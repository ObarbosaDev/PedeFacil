import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function PaymentsLedger() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("id").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["payments-ledger", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payments_ledger")
        .select("*")
        .order("processed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!establishment?.id,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows as any[];
    return (rows as any[]).filter((row) => {
      return (
        String(row.checkout_session_id || "").toLowerCase().includes(term) ||
        String(row.provider_payment_id || "").toLowerCase().includes(term) ||
        String(row.provider_event_id || "").toLowerCase().includes(term) ||
        String(row.status || "").toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Ledger de pagamentos</h1>
        <p className="text-muted-foreground">Rastro completo dos eventos de pagamento para auditoria e suporte.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Buscar por checkout session, payment id, event id ou status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando ledger...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Não rolou carregar o ledger agora.</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum evento encontrado.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Últimos eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.map((row: any) => (
              <div key={row.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="font-semibold text-sm break-all">{row.checkout_session_id}</p>
                  <Badge variant={row.status === "approved" ? "secondary" : "outline"}>{row.status || "unknown"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground break-all">Payment ID: {row.provider_payment_id || "-"}</p>
                <p className="text-xs text-muted-foreground break-all">Event ID: {row.provider_event_id}</p>
                <p className="text-xs text-muted-foreground">Processado em: {new Date(row.processed_at).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
