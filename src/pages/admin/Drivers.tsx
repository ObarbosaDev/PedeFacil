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
import { buildWhatsAppSupportLink } from "@/lib/support";
import { toast } from "sonner";
import { Bike, CircleDollarSign, Copy, Phone, Plus, ShieldCheck, TimerReset, User } from "lucide-react";

type DriverRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  license_plate: string | null;
  avatar_url: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_notes: string | null;
  is_active: boolean;
  is_available: boolean;
  availability_mode: "online" | "busy" | "paused" | "offline";
  max_active_deliveries: number;
  payout_per_delivery: number;
};

type DriverPayoutRollup = {
  deliveries: number;
  payout: number;
  etaTotal?: number;
  paid: number;
  pending: number;
};

const defaultForm = {
  fullName: "",
  email: "",
  phone: "",
  vehicleType: "moto",
  vehicleBrand: "",
  vehicleModel: "",
  vehicleColor: "",
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

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

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

export default function Drivers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);
  const [payoutPeriod, setPayoutPeriod] = useState<PeriodValue>("30");
  const [driverFilter, setDriverFilter] = useState<string>("all");

  const payoutPeriodStartIso = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - Number(payoutPeriod));
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }, [payoutPeriod]);

  const payoutPeriodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === payoutPeriod)?.label || "30 dias",
    [payoutPeriod]
  );

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
        .select("id, driver_id, payout_amount, payout_status, delivered_at, eta_minutes")
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
    queryKey: ["fleet-delivered-periods", establishment?.id, payoutPeriod],
    queryFn: async () => {
      const endOfWindow = new Date();
      endOfWindow.setDate(endOfWindow.getDate() + 1);
      endOfWindow.setHours(0, 0, 0, 0);

      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, driver_id, payout_amount, payout_status, delivered_at, eta_minutes")
        .eq("establishment_id", establishment!.id)
        .eq("status", "delivered")
        .gte("delivered_at", payoutPeriodStartIso)
        .lt("delivered_at", endOfWindow.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const { data: payoutHistoryRows = [] } = useQuery({
    queryKey: ["fleet-payout-history", establishment?.id, payoutPeriod],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("id, driver_id, payout_amount, payout_status, payout_paid_at, payout_batch_ref, delivered_at")
        .eq("establishment_id", establishment!.id)
        .eq("status", "delivered")
        .not("payout_batch_ref", "is", null)
        .gte("delivered_at", payoutPeriodStartIso)
        .order("payout_paid_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!establishment,
  });

  const liveCountByDriver = (activeDeliveries as any[]).reduce<Record<string, number>>((acc, row: any) => {
    acc[row.driver_id] = (acc[row.driver_id] || 0) + 1;
    return acc;
  }, {});

  const deliveredTodayByDriver = useMemo(() => {
    return (deliveredToday as any[]).reduce<Record<string, DriverPayoutRollup>>((acc, row) => {
      if (!acc[row.driver_id]) {
        acc[row.driver_id] = { deliveries: 0, payout: 0, etaTotal: 0, paid: 0, pending: 0 };
      }
      const payout = Number(row.payout_amount || 0);
      acc[row.driver_id].deliveries += 1;
      acc[row.driver_id].payout += payout;
      acc[row.driver_id].etaTotal += Number(row.eta_minutes || 0);
      if (row.payout_status === "paid") acc[row.driver_id].paid += payout;
      else acc[row.driver_id].pending += payout;
      return acc;
    }, {});
  }, [deliveredToday]);

  const summarizeRowsByDriver = (rows: any[]) =>
    rows.reduce<Record<string, DriverPayoutRollup>>((acc, row) => {
      if (!acc[row.driver_id]) {
        acc[row.driver_id] = { deliveries: 0, payout: 0, paid: 0, pending: 0 };
      }
      const payout = Number(row.payout_amount || 0);
      acc[row.driver_id].deliveries += 1;
      acc[row.driver_id].payout += payout;
      if (row.payout_status === "paid") acc[row.driver_id].paid += payout;
      else acc[row.driver_id].pending += payout;
      return acc;
    }, {});

  const periodRows = useMemo(() => {
    const sourceRows = deliveredPeriodRows as any[];
    if (driverFilter === "all") return sourceRows;
    return sourceRows.filter((row) => row.driver_id === driverFilter);
  }, [deliveredPeriodRows, driverFilter]);

  const filteredDrivers = useMemo(() => {
    if (driverFilter === "all") return drivers;
    return drivers.filter((driver) => driver.id === driverFilter);
  }, [driverFilter, drivers]);

  const periodSummaryByDriver = useMemo(() => summarizeRowsByDriver(periodRows), [periodRows]);
  const payoutHistoryBatches = useMemo(() => {
    const batches = new Map<string, { ref: string; paidAt: string | null; total: number; deliveries: number; driverIds: Set<string> }>();
    const sourceRows =
      driverFilter === "all"
        ? (payoutHistoryRows as any[])
        : (payoutHistoryRows as any[]).filter((row) => row.driver_id === driverFilter);
    for (const row of sourceRows) {
      const ref = String(row.payout_batch_ref || "").trim();
      if (!ref) continue;
      if (!batches.has(ref)) {
        batches.set(ref, {
          ref,
          paidAt: row.payout_paid_at || null,
          total: 0,
          deliveries: 0,
          driverIds: new Set<string>(),
        });
      }
      const current = batches.get(ref)!;
      current.total += Number(row.payout_amount || 0);
      current.deliveries += 1;
      if (row.driver_id) current.driverIds.add(String(row.driver_id));
      if (!current.paidAt && row.payout_paid_at) current.paidAt = row.payout_paid_at;
    }
    return Array.from(batches.values())
      .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
      .map((batch) => ({
        ...batch,
        drivers: batch.driverIds.size,
      }));
  }, [driverFilter, payoutHistoryRows]);

  const payoutControlMutation = useMutation({
    mutationFn: async ({ driverId }: { driverId: string }) => {
      const pendingRows = periodRows.filter((row) => row.driver_id === driverId && row.payout_status !== "paid");

      if (!pendingRows.length) {
        throw new Error("Não há repasse pendente nesse período para este entregador.");
      }

      const batchRef = `repasse_${payoutPeriod}d_${new Date().toISOString().slice(0, 10)}_${driverId.slice(0, 8)}`;
      const { error } = await (supabase as any)
        .from("order_deliveries")
        .update({
          payout_status: "paid",
          payout_paid_at: new Date().toISOString(),
          payout_batch_ref: batchRef,
        })
        .in("id", pendingRows.map((row) => row.id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-delivered-today", establishment?.id] });
      queryClient.invalidateQueries({ queryKey: ["fleet-delivered-periods", establishment?.id] });
      queryClient.invalidateQueries({ queryKey: ["fleet-payout-history", establishment?.id] });
      toast.success("Repasse marcado como pago.");
    },
    onError: (error: any) => toast.error(error.message || "Não rolou marcar esse repasse como pago."),
  });

  const saveDriverMutation = useMutation({
    mutationFn: async () => {
      if (!establishment?.id) throw new Error("Loja não encontrada.");
      if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
        throw new Error("Preencha nome, e-mail e telefone.");
      }

      const { error } = await (supabase as any).from("delivery_drivers").insert({
        establishment_id: establishment.id,
        full_name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        vehicle_type: form.vehicleType,
        vehicle_brand: form.vehicleBrand.trim() || null,
        vehicle_model: form.vehicleModel.trim() || null,
        vehicle_color: form.vehicleColor.trim() || null,
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
    onError: (error: any) => toast.error(error.message || "Não rolou cadastrar entregador."),
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
    onError: (error: any) => toast.error(error.message || "Não rolou atualizar entregador."),
  });

  if (!establishment) {
    return <p className="text-center py-10 text-muted-foreground">Configura sua loja para gerenciar entregadores.</p>;
  }

  const total = drivers.length;
  const active = drivers.filter((driver) => driver.is_active).length;
  const online = drivers.filter((driver) => driver.availability_mode === "online" && driver.is_active).length;
  const busy = drivers.filter((driver) => ["busy"].includes(driver.availability_mode) || (liveCountByDriver[driver.id] || 0) > 0).length;
  const deliveredCountToday = (deliveredToday as any[]).length;
  const payoutToday = (deliveredToday as any[]).reduce((acc, row: any) => acc + Number(row.payout_amount || 0), 0);
  const payoutPendingToday = (deliveredToday as any[]).reduce((acc, row: any) => acc + (row.payout_status === "paid" ? 0 : Number(row.payout_amount || 0)), 0);
  const averagePayoutToday = deliveredCountToday > 0 ? payoutToday / deliveredCountToday : 0;
  const periodCount = periodRows.length;
  const periodPayout = periodRows.reduce((acc: number, row: any) => acc + Number(row.payout_amount || 0), 0);
  const periodPendingPayout = periodRows.reduce((acc: number, row: any) => acc + (row.payout_status === "paid" ? 0 : Number(row.payout_amount || 0)), 0);

  const exportPayoutCsv = () => {
    downloadCsv(
      `repasse-frota-${payoutPeriod}d-${driverFilter === "all" ? "todos" : driverFilter}.csv`,
      ["driver_id", "entregador", "deliveries", "payout_total", "paid_total", "pending_total"],
      filteredDrivers.map((driver) => {
        const summary = periodSummaryByDriver[driver.id] || { deliveries: 0, payout: 0, paid: 0, pending: 0 };
        return [driver.id, driver.full_name, summary.deliveries, summary.payout, summary.paid, summary.pending];
      })
    );
  };

  const dailyClosingText = useMemo(() => {
    const lines = [
      `Fechamento do dia - ${establishment.name}`,
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      `Entregas concluídas: ${deliveredCountToday}`,
      `Saída total do dia: ${formatCurrency(payoutToday)}`,
      `Repasse pendente: ${formatCurrency(payoutPendingToday)}`,
      `Média por entrega: ${formatCurrency(averagePayoutToday)}`,
      "",
      "Por entregador:",
      ...drivers.map((driver) => {
        const summary = deliveredTodayByDriver[driver.id] || { deliveries: 0, payout: 0, etaTotal: 0, paid: 0, pending: 0 };
        return `- ${driver.full_name}: ${summary.deliveries} entrega(s), repasse ${formatCurrency(summary.payout)}, pendente ${formatCurrency(summary.pending)}`;
      }),
    ];
    return lines.join("\n");
  }, [averagePayoutToday, deliveredCountToday, deliveredTodayByDriver, drivers, establishment?.name, payoutPendingToday, payoutToday]);

  const copyDailyClosing = async () => {
    try {
      await navigator.clipboard.writeText(dailyClosingText);
      toast.success("Fechamento copiado.");
    } catch {
      toast.error("Não rolou copiar o fechamento.");
    }
  };

  const shareDailyClosing = () => {
    const href = buildWhatsAppSupportLink(dailyClosingText);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Frota e entregadores</h1>
        <p className="text-muted-foreground">Cadastre, acompanhe a carga da frota e deixe o despacho mais redondo.</p>
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
          <CardTitle>Repasse por período</CardTitle>
          <CardDescription>Filtre a janela que faz sentido para fechamento, auditoria e acerto com a frota.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-[220px]">
              <Label>Janela de análise</Label>
              <Select value={payoutPeriod} onValueChange={(value) => setPayoutPeriod(value as PeriodValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full max-w-[260px]">
              <Label>Entregador</Label>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos da frota</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-xl border px-4 py-3">
              <p className="text-xs text-muted-foreground">Entregas</p>
              <p className="text-2xl font-bold">{periodCount}</p>
            </div>
            <div className="rounded-xl border px-4 py-3">
              <p className="text-xs text-muted-foreground">Repasse bruto</p>
              <p className="text-2xl font-bold">{formatCurrency(periodPayout)}</p>
            </div>
            <div className="rounded-xl border px-4 py-3">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-2xl font-bold">{formatCurrency(periodPendingPayout)}</p>
            </div>
            <Button variant="outline" onClick={exportPayoutCsv}>
              Exportar CSV
            </Button>
          </div>
          <div className="space-y-2">
            {filteredDrivers.map((driver) => {
              const summary = periodSummaryByDriver[driver.id] || { deliveries: 0, payout: 0, paid: 0, pending: 0 };
              return (
                <div key={`period-${driver.id}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{driver.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {summary.deliveries} entrega(s) em {payoutPeriodLabel} • pendente {formatCurrency(summary.pending)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{formatCurrency(summary.payout)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => payoutControlMutation.mutate({ driverId: driver.id })}
                      disabled={payoutControlMutation.isPending || summary.pending <= 0}
                    >
                      Marcar pago
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fechamento do dia</CardTitle>
          <CardDescription>Resumo do custo logístico de hoje, sem planilha improvisada nem gambiarra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyDailyClosing()}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar fechamento
            </Button>
            <Button variant="outline" size="sm" onClick={shareDailyClosing}>
              <CircleDollarSign className="h-4 w-4 mr-2" />
              Mandar no WhatsApp
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Saída total de hoje</p>
              <p className="text-2xl font-bold">{formatCurrency(payoutToday)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Corridas concluídas</p>
              <p className="text-2xl font-bold">{deliveredCountToday}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Média por entrega</p>
              <p className="text-2xl font-bold">{formatCurrency(averagePayoutToday)}</p>
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Repasse pendente hoje</p>
            <p className="text-2xl font-bold">{formatCurrency(payoutPendingToday)}</p>
          </div>

          {drivers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Por entregador</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {drivers.map((driver) => {
                  const driverSummary = deliveredTodayByDriver[driver.id] || { deliveries: 0, payout: 0, etaTotal: 0, paid: 0, pending: 0 };
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
                          <p className="text-xs text-muted-foreground">Média ETA</p>
                          <p className="font-semibold">{driverSummary.deliveries > 0 ? `${averageEta} min` : "-"}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Carga ao vivo</p>
                          <p className="font-semibold">{liveCountByDriver[driver.id] || 0}/{driver.max_active_deliveries}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Já pago</p>
                          <p className="font-semibold">{formatCurrency(driverSummary.paid)}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Pendente</p>
                          <p className="font-semibold">{formatCurrency(driverSummary.pending)}</p>
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
            <CardTitle>Janela atual</CardTitle>
            <CardDescription>Leitura consolidada da janela de {payoutPeriodLabel.toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Entregas</p>
                <p className="text-2xl font-bold">{periodCount}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Repasse</p>
                <p className="text-2xl font-bold">{formatCurrency(periodPayout)}</p>
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Pendente no período</p>
              <p className="text-2xl font-bold">{formatCurrency(periodPendingPayout)}</p>
            </div>
            <div className="space-y-2">
              {filteredDrivers.map((driver) => {
                const summary = periodSummaryByDriver[driver.id] || { deliveries: 0, payout: 0, paid: 0, pending: 0 };
                return (
                  <div key={`window-${driver.id}`} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{driver.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {summary.deliveries} entrega(s) • pendente {formatCurrency(summary.pending)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{formatCurrency(summary.payout)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => payoutControlMutation.mutate({ driverId: driver.id })}
                        disabled={payoutControlMutation.isPending || summary.pending <= 0}
                      >
                        Marcar pago
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico da janela</CardTitle>
            <CardDescription>Lotes fechados dentro da mesma janela selecionada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {payoutHistoryBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lote fechado em {payoutPeriodLabel.toLowerCase()}.</p>
            ) : (
              payoutHistoryBatches.slice(0, 6).map((batch) => (
                <div key={`window-history-${batch.ref}`} className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-semibold break-all">{batch.ref}</p>
                    <p className="text-sm text-muted-foreground">
                      {batch.deliveries} entrega(s) • {batch.drivers} entregador(es)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {batch.paidAt ? new Date(batch.paidAt).toLocaleString("pt-BR") : "-"}
                    </p>
                    <p className="text-lg font-bold">{formatCurrency(batch.total)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de repasses por lote</CardTitle>
          <CardDescription>Rastro dos pagamentos já marcados para a frota, com referência de lote e valor fechado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payoutHistoryBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há lotes de repasse fechados.</p>
          ) : (
            payoutHistoryBatches.map((batch) => (
              <div key={batch.ref} className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <p className="font-semibold break-all">{batch.ref}</p>
                  <p className="text-sm text-muted-foreground">
                    {batch.deliveries} entrega(s) • {batch.drivers} entregador(es)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pago em: {batch.paidAt ? new Date(batch.paidAt).toLocaleString("pt-BR") : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="default">Lote pago</Badge>
                  <p className="text-lg font-bold mt-2">{formatCurrency(batch.total)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

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
            <Label>Veículo</Label>
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
            <Label>Marca</Label>
            <Input value={form.vehicleBrand} onChange={(e) => setForm((prev) => ({ ...prev, vehicleBrand: e.target.value }))} placeholder="Honda, Yamaha, Fiat..." />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={form.vehicleModel} onChange={(e) => setForm((prev) => ({ ...prev, vehicleModel: e.target.value }))} placeholder="CG 160, Biz, Onix..." />
          </div>
          <div>
            <Label>Cor</Label>
            <Input value={form.vehicleColor} onChange={(e) => setForm((prev) => ({ ...prev, vehicleColor: e.target.value }))} placeholder="Preta, branca..." />
          </div>
          <div>
            <Label>Máximo de corridas simultâneas</Label>
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
          <CardTitle>Visão da frota</CardTitle>
          <CardDescription>Veja carga, disponibilidade e custo por corrida de cada entregador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há entregadores cadastrados.</p>
          ) : (
            drivers.map((driver) => {
              const liveDeliveries = liveCountByDriver[driver.id] || 0;
              const atCapacity = liveDeliveries >= driver.max_active_deliveries;

              return (
                <div key={driver.id} className="rounded-xl border p-4 bg-card space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      {driver.avatar_url ? (
                        <img
                          src={driver.avatar_url}
                          alt={driver.full_name}
                          className="h-12 w-12 rounded-full border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                          <User className="h-4 w-4" />
                        </div>
                      )}
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
                          {[driver.vehicle_type, driver.vehicle_brand, driver.vehicle_model].filter(Boolean).join(" • ") || "Veículo sem detalhes"}
                        </p>
                      </div>
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
                      <p className="font-semibold">{driver.max_active_deliveries} simultânea(s)</p>
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

                  {(driver.vehicle_color || driver.license_plate || driver.vehicle_notes) && (
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Identificação</p>
                      <p className="font-semibold">
                        {[driver.vehicle_color, driver.license_plate].filter(Boolean).join(" • ") || "Sem identificação adicional"}
                      </p>
                      {driver.vehicle_notes && <p className="mt-1 text-muted-foreground">{driver.vehicle_notes}</p>}
                    </div>
                  )}

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
            Como isso fica redondo na operação
          </p>
          <p>
            Deixa o entregador online para receber corrida, define um limite de carga por pessoa e usa o valor por entrega para fechar o custo logístico do dia sem planilha improvisada.
          </p>
          <p className="mt-2">
            O ideal é manter o mesmo e-mail cadastrado aqui e na conta do entregador para o vínculo acontecer sem atrito.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}



