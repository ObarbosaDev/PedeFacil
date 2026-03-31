import { useEffect, useState } from "react";
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
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/formatters";
import { logAuditEvent } from "@/lib/observability";
import { PASSWORD_RULE, passwordRegex } from "@/lib/security";
import { toast } from "sonner";
import { ArrowLeft, Lock, Plus, Repeat2, Trash2, User } from "lucide-react";

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

export default function ClientAccount() {
  const { user, loading, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const { addItem, clearCart } = useCart();
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "" });
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });

  const handleSignOut = async () => {
    const confirmed = window.confirm("Quer mesmo sair da sua conta agora?");
    if (!confirmed) return;
    await signOut();
  };

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
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar o perfil."),
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
    onError: (error: any) => toast.error(error.message || "Não foi possível salvar o endereço."),
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
    onError: (error: any) => toast.error(error.message || "Não foi possível atualizar o endereço padrão."),
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
    onError: (error: any) => toast.error(error.message || "Não foi possível remover o endereço."),
  });

  const reorderMutation = useMutation({
    mutationFn: async (row: OrderHistoryRow) => {
      const order = row.orders;
      const store = order?.establishments;

      if (!order || !store?.slug) {
        throw new Error("Não foi possível refazer este pedido agora.");
      }

      const ids = (order.order_items || [])
        .map((item) => item.product_id)
        .filter((id): id is string => !!id);

      if (!ids.length) {
        throw new Error("Este pedido não tem itens disponíveis para recompra.");
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
        toast.success(`Recompra pronta. ${unavailableCount} item(ns) não estavam disponíveis e foram removidos.`);
      } else {
        toast.success("Recompra pronta. Seu carrinho foi preenchido.");
      }

      navigate(`/loja/${storeSlug}/checkout`);
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível refazer o pedido."),
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
    onError: (error: any) => toast.error(error.message || "Não foi possível atualizar sua senha."),
  });

  if (!loading && !user) return <Navigate to="/cliente/login" replace />;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link to="/cliente">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para lojas
            </Button>
          </Link>
          <Button variant="ghost" onClick={handleSignOut}>
            Sair da conta
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Minha conta
            </CardTitle>
            <CardDescription>Deixe seus dados salvos para comprar sem fricção.</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Endereços</CardTitle>
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
                <Label>Número</Label>
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
                <Label>Referência</Label>
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
                        {address.label} {address.is_default && <Badge className="ml-2">Padrão</Badge>}
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
                          Tornar padrão
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => deleteAddressMutation.mutate(address.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Segurança da conta
            </CardTitle>
            <CardDescription>Atualize sua senha para manter seu acesso seguro.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de pedidos</CardTitle>
            <CardDescription>Seus últimos pedidos para repetir em poucos cliques.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Você ainda não tem pedidos vinculados à sua conta.</p>
            ) : (
              orderHistory.map((row) => {
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
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

