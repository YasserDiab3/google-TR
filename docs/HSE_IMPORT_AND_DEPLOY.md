# HSE — ترحيل البيانات (Excel / Google Sheets) والتشغيل مع Supabase

This document summarizes how full-database imports work and what must be configured for the app to reach Postgres via `hse-api`.

## 1. Backend (Supabase)

1. Apply migrations under `supabase/migrations/` to your Supabase project (including `20260203140000_hse_sheet_tables.sql` and later fixes).
2. Deploy the Edge Function `hse-api` from `supabase/functions/hse-api/`.
3. Set secrets (see `supabase/functions/hse-api/.env.local.example`):
   - `DATABASE_URL` or `SUPABASE_DB_URL` — direct Postgres connection string for the function.
   - `HSE_API_KEY` — required if set; the frontend must send header `x-hse-api-key` with the same value.
   - Optional: service keys used by other actions in the same function.

**Important:** `saveToSheet` without `upsert` deletes all rows in the target table and inserts only the payload. Prefer merge mode (`upsert: true`) in the bulk-import wizard unless you intend a full table replacement.

## 2. Frontend configuration

1. In **Settings → Integration**, set the Apps Script / RPC URL to your deployed endpoint, for example:
   - `https://<project-ref>.supabase.co/functions/v1/hse-api`
2. Ensure `secrets.local.js` or UI configuration supplies `x-hse-api-key` when `HSE_API_KEY` is enabled on the function (handled in `cloud-integration.js`).
3. For legacy Google Sheets deployments (non-Supabase URL), a valid `spreadsheetId` may still be required for some flows; Supabase RPC URLs skip sheet-id enforcement where implemented.

## 3. Bulk import UI (admin)

Administrators can use **Settings → استيراد Excel / Sheets**:

- Download **per-sheet templates** or **multi-sheet template workbooks** (column headers come from `Backend/Headers.gs`, regenerated into `Frontend/js/modules/data/sheet-headers.generated.json` when you run `node tools/generate-schema-sql.mjs`).
- Upload an `.xlsx` exported from Google Sheets (**File → Download → Microsoft Excel**). Worksheet tab names must match allowed sheet names.
- Use **merge (upsert)** for safe chunked imports; **full replace** requires explicit confirmation.

Module shortcuts (admin): **Incidents**, **Near Miss**, **Violations**, and **Chemical Safety** include an **استيراد Excel** button that opens Settings on this tab with the relevant table pre-selected for templates.

## 4. CLI tools (`tools/`)

- `node tools/import-sheets-json.mjs --dir <folder>` — imports `SheetName.json` arrays. Use `--upsert` to merge on `id` instead of replacing the whole table.
- `node tools/import-sheets-xlsx.mjs --file <path.xlsx>` — imports all worksheets from an Excel file (requires `npm install` in `tools/`). Supports `--upsert` and `--replace`.

Regenerate allowlists and header metadata after editing `Backend/Headers.gs` or `Backend/Config.gs`:

```bash
node tools/generate-schema-sql.mjs
```

This refreshes `allowed_sheets.gen.ts`, the HSE migration SQL file, and `Frontend/js/modules/data/sheet-headers.generated.json`.
