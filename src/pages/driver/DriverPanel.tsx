import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageLoader from "@/components/system/PageLoader";
import StateCard from "@/components/system/StateCard";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { logAuditEvent, logClientError } from "@/lib/observability";
import { toast } from "sonner";
import { Bike, Camera, CheckCircle2, Clock3, ExternalLink, LogOut, MapPin, MessageCircle, Phone, Route, ShieldCheck, Wifi, WifiOff } from "lucide-react";

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
  "Endereço incompleto",
  "Sem troco",
  "Trânsito pesado",
  "Loja atrasou a saída",
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

type DriverAccountForm = {
  fullName: string;
  phone: string;
  vehicleType: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
  vehicleNotes: string;
  avatarUrl: string;
};

const emptyDriverAccountForm: DriverAccountForm = {
  fullName: "",
  phone: "",
  vehicleType: "moto",
  vehicleBrand: "",
  vehicleModel: "",
  vehicleColor: "",
  licensePlate: "",
  vehicleNotes: "",
  avatarUrl: "",
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

function buildCustomerWhatsAppUrl(order: any, store?: any) {
  const phone = String(order?.customer_phone || "").replace(/\D/g, "");
  const withCountryCode = phone.startsWith("55") ? phone : `55${phone}`;
  const message = encodeURIComponent(
    `Oi, aqui é o entregador do pedido${store?.name ? ` da ${store.name}` : ""} na Pede Fácil. Estou com sua entrega e seguindo para o endereço informado.`
  );
  return `https://wa.me/${withCountryCode}?text=${message}`;
}

function buildStoreWhatsAppUrl(store?: any, order?: any) {
  const phone = String(store?.whatsapp || "").replace(/\D/g, "");
  const withCountryCode = phone.startsWith("55") ? phone : `55${phone}`;
  const message = encodeURIComponent(
    `Oi${store?.name ? `, ${store.name}` : ""}. Aqui é o entregador${order?.customer_name ? ` da corrida de ${order.customer_name}` : ""} na Pede Fácil.`
  );
  return `https://wa.me/${withCountryCode}?text=${message}`;
}

function getDeliveryOperationCopy(mode?: string | null) {
  if (mode === "shared_fleet") return "Corrida vinda da base compartilhada da plataforma.";
  if (mode === "hybrid") return "Corrida em modo híbrido: loja + base compartilhada.";
  return "Corrida da frota da loja.";
}

export default function DriverPanel() {
  const { user, loading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const userType = String((user?.user_metadata as any)?.user_type || "");
  const [hasAttemptedProfileSetup, setHasAttemptedProfileSetup] = useState(false);
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
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const [driverAccountForm, setDriverAccountForm] = useState<DriverAccountForm>(emptyDriverAccountForm);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const cacheKey = `pedefacil.driver.offline.${user?.id || "anon"}`;
  const queueKey = `pedefacil.driver.offline.queue.${user?.id || "anon"}`;

  const logContactClick = async (channel: "phone_customer" | "whatsapp_customer" | "whatsapp_store", deliveryId?: string, metadata?: Record<string, unknown>) => {
    try {
      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "delivery_driver",
        entityType: "driver_contact",
        entityId: deliveryId || null,
        action: channel,
        metadata: metadata || {},
      });
    } catch {
      // sem impacto no fluxo
    }
  };

  const ensureDriverProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) return;
      const normalizedEmail = user.email.toLowerCase();
      const { data: linkedRows, error: linkError } = await (supabase as any)
        .from("delivery_drivers")
        .update({ user_id: user.id })
        .eq("email", normalizedEmail)
        .is("user_id", null)
        .select("id");
      if (linkError) throw linkError;
      if (Array.isArray(linkedRows) && linkedRows.length > 0) return;
      const fullName = String((user.user_metadata as any)?.full_name || user.email?.split("@")[0] || "Entregador");
      const phone = String((user.user_metadata as any)?.phone || "").trim() || "A confirmar";
      const { error: insertError } = await (supabase as any).from("delivery_drivers").insert({
        establishment_id: null,
        user_id: user.id,
        full_name: fullName,
        email: normalizedEmail,
        phone,
        vehicle_type: "moto",
        is_active: true,
        is_available: true,
        availability_mode: "offline",
        max_active_deliveries: 1,
        payout_per_delivery: 0,
      });
      if (insertError) throw insertError;
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
    if (!user || driverProfile || ensureDriverProfileMutation.isPending || hasAttemptedProfileSetup) return;
    setHasAttemptedProfileSetup(true);
    ensureDriverProfileMutation.mutate();
  }, [driverProfile, ensureDriverProfileMutation, hasAttemptedProfileSetup, user]);

  useEffect(() => {
    if (!driverProfile) return;
    setDriverAccountForm({
      fullName: String(driverProfile.full_name || ""),
      phone: String(driverProfile.phone || ""),
      vehicleType: String(driverProfile.vehicle_type || "moto"),
      vehicleBrand: String((driverProfile as any).vehicle_brand || ""),
      vehicleModel: String((driverProfile as any).vehicle_model || ""),
      vehicleColor: String((driverProfile as any).vehicle_color || ""),
      licensePlate: String(driverProfile.license_plate || ""),
      vehicleNotes: String((driverProfile as any).vehicle_notes || ""),
      avatarUrl: String((driverProfile as any).avatar_url || ""),
    });
  }, [driverProfile]);

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

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
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
            name,
            whatsapp,
            delivery_operation_mode,
            accepts_marketplace_payments
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

  const { data: availableOffers = [], isLoading: loadingOffers } = useQuery({
    queryKey: ["driver-available-offers", driverProfile?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_available_driver_offers");
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverProfile?.id,
    refetchInterval: 8000,
  });

  const { data: deliveredPayouts = [] } = useQuery({
    queryKey: ["driver-wallet", driverProfile?.id],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, payout_amount, payout_status, payout_paid_at, delivered_at, order_id")
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
  const filteredVisibleDeliveries = useMemo(() => {
    const term = deliverySearch.trim().toLowerCase();
    return (visibleDeliveries as any[]).filter((delivery: any) => {
      const order = delivery.orders;
      const store = delivery.establishments;
      if (deliveryStatusFilter !== "all" && delivery.status !== deliveryStatusFilter) return false;
      if (!term) return true;
      return (
        String(order?.customer_name || "").toLowerCase().includes(term) ||
        String(order?.customer_phone || "").toLowerCase().includes(term) ||
        String(store?.name || "").toLowerCase().includes(term) ||
        String(delivery.id || "").toLowerCase().includes(term)
      );
    });
  }, [deliverySearch, deliveryStatusFilter, visibleDeliveries]);

  const offerDeliveries = useMemo(
    () => (filteredVisibleDeliveries as any[]).filter((delivery: any) => delivery.status === "assigned"),
    [filteredVisibleDeliveries]
  );

  const liveRouteDeliveries = useMemo(
    () => (filteredVisibleDeliveries as any[]).filter((delivery: any) => ["accepted", "picked_up"].includes(delivery.status)),
    [filteredVisibleDeliveries]
  );

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
    const settled30d = (deliveredPayouts as any[])
      .filter((row) => row.payout_status === "paid")
      .reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const pending30d = (deliveredPayouts as any[])
      .filter((row) => row.payout_status !== "paid")
      .reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const total7d = (deliveredPayouts as any[])
      .filter((row) => new Date(row.delivered_at).getTime() >= weekCutoff)
      .reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const today = (deliveredPayouts as any[])
      .filter((row) => new Date(row.delivered_at).getTime() >= dayCutoff)
      .reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const pending = (visibleDeliveries as any[]).reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const totalCount30d = (deliveredPayouts as any[]).filter((row) => new Date(row.delivered_at).getTime() >= monthCutoff).length;
    const lastPaidAt = (deliveredPayouts as any[])
      .filter((row) => row.payout_status === "paid" && row.payout_paid_at)
      .sort((a, b) => new Date(b.payout_paid_at).getTime() - new Date(a.payout_paid_at).getTime())[0]?.payout_paid_at || null;

    return { today, total7d, total30d, settled30d, pending30d, pending, totalCount30d, lastPaidAt };
  }, [deliveredPayouts, visibleDeliveries]);

  const uploadDriverAvatar = async (file: File) => {
    if (!user?.id) throw new Error("Sessão do entregador não encontrada.");
    const extension = file.name.split(".").pop() || "jpg";
    const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const filePath = `${user.id}/avatar-${Date.now()}.${safeExt}`;

    const { error } = await supabase.storage.from("driver-images").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) throw error;

    const { data } = supabase.storage.from("driver-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

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
      toast.error("Seu aparelho não suporta geolocalização.");
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
        toast.error("Não foi possível capturar sua localização.");
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
      throw new Error("Código de confirmação inválido.");
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
    onError: (error: any) => toast.error(error.message || "Não foi possível atualizar seu status."),
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
          throw new Error("Para concluir e enviar prova de entrega, você precisa estar online.");
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
    onError: (error: any) => toast.error(error.message || "Não foi possível atualizar a entrega."),
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
    onError: (error: any) => toast.error(error.message || "Não foi possível registrar a ocorrência."),
  });

  const acceptOfferMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await (supabase as any).rpc("accept_driver_offer", { p_order_id: orderId });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["driver-available-offers", driverProfile?.id] });
      await queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      await queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Corrida aceita. Agora é só ir para a loja e tocar a rota.");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Essa corrida já saiu da base ou não está mais disponível.");
      void queryClient.invalidateQueries({ queryKey: ["driver-available-offers", driverProfile?.id] });
    },
  });

  const saveDriverAccountMutation = useMutation({
    mutationFn: async () => {
      if (!driverProfile?.id) throw new Error("Perfil do entregador ainda não está disponível.");
      if (!driverAccountForm.fullName.trim()) throw new Error("Preencha seu nome para salvar o perfil.");
      if (!driverAccountForm.phone.trim()) throw new Error("Preencha um telefone para contato.");

      const { error } = await (supabase as any)
        .from("delivery_drivers")
        .update({
          full_name: driverAccountForm.fullName.trim(),
          phone: driverAccountForm.phone.trim(),
          vehicle_type: driverAccountForm.vehicleType || "moto",
          vehicle_brand: driverAccountForm.vehicleBrand.trim() || null,
          vehicle_model: driverAccountForm.vehicleModel.trim() || null,
          vehicle_color: driverAccountForm.vehicleColor.trim() || null,
          license_plate: driverAccountForm.licensePlate.trim().toUpperCase() || null,
          vehicle_notes: driverAccountForm.vehicleNotes.trim() || null,
          avatar_url: driverAccountForm.avatarUrl.trim() || null,
        })
        .eq("id", driverProfile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["driver-profile", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["driver-deliveries", driverProfile?.id] });
      toast.success("Perfil do entregador atualizado.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou salvar seu perfil agora."),
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

  if (loadingProfile || (ensureDriverProfileMutation.isPending && !driverProfile)) {
    return <PageLoader label="Carregando painel do entregador..." className="min-h-[70vh]" />;
  }

  if (ensureDriverProfileMutation.isError && !driverProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <div className="w-full max-w-lg">
          <StateCard
            kind="error"
            title="Não foi possivel preparar seu acesso"
            description={String(ensureDriverProfileMutation.error instanceof Error ? ensureDriverProfileMutation.error.message : "Falha ao criar seu perfil de entregador.")}
          >
            <p className="text-sm text-muted-foreground">
              Se você ainda não aplicou a migration da base compartilhada, esse erro vai continuar aparecendo.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setHasAttemptedProfileSetup(false);
                ensureDriverProfileMutation.reset();
              }}
            >
              Tentar de novo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sair
            </Button>
          </StateCard>
        </div>
      </div>
    );
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
            title="Seu acesso ainda n?o ficou pronto"
            description="Tentamos preparar seu cadastro de entregador, mas essa etapa ainda n?o fechou."
          >
            <p className="text-sm text-muted-foreground">
              Recarregue a p?gina. Se continuar igual, a? sim vale acionar o suporte para revisar seu cadastro.
            </p>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Tentar de novo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sair
            </Button>
          </StateCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3efe6]">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-20 right-0 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(120deg,rgba(24,24,27,0.15)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <Card className={isOnline ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/10"}>
          <CardContent className="p-3 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-700" />}
              <span className="font-medium">
                {isOnline ? "Conexão ativa. Painel sincronizado em tempo real." : "Sem internet. O app está segurando os últimos dados deste aparelho."}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && <Badge variant="secondary">Modo offline</Badge>}
              {isSyncingQueue && <Badge variant="outline">Sincronizando...</Badge>}
              {offlineQueue.length > 0 && <Badge variant="secondary">{offlineQueue.length} pendente(s)</Badge>}
            </div>
          </CardContent>
        </Card>

        <section className="overflow-hidden rounded-[32px] border border-zinc-950/10 bg-[#111111] shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
          <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
                    <Bike className="h-3.5 w-3.5" />
                    Base do entregador
                  </div>
                  <div>
                    <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">Rua na mão, corrida bem amarrada.</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                      Painel pensado para rodar liso na rua: aceite rápido, rota clara, contato do cliente e baixa com PIN para não dar BO no fechamento.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                    <Link to="/">
                      Voltar ao início
                    </Link>
                  </Button>
                  <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair da conta
                  </Button>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Corridas vivas</p>
                  <p className="mt-3 text-3xl font-black text-white">{filteredVisibleDeliveries.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Tudo que está no seu radar agora.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Ofertas aguardando</p>
                  <p className="mt-3 text-3xl font-black text-white">{offerDeliveries.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Corridas esperando seu aceite.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Em rota</p>
                  <p className="mt-3 text-3xl font-black text-white">{liveRouteDeliveries.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Corridas já assumidas ou saídas para entrega.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Modo</p>
                  <p className="mt-3 text-3xl font-black text-white">{modeLabels[driverProfile.availability_mode] || driverProfile.availability_mode}</p>
                  <p className="mt-2 text-sm text-zinc-400">Como a base te enxerga neste momento.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 md:p-8 xl:border-l xl:border-t-0">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Perfil na pista</p>
                <div className="mt-4 flex items-center gap-4">
                  {(driverProfile as any).avatar_url ? (
                    <img
                      src={String((driverProfile as any).avatar_url)}
                      alt={driverProfile.full_name}
                      className="h-16 w-16 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <Bike className="h-7 w-7 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{driverProfile.full_name}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {[driverProfile.vehicle_type, (driverProfile as any).vehicle_brand, (driverProfile as any).vehicle_model]
                        .filter(Boolean)
                        .join(" • ") || "Complete o perfil do veículo no Minha conta"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {[driverProfile.phone || "Contato a confirmar", (driverProfile as any).vehicle_color, driverProfile.license_plate]
                    .filter(Boolean)
                    .join(" • ")}
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Contato</p>
                    <p className="mt-2 text-base font-bold">{driverProfile.phone || "A confirmar"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Capacidade</p>
                    <p className="mt-2 text-base font-bold">{driverProfile.max_active_deliveries} simultâneas</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button size="sm" className="bg-white text-zinc-950 hover:bg-zinc-200" onClick={() => updateAvailabilityMutation.mutate("online")}>Ficar online</Button>
                  <Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => updateAvailabilityMutation.mutate("paused")}>Entrar em pausa</Button>
                  <Button size="sm" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => updateAvailabilityMutation.mutate("offline")}>Ficar offline</Button>
                </div>

                <div className="mt-6 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-white" />
                  <span>Entrega baixa com PIN e prova para evitar finalização errada.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader className="border-b border-zinc-950/10 bg-[#faf7f2]">
            <CardTitle className="text-xl font-black tracking-tight text-zinc-950">Minha conta</CardTitle>
            <CardDescription className="text-zinc-600">
              Deixa seu perfil redondo para a loja e para o cliente saberem quem está levando a corrida.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-5 lg:grid-cols-[280px_1fr]">
            <div className="rounded-[24px] border border-zinc-200 bg-[#111111] p-5 text-white">
              <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                {driverAccountForm.avatarUrl ? (
                  <img src={driverAccountForm.avatarUrl} alt={driverAccountForm.fullName || "Foto do entregador"} className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-zinc-500" />
                )}
              </div>
              <p className="mt-4 text-center text-lg font-black">{driverAccountForm.fullName || "Seu nome na pista"}</p>
              <p className="mt-1 text-center text-sm text-zinc-400">
                {[driverAccountForm.vehicleType, driverAccountForm.vehicleBrand, driverAccountForm.vehicleModel].filter(Boolean).join(" • ") || "Veículo ainda não detalhado"}
              </p>
              <div className="mt-5 space-y-3 text-sm text-zinc-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Placa</p>
                  <p className="mt-1 font-semibold">{driverAccountForm.licensePlate || "Não informada"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Cor</p>
                  <p className="mt-1 font-semibold">{driverAccountForm.vehicleColor || "Não informada"}</p>
                </div>
              </div>
              <div className="mt-5">
                <Label htmlFor="driver-avatar" className="text-zinc-300">Foto do entregador</Label>
                <Input
                  id="driver-avatar"
                  type="file"
                  accept="image/*"
                  className="mt-2 border-white/10 bg-white/5 text-white file:text-white"
                  disabled={uploadingAvatar}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingAvatar(true);
                      const publicUrl = await uploadDriverAvatar(file);
                      setDriverAccountForm((prev) => ({ ...prev, avatarUrl: publicUrl }));
                      toast.success("Foto carregada. Agora é só salvar o perfil.");
                    } catch (error: any) {
                      toast.error(error?.message || "Não rolou subir sua foto.");
                    } finally {
                      setUploadingAvatar(false);
                      event.currentTarget.value = "";
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="driver-full-name">Nome que vai aparecer</Label>
                  <Input
                    id="driver-full-name"
                    value={driverAccountForm.fullName}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="driver-phone">Telefone</Label>
                  <Input
                    id="driver-phone"
                    value={driverAccountForm.phone}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="WhatsApp para contato"
                  />
                </div>
                <div>
                  <Label htmlFor="driver-vehicle-type">Tipo de veículo</Label>
                  <select
                    id="driver-vehicle-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={driverAccountForm.vehicleType}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, vehicleType: event.target.value }))}
                  >
                    <option value="moto">Moto</option>
                    <option value="bike">Bike</option>
                    <option value="carro">Carro</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="driver-license-plate">Placa</Label>
                  <Input
                    id="driver-license-plate"
                    value={driverAccountForm.licensePlate}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, licensePlate: event.target.value.toUpperCase() }))}
                    placeholder="ABC1D23"
                  />
                </div>
                <div>
                  <Label htmlFor="driver-vehicle-brand">Marca</Label>
                  <Input
                    id="driver-vehicle-brand"
                    value={driverAccountForm.vehicleBrand}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, vehicleBrand: event.target.value }))}
                    placeholder="Honda, Yamaha, Fiat..."
                  />
                </div>
                <div>
                  <Label htmlFor="driver-vehicle-model">Modelo</Label>
                  <Input
                    id="driver-vehicle-model"
                    value={driverAccountForm.vehicleModel}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, vehicleModel: event.target.value }))}
                    placeholder="CG 160, Biz, Onix..."
                  />
                </div>
                <div>
                  <Label htmlFor="driver-vehicle-color">Cor</Label>
                  <Input
                    id="driver-vehicle-color"
                    value={driverAccountForm.vehicleColor}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, vehicleColor: event.target.value }))}
                    placeholder="Preta, branca, vermelha..."
                  />
                </div>
                <div>
                  <Label htmlFor="driver-avatar-url">Link da foto</Label>
                  <Input
                    id="driver-avatar-url"
                    value={driverAccountForm.avatarUrl}
                    onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                    placeholder="Se quiser colar uma URL manual"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="driver-vehicle-notes">Detalhes extras</Label>
                <Input
                  id="driver-vehicle-notes"
                  value={driverAccountForm.vehicleNotes}
                  onChange={(event) => setDriverAccountForm((prev) => ({ ...prev, vehicleNotes: event.target.value }))}
                  placeholder="Ex.: baú grande, moto econômica, atende noite..."
                />
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-[#faf7f2] p-4 text-sm text-zinc-700">
                Essas infos aparecem para a operação da loja e no rastreio do cliente. O básico que realmente ajuda é: nome, tipo de veículo, modelo, cor e placa.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveDriverAccountMutation.mutate()} disabled={saveDriverAccountMutation.isPending || uploadingAvatar}>
                  {saveDriverAccountMutation.isPending ? "Salvando perfil..." : "Salvar meu perfil"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setDriverAccountForm({
                      fullName: String(driverProfile.full_name || ""),
                      phone: String(driverProfile.phone || ""),
                      vehicleType: String(driverProfile.vehicle_type || "moto"),
                      vehicleBrand: String((driverProfile as any).vehicle_brand || ""),
                      vehicleModel: String((driverProfile as any).vehicle_model || ""),
                      vehicleColor: String((driverProfile as any).vehicle_color || ""),
                      licensePlate: String(driverProfile.license_plate || ""),
                      vehicleNotes: String((driverProfile as any).vehicle_notes || ""),
                      avatarUrl: String((driverProfile as any).avatar_url || ""),
                    })
                  }
                >
                  Voltar para o salvo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader className="border-b border-zinc-950/10 bg-[#faf7f2]">
            <CardTitle className="text-xl font-black tracking-tight text-zinc-950">Corridas disponíveis</CardTitle>
            <CardDescription className="text-zinc-600">
              Quando a base solta uma corrida sem dono, ela cai aqui para você puxar direto no painel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {loadingOffers ? (
              <p className="text-sm text-muted-foreground">Buscando ofertas da base...</p>
            ) : (availableOffers as any[]).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-[#faf7f2] p-4 text-sm text-zinc-600">
                Nenhuma corrida aberta na base agora. Quando entrar uma disponível, ela aparece aqui com loja, cliente, valor e atalho para aceitar.
              </div>
            ) : (
              (availableOffers as any[]).map((offer: any) => (
                <div key={offer.order_id} className="rounded-[24px] border border-zinc-200 bg-[#fcfbf8] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{offer.establishment_name}</p>
                      <h3 className="mt-1 text-lg font-black text-zinc-950">{offer.customer_name}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{offer.customer_phone}</p>
                    </div>
                    <Badge variant="secondary">
                      {offer.order_status === "ready" ? "Pronto para retirada" : offer.order_status === "in_preparation" ? "Em preparo" : "Confirmado"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border bg-white p-3">
                      <p className="text-xs text-muted-foreground">Payout</p>
                      <p className="font-bold">{formatCurrency(Number(offer.payout_amount || 0))}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-3">
                      <p className="text-xs text-muted-foreground">ETA da rota</p>
                      <p className="font-bold">{offer.eta_minutes ? `${offer.eta_minutes} min` : "A definir"}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-3 md:col-span-2">
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="font-bold">{buildAddress(offer) || "Endereço saindo do pedido"}</p>
                      {offer.delivery_reference && <p className="mt-1 text-xs text-muted-foreground">Referência: {offer.delivery_reference}</p>}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => acceptOfferMutation.mutate(String(offer.order_id))} disabled={acceptOfferMutation.isPending}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {acceptOfferMutation.isPending ? "Puxando corrida..." : "Aceitar corrida"}
                    </Button>
                    <a href={buildMapsUrl(offer)} target="_blank" rel="noreferrer">
                      <Button variant="outline">
                        <Route className="mr-2 h-4 w-4" />
                        Ver no Maps
                      </Button>
                    </a>
                    <a href={buildCustomerWhatsAppUrl(offer, { name: offer.establishment_name })} target="_blank" rel="noreferrer">
                      <Button variant="outline">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp do cliente
                      </Button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader className="border-b border-zinc-950/10 bg-[#faf7f2]">
            <CardTitle className="text-xl font-black tracking-tight text-zinc-950">Carteira do entregador</CardTitle>
            <CardDescription className="text-zinc-600">O que entrou, o que está pendente e o que ainda está girando na rua.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Hoje</p>
                <p className="font-bold">{formatCurrency(walletSummary.today)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                <p className="font-bold">{formatCurrency(walletSummary.total7d)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                <p className="font-bold">{formatCurrency(walletSummary.total30d)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Já pago</p>
                <p className="font-bold">{formatCurrency(walletSummary.settled30d)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="font-bold">{formatCurrency(walletSummary.pending30d)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Em rota agora</p>
                <p className="font-bold">{formatCurrency(walletSummary.pending)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Entregas (30d)</p>
                <p className="font-bold">{walletSummary.totalCount30d}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Último repasse identificado</p>
                <p className="font-bold">
                  {walletSummary.lastPaidAt ? formatDate(walletSummary.lastPaidAt) : "Ainda não caiu nenhum repasse marcado"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-zinc-950/10 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <CardHeader className="border-b border-zinc-950/10 bg-[#faf7f2]">
            <CardTitle className="text-xl font-black tracking-tight text-zinc-950">Corridas na mão</CardTitle>
            <CardDescription className="text-zinc-600">Aceite, rota, contato e prova de entrega no mesmo fluxo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 md:p-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-[#faf7f2] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Aguardando aceite</p>
                <p className="mt-2 text-2xl font-black text-zinc-950">{offerDeliveries.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Em rota</p>
                <p className="mt-2 text-2xl font-black text-zinc-950">{liveRouteDeliveries.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Fila offline</p>
                <p className="mt-2 text-2xl font-black text-zinc-950">{offlineQueue.length}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input
                placeholder="Buscar por loja, cliente ou telefone..."
                value={deliverySearch}
                onChange={(event) => setDeliverySearch(event.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={deliveryStatusFilter}
                onChange={(event) => setDeliveryStatusFilter(event.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="assigned">Aguardando aceite</option>
                <option value="accepted">Aceitas</option>
                <option value="picked_up">Saiu para entrega</option>
              </select>
            </div>
            {isDeliveriesError ? (
              <StateCard
                kind="error"
                title="Falha ao carregar corridas"
                description="A conexão oscilou. Atualize para puxar as entregas novamente."
                actionLabel="Recarregar"
                action={() => window.location.reload()}
              />
            ) : filteredVisibleDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem corridas ativas no momento.</p>
            ) : (
              filteredVisibleDeliveries.map((delivery: any) => {
                const order = delivery.orders;
                const store = delivery.establishments;
                const address = buildAddress(order);
                const issueDraft = issueDraftByDelivery[delivery.id] || "";
                const acceptedDeadlineAt = delivery.accepted_deadline_at ? new Date(delivery.accepted_deadline_at).getTime() : null;
                const acceptSecondsLeft = acceptedDeadlineAt ? Math.max(0, Math.ceil((acceptedDeadlineAt - clockNow) / 1000)) : 0;

                return (
                  <div key={delivery.id} className="rounded-[28px] border border-zinc-200 bg-[#fcfaf5] p-4 shadow-[0_16px_48px_rgba(15,23,42,0.06)] md:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold">{store?.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(delivery.assigned_at)}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{deliveryStatusLabels[delivery.status] || delivery.status}</Badge>
                        {delivery.accepted_deadline_at && delivery.status === "assigned" && (
                          <Badge variant="outline">Aceite até {formatDate(delivery.accepted_deadline_at)}</Badge>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs text-muted-foreground">Payout previsto</p>
                        <p className="text-lg font-bold">{formatCurrency(Number(delivery.payout_amount || 0))}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs text-muted-foreground">Modo da corrida</p>
                        <p className="text-sm font-semibold">{getDeliveryOperationCopy(store?.delivery_operation_mode)}</p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs text-muted-foreground">Janela de aceite</p>
                        <p className="text-lg font-bold">{delivery.status === "assigned" ? `${acceptSecondsLeft}s` : "Aceita"}</p>
                      </div>
                    </div>

                    {store?.accepts_marketplace_payments ? (
                      <div className="rounded-2xl border border-sky-300/50 bg-sky-100/70 p-4 text-sky-950">
                        <p className="text-xs uppercase tracking-wider text-zinc-400">Pedido vindo da plataforma</p>
                        <p className="text-sm text-zinc-300 mt-1">
                          Pagamento digital já entrou na operação da loja. Sua parte aqui é aceitar, retirar e concluir com prova.
                        </p>
                      </div>
                    ) : null}

                    {["accepted", "picked_up"].includes(delivery.status) ? (
                      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Rota da corrida</p>
                        <p className="mt-2 text-sm leading-6 text-emerald-950">
                          Corrida aceita. Abre a navegação por aqui e segue direto para o endereço do cliente.
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <a href={buildMapsUrl(order)} target="_blank" rel="noreferrer">
                            <Button className="w-full bg-zinc-950 text-white hover:bg-zinc-800" size="sm">
                              <Route className="mr-2 h-4 w-4" />
                              Abrir no Google Maps
                            </Button>
                          </a>
                          <a href={buildWazeUrl(order)} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="w-full" size="sm">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir no Waze
                            </Button>
                          </a>
                          <a
                            href={`tel:${String(order?.customer_phone || "").replace(/\D/g, "")}`}
                            onClick={() => void logContactClick("phone_customer", delivery.id, { orderId: order?.id, customerPhone: order?.customer_phone })}
                          >
                            <Button variant="outline" className="w-full" size="sm">
                              <Phone className="mr-2 h-4 w-4" />
                              Ligar para cliente
                            </Button>
                          </a>
                          <a
                            href={buildCustomerWhatsAppUrl(order, store)}
                            target="_blank"
                            rel="noreferrer"
                            className="sm:col-span-3"
                            onClick={() => void logContactClick("whatsapp_customer", delivery.id, { orderId: order?.id, customerPhone: order?.customer_phone })}
                          >
                            <Button variant="outline" className="w-full" size="sm">
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Chamar no WhatsApp
                            </Button>
                          </a>
                          {store?.whatsapp && (
                            <a
                              href={buildStoreWhatsAppUrl(store, order)}
                              target="_blank"
                              rel="noreferrer"
                              className="sm:col-span-3"
                              onClick={() => void logContactClick("whatsapp_store", delivery.id, { orderId: order?.id, storeId: store?.id })}
                            >
                              <Button variant="outline" className="w-full" size="sm">
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Falar com a loja
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <a href={buildMapsUrl(order)} target="_blank" rel="noreferrer">
                          <Button variant="outline" className="w-full" size="sm">
                            <Route className="mr-2 h-4 w-4" />
                            Ver no Google Maps
                          </Button>
                        </a>
                        <a href={buildWazeUrl(order)} target="_blank" rel="noreferrer">
                          <Button variant="outline" className="w-full" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ver no Waze
                          </Button>
                        </a>
                        <a
                          href={`tel:${String(order?.customer_phone || "").replace(/\D/g, "")}`}
                          onClick={() => void logContactClick("phone_customer", delivery.id, { orderId: order?.id, customerPhone: order?.customer_phone })}
                        >
                          <Button variant="outline" className="w-full" size="sm">
                            <Phone className="mr-2 h-4 w-4" />
                            Ligar para cliente
                          </Button>
                        </a>
                        <a
                          href={buildCustomerWhatsAppUrl(order, store)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => void logContactClick("whatsapp_customer", delivery.id, { orderId: order?.id, customerPhone: order?.customer_phone })}
                        >
                          <Button variant="outline" className="w-full" size="sm">
                            <MessageCircle className="mr-2 h-4 w-4" />
                            WhatsApp
                          </Button>
                        </a>
                        {store?.whatsapp && (
                          <a
                            href={buildStoreWhatsAppUrl(store, order)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => void logContactClick("whatsapp_store", delivery.id, { orderId: order?.id, storeId: store?.id })}
                          >
                            <Button variant="outline" className="w-full" size="sm">
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Loja
                            </Button>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-sm text-zinc-100">
                      <p className="text-xs text-muted-foreground">Acompanhamento do cliente</p>
                      <Link className="font-medium text-primary hover:underline break-all" to={`/acompanhar/${delivery.tracking_token}`}>
                        {window.location.origin}/acompanhar/{delivery.tracking_token}
                      </Link>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-muted-foreground">Ocorrências da rota</p>
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
                            const customIssue = window.prompt("Descreva a ocorrência da rota:");
                            if (!customIssue?.trim()) return;
                            setIssueDraftByDelivery((prev) => ({ ...prev, [delivery.id]: customIssue.trim() }));
                          }}
                        >
                          Outra ocorrência
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
                          Salvar ocorrência
                        </Button>
                        {delivery.issue_reason && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={reportIssueMutation.isPending}
                            onClick={() => reportIssueMutation.mutate({ deliveryId: delivery.id, issueReason: "" })}
                          >
                            Limpar ocorrência
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
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={reportIssueMutation.isPending}
                          onClick={() => {
                            const reason = window.prompt("O que aconteceu nessa entrega? Ex.: cliente ausente, endereço errado...");
                            if (!reason?.trim()) return;
                            reportIssueMutation.mutate({
                              deliveryId: delivery.id,
                              issueReason: `[Tentativa sem sucesso] ${reason.trim()}`,
                            });
                          }}
                        >
                          Não consegui entregar
                        </Button>
                      )}

                      {["accepted", "picked_up"].includes(delivery.status) && (
                        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-4 space-y-2">
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
                              {capturingGeoByDelivery[delivery.id] ? "Capturando localização..." : "Capturar localização"}
                            </Button>
                            {geoByDelivery[delivery.id] && (
                              <p className={`text-xs ${geoByDelivery[delivery.id]!.accuracy > MIN_GEO_ACCURACY_METERS ? "text-destructive" : "text-muted-foreground"}`}>
                                GPS: precisão {Math.round(geoByDelivery[delivery.id]!.accuracy)}m
                              </p>
                            )}
                          </div>
                          <Input
                            placeholder="Justificativa sem GPS (obrigatória se GPS falhar)"
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











