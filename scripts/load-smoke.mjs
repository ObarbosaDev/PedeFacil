#!/usr/bin/env node
/* eslint-disable no-console */

const baseUrl = process.env.VITE_SUPABASE_URL || "";
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!baseUrl || !anonKey) {
  console.error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.");
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
};

const establishmentId = getArg("--establishment", "");
const totalRequests = Number(getArg("--requests", "1000"));
const concurrency = Number(getArg("--concurrency", "40"));

if (!establishmentId) {
  console.error("Use --establishment <uuid_da_loja>.");
  process.exit(1);
}

const endpoint = `${baseUrl}/rest/v1/checkout_events`;
const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const events = ["menu_view", "add_to_cart", "checkout_view", "order_submitted"];
const randomEvent = () => events[Math.floor(Math.random() * events.length)];

let success = 0;
let fail = 0;
let started = Date.now();

async function fireOne(index) {
  const sessionId = `load_${Math.floor(index / 4)}_${Math.random().toString(36).slice(2, 9)}`;
  const body = {
    establishment_id: establishmentId,
    user_id: null,
    event_name: randomEvent(),
    session_id: sessionId,
    metadata: {
      source: "load_smoke_script",
      seq: index,
      created_at: new Date().toISOString(),
    },
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      fail += 1;
      const text = await res.text();
      console.error(`Falha ${res.status}: ${text.slice(0, 200)}`);
      return;
    }
    success += 1;
  } catch (error) {
    fail += 1;
    console.error(`Erro de rede: ${String(error)}`);
  }
}

async function runPool() {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= totalRequests) break;
      await fireOne(current);
    }
  });
  await Promise.all(workers);
}

await runPool();

const elapsedMs = Date.now() - started;
const rps = elapsedMs > 0 ? (success / (elapsedMs / 1000)).toFixed(1) : "0";

console.log("=== Resultado do load smoke ===");
console.log(`Total: ${totalRequests}`);
console.log(`Sucesso: ${success}`);
console.log(`Falha: ${fail}`);
console.log(`Tempo: ${(elapsedMs / 1000).toFixed(2)}s`);
console.log(`RPS medio: ${rps}`);

if (fail > 0) process.exit(2);

