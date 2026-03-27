import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Products = lazy(() => import("./pages/admin/Products"));
const Categories = lazy(() => import("./pages/admin/Categories"));
const Orders = lazy(() => import("./pages/admin/Orders"));
const StoreSettings = lazy(() => import("./pages/admin/StoreSettings"));
const Loyalty = lazy(() => import("./pages/admin/Loyalty"));
const Coupons = lazy(() => import("./pages/admin/Coupons"));
const Automations = lazy(() => import("./pages/admin/Automations"));
const PublicMenu = lazy(() => import("./pages/public/PublicMenu"));
const Checkout = lazy(() => import("./pages/public/Checkout"));
const ClientPanel = lazy(() => import("./pages/client/ClientPanel"));

const queryClient = new QueryClient();

function RecoveryRedirectHandler() {
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const isRecoveryLink = hash.includes("type=recovery") || search.includes("type=recovery");
    const isResetRoute = window.location.pathname === "/redefinir-senha";

    if (isRecoveryLink && !isResetRoute) {
      window.location.replace(`/redefinir-senha${search}${hash}`);
    }
  }, []);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RecoveryRedirectHandler />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/registro" element={<Register />} />
                <Route path="/esqueci-senha" element={<ForgotPassword />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />

                {/* Public store */}
                <Route path="/cliente" element={<ClientPanel />} />
                <Route path="/loja/:slug" element={<PublicMenu />} />
                <Route path="/loja/:slug/checkout" element={<Checkout />} />

                {/* Admin */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="produtos" element={<Products />} />
                  <Route path="categorias" element={<Categories />} />
                  <Route path="pedidos" element={<Orders />} />
                  <Route path="loja" element={<StoreSettings />} />
                  <Route path="fidelidade" element={<Loyalty />} />
                  <Route path="cupons" element={<Coupons />} />
                  <Route path="automacoes" element={<Automations />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
