import { Link } from "react-router-dom";
import { CheckCircle2, CircleDashed, PackageOpen, Rocket, Store, TicketPercent, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type OnboardingChecklistCardProps = {
  hasStoreBasics: boolean;
  hasCatalog: boolean;
  hasOrders: boolean;
  hasCoupons: boolean;
  hasDrivers: boolean;
};

type ChecklistStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  ready: boolean;
  icon: typeof Store;
};

export default function OnboardingChecklistCard(props: OnboardingChecklistCardProps) {
  const steps: ChecklistStep[] = [
    {
      id: "store",
      label: "Ajustar dados da loja",
      description: "Logo, descrição, WhatsApp e operação básica em ordem.",
      href: "/admin/loja",
      ready: props.hasStoreBasics,
      icon: Store,
    },
    {
      id: "catalog",
      label: "Montar cardápio",
      description: "Categorias e produtos suficientes para começar a vender.",
      href: "/admin/produtos",
      ready: props.hasCatalog,
      icon: PackageOpen,
    },
    {
      id: "campaigns",
      label: "Preparar oferta",
      description: "Cupom ou campanha pronta para conversão inicial.",
      href: "/admin/cupons",
      ready: props.hasCoupons,
      icon: TicketPercent,
    },
    {
      id: "drivers",
      label: "Validar entrega",
      description: "Entregadores ou operação de despacho configurados.",
      href: "/admin/entregadores",
      ready: props.hasDrivers,
      icon: Truck,
    },
    {
      id: "orders",
      label: "Rodar primeiros pedidos",
      description: "Primeiras vendas acontecendo no fluxo real.",
      href: "/admin/pedidos",
      ready: props.hasOrders,
      icon: Rocket,
    },
  ];

  const completed = steps.filter((step) => step.ready).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <Card className="border-zinc-200 bg-white shadow-[0_20px_70px_-50px_rgba(0,0,0,0.45)]">
      <CardHeader>
        <CardTitle>Checklist de ativação</CardTitle>
        <CardDescription>O mínimo para colocar a loja no ar com menos atrito e menos improviso.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Progresso inicial</p>
              <p className="text-sm text-muted-foreground">{completed} de {steps.length} passos fechados</p>
            </div>
            <p className="text-2xl font-black">{progress}%</p>
          </div>
          <Progress value={progress} className="mt-3" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full ${step.ready ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{step.label}</p>
                      {step.ready ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pronto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                          <CircleDashed className="h-3.5 w-3.5" />
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                    {!step.ready ? (
                      <Link to={step.href} className="mt-3 inline-block">
                        <Button variant="outline" size="sm">Resolver agora</Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
