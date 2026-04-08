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

export async function logClientError(params: {
  scope: "app" | "route" | "query";
  message: string;
  stack?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await (supabase as any).from("audit_logs").insert({
      actor_user_id: null,
      actor_role: "system",
      entity_type: "frontend_error",
      entity_id: null,
      action: `client_${params.scope}_error`,
      metadata: {
        message: params.message,
        stack: params.stack || null,
        ...params.metadata,
      },
      user_agent: navigator.userAgent,
    });
  } catch {
    // deliberately silent to avoid cascaded failures
  }
}

let globalErrorHandlersAttached = false;

export function initClientErrorMonitoring() {
  if (globalErrorHandlersAttached) return;
  globalErrorHandlersAttached = true;

  window.addEventListener("error", (event) => {
    void logClientError({
      scope: "app",
      message: event.message || "Erro global de janela",
      stack: (event.error as Error | undefined)?.stack || null,
      metadata: {
        source: "window.onerror",
        file: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string } | string | null;
    const message =
      typeof reason === "string"
        ? reason
        : reason?.message || "Promise rejeitada sem tratamento";
    const stack = typeof reason === "string" ? null : reason?.stack || null;
    void logClientError({
      scope: "app",
      message,
      stack,
      metadata: {
        source: "window.unhandledrejection",
      },
    });
  });
}
