import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "pedefacil.session.id";

export function getOrCreateSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = `sess_${crypto.randomUUID().replace(/-/g, "")}`;
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

export async function trackCheckoutEvent(params: {
  establishmentId?: string | null;
  userId?: string | null;
  eventName: "menu_view" | "add_to_cart" | "checkout_view" | "order_submitted";
  metadata?: Record<string, unknown>;
}) {
  try {
    await (supabase as any).from("checkout_events").insert({
      establishment_id: params.establishmentId || null,
      user_id: params.userId || null,
      event_name: params.eventName,
      session_id: getOrCreateSessionId(),
      metadata: params.metadata || {},
    });
  } catch {
    // non-blocking analytics
  }
}
