/**
 * Supabase Auth — تسجيل دخول بالبريد وكلمة المرور (REST، بدون SDK).
 * الرموز تُخزَّن في sessionStorage؛ تُستخدم Authorization Bearer مع Edge Function بعد الدخول.
 */
(function (global) {
    var STORAGE_ACCESS = 'hse_supabase_access_token';
    var STORAGE_REFRESH = 'hse_supabase_refresh_token';
    var STORAGE_EXPIRES = 'hse_supabase_expires_at';

    function resolveProjectUrl() {
        if (global.__HSE_SUPABASE_URL__) {
            return String(global.__HSE_SUPABASE_URL__).replace(/\/$/, '');
        }
        var rpc = global.__HSE_RPC_URL__ || '';
        try {
            var u = new URL(rpc);
            if (u.hostname.toLowerCase().endsWith('.supabase.co')) {
                return u.origin;
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function persistSession(data) {
        try {
            if (data.access_token) sessionStorage.setItem(STORAGE_ACCESS, data.access_token);
            if (data.refresh_token) sessionStorage.setItem(STORAGE_REFRESH, data.refresh_token);
            if (data.expires_in) {
                sessionStorage.setItem(STORAGE_EXPIRES, String(Date.now() + Number(data.expires_in) * 1000));
            }
        } catch (e) { /* ignore */ }
    }

    function clearSession() {
        try {
            sessionStorage.removeItem(STORAGE_ACCESS);
            sessionStorage.removeItem(STORAGE_REFRESH);
            sessionStorage.removeItem(STORAGE_EXPIRES);
        } catch (e) { /* ignore */ }
    }

    function getAccessToken() {
        try {
            return sessionStorage.getItem(STORAGE_ACCESS) || '';
        } catch (e) {
            return '';
        }
    }

    async function signInWithPassword(email, password) {
        var url = resolveProjectUrl();
        var anon = global.__HSE_SUPABASE_ANON_KEY__;
        if (!url || !anon) {
            throw new Error('إعدادات Supabase غير كاملة (__HSE_SUPABASE_URL__ أو مفتاح anon).');
        }
        var res = await fetch(url + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: anon,
                Authorization: 'Bearer ' + anon,
            },
            body: JSON.stringify({ email: email, password: password }),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) {
            var msg = data.error_description || data.msg || data.message || data.error || 'فشل تسجيل الدخول';
            throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
        persistSession(data);
        return data;
    }

    async function signOutRemote() {
        var url = resolveProjectUrl();
        var anon = global.__HSE_SUPABASE_ANON_KEY__;
        var rt = '';
        try {
            rt = sessionStorage.getItem(STORAGE_REFRESH) || '';
        } catch (e) { /* ignore */ }
        if (!url || !anon || !rt) return;
        try {
            await fetch(url + '/auth/v1/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: anon,
                    Authorization: 'Bearer ' + anon,
                },
                body: JSON.stringify({ refresh_token: rt }),
            });
        } catch (e) { /* ignore */ }
    }

    global.HseSupabasePasswordAuth = {
        resolveProjectUrl: resolveProjectUrl,
        signInWithPassword: signInWithPassword,
        persistSession: persistSession,
        clearSession: clearSession,
        getAccessToken: getAccessToken,
        signOutRemote: signOutRemote,
        STORAGE_ACCESS_KEY: STORAGE_ACCESS,
    };
})(typeof window !== 'undefined' ? window : globalThis);
