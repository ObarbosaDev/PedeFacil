import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import StateCard from "@/components/system/StateCard";
import HelpCenterCard from "@/components/system/HelpCenterCard";
import { formatCurrency, getDeliveryOperationModeLabel, PAYMENT_METHOD_LABELS } from "@/lib/formatters";
import { trackCheckoutEvent } from "@/lib/analytics";
import { generateWhatsAppMessage, openWhatsApp } from "@/lib/whatsapp";
import { createTraceId, logAuditEvent, withTrace } from "@/lib/observability";
import { createExternalOrderCheckout, startOrderCheckoutSession } from "@/lib/order-payments";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag, ShieldCheck, Clock3, MessageCircle, TicketPercent, ClipboardCheck, Sparkles, CreditCard, Bike, WalletCards } from "lucide-react";

const checkoutSchema = z
  .object({
    customerName: z.string().min(2, "Digite pelo menos 2 caracteres."),
    customerPhone: z.string().min(10, "Informe um telefone válido."),
    orderType: z.enum(["pickup", "delivery"]),
    fulfillmentMode: z.enum(["asap", "scheduled"]),
    scheduledFor: z.string().optional(),
    paymentMethod: z.enum(["pix", "credit_card", "debit_card", "cash", "meal_voucher"]),
    observation: z.string().max(500).optional(),
    deliveryStreet: z.string().optional(),
    deliveryNumber: z.string().optional(),
    deliveryNeighborhood: z.string().optional(),
    deliveryCity: z.string().optional(),
    deliveryState: z.string().optional(),
    deliveryZipCode: z.string().optional(),
    deliveryComplement: z.string().optional(),
    deliveryReference: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentMode === "scheduled") {
      const raw = String(data.scheduledFor || "").trim();
      if (!raw) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledFor"],
          message: "Escolha um horário para agendar.",
        });
      } else {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scheduledFor"],
            message: "Horário agendado inválido.",
          });
        } else if (parsed.getTime() < Date.now() + 15 * 60 * 1000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scheduledFor"],
            message: "Agende com pelo menos 15 minutos de antecedência.",
          });
        }
      }
    }

    if (data.orderType !== "delivery") return;

    const requiredFields: Array<{ key: keyof typeof data; label: string }> = [
      { key: "deliveryStreet", label: "Rua" },
      { key: "deliveryNumber", label: "Número" },
      { key: "deliveryNeighborhood", label: "Bairro" },
      { key: "deliveryCity", label: "Cidade" },
      { key: "deliveryState", label: "Estado" },
      { key: "deliveryZipCode", label: "CEP" },
    ];

    for (const field of requiredFields) {
      if (!String(data[field.key] || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field.key],
          message: `${field.label} é obrigatório para entrega.`,
        });
      }
    }
  });

type CheckoutForm = z.infer<typeof checkoutSchema>;
type DiscountType = "percentage" | "fixed";

interface AppliedCoupon {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  minimumOrderValue: number;
  maxDiscountValue: number | null;
  usageLimit: number | null;
  usageCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  discountAmount: number;
}

type StoredOrderIdempotencyContext = {
  key: string;
  fingerprint: string;
  createdAt: string;
};

type DeliveryRuleStatus = "ok" | "zip_missing" | "out_of_area" | "min_order";
type CheckoutUserMetadata = {
  user_type?: string;
};
type CheckoutEstablishmentOps = {
  accepts_marketplace_payments?: boolean | null;
  accepts_meal_voucher?: boolean | null;
  accepting_orders_now?: boolean | null;
  accepts_scheduled_orders?: boolean | null;
  closed_message?: string | null;
  delivery_operation_mode?: string | null;
  pix_key?: string | null;
  pix_recipient_name?: string | null;
  pix_instructions?: string | null;
  busy_mode_enabled?: boolean | null;
  busy_pause_until?: string | null;
};

function calculateDiscount(subtotal: number, coupon: {
  discountType: DiscountType;
  discountValue: number;
  maxDiscountValue: number | null;
}): number {
  let discount = coupon.discountType === "percentage"
    ? subtotal * (coupon.discountValue / 100)
    : coupon.discountValue;

  if (coupon.maxDiscountValue != null) {
    discount = Math.min(discount, coupon.maxDiscountValue);
  }

  return Math.min(Number(discount.toFixed(2)), subtotal);
}

export default function Checkout() {
  const { user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, total, clearCart, addItem } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryFeeMessage, setDeliveryFeeMessage] = useState<string>("");
  const [deliveryRuleStatus, setDeliveryRuleStatus] = useState<DeliveryRuleStatus>("zip_missing");
  const [checkoutSubmitError, setCheckoutSubmitError] = useState<string | null>(null);
  const serviceFee = 0;
  const draftStorageKey = `pedefacil.checkout.draft.${slug || "default"}`;
  const orderIdempotencyStorageKey = `${draftStorageKey}.idempotency`;
  const orderIdempotencyKeyRef = useRef<string>("");
  const orderSubmitLockRef = useRef(false);
  const checkoutPath = `/loja/${slug}/checkout`;
  const loginHref = `/cliente/login?next=${encodeURIComponent(checkoutPath)}`;
  const registerHref = `/cliente/registro?next=${encodeURIComponent(checkoutPath)}&from=checkout`;
  const userType = String(((user?.user_metadata ?? {}) as CheckoutUserMetadata).user_type || "");
  const isCustomerUser = !!user && (!userType || userType === "customer");

  const { data: establishment } = useQuery({
    queryKey: ["public-establishment", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: storeProducts = [] } = useQuery({
    queryKey: ["checkout-products", establishment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, is_available")
        .eq("establishment_id", establishment!.id)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      orderType: "pickup",
      fulfillmentMode: "asap",
      scheduledFor: "",
      paymentMethod: "pix",
      observation: "",
      deliveryStreet: "",
      deliveryNumber: "",
      deliveryNeighborhood: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryZipCode: "",
      deliveryComplement: "",
      deliveryReference: "",
    },
  });

  const watchedValues = useWatch({ control: form.control });
  const orderType = form.watch("orderType");
  const fulfillmentMode = form.watch("fulfillmentMode");
  const selectedPaymentMethod = form.watch("paymentMethod");
  const establishmentOps = establishment as (typeof establishment & CheckoutEstablishmentOps) | null;
  const acceptsMarketplacePayments = Boolean(establishmentOps?.accepts_marketplace_payments);
  const acceptsMealVoucher = Boolean(establishmentOps?.accepts_meal_voucher);
  const acceptingOrdersNow = establishmentOps?.accepting_orders_now !== false;
  const acceptsScheduledOrders = establishmentOps?.accepts_scheduled_orders !== false;
  const closedMessage =
    String(establishmentOps?.closed_message || "").trim() ||
    "Loja fechada no momento. Se quiser, já deixa agendado para amanhã.";
  const deliveryOperationMode = String(establishmentOps?.delivery_operation_mode || "own_fleet");
  const supportsInAppPaymentMethod = selectedPaymentMethod === "pix" || selectedPaymentMethod === "credit_card" || selectedPaymentMethod === "debit_card";
  const shouldUseInAppPayment = acceptsMarketplacePayments && supportsInAppPaymentMethod;
  const storePixKey = String(establishmentOps?.pix_key || "").trim();
  const storePixRecipientName = String(establishmentOps?.pix_recipient_name || "").trim();
  const storePixInstructions =
    String(establishmentOps?.pix_instructions || "").trim() ||
    "Depois de pagar, envie o comprovante no WhatsApp da loja para liberação.";
  const canUseManualPixFallback = selectedPaymentMethod === "pix" && !shouldUseInAppPayment && !!storePixKey;
  const availablePaymentMethods = [
    { id: "pix", label: "PIX" },
    { id: "credit_card", label: "Cartão de crédito" },
    { id: "debit_card", label: "Cartão de débito" },
    { id: "cash", label: "Dinheiro" },
    ...(acceptsMealVoucher ? [{ id: "meal_voucher", label: "Vale-alimentação" }] : []),
  ];
  const nextDayScheduleValue = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    const hours = String(tomorrow.getHours()).padStart(2, "0");
    const minutes = String(tomorrow.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);

  useEffect(() => {
    if (!slug) return;

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        form: CheckoutForm;
        couponCode: string;
        appliedCoupon: AppliedCoupon | null;
      };

      if (parsed?.form) {
        form.reset({
          ...form.getValues(),
          ...parsed.form,
        });
      }

      if (parsed?.couponCode) setCouponCode(parsed.couponCode);
      if (parsed?.appliedCoupon) setAppliedCoupon(parsed.appliedCoupon);
    } catch {
      // ignora rascunho inválido
    }
  }, [draftStorageKey, form, slug]);

  const getOrCreateIdempotencyKey = (fingerprint: string) => {
    const raw = localStorage.getItem(orderIdempotencyStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredOrderIdempotencyContext;
        // Reaproveita a mesma chave somente quando o pedido é o mesmo (retry seguro).
        if (parsed?.key && parsed?.fingerprint === fingerprint) {
          orderIdempotencyKeyRef.current = parsed.key;
          return parsed.key;
        }
      } catch {
        // ignora contexto inválido e gera uma nova chave abaixo
      }
    }

    const nextKey = `ord_${crypto.randomUUID()}`;
    const payload: StoredOrderIdempotencyContext = {
      key: nextKey,
      fingerprint,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(orderIdempotencyStorageKey, JSON.stringify(payload));
    orderIdempotencyKeyRef.current = nextKey;
    return nextKey;
  };

  const getFriendlyCheckoutError = (error: any) => {
    const raw = String(error?.message || "").toLowerCase();
    if (
      raw.includes("failed to fetch") ||
      raw.includes("network") ||
      raw.includes("networkerror") ||
      raw.includes("fetch")
    ) {
      return "Conexão oscilou. Pode tentar de novo: se o pedido já tiver sido criado, a gente recupera sem duplicar.";
    }
    return error?.message || "Não rolou enviar o pedido.";
  };

  const enforceActionRateLimit = async (actionKey: string, maxHits: number, windowSeconds: number) => {
    if (!user?.id) return;
    const { data, error } = await (supabase as any).rpc("enforce_rate_limit", {
      p_action_key: actionKey,
      p_subject_key: user.id,
      p_max_hits: maxHits,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : null;
    if (row && row.allowed === false) {
      const retry = Number(row.retry_after_seconds || 0);
      throw new Error(`Você tentou rápido demais. Aguarde ${retry}s e tente novamente.`);
    }
  };

  useEffect(() => {
    if (!slug) return;
    if (!items.length) return;

    localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        form: watchedValues,
        couponCode,
        appliedCoupon,
      })
    );
  }, [appliedCoupon, couponCode, draftStorageKey, items.length, slug, watchedValues]);

  const { data: customerProfile } = useQuery({
    queryKey: ["checkout-customer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: customerDefaultAddress } = useQuery({
    queryKey: ["checkout-customer-default-address", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_addresses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!customerProfile) return;
    if (!form.getValues("customerName")) form.setValue("customerName", customerProfile.full_name || "");
    if (!form.getValues("customerPhone")) form.setValue("customerPhone", customerProfile.phone || "");
  }, [customerProfile, form]);

  useEffect(() => {
    if (!customerDefaultAddress) return;
    if (!form.getValues("deliveryStreet")) form.setValue("deliveryStreet", customerDefaultAddress.street || "");
    if (!form.getValues("deliveryNumber")) form.setValue("deliveryNumber", customerDefaultAddress.number || "");
    if (!form.getValues("deliveryNeighborhood")) form.setValue("deliveryNeighborhood", customerDefaultAddress.neighborhood || "");
    if (!form.getValues("deliveryCity")) form.setValue("deliveryCity", customerDefaultAddress.city || "");
    if (!form.getValues("deliveryState")) form.setValue("deliveryState", customerDefaultAddress.state || "");
    if (!form.getValues("deliveryZipCode")) form.setValue("deliveryZipCode", customerDefaultAddress.zip_code || "");
    if (!form.getValues("deliveryComplement")) form.setValue("deliveryComplement", customerDefaultAddress.complement || "");
    if (!form.getValues("deliveryReference")) form.setValue("deliveryReference", customerDefaultAddress.reference || "");
  }, [customerDefaultAddress, form]);

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ["checkout-delivery-zones", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_delivery_zones")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  useEffect(() => {
    if (!establishment?.id) return;
    void trackCheckoutEvent({
      establishmentId: establishment.id,
      userId: user?.id ?? null,
      eventName: "checkout_view",
      metadata: { slug: establishment.slug, itemsInCart: items.length },
    });
  }, [establishment?.id, establishment?.slug, items.length, user?.id]);

  const deliverySummary = useMemo(() => {
    if (orderType !== "delivery") return null;

    const values = form.getValues();
    const line1 = `${values.deliveryStreet || ""}, ${values.deliveryNumber || ""}`.trim();
    const line2 = `${values.deliveryNeighborhood || ""} - ${values.deliveryCity || ""}/${values.deliveryState || ""}`.trim();

    return { line1, line2, zipCode: values.deliveryZipCode || "" };
  }, [form, orderType]);

  useEffect(() => {
    if (!appliedCoupon) return;

    if (total < appliedCoupon.minimumOrderValue) {
      toast.error("O subtotal atual ficou abaixo do mínimo exigido para este cupom.");
      setAppliedCoupon(null);
      return;
    }

    const updatedDiscount = calculateDiscount(total, {
      discountType: appliedCoupon.discountType,
      discountValue: appliedCoupon.discountValue,
      maxDiscountValue: appliedCoupon.maxDiscountValue,
    });

    setAppliedCoupon((prev) => (prev ? { ...prev, discountAmount: updatedDiscount } : prev));
  }, [total, appliedCoupon]);

  useEffect(() => {
    if (orderType !== "delivery") {
      setDeliveryFee(0);
      setDeliveryFeeMessage("");
      setDeliveryRuleStatus("ok");
      return;
    }

    const zip = String(form.getValues("deliveryZipCode") || "").replace(/\D/g, "");
    if (zip.length < 5) {
      setDeliveryFee(0);
      setDeliveryFeeMessage("Informe o CEP para calcular a taxa de entrega.");
      setDeliveryRuleStatus("zip_missing");
      return;
    }

    const zone = (deliveryZones as any[])
      .filter((candidate) => zip.startsWith(String(candidate.zip_prefix || "").replace(/\D/g, "")))
      .sort((a, b) => String(b.zip_prefix).length - String(a.zip_prefix).length)[0];

    if (!zone) {
      setDeliveryFee(0);
      setDeliveryFeeMessage("Ainda não entregamos nessa região.");
      setDeliveryRuleStatus("out_of_area");
      return;
    }

    const minOrderValue = Number(zone.min_order_value || 0);
    if (total < minOrderValue) {
      setDeliveryFee(Number(zone.fee || 0));
      setDeliveryFeeMessage(`Pedido mínimo para ${zone.name}: ${formatCurrency(minOrderValue)}.`);
      setDeliveryRuleStatus("min_order");
      return;
    }

    const freeOverValue = zone.free_over_value != null ? Number(zone.free_over_value) : null;
    if (freeOverValue != null && total >= freeOverValue) {
      setDeliveryFee(0);
      setDeliveryFeeMessage(`Frete grátis para ${zone.name} em pedidos acima de ${formatCurrency(freeOverValue)}.`);
      setDeliveryRuleStatus("ok");
      return;
    }

    setDeliveryFee(Number(zone.fee || 0));
    setDeliveryFeeMessage(`Taxa de entrega para ${zone.name}.`);
    setDeliveryRuleStatus("ok");
  }, [deliveryZones, form, orderType, total]);

  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const finalTotal = Math.max(Number((total - discountAmount + deliveryFee + serviceFee).toFixed(2)), 0);
  const recommendations = useMemo(() => {
    if (!storeProducts.length || !items.length) return [];

    const inCartIds = new Set(items.map((item) => item.id));
    const tokens = new Set(
      items
        .flatMap((item) => String(item.name || "").toLowerCase().split(/\s+/))
        .filter((token) => token.length >= 4)
    );
    const cartAveragePrice = items.length
      ? items.reduce((acc, item) => acc + Number(item.price || 0), 0) / items.length
      : 0;

    return (storeProducts as any[])
      .filter((product) => !inCartIds.has(product.id))
      .map((product) => {
        const nameTokens = String(product.name || "").toLowerCase().split(/\s+/);
        const overlap = nameTokens.reduce((acc, token) => acc + (tokens.has(token) ? 1 : 0), 0);
        const priceDistance = Math.abs(Number(product.price || 0) - cartAveragePrice);
        return { ...product, score: overlap * 10 - priceDistance / 10 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [items, storeProducts]);
  const values = form.watch();
  const formErrors = form.formState.errors;
  const requiredBaseFields = ["customerName", "customerPhone"] as const;
  const requiredDeliveryFields = ["deliveryStreet", "deliveryNumber", "deliveryNeighborhood", "deliveryCity", "deliveryState", "deliveryZipCode"] as const;
  const totalRequiredFields = requiredBaseFields.length + (orderType === "delivery" ? requiredDeliveryFields.length : 0);
  const filledBaseFields = requiredBaseFields.filter((field) => String(values[field] || "").trim()).length;
  const filledDeliveryFields = orderType === "delivery"
    ? requiredDeliveryFields.filter((field) => String(values[field] || "").trim()).length
    : 0;
  const formCompletion = totalRequiredFields > 0
    ? Math.round(((filledBaseFields + filledDeliveryFields) / totalRequiredFields) * 100)
    : 0;

  const applyCouponMutation = useMutation({
    mutationFn: async () => {
      if (!establishment) throw new Error("Loja não encontrada.");
      const traceId = createTraceId();
      await enforceActionRateLimit("checkout_apply_coupon", 10, 300);

      const normalizedCode = couponCode.trim().toUpperCase();
      if (!normalizedCode) throw new Error("Digite um código de cupom.");

      const { data: coupon, error } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("establishment_id", establishment.id)
        .eq("code", normalizedCode)
        .maybeSingle();

      if (error) throw error;
      if (!coupon) throw new Error("Cupom inválido ou indisponível.");

      const now = new Date();
      if (!coupon.is_active) throw new Error("Esse cupom não está ativo.");
      if (coupon.starts_at && new Date(coupon.starts_at) > now) throw new Error("Esse cupom ainda não começou.");
      if (coupon.expires_at && new Date(coupon.expires_at) < now) throw new Error("Esse cupom já expirou.");
      if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
        throw new Error("Esse cupom atingiu o limite de uso.");
      }
      if (total < Number(coupon.minimum_order_value || 0)) {
        throw new Error(`Pedido mínimo para esse cupom: ${formatCurrency(Number(coupon.minimum_order_value || 0))}.`);
      }

      const computedDiscount = calculateDiscount(total, {
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value),
        maxDiscountValue: coupon.max_discount_value != null ? Number(coupon.max_discount_value) : null,
      });

      const parsed: AppliedCoupon = {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value),
        minimumOrderValue: Number(coupon.minimum_order_value || 0),
        maxDiscountValue: coupon.max_discount_value != null ? Number(coupon.max_discount_value) : null,
        usageLimit: coupon.usage_limit,
        usageCount: coupon.usage_count,
        startsAt: coupon.starts_at,
        expiresAt: coupon.expires_at,
        discountAmount: computedDiscount,
      };

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "coupon",
        entityId: coupon.id,
        action: "coupon_applied_checkout",
        metadata: withTrace(
          {
            establishmentId: establishment.id,
            couponCode: coupon.code,
            discountAmount: computedDiscount,
            subtotal: total,
          },
          traceId
        ),
      });

      return parsed;
    },
    onSuccess: (coupon) => {
      setAppliedCoupon(coupon);
      setCouponCode(coupon.code);
      toast.success(`Cupom ${coupon.code} aplicado com sucesso.`);
    },
    onError: (error: any) => toast.error(error.message || "Não rolou aplicar o cupom."),
  });

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    toast.success("Cupom removido.");
  };

  const orderMutation = useMutation({
    onMutate: () => {
      setCheckoutSubmitError(null);
    },
    mutationFn: async (data: CheckoutForm) => {
      if (orderSubmitLockRef.current) {
        throw new Error("Seu pedido já está sendo enviado. Aguarde alguns segundos.");
      }
      orderSubmitLockRef.current = true;

      try {
      await enforceActionRateLimit("checkout_submit_order", 5, 120);
      const traceId = createTraceId();
      if (!user) throw new Error("Faça login para finalizar o pedido.");

      await (supabase as any).from("customer_profiles").upsert(
        {
          user_id: user.id,
          full_name: data.customerName,
          phone: data.customerPhone,
        },
        { onConflict: "user_id" }
      );

      const normalizedPhone = data.customerPhone.trim();
      const normalizedName = data.customerName.trim();
      const { data: customerIdResult, error: customerIdErr } = await (supabase as any).rpc("upsert_customer_contact", {
        p_name: normalizedName,
        p_phone: normalizedPhone,
        p_email: user.email ?? null,
      });
      if (customerIdErr) throw customerIdErr;
      const customerId = String(customerIdResult || "").trim();
      if (!customerId) throw new Error("Nao rolou preparar o cadastro do cliente para este pedido.");

      const isDelivery = data.orderType === "delivery";
      const isScheduledOrder = data.fulfillmentMode === "scheduled";
      const establishmentOps = establishment as CheckoutEstablishmentOps | null;
      const manuallyClosed = establishmentOps?.accepting_orders_now === false;
      const isStorePausedNow = Boolean(
        establishmentOps?.busy_mode_enabled &&
        establishmentOps?.busy_pause_until &&
        new Date(establishmentOps.busy_pause_until).getTime() > Date.now()
      );

      if (manuallyClosed && !isScheduledOrder) {
        throw new Error(closedMessage);
      }

      if (manuallyClosed && isScheduledOrder) {
        const scheduledDate = new Date(String(data.scheduledFor || ""));
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < tomorrow.getTime()) {
          throw new Error("Com a loja fechada, o pedido precisa ficar agendado para amanhã em diante.");
        }
      }

      if (isStorePausedNow && !isScheduledOrder) {
        const resumeAt = establishmentOps?.busy_pause_until
          ? new Date(establishmentOps.busy_pause_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : null;
        throw new Error(
          resumeAt
            ? `Loja lotada agora. Novos pedidos imediatos voltam às ${resumeAt}.`
            : "Loja lotada agora. Tente novamente em instantes."
        );
      }

      if (isScheduledOrder && establishmentOps?.accepts_scheduled_orders === false) {
        throw new Error("Esta loja está com agendamento desativado no momento.");
      }

      if (isDelivery) {
        if (deliveryRuleStatus === "out_of_area") {
          throw new Error("A loja ainda não entrega nessa região.");
        }
        if (deliveryRuleStatus === "min_order") {
          throw new Error(deliveryFeeMessage);
        }
      }

      if (isDelivery) {
        await (supabase as any)
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);

        await (supabase as any).from("customer_addresses").insert({
          user_id: user.id,
          label: "Último usado",
          street: data.deliveryStreet,
          number: data.deliveryNumber,
          neighborhood: data.deliveryNeighborhood,
          city: data.deliveryCity,
          state: data.deliveryState,
          zip_code: data.deliveryZipCode,
          complement: data.deliveryComplement || null,
          reference: data.deliveryReference || null,
          is_default: true,
        });
      }

      const orderPayload: any = {
        establishment_id: establishment!.id,
        customer_id: customerId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        order_type: data.orderType,
        is_scheduled: isScheduledOrder,
        scheduled_for: isScheduledOrder ? new Date(String(data.scheduledFor || "")).toISOString() : null,
        observation: data.observation || null,
        payment_method: data.paymentMethod,
        payment_status: "pending",
        subtotal: total,
        discount_amount: discountAmount,
        delivery_fee: isDelivery ? deliveryFee : 0,
        service_fee: serviceFee,
        coupon_id: appliedCoupon?.id || null,
        coupon_code: appliedCoupon?.code || null,
        total: finalTotal,
        delivery_street: isDelivery ? data.deliveryStreet || null : null,
        delivery_number: isDelivery ? data.deliveryNumber || null : null,
        delivery_neighborhood: isDelivery ? data.deliveryNeighborhood || null : null,
        delivery_city: isDelivery ? data.deliveryCity || null : null,
        delivery_state: isDelivery ? data.deliveryState || null : null,
        delivery_zip_code: isDelivery ? data.deliveryZipCode || null : null,
        delivery_complement: isDelivery ? data.deliveryComplement || null : null,
        delivery_reference: isDelivery ? data.deliveryReference || null : null,
      };

      const orderItemsPayload = items.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const orderFingerprint = JSON.stringify({
        establishmentId: establishment!.id,
        userId: user.id,
        orderType: data.orderType,
        fulfillmentMode: data.fulfillmentMode,
        scheduledFor: isScheduledOrder ? data.scheduledFor : null,
        paymentMethod: data.paymentMethod,
        total: finalTotal,
        items: items.map((item) => ({ id: item.id, q: item.quantity, p: Number(item.price || 0) })),
      });
      const idempotencyKey = getOrCreateIdempotencyKey(orderFingerprint);

      const { data: placedOrderRows, error: placeOrderError } = await (supabase as any).rpc("create_order_idempotent", {
        p_idempotency_key: idempotencyKey,
        p_order: orderPayload,
        p_items: orderItemsPayload,
      });
      if (placeOrderError) throw placeOrderError;

      const placedOrder = Array.isArray(placedOrderRows) ? placedOrderRows[0] : null;
      if (!placedOrder?.order_id) {
        throw new Error("Não foi possível gerar o pedido agora.");
      }

      const { data: order, error: orderFetchError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", placedOrder.order_id)
        .single();
      if (orderFetchError) throw orderFetchError;

      const { error: linkErr } = await (supabase as any).from("customer_order_links").upsert(
        {
          user_id: user.id,
          order_id: order.id,
          establishment_id: establishment!.id,
          metadata: withTrace(
            {
              orderType: data.orderType,
              couponCode: appliedCoupon?.code || null,
              subtotal: total,
              discountAmount,
              total: finalTotal,
            },
            traceId
          ),
        },
        { onConflict: "user_id,order_id" }
      );
      if (linkErr) throw linkErr;

      await supabase.from("loyalty_accounts").upsert(
        {
          customer_id: customerId,
          establishment_id: establishment!.id,
          points: Math.floor(finalTotal),
        },
        { onConflict: "customer_id,establishment_id" }
      );

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "order",
        entityId: order.id,
        action: placedOrder.created ? "order_created_checkout" : "order_reused_idempotency_checkout",
        metadata: withTrace(
          {
            establishmentId: establishment!.id,
            idempotencyKey,
            orderType: data.orderType,
            paymentMethod: data.paymentMethod,
            couponCode: appliedCoupon?.code || null,
            itemCount: items.length,
            subtotal: total,
            discountAmount,
            deliveryFee: isDelivery ? deliveryFee : 0,
            serviceFee,
            total: finalTotal,
          },
          traceId
        ),
      });

      let paymentRedirectUrl: string | null = null;
      let manualPixFallback = false;
      let paymentFlow: "in_app" | "manual_pix" | "whatsapp" = "whatsapp";

      if (acceptsMarketplacePayments && (data.paymentMethod === "pix" || data.paymentMethod === "credit_card" || data.paymentMethod === "debit_card")) {
        try {
          const checkoutPaymentMethod = data.paymentMethod === "pix" ? "pix" : "card";
          const paymentSession = await startOrderCheckoutSession({
            orderId: order.id,
            paymentMethod: checkoutPaymentMethod,
          });

          const paymentBaseUrl = `${window.location.origin}/cliente/pagamento-pedido?order=${order.id}&checkout_session_id=${paymentSession.checkout_session_id}`;
          const paymentCheckout = await createExternalOrderCheckout({
            checkoutSessionId: paymentSession.checkout_session_id,
            orderId: order.id,
            successUrl: `${paymentBaseUrl}&payment_return=success`,
            pendingUrl: `${paymentBaseUrl}&payment_return=pending`,
            failureUrl: `${paymentBaseUrl}&payment_return=failure`,
          });

          paymentRedirectUrl = paymentCheckout.checkout_url;
          paymentFlow = "in_app";

          await trackCheckoutEvent({
            establishmentId: establishment!.id,
            userId: user.id,
            eventName: "order_submitted",
            metadata: {
              orderId: order.id,
              idempotencyKey,
              created: !!placedOrder.created,
              orderType: data.orderType,
              paymentMethod: data.paymentMethod,
              total: finalTotal,
              paymentFlow: "in_app",
              checkoutSessionId: paymentSession.checkout_session_id,
            },
          });
        } catch (paymentError: any) {
          // Se a loja ainda não tiver gateway pronto, cai para PIX manual sem perder o pedido.
          if (data.paymentMethod === "pix" && storePixKey) {
            manualPixFallback = true;
            paymentFlow = "manual_pix";
          } else {
            throw paymentError;
          }
        }
      } else {
        if (data.paymentMethod === "pix" && storePixKey) {
          manualPixFallback = true;
          paymentFlow = "manual_pix";
        }
        await trackCheckoutEvent({
          establishmentId: establishment!.id,
          userId: user.id,
          eventName: "order_submitted",
          metadata: {
            orderId: order.id,
            idempotencyKey,
            created: !!placedOrder.created,
            orderType: data.orderType,
            paymentMethod: data.paymentMethod,
            total: finalTotal,
            paymentFlow,
          },
        });
      }

      return { order, data, created: !!placedOrder.created, paymentRedirectUrl, manualPixFallback };
      } finally {
        orderSubmitLockRef.current = false;
      }
    },
    onSuccess: (result) => {
      const successMessage = result.created
        ? "Pedido registrado com sucesso."
        : "Pedido já estava salvo e foi recuperado sem duplicar.";

      clearCart();
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(orderIdempotencyStorageKey);
      orderIdempotencyKeyRef.current = "";

      if (result.paymentRedirectUrl) {
        toast.success(`${successMessage} Agora vamos abrir o pagamento.`);
        window.location.href = result.paymentRedirectUrl;
        return;
      }

      if (result.manualPixFallback) {
        toast.success(`${successMessage} Agora é só copiar a chave PIX da loja e pagar pelo seu banco.`);
        navigate(`/cliente/pagamento-pedido?order=${result.order.id}&manual_pix=1`);
        return;
      }

      const message = generateWhatsAppMessage({
        storeName: establishment!.name,
        whatsappNumber: establishment!.whatsapp,
        customerName: result.data.customerName,
        customerPhone: result.data.customerPhone,
        orderType: result.data.orderType,
        observation: result.data.observation,
        deliveryAddress:
          result.data.orderType === "delivery"
            ? {
                street: result.data.deliveryStreet,
                number: result.data.deliveryNumber,
                neighborhood: result.data.deliveryNeighborhood,
                city: result.data.deliveryCity,
                state: result.data.deliveryState,
                zipCode: result.data.deliveryZipCode,
                complement: result.data.deliveryComplement,
                reference: result.data.deliveryReference,
              }
            : undefined,
        items,
        subtotal: total,
        discountAmount,
        deliveryFee: result.data.orderType === "delivery" ? deliveryFee : 0,
        serviceFee,
        paymentMethod: result.data.paymentMethod,
        couponCode: appliedCoupon?.code,
        total: finalTotal,
      });

      openWhatsApp(establishment!.whatsapp, message);
      toast.success(successMessage);
      navigate(`/loja/${slug}`);
    },
    onError: (err: any) => {
      const message = getFriendlyCheckoutError(err);
      setCheckoutSubmitError(message);
      toast.error(message);
    },
  });

  const deliveryUnavailable = orderType === "delivery" && deliveryRuleStatus === "out_of_area";
  const deliveryMinimumNotReached = orderType === "delivery" && deliveryRuleStatus === "min_order";
  const storePausedNow = Boolean(
    fulfillmentMode !== "scheduled" &&
    establishmentOps?.busy_mode_enabled &&
    establishmentOps?.busy_pause_until &&
    new Date(establishmentOps.busy_pause_until).getTime() > Date.now()
  );
  const isSubmittingOrder = orderMutation.isPending || orderSubmitLockRef.current;
  const storeClosedNow = !acceptingOrdersNow && fulfillmentMode !== "scheduled";
  const canSubmitOrder = !isSubmittingOrder && !deliveryUnavailable && !deliveryMinimumNotReached && !storePausedNow && !storeClosedNow;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Entre na sua conta para concluir o pedido</CardTitle>
            <CardDescription>
              Para segurança do comércio e rastreio do pedido, só finalizamos compras com conta de cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate(loginHref)}>
              Entrar na conta
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate(registerHref)}>
              Criar conta de cliente
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate(`/loja/${slug}`)}>
              Voltar ao cardápio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isCustomerUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Use uma conta de cliente para comprar</CardTitle>
            <CardDescription>
              Essa sessão está vinculada a outro tipo de perfil. Faça login com conta de cliente para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => navigate("/cliente/login")}>
              Entrar com conta de cliente
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate(`/loja/${slug}`)}>
              Voltar ao cardápio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center bg-muted/30">
        <div>
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h2>
          <p className="text-muted-foreground mb-4">Escolha alguns itens e volte para fechar o pedido.</p>
          <Button onClick={() => navigate(`/loja/${slug}`)}>Voltar ao cardápio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <a
        href="#conteudo-principal-checkout"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-zinc-900 focus:text-zinc-100 focus:px-4 focus:py-2 focus:rounded-md"
      >
        Ir para o conteúdo principal
      </a>
      <div id="conteudo-principal-checkout" className="max-w-6xl mx-auto px-4 py-8 pb-28 md:pb-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" onClick={() => navigate(`/loja/${slug}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar ao cardápio
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Finalização segura</Badge>
          </div>
        </div>

        <section className="rounded-2xl border bg-card p-6 md:p-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl md:text-4xl font-black">Quase lá! Bora fechar seu pedido?</h1>
              <p className="text-muted-foreground mt-2">Confere os dados rapidinho e já manda no WhatsApp da loja.</p>
            </div>
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Itens no carrinho</p>
              <p className="text-xl font-bold">{items.reduce((sum, i) => sum + i.quantity, 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total final</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(finalTotal)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Confirmação</p>
              <p className="text-xl font-bold">Rápida</p>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Progresso da finalização
              </p>
              <p className="text-sm font-bold">{formCompletion}%</p>
            </div>
            <Progress value={formCompletion} />
            <p className="text-xs text-muted-foreground">
              Preencha os campos principais para agilizar o envio sem retrabalho.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 mt-4">
            <p className="text-sm font-semibold mb-3">Depois de enviar, funciona assim:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border bg-background p-2">
                <p className="font-semibold">1. Pedido recebido</p>
                <p className="text-muted-foreground mt-1">A loja recebe seu pedido na hora.</p>
              </div>
              <div className="rounded-lg border bg-background p-2">
                <p className="font-semibold">2. Preparação</p>
                <p className="text-muted-foreground mt-1">A equipe confirma e começa a preparar.</p>
              </div>
              <div className="rounded-lg border bg-background p-2">
                <p className="font-semibold">3. Entrega/retirada</p>
                <p className="text-muted-foreground mt-1">Você acompanha e finaliza sem dor de cabeça.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 mt-4">
            <div className="rounded-2xl border bg-zinc-950 text-zinc-100 p-5 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Operação da loja</p>
              <h2 className="text-2xl font-black mt-2">Checkout com leitura de plataforma.</h2>
              <p className="text-zinc-300 mt-2">
                Esta loja roda em <span className="font-semibold text-white">{getDeliveryOperationModeLabel(deliveryOperationMode)}</span>.
                {acceptsMarketplacePayments
                  ? " A estrutura de meios digitais da operação já está ligada."
                  : " O pedido entra por aqui e a confirmação financeira segue o fluxo da loja."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className="bg-white text-zinc-900 inline-flex items-center gap-1">
                  <Bike className="h-3.5 w-3.5" />
                  {getDeliveryOperationModeLabel(deliveryOperationMode)}
                </Badge>
                <Badge variant="outline" className="border-zinc-700 text-zinc-200 inline-flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  {acceptsMarketplacePayments ? "Pagamento digital ativo" : "Pagamento alinhado com a loja"}
                </Badge>
                {acceptsMealVoucher ? (
                  <Badge variant="outline" className="border-zinc-700 text-zinc-200 inline-flex items-center gap-1">
                    <WalletCards className="h-3.5 w-3.5" />
                    Vale-alimentação habilitado
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Leitura rapida</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Meios ativos</span>
                  <span className="font-semibold text-right">{availablePaymentMethods.map((method) => method.label).join(" • ")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Entrega</span>
                  <span className="font-semibold">{orderType === "delivery" ? "Com rota organizada no app" : "Retirada no balcao"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Pagamento escolhido</span>
                  <span className="font-semibold">{PAYMENT_METHOD_LABELS[String(selectedPaymentMethod)] || "PIX"}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {orderType === "delivery" && deliveryFeeMessage
              ? `Status da entrega: ${deliveryFeeMessage}`
              : "Finalização pronta para envio."}
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-2 h-fit">
            <CardHeader>
              <CardTitle>Resumo do pedido</CardTitle>
              <CardDescription>Confira os itens antes de enviar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}

              {recommendations.length > 0 && (
                <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Compre junto
                  </p>
                  <div className="space-y-2">
                    {recommendations.map((product: any) => (
                      <div key={`upsell-${product.id}`} className="rounded-md border bg-card p-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(Number(product.price || 0))}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            addItem({
                              id: product.id,
                              name: product.name,
                              price: Number(product.price || 0),
                              image_url: product.image_url || null,
                            })
                          }
                        >
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <TicketPercent className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Cupom de desconto</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="Digite seu cupom"
                    disabled={!!appliedCoupon}
                  />
                  {appliedCoupon ? (
                    <Button variant="outline" onClick={removeCoupon}>Remover</Button>
                  ) : (
                    <Button onClick={() => applyCouponMutation.mutate()} disabled={applyCouponMutation.isPending || !couponCode.trim()}>
                      Aplicar
                    </Button>
                  )}
                </div>

                {appliedCoupon && (
                  <div className="text-sm rounded-md bg-emerald-50 border border-emerald-200 p-2">
                    <p className="font-medium text-emerald-700">Cupom {appliedCoupon.code} aplicado.</p>
                    <p className="text-emerald-700">Desconto: {formatCurrency(appliedCoupon.discountAmount)}</p>
                    {appliedCoupon.description && <p className="text-emerald-700/90">{appliedCoupon.description}</p>}
                  </div>
                )}
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className={discountAmount > 0 ? "text-emerald-600" : ""}>- {formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de entrega</span>
                  <span>{formatCurrency(orderType === "delivery" ? deliveryFee : 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de serviço</span>
                  <span>{formatCurrency(serviceFee)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              {deliverySummary && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="font-medium mb-1">Endereço de entrega</p>
                  <p className="text-muted-foreground">{deliverySummary.line1}</p>
                  <p className="text-muted-foreground">{deliverySummary.line2}</p>
                  <p className="text-muted-foreground">CEP: {deliverySummary.zipCode}</p>
                  {deliveryFeeMessage && <p className="text-xs text-muted-foreground">{deliveryFeeMessage}</p>}
                </div>
              )}

              {orderType === "delivery" && deliveryFeeMessage && (
                <div
                  className={`rounded-md border p-2 text-xs ${
                    deliveryRuleStatus === "out_of_area" || deliveryRuleStatus === "min_order"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-primary/30 bg-primary/5 text-foreground"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {deliveryFeeMessage}
                </div>
              )}

              <div className="rounded-lg border bg-muted/40 p-3 mt-4 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Seus dados são usados apenas para este pedido.</p>
                <p className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> A loja recebe seu pedido na hora.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Seus dados</CardTitle>
              <CardDescription>Sem enrolação: preenche e envia.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  id="checkout-main-form"
                  onSubmit={form.handleSubmit((d) => {
                    if (orderMutation.isPending || orderSubmitLockRef.current) return;
                    orderMutation.mutate(d);
                  })}
                  className="space-y-4"
                >
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input placeholder="Como você quer ser chamado?" {...field} /></FormControl>
                      {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl><Input placeholder="(11) 99999-8888" {...field} /></FormControl>
                      {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="orderType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Como você vai receber?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Label htmlFor="pickup" className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                            <RadioGroupItem value="pickup" id="pickup" />
                            Retirada no local
                          </Label>
                          <Label htmlFor="delivery" className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                            <RadioGroupItem value="delivery" id="delivery" />
                            Entrega
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="fulfillmentMode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quando preparar?</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Label htmlFor="asap" className={`flex items-center gap-2 rounded-lg border p-3 ${acceptingOrdersNow ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                            <RadioGroupItem value="asap" id="asap" />
                            Pedir agora
                          </Label>
                          <Label htmlFor="scheduled" className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                            <RadioGroupItem value="scheduled" id="scheduled" />
                            ${acceptingOrdersNow ? "Quero agendar" : "Agendar para amanhã"}
                          </Label>
                        </RadioGroup>
                      </FormControl>
                      {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  {fulfillmentMode === "scheduled" && (
                    <FormField control={form.control} name="scheduledFor" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário agendado</FormLabel>
                        <FormControl><Input type="datetime-local" min={acceptingOrdersNow ? undefined : nextDayScheduleValue} {...field} /></FormControl>
                        {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de pagamento</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {availablePaymentMethods.map((method) => (
                            <Label key={method.id} htmlFor={method.id} className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer">
                              <RadioGroupItem value={method.id} id={method.id} />
                              {method.label}
                            </Label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {shouldUseInAppPayment
                          ? "Esse pagamento fecha dentro da jornada, com cobrança segura e retorno automático para o pedido."
                          : canUseManualPixFallback
                            ? "PIX manual ativo: você paga no app do seu banco e a loja confirma por aqui."
                            : acceptsMarketplacePayments
                              ? "PIX e cartão já podem rodar no app. Dinheiro e vale seguem no pedido para a loja confirmar."
                              : "A forma escolhida entra no pedido para a loja tocar a confirmação."}
                      </p>
                      {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  {canUseManualPixFallback && (
                    <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 p-4 space-y-3">
                      <p className="text-sm font-semibold">PIX da loja (todos os bancos)</p>
                      <div className="rounded-lg border border-emerald-200 bg-white p-3">
                        <p className="text-xs text-muted-foreground">Chave PIX</p>
                        <p className="font-semibold break-all">{storePixKey}</p>
                        {storePixRecipientName ? (
                          <p className="text-xs text-muted-foreground mt-1">Recebedor: {storePixRecipientName}</p>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{storePixInstructions}</p>
                    </div>
                  )}

                  {orderType === "delivery" && (
                    <div className="rounded-xl border p-4 space-y-4 bg-muted/20">
                      <h3 className="font-semibold">Dados de entrega</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <FormField control={form.control} name="deliveryStreet" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rua</FormLabel>
                              <FormControl><Input placeholder="Rua das Flores" className={formErrors.deliveryStreet ? "border-destructive focus-visible:ring-destructive/40" : ""} {...field} /></FormControl>
                              {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="deliveryNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl><Input placeholder="123" className={formErrors.deliveryNumber ? "border-destructive focus-visible:ring-destructive/40" : ""} {...field} /></FormControl>
                            {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={form.control} name="deliveryNeighborhood" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl><Input placeholder="Centro" className={formErrors.deliveryNeighborhood ? "border-destructive focus-visible:ring-destructive/40" : ""} {...field} /></FormControl>
                            {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="deliveryZipCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl><Input placeholder="00000-000" className={formErrors.deliveryZipCode ? "border-destructive focus-visible:ring-destructive/40" : ""} {...field} /></FormControl>
                            {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <FormField control={form.control} name="deliveryCity" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cidade</FormLabel>
                              <FormControl><Input placeholder="São Paulo" className={formErrors.deliveryCity ? "border-destructive focus-visible:ring-destructive/40" : ""} {...field} /></FormControl>
                              {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="deliveryState" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl><Input placeholder="SP" maxLength={2} className={formErrors.deliveryState ? "border-destructive focus-visible:ring-destructive/40" : ""} {...field} /></FormControl>
                            {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="deliveryComplement" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento (opcional)</FormLabel>
                          <FormControl><Input placeholder="Apto 12, Bloco B" {...field} /></FormControl>
                          {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="deliveryReference" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referência (opcional)</FormLabel>
                          <FormControl><Input placeholder="Próximo ao mercado" {...field} /></FormControl>
                          {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <FormField control={form.control} name="observation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações (opcional)</FormLabel>
                      <FormControl><Textarea placeholder="Ex: sem cebola, ponto da carne..." {...field} /></FormControl>
                      {!acceptingOrdersNow && (
                        <p className="text-xs text-amber-700">
                          Loja fechada agora. Pedido imediato travado; só agendamento para amanhã.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
                    disabled={!canSubmitOrder}
                  >
                    {isSubmittingOrder
                      ? "Fechando pedido..."
                      : shouldUseInAppPayment
                        ? "Fechar e pagar no app"
                        : canUseManualPixFallback
                          ? "Fechar pedido e ver chave PIX"
                          : fulfillmentMode === "scheduled"
                            ? "Agendar pedido"
                            : "Enviar pedido no WhatsApp"}
                  </Button>
                  {deliveryUnavailable && (
                    <p className="text-xs text-destructive" role="status">
                      Esse CEP está fora da área de entrega desta loja.
                    </p>
                  )}
                  {storePausedNow && (
                    <p className="text-xs text-destructive" role="status">
                      Loja lotada agora. Você pode agendar o pedido para mais tarde.
                    </p>
                  )}
{checkoutSubmitError ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 space-y-2" role="status" aria-live="polite">
                      <p className="text-sm text-destructive">{checkoutSubmitError}</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCheckoutSubmitError(null)}
                      >
                        Entendi
                      </Button>
                    </div>
                  ) : null}
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur p-3 md:hidden">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Total do pedido</p>
            <p className="font-semibold truncate">{formatCurrency(finalTotal)}</p>
          </div>
          <Button
            type="submit"
            form="checkout-main-form"
            className="ml-auto"
            disabled={!canSubmitOrder}
          >
            {isSubmittingOrder
              ? "Fechando..."
              : shouldUseInAppPayment
                ? "Pagar no app"
                : canUseManualPixFallback
                  ? "Ver chave PIX"
                  : fulfillmentMode === "scheduled"
                    ? "Agendar pedido"
                    : "Finalizar pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
}











