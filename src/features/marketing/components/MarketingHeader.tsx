/**
 * Módulo: cabeçalho comercial responsivo.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: landing, navegação e entrada no piloto.
 * Finalidade: levar o visitante ao conteúdo ou à conversa comercial.
 * Motivo: reduzir opções e destacar uma única ação de aquisição.
 * Evolução: integrar métricas próprias quando a API de eventos estiver pronta.
 */
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "./Brand";
import { marketingNavigation } from "../content/landing-content";

type MarketingHeaderProps = {
  pilotHref: string;
};

export function MarketingHeader({ pilotHref }: MarketingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-50 px-4 py-4 md:px-10 lg:px-16 xl:px-28">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between" aria-label="Navegacao principal">
        <div className="flex items-center gap-10 lg:gap-16">
          <Brand />
          <div className="hidden items-center gap-1 md:flex">
            {marketingNavigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white/72 transition-colors hover:text-white"
          >
            Entrar
          </Link>
          <a
            href={pilotHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-85"
          >
            Quero vender direto
          </a>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-lg border border-white/10 text-white md:hidden"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {menuOpen ? (
        <div className="liquid-glass absolute left-4 right-4 top-[4.5rem] rounded-2xl p-3 md:hidden">
          <div className="flex flex-col">
            {marketingNavigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/[0.06] hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <Link
                to="/login"
                className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Entrar
              </Link>
              <a
                href={pilotHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-black"
              >
                Participar
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
