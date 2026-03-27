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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Resumo", icon: LayoutDashboard, path: "/admin" },
  { label: "Pedidos", icon: ClipboardList, path: "/admin/pedidos" },
  { label: "Cardápio", icon: ShoppingBag, path: "/admin/produtos" },
  { label: "Seções", icon: FolderOpen, path: "/admin/categorias" },
  { label: "Cupons", icon: TicketPercent, path: "/admin/cupons" },
  { label: "Automação WhatsApp", icon: Bot, path: "/admin/automacoes" },
  { label: "Minha Loja", icon: Store, path: "/admin/loja" },
  { label: "Clientes VIP", icon: Star, path: "/admin/fidelidade" },
];

export default function AdminSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside className="hidden md:flex w-72 flex-col bg-sidebar text-sidebar-foreground min-h-screen border-r border-sidebar-border">
      <div className="p-6 space-y-4">
        <Link to="/admin" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-sidebar-primary">Pede</span>
          <span className="text-2xl font-extrabold text-sidebar-foreground">Fácil</span>
        </Link>

        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
          <p className="text-xs uppercase tracking-wider text-sidebar-foreground/60">Painel do lojista</p>
          <p className="text-sm mt-1">Seu centro de controle de vendas.</p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <p className="px-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/45">Navegação</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
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
