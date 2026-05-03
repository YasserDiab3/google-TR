/**
 * Collects RPC action names from Backend/Code.gs (case 'x':) and sendRequest/sendToAppsScript from Frontend.
 * Output: tools/artifacts/action-inventory.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "tools", "artifacts");
const CODE_GS = path.join(ROOT, "Backend", "Code.gs");
const FRONTEND_ROOT = path.join(ROOT, "Frontend");

function walkJs(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkJs(p, files);
    else if (name.endsWith(".js")) files.push(p);
  }
  return files;
}

function extractCodeGsCases(content) {
  const re = /case\s+['"]([a-zA-Z0-9_]+)['"]\s*:/g;
  const set = new Set();
  let m;
  while ((m = re.exec(content))) set.add(m[1]);
  return [...set].sort();
}

function extractFrontendActions(content) {
  const set = new Set();
  const patterns = [
    /action:\s*['"]([a-zA-Z0-9_]+)['"]/g,
    /sendToAppsScript\(\s*['"]([a-zA-Z0-9_]+)['"]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content))) set.add(m[1]);
  }
  return [...set].sort();
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const codeGs = fs.readFileSync(CODE_GS, "utf8");
  const backendActions = extractCodeGsCases(codeGs);

  const frontendFiles = walkJs(path.join(FRONTEND_ROOT, "js"));
  const feSet = new Set();
  for (const f of frontendFiles) {
    const txt = fs.readFileSync(f, "utf8");
    for (const a of extractFrontendActions(txt)) feSet.add(a);
  }
  const frontendActions = [...feSet].sort();

  const inBackendNotFrontend = backendActions.filter((a) => !feSet.has(a));
  const inFrontendNotBackend = frontendActions.filter(
    (a) => !backendActions.includes(a),
  );

  const genericSheet = [
    "readFromSheet",
    "batchReadSheets",
    "saveToSheet",
    "appendToSheet",
    "initializeSheets",
  ];

  const googleLikely = (a) =>
    /uploadFileToDrive|exportDailyObservationsPpt|Ppt|getPublicIP/i.test(a);

  const payload = {
    generatedAt: new Date().toISOString(),
    counts: {
      backendCodeGs: backendActions.length,
      frontendUnique: frontendActions.length,
    },
    classification: {
      genericSheetOps: genericSheet.filter((g) => backendActions.includes(g)),
      likelyGoogleDriveOrExternal: backendActions.filter(googleLikely),
    },
    backendActions,
    frontendActions,
    diff: {
      inBackendNotFrontend,
      inFrontendNotBackend,
    },
  };

  const out = path.join(OUT_DIR, "action-inventory.json");
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", out);
}

main();
