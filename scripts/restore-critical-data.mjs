#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const getArg = (flag, fallback = "") => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
};

const fileArg = getArg("--file");
const apply = args.includes("--apply");

if (!fileArg) {
  console.error("Use --file <caminho_backup.json> [--apply]");
  process.exit(1);
}

const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!baseUrl || !serviceKey) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para restore.");
  process.exit(1);
}

const absFile = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(absFile)) {
  console.error(`Arquivo nao encontrado: ${absFile}`);
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(absFile, "utf8"));
const tables = backup?.tables || {};

if (!apply) {
  console.log("Modo seguro: restore em dry-run.");
  for (const [table, rows] of Object.entries(tables)) {
    console.log(`Tabela ${table}: ${(rows || []).length} registros para restaurar.`);
  }
  console.log("Para aplicar de verdade, rode com --apply");
  process.exit(0);
}

async function upsertTable(table, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const url = `${baseUrl}/rest/v1/${table}?on_conflict=id`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha no restore de ${table}: ${res.status} ${text.slice(0, 200)}`);
  }
}

for (const [table, rows] of Object.entries(tables)) {
  await upsertTable(table, rows);
  console.log(`Restore ${table}: ${(rows || []).length} registros aplicados.`);
}

console.log("Restore concluido.");

