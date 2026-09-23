/**
 * Módulo: apresentação comercial dos planos do MVP.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: seção de planos e entrada no piloto.
 * Finalidade: mostrar preço e escopo sem iniciar cobrança inconsistente.
 * Motivo: o billing legado ainda trabalha com três planos e será migrado separadamente.
 * Evolução: conectar ao checkout somente após a homologação do módulo de pagamentos.
 */
import { Check, MoveRight, Sparkles } from "lucide-react";
import { pilotPlans } from "../content/landing-content";

type PricingSectionProps = {
  pilotHref: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function PricingSection({ pilotHref }: PricingSectionProps) {
  return (
    <section id="planos" className="px-4 py-24 md:px-10 md:py-32 lg:px-16 xl:px-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="marketing-kicker">Planos do lançamento</p>
          <h2 className="mt-4 text-4xl font-medium leading-[1.03] tracking-[-0.045em] text-white md:text-6xl">
            Assinatura clara.
            <br />Sem percentual sobre sua venda.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/48">
            Os valores abaixo são a proposta comercial do novo MVP. A ativação acontece pelo piloto acompanhado, sem cobrança automática surpresa.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {pilotPlans.map((plan) => (
            <article
              key={plan.name}
              className={`relative overflow-hidden rounded-[2rem] border p-7 md:p-9 ${
                plan.featured
                  ? "border-[hsla(var(--marketing-primary),0.5)] bg-[hsl(var(--marketing-card-elevated))]"
                  : "border-white/10 bg-[hsl(var(--marketing-card))]"
              }`}
            >
              {plan.featured ? (
                <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--marketing-primary))] px-3 py-1 text-xs font-semibold text-white">
                  <Sparkles className="size-3.5" /> Para crescer
                </div>
              ) : null}

              <p className="text-sm font-semibold uppercase tracking-[0.17em] text-white/45">{plan.name}</p>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-5xl font-semibold tracking-[-0.05em] text-white">{currencyFormatter.format(plan.price)}</span>
                <span className="pb-1 text-sm text-white/40">/mês</span>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/50">{plan.description}</p>

              <div className="my-7 h-px bg-white/[0.08]" />

              <div className="space-y-3">
                {plan.features.map((feature) => (
                  <p key={feature} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-emerald-300">
                      <Check className="size-3" />
                    </span>
                    {feature}
                  </p>
                ))}
              </div>

              <a
                href={pilotHref}
                target="_blank"
                rel="noreferrer"
                className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all ${
                  plan.featured
                    ? "bg-white text-black hover:opacity-85"
                    : "border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                }`}
              >
                Quero participar do piloto
                <MoveRight className="size-4" />
              </a>
            </article>
          ))}
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-white/35">
          Taxas do provedor de pagamento não estão incluídas na assinatura. Condições finais são confirmadas antes da ativação.
        </p>
      </div>
    </section>
  );
}
