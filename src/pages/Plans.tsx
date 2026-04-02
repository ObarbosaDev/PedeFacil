import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, CircleHelp, Crown, Rocket, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BillingMode, getPlanBySlug, getPlanPrice, plans } from "@/lib/plans";
import { trackProductEvent } from "@/lib/product-analytics";

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
    question: "Cliente paga para usar o app?",
    answer: "Não. Cliente compra normalmente. O plano é para o lojista operar com estrutura profissional.",
  },
  {
    question: "Posso mudar de plano depois?",
    answer: "Sim. Você pode subir ou descer de plano conforme a fase da sua operação.",
  },
  {
    question: "Tem fidelidade obrigatória?",
    answer: "Não precisa fidelidade longa. A ideia é você ficar porque funciona, não por amarra.",
  },
  {
    question: "Em quanto tempo dá para começar?",
    answer: "Se os dados da loja já estiverem na mão, o setup inicial sai rápido, em minutos.",
  },
];

export default function Plans() {
  const [searchParams] = useSearchParams();
  const [billingMode, setBillingMode] = useState<BillingMode>((searchParams.get("billing") as BillingMode) || "monthly");
  const [ordersPerDay, setOrdersPerDay] = useState(45);
  const [avgTicket, setAvgTicket] = useState(38);

  const highlightedPlan =
    getPlanBySlug(searchParams.get("plano")) || plans.find((plan) => plan.featured) || plans[0];

  const badgeText = useMemo(
    () => (billingMode === "monthly" ? "Cobrança mensal" : "Cobrança anual com economia"),
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
    return { monthlyVolume, estimatedGain };
  }, [ordersPerDay, avgTicket]);

  const whatsappHref = useMemo(() => {
    const text = `Fala! Quero contratar o plano ${highlightedPlan.name} no PedeFácil. Vamos fechar?`;
    return `https://wa.me/5500000000000?text=${encodeURIComponent(text)}`;
  }, [highlightedPlan.name]);

  useEffect(() => {
    void trackProductEvent("funnel_plans_view", {
      source: "plans_page",
      billingMode,
    });
  }, [billingMode]);

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-zinc-900">
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

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-8">
        <section className="rounded-3xl border border-zinc-200 bg-white/90 backdrop-blur p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
            <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            Planos pensados para crescer junto com sua operação
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-black leading-[1.03]">
            Ver planos, comparar certo e escolher sem dúvida.
          </h1>
          <p className="mt-4 text-zinc-600 max-w-3xl">
            Aqui é direto ao ponto: o que cada plano entrega, quanto custa e qual encaixa melhor no teu momento.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-zinc-300 bg-zinc-100 p-1" role="radiogroup" aria-label="Frequência de cobrança">
            <button
              type="button"
              onClick={() => { setBillingMode("monthly"); void trackProductEvent("funnel_plan_selected", { source: "plans_toggle", billing: "monthly" }); }}
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
              onClick={() => { setBillingMode("yearly"); void trackProductEvent("funnel_plan_selected", { source: "plans_toggle", billing: "yearly" }); }}
              role="radio"
              aria-checked={billingMode === "yearly"}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                billingMode === "yearly" ? "bg-zinc-900 text-zinc-100" : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Anual (economiza)
            </button>
          </div>
          <p className="mt-3 text-sm text-zinc-500">{badgeText}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const price = getPlanPrice(plan, billingMode);
            const hasSaving = billingMode === "yearly" && plan.yearly < plan.monthly;
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
                        Destaque
                      </span>
                    ) : null}
                  </div>
                  <CardTitle className={plan.featured ? "text-zinc-100" : "text-zinc-900"}>{plan.name}</CardTitle>
                  <CardDescription className={plan.featured ? "text-zinc-300" : "text-zinc-600"}>
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-black ${plan.featured ? "text-orange-300" : "text-zinc-900"}`}>
                    {formatPrice(price)}
                    <span className={`text-sm font-medium ml-1 ${plan.featured ? "text-zinc-300" : "text-zinc-500"}`}>
                      /mês
                    </span>
                  </p>
                  {hasSaving ? (
                    <p className="mt-1 text-xs text-emerald-500 font-semibold">
                      Economia anual: {formatPrice((plan.monthly - plan.yearly) * 12)}
                    </p>
                  ) : null}

                  <div className="space-y-2 mt-5">
                    {plan.perks.map((perk) => (
                      <p key={perk} className={`text-sm flex items-start gap-2 ${plan.featured ? "text-zinc-100" : "text-zinc-700"}`}>
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.featured ? "text-emerald-300" : "text-emerald-600"}`} />
                        <span>{perk}</span>
                      </p>
                    ))}
                  </div>

                  <Link to={`/planos/checkout?plano=${plan.slug}&billing=${billingMode}`} className="block mt-6">
                    <Button
                      className={`w-full rounded-full ${
                        plan.featured ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200" : "bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                      }`}
                      onClick={() =>
                        void trackProductEvent("funnel_plan_selected", {
                          source: "plans_cards",
                          plan: plan.slug,
                          billing: billingMode,
                        })
                      }
                    >
                      Escolher plano
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
              <CardDescription>Sem enrolação: o que muda de um plano para outro.</CardDescription>
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
                Simulador de potencial
              </CardTitle>
              <CardDescription>Projeção simples para te ajudar a decidir com mais contexto.</CardDescription>
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

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs text-zinc-500">Volume mensal estimado</p>
                <p className="text-2xl font-black mt-1">{formatPrice(simulator.monthlyVolume)}</p>
                <p className="text-xs text-zinc-500 mt-3">Potencial de ganho com operação mais eficiente</p>
                <p className="text-xl font-black text-emerald-700 mt-1">+ {formatPrice(simulator.estimatedGain)} /mês</p>
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
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-300 relative">Pronto para subir o nível</p>
          <h2 className="text-3xl md:text-4xl font-black mt-2 relative">Escolha seu plano e coloca a operação no eixo.</h2>
          <p className="text-zinc-300 mt-3 max-w-2xl relative">
            Nada de sistema engessado. Você entra com estrutura profissional e com cara de marca grande.
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
                Ir para pagamento
              </Button>
            </Link>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="rounded-full border-zinc-100/70 bg-zinc-100/10 text-zinc-100 hover:bg-zinc-100 hover:text-zinc-900">
                <BadgeCheck className="h-4 w-4 mr-2" />
                Tirar dúvidas
              </Button>
            </a>
          </div>

          <div className="mt-6 flex items-center gap-4 text-xs text-zinc-300 relative flex-wrap">
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Login seguro</span>
            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Fluxo validado</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Visual premium</span>
          </div>
        </section>
      </main>
    </div>
  );
}




