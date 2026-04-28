export type BillingMode = "monthly" | "yearly";
export type PlanSlug = "essencial" | "profissional" | "premium";

export type Plan = {
  slug: PlanSlug;
  name: string;
  monthly: number;
  yearly: number;
  highlight: string;
  description: string;
  shortPitch: string;
  audience: string;
  volumeHint: string;
  setupPromise: string;
  ctaLabel: string;
  perks: string[];
  featured?: boolean;
};

export const plans: Plan[] = [
  {
    slug: "essencial",
    name: "Essencial",
    monthly: 59,
    yearly: 49,
    highlight: "Entrada inteligente",
    description: "Para sair do improviso e profissionalizar o delivery sem pesar no caixa.",
    shortPitch: "Preço baixo para colocar operação, cardápio e pedidos no lugar.",
    audience: "Ideal para loja em fase de tração ou operação enxuta.",
    volumeHint: "Bom encaixe para até 35 pedidos por dia.",
    setupPromise: "Você consegue começar rápido, sem virar escravo de configuração.",
    ctaLabel: "Começar no Essencial",
    perks: ["Cardápio digital bonito", "Pedidos no WhatsApp organizados", "Painel em tempo real", "Fluxo base de operação"],
  },
  {
    slug: "profissional",
    name: "Profissional",
    monthly: 99,
    yearly: 79,
    highlight: "Melhor custo-benefício",
    description: "O plano certo para vender mais, rodar campanha e ter visão real da operação.",
    shortPitch: "É o ponto ideal entre preço agressivo e estrutura de verdade.",
    audience: "Ideal para loja que quer crescer com controle e previsibilidade.",
    volumeHint: "Bom encaixe para 35 a 120 pedidos por dia.",
    setupPromise: "Você ativa campanha, acompanha pedido e despacha melhor no mesmo painel.",
    ctaLabel: "Ir de Profissional",
    perks: ["Tudo do Essencial", "Cupons e campanhas", "Relatórios avançados", "Painel de entregadores"],
    featured: true,
  },
  {
    slug: "premium",
    name: "Premium",
    monthly: 179,
    yearly: 149,
    highlight: "Escala com prioridade",
    description: "Para operação mais intensa, com suporte mais próximo e visão de longo prazo.",
    shortPitch: "Mais estrutura, mais acompanhamento e menos atrito para escalar.",
    audience: "Ideal para marca que já gira forte ou quer montar operação acima da média.",
    volumeHint: "Bom encaixe para operações acima de 120 pedidos por dia.",
    setupPromise: "Você entra com mais acompanhamento e espaço para ajustes finos.",
    ctaLabel: "Subir para Premium",
    perks: ["Tudo do Profissional", "Suporte prioritário", "Acompanhamento consultivo", "Apoio mais próximo na evolução"],
  },
];

export function getPlanBySlug(slug: string | null | undefined): Plan | null {
  if (!slug) return null;
  return plans.find((plan) => plan.slug === slug) || null;
}

export function getPlanPrice(plan: Plan, billingMode: BillingMode): number {
  return billingMode === "monthly" ? plan.monthly : plan.yearly;
}

export function getPlanMonthlyAnchor(plan: Plan): number {
  return plan.monthly;
}

export function getPlanYearlySavings(plan: Plan): number {
  return Math.max(0, (plan.monthly - plan.yearly) * 12);
}
