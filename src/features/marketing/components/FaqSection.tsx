/**
 * Módulo: dúvidas comerciais frequentes.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: objeções finais da landing.
 * Finalidade: esclarecer dependência do iFood, pagamento e operação.
 * Motivo: reduzir conversas repetitivas sem esconder limites do MVP.
 * Evolução: ordenar perguntas com base nas objeções dos pilotos.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { frequentlyAskedQuestions } from "../content/landing-content";

export function FaqSection() {
  return (
    <section className="border-t border-white/[0.08] px-4 py-24 md:px-10 md:py-32 lg:px-16 xl:px-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div>
          <p className="marketing-kicker">Dúvidas honestas</p>
          <h2 className="mt-4 text-4xl font-medium leading-[1.03] tracking-[-0.045em] text-white md:text-5xl">
            Sem letra pequena.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/48">
            O Pede Fácil não promete substituir todos os seus canais. Ele constrói um canal que pertence à sua operação.
          </p>
        </div>

        <Accordion type="single" collapsible className="border-t border-white/10">
          {frequentlyAskedQuestions.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`} className="border-white/10">
              <AccordionTrigger className="py-6 text-left text-base font-medium text-white hover:no-underline md:text-lg">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="max-w-2xl pb-6 text-sm leading-6 text-white/50 md:text-base md:leading-7">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
