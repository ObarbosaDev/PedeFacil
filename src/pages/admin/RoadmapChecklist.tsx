import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListChecks, RefreshCcw, Target } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type ChecklistItem = {
  id: string;
  title: string;
  impact: "alto" | "medio";
  effort: "baixo" | "medio" | "alto";
};

type ChecklistPhase = {
  id: string;
  label: string;
  description: string;
  items: ChecklistItem[];
};

const phases: ChecklistPhase[] = [
  {
    id: "30d",
    label: "Fase 0-30 dias",
    description: "Base de produção: pagamento real, segurança e confiabilidade.",
    items: [
      { id: "payments-webhook", title: "Gateway de pagamento real com webhook assinado", impact: "alto", effort: "alto" },
      { id: "plan-access-matrix", title: "Controle de acesso por plano no sistema inteiro", impact: "alto", effort: "medio" },
      { id: "critical-rate-limit", title: "Rate limit nas rotas críticas (login/reset/checkout/cupom)", impact: "alto", effort: "medio" },
      { id: "rls-audit", title: "Auditoria de RLS tabela por tabela", impact: "alto", effort: "medio" },
      { id: "critical-e2e", title: "Testes E2E dos fluxos críticos antes de deploy", impact: "alto", effort: "medio" },
    ],
  },
  {
    id: "60d",
    label: "Fase 31-60 dias",
    description: "Acelerar conversão e operação da loja.",
    items: [
      { id: "advanced-funnel", title: "Funil avançado por origem, papel e campanha", impact: "alto", effort: "medio" },
      { id: "promo-engine", title: "Motor de promoções com regras (horário/ticket/primeira compra)", impact: "alto", effort: "alto" },
      { id: "delivery-sla", title: "SLA de entrega por etapa com alertas de atraso", impact: "alto", effort: "medio" },
      { id: "repurchase", title: "Recompra de pedido em 1 clique + favoritos", impact: "medio", effort: "medio" },
      { id: "wa-queue", title: "Fila robusta do WhatsApp com retry e DLQ", impact: "alto", effort: "alto" },
    ],
  },
  {
    id: "90d",
    label: "Fase 61-90 dias",
    description: "Escala e governança de longo prazo.",
    items: [
      { id: "feature-flags", title: "Feature flags por loja e rollout controlado", impact: "alto", effort: "medio" },
      { id: "slo-sla", title: "SLO/SLA oficiais com monitoramento mensal", impact: "alto", effort: "medio" },
      { id: "financial-reconciliation", title: "Conciliação financeira automatizada de cobrança", impact: "alto", effort: "alto" },
      { id: "audit-trail-hardening", title: "Trilha de auditoria completa para ações críticas", impact: "alto", effort: "medio" },
      { id: "segment-onboarding", title: "Onboarding guiado por segmento de loja", impact: "medio", effort: "medio" },
    ],
  },
];

function ratio(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export default function RoadmapChecklist() {
  const { user } = useAuth();
  const storageKey = `pedefacil.roadmap.30-60-90.${user?.id || "anon"}`;
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setCheckedMap(parsed || {});
    } catch {
      setCheckedMap({});
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checkedMap));
  }, [checkedMap, storageKey]);

  const allItems = useMemo(() => phases.flatMap((phase) => phase.items), []);
  const totalItems = allItems.length;
  const totalDone = allItems.filter((item) => checkedMap[item.id]).length;
  const overallProgress = ratio(totalDone, totalItems);

  const toggleItem = (itemId: string, checked: boolean) => {
    setCheckedMap((prev) => ({ ...prev, [itemId]: checked }));
  };

  const markPhaseDone = (phase: ChecklistPhase) => {
    setCheckedMap((prev) => {
      const next = { ...prev };
      for (const item of phase.items) next[item.id] = true;
      return next;
    });
    toast.success(`${phase.label} marcada como concluída.`);
  };

  const resetChecklist = () => {
    if (!window.confirm("Quer resetar o checklist inteiro agora?")) return;
    setCheckedMap({});
    toast.success("Checklist resetado.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="rounded-2xl overflow-hidden border bg-card">
        <div className="p-6 md:p-8 bg-gradient-to-r from-primary via-primary to-orange-500 text-primary-foreground">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-90">Plano de execução</p>
              <h1 className="text-3xl md:text-4xl font-black mt-1">Roadmap 30/60/90 na prática</h1>
              <p className="mt-2 opacity-90">
                Checklist de execução para virar produto pronto para cliente pagar e usar sem dor.
              </p>
            </div>
            <Target className="h-8 w-8 opacity-90" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Progresso geral
            </CardTitle>
            <CardDescription>
              {totalDone} de {totalItems} entregas concluídas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={overallProgress} />
            <p className="text-sm text-muted-foreground">
              Execução atual: <span className="font-semibold text-foreground">{overallProgress}%</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full" onClick={resetChecklist}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Resetar checklist
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        {phases.map((phase) => {
          const doneCount = phase.items.filter((item) => checkedMap[item.id]).length;
          const phaseProgress = ratio(doneCount, phase.items.length);

          return (
            <Card key={phase.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle>{phase.label}</CardTitle>
                  <CardDescription>{phase.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{phaseProgress}%</Badge>
                  <Button size="sm" variant="outline" onClick={() => markPhaseDone(phase)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar fase completa
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={phaseProgress} />
                <div className="space-y-2">
                  {phase.items.map((item) => {
                    const checked = !!checkedMap[item.id];
                    return (
                      <label
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                      >
                        <span className="inline-flex items-center gap-3 min-w-0">
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleItem(item.id, value === true)} />
                          <span className="text-sm">{item.title}</span>
                        </span>
                        <span className="inline-flex items-center gap-2 shrink-0">
                          <Badge variant="outline">Impacto {item.impact}</Badge>
                          <Badge variant="outline">Esforço {item.effort}</Badge>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
