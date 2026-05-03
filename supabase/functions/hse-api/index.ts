/**
 * Supabase Edge Function: Apps Script–compatible RPC for HSE frontend.
 * Implements generic sheet operations against PostgreSQL; other actions return NOT_IMPLEMENTED until ported.
 */
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { ALLOWED_SHEETS } from "./allowed_sheets.gen.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-csrf-token",
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

function qTable(sheetName: string): string {
  if (!ALLOWED_SHEETS.has(sheetName)) {
    throw new Error(`Invalid or unsupported sheet name: ${sheetName}`);
  }
  return '"' + sheetName.replace(/"/g, '""') + '"';
}

function serializeCell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

async function readSheet(
  client: Client,
  sheetName: string,
): Promise<Record<string, unknown>[]> {
  const t = qTable(sheetName);
  const result = await client.queryObject<Record<string, unknown>>(
    `SELECT * FROM public.${t}`,
  );
  return result.rows;
}

async function replaceSheet(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  await client.query(`DELETE FROM public.${t}`);
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (keys.length === 0) continue;
    const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => serializeCell(row[k]));
    await client.query(
      `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
      ...vals,
    );
  }
}

async function appendRows(
  client: Client,
  sheetName: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const t = qTable(sheetName);
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => row[k] !== undefined);
    if (keys.length === 0) continue;
    const cols = keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const vals = keys.map((k) => serializeCell(row[k]));
    await client.query(
      `INSERT INTO public.${t} (${cols}) VALUES (${placeholders})`,
      ...vals,
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  const dbUrl = Deno.env.get("DATABASE_URL");
  if (!dbUrl) {
    return jsonResponse({
      success: false,
      message: "SERVER_CONFIG: DATABASE_URL secret is not set for hse-api",
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
  const payload = { ...data, ...(body.spreadsheetId ? { spreadsheetId: body.spreadsheetId } : {}) };

  const client = new Client(parseDatabaseUrl(dbUrl));

  try {
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
        return jsonResponse({
          success: true,
          message: "تم حفظ البيانات بنجاح",
        });
      }

      case "appendToSheet": {
        const sheetName = String(payload.sheetName || "");
        const row = payload.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
        if (!sheetName) {
          return jsonResponse({ success: false, message: "sheetName required" });
        }
        const rows = Array.isArray(row) ? row : row ? [row] : [];
        await appendRows(client, sheetName, rows);
        return jsonResponse({ success: true, message: "تمت الإضافة بنجاح" });
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
      await client.end();
    } catch {
      /* ignore */
    }
  }
});
