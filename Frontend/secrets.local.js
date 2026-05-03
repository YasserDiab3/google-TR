/**
 * أسرار الواجهة — الملف مستبعد عن Git (.gitignore).
 * 1) Project Settings → API → انسخ "anon" "public" والصقه أسفل.
 * 2) لا تضع هنا service_role ولا كلمة مرور قاعدة البيانات.
 */
(function () {
    "use strict";
    window.__HSE_SUPABASE_ANON_KEY__ = "";

    /* اختياري: إن أردت رابط RPC مختلف عن الافتراضي في index.html */
    /* window.__HSE_RPC_URL__ = "https://apsawzzqurfnpsucyozb.supabase.co/functions/v1/hse-api"; */
})();
