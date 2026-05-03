/**
 * تطبيق ملف الهجرة الرئيسي على Postgres (Supabase أو أي مضيف).
 * يتطلب متغير البيئة DATABASE_URL (سلسلة الاتصال الكاملة من لوحة Supabase → Settings → Database).
 *
 * الاستخدام من PowerShell:
 *   $env:DATABASE_URL = "postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres"
 *   node tools/apply-migration.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATION = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260203140000_hse_sheet_tables.sql",
);

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error(
      "ضع DATABASE_URL (سلسلة postgres من Supabase) ثم أعد التشغيل.\n" +
        "مثال: postgresql://postgres.xxx:كلمة_المرور@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
    );
    process.exit(1);
  }

  let sql = fs.readFileSync(MIGRATION, "utf8");
  sql = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");

  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(";") ? s : s + ";"));

  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    for (let i = 0; i < statements.length; i++) {
      await client.query(statements[i]);
    }
    console.log("OK: تم تنفيذ", statements.length, "جملة SQL من", MIGRATION);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
