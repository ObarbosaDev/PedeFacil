export type BillingMode = "monthly" | "yearly";

export type Plan = {
  slug: "essencial" | "profissional" | "premium";
  name: string;
  monthly: number;
  yearly: number;
  highlight: string;
  description: string;
  perks: string[];
  featured?: boolean;
};

export const plans: Plan[] = [
  {
    slug: "essencial",
    name: "Essencial",
    monthly: 79,
    yearly: 63,
    highlight: "Entrada forte",
    description: "Para quem quer organizar a operação sem complicar.",
    perks: ["Cardápio digital", "Pedidos no WhatsApp", "Painel em tempo real", "Suporte por e-mail"],
  },
  {
    slug: "profissional",
    name: "Profissional",
    monthly: 149,
    yearly: 119,
    highlight: "Mais escolhido",
    description: "Equilíbrio ideal entre crescimento e controle.",
    perks: ["Tudo do Essencial", "Cupons e campanhas", "Relatórios avançados", "Gestão de entregadores"],
    featured: true,
  },
  {
    slug: "premium",
    name: "Premium",
    monthly: 249,
    yearly: 199,
    highlight: "Escala e performance",
    description: "Para operação em ritmo alto e visão de longo prazo.",
    perks: ["Tudo do Profissional", "Suporte prioritário", "Acompanhamento consultivo", "Ajustes estratégicos"],
  },
];

export function getPlanBySlug(slug: string | null | undefined): Plan | null {
  if (!slug) return null;
  return plans.find((plan) => plan.slug === slug) || null;
}

export function getPlanPrice(plan: Plan, billingMode: BillingMode): number {
  return billingMode === "monthly" ? plan.monthly : plan.yearly;
}


