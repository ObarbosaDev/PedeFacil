import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, CircleHelp, Crown, Rocket, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BillingMode, getPlanBySlug, getPlanMonthlyAnchor, getPlanPrice, getPlanYearlySavings, plans } from "@/lib/plans";
import { trackProductEvent } from "@/lib/product-analytics";
import { buildWhatsAppSupportLink } from "@/lib/support";

const comparisonRows = [
  { label: "Pedidos no WhatsApp", values: [true, true, true] },
  { label: "Cupons e campanhas", values: [false, true, true] },
  { label: "Painel de entregadores", values: [false, true, true] },
  { label: "Relatórios avançados", values: [false, true, true] },
  { label: "Suporte prioritário", values: [false, false, true] },
  { label: "Acompanhamento consultivo", values: [false, false, true] },
];

const faqs = [
  {
    question: "O cliente paga para usar o app?",
    answer: "Não. Quem assina o sistema é o lojista. Cliente compra normalmente e usa a operação que a loja montou.",
  },
  {
    question: "Posso começar baixo e subir depois?",
    answer: "Sim. Você pode começar no plano mais leve e subir quando a operação pedir mais campanha, entregador e acompanhamento.",
  },
  {
    question: "Tem fidelidade longa ou amarração?",
    answer: "A proposta é retenção por resultado, não por armadilha. O teste grátis serve justamente para você validar com calma.",
  },
  {
    question: "Dá para ativar rápido?",
    answer: "Sim. Se o cardápio e os dados da loja já estiverem na mão, o painel começa a rodar em pouco tempo.",
  },
];

export default function Plans() {
  const [searchParams] = useSearchParams();
  const [billingMode, setBillingMode] = useState<BillingMode>((searchParams.get("billing") as BillingMode) || "monthly");
  const [ordersPerDay, setOrdersPerDay] = useState(45);
  const [avgTicket, setAvgTicket] = useState(38);

  const highlightedPlan = getPlanBySlug(searchParams.get("plano")) || plans.find((plan) => plan.featured) || plans[0];

  const badgeText = useMemo(
    () => (billingMode === "monthly" ? "Cobrança mensal sem complicação" : "Cobrança anual com desconto agressivo"),
    [billingMode]
  );

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);

  const simulator = useMemo(() => {
    const monthlyVolume = ordersPerDay * avgTicket * 30;
    const estimatedGain = monthlyVolume * 0.08;
    const highlightedPrice = getPlanPrice(highlightedPlan, billingMode);
    const coverageDays = Math.max(1, Math.ceil(highlightedPrice / Math.max(avgTicket, 1)));
    return { monthlyVolume, estimatedGain, coverageDays };
  }, [avgTicket, billingMode, highlightedPlan, ordersPerDay]);

  const whatsappHref = useMemo(() => {
    const text = `Fala! Quero entender melhor o plano ${highlightedPlan.name} do PedeFácil.`;
    return buildWhatsAppSupportLink(text);
  }, [highlightedPlan.name]);

  useEffect(() => {
    void trackProductEvent("funnel_plans_view", {
      source: "plans_page",
      billingMode,
    });
  }, [billingMode]);

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-zinc-900">
      <a
        href="#conteudo-principal-planos"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[9999] focus:bg-zinc-900 focus:text-zinc-100 focus:px-4 focus:py-2 focus:rounded-md"
      >
        Ir para o conteúdo principal
      </a>
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[26rem] w-[26rem] rounded-full bg-orange-300/25 blur-3xl" />
        <div className="absolute -bottom-20 right-0 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(251,191,36,0.16),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.14),transparent_35%)]" />
      </div>

      <nav className="sticky top-0 z-50 border-b border-zinc-200/70 bg-[#f6f4ef]/88 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center" aria-label="Voltar para a página inicial">
            <img src="/logo.png" alt="Logo Pede Fácil" className="h-10 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" className="rounded-full">Voltar para home</Button>
            </Link>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <Button variant="outline" className="rounded-full">Falar no WhatsApp</Button>
            </a>
          </div>
        </div>
      </nav>

      <main id="conteudo-principal-planos" className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <section className="rounded-[2rem] border border-zinc-200 bg-white/92 backdrop-blur p-6 md:p-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-orange-200/40 blur-3xl pointer-events-none" />
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start relative">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                30 dias grátis para sentir o produto rodando
              </div>
              <h1 className="mt-4 text-4xl md:text-5xl font-black leading-[1.03]">
                Preço mais afiado, produto mais sólido e um caminho mais fácil para fechar.
              </h1>
              <p className="mt-4 max-w-3xl text-zinc-600 text-base md:text-lg">
                A lógica aqui é simples: reduzir atrito para entrar, entregar valor de verdade e deixar claro o que cada plano resolve no teu estágio.
              </p>

              <div className="mt-6 inline-flex rounded-full border border-zinc-300 bg-zinc-100 p-1" role="radiogroup" aria-label="Frequência de cobrança">
                <button
                  type="button"
                  onClick={() => {
                    setBillingMode("monthly");
                    void trackProductEvent("funnel_plan_selected", { source: "plans_toggle", billing: "monthly" });
                  }}
                  role="radio"
                  aria-checked={billingMode === "monthly"}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    billingMode === "monthly" ? "bg-zinc-900 text-zinc-100" : "text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBillingMode("yearly");
                    void trackProductEvent("funnel_plan_selected", { source: "plans_toggle", billing: "yearly" });
                  }}
                  role="radio"
                  aria-checked={billingMode === "yearly"}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    billingMode === "yearly" ? "bg-zinc-900 text-zinc-100" : "text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Anual
                </button>
              </div>
              <p className="mt-3 text-sm text-zinc-500">{badgeText}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={`/planos/checkout?plano=${highlightedPlan.slug}&billing=${billingMode}`}>
                  <Button className="rounded-full bg-zinc-900 text-zinc-100 hover:bg-zinc-800">
                    Escolher {highlightedPlan.name}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="rounded-full">Quero tirar dúvida real</Button>
                </a>
              </div>
            </div>

            <Card className="border-zinc-200 bg-zinc-950 text-zinc-100 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.95)]">
              <CardHeader>
                <CardTitle className="text-zinc-100">Resumo comercial sem enrolação</CardTitle>
                <CardDescription className="text-zinc-300">
                  O plano mais escolhido está em <span className="font-semibold text-orange-300">{formatPrice(getPlanPrice(plans.find((plan) => plan.slug === "profissional") || plans[1], billingMode))}/mês</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-zinc-200">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Por que isso converte melhor</p>
                  <p className="mt-2 font-semibold">Entrada mais leve, percepção de valor mais forte e trial para reduzir medo de compra.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-xs text-zinc-400">Preço inicial</p>
                    <p className="mt-1 text-2xl font-black text-orange-300">{formatPrice(getPlanPrice(plans[0], billingMode))}</p>
                    <p className="text-xs text-zinc-400 mt-1">para entrar no jogo sem travar caixa</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-xs text-zinc-400">Plano mais forte</p>
                    <p className="mt-1 text-2xl font-black text-emerald-300">30 dias grátis</p>
                    <p className="text-xs text-zinc-400 mt-1">para usar antes de pagar de verdade</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Checkout seguro</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1"><BadgeCheck className="h-3.5 w-3.5 text-orange-300" /> Produto pronto para operar</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const price = getPlanPrice(plan, billingMode);
            const saving = getPlanYearlySavings(plan);
            const isHighlighted = plan.slug === highlightedPlan.slug;
            return (
              <Card
                key={plan.slug}
                className={
                  plan.featured
                    ? `border-zinc-900 bg-zinc-900 text-zinc-100 shadow-[0_24px_80px_-60px_rgba(0,0,0,0.9)] ${isHighlighted ? "ring-2 ring-orange-400" : ""}`
                    : `border-zinc-200 bg-white ${isHighlighted ? "ring-2 ring-orange-300" : ""}`
                }
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs uppercase tracking-wider ${plan.featured ? "text-zinc-300" : "text-zinc-500"}`}>
                      {plan.highlight}
                    </p>
                    {plan.featured ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-1 bg-zinc-100 text-zinc-900">
                        <Crown className="h-3.5 w-3.5" />
                        Mais pedido
                      </span>
                    ) : null}
                  </div>
                  <CardTitle className={plan.featured ? "text-zinc-100" : "text-zinc-900"}>{plan.name}</CardTitle>
                  <CardDescription className={plan.featured ? "text-zinc-300" : "text-zinc-600"}>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div>
                      <p className={`text-3xl font-black ${plan.featured ? "text-orange-300" : "text-zinc-900"}`}>
                        {formatPrice(price)}
                        <span className={`text-sm font-medium ml-1 ${plan.featured ? "text-zinc-300" : "text-zinc-500"}`}>/mês</span>
                      </p>
                      {billingMode === "yearly" ? (
                        <p className="mt-1 text-xs text-emerald-500 font-semibold">Economia anual de {formatPrice(saving)}</p>
                      ) : (
                        <p className={`mt-1 text-xs ${plan.featured ? "text-zinc-400" : "text-zinc-500"}`}>Âncora mensal cheia: {formatPrice(getPlanMonthlyAnchor(plan))}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.featured ? "bg-zinc-100 text-zinc-900" : "bg-orange-100 text-orange-700"}`}>
                      30 dias grátis
                    </span>
                  </div>

                  <div className={`mt-5 rounded-2xl border p-4 ${plan.featured ? "border-zinc-800 bg-zinc-950/60" : "border-zinc-200 bg-zinc-50"}`}>
                    <p className={`text-sm font-semibold ${plan.featured ? "text-zinc-100" : "text-zinc-900"}`}>{plan.shortPitch}</p>
                    <p className={`mt-2 text-sm ${plan.featured ? "text-zinc-300" : "text-zinc-600"}`}>{plan.audience}</p>
                    <p className={`mt-1 text-sm ${plan.featured ? "text-zinc-300" : "text-zinc-600"}`}>{plan.volumeHint}</p>
                  </div>

                  <div className="space-y-2 mt-5">
                    {plan.perks.map((perk) => (
                      <p key={perk} className={`text-sm flex items-start gap-2 ${plan.featured ? "text-zinc-100" : "text-zinc-700"}`}>
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.featured ? "text-emerald-300" : "text-emerald-600"}`} />
                        <span>{perk}</span>
                      </p>
                    ))}
                  </div>

                  <p className={`mt-4 text-xs ${plan.featured ? "text-zinc-400" : "text-zinc-500"}`}>{plan.setupPromise}</p>

                  <Link to={`/planos/checkout?plano=${plan.slug}&billing=${billingMode}`} className="block mt-6">
                    <Button
                      className={`w-full rounded-full ${plan.featured ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-zinc-100 hover:bg-zinc-800"}`}
                      onClick={() =>
                        void trackProductEvent("funnel_plan_selected", {
                          source: "plans_cards",
                          plan: plan.slug,
                          billing: billingMode,
                        })
                      }
                    >
                      {plan.ctaLabel}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[0.55fr_0.45fr] gap-4">
          <Card className="border-zinc-200 bg-white">
            <CardHeader>
              <CardTitle>Comparativo rápido</CardTitle>
              <CardDescription>Sem fumaça: o que realmente muda quando você sobe de plano.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left">
                    <th className="py-2 pr-3">Recurso</th>
                    <th className="py-2 px-3">Essencial</th>
                    <th className="py-2 px-3">Profissional</th>
                    <th className="py-2 px-3">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b border-zinc-100 last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-zinc-700">{row.label}</td>
                      {row.values.map((enabled, index) => (
                        <td key={`${row.label}-${index}`} className="py-2 px-3">
                          {enabled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <Check className="h-4 w-4" /> Sim
                            </span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                Simulador simples de valor
              </CardTitle>
              <CardDescription>Não é promessa mágica. É uma conta rápida para entender o peso do plano no teu caixa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="ordersRange" className="text-sm font-medium">Pedidos por dia: {ordersPerDay}</label>
                <input
                  id="ordersRange"
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={ordersPerDay}
                  onChange={(event) => setOrdersPerDay(Number(event.target.value))}
                  className="mt-2 w-full accent-orange-500"
                />
              </div>
              <div>
                <label htmlFor="ticketRange" className="text-sm font-medium">Ticket médio: {formatPrice(avgTicket)}</label>
                <input
                  id="ticketRange"
                  type="range"
                  min={20}
                  max={120}
                  step={2}
                  value={avgTicket}
                  onChange={(event) => setAvgTicket(Number(event.target.value))}
                  className="mt-2 w-full accent-orange-500"
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Volume mensal estimado</p>
                <p className="text-2xl font-black mt-1">{formatPrice(simulator.monthlyVolume)}</p>
                <p className="text-xs text-zinc-500 mt-3">Ganho potencial com operação mais redonda</p>
                <p className="text-xl font-black text-emerald-700 mt-1">+ {formatPrice(simulator.estimatedGain)} /mês</p>
                <p className="text-xs text-zinc-600 mt-3">
                  No cenário acima, o plano <span className="font-semibold">{highlightedPlan.name}</span> se paga com o equivalente a cerca de <span className="font-semibold">{simulator.coverageDays} dias</span> de operação.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-black">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-4">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-left">
                  <span className="inline-flex items-center gap-2">
                    <CircleHelp className="h-4 w-4 text-orange-500" />
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-zinc-600">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-8 md:p-10 relative overflow-hidden">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-52 w-52 rounded-full bg-orange-400/20 blur-3xl pointer-events-none" />
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-300 relative">Fechamento comercial</p>
          <h2 className="text-3xl md:text-4xl font-black mt-2 relative">Escolha o plano certo e entra com estrutura de verdade.</h2>
          <p className="text-zinc-300 mt-3 max-w-2xl relative">
            Preço competitivo chama atenção. Produto sólido segura o cliente depois. A ideia aqui é ter os dois.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 relative">
            <Link to={`/planos/checkout?plano=${highlightedPlan.slug}&billing=${billingMode}`}>
              <Button
                size="lg"
                className="rounded-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                onClick={() =>
                  void trackProductEvent("funnel_checkout_started", {
                    source: "plans_footer_cta",
                    plan: highlightedPlan.slug,
                    billing: billingMode,
                  })
                }
              >
                <Rocket className="h-4 w-4 mr-2" />
                Ir para checkout
              </Button>
            </Link>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="rounded-full border-zinc-100/70 bg-zinc-100/10 text-zinc-100 hover:bg-zinc-100 hover:text-zinc-900">
                <BadgeCheck className="h-4 w-4 mr-2" />
                Falar com suporte
              </Button>
            </a>
          </div>

          <div className="mt-6 flex items-center gap-4 text-xs text-zinc-300 relative flex-wrap">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Login seguro</span>
            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Trial de 30 dias</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Design premium</span>
          </div>
        </section>
      </main>
    </div>
  );
}
