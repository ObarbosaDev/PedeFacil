import { supabase } from "@/integrations/supabase/client";

export function createTraceId() {
  return `trace_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function withTrace<T extends object>(payload: T, traceId: string) {
  return { ...payload, traceId };
}

export async function logAuditEvent(params: {
  actorUserId?: string | null;
  actorRole?: string;
  entityType: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await (supabase as any).from("audit_logs").insert({
      actor_user_id: params.actorUserId || null,
      actor_role: params.actorRole || null,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      action: params.action,
      metadata: params.metadata || {},
      user_agent: navigator.userAgent,
    });
  } catch {
    // deliberately silent to avoid blocking user flows
  }
}
