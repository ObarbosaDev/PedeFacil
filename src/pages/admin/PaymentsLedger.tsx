import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { buildWhatsAppSupportLink } from "@/lib/support";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StateCard from "@/components/system/StateCard";
import HelpCenterCard from "@/components/system/HelpCenterCard";
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from "@/lib/formatters";
import { CreditCard, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

const PAYMENT_STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "approved", label: "Aprovados" },
  { value: "pending", label: "Pendentes" },
  { value: "failed", label: "Falhados" },
] as const;

type PaymentStatusFilter = (typeof PAYMENT_STATUS_OPTIONS)[number]["value"];

const PAYMENT_METHOD_FILTER_OPTIONS = [
  { value: "all", label: "Todos os meios" },
  { value: "pix", label: "PIX" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "money", label: "Dinheiro" },
  { value: "meal_voucher", label: "Vale alimentação" },
  { value: "subscription", label: "Assinatura" },
] as const;

type PaymentMethodFilter = (typeof PAYMENT_METHOD_FILTER_OPTIONS)[number]["value"];

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

type LedgerRow = {
  id: string;
  checkout_session_id: string;
  provider_name: string;
  provider_payment_id: string | null;
  provider_event_id: string;
  status: string;
  amount_cents: number | null;
  currency: string | null;
  processed_at: string;
  payload: Record<string, unknown> | null;
};

type OrderPaymentSessionRow = {
  id: string;
  checkout_session_id: string;
  status: string;
  payment_method: string;
  amount_cents: number;
  paid_at: string | null;
  orders: {
    id: string;
    total: number;
    payment_status: string;
    customer_name: string;
    customer_phone: string;
    created_at: string;
    status: string;
  } | null;
};

type StoreSubscriptionRow = {
  id: string;
  checkout_session_id: string;
  status: string;
  plan_slug: string;
  amount_cents: number;
  paid_at: string | null;
};

type FinancialOrderRow = {
  id: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  service_fee: number;
  payment_status: string;
  status: string;
  created_at: string;
};

type DeliveryPayoutRow = {
  order_id: string;
  payout_amount: number;
  status: string;
  created_at: string;
};

export default function PaymentsLedger() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodValue>("30");
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>("all");

  const periodStartIso = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - Number(period));
    return start.toISOString();
  }, [period]);

  const periodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.value === period)?.label || "30 dias",
    [period]
  );

  const { data: establishment } = useQuery({
    queryKey: ["my-establishment-finance"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("establishments")
        .select("id, platform_fee_percent")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: ledgerRows = [], isLoading, error } = useQuery<LedgerRow[]>({
    queryKey: ["payments-ledger", user?.id, period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payments_ledger")
        .select("*")
        .gte("processed_at", periodStartIso)
        .order("processed_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data || []) as LedgerRow[];
    },
    enabled: !!user && !!establishment?.id,
  });

  const { data: orderPaymentSessions = [] } = useQuery<OrderPaymentSessionRow[]>({
    queryKey: ["order-payment-sessions-ledger", user?.id, establishment?.id, period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_payment_sessions")
        .select(`
          id,
          checkout_session_id,
          status,
          payment_method,
          amount_cents,
          paid_at,
          orders:order_id (
            id,
            total,
            payment_status,
            customer_name,
            customer_phone,
            created_at,
            status
          )
        `)
        .eq("establishment_id", establishment!.id)
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data || []) as OrderPaymentSessionRow[];
    },
    enabled: !!user && !!establishment?.id,
  });

  const { data: subscriptionRows = [] } = useQuery<StoreSubscriptionRow[]>({
    queryKey: ["store-subscriptions-ledger", user?.id, period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_subscriptions")
        .select("id, checkout_session_id, status, plan_slug, amount_cents, paid_at")
        .gte("created_at", periodStartIso)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as StoreSubscriptionRow[];
    },
    enabled: !!user,
  });

  const { data: financialOrders = [] } = useQuery<FinancialOrderRow[]>({
    queryKey: ["financial-orders", establishment?.id, period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, total, subtotal, discount_amount, delivery_fee, service_fee, payment_status, status, created_at")
        .eq("establishment_id", establishment!.id)
        .gte("created_at", periodStartIso);
      if (error) throw error;
      return (data || []) as FinancialOrderRow[];
    },
    enabled: !!user && !!establishment?.id,
  });

  const { data: deliveryPayouts = [] } = useQuery<DeliveryPayoutRow[]>({
    queryKey: ["financial-delivery-payouts", establishment?.id, period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_deliveries")
        .select("order_id, payout_amount, status, created_at")
        .eq("establishment_id", establishment!.id)
        .gte("created_at", periodStartIso);
      if (error) throw error;
      return (data || []) as DeliveryPayoutRow[];
    },
    enabled: !!user && !!establishment?.id,
  });

  const orderSessionByCheckout = useMemo(
    () => new Map(orderPaymentSessions.map((row) => [row.checkout_session_id, row])),
    [orderPaymentSessions]
  );

  const subscriptionByCheckout = useMemo(
    () => new Map(subscriptionRows.map((row) => [row.checkout_session_id, row])),
    [subscriptionRows]
  );

  const enrichedRows = useMemo(() => {
    return ledgerRows.map((row) => {
      const orderPayment = orderSessionByCheckout.get(row.checkout_session_id);
      const subscription = subscriptionByCheckout.get(row.checkout_session_id);
      const sourceType = orderPayment ? "order" : subscription ? "subscription" : "unknown";

      return {
        ...row,
        sourceType,
        orderPayment,
        subscription,
      };
    });
  }, [ledgerRows, orderSessionByCheckout, subscriptionByCheckout]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedRows.filter((row) => {
      const normalizedStatus = String(row.status || "").toLowerCase();
      const normalizedMethod =
        row.sourceType === "subscription"
          ? "subscription"
          : String(row.orderPayment?.payment_method === "card" ? "credit_card" : row.orderPayment?.payment_method || "").toLowerCase();
      const approvedStatuses = new Set(["approved", "paid"]);
      const pendingStatuses = new Set(["pending", "pending_payment", "in_process"]);
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "approved" && approvedStatuses.has(normalizedStatus)) ||
        (statusFilter === "pending" && pendingStatuses.has(normalizedStatus)) ||
        (statusFilter === "failed" && !approvedStatuses.has(normalizedStatus) && !pendingStatuses.has(normalizedStatus));
      if (!statusMatches) return false;
      if (paymentMethodFilter !== "all" && normalizedMethod !== paymentMethodFilter) return false;
      if (!term) return true;
      const order = row.orderPayment?.orders;
      return (
        String(row.checkout_session_id || "").toLowerCase().includes(term) ||
        String(row.provider_payment_id || "").toLowerCase().includes(term) ||
        String(row.provider_event_id || "").toLowerCase().includes(term) ||
        String(row.status || "").toLowerCase().includes(term) ||
        String(row.sourceType || "").toLowerCase().includes(term) ||
        String(order?.customer_name || "").toLowerCase().includes(term) ||
        String(order?.customer_phone || "").toLowerCase().includes(term) ||
        String(order?.id || "").toLowerCase().includes(term) ||
        String(row.subscription?.plan_slug || "").toLowerCase().includes(term)
      );
    });
  }, [enrichedRows, search, statusFilter, paymentMethodFilter]);

  const metrics = useMemo(() => {
    const approvedStatuses = new Set(["approved", "paid"]);
    const pendingStatuses = new Set(["pending", "pending_payment", "in_process"]);
    const approved = rows.filter((row) => approvedStatuses.has(String(row.status || "").toLowerCase()));
    const pending = rows.filter((row) => pendingStatuses.has(String(row.status || "").toLowerCase()));
    const orderApproved = approved.filter((row) => row.sourceType === "order");
    const approvedAmount = approved.reduce((sum, row) => sum + Number((row.amount_cents || 0) / 100), 0);

    return {
      total: rows.length,
      approved: approved.length,
      pending: pending.length,
      orderApproved: orderApproved.length,
      approvedAmount,
    };
  }, [rows]);

  const exportFinanceCsv = () => {
    downloadCsv(
      `financeiro-${period}d-${statusFilter}.csv`,
      [
        "checkout_session_id",
        "origem",
        "status_evento",
        "valor_evento",
        "cliente",
        "telefone",
        "pedido_id",
        "status_pedido",
        "metodo_pagamento",
        "processado_em",
        "payment_id",
        "event_id",
      ],
      rows.map((row) => {
        const order = row.orderPayment?.orders;
        return [
          row.checkout_session_id,
          row.sourceType,
          row.status,
          row.amount_cents ? Number(row.amount_cents) / 100 : "",
          order?.customer_name || "",
          order?.customer_phone || "",
          order?.id || "",
          order?.payment_status || row.subscription?.status || "",
          row.orderPayment?.payment_method || "",
          row.processed_at,
          row.provider_payment_id || "",
          row.provider_event_id,
        ];
      })
    );
  };

  const settlement = useMemo(() => {
    const paidOrders = financialOrders.filter((row) => row.payment_status === "paid");
    const grossPaid = paidOrders.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const subtotalPaid = paidOrders.reduce((sum, row) => sum + Number(row.subtotal || 0), 0);
    const discounts = paidOrders.reduce((sum, row) => sum + Number(row.discount_amount || 0), 0);
    const deliveryFees = paidOrders.reduce((sum, row) => sum + Number(row.delivery_fee || 0), 0);
    const serviceFees = paidOrders.reduce((sum, row) => sum + Number(row.service_fee || 0), 0);
    const platformFeePercent = Number((establishment as any)?.platform_fee_percent || 0);
    const platformFeeAmount = grossPaid * (platformFeePercent / 100);
    const driverPayout = deliveryPayouts.reduce((sum, row) => sum + Number(row.payout_amount || 0), 0);
    const estimatedStoreNet = grossPaid - platformFeeAmount - driverPayout;

    const todayKey = new Date().toISOString().slice(0, 10);
    const paidToday = paidOrders.filter((row) => String(row.created_at || "").slice(0, 10) === todayKey);
    const grossToday = paidToday.reduce((sum, row) => sum + Number(row.total || 0), 0);

    return {
      grossPaid,
      subtotalPaid,
      discounts,
      deliveryFees,
      serviceFees,
      platformFeePercent,
      platformFeeAmount,
      driverPayout,
      estimatedStoreNet,
      paidOrdersCount: paidOrders.length,
      grossToday,
    };
  }, [deliveryPayouts, establishment, financialOrders]);

  const financeClosingText = useMemo(() => {
    return [
      `Fechamento financeiro - ${periodLabel}`,
      `Eventos visíveis: ${metrics.total}`,
      `Aprovados: ${metrics.approved}`,
      `Pendentes: ${metrics.pending}`,
      `Pedidos pagos: ${metrics.orderApproved}`,
      `Volume aprovado: ${formatCurrency(metrics.approvedAmount)}`,
      `Bruto pago: ${formatCurrency(settlement.grossPaid)}`,
      `Taxa da plataforma: ${formatCurrency(settlement.platformFeeAmount)}`,
      `Repasse motoboy: ${formatCurrency(settlement.driverPayout)}`,
      `Líquido estimado: ${formatCurrency(settlement.estimatedStoreNet)}`,
      `Filtro de status: ${PAYMENT_STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label || "Todos os status"}`,
      `Filtro de meio: ${PAYMENT_METHOD_FILTER_OPTIONS.find((option) => option.value === paymentMethodFilter)?.label || "Todos os meios"}`,
    ].join("\n");
  }, [metrics, paymentMethodFilter, periodLabel, settlement, statusFilter]);

  const manualReviewRows = useMemo(() => {
    const now = Date.now();
    return rows
      .map((row) => {
        const order = row.orderPayment?.orders;
        const normalizedStatus = String(row.status || "").toLowerCase();
        const processedAt = new Date(row.processed_at).getTime();
        const ageMinutes = Math.max(0, Math.round((now - processedAt) / 60000));
        const reasons: string[] = [];

        if (!order && row.sourceType === "unknown") reasons.push("Evento sem vínculo local");
        if (normalizedStatus === "approved" && order && order.payment_status !== "paid") {
          reasons.push("Evento aprovado, mas pedido ainda não ficou pago");
        }
        if (["pending", "pending_payment", "in_process"].includes(normalizedStatus) && ageMinutes >= 20) {
          reasons.push("Pagamento pendente há tempo demais");
        }
        if (row.provider_event_id && rows.filter((item) => item.provider_event_id === row.provider_event_id).length > 1) {
          reasons.push("Mesmo event id apareceu mais de uma vez");
        }

        return {
          ...row,
          order,
          ageMinutes,
          reasons,
        };
      })
      .filter((row) => row.reasons.length > 0)
      .sort((a, b) => b.ageMinutes - a.ageMinutes);
  }, [rows]);

  const copyFinanceClosing = async () => {
    try {
      await navigator.clipboard.writeText(financeClosingText);
      toast.success("Fechamento financeiro copiado.");
    } catch {
      toast.error("Não rolou copiar o fechamento financeiro.");
    }
  };

  const shareFinanceClosing = () => {
    window.open(buildWhatsAppSupportLink(financeClosingText), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-3xl border bg-card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-10 right-0 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl pointer-events-none" />
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Pagamento no app e conciliação
        </div>
        <h1 className="text-3xl md:text-4xl font-black mt-4">Financeiro da plataforma, sem ponto cego.</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Aqui fica o rastro do que caiu, do que ainda está pendente e de qual pedido isso faz parte. O lojista para de operar no escuro.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Eventos</p><p className="text-2xl font-bold">{metrics.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aprovados</p><p className="text-2xl font-bold">{metrics.approved}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pedidos pagos</p><p className="text-2xl font-bold">{metrics.orderApproved}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Volume aprovado</p><p className="text-2xl font-bold">{formatCurrency(metrics.approvedAmount)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bruto pago {periodLabel}</p><p className="text-2xl font-bold">{formatCurrency(settlement.grossPaid)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bruto hoje</p><p className="text-2xl font-bold">{formatCurrency(settlement.grossToday)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Taxa plataforma</p><p className="text-2xl font-bold">{formatCurrency(settlement.platformFeeAmount)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Repasse motoboy</p><p className="text-2xl font-bold">{formatCurrency(settlement.driverPayout)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Frete cobrado</p><p className="text-2xl font-bold">{formatCurrency(settlement.deliveryFees)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Líquido estimado</p><p className="text-2xl font-bold">{formatCurrency(settlement.estimatedStoreNet)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar evento ou cobrança</CardTitle>
          <CardDescription>Procure por session, payment id, pedido, cliente, telefone ou status. A janela abaixo corta o ruído.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_220px_220px_auto_auto]">
          <Input
            placeholder="Ex.: Maria, approved, ordpay..., mp-123, profissional"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodValue)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Janela: {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PaymentStatusFilter)}
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={paymentMethodFilter}
            onChange={(event) => setPaymentMethodFilter(event.target.value as PaymentMethodFilter)}
          >
            {PAYMENT_METHOD_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => void copyFinanceClosing()}>
            Copiar fechamento
          </Button>
          <Button variant="outline" onClick={shareFinanceClosing}>
            Mandar no WhatsApp
          </Button>
          <Button variant="outline" onClick={exportFinanceCsv}>
            Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[0.68fr_0.32fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><ReceiptText className="h-5 w-5" /> Conciliação por evento</CardTitle>
            <CardDescription>Base real para suporte, auditoria e leitura do caixa digital sem chute.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando financeiro...</div>
            ) : error ? (
              <div className="text-sm text-destructive">Não rolou carregar o financeiro agora.</div>
            ) : rows.length === 0 ? (
              <StateCard
                title="Nenhum evento encontrado"
                description="Ainda não caiu nada nessa janela. Se você esperava movimento, confira o período e os filtros."
              />
            ) : (
              rows.map((row) => {
                const order = row.orderPayment?.orders;
                const orderLink = order ? `/admin/pedidos` : null;
                const normalizedStatus = String(row.status || "").toLowerCase();
                const isApproved = normalizedStatus === "approved" || normalizedStatus === "paid";
                const platformFeeAmount = order
                  ? Number(order.total || 0) * (Number((establishment as any)?.platform_fee_percent || 0) / 100)
                  : 0;
                const payoutAmount = order
                  ? Number(
                      deliveryPayouts.find((item) => item.order_id === order.id)?.payout_amount || 0
                    )
                  : 0;
                const estimatedStoreNet = order
                  ? Number(order.total || 0) - platformFeeAmount - payoutAmount
                  : 0;

                return (
                  <div key={row.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={isApproved ? "default" : "outline"}>
                            {isApproved ? "Aprovado" : row.status || "unknown"}
                          </Badge>
                          <Badge variant="secondary">
                            {row.sourceType === "order" ? "Pedido" : row.sourceType === "subscription" ? "Assinatura" : "Não classificado"}
                          </Badge>
                          {row.orderPayment && (
                            <Badge variant="outline">
                              {PAYMENT_METHOD_LABELS[(row.orderPayment.payment_method === "card" ? "credit_card" : row.orderPayment.payment_method) as keyof typeof PAYMENT_METHOD_LABELS] || row.orderPayment.payment_method}
                            </Badge>
                          )}
                        </div>
                        <p className="font-semibold text-sm break-all">{row.checkout_session_id}</p>
                      </div>
                      <p className="text-sm font-semibold">{row.amount_cents ? formatCurrency(Number(row.amount_cents) / 100) : "-"}</p>
                    </div>

                    {order ? (
                      <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={order.payment_status === "paid" ? "default" : "outline"}>
                              {order.payment_status === "paid" ? "Pedido pago" : "Pedido pendente"}
                            </Badge>
                            <Badge variant="secondary">{order.status}</Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <p className="break-all">Pedido: {order.id}</p>
                          <p>Criado em: {formatDate(order.created_at)}</p>
                          <p>Total do pedido: {formatCurrency(Number(order.total || 0))}</p>
                          <p>Processado em: {new Date(row.processed_at).toLocaleString("pt-BR")}</p>
                          <p>Taxa da plataforma: {formatCurrency(platformFeeAmount)}</p>
                          <p>Repasse do motoboy: {formatCurrency(payoutAmount)}</p>
                          <p className="font-medium text-foreground">Líquido estimado da loja: {formatCurrency(estimatedStoreNet)}</p>
                        </div>

                        {orderLink && (
                          <Link to={orderLink}>
                            <Button variant="outline" size="sm">Abrir no Kanban</Button>
                          </Link>
                        )}
                      </div>
                    ) : row.subscription ? (
                      <div className="rounded-xl border bg-muted/20 p-3 space-y-2 text-sm">
                        <p className="font-semibold">Assinatura do lojista</p>
                        <p className="text-muted-foreground">
                          Plano {row.subscription.plan_slug} • status {row.subscription.status}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                        Evento sem vínculo carregado. Vale revisar se a session existe no banco.
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p className="break-all">Payment ID: {row.provider_payment_id || "-"}</p>
                      <p className="break-all">Event ID: {row.provider_event_id}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><WalletCards className="h-5 w-5" /> Leitura operacional</CardTitle>
            <CardDescription>O que realmente importa no dia a dia da operação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="font-semibold">Fila de revisão manual</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {manualReviewRows.length > 0
                  ? `${manualReviewRows.length} evento(s) merecem olhar humano antes de você confiar no fechamento.`
                  : "Nenhum evento gritando por revisão agora."}
              </p>
              <div className="mt-3 space-y-2">
                {manualReviewRows.length === 0 ? (
                  <StateCard
                    title="Sem revisão pendente"
                    description="Boa. O que apareceu aqui bate com o esperado da operação."
                  />
                ) : (
                  manualReviewRows.slice(0, 4).map((row) => (
                    <div key={row.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-semibold break-all">{row.checkout_session_id}</p>
                        <Badge variant="outline">há {row.ageMinutes} min</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {row.order?.customer_name || row.subscription?.plan_slug || "Sem vínculo"} • {row.status}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {row.reasons.map((reason) => (
                          <li key={reason}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="font-semibold">Fechamento direto</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Subtotal vendido</span>
                  <span className="font-medium">{formatCurrency(settlement.subtotalPaid)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Descontos</span>
                  <span className="font-medium text-emerald-700">- {formatCurrency(settlement.discounts)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Taxa de serviço</span>
                  <span className="font-medium">{formatCurrency(settlement.serviceFees)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Taxa da plataforma ({settlement.platformFeePercent.toFixed(0)}%)</span>
                  <span className="font-medium">- {formatCurrency(settlement.platformFeeAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t pt-2">
                  <span className="font-semibold">Líquido estimado da loja</span>
                  <span className="font-bold">{formatCurrency(settlement.estimatedStoreNet)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="font-semibold inline-flex items-center gap-2"><CreditCard className="h-4 w-4" /> Pedido pago x pendente</p>
              <p className="text-sm text-muted-foreground mt-2">
                Se o pedido estiver com pagamento pendente, o Kanban e o financeiro mostram isso de cara. Sem adivinhação.
              </p>
            </div>
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="font-semibold">Checklist rápido</p>
              <p className="text-sm text-muted-foreground mt-2">
                1. evento aprovado,
                2. pedido marcado como pago,
                3. valor coerente,
                4. nada duplicado para a mesma session.
              </p>
            </div>
            <div className="rounded-xl border p-4 bg-zinc-950 text-zinc-100">
              <p className="text-xs uppercase tracking-wider text-zinc-400">Direção recomendada</p>
              <p className="text-sm mt-2 text-zinc-300">
                Próximo nível aqui é repasse: separar o que é da loja, da plataforma e do entregador sem bagunçar a operação.
              </p>
            </div>
            <HelpCenterCard
              title="Quando o financeiro sair do trilho"
              description="Atalhos práticos para não deixar cobrança pendurada virar dor maior."
              supportMessage="Preciso de apoio para revisar eventos de pagamento e conciliação da loja."
              topics={[
                {
                  title: "Evento aprovado, pedido não pago",
                  description: "Revise webhook, status local e duplicidade por session. Se necessário, revalide antes de mexer manualmente.",
                },
                {
                  title: "Session sem vínculo",
                  description: "Confira se o checkout foi salvo no banco ou se o evento chegou antes da gravação local.",
                },
                {
                  title: "Pendente há tempo demais",
                  description: "Se passou do tempo normal do meio de pagamento, trate como revisão manual e alinhe com suporte ou cliente.",
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
