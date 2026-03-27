import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, FolderOpen, ClipboardList, Store, Star, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Pedidos", icon: ClipboardList, path: "/admin/pedidos" },
  { label: "Produtos", icon: ShoppingBag, path: "/admin/produtos" },
  { label: "Categorias", icon: FolderOpen, path: "/admin/categorias" },
  { label: "Minha Loja", icon: Store, path: "/admin/loja" },
  { label: "Fidelidade", icon: Star, path: "/admin/fidelidade" },
];

export default function AdminSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground min-h-screen">
      <div className="p-6">
        <Link to="/admin" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-sidebar-primary">Pede</span>
          <span className="text-2xl font-extrabold text-sidebar-foreground">Fácil</span>
        </Link>
        <p className="text-xs text-sidebar-foreground/50 mt-1">Painel do Lojista</p>
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
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
