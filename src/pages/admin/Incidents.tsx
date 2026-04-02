import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, ClipboardList, ShieldAlert, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";

const DELIVERY_STUCK_STATUSES = ["assigned", "accepted", "picked_up"];

export default function Incidents() {
  const { user } = useAuth();

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: failedAutomationEvents = [] } = useQuery({
    queryKey: ["incidents-failed-automation", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_automation_events")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const { data: stuckDeliveries = [] } = useQuery({
    queryKey: ["incidents-stuck-deliveries", establishment?.id],
    queryFn: async () => {
      const timeLimit = new Date(Date.now() - 40 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select(`
          id,
          order_id,
          status,
          assigned_at,
          accepted_at,
          picked_up_at,
          issue_reason,
          orders:order_id (
            id,
            customer_name,
            customer_phone
          ),
          delivery_drivers:driver_id (
            id,
            full_name
          )
        `)
        .eq("establishment_id", establishment!.id)
        .in("status", DELIVERY_STUCK_STATUSES)
        .lt("assigned_at", timeLimit)
        .order("assigned_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const { data: lateOrders = [] } = useQuery({
    queryKey: ["incidents-late-orders", establishment?.id],
    queryFn: async () => {
      const timeLimit = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, customer_name, customer_phone, created_at, total")
        .eq("establishment_id", establishment!.id)
        .in("status", ["received", "confirmed", "in_preparation", "ready"])
        .lt("created_at", timeLimit)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const openIssuesCount = failedAutomationEvents.length + stuckDeliveries.length + lateOrders.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Central de incidentes</h1>
          <p className="text-muted-foreground">Visão rápida do que pode travar sua operação agora.</p>
        </div>
        <Badge variant={openIssuesCount > 0 ? "destructive" : "secondary"}>
          {openIssuesCount > 0 ? `${openIssuesCount} pendências` : "Sem pendências"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Automações com falha</p>
            <p className="text-2xl font-bold">{failedAutomationEvents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entregas travadas</p>
            <p className="text-2xl font-bold">{stuckDeliveries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pedidos acima do tempo</p>
            <p className="text-2xl font-bold">{lateOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Falhas de automação WhatsApp
          </CardTitle>
          <CardDescription>Eventos que falharam e precisam de replay/manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {failedAutomationEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem falhas recentes.</p>
          ) : (
            failedAutomationEvents.map((event: any) => (
              <div key={event.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{event.event_key}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.customer_phone || "Sem telefone"} • Tentativas: {event.attempts || 0} • {formatDate(event.created_at)}
                  </p>
                </div>
                <Badge variant="destructive">failed</Badge>
              </div>
            ))
          )}
          <Link to="/admin/automacoes">
            <Button variant="outline" size="sm">
              Abrir automações
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Entregas travadas
          </CardTitle>
          <CardDescription>Rotas em andamento há mais de 40 minutos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {stuckDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem entregas travadas.</p>
          ) : (
            stuckDeliveries.map((delivery: any) => (
              <div key={delivery.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{delivery.orders?.customer_name || "Cliente"}</p>
                <p className="text-xs text-muted-foreground">
                  Entregador: {delivery.delivery_drivers?.full_name || "Não definido"} • Status: {delivery.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Início da rota: {formatDate(delivery.assigned_at)}
                </p>
                {delivery.issue_reason ? <p className="text-xs text-amber-700 mt-1">Ocorrência: {delivery.issue_reason}</p> : null}
              </div>
            ))
          )}
          <Link to="/admin/pedidos">
            <Button variant="outline" size="sm">
              Abrir pedidos
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Pedidos acima do tempo esperado
          </CardTitle>
          <CardDescription>Pedidos em aberto há mais de 35 minutos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lateOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem pedidos atrasados.</p>
          ) : (
            lateOrders.map((order: any) => (
              <div key={order.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customer_phone} • {formatDate(order.created_at)}
                  </p>
                </div>
                <Badge variant="destructive">{order.status}</Badge>
              </div>
            ))
          )}
          <Link to="/admin/pedidos">
            <Button variant="outline" size="sm">
              Abrir Kanban
              <ClipboardList className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {openIssuesCount === 0 ? (
        <Card className="border-emerald-400/30 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-emerald-600" />
            Operação estável no momento. Sem incidentes críticos abertos.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

