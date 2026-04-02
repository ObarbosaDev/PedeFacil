import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageLoader from "@/components/system/PageLoader";
import StateCard from "@/components/system/StateCard";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { logAuditEvent, logClientError } from "@/lib/observability";
import { toast } from "sonner";
import { Bike, CheckCircle2, Clock3, ExternalLink, LogOut, MapPin, Phone, Route, ShieldCheck, Wifi, WifiOff } from "lucide-react";

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

type OfflineDriverAction =
  | { type: "availability"; mode: "online" | "paused" | "offline"; createdAt: string }
  | { type: "delivery_status"; deliveryId: string; nextStatus: string; confirmationCode?: string; createdAt: string }
  | { type: "delivery_issue"; deliveryId: string; issueReason: string; createdAt: string };

type DeliveryGeolocation = {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
};

const MIN_GEO_ACCURACY_METERS = 120;

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
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [cachedDeliveries, setCachedDeliveries] = useState<any[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineDriverAction[]>([]);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [proofFileByDelivery, setProofFileByDelivery] = useState<Record<string, File | null>>({});
  const [uploadingProofByDelivery, setUploadingProofByDelivery] = useState<Record<string, boolean>>({});
  const [recipientNameByDelivery, setRecipientNameByDelivery] = useState<Record<string, string>>({});
  const [geoByDelivery, setGeoByDelivery] = useState<Record<string, DeliveryGeolocation | null>>({});
  const [capturingGeoByDelivery, setCapturingGeoByDelivery] = useState<Record<string, boolean>>({});
  const [gpsBypassReasonByDelivery, setGpsBypassReasonByDelivery] = useState<Record<string, string>>({});
  const cacheKey = `pedefacil.driver.offline.${user?.id || "anon"}`;
  const queueKey = `pedefacil.driver.offline.queue.${user?.id || "anon"}`;

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

  const {
    data: driverProfile,
    isLoading: loadingProfile,
    isError: isDriverProfileError,
    error: driverProfileError,
  } = useQuery({
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) {
        setCachedDeliveries([]);
        return;
      }
      const parsed = JSON.parse(raw) as { deliveries?: any[] };
      setCachedDeliveries(Array.isArray(parsed?.deliveries) ? parsed.deliveries : []);
    } catch {
      setCachedDeliveries([]);
    }
  }, [cacheKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(queueKey);
      if (!raw) {
        setOfflineQueue([]);
        return;
      }
      const parsed = JSON.parse(raw) as OfflineDriverAction[];
      setOfflineQueue(Array.isArray(parsed) ? parsed : []);
    } catch {
      setOfflineQueue([]);
    }
  }, [queueKey]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const {
    data: deliveries = [],
    isError: isDeliveriesError,
    error: deliveriesError,
  } = useQuery({
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

  const { data: deliveredPayouts = [] } = useQuery({
    queryKey: ["driver-wallet", driverProfile?.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, payout_amount, delivered_at, order_id")
        .eq("driver_id", driverProfile!.id)
        .eq("status", "delivered")
        .gte("delivered_at", start.toISOString())
        .order("delivered_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverProfile?.id,
  });

  useEffect(() => {
    if (!isOnline) return;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        deliveries: deliveries as any[],
        updatedAt: new Date().toISOString(),
      })
    );
    setCachedDeliveries(deliveries as any[]);
  }, [cacheKey, deliveries, isOnline]);

  const visibleDeliveries = useMemo(() => (isOnline ? (deliveries as any[]) : cachedDeliveries), [cachedDeliveries, deliveries, isOnline]);

  const persistOfflineQueue = (nextQueue: OfflineDriverAction[]) => {
    setOfflineQueue(nextQueue);
    localStorage.setItem(queueKey, JSON.stringify(nextQueue));
  };

  const enqueueOfflineAction = (action: OfflineDriverAction) => {
    const next = [...offlineQueue, action];
    persistOfflineQueue(next);
  };

  const persistCachedDeliveries = (nextDeliveries: any[]) => {
    setCachedDeliveries(nextDeliveries);
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        deliveries: nextDeliveries,
        updatedAt: new Date().toISOString(),
      })
    );
  };

  const applyLocalDeliveryPatch = (deliveryId: string, patch: Record<string, any>) => {
    const next = (visibleDeliveries as any[])
      .map((delivery: any) => (delivery.id === deliveryId ? { ...delivery, ...patch } : delivery))
      .filter((delivery: any) => ["assigned", "accepted", "picked_up"].includes(delivery.status));
    persistCachedDeliveries(next);
  };

  const walletSummary = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const weekCutoff = now - 7 * oneDay;
    const monthCutoff = now - 30 * oneDay;
    const dayCutoff = now - oneDay;

    const total30d = (deliveredPayouts as any[]).reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const total7d = (deliveredPayouts as any[])
      .filter((row) => new Date(row.delivered_at).getTime() >= weekCutoff)
      .reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const today = (deliveredPayouts as any[])
      .filter((row) => new Date(row.delivered_at).getTime() >= dayCutoff)
      .reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const pending = (visibleDeliveries as any[]).reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const totalCount30d = (deliveredPayouts as any[]).filter((row) => new Date(row.delivered_at).getTime() >= monthCutoff).length;

    return { today, total7d, total30d, pending, totalCount30d };
  }, [deliveredPayouts, visibleDeliveries]);

  const uploadDeliveryProof = async (deliveryId: string, file: File) => {
    setUploadingProofByDelivery((prev) => ({ ...prev, [deliveryId]: true }));
    try {
      const extension = file.name.split(".").pop() || "jpg";
      const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const filePath = `${driverProfile.id}/${deliveryId}/${Date.now()}.${safeExt}`;

      const { error } = await supabase.storage.from("delivery-proofs").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("delivery-proofs").getPublicUrl(filePath);
      return data.publicUrl;
    } finally {
      setUploadingProofByDelivery((prev) => ({ ...prev, [deliveryId]: false }));
    }
  };

  const captureDeliveryGeolocation = (deliveryId: string) => {
    if (!("geolocation" in navigator)) {
      toast.error("Seu aparelho nao suporta geolocalizacao.");
      return;
    }

    setCapturingGeoByDelivery((prev) => ({ ...prev, [deliveryId]: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const payload: DeliveryGeolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        };
        setGeoByDelivery((prev) => ({ ...prev, [deliveryId]: payload }));
        setCapturingGeoByDelivery((prev) => ({ ...prev, [deliveryId]: false }));
        toast.success("Localizacao capturada.");
      },
      () => {
        setCapturingGeoByDelivery((prev) => ({ ...prev, [deliveryId]: false }));
        toast.error("Nao foi possivel capturar sua localizacao.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const applyAvailabilityOnline = async (mode: "online" | "paused" | "offline") => {
    const { error } = await (supabase as any)
      .from("delivery_drivers")
      .update({
        availability_mode: mode,
        is_available: mode === "online",
      })
      .eq("id", driverProfile.id);
    if (error) throw error;
  };

  const applyIssueOnline = async (deliveryId: string, issueReason: string) => {
    const { error } = await (supabase as any)
      .from("order_deliveries")
      .update({ issue_reason: issueReason.trim() || null })
      .eq("id", deliveryId);
    if (error) throw error;
  };

  const applyDeliveryStatusOnline = async ({
    deliveryId,
    nextStatus,
    confirmationCode,
    proofImageUrl,
    recipientName,
    deliveryGeolocation,
    gpsBypassReason,
  }: {
    deliveryId: string;
    nextStatus: string;
    confirmationCode?: string;
    proofImageUrl?: string;
    recipientName?: string;
    deliveryGeolocation?: DeliveryGeolocation;
    gpsBypassReason?: string;
  }) => {
    const patch: Record<string, any> = { status: nextStatus };
    if (nextStatus === "accepted") patch.accepted_at = new Date().toISOString();
    if (nextStatus === "picked_up") patch.picked_up_at = new Date().toISOString();
    if (nextStatus === "delivered") patch.delivered_at = new Date().toISOString();
    if (nextStatus === "delivered") {
      patch.recipient_name = recipientName || null;
      patch.delivered_lat = deliveryGeolocation?.lat ?? null;
      patch.delivered_lng = deliveryGeolocation?.lng ?? null;
      patch.delivered_accuracy_meters = deliveryGeolocation?.accuracy ?? null;
      patch.gps_bypass_reason = gpsBypassReason || null;
      patch.proof_image_url = proofImageUrl || null;
      patch.proof_uploaded_at = proofImageUrl ? new Date().toISOString() : null;
    }

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

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "delivery_driver",
        entityType: "order_delivery",
        entityId: deliveryId,
        action: "delivery_completed_with_proof",
        metadata: {
          orderId: currentDelivery.order_id,
          driverId: currentDelivery.driver_id,
          proofImageUrl: proofImageUrl || null,
          recipientName: recipientName || null,
          deliveredLat: deliveryGeolocation?.lat ?? null,
          deliveredLng: deliveryGeolocation?.lng ?? null,
          deliveredAccuracy: deliveryGeolocation?.accuracy ?? null,
          gpsBypassReason: gpsBypassReason || null,
        },
      });
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
  };

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (mode: "online" | "paused" | "offline") => {
      if (!isOnline) {
        enqueueOfflineAction({ type: "availability", mode, createdAt: new Date().toISOString() });
        queryClient.setQueryData(["driver-profile", user?.id], (prev: any) =>
          prev
            ? {
                ...prev,
                availability_mode: mode,
                is_available: mode === "online",
              }
            : prev
        );
        toast.success("Sem internet: status salvo na fila.");
        return;
      }
      await applyAvailabilityOnline(mode);
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
      proofFile,
      recipientName,
      deliveryGeolocation,
      gpsBypassReason,
    }: {
      deliveryId: string;
      nextStatus: string;
      confirmationCode?: string;
      proofFile?: File | null;
      recipientName?: string;
      deliveryGeolocation?: DeliveryGeolocation | null;
      gpsBypassReason?: string;
    }) => {
      if (!isOnline) {
        if (nextStatus === "delivered") {
          throw new Error("Para concluir e enviar prova de entrega, voce precisa estar online.");
        }

        enqueueOfflineAction({
          type: "delivery_status",
          deliveryId,
          nextStatus,
          confirmationCode,
          createdAt: new Date().toISOString(),
        });
        const localPatch: Record<string, any> = { status: nextStatus };
        if (nextStatus === "accepted") localPatch.accepted_at = new Date().toISOString();
        if (nextStatus === "picked_up") localPatch.picked_up_at = new Date().toISOString();
        if (nextStatus === "delivered") localPatch.delivered_at = new Date().toISOString();
        applyLocalDeliveryPatch(deliveryId, localPatch);
        toast.success("Sem internet: acao da entrega salva na fila.");
        return;
      }

      let proofImageUrl: string | undefined;
      if (nextStatus === "delivered") {
        if (!proofFile) {
          throw new Error("Adicione uma foto da entrega antes de concluir.");
        }
        if (!recipientName?.trim()) {
          throw new Error("Informe o nome de quem recebeu a entrega.");
        }
        const hasGoodGps = !!deliveryGeolocation && deliveryGeolocation.accuracy <= MIN_GEO_ACCURACY_METERS;
        if (!hasGoodGps && (!gpsBypassReason?.trim() || gpsBypassReason.trim().length < 12)) {
          throw new Error("Sem GPS valido, informe uma justificativa com pelo menos 12 caracteres.");
        }
        proofImageUrl = await uploadDeliveryProof(deliveryId, proofFile);

        await applyDeliveryStatusOnline({
          deliveryId,
          nextStatus,
          confirmationCode,
          proofImageUrl,
          recipientName,
          deliveryGeolocation: hasGoodGps ? (deliveryGeolocation || undefined) : undefined,
          gpsBypassReason: hasGoodGps ? undefined : gpsBypassReason.trim(),
        });
        return;
      }

      await applyDeliveryStatusOnline({ deliveryId, nextStatus, confirmationCode });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (variables?.nextStatus === "delivered") {
        setProofFileByDelivery((prev) => ({ ...prev, [variables.deliveryId]: null }));
        setRecipientNameByDelivery((prev) => ({ ...prev, [variables.deliveryId]: "" }));
        setGeoByDelivery((prev) => ({ ...prev, [variables.deliveryId]: null }));
        setGpsBypassReasonByDelivery((prev) => ({ ...prev, [variables.deliveryId]: "" }));
      }
      toast.success("Entrega atualizada.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel atualizar a entrega."),
  });

  const reportIssueMutation = useMutation({
    mutationFn: async ({ deliveryId, issueReason }: { deliveryId: string; issueReason: string }) => {
      if (!isOnline) {
        enqueueOfflineAction({
          type: "delivery_issue",
          deliveryId,
          issueReason,
          createdAt: new Date().toISOString(),
        });
        applyLocalDeliveryPatch(deliveryId, { issue_reason: issueReason.trim() || null });
        toast.success("Sem internet: ocorrência salva na fila.");
        return;
      }
      await applyIssueOnline(deliveryId, issueReason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Ocorrencia registrada.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel registrar a ocorrencia."),
  });

  useEffect(() => {
    if (!isOnline || offlineQueue.length === 0 || !driverProfile?.id || isSyncingQueue) return;

    let cancelled = false;

    const runSync = async () => {
      setIsSyncingQueue(true);
      let applied = 0;
      const remainingQueue: OfflineDriverAction[] = [];

      for (let index = 0; index < offlineQueue.length; index += 1) {
        const action = offlineQueue[index];
        if (cancelled) return;

        try {
          if (action.type === "availability") {
            await applyAvailabilityOnline(action.mode);
          }
          if (action.type === "delivery_issue") {
            await applyIssueOnline(action.deliveryId, action.issueReason);
          }
          if (action.type === "delivery_status") {
            await applyDeliveryStatusOnline({
              deliveryId: action.deliveryId,
              nextStatus: action.nextStatus,
              confirmationCode: action.confirmationCode,
            });
          }
          applied += 1;
        } catch {
          remainingQueue.push(...offlineQueue.slice(index));
          break;
        }
      }

      if (cancelled) return;

      persistOfflineQueue(remainingQueue);
      setIsSyncingQueue(false);

      queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      if (applied > 0) toast.success(`${applied} acao(oes) offline sincronizadas.`);
      if (remainingQueue.length > 0) toast.warning(`${remainingQueue.length} acao(oes) ficaram pendentes para tentar de novo.`);
    };

    void runSync();
    return () => {
      cancelled = true;
    };
  }, [applyAvailabilityOnline, applyDeliveryStatusOnline, applyIssueOnline, driverProfile?.id, isOnline, isSyncingQueue, offlineQueue, queryClient, user?.id]);

  useEffect(() => {
    if (!isDriverProfileError || !driverProfileError) return;
    void logClientError({
      scope: "query",
      message: "Falha ao carregar perfil do entregador",
      metadata: { error: String(driverProfileError) },
    });
  }, [driverProfileError, isDriverProfileError]);

  useEffect(() => {
    if (!isDeliveriesError || !deliveriesError) return;
    void logClientError({
      scope: "query",
      message: "Falha ao carregar entregas do entregador",
      metadata: { error: String(deliveriesError) },
    });
  }, [deliveriesError, isDeliveriesError]);

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
    return <PageLoader label="Carregando painel do entregador..." className="min-h-[70vh]" />;
  }

  if (isDriverProfileError) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-3xl">
          <StateCard
            kind="error"
            title="Não foi possível abrir seu painel"
            description="Tente novamente em instantes. Se persistir, avise o suporte da loja."
            actionLabel="Recarregar"
            action={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (!driverProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <div className="w-full max-w-lg">
          <StateCard
            title="Cadastro ainda não vinculado"
            description="Seu e-mail ainda não foi encontrado em nenhum cadastro de entregador da loja."
          >
            <p className="text-sm text-muted-foreground">
              Peça para o lojista te cadastrar na tela de Entregadores usando este mesmo e-mail.
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sair
            </Button>
          </StateCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card className={isOnline ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/10"}>
          <CardContent className="p-3 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-700" />}
              <span className="font-medium">
                {isOnline ? "Conexao ativa. Dados sincronizados em tempo real." : "Sem internet. Exibindo ultimas corridas salvas neste aparelho."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && <Badge variant="secondary">Modo offline</Badge>}
              {isSyncingQueue && <Badge variant="outline">Sincronizando...</Badge>}
              {offlineQueue.length > 0 && <Badge variant="secondary">{offlineQueue.length} pendente(s)</Badge>}
            </div>
          </CardContent>
        </Card>

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
            <div><p className="text-xs text-muted-foreground">Corridas ativas</p><p className="text-2xl font-bold">{visibleDeliveries.length}</p></div>
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
            <CardTitle>Carteira do entregador</CardTitle>
            <CardDescription>Resumo financeiro da sua rota para acompanhar ganhos sem dor de cabeca.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="font-bold">{formatCurrency(walletSummary.today)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ultimos 7 dias</p>
              <p className="font-bold">{formatCurrency(walletSummary.total7d)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ultimos 30 dias</p>
              <p className="font-bold">{formatCurrency(walletSummary.total30d)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Em rota agora</p>
              <p className="font-bold">{formatCurrency(walletSummary.pending)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Entregas (30d)</p>
              <p className="font-bold">{walletSummary.totalCount30d}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Minhas entregas</CardTitle>
            <CardDescription>Painel direto para quem está na rua: rota, contato e confirmação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isDeliveriesError ? (
              <StateCard
                kind="error"
                title="Falha ao carregar corridas"
                description="A conexão oscilou. Atualize para puxar as entregas novamente."
                actionLabel="Recarregar"
                action={() => window.location.reload()}
              />
            ) : visibleDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem corridas ativas no momento.</p>
            ) : (
              visibleDeliveries.map((delivery: any) => {
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
                        <div className="w-full rounded-lg border p-3 bg-muted/20 space-y-2">
                          <p className="text-xs text-muted-foreground">Prova de entrega (foto)</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              setProofFileByDelivery((prev) => ({ ...prev, [delivery.id]: file }));
                            }}
                          />
                          {proofFileByDelivery[delivery.id] && (
                            <p className="text-xs text-muted-foreground">Foto selecionada: {proofFileByDelivery[delivery.id]?.name}</p>
                          )}
                          <Input
                            placeholder="Nome de quem recebeu"
                            value={recipientNameByDelivery[delivery.id] || ""}
                            onChange={(event) =>
                              setRecipientNameByDelivery((prev) => ({ ...prev, [delivery.id]: event.target.value }))
                            }
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={capturingGeoByDelivery[delivery.id]}
                              onClick={() => captureDeliveryGeolocation(delivery.id)}
                            >
                              {capturingGeoByDelivery[delivery.id] ? "Capturando localizacao..." : "Capturar localizacao"}
                            </Button>
                            {geoByDelivery[delivery.id] && (
                              <p className={`text-xs ${geoByDelivery[delivery.id]!.accuracy > MIN_GEO_ACCURACY_METERS ? "text-destructive" : "text-muted-foreground"}`}>
                                GPS: precisao {Math.round(geoByDelivery[delivery.id]!.accuracy)}m
                              </p>
                            )}
                          </div>
                          <Input
                            placeholder="Justificativa sem GPS (obrigatoria se GPS falhar)"
                            value={gpsBypassReasonByDelivery[delivery.id] || ""}
                            onChange={(event) =>
                              setGpsBypassReasonByDelivery((prev) => ({ ...prev, [delivery.id]: event.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={uploadingProofByDelivery[delivery.id]}
                            onClick={() => {
                              const code = window.prompt("Confirma o PIN de entrega com 4 digitos:");
                              if (!code) return;
                              updateDeliveryMutation.mutate({
                                deliveryId: delivery.id,
                                nextStatus: "delivered",
                                confirmationCode: code.trim(),
                                proofFile: proofFileByDelivery[delivery.id] || null,
                                recipientName: recipientNameByDelivery[delivery.id] || "",
                                deliveryGeolocation: geoByDelivery[delivery.id] || null,
                                gpsBypassReason: gpsBypassReasonByDelivery[delivery.id] || "",
                              });
                            }}
                          >
                            {uploadingProofByDelivery[delivery.id] ? "Enviando prova..." : "Marcar como entregue"}
                          </Button>
                        </div>
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
