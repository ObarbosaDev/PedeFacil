/**
 * Módulo: assinatura visual da marca.
 * Data: 2026-09-23.
 * Responsável: Engenharia Pede Fácil.
 * Tela/fluxo: navegação comercial e rodapé.
 * Finalidade: manter símbolo e nome legíveis em superfícies escuras.
 * Motivo: o PNG legado perde contraste no novo tema.
 * Evolução: substituir pelo SVG oficial quando a marca for finalizada.
 */
import { MessageCircle, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type BrandProps = {
  className?: string;
  compact?: boolean;
};

export function Brand({ className, compact = false }: BrandProps) {
  return (
    <Link
      to="/"
      aria-label="Pede Facil, pagina inicial"
      className={cn("inline-flex items-center gap-2.5 text-white", className)}
    >
      <span className="relative grid size-9 place-items-center" aria-hidden="true">
        <MessageCircle className="absolute inset-0 size-9 fill-[hsl(var(--marketing-primary))] text-[hsl(var(--marketing-primary))]" />
        <Utensils className="relative -translate-y-0.5 size-4.5 text-white" strokeWidth={2.4} />
      </span>
      {!compact ? (
        <span className="text-xl font-bold tracking-[-0.04em]">
          Pede<span className="text-[hsl(var(--marketing-primary))]">Facil</span>
        </span>
      ) : null}
    </Link>
  );
}
