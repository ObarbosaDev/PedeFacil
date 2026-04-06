import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/formatters";
import { logAuditEvent } from "@/lib/observability";
import { buildWhatsAppSupportLink } from "@/lib/support";
import { toast } from "sonner";

const statusFlow = ["received", "confirmed", "in_preparation", "ready", "delivered"];
const kanbanColumns = ["received", "confirmed", "in_preparation", "ready", "delivered"];
const pageSize = 50;
const orderStatusFilterOptions = [
  { value: "all", label: "Todos os status" },
  { value: "received", label: "Recebidos" },
  { value: "confirmed", label: "Confirmados" },
  { value: "in_preparation", label: "Em preparo" },
  { value: "ready", label: "Prontos" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
] as const;

const defaultSlaByStatus: Record<string, number> = {
  received: 5,
  confirmed: 10,
  in_preparation: 25,
  ready: 10,
  delivered: 0,
};

const statusTone: Record<string, string> = {
  received: "border-l-blue-400",
  confirmed: "border-l-amber-400",
  in_preparation: "border-l-orange-500",
  ready: "border-l-emerald-500",
  delivered: "border-l-zinc-400",
};

const quickStatusActions: Record<string, { label: string; next: string }[]> = {
  received: [{ label: "Confirmar", next: "confirmed" }],
  confirmed: [
    { label: "Iniciar preparo", next: "in_preparation" },
    { label: "Marcar pronto", next: "ready" },
  ],
  in_preparation: [{ label: "Marcar pronto", next: "ready" }],
  ready: [{ label: "Concluir", next: "delivered" }],
  delivered: [],
};

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers.map(escapeCsv).join(";"), ...rows.map((row) => row.map(escapeCsv).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCustomerWhatsAppUrl(phone: string, customerName?: string) {
  const sanitized = String(phone || "").replace(/\D/g, "");
  const withCountryCode = sanitized.startsWith("55") ? sanitized : `55${sanitized}`;
  const message = encodeURIComponent(
    `Oi${customerName ? `, ${customerName}` : ""}. Aqui é da operação da Pede Fácil. Estamos falando sobre o seu pedido.`
  );
  return `https://wa.me/${withCountryCode}?text=${message}`;
}

function getSlaColumnTone(lateRatio: number) {
  if (lateRatio >= 0.4) {
    return {
      dot: "bg-red-500",
      badgeVariant: "destructive" as const,
      label: "Crítico",
    };
  }
  if (lateRatio >= 0.15) {
    return {
      dot: "bg-amber-500",
      badgeVariant: "secondary" as const,
      label: "Atenção",
    };
  }
  return {
    dot: "bg-emerald-500",
    badgeVariant: "outline" as const,
    label: "No ritmo",
  };
}

function playNewOrderSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.18);

    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.22);
  } catch {
    // fallback silencioso
  }
}

function playSlaAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(410, audioCtx.currentTime + 0.24);

    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.28);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } catch {
    // fallback silencioso
  }
}

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [selectedDriverByOrder, setSelectedDriverByOrder] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const hasBootstrappedOrders = useRef(false);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const autoRedispatchingOrderIds = useRef<Set<string>>(new Set());
  const previousLateCount = useRef(0);
  const invalidateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, orderTypeFilter, paymentMethodFilter, statusFilter, driverFilter]);

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const canUseSharedFleet = useMemo(() => {
    const mode = String((establishment as any)?.delivery_operation_mode || "own_fleet");
    return mode === "shared_fleet" || mode === "hybrid";
  }, [establishment]);

  const { data: slaSettings } = useQuery({
    queryKey: ["establishment-sla-settings", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishment_sla_settings")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!establishment,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: deliveryDrivers = [] } = useQuery({
    queryKey: ["delivery-drivers", establishment?.id, canUseSharedFleet],
    queryFn: async () => {
      let query = (supabase as any)
        .from("delivery_drivers")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      query = canUseSharedFleet
        ? query.or(`establishment_id.eq.${establishment!.id},establishment_id.is.null`)
        : query.eq("establishment_id", establishment!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const { data: driverReputationRows = [] } = useQuery({
    queryKey: ["driver-reputation-metrics", establishment?.id, canUseSharedFleet],
    queryFn: async () => {
      let query = (supabase as any).from("driver_reputation_metrics").select("*");
      query = canUseSharedFleet
        ? query.or(`establishment_id.eq.${establishment!.id},establishment_id.is.null`)
        : query.eq("establishment_id", establishment!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", establishment?.id, searchTerm, orderTypeFilter, page],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("orders")
        .select("*, order_items(*)", { count: "exact" })
        .eq("establishment_id", establishment!.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (orderTypeFilter !== "all") {
        query = query.eq("order_type", orderTypeFilter);
      }

      const search = searchTerm.trim();
      if (search) {
        const safeSearch = search.replace(/,/g, " ");
        query = query.or(`customer_name.ilike.%${safeSearch}%,customer_phone.ilike.%${safeSearch}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { rows: data || [], count: count || 0 };
    },
    enabled: !!establishment,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const orders = ordersQuery.data?.rows || [];
  const totalCount = ordersQuery.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!establishment?.id) return;

    const scheduleRealtimeInvalidation = () => {
      if (invalidateTimerRef.current) return;
      invalidateTimerRef.current = window.setTimeout(() => {
        invalidateTimerRef.current = null;
        queryClient.invalidateQueries({ queryKey: ["orders", establishment.id] });
        queryClient.invalidateQueries({ queryKey: ["order-history", establishment.id] });
        queryClient.invalidateQueries({ queryKey: ["order-deliveries", establishment.id] });
        queryClient.invalidateQueries({ queryKey: ["delivery-drivers", establishment.id] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-orders", establishment.id] });
      }, 350);
    };

    const channel = supabase
      .channel(`orders-realtime-${establishment.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishment.id}`,
        },
        (payload: any) => {
          scheduleRealtimeInvalidation();

          if (payload.eventType === "INSERT") {
            const newest = payload.new;
            if (newest) {
              toast.success(`Novo pedido de ${newest.customer_name}!`);
              playNewOrderSound();

              if ("Notification" in window) {
                if (Notification.permission === "granted") {
                  new Notification("Novo pedido recebido", {
                    body: `${newest.customer_name} - ${formatCurrency(Number(newest.total || 0))}`,
                  });
                } else if (Notification.permission === "default") {
                  void Notification.requestPermission();
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (invalidateTimerRef.current) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [establishment?.id, queryClient]);

  useEffect(() => {
    const currentIds = new Set(orders.map((order: any) => order.id));

    if (!hasBootstrappedOrders.current) {
      knownOrderIds.current = currentIds;
      hasBootstrappedOrders.current = true;
      return;
    }

    knownOrderIds.current = currentIds;
  }, [orders]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const currentOrder = orders.find((order: any) => order.id === id);
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "store_owner",
        entityType: "order",
        entityId: id,
        action: "order_status_updated",
        metadata: {
          establishmentId: establishment?.id ?? null,
          previousStatus: currentOrder?.status ?? null,
          nextStatus: status,
          orderTotal: Number(currentOrder?.total ?? 0),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", establishment?.id] });
      queryClient.invalidateQueries({ queryKey: ["order-history", establishment?.id] });
      toast.success("Status atualizado!");
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await (supabase as any)
        .from("orders")
        .update({
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", establishment?.id] });
      queryClient.invalidateQueries({ queryKey: ["order-history", establishment?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-orders", establishment?.id] });
      toast.success("Pagamento confirmado no pedido.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou confirmar o pagamento."),
  });

  const dispatchDelivery = useMutation({
    mutationFn: async ({ orderId, driverId }: { orderId: string; driverId: string }) => {
      const selectedDriver = (deliveryDrivers as any[]).find((driver) => driver.id === driverId);
      const dispatchTimeoutSeconds = Math.min(
        300,
        Math.max(15, Number((establishment as any)?.dispatch_timeout_seconds || 30))
      );
      const defaultDriverPayout = Math.max(0, Number((establishment as any)?.default_driver_payout || 0));
      const { data: currentDelivery, error: currentDeliveryError } = await (supabase as any)
        .from("order_deliveries")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (currentDeliveryError) throw currentDeliveryError;

      const trackingToken = currentDelivery?.tracking_token || crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const confirmationCode = currentDelivery?.confirmation_code || String(Math.floor(Math.random() * 10000)).padStart(4, "0");

      const { error } = await (supabase as any).from("order_deliveries").upsert(
        {
          order_id: orderId,
          establishment_id: establishment!.id,
          driver_id: driverId,
          status: "assigned",
          assigned_at: new Date().toISOString(),
          accepted_deadline_at: new Date(Date.now() + dispatchTimeoutSeconds * 1000).toISOString(),
          tracking_token: trackingToken,
          confirmation_code: confirmationCode,
          payout_amount: Number(selectedDriver?.payout_per_delivery || defaultDriverPayout),
          eta_minutes: 35,
          accepted_at: null,
          arrived_at_store_at: null,
          picked_up_at: null,
          delivered_at: null,
          cancelled_at: null,
        },
        { onConflict: "order_id" }
      );
      if (error) throw error;

      if (currentDelivery?.driver_id && currentDelivery.driver_id !== driverId) {
        const { count: previousDriverActiveCount, error: previousDriverActiveCountError } = await (supabase as any)
          .from("order_deliveries")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", currentDelivery.driver_id)
          .eq("establishment_id", establishment!.id)
          .in("status", ["assigned", "accepted", "picked_up"])
          .neq("order_id", orderId);
        if (previousDriverActiveCountError) throw previousDriverActiveCountError;

        await (supabase as any)
          .from("delivery_drivers")
          .update({
            is_available: (previousDriverActiveCount || 0) === 0,
            availability_mode: (previousDriverActiveCount || 0) === 0 ? "online" : "busy",
          })
          .eq("id", currentDelivery.driver_id);
      }

      await (supabase as any)
        .from("delivery_drivers")
        .update({
          is_available: false,
          availability_mode: "busy",
        })
        .eq("id", driverId);

      await logAuditEvent({
        actorUserId: user?.id ?? null,
        actorRole: "store_owner",
        entityType: "order_delivery",
        entityId: orderId,
        action: "delivery_dispatched",
        metadata: {
          establishmentId: establishment?.id ?? null,
          orderId,
          driverId,
          driverName: selectedDriver?.full_name || null,
          confirmationCode,
          trackingToken,
          previousDriverId: currentDelivery?.driver_id || null,
          redispatched: Boolean(currentDelivery),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-drivers", establishment?.id] });
      toast.success("Entrega despachada.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou despachar agora."),
  });

  const orderIds = useMemo(() => orders.map((order: any) => order.id), [orders]);

  const { data: orderDeliveries = [] } = useQuery({
    queryKey: ["order-deliveries", establishment?.id, orderIds.join(",")],
    queryFn: async () => {
      if (!orderIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select(`
          *,
          delivery_drivers:driver_id (
            id,
            full_name,
            phone,
            is_available,
            vehicle_type,
            vehicle_brand,
            vehicle_model,
            vehicle_color,
            license_plate,
            avatar_url
          )
        `)
        .eq("establishment_id", establishment!.id)
        .in("order_id", orderIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment && orderIds.length > 0,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const { data: historyRows = [] } = useQuery({
    queryKey: ["order-history", establishment?.id, orderIds.join(",")],
    queryFn: async () => {
      if (!orderIds.length) return [];

      const { data, error } = await (supabase as any)
        .from("order_status_history")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .in("order_id", orderIds)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment && orderIds.length > 0,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const historyByOrder = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const row of historyRows as any[]) {
      if (!grouped[row.order_id]) grouped[row.order_id] = [];
      grouped[row.order_id].push(row);
    }
    return grouped;
  }, [historyRows]);

  const deliveryByOrderId = useMemo(() => {
    const map: Record<string, any> = {};
    for (const delivery of orderDeliveries as any[]) {
      map[delivery.order_id] = delivery;
    }
    return map;
  }, [orderDeliveries]);

  const activeDeliveriesByDriver = useMemo(() => {
    const map: Record<string, number> = {};
    for (const delivery of orderDeliveries as any[]) {
      if (!["assigned", "accepted", "picked_up"].includes(delivery.status)) continue;
      map[delivery.driver_id] = (map[delivery.driver_id] || 0) + 1;
    }
    return map;
  }, [orderDeliveries]);

  const driverReputationById = useMemo(() => {
    return (driverReputationRows as any[]).reduce<Record<string, any>>((acc, row: any) => {
      acc[row.driver_id] = row;
      return acc;
    }, {});
  }, [driverReputationRows]);

  const localDispatchDrivers = useMemo(() => {
    return (deliveryDrivers as any[]).filter((driver) => driver.establishment_id === establishment?.id);
  }, [deliveryDrivers, establishment?.id]);

  const scoreDriverForDispatch = (driver: any, currentAssignedDriverId?: string | null) => {
    const load = activeDeliveriesByDriver[driver.id] || 0;
    const reputation = driverReputationById[driver.id];
    const avgRating = Number(reputation?.avg_rating || 0);
    const completed = Number(reputation?.deliveries_completed || 0);
    const lateAcceptances = Number(reputation?.late_acceptances || 0);
    const isSharedDriver = !driver.establishment_id;
    const isCurrentDriver = !!currentAssignedDriverId && driver.id === currentAssignedDriverId;

    let score = 0;
    score += driver.availability_mode === "online" ? 500 : driver.availability_mode === "busy" ? 150 : -500;
    score -= load * 120;
    score += Math.min(completed, 60) * 3;
    score += avgRating * 30;
    score -= lateAcceptances * 18;
    score += isSharedDriver ? (String((establishment as any)?.delivery_operation_mode || "") === "shared_fleet" ? 35 : -10) : 40;
    if (isCurrentDriver) score -= 1000;

    return score;
  };

  const getBestDispatchDriver = (currentAssignedDriverId?: string | null, sourceDrivers?: any[]) => {
    const ranked = [...(sourceDrivers || (deliveryDrivers as any[]))]
      .filter((driver) => {
        if (!driver.is_active) return false;
        if (!["online", "busy"].includes(driver.availability_mode || "")) return false;
        const load = activeDeliveriesByDriver[driver.id] || 0;
        const capacity = Number(driver.max_active_deliveries || 1);
        return load < capacity;
      })
      .map((driver) => ({
        ...driver,
        dispatchScore: scoreDriverForDispatch(driver, currentAssignedDriverId),
      }))
      .sort((a, b) => b.dispatchScore - a.dispatchScore);

    return ranked[0] || null;
  };

  useEffect(() => {
    if (!establishment?.id || !(orderDeliveries as any[]).length || !(deliveryDrivers as any[]).length) return;
    if ((establishment as any)?.auto_dispatch_enabled === false) return;

    const expiredAssignedDeliveries = (orderDeliveries as any[]).filter((delivery) => {
      if (delivery.status !== "assigned" || !delivery.accepted_deadline_at) return false;
      return new Date(delivery.accepted_deadline_at).getTime() < Date.now();
    });

    if (!expiredAssignedDeliveries.length) return;

    const run = async () => {
      for (const delivery of expiredAssignedDeliveries) {
        if (autoRedispatchingOrderIds.current.has(delivery.order_id)) continue;

        const bestDriver = getBestDispatchDriver(delivery.driver_id, localDispatchDrivers);
        if (!bestDriver) continue;

        autoRedispatchingOrderIds.current.add(delivery.order_id);

        try {
          await dispatchDelivery.mutateAsync({ orderId: delivery.order_id, driverId: bestDriver.id });
          toast.info(`Rota redespachada automaticamente para ${bestDriver.full_name}.`);
        } catch {
          // erro ja tratado na mutation
        } finally {
          autoRedispatchingOrderIds.current.delete(delivery.order_id);
        }
      }
    };

    void run();
  }, [dispatchDelivery, establishment?.id, orderDeliveries, localDispatchDrivers, activeDeliveriesByDriver, driverReputationById]);

  useEffect(() => {
    if (!establishment?.id || !(deliveryDrivers as any[]).length || !orders.length) return;
    if ((establishment as any)?.auto_dispatch_enabled === false) return;

    const ordersWithoutDispatch = orders.filter((order: any) => {
      if (order.order_type !== "delivery") return false;
      if (!["confirmed", "in_preparation", "ready"].includes(order.status)) return false;
      return !deliveryByOrderId[order.id];
    });

    if (!ordersWithoutDispatch.length) return;

    const run = async () => {
      for (const order of ordersWithoutDispatch) {
        if (autoRedispatchingOrderIds.current.has(order.id)) continue;

        const bestDriver = getBestDispatchDriver(undefined, localDispatchDrivers);
        if (!bestDriver) continue;

        autoRedispatchingOrderIds.current.add(order.id);
        try {
          await dispatchDelivery.mutateAsync({ orderId: order.id, driverId: bestDriver.id });
          toast.info(`Auto-despacho: ${order.customer_name} foi para ${bestDriver.full_name}.`);
        } catch {
          // erro ja tratado na mutation
        } finally {
          autoRedispatchingOrderIds.current.delete(order.id);
        }
      }
    };

    void run();
  }, [dispatchDelivery, establishment?.id, orders, deliveryByOrderId, localDispatchDrivers, activeDeliveriesByDriver, driverReputationById]);

  const slaByStatus = useMemo(() => ({
    received: Number(slaSettings?.received_minutes || defaultSlaByStatus.received),
    confirmed: Number(slaSettings?.confirmed_minutes || defaultSlaByStatus.confirmed),
    in_preparation: Number(slaSettings?.in_preparation_minutes || defaultSlaByStatus.in_preparation),
    ready: Number(slaSettings?.ready_minutes || defaultSlaByStatus.ready),
    delivered: 0,
  }), [slaSettings]);

  const getStatusStartedAt = (order: any) => {
    const currentStatus = order.status;
    if (currentStatus === "delivered" || currentStatus === "cancelled") return null;
    const history = (historyByOrder[order.id] || []) as any[];
    const match = history.find((event) => event.new_status === currentStatus);
    return new Date(match?.changed_at || order.created_at);
  };

  const getSlaInfo = (order: any) => {
    const status = order.status;
    if (status === "delivered" || status === "cancelled") return null;
    const limitMinutes = slaByStatus[status] || 0;
    if (!limitMinutes) return null;
    const startedAt = getStatusStartedAt(order);
    if (!startedAt) return null;
    const elapsedMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);
    const overtime = elapsedMinutes - limitMinutes;
    return { elapsedMinutes, limitMinutes, overtime, isLate: overtime > 0 };
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order: any) => {
      if (statusFilter !== "all" && String(order.status || "") !== statusFilter) return false;
      if (paymentMethodFilter === "all") return true;
      const paymentMatches = String(order.payment_method || "") === paymentMethodFilter;
      if (!paymentMatches) return false;
      return true;
    });
  }, [orders, paymentMethodFilter, statusFilter]);

  const driverFilteredOrders = useMemo(() => {
    return filteredOrders.filter((order: any) => {
      if (driverFilter === "all") return true;
      const delivery = deliveryByOrderId[order.id];
      if (driverFilter === "unassigned") {
        return order.order_type === "delivery" && !delivery?.driver_id;
      }
      return delivery?.driver_id === driverFilter;
    });
  }, [deliveryByOrderId, driverFilter, filteredOrders]);

  const ordersByStatus = kanbanColumns.map((status) => {
    const columnOrders = driverFilteredOrders.filter((order: any) => {
      const isScheduledOpen =
        Boolean(order.is_scheduled) &&
        Boolean(order.scheduled_for) &&
        new Date(order.scheduled_for).getTime() > Date.now() &&
        !["delivered", "cancelled"].includes(order.status);
      if (isScheduledOpen) return false;
      return order.status === status;
    });
    const lateCount = columnOrders.reduce((acc, order) => {
      const slaInfo = getSlaInfo(order);
      return acc + (slaInfo?.isLate ? 1 : 0);
    }, 0);
    const lateRatio = columnOrders.length ? lateCount / columnOrders.length : 0;

    return {
      status,
      label: ORDER_STATUS_LABELS[status],
      orders: columnOrders,
      lateCount,
      lateRatio,
      tone: getSlaColumnTone(lateRatio),
    };
  });

  const cancelledOrders = driverFilteredOrders.filter((order: any) => order.status === "cancelled");
  const lateOrders = driverFilteredOrders.filter((order: any) => {
    const slaInfo = getSlaInfo(order);
    return Boolean(slaInfo?.isLate);
  });

  useEffect(() => {
    const currentLateCount = lateOrders.length;
    if (currentLateCount > previousLateCount.current) {
      playSlaAlertSound();
      toast.warning(`Atenção: ${currentLateCount} pedido(s) com SLA estourado.`);
    }
    previousLateCount.current = currentLateCount;
  }, [lateOrders.length]);

  const summary = useMemo(() => {
    const inProgress = driverFilteredOrders.filter((o: any) => !["delivered", "cancelled"].includes(o.status)).length;
    const delivered = driverFilteredOrders.filter((o: any) => o.status === "delivered").length;
    const scheduledOpen = driverFilteredOrders.filter((o: any) => {
      if (!o.is_scheduled || !o.scheduled_for) return false;
      if (["delivered", "cancelled"].includes(o.status)) return false;
      return new Date(o.scheduled_for).getTime() > Date.now();
    }).length;

    return {
      total: driverFilteredOrders.length,
      inProgress,
      delivered,
      cancelled: cancelledOrders.length,
      scheduledOpen,
      driversOnline: (deliveryDrivers as any[]).filter((driver) => driver.is_active && ["online", "busy"].includes(driver.availability_mode || "")).length,
      deliveriesInRoute: (orderDeliveries as any[]).filter((delivery) => ["assigned", "accepted", "picked_up"].includes(delivery.status)).length,
    };
  }, [driverFilteredOrders, cancelledOrders.length, deliveryDrivers, orderDeliveries]);

  const scheduledOrders = useMemo(() => {
    return driverFilteredOrders
      .filter((order: any) => {
        if (!order.is_scheduled || !order.scheduled_for) return false;
        if (["delivered", "cancelled"].includes(order.status)) return false;
        return new Date(order.scheduled_for).getTime() > Date.now();
      })
      .sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
  }, [driverFilteredOrders]);

  const exportOrdersCsv = () => {
    downloadCsv(
      `kanban-pedidos-pagina-${page}.csv`,
      [
        "pedido_id",
        "cliente",
        "telefone",
        "status",
        "tipo",
        "pagamento_status",
        "metodo_pagamento",
        "total",
        "criado_em",
        "entregador",
      ],
      driverFilteredOrders.map((order: any) => [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.status,
        order.order_type,
        order.payment_status,
        order.payment_method,
        order.total,
        order.created_at,
        deliveryByOrderId[order.id]?.delivery_drivers?.full_name || "",
      ])
    );
    toast.success("CSV do Kanban gerado.");
  };

  const exportScheduledOrdersCsv = () => {
    downloadCsv(
      `pedidos-agendados-pagina-${page}.csv`,
      ["pedido_id", "cliente", "telefone", "tipo", "status", "agendado_para", "metodo_pagamento", "total"],
      scheduledOrders.map((order: any) => [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.order_type,
        order.status,
        order.scheduled_for,
        order.payment_method,
        order.total,
      ])
    );
    toast.success("CSV de agendados gerado.");
  };

  const exportCancelledOrdersCsv = () => {
    downloadCsv(
      `cancelamentos-pagina-${page}.csv`,
      ["pedido_id", "cliente", "telefone", "tipo", "metodo_pagamento", "total", "criado_em"],
      cancelledOrders.map((order: any) => [
        order.id,
        order.customer_name,
        order.customer_phone,
        order.order_type,
        order.payment_method,
        order.total,
        order.created_at,
      ])
    );
    toast.success("CSV de cancelamentos gerado.");
  };

  const kanbanClosingText = useMemo(() => {
    return [
      "Fechamento do Kanban",
      `Pedidos visíveis: ${summary.total}`,
      `Em andamento: ${summary.inProgress}`,
      `Entregues: ${summary.delivered}`,
      `Cancelados: ${summary.cancelled}`,
      `Agendados: ${summary.scheduledOpen}`,
      `Frota online: ${summary.driversOnline}`,
      `Rotas ativas: ${summary.deliveriesInRoute}`,
      `Filtro de tipo: ${orderTypeFilter === "all" ? "Todos os tipos" : orderTypeFilter === "pickup" ? "Retirada" : "Entrega"}`,
      `Filtro de pagamento: ${paymentMethodFilter === "all" ? "Todos os meios" : PAYMENT_METHOD_LABELS[paymentMethodFilter as keyof typeof PAYMENT_METHOD_LABELS] || paymentMethodFilter}`,
      `Filtro de status: ${orderStatusFilterOptions.find((option) => option.value === statusFilter)?.label || "Todos os status"}`,
      `Filtro de entregador: ${driverFilter === "all" ? "Todos" : driverFilter === "unassigned" ? "Sem entregador" : ((deliveryDrivers as any[]).find((driver) => driver.id === driverFilter)?.full_name || "Entregador filtrado")}`,
    ].join("\n");
  }, [driverFilter, orderTypeFilter, paymentMethodFilter, statusFilter, summary, deliveryDrivers]);

  const copyKanbanClosing = async () => {
    try {
      await navigator.clipboard.writeText(kanbanClosingText);
      toast.success("Fechamento do Kanban copiado.");
    } catch {
      toast.error("Não rolou copiar o fechamento do Kanban.");
    }
  };

  const shareKanbanClosing = () => {
    window.open(buildWhatsAppSupportLink(kanbanClosingText), "_blank", "noopener,noreferrer");
  };

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configura sua loja primeiro para liberar essa visão.</p>;
  }

  const fromItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Central de pedidos em tempo real</h1>
          <p className="text-muted-foreground">Atualização em tempo real para você tocar a operação sem perder o timing.</p>
        </div>
        <Link to="/admin/incidentes">
          <Button variant="outline" size="sm">Ver incidentes</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-7 gap-3">
          <div className="md:col-span-2">
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={orderTypeFilter} onValueChange={(value) => setOrderTypeFilter(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="pickup">Retirada</SelectItem>
              <SelectItem value="delivery">Entrega</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meios</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="credit_card">Cartão de crédito</SelectItem>
              <SelectItem value="debit_card">Cartão de débito</SelectItem>
              <SelectItem value="money">Dinheiro</SelectItem>
              <SelectItem value="meal_voucher">Vale alimentação</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderStatusFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={driverFilter} onValueChange={setDriverFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os entregadores</SelectItem>
              <SelectItem value="unassigned">Sem entregador</SelectItem>
              {(deliveryDrivers as any[]).map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setOrderTypeFilter("all");
              setPaymentMethodFilter("all");
              setStatusFilter("all");
              setDriverFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold">Fechamento rápido do Kanban</p>
            <p className="text-sm text-muted-foreground">
              {summary.total} pedido(s) visíveis, {summary.inProgress} em andamento, {summary.delivered} entregues e {summary.cancelled} cancelados.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => void copyKanbanClosing()}>
              Copiar fechamento
            </Button>
            <Button variant="outline" onClick={shareKanbanClosing}>
              Mandar no WhatsApp
            </Button>
            <Button variant="outline" onClick={exportOrdersCsv}>
              Exportar CSV do Kanban
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em andamento</p><p className="text-2xl font-bold">{summary.inProgress}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entregues</p><p className="text-2xl font-bold">{summary.delivered}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cancelados</p><p className="text-2xl font-bold">{summary.cancelled}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Agendados</p><p className="text-2xl font-bold">{summary.scheduledOpen}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Frota online</p><p className="text-2xl font-bold">{summary.driversOnline}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rotas ativas</p><p className="text-2xl font-bold">{summary.deliveriesInRoute}</p></CardContent></Card>
      </div>

      {scheduledOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Pedidos agendados</span>
              <Button variant="outline" size="sm" onClick={exportScheduledOrdersCsv}>
                Exportar agendados
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scheduledOrders.map((order: any) => (
              <div key={order.id} className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold">{order.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.order_type === "delivery" ? "Entrega" : "Retirada"} • Agendado para {formatDate(order.scheduled_for)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total: {formatCurrency(Number(order.total || 0))}</p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={order.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus.mutate({ id: order.id, status: "confirmed" })}
                    disabled={updateStatus.isPending || order.status === "confirmed"}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {lateOrders.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold">SLA pedindo atenção</p>
              <p className="text-sm text-muted-foreground">
                Você tem <span className="font-semibold text-destructive">{lateOrders.length}</span> pedido(s) acima do tempo esperado.
              </p>
            </div>
            <Badge variant="destructive">SLA estourado</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">Mostrando {fromItem}-{toItem} de {totalCount} pedido(s)</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || ordersQuery.isFetching}>
              Anterior
            </Button>
            <span className="text-sm">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages || ordersQuery.isFetching}>
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>

      {driverFilteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">Nenhum pedido encontrado com esses filtros.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-[1260px]">
              {ordersByStatus.map((column) => (
                <Card key={column.status} className={`w-[250px] shrink-0 border-l-4 ${statusTone[column.status]}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${column.tone.dot}`} />
                        {column.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{column.orders.length}</span>
                    </CardTitle>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={column.tone.badgeVariant} className="text-[11px]">
                        SLA: {column.tone.label}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground">
                        {column.lateCount}/{column.orders.length || 0} atrasado(s)
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
                    {column.orders.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-3">Fila zerada</p>
                    )}

                    {column.orders.map((order: any) => {
                      const currentIdx = statusFlow.indexOf(order.status);
                      const nextStatus =
                        currentIdx >= 0 && currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

                      const timeline = (historyByOrder[order.id] || []).slice(0, 3);
                      const slaInfo = getSlaInfo(order);
                      const delivery = deliveryByOrderId[order.id];
                      const isDeliveryOrder = order.order_type === "delivery";
                      const selectedDriverId = selectedDriverByOrder[order.id] || delivery?.driver_id || "";
                      const canDispatch = isDeliveryOrder && !["delivered", "cancelled"].includes(order.status);
                      const sortedDrivers = [...(deliveryDrivers as any[])]
                        .map((driver) => ({
                          ...driver,
                          dispatchScore: scoreDriverForDispatch(driver, delivery?.driver_id),
                        }))
                        .sort((a, b) => b.dispatchScore - a.dispatchScore);
                      const acceptTimeoutExpired =
                        delivery?.status === "assigned" &&
                        delivery?.accepted_deadline_at &&
                        new Date(delivery.accepted_deadline_at).getTime() < Date.now();

                      return (
                        <Card key={order.id} className="border-dashed">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-sm">{order.customer_name}</h3>
                                <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                              </div>
                              <StatusBadge status={order.status} />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={order.payment_status === "paid" ? "default" : "outline"}>
                                  {order.payment_status === "paid" ? "Pagamento aprovado" : "Pagamento pendente"}
                                </Badge>
                                <Badge variant="secondary">
                                  {PAYMENT_METHOD_LABELS[order.payment_method as keyof typeof PAYMENT_METHOD_LABELS] || order.payment_method || "Forma não informada"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{order.order_type === "pickup" ? "Retirada" : "Entrega"}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                              {order.payment_status !== "paid" && ["pix", "credit_card", "debit_card"].includes(String(order.payment_method || "")) && (
                                <p className="text-xs text-amber-700">
                                  Cobrança digital ainda pendente. Bom acompanhar no financeiro antes de liberar qualquer exceção.
                                </p>
                              )}
                              {order.payment_status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  disabled={confirmPaymentMutation.isPending}
                                  onClick={() => {
                                    const ok = window.confirm("Confirmar pagamento deste pedido como aprovado?");
                                    if (!ok) return;
                                    confirmPaymentMutation.mutate(order.id);
                                  }}
                                >
                                  Confirmar pagamento
                                </Button>
                              )}
                              {order.observation && <p className="text-xs text-muted-foreground line-clamp-2">{order.observation}</p>}
                              <div className="flex flex-wrap gap-2">
                                <a href={`tel:${String(order.customer_phone || "").replace(/\D/g, "")}`}>
                                  <Button size="sm" variant="outline">Ligar</Button>
                                </a>
                                <a href={buildCustomerWhatsAppUrl(order.customer_phone, order.customer_name)} target="_blank" rel="noreferrer">
                                  <Button size="sm" variant="outline">WhatsApp</Button>
                                </a>
                              </div>
                              {delivery && (
                                <div className="rounded-md border p-2 mt-1">
                                  <div className="mb-2 flex items-center gap-2">
                                    {delivery.delivery_drivers?.avatar_url ? (
                                      <img
                                        src={delivery.delivery_drivers.avatar_url}
                                        alt={delivery.delivery_drivers?.full_name || "Entregador"}
                                        className="h-10 w-10 rounded-full border object-cover"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground">
                                        Moto
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-[11px] text-muted-foreground">
                                        Entregador: <span className="font-semibold text-foreground">{delivery.delivery_drivers?.full_name || "Sem nome"}</span>
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        {[delivery.delivery_drivers?.vehicle_type, delivery.delivery_drivers?.vehicle_brand, delivery.delivery_drivers?.vehicle_model]
                                          .filter(Boolean)
                                          .join(" • ") || "Veículo sem detalhes"}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    Status da rota: {delivery.status === "assigned" ? "Aguardando aceite" : delivery.status === "accepted" ? "Aceita" : delivery.status === "picked_up" ? "Saiu para entrega" : delivery.status}
                                  </p>
                                  {(delivery.delivery_drivers?.vehicle_color || delivery.delivery_drivers?.license_plate) && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Identificação: {[delivery.delivery_drivers?.vehicle_color, delivery.delivery_drivers?.license_plate].filter(Boolean).join(" • ")}
                                    </p>
                                  )}
                                  {delivery.accepted_deadline_at && delivery.status === "assigned" && (
                                    <p className={`text-[11px] ${acceptTimeoutExpired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                      Aceite até: {formatDate(delivery.accepted_deadline_at)}
                                    </p>
                                  )}
                                  {acceptTimeoutExpired && (
                                    <p className="text-[11px] font-semibold text-destructive">
                                      Aceite expirado. Vale redespachar para não travar a rota.
                                    </p>
                                  )}
                                  {delivery.confirmation_code && (
                                    <p className="text-[11px] text-muted-foreground">
                                      PIN final: <span className="font-semibold text-foreground">{delivery.confirmation_code}</span>
                                    </p>
                                  )}
                                  {delivery.tracking_token && (
                                    <p className="text-[11px] text-primary break-all">
                                      Rastreamento: {window.location.origin}/acompanhar/{delivery.tracking_token}
                                    </p>
                                  )}
                                  {delivery.issue_reason && (
                                    <p className="text-[11px] text-amber-700">
                                      Ocorrência: <span className="font-semibold">{delivery.issue_reason}</span>
                                    </p>
                                  )}
                                  {delivery.proof_image_url && (
                                    <div className="mt-2">
                                      <p className="text-[11px] text-muted-foreground mb-1">Prova de entrega:</p>
                                      <img
                                        src={delivery.proof_image_url}
                                        alt="Prova de entrega"
                                        className="h-20 w-20 rounded-md border object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                  )}
                                  {delivery.recipient_name && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Recebido por: <span className="font-semibold text-foreground">{delivery.recipient_name}</span>
                                    </p>
                                  )}
                                  {delivery.delivered_accuracy_meters != null && (
                                    <p className="text-[11px] text-muted-foreground">
                                      GPS: {Math.round(Number(delivery.delivered_accuracy_meters))}m de precisão
                                    </p>
                                  )}
                                  {delivery.gps_bypass_reason && (
                                    <p className="text-[11px] text-amber-700">
                                      Justificativa sem GPS: <span className="font-semibold">{delivery.gps_bypass_reason}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                              {slaInfo && (
                                <div className="pt-1">
                                  {slaInfo.isLate ? (
                                    <Badge variant="destructive" className="text-[11px]">
                                      SLA estourado em {slaInfo.overtime} min
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[11px]">
                                      SLA no prazo ({slaInfo.limitMinutes - slaInfo.elapsedMinutes} min restantes)
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>

                            {timeline.length > 0 && (
                              <div className="rounded-md border p-2 space-y-1">
                                <p className="text-[11px] font-medium text-muted-foreground">Timeline</p>
                                {timeline.map((event: any) => (
                                  <p key={event.id} className="text-[11px] text-muted-foreground">
                                    {ORDER_STATUS_LABELS[event.new_status] || event.new_status} - {formatDate(event.changed_at)}
                                  </p>
                                ))}
                              </div>
                            )}

                            {order.order_items && order.order_items.length > 0 && (
                              <div className="space-y-1">
                                {order.order_items.slice(0, 3).map((item: any) => (
                                  <p key={item.id} className="text-xs">{item.quantity}x {item.product_name}</p>
                                ))}
                                {order.order_items.length > 3 && (
                                  <p className="text-xs text-muted-foreground">+{order.order_items.length - 3} item(ns)</p>
                                )}
                              </div>
                            )}

                            <div className="space-y-1">
                              {Number(order.discount_amount || 0) > 0 && (
                                <>
                                  <p className="text-xs text-muted-foreground">
                                    Subtotal: {formatCurrency(Number(order.subtotal || order.total))}
                                  </p>
                                  <p className="text-xs text-emerald-600">
                                    Desconto{order.coupon_code ? ` (${order.coupon_code})` : ""}: -{formatCurrency(Number(order.discount_amount))}
                                  </p>
                                </>
                              )}
                              <p className="text-sm font-semibold text-primary">
                                Total: {formatCurrency(Number(order.total))}
                              </p>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                              {(quickStatusActions[order.status] || []).map((action) => (
                                <Button
                                  key={`${order.id}-${action.next}`}
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 text-xs"
                                  onClick={() => updateStatus.mutate({ id: order.id, status: action.next })}
                                  disabled={updateStatus.isPending || order.status === action.next}
                                >
                                  {action.label}
                                </Button>
                              ))}

                              {canDispatch && (
                                <>
                                  <Select
                                    value={selectedDriverId || "__none"}
                                    onValueChange={(value) => setSelectedDriverByOrder((prev) => ({
                                      ...prev,
                                      [order.id]: value === "__none" ? "" : value,
                                    }))}
                                  >
                                    <SelectTrigger className="h-8 text-xs w-full">
                                      <SelectValue placeholder="Selecionar entregador" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none">Selecionar entregador</SelectItem>
                                      {sortedDrivers.map((driver) => (
                                        <SelectItem key={driver.id} value={driver.id}>
                                          {driver.full_name} • {activeDeliveriesByDriver[driver.id] || 0}/{driver.max_active_deliveries || 1}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs w-full"
                                    onClick={() => {
                                      if (!selectedDriverId) {
                                        toast.error("Escolha um entregador.");
                                        return;
                                      }
                                      const selectedDriver = (deliveryDrivers as any[]).find((driver) => driver.id === selectedDriverId);
                                      const selectedDriverLoad = activeDeliveriesByDriver[selectedDriverId] || 0;
                                      const selectedDriverCapacity = Number(selectedDriver?.max_active_deliveries || 1);
                                      const isSameDriver = delivery?.driver_id === selectedDriverId;
                                      if (!isSameDriver && selectedDriverLoad >= selectedDriverCapacity) {
                                        toast.error("Esse entregador já bateu o limite de corridas.");
                                        return;
                                      }
                                      dispatchDelivery.mutate({ orderId: order.id, driverId: selectedDriverId });
                                    }}
                                    disabled={dispatchDelivery.isPending}
                                  >
                                    {acceptTimeoutExpired ? "Redespachar agora" : delivery ? "Reatribuir rota" : "Despachar para entregador"}
                                  </Button>
                                </>
                              )}

                              {nextStatus && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                                  disabled={updateStatus.isPending}
                                >
                                  Avançar para {ORDER_STATUS_LABELS[nextStatus]}
                                </Button>
                              )}
                              {order.status !== "delivered" && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => updateStatus.mutate({ id: order.id, status: "cancelled" })}
                                  disabled={updateStatus.isPending}
                                >
                                  Cancelar pedido
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {cancelledOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Histórico de cancelamentos</span>
                  <span className="text-xs text-muted-foreground">{cancelledOrders.length}</span>
                </CardTitle>
              </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportCancelledOrdersCsv}>
                Exportar cancelamentos
              </Button>
            </div>
            {cancelledOrders.map((order: any) => (
              <div key={order.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                      <p className="font-medium text-sm">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(Number(order.total))}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}






