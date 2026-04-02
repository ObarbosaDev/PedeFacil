import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  FolderOpen,
  ClipboardList,
  Store,
  Star,
  LogOut,
  Sparkles,
  TicketPercent,
  Bot,
  Bike,
  Lock,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { PlanFeature, PlanSlug, getRequiredPlanForFeature, hasPlanFeature, planLabel } from "@/lib/plan-access";

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

type AdminSidebarProps = {
  activePlanSlug?: PlanSlug;
};

export default function AdminSidebar({ activePlanSlug }: AdminSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside className="hidden md:flex w-72 flex-col bg-sidebar text-sidebar-foreground min-h-screen border-r border-sidebar-border">
      <div className="p-6 space-y-4">
        <Link to="/admin" className="flex items-center" aria-label="Ir para o painel do lojista">
          <img src="/logo.png" alt="Logo Pede Fácil" className="h-10 w-auto object-contain" />
        </Link>

        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
          <p className="text-xs uppercase tracking-wider text-sidebar-foreground/60">Painel do lojista</p>
          <p className="text-sm mt-1">Seu centro de controle de vendas.</p>
          {activePlanSlug ? (
            <p className="text-xs mt-2 text-sidebar-foreground/75">Plano atual: <span className="font-semibold">{planLabel(activePlanSlug)}</span></p>
          ) : null}
        </div>
      </div>

      <div className="px-3 pb-2">
        <p className="px-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/45">Navegação</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isLocked = !hasPlanFeature(activePlanSlug, item.feature);
          const isActive = !isLocked && location.pathname === item.path;

          if (isLocked) {
            const requiredPlan = getRequiredPlanForFeature(item.feature);
            return (
              <Link
                key={item.path}
                to={`/planos/checkout?plano=${requiredPlan}&billing=monthly`}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/55 border border-dashed border-sidebar-border hover:bg-sidebar-accent/50 transition-colors"
              >
                <span className="inline-flex items-center gap-3 min-w-0">
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                <Lock className="h-4 w-4 shrink-0" />
              </Link>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 space-y-3">
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/85">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-sidebar-primary" />
            <p className="font-semibold">Dica rápida</p>
          </div>
          <p>Atualize as fotos dos produtos para melhorar a conversão no cardápio.</p>
        </div>

        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sair da conta
        </button>
      </div>
    </aside>
  );
}
