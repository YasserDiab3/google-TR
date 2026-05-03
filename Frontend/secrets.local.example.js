/**
 * انسخ إلى secrets.local.js (نفس المجلد Frontend/) — الملف secrets.local.js مستبعد عن Git.
 *
 * Supabase (Postgres فقط):
 * - __HSE_RPC_URL__: رابط دالة hse-api
 * - __HSE_USE_SUPABASE__ / __HSE_SUPABASE_ONLY__: true (يمكن تعيين false للعودة إلى GAS محلياً)
 * - __HSE_SUPABASE_ANON_KEY__: من لوحة Supabase → API (JWT anon أو المفتاح المنشور)
 * - __HSE_API_KEY__: اختياري — يجب أن يطابق سر HSE_API_KEY على الدالة إن فعّلتَه
 */
(function () {
    "use strict";
    window.__HSE_RPC_URL__ =
        window.__HSE_RPC_URL__ ||
        "https://apsawzzqurfnpsucyozb.supabase.co/functions/v1/hse-api";
    window.__HSE_USE_SUPABASE__ = true;
    window.__HSE_SUPABASE_ONLY__ = true;
    window.__HSE_SUPABASE_ANON_KEY__ = "الصق_هنا_mفتاح_anon_أو_sb_publishable";
    /* window.__HSE_API_KEY__ = "نفس_قيمة_سر_HSE_API_KEY_من_Supabase_Dashboard"; */
})();
