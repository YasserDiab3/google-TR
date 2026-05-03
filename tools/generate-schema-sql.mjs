/**
 * Parses Backend/Headers.gs headersMap and Backend/Config.gs getRequiredSheets,
 * emits supabase/migrations SQL with quoted identifiers matching sheet column names.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function stripGsComments(src) {
  return src.replace(/\/\/[^\n]*/g, "");
}

/** Extract quoted strings from getRequiredSheets array block */
function extractRequiredSheets(configSrc) {
  const start = configSrc.indexOf("function getRequiredSheets()");
  if (start === -1) throw new Error("getRequiredSheets not found");
  const sub = configSrc.slice(start);
  const arrStart = sub.indexOf("const sheets = [");
  if (arrStart === -1) throw new Error("sheets = [ not found");
  const from = sub.slice(arrStart);
  const end = from.indexOf("];");
  const block = from.slice(0, end);
  const re = /'([^']+)'/g;
  const names = [];
  let m;
  while ((m = re.exec(block))) names.push(m[1]);
  return [...new Set(names)];
}

/** Parse headersMap object — keys and string array values */
function parseHeadersMap(headersSrc) {
  const cleaned = stripGsComments(headersSrc);
  const start = cleaned.indexOf("const headersMap = {");
  if (start === -1) throw new Error("headersMap not found");
  let i = start + "const headersMap = {".length;
  const map = {};
  while (i < cleaned.length) {
    while (/\s/.test(cleaned[i])) i++;
    if (cleaned[i] === "}") break;
    if (cleaned.slice(i, i + 6) === "return") break;
    if (cleaned[i] !== "'") throw new Error(`Expected ' at ${i}`);
    i++;
    const keyEnd = cleaned.indexOf("'", i);
    const sheetName = cleaned.slice(i, keyEnd);
    i = keyEnd + 1;
    while (/\s/.test(cleaned[i])) i++;
    if (cleaned[i] !== ":") throw new Error(`Expected : after key ${sheetName}`);
    i++;
    while (/\s/.test(cleaned[i])) i++;
    if (cleaned[i] !== "[") throw new Error(`Expected [ for ${sheetName}`);
    i++;
    const cols = [];
    while (i < cleaned.length) {
      while (/\s|,/.test(cleaned[i])) i++;
      if (cleaned[i] === "]") {
        i++;
        break;
      }
      if (cleaned[i] !== "'") throw new Error(`Expected column quote in ${sheetName} at ${i}`);
      i++;
      const ce = cleaned.indexOf("'", i);
      cols.push(cleaned.slice(i, ce));
      i = ce + 1;
    }
    map[sheetName] = cols;
    while (/\s/.test(cleaned[i])) i++;
    if (cleaned[i] === ",") i++;
  }
  return map;
}

function quoteIdent(s) {
  return '"' + String(s).replace(/"/g, '""') + '"';
}

function sqlTypeForColumn(colName) {
  if (/^(attachments|permissions|items|preferences|settings|data|json|payload|reportData|approvalFlowJson|documentsToAmendJson|committeeMembersJson|trainingRequirementsJson)$/i.test(colName))
    return "jsonb";
  return "text";
}

function buildCreateTable(sheetName, columns) {
  if (!columns.length) {
    return `-- SKIP empty headers: ${sheetName}\n`;
  }
  const colsSql = columns
    .map((c) => `  ${quoteIdent(c)} ${sqlTypeForColumn(c)}`)
    .join(",\n");
  return `CREATE TABLE IF NOT EXISTS public.${quoteIdent(sheetName)} (\n${colsSql}\n);\n`;
}

function main() {
  const headersPath = path.join(ROOT, "Backend", "Headers.gs");
  const configPath = path.join(ROOT, "Backend", "Config.gs");
  const headersSrc = fs.readFileSync(headersPath, "utf8");
  const configSrc = fs.readFileSync(configPath, "utf8");

  const headersMap = parseHeadersMap(headersSrc);
  const required = extractRequiredSheets(configSrc);

  const migDir = path.join(ROOT, "supabase", "migrations");
  fs.mkdirSync(migDir, { recursive: true });

  let sql = `-- HSE sheet tables (generated from Headers.gs / Config.gs)\n`;
  sql += `CREATE SCHEMA IF NOT EXISTS public;\n`;
  sql += `SET search_path TO public;\n\n`;

  const missingHeaders = [];
  for (const sheet of required.sort()) {
    const cols = headersMap[sheet];
    if (!cols || !cols.length) {
      missingHeaders.push(sheet);
      sql += `-- WARNING: no headers for '${sheet}' — create manually or extend Headers.gs\n`;
      continue;
    }
    sql += buildCreateTable(sheet, cols);
    sql += "\n";
  }

  const outPath = path.join(migDir, "20260203140000_hse_sheet_tables.sql");
  fs.writeFileSync(outPath, sql, "utf8");

  const metaPath = path.join(ROOT, "tools", "artifacts", "schema-generation-meta.json");
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        migrationFile: outPath,
        requiredSheetCount: required.length,
        parsedHeaderSheets: Object.keys(headersMap).length,
        missingHeadersForRequiredSheets: missingHeaders,
      },
      null,
      2,
    ),
    "utf8",
  );

  const fnDir = path.join(ROOT, "supabase", "functions", "hse-api");
  fs.mkdirSync(fnDir, { recursive: true });
  const allowTs = path.join(fnDir, "allowed_sheets.gen.ts");
  const lines = required.sort().map((s) => `  ${JSON.stringify(s)},`);
  fs.writeFileSync(
    allowTs,
    `/** Auto-generated by tools/generate-schema-sql.mjs — do not edit by hand */\nexport const ALLOWED_SHEETS = new Set<string>([\n${lines.join("\n")}\n]);\n`,
    "utf8",
  );

  console.log("Wrote", outPath);
  console.log("Wrote", allowTs);
  if (missingHeaders.length)
    console.warn("Missing headers for:", missingHeaders.join(", "));
}

main();
