import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/formatters";
import { logAuditEvent } from "@/lib/observability";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import {
  getCurrentDeviceLabel,
  getSecuritySettings,
  listTrustedDevices,
  revokeTrustedDevice,
  trustCurrentDevice,
  updateSecuritySettings,
} from "@/lib/account-security";
import { toast } from "sonner";
import { ArrowLeft, Clock3, CreditCard, Lock, MapPin, Plus, Repeat2, ShieldCheck, ShoppingBag, Trash2, User } from "lucide-react";

type CustomerProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
};

type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  complement: string | null;
  reference: string | null;
  is_default: boolean;
};

type OrderHistoryRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  orders: {
    id: string;
    created_at: string;
    status: string;
    payment_status: string;
    order_type: "pickup" | "delivery";
    subtotal: number;
    discount_amount: number;
    coupon_code: string | null;
    total: number;
    establishments: {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
    } | null;
    order_items: Array<{
      id: string;
      product_id: string | null;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>;
  } | null;
};

type ConfirmAction =
  | { type: "signout" }
  | { type: "delete-address"; id: string }
  | { type: "revoke-device"; id: string };


const emptyAddress = {
  label: "Casa",
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  state: "",
  zip_code: "",
  complement: "",
  reference: "",
};

function getOrderTypeLabel(orderType: "pickup" | "delivery") {
  return orderType === "delivery" ? "Entrega" : "Retirada";
}

export default function ClientAccount() {
  const { user, loading, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { addItem, clearCart } = useCart();
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "" });
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "signout") {
      setConfirmAction(null);
      await handleSignOut();
      return;
    }

    if (confirmAction.type === "delete-address") {
      deleteAddressMutation.mutate(confirmAction.id);
      setConfirmAction(null);
      return;
    }

    revokeTrustedDeviceMutation.mutate(confirmAction.id);
    setConfirmAction(null);
  };

  const confirmDialogCopy = useMemo(() => {
    if (!confirmAction) return null;
    if (confirmAction.type === "signout") {
      return {
        title: "Sair da conta agora?",
        description: "Você volta para a área pública e precisa entrar de novo para acessar seu perfil, endereços e histórico.",
        actionLabel: "Sair da conta",
      };
    }
    if (confirmAction.type === "delete-address") {
      return {
        title: "Remover este endereço?",
        description: "Esse endereço sai da sua conta e deixa de aparecer nos atalhos do checkout.",
        actionLabel: "Remover endereço",
      };
    }
    return {
      title: "Remover este dispositivo?",
      description: "Esse navegador perde o acesso confiável e volta a pedir código por e-mail no login.",
      actionLabel: "Remover dispositivo",
    };
  }, [confirmAction]);


  const { data: profile } = useQuery<CustomerProfile | null>({
    queryKey: ["customer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as CustomerProfile | null;
    },
    enabled: !!user,
  });

  const { data: addresses = [] } = useQuery<CustomerAddress[]>({
    queryKey: ["customer-addresses", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CustomerAddress[];
    },
    enabled: !!user,
  });

  const { data: orderHistory = [] } = useQuery<OrderHistoryRow[]>({
    queryKey: ["customer-order-history", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_order_links")
        .select(`
          id,
          created_at,
          metadata,
          orders:order_id (
            id,
            created_at,
            status,
            payment_status,
            order_type,
            subtotal,
            discount_amount,
            coupon_code,
            total,
            establishments:establishment_id (
              id,
              name,
              slug,
              logo_url
            ),
            order_items (
              id,
              product_id,
              product_name,
              quantity,
              unit_price
            )
          )
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as OrderHistoryRow[];
    },
    enabled: !!user,
  });

  const { data: securitySettings } = useQuery({
    queryKey: ["user-security-settings", user?.id],
    queryFn: async () => getSecuritySettings(user!.id),
    enabled: !!user,
  });

  const { data: trustedDevices = [] } = useQuery({
    queryKey: ["trusted-devices", user?.id],
    queryFn: async () => listTrustedDevices(user!.id),
    enabled: !!user,
  });

  const filteredOrderHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return orderHistory.filter((row) => {
      const order = row.orders;
      const store = order?.establishments;
      if (!order || !store) return false;
      if (historyStatusFilter !== "all" && order.status !== historyStatusFilter) return false;
      if (!term) return true;
      return (
        String(store.name || "").toLowerCase().includes(term) ||
        String(order.id || "").toLowerCase().includes(term) ||
        String(order.order_type || "").toLowerCase().includes(term) ||
        String(order.payment_status || "").toLowerCase().includes(term)
      );
    });
  }, [historySearch, historyStatusFilter, orderHistory]);

  const activeOrder = useMemo(() => {
    return orderHistory.find((row) => row.orders && !["delivered", "cancelled"].includes(String(row.orders.status || ""))) || null;
  }, [orderHistory]);

  const accountMetrics = useMemo(() => {
    const paidOrders = orderHistory.filter((row) => row.orders?.payment_status === "paid").length;
    const totalSpent = orderHistory.reduce((sum, row) => sum + Number(row.orders?.total || 0), 0);
    return {
      orders: orderHistory.length,
      paidOrders,
      addresses: addresses.length,
      totalSpent,
    };
  }, [addresses.length, orderHistory]);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      fullName: profile.full_name || "",
      phone: profile.phone || "",
    });
  }, [profile]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        full_name: profileForm.fullName.trim(),
        phone: profileForm.phone.trim() || null,
      };

      if (!payload.full_name) throw new Error("Informe seu nome.");

      const { error } = await (supabase as any)
        .from("customer_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "customer_profile",
        entityId: user?.id,
        action: "customer_profile_updated",
        metadata: {
          hasPhone: !!payload.phone,
          fullName: payload.full_name,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-profile", user?.id] });
      toast.success("Perfil salvo com sucesso.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou salvar seu perfil."),
  });

  const saveAddressMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        label: addressForm.label.trim() || "Casa",
        street: addressForm.street.trim(),
        number: addressForm.number.trim(),
        neighborhood: addressForm.neighborhood.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim().toUpperCase(),
        zip_code: addressForm.zip_code.trim(),
        complement: addressForm.complement.trim() || null,
        reference: addressForm.reference.trim() || null,
        is_default: addresses.length === 0,
      };

      if (!payload.street || !payload.number || !payload.neighborhood || !payload.city || !payload.state || !payload.zip_code) {
        throw new Error("Preencha os campos obrigatórios do endereço.");
      }

      const { error } = await (supabase as any).from("customer_addresses").insert(payload);
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "customer_address",
        action: "customer_address_created",
        metadata: {
          city: payload.city,
          state: payload.state,
          isDefault: payload.is_default,
        },
      });
    },
    onSuccess: () => {
      setAddressForm(emptyAddress);
      queryClient.invalidateQueries({ queryKey: ["customer-addresses", user?.id] });
      toast.success("Endereço salvo.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou salvar o endereço."),
  });

  const setDefaultAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error: clearError } = await (supabase as any)
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", user!.id);
      if (clearError) throw clearError;

      const { error } = await (supabase as any)
        .from("customer_addresses")
        .update({ is_default: true })
        .eq("id", addressId)
        .eq("user_id", user!.id);
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "customer_address",
        entityId: addressId,
        action: "customer_address_default_updated",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses", user?.id] });
      toast.success("Endereço padrão atualizado.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou atualizar o endereço padrão."),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await (supabase as any)
        .from("customer_addresses")
        .delete()
        .eq("id", addressId)
        .eq("user_id", user!.id);
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "customer_address",
        entityId: addressId,
        action: "customer_address_deleted",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-addresses", user?.id] });
      toast.success("Endereço removido.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou remover o endereço."),
  });

  const reorderMutation = useMutation({
    mutationFn: async (row: OrderHistoryRow) => {
      const order = row.orders;
      const store = order?.establishments;

      if (!order || !store?.slug) {
        throw new Error("Não rolou refazer esse pedido agora.");
      }

      const ids = (order.order_items || [])
        .map((item) => item.product_id)
        .filter((id): id is string => !!id);

      if (!ids.length) {
        throw new Error("Esse pedido não tem itens disponíveis para recompra.");
      }

      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, is_available")
        .eq("establishment_id", store.id)
        .eq("is_available", true)
        .in("id", ids);
      if (error) throw error;

      const productMap = new Map((products || []).map((product) => [product.id, product]));
      const cartPayload: Array<{ id: string; name: string; price: number; image_url?: string | null }> = [];
      let unavailableCount = 0;

      for (const item of order.order_items || []) {
        if (!item.product_id) {
          unavailableCount += 1;
          continue;
        }

        const currentProduct = productMap.get(item.product_id);
        if (!currentProduct) {
          unavailableCount += item.quantity;
          continue;
        }

        for (let index = 0; index < item.quantity; index += 1) {
          cartPayload.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: Number(currentProduct.price),
            image_url: currentProduct.image_url,
          });
        }
      }

      if (!cartPayload.length) {
        throw new Error("Nenhum item desse pedido está disponível no cardápio atual.");
      }

      return { cartPayload, storeSlug: store.slug, orderId: order.id, unavailableCount };
    },
    onSuccess: async ({ cartPayload, storeSlug, orderId, unavailableCount }) => {
      clearCart();
      cartPayload.forEach((item) => addItem(item));

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "order",
        entityId: orderId,
        action: "customer_reorder_created",
        metadata: {
          cartItemsAdded: cartPayload.length,
          unavailableItems: unavailableCount,
        },
      });

      if (unavailableCount > 0) {
        toast.success(`Recompra pronta. ${unavailableCount} item(ns) não estavam disponíveis e saíram do carrinho.`);
      } else {
        toast.success("Recompra pronta. Seu carrinho foi preenchido.");
      }

      navigate(`/loja/${storeSlug}/checkout`);
    },
    onError: (error: any) => toast.error(error.message || "Não rolou refazer o pedido."),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const nextPassword = passwordForm.newPassword.trim();
      const confirmPassword = passwordForm.confirmNewPassword.trim();

      if (!nextPassword || !confirmPassword) {
        throw new Error("Preencha e confirme a nova senha.");
      }

      if (!passwordRegex.test(nextPassword)) {
        throw new Error(PASSWORD_RULE);
      }

      if (nextPassword !== confirmPassword) {
        throw new Error("As senhas não conferem.");
      }

      await updatePassword(nextPassword);

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "customer",
        entityType: "auth",
        entityId: user?.id,
        action: "customer_password_updated",
      });
    },
    onSuccess: () => {
      setPasswordForm({ newPassword: "", confirmNewPassword: "" });
      toast.success("Senha atualizada com sucesso.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou atualizar sua senha."),
  });

  const updateSecuritySettingsMutation = useMutation({
    mutationFn: async (patch: Partial<{ otp_enabled: boolean; require_step_up_for_critical_actions: boolean }>) => {
      await updateSecuritySettings(user!.id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-security-settings", user?.id] });
      toast.success("Configurações de segurança atualizadas.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou atualizar as configurações de segurança."),
  });

  const trustCurrentDeviceMutation = useMutation({
    mutationFn: async () => {
      await trustCurrentDevice(user!.id, getCurrentDeviceLabel());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trusted-devices", user?.id] });
      toast.success("Este dispositivo foi adicionado como confiavel.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou confiar neste dispositivo."),
  });

  const revokeTrustedDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => revokeTrustedDevice(user!.id, deviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trusted-devices", user?.id] });
      toast.success("Dispositivo removido da lista de confiaveis.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou remover o dispositivo."),
  });

  if (!loading && !user) return <Navigate to="/cliente/login" replace />;

  return (
    <div className="min-h-screen bg-[#f3efe6]">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(120deg,rgba(24,24,27,0.16)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to="/cliente">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para lojas
            </Button>
          </Link>
          <Button variant="ghost" onClick={() => setConfirmAction({ type: "signout" })}>
            Sair da conta
          </Button>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-zinc-950/10 bg-[#111111] shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
          <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 md:p-8 text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
                <ShoppingBag className="h-3.5 w-3.5" />
                Painel do cliente
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Sua conta pronta para pedir rápido, sem enrolação.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                Perfil salvo, endereço na mão, segurança redonda e histórico pronto para repetir pedido sem perder tempo.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Pedidos</p>
                  <p className="mt-3 text-3xl font-black">{accountMetrics.orders}</p>
                  <p className="mt-2 text-sm text-zinc-400">Histórico já registrado.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Pagos</p>
                  <p className="mt-3 text-3xl font-black">{accountMetrics.paidOrders}</p>
                  <p className="mt-2 text-sm text-zinc-400">Compras com pagamento confirmado.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Endereços</p>
                  <p className="mt-3 text-3xl font-black">{accountMetrics.addresses}</p>
                  <p className="mt-2 text-sm text-zinc-400">Pontos salvos para checkout.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Total no app</p>
                  <p className="mt-3 text-2xl font-black">{formatCurrency(accountMetrics.totalSpent)}</p>
                  <p className="mt-2 text-sm text-zinc-400">Leitura rápida do seu uso.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 md:p-8 xl:border-l xl:border-t-0">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Pedido em destaque</p>
                {activeOrder?.orders?.establishments ? (
                  <>
                    <h2 className="mt-3 text-2xl font-black tracking-tight">{activeOrder.orders.establishments.name}</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {ORDER_STATUS_LABELS[activeOrder.orders.status] || activeOrder.orders.status} • {getOrderTypeLabel(activeOrder.orders.order_type)}
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Total</p>
                        <p className="mt-2 text-base font-bold">{formatCurrency(Number(activeOrder.orders.total || 0))}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Criado em</p>
                        <p className="mt-2 text-base font-bold">{formatDate(activeOrder.orders.created_at)}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {activeOrder.orders.payment_status !== "paid" && (
                        <Link to={`/cliente/pagamento-pedido?order=${activeOrder.orders.id}`}>
                          <Button className="bg-white text-zinc-950 hover:bg-zinc-200">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Pagar agora
                          </Button>
                        </Link>
                      )}
                      <Link to={`/loja/${activeOrder.orders.establishments.slug}`}>
                        <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                          Ver loja
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-2xl font-black tracking-tight">Conta pronta para o próximo pedido</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      Assim que você fechar uma compra, o pedido ativo aparece aqui com status e atalhos rápidos.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-4">
          <a href="#perfil-cliente" className="rounded-2xl border border-zinc-950/10 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-primary/30 hover:text-zinc-950">Perfil</a>
          <a href="#enderecos-cliente" className="rounded-2xl border border-zinc-950/10 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-primary/30 hover:text-zinc-950">Endereços</a>
          <a href="#seguranca-cliente" className="rounded-2xl border border-zinc-950/10 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-primary/30 hover:text-zinc-950">Segurança</a>
          <a href="#historico-cliente" className="rounded-2xl border border-zinc-950/10 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:border-primary/30 hover:text-zinc-950">Histórico</a>
        </div>

        <Card id="perfil-cliente" className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Minha conta
            </CardTitle>
            <CardDescription>Deixe seus dados salvos para comprar sem friccao.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Nome</Label>
              <Input
                value={profileForm.fullName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="Seu nome"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="md:col-span-3">
              <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
                {saveProfileMutation.isPending ? "Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="enderecos-cliente" className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle>Enderecos</CardTitle>
            <CardDescription>Cadastre seus endereços para o checkout preencher automático.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Apelido</Label>
                <Input value={addressForm.label} onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Rua</Label>
                <Input value={addressForm.street} onChange={(e) => setAddressForm((prev) => ({ ...prev, street: e.target.value }))} />
              </div>
              <div>
                <Label>Numero</Label>
                <Input value={addressForm.number} onChange={(e) => setAddressForm((prev) => ({ ...prev, number: e.target.value }))} />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input value={addressForm.neighborhood} onChange={(e) => setAddressForm((prev) => ({ ...prev, neighborhood: e.target.value }))} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={addressForm.zip_code} onChange={(e) => setAddressForm((prev) => ({ ...prev, zip_code: e.target.value }))} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={addressForm.city} onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))} />
              </div>
              <div>
                <Label>Estado</Label>
                <Input value={addressForm.state} onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))} maxLength={2} />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input value={addressForm.complement} onChange={(e) => setAddressForm((prev) => ({ ...prev, complement: e.target.value }))} />
              </div>
              <div>
                <Label>Referencia</Label>
                <Input value={addressForm.reference} onChange={(e) => setAddressForm((prev) => ({ ...prev, reference: e.target.value }))} />
              </div>
            </div>

            <Button onClick={() => saveAddressMutation.mutate()} disabled={saveAddressMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {saveAddressMutation.isPending ? "Salvando endereço..." : "Adicionar endereço"}
            </Button>

            <div className="space-y-2">
              {addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado ainda.</p>
              ) : (
                addresses.map((address) => (
                  <div key={address.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {address.label} {address.is_default && <Badge className="ml-2">Padrao</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.street}, {address.number} - {address.neighborhood}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.city}/{address.state} - CEP {address.zip_code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!address.is_default && (
                        <Button variant="outline" size="sm" onClick={() => setDefaultAddressMutation.mutate(address.id)}>
                          Tornar padrao
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => setConfirmAction({ type: "delete-address", id: address.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card id="seguranca-cliente" className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Segurança da conta
            </CardTitle>
            <CardDescription>Atualize sua senha e deixe sua conta redonda, sem brecha boba.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Digite uma nova senha"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground mt-1">{PASSWORD_RULE}</p>
              </div>
              <div>
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
              </div>
              <div className="md:col-span-2">
                <Button onClick={() => changePasswordMutation.mutate()} disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? "Atualizando senha..." : "Atualizar senha"}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Código por e-mail no login</p>
                  <p className="text-xs text-muted-foreground">Se ativar, além da senha você confirma o acesso com código no e-mail.</p>
                </div>
                <Switch
                  checked={!!securitySettings?.otp_enabled}
                  onCheckedChange={(checked) => updateSecuritySettingsMutation.mutate({ otp_enabled: checked })}
                  disabled={updateSecuritySettingsMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Verificação extra para ações sensíveis</p>
                  <p className="text-xs text-muted-foreground">Pede uma confirmação a mais quando você mexer no que é crítico.</p>
                </div>
                <Switch
                  checked={!!securitySettings?.require_step_up_for_critical_actions}
                  onCheckedChange={(checked) =>
                    updateSecuritySettingsMutation.mutate({ require_step_up_for_critical_actions: checked })
                  }
                  disabled={updateSecuritySettingsMutation.isPending}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">Dispositivos confiáveis</p>
                  <p className="text-xs text-muted-foreground">Gerencie os navegadores que podem pular o código por e-mail.</p>
                </div>
                <Button variant="outline" onClick={() => trustCurrentDeviceMutation.mutate()} disabled={trustCurrentDeviceMutation.isPending}>
                  Confiar neste dispositivo
                </Button>
              </div>

              {trustedDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não tem dispositivo confiável cadastrado.</p>
              ) : (
                trustedDevices.map((device) => (
                  <div key={device.id} className="rounded-md border p-3 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium">{device.device_label || "Dispositivo"}</p>
                      <p className="text-xs text-muted-foreground">
                        Último uso: {formatDate(device.last_used_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmAction({ type: "revoke-device", id: device.id })}
                      disabled={revokeTrustedDeviceMutation.isPending}
                    >
                      Remover
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmDialogCopy?.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDialogCopy?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAction}>{confirmDialogCopy?.actionLabel || "Confirmar"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card id="historico-cliente" className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle>Histórico de pedidos</CardTitle>
            <CardDescription>Seus últimos pedidos para repetir sem perder tempo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input
                placeholder="Buscar por loja, pedido ou tipo..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="received">Recebidos</option>
                <option value="confirmed">Confirmados</option>
                <option value="in_preparation">Em preparo</option>
                <option value="ready">Prontos</option>
                <option value="delivered">Entregues</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>
            {filteredOrderHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado com esses filtros.</p>
            ) : (
              filteredOrderHistory.map((row) => {
                const order = row.orders;
                const store = order?.establishments;

                if (!order || !store) return null;

                return (
                  <div key={row.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status] || order.status}</Badge>
                        <Badge variant={order.payment_status === "paid" ? "default" : "outline"}>
                          {order.payment_status === "paid" ? "Pago" : "Pagamento pendente"}
                        </Badge>
                        <Badge variant="outline">{order.order_type === "delivery" ? "Entrega" : "Retirada"}</Badge>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      {(order.order_items || []).slice(0, 3).map((item) => (
                        <p key={item.id}>
                          {item.quantity}x {item.product_name}
                        </p>
                      ))}
                      {(order.order_items || []).length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{(order.order_items || []).length - 3} item(ns)
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm">
                        {Number(order.discount_amount || 0) > 0 && (
                          <p className="text-emerald-600">
                            Desconto{order.coupon_code ? ` (${order.coupon_code})` : ""}: -{formatCurrency(Number(order.discount_amount))}
                          </p>
                        )}
                        <p className="font-semibold">Total: {formatCurrency(Number(order.total || 0))}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.payment_status !== "paid" && (
                          <Link to={`/cliente/pagamento-pedido?order=${order.id}`}>
                            <Button variant="default">
                              Pagar pedido
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => reorderMutation.mutate(row)}
                          disabled={reorderMutation.isPending}
                        >
                          <Repeat2 className="h-4 w-4 mr-2" />
                          Refazer pedido
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}














