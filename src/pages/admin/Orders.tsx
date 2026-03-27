import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/formatters";
import { toast } from "sonner";
import { useState } from "react";

const statusFlow = ["received", "confirmed", "in_preparation", "ready", "delivered"];

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  const filtered = filterStatus === "all" ? orders : orders.filter((o: any) => o.status === filterStatus);

  if (!establishment) {
    return <p className="text-muted-foreground text-center py-12">Configure sua loja primeiro.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="text-muted-foreground">{orders.length} pedido(s)</p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((order: any) => {
            const currentIdx = statusFlow.indexOf(order.status);
            const nextStatus = currentIdx >= 0 && currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

            return (
              <Card key={order.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{order.customer_name}</h3>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">📱 {order.customer_phone}</p>
                      <p className="text-sm text-muted-foreground">📦 {order.order_type === "pickup" ? "Retirada" : "Entrega"}</p>
                      {order.observation && <p className="text-sm text-muted-foreground">📝 {order.observation}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(order.created_at)}</p>

                      {order.order_items && order.order_items.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {order.order_items.map((item: any) => (
                            <p key={item.id} className="text-sm">
                              {item.quantity}x {item.product_name} — {formatCurrency(Number(item.unit_price) * item.quantity)}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(Number(order.total))}</p>
                      {nextStatus && order.status !== "cancelled" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                        >
                          → {ORDER_STATUS_LABELS[nextStatus]}
                        </Button>
                      )}
                      {order.status !== "cancelled" && order.status !== "delivered" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="ml-2"
                          onClick={() => updateStatus.mutate({ id: order.id, status: "cancelled" })}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
