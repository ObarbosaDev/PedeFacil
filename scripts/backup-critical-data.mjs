#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!baseUrl || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para gerar backup.");
  process.exit(1);
}

const tables = [
  "establishments",
  "categories",
  "products",
  "coupons",
  "delivery_drivers",
  "store_subscriptions",
];

async function fetchTable(table) {
  const url = `${baseUrl}/rest/v1/${table}?select=*`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao ler ${table}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const payload = {
  generated_at: new Date().toISOString(),
  source: baseUrl,
  tables: {},
};

for (const table of tables) {
  const rows = await fetchTable(table);
  payload.tables[table] = rows;
  console.log(`Backup ${table}: ${rows.length} registros`);
}

const filePath = path.join(backupDir, `pedefacil-backup-${timestamp}.json`);
fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
console.log(`Backup concluido: ${filePath}`);

