import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/formatters";
import { toast } from "sonner";

const statusFlow = ["received", "confirmed", "in_preparation", "ready", "delivered"];
const kanbanColumns = ["received", "confirmed", "in_preparation", "ready", "delivered"];

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data } = await supabase.from("establishments").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", establishment?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("establishment_id", establishment!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!establishment,
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Status atualizado!");
    },
  });

  const ordersByStatus = kanbanColumns.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    orders: orders.filter((order: any) => order.status === status),
  }));

  const cancelledOrders = orders.filter((order: any) => order.status === "cancelled");

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedidos (Kanban)</h1>
          <p className="text-muted-foreground">{orders.length} pedido(s)</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            {ordersByStatus.map((column) => (
              <Card key={column.status} className="h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span>{column.label}</span>
                    <span className="text-xs text-muted-foreground">{column.orders.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {column.orders.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">Sem pedidos</p>
                  )}

                  {column.orders.map((order: any) => {
                    const currentIdx = statusFlow.indexOf(order.status);
                    const nextStatus =
                      currentIdx >= 0 && currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

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
                            <p className="text-xs text-muted-foreground">
                              {order.order_type === "pickup" ? "Retirada" : "Entrega"}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                            {order.observation && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{order.observation}</p>
                            )}
                          </div>

                          {order.order_items && order.order_items.length > 0 && (
                            <div className="space-y-1">
                              {order.order_items.slice(0, 3).map((item: any) => (
                                <p key={item.id} className="text-xs">
                                  {item.quantity}x {item.product_name}
                                </p>
                              ))}
                              {order.order_items.length > 3 && (
                                <p className="text-xs text-muted-foreground">+{order.order_items.length - 3} item(ns)</p>
                              )}
                            </div>
                          )}

                          <p className="text-sm font-semibold text-primary">{formatCurrency(Number(order.total))}</p>

                          <div className="flex gap-2 flex-wrap">
                            {nextStatus && (
                              <Button
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                              >
                                Avancar: {ORDER_STATUS_LABELS[nextStatus]}
                              </Button>
                            )}
                            {order.status !== "delivered" && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => updateStatus.mutate({ id: order.id, status: "cancelled" })}
                              >
                                Cancelar
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

          {cancelledOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Cancelados</span>
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
