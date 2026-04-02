import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Circle, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/formatters";

export default function GoLivePresentation() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const checklistStorageKey = `pedefacil.go-live.checklist.${user?.id || "anon"}`;
  const acceptanceStorageKey = `pedefacil.go-live.acceptance.${user?.id || "anon"}`;

  const checklistState = useMemo(() => {
    try {
      const raw = localStorage.getItem(checklistStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  }, [checklistStorageKey]);

  const acceptanceState = useMemo(() => {
    try {
      const raw = localStorage.getItem(acceptanceStorageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  }, [acceptanceStorageKey]);

  const { data: establishment } = useQuery({
    queryKey: ["go-live-present-establishment", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("id, name").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["go-live-present-audit", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select(`
          id,
          status,
          delivered_at,
          proof_image_url,
          recipient_name,
          delivered_accuracy_meters,
          gps_bypass_reason,
          orders:order_id(customer_name),
          delivery_drivers:driver_id(full_name)
        `)
        .eq("establishment_id", establishment!.id)
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const checklistTotal = 7;
  const acceptanceTotal = 7;
  const checklistDone = Object.values(checklistState).filter(Boolean).length;
  const acceptanceDone = Object.values(acceptanceState).filter(Boolean).length;

  const audit = useMemo(() => {
    const rows = deliveries as any[];
    const compliant = rows.filter((row) => {
      const hasProof = !!row.proof_image_url;
      const hasRecipient = !!String(row.recipient_name || "").trim();
      const hasGpsOrBypass = row.delivered_accuracy_meters != null || !!String(row.gps_bypass_reason || "").trim();
      return hasProof && hasRecipient && hasGpsOrBypass;
    }).length;
    const rate = rows.length ? Math.round((compliant / rows.length) * 100) : 0;
    return { total: rows.length, compliant, rate };
  }, [deliveries]);

  const score = Math.round(
    ((checklistDone / checklistTotal || 0) * 35) +
    ((acceptanceDone / acceptanceTotal || 0) * 35) +
    ((audit.rate / 100) * 30)
  );

  const status = score >= 90 ? "green" : score >= 70 ? "yellow" : "red";

  const statusLabel = status === "green" ? "Pronto para liberar" : status === "yellow" ? "Quase pronto" : "Não pronto";

  const latest = (deliveries as any[]).slice(0, 3);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await (containerRef.current || document.documentElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // sem suporte/permicao no browser
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      }
      if (event.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={containerRef} className={`space-y-6 animate-fade-in ${isFullscreen ? "p-6 bg-background min-h-screen" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Apresentacao executiva</p>
          <h1 className="text-3xl font-black">Status de prontidao para cliente</h1>
          <p className="text-muted-foreground mt-1">{establishment?.name || "Sua operação"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? "Sair da tela cheia" : "Tela cheia (F)"}
          </Button>
          {!isFullscreen && (
            <Link to="/admin/go-live">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para central
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className={status === "green" ? "border-emerald-500/40 bg-emerald-500/10" : status === "yellow" ? "border-amber-500/40 bg-amber-500/10" : "border-destructive/40 bg-destructive/10"}>
        <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Semáforo de liberação</p>
            <p className="text-3xl font-black mt-1">{statusLabel}</p>
            <p className="text-sm text-muted-foreground mt-1">Score consolidado: {score}%</p>
          </div>
          <div className="flex items-center gap-3">
            <Circle className={`h-7 w-7 ${status === "green" ? "text-emerald-600 fill-emerald-600" : status === "yellow" ? "text-amber-500 fill-amber-500" : "text-destructive fill-destructive"}`} />
            <Badge variant={status === "green" ? "secondary" : status === "yellow" ? "outline" : "destructive"}>
              {status === "green" ? "GO" : status === "yellow" ? "ATENCAO" : "STOP"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Checklist</p><p className="text-2xl font-bold">{checklistDone}/{checklistTotal}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aceitação</p><p className="text-2xl font-bold">{acceptanceDone}/{acceptanceTotal}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Conformidade entrega</p><p className="text-2xl font-bold">{audit.rate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ultima atualizacao</p><p className="text-sm font-semibold">{formatDate(new Date().toISOString())}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidencias recentes</CardTitle>
          <CardDescription>Últimas entregas concluídas com dados de conformidade.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {latest.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem entregas concluídas para exibir.</p>
          ) : (
            latest.map((row: any) => {
              const compliant = !!row.proof_image_url
                && !!String(row.recipient_name || "").trim()
                && (row.delivered_accuracy_meters != null || !!String(row.gps_bypass_reason || "").trim());
              return (
                <div key={row.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.orders?.customer_name || "Cliente"} - {row.delivery_drivers?.full_name || "Entregador"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {row.delivered_at ? formatDate(row.delivered_at) : "Sem data"} | GPS: {row.delivered_accuracy_meters != null ? `${Math.round(Number(row.delivered_accuracy_meters))}m` : "bypass"}
                    </p>
                  </div>
                  {compliant ? (
                    <Badge variant="secondary" className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Conforme</Badge>
                  ) : (
                    <Badge variant="destructive" className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Incompleta</Badge>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
