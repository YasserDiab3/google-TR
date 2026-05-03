console.log('🟢 login-init-fixed.js loaded successfully!');

// دالة log في النطاق العام — تُغطَّى داخل الـ IIFE بنسخة أكثر تفصيلاً
// ضرورية لـ handleLogin والدوال الخارج عن الـ IIFE
var log = function() { try { console.log.apply(console, arguments); } catch(e) {} };

// ===== تهيئة مباشرة لشاشة تسجيل الدخول - نسخة محسنة ومحلولة =====

// عزل هذا الملف بالكامل لتجنب تلويث الـ global scope (خصوصاً اسم log)
(function () {
    'use strict';

    // Logger للـ debugging (يعمل في كل البيئات)
    const log = (...args) => {
        try {
            if (typeof window !== 'undefined' && window.Utils && typeof window.Utils.safeLog === 'function') {
                window.Utils.safeLog(...args);
                return;
            }
        } catch (e) { /* ignore */ }
        // fallback: log دائماً للـ debugging
        try {
            if (typeof window !== 'undefined' && console && console.log) {
                console.log(...args);
            }
        } catch (e) { /* ignore */ }
    };

    log('🚀 تحميل login-init-fixed.js...');


    // ===== مزامنة المستخدمين قبل تسجيل الدخول (إعداد المزامنة) =====
    const LoginSyncSetup = (function () {
        const STORAGE_KEY = 'hse_google_config'; /* مفتاح تخزين تاريخي — يحتوي إعدادات RPC/الخادم */
        const MODAL_ID = 'login-sync-settings-modal';

        function getDefaultGoogleConfig() {
            return {
                appsScript: { enabled: true, scriptUrl: 'https://script.google.com/macros/s/AKfycbx2dCdy7o7cOUSJCiA05OEyOYB5e5e79DgV5WKVqv8fhmOnNKQjZrvI9j8jxFXtT16m/exec' },
                sheets: { enabled: true, spreadsheetId: '1EanavJ2OodOmq8b1GagSj8baa-KF-o4mVme_Jlwmgxc', apiKey: '' },
                maps: { enabled: false, apiKey: '' }
            };
        }

        function mergeGoogleConfig(base, override) {
            const b = base || getDefaultGoogleConfig();
            const o = override || {};
            const appsScript = Object.assign({}, b.appsScript || {}, o.appsScript || {});
            const sheets = Object.assign({}, b.sheets || {}, o.sheets || {});
            const maps = Object.assign({}, b.maps || {}, o.maps || {});
            const url = String(appsScript.scriptUrl || '').trim();
            const sheetId = String(sheets.spreadsheetId || '').trim();
            return {
                appsScript: {
                    ...appsScript,
                    scriptUrl: url || String(b.appsScript?.scriptUrl || '').trim(),
                    enabled: url ? true : !!appsScript.enabled
                },
                sheets: {
                    ...sheets,
                    spreadsheetId: sheetId || String(b.sheets?.spreadsheetId || '').trim(),
                    enabled: sheetId ? true : !!sheets.enabled
                },
                maps
            };
        }

        function readStoredGoogleConfig() {
            let cfg = getDefaultGoogleConfig();
            try {
                if (typeof window !== 'undefined' && window.AppState && window.AppState.googleConfig) {
                    cfg = mergeGoogleConfig(cfg, window.AppState.googleConfig);
                }
            } catch (e) { /* ignore */ }

            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    cfg = mergeGoogleConfig(cfg, parsed);
                }
            } catch (e) { /* ignore */ }

            return cfg;
        }

        function persistGoogleConfig(cfg) {
            try {
                if (typeof window !== 'undefined' && window.AppState) {
                    window.AppState.googleConfig = cfg;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof window !== 'undefined' && window.DataManager && typeof window.DataManager.saveGoogleConfig === 'function') {
                    // DataManager.saveGoogleConfig يقرأ من AppState.googleConfig
                    window.DataManager.saveGoogleConfig();
                    return true;
                }
            } catch (e) { /* ignore */ }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
                return true;
            } catch (e) {
                return false;
            }
        }

        function isValidAppsScriptUrl(url) {
            const u = String(url || '').trim();
            if (!u) return false;
            try {
                if (typeof window !== 'undefined' &&
                    window.GoogleIntegration &&
                    typeof window.GoogleIntegration.isValidGoogleAppsScriptUrl === 'function') {
                    return !!window.GoogleIntegration.isValidGoogleAppsScriptUrl(u);
                }
            } catch (e) { /* ignore */ }
            try {
                const x = new URL(u);
                if (x.protocol !== 'https:') return false;
                if (x.hostname.toLowerCase().endsWith('.supabase.co') && x.pathname.indexOf('/functions/v1/') !== -1) return true;
            } catch (e) { return false; }
            if (!/^https:\/\/script\.google\.com\//i.test(u)) return false;
            if (!/\/exec(\?|#|$)/i.test(u)) return false;
            return true;
        }

        function isValidSpreadsheetId(id) {
            const v = String(id || '').trim();
            if (!v) return false;
            if (v === 'YOUR_SPREADSHEET_ID_HERE') return false;
            // غالباً أحرف/أرقام/شرطة/underscore
            return /^[a-zA-Z0-9-_]{15,}$/.test(v);
        }

        function notify(type, msg) {
            try {
                if (typeof window !== 'undefined' && window.Notification && typeof window.Notification[type] === 'function') {
                    window.Notification[type](msg);
                    return;
                }
            } catch (e) { /* ignore */ }
            try { alert(msg); } catch (e) { /* ignore */ }
        }

        function setModalStatus(text, kind = 'info') {
            const el = document.getElementById('login-sync-settings-status');
            if (!el) return;
            el.style.display = 'block';
            el.classList.remove('text-green-700', 'text-red-700', 'text-yellow-700', 'text-gray-700');
            if (kind === 'success') el.classList.add('text-green-700');
            else if (kind === 'error') el.classList.add('text-red-700');
            else if (kind === 'warning') el.classList.add('text-yellow-700');
            else el.classList.add('text-gray-700');
            el.textContent = text;
        }

        function closeModal() {
            const overlay = document.getElementById(MODAL_ID);
            if (overlay) {
                overlay.style.display = 'none';
            }
        }

        function ensureModal() {
            let overlay = document.getElementById(MODAL_ID);
            if (overlay) return overlay;

            overlay = document.createElement('div');
            overlay.id = MODAL_ID;
            overlay.className = 'modal-overlay';
            overlay.style.display = 'none';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'إعداد المزامنة');

            overlay.innerHTML = `
                <div class="modal-content" style="max-width: 560px;">
                    <div class="modal-header">
                        <div class="modal-title">إعداد المزامنة</div>
                        <button type="button" class="modal-close" id="login-sync-settings-close" aria-label="إغلاق">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    رابط الخادم الخلفي (RPC / Supabase Edge)
                                </label>
                                <input id="login-sync-script-url" type="url" class="form-input" dir="ltr"
                                    placeholder="https://xxxx.supabase.co/functions/v1/hse-api" autocomplete="off">
                                <p class="text-xs text-gray-500 mt-2">للنشر على Supabase: استخدم رابط دالة <b>hse-api</b> تحت <b>/functions/v1/</b>. إن وُجد نشر قديم متوافق، يمكن استخدام رابط ينتهي بـ <b>/exec</b>.</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    معرف الجدول (اختياري — إن يطلبه الخادم)
                                </label>
                                <input id="login-sync-spreadsheet-id" type="text" class="form-input" dir="ltr"
                                    placeholder="مثال: معرف جدول أو مشروع" autocomplete="off">
                                <p class="text-xs text-gray-500 mt-2">اتركه فارغاً إذا لم يكن مطلوباً في إعداداتك الحالية.</p>
                            </div>
                            <div id="login-sync-settings-status" class="text-sm text-gray-700" style="display:none;"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-primary" id="login-sync-settings-save">
                            حفظ + مزامنة المستخدمين
                        </button>
                        <button type="button" class="btn-secondary" id="login-sync-settings-cancel">
                            إلغاء
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Close handlers
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            }, true);

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    const o = document.getElementById(MODAL_ID);
                    if (o && o.style.display !== 'none') closeModal();
                }
            }, true);

            return overlay;
        }

        function openModal() {
            const overlay = ensureModal();
            const cfg = readStoredGoogleConfig();

            const scriptInput = overlay.querySelector('#login-sync-script-url');
            const sheetInput = overlay.querySelector('#login-sync-spreadsheet-id');
            if (scriptInput) scriptInput.value = String(cfg.appsScript?.scriptUrl || '');
            if (sheetInput) sheetInput.value = String(cfg.sheets?.spreadsheetId || '');

            // reset status
            const status = overlay.querySelector('#login-sync-settings-status');
            if (status) status.style.display = 'none';

            overlay.style.display = 'flex';
            setTimeout(() => {
                try { scriptInput && scriptInput.focus(); } catch (e) { /* ignore */ }
            }, 50);
        }

        async function saveAndSyncUsers() {
            const overlay = ensureModal();
            const saveBtn = overlay.querySelector('#login-sync-settings-save');
            const scriptInput = overlay.querySelector('#login-sync-script-url');
            const sheetInput = overlay.querySelector('#login-sync-spreadsheet-id');

            const scriptUrl = String(scriptInput?.value || '').trim();
            const spreadsheetId = String(sheetInput?.value || '').trim();

            if (!isValidAppsScriptUrl(scriptUrl)) {
                setModalStatus('يرجى إدخال رابط Google Apps Script صحيح (ينتهي بـ /exec).', 'error');
                try { scriptInput && scriptInput.focus(); } catch (e) { /* ignore */ }
                return;
            }
            if (!isValidSpreadsheetId(spreadsheetId)) {
                setModalStatus('يرجى إدخال spreadsheetId صحيح.', 'error');
                try { sheetInput && sheetInput.focus(); } catch (e) { /* ignore */ }
                return;
            }

            const cfg = readStoredGoogleConfig();
            cfg.appsScript.enabled = true;
            cfg.appsScript.scriptUrl = scriptUrl;
            cfg.sheets.enabled = true;
            cfg.sheets.spreadsheetId = spreadsheetId;

            const persisted = persistGoogleConfig(cfg);
            if (!persisted) {
                setModalStatus('تعذر حفظ الإعدادات على هذا الجهاز (localStorage غير متاح).', 'error');
                return;
            }

            // Sync users (without logging in)
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.dataset.originalText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري المزامنة...';
            }

            setModalStatus('جاري مزامنة المستخدمين من Google Sheets...', 'info');
            notify('info', 'جاري مزامنة المستخدمين...');

            try {
                if (typeof window === 'undefined' || !window.GoogleIntegration || typeof window.GoogleIntegration.syncUsers !== 'function') {
                    throw new Error('GoogleIntegration غير جاهز بعد. انتظر ثواني ثم حاول مرة أخرى.');
                }

                const ok = await window.GoogleIntegration.syncUsers(true);
                if (ok) {
                    // تعطيل bootstrap بعد نجاح المزامنة إن لزم
                    try {
                        if (window.Auth && typeof window.Auth.handleUsersSyncSuccess === 'function') {
                            window.Auth.handleUsersSyncSuccess();
                        }
                    } catch (e) { /* ignore */ }

                    const count = Array.isArray(window.AppState?.appData?.users) ? window.AppState.appData.users.length : 0;
                    setModalStatus(`✅ تمت مزامنة المستخدمين بنجاح. عدد المستخدمين: ${count}`, 'success');
                    notify('success', `✅ تمت مزامنة المستخدمين بنجاح (${count})`);
                } else {
                    setModalStatus('⚠️ لم تكتمل المزامنة (تحقق من الإعدادات/الاتصال).', 'warning');
                    notify('warning', '⚠️ لم تكتمل مزامنة المستخدمين.');
                }
            } catch (err) {
                const msg = err?.message || String(err || 'خطأ غير معروف');
                setModalStatus(`❌ فشلت المزامنة: ${msg}`, 'error');
                notify('error', `❌ فشلت المزامنة: ${msg}`);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = saveBtn.dataset.originalText || 'حفظ + مزامنة المستخدمين';
                }
            }
        }

        function bindModalButtonsOnce() {
            const overlay = ensureModal();
            if (overlay.dataset.bound === 'true') return;

            const closeBtn = overlay.querySelector('#login-sync-settings-close');
            const cancelBtn = overlay.querySelector('#login-sync-settings-cancel');
            const saveBtn = overlay.querySelector('#login-sync-settings-save');

            if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeModal(); }, true);
            if (cancelBtn) cancelBtn.addEventListener('click', function (e) { e.preventDefault(); closeModal(); }, true);
            if (saveBtn) saveBtn.addEventListener('click', function (e) { e.preventDefault(); saveAndSyncUsers(); }, true);

            overlay.dataset.bound = 'true';
        }

        function open() {
            bindModalButtonsOnce();
            openModal();
        }

        return { open };
    })();

    // جعل LoginSyncSetup متاحاً بشكل global لضمان عمله
    if (typeof window !== 'undefined') {
        window.LoginSyncSetup = LoginSyncSetup;
        log('✅ تم تسجيل LoginSyncSetup في window');
    }

    // منع ظهور بيانات الدخول في رابط الموقع (إن وُجدت بالـ query params)
    (function sanitizeLoginQueryParams() {
        function applyAndCleanup() {
            try {
                const params = new URLSearchParams(window.location.search || '');
                const urlUsername = params.get('username') || params.get('email') || '';
                // ⚠️ أمان: لا نقبل تمرير كلمة المرور عبر URL في الإنتاج
                const isDev = (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '' ||
                    window.location.search.includes('dev=true'));
                const urlPassword = isDev ? (params.get('password') || '') : '';

                // تعبئة الحقول (إن كانت موجودة) ثم حذفها من الرابط
                const usernameInput = document.getElementById('username');
                const passwordInput = document.getElementById('password');

                if (usernameInput && urlUsername) usernameInput.value = urlUsername;
                if (passwordInput && urlPassword) passwordInput.value = urlPassword;

                if (params.has('username')) params.delete('username');
                if (params.has('email')) params.delete('email');
                if (params.has('password')) params.delete('password');

                const remaining = params.toString();
                const newUrl = window.location.pathname + (remaining ? `?${remaining}` : '') + (window.location.hash || '');
                // لا نعمل replaceState إذا لم يتغير شيء
                const currentCleanUrl = window.location.pathname + window.location.search + (window.location.hash || '');
                if (newUrl !== currentCleanUrl) {
                    window.history.replaceState(null, document.title, newUrl);
                }
            } catch (e) {
                // تجاهل أي خطأ (مهم: لا نكسر شاشة الدخول)
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyAndCleanup);
        } else {
            applyAndCleanup();
        }
    })();

// تهيئة فورية للأزرار - تعمل حتى لو لم تكن الوحدات محملة
(function initLoginButtonsImmediately() {
    'use strict';
    
    function setupPasswordToggle() {
        const passwordToggleBtn = document.getElementById('password-toggle-btn');
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.getElementById('password-toggle-icon');
        
        if (!passwordToggleBtn || !passwordInput || !toggleIcon) {
            return false;
        }
        
        // إزالة جميع المعالجات القديمة
        const newBtn = passwordToggleBtn.cloneNode(true);
        passwordToggleBtn.parentNode.replaceChild(newBtn, passwordToggleBtn);
        
        // إزالة جميع المعالجات السابقة من الزر الجديد
        const cleanBtn = newBtn.cloneNode(true);
        newBtn.parentNode.replaceChild(cleanBtn, newBtn);
        
        cleanBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const currentPasswordInput = document.getElementById('password');
            const currentToggleIcon = document.getElementById('password-toggle-icon');
            
            if (currentPasswordInput && currentToggleIcon) {
                if (currentPasswordInput.type === 'password') {
                    currentPasswordInput.type = 'text';
                    currentToggleIcon.classList.remove('fa-eye');
                    currentToggleIcon.classList.add('fa-eye-slash');
                } else {
                    currentPasswordInput.type = 'password';
                    currentToggleIcon.classList.remove('fa-eye-slash');
                    currentToggleIcon.classList.add('fa-eye');
                }
            }
        }, true);
        
        log('✅ تم تفعيل زر إظهار/إخفاء كلمة المرور');
        return true;
    }
    
    function setupForgotPassword() {
        const forgotPasswordLink = document.getElementById('forgot-password-link');
        
        if (!forgotPasswordLink) {
            return false;
        }
        
        // إزالة جميع المعالجات القديمة
        const newLink = forgotPasswordLink.cloneNode(true);
        forgotPasswordLink.parentNode.replaceChild(newLink, forgotPasswordLink);
        
        // إزالة جميع المعالجات السابقة من الرابط الجديد
        const cleanLink = newLink.cloneNode(true);
        newLink.parentNode.replaceChild(cleanLink, newLink);
        
        cleanLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // محاولة استخدام UI.showForgotPasswordModal
            if (typeof window.UI !== 'undefined' && typeof window.UI.showForgotPasswordModal === 'function') {
                try {
                    window.UI.showForgotPasswordModal();
                } catch (error) {
                    console.error('❌ خطأ في عرض نافذة استعادة كلمة المرور:', error);
                    alert('ميزة استعادة كلمة المرور قيد التطوير.\n\nيرجى التواصل مع:\nYasser.diab@icapp.com.eg');
                }
            } else {
                alert('ميزة استعادة كلمة المرور قيد التطوير.\n\nيرجى التواصل مع:\nYasser.diab@icapp.com.eg');
            }
        }, true);
        
        log('✅ تم تفعيل رابط استعادة كلمة المرور');
        return true;
    }
    
    function setupHelpButton() {
        const helpBtn = document.getElementById('help-btn');
        
        if (!helpBtn) {
            return false;
        }
        
        // إزالة جميع المعالجات القديمة
        const newHelpBtn = helpBtn.cloneNode(true);
        helpBtn.parentNode.replaceChild(newHelpBtn, helpBtn);
        
        // إزالة جميع المعالجات السابقة من الزر الجديد
        const cleanHelpBtn = newHelpBtn.cloneNode(true);
        newHelpBtn.parentNode.replaceChild(cleanHelpBtn, newHelpBtn);
        
        cleanHelpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // محاولة استخدام UI.showHelpModal
            if (typeof window.UI !== 'undefined' && typeof window.UI.showHelpModal === 'function') {
                try {
                    window.UI.showHelpModal();
                } catch (error) {
                    console.error('❌ خطأ في عرض نافذة المساعدة:', error);
                    const helpMessage = `📋 مساعدة تسجيل الدخول

📞 للدعم:
Yasser.diab@icapp.com.eg`;
                    alert(helpMessage);
                }
            } else {
                const helpMessage = `📋 مساعدة تسجيل الدخول

📞 للدعم:
Yasser.diab@icapp.com.eg`;
                alert(helpMessage);
            }
        }, true);
        
        log('✅ تم تفعيل زر المساعدة');
        return true;
    }

    // تهيئة زر اللغة في شاشة تسجيل الدخول (يتخطى إذا ربَط السكربت المضمن في index.html)
    function setupLanguageToggle() {
        if (window._loginLangDirectBound) {
            return true;
        }
        const langToggleBtn = document.getElementById('login-language-toggle-btn');
        const langDropdown = document.getElementById('login-language-dropdown');
        const currentLangText = langToggleBtn ? langToggleBtn.querySelector('#current-lang-text, span[id*="lang-text"]') : null;
        
        if (!langToggleBtn || !langDropdown || !currentLangText) {
            log('⚠️ لم يتم العثور على عناصر تبديل اللغة');
            return false;
        }
        
        const currentLang = localStorage.getItem('language') || 'ar';
        currentLangText.textContent = currentLang === 'ar' ? 'العربية' : 'English';
        
        if (langToggleBtn.dataset.handlerBound === 'true') {
            return true;
        }
        
        function showDropdown() {
            langDropdown.classList.remove('hidden');
            langDropdown.classList.add('show');
            langDropdown.style.setProperty('display', 'block', 'important');
            langDropdown.style.setProperty('visibility', 'visible', 'important');
            langDropdown.style.setProperty('z-index', '99999', 'important');
            langToggleBtn.setAttribute('aria-expanded', 'true');
        }
        function hideDropdown() {
            langDropdown.classList.add('hidden');
            langDropdown.classList.remove('show');
            langDropdown.style.removeProperty('display');
            langDropdown.style.removeProperty('visibility');
            langDropdown.style.removeProperty('z-index');
            langToggleBtn.setAttribute('aria-expanded', 'false');
        }

        // تبديل القائمة المنسدلة عند النقر على الزر
        langToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = langDropdown.classList.contains('hidden');
            if (isHidden) {
                showDropdown();
            } else {
                hideDropdown();
            }
        });

        // معالجة اختيار اللغة
        const langButtons = langDropdown.querySelectorAll('[data-lang]');
        langButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const selectedLang = this.getAttribute('data-lang');
                if (!selectedLang) return;

                // توحيد مسار الترجمة: الاعتماد على UI.setLanguage متى كان متاحاً.
                if (typeof window.UI !== 'undefined' && typeof window.UI.setLanguage === 'function') {
                    window.UI.setLanguage(selectedLang);
                } else {
                    localStorage.setItem('language', selectedLang);
                    if (typeof window.AppState !== 'undefined') window.AppState.currentLanguage = selectedLang;
                    const isRTL = selectedLang === 'ar';
                    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
                    document.documentElement.lang = selectedLang === 'ar' ? 'ar' : 'en';
                    if (document.body) document.body.dir = isRTL ? 'rtl' : 'ltr';
                    currentLangText.textContent = selectedLang === 'ar' ? 'العربية' : 'English';
                    updateLoginTexts(selectedLang);
                    const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
                        ? window.AppI18n
                        : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
                    if (i18nCore) {
                        i18nCore.applyI18n(document, selectedLang);
                        i18nCore.applyLiteralTranslations(document, selectedLang);
                    }
                }
                hideDropdown();
                log('✅ تم تغيير اللغة إلى:', selectedLang);
            });
        });

        // إغلاق القائمة عند النقر خارجها
        document.addEventListener('click', function(e) {
            if (!langToggleBtn.contains(e.target) && !langDropdown.contains(e.target)) {
                hideDropdown();
            }
        });
        
        langToggleBtn.dataset.handlerBound = 'true';
        log('✅ تم تفعيل زر تبديل اللغة');
        return true;
    }
    
    // تحديث نصوص تسجيل الدخول حسب اللغة
    function updateLoginTexts(lang) {
        const texts = {
            ar: {
                email: 'البريد الإلكتروني',
                password: 'كلمة المرور',
                login: 'تسجيل الدخول',
                help: 'مساعدة / Help',
                forgot: 'نسيت كلمة المرور؟'
            },
            en: {
                email: 'Email',
                password: 'Password',
                login: 'Log in',
                help: 'Help',
                forgot: 'Forgot password?'
            }
        };
        
        const t = texts[lang];
        if (!t) return;
        
        // تحديث العناصر ذات data-i18n
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) {
                el.textContent = t[key];
            }
        });
        
        // تحديث العناصر المحددة بالـ ID
        const updates = {
            'login-email-text': t.email,
            'login-password-text': t.password,
            'login-submit-text': t.login,
            'login-help-text': t.help,
            'login-forgot-text': t.forgot
        };
        
        Object.entries(updates).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        });
    }

    // محاولة التهيئة الفورية
    function tryInit() {
        const passwordOk = setupPasswordToggle();
        const forgotOk = setupForgotPassword();
        const helpOk = setupHelpButton();
        const langOk = setupLanguageToggle();

        if (passwordOk && forgotOk && helpOk && langOk) {
            log('✅ تم تهيئة جميع أزرار تسجيل الدخول بنجاح');
            return true;
        }
        return false;
    }
    
    // محاولة فورية
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            if (!tryInit()) {
                // إعادة المحاولة بعد قليل
                setTimeout(tryInit, 100);
            }
        });
    } else {
        if (!tryInit()) {
            // إعادة المحاولة بعد قليل
            setTimeout(tryInit, 100);
        }
    }
    
    // إعادة المحاولة عند تحميل الصفحة بالكامل
    window.addEventListener('load', function() {
        setTimeout(tryInit, 200);
    });
    
    // إعادة المحاولة كل ثانية حتى تنجح (لمدة 10 ثوان)
    let retryCount = 0;
    const retryInterval = setInterval(function() {
        if (tryInit() || retryCount >= 10) {
            clearInterval(retryInterval);
        }
        retryCount++;
    }, 1000);

})();

async function handleLogin(form, submitBtn) {
    // التأكد من أن submitBtn هو عنصر <button> الفعلي وليس عنصراً داخله (مثل <i>)
    if (submitBtn && submitBtn.tagName !== 'BUTTON') {
        submitBtn = submitBtn.closest('button') || submitBtn;
    }
    log('📝 محاولة تسجيل الدخول...');
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('remember-me');
    
    if (!usernameInput || !passwordInput) {
        const errorMsg = 'خطأ في تحميل نموذج تسجيل الدخول';
        console.error('❌', errorMsg);
        if (typeof window.Notification !== 'undefined') {
            window.Notification.error(errorMsg);
        } else {
            alert(errorMsg);
        }
        return;
    }
    
    const email = usernameInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberCheckbox ? rememberCheckbox.checked : false;
    
    if (!email || !password) {
        const errorMsg = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
        console.warn('⚠️', errorMsg);
        if (typeof window.Notification !== 'undefined') {
            window.Notification.warning(errorMsg);
        } else {
            alert(errorMsg);
        }
        return;
    }

    // ✅ استجابة فورية للضغط: تعطيل الزر وعرض حالة تحميل مرئية قبل أي await
    const originalBtnText = submitBtn.innerHTML;
    const langEn = (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en');
    const loadingLabel = langEn ? 'Signing in...' : 'جاري التحقق...';
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2" aria-hidden="true"></i><span id="login-submit-text">' + loadingLabel + '</span>';
    try {
        await new Promise(r => requestAnimationFrame(() => r()));
    } catch (e) { /* ignore */ }
    
    // التحقق من الوحدات (مع انتظار قصير لتفادي بطء تحميل defer/503 المؤقت)
    let deps = checkDependencies();
    if (deps && deps.ok === false) {
        const start = Date.now();
        const maxWaitMs = 700;
        submitBtn.setAttribute('aria-busy', 'true');

        while (deps.ok === false && Date.now() - start < maxWaitMs) {
            await new Promise(r => setTimeout(r, 60));
            deps = checkDependencies();
        }

        if (deps.ok === false) {
            const missingStr = Array.isArray(deps.missing) ? deps.missing.join(', ') : '';
            const errorMsg = 'نظام المصادقة غير جاهز. يرجى تحديث الصفحة.' + (missingStr ? `\n\nالوحدات غير المحمّلة: ${missingStr}` : '');
            console.error('❌', errorMsg);
            if (typeof window.Notification !== 'undefined' && typeof window.Notification.error === 'function') {
                window.Notification.error(errorMsg);
            } else {
                alert(errorMsg);
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }

        // رجوع رسالة الزر لتسجيل الدخول بعد اكتمال تجهيز الاعتماديات
        submitBtn.setAttribute('aria-busy', 'true');
    }
    
    try {
        log('🔐 استدعاء Auth.login...');
        
        const result = await window.Auth.login(email, password, remember);
        log('📥 نتيجة تسجيل الدخول:', result);
        
        // فحص النتيجة
        let success = false;
        let requiresPasswordChange = false;
        let isFirstLogin = false;
        
        if (result === true) {
            success = true;
        } else if (result && typeof result === 'object') {
            success = result.success === true;
            requiresPasswordChange = result.requiresPasswordChange === true;
            isFirstLogin = result.isFirstLogin === true;
        }
        
        if (success) {
            log('✅ تسجيل دخول ناجح!');
            try {
                submitBtn.disabled = false;
                submitBtn.removeAttribute('aria-busy');
                submitBtn.innerHTML = originalBtnText;
            } catch (e) { /* ignore */ }

            // عدم إخفاء شاشة الدخول هنا — showMainApp يخفيها بعد تحميل الإعدادات ثم يعرض السياسة مباشرة (بدون شاشة تحضيرية)
            // معالجة تغيير كلمة المرور إذا لزم الأمر
            if (requiresPasswordChange || isFirstLogin) {
                log('🔐 يتطلب تغيير كلمة المرور');
            }
            
            // showMainApp يحمّل الإعدادات (الشاشة تبقى كما هي) ثم يخفي الدخول ويعرض السياسة مباشرة أو لوحة التحكم
            if (typeof window.UI !== 'undefined' && window.UI.showMainApp) {
                try {
                    // حماية من التعليق: لو showMainApp تأخرت لا نترك المستخدم على شاشة الدخول بلا نهاية
                    const warnAfterMs = 300;
                    const hardTimeoutMs = 2500;
                    const warnTimer = setTimeout(function () {
                        try {
                            if (submitBtn && !submitBtn.disabled) return;
                            submitBtn.setAttribute('aria-busy', 'true');
                        } catch (e) { /* ignore */ }
                    }, warnAfterMs);

                    await Promise.race([
                        window.UI.showMainApp(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('showMainApp timeout')), hardTimeoutMs))
                    ]);
                    clearTimeout(warnTimer);
                } catch (err) {
                    log('⚠️ خطأ في showMainApp:', err);
                    // fallback: إظهار التطبيق حتى لو UI.showMainApp فشل/تأخر
                    try { if (typeof window.App !== 'undefined' && window.App.load) window.App.load(); } catch (e) { /* ignore */ }
                    const loginScreen = document.getElementById('login-screen');
                    if (loginScreen) { loginScreen.style.display = 'none'; loginScreen.classList.remove('active', 'show'); }
                    document.body.classList.add('app-active');
                    const mainApp = document.getElementById('main-app');
                    if (mainApp) mainApp.style.display = 'flex';
                }
            } else if (typeof window.App !== 'undefined' && window.App.load) {
                window.App.load();
                const mainApp = document.getElementById('main-app');
                if (mainApp) mainApp.style.display = 'flex';
            }
        } else {
            // تحسين رسالة الخطأ
            let errorMsg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
            
            if (result && typeof result === 'object') {
                if (result.message) {
                    errorMsg = result.message;
                } else if (result.error) {
                    errorMsg = result.error;
                }
            } else if (typeof result === 'string') {
                errorMsg = result;
            }
            
            // التحقق من أخطاء الاتصال بـ Google Services
            const errorStr = JSON.stringify(result || '').toLowerCase();
            if (errorStr.includes('cert_authority_invalid') || 
                errorStr.includes('certificate') ||
                errorStr.includes('err_cert') ||
                errorStr.includes('ssl') ||
                errorStr.includes('tls')) {
                errorMsg = 'خطأ في الاتصال بخدمات Google. قد تكون هناك مشكلة في شهادة الأمان. يرجى التحقق من إعدادات الإنترنت والمتصفح.';
            } else if (errorStr.includes('networkerror') || 
                       errorStr.includes('failed to fetch') ||
                       errorStr.includes('timeout') ||
                       errorStr.includes('network')) {
                errorMsg = 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت وإعادة المحاولة.';
            } else if (errorStr.includes('google') && 
                       (errorStr.includes('غير متاح') || 
                        errorStr.includes('not available') ||
                        errorStr.includes('خطأ') ||
                        errorStr.includes('error'))) {
                errorMsg = 'خدمات Google غير متاحة حالياً. يرجى المحاولة لاحقاً أو التحقق من إعدادات Google Sheets.';
            }
            
            // تسجيل قصير للمستخدم
            var _shortMsg = (result && result.message && typeof result.message === 'string') ? result.message.split('\n')[0] : errorMsg;
            console.error('❌ فشل تسجيل الدخول:', _shortMsg);
            
            if (typeof window.Notification !== 'undefined') {
                window.Notification.error(errorMsg);
            } else {
                alert(errorMsg);
            }
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error);
        let errorMsg = 'حدث خطأ: ' + (error.message || error);
        
        // التحقق من أخطاء الاتصال
        const errorStr = String(error.message || error || '').toLowerCase();
        if (errorStr.includes('cert_authority_invalid') || 
            errorStr.includes('certificate') ||
            errorStr.includes('err_cert') ||
            errorStr.includes('ssl') ||
            errorStr.includes('tls')) {
            errorMsg = 'خطأ في الاتصال بخدمات Google. قد تكون هناك مشكلة في شهادة الأمان. يرجى التحقق من إعدادات الإنترنت والمتصفح.';
        } else if (errorStr.includes('networkerror') || 
                   errorStr.includes('failed to fetch') ||
                   errorStr.includes('timeout') ||
                   errorStr.includes('network')) {
            errorMsg = 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت وإعادة المحاولة.';
        } else if (errorStr.includes('google') && 
                   (errorStr.includes('غير متاح') || 
                    errorStr.includes('not available') ||
                    errorStr.includes('خطأ') ||
                    errorStr.includes('error'))) {
            errorMsg = 'خدمات Google غير متاحة حالياً. يرجى المحاولة لاحقاً أو التحقق من إعدادات Google Sheets.';
        }
        
        if (typeof window.Notification !== 'undefined') {
            window.Notification.error(errorMsg);
        } else {
            alert(errorMsg);
        }
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        submitBtn.removeAttribute('aria-busy');
    }
}

// Expose to global scope
if (typeof window !== 'undefined') {
    window.handleLogin = handleLogin;
}

// ربط احتياطي لزر تسجيل الدخول (delegation) لتفادي أي تعارض/استبدال للـ form
(function bindLoginFallbackHandlers() {
    try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        if (window.__loginFallbackBound === true) return;
        window.__loginFallbackBound = true;

        const run = async (btn) => {
            const form = document.getElementById('login-form');
            if (!form || typeof window.handleLogin !== 'function') return;
            await window.handleLogin(form, btn);
        };

        document.addEventListener('click', function (e) {
            const btn = e && e.target ? e.target.closest('#login-submit-btn') : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            run(btn);
        }, true);

        document.addEventListener('submit', function (e) {
            const form = e && e.target ? e.target.closest('#login-form') : null;
            if (!form) return;
            const btn = form.querySelector('#login-submit-btn') || form.querySelector('button[type="submit"]');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            run(btn || form);
        }, true);
    } catch (err) {
        // لا نُظهر خطأ للمستخدم هنا لتجنب تعطيل الصفحة
        try { console.warn('Login fallback bind error', err); } catch (e) { /* ignore */ }
    }
})();

// Global checkDependencies for handleLogin
function checkDependencies() {
    const missing = [];
    if (typeof window.Auth === 'undefined') missing.push('Auth');
    if (typeof window.DataManager === 'undefined') missing.push('DataManager');
    // ملاحظة: UI و Notification ليستا شرطاً لتسجيل الدخول نفسه (يمكن عرض رسالة عبر alert والانتقال لـ App.load كبديل)
    return { ok: missing.length === 0, missing };
}

// ===== تهيئة نموذج تسجيل الدخول =====
(function initLoginForm() {
    'use strict';
    
    function checkDependencies() {
        // استخدم نفس checkDependencies العالمي (يعيد {ok, missing})
        try {
            const res = window.checkDependencies ? window.checkDependencies() : null;
            if (res && typeof res.ok === 'boolean') return res.ok;
        } catch (e) { /* ignore */ }
        // fallback minimal: UI/Notification ليست شرطاً لتسجيل الدخول نفسه
        return typeof window.Auth !== 'undefined' &&
               typeof window.DataManager !== 'undefined';
    }
    
    function setupLoginForm() {
        console.log('🚀 setupLoginForm called!');
        const loginForm = document.getElementById('login-form');
        console.log('🔍 Login form found:', loginForm);
        
        if (!loginForm) {
            console.error('❌ Login form not found!');
            return false;
        }
        
        // إزالة جميع المعالجات القديمة
        const newForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newForm, loginForm);

        // ⚠️ مهم: استبدال الـ form بالـ clone يمسح معالجات الأزرار الموجودة داخله
        // لذلك نعيد تفعيل (عرض كلمة المرور / نسيت كلمة المرور / مساعدة) بعد الاستبدال مباشرة
        (function rebindLoginAuxButtons() {
            // Password toggle
            const passwordToggleBtn = newForm.querySelector('#password-toggle-btn');
            const passwordInput = newForm.querySelector('#password');
            const toggleIcon = newForm.querySelector('#password-toggle-icon');

            if (passwordToggleBtn && passwordInput && toggleIcon) {
                // منع تكرار الربط لو تم استدعاء setupLoginForm أكثر من مرة
                if (passwordToggleBtn.dataset.handlerBound !== 'true') {
                    passwordToggleBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        if (passwordInput.type === 'password') {
                            passwordInput.type = 'text';
                            toggleIcon.classList.remove('fa-eye');
                            toggleIcon.classList.add('fa-eye-slash');
                            passwordToggleBtn.setAttribute('aria-label', 'إخفاء كلمة المرور');
                            passwordToggleBtn.setAttribute('title', 'إخفاء كلمة المرور');
                        } else {
                            passwordInput.type = 'password';
                            toggleIcon.classList.remove('fa-eye-slash');
                            toggleIcon.classList.add('fa-eye');
                            passwordToggleBtn.setAttribute('aria-label', 'إظهار كلمة المرور');
                            passwordToggleBtn.setAttribute('title', 'إظهار كلمة المرور');
                        }

                        passwordInput.focus();
                    }, true);
                    passwordToggleBtn.dataset.handlerBound = 'true';
                }
            }

            // Forgot password link
            const forgotPasswordLink = newForm.querySelector('#forgot-password-link');
            if (forgotPasswordLink) {
                if (forgotPasswordLink.dataset.handlerBound !== 'true') {
                    forgotPasswordLink.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        if (typeof window.UI !== 'undefined' && typeof window.UI.showForgotPasswordModal === 'function') {
                            try {
                                window.UI.showForgotPasswordModal();
                            } catch (error) {
                                console.error('❌ خطأ في عرض نافذة استعادة كلمة المرور:', error);
                                alert('ميزة استعادة كلمة المرور قيد التطوير.\n\nيرجى التواصل مع:\nYasser.diab@icapp.com.eg');
                            }
                        } else {
                            alert('ميزة استعادة كلمة المرور قيد التطوير.\n\nيرجى التواصل مع:\nYasser.diab@icapp.com.eg');
                        }
                    }, true);
                    forgotPasswordLink.dataset.handlerBound = 'true';
                }
            }

            // Help button
            const helpBtn = newForm.querySelector('#help-btn');
            if (helpBtn) {
                if (helpBtn.dataset.handlerBound !== 'true') {
                    helpBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        if (typeof window.UI !== 'undefined' && typeof window.UI.showHelpModal === 'function') {
                            try {
                                window.UI.showHelpModal();
                            } catch (error) {
                                console.error('❌ خطأ في عرض نافذة المساعدة:', error);
                                const helpMessage = `📋 مساعدة تسجيل الدخول

📞 للدعم:
Yasser.diab@icapp.com.eg`;
                                alert(helpMessage);
                            }
                        } else {
                            const helpMessage = `📋 مساعدة تسجيل الدخول

📞 للدعم:
Yasser.diab@icapp.com.eg`;
                            alert(helpMessage);
                        }
                    }, true);
                    helpBtn.dataset.handlerBound = 'true';
                }
            }

        })();
        
        // ⚠️ مهم: إعادة تفعيل زر تبديل اللغة بعد استبدال النموذج
        setupLanguageToggle();
        
        log('✅ تم تفعيل نموذج تسجيل الدخول');
        return true;
    }
    
    // انتظار تحميل الوحدات
    function waitForDependenciesAndInit() {
        // تهيئة النموذج فوراً بدون انتظار الوحدات
        setupLoginForm();
        
        if (checkDependencies()) {
            log('✅ جميع الوحدات محملة');
            return;
        }
        
        log('⏳ انتظار تحميل الوحدات المطلوبة...');
        let attempts = 0;
        const maxAttempts = 100; // 10 ثوان كحد أقصى
        
        const checkInterval = setInterval(function() {
            attempts++;
            
            if (checkDependencies()) {
                clearInterval(checkInterval);
                log('✅ جميع الوحدات محملة بعد ' + attempts + ' محاولة');
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('❌ انتهت محاولات انتظار الوحدات');
                console.error('الوحدات المفقودة:', {
                    Auth: typeof window.Auth === 'undefined' ? '❌' : '✅',
                    DataManager: typeof window.DataManager === 'undefined' ? '❌' : '✅',
                    UI: typeof window.UI === 'undefined' ? '❌' : '✅',
                    Notification: typeof window.Notification === 'undefined' ? '❌' : '✅'
                });
            }
        }, 100);
    }
    
    // بدء العملية
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            waitForDependenciesAndInit();
        });
    } else {
        waitForDependenciesAndInit();
    }
    
    // إعادة المحاولة عند تحميل الصفحة بالكامل
    window.addEventListener('load', function() {
        setTimeout(function() {
            if (checkDependencies()) {
                setupLoginForm();
            }
        }, 500);
    });
})();

// تحميل بيانات "تذكرني"
(function loadRememberMe() {
    'use strict';
    
    function loadRememberedUser() {
        try {
            const rememberedUser = localStorage.getItem('hse_remember_user');
            if (rememberedUser) {
                const userData = JSON.parse(rememberedUser);
                const usernameInput = document.getElementById('username');
                const rememberCheckbox = document.getElementById('remember-me');
                
                if (usernameInput && userData.email) {
                    usernameInput.value = userData.email;
                }
                if (rememberCheckbox) {
                    rememberCheckbox.checked = true;
                }
                log('✅ تم تحميل بيانات "تذكرني"');
            }
        } catch (error) {
            console.warn('⚠️ خطأ في تحميل "تذكرني":', error);
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadRememberedUser);
    } else {
        loadRememberedUser();
    }
})();

// تهيئة الشعار في شاشة تسجيل الدخول عند تحميل الصفحة
(function initLoginLogo() {
    'use strict';
    
    function updateLoginLogo() {
        // التحقق من وجود UI و AppState
        if (typeof window.UI === 'undefined' || typeof window.UI.updateLoginLogo !== 'function') {
            return false;
        }
        
        // محاولة تحديث الشعار
        try {
            window.UI.updateLoginLogo();
            log('✅ تم تحديث شعار الشركة في شاشة تسجيل الدخول');
            return true;
        } catch (error) {
            console.warn('⚠️ خطأ في تحديث شعار الشركة:', error);
            return false;
        }
    }
    
    // تحديث الشعار عند تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // انتظار تحميل UI و AppState
            let attempts = 0;
            const maxAttempts = 25; // 2.5 ثانية
            const checkInterval = setInterval(function() {
                attempts++;
                if (updateLoginLogo() || attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                }
            }, 100);
        });
    } else {
        // DOM محمل بالفعل - محاولة مباشرة
        setTimeout(function() {
            let attempts = 0;
            const maxAttempts = 25;
            const checkInterval = setInterval(function() {
                attempts++;
                if (updateLoginLogo() || attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                }
            }, 100);
        }, 500);
    }
    
    // تحديث الشعار عند تحميل الصفحة بالكامل
    window.addEventListener('load', function() {
        setTimeout(updateLoginLogo, 500);
    });
    
    // الاستماع لتحديثات الشعار
    window.addEventListener('storage', function(e) {
        if (e.key === 'hse_company_logo' || e.key === 'company_logo') {
            setTimeout(updateLoginLogo, 50);
        }
    });
    
    // الاستماع للأحداث المخصصة لتحديث الشعار
    window.addEventListener('companyLogoUpdated', function(e) {
        if (e.detail && e.detail.logoUrl) {
            setTimeout(updateLoginLogo, 50);
        }
    });
})();

// تحديث عدد تسجيلات الدخول في الفوتر
(function updateLoginCount() {
    'use strict';
    
    function calculateLoginCount() {
        try {
            // محاولة الحصول على عدد تسجيلات الدخول الإجمالي من systemStatistics
            if (typeof window.AppState !== 'undefined' && window.AppState.appData) {
                // أولوية: استخدام systemStatistics.totalLogins إذا كان موجوداً
                if (window.AppState.appData.systemStatistics && 
                    typeof window.AppState.appData.systemStatistics.totalLogins === 'number') {
                    return window.AppState.appData.systemStatistics.totalLogins;
                }
                
                // إذا لم يكن موجوداً، حساب من loginHistory (للتوافق مع البيانات القديمة)
                if (window.AppState.appData.users && Array.isArray(window.AppState.appData.users)) {
                    let totalLogins = 0;
                    window.AppState.appData.users.forEach(user => {
                        if (user.loginHistory && Array.isArray(user.loginHistory)) {
                            totalLogins += user.loginHistory.length;
                        }
                    });
                    
                    // حفظ القيمة المحسوبة في systemStatistics للمرة القادمة
                    if (!window.AppState.appData.systemStatistics) {
                        window.AppState.appData.systemStatistics = {};
                    }
                    window.AppState.appData.systemStatistics.totalLogins = totalLogins;
                    
                    return totalLogins;
                }
            }
            
            // محاولة الحصول على البيانات من localStorage
            try {
                const appDataStr = localStorage.getItem('hse_app_data');
                if (appDataStr) {
                    const appData = JSON.parse(appDataStr);
                    
                    // أولوية: استخدام systemStatistics.totalLogins إذا كان موجوداً
                    if (appData.systemStatistics && 
                        typeof appData.systemStatistics.totalLogins === 'number') {
                        return appData.systemStatistics.totalLogins;
                    }
                    
                    // إذا لم يكن موجوداً، حساب من loginHistory
                    if (appData.users && Array.isArray(appData.users)) {
                        let totalLogins = 0;
                        appData.users.forEach(user => {
                            if (user.loginHistory && Array.isArray(user.loginHistory)) {
                                totalLogins += user.loginHistory.length;
                            }
                        });
                        return totalLogins;
                    }
                }
            } catch (e) {
                // تجاهل الأخطاء
            }
            
            return 0;
        } catch (error) {
            console.warn('⚠️ خطأ في حساب عدد تسجيلات الدخول:', error);
            return 0;
        }
    }
    
    function updateLoginCountDisplay() {
        const loginCountElement = document.getElementById('login-count');
        if (loginCountElement) {
            const count = calculateLoginCount();
            loginCountElement.textContent = count.toLocaleString('ar-EG');
        }
    }
    
    function setupPrivacyPolicyLink() {
        const privacyLink = document.getElementById('privacy-policy-link');
        if (privacyLink) {
            privacyLink.addEventListener('click', function(e) {
                e.preventDefault();
                // يمكن إضافة نافذة سياسة الخصوصية هنا لاحقاً
                alert('سياسة الخصوصية\n\nنحن ملتزمون بحماية خصوصية المستخدمين. يتم تخزين البيانات بشكل آمن ولا يتم مشاركتها مع أطراف ثالثة.\n\nللمزيد من المعلومات، يرجى التواصل مع:\nYasser.diab@icapp.com.eg');
            });
        }
    }
    
    function runWhenIdle(fn) {
        try {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(() => fn(), { timeout: 1200 });
                return;
            }
        } catch (e) { /* ignore */ }
        setTimeout(fn, 0);
    }

    // تحديث العدد عند تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            runWhenIdle(function () {
                setupPrivacyPolicyLink();
                updateLoginCountDisplay();
                setTimeout(updateLoginCountDisplay, 1500);
            });
        });
    } else {
        runWhenIdle(function () {
            setupPrivacyPolicyLink();
            updateLoginCountDisplay();
            setTimeout(updateLoginCountDisplay, 1500);
        });
    }
    
    // تحديث العدد عند تحميل الصفحة بالكامل
    window.addEventListener('load', function() {
        setTimeout(updateLoginCountDisplay, 500);
    });
    
    // تحديث العدد عند تغيير البيانات
    window.addEventListener('storage', function(e) {
        if (e.key === 'hse_app_data' || e.key === 'hse_current_session') {
            setTimeout(updateLoginCountDisplay, 50);
        }
    });
    
    // تحديث العدد عند تسجيل الدخول
    document.addEventListener('loginSuccess', function() {
        setTimeout(updateLoginCountDisplay, 250);
    });
})();

    log('✅ login-init-fixed.js تم تحميله بنجاح');
})();
