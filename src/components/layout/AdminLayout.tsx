import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar from "./AdminSidebar";
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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Resumo", icon: LayoutDashboard, path: "/admin" },
  { label: "Pedidos", icon: ClipboardList, path: "/admin/pedidos" },
  { label: "Cardápio", icon: ShoppingBag, path: "/admin/produtos" },
  { label: "Seções", icon: FolderOpen, path: "/admin/categorias" },
  { label: "Cupons", icon: TicketPercent, path: "/admin/cupons" },
  { label: "Entregadores", icon: Bike, path: "/admin/entregadores" },
  { label: "Automação WhatsApp", icon: Bot, path: "/admin/automacoes" },
  { label: "Minha Loja", icon: Store, path: "/admin/loja" },
  { label: "Clientes VIP", icon: Star, path: "/admin/fidelidade" },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <AdminSidebar />

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-1">
          <span className="text-xl font-extrabold text-primary">Pede</span>
          <span className="text-xl font-extrabold">Fácil</span>
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
              const isActive = location.pathname === item.path;
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
