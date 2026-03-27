import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useForm } from "react-hook-form";
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
import { formatCurrency } from "@/lib/formatters";
import { generateWhatsAppMessage, openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag, ShieldCheck, Clock3, MessageCircle, TicketPercent } from "lucide-react";

const checkoutSchema = z
  .object({
    customerName: z.string().min(2, "Digite pelo menos 2 caracteres."),
    customerPhone: z.string().min(10, "Informe um telefone válido."),
    orderType: z.enum(["pickup", "delivery"]),
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
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

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

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      orderType: "pickup",
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

  const orderType = form.watch("orderType");

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

  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const finalTotal = Math.max(Number((total - discountAmount).toFixed(2)), 0);

  const applyCouponMutation = useMutation({
    mutationFn: async () => {
      if (!establishment) throw new Error("Loja não encontrada.");

      const normalizedCode = couponCode.trim().toUpperCase();
      if (!normalizedCode) throw new Error("Digite um código de cupom.");

      const { data: coupon, error } = await supabase
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

      return parsed;
    },
    onSuccess: (coupon) => {
      setAppliedCoupon(coupon);
      setCouponCode(coupon.code);
      toast.success(`Cupom ${coupon.code} aplicado com sucesso.`);
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível aplicar o cupom."),
  });

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    toast.success("Cupom removido.");
  };

  const orderMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({ name: data.customerName, phone: data.customerPhone })
        .select()
        .single();
      if (custErr) throw custErr;

      const isDelivery = data.orderType === "delivery";

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          establishment_id: establishment!.id,
          customer_id: customer.id,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          order_type: data.orderType,
          observation: data.observation || null,
          subtotal: total,
          discount_amount: discountAmount,
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
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      await supabase.from("loyalty_accounts").upsert(
        {
          customer_id: customer.id,
          establishment_id: establishment!.id,
          points: Math.floor(finalTotal),
        },
        { onConflict: "customer_id,establishment_id" }
      );

      return { order, data };
    },
    onSuccess: (result) => {
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
        couponCode: appliedCoupon?.code,
        total: finalTotal,
      });

      openWhatsApp(establishment!.whatsapp, message);
      clearCart();
      toast.success("Pedido enviado com sucesso.");
      navigate(`/loja/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Não foi possível enviar o pedido."),
  });

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
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" onClick={() => navigate(`/loja/${slug}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar ao cardápio
          </Button>
          <Badge variant="secondary">Finalização segura</Badge>
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
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              {deliverySummary && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium mb-1">Endereço de entrega</p>
                  <p className="text-muted-foreground">{deliverySummary.line1}</p>
                  <p className="text-muted-foreground">{deliverySummary.line2}</p>
                  <p className="text-muted-foreground">CEP: {deliverySummary.zipCode}</p>
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
                <form onSubmit={form.handleSubmit((d) => orderMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl><Input placeholder="Como você quer ser chamado?" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone / WhatsApp</FormLabel>
                      <FormControl><Input placeholder="(11) 99999-8888" {...field} /></FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )} />

                  {orderType === "delivery" && (
                    <div className="rounded-xl border p-4 space-y-4 bg-muted/20">
                      <h3 className="font-semibold">Dados de entrega</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <FormField control={form.control} name="deliveryStreet" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rua</FormLabel>
                              <FormControl><Input placeholder="Rua das Flores" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="deliveryNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl><Input placeholder="123" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={form.control} name="deliveryNeighborhood" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl><Input placeholder="Centro" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="deliveryZipCode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl><Input placeholder="00000-000" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <FormField control={form.control} name="deliveryCity" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cidade</FormLabel>
                              <FormControl><Input placeholder="São Paulo" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="deliveryState" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl><Input placeholder="SP" maxLength={2} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="deliveryComplement" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento (opcional)</FormLabel>
                          <FormControl><Input placeholder="Apto 12, Bloco B" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="deliveryReference" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Referência (opcional)</FormLabel>
                          <FormControl><Input placeholder="Próximo ao mercado" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <FormField control={form.control} name="observation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações (opcional)</FormLabel>
                      <FormControl><Textarea placeholder="Ex: sem cebola, ponto da carne..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full h-12 text-base" disabled={orderMutation.isPending}>
                    {orderMutation.isPending ? "Enviando pedido..." : "Enviar pedido no WhatsApp"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


