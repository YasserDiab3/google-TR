/**
 * Smoke-test hse-api Edge function (testConnection + readFromSheet sample).
 * Usage: HSE_API_URL=https://xxx.supabase.co/functions/v1/hse-api node verify-hse-api.mjs
 */
const url = process.env.HSE_API_URL || "";
if (!url) {
  console.error("Set HSE_API_URL to your deployed hse-api endpoint.");
  process.exit(1);
}

async function post(body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    console.error("Non-JSON:", text.slice(0, 500));
    process.exit(1);
  }
  return { ok: r.ok, status: r.status, json: j };
}

const tc = await post({
  action: "testConnection",
  data: {},
  csrfToken: "verify",
  clientSessionId: "verify",
  timestamp: new Date().toISOString(),
});
console.log("testConnection:", tc.status, tc.json);

const rd = await post({
  action: "readFromSheet",
  data: { sheetName: "Users" },
  csrfToken: "verify",
  clientSessionId: "verify",
  timestamp: new Date().toISOString(),
});
console.log("readFromSheet Users:", rd.status, rd.json?.success, Array.isArray(rd.json?.data) ? `rows=${rd.json.data.length}` : rd.json?.message);
