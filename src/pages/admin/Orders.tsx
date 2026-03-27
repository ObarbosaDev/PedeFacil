import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/formatters";
import { toast } from "sonner";

const statusFlow = ["received", "confirmed", "in_preparation", "ready", "delivered"];
const kanbanColumns = ["received", "confirmed", "in_preparation", "ready", "delivered"];
const pageSize = 50;

const statusTone: Record<string, string> = {
  received: "border-l-blue-400",
  confirmed: "border-l-amber-400",
  in_preparation: "border-l-orange-500",
  ready: "border-l-emerald-500",
  delivered: "border-l-zinc-400",
};

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

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "pickup" | "delivery">("all");
  const [page, setPage] = useState(1);
  const hasBootstrappedOrders = useRef(false);
  const knownOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPage(1);
  }, [searchTerm, orderTypeFilter]);

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
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
  });

  const orders = ordersQuery.data?.rows || [];
  const totalCount = ordersQuery.data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!establishment?.id) return;

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
          queryClient.invalidateQueries({ queryKey: ["orders", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-orders", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-period-orders", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-period-items", establishment.id] });
          queryClient.invalidateQueries({ queryKey: ["order-history", establishment.id] });

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
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-history"] });
      toast.success("Status atualizado!");
    },
  });

  const orderIds = useMemo(() => orders.map((order: any) => order.id), [orders]);

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
  });

  const historyByOrder = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const row of historyRows as any[]) {
      if (!grouped[row.order_id]) grouped[row.order_id] = [];
      grouped[row.order_id].push(row);
    }
    return grouped;
  }, [historyRows]);

  const ordersByStatus = kanbanColumns.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    orders: orders.filter((order: any) => order.status === status),
  }));

  const cancelledOrders = orders.filter((order: any) => order.status === "cancelled");

  const summary = useMemo(() => {
    const inProgress = orders.filter((o: any) => !["delivered", "cancelled"].includes(o.status)).length;
    const delivered = orders.filter((o: any) => o.status === "delivered").length;
    return {
      total: totalCount,
      inProgress,
      delivered,
      cancelled: cancelledOrders.length,
    };
  }, [orders, cancelledOrders.length, totalCount]);

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro.</p>;
  }

  const fromItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Central de pedidos</h1>
          <p className="text-muted-foreground">Atualização em tempo real para você tocar a operação no ritmo certo.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
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

          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm("");
              setOrderTypeFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em andamento</p><p className="text-2xl font-bold">{summary.inProgress}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entregues</p><p className="text-2xl font-bold">{summary.delivered}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cancelados</p><p className="text-2xl font-bold">{summary.cancelled}</p></CardContent></Card>
      </div>

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

      {orders.length === 0 ? (
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
                      <span>{column.label}</span>
                      <span className="text-xs text-muted-foreground">{column.orders.length}</span>
                    </CardTitle>
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
                              <p className="text-xs text-muted-foreground">{order.order_type === "pickup" ? "Retirada" : "Entrega"}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                              {order.observation && <p className="text-xs text-muted-foreground line-clamp-2">{order.observation}</p>}
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
                              {nextStatus && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
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

