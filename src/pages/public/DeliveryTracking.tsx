import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Bike, MapPin, ShieldCheck } from "lucide-react";

const statusLabels: Record<string, string> = {
  assigned: "Pedido despachado para um entregador",
  accepted: "Entregador aceitou a corrida",
  picked_up: "Saiu para entrega",
  delivered: "Pedido entregue",
  cancelled: "Entrega cancelada",
};

export default function DeliveryTracking() {
  const { token } = useParams<{ token: string }>();
  const previousStatusRef = useRef<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["delivery-tracking", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_delivery_tracking", {
        p_tracking_token: token,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (!token) return;

    const channel = supabase
      .channel(`tracking-realtime-${token}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "order_deliveries",
          filter: `tracking_token=eq.${token}`,
        },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetch, token]);

  useEffect(() => {
    if (!data?.delivery_status) return;

    const previousStatus = previousStatusRef.current;
    if (!previousStatus) {
      previousStatusRef.current = data.delivery_status;
      return;
    }

    if (previousStatus === data.delivery_status) return;

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Atualização da entrega", {
        body: statusLabels[data.delivery_status] || data.delivery_status,
      });
    }

    previousStatusRef.current = data.delivery_status;
  }, [data?.delivery_status]);

  if (isLoading) {
    return <p className="text-center py-12 text-muted-foreground">Carregando rastreio...</p>;
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Rastreio não encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esse link não bate com nenhuma entrega ativa.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
            Voltar para o início
          </Link>
          <p className="text-sm text-primary font-medium flex items-center gap-2">
            <Bike className="h-4 w-4" />
            Acompanhamento da entrega
          </p>
          <h1 className="text-3xl font-black mt-1">{data.establishment_name}</h1>
          <p className="text-muted-foreground mt-1">Pedido de {data.customer_name}</p>
        </div>

        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground">Status atual</p>
              <p className="text-lg font-semibold">{statusLabels[data.delivery_status] || data.delivery_status}</p>
            </div>
            <Badge variant="secondary">{data.delivery_status}</Badge>
          </CardContent>
        </Card>

        {"Notification" in window && Notification.permission !== "granted" && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">Ative alertas para receber notificação quando o status mudar.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void Notification.requestPermission();
                }}
              >
                Ativar alertas
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total do pedido</p>
              <p className="font-semibold">{formatCurrency(Number(data.order_total || 0))}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Tempo estimado</p>
              <p className="font-semibold">{data.eta_minutes ? `${data.eta_minutes} min` : "Sem ETA informado"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Entregador</p>
              <p className="font-semibold">{data.driver_name}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Contato do entregador</p>
              <p className="font-semibold">{data.driver_phone}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Despacho criado</p>
              <p className="text-muted-foreground">{formatDate(data.assigned_at)}</p>
            </div>
            {data.accepted_at && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">Entregador aceitou a corrida</p>
                <p className="text-muted-foreground">{formatDate(data.accepted_at)}</p>
              </div>
            )}
            {data.arrived_at_store_at && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">Entregador chegou na loja</p>
                <p className="text-muted-foreground">{formatDate(data.arrived_at_store_at)}</p>
              </div>
            )}
            {data.picked_up_at && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">Saiu para entrega</p>
                <p className="text-muted-foreground">{formatDate(data.picked_up_at)}</p>
              </div>
            )}
            {data.delivered_at && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">Pedido entregue</p>
                <p className="text-muted-foreground">{formatDate(data.delivered_at)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Confirmação da entrega
            </p>
            <p>O entregador precisa confirmar o PIN final para concluir a corrida: <span className="font-semibold text-foreground">{data.confirmation_code}</span></p>
            <p className="mt-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Se houver algum problema no trajeto, fale direto com a loja.
            </p>
            {data.proof_image_url && (
              <div className="mt-3">
                <p className="font-medium text-foreground mb-2">Comprovação da entrega</p>
                <img
                  src={data.proof_image_url}
                  alt="Comprovação da entrega"
                  className="max-h-64 rounded-lg border object-cover"
                  loading="lazy"
                />
              </div>
            )}
            {data.recipient_name && (
              <p className="mt-2">
                Recebido por: <span className="font-semibold text-foreground">{data.recipient_name}</span>
              </p>
            )}
            {data.delivered_accuracy_meters != null && (
              <p className="mt-1 text-xs">
                GPS da confirmação: {Math.round(Number(data.delivered_accuracy_meters))}m de precisão.
              </p>
            )}
            {data.gps_bypass_reason && (
              <p className="mt-1 text-xs text-amber-700">
                Entrega concluída com justificativa sem GPS: <span className="font-semibold">{data.gps_bypass_reason}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
