import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, ClipboardList, ShieldAlert, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import StateCard from "@/components/system/StateCard";
import HelpCenterCard from "@/components/system/HelpCenterCard";

const DELIVERY_STUCK_STATUSES = ["assigned", "accepted", "picked_up"];

type FailedAutomationEventRow = {
  id: string;
  event_key: string;
  customer_phone: string | null;
  attempts: number | null;
  created_at: string;
};

type StuckDeliveryRow = {
  id: string;
  status: string;
  assigned_at: string;
  issue_reason: string | null;
  orders: {
    customer_name: string | null;
    customer_phone: string | null;
  } | null;
  delivery_drivers: {
    full_name: string | null;
  } | null;
};

type LateOrderRow = {
  id: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  total: number;
};

type TriageItem = {
  id: string;
  title: string;
  detail: string;
  since: number;
  severity: "critical" | "attention" | "watch";
  href: string;
  cta: string;
};

function getMinutesAgo(isoDate: string) {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
}

function getIncidentSeverity(minutes: number, thresholds: { critical: number; attention: number }): TriageItem["severity"] {
  if (minutes >= thresholds.critical) return "critical";
  if (minutes >= thresholds.attention) return "attention";
  return "watch";
}

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

  const { data: failedAutomationEvents = [] } = useQuery<FailedAutomationEventRow[]>({
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
      return (data || []) as FailedAutomationEventRow[];
    },
    enabled: !!establishment?.id,
  });

  const { data: stuckDeliveries = [] } = useQuery<StuckDeliveryRow[]>({
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
            customer_name,
            customer_phone
          ),
          delivery_drivers:driver_id (
            full_name
          )
        `)
        .eq("establishment_id", establishment!.id)
        .in("status", DELIVERY_STUCK_STATUSES)
        .lt("assigned_at", timeLimit)
        .order("assigned_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return (data || []) as StuckDeliveryRow[];
    },
    enabled: !!establishment?.id,
  });

  const { data: lateOrders = [] } = useQuery<LateOrderRow[]>({
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
      return (data || []) as LateOrderRow[];
    },
    enabled: !!establishment?.id,
  });

  const openIssuesCount = failedAutomationEvents.length + stuckDeliveries.length + lateOrders.length;

  const triageQueue = useMemo(() => {
    const items: TriageItem[] = [
      ...failedAutomationEvents.map((event) => {
        const minutesOpen = getMinutesAgo(event.created_at);
        return {
          id: event.id,
          title: `Automação travada: ${event.event_key}`,
          detail: `${event.customer_phone || "Sem telefone"} • ${event.attempts || 0} tentativa(s)`,
          since: minutesOpen,
          severity: getIncidentSeverity(minutesOpen, { critical: 20, attention: 8 }),
          href: "/admin/automacoes",
          cta: "Abrir automações",
        };
      }),
      ...stuckDeliveries.map((delivery) => {
        const minutesOpen = getMinutesAgo(delivery.assigned_at);
        return {
          id: delivery.id,
          title: `Entrega travada: ${delivery.orders?.customer_name || "Cliente"}`,
          detail: `${delivery.delivery_drivers?.full_name || "Sem entregador"} • ${delivery.status}`,
          since: minutesOpen,
          severity: getIncidentSeverity(minutesOpen, { critical: 65, attention: 40 }),
          href: "/admin/pedidos",
          cta: "Abrir pedidos",
        };
      }),
      ...lateOrders.map((order) => {
        const minutesOpen = getMinutesAgo(order.created_at);
        return {
          id: order.id,
          title: `Pedido acima do tempo: ${order.customer_name}`,
          detail: `${order.customer_phone} • ${order.status}`,
          since: minutesOpen,
          severity: getIncidentSeverity(minutesOpen, { critical: 55, attention: 35 }),
          href: "/admin/pedidos",
          cta: "Ver Kanban",
        };
      }),
    ].sort((a, b) => b.since - a.since);

    return {
      items,
      critical: items.filter((item) => item.severity === "critical"),
      attention: items.filter((item) => item.severity === "attention"),
      watch: items.filter((item) => item.severity === "watch"),
    };
  }, [failedAutomationEvents, lateOrders, stuckDeliveries]);

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

      <div className="grid grid-cols-1 xl:grid-cols-[0.66fr_0.34fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Fila de triagem
            </CardTitle>
            <CardDescription>Ordem sugerida para atacar o que está mais quente primeiro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {triageQueue.items.length === 0 ? (
              <StateCard
                title="Nada queimando agora"
                description="Sua operação está limpa. Se aparecer algo aqui, a ideia é agir rápido antes de virar suporte em massa."
              />
            ) : (
              triageQueue.items.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="font-semibold">{item.title}</p>
                    <Badge
                      variant={
                        item.severity === "critical"
                          ? "destructive"
                          : item.severity === "attention"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {item.severity === "critical" ? "Crítico" : item.severity === "attention" ? "Atenção" : "Monitorar"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground">Aberto há {item.since} min</p>
                    <Link to={item.href}>
                      <Button variant="outline" size="sm">
                        {item.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapa rápido</CardTitle>
              <CardDescription>Leitura simples para decidir onde você entra primeiro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border p-3 bg-destructive/5">
                <p className="font-semibold">Crítico agora</p>
                <p className="text-muted-foreground">{triageQueue.critical.length} item(ns)</p>
              </div>
              <div className="rounded-xl border p-3 bg-amber-500/5">
                <p className="font-semibold">Precisa atenção</p>
                <p className="text-muted-foreground">{triageQueue.attention.length} item(ns)</p>
              </div>
              <div className="rounded-xl border p-3 bg-muted/30">
                <p className="font-semibold">Só monitorar</p>
                <p className="text-muted-foreground">{triageQueue.watch.length} item(ns)</p>
              </div>
            </CardContent>
          </Card>

          <HelpCenterCard
            title="Se o dia apertar"
            description="Atalhos rápidos para não deixar a operação desandar."
            supportMessage="Preciso de apoio para tratar incidentes na operação da loja."
            topics={[
              {
                title: "Entrega travou e o cliente está cobrando",
                description: "Abra o pedido, confira o entregador atual e decida entre redispatch ou contato direto antes de mexer manualmente.",
              },
              {
                title: "WhatsApp falhou",
                description: "Veja se foi payload, webhook ou limite de tentativas. Se o evento for importante, faça replay ou contato manual.",
              },
              {
                title: "Pedido estourando SLA",
                description: "Priorize confirmar, avisar o cliente e alinhar expectativa antes que vire cancelamento ou desgaste.",
              },
            ]}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Falhas de automação WhatsApp
          </CardTitle>
          <CardDescription>Eventos que falharam e precisam de replay ou ação manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {failedAutomationEvents.length === 0 ? (
            <StateCard
              title="Sem falhas recentes"
              description="A fila de automação está limpa agora. Se aparecer erro aqui, trate rápido para não virar buraco no atendimento."
            />
          ) : (
            failedAutomationEvents.map((event) => (
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
            <StateCard
              title="Sem entregas travadas"
              description="Boa. Nenhuma rota estourando o tempo de segurança agora."
            />
          ) : (
            stuckDeliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{delivery.orders?.customer_name || "Cliente"}</p>
                <p className="text-xs text-muted-foreground">
                  Entregador: {delivery.delivery_drivers?.full_name || "Não definido"} • Status: {delivery.status}
                </p>
                <p className="text-xs text-muted-foreground">Início da rota: {formatDate(delivery.assigned_at)}</p>
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
            <StateCard
              title="Sem pedidos atrasados"
              description="O SLA está no eixo por agora. Se a fila subir, essa área vira o seu radar."
            />
          ) : (
            lateOrders.map((order) => (
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
