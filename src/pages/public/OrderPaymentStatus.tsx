import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { createExternalOrderCheckout, revalidateExternalOrderPayment } from "@/lib/order-payments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const statusLabel: Record<string, string> = {
  pending_payment: "Pagamento pendente",
  paid: "Pagamento aprovado",
  failed: "Pagamento falhou",
  expired: "Cobrança expirada",
  canceled: "Cobrança cancelada",
};

export default function OrderPaymentStatus() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [paymentId, setPaymentId] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [autoRevalidateDone, setAutoRevalidateDone] = useState(false);

  const orderId = searchParams.get("order");
  const checkoutSessionId = searchParams.get("checkout_session_id");
  const paymentReturn = searchParams.get("payment_return");
  const paymentIdFromReturn = searchParams.get("payment_id") || searchParams.get("collection_id") || "";

  const { data: orderLink, isLoading } = useQuery({
    queryKey: ["customer-order-payment-status", user?.id, orderId, checkoutSessionId],
    queryFn: async () => {
      if (!orderId) throw new Error("Pedido não informado.");

      const { data, error } = await (supabase as any)
        .from("customer_order_links")
        .select(`
          id,
          orders:order_id (
            id,
            total,
            payment_status,
            payment_method,
            status,
            order_type,
            created_at,
            establishments:establishment_id (
              id,
              name,
              slug,
              whatsapp,
              pix_key,
              pix_recipient_name,
              pix_instructions
            )
          )
        `)
        .eq("user_id", user!.id)
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orderId,
    refetchInterval: (query) => {
      const row = query.state.data as any;
      const paymentStatus = row?.orders?.payment_status;
      return paymentStatus === "paid" ? false : 5000;
    },
  });

  const { data: paymentSession } = useQuery({
    queryKey: ["order-payment-session", user?.id, orderId, checkoutSessionId],
    queryFn: async () => {
      if (!orderId) throw new Error("Pedido não informado.");

      const query = (supabase as any)
        .from("order_payment_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (checkoutSessionId) {
        query.eq("checkout_session_id", checkoutSessionId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orderId,
    refetchInterval: (query) => {
      const row = query.state.data as any;
      return row?.status === "paid" ? false : 5000;
    },
  });

  useEffect(() => {
    if (!paymentReturn) return;
    if (paymentReturn === "success") {
      toast.success("Pagamento recebido. Estamos validando e liberando o pedido.");
    } else if (paymentReturn === "pending") {
      toast.info("Pagamento em análise. O status vai atualizar aqui.");
    } else if (paymentReturn === "failure") {
      toast.error("O pagamento não foi concluído. Você pode tentar de novo.");
    }
  }, [paymentReturn]);

  useEffect(() => {
    if (!paymentIdFromReturn) return;
    setPaymentId(paymentIdFromReturn);
  }, [paymentIdFromReturn]);

  const regenerateCheckoutMutation = useMutation({
    onMutate: () => setInlineError(null),
    mutationFn: async () => {
      if (!paymentSession?.checkout_session_id || !orderId) {
        throw new Error("Cobrança ainda não disponível para este pedido.");
      }
      const baseUrl = `${window.location.origin}/cliente/pagamento-pedido?order=${orderId}&checkout_session_id=${paymentSession.checkout_session_id}`;
      return createExternalOrderCheckout({
        checkoutSessionId: paymentSession.checkout_session_id,
        orderId,
        successUrl: `${baseUrl}&payment_return=success`,
        pendingUrl: `${baseUrl}&payment_return=pending`,
        failureUrl: `${baseUrl}&payment_return=failure`,
      });
    },
    onSuccess: (result) => {
      if (result.already_paid) {
        toast.success("Esse pedido já está pago.");
        void queryClient.invalidateQueries({ queryKey: ["customer-order-payment-status", user?.id, orderId, checkoutSessionId] });
        return;
      }

      if (!result.checkout_url) {
        throw new Error("A cobrança voltou sem link de pagamento.");
      }

      window.location.href = result.checkout_url;
    },
    onError: (error: any) => {
      const message = error?.message || "Não rolou abrir a cobrança agora.";
      setInlineError(message);
      toast.error(message);
    },
  });

  const revalidateMutation = useMutation({
    onMutate: () => setInlineError(null),
    mutationFn: async () => {
      if (!paymentSession?.checkout_session_id) {
        throw new Error("Cobrança ainda não criada para esse pedido.");
      }
      return revalidateExternalOrderPayment({
        checkoutSessionId: paymentSession.checkout_session_id,
        paymentId: paymentId.trim() || undefined,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["customer-order-payment-status", user?.id, orderId, checkoutSessionId] });
      await queryClient.invalidateQueries({ queryKey: ["order-payment-session", user?.id, orderId, checkoutSessionId] });
      if (result.revalidated) {
        toast.success("Pagamento revalidado com sucesso.");
      } else {
        toast.info("Ainda está pendente. Se você acabou de pagar, espera alguns segundos e tenta de novo.");
      }
    },
    onError: (error: any) => {
      const message = error?.message || "Não rolou atualizar o pagamento agora.";
      setInlineError(message);
      toast.error(message);
    },
  });

  useEffect(() => {
    if (autoRevalidateDone) return;
    if (!paymentIdFromReturn) return;
    if (!paymentSession?.checkout_session_id) return;
    setAutoRevalidateDone(true);
    revalidateMutation.mutate();
  }, [autoRevalidateDone, paymentIdFromReturn, paymentSession?.checkout_session_id, revalidateMutation]);

  const order = (orderLink as any)?.orders;
  const store = order?.establishments;
  const isPaid = order?.payment_status === "paid" || paymentSession?.status === "paid";
  const isManualPix =
    !paymentSession &&
    String(order?.payment_method || "").toLowerCase() === "pix" &&
    !!String(store?.pix_key || "").trim();
  const readableStatus = statusLabel[paymentSession?.status || order?.payment_status || "pending_payment"] || "Pagamento pendente";
  const formattedAmount = useMemo(() => {
    const amount = paymentSession?.amount_cents != null
      ? Number(paymentSession.amount_cents) / 100
      : Number(order?.total || 0);
    return formatCurrency(amount);
  }, [order?.total, paymentSession?.amount_cents]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Entre na sua conta para ver o pagamento</CardTitle>
            <CardDescription>Esse retorno fica disponível só para o cliente dono do pedido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/cliente/login">
              <Button className="w-full">Entrar na conta</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4ef] text-zinc-900 relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-28 -left-24 h-[26rem] w-[26rem] rounded-full bg-orange-300/25 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-[26rem] w-[26rem] rounded-full bg-emerald-300/20 blur-3xl" />
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <section className="rounded-3xl border border-zinc-200 bg-white/90 backdrop-blur p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Link to={store?.slug ? `/loja/${store.slug}` : "/cliente/conta"}>
              <Button variant="outline" className="rounded-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {store?.slug ? "Voltar para a loja" : "Voltar para sua conta"}
              </Button>
            </Link>

            <span className="inline-flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-2 border border-zinc-300 bg-white">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Pagamento protegido
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pagamento do pedido</p>
              <h1 className="text-3xl md:text-4xl font-black mt-2">
                {isPaid ? "Pedido pago e pronto para seguir o fluxo." : "Falta só fechar o pagamento para soltar o pedido."}
              </h1>
              <p className="text-zinc-600 mt-2">
                {store?.name ? `Loja: ${store.name}.` : "Seu pedido já foi registrado."} Aqui você acompanha cobrança, reabre o pagamento e confere se caiu.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 min-w-[240px]">
              <p className="text-xs text-zinc-500">Status atual</p>
              <p className="font-semibold mt-1">{readableStatus}</p>
              <p className="text-xs text-zinc-600 mt-1">Valor: {formattedAmount}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[0.62fr_0.38fr] gap-4">
          <Card className="border-zinc-200 bg-white shadow-[0_24px_80px_-55px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>{isManualPix ? "Pagamento PIX da loja" : "Voltar para a cobrança"}</CardTitle>
              <CardDescription>
                {isManualPix
                  ? "Pague no app do seu banco usando a chave abaixo e, em seguida, avise a loja."
                  : "Se você saiu do Mercado Pago ou a internet oscilou, pode reabrir a cobrança daqui sem duplicar pedido."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Pedido</p>
                    <p className="text-xs text-zinc-500 break-all">{orderId || "-"}</p>
                  </div>
                  <Badge variant={isPaid ? "default" : "secondary"}>{readableStatus}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="text-xs text-zinc-500">Forma atual</p>
                    <p className="font-semibold mt-1">
                      {paymentSession?.payment_method === "card" ? (
                        <span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4" /> Cartão</span>
                      ) : (
                        <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4" /> PIX</span>
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="text-xs text-zinc-500">Valor</p>
                    <p className="font-semibold mt-1">{formattedAmount}</p>
                  </div>
                </div>
              </div>

              {isManualPix ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-zinc-200 bg-white p-3">
                    <p className="text-xs text-zinc-500">Chave PIX da loja</p>
                    <p className="font-semibold break-all mt-1">{String(store?.pix_key || "-")}</p>
                    {store?.pix_recipient_name ? (
                      <p className="text-xs text-zinc-600 mt-1">Recebedor: {store.pix_recipient_name}</p>
                    ) : null}
                  </div>

                  {store?.pix_instructions ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                      {store.pix_instructions}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(String(store?.pix_key || ""));
                          toast.success("Chave PIX copiada.");
                        } catch {
                          toast.error("Não rolou copiar automaticamente. Copie manualmente.");
                        }
                      }}
                    >
                      Copiar chave PIX
                    </Button>
                    {store?.whatsapp ? (
                      <a
                        href={`https://wa.me/${String(store.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Oi, acabei de pagar o pedido ${orderId} via PIX. Pode confirmar para mim?`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="outline">Avisar loja no WhatsApp</Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => regenerateCheckoutMutation.mutate()} disabled={regenerateCheckoutMutation.isPending || isPaid}>
                    {regenerateCheckoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    {isPaid ? "Pagamento confirmado" : "Abrir cobrança de novo"}
                  </Button>
                </div>
              )}

              {inlineError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {inlineError}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white shadow-[0_24px_80px_-55px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>Atualizar status</CardTitle>
              <CardDescription>
                {isManualPix
                  ? "Depois de pagar no banco, avise a loja e aguarde a confirmação do pagamento no painel."
                  : "Se você já pagou e ainda está pendente, cola o `payment_id` para forçar a conferência."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isManualPix ? (
                <>
                  <Input
                    value={paymentId}
                    onChange={(event) => setPaymentId(event.target.value)}
                    placeholder="Ex.: 1234567890"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => revalidateMutation.mutate()}
                    disabled={revalidateMutation.isPending}
                  >
                    {revalidateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Atualizar status
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.reload()}
                >
                  Atualizar status do pedido
                </Button>
              )}

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 text-sm text-zinc-600">
                <p className="font-semibold text-zinc-900">Leitura rápida</p>
                <p>1. Pedido criado e seguro no sistema.</p>
                <p>2. {isManualPix ? "Você paga no app do seu banco via chave PIX da loja." : "Cobrança reaberta sem duplicar o pedido."}</p>
                <p>3. Assim que aprovar, o status sobe aqui e no painel da loja.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {isLoading ? (
          <div className="text-sm text-zinc-600">Carregando os dados do pagamento...</div>
        ) : null}
      </main>
    </div>
  );
}
