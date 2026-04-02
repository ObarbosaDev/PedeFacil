import { logAuditEvent } from "@/lib/observability";

type ProductEventName =
  | "funnel_home_cta_click"
  | "funnel_plans_view"
  | "funnel_plan_selected"
  | "funnel_checkout_started"
  | "funnel_checkout_payment_method_selected"
  | "funnel_checkout_payment_generated"
  | "funnel_checkout_payment_confirmed"
  | "funnel_account_created"
  | "funnel_login_success";

export async function trackProductEvent(
  eventName: ProductEventName,
  metadata?: Record<string, unknown>
) {
  await logAuditEvent({
    actorUserId: null,
    actorRole: "visitor",
    entityType: "product_event",
    action: eventName,
    metadata: metadata || {},
  });
}
