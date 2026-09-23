/**
 * Módulo: composição da landing comercial.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: rota pública `/`.
 * Finalidade: apresentar o novo MVP e captar lojas para o piloto.
 * Motivo: a home antiga dependia do banco e vendia três produtos diferentes.
 * Evolução: integrar eventos first-party e casos reais após o piloto.
 */
import { useMemo } from "react";
import { buildWhatsAppSupportLink } from "@/lib/support";
import { FaqSection } from "../components/FaqSection";
import { HeroSection } from "../components/HeroSection";
import { HowItWorksSection } from "../components/HowItWorksSection";
import { ManifestoSection } from "../components/ManifestoSection";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingHeader } from "../components/MarketingHeader";
import { PricingSection } from "../components/PricingSection";
import { ValueSection } from "../components/ValueSection";
import "../styles/marketing.css";

export default function LandingPage() {
  const pilotHref = useMemo(
    () => buildWhatsAppSupportLink("Olá! Quero entender se o piloto do Pede Fácil faz sentido para minha loja."),
    []
  );

  return (
    <div className="marketing-shell min-h-screen overflow-x-clip bg-[hsl(var(--marketing-background))] text-white">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Ir para o conteúdo principal
      </a>
      <MarketingHeader pilotHref={pilotHref} />
      <main id="conteudo-principal">
        <HeroSection pilotHref={pilotHref} />
        <ManifestoSection />
        <ValueSection />
        <HowItWorksSection />
        <PricingSection pilotHref={pilotHref} />
        <FaqSection />
      </main>
      <MarketingFooter pilotHref={pilotHref} />
    </div>
  );
}
