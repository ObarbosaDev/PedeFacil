import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatsCard from "@/components/dashboard/StatsCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { ClipboardList, DollarSign, TrendingUp, ArrowRight, Sparkles, PackageCheck, CalendarDays, Trophy } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageLoader from "@/components/system/PageLoader";
import StateCard from "@/components/system/StateCard";
import { logClientError } from "@/lib/observability";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

type PeriodValue = (typeof periodOptions)[number]["value"];
type ProductOriginFilter = "all" | "home" | "plans_page" | "checkout_page" | "auth";
type ProductRoleFilter = "all" | "store_owner" | "customer" | "delivery_driver" | "unknown";

const productFunnelChartConfig = {
  planSelected: {
    label: "Planos selecionados",
    color: "hsl(var(--primary))",
  },
  checkoutStarted: {
    label: "Checkout iniciado",
    color: "hsl(var(--success))",
  },
  paymentConfirmed: {
    label: "Pagamentos confirmados",
    color: "hsl(var(--accent))",
  },
  conversionRate: {
    label: "Conversão diária (%)",
    color: "hsl(var(--warning))",
  },
} satisfies ChartConfig;

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodValue>("30");
  const [originFilter, setOriginFilter] = useState<ProductOriginFilter>("all");
  const [roleFilter, setRoleFilter] = useState<ProductRoleFilter>("all");

  const periodStartIso = useMemo(() => {
    const days = Number(period);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days + 1);
    return d.toISOString();
  }, [period]);

  const {
    data: establishment,
    isLoading: isLoadingEstablishment,
    isError: isEstablishmentError,
    error: establishmentError,
  } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const {
    data: orders = [],
    isLoading: isLoadingOrders,
    isError: isOrdersError,
    error: ordersError,
  } = useQuery({
    queryKey: ["dashboard-orders", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("created_at", { ascending: false })
        .limit(12);
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: periodOrders = [] } = useQuery({
    queryKey: ["dashboard-period-orders", establishment?.id, periodStartIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, customer_name, customer_phone, order_type")
        .eq("establishment_id", establishment!.id)
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: periodItems = [] } = useQuery({
    queryKey: ["dashboard-period-items", establishment?.id, periodStartIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price, orders!inner(created_at, establishment_id, status)")
        .eq("orders.establishment_id", establishment!.id)
        .gte("orders.created_at", periodStartIso);
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: funnelEvents = [] } = useQuery({
    queryKey: ["dashboard-funnel-events", establishment?.id, periodStartIso],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checkout_events")
        .select("event_name, session_id, created_at")
        .eq("establishment_id", establishment!.id)
        .gte("created_at", periodStartIso);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const {
    data: productEvents = [],
    isError: isProductEventsError,
    error: productEventsError,
  } = useQuery({
    queryKey: ["dashboard-product-events", periodStartIso],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_logs")
        .select("action, metadata, created_at")
        .eq("entity_type", "product_event")
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!establishment?.id) return;

    const channel = supabase
      .channel(`dashboard-orders-${establishment.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishment.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-orders", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-period-orders", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-period-items", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-funnel-events", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["orders", establishment.id] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [establishment?.id, queryClient]);

  useEffect(() => {
    if (!isEstablishmentError || !establishmentError) return;
    void logClientError({
      scope: "query",
      message: "Falha ao carregar estabelecimento no dashboard",
      metadata: {
        error: String(establishmentError),
      },
    });
  }, [establishmentError, isEstablishmentError]);

  useEffect(() => {
    if (!isOrdersError || !ordersError) return;
    void logClientError({
      scope: "query",
      message: "Falha ao carregar pedidos no dashboard",
      metadata: {
        error: String(ordersError),
      },
    });
  }, [isOrdersError, ordersError]);

  useEffect(() => {
    if (!isProductEventsError || !productEventsError) return;
    void logClientError({
      scope: "query",
      message: "Falha ao carregar eventos de funil comercial",
      metadata: {
        error: String(productEventsError),
      },
    });
  }, [isProductEventsError, productEventsError]);

  const todayOrders = orders.filter(
    (order) => new Date(order.created_at).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const inProgress = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;

  const analytics = useMemo(() => {
    const paidOrders = periodOrders.filter((order: any) => order.status !== "cancelled");
    const revenue = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total), 0);
    const cancelled = periodOrders.filter((order: any) => order.status === "cancelled").length;
    const cancellationRate = periodOrders.length > 0 ? (cancelled / periodOrders.length) * 100 : 0;
    const avgTicket = paidOrders.length > 0 ? revenue / paidOrders.length : 0;

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of periodItems as any[]) {
      const itemOrderStatus = item.orders?.status;
      if (itemOrderStatus === "cancelled") continue;

      const current = productMap.get(item.product_name) || { name: item.product_name, qty: 0, revenue: 0 };
      current.qty += Number(item.quantity);
      current.revenue += Number(item.quantity) * Number(item.unit_price);
      productMap.set(item.product_name, current);
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      revenue,
      avgTicket,
      cancellationRate,
      totalOrders: periodOrders.length,
      topProducts,
    };
  }, [periodOrders, periodItems]);

  const funnel = useMemo(() => {
    const menuSessions = new Set<string>();
    const cartSessions = new Set<string>();
    const checkoutSessions = new Set<string>();
    const submittedSessions = new Set<string>();

    for (const event of funnelEvents as any[]) {
      const sessionId = String(event.session_id || "");
      if (!sessionId) continue;
      if (event.event_name === "menu_view") menuSessions.add(sessionId);
      if (event.event_name === "add_to_cart") cartSessions.add(sessionId);
      if (event.event_name === "checkout_view") checkoutSessions.add(sessionId);
      if (event.event_name === "order_submitted") submittedSessions.add(sessionId);
    }

    const menu = menuSessions.size;
    const cart = cartSessions.size;
    const checkout = checkoutSessions.size;
    const submitted = submittedSessions.size;

    const toPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

    return {
      menu,
      cart,
      checkout,
      submitted,
      cartRate: toPercent(cart, menu),
      checkoutRate: toPercent(checkout, cart),
      submitRate: toPercent(submitted, checkout),
      totalConversion: toPercent(submitted, menu),
    };
  }, [funnelEvents]);

  const productFunnel = useMemo(() => {
    const getEventSource = (event: any): ProductOriginFilter => {
      const source = String(event?.metadata?.source || "").trim();
      if (source === "home" || source === "plans_page" || source === "checkout_page" || source === "auth") return source;
      if (event?.action === "funnel_home_cta_click") return "home";
      if (String(event?.action || "").includes("checkout")) return "checkout_page";
      if (String(event?.action || "").includes("login") || String(event?.action || "").includes("account")) return "auth";
      if (String(event?.action || "").includes("plan")) return "plans_page";
      return "home";
    };

    const getEventRole = (event: any): ProductRoleFilter => {
      const role = String(event?.metadata?.role || "").trim();
      if (role === "store_owner" || role === "customer" || role === "delivery_driver") return role;
      return "unknown";
    };

    const filteredProductEvents = (productEvents as any[]).filter((event) => {
      const matchesOrigin = originFilter === "all" || getEventSource(event) === originFilter;
      const matchesRole = roleFilter === "all" || getEventRole(event) === roleFilter;
      return matchesOrigin && matchesRole;
    });

    const totals = {
      homeClicks: 0,
      plansView: 0,
      planSelected: 0,
      checkoutStarted: 0,
      paymentGenerated: 0,
      paymentConfirmed: 0,
      accountCreated: 0,
      loginSuccess: 0,
    };
    const ctaTargets = new Map<string, number>();

    for (const event of filteredProductEvents) {
      const action = String(event.action || "");
      if (action === "funnel_home_cta_click") {
        totals.homeClicks += 1;
        const target = String(event.metadata?.target || "sem_target");
        ctaTargets.set(target, (ctaTargets.get(target) || 0) + 1);
      }
      if (action === "funnel_plans_view") totals.plansView += 1;
      if (action === "funnel_plan_selected") totals.planSelected += 1;
      if (action === "funnel_checkout_started") totals.checkoutStarted += 1;
      if (action === "funnel_checkout_payment_generated") totals.paymentGenerated += 1;
      if (action === "funnel_checkout_payment_confirmed") totals.paymentConfirmed += 1;
      if (action === "funnel_account_created") totals.accountCreated += 1;
      if (action === "funnel_login_success") totals.loginSuccess += 1;
    }

    const toPercent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
    const topTargets = Array.from(ctaTargets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      ...totals,
      checkoutRate: toPercent(totals.checkoutStarted, totals.planSelected),
      paymentRate: toPercent(totals.paymentConfirmed, totals.checkoutStarted),
      planSelectionRate: toPercent(totals.planSelected, totals.plansView),
      topTargets,
    };
  }, [originFilter, productEvents, roleFilter]);

  const productFunnelDaily = useMemo(() => {
    const days = Number(period);
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);

    const byDate = new Map<
      string,
      { date: string; planSelected: number; checkoutStarted: number; paymentConfirmed: number; conversionRate: number }
    >();

    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateKey = date.toISOString().slice(0, 10);
      byDate.set(dateKey, {
        date: dateKey,
        planSelected: 0,
        checkoutStarted: 0,
        paymentConfirmed: 0,
        conversionRate: 0,
      });
    }

    const getEventSource = (event: any): ProductOriginFilter => {
      const source = String(event?.metadata?.source || "").trim();
      if (source === "home" || source === "plans_page" || source === "checkout_page" || source === "auth") return source;
      if (event?.action === "funnel_home_cta_click") return "home";
      if (String(event?.action || "").includes("checkout")) return "checkout_page";
      if (String(event?.action || "").includes("login") || String(event?.action || "").includes("account")) return "auth";
      if (String(event?.action || "").includes("plan")) return "plans_page";
      return "home";
    };

    const getEventRole = (event: any): ProductRoleFilter => {
      const role = String(event?.metadata?.role || "").trim();
      if (role === "store_owner" || role === "customer" || role === "delivery_driver") return role;
      return "unknown";
    };

    const filteredProductEvents = (productEvents as any[]).filter((event) => {
      const matchesOrigin = originFilter === "all" || getEventSource(event) === originFilter;
      const matchesRole = roleFilter === "all" || getEventRole(event) === roleFilter;
      return matchesOrigin && matchesRole;
    });

    for (const event of filteredProductEvents) {
      const action = String(event.action || "");
      const createdAt = new Date(event.created_at || now);
      const dateKey = createdAt.toISOString().slice(0, 10);
      const current = byDate.get(dateKey);
      if (!current) continue;

      if (action === "funnel_plan_selected") current.planSelected += 1;
      if (action === "funnel_checkout_started") current.checkoutStarted += 1;
      if (action === "funnel_checkout_payment_confirmed") current.paymentConfirmed += 1;
    }

    const rows = Array.from(byDate.values()).map((row) => {
      const rate = row.checkoutStarted > 0 ? (row.paymentConfirmed / row.checkoutStarted) * 100 : 0;
      return { ...row, conversionRate: Number(rate.toFixed(1)) };
    });

    return rows;
  }, [originFilter, period, productEvents, roleFilter]);

  const exportOrdersCsv = () => {
    const header = ["id", "cliente", "telefone", "tipo", "status", "total", "criado_em"];

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/\"/g, '""')}"`;
      }
      return text;
    };

    const rows = (periodOrders as any[]).map((order) => [
      order.id,
      order.customer_name,
      order.customer_phone,
      order.order_type,
      order.status,
      Number(order.total).toFixed(2),
      new Date(order.created_at).toISOString(),
    ]);

    const csv = [header, ...rows].map((line) => line.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-pedidos-${period}dias.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (isLoadingEstablishment) {
    return <PageLoader label="Carregando visão geral da loja..." className="min-h-[70vh]" />;
  }

  if (isEstablishmentError) {
    return (
      <StateCard
        kind="error"
        title="Não rolou carregar sua loja agora"
        description="A conexão oscilou ou faltou permissão. Atualize a página e tente de novo."
        actionLabel="Voltar ao início"
        actionHref="/"
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="rounded-2xl overflow-hidden border bg-card">
        <div className="p-6 md:p-8 bg-gradient-to-r from-primary via-primary to-orange-500 text-primary-foreground">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-90">Painel do lojista</p>
              <h1 className="text-3xl md:text-4xl font-black mt-1">Resumo do seu negócio em tempo real</h1>
              <p className="mt-2 opacity-90">
                {establishment?.name
                  ? `Tudo centralizado para você tocar a operação da ${establishment.name}.`
                  : "Configura sua loja para desbloquear todos os recursos do painel."}
              </p>
            </div>
            <Sparkles className="h-8 w-8 opacity-90" />
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/admin/pedidos">
              <Button variant="secondary" size="sm">
                Ver pedidos <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link to="/admin/produtos">
              <Button variant="secondary" size="sm">Atualizar cardápio</Button>
            </Link>
          </div>
        </div>
      </section>

      {!establishment && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <p className="font-semibold text-lg">Sua loja ainda não foi configurada.</p>
            <p className="text-muted-foreground mt-1">
              Vai em <strong>"Minha Loja"</strong> no menu, preencha os dados e já começa a receber pedidos.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Pedidos no total" value={orders.length} icon={ClipboardList} className="border-primary/20" />
        <StatsCard title="Pedidos hoje" value={todayOrders.length} icon={TrendingUp} className="border-orange-300/40" />
        <StatsCard title="Faturamento hoje" value={formatCurrency(todayRevenue)} icon={DollarSign} className="border-emerald-300/40" />
        <StatsCard title="Em andamento" value={inProgress} icon={PackageCheck} description="Acompanhando o fluxo" className="border-blue-300/40" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Pedidos mais recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingOrders ? (
              <p className="text-muted-foreground text-center py-8">Buscando pedidos mais recentes...</p>
            ) : isOrdersError ? (
              <StateCard
                kind="error"
                title="Falha ao carregar pedidos"
                description="Tente atualizar em alguns segundos para continuar com os dados mais recentes."
                actionLabel="Recarregar"
                action={() => window.location.reload()}
              />
            ) : orders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Ainda não caiu nenhum pedido por aqui.</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 6).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
                    <div>
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} />
                      <span className="font-semibold">{formatCurrency(Number(order.total))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Radar rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Pedidos de hoje</p>
              <p className="text-2xl font-bold">{todayOrders.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Ticket médio (hoje)</p>
              <p className="text-2xl font-bold">
                {todayOrders.length > 0 ? formatCurrency(todayRevenue / todayOrders.length) : formatCurrency(0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Clientes</p>
              <p className="text-base">Módulo em evolução.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Análise por período
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-[180px]">
                <Select value={period} onValueChange={(value) => setPeriod(value as PeriodValue)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" onClick={exportOrdersCsv}>Exportar CSV</Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Pedidos no período</p>
              <p className="text-2xl font-bold">{analytics.totalOrders}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="text-2xl font-bold">{formatCurrency(analytics.revenue)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-2xl font-bold">{formatCurrency(analytics.avgTicket)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Taxa de cancelamento</p>
              <p className="text-2xl font-bold">{analytics.cancellationRate.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Top produtos no período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ainda não há dados suficientes para ranking.</p>
            ) : (
              <div className="space-y-2">
                {analytics.topProducts.map((item, index) => (
                  <div key={item.name} className="rounded-lg border p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{index + 1}. {item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.qty} unidade(s) vendida(s)</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-[220px]">
            <p className="text-xs text-muted-foreground mb-1">Filtrar por origem</p>
            <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as ProductOriginFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="plans_page">Planos</SelectItem>
                <SelectItem value="checkout_page">Checkout</SelectItem>
                <SelectItem value="auth">Auth (login/cadastro)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[220px]">
            <p className="text-xs text-muted-foreground mb-1">Filtrar por papel</p>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as ProductRoleFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                <SelectItem value="store_owner">Lojista</SelectItem>
                <SelectItem value="customer">Cliente</SelectItem>
                <SelectItem value="delivery_driver">Entregador</SelectItem>
                <SelectItem value="unknown">Sem papel definido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Esses filtros impactam os cards e o gráfico diário do funil comercial.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Funil de conversão</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sessões no cardápio</p>
              <p className="text-2xl font-bold">{funnel.menu}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sessões com carrinho</p>
              <p className="text-2xl font-bold">{funnel.cart}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sessões no checkout</p>
              <p className="text-2xl font-bold">{funnel.checkout}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Pedidos enviados</p>
              <p className="text-2xl font-bold">{funnel.submitted}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxas de conversão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Cardápio → Carrinho</span>
              <span className="font-semibold">{funnel.cartRate.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Carrinho → Checkout</span>
              <span className="font-semibold">{funnel.checkoutRate.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Checkout → Pedido</span>
              <span className="font-semibold">{funnel.submitRate.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Conversão total</span>
              <span className="font-semibold">{funnel.totalConversion.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Funil comercial (aquisição)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cliques de CTA (home)</p>
              <p className="text-2xl font-bold">{productFunnel.homeClicks}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Visitas em planos</p>
              <p className="text-2xl font-bold">{productFunnel.plansView}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Planos selecionados</p>
              <p className="text-2xl font-bold">{productFunnel.planSelected}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Checkout iniciado</p>
              <p className="text-2xl font-bold">{productFunnel.checkoutStarted}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cobranças geradas</p>
              <p className="text-2xl font-bold">{productFunnel.paymentGenerated}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Pagamentos confirmados</p>
              <p className="text-2xl font-bold">{productFunnel.paymentConfirmed}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxas e intenção de compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Planos → Seleção</span>
              <span className="font-semibold">{productFunnel.planSelectionRate.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Seleção → Checkout</span>
              <span className="font-semibold">{productFunnel.checkoutRate.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Checkout → Pagamento</span>
              <span className="font-semibold">{productFunnel.paymentRate.toFixed(1)}%</span>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-2">CTAs mais clicados</p>
              {productFunnel.topTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda sem cliques suficientes neste período.</p>
              ) : (
                <div className="space-y-1.5">
                  {productFunnel.topTargets.map(([target, count]) => (
                    <div key={target} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate">{target}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Contas criadas no período</p>
              <p className="text-lg font-bold">{productFunnel.accountCreated}</p>
              <p className="text-xs text-muted-foreground mt-2">Logins concluídos no período</p>
              <p className="text-lg font-bold">{productFunnel.loginSuccess}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Evolução diária do funil comercial</CardTitle>
          </CardHeader>
          <CardContent>
            {productFunnelDaily.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem dados diários suficientes para o gráfico.</p>
            ) : (
              <ChartContainer config={productFunnelChartConfig} className="h-[320px] w-full">
                <ComposedChart data={productFunnelDaily} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickFormatter={(value) =>
                      new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) =>
                          new Date(`${String(label)}T00:00:00`).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        }
                      />
                    }
                  />
                  <Bar dataKey="planSelected" fill="var(--color-planSelected)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="checkoutStarted" fill="var(--color-checkoutStarted)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="paymentConfirmed" fill="var(--color-paymentConfirmed)" radius={[6, 6, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="conversionRate"
                    stroke="var(--color-conversionRate)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}


