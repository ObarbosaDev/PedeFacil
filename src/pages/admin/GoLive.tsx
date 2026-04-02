import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, FileDown } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { Link } from "react-router-dom";

type CheckResult = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

const checklistItems = [
  { key: "dados_loja", label: "Dados da loja completos (nome, WhatsApp, endereco)" },
  { key: "cardapio_publicado", label: "Cardapio com fotos e produtos disponiveis" },
  { key: "entregadores_ativos", label: "Pelo menos 1 entregador ativo" },
  { key: "cupons_revisados", label: "Cupons e regras comerciais revisados" },
  { key: "fluxo_compra_testado", label: "Fluxo de compra testado do inicio ao fim" },
  { key: "fluxo_entrega_testado", label: "Fluxo de entrega com prova e PIN testado" },
  { key: "alertas_ativos", label: "Alertas e notificacoes habilitados na operacao" },
];

const acceptanceCases = [
  { key: "caso_01_checkout", label: "Caso 01: cliente finaliza pedido com sucesso" },
  { key: "caso_02_kanban", label: "Caso 02: pedido aparece e atualiza no Kanban" },
  { key: "caso_03_dispatch", label: "Caso 03: despacho de entrega funciona" },
  { key: "caso_04_proof_gps", label: "Caso 04: entrega com prova + GPS + recebedor" },
  { key: "caso_05_proof_bypass", label: "Caso 05: entrega com bypass GPS e justificativa" },
  { key: "caso_06_tracking", label: "Caso 06: rastreio em tempo real no cliente" },
  { key: "caso_07_audit_csv", label: "Caso 07: auditoria de entregas exportada em CSV" },
];

async function checkRealtimeConnection() {
  return new Promise<{ ok: boolean; detail: string }>((resolve) => {
    const channel = supabase.channel(`go-live-check-${Date.now()}`);
    const timeout = setTimeout(() => {
      void supabase.removeChannel(channel);
      resolve({ ok: false, detail: "Timeout ao conectar no realtime." });
    }, 5000);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        void supabase.removeChannel(channel);
        resolve({ ok: true, detail: "Canal realtime conectado." });
      }
    });
  });
}

export default function GoLive() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const checklistStorageKey = `pedefacil.go-live.checklist.${user?.id || "anon"}`;
  const acceptanceStorageKey = `pedefacil.go-live.acceptance.${user?.id || "anon"}`;

  const [checklistState, setChecklistState] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(checklistStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [acceptanceState, setAcceptanceState] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(acceptanceStorageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const persistChecklist = (next: Record<string, boolean>) => {
    setChecklistState(next);
    localStorage.setItem(checklistStorageKey, JSON.stringify(next));
  };
  const persistAcceptance = (next: Record<string, boolean>) => {
    setAcceptanceState(next);
    localStorage.setItem(acceptanceStorageKey, JSON.stringify(next));
  };

  const { data: establishment } = useQuery({
    queryKey: ["go-live-establishment", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("id, name").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: deliveryAuditRows = [], refetch: refetchDeliveryAudit, isFetching: fetchingDeliveryAudit } = useQuery({
    queryKey: ["go-live-delivery-audit", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select(`
          id,
          order_id,
          status,
          delivered_at,
          proof_image_url,
          recipient_name,
          delivered_accuracy_meters,
          gps_bypass_reason,
          orders:order_id (
            customer_name,
            customer_phone
          ),
          delivery_drivers:driver_id (
            full_name
          )
        `)
        .eq("establishment_id", establishment!.id)
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const runDiagnostics = async () => {
    setRunning(true);
    const nextResults: CheckResult[] = [];

    try {
      nextResults.push({
        key: "auth",
        label: "Autenticacao",
        ok: !!user?.id,
        detail: user?.id ? "Sessao autenticada." : "Usuario nao autenticado.",
      });

      const { error: dbError } = await supabase.from("establishments").select("id").limit(1);
      nextResults.push({
        key: "db",
        label: "Banco de dados",
        ok: !dbError,
        detail: dbError ? dbError.message : "Consulta basica funcionando.",
      });

      const { error: storageError } = await supabase.storage.from("delivery-proofs").list("", { limit: 1 });
      nextResults.push({
        key: "storage",
        label: "Storage (delivery-proofs)",
        ok: !storageError,
        detail: storageError ? storageError.message : "Bucket acessivel.",
      });

      const { error: schemaError } = await (supabase as any)
        .from("order_deliveries")
        .select("id, proof_image_url, recipient_name, delivered_accuracy_meters, gps_bypass_reason")
        .limit(1);
      nextResults.push({
        key: "schema",
        label: "Schema de entrega",
        ok: !schemaError,
        detail: schemaError ? schemaError.message : "Colunas criticas disponiveis.",
      });

      const realtime = await checkRealtimeConnection();
      nextResults.push({
        key: "realtime",
        label: "Realtime",
        ok: realtime.ok,
        detail: realtime.detail,
      });

      nextResults.push({
        key: "pwa",
        label: "PWA basico",
        ok: "serviceWorker" in navigator,
        detail: "serviceWorker" in navigator ? "Navegador suporta service worker." : "Navegador sem suporte.",
      });
    } finally {
      setResults(nextResults);
      setRunning(false);
    }
  };

  const technicalPassed = results.filter((result) => result.ok).length;
  const technicalTotal = results.length;
  const checklistDone = checklistItems.filter((item) => checklistState[item.key]).length;
  const checklistTotal = checklistItems.length;
  const acceptanceDone = acceptanceCases.filter((item) => acceptanceState[item.key]).length;
  const acceptanceTotal = acceptanceCases.length;

  const readinessScore = useMemo(() => {
    const technicalScore = technicalTotal > 0 ? technicalPassed / technicalTotal : 0;
    const processScore = checklistTotal > 0 ? checklistDone / checklistTotal : 0;
    return Math.round(((technicalScore * 0.6) + (processScore * 0.4)) * 100);
  }, [checklistDone, checklistTotal, technicalPassed, technicalTotal]);

  const auditSummary = useMemo(() => {
    const rows = deliveryAuditRows as any[];
    const withProof = rows.filter((row) => !!row.proof_image_url).length;
    const withRecipient = rows.filter((row) => !!String(row.recipient_name || "").trim()).length;
    const withGps = rows.filter((row) => row.delivered_accuracy_meters != null).length;
    const gpsBypass = rows.filter((row) => !!String(row.gps_bypass_reason || "").trim()).length;
    const fullyCompliant = rows.filter((row) => {
      const hasProof = !!row.proof_image_url;
      const hasRecipient = !!String(row.recipient_name || "").trim();
      const hasGpsOrBypass = row.delivered_accuracy_meters != null || !!String(row.gps_bypass_reason || "").trim();
      return hasProof && hasRecipient && hasGpsOrBypass;
    }).length;

    return {
      total: rows.length,
      withProof,
      withRecipient,
      withGps,
      gpsBypass,
      fullyCompliant,
      complianceRate: rows.length ? Math.round((fullyCompliant / rows.length) * 100) : 0,
    };
  }, [deliveryAuditRows]);

  const goLiveGates = useMemo(() => {
    const technicalGate = technicalTotal > 0 && technicalPassed === technicalTotal;
    const operationalGate = checklistTotal > 0 && checklistDone === checklistTotal;
    const acceptanceGate = acceptanceTotal > 0 && acceptanceDone === acceptanceTotal;
    const complianceGate = auditSummary.total === 0 ? false : auditSummary.complianceRate >= 90;
    const scoreGate = readinessScore >= 90;

    return [
      { key: "gate_technical", label: "Infraestrutura 100% OK", pass: technicalGate },
      { key: "gate_operational", label: "Checklist operacional 100%", pass: operationalGate },
      { key: "gate_acceptance", label: "Matriz de aceitacao 100%", pass: acceptanceGate },
      { key: "gate_compliance", label: "Conformidade de entrega >= 90%", pass: complianceGate },
      { key: "gate_score", label: "Score de prontidao >= 90%", pass: scoreGate },
    ];
  }, [
    acceptanceDone,
    acceptanceTotal,
    auditSummary.complianceRate,
    auditSummary.total,
    checklistDone,
    checklistTotal,
    readinessScore,
    technicalPassed,
    technicalTotal,
  ]);

  const releaseApproved = goLiveGates.every((gate) => gate.pass);

  const exportAuditCsv = () => {
    if (!deliveryAuditRows.length) return;
    const headers = [
      "delivery_id",
      "order_id",
      "status",
      "delivered_at",
      "driver_name",
      "customer_name",
      "customer_phone",
      "proof_image_url",
      "recipient_name",
      "delivered_accuracy_meters",
      "gps_bypass_reason",
      "compliant",
    ];

    const rows = (deliveryAuditRows as any[]).map((row) => {
      const compliant = !!row.proof_image_url
        && !!String(row.recipient_name || "").trim()
        && (row.delivered_accuracy_meters != null || !!String(row.gps_bypass_reason || "").trim());
      return [
        row.id,
        row.order_id,
        row.status,
        row.delivered_at || "",
        row.delivery_drivers?.full_name || "",
        row.orders?.customer_name || "",
        row.orders?.customer_phone || "",
        row.proof_image_url || "",
        row.recipient_name || "",
        row.delivered_accuracy_meters ?? "",
        row.gps_bypass_reason || "",
        compliant ? "yes" : "no",
      ];
    });

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `auditoria-entregas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const exportGoLiveReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      establishment_id: establishment?.id || null,
      establishment_name: establishment?.name || null,
      readiness_score: readinessScore,
      release_approved: releaseApproved,
      diagnostics: results,
      checklist: checklistItems.map((item) => ({
        key: item.key,
        label: item.label,
        done: !!checklistState[item.key],
      })),
      acceptance_matrix: acceptanceCases.map((item) => ({
        key: item.key,
        label: item.label,
        pass: !!acceptanceState[item.key],
      })),
      gates: goLiveGates,
      delivery_audit_summary: auditSummary,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `go-live-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Central de Go-live</h1>
          <p className="text-muted-foreground">Checklist final para liberar a operacao com seguranca.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/go-live/apresentacao">
            <Button variant="outline">Modo apresentacao</Button>
          </Link>
          <Button onClick={runDiagnostics} disabled={running}>
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
            {running ? "Rodando diagnostico..." : "Rodar diagnostico"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Score go-live</p><p className="text-2xl font-bold">{readinessScore}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Checks tecnicos OK</p><p className="text-2xl font-bold">{technicalPassed}/{technicalTotal || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Checklist operacional</p><p className="text-2xl font-bold">{checklistDone}/{checklistTotal}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Status</p><p className="text-2xl font-bold">{releaseApproved ? "Liberado" : "Bloqueado"}</p></CardContent></Card>
      </div>

      <Card className={releaseApproved ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold">{releaseApproved ? "Go-live aprovado" : "Go-live ainda bloqueado"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {releaseApproved
                ? "Todos os gates de liberacao passaram. Ambiente pronto para cliente final."
                : "Ainda existem gates pendentes. Feche os pontos abaixo antes de liberar."}
            </p>
          </div>
          <Button variant="outline" onClick={exportGoLiveReport}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar relatorio
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostico tecnico</CardTitle>
          <CardDescription>Valida infraestrutura minima para operacao real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda nao executado.</p>
          ) : (
            results.map((result) => (
              <div key={result.key} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{result.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.detail}</p>
                </div>
                {result.ok ? (
                  <Badge variant="secondary" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />OK</Badge>
                ) : (
                  <Badge variant="destructive" className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Falhou</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist de homologacao</CardTitle>
          <CardDescription>Marque tudo que ja foi validado antes de abrir para cliente final.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklistItems.map((item) => (
            <label key={item.key} className="rounded-lg border p-3 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!checklistState[item.key]}
                onChange={(event) => persistChecklist({ ...checklistState, [item.key]: event.target.checked })}
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Recomendacao de liberacao
          </p>
          <p>
            Libere a operacao quando o score estiver acima de 85% e todos os fluxos de compra, entrega e comprovacao passarem em teste real.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gates de liberacao</CardTitle>
          <CardDescription>Regras objetivas para aprovar abertura ao cliente final.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {goLiveGates.map((gate) => (
            <div key={gate.key} className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <p className="text-sm">{gate.label}</p>
              <Badge variant={gate.pass ? "secondary" : "destructive"}>{gate.pass ? "PASS" : "FAIL"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matriz de aceitacao (PASS/FAIL)</CardTitle>
          <CardDescription>Execute os cenarios e marque resultado antes da liberacao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-xs text-muted-foreground mb-2">Resultado: {acceptanceDone}/{acceptanceTotal} PASS</div>
          {acceptanceCases.map((item) => (
            <label key={item.key} className="rounded-lg border p-3 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!acceptanceState[item.key]}
                onChange={(event) => persistAcceptance({ ...acceptanceState, [item.key]: event.target.checked })}
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria de entregas</CardTitle>
          <CardDescription>Controle de conformidade das ultimas entregas concluidas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant="secondary">Conforme: {auditSummary.fullyCompliant}/{auditSummary.total}</Badge>
              <Badge variant="outline">Taxa: {auditSummary.complianceRate}%</Badge>
              <Badge variant="outline">Com prova: {auditSummary.withProof}</Badge>
              <Badge variant="outline">Com recebedor: {auditSummary.withRecipient}</Badge>
              <Badge variant="outline">Com GPS: {auditSummary.withGps}</Badge>
              <Badge variant="outline">Bypass GPS: {auditSummary.gpsBypass}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => refetchDeliveryAudit()} disabled={fetchingDeliveryAudit}>
                Atualizar
              </Button>
              <Button size="sm" onClick={exportAuditCsv} disabled={!deliveryAuditRows.length}>
                Exportar CSV
              </Button>
            </div>
          </div>

          {deliveryAuditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem entregas concluidas para auditar.</p>
          ) : (
            <div className="space-y-2">
              {(deliveryAuditRows as any[]).slice(0, 20).map((row) => {
                const compliant = !!row.proof_image_url
                  && !!String(row.recipient_name || "").trim()
                  && (row.delivered_accuracy_meters != null || !!String(row.gps_bypass_reason || "").trim());
                return (
                  <div key={row.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium">
                        {row.orders?.customer_name || "Cliente"} - {row.delivery_drivers?.full_name || "Entregador"}
                      </p>
                      <Badge variant={compliant ? "secondary" : "destructive"}>
                        {compliant ? "Conforme" : "Incompleta"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Entregue em: {row.delivered_at ? formatDate(row.delivered_at) : "-"}
                    </p>
                    {!compliant && (
                      <p className="text-xs text-destructive mt-1">
                        Pendencias:
                        {!row.proof_image_url ? " sem prova;" : ""}
                        {!String(row.recipient_name || "").trim() ? " sem recebedor;" : ""}
                        {row.delivered_accuracy_meters == null && !String(row.gps_bypass_reason || "").trim() ? " sem GPS/justificativa;" : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
