/**
 * Módulo: manifesto comercial com revelação por rolagem.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: seção de resultados da landing.
 * Finalidade: explicar a dor de recorrência sem inventar depoimentos.
 * Motivo: prova social falsa destruiria confiança antes do piloto.
 * Evolução: substituir por caso real autorizado e verificável.
 */
import { motion, useScroll, useTransform } from "framer-motion";
import { Quote } from "lucide-react";
import { useRef } from "react";

const manifesto =
  "O problema não é apenas receber pedidos. É perder o cliente depois da primeira compra. O Pede Fácil organiza a venda de hoje e cria o caminho para a próxima.";

function RevealWord({ word, index, total, progress }: { word: string; index: number; total: number; progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const start = index / total;
  const end = Math.min(1, (index + 1.6) / total);
  const opacity = useTransform(progress, [start, end], [0.38, 1]);
  const color = useTransform(progress, [start, end], ["hsl(0 0% 50%)", "hsl(0 0% 100%)"]);

  return (
    <motion.span style={{ opacity, color }} className="mr-[0.26em] inline-block">
      {word}
    </motion.span>
  );
}

export function ManifestoSection() {
  const containerRef = useRef<HTMLElement>(null);
  const words = manifesto.split(" ");
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end center"],
  });

  return (
    <section ref={containerRef} id="resultados" className="flex min-h-[65vh] items-center px-6 py-20 md:min-h-[85vh] md:px-16 md:py-32">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-9">
        <div className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[hsl(var(--marketing-primary))]">
          <Quote className="size-5 fill-current" />
        </div>
        <p className="flex flex-wrap text-3xl font-medium leading-[1.16] tracking-[-0.035em] md:text-5xl">
          {words.map((word, index) => (
            <RevealWord key={`${word}-${index}`} word={word} index={index} total={words.length} progress={scrollYProgress} />
          ))}
        </p>
        <div className="flex items-center gap-4 border-l border-[hsl(var(--marketing-primary))] pl-4">
          <div>
            <p className="text-sm font-semibold text-white">Por que o Pede Fácil existe</p>
            <p className="mt-1 text-sm text-white/45">Venda própria, operação clara e relacionamento que permanece com a loja.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
