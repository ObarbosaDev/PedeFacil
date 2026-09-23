/**
 * Módulo: proposta de valor em três resultados.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: seção de produto da landing.
 * Finalidade: conectar recursos a venda, operação e recompra.
 * Motivo: listas extensas de funções não explicam valor ao lojista.
 * Evolução: adicionar evidências reais conforme o piloto gerar dados.
 */
import { ArrowUpRight, ListChecks, Repeat2, Store } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { valuePropositions } from "../content/landing-content";

const iconByName = {
  store: Store,
  orders: ListChecks,
  repeat: Repeat2,
};

export function ValueSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="produto" className="px-4 py-24 md:px-10 md:py-32 lg:px-16 xl:px-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="max-w-3xl">
          <p className="marketing-kicker">O produto</p>
          <h2 className="mt-4 text-4xl font-medium leading-[1.02] tracking-[-0.045em] text-white md:text-6xl">
            Menos painel para aprender.
            <br />Mais venda para <span className="font-serif font-normal italic text-[hsl(var(--marketing-primary))]">acompanhar.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/50 md:text-lg">
            Cada tela existe para reduzir uma etapa entre a vontade do cliente e o pedido entregue.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {valuePropositions.map((item, index) => {
            const Icon = iconByName[item.icon];
            return (
              <motion.article
                key={item.title}
                initial={prefersReducedMotion ? false : { y: 24 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: index * 0.08 }}
                className="group relative min-h-80 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[hsl(var(--marketing-card))] p-7 transition-colors hover:border-white/20"
              >
                <div className="absolute -right-20 -top-20 size-52 rounded-full bg-[hsla(var(--marketing-primary),0.09)] blur-3xl transition-opacity group-hover:opacity-100" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[hsl(var(--marketing-primary))]">
                      <Icon className="size-5" />
                    </span>
                    <ArrowUpRight className="size-5 text-white/20 transition-colors group-hover:text-white/60" />
                  </div>
                  <div className="mt-auto pt-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--marketing-primary))]">{item.eyebrow}</p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/48">{item.description}</p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
