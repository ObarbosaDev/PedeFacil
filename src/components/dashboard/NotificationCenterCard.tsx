import { AlertTriangle, BellRing, CheckCircle2, CreditCard, TimerReset, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  tone: "critical" | "warning" | "info" | "success";
};

type NotificationCenterCardProps = {
  lateOrders: number;
  pendingDigitalPayments: number;
  activeDeliveries: number;
  hasCatalog: boolean;
};

function toneBadge(tone: NotificationItem["tone"]) {
  if (tone === "critical") return <Badge variant="destructive">Crítico</Badge>;
  if (tone === "warning") return <Badge variant="secondary">Atenção</Badge>;
  if (tone === "success") return <Badge variant="outline">Ok</Badge>;
  return <Badge variant="outline">Info</Badge>;
}

export default function NotificationCenterCard({
  lateOrders,
  pendingDigitalPayments,
  activeDeliveries,
  hasCatalog,
}: NotificationCenterCardProps) {
  const items: NotificationItem[] = [
    lateOrders > 0
      ? {
          id: "late-orders",
          title: `${lateOrders} pedido(s) com risco de atraso`,
          description: "Vale agir antes do cliente sentir o atraso.",
          tone: lateOrders >= 5 ? "critical" : "warning",
        }
      : {
          id: "late-orders-ok",
          title: "SLA sob controle agora",
          description: "Nenhum pedido apertando o tempo neste momento.",
          tone: "success",
        },
    pendingDigitalPayments > 0
      ? {
          id: "pending-payments",
          title: `${pendingDigitalPayments} pagamento(s) digital(is) pendente(s)`,
          description: "Revalide antes de tratar como problema operacional.",
          tone: "warning",
        }
      : {
          id: "pending-payments-ok",
          title: "Pagamentos digitais em dia",
          description: "Nada pendurado no financeiro por agora.",
          tone: "success",
        },
    activeDeliveries > 0
      ? {
          id: "active-deliveries",
          title: `${activeDeliveries} entrega(s) em rota`,
          description: "Acompanhe despacho, SLA e contato com cliente.",
          tone: "info",
        }
      : {
          id: "active-deliveries-empty",
          title: "Nenhuma entrega em rota",
          description: "Se isso não era esperado, revise operação e demanda.",
          tone: "info",
        },
    hasCatalog
      ? {
          id: "catalog-ready",
          title: "Cardápio pronto para vender",
          description: "Agora o foco é conversão, campanha e operação.",
          tone: "success",
        }
      : {
          id: "catalog-missing",
          title: "Cardápio ainda incompleto",
          description: "Sem produto suficiente, o resto da operação perde força.",
          tone: "warning",
        },
  ];

  return (
    <Card className="border-zinc-200 bg-white shadow-[0_20px_70px_-50px_rgba(0,0,0,0.45)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-orange-500" />
          Central de alertas
        </CardTitle>
        <CardDescription>Leitura rápida do que merece atenção antes de virar problema.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
              {toneBadge(item.tone)}
            </div>
          </div>
        ))}

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 p-3 text-center">
            <AlertTriangle className="mx-auto h-4 w-4 text-red-500" />
            <p className="mt-2 text-xs text-muted-foreground">SLA</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 text-center">
            <CreditCard className="mx-auto h-4 w-4 text-orange-500" />
            <p className="mt-2 text-xs text-muted-foreground">Financeiro</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 text-center">
            <Truck className="mx-auto h-4 w-4 text-blue-500" />
            <p className="mt-2 text-xs text-muted-foreground">Entrega</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 text-center">
            <TimerReset className="mx-auto h-4 w-4 text-emerald-500" />
            <p className="mt-2 text-xs text-muted-foreground">Ritmo</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
