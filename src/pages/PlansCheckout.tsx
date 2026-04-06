import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Check, CreditCard, ExternalLink, Lock, LogIn, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { BillingMode, getPlanBySlug, getPlanPrice, plans } from "@/lib/plans";
import {
  CheckoutPaymentMethod,
  CheckoutSession,
  createExternalPlanCheckout,
  getMyStoreSubscription,
  revalidateExternalPlanPayment,
  startPlanCheckout,
} from "@/lib/subscription";
import { trackProductEvent } from "@/lib/product-analytics";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppSupportLink } from "@/lib/support";

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
  const [paymentId, setPaymentId] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
    refetchInterval: (query) => {
      const data = query.state.data as Awaited<ReturnType<typeof getMyStoreSubscription>>;
      if (!data) return false;
      return data.status === "pending_payment" ? 5000 : false;
    },
  });

  useEffect(() => {
    if (!subscription?.checkout_session_id) return;
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

  useEffect(() => {
    const paymentReturn = searchParams.get("payment_return");
    if (!paymentReturn) return;
    if (paymentReturn === "success") {
      toast.success("Pagamento recebido. Estamos validando e liberando seu acesso.");
    } else if (paymentReturn === "pending") {
      toast.info("Pagamento em análise. A gente atualiza o status automático por aqui.");
    } else if (paymentReturn === "failure") {
      toast.error("O pagamento não foi concluído. Você pode tentar de novo.");
    }
  }, [searchParams]);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

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
      throw new Error(`Muitas tentativas seguidas. Aguarde ${Number(row.retry_after_seconds || 0)}s.`);
    }
  };

  const planPrice = useMemo(() => (plan ? getPlanPrice(plan, billingMode) : 0), [plan, billingMode]);
  const effectivePrice = useMemo(() => (checkout?.amount_cents ? checkout.amount_cents / 100 : planPrice), [checkout?.amount_cents, planPrice]);

  const nextHref = `/planos/checkout?plano=${plan.slug}&billing=${billingMode}`;
  const isActive = subscription?.status === "active";
  const supportHref = buildWhatsAppSupportLink(
    `Oi! Estou com dificuldade para concluir o pagamento do plano ${plan.name}.`
  );

  const startCheckoutMutation = useMutation({
    onMutate: () => setPaymentError(null),
    mutationFn: async () => {
      if (!user) throw new Error("Faça login para gerar seu checkout.");
      await enforceActionRateLimit("plans_start_checkout", 8, 300);
      const checkoutSession = await startPlanCheckout({
        planSlug: plan.slug,
        billingCycle: billingMode,
        paymentMethod: paymentMethod as CheckoutPaymentMethod,
      });

      const baseUrl = `${window.location.origin}/planos/checkout?plano=${plan.slug}&billing=${billingMode}`;
      const payment = await createExternalPlanCheckout({
        checkoutSessionId: checkoutSession.checkout_session_id,
        successUrl: `${baseUrl}&payment_return=success`,
        pendingUrl: `${baseUrl}&payment_return=pending`,
        failureUrl: `${baseUrl}&payment_return=failure`,
      });

      return { checkoutSession, payment };
    },
    onSuccess: async ({ checkoutSession, payment }) => {
      setCheckout(checkoutSession);
      await queryClient.invalidateQueries({ queryKey: ["my-store-subscription", user?.id] });

      void trackProductEvent("funnel_checkout_payment_generated", {
        plan: checkoutSession.plan_slug,
        billing: checkoutSession.billing_cycle,
        method: checkoutSession.payment_method,
        status: checkoutSession.status,
        provider: payment.provider,
      });

      if (payment.already_active || checkoutSession.status === "active") {
        toast.success("Sua assinatura já está ativa. Painel liberado.");
        return;
      }

      if (!payment.checkout_url) {
        throw new Error("A cobrança foi criada, mas o link de pagamento não voltou.");
      }

      toast.success("Bora fechar isso com segurança no Mercado Pago. Redirecionando...");
      window.location.href = payment.checkout_url;
    },
    onError: (error: any) => {
      const message = error?.message || "Não rolou iniciar seu pagamento agora.";
      setPaymentError(message);
      toast.error(message);
    },
  });

  const revalidateMutation = useMutation({
    onMutate: () => setPaymentError(null),
    mutationFn: async () => {
      if (!checkout?.checkout_session_id) throw new Error("Gere uma cobrança antes de revalidar.");
      await enforceActionRateLimit("plans_revalidate_payment", 10, 300);
      return revalidateExternalPlanPayment({
        checkoutSessionId: checkout.checkout_session_id,
        paymentId: paymentId.trim() || undefined,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["my-store-subscription", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["store-panel-access", user?.id] });
      if (result.revalidated) {
        toast.success("Pagamento revalidado com sucesso.");
      } else {
        toast.info("Revalidação feita. O status ainda está pendente.");
      }
    },
    onError: (error: any) => {
      const message = error?.message || "Não rolou revalidar o pagamento agora.";
      setPaymentError(message);
      toast.error(message);
    },
  });

  useEffect(() => {
    void trackProductEvent("funnel_checkout_started", {
      source: "checkout_page",
      plan: plan.slug,
      billing: billingMode,
    });
  }, [billingMode, plan.slug]);

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-zinc-900 relative overflow-hidden">
      <a
        href="#conteudo-principal-planos-checkout"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-zinc-900 focus:text-zinc-100 focus:px-4 focus:py-2 focus:rounded-md"
      >Ir para o conteúdo principal</a>
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[26rem] w-[26rem] rounded-full bg-orange-300/25 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-[26rem] w-[26rem] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#111827_1px,transparent_1px),linear-gradient(to_bottom,#111827_1px,transparent_1px)] [background-size:34px_34px]" />
      </div>

      <main id="conteudo-principal-planos-checkout" className="max-w-6xl mx-auto px-4 py-10 space-y-6">
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
              <p className="text-zinc-600 mt-2">Conta criada + pagamento aprovado = acesso liberado automaticamente.</p>
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
                Por segurança, o checkout só é gerado para conta autenticada.
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

        <section className="grid grid-cols-1 lg:grid-cols-[0.58fr_0.42fr] gap-4">
          <Card className="border-zinc-200 bg-white shadow-[0_24px_80px_-55px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>Pagamento real com Mercado Pago</CardTitle>
              <CardDescription>Clique para gerar sua cobrança e finalizar em ambiente seguro com PIX ou cartão.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Escolher plano">
                {plans.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => setSelectedPlanSlug(item.slug)}
                    role="radio"
                    aria-checked={item.slug === plan.slug}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      item.slug === plan.slug ? "border-zinc-900 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
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
                  onClick={() => setPaymentMethod("pix")}
                  role="radio"
                  aria-checked={paymentMethod === "pix"}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === "pix" ? "border-zinc-900 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <QrCode className="h-4 w-4" />
                    PIX
                  </span>
                  <p className={`text-xs mt-1 ${paymentMethod === "pix" ? "text-zinc-300" : "text-zinc-500"}`}>Pagamento instantâneo</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  role="radio"
                  aria-checked={paymentMethod === "card"}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    paymentMethod === "card" ? "border-zinc-900 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </span>
                  <p className={`text-xs mt-1 ${paymentMethod === "card" ? "text-zinc-300" : "text-zinc-500"}`}>Crédito e débito</p>
                </button>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <p className="font-semibold">Fechamento 100% seguro</p>
                <p className="text-sm text-zinc-600">Depois da aprovação, o sistema atualiza a assinatura e libera o painel automaticamente.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => startCheckoutMutation.mutate()} disabled={!user || startCheckoutMutation.isPending || loadingSubscription || isActive}>
                    {startCheckoutMutation.isPending ? "Gerando e redirecionando..." : "Pagar com Mercado Pago"}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void queryClient.invalidateQueries({ queryKey: ["my-store-subscription", user?.id] });
                      void queryClient.invalidateQueries({ queryKey: ["store-panel-access", user?.id] });
                    }}
                    disabled={!user}
                  >
                    Atualizar status
                  </Button>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs text-zinc-500">Se o pagamento aprovou e ainda não liberou, cole o ID e revalide.</p>
                  <input
                    value={paymentId}
                    onChange={(event) => setPaymentId(event.target.value)}
                    placeholder="ID do pagamento (opcional)"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
                  />
                  <Button variant="outline" onClick={() => revalidateMutation.mutate()} disabled={!checkout?.checkout_session_id || revalidateMutation.isPending}>
                    {revalidateMutation.isPending ? "Revalidando..." : "Revalidar pagamento"}
                  </Button>
                </div>

                {paymentError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                    <p className="text-sm font-semibold text-red-700">Não foi possível concluir agora</p>
                    <p className="text-sm text-red-700">{paymentError}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => startCheckoutMutation.mutate()} disabled={startCheckoutMutation.isPending || !user}>
                        Tentar novamente
                      </Button>
                      <a href={supportHref} target="_blank" rel="noreferrer">
                        <Button variant="outline">Falar com suporte</Button>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
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
                Pagamento aprovado libera automaticamente o acesso ao painel do lojista.
              </div>

              {isActive ? (
                <Link to="/admin" className="block pt-2">
                  <Button className="w-full rounded-full bg-zinc-900 text-zinc-100 hover:bg-zinc-800">
                    <BadgeCheck className="h-4 w-4 mr-2" />
                    Ir para painel liberado
                  </Button>
                </Link>
              ) : (
                <Link to="/admin" className="block pt-2">
                  <Button variant="outline" className="w-full rounded-full">
                    Ver status da assinatura no painel
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
