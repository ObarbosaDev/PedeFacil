import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar from "./AdminSidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingBag,
  FolderOpen,
  ClipboardList,
  Store,
  Star,
  Menu,
  X,
  TicketPercent,
  Bot,
  Bike,
  Lock,
  CreditCard,
  LogOut,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { canAccessStorePanel, getMyStoreSubscription } from "@/lib/subscription";
import {
  PlanFeature,
  PlanSlug,
  getRequiredFeatureForAdminPath,
  getRequiredPlanForFeature,
  hasPlanFeature,
  planLabel,
} from "@/lib/plan-access";

const navItems: { label: string; icon: any; path: string; feature: PlanFeature }[] = [
  { label: "Resumo", icon: LayoutDashboard, path: "/admin", feature: "dashboard" },
  { label: "Pedidos", icon: ClipboardList, path: "/admin/pedidos", feature: "orders" },
  { label: "Cardápio", icon: ShoppingBag, path: "/admin/produtos", feature: "products" },
  { label: "Seções", icon: FolderOpen, path: "/admin/categorias", feature: "categories" },
  { label: "Cupons", icon: TicketPercent, path: "/admin/cupons", feature: "coupons" },
  { label: "Entregadores", icon: Bike, path: "/admin/entregadores", feature: "drivers" },
  { label: "Automação WhatsApp", icon: Bot, path: "/admin/automacoes", feature: "automations" },
  { label: "Go-live", icon: ShieldCheck, path: "/admin/go-live", feature: "dashboard" },
  { label: "Roadmap 30/60/90", icon: Target, path: "/admin/roadmap", feature: "dashboard" },
  { label: "Minha Loja", icon: Store, path: "/admin/loja", feature: "store" },
  { label: "Clientes VIP", icon: Star, path: "/admin/fidelidade", feature: "loyalty" },
];

export default function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const { data: hasAccess, isLoading: loadingAccess } = useQuery({
    queryKey: ["store-panel-access", user?.id],
    queryFn: () => canAccessStorePanel(),
    enabled: !!user,
  });

  const { data: subscription } = useQuery({
    queryKey: ["store-panel-subscription", user?.id],
    queryFn: () => getMyStoreSubscription(),
    enabled: !!user,
  });

  const activePlan = subscription?.plan_slug as PlanSlug | undefined;
  const requiredFeature = getRequiredFeatureForAdminPath(location.pathname);
  const requiredPlan = getRequiredPlanForFeature(requiredFeature);
  const hasFeatureAccess = hasPlanFeature(activePlan, requiredFeature);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (loadingAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    const fallbackPlan = subscription?.plan_slug || "profissional";
    const fallbackBilling = subscription?.billing_cycle || "monthly";
    const checkoutHref = `/planos/checkout?plano=${fallbackPlan}&billing=${fallbackBilling}`;

    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border bg-card p-6 md:p-8 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.8)]">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5 text-orange-600" />
            Acesso do lojista bloqueado até a assinatura ficar ativa
          </div>

          <h1 className="text-3xl md:text-4xl font-black mt-4">Falta só ativar o plano para liberar o painel.</h1>
          <p className="text-muted-foreground mt-2">
            Assim que o pagamento for confirmado, o acesso do lojista é liberado automaticamente.
          </p>

          <div className="mt-5 rounded-2xl border bg-muted/40 p-4">
            <p className="text-sm font-semibold">Resumo da assinatura</p>
            <p className="text-sm text-muted-foreground mt-1">
              Status atual: <span className="font-semibold text-foreground">{subscription?.status || "sem assinatura"}</span>
            </p>
            {subscription?.current_period_end ? (
              <p className="text-sm text-muted-foreground">
                Vigência até:{" "}
                <span className="font-semibold text-foreground">
                  {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                </span>
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to={checkoutHref}>
              <Button>
                <CreditCard className="h-4 w-4 mr-2" />
                Ir para pagamento do plano
              </Button>
            </Link>

            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasFeatureAccess) {
    const upgradeHref = `/planos/checkout?plano=${requiredPlan}&billing=monthly`;

    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border bg-card p-6 md:p-8 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.8)]">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5 text-orange-600" />
            Função indisponível no seu plano atual
          </div>

          <h1 className="text-3xl md:text-4xl font-black mt-4">Essa área pede plano {planLabel(requiredPlan)}.</h1>
          <p className="text-muted-foreground mt-2">
            Seu plano atual é <span className="font-semibold text-foreground">{activePlan ? planLabel(activePlan) : "não definido"}</span>.
            Para usar essa função, faça upgrade.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to={upgradeHref}>
              <Button>
                <CreditCard className="h-4 w-4 mr-2" />
                Fazer upgrade de plano
              </Button>
            </Link>
            <Link to="/admin">
              <Button variant="outline">Voltar para resumo</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <AdminSidebar activePlanSlug={activePlan} />

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <Link to="/admin" className="flex items-center" aria-label="Ir para o painel do lojista">
          <img src="/logo.png" alt="Logo Pede Fácil" className="h-9 w-auto object-contain" />
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div id="admin-mobile-menu" className="md:hidden fixed inset-0 z-40 bg-background pt-16">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const isLocked = !hasPlanFeature(activePlan, item.feature);
              const isActive = !isLocked && location.pathname === item.path;
              const upgradeHref = `/planos/checkout?plano=${getRequiredPlanForFeature(item.feature)}&billing=monthly`;

              if (isLocked) {
                return (
                  <Link
                    key={item.path}
                    to={upgradeHref}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground border border-dashed"
                  >
                    <span className="inline-flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider">Upgrade</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <main className="flex-1 md:p-8 p-4 pt-20 md:pt-8 overflow-auto relative z-10">
        <div className="mx-auto w-full max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
