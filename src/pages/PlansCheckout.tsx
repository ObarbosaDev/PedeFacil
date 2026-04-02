import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Check, Clock3, Copy, CreditCard, Lock, LogIn, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { BillingMode, getPlanBySlug, getPlanPrice, plans } from "@/lib/plans";
import { buildPixPayload, buildPixQrImageUrl } from "@/lib/pix";
import { CheckoutPaymentMethod, CheckoutSession, confirmPlanPayment, getMyStoreSubscription, startPlanCheckout } from "@/lib/subscription";
import { trackProductEvent } from "@/lib/product-analytics";

const PIX_KEY = "067.444.201-60";
const MERCHANT_NAME = "PEDEFACIL";
const MERCHANT_CITY = "SAO PAULO";

type PaymentMethod = "pix" | "card";

const statusLabel: Record<string, string> = {
  pending_payment: "Pagamento pendente",
  active: "Assinatura ativa",
  past_due: "Pagamento em atraso",
  canceled: "Assinatura cancelada",
  expired: "Assinatura expirada",
};

export default function PlansCheckout() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [qrErrored, setQrErrored] = useState(false);

  const billingModeParam = searchParams.get("billing");
  const billingMode: BillingMode = billingModeParam === "yearly" ? "yearly" : "monthly";
  const [selectedPlanSlug, setSelectedPlanSlug] = useState(
    () => getPlanBySlug(searchParams.get("plano"))?.slug || "profissional"
  );
  const plan = getPlanBySlug(selectedPlanSlug) || plans.find((item) => item.slug === "profissional") || plans[0];

  const { data: subscription, isLoading: loadingSubscription } = useQuery({
    queryKey: ["my-store-subscription", user?.id],
    queryFn: () => getMyStoreSubscription(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!subscription) return;
    if (!subscription.checkout_session_id) return;

    setCheckout((prev) => {
      if (prev?.checkout_session_id === subscription.checkout_session_id) return prev;
      return {
        subscription_id: subscription.subscription_id,
        checkout_session_id: subscription.checkout_session_id,
        plan_slug: subscription.plan_slug,
        billing_cycle: subscription.billing_cycle,
        status: subscription.status,
        payment_method: subscription.payment_method,
        amount_cents: subscription.amount_cents,
        currency: subscription.currency,
        payment_expires_at: subscription.payment_expires_at,
      };
    });
  }, [subscription]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);

  const planPrice = useMemo(() => (plan ? getPlanPrice(plan, billingMode) : 0), [plan, billingMode]);
  const effectivePrice = useMemo(() => {
    if (checkout?.amount_cents) return checkout.amount_cents / 100;
    return planPrice;
  }, [checkout?.amount_cents, planPrice]);

  const pixCode = useMemo(() => {
    if (!plan) return "";

    const txid = checkout?.checkout_session_id
      ? checkout.checkout_session_id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25)
      : `PLANO${plan.slug.toUpperCase()}`;

    return buildPixPayload({
      key: PIX_KEY,
      amount: effectivePrice,
      merchantName: MERCHANT_NAME,
      merchantCity: MERCHANT_CITY,
      txid,
      description: `Assinatura ${plan.name}`,
    });
  }, [checkout?.checkout_session_id, plan, effectivePrice]);

  const pixQrUrl = useMemo(() => (pixCode ? buildPixQrImageUrl(pixCode) : ""), [pixCode]);

  const startCheckoutMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para gerar seu checkout.");
      return startPlanCheckout({
        planSlug: plan.slug,
        billingCycle: billingMode,
        paymentMethod: paymentMethod as CheckoutPaymentMethod,
      });
    },
    onSuccess: (data) => {
      setCheckout(data);
      queryClient.invalidateQueries({ queryKey: ["my-store-subscription", user?.id] });
      void trackProductEvent("funnel_checkout_payment_generated", {
        plan: data.plan_slug,
        billing: data.billing_cycle,
        method: data.payment_method,
        status: data.status,
      });

      if (data.status === "active") {
        toast.success("Sua assinatura já está ativa. Painel liberado.");
        return;
      }

      toast.success("Checkout gerado. Agora é só confirmar o pagamento.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Não rolou gerar o checkout agora.");
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!checkout?.checkout_session_id) throw new Error("Gere a cobrança antes de confirmar o pagamento.");

      return confirmPlanPayment({
        checkoutSessionId: checkout.checkout_session_id,
      });
    },
    onSuccess: async () => {
      void trackProductEvent("funnel_checkout_payment_confirmed", {
        plan: checkout?.plan_slug || plan.slug,
        billing: checkout?.billing_cycle || billingMode,
        method: checkout?.payment_method || paymentMethod,
      });
      toast.success("Pagamento confirmado e acesso liberado.");
      await queryClient.invalidateQueries({ queryKey: ["my-store-subscription", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["store-panel-access", user?.id] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Não rolou confirmar o pagamento agora.");
    },
  });

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixCode);
      toast.success("Código PIX copiado.");
    } catch {
      toast.error("Não deu para copiar agora.");
    }
  };

  const nextHref = `/planos/checkout?plano=${plan.slug}&billing=${billingMode}`;

  const isActive = subscription?.status === "active";

  useEffect(() => {
    void trackProductEvent("funnel_checkout_started", {
      source: "checkout_page",
      plan: plan.slug,
      billing: billingMode,
    });
  }, [billingMode, plan.slug]);

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-zinc-900 relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[26rem] w-[26rem] rounded-full bg-orange-300/25 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-[26rem] w-[26rem] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] [background-size:34px_34px]" />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <section className="rounded-3xl border border-zinc-200 bg-white/90 backdrop-blur p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link to={`/planos?plano=${plan.slug}&billing=${billingMode}`}>
              <Button variant="outline" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para planos
              </Button>
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-2 border border-zinc-300 bg-white">
                <Lock className="h-3.5 w-3.5 text-zinc-700" />
                Ambiente protegido
              </span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-2 border border-zinc-300 bg-white">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Checkout seguro
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pagamento da assinatura</p>
              <h1 className="text-3xl md:text-4xl font-black mt-2">
                Libere o plano <span className="text-orange-600">{plan.name}</span> e ative seu painel.
              </h1>
              <p className="text-zinc-600 mt-2">Conta criada + pagamento confirmado = acesso liberado automaticamente.</p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 min-w-[240px]">
              <p className="text-xs text-zinc-500">Status atual</p>
              <p className="font-semibold mt-1">{subscription?.status ? statusLabel[subscription.status] : "Sem assinatura"}</p>
              {subscription?.current_period_end ? (
                <p className="text-xs text-zinc-600 mt-1">
                  Vigência até {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {!user ? (
          <Card className="border-zinc-200 bg-white shadow-[0_24px_80px_-55px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>Primeiro passo: entrar na conta do lojista</CardTitle>
              <CardDescription>
                Por segurança, o checkout só é gerado para conta autenticada. Assim o plano fica vinculado ao dono certo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link to={`/login?next=${encodeURIComponent(nextHref)}`}>
                <Button>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar para pagar
                </Button>
              </Link>
              <Link to={`/registro?next=${encodeURIComponent(nextHref)}`}>
                <Button variant="outline">Criar conta e continuar</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        {isActive ? (
          <Card className="border-emerald-200 bg-emerald-50 text-emerald-900">
            <CardHeader>
              <CardTitle>Assinatura ativa</CardTitle>
              <CardDescription className="text-emerald-800">Seu painel já está liberado.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin">
                <Button className="bg-emerald-700 text-white hover:bg-emerald-800">Ir para painel do lojista</Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid grid-cols-1 lg:grid-cols-[0.58fr_0.42fr] gap-4">
          <Card className="border-zinc-200 bg-white shadow-[0_24px_80px_-55px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>Forma de pagamento</CardTitle>
              <CardDescription>Gere a cobrança e confirme o pagamento para liberar o acesso.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Escolher plano">
                {plans.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => {
                      setSelectedPlanSlug(item.slug);
                      setQrErrored(false);
                      void trackProductEvent("funnel_plan_selected", {
                        source: "checkout_plan_switch",
                        plan: item.slug,
                        billing: billingMode,
                      });
                    }}
                    role="radio"
                    aria-checked={item.slug === plan.slug}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      item.slug === plan.slug
                        ? "border-zinc-900 bg-zinc-900 text-zinc-100"
                        : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                    }`}
                  >
                    <p className="font-semibold text-sm">{item.name}</p>
                    <p className={`text-xs mt-1 ${item.slug === plan.slug ? "text-zinc-300" : "text-zinc-500"}`}>
                      {formatPrice(getPlanPrice(item, billingMode))}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Escolher forma de pagamento">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("pix");
                    void trackProductEvent("funnel_checkout_payment_method_selected", { method: "pix" });
                  }}
                  role="radio"
                  aria-checked={paymentMethod === "pix"}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === "pix"
                      ? "border-zinc-900 bg-zinc-900 text-zinc-100"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <QrCode className="h-4 w-4" />
                    PIX
                  </span>
                  <p className={`text-xs mt-1 ${paymentMethod === "pix" ? "text-zinc-300" : "text-zinc-500"}`}>
                    Aprovação rápida
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("card");
                    void trackProductEvent("funnel_checkout_payment_method_selected", { method: "card" });
                  }}
                  role="radio"
                  aria-checked={paymentMethod === "card"}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === "card"
                      ? "border-zinc-900 bg-zinc-900 text-zinc-100"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </span>
                  <p className={`text-xs mt-1 ${paymentMethod === "card" ? "text-zinc-300" : "text-zinc-500"}`}>
                    Crédito ou débito
                  </p>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => startCheckoutMutation.mutate()}
                  disabled={!user || startCheckoutMutation.isPending || loadingSubscription || isActive}
                >
                  {startCheckoutMutation.isPending ? "Gerando cobrança..." : "Gerar cobrança"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => confirmPaymentMutation.mutate()}
                  disabled={!checkout?.checkout_session_id || confirmPaymentMutation.isPending || isActive}
                >
                  {confirmPaymentMutation.isPending ? "Confirmando..." : "Já paguei, validar e liberar"}
                </Button>
              </div>

              {paymentMethod === "pix" ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:p-5">
                  <p className="font-semibold">Pague com PIX</p>
                  <p className="text-sm text-zinc-600 mt-1">
                    Escaneie o QR Code ou copie o código PIX abaixo para pagar e liberar sua assinatura.
                  </p>

                  <div className="mt-4 flex flex-col sm:flex-row gap-4">
                    <div className="rounded-xl bg-white border border-zinc-200 p-3 w-fit shadow-sm">
                      {!qrErrored ? (
                        <img
                          src={pixQrUrl}
                          alt="QR Code PIX"
                          className="h-52 w-52"
                          onError={() => setQrErrored(true)}
                        />
                      ) : (
                        <div className="h-52 w-52 grid place-items-center text-center px-4 text-sm text-zinc-500">
                          Não carregou o QR agora. Use o PIX Copia e Cola abaixo.
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="rounded-xl border border-zinc-200 bg-white p-3">
                        <p className="text-xs text-zinc-500">Chave PIX</p>
                        <p className="font-semibold">{PIX_KEY}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3">
                        <p className="text-xs text-zinc-500">PIX Copia e Cola</p>
                        <p className="text-[11px] break-all text-zinc-700 mt-1">{pixCode}</p>
                      </div>

                      <Button className="w-full rounded-full" onClick={copyPixCode}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar código PIX
                      </Button>

                      <p className="text-xs text-zinc-500 inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        A confirmação costuma cair em poucos segundos.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:p-5 space-y-3">
                  <p className="font-semibold">Pagamento com cartão</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label>Nome no cartão</Label>
                      <Input placeholder="Nome completo" />
                    </div>
                    <div>
                      <Label>Número do cartão</Label>
                      <Input placeholder="0000 0000 0000 0000" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Validade</Label>
                        <Input placeholder="MM/AA" />
                      </div>
                      <div>
                        <Label>CVV</Label>
                        <Input placeholder="123" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">Após preencher, clique em "Gerar cobrança" e depois em "Já paguei, validar e liberar".</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white h-fit shadow-[0_24px_80px_-55px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>Resumo da assinatura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">Plano</p>
                <p className="font-semibold">{plan.name}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">Cobrança</p>
                <p className="font-semibold">{billingMode === "yearly" ? "Anual (com economia)" : "Mensal"}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs text-zinc-500">Valor</p>
                <p className="text-2xl font-black">
                  {formatPrice(effectivePrice)}<span className="text-sm font-medium">/mês</span>
                </p>
              </div>
              {checkout?.checkout_session_id ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs text-zinc-500">Checkout session</p>
                  <p className="text-xs break-all font-semibold mt-1">{checkout.checkout_session_id}</p>
                </div>
              ) : null}

              <div className="pt-1">
                <p className="text-xs text-zinc-500">Incluso no plano</p>
                <div className="mt-2 space-y-1.5">
                  {plan.perks.slice(0, 4).map((perk) => (
                    <p key={perk} className="text-sm inline-flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-emerald-600" />
                      {perk}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Pagamento confirmado libera automaticamente o acesso ao painel do lojista.
              </div>

              <Link to="/admin" className="block pt-2">
                <Button className="w-full rounded-full bg-zinc-900 text-zinc-100 hover:bg-zinc-800" disabled={!isActive}>
                  <BadgeCheck className="h-4 w-4 mr-2" />
                  Ir para painel liberado
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

