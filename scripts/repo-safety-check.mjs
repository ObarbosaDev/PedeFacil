#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const forbiddenPatterns = [
  /^\.env(\..+)?$/i,
  /^.*\.(pem|key|p12|pfx)$/i,
  /^secrets?\..*$/i,
  /^.*service[-_]?account.*\.json$/i,
];

const allowList = new Set([".env", ".env.example"]);

const ignoreDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "backend/target",
  ".idea",
]);

function walk(dir, root = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (ignoreDirs.has(rel) || ignoreDirs.has(entry.name)) continue;
      files.push(...walk(abs, root));
      continue;
    }

    files.push(rel);
  }

  return files;
}

const repoRoot = process.cwd();
let files = [];

const gitResult = spawnSync("git", ["ls-files"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: false,
});

if (gitResult.status === 0 && gitResult.stdout) {
  files = gitResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} else {
  files = walk(repoRoot);
}

const deletedInIndex = new Set();
const deletedResult = spawnSync("git", ["ls-files", "--deleted"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: false,
});

if (deletedResult.status === 0 && deletedResult.stdout) {
  const lines = deletedResult.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    deletedInIndex.add(line.replace(/\\/g, "/"));
  }
}

const envStatus = spawnSync("git", ["status", "--porcelain", "--", ".env"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: false,
});
const isEnvMarkedDeleted =
  envStatus.status === 0 &&
  envStatus.stdout
    .split("\n")
    .map((line) => line.trim())
    .some((line) => line.startsWith("D"));

const violations = files.filter((file) => {
  if (allowList.has(file)) return false;
  if (file === ".env" && isEnvMarkedDeleted) return false;
  if (deletedInIndex.has(file)) return false;
  return forbiddenPatterns.some((pattern) => pattern.test(file));
});

if (violations.length) {
  console.error("Falha de seguranca: arquivos sensiveis encontrados no repositorio:");
  for (const file of violations) {
    console.error(` - ${file}`);
  }
  console.error("\nRemova os arquivos sensiveis e mantenha somente templates (ex.: .env.example).");
  process.exit(1);
}

console.log("Repo safety check: OK");
