import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";

type OrderCheckoutPaymentMethod = "pix" | "card";

export type OrderPaymentSession = {
  order_id: string;
  checkout_session_id: string;
  status: "pending_payment" | "paid" | "failed" | "expired" | "canceled";
  payment_method: OrderCheckoutPaymentMethod;
  amount_cents: number;
  currency: string;
  payment_expires_at: string | null;
};

export type ExternalOrderCheckoutSession = {
  provider: "mercado_pago" | string;
  already_paid: boolean;
  checkout_url: string | null;
  preference_id: string | null;
  checkout_session_id: string;
  order_id: string;
};

const DEFAULT_HTTP_TIMEOUT_MS = 15000;

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  fallbackErrorMessage: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload: any = {};
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw new Error(payload?.message || fallbackErrorMessage);
    }

    return payload as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("A conexao demorou alem do esperado. Tente de novo em instantes.");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(fallbackErrorMessage);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function startOrderCheckoutSession(input: {
  orderId: string;
  paymentMethod: OrderCheckoutPaymentMethod;
}): Promise<OrderPaymentSession> {
  const { data, error } = await (supabase as any).rpc("start_order_checkout", {
    p_order_id: input.orderId,
    p_payment_method: input.paymentMethod,
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Nao foi possivel iniciar o pagamento do pedido agora.");
  }

  return data[0] as OrderPaymentSession;
}

export async function createExternalOrderCheckout(input: {
  checkoutSessionId: string;
  orderId: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
}): Promise<ExternalOrderCheckoutSession> {
  const apiBase = env.VITE_PAYMENTS_API_BASE_URL;
  return fetchJsonWithTimeout<ExternalOrderCheckoutSession>(
    `${apiBase}/api/payments/order/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkoutSessionId: input.checkoutSessionId,
        orderId: input.orderId,
        successUrl: input.successUrl,
        pendingUrl: input.pendingUrl,
        failureUrl: input.failureUrl,
      }),
    },
    "Nao foi possivel abrir a cobranca do pedido agora."
  );
}

export async function revalidateExternalOrderPayment(input: {
  checkoutSessionId: string;
  paymentId?: string;
}): Promise<{ status: string; payment_status?: string; revalidated: boolean; order_id?: string }> {
  const apiBase = env.VITE_PAYMENTS_API_BASE_URL;
  return fetchJsonWithTimeout<{ status: string; payment_status?: string; revalidated: boolean; order_id?: string }>(
    `${apiBase}/api/payments/order/revalidate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkoutSessionId: input.checkoutSessionId,
        paymentId: input.paymentId || null,
      }),
    },
    "Nao foi possivel atualizar o pagamento do pedido agora."
  );
}
