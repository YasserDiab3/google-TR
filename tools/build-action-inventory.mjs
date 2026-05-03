/**
 * Builds tools/action-inventory.json from Backend/Code.gs (switch cases)
 * and Frontend JS tree (action strings + sendToAppsScript first arg).
 * Run: node tools/build-action-inventory.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const HSE_API_IMPLEMENTED = new Set([
  "testConnection",
  "getPublicIP",
  "initializeSheets",
  "readFromSheet",
  "batchReadSheets",
  "saveToSheet",
  "appendToSheet",
  "deleteFromSheet",
  "getCompanySettings",
  "saveCompanySettings",
  "getUsersMeta",
  "getFormSettings",
  "saveFormSettings",
  "addUser",
  "updateUser",
  "deleteUser",
  "resetUserPassword",
  "fixUsersSheetHeaders",
  "fixMissingSheetHeaders",
  "uploadFileToDrive",
  "processAIQuestion",
]); // يطابق supabase/functions/hse-api/index.ts — حدّث عند إضافة case جديد

const MVP_ACTIONS = [
  "testConnection",
  "readFromSheet",
  "batchReadSheets",
  "saveToSheet",
  "appendToSheet",
  "deleteFromSheet",
  "getCompanySettings",
  "saveCompanySettings",
  "getUsersMeta",
  "getFormSettings",
  "saveFormSettings",
  "addUser",
  "updateUser",
  "deleteUser",
  "resetUserPassword",
  "fixUsersSheetHeaders",
  "fixMissingSheetHeaders",
];

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJs(p, out);
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

function extractCodeGsCases(src) {
  const set = new Set();
  const re = /case\s+'([^']+)'/g;
  let m;
  while ((m = re.exec(src))) set.add(m[1]);
  return [...set].sort();
}

function extractFrontendActions(src) {
  const set = new Set();
  const patterns = [
    /action:\s*'([^']+)'/g,
    /action:\s*"([^"]+)"/g,
    /sendToAppsScript\(\s*'([^']+)'/g,
    /sendToAppsScript\(\s*"([^"]+)"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) set.add(m[1]);
  }
  return [...set].sort();
}

function main() {
  const codeGs = path.join(ROOT, "Backend", "Code.gs");
  const backendCases = fs.existsSync(codeGs)
    ? extractCodeGsCases(readText(codeGs))
    : [];

  const frontendDir = path.join(ROOT, "Frontend", "js");
  const files = walkJs(frontendDir);
  const feSet = new Set();
  for (const f of files) {
    for (const a of extractFrontendActions(readText(f))) feSet.add(a);
  }
  const frontendActions = [...feSet].sort();

  const matrix = {};
  for (const a of new Set([...backendCases, ...frontendActions])) {
    const inBackend = backendCases.includes(a);
    const inFrontend = frontendActions.includes(a);
    const inHse = HSE_API_IMPLEMENTED.has(a);
    let status = "gap";
    if (inHse) status = "implemented_in_hse_api";
    else if (inBackend && !inHse) status = "needs_port_from_gas";
    else if (!inBackend && inFrontend) status = "frontend_only_or_dynamic";
    matrix[a] = {
      inBackend,
      inFrontend,
      inHseApiPlan: inHse,
      status,
    };
  }

  const out = {
    generatedAt: new Date().toISOString(),
    summary: {
      backendCaseCount: backendCases.length,
      frontendDistinctActionCount: frontendActions.length,
      mvpActionCount: MVP_ACTIONS.length,
    },
    mvpLaunchActions: MVP_ACTIONS,
    backendCases,
    frontendActions,
    compatibilityMatrix: matrix,
  };

  const dest = path.join(ROOT, "tools", "action-inventory.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", dest);
}

main();
