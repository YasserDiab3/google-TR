/**
 * Import multi-sheet .xlsx into PostgreSQL (same logical tables as Google Sheets / hse-api).
 *
 * Usage:
 *   cd tools && npm install
 *   set DATABASE_URL=postgresql://...
 *   node import-sheets-xlsx.mjs --file C:/path/export.xlsx [--upsert] [--replace]
 *
 * Default mode is --replace (DELETE ALL then INSERT per sheet), matching legacy JSON importer.
 * Use --upsert to merge on primary key column "id" when present.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import xlsx from "xlsx";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const allowPath = path.join(ROOT, "supabase", "functions", "hse-api", "allowed_sheets.gen.ts");

/** Legacy aliases → physical Postgres table name (keep in sync with hse-api/index.ts). */
const SHEET_ALIASES = {
  safetyAlerts: "SafetyAlerts",
  LegalInventory: "LegalInventory",
  EmployeePPEMatrixByCode: "PPEMatrix",
  PTWRegistry: "PTWRegistry",
  PTW_MAP_COORDINATES: "PTW_MAP_SITES",
  TrainingAttendance: "TrainingAttendance",
  TrainingAnalysisData: "TrainingAnalysisData",
};

function resolveTableName(raw) {
  const s = String(raw || "").trim();
  if (!s) return s;
  return SHEET_ALIASES[s] || s;
}

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

function isAllowedSheet(tabName, ALLOWED) {
  const raw = String(tabName || "").trim();
  if (!raw) return false;
  if (ALLOWED.has(raw)) return true;
  const resolved = resolveTableName(raw);
  if (ALLOWED.has(resolved)) return true;
  for (const name of ALLOWED) {
    if (resolveTableName(name) === resolved) return true;
  }
  return false;
}

function qIdent(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function serializeCell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

async function replaceSheet(client, tableName, rows) {
  const t = qIdent(tableName);
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

async function upsertSheet(client, tableName, rows) {
  const t = qIdent(tableName);
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (keys.length === 0) continue;
    const idKey = keys.find((k) => k.toLowerCase() === "id");
    const cols = keys.map((k) => qIdent(k)).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => serializeCell(row[k]));

    if (!idKey) {
      await client.query(`INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`, vals);
      continue;
    }

    const updateSet = keys
      .filter((k) => k !== idKey)
      .map((k) => `${qIdent(k)} = EXCLUDED.${qIdent(k)}`)
      .join(", ");

    let query = `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`;
    if (updateSet) {
      query += ` ON CONFLICT (${qIdent(idKey)}) DO UPDATE SET ${updateSet}`;
    } else {
      query += ` ON CONFLICT (${qIdent(idKey)}) DO NOTHING`;
    }
    await client.query(query, vals);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let file = "";
  let upsert = false;
  let replace = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) file = args[++i];
    else if (args[i] === "--upsert") upsert = true;
    else if (args[i] === "--replace") replace = true;
  }
  if (!replace && !upsert) replace = true;
  return { file, upsert: upsert && !replace, replace };
}

async function main() {
  const { file, upsert } = parseArgs();
  if (!file || !fs.existsSync(file)) {
    console.error("Usage: node import-sheets-xlsx.mjs --file <path.xlsx> [--upsert | --replace]");
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const ALLOWED = loadAllowedSheets();
  const workbook = xlsx.readFile(file);
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  let n = 0;
  try {
    for (const tabName of workbook.SheetNames) {
      if (!isAllowedSheet(tabName, ALLOWED)) {
        console.warn("Skip (not allowed):", tabName);
        continue;
      }
      const tableName = resolveTableName(tabName);
      const ws = workbook.Sheets[tabName];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: "", raw: false });
      const nonEmpty = rows.filter((row) =>
        Object.values(row).some((v) => String(v).trim() !== ""),
      );
      if (!nonEmpty.length) {
        console.warn("Skip (empty):", tabName);
        continue;
      }
      if (upsert) {
        await upsertSheet(client, tableName, nonEmpty);
      } else {
        await replaceSheet(client, tableName, nonEmpty);
      }
      console.log(upsert ? "Upserted" : "Replaced", tableName, nonEmpty.length, "rows (tab:", tabName + ")");
      n++;
    }
  } finally {
    await client.end();
  }
  console.log("Done. Sheets processed:", n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
