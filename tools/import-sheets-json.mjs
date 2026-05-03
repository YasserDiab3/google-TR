/**
 * Import per-sheet JSON arrays into PostgreSQL (same shape as readFromSheet).
 * Usage: set DATABASE_URL, then:
 *   node import-sheets-json.mjs --dir C:/path/to/export
 * Each file: SheetName.json = [ { ...row }, ... ]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const allowPath = path.join(ROOT, "supabase", "functions", "hse-api", "allowed_sheets.gen.ts");

function loadAllowedSheets() {
  const src = fs.readFileSync(allowPath, "utf8");
  const s = new Set();
  for (const line of src.split("\n")) {
    const m = line.match(/^\s*"([^"]+)"\s*,?\s*$/);
    if (m) s.add(m[1]);
  }
  if (s.size === 0) throw new Error("Could not parse allowed_sheets.gen.ts");
  return s;
}

function qIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function serializeCell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

async function replaceSheet(client, sheetName, rows) {
  const t = qIdent(sheetName);
  await client.query(`DELETE FROM public.${t}`);
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (keys.length === 0) continue;
    const cols = keys.map((k) => qIdent(k)).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => serializeCell(row[k]));
    await client.query(`INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`, vals);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let dir = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      dir = args[++i];
    }
  }
  return { dir };
}

async function main() {
  const { dir } = parseArgs();
  if (!dir || !fs.existsSync(dir)) {
    console.error("Usage: node import-sheets-json.mjs --dir <folder with SheetName.json files>");
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const ALLOWED = loadAllowedSheets();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let n = 0;
  try {
    for (const f of files) {
      const sheetName = f.replace(/\.json$/i, "");
      if (!ALLOWED.has(sheetName)) {
        console.warn("Skip (not in allowlist):", sheetName);
        continue;
      }
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) {
        console.warn("Skip (not an array):", f);
        continue;
      }
      await replaceSheet(client, sheetName, rows);
      console.log("Imported", sheetName, rows.length, "rows");
      n++;
    }
  } finally {
    await client.end();
  }
  console.log("Done. Sheets imported:", n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
