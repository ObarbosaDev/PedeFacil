import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Banknote, Bike, CreditCard, Store, TimerReset, WalletCards, Zap } from "lucide-react";
import { toast } from "sonner";

type DeliveryOperationMode = "own_fleet" | "shared_fleet" | "hybrid";

const deliveryModeCards: Array<{
  id: DeliveryOperationMode;
  title: string;
  description: string;
  helper: string;
}> = [
  {
    id: "own_fleet",
    title: "Entrega própria",
    description: "A loja roda com a própria frota cadastrada no sistema.",
    helper: "Bom para operação local, com mais controle e menos variação.",
  },
  {
    id: "shared_fleet",
    title: "Base compartilhada",
    description: "A plataforma distribui corridas para entregadores disponíveis.",
    helper: "Mais próximo do modelo marketplace.",
  },
  {
    id: "hybrid",
    title: "Modo híbrido",
    description: "Tenta a frota da loja primeiro e depois abre para a base compartilhada.",
    helper: "Melhor equilíbrio para escalar sem travar pedido.",
  },
];

export default function MarketplaceControl() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  const [form, setForm] = useState({
    deliveryOperationMode: "own_fleet" as DeliveryOperationMode,
    autoDispatchEnabled: true,
    acceptsMarketplacePayments: false,
    acceptsMealVoucher: false,
    platformFeePercent: "12",
    defaultDriverPayout: "0",
    dispatchTimeoutSeconds: "30",
    mercadoPagoAccessToken: "",
    mercadoPagoPublicKey: "",
    mercadoPagoUserId: "",
    pixKey: "",
    pixRecipientName: "",
    pixInstructions: "",
  });

  const { data: establishment, isLoading } = useQuery({
    queryKey: ["my-establishment-marketplace"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishments")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: paymentAccount } = useQuery({
    queryKey: ["marketplace-payment-account", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_payment_accounts")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!establishment?.id,
  });

  const { data: orderRows = [] } = useQuery({
    queryKey: ["marketplace-orders-summary", establishment?.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, total, delivery_fee, payment_status, order_type")
        .eq("establishment_id", establishment!.id)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const { data: deliveryRows = [] } = useQuery({
    queryKey: ["marketplace-delivery-summary", establishment?.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, payout_amount, status")
        .eq("establishment_id", establishment!.id)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  useEffect(() => {
    if (!establishment || initialized) return;
    setForm({
      deliveryOperationMode: ((establishment.delivery_operation_mode as DeliveryOperationMode) || "own_fleet"),
      autoDispatchEnabled: establishment.auto_dispatch_enabled !== false,
      acceptsMarketplacePayments: !!establishment.accepts_marketplace_payments,
      acceptsMealVoucher: !!establishment.accepts_meal_voucher,
      platformFeePercent: String(Number(establishment.platform_fee_percent ?? 12)),
      defaultDriverPayout: String(Number(establishment.default_driver_payout ?? 0)),
      dispatchTimeoutSeconds: String(Number(establishment.dispatch_timeout_seconds ?? 30)),
      mercadoPagoAccessToken: "",
      mercadoPagoPublicKey: "",
      mercadoPagoUserId: "",
      pixKey: String(establishment.pix_key ?? ""),
      pixRecipientName: String(establishment.pix_recipient_name ?? ""),
      pixInstructions: String(
        establishment.pix_instructions ?? "Depois de pagar, envie o comprovante no WhatsApp da loja para liberação."
      ),
    });
    setInitialized(true);
  }, [establishment, initialized]);

  useEffect(() => {
    if (!paymentAccount) return;
    setForm((prev) => ({
      ...prev,
      mercadoPagoPublicKey: String(paymentAccount.mercadopago_public_key ?? ""),
      mercadoPagoUserId: String(paymentAccount.mercadopago_user_id ?? ""),
    }));
  }, [paymentAccount]);

  const metrics = useMemo(() => {
    const orders = orderRows as any[];
    const deliveries = deliveryRows as any[];
    const deliveryOrders = orders.filter((row) => row.order_type === "delivery");
    const gross = orders.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const deliveryFees = deliveryOrders.reduce((sum, row) => sum + Number(row.delivery_fee || 0), 0);
    const paidOrders = orders.filter((row) => row.payment_status === "paid").length;
    const driverPayout = deliveries.reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const platformFeeProjected = gross * (Number(form.platformFeePercent || 0) / 100);
    const netStoreProjected = gross - platformFeeProjected - driverPayout;

    return {
      gross,
      deliveryFees,
      paidOrders,
      driverPayout,
      platformFeeProjected,
      netStoreProjected,
      totalOrders: orders.length,
    };
  }, [deliveryRows, form.platformFeePercent, orderRows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!establishment?.id) throw new Error("Cadastre a loja antes de configurar a operação.");

      const platformFeePercent = Number(form.platformFeePercent);
      const defaultDriverPayout = Number(form.defaultDriverPayout);
      const dispatchTimeoutSeconds = Number(form.dispatchTimeoutSeconds);

      if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
        throw new Error("Taxa da plataforma invalida.");
      }

      if (!Number.isFinite(defaultDriverPayout) || defaultDriverPayout < 0) {
        throw new Error("Pagamento base do entregador inválido.");
      }

      if (!Number.isInteger(dispatchTimeoutSeconds) || dispatchTimeoutSeconds < 15 || dispatchTimeoutSeconds > 300) {
        throw new Error("Tempo de aceite precisa ficar entre 15 e 300 segundos.");
      }

      const { error } = await (supabase as any)
        .from("establishments")
        .update({
          delivery_operation_mode: form.deliveryOperationMode,
          auto_dispatch_enabled: form.autoDispatchEnabled,
          accepts_marketplace_payments: form.acceptsMarketplacePayments,
          accepts_meal_voucher: form.acceptsMealVoucher,
          platform_fee_percent: platformFeePercent,
          default_driver_payout: defaultDriverPayout,
          dispatch_timeout_seconds: dispatchTimeoutSeconds,
          mercadopago_public_key: form.mercadoPagoPublicKey.trim() || null,
          mercadopago_user_id: form.mercadoPagoUserId.trim() || null,
          pix_key: form.pixKey.trim() || null,
          pix_recipient_name: form.pixRecipientName.trim() || null,
          pix_instructions: form.pixInstructions.trim() || null,
        })
        .eq("id", establishment.id);
      if (error) throw error;

      const nextToken = form.mercadoPagoAccessToken.trim();
      const nextPublicKey = form.mercadoPagoPublicKey.trim() || null;
      const nextUserId = form.mercadoPagoUserId.trim() || null;
      const currentToken = String(paymentAccount?.mercadopago_access_token || "").trim();

      if (nextToken || currentToken || nextPublicKey || nextUserId) {
        const tokenToPersist = nextToken || currentToken;
        if (tokenToPersist) {
          const { error: accountError } = await (supabase as any)
            .from("establishment_payment_accounts")
            .upsert(
              {
                establishment_id: establishment.id,
                mercadopago_access_token: tokenToPersist,
                mercadopago_public_key: nextPublicKey,
                mercadopago_user_id: nextUserId,
              },
              { onConflict: "establishment_id" }
            );
          if (accountError) throw accountError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-establishment"] });
      queryClient.invalidateQueries({ queryKey: ["my-establishment-marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-payment-account", establishment?.id] });
      setForm((prev) => ({ ...prev, mercadoPagoAccessToken: "" }));
      toast.success("Operação marketplace atualizada.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Não rolou salvar a operação agora.");
    },
  });

  if (isLoading) {
    return <div className="py-10 text-sm text-muted-foreground">Carregando operação...</div>;
  }

  if (!establishment) {
    return <div className="py-10 text-sm text-muted-foreground">Cadastre sua loja para configurar a operação marketplace.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-3xl border bg-card p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-orange-300/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 left-0 h-36 w-36 rounded-full bg-emerald-300/15 blur-3xl pointer-events-none" />
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
          <Zap className="h-3.5 w-3.5 text-orange-500" />
          Fase 1 de marketplace
        </div>
        <h1 className="text-3xl md:text-4xl font-black mt-4">Operação de plataforma, sem gambiarra.</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Defina como a loja conecta pagamento, despacho, taxa da plataforma e repasse do entregador.
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pedidos 30d</p><p className="text-2xl font-bold">{metrics.totalOrders}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pedidos pagos</p><p className="text-2xl font-bold">{metrics.paidOrders}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bruto 30d</p><p className="text-2xl font-bold">{formatCurrency(metrics.gross)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Frete cobrado</p><p className="text-2xl font-bold">{formatCurrency(metrics.deliveryFees)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Repasse motoboy</p><p className="text-2xl font-bold">{formatCurrency(metrics.driverPayout)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Líquido projetado</p><p className="text-2xl font-bold">{formatCurrency(metrics.netStoreProjected)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo de entrega</CardTitle>
          <CardDescription>Escolha como a loja conversa com a frota dentro da plataforma.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {deliveryModeCards.map((mode) => {
            const selected = form.deliveryOperationMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, deliveryOperationMode: mode.id }))}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  selected ? "border-zinc-900 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{mode.title}</p>
                  {selected ? <Badge className="bg-white text-zinc-900">Ativo</Badge> : null}
                </div>
                <p className={`text-sm mt-2 ${selected ? "text-zinc-300" : "text-zinc-600"}`}>{mode.description}</p>
                <p className={`text-xs mt-3 ${selected ? "text-zinc-400" : "text-zinc-500"}`}>{mode.helper}</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[0.58fr_0.42fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pagamentos e despacho</CardTitle>
            <CardDescription>O que o cliente paga no app e como a rota vai para o motoboy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-semibold inline-flex items-center gap-2"><CreditCard className="h-4 w-4" /> Pagamento no app</p>
                <p className="text-sm text-muted-foreground mt-1">Liga o fluxo de PIX e cartão por dentro da plataforma.</p>
              </div>
              <Switch checked={form.acceptsMarketplacePayments} onCheckedChange={(value) => setForm((prev) => ({ ...prev, acceptsMarketplacePayments: value }))} />
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Conta de recebimento Mercado Pago</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    O checkout do cliente usa essa conta da loja. Sem token, o pagamento no app não abre.
                  </p>
                </div>
                <Badge variant={paymentAccount?.mercadopago_access_token ? "default" : "outline"}>
                  {paymentAccount?.mercadopago_access_token ? "Conta conectada" : "Conta pendente"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Access Token da loja</Label>
                <Input
                  type="password"
                  value={form.mercadoPagoAccessToken}
                  onChange={(event) => setForm((prev) => ({ ...prev, mercadoPagoAccessToken: event.target.value }))}
                  placeholder={
                    paymentAccount?.mercadopago_access_token
                      ? "Token já salvo. Preencha só se quiser trocar."
                      : "APP_USR-..."
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Dica: se já estiver salvo, deixe em branco para manter o token atual.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Public Key (opcional)</Label>
                  <Input
                    value={form.mercadoPagoPublicKey}
                    onChange={(event) => setForm((prev) => ({ ...prev, mercadoPagoPublicKey: event.target.value }))}
                    placeholder="APP_USR-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>User ID da conta (opcional)</Label>
                  <Input
                    value={form.mercadoPagoUserId}
                    onChange={(event) => setForm((prev) => ({ ...prev, mercadoPagoUserId: event.target.value }))}
                    placeholder="Ex.: 123456789"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Fallback PIX manual (todos os bancos)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Se a loja ainda não tiver gateway conectado, o cliente paga com o app do banco dele via essa chave.
                  </p>
                </div>
                <Badge variant={form.pixKey.trim() ? "default" : "outline"}>
                  {form.pixKey.trim() ? "PIX pronto" : "PIX não configurado"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Chave PIX da loja</Label>
                <Input
                  value={form.pixKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, pixKey: event.target.value }))}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome do recebedor</Label>
                  <Input
                    value={form.pixRecipientName}
                    onChange={(event) => setForm((prev) => ({ ...prev, pixRecipientName: event.target.value }))}
                    placeholder="Ex.: Restaurante XPTO LTDA"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instruções de confirmação</Label>
                  <Input
                    value={form.pixInstructions}
                    onChange={(event) => setForm((prev) => ({ ...prev, pixInstructions: event.target.value }))}
                    placeholder="Ex.: Envie o comprovante no WhatsApp da loja"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-semibold inline-flex items-center gap-2"><WalletCards className="h-4 w-4" /> Vale-alimentação</p>
                <p className="text-sm text-muted-foreground mt-1">A base comercial já está pronta. Só liga quando a integração real estiver de pé.</p>
              </div>
              <Switch checked={form.acceptsMealVoucher} onCheckedChange={(value) => setForm((prev) => ({ ...prev, acceptsMealVoucher: value }))} />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-semibold inline-flex items-center gap-2"><Bike className="h-4 w-4" /> Auto-despacho</p>
                <p className="text-sm text-muted-foreground mt-1">Quando pedido de entrega entra, o sistema tenta despachar sozinho.</p>
              </div>
              <Switch checked={form.autoDispatchEnabled} onCheckedChange={(value) => setForm((prev) => ({ ...prev, autoDispatchEnabled: value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Taxa da plataforma (%)</Label>
                <Input value={form.platformFeePercent} onChange={(event) => setForm((prev) => ({ ...prev, platformFeePercent: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Payout base por corrida</Label>
                <Input value={form.defaultDriverPayout} onChange={(event) => setForm((prev) => ({ ...prev, defaultDriverPayout: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tempo de aceite (segundos)</Label>
                <Input value={form.dispatchTimeoutSeconds} onChange={(event) => setForm((prev) => ({ ...prev, dispatchTimeoutSeconds: event.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Leitura de margem</CardTitle>
            <CardDescription>Estimativa simples para loja, entregador e plataforma.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border p-4 bg-zinc-950 text-zinc-100">
              <p className="text-xs uppercase tracking-wider text-zinc-400">Fluxo financeiro base</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Banknote className="h-4 w-4" /> Pedido bruto</span><strong>{formatCurrency(metrics.gross)}</strong></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Store className="h-4 w-4" /> Taxa plataforma</span><strong>{formatCurrency(metrics.platformFeeProjected)}</strong></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Bike className="h-4 w-4" /> Repasse motoboy</span><strong>{formatCurrency(metrics.driverPayout)}</strong></div>
                <div className="h-px bg-zinc-800" />
                <div className="flex items-center justify-between gap-3 text-base"><span>Líquido projetado da loja</span><strong>{formatCurrency(metrics.netStoreProjected)}</strong></div>
              </div>
            </div>

            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="font-semibold inline-flex items-center gap-2"><TimerReset className="h-4 w-4" /> Recomendacao pratica</p>
              <p className="text-sm text-muted-foreground mt-2">
                Comece com auto-despacho ligado, timeout entre 30 e 45 segundos e payout base enxuto.
                Ajuste depois de olhar 2 semanas de operação real.
              </p>
            </div>

            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando operação..." : "Salvar operação marketplace"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

