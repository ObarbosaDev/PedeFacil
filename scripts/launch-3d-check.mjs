import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const checks = [];

function ok(label, detail = "") {
  checks.push({ status: "ok", label, detail });
}

function warn(label, detail = "") {
  checks.push({ status: "warn", label, detail });
}

function fail(label, detail = "") {
  checks.push({ status: "fail", label, detail });
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function readText(relativePath) {
  const abs = path.join(rootDir, relativePath);
  return fs.readFileSync(abs, "utf8");
}

function parseEnvFile(relativePath) {
  if (!fileExists(relativePath)) return null;
  const raw = readText(relativePath).replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function hasRealValue(value) {
  if (!value) return false;
  const v = String(value).trim();
  if (!v) return false;
  const placeholders = [
    "SEU_",
    "YOUR_",
    "SUA_",
    "example",
    "changeme",
    "token_aqui",
  ];
  return !placeholders.some((p) => v.toLowerCase().includes(p.toLowerCase()));
}

function checkRequiredFiles() {
  const requiredFiles = [
    "supabase/migrations/20260406113000_establishment_mercadopago_account.sql",
    "supabase/migrations/20260406122000_establishment_manual_pix_fallback.sql",
    "supabase/migrations/20260406122500_establishment_payment_accounts_private.sql",
    "supabase/migrations/20260406130000_scale_phase2_indexes.sql",
    "backend/src/main/java/com/pedefacil/automation/payment/PlanPaymentsController.java",
    "src/pages/public/Checkout.tsx",
    "src/pages/public/OrderPaymentStatus.tsx",
    "src/pages/admin/MarketplaceControl.tsx",
    "src/pages/admin/Orders.tsx",
  ];

  for (const relativePath of requiredFiles) {
    if (fileExists(relativePath)) ok("Arquivo crítico presente", relativePath);
    else fail("Arquivo crítico ausente", relativePath);
  }
}

function checkFrontendEnv() {
  const env = parseEnvFile(".env");
  if (!env) {
    warn("Arquivo .env não encontrado na raiz", "Crie com base no .env.example");
    return;
  }

  const requiredKeys = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PROJECT_ID",
    "VITE_PAYMENTS_API_BASE_URL",
  ];

  for (const key of requiredKeys) {
    if (hasRealValue(env[key])) ok("Env frontend preenchido", key);
    else fail("Env frontend faltando/placeholder", key);
  }
}

function checkBackendEnv() {
  const env = parseEnvFile("backend/.env");
  if (!env) {
    warn("Arquivo backend/.env não encontrado", "Crie com base em backend/.env.example");
    return;
  }

  const requiredKeys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PAYMENTS_API_PUBLIC_BASE_URL",
  ];

  for (const key of requiredKeys) {
    if (hasRealValue(env[key])) ok("Env backend preenchido", key);
    else fail("Env backend faltando/placeholder", key);
  }

  const optionalButImportant = [
    "MERCADOPAGO_ACCESS_TOKEN",
    "MERCADOPAGO_WEBHOOK_TOKEN",
  ];

  for (const key of optionalButImportant) {
    if (hasRealValue(env[key])) ok("Env backend importante preenchido", key);
    else warn("Env backend importante ausente", key);
  }

  const publicBase = env.PAYMENTS_API_PUBLIC_BASE_URL || "";
  if (publicBase.includes("localhost") || publicBase.includes("127.0.0.1")) {
    fail(
      "PAYMENTS_API_PUBLIC_BASE_URL está local",
      "Para webhook real, use URL pública HTTPS (domínio ou ngrok)."
    );
  }
}

function checkTextCorruption() {
  const targets = [
    "src/pages/auth/Login.tsx",
    "src/pages/client/ClientLogin.tsx",
    "src/pages/driver/DriverLogin.tsx",
    "src/pages/public/Checkout.tsx",
  ];

  let hasCorruption = false;
  for (const relativePath of targets) {
    if (!fileExists(relativePath)) continue;
    const content = readText(relativePath);
    if (content.includes("Ã") || content.includes("�")) {
      hasCorruption = true;
      fail("Texto quebrado detectado", relativePath);
    }
  }
  if (!hasCorruption) ok("Sem texto quebrado nas telas críticas");
}

function printSummary() {
  const count = {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };

  console.log("\n=== Pede Facil | Launch 3D Check ===\n");
  for (const c of checks) {
    const icon = c.status === "ok" ? "[OK]" : c.status === "warn" ? "[WARN]" : "[FAIL]";
    const line = c.detail ? `${icon} ${c.label} -> ${c.detail}` : `${icon} ${c.label}`;
    console.log(line);
  }

  console.log("\nResumo:");
  console.log(`- OK: ${count.ok}`);
  console.log(`- WARN: ${count.warn}`);
  console.log(`- FAIL: ${count.fail}`);

  if (count.fail > 0) {
    console.log("\nStatus final: NAO PRONTO para lancar.");
    process.exitCode = 1;
    return;
  }

  if (count.warn > 0) {
    console.log("\nStatus final: quase pronto. Ajuste os WARN antes do go-live.");
    process.exitCode = 0;
    return;
  }

  console.log("\nStatus final: pronto para etapa final de homologacao.");
}

checkRequiredFiles();
checkFrontendEnv();
checkBackendEnv();
checkTextCorruption();
printSummary();
