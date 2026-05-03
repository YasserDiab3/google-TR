/**
 * Smoke test for Supabase hse-api (requires network).
 * Usage:
 *   set HSE_RPC_URL=https://....supabase.co/functions/v1/hse-api
 *   set HSE_SUPABASE_ANON_KEY=eyJ...   (optional if verify_jwt false)
 *   set HSE_API_KEY=...                 (optional, must match Edge secret)
 *   node tools/smoke-hse-api.mjs
 */
const url = process.env.HSE_RPC_URL?.trim();
const anon = process.env.HSE_SUPABASE_ANON_KEY?.trim();
const apiKey = process.env.HSE_API_KEY?.trim();

if (!url) {
  console.error("Missing HSE_RPC_URL");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
};
if (anon) {
  headers.apikey = anon;
  if (anon.startsWith("eyJ")) headers.Authorization = `Bearer ${anon}`;
}
if (apiKey) headers["x-hse-api-key"] = apiKey;

const body = JSON.stringify({ action: "testConnection", data: {} });
const res = await fetch(url, { method: "POST", headers, body });
const text = await res.text();
console.log("status", res.status);
console.log(text.slice(0, 800));
if (!res.ok) process.exit(2);
let j;
try {
  j = JSON.parse(text);
} catch {
  process.exit(3);
}
if (!j.success) process.exit(4);
console.log("smoke ok");
process.exit(0);
