import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await (supabase as any).rpc("start_plan_checkout", {
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

export async function confirmPlanPayment(input: {
  checkoutSessionId: string;
  providerEventId?: string;
  providerName?: string;
}): Promise<{ subscription_id: string; status: SubscriptionStatus; current_period_end: string | null }> {
  const normalizedCheckoutSessionId = input.checkoutSessionId.trim();
  if (!normalizedCheckoutSessionId) {
    throw new Error("Sessao de checkout invalida.");
  }

  const sanitizedSessionId = normalizedCheckoutSessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
  const providerEventId =
    input.providerEventId ||
    `evt_checkout_${sanitizedSessionId || "fallback"}`;

  const { data, error } = await (supabase as any).rpc("confirm_plan_payment_webhook", {
    p_checkout_session_id: normalizedCheckoutSessionId,
    p_provider_event_id: providerEventId,
    p_provider_name: input.providerName || "internal_demo",
    p_payload: {
      source: "frontend_simulation",
      created_at: new Date().toISOString(),
    },
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Não foi possível confirmar o pagamento.");
  }

  return data[0] as { subscription_id: string; status: SubscriptionStatus; current_period_end: string | null };
}
