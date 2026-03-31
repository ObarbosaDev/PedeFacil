import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { Bike, CheckCircle2, Clock3, ExternalLink, LogOut, MapPin, Phone, Route, ShieldCheck } from "lucide-react";

const deliveryStatusLabels: Record<string, string> = {
  assigned: "Aguardando aceite",
  accepted: "Aceita",
  picked_up: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

const modeLabels: Record<string, string> = {
  online: "Online",
  busy: "Em rota",
  paused: "Em pausa",
  offline: "Offline",
};

const deliveryIssuePresets = [
  "Cliente ausente",
  "Endereco incompleto",
  "Sem troco",
  "Transito pesado",
  "Loja atrasou a saida",
];

function buildAddress(order: any) {
  const parts = [
    [order?.delivery_street, order?.delivery_number].filter(Boolean).join(", "),
    order?.delivery_neighborhood,
    [order?.delivery_city, order?.delivery_state].filter(Boolean).join("/"),
  ].filter(Boolean);

  return parts.join(" - ");
}

function buildMapsUrl(order: any) {
  const query = encodeURIComponent(
    [
      order?.delivery_street,
      order?.delivery_number,
      order?.delivery_neighborhood,
      order?.delivery_city,
      order?.delivery_state,
      order?.delivery_zip_code,
    ]
      .filter(Boolean)
      .join(", ")
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function buildWazeUrl(order: any) {
  const query = encodeURIComponent(
    [
      order?.delivery_street,
      order?.delivery_number,
      order?.delivery_neighborhood,
      order?.delivery_city,
      order?.delivery_state,
    ]
      .filter(Boolean)
      .join(", ")
  );
  return `https://waze.com/ul?q=${query}&navigate=yes`;
}

export default function DriverPanel() {
  const { user, loading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const userType = String((user?.user_metadata as any)?.user_type || "");
  const [issueDraftByDelivery, setIssueDraftByDelivery] = useState<Record<string, string>>({});

  const linkDriverMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) return;
      const { error } = await (supabase as any)
        .from("delivery_drivers")
        .update({ user_id: user.id })
        .eq("email", user.email.toLowerCase())
        .is("user_id", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
    },
  });

  const { data: driverProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ["driver-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_drivers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || driverProfile || linkDriverMutation.isPending) return;
    void linkDriverMutation.mutateAsync();
  }, [driverProfile, linkDriverMutation, user]);

  const { data: deliveries = [] } = useQuery({
    queryKey: ["driver-deliveries", driverProfile?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select(`
          *,
          orders:order_id (
            id,
            customer_name,
            customer_phone,
            order_type,
            total,
            status,
            delivery_street,
            delivery_number,
            delivery_neighborhood,
            delivery_city,
            delivery_state,
            delivery_zip_code,
            delivery_reference,
            created_at
          ),
          establishments:establishment_id (
            id,
            name
          )
        `)
        .eq("driver_id", driverProfile!.id)
        .in("status", ["assigned", "accepted", "picked_up"])
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverProfile?.id,
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (mode: "online" | "paused" | "offline") => {
      const { error } = await (supabase as any)
        .from("delivery_drivers")
        .update({
          availability_mode: mode,
          is_available: mode === "online",
        })
        .eq("id", driverProfile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
      toast.success("Seu status foi atualizado.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel atualizar seu status."),
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: async ({
      deliveryId,
      nextStatus,
      confirmationCode,
    }: {
      deliveryId: string;
      nextStatus: string;
      confirmationCode?: string;
    }) => {
      const patch: Record<string, any> = { status: nextStatus };
      if (nextStatus === "accepted") patch.accepted_at = new Date().toISOString();
      if (nextStatus === "picked_up") patch.picked_up_at = new Date().toISOString();
      if (nextStatus === "delivered") patch.delivered_at = new Date().toISOString();

      const { data: currentDelivery, error: deliveryError } = await (supabase as any)
        .from("order_deliveries")
        .select("*, orders:order_id(id, establishment_id, customer_name, customer_phone, total, order_type)")
        .eq("id", deliveryId)
        .single();
      if (deliveryError) throw deliveryError;

      if (nextStatus === "delivered" && confirmationCode !== currentDelivery.confirmation_code) {
        throw new Error("Codigo de confirmacao invalido.");
      }

      const { error } = await (supabase as any)
        .from("order_deliveries")
        .update(patch)
        .eq("id", deliveryId);
      if (error) throw error;

      if (nextStatus === "accepted") {
        await (supabase as any).from("whatsapp_automation_events").insert({
          establishment_id: currentDelivery.establishment_id,
          order_id: currentDelivery.order_id,
          customer_phone: currentDelivery.orders.customer_phone,
          event_key: "delivery_accepted_by_driver",
          payload: {
            order_id: currentDelivery.orders.id,
            customer_name: currentDelivery.orders.customer_name,
            customer_phone: currentDelivery.orders.customer_phone,
            status: "accepted",
            order_type: currentDelivery.orders.order_type,
            total: currentDelivery.orders.total,
            updated_at: new Date().toISOString(),
          },
          status: "pending",
          attempts: 0,
        });
      }

      if (nextStatus === "picked_up") {
        await (supabase as any).from("whatsapp_automation_events").insert({
          establishment_id: currentDelivery.establishment_id,
          order_id: currentDelivery.order_id,
          customer_phone: currentDelivery.orders.customer_phone,
          event_key: "delivery_out_for_delivery",
          payload: {
            order_id: currentDelivery.orders.id,
            customer_name: currentDelivery.orders.customer_name,
            customer_phone: currentDelivery.orders.customer_phone,
            status: "picked_up",
            order_type: currentDelivery.orders.order_type,
            total: currentDelivery.orders.total,
            tracking_url: `${window.location.origin}/acompanhar/${currentDelivery.tracking_token}`,
            updated_at: new Date().toISOString(),
          },
          status: "pending",
          attempts: 0,
        });
      }

      if (nextStatus === "delivered") {
        const { error: orderError } = await supabase
          .from("orders")
          .update({ status: "delivered" as any })
          .eq("id", currentDelivery.order_id);
        if (orderError) throw orderError;
      }

      const { data: activeDeliveries } = await (supabase as any)
        .from("order_deliveries")
        .select("id")
        .eq("driver_id", currentDelivery.driver_id)
        .in("status", ["assigned", "accepted", "picked_up"]);

      await (supabase as any)
        .from("delivery_drivers")
        .update({
          is_available: !activeDeliveries?.length,
          availability_mode: activeDeliveries?.length ? "busy" : "online",
        })
        .eq("id", currentDelivery.driver_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Entrega atualizada.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel atualizar a entrega."),
  });

  const reportIssueMutation = useMutation({
    mutationFn: async ({ deliveryId, issueReason }: { deliveryId: string; issueReason: string }) => {
      const { error } = await (supabase as any)
        .from("order_deliveries")
        .update({ issue_reason: issueReason.trim() || null })
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Ocorrencia registrada.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel registrar a ocorrencia."),
  });

  if (!loading && !user) return <Navigate to="/entregador/login" replace />;

  if (!loading && user && userType && userType !== "delivery_driver") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Conta sem acesso de entregador</CardTitle>
            <CardDescription>Entre com uma conta de entregador para visualizar as corridas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => signOut()}>Sair e trocar conta</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingProfile) {
    return <p className="text-center py-12 text-muted-foreground">Carregando painel do entregador...</p>;
  }

  if (!driverProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Cadastro ainda nao vinculado</CardTitle>
            <CardDescription>Seu e-mail ainda nao foi encontrado em nenhum cadastro de entregador da loja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Peca para o lojista te cadastrar na tela de Entregadores usando este mesmo e-mail.</p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bike className="h-6 w-6 text-primary" />
              Painel do entregador
            </h1>
            <p className="text-muted-foreground">{driverProfile.full_name} • {driverProfile.vehicle_type}</p>
          </div>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div><p className="text-xs text-muted-foreground">Corridas ativas</p><p className="text-2xl font-bold">{deliveries.length}</p></div>
            <div><p className="text-xs text-muted-foreground">Modo</p><p className="text-sm font-semibold">{modeLabels[driverProfile.availability_mode] || driverProfile.availability_mode}</p></div>
            <div><p className="text-xs text-muted-foreground">Capacidade</p><p className="text-sm font-semibold">{driverProfile.max_active_deliveries} simultaneas</p></div>
            <div><p className="text-xs text-muted-foreground">Pagamento por corrida</p><p className="text-sm font-semibold">{formatCurrency(Number(driverProfile.payout_per_delivery || 0))}</p></div>
            <div><p className="text-xs text-muted-foreground">Contato</p><p className="text-sm font-semibold">{driverProfile.phone}</p></div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => updateAvailabilityMutation.mutate("online")}>Ficar online</Button>
            <Button size="sm" variant="outline" onClick={() => updateAvailabilityMutation.mutate("paused")}>Entrar em pausa</Button>
            <Button size="sm" variant="outline" onClick={() => updateAvailabilityMutation.mutate("offline")}>Ficar offline</Button>
            <div className="text-sm text-muted-foreground flex items-center gap-2 ml-auto">
              <ShieldCheck className="h-4 w-4 text-primary" />
              O sistema usa PIN na entrega para evitar baixa errada.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Minhas entregas</CardTitle>
            <CardDescription>Painel direto para quem esta na rua: rota, contato e confirmacao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem corridas ativas no momento.</p>
          ) : (
              deliveries.map((delivery: any) => {
                const order = delivery.orders;
                const store = delivery.establishments;
                const address = buildAddress(order);
                const issueDraft = issueDraftByDelivery[delivery.id] || "";

                return (
                  <div key={delivery.id} className="rounded-xl border p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold">{store?.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(delivery.assigned_at)}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{deliveryStatusLabels[delivery.status] || delivery.status}</Badge>
                        {delivery.accepted_deadline_at && delivery.status === "assigned" && (
                          <Badge variant="outline">Aceite ate {formatDate(delivery.accepted_deadline_at)}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-sm space-y-1">
                      <p className="font-medium">{order?.customer_name}</p>
                      <p className="text-muted-foreground flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order?.customer_phone}</p>
                      <p className="text-muted-foreground flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5" /> <span>{address}</span></p>
                      {order?.delivery_reference && <p className="text-muted-foreground">Ref.: {order.delivery_reference}</p>}
                      <p className="font-semibold text-primary">Total: {formatCurrency(Number(order?.total || 0))}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <a href={buildMapsUrl(order)} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="w-full" size="sm">
                          <Route className="h-4 w-4 mr-2" />
                          Google Maps
                        </Button>
                      </a>
                      <a href={buildWazeUrl(order)} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="w-full" size="sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir no Waze
                        </Button>
                      </a>
                      <a href={`tel:${String(order?.customer_phone || "").replace(/\D/g, "")}`}>
                        <Button variant="outline" className="w-full" size="sm">
                          <Phone className="h-4 w-4 mr-2" />
                          Ligar para cliente
                        </Button>
                      </a>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Acompanhamento do cliente</p>
                      <Link className="font-medium text-primary hover:underline break-all" to={`/acompanhar/${delivery.tracking_token}`}>
                        {window.location.origin}/acompanhar/{delivery.tracking_token}
                      </Link>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-muted-foreground">Ocorrencias da rota</p>
                        {delivery.issue_reason && (
                          <Badge variant="outline">{delivery.issue_reason}</Badge>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {deliveryIssuePresets.map((issue) => (
                          <Button
                            key={`${delivery.id}-${issue}`}
                            type="button"
                            size="sm"
                            variant={issueDraft === issue ? "default" : "outline"}
                            onClick={() => setIssueDraftByDelivery((prev) => ({ ...prev, [delivery.id]: issue }))}
                          >
                            {issue}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const customIssue = window.prompt("Descreva a ocorrencia da rota:");
                            if (!customIssue?.trim()) return;
                            setIssueDraftByDelivery((prev) => ({ ...prev, [delivery.id]: customIssue.trim() }));
                          }}
                        >
                          Outra ocorrencia
                        </Button>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!issueDraft || reportIssueMutation.isPending}
                          onClick={() => reportIssueMutation.mutate({ deliveryId: delivery.id, issueReason: issueDraft })}
                        >
                          Salvar ocorrencia
                        </Button>
                        {delivery.issue_reason && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={reportIssueMutation.isPending}
                            onClick={() => reportIssueMutation.mutate({ deliveryId: delivery.id, issueReason: "" })}
                          >
                            Limpar ocorrencia
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {delivery.status === "assigned" && (
                        <Button size="sm" onClick={() => updateDeliveryMutation.mutate({ deliveryId: delivery.id, nextStatus: "accepted" })}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Aceitar corrida
                        </Button>
                      )}

                      {delivery.status === "accepted" && (
                        <Button size="sm" onClick={() => updateDeliveryMutation.mutate({ deliveryId: delivery.id, nextStatus: "picked_up" })}>
                          <Clock3 className="h-4 w-4 mr-2" />
                          Saiu para entrega
                        </Button>
                      )}

                      {["accepted", "picked_up"].includes(delivery.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const code = window.prompt("Confirma o PIN de entrega com 4 digitos:");
                            if (!code) return;
                            updateDeliveryMutation.mutate({
                              deliveryId: delivery.id,
                              nextStatus: "delivered",
                              confirmationCode: code.trim(),
                            });
                          }}
                        >
                          Marcar como entregue
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
