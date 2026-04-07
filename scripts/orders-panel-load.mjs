#!/usr/bin/env node

const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const looksLikePlaceholder = (value) => {
  if (!value) return true;
  const normalized = String(value).trim().toLowerCase();
  return (
    normalized.includes("seu_") ||
    normalized.includes("sua_") ||
    normalized.includes("real") ||
    normalized.includes("placeholder") ||
    normalized === "..." ||
    normalized === "null" ||
    normalized === "undefined"
  );
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );

if (!baseUrl || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

if (looksLikePlaceholder(baseUrl) || !baseUrl.startsWith("https://")) {
  console.error("SUPABASE_URL invalida. Use a URL real do projeto, por exemplo: https://xxxx.supabase.co");
  process.exit(1);
}

if (looksLikePlaceholder(serviceKey) || !serviceKey.startsWith("sb_secret_")) {
  console.error("SUPABASE_SERVICE_ROLE_KEY invalida. Use a service role real que comece com sb_secret_.");
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
};

const establishmentId = getArg("--establishment", "");
const totalRequests = Number(getArg("--requests", "3000"));
const concurrency = Number(getArg("--concurrency", "120"));
const pageSize = Number(getArg("--page-size", "50"));

if (!establishmentId) {
  console.error("Use --establishment <uuid_da_loja>.");
  process.exit(1);
}

if (looksLikePlaceholder(establishmentId) || !isUuid(establishmentId)) {
  console.error("Establishment invalido. Use um UUID real da loja em --establishment.");
  process.exit(1);
}

const endpoint =
  `${baseUrl}/rest/v1/orders` +
  `?select=id,created_at,status,payment_status,total,customer_name,order_type` +
  `&establishment_id=eq.${encodeURIComponent(establishmentId)}` +
  `&order=created_at.desc` +
  `&limit=${Number.isFinite(pageSize) ? Math.max(1, pageSize) : 50}`;

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

let success = 0;
let fail = 0;
let p95Samples = [];
const startedAt = Date.now();

async function fireOne(index) {
  const requestStarted = Date.now();
  try {
    const res = await fetch(endpoint, { method: "GET", headers });
    const elapsed = Date.now() - requestStarted;
    p95Samples.push(elapsed);

    if (!res.ok) {
      fail += 1;
      const text = await res.text();
      console.error(`Falha #${index} | ${res.status}: ${text.slice(0, 180)}`);
      return;
    }

    await res.text();
    success += 1;
  } catch (error) {
    fail += 1;
    console.error(`Erro de rede #${index}: ${String(error)}`);
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

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

await runPool();

const elapsedMs = Date.now() - startedAt;
const rps = elapsedMs > 0 ? success / (elapsedMs / 1000) : 0;
const p95 = percentile(p95Samples, 95);
const p99 = percentile(p95Samples, 99);

console.log("=== Resultado do orders panel load ===");
console.log(`Total: ${totalRequests}`);
console.log(`Sucesso: ${success}`);
console.log(`Falha: ${fail}`);
console.log(`Tempo total: ${(elapsedMs / 1000).toFixed(2)}s`);
console.log(`RPS medio: ${rps.toFixed(1)}`);
console.log(`Latencia p95: ${p95} ms`);
console.log(`Latencia p99: ${p99} ms`);

if (fail > 0) process.exit(2);
