export type PlanSlug = "essencial" | "profissional" | "premium";

export type PlanFeature =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "store"
  | "coupons"
  | "drivers"
  | "automations"
  | "loyalty"
  | "support";

const FEATURES_BY_PLAN: Record<PlanSlug, PlanFeature[]> = {
  essencial: ["dashboard", "orders", "products", "categories", "store"],
  profissional: ["dashboard", "orders", "products", "categories", "store", "coupons", "drivers"],
  premium: [
    "dashboard",
    "orders",
    "products",
    "categories",
    "store",
    "coupons",
    "drivers",
    "automations",
    "loyalty",
    "support",
  ],
};

const FEATURE_REQUIRED_PLAN: Record<PlanFeature, PlanSlug> = {
  dashboard: "essencial",
  orders: "essencial",
  products: "essencial",
  categories: "essencial",
  store: "essencial",
  coupons: "profissional",
  drivers: "profissional",
  automations: "premium",
  loyalty: "premium",
  support: "premium",
};

export function hasPlanFeature(plan: PlanSlug | undefined | null, feature: PlanFeature): boolean {
  if (!plan) return false;
  return FEATURES_BY_PLAN[plan].includes(feature);
}

export function getRequiredPlanForFeature(feature: PlanFeature): PlanSlug {
  return FEATURE_REQUIRED_PLAN[feature];
}

export function getRequiredFeatureForAdminPath(pathname: string): PlanFeature {
  if (pathname === "/admin") return "dashboard";
  if (pathname.startsWith("/admin/pedidos")) return "orders";
  if (pathname.startsWith("/admin/produtos")) return "products";
  if (pathname.startsWith("/admin/categorias")) return "categories";
  if (pathname.startsWith("/admin/loja")) return "store";
  if (pathname.startsWith("/admin/cupons")) return "coupons";
  if (pathname.startsWith("/admin/entregadores")) return "drivers";
  if (pathname.startsWith("/admin/automacoes")) return "automations";
  if (pathname.startsWith("/admin/fidelidade")) return "loyalty";
  if (pathname.startsWith("/admin/suporte")) return "support";
  if (pathname.startsWith("/admin/go-live")) return "dashboard";
  return "dashboard";
}

export function planLabel(plan: PlanSlug): string {
  if (plan === "essencial") return "Essencial";
  if (plan === "profissional") return "Profissional";
  return "Premium";
}
