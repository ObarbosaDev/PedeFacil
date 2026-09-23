/**
 * Módulo: etapas de implantação.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: seção como funciona da landing.
 * Finalidade: reduzir a percepção de esforço para colocar a loja no ar.
 * Motivo: o lojista compra velocidade e apoio, não uma ferramenta para configurar sozinho.
 * Evolução: ligar cada etapa ao onboarding real do produto.
 */
import { motion, useReducedMotion } from "framer-motion";
import { implementationSteps } from "../content/landing-content";

export function HowItWorksSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="como-funciona" className="border-y border-white/[0.08] bg-white/[0.018] px-4 py-24 md:px-10 md:py-32 lg:px-16 xl:px-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="marketing-kicker">Da ideia ao primeiro pedido</p>
            <h2 className="mt-4 text-4xl font-medium leading-[1.03] tracking-[-0.045em] text-white md:text-5xl">
              Sua loja no ar sem virar um projeto de tecnologia.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/48">
              No piloto, a implantação é acompanhada. O objetivo é publicar rápido, receber um pedido real e ensinar sua equipe a operar.
            </p>
          </div>

          <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {implementationSteps.map((step, index) => (
              <motion.article
                key={step.number}
                initial={prefersReducedMotion ? false : { x: 28 }}
                whileInView={{ x: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="grid gap-4 py-7 sm:grid-cols-[4rem_1fr] sm:gap-7 md:py-9"
              >
                <span className="font-serif text-3xl italic text-[hsl(var(--marketing-primary))]">{step.number}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{step.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/48 md:text-base">{step.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
