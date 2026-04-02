import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";

export type BillingCycle = "monthly" | "yearly";
export type CheckoutPaymentMethod = "pix" | "card";
export type SubscriptionStatus = "pending_payment" | "active" | "past_due" | "canceled" | "expired";

export type StoreSubscription = {
  subscription_id: string;
  plan_slug: "essencial" | "profissional" | "premium";
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  payment_method: CheckoutPaymentMethod;
  checkout_session_id: string;
  amount_cents: number;
  currency: string;
  paid_at: string | null;
  current_period_end: string | null;
  payment_expires_at: string | null;
  created_at: string;
};

export type CheckoutSession = {
  subscription_id: string;
  checkout_session_id: string;
  plan_slug: "essencial" | "profissional" | "premium";
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  payment_method: CheckoutPaymentMethod;
  amount_cents: number;
  currency: string;
  payment_expires_at: string | null;
};

export type ExternalCheckoutSession = {
  provider: "mercado_pago" | string;
  already_active: boolean;
  checkout_url: string | null;
  preference_id: string | null;
  checkout_session_id: string;
};

export async function getMyStoreSubscription(): Promise<StoreSubscription | null> {
  const { data, error } = await (supabase as any).rpc("get_my_store_subscription");
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as StoreSubscription;
}

export async function canAccessStorePanel(): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("can_access_store_panel");
  if (error) throw error;
  return !!data;
}

export async function startPlanCheckout(input: {
  planSlug: "essencial" | "profissional" | "premium";
  billingCycle: BillingCycle;
  paymentMethod: CheckoutPaymentMethod;
}): Promise<CheckoutSession> {
  const { data, error } = await (supabase as any).rpc("start_plan_checkout_v2", {
    p_plan_slug: input.planSlug,
    p_billing_cycle: input.billingCycle,
    p_payment_method: input.paymentMethod,
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Não foi possível iniciar o checkout agora.");
  }

  return data[0] as CheckoutSession;
}

export async function createExternalPlanCheckout(input: {
  checkoutSessionId: string;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
}): Promise<ExternalCheckoutSession> {
  const apiBase = env.VITE_PAYMENTS_API_BASE_URL || "http://localhost:8081";
  const response = await fetch(`${apiBase}/api/payments/plan/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      checkoutSessionId: input.checkoutSessionId,
      successUrl: input.successUrl,
      pendingUrl: input.pendingUrl,
      failureUrl: input.failureUrl,
    }),
  });

  const rawText = await response.text();
  let payload: any = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { raw: rawText };
  }

  if (!response.ok) {
    const fallback =
      typeof payload?.raw === "string" && payload.raw.trim()
        ? payload.raw.slice(0, 220)
        : "Não foi possível iniciar o pagamento agora.";
    throw new Error(payload?.message || fallback);
  }

  return payload as ExternalCheckoutSession;
}

export async function revalidateExternalPlanPayment(input: {
  checkoutSessionId: string;
  paymentId?: string;
}): Promise<{ status: string; payment_status?: string; revalidated: boolean }> {
  const apiBase = env.VITE_PAYMENTS_API_BASE_URL || "http://localhost:8081";
  const response = await fetch(`${apiBase}/api/payments/plan/revalidate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      checkoutSessionId: input.checkoutSessionId,
      paymentId: input.paymentId || null,
    }),
  });

  const rawText = await response.text();
  let payload: any = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { raw: rawText };
  }

  if (!response.ok) {
    const fallback =
      typeof payload?.raw === "string" && payload.raw.trim()
        ? payload.raw.slice(0, 220)
        : "Não foi possível revalidar o pagamento agora.";
    throw new Error(payload?.message || fallback);
  }

  return payload as { status: string; payment_status?: string; revalidated: boolean };
}
