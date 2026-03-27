import http from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SIGNATURE_SECRET = process.env.PEDEFACIL_SIGNATURE_SECRET || "";
const AUTH_BEARER_TOKEN = process.env.PEDEFACIL_RECEIVER_TOKEN || "";

const OUTBOUND_MODE = (process.env.OUTBOUND_MODE || "webhook").toLowerCase();
const OUTBOUND_WEBHOOK_URL = process.env.OUTBOUND_WEBHOOK_URL || "";
const OUTBOUND_WEBHOOK_AUTH = process.env.OUTBOUND_WEBHOOK_AUTH || "";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "";

const ZAPI_URL = process.env.ZAPI_URL || "";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "";

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(String(a || ""));
  const bBuf = Buffer.from(String(b || ""));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function validateBearer(req) {
  if (!AUTH_BEARER_TOKEN) return true;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return timingSafeEqual(token, AUTH_BEARER_TOKEN);
}

function validateSignature(rawBody, signatureHeader) {
  if (!SIGNATURE_SECRET) return true;
  const expected = crypto
    .createHmac("sha256", SIGNATURE_SECRET)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqual(expected, signatureHeader || "");
}

async function dispatchWebhook(payload) {
  if (!OUTBOUND_WEBHOOK_URL) {
    throw new Error("OUTBOUND_WEBHOOK_URL não configurada.");
  }

  const headers = { "Content-Type": "application/json" };
  if (OUTBOUND_WEBHOOK_AUTH) {
    headers.Authorization = `Bearer ${OUTBOUND_WEBHOOK_AUTH}`;
  }

  const response = await fetch(OUTBOUND_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Webhook de saída falhou (${response.status}): ${text}`);
  }

  return { ok: true, provider: "webhook" };
}

async function dispatchEvolution(payload) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    throw new Error("Configuração da Evolution incompleta.");
  }

  const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendText/${EVOLUTION_INSTANCE}`;
  const body = {
    number: String(payload.customerPhone || "").replace(/\D/g, ""),
    options: { delay: 1200, presence: "composing" },
    textMessage: { text: payload.message || "" },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Evolution falhou (${response.status}): ${text}`);
  }

  return { ok: true, provider: "evolution" };
}

async function dispatchZApi(payload) {
  if (!ZAPI_URL || !ZAPI_TOKEN) {
    throw new Error("Configuração da Z-API incompleta.");
  }

  const response = await fetch(ZAPI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": ZAPI_TOKEN,
    },
    body: JSON.stringify({
      phone: String(payload.customerPhone || "").replace(/\D/g, ""),
      message: payload.message || "",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Z-API falhou (${response.status}): ${text}`);
  }

  return { ok: true, provider: "zapi" };
}

async function dispatchByMode(payload) {
  if (OUTBOUND_MODE === "webhook") return dispatchWebhook(payload);
  if (OUTBOUND_MODE === "evolution") return dispatchEvolution(payload);
  if (OUTBOUND_MODE === "zapi") return dispatchZApi(payload);

  console.log("[receiver:log-only]", JSON.stringify(payload));
  return { ok: true, provider: "log" };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, mode: OUTBOUND_MODE, timestamp: new Date().toISOString() });
  }

  if (req.method !== "POST" || url.pathname !== "/webhook/pedefacil") {
    return json(res, 404, { ok: false, error: "Rota não encontrada" });
  }

  if (!validateBearer(req)) {
    return json(res, 401, { ok: false, error: "Token inválido" });
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const rawBody = Buffer.concat(chunks);
    const signature = req.headers["x-pedefacil-signature"];

    if (!validateSignature(rawBody, Array.isArray(signature) ? signature[0] : signature)) {
      return json(res, 401, { ok: false, error: "Assinatura inválida" });
    }

    const payload = safeJsonParse(rawBody);
    if (!payload) {
      return json(res, 400, { ok: false, error: "JSON inválido" });
    }

    try {
      const result = await dispatchByMode(payload);
      return json(res, 200, {
        ok: true,
        provider: result.provider,
        eventId: payload.eventId,
        eventKey: payload.eventKey,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json(res, 500, { ok: false, error: message });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[pedefacil-receiver] online em http://${HOST}:${PORT}`);
  console.log(`[pedefacil-receiver] rota: POST /webhook/pedefacil`);
  console.log(`[pedefacil-receiver] health: GET /health`);
  console.log(`[pedefacil-receiver] mode=${OUTBOUND_MODE}`);
});
