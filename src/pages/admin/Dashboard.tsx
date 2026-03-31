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

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
] as const;

type PeriodValue = (typeof periodOptions)[number]["value"];

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodValue>("30");

  const periodStartIso = useMemo(() => {
    const days = Number(period);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days + 1);
    return d.toISOString();
  }, [period]);

  const { data: establishment } = useQuery({
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

  const { data: orders = [] } = useQuery({
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
                  : "Configure sua loja para desbloquear todos os recursos do painel."}
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
            {orders.length === 0 ? (
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
    </div>
  );
}

