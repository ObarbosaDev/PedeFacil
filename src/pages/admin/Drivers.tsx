import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { Bike, CircleDollarSign, Phone, Plus, ShieldCheck, TimerReset, User } from "lucide-react";

type DriverRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  license_plate: string | null;
  is_active: boolean;
  is_available: boolean;
  availability_mode: "online" | "busy" | "paused" | "offline";
  max_active_deliveries: number;
  payout_per_delivery: number;
};

const defaultForm = {
  fullName: "",
  email: "",
  phone: "",
  vehicleType: "moto",
  licensePlate: "",
  maxActiveDeliveries: "1",
  payoutPerDelivery: "0",
};

const modeLabels: Record<DriverRow["availability_mode"], string> = {
  online: "Online",
  busy: "Em rota",
  paused: "Em pausa",
  offline: "Offline",
};

export default function Drivers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("establishments")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: drivers = [] } = useQuery<DriverRow[]>({
    queryKey: ["delivery-drivers", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delivery_drivers")
        .select("*")
        .eq("establishment_id", establishment!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DriverRow[];
    },
    enabled: !!establishment,
  });

  const { data: activeDeliveries = [] } = useQuery({
    queryKey: ["fleet-live-deliveries", establishment?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, driver_id, status")
        .eq("establishment_id", establishment!.id)
        .in("status", ["assigned", "accepted", "picked_up"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: deliveredToday = [] } = useQuery({
    queryKey: ["fleet-delivered-today", establishment?.id],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, driver_id, payout_amount, delivered_at, eta_minutes")
        .eq("establishment_id", establishment!.id)
        .eq("status", "delivered")
        .gte("delivered_at", startOfDay.toISOString())
        .lt("delivered_at", endOfDay.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: deliveredPeriodRows = [] } = useQuery({
    queryKey: ["fleet-delivered-periods", establishment?.id],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfWindow = new Date();
      endOfWindow.setDate(endOfWindow.getDate() + 1);
      endOfWindow.setHours(0, 0, 0, 0);

      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, driver_id, payout_amount, delivered_at, eta_minutes")
        .eq("establishment_id", establishment!.id)
        .eq("status", "delivered")
        .gte("delivered_at", startOfMonth.toISOString())
        .lt("delivered_at", endOfWindow.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const liveCountByDriver = activeDeliveries.reduce<Record<string, number>>((acc, row: any) => {
    acc[row.driver_id] = (acc[row.driver_id] || 0) + 1;
    return acc;
  }, {});

  const deliveredTodayByDriver = useMemo(() => {
    return (deliveredToday as any[]).reduce<Record<string, { deliveries: number; payout: number; etaTotal: number }>>((acc, row) => {
      if (!acc[row.driver_id]) {
        acc[row.driver_id] = { deliveries: 0, payout: 0, etaTotal: 0 };
      }
      acc[row.driver_id].deliveries += 1;
      acc[row.driver_id].payout += Number(row.payout_amount || 0);
      acc[row.driver_id].etaTotal += Number(row.eta_minutes || 0);
      return acc;
    }, {});
  }, [deliveredToday]);

  const weeklyRows = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    return (deliveredPeriodRows as any[]).filter((row) => new Date(row.delivered_at).getTime() >= weekStart.getTime());
  }, [deliveredPeriodRows]);

  const monthlyRows = deliveredPeriodRows as any[];

  const summarizeRowsByDriver = (rows: any[]) =>
    rows.reduce<Record<string, { deliveries: number; payout: number }>>((acc, row) => {
      if (!acc[row.driver_id]) {
        acc[row.driver_id] = { deliveries: 0, payout: 0 };
      }
      acc[row.driver_id].deliveries += 1;
      acc[row.driver_id].payout += Number(row.payout_amount || 0);
      return acc;
    }, {});

  const weeklySummaryByDriver = useMemo(() => summarizeRowsByDriver(weeklyRows), [weeklyRows]);
  const monthlySummaryByDriver = useMemo(() => summarizeRowsByDriver(monthlyRows), [monthlyRows]);

  const saveDriverMutation = useMutation({
    mutationFn: async () => {
      if (!establishment?.id) throw new Error("Loja nao encontrada.");
      if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
        throw new Error("Preencha nome, e-mail e telefone.");
      }

      const { error } = await (supabase as any).from("delivery_drivers").insert({
        establishment_id: establishment.id,
        full_name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        vehicle_type: form.vehicleType,
        license_plate: form.licensePlate.trim() || null,
        max_active_deliveries: Math.max(Number(form.maxActiveDeliveries || 1), 1),
        payout_per_delivery: Math.max(Number(form.payoutPerDelivery || 0), 0),
        availability_mode: "online",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["delivery-drivers", establishment?.id] });
      toast.success("Entregador cadastrado.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel cadastrar entregador."),
  });

  const updateDriverMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await (supabase as any).from("delivery_drivers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-drivers", establishment?.id] });
      toast.success("Entregador atualizado.");
    },
    onError: (error: any) => toast.error(error.message || "Nao foi possivel atualizar entregador."),
  });

  if (!establishment) {
    return <p className="text-center py-10 text-muted-foreground">Configure sua loja para gerenciar entregadores.</p>;
  }

  const total = drivers.length;
  const active = drivers.filter((driver) => driver.is_active).length;
  const online = drivers.filter((driver) => driver.availability_mode === "online" && driver.is_active).length;
  const busy = drivers.filter((driver) => ["busy"].includes(driver.availability_mode) || (liveCountByDriver[driver.id] || 0) > 0).length;
  const deliveredCountToday = (deliveredToday as any[]).length;
  const payoutToday = (deliveredToday as any[]).reduce((acc, row: any) => acc + Number(row.payout_amount || 0), 0);
  const averagePayoutToday = deliveredCountToday > 0 ? payoutToday / deliveredCountToday : 0;
  const weeklyCount = weeklyRows.length;
  const weeklyPayout = weeklyRows.reduce((acc: number, row: any) => acc + Number(row.payout_amount || 0), 0);
  const monthlyCount = monthlyRows.length;
  const monthlyPayout = monthlyRows.reduce((acc: number, row: any) => acc + Number(row.payout_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Frota e entregadores</h1>
        <p className="text-muted-foreground">Cadastre, acompanhe carga da frota e deixe o despacho mais redondo.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-2xl font-bold">{active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Online</p><p className="text-2xl font-bold">{online}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em rota</p><p className="text-2xl font-bold">{busy}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entregas hoje</p><p className="text-2xl font-bold">{deliveredCountToday}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fechamento hoje</p><p className="text-2xl font-bold">{formatCurrency(payoutToday)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fechamento do dia</CardTitle>
          <CardDescription>Resumo do custo logistico de hoje, sem precisar fechar isso no improviso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Saida total de hoje</p>
              <p className="text-2xl font-bold">{formatCurrency(payoutToday)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Corridas concluidas</p>
              <p className="text-2xl font-bold">{deliveredCountToday}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Media por entrega</p>
              <p className="text-2xl font-bold">{formatCurrency(averagePayoutToday)}</p>
            </div>
          </div>

          {drivers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Por entregador</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {drivers.map((driver) => {
                  const driverSummary = deliveredTodayByDriver[driver.id] || { deliveries: 0, payout: 0, etaTotal: 0 };
                  const averageEta = driverSummary.deliveries > 0 ? Math.round(driverSummary.etaTotal / driverSummary.deliveries) : 0;

                  return (
                    <div key={`closing-${driver.id}`} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{driver.full_name}</p>
                          <p className="text-sm text-muted-foreground">{driver.vehicle_type}</p>
                        </div>
                        <Badge variant={driverSummary.deliveries > 0 ? "default" : "secondary"}>
                          {driverSummary.deliveries > 0 ? `${driverSummary.deliveries} entrega(s)` : "Sem entrega hoje"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Repasse</p>
                          <p className="font-semibold">{formatCurrency(driverSummary.payout)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Media ETA</p>
                          <p className="font-semibold">{driverSummary.deliveries > 0 ? `${averageEta} min` : "-"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Carga ao vivo</p>
                          <p className="font-semibold">{liveCountByDriver[driver.id] || 0}/{driver.max_active_deliveries}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Fechamento semanal</CardTitle>
            <CardDescription>Ultimos 7 dias de repasse e volume por entregador.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Entregas</p>
                <p className="text-2xl font-bold">{weeklyCount}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Repasse</p>
                <p className="text-2xl font-bold">{formatCurrency(weeklyPayout)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {drivers.map((driver) => {
                const summary = weeklySummaryByDriver[driver.id] || { deliveries: 0, payout: 0 };
                return (
                  <div key={`weekly-${driver.id}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{driver.full_name}</p>
                      <p className="text-sm text-muted-foreground">{summary.deliveries} entrega(s)</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(summary.payout)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fechamento mensal</CardTitle>
            <CardDescription>Consolidado do mes para acompanhar custo logistico da operacao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Entregas</p>
                <p className="text-2xl font-bold">{monthlyCount}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Repasse</p>
                <p className="text-2xl font-bold">{formatCurrency(monthlyPayout)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {drivers.map((driver) => {
                const summary = monthlySummaryByDriver[driver.id] || { deliveries: 0, payout: 0 };
                return (
                  <div key={`monthly-${driver.id}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{driver.full_name}</p>
                      <p className="text-sm text-muted-foreground">{summary.deliveries} entrega(s)</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(summary.payout)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo entregador</CardTitle>
          <CardDescription>Use o mesmo e-mail que ele vai cadastrar em <span className="font-semibold">/entregador/registro</span>.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Nome completo</Label>
            <Input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Veiculo</Label>
            <Select value={form.vehicleType} onValueChange={(value) => setForm((prev) => ({ ...prev, vehicleType: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="moto">Moto</SelectItem>
                <SelectItem value="bike">Bike</SelectItem>
                <SelectItem value="carro">Carro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Placa</Label>
            <Input value={form.licensePlate} onChange={(e) => setForm((prev) => ({ ...prev, licensePlate: e.target.value }))} placeholder="Opcional" />
          </div>
          <div>
            <Label>Maximo de corridas simultaneas</Label>
            <Input type="number" min={1} value={form.maxActiveDeliveries} onChange={(e) => setForm((prev) => ({ ...prev, maxActiveDeliveries: e.target.value }))} />
          </div>
          <div>
            <Label>Valor por entrega</Label>
            <Input type="number" min={0} step="0.01" value={form.payoutPerDelivery} onChange={(e) => setForm((prev) => ({ ...prev, payoutPerDelivery: e.target.value }))} />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button className="w-full" onClick={() => saveDriverMutation.mutate()} disabled={saveDriverMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              {saveDriverMutation.isPending ? "Salvando..." : "Cadastrar entregador"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visao da frota</CardTitle>
          <CardDescription>Veja carga, disponibilidade e custo por corrida de cada entregador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda nao ha entregadores cadastrados.</p>
          ) : (
            drivers.map((driver) => {
              const liveDeliveries = liveCountByDriver[driver.id] || 0;
              const atCapacity = liveDeliveries >= driver.max_active_deliveries;

              return (
                <div key={driver.id} className="rounded-xl border p-4 bg-card space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <p className="font-semibold flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        {driver.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{driver.email}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {driver.phone}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Bike className="h-3.5 w-3.5" />
                       {driver.vehicle_type}{driver.license_plate ? ` - ${driver.license_plate}` : ""}
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={driver.is_active ? "default" : "secondary"}>
                        {driver.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant={atCapacity ? "destructive" : "outline"}>
                        {liveDeliveries}/{driver.max_active_deliveries} corridas
                      </Badge>
                      <Badge variant="secondary">{modeLabels[driver.availability_mode] || driver.availability_mode}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Capacidade</p>
                      <p className="font-semibold">{driver.max_active_deliveries} simultanea(s)</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Custo por entrega</p>
                      <p className="font-semibold">{formatCurrency(Number(driver.payout_per_delivery || 0))}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Despacho</p>
                      <p className="font-semibold">{atCapacity ? "No limite" : "Pode receber nova corrida"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={driver.availability_mode}
                      onValueChange={(value) => updateDriverMutation.mutate({
                        id: driver.id,
                        patch: {
                          availability_mode: value,
                          is_available: value === "online",
                        },
                      })}
                    >
                      <SelectTrigger className="w-[210px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="busy">Em rota</SelectItem>
                        <SelectItem value="paused">Em pausa</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateDriverMutation.mutate({
                        id: driver.id,
                        patch: { is_active: !driver.is_active },
                      })}
                    >
                      {driver.is_active ? "Desativar" : "Ativar"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateDriverMutation.mutate({
                        id: driver.id,
                        patch: {
                          availability_mode: "online",
                          is_available: true,
                        },
                      })}
                    >
                      <TimerReset className="h-4 w-4 mr-2" />
                      Liberar para fila
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Como isso fica redondo na operacao
          </p>
          <p>
            Deixa o entregador online para receber corrida, define um limite de carga por pessoa e usa o valor por entrega para fechar custo logistico do dia sem planilha improvisada.
          </p>
          <p className="mt-2">
            O ideal e manter o mesmo e-mail cadastrado aqui e na conta do entregador para o vinculo acontecer sem atrito.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

