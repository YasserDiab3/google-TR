/**
 * Supabase Edge Function: Apps Script–compatible RPC for HSE frontend.
 * Generic sheet ops + MVP actions for Supabase-only deployments.
 *
 * Security: set Supabase secret HSE_API_KEY — requests must send header x-hse-api-key.
 * Optional AI: OPENAI_API_KEY for processAIQuestion (minimal proxy).
 *
 * saveToSheet: full table replace (DELETE ALL then INSERT). Use appendToSheet for incremental rows.
 */
import { Client, Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { ALLOWED_SHEETS } from "./allowed_sheets.gen.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-csrf-token, x-hse-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "postgres",
    hostname: u.hostname,
    port: parseInt(u.port || "5432", 10),
  };
}

function pickDatabaseUrl(): string | null {
  const candidates = [
    (Deno.env.get("DATABASE_URL") || "").trim(),
    (Deno.env.get("SUPABASE_DB_URL") || "").trim(),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      // validate URL early to avoid crashing the request path.
      // eslint-disable-next-line no-new
      new URL(c);
      return c;
    } catch {
      // try next candidate
    }
  }
  return null;
}

const SHEET_ALIASES: Record<string, string> = {
  // Legacy/module aliases normalized to existing DB tables
  safetyAlerts: "SafetyAlerts",
  LegalInventory: "LegalInventory",
  EmployeePPEMatrixByCode: "PPEMatrix",
  PTWRegistry: "PTWRegistry",
  PTW_MAP_COORDINATES: "PTW_MAP_SITES",
  TrainingAttendance: "TrainingAttendance",
  TrainingAnalysisData: "TrainingAnalysisData",
};

function resolveSheetName(sheetName: string): string {
  const raw = String(sheetName || "").trim();
  if (!raw) return raw;
  return SHEET_ALIASES[raw] || raw;
}

/** Accept legacy/config sheet ids, alias sources, and alias targets (e.g. PTW_MAP_COORDINATES → PTW_MAP_SITES). */
function isAllowedSheetRequest(sheetName: string): boolean {
  const raw = String(sheetName || "").trim();
  if (!raw) return false;
  if (ALLOWED_SHEETS.has(raw)) return true;
  const resolved = resolveSheetName(raw);
  if (ALLOWED_SHEETS.has(resolved)) return true;
  for (const name of ALLOWED_SHEETS) {
    if (resolveSheetName(name) === resolved) return true;
  }
  return false;
}

function qTable(sheetName: string): string {
  if (!isAllowedSheetRequest(sheetName)) {
    throw new Error(`Invalid or unsupported sheet name: ${sheetName}`);
  }
  const resolved = resolveSheetName(sheetName);
  return '"' + resolved.replace(/"/g, '""') + '"';
}

function serializeCell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function normalizePgUserRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const ph = out.passwordHash ?? out.passwordhash;
  if (ph != null && out.passwordHash == null) {
    out.passwordHash = ph;
  }
  // keep API payload aligned with schema column names used on write path
  if (Object.prototype.hasOwnProperty.call(out, "passwordhash")) {
    delete out.passwordhash;
  }
  return out;
}

async function readSheet(
  client: Client,
  sheetName: string,
): Promise<Record<string, unknown>[]> {
  const t = qTable(sheetName);
  const result = await client.queryObject<Record<string, unknown>>(
    `SELECT * FROM public.${t}`,
  );
  const rows = result.rows;
  if (sheetName === "Users") {
    return rows.map((r) => normalizePgUserRow(r));
  }
  return rows;
}

/** If begin() throws, rollback() throws "transaction has not been started" — swallow that so the real error surfaces. */
async function safeRollbackTransaction(
  transaction: { rollback: () => Promise<unknown> },
): Promise<void> {
  try {
    await transaction.rollback();
  } catch {
    /* ignore */
  }
}

async function replaceSheet(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  const transaction = client.createTransaction(`replace_${sheetName}`);
  try {
    await transaction.begin();
    await transaction.queryObject(`DELETE FROM public.${t}`);

    // Process in smaller batches to avoid connection timeouts
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      for (const row of batch) {
        const keys = Object.keys(row).filter((k) => row[k] !== undefined);
        if (keys.length === 0) continue;
        const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const vals = keys.map((k) => serializeCell(row[k]));
        await transaction.queryObject(
          `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
          vals,
        );
      }
    }
    await transaction.commit();
  } catch (e) {
    await safeRollbackTransaction(transaction);
    throw e;
  }
}

async function appendRows(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  const transaction = client.createTransaction(`append_${sheetName}`);
  try {
    await transaction.begin();
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      for (const row of batch) {
        const keys = Object.keys(row).filter((k) => row[k] !== undefined);
        if (keys.length === 0) continue;
        const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const vals = keys.map((k) => serializeCell(row[k]));
        await transaction.queryObject(
          `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
          vals,
        );
      }
    }
    await transaction.commit();
  } catch (e) {
    await safeRollbackTransaction(transaction);
    throw e;
  }
}

async function deleteFromSheetImpl(
  client: Client,
  sheetName: string,
  id: string,
): Promise<void> {
  const t = qTable(sheetName);
  await client.queryObject(`DELETE FROM public.${t} WHERE "id" = $1`, [id]);
}

async function upsertRows(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  const transaction = client.createTransaction(`upsert_${sheetName}`);
  try {
    await transaction.begin();
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      for (const row of batch) {
        const keys = Object.keys(row).filter((k) => row[k] !== undefined);
        if (keys.length === 0) continue;

        const idKey = keys.find(k => k.toLowerCase() === 'id');
        if (!idKey) {
          const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
          const vals = keys.map((k) => serializeCell(row[k]));
          await transaction.queryObject(
            `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
            vals,
          );
          continue;
        }

        const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const vals = keys.map((k) => serializeCell(row[k]));

        const updateSet = keys
          .filter(k => k !== idKey)
          .map((k) => `"${k.replace(/"/g, '""')}" = EXCLUDED."${k.replace(/"/g, '""')}"`)
          .join(", ");

        let query = `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`;
        if (updateSet) {
          query += ` ON CONFLICT ("${idKey}") DO UPDATE SET ${updateSet}`;
        } else {
          query += ` ON CONFLICT ("${idKey}") DO NOTHING`;
        }

        await transaction.queryObject(query, vals);
      }
    }
    await transaction.commit();
  } catch (e) {
    await safeRollbackTransaction(transaction);
    throw e;
  }
}

async function saveToSheetImpl(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
  useUpsert: boolean,
): Promise<void> {
  if (useUpsert) {
    await upsertRows(client, sheetName, rows);
  } else {
    await replaceSheet(client, sheetName, rows);
  }
}

function checkHseApiKey(req: Request): Response | null {
  const required = (Deno.env.get("HSE_API_KEY") || "").trim();
  if (!required) return null;
  const sent = (req.headers.get("x-hse-api-key") || "").trim();
  if (sent !== required) {
    return jsonResponse(
      {
        success: false,
        message: "Unauthorized: invalid or missing x-hse-api-key",
        errorCode: "HSE_API_KEY_REQUIRED",
      },
      401,
    );
  }
  return null;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value || "");
}

async function bumpUsersMeta(client: Client): Promise<void> {
  const ms = Date.now();
  const iso = new Date().toISOString();
  await client.queryObject(
    `INSERT INTO public."HSE_AppMeta" ("key", "value_text", "value_num", "updated_at")
     VALUES ('users_last_updated', $1, $2, now())
     ON CONFLICT ("key") DO UPDATE SET
       "value_text" = EXCLUDED."value_text",
       "value_num" = EXCLUDED."value_num",
       "updated_at" = now()`,
    [iso, ms],
  );
}

async function getUsersMetaImpl(client: Client): Promise<Record<string, unknown>> {
  const r = await client.queryObject<{
    value_text: string | null;
    value_num: string | null;
  }>(
    `SELECT "value_text", "value_num" FROM public."HSE_AppMeta" WHERE "key" = 'users_last_updated' LIMIT 1`,
  );
  const row = r.rows[0];
  if (row && row.value_num != null) {
    return {
      updatedAtMs: Number(row.value_num) || 0,
      updatedAtIso: row.value_text || "",
      serverTimeIso: new Date().toISOString(),
    };
  }
  const maxRow = await client.queryObject<{ m: string | null }>(
    `SELECT MAX("updatedAt")::text AS m FROM public."Users"`,
  );
  const m = maxRow.rows[0]?.m;
  return {
    updatedAtMs: m ? Date.parse(m) || 0 : 0,
    updatedAtIso: m || "",
    serverTimeIso: new Date().toISOString(),
  };
}

function defaultCompanySettings(): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: "COMPANY-SETTINGS-1",
    name: "",
    secondaryName: "",
    nameFontSize: "16",
    secondaryNameFontSize: "14",
    secondaryNameColor: "#6B7280",
    formVersion: "1.0",
    address: "",
    phone: "",
    email: "",
    logo: "",
    postLoginItems: "",
    clinicMonthlyVisitsAlertThreshold: "10",
    clinicVisitTypes: "",
    profileTeamsUrl: "",
    profileWhatsAppUrl: "",
    createdAt: now,
    updatedAt: now,
    createdBy: "System",
    updatedBy: "System",
  };
}

async function getCompanySettingsImpl(
  client: Client,
): Promise<Record<string, unknown>> {
  const rows = await readSheet(client, "Company_Settings");
  if (rows.length === 0) return defaultCompanySettings();
  return { ...defaultCompanySettings(), ...rows[0] };
}

async function saveCompanySettingsImpl(
  client: Client,
  payload: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  const userData = (payload.userData || payload.user || {}) as Record<
    string,
    unknown
  >;
  const userName = String(userData.name || userData.email || "System");
  const existing = await readSheet(client, "Company_Settings");
  const base = existing.length > 0
    ? { ...existing[0] }
    : defaultCompanySettings();
  const postLoginItems =
    typeof payload.postLoginItems === "string"
      ? payload.postLoginItems
      : Array.isArray(payload.postLoginItems)
      ? JSON.stringify(payload.postLoginItems)
      : String(base.postLoginItems || "");
  const clinicVisitTypes =
    typeof payload.clinicVisitTypes === "string"
      ? payload.clinicVisitTypes
      : Array.isArray(payload.clinicVisitTypes)
      ? JSON.stringify(payload.clinicVisitTypes)
      : String(base.clinicVisitTypes || "");
  let th = parseInt(
    String(payload.clinicMonthlyVisitsAlertThreshold ?? "10"),
    10,
  );
  if (Number.isNaN(th) || th < 1) th = 10;
  if (th > 1000) th = 1000;
  const row: Record<string, unknown> = {
    id: "COMPANY-SETTINGS-1",
    name: payload.name ?? base.name ?? "",
    secondaryName: payload.secondaryName ?? base.secondaryName ?? "",
    nameFontSize: String(payload.nameFontSize ?? base.nameFontSize ?? "16"),
    secondaryNameFontSize: String(
      payload.secondaryNameFontSize ?? base.secondaryNameFontSize ?? "14",
    ),
    secondaryNameColor: String(
      payload.secondaryNameColor ?? base.secondaryNameColor ?? "#6B7280",
    ),
    formVersion: String(payload.formVersion ?? base.formVersion ?? "1.0"),
    address: payload.address ?? base.address ?? "",
    phone: payload.phone ?? base.phone ?? "",
    email: payload.email ?? base.email ?? "",
    logo: payload.logo ?? base.logo ?? "",
    postLoginItems,
    clinicMonthlyVisitsAlertThreshold: String(th),
    clinicVisitTypes,
    profileTeamsUrl: String(
      payload.profileTeamsUrl ?? base.profileTeamsUrl ?? "",
    ),
    profileWhatsAppUrl: String(
      payload.profileWhatsAppUrl ?? base.profileWhatsAppUrl ?? "",
    ),
    createdAt: String(base.createdAt || now),
    updatedAt: now,
    createdBy: String(base.createdBy || "System"),
    updatedBy: userName,
  };
  await replaceSheet(client, "Company_Settings", [row]);
}

async function getFormSettingsImpl(
  client: Client,
): Promise<Record<string, unknown>> {
  const sites = await readSheet(client, "Form_Sites");
  const places = await readSheet(client, "Form_Places");
  const departments = await readSheet(client, "Form_Departments");
  const safetyTeam = await readSheet(client, "Form_SafetyTeam");

  const formattedSites = sites.map((site) => {
    const siteId = String(site.id || "").trim();
    const sitePlaces = places
      .filter((p) => String(p.siteId || "").trim() === siteId && siteId !== "")
      .map((p) => ({ id: p.id || "", name: p.name || "" }));
    return {
      id: site.id,
      name: site.name,
      description: site.description || "",
      places: sitePlaces,
    };
  });

  const formattedDepartments = departments.map((d) => d.name);
  const formattedSafetyTeam = safetyTeam.map((m) => m.name);

  return {
    id: "FORM-SETTINGS-1",
    sites: formattedSites,
    departments: formattedDepartments,
    safetyTeam: formattedSafetyTeam,
    updatedAt: new Date().toISOString(),
    updatedBy: "System",
  };
}

async function saveFormSettingsImpl(
  client: Client,
  payload: Record<string, unknown>,
): Promise<void> {
  const userData = (payload.userData || payload.user || {}) as Record<
    string,
    unknown
  >;
  const userName = String(userData.name || userData.email || "System");
  const now = new Date().toISOString();

  let sites = payload.sites || [];
  let departments = payload.departments || [];
  let safetyTeam = payload.safetyTeam || [];
  if (typeof sites === "string") {
    try {
      sites = JSON.parse(sites as string);
    } catch {
      sites = [];
    }
  }
  if (typeof departments === "string") {
    try {
      departments = JSON.parse(departments as string);
    } catch {
      departments = [];
    }
  }
  if (typeof safetyTeam === "string") {
    try {
      safetyTeam = JSON.parse(safetyTeam as string);
    } catch {
      safetyTeam = [];
    }
  }

  const sitesRows: Record<string, unknown>[] = [];
  const placesRows: Record<string, unknown>[] = [];
  const siteList = Array.isArray(sites) ? sites : [];

  siteList.forEach((site: Record<string, unknown>, siteIndex: number) => {
    const siteId = String(site.id || crypto.randomUUID());
    sitesRows.push({
      id: siteId,
      name: site.name || "",
      description: site.description || "",
      isActive: "نشط",
      sortOrder: String(siteIndex),
      createdAt: now,
      updatedAt: now,
      createdBy: userName,
      updatedBy: userName,
    });
    const pl = Array.isArray(site.places) ? site.places : [];
    pl.forEach((place: Record<string, unknown>, placeIndex: number) => {
      placesRows.push({
        id: String(place.id || crypto.randomUUID()),
        siteId: siteId,
        siteName: String(site.name || ""),
        name: place.name || "",
        description: place.description || "",
        isActive: "نشط",
        sortOrder: String(placeIndex),
        createdAt: now,
        updatedAt: now,
        createdBy: userName,
        updatedBy: userName,
      });
    });
  });

  const deptRows: Record<string, unknown>[] = [];
  (Array.isArray(departments) ? departments : []).forEach(
    (d: unknown, index: number) => {
      const deptName = typeof d === "string" ? d : (d as Record<string, unknown>).name;
      if (!deptName) return;
      deptRows.push({
        id: crypto.randomUUID(),
        name: String(deptName),
        description: "",
        isActive: "نشط",
        sortOrder: String(index),
        createdAt: now,
        updatedAt: now,
        createdBy: userName,
        updatedBy: userName,
      });
    },
  );

  const safetyRows: Record<string, unknown>[] = [];
  (Array.isArray(safetyTeam) ? safetyTeam : []).forEach(
    (m: unknown, index: number) => {
      const name = typeof m === "string" ? m : (m as Record<string, unknown>).name;
      if (!name) return;
      safetyRows.push({
        id: crypto.randomUUID(),
        name: String(name),
        position: "",
        phone: "",
        email: "",
        isActive: "نشط",
        sortOrder: String(index),
        createdAt: now,
        updatedAt: now,
        createdBy: userName,
        updatedBy: userName,
      });
    },
  );

  await replaceSheet(client, "Form_Sites", sitesRows);
  await replaceSheet(client, "Form_Places", placesRows);
  await replaceSheet(client, "Form_Departments", deptRows);
  await replaceSheet(client, "Form_SafetyTeam", safetyRows);
}

async function prepareUserRow(
  userData: Record<string, unknown>,
): Promise<Record<string, unknown> | { err: string }> {
  const processed: Record<string, unknown> = { ...userData };
  const pwd = processed.password;
  if (typeof pwd === "string" && pwd.trim() !== "") {
    if (!isSha256Hex(pwd)) {
      processed.passwordHash = await sha256Hex(pwd.trim());
      processed.password = "***";
    } else {
      processed.passwordHash = pwd;
      processed.password = "***";
    }
  } else if (
    typeof processed.passwordHash === "string" &&
    processed.passwordHash.trim() !== ""
  ) {
    if (!isSha256Hex(processed.passwordHash)) {
      processed.passwordHash = await sha256Hex(
        String(processed.passwordHash).trim(),
      );
    }
    processed.password = "***";
  } else {
    processed.password = "***";
    processed.passwordHash = "";
  }

  if (!processed.passwordHash || String(processed.passwordHash).trim() === "") {
    return { err: "لا يمكن إضافة مستخدم بدون كلمة مرور مشفرة." };
  }
  if (!isSha256Hex(String(processed.passwordHash))) {
    return { err: "تنسيق كلمة المرور المشفرة غير صحيح." };
  }

  if (!processed.id) processed.id = crypto.randomUUID();
  const ts = new Date().toISOString();
  if (!processed.createdAt) processed.createdAt = ts;
  processed.updatedAt = ts;
  if (processed.active === undefined || processed.active === null) {
    processed.active = "true";
  }
  return processed;
}

const dbUrl = pickDatabaseUrl();
const pool = dbUrl ? new Pool(dbUrl, 10, true) : null;

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    const authErr = checkHseApiKey(req);
    if (authErr) return authErr;

    if (!pool) {
      return jsonResponse({
        success: false,
        message: "SERVER_CONFIG: valid DATABASE_URL/SUPABASE_DB_URL secret is not set for hse-api",
      }, 500);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, message: "Invalid JSON body" }, 400);
    }

    const action = String(body.action || "");
    const data = (body.data ?? {}) as Record<string, unknown>;
    const payload = {
      ...data,
      ...(body.spreadsheetId ? { spreadsheetId: body.spreadsheetId } : {}),
    };

    let client: Client | undefined;
    try {
      client = await pool.connect();

    switch (action) {
      case "testConnection":
        return jsonResponse({
          success: true,
          message: "الاتصال بالخلفية يعمل بنجاح",
          timestamp: new Date().toISOString(),
          serverTime: new Date().toISOString(),
          backend: "hse-api-supabase",
        });

      case "getPublicIP": {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("cf-connecting-ip") ||
          "";
        return jsonResponse({ success: true, data: { ip } });
      }

      case "initializeSheets":
        return jsonResponse({
          success: true,
          message:
            "PostgreSQL schema is managed via Supabase migrations (see supabase/migrations).",
        });

      case "readFromSheet": {
        const sheetName = String(
          payload.sheetName || (typeof payload === "string" ? payload : "") ||
            "",
        );
        if (!sheetName) {
          return jsonResponse({
            success: false,
            message: "Sheet name is required for readFromSheet action",
          });
        }
        const rows = await readSheet(client, sheetName);
        return jsonResponse({ success: true, data: rows });
      }

      case "batchReadSheets": {
        const sheetNames = payload.sheetNames as string[] | undefined;
        if (!Array.isArray(sheetNames) || sheetNames.length === 0) {
          return jsonResponse({
            success: false,
            message: "sheetNames array is required for batchReadSheets",
          });
        }
        const maxBatchSize = 15;
        if (sheetNames.length > maxBatchSize) {
          return jsonResponse({
            success: false,
            message:
              `Batch size too large. Maximum ${maxBatchSize} sheets per request.`,
            maxBatchSize,
          });
        }

        const batchResults: Record<string, unknown> = {};
        const failedSheets: { sheetName: string; error: string }[] = [];

        // Use parallel processing for faster loading
        await Promise.all(sheetNames.map(async (name) => {
          let subClient;
          try {
            subClient = await pool.connect();
            batchResults[name] = await readSheet(subClient, name);
          } catch (e) {
            failedSheets.push({
              sheetName: name,
              error: e instanceof Error ? e.message : String(e),
            });
            batchResults[name] = null;
          } finally {
            if (subClient) await subClient.release();
          }
        }));

        return jsonResponse({
          success: true,
          data: batchResults,
          failedSheets,
          totalSheets: sheetNames.length,
          successfulSheets: sheetNames.length - failedSheets.length,
        });
      }

      case "saveToSheet": {
        const sheetName = String(payload.sheetName || "");
        let rowsRaw: unknown = payload.data;
        const useUpsert = payload.upsert === true || payload.upsert === "true";

        if (!sheetName) {
          return jsonResponse({ success: false, message: "sheetName required" });
        }
        if (rowsRaw != null && typeof rowsRaw === "object" && !Array.isArray(rowsRaw)) {
          rowsRaw = [rowsRaw as Record<string, unknown>];
        }
        const rows = rowsRaw as Record<string, unknown>[] | undefined;
        if (!Array.isArray(rows)) {
          return jsonResponse({
            success: false,
            message: "data must be an array or a single row object",
          });
        }

        if (useUpsert) {
          await upsertRows(client, sheetName, rows);
        } else {
          await replaceSheet(client, sheetName, rows);
        }

        if (sheetName === "Users") await bumpUsersMeta(client);
        return jsonResponse({
          success: true,
          message: "تم حفظ البيانات بنجاح",
        });
      }

      case "appendToSheet": {
        const sheetName = String(payload.sheetName || "");
        const row = payload.data as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | undefined;
        if (!sheetName) {
          return jsonResponse({ success: false, message: "sheetName required" });
        }
        const rows = Array.isArray(row) ? row : row ? [row] : [];
        await appendRows(client, sheetName, rows);
        if (sheetName === "Users") await bumpUsersMeta(client);
        return jsonResponse({ success: true, message: "تمت الإضافة بنجاح" });
      }

      case "deleteFromSheet": {
        const sheetName = String(payload.sheetName || "");
        const id = String(payload.id || "");
        if (!sheetName || !id) {
          return jsonResponse({
            success: false,
            message: "sheetName and id are required for deleteFromSheet",
          });
        }
        await deleteFromSheetImpl(client, sheetName, id);
        if (sheetName === "Users") await bumpUsersMeta(client);
        return jsonResponse({ success: true, message: "تم الحذف بنجاح" });
      }

      case "getUsersMeta": {
        const meta = await getUsersMetaImpl(client);
        return jsonResponse({ success: true, data: meta });
      }

      case "getCompanySettings": {
        const dataOut = await getCompanySettingsImpl(client);
        return jsonResponse({ success: true, data: dataOut });
      }

      case "saveCompanySettings": {
        await saveCompanySettingsImpl(client, payload);
        const dataOut = await getCompanySettingsImpl(client);
        return jsonResponse({
          success: true,
          message: "تم حفظ إعدادات الشركة بنجاح",
          data: dataOut,
        });
      }

      case "getFormSettings": {
        const dataOut = await getFormSettingsImpl(client);
        return jsonResponse({ success: true, data: dataOut });
      }

      case "saveFormSettings": {
        await saveFormSettingsImpl(client, payload);
        return jsonResponse({
          success: true,
          message: "تم حفظ إعدادات النماذج بنجاح",
        });
      }

      case "addUser": {
        const prep = await prepareUserRow(payload as Record<string, unknown>);
        if ("err" in prep) {
          return jsonResponse({ success: false, message: prep.err });
        }
        await appendRows(client, "Users", [prep]);
        await bumpUsersMeta(client);
        return jsonResponse({
          success: true,
          message: "تمت إضافة المستخدم بنجاح",
          data: { id: prep.id, userId: prep.id },
        });
      }

      case "updateUser": {
        const userId = String(
          payload.userId || payload.id || (payload as { updateData?: { id?: string } }).updateData?.id || "",
        );
        const rawUpdate = (payload.updateData && typeof payload.updateData === "object")
          ? { ...(payload.updateData as Record<string, unknown>) }
          : { ...payload };
        const omit = new Set([
          "userId",
          "updateData",
          "spreadsheetId",
          "user",
          "userData",
          "id",
        ]);
        for (const k of omit) delete rawUpdate[k];
        if (!userId) {
          return jsonResponse({ success: false, message: "userId required" });
        }
        const users = await readSheet(client, "Users");
        let found = false;
        const next = await Promise.all(
          users.map(async (u) => {
            if (String(u.id) !== userId) return u;
            found = true;
            // Ensure permissions are preserved correctly
            const permissions = rawUpdate.permissions || u.permissions;
            const merged = { ...u, ...rawUpdate, permissions, id: u.id };
            if (
              typeof merged.password === "string" &&
              merged.password !== "***" &&
              merged.password.trim() !== ""
            ) {
              merged.passwordHash = await sha256Hex(merged.password.trim());
              merged.password = "***";
            }
            merged.updatedAt = new Date().toISOString();
            return merged;
          }),
        );
        if (!found) {
          return jsonResponse({ success: false, message: "المستخدم غير موجود" });
        }
        await replaceSheet(client, "Users", next);
        await bumpUsersMeta(client);
        return jsonResponse({ success: true, message: "تم تحديث المستخدم بنجاح" });
      }

      case "deleteUser": {
        const userId = String(payload.userId || payload.id || "");
        if (!userId) {
          return jsonResponse({ success: false, message: "userId required" });
        }
        const users = await readSheet(client, "Users");
        const next = users.filter((u) => String(u.id) !== userId);
        if (next.length === users.length) {
          return jsonResponse({ success: false, message: "المستخدم غير موجود" });
        }
        await replaceSheet(client, "Users", next);
        await bumpUsersMeta(client);
        return jsonResponse({ success: true, message: "تم حذف المستخدم بنجاح" });
      }

      case "resetUserPassword": {
        const uid = String(
          payload.userId || payload.id || payload.email || "",
        );
        const newPassword = String(payload.newPassword || "");
        if (!uid || !newPassword) {
          return jsonResponse({
            success: false,
            message: "userId/email and newPassword required",
          });
        }
        const hash = await sha256Hex(newPassword);
        const users = await readSheet(client, "Users");
        let found = false;
        const next = users.map((u) => {
          const match =
            String(u.id) === uid ||
            String(u.email || "").toLowerCase() === uid.toLowerCase();
          if (!match) return u;
          found = true;
          return {
            ...u,
            passwordHash: hash,
            password: "***",
            updatedAt: new Date().toISOString(),
          };
        });
        if (!found) {
          return jsonResponse({ success: false, message: "المستخدم غير موجود" });
        }
        await replaceSheet(client, "Users", next);
        await bumpUsersMeta(client);
        return jsonResponse({
          success: true,
          message: "تم إعادة تعيين كلمة المرور بنجاح",
        });
      }

      case "fixUsersSheetHeaders":
      case "fixMissingSheetHeaders":
        return jsonResponse({
          success: true,
          message: "no-op on PostgreSQL (headers managed by migrations)",
        });

      case "uploadFileToDrive": {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

        if (!supabaseUrl || !supabaseAnonKey) {
          return jsonResponse({
            success: false,
            message: "Supabase storage configuration missing (SUPABASE_URL/SUPABASE_ANON_KEY)",
          }, 500);
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const base64Data = String(payload.base64Data || "");
        const fileName = String(payload.fileName || `upload_${Date.now()}`);
        const mimeType = String(payload.mimeType || "application/octet-stream");
        const moduleName = String(payload.moduleName || "General").toLowerCase();

        if (!base64Data) {
          return jsonResponse({ success: false, message: "No data provided" });
        }

        try {
          // data:image/jpeg;base64,....
          const pureBase64 = base64Data.split(",")[1] || base64Data;
          const binaryData = decode(pureBase64);

          const bucketName = "hse-attachments";
          const filePath = `${moduleName}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, binaryData, {
              contentType: mimeType,
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          return jsonResponse({
            success: true,
            fileId: uploadData.path,
            directLink: publicUrl,
            shareableLink: publicUrl,
            fileName: fileName,
          });
        } catch (err) {
          return jsonResponse({
            success: false,
            message: `Storage error: ${err instanceof Error ? err.message : String(err)}`,
          }, 500);
        }
      }

      case "processAIQuestion": {
        const apiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim();
        if (!apiKey) {
          return jsonResponse({
            success: false,
            message:
              "OPENAI_API_KEY غير مضبوط على الدالة. أضف السر في لوحة Supabase أو عطّل مسار الذكاء الاصطناعي.",
            code: "AI_NOT_CONFIGURED",
            action,
          });
        }
        const question = String(
          (payload as { question?: string }).question ||
            (payload as { data?: { question?: string } }).data?.question ||
            "",
        );
        if (!question) {
          return jsonResponse({
            success: false,
            message: "question required",
          });
        }
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an HSE assistant. Reply concisely in Arabic when the user writes Arabic." },
              { role: "user", content: question },
            ],
          }),
        });
        const j = await r.json();
        if (!r.ok) {
          return jsonResponse({
            success: false,
            message: JSON.stringify(j).slice(0, 500),
            code: "OPENAI_ERROR",
          }, 502);
        }
        const text =
          j?.choices?.[0]?.message?.content ||
          "";
        return jsonResponse({
          success: true,
          text,
          message: text,
          data: { answer: text },
        });
      }

      // --- Legacy/Module Specific Action Mappings ---

      case "addOrUpdatePPEStockItem": {
        // Normalize itemId to id for DB compatibility
        const stockData = { ...payload } as Record<string, any>;
        if (stockData.itemId) {
          stockData.id = stockData.itemId;
          delete stockData.itemId;
        }
        await saveToSheetImpl(client, "PPE_Stock", [stockData], true);
        return jsonResponse({ success: true, message: "تم حفظ الصنف بنجاح" });
      }

      case "addPPETransaction": {
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, "PPE_Transactions", [row]);
        return jsonResponse({ success: true, message: "تم تسجيل العملية بنجاح" });
      }

      case "deletePPE": {
        const id = String(payload.ppeId || payload.id || "");
        await deleteFromSheetImpl(client, "PPE", id);
        return jsonResponse({ success: true, message: "تم حذف السجل بنجاح" });
      }

      case "deletePPEStockItem": {
        const id = String(payload.itemId || payload.id || "");
        await deleteFromSheetImpl(client, "PPE_Stock", id);
        return jsonResponse({ success: true, message: "تم حذف الصنف بنجاح" });
      }

      case "deleteClinicVisit": {
        const id = String(payload.visitId || payload.id || "");
        await deleteFromSheetImpl(client, "ClinicVisits", id);
        return jsonResponse({ success: true, message: "تم حذف الزيارة بنجاح" });
      }

      case "deleteMedication": {
        const id = String(payload.medicationId || payload.id || "");
        await deleteFromSheetImpl(client, "Medications", id);
        return jsonResponse({ success: true, message: "تم حذف الدواء بنجاح" });
      }

      case "deleteObservation": {
        const id = String(payload.observationId || payload.id || "");
        await deleteFromSheetImpl(client, "DailyObservations", id);
        return jsonResponse({ success: true, message: "تم حذف الملاحظة بنجاح" });
      }

      case "deleteSafetyTeamMember":
      case "deleteSafetyTeamTask":
      case "deleteNearMiss":
      case "deleteSafetyAlert":
      case "deleteAppEmergencyNumber":
      case "deleteBackup":
      case "deleteAnalysis": {
        const tableMap: Record<string, string> = {
          deleteSafetyTeamMember: "SafetyTeamMembers",
          deleteSafetyTeamTask: "SafetyTeamTasks",
          deleteNearMiss: "NearMiss",
          deleteSafetyAlert: "SafetyAlerts",
          deleteAppEmergencyNumber: "AppEmergencyNumbers",
          deleteBackup: "BackupLog",
          deleteAnalysis: "TrainingAnalysisData",
          deleteFireEquipmentApprovalRequest: "FireEquipment",
          deleteIssuingAuthority: "IssuingAuthorities",
          deleteContractorIssuingAuthority: "IssuingAuthorities",
          deleteSafetyTeamMember: "SafetyTeamMembers",
          deleteSafetyTeamTask: "SafetyTeamTasks",
          deleteAppEmergencyNumber: "AppEmergencyNumbers",
        };
        const table = tableMap[action];
        const id = String(payload.id || "");
        await deleteFromSheetImpl(client, table, id);
        return jsonResponse({ success: true, message: "تم الحذف بنجاح" });
      }

      case "deleteFireEquipment": {
        const id = String(
          payload.fireEquipmentId || payload.assetId || payload.id || "",
        );
        await deleteFromSheetImpl(client, "FireEquipment", id);
        return jsonResponse({ success: true, message: "تم حذف المعدة بنجاح" });
      }

      case "deleteIncident": {
        const id = String(payload.incidentId || payload.id || "");
        await deleteFromSheetImpl(client, "Incidents", id);
        return jsonResponse({ success: true, message: "تم حذف الحادث بنجاح" });
      }

      case "deleteSafetyAlert": {
        const id = String(payload.alertId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyAlerts", id);
        return jsonResponse({ success: true, message: "تم حذف التنبيه بنجاح" });
      }

      case "deleteNearMiss": {
        const id = String(payload.nearMissId || payload.id || "");
        await deleteFromSheetImpl(client, "NearMiss", id);
        return jsonResponse({ success: true, message: "تم حذف السجل بنجاح" });
      }

      case "deleteTraining": {
        const id = String(payload.trainingId || payload.id || "");
        await deleteFromSheetImpl(client, "Training", id);
        return jsonResponse({ success: true, message: "تم حذف التدريب بنجاح" });
      }

      case "deleteAllObservations": {
        await replaceSheet(client, "DailyObservations", []);
        return jsonResponse({
          success: true,
          message: "تم حذف جميع الملاحظات بنجاح",
        });
      }

      case "deleteFireEquipmentApprovalRequest": {
        const id = String(payload.requestId || payload.id || "");
        await deleteFromSheetImpl(client, "ContractorApprovalRequests", id);
        return jsonResponse({ success: true, message: "تم حذف الطلب بنجاح" });
      }

      case "deleteSafetyTeamMember": {
        const id = String(payload.memberId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyTeamMembers", id);
        return jsonResponse({ success: true, message: "تم حذف العضو بنجاح" });
      }

      case "deleteSafetyTeamTask": {
        const id = String(payload.taskId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyTeamTasks", id);
        return jsonResponse({ success: true, message: "تم حذف المهمة بنجاح" });
      }

      case "deleteCustomKPI": {
        const id = String(payload.kpiId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyTeamKPIs", id);
        return jsonResponse({ success: true, message: "تم حذف المؤشر بنجاح" });
      }

      case "deleteSafetyTeamAttendance": {
        const id = String(payload.attendanceId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyTeamAttendance", id);
        return jsonResponse({ success: true, message: "تم حذف سجل التحضير بنجاح" });
      }

      case "deleteSafetyTeamLeave": {
        const id = String(payload.leaveId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyTeamLeaves", id);
        return jsonResponse({ success: true, message: "تم حذف سجل الإجازة بنجاح" });
      }

      case "deactivateEmployee": {
        const id = String(payload.employeeId || payload.id || "");
        if (!id) return jsonResponse({ success: false, message: "employeeId required" });
        const rows = await readSheet(client, "Employees");
        const next = rows.map((r) => {
          if (String(r.id) === id) {
            return {
              ...r,
              isActive: "غير نشط",
              status: "Deactivated",
              updatedAt: new Date().toISOString(),
            };
          }
          return r;
        });
        await replaceSheet(client, "Employees", next);
        return jsonResponse({
          success: true,
          message: "تم إلغاء تفعيل الموظف بنجاح",
        });
      }

      case "addEnvironmentalAspect":
      case "addHSEAudit":
      case "addHSECorrectiveAction":
      case "addHSENonConformity":
      case "addHSEObjective":
      case "addSafetyTeamAttendance":
      case "addSafetyTeamKPI":
      case "addSafetyTeamLeave":
      case "addSafetyTeamMember":
      case "addSafetyTeamTask":
      case "addClinicVisit":
      case "addInjury":
      case "addMedication":
      case "addTraining":
      case "addDocumentCode":
      case "addDocumentVersion":
      case "addFireEquipmentInspection":
      case "addSafetyAlert": {
        const sheetMap: Record<string, string> = {
          addEnvironmentalAspect: "EnvironmentalAspects",
          addHSEAudit: "HSEAudits",
          addHSECorrectiveAction: "HSECorrectiveActions",
          addHSENonConformity: "HSENonConformities",
          addHSEObjective: "HSEObjectives",
          addSafetyTeamAttendance: "SafetyTeamAttendance",
          addSafetyTeamKPI: "SafetyTeamKPIs",
          addSafetyTeamLeave: "SafetyTeamLeaves",
          addSafetyTeamMember: "SafetyTeamMembers",
          addSafetyTeamTask: "SafetyTeamTasks",
          addClinicVisit: "ClinicVisits",
          addInjury: "Injuries",
          addMedication: "Medications",
          addTraining: "Training",
          addDocumentCode: "DocumentCodes",
          addDocumentVersion: "DocumentVersions",
          addFireEquipmentInspection: "FireEquipmentInspections",
          addSafetyAlert: "SafetyAlerts",
          addClinicVisitDeletionRequest: "ClinicVisits", // usually marked as deleted or in a separate table, mapping to same for now
          addMedicationDeletionRequest: "Medications",
          addContractorApprovalRequest: "ContractorApprovalRequests",
          addContractorDeletionRequest: "ContractorDeletionRequests",
          addFireEquipmentApprovalRequest: "FireEquipment",
          addIncidentNotification: "IncidentNotifications",
          addPeriodicInspection: "PeriodicInspectionRecords",
          addSupplyRequest: "ClinicInventory",
          addChangeRequest: "CarbonFootprint", // Placeholder or mapping to a change management table if exists
          addNotification: "Notifications",
          addObservationComment: "DailyObservations",
          addObservationUpdate: "DailyObservations",
          addActionComment: "ActionTrackingRegister",
          addActionUpdate: "ActionTrackingRegister",
          addIssue: "HSENonConformities",
        };
        const table = sheetMap[action];
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, table, [row]);
        return jsonResponse({ success: true, message: "تمت الإضافة بنجاح" });
      }

      case "deleteApprovedContractor":
      case "deleteContractor": {
        const table =
          action === "deleteApprovedContractor"
            ? "ApprovedContractors"
            : "Contractors";
        const id = String(payload.id || payload.contractorId || "");
        await deleteFromSheetImpl(client, table, id);
        return jsonResponse({ success: true, message: "تم الحذف بنجاح" });
      }

      case "updateApprovedContractor": {
        const id = String(payload.approvedContractorId || payload.id || "");
        const data = (payload.updateData || payload) as Record<string, any>;
        if (id && !data.id) data.id = id;
        await saveToSheetImpl(client, "ApprovedContractors", [data], true);
        return jsonResponse({ success: true, message: "تم التحديث بنجاح" });
      }

      case "deleteActionTracking": {
        const id = String(payload.actionId || payload.id || "");
        await deleteFromSheetImpl(client, "ActionTrackingRegister", id);
        return jsonResponse({ success: true, message: "تم حذف الإجراء بنجاح" });
      }

      case "addActionTracking": {
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, "ActionTrackingRegister", [row]);
        return jsonResponse({ success: true, message: "تمت إضافة الإجراء بنجاح" });
      }

      case "updateActionTracking": {
        const id = String(payload.actionId || payload.id || "");
        const data = (payload.updateData || payload) as Record<string, any>;
        if (id && !data.id) data.id = id;
        await saveToSheetImpl(client, "ActionTrackingRegister", [data], true);
        return jsonResponse({ success: true, message: "تم تحديث الإجراء بنجاح" });
      }

      case "deletePTW": {
        const id = String(payload.permitId || payload.id || "");
        await deleteFromSheetImpl(client, "PTW", id);
        return jsonResponse({ success: true, message: "تم حذف التصريح بنجاح" });
      }

      case "deletePTWRegistryEntry": {
        const id = String(payload.entryId || payload.id || "");
        await deleteFromSheetImpl(client, "PTWRegistry", id);
        return jsonResponse({ success: true, message: "تم حذف السجل بنجاح" });
      }

      case "deleteSafetyBudgetTransaction": {
        const id = String(payload.transactionId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyBudgetTransactions", id);
        return jsonResponse({ success: true, message: "تم حذف الحركة بنجاح" });
      }

      case "deleteViolationFromSheet": {
        const id = String(payload.id || "");
        await deleteFromSheetImpl(client, "Violations", id);
        return jsonResponse({ success: true, message: "تم حذف المخالفة بنجاح" });
      }

      case "deleteDocumentCode": {
        const id = String(payload.id || "");
        await deleteFromSheetImpl(client, "DocumentCodes", id);
        return jsonResponse({ success: true, message: "تم حذف الكود بنجاح" });
      }

      case "deleteHSEMonitoringPlan": {
        const id = String(payload.planId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyPerformanceKPIs", id);
        return jsonResponse({ success: true, message: "تم حذف النشاط بنجاح" });
      }

      case "deleteKPIAnnualPlan": {
        const id = String(payload.planId || payload.id || "");
        await deleteFromSheetImpl(client, "SafetyPerformanceKPIs", id);
        return jsonResponse({ success: true, message: "تم حذف المؤشر بنجاح" });
      }

      case "deleteEmployee": {
        const id = String(payload.employeeId || payload.id || "");
        await deleteFromSheetImpl(client, "Employees", id);
        return jsonResponse({ success: true, message: "تم حذف الموظف بنجاح" });
      }

      case "deleteSOPJHA": {
        const id = String(payload.sopJhaId || payload.id || "");
        await deleteFromSheetImpl(client, "SOPJHA", id);
        return jsonResponse({ success: true, message: "تم الحذف بنجاح" });
      }

      case "deleteAllEmployees": {
        await replaceSheet(client, "Employees", []);
        return jsonResponse({
          success: true,
          message: "تم حذف جميع الموظفين بنجاح",
        });
      }

      case "addUserActivityLog": {
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, "UserActivityLog", [row]);
        return jsonResponse({ success: true });
      }

      case "getAllUserActivityLogs": {
        const rows = await readSheet(client, "UserActivityLog");
        return jsonResponse({ success: true, data: rows });
      }

      case "getUserTasksByUserId": {
        const uid = String(payload.userId || payload.id || "");
        const rows = await readSheet(client, "UserTasks");
        const filtered = rows.filter(r => String(r.userId) === uid || String(r.assignedTo) === uid);
        return jsonResponse({ success: true, data: filtered });
      }

      case "getAllClinicVisits": {
        const rows = await readSheet(client, "ClinicVisits");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllPPE": {
        const rows = await readSheet(client, "PPE");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllPPEStockItems": {
        const rows = await readSheet(client, "PPE_Stock");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllPPETransactions": {
        const rows = await readSheet(client, "PPE_Transactions");
        return jsonResponse({ success: true, data: rows });
      }

      case "getPPEItemsList": {
        const rows = await readSheet(client, "PPE_Stock");
        return jsonResponse({ success: true, data: rows });
      }

      case "getPPEMatrix": {
        const rows = await readSheet(client, "PPEMatrix");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllTrainings": {
        const rows = await readSheet(client, "Training");
        return jsonResponse({ success: true, data: rows });
      }

      case "getEmployeeTrainingMatrix": {
        const rows = await readSheet(client, "EmployeeTrainingMatrix");
        return jsonResponse({ success: true, data: rows });
      }

      case "getDailyUserSessionActivityReport": {
        const rows = await readSheet(client, "UserActivityLog");
        return jsonResponse({ success: true, data: rows });
      }

      case "getSmartRecommendations": {
        // Mocking smart recommendations for now
        return jsonResponse({
          success: true,
          data: [
            { id: 1, text: "تأكد من تحديث مصفوفة التدريب للموظفين الجدد." },
            { id: 2, text: "مراجعة تصاريح العمل منتهية الصلاحية." }
          ]
        });
      }

      case "addIncident": {
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, "Incidents", [row]);
        return jsonResponse({ success: true, message: "تم تسجيل الحادث بنجاح" });
      }

      case "getAllIncidents": {
        const rows = await readSheet(client, "Incidents");
        return jsonResponse({ success: true, data: rows });
      }

      case "addSickLeave": {
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, "SickLeave", [row]);
        return jsonResponse({ success: true, message: "تم تسجيل الإجازة بنجاح" });
      }

      case "getAllNearMisses": {
        const rows = await readSheet(client, "NearMiss");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllObservations": {
        const rows = await readSheet(client, "DailyObservations");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllPTWs": {
        const rows = await readSheet(client, "PTW");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllPeriodicInspectionRecords": {
        const rows = await readSheet(client, "PeriodicInspectionRecords");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllTrainingAttendance": {
        const rows = await readSheet(client, "TrainingAttendance");
        return jsonResponse({ success: true, data: rows });
      }

      case "getAllContractorTrainings": {
        const rows = await readSheet(client, "ContractorTrainings");
        return jsonResponse({ success: true, data: rows });
      }

      case "getActionTrackingSettings": {
        const rows = await readSheet(client, "ActionTrackingSettings");
        return jsonResponse({ success: true, data: rows[0] || {} });
      }

      case "getActionTrackingKPIs": {
        // Simple logic for KPIs
        const rows = await readSheet(client, "ActionTrackingRegister");
        const total = rows.length;
        const closed = rows.filter(r => r.status === "Closed" || r.status === "تم الإغلاق").length;
        return jsonResponse({
          success: true,
          data: { total, closed, open: total - closed }
        });
      }

      case "getSafetyTeamMembers": {
        const rows = await readSheet(client, "SafetyTeamMembers");
        return jsonResponse({ success: true, data: rows });
      }

      case "getSafetyTeamMember": {
        const id = String(payload.id || "");
        const rows = await readSheet(client, "SafetyTeamMembers");
        const row = rows.find(r => String(r.id) === id);
        return jsonResponse({ success: true, data: row || null });
      }

      case "getSafetyTeamKPIs": {
        const rows = await readSheet(client, "SafetyTeamKPIs");
        return jsonResponse({ success: true, data: rows });
      }

      case "getSafetyTeamAttendance": {
        const rows = await readSheet(client, "SafetyTeamAttendance");
        return jsonResponse({ success: true, data: rows });
      }

      case "getSafetyTeamLeaves": {
        const rows = await readSheet(client, "SafetyTeamLeaves");
        return jsonResponse({ success: true, data: rows });
      }

      case "getJobDescription": {
        const rows = await readSheet(client, "SafetyJobDescriptions");
        return jsonResponse({ success: true, data: rows });
      }

      case "getOrganizationalStructure": {
        const rows = await readSheet(client, "SafetyOrganizationalStructure");
        return jsonResponse({ success: true, data: rows });
      }

      case "getNextChangeRequestNumber": {
        // This usually increments a counter
        return jsonResponse({ success: true, nextNumber: `CR-${Date.now().toString().slice(-6)}` });
      }

      case "deleteTraining": {
        const id = String(payload.trainingId || payload.id || "");
        await deleteFromSheetImpl(client, "Training", id);
        return jsonResponse({ success: true, message: "تم حذف التدريب بنجاح" });
      }

      case "logAIQuestion": {
        const row = { ...payload } as Record<string, any>;
        if (!row.id) row.id = crypto.randomUUID();
        await appendRows(client, "UserAILog", [row]);
        return jsonResponse({ success: true });
      }

      case "exportDailyObservationsPptReport":
      case "getDailyObservationsPptTemplateId":
      case "setDailyObservationsPptTemplateId": {
        return jsonResponse({ success: true, message: "Mocked PPT action" });
      }

      default:
        return jsonResponse({
          success: false,
          message:
            `hse-api: action not implemented yet (${action}). Use generic sheet ops or extend Edge handler.`,
          code: "NOT_IMPLEMENTED",
          action,
        });
    }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("hse-api error:", msg);
      return jsonResponse({ success: false, message: msg }, 500);
    } finally {
      try {
        if (client) await client.end();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("hse-api fatal:", msg);
    return new Response(JSON.stringify({ success: false, message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
