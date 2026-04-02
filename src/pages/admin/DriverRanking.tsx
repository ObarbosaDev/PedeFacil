import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function medal(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "•";
}

export default function DriverRanking() {
  const { user } = useAuth();

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("id").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: rankingRows = [], isLoading, error } = useQuery({
    queryKey: ["driver-ranking", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("driver_reputation_metrics")
        .select("*")
        .eq("establishment_id", establishment!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment?.id,
  });

  const ranking = useMemo(() => {
    return [...(rankingRows as any[])].sort((a, b) => {
      const scoreA = Number(a.avg_rating || 0) * 100 + Number(a.deliveries_completed || 0) - Number(a.late_acceptances || 0) * 2;
      const scoreB = Number(b.avg_rating || 0) * 100 + Number(b.deliveries_completed || 0) - Number(b.late_acceptances || 0) * 2;
      return scoreB - scoreA;
    });
  }, [rankingRows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Ranking dos entregadores</h1>
        <p className="text-muted-foreground">Visão rápida de performance para escalar operação com quem está voando.</p>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando ranking...</CardContent></Card>
      ) : error ? (
        <Card><CardContent className="p-6 text-sm text-destructive">Não rolou carregar o ranking agora.</CardContent></Card>
      ) : ranking.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Ainda não há dados suficientes de entrega.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Top performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ranking.map((driver: any, index: number) => (
              <div key={driver.driver_id} className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">{medal(index)} {driver.full_name || "Entregador"}</p>
                  <p className="text-sm text-muted-foreground">
                    Entregas: {Number(driver.deliveries_completed || 0)} • Avaliações: {Number(driver.ratings_total || 0)} • Aceites atrasados: {Number(driver.late_acceptances || 0)}
                  </p>
                </div>
                <Badge variant="secondary">
                  Nota média: {Number(driver.avg_rating || 0).toFixed(2)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
