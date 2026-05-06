/**
 * Supabase Edge Function: Apps Script–compatible RPC for HSE frontend.
 * Generic sheet ops + MVP actions for Supabase-only deployments.
 *
 * Security: set Supabase secret HSE_API_KEY — requests must send header x-hse-api-key.
 * Optional AI: OPENAI_API_KEY for processAIQuestion (minimal proxy).
 *
 * saveToSheet: full table replace (DELETE ALL then INSERT). Use appendToSheet for incremental rows.
 */
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
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
  IncidentsRegistry: "Incidents",
  safetyAlerts: "IncidentNotifications",
  LegalInventory: "LegalDocuments",
  EmployeePPEMatrixByCode: "PPEMatrix",
  PTWRegistry: "PTW",
  PTW_MAP_SITES: "PTW_MAP_COORDINATES",
  TrainingAttendance: "Training",
  TrainingAnalysisData: "Training",
};

function resolveSheetName(sheetName: string): string {
  const raw = String(sheetName || "").trim();
  if (!raw) return raw;
  return SHEET_ALIASES[raw] || raw;
}

function qTable(sheetName: string): string {
  const resolved = resolveSheetName(sheetName);
  if (!ALLOWED_SHEETS.has(resolved)) {
    throw new Error(`Invalid or unsupported sheet name: ${sheetName}`);
  }
  return '"' + resolved.replace(/"/g, '""') + '"';
}

const tableColumnsCache = new Map<string, Set<string>>();

async function getTableColumns(client: Client, sheetName: string): Promise<Set<string>> {
  const resolved = resolveSheetName(sheetName);
  const cacheKey = resolved.toLowerCase();
  const cached = tableColumnsCache.get(cacheKey);
  if (cached) return cached;

  const res = await client.queryObject<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [resolved],
  );
  const cols = new Set(
    (res.rows || []).map((r) => String(r.column_name || "").trim()).filter(Boolean),
  );
  tableColumnsCache.set(cacheKey, cols);
  return cols;
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

async function replaceSheet(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  const tableCols = await getTableColumns(client, sheetName);
  await client.queryObject(`DELETE FROM public.${t}`);
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) =>
      row[k] !== undefined && tableCols.has(String(k))
    );
    if (keys.length === 0) continue;
    const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => serializeCell(row[k]));
    await client.queryObject(
      `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
      vals,
    );
  }
}

async function appendRows(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  const tableCols = await getTableColumns(client, sheetName);
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) =>
      row[k] !== undefined && tableCols.has(String(k))
    );
    if (keys.length === 0) continue;
    const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => serializeCell(row[k]));
    await client.queryObject(
      `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
      vals,
    );
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

    const dbUrl = pickDatabaseUrl();
    if (!dbUrl) {
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
      client = new Client(parseDatabaseUrl(dbUrl));
      await client.connect();

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

      case "getAllEmployees": {
        const rows = await readSheet(client, "Employees");
        const includeInactive = Boolean(payload?.filters?.includeInactive);
        const filtered = includeInactive
          ? rows
          : rows.filter((r) => {
            const status = String(r.status ?? "").trim().toLowerCase();
            const resignationDate = String(r.resignationDate ?? "").trim();
            if (resignationDate) return false;
            if (status === "inactive" || status === "غير نشط") return false;
            return true;
          });
        return jsonResponse({ success: true, data: filtered });
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
        for (const name of sheetNames) {
          try {
            batchResults[name] = await readSheet(client, name);
          } catch (e) {
            failedSheets.push({
              sheetName: name,
              error: e instanceof Error ? e.message : String(e),
            });
            batchResults[name] = null;
          }
        }
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
        const rows = payload.data as Record<string, unknown>[] | undefined;
        if (!sheetName) {
          return jsonResponse({ success: false, message: "sheetName required" });
        }
        if (!Array.isArray(rows)) {
          return jsonResponse({ success: false, message: "data must be an array" });
        }
        await replaceSheet(client, sheetName, rows);
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
            const merged = { ...u, ...rawUpdate, id: u.id };
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

      case "uploadFileToDrive":
        return jsonResponse({
          success: false,
          message:
            "رفع الملفات عبر Google Drive غير مدعوم على Postgres. استخدم Supabase Storage وحفظ الرابط في الجدول.",
          code: "USE_SUPABASE_STORAGE",
          action,
        });

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
