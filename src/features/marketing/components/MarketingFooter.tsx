/**
 * Módulo: fechamento e rodapé comercial.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: final da landing e contato.
 * Finalidade: repetir a ação principal e oferecer navegação institucional.
 * Motivo: o visitante precisa terminar a página com um próximo passo inequívoco.
 * Evolução: adicionar documentos legais e dados empresariais validados.
 */
import { ArrowRight, Instagram, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { SUPPORT_PHONE_DISPLAY } from "@/lib/support";
import { Brand } from "./Brand";

type MarketingFooterProps = {
  pilotHref: string;
};

export function MarketingFooter({ pilotHref }: MarketingFooterProps) {
  return (
    <footer className="px-4 pb-6 md:px-10 lg:px-16 xl:px-28">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[2rem] border border-white/10 bg-[hsl(var(--marketing-card))]">
        <div className="relative px-6 py-16 text-center md:px-12 md:py-24">
          <div className="absolute left-1/2 top-1/2 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsla(var(--marketing-primary),0.12)] blur-[100px]" aria-hidden="true" />
          <div className="relative mx-auto max-w-3xl">
            <p className="marketing-kicker">Próximo passo</p>
            <h2 className="mt-4 text-4xl font-medium leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
              Vamos colocar seu canal próprio para vender?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/48">
              Conte como sua loja opera hoje. A gente avalia se o piloto faz sentido antes de prometer qualquer coisa.
            </p>
            <a
              href={pilotHref}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-black transition-opacity hover:opacity-85"
            >
              Falar sobre minha loja
              <ArrowRight className="size-4" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-5 border-t border-white/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Brand />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/42">
            <Link to="/login" className="transition-colors hover:text-white">Área do lojista</Link>
            <a href={pilotHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
              <MessageCircle className="size-3.5" /> {SUPPORT_PHONE_DISPLAY}
            </a>
            <span className="inline-flex items-center gap-1.5 text-white/25"><Instagram className="size-3.5" /> Em breve</span>
          </div>
        </div>
      </div>
      <p className="py-5 text-center text-[11px] text-white/25">© {new Date().getFullYear()} Pede Fácil. Venda direta com relacionamento de verdade.</p>
    </footer>
  );
}
