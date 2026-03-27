import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;

type EventRow = {
  id: string;
  establishment_id: string;
  order_id: string | null;
  customer_phone: string;
  event_key: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  created_at: string;
};

type SettingsRow = {
  establishment_id: string;
  is_enabled: boolean;
  webhook_url: string | null;
  webhook_secret: string | null;
  provider_name: string;
  send_on_new_order: boolean;
  send_on_status_change: boolean;
  send_out_of_hours: boolean;
};

type TemplateRow = {
  establishment_id: string;
  event_key: string;
  template_text: string;
  is_active: boolean;
};

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value || "Erro desconhecido");
}

function renderTemplate(template: string, payload: Record<string, unknown>): string {
  const normalized = template.replace(/\#\{\s*([a-zA-Z0-9_]+)\s*\}/g, "{$1}");

  return normalized.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_, key: string) => {
    const raw = payload[key];
    if (raw == null) return "";
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  });
}

function shouldSendEvent(settings: SettingsRow, eventKey: string): boolean {
  if (!settings.is_enabled) return false;
  if (!settings.webhook_url) return false;

  if (eventKey === "new_order") return settings.send_on_new_order;
  if (eventKey.startsWith("status_")) return settings.send_on_status_change;
  if (eventKey === "out_of_hours") return settings.send_out_of_hours;

  return true;
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, bodyData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthenticatedRequest(req: Request, supabaseUrl: string): Promise<boolean> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!anonKey || !authHeader) return false;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error) return false;
  return !!data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Credenciais do Supabase não configuradas no ambiente.");
    }

    const runnerToken = Deno.env.get("AUTOMATION_RUNNER_TOKEN");
    const reqToken = req.headers.get("x-automation-runner-token") || req.headers.get("authorization")?.replace("Bearer ", "");

    const hasRunnerTokenAccess = !!runnerToken && !!reqToken && reqToken === runnerToken;
    const hasUserAccess = await isAuthenticatedRequest(req, supabaseUrl);

    if (!hasRunnerTokenAccess && !hasUserAccess) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const eventId = typeof body.eventId === "string" ? body.eventId : null;
    const dryRun = Boolean(body.dryRun);
    const requestedLimit = Number(body.limit || 20);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 20, 1), 100);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let eventQuery = admin
      .from("whatsapp_automation_events")
      .select("id, establishment_id, order_id, customer_phone, event_key, payload, status, attempts, created_at")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (eventId) {
      eventQuery = eventQuery.eq("id", eventId);
    } else {
      eventQuery = eventQuery.in("status", ["pending", "failed"]).lt("attempts", MAX_ATTEMPTS);
    }

    const { data: events, error: eventsError } = await eventQuery;
    if (eventsError) throw eventsError;

    const queue = (events || []) as EventRow[];
    if (queue.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, sent: 0, failed: 0, skipped: 0, message: "Fila vazia" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const establishmentIds = Array.from(new Set(queue.map((e) => e.establishment_id)));

    const [settingsRes, templatesRes] = await Promise.all([
      admin
        .from("whatsapp_automation_settings")
        .select("establishment_id, is_enabled, webhook_url, webhook_secret, provider_name, send_on_new_order, send_on_status_change, send_out_of_hours")
        .in("establishment_id", establishmentIds),
      admin
        .from("whatsapp_message_templates")
        .select("establishment_id, event_key, template_text, is_active")
        .in("establishment_id", establishmentIds),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (templatesRes.error) throw templatesRes.error;

    const settingsByEstablishment = new Map<string, SettingsRow>();
    for (const row of (settingsRes.data || []) as SettingsRow[]) {
      settingsByEstablishment.set(row.establishment_id, row);
    }

    const templatesByEstablishmentEvent = new Map<string, TemplateRow>();
    for (const row of (templatesRes.data || []) as TemplateRow[]) {
      templatesByEstablishmentEvent.set(`${row.establishment_id}:${row.event_key}`, row);
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const processed: Array<{ id: string; status: string; reason?: string }> = [];

    for (const event of queue) {
      const settings = settingsByEstablishment.get(event.establishment_id);
      const template = templatesByEstablishmentEvent.get(`${event.establishment_id}:${event.event_key}`);

      const attemptNumber = event.attempts + 1;

      const failEvent = async (reason: string) => {
        failed += 1;
        processed.push({ id: event.id, status: "failed", reason });

        if (!dryRun) {
          await admin
            .from("whatsapp_automation_events")
            .update({
              status: "failed",
              attempts: attemptNumber,
              last_error: reason,
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        }
      };

      const skipEvent = async (reason: string) => {
        skipped += 1;
        processed.push({ id: event.id, status: "skipped", reason });

        if (!dryRun) {
          await admin
            .from("whatsapp_automation_events")
            .update({
              status: "failed",
              attempts: attemptNumber,
              last_error: reason,
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        }
      };

      if (!settings) {
        await skipEvent("Configuração de automação não encontrada.");
        continue;
      }

      if (!shouldSendEvent(settings, event.event_key)) {
        await skipEvent("Evento desativado nas configurações da loja.");
        continue;
      }

      if (!template || !template.is_active || !template.template_text?.trim()) {
        await skipEvent("Template ausente ou inativo para este evento.");
        continue;
      }

      const message = renderTemplate(template.template_text, event.payload || {});

      const webhookPayload = {
        source: "pedefacil",
        provider: settings.provider_name || "webhook",
        eventId: event.id,
        eventKey: event.event_key,
        establishmentId: event.establishment_id,
        orderId: event.order_id,
        customerPhone: event.customer_phone,
        message,
        payload: event.payload || {},
        createdAt: event.created_at,
      };

      const serializedPayload = JSON.stringify(webhookPayload);

      try {
        if (!dryRun) {
          await admin
            .from("whatsapp_automation_events")
            .update({ status: "processing", attempts: attemptNumber, last_error: null })
            .eq("id", event.id);
        }

        if (!dryRun) {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "x-pedefacil-event-id": event.id,
            "x-pedefacil-event-key": event.event_key,
          };

          if (settings.webhook_secret) {
            headers["x-pedefacil-signature"] = await hmacSha256(settings.webhook_secret, serializedPayload);
          }

          const response = await fetch(settings.webhook_url!, {
            method: "POST",
            headers,
            body: serializedPayload,
          });

          if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`Webhook retornou ${response.status}: ${responseText}`);
          }

          await admin
            .from("whatsapp_automation_events")
            .update({
              status: "sent",
              last_error: null,
              processed_at: new Date().toISOString(),
            })
            .eq("id", event.id);
        }

        sent += 1;
        processed.push({ id: event.id, status: dryRun ? "dry-run" : "sent" });
      } catch (error) {
        await failEvent(toErrorMessage(error));
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        processed: queue.length,
        sent,
        failed,
        skipped,
        details: processed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: toErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
