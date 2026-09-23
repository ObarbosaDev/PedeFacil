/**
 * Módulo: hero comercial.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: primeira dobra da página inicial.
 * Finalidade: comunicar canal próprio e conduzir ao piloto.
 * Motivo: trocar a narrativa ampla de ecossistema por uma promessa específica.
 * Evolução: testar headline e CTA com tráfego real.
 */
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { useRef } from "react";
import { ProductPreview } from "./ProductPreview";

type HeroSectionProps = {
  pilotHref: string;
};

export function HeroSection({ pilotHref }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const contentY = useTransform(scrollYProgress, [0, 0.5], [0, prefersReducedMotion ? 0 : -120]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.48], [1, prefersReducedMotion ? 1 : 0]);
  const previewY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -120]);

  return (
    <section ref={sectionRef} className="relative min-h-[105vh] overflow-hidden pb-24 pt-10 md:pt-16">
      <div className="marketing-grid absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="hero-aurora absolute left-1/2 top-0 h-[34rem] w-[54rem] max-w-[110vw] -translate-x-1/2 rounded-full" aria-hidden="true" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="liquid-glass mb-7 inline-flex items-center gap-2 rounded-xl px-3 py-2"
        >
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-black">Piloto</span>
          <span className="text-sm font-medium text-white/60">Seu canal próprio, sem comissão por pedido</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-4xl text-5xl font-medium leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]"
        >
          Venda direto.
          <br />
          Faça o cliente <span className="font-serif font-normal italic tracking-[-0.025em] text-[hsl(var(--marketing-primary))]">voltar.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-base font-normal leading-7 text-[hsl(var(--marketing-subtitle))] sm:text-lg"
        >
          Cardápio, pedidos, pagamentos e recompra em um só lugar.
          <br className="hidden sm:block" /> Sua loja vende com a própria marca e mantém o relacionamento com cada cliente.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
        >
          <motion.a
            href={pilotHref}
            target="_blank"
            rel="noreferrer"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-black sm:w-auto"
          >
            Quero colocar minha loja no ar
            <ArrowRight className="size-4" />
          </motion.a>
          <a
            href="#produto"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/[0.08] sm:w-auto"
          >
            Ver como funciona
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/42"
        >
          <span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-3.5" /> Implantação guiada</span>
          <span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-3.5" /> Sem aplicativo para o cliente</span>
          <span className="inline-flex items-center gap-1.5"><BadgeCheck className="size-3.5" /> Atendimento humano</span>
        </motion.div>
      </motion.div>

      <motion.div
        style={{ y: previewY }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="relative z-20 mt-16 w-screen md:mt-20"
      >
        <ProductPreview />
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-40 bg-gradient-to-t from-[hsl(var(--marketing-background))] to-transparent" />
    </section>
  );
}
