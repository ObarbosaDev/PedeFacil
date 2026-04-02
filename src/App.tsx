import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import AppErrorBoundary from "@/components/system/AppErrorBoundary";
import NetworkStatusBanner from "@/components/system/NetworkStatusBanner";
import PageLoader from "@/components/system/PageLoader";
import RouteA11yAnnouncer from "@/components/system/RouteA11yAnnouncer";

const Index = lazy(() => import("./pages/Index"));
const Plans = lazy(() => import("./pages/Plans"));
const PlansCheckout = lazy(() => import("./pages/PlansCheckout"));
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
const Drivers = lazy(() => import("./pages/admin/Drivers"));
const Incidents = lazy(() => import("./pages/admin/Incidents"));
const DriverRanking = lazy(() => import("./pages/admin/DriverRanking"));
const PaymentsLedger = lazy(() => import("./pages/admin/PaymentsLedger"));
const GoLive = lazy(() => import("./pages/admin/GoLive"));
const GoLivePresentation = lazy(() => import("./pages/admin/GoLivePresentation"));
const RoadmapChecklist = lazy(() => import("./pages/admin/RoadmapChecklist"));
const PublicMenu = lazy(() => import("./pages/public/PublicMenu"));
const Checkout = lazy(() => import("./pages/public/Checkout"));
const DeliveryTracking = lazy(() => import("./pages/public/DeliveryTracking"));
const ClientPanel = lazy(() => import("./pages/client/ClientPanel"));
const ClientLogin = lazy(() => import("./pages/client/ClientLogin"));
const ClientRegister = lazy(() => import("./pages/client/ClientRegister"));
const ClientAccount = lazy(() => import("./pages/client/ClientAccount"));
const DriverLogin = lazy(() => import("./pages/driver/DriverLogin"));
const DriverRegister = lazy(() => import("./pages/driver/DriverRegister"));
const DriverPanel = lazy(() => import("./pages/driver/DriverPanel"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

function RequireClientAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader label="Carregando sua sessão..." className="min-h-[60vh]" />;
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/cliente/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}

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

function AppRoutes() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      const main = document.getElementById("app-main-content");
      main?.focus();
    });
  }, [location.pathname, location.search]);

  return (
    <main
      id="app-main-content"
      key={`${location.pathname}${location.search}`}
      className="route-transition"
      tabIndex={-1}
      aria-label="Conteúdo principal"
    >
      <Routes location={location}>
        <Route path="/" element={<Index />} />
        <Route path="/planos" element={<Plans />} />
        <Route path="/planos/checkout" element={<PlansCheckout />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />

        {/* Public store */}
        <Route path="/cliente" element={<RequireClientAuth><ClientPanel /></RequireClientAuth>} />
        <Route path="/cliente/login" element={<ClientLogin />} />
        <Route path="/cliente/registro" element={<ClientRegister />} />
        <Route path="/cliente/conta" element={<RequireClientAuth><ClientAccount /></RequireClientAuth>} />
        <Route path="/entregador/login" element={<DriverLogin />} />
        <Route path="/entregador/registro" element={<DriverRegister />} />
        <Route path="/entregador" element={<DriverPanel />} />
        <Route path="/loja/:slug" element={<PublicMenu />} />
        <Route path="/loja/:slug/checkout" element={<Checkout />} />
        <Route path="/acompanhar/:token" element={<DeliveryTracking />} />

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
          <Route path="entregadores" element={<Drivers />} />
          <Route path="entregadores/ranking" element={<DriverRanking />} />
          <Route path="incidentes" element={<Incidents />} />
          <Route path="pagamentos/ledger" element={<PaymentsLedger />} />
          <Route path="go-live" element={<GoLive />} />
          <Route path="go-live/apresentacao" element={<GoLivePresentation />} />
          <Route path="roadmap" element={<RoadmapChecklist />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppErrorBoundary>
            <BrowserRouter>
              <a
                href="#app-main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
              >
                Ir para o conteúdo principal
              </a>
              <RecoveryRedirectHandler />
              <RouteA11yAnnouncer />
              <NetworkStatusBanner />
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </BrowserRouter>
          </AppErrorBoundary>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
