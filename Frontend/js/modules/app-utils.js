/* ========================================
   نظام السلامة المهنية - أمريكانا HSE
   app-utils.js - الدوال المساعدة والثوابت
   ======================================== */

// معالجة أخطاء Chrome Extensions
(function () {
    'use strict';

    /**
     * ضوضاء من إضافات المتصفح (Chrome/Edge) — ليست من تطبيقنا.
     * تُسجَّل عادةً عندما يستدعي الامتداد sendMessage دون التحقق من runtime.lastError،
     * أو عند إغلاق منفذ الرسائل قبل الرد.
     * يجب قمعها دائماً: على الصفحات العادية غالباً لا يوجد chrome.runtime لذا كان القمع
     * السابق داخل if (chrome.runtime) لا يعمل أبداً.
     */
    const extNoise = (s) => {
        const t = String(s || '').toLowerCase();
        return t.includes('runtime.lasterror') ||
            t.includes('unchecked runtime.lasterror') ||
            t.includes('message port closed') ||
            t.includes('port closed before a response') ||
            t.includes('before a response was received') ||
            t.includes('message channel closed') ||
            t.includes('asynchronous response') ||
            t.includes('receiving end does not exist') ||
            t.includes('could not establish connection') ||
            t.includes('extension context invalidated') ||
            t.includes('the message port closed');
    };

    const stringifyArg = (arg) => {
        if (arg === null || arg === undefined) return '';
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'object') {
            try {
                if (arg && arg.message) return String(arg.message) + (arg.stack ? ' ' + arg.stack : '');
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    };

    const shouldSuppressConsoleArgs = (args) => {
        if (!args || args.length === 0) return false;
        const joined = args.map(stringifyArg).join(' ');
        return args.some((a) => extNoise(stringifyArg(a))) || extNoise(joined);
    };

    const wrapConsole = (methodName) => {
        const original = console[methodName];
        if (typeof original !== 'function') return;
        console[methodName] = function (...args) {
            if (shouldSuppressConsoleArgs(args)) return;
            return original.apply(console, args);
        };
    };

    wrapConsole('error');
    wrapConsole('warn');
    wrapConsole('log');
    wrapConsole('info');
    wrapConsole('debug');

    // لا نعيد تعريف chrome.runtime.lastError هنا: القراءة داخل الـ getter كانت تستدعي نفسها (تكرار لا نهائي محتمل).
    // الإضافات التي تتحقق من lastError تحتاج القيمة الأصلية دون تلاعب.

    // قمع أخطاء CSP المتعلقة بـ source maps و frame-ancestors
    const originalError = window.onerror;
    window.onerror = function (msg, url, line, col, error) {
        if (msg && (
            typeof msg === 'string' && (
                msg.includes('.map') ||
                msg.includes('sourcemap') ||
                msg.includes('Content Security Policy') ||
                msg.includes('frame-ancestors') ||
                msg.includes('runtime.lastError') ||
                msg.includes('Unchecked runtime.lastError') ||
                msg.includes('message port closed') ||
                msg.includes('before a response was received') ||
                msg.includes('message channel closed') ||
                msg.includes('asynchronous response') ||
                msg.includes('Receiving end does not exist') ||
                msg.includes('Could not establish connection') ||
                msg.includes('Extension context invalidated')
            )
        )) {
            return true; // منع عرض الخطأ
        }
        if (originalError) {
            return originalError.apply(this, arguments);
        }
        return false;
    };

    // قمع أخطاء unhandled promise rejections المتعلقة بـ Chrome Extensions
    window.addEventListener('unhandledrejection', function (event) {
        const reason = event.reason;
        if (reason && (
            (typeof reason === 'string' && (
                reason.includes('runtime.lastError') ||
                reason.includes('message port closed') ||
                reason.includes('before a response was received') ||
                reason.includes('message channel closed') ||
                reason.includes('asynchronous response') ||
                reason.includes('Receiving end does not exist') ||
                reason.includes('Could not establish connection') ||
                reason.includes('Extension context invalidated')
            )) ||
            (reason && reason.message && (
                reason.message.includes('runtime.lastError') ||
                reason.message.includes('message port closed') ||
                reason.message.includes('before a response was received') ||
                reason.message.includes('message channel closed') ||
                reason.message.includes('asynchronous response') ||
                reason.message.includes('Receiving end does not exist') ||
                reason.message.includes('Could not establish connection') ||
                reason.message.includes('Extension context invalidated')
            ))
        )) {
            event.preventDefault();
            return false;
        }
    });
})();


// ===== Permissions System =====

// تعريف الصلاحيات التفصيلية لكل مديول
const MODULE_DETAILED_PERMISSIONS = {
    'employees': {
        label: 'صلاحيات مديول قاعدة بيانات الموظفين',
        permissions: [
            { key: 'employees-list', label: 'قائمة الموظفين', icon: 'fa-id-badge' },
            { key: 'external-workforce', label: 'تبويب العمالة الخارجية والمقاولين', icon: 'fa-helmet-safety' }
        ]
    },
    'incidents': {
        label: 'صلاحيات مديول الحوادث',
        permissions: [
            { key: 'registry', label: 'سجل الحوادث', icon: 'fa-book' },
            { key: 'detailed-log', label: 'السجل التفصيلي', icon: 'fa-list-alt' },
            { key: 'incidents-list', label: 'قائمة الحوادث', icon: 'fa-list' },
            { key: 'annual-log', label: 'السجل السنوي', icon: 'fa-calendar-alt' },
            { key: 'analysis', label: 'التحليل', icon: 'fa-chart-line' },
            { key: 'approvals', label: 'الموافقات', icon: 'fa-check-circle' },
            { key: 'safety-alerts', label: 'تنبيهات السلامة', icon: 'fa-bell' }
        ]
    },
    'clinic': {
        label: 'صلاحيات مديول العيادة',
        permissions: [
            { key: 'visits', label: 'الزيارات', icon: 'fa-user-md' },
            { key: 'medications', label: 'الأدوية', icon: 'fa-pills' },
            { key: 'sickLeave', label: 'الإجازات المرضية', icon: 'fa-calendar-times' },
            { key: 'dispensed-medications', label: 'سجل الأدوية المنصرفة', icon: 'fa-prescription-bottle-alt' },
            { key: 'injuries', label: 'الإصابات', icon: 'fa-user-injured' },
            { key: 'supply-request', label: 'طلب احتياجات', icon: 'fa-shopping-cart' },
            { key: 'approvals', label: 'طلبات الموافقة', icon: 'fa-check-circle' },
            { key: 'data-analysis', label: 'تحليل البيانات', icon: 'fa-chart-bar' }
        ]
    },
    'training': {
        label: 'صلاحيات مديول التدريب',
        permissions: [
            { key: 'training-list', label: 'قائمة التدريبات', icon: 'fa-list' },
            { key: 'training-matrix', label: 'مصفوفة التدريب', icon: 'fa-table' },
            { key: 'annual-plan', label: 'الخطة السنوية', icon: 'fa-calendar-check' },
            { key: 'analysis', label: 'التحليل', icon: 'fa-chart-line' },
            { key: 'contractor-training', label: 'تدريب المقاولين', icon: 'fa-users' }
        ]
    },
    'fire-equipment': {
        label: 'صلاحيات مديول معدات الإطفاء',
        permissions: [
            { key: 'database', label: 'قاعدة البيانات', icon: 'fa-database' },
            { key: 'register', label: 'السجل', icon: 'fa-clipboard-list' },
            { key: 'inspections', label: 'الفحوصات', icon: 'fa-clipboard-check' },
            { key: 'analytics', label: 'التحليل', icon: 'fa-chart-line' },
            { key: 'approval-requests', label: 'طلبات الموافقة', icon: 'fa-check-circle' }
        ]
    },
    'daily-observations': {
        label: 'صلاحيات مديول الملاحظات اليومية',
        permissions: [
            { key: 'observations-registry', label: 'سجل الملاحظات', icon: 'fa-book' },
            {
                key: 'observations-view-department',
                label: 'عرض ملاحظات الإدارة المعنية (تطابق حقل إدارة المستخدم مع «المسؤول عن التنفيذ»)',
                icon: 'fa-building'
            },
            { key: 'data-analysis', label: 'تحليل البيانات', icon: 'fa-chart-bar' },
            { key: 'observations-specialist-review', label: 'مراجعة أخصائي السلامة (سير الاعتماد)', icon: 'fa-user-check' },
            { key: 'observations-manager-approve', label: 'اعتماد مدير السلامة', icon: 'fa-stamp' },
            { key: 'observations-view-all', label: 'عرض جميع الملاحظات (متابعة شاملة)', icon: 'fa-globe' }
        ]
    },
    'ptw': {
        label: 'صلاحيات مديول تصاريح العمل',
        permissions: [
            { key: 'ptw-list', label: 'قائمة التصاريح', icon: 'fa-list' },
            { key: 'analytics', label: 'التحليل', icon: 'fa-chart-line' },
            { key: 'approvals', label: 'الموافقات', icon: 'fa-check-circle' }
        ]
    },
    'contractors': {
        label: 'صلاحيات مديول المقاولين',
        permissions: [
            { key: 'contractors-list', label: 'قائمة المقاولين', icon: 'fa-list' },
            { key: 'evaluations', label: 'التقييمات', icon: 'fa-star' },
            { key: 'analytics', label: 'التحليل', icon: 'fa-chart-line' },
            { key: 'approval-requests', label: 'طلبات الموافقة', icon: 'fa-check-circle' }
        ]
    }
};

const MODULE_PERMISSIONS_CONFIG = [
    { key: 'dashboard', label: 'لوحة التحكم', icon: 'fa-dashboard' },
    { key: 'users', label: 'إدارة المستخدمين', icon: 'fa-users-cog', adminOnly: true },
    { key: 'user-tasks', label: 'مهام المستخدمين', icon: 'fa-tasks' },
    { key: 'employees', label: 'قاعدة بيانات الموظفين', icon: 'fa-database', hasDetailedPermissions: true },
    { key: 'incidents', label: 'الحوادث', icon: 'fa-exclamation-triangle', hasDetailedPermissions: true },
    { key: 'nearmiss', label: 'الحوادث الوشيكة', icon: 'fa-exclamation-circle' },
    { key: 'ptw', label: 'تصاريح العمل', icon: 'fa-id-card', hasDetailedPermissions: true },
    { key: 'training', label: 'التدريب', icon: 'fa-graduation-cap', hasDetailedPermissions: true },
    { key: 'clinic', label: 'العيادة الطبية', icon: 'fa-hospital', hasDetailedPermissions: true },
    { key: 'fire-equipment', label: 'معدات الإطفاء', icon: 'fa-fire-extinguisher', hasDetailedPermissions: true },
    { key: 'periodic-inspections', label: 'الفحوصات الدورية', icon: 'fa-clipboard-check' },
    { key: 'ppe', label: 'مهمات الوقاية', icon: 'fa-hard-hat' },
    { key: 'violations', label: 'المخالفات', icon: 'fa-ban' },
    { key: 'contractors', label: 'المقاولين', icon: 'fa-users', hasDetailedPermissions: true },
    { key: 'behavior-monitoring', label: 'مراقبة السلوكيات', icon: 'fa-user-check' },
    { key: 'chemical-safety', label: 'السلامة الكيميائية', icon: 'fa-flask' },
    { key: 'daily-observations', label: 'الملاحظات اليومية', icon: 'fa-eye', hasDetailedPermissions: true },
    { key: 'iso', label: 'نظام ISO', icon: 'fa-certificate' },
    { key: 'emergency', label: 'تنبيهات الطوارئ', icon: 'fa-bell' },
    { key: 'risk-assessment', label: 'تقييم المخاطر', icon: 'fa-balance-scale' },
    { key: 'sop-jha', label: 'إجراءات العمل والتقييمات', icon: 'fa-tasks' },
    { key: 'legal-documents', label: 'الوثائق القانونية', icon: 'fa-file-contract' },
    { key: 'sustainability', label: 'الاستدامة', icon: 'fa-leaf' },
    { key: 'safety-budget', label: 'ميزانية السلامة وتتبع الإنفاق', icon: 'fa-wallet' },
    { key: 'ai-assistant', label: 'المساعد الذكي', icon: 'fa-robot' },
    { key: 'safety-performance-kpis', label: 'مؤشرات الأداء لإدارة السلامة', icon: 'fa-gauge-high', hasDetailedPermissions: true },
    { key: 'kpi-annual-plan', label: 'الخطة السنوية لمؤشرات الأداء (KPIs)', icon: 'fa-calendar-alt', parentModule: 'safety-performance-kpis' },
    { key: 'hse-monitoring-plan', label: 'خطة متابعة HSE', icon: 'fa-clipboard-check', parentModule: 'safety-performance-kpis' },
    { key: 'safety-health-management', label: 'إدارة السلامة والصحة', icon: 'fa-user-shield' },
    { key: 'settings', label: 'الإعدادات', icon: 'fa-cog', adminOnly: true },
    { key: 'action-tracking', label: 'سجل متابعة الإجراءات', icon: 'fa-clipboard-list' },
    { key: 'issue-tracking', label: 'تتبع المشاكل', icon: 'fa-bug', hasDetailedPermissions: true },
    { key: 'change-management', label: 'إدارة التغيرات', icon: 'fa-exchange-alt', hasDetailedPermissions: true },
    { key: 'issuing-authorities', label: 'المصرح لهم بالتوقيع على تصاريح العمل', icon: 'fa-user-check', parentModule: 'ptw', adminOnly: true }
];

const buildRoleDefaults = (enabledKeys = []) => {
    const permissions = {};
    MODULE_PERMISSIONS_CONFIG.forEach(({ key }) => {
        permissions[key] = enabledKeys.includes(key);
    });
    return permissions;
};

// ⚠️ ملاحظة أمنية مهمة: لا يتم إضافة أي صلاحيات افتراضية تلقائياً
// الصلاحيات تُمنح فقط من قبل مدير النظام من خلال إدارة المستخدمين
// هذا يضمن السيطرة الكاملة على الصلاحيات من قبل المدير
//
// ⚠️ تحذير: DEFAULT_ROLE_PERMISSIONS لا يتم استخدامه في hasAccess أو getEffectivePermissions
// هذا الكائن موجود فقط للتوافق مع الكود القديم أو للاستخدام المستقبلي
// لا يتم استخدامه تلقائياً لمنح أي صلاحيات - جميع الصلاحيات يجب منحها صراحةً من قبل المدير
const DEFAULT_ROLE_PERMISSIONS = {
    // مدير النظام - صلاحيات كاملة على كل الموديولات (يتم التحقق منها في hasAccess مباشرة)
    admin: buildRoleDefaults(MODULE_PERMISSIONS_CONFIG.map(m => m.key)),

    // مسئول السلامة - لا توجد صلاحيات افتراضية، يجب منحها من قبل مدير النظام
    safety_officer: buildRoleDefaults([]),

    // المستخدم العادي - لا توجد صلاحيات افتراضية، يجب منحها من قبل مدير النظام
    user: buildRoleDefaults([]),

    // دور القراءة فقط - يمكنه العرض فقط بدون إضافة أو تعديل أو حذف
    read_only: buildRoleDefaults([])
};

// ✅ قائمة الأدوار المتاحة في النظام
const AVAILABLE_ROLES = [
    { key: 'admin', label: 'مدير النظام', labelEn: 'System Administrator', color: 'red', icon: 'fa-user-shield' },
    { key: 'safety_officer', label: 'مسئول السلامة', labelEn: 'Safety Officer', color: 'blue', icon: 'fa-hard-hat' },
    { key: 'user', label: 'مستخدم عادي', labelEn: 'Regular User', color: 'green', icon: 'fa-user' },
    { key: 'read_only', label: 'قراءة فقط', labelEn: 'Read Only', color: 'purple', icon: 'fa-eye' }
];

const Permissions = {
    /**
     * هل الدور «مدير نظام»؟ يدعم اختلاف الحروف في الجدول/الجلسة (Admin، مدير النظام، …)
     */
    isAdminRole(role) {
        if (role == null || role === '') return false;
        const r = String(role).trim();
        if (r === 'مدير النظام' || r === 'مدير') return true;
        const low = r.toLowerCase();
        return (
            low === 'admin' ||
            low === 'administrator' ||
            low === 'system_admin' ||
            low === 'system-manager'
        );
    },

    /**
     * مدير فعلي في الجلسة أو في عمود permissions أو في جدول المستخدمين (بعد المزامنة).
     * يُستخدم لـ Users وإعدادات adminOnly وتبويبات التفصيل ومعدات الحريق.
     */
    isCurrentUserEffectiveAdmin(user = AppState.currentUser) {
        if (!user) return false;
        if (this.isAdminRole(user.role)) return true;
        const spRaw = user.permissions;
        const sp = this.normalizePermissions(spRaw);
        if (sp && typeof sp === 'object' && !Array.isArray(sp)) {
            if (this.isAdminRole(sp.role)) return true;
            if (sp.admin === true || sp.isAdmin === true || sp['manage-modules'] === true) return true;
        }
        if (AppState.appData && Array.isArray(AppState.appData.users)) {
            const emailOrId = (user.email || user.id || '').toString().toLowerCase().trim();
            const dbUser = AppState.appData.users.find(u =>
                (u.email && u.email.toString().toLowerCase().trim() === emailOrId) ||
                (u.id && /@/.test(String(u.id)) && u.id.toString().toLowerCase().trim() === emailOrId)
            );
            if (dbUser) {
                if (this.isAdminRole(dbUser.role)) return true;
                const dp = this.normalizePermissions(dbUser.permissions);
                if (dp && typeof dp === 'object' && !Array.isArray(dp)) {
                    if (this.isAdminRole(dp.role)) return true;
                    if (dp.admin === true || dp.isAdmin === true || dp['manage-modules'] === true) return true;
                }
            }
        }
        return false;
    },

    /**
     * تطبيع كائن الصلاحيات (يُحوّل JSON string إلى كائن)
     */
    normalizePermissions(permissions) {
        if (!permissions) return null;
        if (typeof permissions === 'string') {
            try {
                // محاولة تحليل JSON أولاً
                return JSON.parse(permissions);
            } catch (error) {
                // إذا فشل تحليل JSON، قد تكون الصلاحيات بصيغة key: value من Google Sheets
                const trimmed = permissions.trim();
                if (trimmed && (trimmed.includes(':') || trimmed.includes('\n'))) {
                    try {
                        // محاولة تحويل النص إلى كائن (key: value format)
                        const lines = trimmed.split('\n').filter(line => line.trim());
                        const perms = {};
                        lines.forEach(line => {
                            const match = line.match(/^([^:]+):\s*(.+)$/);
                            if (match) {
                                const key = match[1].trim();
                                let value = match[2].trim();
                                // تحويل القيم النصية إلى boolean/number/string
                                if (value === 'true') {
                                    perms[key] = true;
                                } else if (value === 'false') {
                                    perms[key] = false;
                                } else if (!isNaN(value) && value !== '') {
                                    perms[key] = Number(value);
                                } else {
                                    // محاولة تحليل القيم المعقدة (مثل الصلاحيات التفصيلية)
                                    // مثال: "incidentsPermissions: add: true, edit: false"
                                    if (value.includes(',')) {
                                        const nestedObj = {};
                                        const pairs = value.split(',').map(p => p.trim());
                                        pairs.forEach(pair => {
                                            const nestedMatch = pair.match(/^([^:]+):\s*(.+)$/);
                                            if (nestedMatch) {
                                                const nestedKey = nestedMatch[1].trim();
                                                const nestedValue = nestedMatch[2].trim();
                                                nestedObj[nestedKey] = nestedValue === 'true' ? true : 
                                                                      nestedValue === 'false' ? false : 
                                                                      !isNaN(nestedValue) ? Number(nestedValue) : nestedValue;
                                            }
                                        });
                                        if (Object.keys(nestedObj).length > 0) {
                                            perms[key] = nestedObj;
                                        } else {
                                            perms[key] = value;
                                        }
                                    } else {
                                        perms[key] = value;
                                    }
                                }
                            }
                        });
                        if (Object.keys(perms).length > 0) {
                            return perms;
                        }
                    } catch (parseError) {
                        Utils.safeWarn('⚠ تعذر تحليل بيانات الصلاحيات بصيغة key:value، سيتم تجاهلها:', parseError);
                    }
                }
                return null;
            }
        }
        return permissions;
    },

    async ensureFormSettingsState(forceReload = false) {
        // ✅ إصلاح: إعادة تحميل البيانات من Google Sheets عند forceReload لضمان الحصول على أحدث البيانات
        if (forceReload || !this.formSettingsState) {
            await this.initFormSettingsState();
        }
        return this.formSettingsState;
    },

    getFormSettingsState() {
        // دالة متزامنة للحصول على الحالة (تُستخدم في دوال العرض)
        if (!this.formSettingsState) {
            // إذا لم تكن الحالة مهيأة، إرجاع حالة افتراضية
            return {
                sites: [],
                selectedSiteId: '',
                departments: [],
                safetyTeam: []
            };
        }
        return this.formSettingsState;
    },

    async initFormSettingsState() {
        // ✅ ضمان وجود AppState.appData لتفادي أخطاء عند التعيين لاحقاً
        if (typeof AppState === 'undefined') return this.getFormSettingsState();
        if (!AppState.appData) AppState.appData = {};
        const hasRemoteSettingsApi = (
            typeof GoogleIntegration !== 'undefined' &&
            typeof GoogleIntegration.sendToAppsScript === 'function'
        );

        // محاولة تحميل إعدادات الشركة من Google Sheets أولاً
        if (hasRemoteSettingsApi) {
            try {
                const companyResult = await GoogleIntegration.sendToAppsScript('getCompanySettings', {});
                if (companyResult && companyResult.success && companyResult.data) {
                    // تحليل postLoginItems إذا كانت نصاً (JSON)
                    let postLoginItems = AppState.companySettings?.postLoginItems;
                    if (companyResult.data.postLoginItems !== undefined) {
                        const raw = companyResult.data.postLoginItems;
                        if (typeof raw === 'string' && raw.trim() !== '') {
                            try {
                                postLoginItems = JSON.parse(raw);
                            } catch (e) {
                                postLoginItems = [];
                            }
                        } else if (Array.isArray(raw)) {
                            postLoginItems = raw;
                        }
                    }
                    if (!Array.isArray(postLoginItems)) postLoginItems = [];

                    // تحليل clinicVisitTypes إذا كانت نصاً (JSON)
                    let clinicVisitTypes = AppState.companySettings?.clinicVisitTypes;
                    if (companyResult.data.clinicVisitTypes !== undefined) {
                        const rawClinicTypes = companyResult.data.clinicVisitTypes;
                        if (typeof rawClinicTypes === 'string' && rawClinicTypes.trim() !== '') {
                            try {
                                clinicVisitTypes = JSON.parse(rawClinicTypes);
                            } catch (e) {
                                clinicVisitTypes = rawClinicTypes.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
                            }
                        } else if (Array.isArray(rawClinicTypes)) {
                            clinicVisitTypes = rawClinicTypes;
                        } else {
                            clinicVisitTypes = [];
                        }
                    }
                    if (!Array.isArray(clinicVisitTypes)) clinicVisitTypes = [];

                    // تحديث AppState ببيانات الشركة من Google Sheets
                    AppState.companySettings = Object.assign({}, AppState.companySettings, {
                        name: companyResult.data.name || AppState.companySettings?.name,
                        secondaryName: companyResult.data.secondaryName || AppState.companySettings?.secondaryName,
                        nameFontSize: companyResult.data.nameFontSize || AppState.companySettings?.nameFontSize || 16,
                        secondaryNameFontSize: companyResult.data.secondaryNameFontSize || AppState.companySettings?.secondaryNameFontSize || 14,
                        secondaryNameColor: companyResult.data.secondaryNameColor || AppState.companySettings?.secondaryNameColor || '#6B7280',
                        formVersion: companyResult.data.formVersion || AppState.companySettings?.formVersion || '1.0',
                        address: companyResult.data.address || AppState.companySettings?.address,
                        phone: companyResult.data.phone || AppState.companySettings?.phone,
                        email: companyResult.data.email || AppState.companySettings?.email,
                        postLoginItems: postLoginItems,
                        clinicMonthlyVisitsAlertThreshold: companyResult.data.clinicMonthlyVisitsAlertThreshold ?? AppState.companySettings?.clinicMonthlyVisitsAlertThreshold ?? 10,
                        clinicVisitTypes: clinicVisitTypes
                    });

                    // تحديث شعار الشركة إذا كان موجوداً
                    if (companyResult.data.logo) {
                        AppState.companyLogo = companyResult.data.logo;
                        // تحديث الشعار في AppState.companySettings أيضاً
                        if (!AppState.companySettings) {
                            AppState.companySettings = {};
                        }
                        AppState.companySettings.logo = companyResult.data.logo;
                        // حفظ الشعار في localStorage
                        localStorage.setItem('company_logo', companyResult.data.logo);
                        localStorage.setItem('hse_company_logo', companyResult.data.logo);

                        // تحديث الشعار في جميع الأماكن المخصصة
                        if (typeof UI !== 'undefined') {
                            if (UI.updateCompanyLogoHeader) {
                                UI.updateCompanyLogoHeader();
                            }
                            if (UI.updateLoginLogo) {
                                UI.updateLoginLogo();
                            }
                            if (UI.updateDashboardLogo) {
                                UI.updateDashboardLogo();
                            }
                            if (UI.updateCompanyBranding) {
                                UI.updateCompanyBranding();
                            }
                        }

                        // إرسال حدث لتحديث الشعار
                        window.dispatchEvent(new CustomEvent('companyLogoUpdated', {
                            detail: { logoUrl: companyResult.data.logo }
                        }));
                    }

                    Utils.safeLog('✅ تم تحميل إعدادات الشركة من Google Sheets بنجاح');
                }
            } catch (error) {
                Utils.safeWarn('⚠️ فشل تحميل إعدادات الشركة من Google Sheets:', error);
            }
        }

        // ✅ إصلاح: محاولة تحميل الإعدادات من Google Sheets أولاً
        // ✅ إصلاح: هذا يعمل لجميع المستخدمين بعد المزامنة وتسجيل الدخول
        if (hasRemoteSettingsApi) {
            try {
                // ✅ إصلاح: تحميل مباشر من قاعدة البيانات بدون تأخير
                const result = await GoogleIntegration.sendToAppsScript('getFormSettings', {});
                if (result && result.success && result.data) {
                    // ✅ إصلاح: تحديث AppState بالبيانات من Google Sheets مع التأكد من وجود الأماكن الفرعية
                    if (Array.isArray(result.data.sites) && result.data.sites.length > 0) {
                        // ✅ إصلاح: التأكد من أن كل موقع يحتوي على places (حتى لو كانت مصفوفة فارغة)
                        // ✅ إصلاح: ربط صحيح للأماكن بالمواقع باستخدام String() لضمان المطابقة
                        const normalizedSites = result.data.sites.map(site => {
                            const siteId = String(site.id || '').trim();
                            // ✅ إصلاح: التأكد من ربط جميع الأماكن الفرعية بالموقع بشكل صحيح
                            // ✅ إصلاح: استخدام siteId من الموقع لضمان الربط الصحيح
                            const sitePlaces = Array.isArray(site.places) && site.places.length > 0 
                                ? site.places.map(place => {
                                    // ✅ إصلاح: استخدام siteId من الموقع الحالي لضمان الربط الصحيح
                                    const placeSiteId = String(place.siteId || site.id || siteId || '').trim();
                                    return {
                                        id: place.id || Utils.generateId('PLACE'),
                                        name: place.name || '',
                                        siteId: placeSiteId || siteId // ✅ إصلاح: ربط صحيح بالموقع
                                    };
                                })
                                : []; // ✅ إصلاح: مصفوفة فارغة إذا لم تكن هناك أماكن
                            
                            return {
                                id: site.id || Utils.generateId('SITE'),
                                name: site.name || '',
                                description: site.description || '',
                                places: sitePlaces // ✅ إصلاح: جميع الأماكن الفرعية مرتبطة بشكل صحيح
                            };
                        });
                        AppState.appData.observationSites = normalizedSites;
                        // ✅ إصلاح: عرض رسالة للمستخدم حتى في وضع الإنتاج
                        Utils.safeLog(`✅ تم تحميل ${normalizedSites.length} موقع من قاعدة البيانات`);
                    } else {
                        // ✅ عدم مسح المواقع المحلية (من DataManager.load) عند رجوع الـ API بلا مواقع
                        if (!Array.isArray(AppState.appData.observationSites)) {
                            AppState.appData.observationSites = [];
                        }
                    }
                    if (Array.isArray(result.data.departments) && result.data.departments.length > 0) {
                        if (!AppState.companySettings) {
                            AppState.companySettings = {};
                        }
                        AppState.companySettings.formDepartments = result.data.departments;
                    }
                    if (Array.isArray(result.data.safetyTeam) && result.data.safetyTeam.length > 0) {
                        if (!AppState.companySettings) {
                            AppState.companySettings = {};
                        }
                        AppState.companySettings.safetyTeam = result.data.safetyTeam;
                    }

                    // حفظ في localStorage لاستخدامها لاحقاً
                    const dm = (typeof window !== 'undefined' && window.DataManager) ||
                        (typeof DataManager !== 'undefined' && DataManager);
                    if (dm && typeof dm.save === 'function') {
                        dm.save();
                    }
                    if (dm && typeof dm.saveCompanySettings === 'function') {
                        dm.saveCompanySettings();
                    }

                    Utils.safeLog('✅ تم تحميل إعدادات النماذج من Google Sheets بنجاح');
                } else {
                    Utils.safeWarn('⚠️ لم يتم تحميل إعدادات النماذج من Google Sheets - استخدام البيانات المحلية');
                    if (!Array.isArray(AppState.appData.observationSites)) {
                        AppState.appData.observationSites = [];
                    }
                }
            } catch (error) {
                Utils.safeWarn('⚠️ فشل تحميل إعدادات النماذج من Google Sheets، سيتم استخدام البيانات المحلية:', error);
                if (!Array.isArray(AppState.appData.observationSites)) {
                    AppState.appData.observationSites = [];
                }
            }
        } else {
            if (!Array.isArray(AppState.appData.observationSites)) {
                AppState.appData.observationSites = [];
            }
        }

        const sitesSource = (() => {
            if (Array.isArray(AppState.appData?.observationSites) && AppState.appData.observationSites.length > 0) {
                return AppState.appData.observationSites;
            }
            if (typeof DailyObservations !== 'undefined' && Array.isArray(DailyObservations.DEFAULT_SITES)) {
                return DailyObservations.DEFAULT_SITES;
            }
            return [];
        })();

        // ✅ إصلاح: معالجة أفضل للمواقع والأماكن الفرعية - التأكد من تحميل جميع المواقع
        // لا نستخدم slice() أو limit - نحمّل جميع المواقع
        const clonedSites = sitesSource.map((site, index) => {
            const siteId = site.id || site.siteId || Utils.generateId('SITE');
            const siteName = site.name || site.title || site.label || `موقع ${index + 1}`;
            
            // ✅ إصلاح: معالجة أفضل للأماكن الفرعية مع دعم صيغ متعددة
            let placesSource = [];
            if (Array.isArray(site.places) && site.places.length > 0) {
                placesSource = site.places;
            } else if (Array.isArray(site.locations) && site.locations.length > 0) {
                placesSource = site.locations;
            } else if (Array.isArray(site.children) && site.children.length > 0) {
                placesSource = site.children;
            } else if (Array.isArray(site.areas) && site.areas.length > 0) {
                placesSource = site.areas;
            }
            
            // ✅ إصلاح: تطبيع الأماكن الفرعية مع التأكد من وجود id و name وربط صحيح بالموقع
            // ✅ إصلاح: استخدام String() لضمان المطابقة الصحيحة بين siteId
            const siteIdStr = String(siteId || '').trim();
            const places = placesSource.map((place, idx) => {
                // إذا كان place كائن، نستخدم خصائصه
                if (typeof place === 'object' && place !== null) {
                    // ✅ إصلاح: استخدام String() لضمان المطابقة الصحيحة
                    const placeSiteId = String(place.siteId || siteId || '').trim();
                    return {
                        id: place.id || place.placeId || place.value || Utils.generateId('PLACE'),
                        name: place.name || place.placeName || place.title || place.label || place.locationName || `مكان ${idx + 1}`,
                        siteId: placeSiteId || siteIdStr // ✅ إصلاح: ربط صحيح بالموقع باستخدام String()
                    };
                }
                // إذا كان place نص، نستخدمه كاسم
                if (typeof place === 'string') {
                    return {
                        id: Utils.generateId('PLACE'),
                        name: place,
                        siteId: siteIdStr // ✅ إصلاح: ربط صحيح بالموقع باستخدام String()
                    };
                }
                // في حالة أخرى، نستخدم قيمة افتراضية
                return {
                    id: Utils.generateId('PLACE'),
                    name: `مكان ${idx + 1}`,
                    siteId: siteIdStr // ✅ إصلاح: ربط صحيح بالموقع باستخدام String()
                };
            });
            
            return {
                id: siteId,
                name: siteName,
                description: site.description || '',
                places: places // ✅ إصلاح: التأكد من أن places دائماً مصفوفة (حتى لو كانت فارغة)
            };
        });

        const selectedSiteId = clonedSites[0]?.id || '';

        this.formSettingsState = {
            sites: clonedSites,
            selectedSiteId,
            departments: this.getInitialFormDepartments(),
            safetyTeam: this.getInitialSafetyTeam()
        };

        // ✅ إطلاق حدث وتحديث القوائم فوراً لأي عناصر موجودة في الـ DOM
        try {
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('formSettingsUpdated', {
                    detail: { sites: clonedSites, observationSites: AppState.appData.observationSites }
                }));
                var names = ['Training', 'Clinic', 'PTW', 'Incidents', 'Violations', 'FireEquipment', 'PeriodicInspections', 'BehaviorMonitoring'];
                for (var i = 0; i < names.length; i++) {
                    try {
                        var M = window[names[i]];
                        if (M && typeof M.refreshSiteDropdowns === 'function') M.refreshSiteDropdowns();
                    } catch (e2) { /* ignore */ }
                }
                if (clonedSites.length > 0 && typeof Utils !== 'undefined' && Utils.safeLog) {
                    Utils.safeLog('✅ تم إطلاق حدث formSettingsUpdated وتحديث قوائم المصنع/الموقع');
                }
            }
        } catch (e) { /* ignore */ }

        return this.formSettingsState;
    },

    /**
     * استدعاء دالة عند جاهزية إعدادات النماذج (المواقع). إذا كانت جاهزة تُستدعى فوراً، وإلا بعد حدث formSettingsUpdated.
     */
    onFormSettingsReady(callback) {
        if (typeof callback !== 'function') return;
        try {
            if (this.formSettingsState && Array.isArray(this.formSettingsState.sites) && this.formSettingsState.sites.length > 0) {
                callback(this.formSettingsState);
                return;
            }
            const handler = (e) => {
                try { window.removeEventListener('formSettingsUpdated', handler); } catch (err) {}
                try {
                    const state = (e && e.detail && e.detail.sites) ? { sites: e.detail.sites } : this.formSettingsState;
                    callback(state || { sites: [] });
                } catch (err) { Utils.safeWarn('⚠️ onFormSettingsReady callback error:', err); }
            };
            window.addEventListener('formSettingsUpdated', handler);
        } catch (err) { Utils.safeWarn('⚠️ onFormSettingsReady error:', err); }
    },

    getInitialFormDepartments() {
        const settings = AppState.companySettings || {};
        const stored = settings.formDepartments;
        if (Array.isArray(stored)) {
            return stored.map((item) => String(item || '').trim()).filter(Boolean);
        }
        if (typeof stored === 'string') {
            return stored.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
        }
        if (Array.isArray(settings.departments)) {
            return settings.departments.map((item) => String(item || '').trim()).filter(Boolean);
        }
        if (typeof settings.departments === 'string') {
            return settings.departments.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
        }
        if (typeof DailyObservations !== 'undefined' && typeof DailyObservations.getDepartmentOptions === 'function') {
            try {
                const options = DailyObservations.getDepartmentOptions();
                if (Array.isArray(options)) {
                    return options.map((item) => String(item || '').trim()).filter(Boolean);
                }
            } catch (error) {
                Utils.safeWarn('⚠️ تعذر تحميل الإدارات من DailyObservations:', error);
            }
        }
        return [];
    },

    getInitialSafetyTeam() {
        const settings = AppState.companySettings || {};
        const stored = settings.safetyTeam || settings.safetyTeamMembers;
        if (Array.isArray(stored)) {
            return stored.map((item) => String(item || '').trim()).filter(Boolean);
        }
        if (typeof stored === 'string') {
            return stored.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
        }
        return [];
    },

    renderFormSettingsCard() {
        return `
            <div class="content-card mt-6" id="form-settings-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-sliders-h ml-2"></i>
                        إعدادات النماذج
                    </h2>
                </div>
                <div class="card-body space-y-6">
                    <p class="text-sm text-gray-600 leading-6">
                        من هنا يمكنك إدارة المواقع وأماكنها، وتحديد قوائم الإدارات المسؤولة وفريق السلامة المستخدمين داخل النماذج (مثل الملاحظات اليومية).
                        أي تعديل يتم حفظه مباشرة في قاعدة البيانات ويظهر في النماذج عند تعبئتها. جميع العمليات تُسجل في سجل النشاطات مع اسم المستخدم والتاريخ.
                    </p>
                    <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-6 shadow">
                        <div class="flex flex-col gap-1 mb-4 pb-4 border-b border-gray-200">
                            <h3 class="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700" aria-hidden="true">
                                    <i class="fas fa-map-marked-alt text-sm"></i>
                                </span>
                                المواقع والأماكن
                            </h3>
                            <p class="text-xs text-gray-500 pr-2">
                                اختر موقعاً من العمود الأول لإدارة الأماكن التابعة له في العمود الثاني. الترتيب المعروض هنا يُستخدم في قوائم النماذج.
                            </p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div class="rounded-lg border border-gray-200 bg-white p-4 shadow flex flex-col" style="min-height: 12rem;">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                    <i class="fas fa-map-marker-alt text-gray-400 text-xs" aria-hidden="true"></i>
                                    المواقع
                                </h4>
                                <p class="text-xs text-gray-500 mb-3">قائمة المصانع أو المواقع؛ استخدم «اختيار» لتحديد الموقع النشط.</p>
                                <div id="form-settings-sites-list" class="space-y-2 flex-1 min-h-0 max-h-96 overflow-y-auto pr-1"></div>
                                <button type="button" class="btn-primary btn-sm mt-3 w-full flex-shrink-0" data-action="add-site">
                                    <i class="fas fa-plus ml-2"></i>إضافة موقع
                                </button>
                            </div>
                            <div class="rounded-lg border border-gray-200 bg-white p-4 shadow flex flex-col" style="min-height: 12rem; border-inline-start: 4px solid #3b82f6;">
                                <h4 class="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                                    <i class="fas fa-location-dot text-gray-400 text-xs" aria-hidden="true"></i>
                                    الأماكن داخل الموقع المحدد
                                </h4>
                                <p id="form-settings-places-context" class="text-xs text-gray-600 mb-3 rounded-md bg-gray-50 border border-dashed border-gray-200 px-3 py-2" style="min-height: 2.75rem;" aria-live="polite"></p>
                                <div id="form-settings-places-list" class="space-y-2 flex-1 min-h-0 max-h-96 overflow-y-auto pr-1"></div>
                                <button type="button" class="btn-secondary btn-sm mt-3 w-full flex-shrink-0" data-action="add-place" id="form-settings-add-place-btn">
                                    <i class="fas fa-plus ml-2"></i>إضافة مكان
                                </button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 class="text-sm font-semibold text-gray-700 mb-3">
                            <i class="fas fa-briefcase ml-2"></i>المسؤولون عن التنفيذ
                        </h3>
                        <div id="form-settings-departments-list" class="space-y-2"></div>
                        <button type="button" class="btn-secondary btn-sm mt-2" data-action="add-department">
                            <i class="fas fa-plus ml-2"></i>إضافة إدارة
                        </button>
                    </div>
                    <div>
                        <h3 class="text-sm font-semibold text-gray-700 mb-3">
                            <i class="fas fa-user-shield ml-2"></i>فريق السلامة
                        </h3>
                        <div id="form-settings-safety-list" class="space-y-2"></div>
                        <button type="button" class="btn-secondary btn-sm mt-2" data-action="add-safety-member">
                            <i class="fas fa-plus ml-2"></i>إضافة عضو
                        </button>
                    </div>
                    
                    <!-- استيراد وتصدير البيانات -->
                    <div class="border-t border-gray-200 pt-4 mt-4">
                        <h3 class="text-sm font-semibold text-gray-700 mb-3">
                            <i class="fas fa-exchange-alt ml-2"></i>استيراد وتصدير البيانات
                        </h3>
                        <div class="flex flex-wrap gap-2 mb-4">
                            <button type="button" class="btn-secondary btn-sm" data-action="import-form-settings-file">
                                <i class="fas fa-file-import ml-2"></i>استيراد من ملف
                            </button>
                            <button type="button" class="btn-secondary btn-sm" data-action="export-form-settings">
                                <i class="fas fa-file-export ml-2"></i>تصدير إلى ملف
                            </button>
                            <input type="file" id="form-settings-file-input" accept=".json" style="display: none;">
                        </div>
                        
                        <!-- منطقة النسخ واللصق -->
                        <div class="mt-4">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-paste ml-2"></i>النسخ واللصق (JSON)
                            </label>
                            <textarea 
                                id="form-settings-paste-area" 
                                class="form-input w-full min-h-[150px] font-mono text-sm"
                                placeholder='الصق البيانات بصيغة JSON هنا، مثال:&#10;{&#10;  "sites": [{"id": "SITE1", "name": "موقع 1", "places": [{"id": "PLACE1", "name": "مكان 1"}]}],&#10;  "departments": ["إدارة 1", "إدارة 2"],&#10;  "safetyTeam": ["عضو 1", "عضو 2"]&#10;}'
                            ></textarea>
                            <div class="flex gap-2 mt-2">
                                <button type="button" class="btn-secondary btn-sm" data-action="paste-form-settings">
                                    <i class="fas fa-clipboard ml-2"></i>استيراد من النص
                                </button>
                                <button type="button" class="btn-secondary btn-sm" data-action="copy-form-settings">
                                    <i class="fas fa-copy ml-2"></i>نسخ إلى الحافظة
                                </button>
                                <button type="button" class="btn-secondary btn-sm" data-action="clear-paste-area">
                                    <i class="fas fa-eraser ml-2"></i>مسح
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle ml-1"></i>
                                يمكنك نسخ البيانات من ملف JSON ولصقها هنا، أو نسخ البيانات الحالية للصقها في مكان آخر.
                            </p>
                        </div>
                    </div>
                </div>
                <div class="card-footer flex flex-wrap items-center justify-between gap-3">
                    <button type="button" class="btn-secondary" data-action="reset-form-settings">
                        <i class="fas fa-undo ml-2"></i>إلغاء التعديلات
                    </button>
                    <button type="button" class="btn-primary" data-action="save-form-settings">
                        <i class="fas fa-save ml-2"></i>حفظ إعدادات النماذج
                    </button>
                </div>
            </div>
        `;
    },

    renderFormSitesList() {
        const state = this.getFormSettingsState();
        if (!Array.isArray(state.sites) || state.sites.length === 0) {
            return `
                <div class="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-600">
                    لا توجد مواقع مسجلة. اضغط على زر <strong>إضافة موقع</strong> للبدء.
                </div>
            `;
        }

        // ✅ إصلاح: عرض جميع المواقع بدون أي قيود (50 موقع أو أكثر)
        // لا نستخدم slice() أو limit - نعرض جميع المواقع
        return state.sites.map((site, index) => `
            <div class="flex flex-wrap items-center gap-2 p-3 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors ${site.id === state.selectedSiteId ? 'border-blue-500 bg-blue-50' : ''}" data-site-id="${Utils.escapeHTML(site.id)}">
                <span class="inline-flex items-center justify-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 flex-shrink-0" title="الترتيب">#${index + 1}</span>
                <input type="text" class="form-input flex-1 min-w-0" data-field="site-name" data-site-id="${Utils.escapeHTML(site.id)}"
                    value="${Utils.escapeHTML(site.name || '')}" placeholder="اسم الموقع" style="min-width: 8rem;">
                <button type="button" class="btn-secondary btn-xs flex-shrink-0 ${site.id === state.selectedSiteId ? 'btn-primary' : ''}" data-action="select-site" data-site-id="${Utils.escapeHTML(site.id)}">
                    ${site.id === state.selectedSiteId ? '<i class="fas fa-check ml-1"></i>محدد' : 'اختيار'}
                </button>
                <button type="button" class="btn-danger btn-xs flex-shrink-0" data-action="remove-site" data-site-id="${Utils.escapeHTML(site.id)}" title="حذف الموقع">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    renderFormPlacesList() {
        const state = this.getFormSettingsState();
        const emptyBox = (body) => `
            <div class="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-600 leading-relaxed">
                ${body}
            </div>`;
        if (!state || !Array.isArray(state.sites)) {
            return emptyBox('لا توجد مواقع متاحة. أضف موقعاً أولاً من العمود المجاور.');
        }
        if (!state.selectedSiteId) {
            return emptyBox('اختر موقعاً من قائمة المواقع باستخدام زر <strong>اختيار</strong> لعرض وتعديل الأماكن التابعة له.');
        }
        const site = state.sites.find((item) => item.id === state.selectedSiteId);
        if (!site) {
            return emptyBox('الموقع المحدد غير موجود. اختر موقعاً صالحاً من القائمة.');
        }
        if (!Array.isArray(site.places) || site.places.length === 0) {
            const label = (site.name || '').trim() || 'هذا الموقع';
            return emptyBox(`لا توجد أماكن مسجلة لـ <strong>${Utils.escapeHTML(label)}</strong>. استخدم زر <strong>إضافة مكان</strong> أدناه.`);
        }
        return site.places.map((place, index) => `
            <div class="flex flex-wrap items-center gap-2 p-3 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors" data-place-id="${Utils.escapeHTML(place.id)}">
                <span class="inline-flex items-center justify-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 flex-shrink-0" title="الترتيب">#${index + 1}</span>
                <input type="text" class="form-input flex-1 min-w-0" data-field="place-name" data-place-id="${Utils.escapeHTML(place.id)}"
                    value="${Utils.escapeHTML(place.name || '')}" placeholder="اسم المكان داخل الموقع" style="min-width: 8rem;">
                <button type="button" class="btn-danger btn-xs flex-shrink-0" data-action="remove-place" data-place-id="${Utils.escapeHTML(place.id)}" title="حذف المكان">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    renderDepartmentsList() {
        const state = this.getFormSettingsState();
        if (!Array.isArray(state.departments) || state.departments.length === 0) {
            return `<p class="text-sm text-gray-500">لم يتم تحديد إدارات مسؤولة بعد. يمكنك إضافتها عبر الزر أدناه.</p>`;
        }
        return state.departments.map((department, index) => `
            <div class="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-white" data-department-index="${index}">
                <span class="text-xs text-gray-400">#${index + 1}</span>
                <input type="text" class="form-input flex-1" data-field="department-name" data-department-index="${index}"
                    value="${Utils.escapeHTML(department || '')}" placeholder="اسم الإدارة أو الجهة المسؤولة">
                <button type="button" class="btn-danger btn-xs" data-action="remove-department" data-department-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    renderSafetyTeamList() {
        const state = this.getFormSettingsState();
        if (!Array.isArray(state.safetyTeam) || state.safetyTeam.length === 0) {
            return `<p class="text-sm text-gray-500">لم يتم تسجيل أعضاء فريق السلامة. يمكنك إضافة الأسماء عبر الزر أدناه.</p>`;
        }
        return state.safetyTeam.map((member, index) => `
            <div class="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-white" data-safety-index="${index}">
                <span class="text-xs text-gray-400">#${index + 1}</span>
                <input type="text" class="form-input flex-1" data-field="safety-name" data-safety-index="${index}"
                    value="${Utils.escapeHTML(member || '')}" placeholder="اسم عضو فريق السلامة">
                <button type="button" class="btn-danger btn-xs" data-action="remove-safety-member" data-safety-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    refreshFormSettingsUI() {
        const state = this.getFormSettingsState();
        const sitesList = document.getElementById('form-settings-sites-list');
        if (sitesList) {
            sitesList.innerHTML = this.renderFormSitesList();
        }
        const placesList = document.getElementById('form-settings-places-list');
        if (placesList) {
            placesList.innerHTML = this.renderFormPlacesList();
        }
        const departmentsList = document.getElementById('form-settings-departments-list');
        if (departmentsList) {
            departmentsList.innerHTML = this.renderDepartmentsList();
        }
        const safetyList = document.getElementById('form-settings-safety-list');
        if (safetyList) {
            safetyList.innerHTML = this.renderSafetyTeamList();
        }
        const addPlaceBtn = document.getElementById('form-settings-add-place-btn');
        if (addPlaceBtn) {
            addPlaceBtn.disabled = !state.selectedSiteId;
        }
        const placesCtx = document.getElementById('form-settings-places-context');
        if (placesCtx) {
            if (!state || !state.selectedSiteId || !Array.isArray(state.sites)) {
                placesCtx.textContent =
                    'لم يُحدد موقع بعد. اختر موقعاً من قائمة «المواقع» بزر «اختيار» لعرض الأماكن التابعة له.';
            } else {
                const sel = state.sites.find((s) => s.id === state.selectedSiteId);
                if (!sel) {
                    placesCtx.textContent = 'الموقع المحدد غير متوفر في القائمة. اختر موقعاً آخر.';
                } else {
                    const name = String(sel.name || '').trim() || sel.id;
                    const n = Array.isArray(sel.places) ? sel.places.length : 0;
                    placesCtx.textContent = `الموقع النشط: ${name} — عدد الأماكن المسجلة: ${n}`;
                }
            }
        }
    },

    async bindFormSettingsEvents() {
        const card = document.getElementById('form-settings-card');
        if (!card) return;

        // ✅ إصلاح: إعادة تحميل البيانات من Google Sheets عند فتح التبويب لضمان الحصول على أحدث البيانات
        // forceReload = true لضمان تحميل جميع المواقع (50 موقع) من قاعدة البيانات
        await this.ensureFormSettingsState(true); // forceReload = true
        
        // ✅ إصلاح: التأكد من تحديث الواجهة بعد التحميل
        this.refreshFormSettingsUI();
        
        // ✅ إصلاح: إضافة رسالة تحميل للمستخدم (حتى في وضع الإنتاج)
        const sitesCount = this.formSettingsState?.sites?.length || 0;
        if (sitesCount > 0) {
            Utils.safeLog(`✅ تم تحميل ${sitesCount} موقع في تبويب إعدادات النماذج`);
        } else {
            Utils.safeWarn('⚠️ لم يتم تحميل أي مواقع - تحقق من قاعدة البيانات');
        }

        if (this.formSettingsEventsBound) return;
        this.formSettingsEventsBound = true;

        card.addEventListener('click', (event) => {
            const actionElement = event.target.closest('[data-action]');
            if (!actionElement) return;
            const action = actionElement.getAttribute('data-action');
            switch (action) {
                case 'add-site':
                    this.handleAddSite();
                    break;
                case 'select-site':
                    this.handleSelectSite(actionElement.getAttribute('data-site-id'));
                    break;
                case 'remove-site':
                    this.handleRemoveSite(actionElement.getAttribute('data-site-id'));
                    break;
                case 'add-place':
                    this.handleAddPlace();
                    break;
                case 'remove-place':
                    this.handleRemovePlace(actionElement.getAttribute('data-place-id'));
                    break;
                case 'add-department':
                    this.handleAddDepartment();
                    break;
                case 'remove-department':
                    this.handleRemoveDepartment(Number(actionElement.getAttribute('data-department-index')));
                    break;
                case 'add-safety-member':
                    this.handleAddSafetyMember();
                    break;
                case 'remove-safety-member':
                    this.handleRemoveSafetyMember(Number(actionElement.getAttribute('data-safety-index')));
                    break;
                case 'reset-form-settings':
                    this.handleResetFormSettings();
                    break;
                case 'save-form-settings':
                    this.handleSaveFormSettings();
                    break;
                case 'import-form-settings-file':
                    this.handleImportFormSettingsFile();
                    break;
                case 'export-form-settings':
                    this.handleExportFormSettings();
                    break;
                case 'paste-form-settings':
                    this.handlePasteFormSettings();
                    break;
                case 'copy-form-settings':
                    this.handleCopyFormSettings();
                    break;
                case 'clear-paste-area':
                    this.handleClearPasteArea();
                    break;
                default:
                    break;
            }
        });

        card.addEventListener('input', (event) => {
            const target = event.target;
            if (!target) return;
            const field = target.getAttribute('data-field');
            switch (field) {
                case 'site-name':
                    this.handleSiteNameChange(target.getAttribute('data-site-id'), target.value);
                    break;
                case 'place-name':
                    this.handlePlaceNameChange(target.getAttribute('data-place-id'), target.value);
                    break;
                case 'department-name':
                    this.handleDepartmentChange(Number(target.getAttribute('data-department-index')), target.value);
                    break;
                case 'safety-name':
                    this.handleSafetyMemberChange(Number(target.getAttribute('data-safety-index')), target.value);
                    break;
                default:
                    break;
            }
        });

        // ربط حدث اختيار الملف
        const fileInput = document.getElementById('form-settings-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    this.handleImportFormSettingsFileContent(file);
                }
                // إعادة تعيين قيمة input ليمكن اختيار نفس الملف مرة أخرى
                event.target.value = '';
            });
        }
    },

    async handleAddSite() {
        const state = await this.ensureFormSettingsState();
        if (!state) {
            Utils.safeError('❌ فشل تهيئة حالة إعدادات النماذج');
            return;
        }
        if (!Array.isArray(state.sites)) {
            state.sites = [];
        }
        const newSite = {
            id: Utils.generateId('SITE'),
            name: '',
            places: []
        };
        state.sites.push(newSite);
        state.selectedSiteId = newSite.id;
        this.refreshFormSettingsUI();
        setTimeout(() => {
            const input = document.querySelector(`[data-field="site-name"][data-site-id="${newSite.id}"]`);
            if (input) input.focus();
        }, 0);
    },

    handleSelectSite(siteId) {
        const state = this.getFormSettingsState();
        if (!siteId || !state || !Array.isArray(state.sites)) return;
        if (!state.sites.some((site) => site.id === siteId)) return;
        state.selectedSiteId = siteId;
        this.refreshFormSettingsUI();
    },

    handleRemoveSite(siteId) {
        const state = this.getFormSettingsState();
        if (!siteId || !state || !Array.isArray(state.sites)) return;
        const index = state.sites.findIndex((site) => site.id === siteId);
        if (index === -1) return;
        const siteName = state.sites[index].name || 'موقع بدون اسم';
        if (!confirm(`سيتم حذف الموقع "${siteName}" وجميع الأماكن المرتبطة به. هل ترغب بالمتابعة؟`)) {
            return;
        }
        state.sites.splice(index, 1);
        if (state.selectedSiteId === siteId) {
            state.selectedSiteId = state.sites[0]?.id || '';
        }
        this.refreshFormSettingsUI();
    },

    handleSiteNameChange(siteId, value) {
        const state = this.getFormSettingsState();
        if (!state || !Array.isArray(state.sites)) return;
        const site = state.sites.find((item) => item.id === siteId);
        if (site) {
            site.name = value;
        }
    },

    handleAddPlace() {
        const state = this.getFormSettingsState();
        if (!state || !Array.isArray(state.sites)) return;
        const siteId = state.selectedSiteId;
        if (!siteId) {
            Notification.warning('يرجى اختيار موقع أولاً.');
            return;
        }
        const site = state.sites.find((item) => item.id === siteId);
        if (!site) return;
        if (!Array.isArray(site.places)) {
            site.places = [];
        }
        const newPlace = {
            id: Utils.generateId('PLACE'),
            name: ''
        };
        site.places.push(newPlace);
        this.refreshFormSettingsUI();
        setTimeout(() => {
            const input = document.querySelector(`[data-field="place-name"][data-place-id="${newPlace.id}"]`);
            if (input) input.focus();
        }, 0);
    },

    handlePlaceNameChange(placeId, value) {
        const state = this.getFormSettingsState();
        if (!state || !Array.isArray(state.sites)) return;
        const site = state.sites.find((item) => item.id === state.selectedSiteId);
        if (!site || !Array.isArray(site.places)) return;
        const place = site.places.find((item) => item.id === placeId);
        if (place) {
            place.name = value;
        }
    },

    handleRemovePlace(placeId) {
        const state = this.getFormSettingsState();
        if (!state || !Array.isArray(state.sites)) return;
        const site = state.sites.find((item) => item.id === state.selectedSiteId);
        if (!site || !Array.isArray(site.places)) return;
        const index = site.places.findIndex((item) => item.id === placeId);
        if (index === -1) return;
        const placeName = site.places[index].name || 'مكان بدون اسم';
        if (!confirm(`هل ترغب في حذف المكان "${placeName}"؟`)) {
            return;
        }
        site.places.splice(index, 1);
        this.refreshFormSettingsUI();
    },

    handleAddDepartment() {
        const state = this.getFormSettingsState();
        if (!state) return;
        if (!Array.isArray(state.departments)) {
            state.departments = [];
        }
        state.departments.push('');
        this.refreshFormSettingsUI();
        setTimeout(() => {
            const index = state.departments.length - 1;
            const input = document.querySelector(`[data-field="department-name"][data-department-index="${index}"]`);
            if (input) input.focus();
        }, 0);
    },

    handleDepartmentChange(index, value) {
        const state = this.getFormSettingsState();
        if (!state) return;
        if (!Array.isArray(state.departments)) {
            state.departments = [];
        }
        if (Number.isInteger(index) && index >= 0 && index < state.departments.length) {
            state.departments[index] = value;
        }
    },

    handleRemoveDepartment(index) {
        const state = this.getFormSettingsState();
        if (!state || !Array.isArray(state.departments)) return;
        if (!Number.isInteger(index) || index < 0 || index >= state.departments.length) return;
        state.departments.splice(index, 1);
        this.refreshFormSettingsUI();
    },

    handleAddSafetyMember() {
        const state = this.getFormSettingsState();
        if (!state) return;
        if (!Array.isArray(state.safetyTeam)) {
            state.safetyTeam = [];
        }
        state.safetyTeam.push('');
        this.refreshFormSettingsUI();
        setTimeout(() => {
            const index = state.safetyTeam.length - 1;
            const input = document.querySelector(`[data-field="safety-name"][data-safety-index="${index}"]`);
            if (input) input.focus();
        }, 0);
    },

    handleSafetyMemberChange(index, value) {
        const state = this.getFormSettingsState();
        if (!state) return;
        if (!Array.isArray(state.safetyTeam)) {
            state.safetyTeam = [];
        }
        if (Number.isInteger(index) && index >= 0 && index < state.safetyTeam.length) {
            state.safetyTeam[index] = value;
        }
    },

    handleRemoveSafetyMember(index) {
        const state = this.getFormSettingsState();
        if (!state || !Array.isArray(state.safetyTeam)) return;
        if (!Number.isInteger(index) || index < 0 || index >= state.safetyTeam.length) return;
        state.safetyTeam.splice(index, 1);
        this.refreshFormSettingsUI();
    },

    handleResetFormSettings() {
        if (!confirm('سيتم تجاهل جميع التغييرات غير المحفوظة. هل تريد المتابعة؟')) {
            return;
        }
        this.initFormSettingsState();
        this.refreshFormSettingsUI();
        Notification.success('تمت استعادة الإعدادات كما كانت قبل التعديل.');
    },

    sanitizeSites(rawSites = []) {
        const sites = [];
        for (const site of rawSites) {
            const id = site.id || Utils.generateId('SITE');
            const name = (site.name || '').trim();
            if (!name) {
                return {
                    error: 'يرجى إدخال اسم لكل موقع.',
                    focusSelector: `[data-field="site-name"][data-site-id="${id}"]`
                };
            }
            const placesRaw = Array.isArray(site.places) ? site.places : [];
            const places = [];
            for (const place of placesRaw) {
                const placeId = place.id || Utils.generateId('PLACE');
                const placeName = (place.name || '').trim();
                if (!placeName) {
                    return {
                        error: `يرجى إدخال اسم لجميع الأماكن داخل الموقع "${name}".`,
                        focusSelector: `[data-field="place-name"][data-place-id="${placeId}"]`
                    };
                }
                places.push({ id: placeId, name: placeName });
            }
            sites.push({ id, name, places });
        }
        if (!sites.length) {
            return {
                error: 'يجب إضافة موقع واحد على الأقل.',
                focusSelector: '[data-action="add-site"]'
            };
        }
        return { sites };
    },

    async handleSaveFormSettings() {
        const state = await this.ensureFormSettingsState();
        if (!state) {
            Utils.safeError('❌ فشل تهيئة حالة إعدادات النماذج');
            return;
        }
        const sanitizedResult = this.sanitizeSites(state.sites || []);
        if (sanitizedResult.error) {
            Notification.error(sanitizedResult.error);
            if (sanitizedResult.focusSelector) {
                const element = document.querySelector(sanitizedResult.focusSelector);
                if (element) {
                    element.focus();
                    element.classList.add('ring', 'ring-ring-500');
                    setTimeout(() => element.classList.remove('ring', 'ring-red-500'), 1500);
                }
            }
            return;
        }

        const sites = sanitizedResult.sites;
        const departments = (state.departments || [])
            .map((value) => String(value || '').trim())
            .filter((value, index, array) => value && array.indexOf(value) === index);
        const safetyTeam = (state.safetyTeam || [])
            .map((value) => String(value || '').trim())
            .filter((value, index, array) => value && array.indexOf(value) === index);

        // حفظ في localStorage أولاً
        AppState.appData.observationSites = sites;
        if (!AppState.companySettings) {
            AppState.companySettings = {};
        }
        AppState.companySettings.formDepartments = departments;
        AppState.companySettings.safetyTeam = safetyTeam;

        const dm = (typeof window !== 'undefined' && window.DataManager) ||
            (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }
        if (dm && typeof dm.saveCompanySettings === 'function') {
            dm.saveCompanySettings();
        }

        // مزامنة مع Google Sheets إذا كان متاحاً
        if (AppState.googleConfig?.appsScript?.enabled && typeof GoogleIntegration !== 'undefined') {
            try {
                const userData = AppState.currentUser || {};
                const result = await GoogleIntegration.sendToAppsScript('saveFormSettings', {
                    id: 'FORM-SETTINGS-1',
                    sites: sites,
                    departments: departments,
                    safetyTeam: safetyTeam,
                    userData: {
                        email: userData.email,
                        name: userData.name,
                        role: userData.role,
                        permissions: userData.permissions
                    }
                });

                if (result && result.success) {
                    Utils.safeLog('✅ تم حفظ إعدادات النماذج في Google Sheets بنجاح');
                } else {
                    Utils.safeWarn('⚠️ فشل حفظ إعدادات النماذج في Google Sheets:', result?.message);
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ أثناء مزامنة إعدادات النماذج مع Google Sheets:', error);
            }
        }

        // تسجيل حركة المستخدم
        if (typeof UserActivityLog !== 'undefined') {
            UserActivityLog.log('settings', 'Settings', 'form-settings', {
                description: 'تعديل إعدادات النماذج (المواقع، الإدارات، فريق السلامة)'
            }).catch(() => { });
        }

        AuditLog.log('update_form_settings', 'Settings', 'form-settings', {
            sites: sites.length,
            departments: departments.length,
            safetyTeam: safetyTeam.length
        });

        Notification.success('تم حفظ إعدادات النماذج بنجاح.');
        this.initFormSettingsState();
        this.refreshFormSettingsUI();
    },

    handleImportFormSettingsFile() {
        const fileInput = document.getElementById('form-settings-file-input');
        if (fileInput) {
            fileInput.click();
        }
    },

    handleImportFormSettingsFileContent(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const data = JSON.parse(content);
                this.importFormSettingsData(data);
            } catch (error) {
                Notification.error('فشل قراءة الملف. تأكد من أن الملف بصيغة JSON صحيحة: ' + error.message);
            }
        };
        reader.onerror = () => {
            Notification.error('حدث خطأ أثناء قراءة الملف.');
        };
        reader.readAsText(file);
    },

    importFormSettingsData(data) {
        if (!data || typeof data !== 'object') {
            Notification.error('صيغة البيانات غير صحيحة.');
            return;
        }

        const state = this.getFormSettingsState();
        if (!state) {
            Utils.safeError('❌ فشل تهيئة حالة إعدادات النماذج');
            return;
        }
        let imported = false;

        // استيراد المواقع
        if (Array.isArray(data.sites) && data.sites.length > 0) {
            const importedSites = data.sites.map((site, index) => {
                const siteId = site.id || Utils.generateId('SITE');
                const siteName = site.name || site.title || site.label || `موقع ${index + 1}`;
                const placesSource = Array.isArray(site.places)
                    ? site.places
                    : Array.isArray(site.locations)
                        ? site.locations
                        : Array.isArray(site.children)
                            ? site.children
                            : Array.isArray(site.areas)
                                ? site.areas
                                : [];
                const places = placesSource.map((place, idx) => ({
                    id: place.id || place.placeId || place.value || Utils.generateId('PLACE'),
                    name: place.name || place.placeName || place.title || place.label || place.locationName || `مكان ${idx + 1}`
                }));
                return {
                    id: siteId,
                    name: siteName,
                    places
                };
            });
            state.sites = importedSites;
            state.selectedSiteId = importedSites[0]?.id || '';
            imported = true;
        }

        // استيراد الإدارات
        if (Array.isArray(data.departments) && data.departments.length > 0) {
            state.departments = data.departments
                .map((item) => String(item || '').trim())
                .filter(Boolean);
            imported = true;
        } else if (typeof data.departments === 'string') {
            state.departments = data.departments
                .split(/\n|,/)
                .map((item) => item.trim())
                .filter(Boolean);
            imported = true;
        }

        // استيراد فريق السلامة
        if (Array.isArray(data.safetyTeam) && data.safetyTeam.length > 0) {
            state.safetyTeam = data.safetyTeam
                .map((item) => String(item || '').trim())
                .filter(Boolean);
            imported = true;
        } else if (Array.isArray(data.safetyTeamMembers) && data.safetyTeamMembers.length > 0) {
            state.safetyTeam = data.safetyTeamMembers
                .map((item) => String(item || '').trim())
                .filter(Boolean);
            imported = true;
        } else if (typeof data.safetyTeam === 'string') {
            state.safetyTeam = data.safetyTeam
                .split(/\n|,/)
                .map((item) => item.trim())
                .filter(Boolean);
            imported = true;
        }

        if (imported) {
            this.refreshFormSettingsUI();
            Notification.success('تم استيراد البيانات بنجاح. يمكنك مراجعة التعديلات وحفظها.');
        } else {
            Notification.warning('لم يتم العثور على بيانات صحيحة للاستيراد.');
        }
    },

    handleExportFormSettings() {
        const state = this.getFormSettingsState();
        if (!state) {
            Utils.safeError('❌ فشل تهيئة حالة إعدادات النماذج');
            return;
        }
        const exportData = {
            sites: state.sites || [],
            departments: state.departments || [],
            safetyTeam: state.safetyTeam || []
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Notification.success('تم تصدير البيانات بنجاح.');
    },

    handlePasteFormSettings() {
        const pasteArea = document.getElementById('form-settings-paste-area');
        if (!pasteArea) return;

        const text = pasteArea.value.trim();
        if (!text) {
            Notification.warning('الرجاء لصق البيانات في المنطقة النصية أولاً.');
            return;
        }

        try {
            const data = JSON.parse(text);
            this.importFormSettingsData(data);
            pasteArea.value = '';
        } catch (error) {
            Notification.error('صيغة JSON غير صحيحة. تحقق من البيانات: ' + error.message);
        }
    },

    handleCopyFormSettings() {
        const state = this.getFormSettingsState();
        if (!state) {
            Utils.safeError('❌ فشل تهيئة حالة إعدادات النماذج');
            return;
        }
        const exportData = {
            sites: state.sites || [],
            departments: state.departments || [],
            safetyTeam: state.safetyTeam || []
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const pasteArea = document.getElementById('form-settings-paste-area');
        if (pasteArea) {
            pasteArea.value = jsonString;
            pasteArea.select();
            pasteArea.setSelectionRange(0, 99999); // للأجهزة المحمولة
        }

        // نسخ إلى الحافظة
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonString).then(() => {
                Notification.success('تم نسخ البيانات إلى الحافظة.');
            }).catch(() => {
                // Fallback: استخدام execCommand
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = jsonString;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    Notification.success('تم نسخ البيانات إلى الحافظة.');
                } catch (err) {
                    Notification.error('فشل نسخ البيانات. حاول يدوياً من المنطقة النصية.');
                }
            });
        } else {
            // Fallback للمتصفحات القديمة
            try {
                const textArea = document.createElement('textarea');
                textArea.value = jsonString;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                Notification.success('تم نسخ البيانات إلى الحافظة.');
            } catch (err) {
                Notification.error('فشل نسخ البيانات. استخدم Ctrl+C على النص في المنطقة النصية.');
            }
        }
    },

    handleClearPasteArea() {
        const pasteArea = document.getElementById('form-settings-paste-area');
        if (pasteArea) {
            pasteArea.value = '';
            pasteArea.focus();
        }
    },

    /**
     * الحصول على صلاحيات المستخدم من قاعدة البيانات
     */
    getDatabasePermissions(user) {
        if (!user || !user.email) {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ getDatabasePermissions: لا يوجد مستخدم أو بريد إلكتروني');
            }
            return null;
        }
        
        // ✅ إصلاح: التأكد من وجود AppState.appData.users
        if (!AppState.appData || !AppState.appData.users) {
            if (AppState.debugMode) {
                Utils.safeLog('ℹ️ getDatabasePermissions: AppState.appData.users غير محملة بعد');
            }
            return null;
        }
        
        const users = AppState.appData.users || [];
        const dbUser = users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
        
        if (!dbUser) {
            if (AppState.debugMode) {
                Utils.safeLog(`ℹ️ getDatabasePermissions: المستخدم ${user.email} غير موجود في قاعدة البيانات`);
            }
            return null;
        }
        
        // ✅ إصلاح: تطبيع الصلاحيات والتأكد من أنها كائن صالح
        const normalized = this.normalizePermissions(dbUser.permissions);
        if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
            if (AppState.debugMode) {
                Utils.safeLog(`✅ getDatabasePermissions: تم العثور على صلاحيات للمستخدم ${user.email}`, Object.keys(normalized).length, 'صلاحية');
            }
            return normalized;
        } else {
            // إذا كانت الصلاحيات غير صالحة، نعيد كائن فارغ بدلاً من null
            if (AppState.debugMode) {
                Utils.safeWarn(`⚠️ getDatabasePermissions: صلاحيات المستخدم ${user.email} غير صالحة - إرجاع كائن فارغ`);
            }
            return {};
        }
    },

    /**
     * الحصول على الصلاحيات النهائية للمستخدم (جلسة + قاعدة بيانات)
     * يعطي الأولوية للصلاحيات من قاعدة البيانات لضمان المزامنة الفورية
     * 
     * ⚠️ مهم: لا يتم استخدام DEFAULT_ROLE_PERMISSIONS هنا - فقط الصلاحيات الممنوحة صراحةً من قبل المدير
     * 
     * @param {Object} user - بيانات المستخدم (افتراضي: المستخدم الحالي)
     * @returns {Object} - كائن الصلاحيات الفعالة
     */
    getEffectivePermissions(user = AppState.currentUser) {
        if (!user) return {};
        if (this.isCurrentUserEffectiveAdmin(user)) {
            return { __isAdmin: true };
        }

        const effective = {};

        // ✅ إصلاح: الحصول على الصلاحيات من الجلسة أولاً (لضمان العمل حتى لو لم تكن البيانات محملة)
        const sessionPermissions = this.normalizePermissions(user.permissions);
        if (sessionPermissions && typeof sessionPermissions === 'object' && Object.keys(sessionPermissions).length > 0) {
            // دمج الصلاحيات من الجلسة
            // ✅ إصلاح: استخدام deep merge للصلاحيات التفصيلية
            Object.keys(sessionPermissions).forEach(key => {
                if (key.endsWith('Permissions') && typeof sessionPermissions[key] === 'object') {
                    // الصلاحيات التفصيلية - دمج عميق
                    effective[key] = { ...(effective[key] || {}), ...sessionPermissions[key] };
                } else {
                    // الصلاحيات الأساسية
                    effective[key] = sessionPermissions[key];
                }
            });
        }

        // الحصول على الصلاحيات من قاعدة البيانات (الأحدث - لها الأولوية)
        const dbPermissions = this.getDatabasePermissions(user);
        if (dbPermissions && typeof dbPermissions === 'object' && Object.keys(dbPermissions).length > 0) {
            // ✅ إصلاح: دمج عميق للصلاحيات من قاعدة البيانات (الأولوية - تستبدل الصلاحيات من الجلسة)
            Object.keys(dbPermissions).forEach(key => {
                if (key.endsWith('Permissions') && typeof dbPermissions[key] === 'object') {
                    // الصلاحيات التفصيلية - دمج عميق
                    effective[key] = { ...(effective[key] || {}), ...dbPermissions[key] };
                } else {
                    // الصلاحيات الأساسية
                    effective[key] = dbPermissions[key];
                }
            });

            // تحديث صلاحيات المستخدم الحالي في AppState إذا كان هو المستخدم الحالي
            if (user === AppState.currentUser || (user.email && AppState.currentUser && user.email === AppState.currentUser.email)) {
                AppState.currentUser.permissions = dbPermissions;
            }
        }

        // ⚠️ لا يتم إضافة أي صلاحيات افتراضية هنا - فقط الصلاحيات الممنوحة صراحةً

        return effective;
    },

    /**
     * التحقق من صلاحية المستخدم للوصول إلى مديول معين
     * 
     * ⚠️ مهم: لا توجد صلاحيات افتراضية - جميع الصلاحيات يجب منحها صراحةً من قبل مدير النظام
     * 
     * @param {string} moduleName - اسم الموديول
     * @returns {boolean} - true إذا كان لديه صلاحية، false إذا لم يكن لديه صلاحية
     */
    hasAccess(moduleName) {
        const user = AppState.currentUser;
        if (!user) {
            if (AppState.debugMode) {
                Utils.safeWarn(`⚠️ hasAccess(${moduleName}): لا يوجد مستخدم مسجل دخول`);
            }
            return false;
        }

        // ملفي الشخصي متاح دائماً لأي مستخدم مسجل الدخول
        if (moduleName === 'profile') {
            return true;
        }

        // التحقق من الموديولات المحمية (adminOnly)
        const moduleConfig = MODULE_PERMISSIONS_CONFIG.find(m => m.key === moduleName);
        if (moduleConfig && moduleConfig.adminOnly) {
            // الموديولات المحمية متاحة لمدير النظام فقط
            const isAdmin = this.isCurrentUserEffectiveAdmin(user);
            if (AppState.debugMode && !isAdmin) {
                Utils.safeLog(`🔒 hasAccess(${moduleName}): موديول محمي - يتطلب صلاحيات مدير`);
            }
            return isAdmin;
        }

        // المدير لديه صلاحيات كاملة
        if (this.isCurrentUserEffectiveAdmin(user)) {
            if (AppState.debugMode) {
                Utils.safeLog(`✅ hasAccess(${moduleName}): مدير النظام - صلاحية كاملة`);
            }
            return true;
        }

        // التحقق من الصلاحيات المخصصة للمستخدم (الممنوحة من قبل مدير النظام فقط)
        // ⚠️ لا يتم استخدام DEFAULT_ROLE_PERMISSIONS هنا - فقط الصلاحيات الممنوحة صراحةً
        const effectivePermissions = this.getEffectivePermissions(user);
        if (Object.prototype.hasOwnProperty.call(effectivePermissions, moduleName)) {
            const hasAccess = effectivePermissions[moduleName] === true;
            if (AppState.debugMode) {
                Utils.safeLog(`🔍 hasAccess(${moduleName}): ${hasAccess ? '✅ مسموح' : '❌ غير مسموح'} (من الصلاحيات الفعالة)`);
            }
            return hasAccess;
        }

        // ⚠️ لا توجد صلاحيات افتراضية - يجب منحها من قبل مدير النظام فقط
        if (AppState.debugMode) {
            Utils.safeLog(`❌ hasAccess(${moduleName}): لا توجد صلاحية - يجب منحها من قبل المدير`);
        }
        return false;
    },

    /**
     * التحقق من صلاحية تفصيلية داخل مديول
     * @param {string} moduleName - اسم المديول (مثل 'incidents', 'clinic')
     * @param {string} permissionKey - مفتاح الصلاحية التفصيلية (مثل 'analysis', 'registry')
     * @returns {boolean} - true إذا كان لديه صلاحية
     */
    hasDetailedPermission(moduleName, permissionKey) {
        const user = AppState.currentUser;
        if (!user) return false;

        // المدير لديه صلاحيات كاملة
        if (this.isCurrentUserEffectiveAdmin(user)) return true;

        // التحقق من وجود صلاحية الوصول للمديول أولاً
        if (!this.hasAccess(moduleName)) return false;

        // الحصول على الصلاحيات الفعالة
        const effectivePermissions = this.getEffectivePermissions(user);
        
        // التحقق من الصلاحيات التفصيلية
        const detailedPerms = effectivePermissions[`${moduleName}Permissions`];
        if (detailedPerms && typeof detailedPerms === 'object') {
            return detailedPerms[permissionKey] === true;
        }

        // إذا لم توجد صلاحيات تفصيلية، نعطي الوصول الكامل للمديول
        // (للتوافق مع المستخدمين القدامى)
        return true;
    },

    /**
     * الحصول على قائمة الصلاحيات التفصيلية المسموح بها لمديول معين
     * @param {string} moduleName - اسم المديول
     * @returns {Array} - مصفوفة بمفاتيح الصلاحيات المسموح بها
     */
    getAllowedDetailedPermissions(moduleName) {
        const user = AppState.currentUser;
        if (!user) return [];

        // المدير لديه صلاحيات كاملة
        if (this.isCurrentUserEffectiveAdmin(user)) {
            const moduleDetails = MODULE_DETAILED_PERMISSIONS[moduleName];
            if (moduleDetails && moduleDetails.permissions) {
                return moduleDetails.permissions.map(p => p.key);
            }
            return [];
        }

        // التحقق من وجود صلاحية الوصول للمديول أولاً
        if (!this.hasAccess(moduleName)) return [];

        const effectivePermissions = this.getEffectivePermissions(user);
        const detailedPerms = effectivePermissions[`${moduleName}Permissions`];
        
        if (detailedPerms && typeof detailedPerms === 'object') {
            return Object.keys(detailedPerms).filter(key => detailedPerms[key] === true);
        }

        // إذا لم توجد صلاحيات تفصيلية، نعطي الوصول الكامل
        const moduleDetails = MODULE_DETAILED_PERMISSIONS[moduleName];
        if (moduleDetails && moduleDetails.permissions) {
            return moduleDetails.permissions.map(p => p.key);
        }

        return [];
    },





    /* Deprecated training helpers within Permissions
    openAnnualPlanItemForm(year, itemId = null, onSave = null) {
        const plan = this.getAnnualPlan(year, { createIfMissing: true });
        const item = plan.items.find(i => i.id === itemId) || null;
        const positions = this.getUniquePositions();
        // ✅ تم التحديث: استخدام ApprovedContractors فقط
        const contractors = (typeof Contractors !== 'undefined' && typeof Contractors.getAllContractorsForModules === 'function')
            ? Contractors.getAllContractorsForModules().map(contractor => contractor.name || contractor.companyName).filter(Boolean)
            : (AppState.appData.approvedContractors || []).map(contractor => contractor.companyName || contractor.name).filter(Boolean);
        const topics = this.getAllTrainingTopics();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-calendar-plus ml-2"></i>
                        ${item ? 'تعديل عنصر الخطة' : 'إضافة عنصر جديد للخطة'}
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="annual-plan-item-form">
                    <div class="modal-body space-y-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="plan-item-topic" class="block text-sm font-semibold text-gray-700 mb-2">الموضوع التدريبي *</label>
                                <input type="text" id="plan-item-topic" class="form-input" required value="${Utils.escapeHTML(item?.topic || '')}" placeholder="عنوان البرنامج التدريبي">
                            </div>
                            <div>
                                <label for="plan-item-date" class="block text-sm font-semibold text-gray-700 mb-2">التاريخ المخطط *</label>
                                <input type="date" id="plan-item-date" class="form-input" required value="${item?.plannedDate ? new Date(item.plannedDate).toISOString().slice(0, 10) : ''}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label for="plan-item-target-type" class="block text-sm font-semibold text-gray-700 mb-2">الفئة المستهدفة *</label>
                                <select id="plan-item-target-type" class="form-input" required>
                                    <option value="employees" ${item?.targetType === 'employees' ? 'selected' : ''}>الموظفون</option>
                                    <option value="contractors" ${item?.targetType === 'contractors' ? 'selected' : ''}>المقاولون</option>
                                    <option value="mixed" ${item?.targetType === 'mixed' ? 'selected' : ''}>الكل</option>
                                </select>
                            </div>
                            <div>
                                <label for="plan-item-status" class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                                <select id="plan-item-status" class="form-input">
                                    <option value="مخطط" ${item?.status === 'مخطط' ? 'selected' : ''}>مخطط</option>
                                    <option value="قيد التنفيذ" ${item?.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
                                    <option value="مكتمل" ${item?.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                    <option value="مؤجل" ${item?.status === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                                </select>
                            </div>
                            <div>
                                <label for="plan-item-year" class="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
                                <input type="text" id="plan-item-year" class="form-input" value="${year}" disabled>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="plan-item-roles" class="block text-sm font-semibold text-gray-700 mb-2">الوظائف المستهدفة</label>
                                <select id="plan-item-roles" class="form-input" multiple size="5">
                                    ${positions.map(position => `
                                        <option value="${Utils.escapeHTML(position)}" ${item?.targetRoles?.includes(position) ? 'selected' : ''}>${Utils.escapeHTML(position)}</option>
    
        
        modal.querySelector('#quick-training-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                const subject = modal.querySelector('#quick-training-subject')?.value.trim();
                const trainer = modal.querySelector('#quick-training-trainer')?.value.trim();
                const trainingType = modal.querySelector('#quick-training-type')?.value || 'داخلي';
                const dateValue = modal.querySelector('#quick-training-date')?.value;
                const location = modal.querySelector('#quick-training-location')?.value.trim();
                const status = modal.querySelector('#quick-training-status')?.value || 'مكتمل';
                const startTime = modal.querySelector('#quick-training-start-time')?.value;
                const endTime = modal.querySelector('#quick-training-end-time')?.value;
                const hoursValue = parseFloat(modal.querySelector('#quick-training-hours')?.value || '0');
                const topicsSelected = this.getSelectedOptionsFromElement(modal.querySelector('#quick-training-topics'));
                
                if (!subject || !trainer || !dateValue) {
                    Notification.warning('يرجى إدخال البيانات الأساسية للتدريب');
                    return;
                }
                
                let computedHours = hoursValue;
                if ((!computedHours || computedHours <= 0) && startTime && endTime) {
                    const start = new Date(`2000-01-01T${startTime}:00`);
                    const end = new Date(`2000-01-01T${endTime}:00`);
                    const diffMs = end - start;
                    if (diffMs > 0) {
                        computedHours = diffMs / (1000 * 60 * 60);
                    }
                }
                
                const trainingId = Utils.generateId('TRAINING');
                const isoDate = new Date(dateValue).toISOString();
                
                const participantEntry = {
                    name: employee.name || '',
                    code: employee.employeeNumber || employee.sapId || '',
                    employeeNumber: employee.employeeNumber || employee.sapId || '',
                    employeeCode: employee.employeeNumber || employee.employeeCode || '',
                    department: employee.department || '',
                    position: employee.position || '',
                    workLocation: employee.location || employee.workLocation || '',
                    type: 'employee',
                    personType: 'employee',
                    topics: topicsSelected
                };
                
                const trainingRecord = {
                    id: trainingId,
                    name: subject,
                    trainer: trainer,
                    trainingType: trainingType,
                    location: location || '',
                    date: isoDate,
                    startDate: isoDate,
                    startTime: startTime || '',
                    endTime: endTime || '',
                    status: status,
                    hours: computedHours > 0 ? computedHours.toFixed(2) : '',
                    participants: [participantEntry],
                    participantsCount: 1,
                    topics: topicsSelected,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                AppState.appData.training.push(trainingRecord);
                this.syncEmployeeTrainingMatrix(trainingRecord);
                
                if (topicsSelected.length) {
                    const year = new Date(dateValue).getFullYear();
                    const plan = this.getAnnualPlan(year, { createIfMissing: false });
                    if (plan) {
                        const nowIso = new Date().toISOString();
                        topicsSelected.forEach(topicName => {
                            const planItem = plan.items.find(item => {
                                if (item.linkedTrainingId) return false;
                                const matchesTopic = item.topic === topicName || (Array.isArray(item.requiredTopics) && item.requiredTopics.includes(topicName));
                                if (!matchesTopic) return false;
                                if (Array.isArray(item.targetRoles) && item.targetRoles.length) {
                                    return item.targetRoles.includes(employee.position);
                                }
                                return item.targetType !== 'contractors';
                            });
                            if (planItem) {
                                planItem.linkedTrainingId = trainingId;
                                planItem.status = 'مكتمل';
                                planItem.updatedAt = nowIso;
                            }
                        });
                    }
                }
                
                const dm = (typeof window !== 'undefined' && window.DataManager) || 
                           (typeof DataManager !== 'undefined' && DataManager);
                if (dm && typeof dm.save === 'function') {
                    dm.save();
                }
                await Promise.allSettled([
                    GoogleIntegration.autoSave?.('Training', AppState.appData.training),
                    GoogleIntegration.autoSave?.('EmployeeTrainingMatrix', AppState.appData.employeeTrainingMatrix)
                ]);
                
                await this.refreshTrainingMatrix();
                this.loadTrainingList();
                Notification.success('تم تسجيل التدريب بنجاح');
                close();
            } catch (error) {
                Utils.safeError('خطأ في تسجيل التدريب السريع:', error);
                Notification.error('تعذر تسجيل التدريب: ' + error.message);
            }
        });
    },
    
    
    
    
    showAnnualPlanModal(initialYear = new Date().getFullYear()) {
        this.ensureData();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1100px; max-height: 92vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-calendar-check ml-2"></i>
                        الخطة التدريبية السنوية
                    </h2>
                    <div class="flex items-center gap-2 mr-auto">
                        <button class="btn-icon btn-icon-secondary" id="annual-plan-prev-year" title="السنة السابقة">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <input type="number" id="annual-plan-year" class="form-input" style="width: 120px;" value="${initialYear}">
                        <button class="btn-icon btn-icon-secondary" id="annual-plan-next-year" title="السنة التالية">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                    </div>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-6" id="annual-plan-body"></div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إغلاق</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });
        
        const traineesInput = modal.querySelector('#contractor-training-trainees');
        const durationInput = modal.querySelector('#contractor-training-duration');
        const totalHoursInput = modal.querySelector('#contractor-training-hours');
        const recalculateTotalHours = () => {
            if (!traineesInput || !durationInput || !totalHoursInput) return;
            const trainees = parseInt(traineesInput.value || '0', 10);
            const duration = parseInt(durationInput.value || '0', 10);
            if (Number.isFinite(trainees) && trainees > 0 && Number.isFinite(duration) && duration > 0) {
                const computed = Number(((trainees * duration) / 60).toFixed(2));
                totalHoursInput.value = computed > 0 ? computed.toFixed(2) : '';
            } else {
                totalHoursInput.value = '';
            }
        };
        traineesInput?.addEventListener('input', () => {
            if (traineesInput.value && parseInt(traineesInput.value, 10) < 0) traineesInput.value = '';
            recalculateTotalHours();
        });
        durationInput?.addEventListener('input', () => {
            if (durationInput.value && parseInt(durationInput.value, 10) < 0) durationInput.value = '';
            recalculateTotalHours();
        });
        recalculateTotalHours();
        
        const yearInput = modal.querySelector('#annual-plan-year');
        const bodyContainer = modal.querySelector('#annual-plan-body');
        const render = async () => {
            const year = parseInt(yearInput.value, 10) || new Date().getFullYear();
            bodyContainer.innerHTML = this.renderAnnualPlanContent(year);
            this.bindAnnualPlanEvents(modal, year);
        };
        
        modal.querySelector('#annual-plan-prev-year')?.addEventListener('click', () => {
            yearInput.value = (parseInt(yearInput.value, 10) || initialYear) - 1;
            render();
        });
        modal.querySelector('#annual-plan-next-year')?.addEventListener('click', () => {
            yearInput.value = (parseInt(yearInput.value, 10) || initialYear) + 1;
            render();
        });
        yearInput?.addEventListener('change', render);
        
        render();
    },
    
    renderAnnualPlanContent(year) {
        const plan = this.getAnnualPlan(year, { createIfMissing: this.isCurrentUserAdmin() });
        if (!plan) {
            return `
                <div class="border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
                    لم يتم إنشاء خطة تدريبية للسنة ${year} بعد.
                    ${this.isCurrentUserAdmin() ? '<div class="mt-3"><button class="btn-primary" id="create-annual-plan-btn"><i class="fas fa-plus ml-2"></i>إنشاء الخطة التدريبية للسنة</button></div>' : ''}
                </div>
            `;
        }
        
        const stats = this.getAnnualPlanStats(plan);
        
        return `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex flex-wrap gap-4 items-center justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-blue-900">سنة الخطة: ${year}</h3>
                        <p class="text-sm text-blue-700">تم إنشاء الخطة بواسطة: ${Utils.escapeHTML(plan.createdBy?.name || 'غير معروف')} في ${Utils.formatDate(plan.createdAt)}</p>
                    </div>
                    ${this.isCurrentUserAdmin() ? `
                        <div>
                            <button class="btn-primary" id="add-annual-plan-item-btn">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة عنصر للخطة
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="content-card h-full">
                    <p class="text-sm text-gray-500">إجمالي العناصر</p>
                    <p class="text-2xl font-bold text-gray-900">${stats.total}</p>
                </div>
                <div class="content-card h-full">
                    <p class="text-sm text-gray-500">برامج مكتملة</p>
                    <p class="text-2xl font-bold text-green-600">${stats.completed}</p>
                </div>
                <div class="content-card h-full">
                    <p class="text-sm text-gray-500">قيد التنفيذ</p>
                    <p class="text-2xl font-bold text-blue-600">${stats.inProgress}</p>
                </div>
                <div class="content-card h-full">
                    <p class="text-sm text-gray-500">مؤجلة</p>
                    <p class="text-2xl font-bold text-yellow-600">${stats.delayed}</p>
                </div>
            </div>
            
            <div class="content-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-clipboard-list ml-2"></i>
                        خطة التدريب التفصيلية (${plan.items.length} بند)
                    </h3>
                </div>
                <div class="card-body">
                    ${plan.items.length ? this.renderAnnualPlanTable(plan, year) : `
                        <div class="text-center text-gray-500 py-8">
                            لا توجد عناصر مسجلة ضمن الخطة الحالية.
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    bindAnnualPlanEvents(modal, year) {
        const plan = this.getAnnualPlan(year, { createIfMissing: false });
        if (!plan) {
            modal.querySelector('#create-annual-plan-btn')?.addEventListener('click', () => {
                this.createAnnualPlan(year);
                modal.querySelector('#annual-plan-body').innerHTML = this.renderAnnualPlanContent(year);
                this.bindAnnualPlanEvents(modal, year);
            });
            return;
        }
        
        if (this.isCurrentUserAdmin()) {
            const rerender = () => {
                modal.querySelector('#annual-plan-body').innerHTML = this.renderAnnualPlanContent(year);
                this.bindAnnualPlanEvents(modal, year);
            };
            modal.querySelector('#add-annual-plan-item-btn')?.addEventListener('click', () => this.openAnnualPlanItemForm(year, null, rerender));
            modal.querySelectorAll('[data-action="delete-plan-item"]').forEach(button => {
                button.addEventListener('click', () => {
                    const itemId = button.getAttribute('data-item-id');
                    this.removeAnnualPlanItem(year, itemId);
                    rerender();
                });
            });
            modal.querySelectorAll('[data-action="edit-plan-item"]').forEach(button => {
                button.addEventListener('click', () => {
                    const itemId = button.getAttribute('data-item-id');
                    this.openAnnualPlanItemForm(year, itemId, rerender);
                });
            });
            modal.querySelectorAll('.plan-status-select').forEach(select => {
                select.addEventListener('change', (event) => {
                    const itemId = select.getAttribute('data-item-id');
                    this.updateAnnualPlanItemStatus(year, itemId, event.target.value);
                });
            });
            modal.querySelectorAll('.plan-training-link').forEach(select => {
                select.addEventListener('change', (event) => {
                    const itemId = select.getAttribute('data-item-id');
                    const trainingId = event.target.value;
                    this.linkTrainingToPlanItem(year, itemId, trainingId);
                    rerender();
                });
            });
        }
    },
    
    renderAnnualPlanTable(plan, year) {
        const trainings = AppState.appData.training || [];
        const trainingOptions = trainings
            .map(training => ({
                id: training.id,
                name: training.name || 'بدون عنوان',
                date: training.startDate || training.date || ''
            }))
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        
        const renderTargets = (item) => {
            const parts = [];
            if (item.targetType === 'employees') {
                parts.push('الموظفون');
            } else if (item.targetType === 'contractors') {
                parts.push('المقاولون');
            } else {
                parts.push('الموظفون والمقاولون');
            }
            if (Array.isArray(item.targetRoles) && item.targetRoles.length) {
                parts.push(`الوظائف: ${item.targetRoles.map(r => Utils.escapeHTML(r)).join(', ')}`);
            }
            if (Array.isArray(item.targetContractors) && item.targetContractors.length) {
                parts.push(`المقاولون: ${item.targetContractors.map(c => Utils.escapeHTML(c)).join(', ')}`);
            }
            return parts.join(' — ');
        };
        
        const statusOptions = ['مخطط', 'قيد التنفيذ', 'مكتمل', 'مؤجل'];
        
        return `
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموضوع</th>
                            <th>التاريخ المخطط</th>
                            <th>الفئة المستهدفة</th>
                            <th>الحالة</th>
                            <th>ربط التدريب</th>
                            <th>ملاحظات</th>
                            ${this.isCurrentUserAdmin() ? '<th>الإجراءات</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${plan.items.sort((a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || '')).map(item => `
                            <tr>
                                <td>
                                    <div class="font-semibold text-gray-900">${Utils.escapeHTML(item.topic || '')}</div>
                                    ${item.requiredTopics && item.requiredTopics.length ? `
                                        <div class="text-xs text-blue-600 mt-1">موضوعات: ${item.requiredTopics.map(topic => Utils.escapeHTML(topic)).join(', ')}</div>
                                    ` : ''}
                                </td>
                                <td>${item.plannedDate ? Utils.formatDate(item.plannedDate) : '—'}</td>
                                <td>${renderTargets(item)}</td>
                                <td>
                                    ${this.isCurrentUserAdmin() ? `
                                        <select class="form-input plan-status-select" data-item-id="${item.id}">
                                            ${statusOptions.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}
                                        </select>
                                    ` : `
                                        <span class="badge ${
                                            item.status === 'مكتمل' ? 'badge-success' :
                                            item.status === 'قيد التنفيذ' ? 'badge-info' :
                                            item.status === 'مؤجل' ? 'badge-warning' : 'badge-secondary'
                                        }">${Utils.escapeHTML(item.status || 'مخطط')}</span>
                                    `}
                                </td>
                                <td>
                                    ${this.isCurrentUserAdmin() ? `
                                        <select class="form-input plan-training-link" data-item-id="${item.id}">
                                            <option value="">—</option>
                                            ${trainingOptions.map(option => `
                                                <option value="${option.id}" ${option.id === item.linkedTrainingId ? 'selected' : ''}>
                                                    ${Utils.escapeHTML(option.name)} (${option.date ? Utils.formatDate(option.date) : 'بدون تاريخ'})
                                                </option>
                                            `).join('')}
                                        </select>
                                    ` : `
                                        ${item.linkedTrainingId ? `<span class="text-sm text-blue-600">مرتبط بسجل تدريب</span>` : '<span class="text-xs text-gray-400">غير مرتبط</span>'}
                                    `}
                                </td>
                                <td>${Utils.escapeHTML(item.notes || '')}</td>
                                ${this.isCurrentUserAdmin() ? `
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button class="btn-icon btn-icon-primary" data-action="edit-plan-item" data-item-id="${item.id}" title="تعديل العنصر">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon btn-icon-danger" data-action="delete-plan-item" data-item-id="${item.id}" title="حذف العنصر">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    openAnnualPlanItemForm(year, itemId = null, onSave = null) {
        const plan = this.getAnnualPlan(year, { createIfMissing: true });
        const item = plan.items.find(i => i.id === itemId) || null;
        const positions = this.getUniquePositions();
        // ✅ تم التحديث: استخدام ApprovedContractors فقط
        const contractors = (typeof Contractors !== 'undefined' && typeof Contractors.getAllContractorsForModules === 'function')
            ? Contractors.getAllContractorsForModules().map(contractor => contractor.name || contractor.companyName).filter(Boolean)
            : (AppState.appData.approvedContractors || []).map(contractor => contractor.companyName || contractor.name).filter(Boolean);
        const topics = this.getAllTrainingTopics();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-calendar-plus ml-2"></i>
                        ${item ? 'تعديل عنصر الخطة' : 'إضافة عنصر جديد للخطة'}
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="annual-plan-item-form">
                    <div class="modal-body space-y-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="plan-item-topic" class="block text-sm font-semibold text-gray-700 mb-2">الموضوع التدريبي *</label>
                                <input type="text" id="plan-item-topic" class="form-input" required value="${Utils.escapeHTML(item?.topic || '')}" placeholder="عنوان البرنامج التدريبي">
                            </div>
                            <div>
                                <label for="plan-item-date" class="block text-sm font-semibold text-gray-700 mb-2">التاريخ المخطط *</label>
                                <input type="date" id="plan-item-date" class="form-input" required value="${item?.plannedDate ? new Date(item.plannedDate).toISOString().slice(0, 10) : ''}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label for="plan-item-target-type" class="block text-sm font-semibold text-gray-700 mb-2">الفئة المستهدفة *</label>
                                <select id="plan-item-target-type" class="form-input" required>
                                    <option value="employees" ${item?.targetType === 'employees' ? 'selected' : ''}>الموظفون</option>
                                    <option value="contractors" ${item?.targetType === 'contractors' ? 'selected' : ''}>المقاولون</option>
                                    <option value="mixed" ${item?.targetType === 'mixed' ? 'selected' : ''}>الكل</option>
                                </select>
                            </div>
                            <div>
                                <label for="plan-item-status" class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                                <select id="plan-item-status" class="form-input">
                                    <option value="مخطط" ${item?.status === 'مخطط' ? 'selected' : ''}>مخطط</option>
                                    <option value="قيد التنفيذ" ${item?.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
                                    <option value="مكتمل" ${item?.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                    <option value="مؤجل" ${item?.status === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                                </select>
                            </div>
                            <div>
                                <label for="plan-item-year" class="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
                                <input type="text" id="plan-item-year" class="form-input" value="${year}" disabled>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="plan-item-roles" class="block text-sm font-semibold text-gray-700 mb-2">الوظائف المستهدفة</label>
                                <select id="plan-item-roles" class="form-input" multiple size="5">
                                    ${positions.map(position => `
                                        <option value="${Utils.escapeHTML(position)}" ${item?.targetRoles?.includes(position) ? 'selected' : ''}>${Utils.escapeHTML(position)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="plan-item-contractors" class="block text-sm font-semibold text-gray-700 mb-2">المقاولون المستهدفون</label>
                                <select id="plan-item-contractors" class="form-input" multiple size="5">
                                    ${contractors.map(name => `
                                        <option value="${Utils.escapeHTML(name)}" ${item?.targetContractors?.includes(name) ? 'selected' : ''}>${Utils.escapeHTML(name)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label for="plan-item-topics" class="block text-sm font-semibold text-gray-700 mb-2">الموضوعات المرتبطة (اختياري)</label>
                            <select id="plan-item-topics" class="form-input" multiple size="5">
                                ${topics.map(topic => `
                                    <option value="${Utils.escapeHTML(topic)}" ${item?.requiredTopics?.includes(topic) ? 'selected' : ''}>${Utils.escapeHTML(topic)}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label for="plan-item-notes" class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                            <textarea id="plan-item-notes" class="form-input" rows="3" placeholder="تفاصيل إضافية أو أهداف البرنامج">${Utils.escapeHTML(item?.notes || '')}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            ${item ? 'حفظ التعديلات' : 'إضافة للخطة'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });
        
        modal.querySelector('#annual-plan-item-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const topic = modal.querySelector('#plan-item-topic')?.value.trim();
            const plannedDate = modal.querySelector('#plan-item-date')?.value;
            const targetType = modal.querySelector('#plan-item-target-type')?.value || 'employees';
            const status = modal.querySelector('#plan-item-status')?.value || 'مخطط';
            const targetRoles = this.getSelectedOptionsFromElement(modal.querySelector('#plan-item-roles'));
            const targetContractors = this.getSelectedOptionsFromElement(modal.querySelector('#plan-item-contractors'));
            const requiredTopics = this.getSelectedOptionsFromElement(modal.querySelector('#plan-item-topics'));
            const notes = modal.querySelector('#plan-item-notes')?.value.trim();
            
            if (!topic || !plannedDate) {
                Notification.warning('يرجى إدخال الموضوع والتاريخ المخطط');
                return;
            }
            
            const entry = {
                id: item?.id || Utils.generateId('PLANITEM'),
                topic,
                plannedDate: new Date(plannedDate).toISOString(),
                targetType,
                status,
                targetRoles,
                targetContractors,
                requiredTopics,
                notes,
                linkedTrainingId: item?.linkedTrainingId || '',
                createdAt: item?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.upsertAnnualPlanItem(year, entry);
            Notification.success(item ? 'تم تحديث العنصر بنجاح' : 'تم إضافة العنصر إلى الخطة');
            close();
            if (typeof onSave === 'function') {
                onSave();
            }
        });
    },
    
    isCurrentUserAdmin() {
        return this.isCurrentUserEffectiveAdmin();
    },
    
    getAnnualPlan(year, { createIfMissing = false } = {}) {
        this.ensureData();
        if (!Array.isArray(AppState.appData.annualTrainingPlans)) {
            AppState.appData.annualTrainingPlans = [];
        }
        let plan = AppState.appData.annualTrainingPlans.find(p => p.year === year);
        if (!plan && createIfMissing && this.isCurrentUserAdmin()) {
            plan = this.createAnnualPlan(year);
        }
        return plan || null;
    },
    
    createAnnualPlan(year) {
        const plan = {
            id: `PLAN-${year}`,
            year,
            createdBy: {
                id: AppState.currentUser?.id || '',
                name: AppState.currentUser?.name || AppState.currentUser?.displayName || AppState.currentUser?.email || 'مسؤول النظام',
                email: AppState.currentUser?.email || ''
            },
            createdAt: new Date().toISOString(),
            items: []
        };
        AppState.appData.annualTrainingPlans.push(plan);
        const dm = (typeof window !== 'undefined' && window.DataManager) || 
                   (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }
        Notification.success(`تم إنشاء الخطة التدريبية للسنة ${year}`);
        return plan;
    },
    
    upsertAnnualPlanItem(year, entry) {
        const plan = this.getAnnualPlan(year, { createIfMissing: true });
        const index = plan.items.findIndex(i => i.id === entry.id);
        if (index >= 0) {
            plan.items[index] = entry;
        } else {
            plan.items.push(entry);
        }
        plan.updatedAt = new Date().toISOString();
        const dm = (typeof window !== 'undefined' && window.DataManager) || 
                   (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }
    },
    
    getAnnualPlanStats(plan) {
        const stats = {
            total: plan.items.length,
            completed: plan.items.filter(item => item.status === 'مكتمل').length,
            inProgress: plan.items.filter(item => item.status === 'قيد التنفيذ').length,
            delayed: plan.items.filter(item => item.status === 'مؤجل').length
        };
        return stats;
    },
    
    updateAnnualPlanItemStatus(year, itemId, status) {
        const plan = this.getAnnualPlan(year, { createIfMissing: false });
        if (!plan) return;
        const item = plan.items.find(i => i.id === itemId);
        if (!item) return;
        item.status = status;
        item.updatedAt = new Date().toISOString();
        const dm = (typeof window !== 'undefined' && window.DataManager) || 
                   (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }
        Notification.success('تم تحديث حالة العنصر');
    },
    
    linkTrainingToPlanItem(year, itemId, trainingId) {
        const plan = this.getAnnualPlan(year, { createIfMissing: false });
        if (!plan) return;
        const item = plan.items.find(i => i.id === itemId);
        if (!item) return;
        item.linkedTrainingId = trainingId || '';
        if (trainingId) {
            item.status = 'مكتمل';
        }
        item.updatedAt = new Date().toISOString();
        const dm = (typeof window !== 'undefined' && window.DataManager) || 
                   (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }
        Notification.success('تم تحديث ربط العنصر بسجل التدريب');
    },
    
    removeAnnualPlanItem(year, itemId) {
        const plan = this.getAnnualPlan(year, { createIfMissing: false });
        if (!plan) return;
        plan.items = plan.items.filter(item => item.id !== itemId);
        plan.updatedAt = new Date().toISOString();
        const dm = (typeof window !== 'undefined' && window.DataManager) || 
                   (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }
        Notification.success('تم حذف عنصر الخطة التدريبية');
    },
    */

    /**
     * الحصول على قائمة الوحدات المتاحة للمستخدم الحالي
     */
    getAccessibleModules(includeDefault = false) {
        const user = AppState.currentUser;
        if (!user) return [];
        if (this.isAdminRole(user.role)) return ['*'];

        // لا يتم إضافة dashboard تلقائياً - يجب منح الصلاحية صراحةً من قبل المدير
        const modules = new Set();
        const effectivePermissions = this.getEffectivePermissions(user);

        // إضافة فقط الصلاحيات الممنوحة صراحةً من قبل مدير النظام
        Object.entries(effectivePermissions).forEach(([module, allowed]) => {
            if (allowed === true) {
                modules.add(module);
            }
        });

        // لا يتم استخدام الصلاحيات الافتراضية - يجب منحها من قبل المدير فقط
        // (تم الاحتفاظ بالمعامل includeDefault للتوافق مع الكود الحالي، لكنه لا يؤثر)

        return Array.from(modules);
    },

    /**
     * إخفاء/إظهار عناصر القائمة حسب الصلاحيات
     */
    updateNavigation() {
        // ✅ إصلاح: التأكد من وجود المستخدم الحالي
        if (!AppState.currentUser) {
            Utils.safeWarn('⚠️ لا يوجد مستخدم مسجل دخول - لا يمكن تحديث القائمة');
            return;
        }

        if (typeof Utils !== 'undefined' && typeof Utils.canonicalizeUserRole === 'function') {
            AppState.currentUser.role = Utils.canonicalizeUserRole(AppState.currentUser.role);
        }

        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length === 0) {
            // إذا لم تكن عناصر القائمة موجودة بعد، نعيد المحاولة بعد قليل
            setTimeout(() => {
                if (document.querySelectorAll('.nav-item').length > 0) {
                    this.updateNavigation();
                }
            }, 500);
            return;
        }

        navItems.forEach(item => {
            const module = item.getAttribute('data-section');
            if (module) {
                const hasAccess = this.hasAccess(module);
                if (!hasAccess) {
                    item.style.display = 'none';
                    item.setAttribute('data-permission-hidden', 'true');
                } else {
                    item.style.display = '';
                    item.setAttribute('data-permission-hidden', 'false');
                }
            }
        });

        // إذا بقي كل شيء مخفياً رغم أن المستخدم مدير — أعد الإظهار (جلسة قديمة أو role غير مطبّع)
        let visibleCount = Array.from(navItems).filter(item => item.style.display !== 'none').length;
        if (visibleCount === 0 && this.isAdminRole(AppState.currentUser.role)) {
            navItems.forEach(item => {
                if (item.getAttribute('data-section')) {
                    item.style.display = '';
                    item.setAttribute('data-permission-hidden', 'false');
                }
            });
            visibleCount = Array.from(navItems).filter(item => item.style.display !== 'none').length;
        }

        // ✅ إصلاح: تسجيل للمساعدة في التشخيص
        if (AppState.debugMode) {
            Utils.safeLog(`✅ تم تحديث القائمة: ${visibleCount} عنصر مرئي من ${navItems.length} عنصر`);
        }
    },

    /**
     * التحقق من الصلاحيات قبل عرض القسم
     * @param {string} moduleName - اسم الموديول
     * @param {boolean} suppressMessage - إذا كان true، لن يتم عرض رسالة الخطأ (مفيد عند العودة للتنقل)
     * @returns {boolean} - true إذا كان لديه صلاحية، false إذا لم يكن لديه صلاحية
     */
    checkBeforeShow(moduleName, suppressMessage = false) {
        if (!this.hasAccess(moduleName)) {
            // التحقق من إذا كان القسم محمي (adminOnly)
            const moduleConfig = MODULE_PERMISSIONS_CONFIG.find(m => m.key === moduleName);
            const isAdminOnly = moduleConfig && moduleConfig.adminOnly;

            const errorMessage = isAdminOnly
                ? 'هذا القسم متاح لمدير النظام فقط'
                : 'ليس لديك صلاحية للوصول إلى هذا القسم';

            // عرض الرسالة فقط إذا لم يكن suppressMessage = true (أي عند محاولة الوصول الفعلية)
            if (!suppressMessage) {
                // محاولة عرض الرسالة عبر Notification.error
                try {
                    if (typeof Notification !== 'undefined' && typeof Notification.error === 'function') {
                        Notification.error(errorMessage);
                    } else {
                        // في حالة عدم توفر Notification، نستخدم console.error و alert كبديل
                        console.error('⚠️ ' + errorMessage);
                        alert(errorMessage);
                    }
                } catch (error) {
                    // في حالة فشل Notification.error، نستخدم console.error و alert كبديل
                    console.error('⚠️ ' + errorMessage);
                    alert(errorMessage);
                }
            }

            return false;
        }
        return true;
    },

    /**
     * الحصول على تسمية دور المستخدم بالعربية
     */
    getRoleLabel(role) {
        const labels = {
            'admin': 'مدير النظام',
            'safety_officer': 'مسئول السلامة',
            'user': 'مستخدم'
        };
        return labels[role] || role;
    },

    /**
     * التحقق من أن المستخدم الحالي هو مدير النظام
     */
    isAdmin() {
        return this.isCurrentUserEffectiveAdmin();
    }
};

// ===== Global State =====
const DEFAULT_COMPANY_NAME = '';

const AppState = {
    /** إصدار التطبيق — تسلسلي: 1.0.0 → 1.0.1 → 1.0.2 … عند كل نشر زِد الرقم هنا وفي version.json */
    appVersion: '1.0.5',
    /** نص اختياري لرسالة التحديث (ملخص التغييرات). إن تُركت فارغة يُستخدم النص الافتراضي. */
    updateMessage: '',
    debugMode: false,
    /** عند true: الخلفية الأساسية Supabase (hse-api)؛ منطق الواجهة لا يشترط تفعيل Google Sheets في الإعدادات */
    useSupabaseBackend: false,
    currentUser: null,
    currentSection: 'dashboard',
    currentLanguage: 'ar',
    navigationHistory: [], // سجل التنقل بين الصفحات
    isPageRefresh: false, // علامة للكشف عن إعادة تحميل الصفحة
    isNavigatingBack: false, // علامة للكشف عن التنقل للخلف
    runningWithoutBackend: false, // true عند فتح الملف محلياً (file://) بدون نشر
    _noBackendWarningLogged: false, // لتسجيل رسالة "بدون خادم" مرة واحدة فقط
    appData: {
        users: [],
        incidents: [],
        nearmiss: [],
        ptw: [],
        ptwRegistry: [],
        training: [],
        clinicVisits: [],
        medications: [],
        sickLeave: [],
        injuries: [],
        clinicInventory: [],
        fireEquipment: [],
        fireEquipmentAssets: [],
        fireEquipmentInspections: [],
        periodicInspectionCategories: [],
        periodicInspectionRecords: [],
        periodicInspectionSchedules: [],
        periodicInspectionChecklists: [],
        ppe: [],
        violations: [],
        violationTypes: [],
        contractors: [],
        approvedContractors: [],
        contractorEvaluations: [],
        contractorEvaluationCriteria: [],
        contractorApprovalRequests: [],
        employees: [],
        behaviorMonitoring: [],
        chemicalSafety: [],
        dailyObservations: [],
        observationSites: [],
        isoDocuments: [],
        isoProcedures: [],
        isoForms: [],
        emergencyAlerts: [],
        emergencyPlans: [],
        emergencyPlansUpdates: [],
        riskAssessments: [],
        sopJHA: [],
        legalDocuments: [], // المستندات القانونية والتشريعية
        legalInventory: [], // سجل حصر التشريعات والقوانين
        hseAudits: [], // عمليات التدقيق والمراجعة
        hseNonConformities: [], // عدم المطابقة
        hseCorrectiveActions: [], // الإجراءات التصحيحية
        hseObjectives: [], // أهدا HSE
        hseRiskAssessments: [], // تقييمات المخاطر HSE
        environmentalAspects: [], // الجوانب البيئية
        environmentalMonitoring: [], // المراقبة البيئية
        sustainability: [], // الاستدامة البيئية
        carbonFootprint: [], // البصمة الكربونية
        wasteManagement: [], // إدارة النايات
        energyEfficiency: [], // كاءة الطاقة
        waterManagement: [], // إدارة المياه
        recyclingPrograms: [], // برامج إعادة التدوير
        safetyTeamMembers: [], // أعضاء فريق السلامة
        safetyOrganizationalStructure: [], // الهيكل الوظيفي لفريق السلامة
        safetyJobDescriptions: [], // الوصف الوظيفي لفريق السلامة
        safetyTeamKPIs: [], // مؤشرات أداء فريق السلامة
        safetyTeamAttendance: [], // حضور فريق السلامة
        safetyTeamLeaves: [], // إجازات فريق السلامة
        safetyTeamTasks: [], // مهام فريق السلامة
        safetyPerformanceKPIs: [], // مؤشرات الأداء للسلامة
        employeeTrainingMatrix: {}, // مصفوفة التدريب لكل موظف
        trainingTopicsByRole: {}, // موضوعات التدريب المطلوبة حسب الوظيفة
        annualTrainingPlans: [], // الخطط التدريبية السنوية
        employeePPEMatrix: {}, // مصوة مهمات الوقاية لكل موظف حسب الوظيفة
        employeePPEMatrixByCode: {}, // مصفوفة مهمات الوقاية لكل موظف مرتبطة بالكود الوظيي
        actionTrackingRegister: [], // سجل متابعة الإجراءات
        safetyBudgets: [], // تعريفات الميزانية المعتمدة
        safetyBudgetTransactions: [], // عمليات الصرف ومتابعة الإنفاق
        workflows: [], // سير العمل والموافقات
        incidentWorkflows: [], // تدفقات عمل الحوادث
        auditLog: [], // سجل عمليات النظام (Audit Log)
        user_activity_log: [], // سجل حركات المستخدمين (User Activity Log)
        systemStatistics: {
            totalLogins: 0 // إجمالي عدد تسجيلات الدخول للنظام
        }
    },
    syncMeta: {
        users: 0,
        // ✅ إضافة: تتبع حالة تحميل كل ورقة
        sheets: {}, // { sheetName: timestamp }
        lastSyncTime: 0, // آخر مرة تم فيها التحميل الكامل
        userEmail: null // البريد الإلكتروني للمستخدم الحالي
    },
    /** إعدادات RPC للخادم الخلفي (الاسم التاريخي googleConfig — يُستخدم مع Supabase Edge / hse-api) */
    googleConfig: {
        appsScript: {
            enabled: true,
            scriptUrl: 'https://script.google.com/macros/s/AKfycbx2dCdy7o7cOUSJCiA05OEyOYB5e5e79DgV5WKVqv8fhmOnNKQjZrvI9j8jxFXtT16m/exec'
        },
        sheets: {
            enabled: true,
            spreadsheetId: '1EanavJ2OodOmq8b1GagSj8baa-KF-o4mVme_Jlwmgxc',
            apiKey: ''
        },
        maps: {
            enabled: false,
            apiKey: ''
        }
    },
    cloudStorageConfig: {
        onedrive: {
            enabled: false,
            clientId: '',
            clientSecret: '',
            accessToken: '',
            refreshToken: '',
            tokenExpiry: null,
            tenantId: '' // للمؤسسات
        },
        googleDrive: {
            enabled: false,
            clientId: '',
            clientSecret: '',
            accessToken: '',
            refreshToken: '',
            tokenExpiry: null,
            apiKey: ''
        },
        sharepoint: {
            enabled: false,
            clientId: '',
            clientSecret: '',
            accessToken: '',
            refreshToken: '',
            tokenExpiry: null,
            siteUrl: '',
            tenantId: ''
        }
    },
    companyLogo: '',
    companySettings: {
        name: DEFAULT_COMPANY_NAME,
        secondaryName: '',
        address: '',
        phone: '',
        email: '',
        approvalCircuits: {},
        formDepartments: [],
        safetyTeam: []
    },
    dateFormat: 'gregorian', // 'gregorian' or 'hijri'
    notificationEmails: [], // قائمة الإيميلات للإشعارات
    emergencyChannels: ['SMS', 'Email', 'الاتصال الداخلي', 'الإذاعة الداخلية'],
    emergencyTeams: ['فريق الإخلاء', 'فريق مكافحة الحريق', 'فريق الإسعافات الأولية', 'فريق الأمن'],
    legalPortalUrl: '', // رابط بوابة التشريعات
    legalKeywords: [], // كلمات مفتاحية للمتابعة القانونية
    legalAutoNotify: false // تفعيل التنبيهات التلقائية للتحديثات القانونية
};

(function applySupabaseBackendFlag() {
    try {
        if (typeof window !== 'undefined' && window.__HSE_USE_SUPABASE__ === true) {
            AppState.useSupabaseBackend = true;
        } else if (typeof window !== 'undefined' && /safety-icapp\.com$/i.test(String(window.location.hostname || ''))) {
            AppState.useSupabaseBackend = true;
        }
        const rpc = typeof window !== 'undefined' && window.__HSE_RPC_URL__
            ? String(window.__HSE_RPC_URL__).trim()
            : '';
        if (rpc && AppState.googleConfig && AppState.googleConfig.appsScript) {
            AppState.googleConfig.appsScript.scriptUrl = rpc;
            AppState.googleConfig.appsScript.enabled = true;
        }
        /** دمج إعدادات الاتصال من localStorage قبل أي وحدة أخرى — يمنع hasCloudBackendSync=false وواجهة «ميتة» بعد تفريغ الافتراضيات */
        try {
            if (typeof localStorage !== 'undefined' && AppState.googleConfig) {
                const raw = localStorage.getItem('hse_google_config');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        if (parsed.appsScript && typeof parsed.appsScript === 'object') {
                            const currentApps = AppState.googleConfig.appsScript || {};
                            const parsedApps = parsed.appsScript || {};
                            const parsedUrl = String(parsedApps.scriptUrl || '').trim();
                            AppState.googleConfig.appsScript = {
                                ...currentApps,
                                ...parsedApps,
                                // لا نسمح لقيمة فارغة من localStorage بإلغاء URL افتراضي صالح
                                scriptUrl: parsedUrl || String(currentApps.scriptUrl || '').trim(),
                                // إذا كان URL صالحًا اعتبر التفعيل true حتى لا تتعطل المزامنة تلقائيًا
                                enabled: parsedUrl ? true : !!(parsedApps.enabled ?? currentApps.enabled)
                            };
                        }
                        if (parsed.sheets && typeof parsed.sheets === 'object') {
                            const currentSheets = AppState.googleConfig.sheets || {};
                            const parsedSheets = parsed.sheets || {};
                            const parsedSheetId = String(parsedSheets.spreadsheetId || '').trim();
                            AppState.googleConfig.sheets = {
                                ...currentSheets,
                                ...parsedSheets,
                                spreadsheetId: parsedSheetId || String(currentSheets.spreadsheetId || '').trim(),
                                enabled: parsedSheetId ? true : !!(parsedSheets.enabled ?? currentSheets.enabled)
                            };
                        }
                        if (parsed.maps && typeof parsed.maps === 'object') {
                            AppState.googleConfig.maps = {
                                ...AppState.googleConfig.maps,
                                ...parsed.maps
                            };
                        }
                    }
                }
            }
        } catch (mergeErr) { /* تجاهل تالف hse_google_config */ }
    } catch (e) { /* ignore */ }
})();

// ===== Utility Functions =====
const Utils = {
    /**
     * تطبيع حقل الدور للجلسة (admin صريح لكل أشكال المدير المعروفة في الجدول)
     */
    canonicalizeUserRole(role) {
        const r = role == null || role === '' ? 'user' : String(role).trim();
        if (typeof Permissions !== 'undefined' && typeof Permissions.isAdminRole === 'function' && Permissions.isAdminRole(r)) {
            return 'admin';
        }
        return r || 'user';
    },

    /** هل الخلفية الحالية مضبوطة على Supabase */
    isSupabaseBackend() {
        return !!(typeof AppState !== 'undefined' && AppState.useSupabaseBackend === true);
    },

    /**
     * هل يوجد مسار سحابي للمزامنة (وضع Supabase، أو تفعيل + رابط RPC)
     * مع Supabase: true حتى لا تُجمّد الواجهة إن تأخر ضبط الرابط؛ الطبقات السفلى ترفض الطلب بدون scriptUrl.
     */
    hasCloudBackendSync() {
        const gc = typeof AppState !== 'undefined' ? AppState.googleConfig : null;
        if (!gc || !gc.appsScript) return false;
        const url = String(gc.appsScript.scriptUrl || '').trim();
        if (this.isSupabaseBackend()) return true;
        return !!(gc.appsScript.enabled && url);
    },

    /**
     * التحقق من بيئة الإنتاج
     */
    isProduction() {
        if (typeof window === 'undefined') return true;
        const hostname = window.location.hostname;
        return hostname !== 'localhost' &&
            !hostname.includes('127.0.0.1') &&
            !hostname.includes('192.168.') &&
            !hostname.includes('10.') &&
            hostname !== '';
    },

    /**
     * تسجيل آمن - لا يسجل في الإنتاج
     */
    safeLog(...args) {
        if (!Utils.isProduction()) {
            console.log(...args);
        }
    },

    /**
     * تسجيل أخطاء آمن - لا يسجل معلومات حساسة في الإنتاج
     */
    safeError(...args) {
        // تجاهل أخطاء Chrome extensions و source maps
        if (args.length > 0) {
            // جمع جميع النصوص من جميع المعاملات للتحقق الشامل
            let allArgsText = '';
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (typeof arg === 'string') {
                    allArgsText += arg + ' ';
                } else if (arg && typeof arg === 'object') {
                    // التحقق من message و stack و toString
                    if (arg.message) allArgsText += String(arg.message) + ' ';
                    if (arg.stack) allArgsText += String(arg.stack) + ' ';
                    if (arg.toString) allArgsText += String(arg.toString()) + ' ';
                }
            }
            allArgsText = allArgsText.toLowerCase();

            const firstArg = args[0];
            const firstArgStr = String(firstArg || '').toLowerCase();

            // قائمة الأخطاء التي يجب تجاهلها
            const shouldIgnore =
                firstArgStr.includes('runtime.lasterror') ||
                firstArgStr.includes('message port closed') ||
                firstArgStr.includes('receiving end does not exist') ||
                firstArgStr.includes('could not establish connection') ||
                firstArgStr.includes('.map') ||
                firstArgStr.includes('sourcemap') ||
                firstArgStr.includes('content security policy') ||
                firstArgStr.includes('frame-ancestors') ||
                firstArgStr.includes('translator') ||
                firstArgStr.includes('uploadmanager') ||
                firstArgStr.includes('upload-manager') ||
                (firstArgStr.includes('cannot read properties of undefined') && firstArgStr.includes('document')) ||
                allArgsText.includes('uploadmanager') ||
                allArgsText.includes('upload-manager') ||
                (allArgsText.includes('cannot read properties of undefined') && allArgsText.includes('document')) ||
                allArgsText.includes('uploadmanager.js') ||
                firstArgStr.includes('معرف google sheets غير محدد') ||
                firstArgStr.includes('google sheets id') ||
                firstArgStr.includes('spreadsheet id') ||
                firstArgStr.includes('sendrequest (savetosheet)') ||
                firstArgStr.includes('sendrequest (appendtosheet)') ||
                firstArgStr.includes('sendrequest (readfromsheet)') ||
                firstArgStr.includes('sendrequest (batchreadsheets)') ||
                firstArgStr.includes('❌ فشل batch') ||
                (firstArgStr.includes('خطأ في الوصول إلى الكاميرا') && (allArgsText.includes('notallowederror') || allArgsText.includes('permission denied'))) ||
                (firstArgStr.includes('خطأ في الوصول إلى الكاميرا') && allArgsText.includes('permissions policy violation'));

            if (typeof firstArg === 'string' && shouldIgnore) {
                return; // تجاهل هذه الأخطاء
            }

            if (firstArg && typeof firstArg === 'object') {
                const msg = String(firstArg.message || firstArg.toString() || '').toLowerCase();
                const stack = String(firstArg.stack || '').toLowerCase();
                const combined = msg + ' ' + stack;

                if (combined.includes('runtime.lasterror') ||
                    combined.includes('message port closed') ||
                    combined.includes('receiving end does not exist') ||
                    combined.includes('could not establish connection') ||
                    combined.includes('.map') ||
                    combined.includes('sourcemap') ||
                    combined.includes('frame-ancestors') ||
                    combined.includes('translator') ||
                    combined.includes('uploadmanager') ||
                    combined.includes('upload-manager') ||
                    (combined.includes('cannot read properties of undefined') && combined.includes('document')) ||
                    combined.includes('uploadmanager.js') ||
                    combined.includes('معرف google sheets غير محدد') ||
                    combined.includes('google sheets id') ||
                    combined.includes('spreadsheet id')) {
                    return; // تجاهل هذه الأخطاء
                }
            }
        }

        // فحص إضافي شامل قبل السجل - للتحقق من جميع المعاملات
        let allText = '';
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (typeof arg === 'string') {
                allText += arg + ' ';
            } else if (arg && typeof arg === 'object') {
                if (arg.message) allText += String(arg.message) + ' ';
                if (arg.stack) allText += String(arg.stack) + ' ';
                if (arg.toString) allText += String(arg.toString()) + ' ';
            }
        }
        allText = allText.toLowerCase();

        // تجاهل أخطاء uploadmanager و document errors
        if (allText.includes('uploadmanager') ||
            allText.includes('upload-manager') ||
            allText.includes('uploadmanager.js') ||
            (allText.includes('cannot read properties of undefined') && allText.includes('document'))) {
            return; // تجاهل هذه الأخطاء تماماً
        }

        // تجاهل أخطاء "Failed to fetch" المتعلقة بـ Google Sheets عندما تكون غير مفعّلة
        if (allText.includes('خطأ في طلب google sheets') &&
            (allText.includes('failed to fetch') || allText.includes('networkerror'))) {
            // التحقق من حالة Google Sheets
            const isGoogleAppsScriptEnabled = window.AppState?.googleConfig?.appsScript?.enabled &&
                window.AppState?.googleConfig?.appsScript?.scriptUrl;
            if (!isGoogleAppsScriptEnabled) {
                return; // تجاهل الخطأ إذا كانت Google Sheets غير مفعّلة
            }
        }

        // تجاهل أخطاء الكاميرا المتعلقة بالصلاحيات
        if (allText.includes('خطأ في الوصول إلى الكاميرا') &&
            (allText.includes('notallowederror') ||
                allText.includes('permission denied') ||
                allText.includes('permissions policy violation'))) {
            return; // تجاهل أخطاء صلاحيات الكاميرا
        }

        if (!Utils.isProduction()) {
            console.error(...args);
        } else {
            // في الإنتاج، نسجل فقط رسائل عامة بدون تفاصيل
            const safeArgs = args.map(arg => {
                if (typeof arg === 'string') {
                    // إزالة أي معلومات حساسة محتملة
                    return arg.replace(/password|token|key|secret|hash/gi, '[REDACTED]');
                }
                if (arg && typeof arg === 'object') {
                    // محاولة استخراج معلومات مفيدة من الكائن
                    if (arg instanceof Error) {
                        return {
                            name: arg.name,
                            message: String(arg.message || '').replace(/password|token|key|secret|hash/gi, '[REDACTED]'),
                            stack: arg.stack ? String(arg.stack).split('\n').slice(0, 3).join('\n') : undefined
                        };
                    }
                    if (arg.message) {
                        return {
                            message: String(arg.message).replace(/password|token|key|secret|hash/gi, '[REDACTED]'),
                            ...(arg.code ? { code: arg.code } : {}),
                            ...(arg.status ? { status: arg.status } : {}),
                            ...(arg.statusText ? { statusText: arg.statusText } : {})
                        };
                    }
                    // محاولة تحويل الكائن إلى JSON مع معالجة الأخطاء
                    try {
                        const jsonStr = JSON.stringify(arg, null, 2);
                        if (jsonStr.length > 500) {
                            return JSON.parse(jsonStr.substring(0, 500) + '...');
                        }
                        return JSON.parse(jsonStr);
                    } catch (e) {
                        return String(arg).replace(/password|token|key|secret|hash/gi, '[REDACTED]');
                    }
                }
                return String(arg || '[Object]');
            });
            // تجاهل أخطاء Chrome Extensions - تحقق شامل من جميع المعاملات
            for (let i = 0; i < safeArgs.length; i++) {
                const argStr = String(safeArgs[i] || '').toLowerCase();
                if (argStr.includes('runtime.lasterror') ||
                    argStr.includes('message port closed') ||
                    argStr.includes('receiving end does not exist') ||
                    argStr.includes('could not establish connection') ||
                    argStr.includes('extension context invalidated') ||
                    argStr.includes('the message port closed') ||
                    argStr.includes('uploadmanager') ||
                    argStr.includes('upload-manager') ||
                    argStr.includes('uploadmanager.js') ||
                    (argStr.includes('cannot read properties of undefined') && argStr.includes('document'))) {
                    return; // تجاهل هذه الأخطاء تماماً
                }
                // تحقق من الكائنات أيضاً
                if (safeArgs[i] && typeof safeArgs[i] === 'object') {
                    try {
                        const objStr = JSON.stringify(safeArgs[i]).toLowerCase();
                        if (objStr.includes('runtime.lasterror') ||
                            objStr.includes('message port closed') ||
                            objStr.includes('receiving end does not exist') ||
                            objStr.includes('could not establish connection') ||
                            objStr.includes('uploadmanager') ||
                            objStr.includes('upload-manager') ||
                            objStr.includes('uploadmanager.js') ||
                            (objStr.includes('cannot read properties of undefined') && objStr.includes('document'))) {
                            return; // تجاهل هذه الأخطاء تماماً
                        }
                    } catch (e) {
                        // إذا فشل JSON.stringify، نتحقق من message و stack مباشرة
                        if (safeArgs[i].message) {
                            const msg = String(safeArgs[i].message).toLowerCase();
                            if (msg.includes('uploadmanager') ||
                                msg.includes('upload-manager') ||
                                (msg.includes('cannot read properties of undefined') && msg.includes('document')) ||
                                (msg.includes('htmlstyleelement') && msg.includes('document'))) {
                                return;
                            }
                        }
                        if (safeArgs[i].stack) {
                            const stack = String(safeArgs[i].stack).toLowerCase();
                            if (stack.includes('uploadmanager') ||
                                stack.includes('upload-manager') ||
                                stack.includes('uploadmanager.js') ||
                                (stack.includes('htmlstyleelement') && stack.includes('document'))) {
                                return;
                            }
                        }
                    }
                }
            }
            console.error(...safeArgs);
        }
    },

    /**
     * إنشاء Promise مع timeout مع تنظيف الـ timer لمنع unhandled rejections
     * @param {Promise} promise - الـ Promise الأصلي
     * @param {number} timeoutMs - المهلة بالميلي ثانية
     * @param {string|Error|Function} timeoutError - رسالة/خطأ أو دالة تُرجع Error/Message
     * @returns {Promise}
     */
    promiseWithTimeout(promise, timeoutMs = 10000, timeoutError = 'انتهت مهلة العملية') {
        let timeoutId = null;
        let settled = false;

        const normalizedPromise = Promise.resolve(promise)
            .finally(() => {
                settled = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            });

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                // إذا كان الـ promise الأساسي انتهى، لا نرمي خطأ
                if (settled) return;

                try {
                    const value = (typeof timeoutError === 'function') ? timeoutError() : timeoutError;
                    if (value instanceof Error) {
                        reject(value);
                    } else {
                        let msg = String(value || 'انتهت مهلة العملية');
                        // عدم استخدام HTML كرسالة خطأ (قد يُمرَّر بالخطأ من دوال تعيد محتوى واجهة)
                        if (msg.length > 80 && (msg.includes('<div') || msg.includes('class="') || msg.includes('</p>'))) {
                            msg = 'انتهت مهلة العملية';
                        }
                        reject(new Error(msg));
                    }
                } catch (e) {
                    reject(e instanceof Error ? e : new Error(String(e || 'انتهت مهلة العملية')));
                }
            }, timeoutMs);
        });

        return Promise.race([normalizedPromise, timeoutPromise]);
    },

    /**
     * تسجيل تحذيرات آمن
     */
    safeWarn(...args) {
        // تجاهل التحذيرات المتعلقة بـ Google Sheets و Chrome Extensions
        if (args.length > 0) {
            const argsStr = args.map(arg => String(arg || '')).join(' ');
            if (argsStr.includes('runtime.lastError') ||
                argsStr.includes('message port closed') ||
                argsStr.includes('translator') ||
                argsStr.includes('معرف Google Sheets غير محدد') ||
                argsStr.includes('Google Sheets ID') ||
                argsStr.includes('Spreadsheet ID') ||
                argsStr.includes('sendRequest (saveToSheet)') ||
                argsStr.includes('sendRequest (appendToSheet)') ||
                argsStr.includes('sendRequest (readFromSheet)') ||
                argsStr.includes('معرف Google Sheets غير معرف')) {
                return; // تجاهل هذه التحذيرات
            }

            // عند الفتح بدون نشر (file://) أو عند أول timeout: رسالة واحدة بدلاً من عشرات التحذيرات
            const isNoBackendWarning = (
                argsStr.includes('فشل التحميل ولا توجد بيانات محلية احتياطية') ||
                (argsStr.includes('يحتوي على') && argsStr.includes('ورقة فارغة')) ||
                argsStr.includes('انتهت مهلة الاتصال بالخادم') ||
                argsStr.includes('انتهت مهلة انتظار تحميل البيانات') ||
                argsStr.includes('Timeout: تحميل البيانات') ||
                argsStr.includes('خطأ في الاتصال بـ Backend') ||
                argsStr.includes('انتهت مهلة الاتصال للخادم')
            );
            if (isNoBackendWarning && typeof AppState !== 'undefined') {
                AppState.runningWithoutBackend = true;
                if (!AppState._noBackendWarningLogged) {
                    AppState._noBackendWarningLogged = true;
                    console.warn('⚠️ التطبيق يعمل بدون نشر (لا اتصال بالخادم). بعض البيانات غير متوفرة.');
                }
                return;
            }

            // تقليل تكرار رسائل Circuit Breaker - تسجيل مرة واحدة كل 30 ثانية
            if (argsStr.includes('Circuit Breaker مفتوح')) {
                const lastLogTime = this._circuitBreakerWarnTime || 0;
                const now = Date.now();
                if (now - lastLogTime < 30000) {
                    return; // تجاهل إذا تم تسجيلها مؤخراً
                }
                this._circuitBreakerWarnTime = now;
            }
        }

        if (!Utils.isProduction()) {
            console.warn(...args);
        }
    },

    /**
     * JSON.stringify آمن يتعامل مع المراجع الدائرية
     */
    safeStringify(obj, space) {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);
            }
            return value;
        }, space);
    },

    /**
     * تنظيف النص لمنع XSS
     */
    escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },

    /**
     * تنقية HTML ديناميكي بشكل محافظ قبل حقنه في DOM
     */
    sanitizeHTML(html) {
        const raw = String(html || '');
        if (!raw) return '';
        const template = document.createElement('template');
        template.innerHTML = raw;

        const blockedTags = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta']);
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach((el) => {
            const tag = String(el.tagName || '').toLowerCase();
            if (blockedTags.has(tag)) {
                el.remove();
                return;
            }
            const attrs = Array.from(el.attributes || []);
            attrs.forEach((attr) => {
                const name = String(attr.name || '').toLowerCase();
                const value = String(attr.value || '');
                if (name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                    return;
                }
                if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        return template.innerHTML;
    },

    /**
     * تعيين innerHTML بعد التنقية
     */
    setSafeHTML(element, html) {
        if (!element) return;
        element.innerHTML = this.sanitizeHTML(html);
    },

    extractImageSourceCandidate(source) {
        if (!source) return '';
        if (typeof source === 'string') return source;
        if (typeof source !== 'object') return '';

        const candidateKeys = [
            'photo',
            'photoUrl',
            'imageUrl',
            'image',
            'personalPhoto',
            'documentImage',
            'directLink',
            'shareableLink',
            'url'
        ];

        for (let i = 0; i < candidateKeys.length; i++) {
            const value = source[candidateKeys[i]];
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }

        return '';
    },

    extractDriveFileId(url) {
        try {
            const raw = String(url || '').trim();
            if (!raw) return '';
            if (typeof window !== 'undefined' && typeof window.__extractDriveFileId === 'function') {
                return String(window.__extractDriveFileId(raw) || '').trim();
            }
            const match = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/i)
                || raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)
                || raw.match(/\/d\/([a-zA-Z0-9_-]+)/i)
                || raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/i)
                || raw.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/i);
            return match ? String(match[1] || '').trim() : '';
        } catch (e) {
            return '';
        }
    },

    normalizeGoogleDriveImageUrl(url) {
        const raw = String(url || '').trim().replace(/^['"`]+|['"`]+$/g, '');
        if (!raw) return '';

        if (typeof window !== 'undefined' && typeof window.__convertGoogleDriveUrl === 'function') {
            const converted = window.__convertGoogleDriveUrl(raw);
            if (converted && typeof converted === 'string') {
                return converted.trim();
            }
        }

        const fileId = this.extractDriveFileId(raw);
        if (!fileId) {
            return raw;
        }

        if (typeof window !== 'undefined' && typeof window.__googleDrivePreviewUrlFromId === 'function') {
            return window.__googleDrivePreviewUrlFromId(fileId);
        }

        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    },

    normalizeImageSource(source) {
        const rawSource = this.extractImageSourceCandidate(source);
        if (!rawSource) return '';

        let trimmed = String(rawSource).trim().replace(/^['"`]+|['"`]+$/g, '');
        if (!trimmed) return '';

        if (trimmed.startsWith('blob:')) {
            return trimmed;
        }

        if (/^data:image\//i.test(trimmed)) {
            const commaIndex = trimmed.indexOf(',');
            if (commaIndex === -1) {
                return trimmed.replace(/\s+/g, '');
            }

            const header = trimmed.slice(0, commaIndex).replace(/\s+/g, '');
            const payload = trimmed.slice(commaIndex + 1).replace(/\s+/g, '');
            return payload ? `${header},${payload}` : '';
        }

        if (/^https?:\/\//i.test(trimmed)) {
            if (/drive\.google\.com|googleusercontent\.com/i.test(trimmed)) {
                return this.normalizeGoogleDriveImageUrl(trimmed);
            }
            return trimmed;
        }

        const compactBase64 = trimmed.replace(/\s+/g, '');
        if (compactBase64.length > 100 && /^[A-Za-z0-9+/=]+$/.test(compactBase64.substring(0, Math.min(120, compactBase64.length)))) {
            return `data:image/jpeg;base64,${compactBase64}`;
        }

        return '';
    },

    /**
     * رابط نشر Apps Script (Web App) إن وُجد في الإعدادات.
     */
    getAppsScriptScriptUrl() {
        try {
            let u = (typeof AppState !== 'undefined' && AppState.googleConfig && AppState.googleConfig.appsScript && AppState.googleConfig.appsScript.scriptUrl)
                ? String(AppState.googleConfig.appsScript.scriptUrl).trim()
                : '';
            // نشر الويب يعمل عادة عبر /exec؛ /dev قد يعيد HTML أو يرفض طلبات getProfileImage
            if (u && u.indexOf('script.google.com/macros/s/') !== -1) {
                u = u.replace(/\/dev(\?|#|$)/, '/exec$1');
            }
            return u;
        } catch (e) {
            return '';
        }
    },

    /**
     * URL لطلب getProfileImage (صورة من Drive كـ JSON يحوي dataUri) — يتجاوز حظر hotlinking لـ Google Drive في وسم img.
     */
    buildGetProfileImageProxyUrl(fileId) {
        const id = String(fileId || '').trim();
        if (!id) return '';
        const scriptUrl = this.getAppsScriptScriptUrl();
        if (!scriptUrl || scriptUrl.indexOf('script.google.com') === -1) return '';
        return scriptUrl + (scriptUrl.indexOf('?') !== -1 ? '&' : '?') + 'action=getProfileImage&id=' + encodeURIComponent(id);
    },

    /**
     * جلب صورة Drive عبر السكربت وإرجاع data URI للعرض في img.
     */
    async fetchDriveImageDataUri(fileId) {
        const url = this.buildGetProfileImageProxyUrl(fileId);
        if (!url) return null;
        try {
            const res = await fetch(url, { method: 'GET', credentials: 'omit' });
            const data = await res.json();
            if (data && data.success && data.dataUri) return String(data.dataUri);
        } catch (e) {
            /* ignore */
        }
        return null;
    },

    /**
     * تعبئة عناصر img التي تحمل data-drive-proxy-id بتحميل الصورة عبر الوكيل.
     * @param {ParentNode|null|undefined} rootEl
     * @param {{ onFetchFail?: (img: HTMLImageElement) => void }} [callbacks]
     */
    hydrateDriveProxyImages(rootEl, callbacks) {
        try {
            const root = rootEl || document;
            if (!root || typeof root.querySelectorAll !== 'function') return;
            const scriptUrl = this.getAppsScriptScriptUrl();
            if (!scriptUrl || scriptUrl.indexOf('script.google.com') === -1) return;

            const imgs = root.querySelectorAll('img[data-drive-proxy-id]');
            if (!imgs || !imgs.length) return;

            const onFetchFail = callbacks && typeof callbacks.onFetchFail === 'function' ? callbacks.onFetchFail : null;

            imgs.forEach((img) => {
                if (!img || img.dataset.driveProxyHydrated === '1') return;
                const id = String(img.getAttribute('data-drive-proxy-id') || '').trim();
                if (!id) return;
                img.dataset.driveProxyHydrated = '1';
                this.fetchDriveImageDataUri(id).then((dataUri) => {
                    if (dataUri) {
                        img.src = dataUri;
                        try {
                            if (img.dataset.photoUrl !== undefined) img.dataset.photoUrl = dataUri;
                        } catch (e2) { /* ignore */ }
                    } else if (onFetchFail) {
                        onFetchFail(img);
                    }
                });
            });
        } catch (e) {
            /* ignore */
        }
    },

    /** صورة شفافة 1×1 تُستخدم كـ src مؤقت قبل جلب صور Drive عبر الوكيل */
    IMG_DRIVE_PLACEHOLDER_GIF: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',

    /**
     * توحيد منطق عرض الصور: روابط Google Drive تُعرض عبر وكيل getProfileImage عند توفر scriptUrl.
     * @param {*} source - نص أو كائن يُمرَّر إلى normalizeImageSource
     * @returns {{ canonical: string, displaySrc: string, proxyFileId: string, needsProxy: boolean }}
     */
    resolveDriveAwareImgDisplay(source) {
        const empty = { canonical: '', displaySrc: '', proxyFileId: '', needsProxy: false };
        try {
            const canonical = this.normalizeImageSource(source);
            if (!canonical) return empty;

            if (/^data:image\//i.test(canonical) || String(canonical).indexOf('blob:') === 0) {
                return { canonical, displaySrc: canonical, proxyFileId: '', needsProxy: false };
            }
            if (!/^https?:\/\//i.test(canonical)) {
                return { canonical, displaySrc: canonical, proxyFileId: '', needsProxy: false };
            }
            if (!/drive\.google\.com|googleusercontent\.com/i.test(canonical)) {
                return { canonical, displaySrc: canonical, proxyFileId: '', needsProxy: false };
            }
            const fileId = this.extractDriveFileId(canonical);
            const scriptUrl = this.getAppsScriptScriptUrl();
            const canProxy = !!(fileId && scriptUrl && scriptUrl.indexOf('script.google.com') !== -1);
            if (canProxy) {
                return {
                    canonical,
                    displaySrc: this.IMG_DRIVE_PLACEHOLDER_GIF,
                    proxyFileId: fileId,
                    needsProxy: true
                };
            }
            return { canonical, displaySrc: canonical, proxyFileId: '', needsProxy: false };
        } catch (e) {
            return empty;
        }
    },

    /**
     * سمات HTML لوسم img عند استخدام وكيل Drive (مع resolveDriveAwareImgDisplay).
     * @param {{ needsProxy?: boolean, proxyFileId?: string }} info
     */
    driveProxyImgAttrs(info) {
        if (!info || !info.needsProxy || !info.proxyFileId) return '';
        return ` data-drive-proxy-id="${this.escapeHTML(String(info.proxyFileId))}"`;
    },

    normalizeContractorIdentityValue(value) {
        if (value === undefined || value === null) return '';
        return String(value)
            .replace(/[\u200e\u200f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    },

    canonicalizeContractorName(value) {
        const normalized = this.normalizeContractorIdentityValue(value);
        if (!normalized) return '';
        return normalized
            .replace(/["'`.,،؛:(){}\[\]<>_\-\/\\|]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    getPreferredContractorLookupKey(contractor, fallbackValue = '') {
        const base = contractor && typeof contractor === 'object' ? contractor : {};
        const candidates = [
            base.code,
            base.isoCode,
            base.contractorCode,
            base.entityCode,
            base.licenseNumber,
            base.contractNumber,
            base.contractorId,
            base.id,
            base.approvedEntityId,
            fallbackValue
        ];
        for (let i = 0; i < candidates.length; i++) {
            const normalized = this.normalizeContractorIdentityValue(candidates[i]);
            if (normalized) {
                return String(candidates[i]).replace(/[\u200e\u200f]/g, '').trim();
            }
        }
        return '';
    },

    sanitizeContractorIdentity(contractor) {
        const base = contractor && typeof contractor === 'object' ? { ...contractor } : {};
        const normalizeValue = (value) => this.normalizeContractorIdentityValue(value);
        const canonicalizeName = (value) => this.canonicalizeContractorName(value);
        const collectCandidateIds = (record) => {
            if (!record || typeof record !== 'object') return [];
            const values = [
                record.id,
                record.contractorId,
                record.code,
                record.isoCode,
                record.contractorCode,
                record.entityCode,
                record.licenseNumber,
                record.contractNumber,
                record.approvedEntityId
            ];
            ['aliasIds', 'identityIds', 'legacyIds', 'altIds'].forEach((field) => {
                if (Array.isArray(record[field])) values.push(...record[field]);
            });
            return Array.from(new Set(values.map(value => String(value == null ? '' : value).replace(/[\u200e\u200f]/g, '').trim()).filter(Boolean)));
        };
        const baseCode = normalizeValue(base.code || base.isoCode || base.contractorCode || base.entityCode);
        const baseName = canonicalizeName(base.companyName || base.name || base.contractorName || base.company || base.contractorCompany);
        const linkedContractors = Array.isArray(AppState?.appData?.contractors) ? AppState.appData.contractors.filter(Boolean) : [];
        const resolveLinkedRecord = (value) => {
            const normalized = normalizeValue(value);
            if (!normalized) return null;
            return linkedContractors.find((record) => {
                return [
                    record?.id,
                    record?.contractorId,
                    record?.code,
                    record?.isoCode,
                    record?.contractorCode,
                    record?.entityCode
                ].some(candidate => normalizeValue(candidate) === normalized);
            }) || null;
        };
        const matchesBaseIdentity = (record) => {
            if (!record || typeof record !== 'object') return false;
            const recordCode = normalizeValue(record.code || record.isoCode || record.contractorCode || record.entityCode);
            if (baseCode && recordCode) {
                return recordCode === baseCode;
            }
            const recordName = canonicalizeName(record.name || record.companyName || record.contractorName || record.company || record.contractorCompany);
            if (baseName && recordName) {
                return recordName === baseName;
            }
            return !(baseCode || baseName);
        };
        const conflictingIds = new Set();
        ['contractorId', 'id'].forEach((field) => {
            const normalized = normalizeValue(base[field]);
            if (!normalized) return;
            const linkedRecord = resolveLinkedRecord(base[field]);
            if (linkedRecord && !matchesBaseIdentity(linkedRecord)) {
                conflictingIds.add(normalized);
            }
        });

        if (conflictingIds.has(normalizeValue(base.contractorId))) {
            delete base.contractorId;
        }

        if (conflictingIds.has(normalizeValue(base.id))) {
            const replacementId = this.getPreferredContractorLookupKey({
                ...base,
                id: '',
                contractorId: ''
            });
            base.id = replacementId || '';
        }

        ['aliasIds', 'identityIds', 'legacyIds', 'altIds'].forEach((field) => {
            if (!Array.isArray(base[field])) return;
            base[field] = base[field].filter(value => !conflictingIds.has(normalizeValue(value)));
        });

        const safeIds = collectCandidateIds(base);
        if (safeIds.length) {
            base.aliasIds = Array.from(new Set([...(Array.isArray(base.aliasIds) ? base.aliasIds : []), ...safeIds]));
        }

        return base;
    },

    buildContractorIdentityMatcher(contractor, contractorIdParam) {
        const base = contractor && typeof contractor === 'object' ? contractor : {};
        const normalizeValue = (value) => this.normalizeContractorIdentityValue(value);
        const canonicalizeName = (value) => this.canonicalizeContractorName(value);
        const baseIdFields = ['id', 'contractorId', 'contractorCode', 'code', 'isoCode', 'licenseNumber', 'contractNumber', 'approvedEntityId', 'entityCode'];
        const recordIdFields = ['contractorId', 'contractorCode', 'code', 'isoCode', 'licenseNumber', 'contractNumber', 'approvedEntityId', 'entityCode'];
        const nameFields = ['contractorName', 'companyName', 'company', 'contractorCompany', 'name', 'externalName', 'contractorWorkerName', 'contractorWorker'];
        const idsSet = new Set();
        const exactNameSet = new Set();
        const canonicalNameSet = new Set();
        const addId = (value) => {
            const normalized = normalizeValue(value);
            if (normalized) idsSet.add(normalized);
        };
        const addIdCollection = (values) => {
            if (!Array.isArray(values)) return;
            values.forEach(addId);
        };
        const addName = (value) => {
            const normalized = normalizeValue(value);
            if (normalized) exactNameSet.add(normalized);
            const canonical = canonicalizeName(value);
            if (canonical) canonicalNameSet.add(canonical);
        };
        const collectRecordIds = (record) => {
            if (!record || typeof record !== 'object') return [];
            return recordIdFields
                .map(field => normalizeValue(record[field]))
                .filter(Boolean);
        };
        const collectRecordNames = (record) => {
            if (!record || typeof record !== 'object') return [];
            const names = [];
            nameFields.forEach(field => {
                const value = record[field];
                if (value === undefined || value === null) return;
                const normalized = String(value).replace(/\s+/g, ' ').trim();
                if (normalized) names.push(normalized);
            });
            return names;
        };
        const collectContractorEntityNames = (record) => {
            if (!record || typeof record !== 'object') return [];
            return ['contractorName', 'companyName', 'company', 'contractorCompany', 'name', 'externalName']
                .map(field => record[field])
                .filter(value => value !== undefined && value !== null)
                .map(value => String(value).replace(/\s+/g, ' ').trim())
                .filter(Boolean);
        };
        const matchesNameValue = (value) => {
            const normalized = normalizeValue(value);
            if (normalized && exactNameSet.has(normalized)) return true;
            const canonical = canonicalizeName(value);
            return !!(canonical && canonicalNameSet.has(canonical));
        };

        addId(contractorIdParam);
        baseIdFields.forEach(field => addId(base[field]));
        addIdCollection(base.aliasIds);
        addIdCollection(base.identityIds);
        addIdCollection(base.legacyIds);
        addIdCollection(base.altIds);
        nameFields.forEach(field => addName(base[field]));

        const matchesContractor = (record) => {
            if (!record || typeof record !== 'object') return false;
            const recordIds = collectRecordIds(record);
            if (recordIds.some(id => idsSet.has(id))) return true;
            if (recordIds.length > 0) return false;
            return collectRecordNames(record).some(matchesNameValue);
        };

        const contractorName = String(base.name || base.companyName || base.contractorName || '').replace(/\s+/g, ' ').trim();

        return {
            contractorName,
            idsSet,
            exactNameSet,
            canonicalNameSet,
            normalizeValue,
            canonicalizeName,
            collectRecordIds,
            collectRecordNames,
            hasAnyRecordIds(record) {
                return collectRecordIds(record).length > 0;
            },
            matchesNameValue,
            matchFieldsByName(values) {
                return (Array.isArray(values) ? values : []).some(matchesNameValue);
            },
            matchesContractor,
            violationBelongsToContractor(record) {
                if (!record || typeof record !== 'object') return false;
                const personType = normalizeValue(record.personType);
                if ((personType === 'employee' || personType === 'موظف') &&
                    !record.contractorName &&
                    !record.contractorId &&
                    !record.contractorCode &&
                    !record.code &&
                    !record.isoCode) {
                    return false;
                }
                const recordIds = collectRecordIds(record);
                const hasRecordIds = recordIds.length > 0;
                const idsMatch = recordIds.some(id => idsSet.has(id));
                if (hasRecordIds && !idsMatch) return false;
                const entityNames = collectContractorEntityNames(record);
                const hasEntityNames = entityNames.length > 0;
                const namesMatch = entityNames.some(matchesNameValue);
                if (hasEntityNames && !namesMatch) return false;
                // Prefer explicit IDs as source of truth across modules/sheets.
                // Name mismatches (spacing/spelling variants) should not hide valid records.
                if (hasRecordIds) return idsMatch;
                if (hasEntityNames) return namesMatch;
                return matchesContractor(record);
            },
            evaluationBelongsToContractor(record) {
                if (!record || typeof record !== 'object') return false;
                const recordIds = collectRecordIds(record);
                const hasRecordIds = recordIds.length > 0;
                const idsMatch = recordIds.some(id => idsSet.has(id));
                if (hasRecordIds) return idsMatch;
                const entityNames = collectContractorEntityNames(record);
                const hasEntityNames = entityNames.length > 0;
                if (hasEntityNames) return entityNames.some(matchesNameValue);
                return matchesContractor(record);
            }
        };
    },

    findApprovedContractorByTerm(term, approvedContractors = []) {
        const normalizedTerm = this.normalizeContractorIdentityValue(term);
        const canonicalTerm = this.canonicalizeContractorName(term);
        const approvedList = Array.isArray(approvedContractors) ? approvedContractors.filter(Boolean) : [];
        if (!normalizedTerm) {
            return { contractor: null, matches: [], ambiguous: false, reason: 'empty', matchType: null };
        }

        const collectMatches = (predicate) => approvedList.filter(contractor => {
            try {
                return predicate(contractor);
            } catch (error) {
                return false;
            }
        });

        let matches = collectMatches(contractor => {
            const sanitized = this.sanitizeContractorIdentity(contractor);
            const ctx = this.buildContractorIdentityMatcher(sanitized, this.getPreferredContractorLookupKey(sanitized, contractor?.contractorId || contractor?.id));
            return ctx.idsSet.has(normalizedTerm);
        });
        let matchType = 'exact-id';

        if (!matches.length) {
            matches = collectMatches(contractor => {
                const sanitized = this.sanitizeContractorIdentity(contractor);
                const ctx = this.buildContractorIdentityMatcher(sanitized, this.getPreferredContractorLookupKey(sanitized, contractor?.contractorId || contractor?.id));
                return ctx.matchesNameValue(term);
            });
            matchType = 'exact-name';
        }

        if (!matches.length && normalizedTerm.length >= 3) {
            matches = collectMatches(contractor => {
                const sanitized = this.sanitizeContractorIdentity(contractor);
                const ctx = this.buildContractorIdentityMatcher(sanitized, this.getPreferredContractorLookupKey(sanitized, contractor?.contractorId || contractor?.id));
                return Array.from(ctx.idsSet).some(value => value.startsWith(normalizedTerm));
            });
            matchType = 'prefix-id';
        }

        if (!matches.length && canonicalTerm && canonicalTerm.length >= 3) {
            matches = collectMatches(contractor => {
                const sanitized = this.sanitizeContractorIdentity(contractor);
                const ctx = this.buildContractorIdentityMatcher(sanitized, this.getPreferredContractorLookupKey(sanitized, contractor?.contractorId || contractor?.id));
                return Array.from(ctx.canonicalNameSet).some(value => value.startsWith(canonicalTerm));
            });
            matchType = 'prefix-name';
        }

        if (matches.length === 1) {
            return {
                contractor: matches[0],
                matches,
                ambiguous: false,
                reason: 'matched',
                matchType
            };
        }

        return {
            contractor: null,
            matches,
            ambiguous: matches.length > 1,
            reason: matches.length > 1 ? 'ambiguous' : 'not-found',
            matchType
        };
    },

    /**
     * التحقق من صحة البريد الإلكتروني
     */
    isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email.trim());
    },

    async sha256(value) {
        if (value === undefined || value === null) value = '';
        const input = String(value);

        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(input);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        if (window.CryptoJS && window.CryptoJS.SHA256) {
            return window.CryptoJS.SHA256(input).toString();
        }

        throw new Error('SHA-256 not supported in this environment');
    },

    isSha256Hex(value) {
        if (!value || typeof value !== 'string') return false;
        return /^[a-f0-9]{64}$/i.test(value.trim());
    },

    async normalizePasswordForComparison(inputPassword, storedPassword) {
        Utils.safeLog('🔧 normalizePasswordForComparison:', {
            inputPasswordLength: inputPassword?.length || 0,
            storedPasswordLength: storedPassword?.length || 0,
            storedPasswordPrefix: storedPassword ? (storedPassword.substring(0, 20) + '...') : 'غير موجود',
            isStoredPasswordHash: storedPassword ? this.isSha256Hex(storedPassword) : false
        });

        if (storedPassword && this.isSha256Hex(storedPassword)) {
            try {
                const hashedInput = await this.sha256(inputPassword);
                Utils.safeLog('✅ تم تشفير كلمة المرور المدخلة:', {
                    inputPasswordLength: inputPassword.length,
                    hashedInputLength: hashedInput.length,
                    hashedInputPrefix: hashedInput.substring(0, 20) + '...',
                    storedPasswordPrefix: storedPassword.substring(0, 20) + '...'
                });
                return hashedInput;
            } catch (error) {
                Utils.safeWarn('⚠ تعذر توليد SHA-256 للمقارنة:', error);
                return inputPassword;
            }
        }

        Utils.safeWarn('⚠ storedPassword ليس hash صحيح - إرجاع inputPassword كما هو');
        return inputPassword;
    },

    /**
     * تنسيق التاريخ
     */
    formatDateForInput(date) {
        if (!date) return '';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return '';
        }
    },

    formatDate(date, locale = null) {
        if (!date) return '-';

        const dateFormat = (typeof AppState !== 'undefined' && AppState.dateFormat) ? AppState.dateFormat : 'gregorian';
        const useLocale = locale || (dateFormat === 'hijri' ? 'ar-SA-u-ca-islamic' : 'en-GB');

        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return '-';

            return d.toLocaleDateString(useLocale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                calendar: dateFormat === 'hijri' ? 'islamic' : 'gregory'
            });
        } catch (error) {
            Utils.safeError('خطأ في تنسيق التاريخ:', error);
            return '-';
        }
    },

    /**
     * تنسيق التاريخ والوقت
     */
    formatDateTime(date, locale = null) {
        if (!date) return '-';

        const dateFormat = (typeof AppState !== 'undefined' && AppState.dateFormat) ? AppState.dateFormat : 'gregorian';
        const useLocale = locale || (dateFormat === 'hijri' ? 'ar-SA-u-ca-islamic' : 'ar-EG');
        const isArabicLocale = useLocale.startsWith('ar');

        try {
            let d;
            
            // ✅ معالجة شاملة لجميع أنواع التاريخ
            // إذا كان Date object مباشرة
            if (date instanceof Date) {
                if (isNaN(date.getTime())) return '-';
                d = date;
            } else {
                // معالجة strings
                let dateStr = String(date).trim();
                
                // إذا كانت بصيغة ISO كاملة (تحتوي على T و Z أو +)
                if (dateStr.includes('T') && (dateStr.includes('Z') || dateStr.includes('+') || dateStr.match(/-\d{2}:\d{2}$/))) {
                    d = new Date(dateStr);
                }
                // إذا كانت بصيغة yyyy-MM-dd فقط (10 أحرف)، نضيف وقت افتراضي
                else if (dateStr.length === 10 && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // نستخدم 00:00:00 كوقت افتراضي للبيانات القديمة
                    d = new Date(dateStr + 'T00:00:00');
                }
                // محاولة تحويل أي صيغة أخرى
                else {
                    d = new Date(dateStr);
                }
                
                if (isNaN(d.getTime())) return '-';
            }

            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                calendar: dateFormat === 'hijri' ? 'islamic' : 'gregory'
            };
            
            // Ensure AM/PM is displayed for Arabic locales
            if (isArabicLocale) {
                options.hour12 = true;
            }

            return d.toLocaleString(useLocale, options);
        } catch (error) {
            Utils.safeError('خطأ في تنسيق التاريخ والوقت:', error);
            return '-';
        }
    },

    /**
     * تحويل ISO string أو Date إلى تنسيق datetime-local للعرض في حقول الإدخال
     * يقوم بتحويل التوقيت من UTC إلى التوقيت المحلي بشكل صحيح
     * @param {string|Date} isoOrDate - تاريخ بتنسيق ISO string أو كائن Date
     * @returns {string} تاريخ بتنسيق yyyy-MM-ddTHH:mm للاستخدام في حقول datetime-local
     */
    toDateTimeLocalString(isoOrDate) {
        if (!isoOrDate) return '';
        try {
            const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
            if (isNaN(date.getTime())) return '';
            // تحويل من UTC إلى التوقيت المحلي
            const offset = date.getTimezoneOffset();
            const localDate = new Date(date.getTime() - offset * 60000);
            return localDate.toISOString().slice(0, 16);
        } catch (error) {
            Utils.safeError('خطأ في تحويل التاريخ إلى datetime-local:', error);
            return '';
        }
    },

    /**
     * تحويل datetime-local string إلى ISO string بشكل صحيح
     * يحافظ على الوقت المحلي المدخل من قبل المستخدم
     * @param {string} dateTimeLocalString - قيمة datetime-local بصيغة YYYY-MM-DDTHH:mm
     * @returns {string|null} ISO string أو null إذا كانت القيمة غير صحيحة
     */
    dateTimeLocalToISO(dateTimeLocalString) {
        if (!dateTimeLocalString || !dateTimeLocalString.trim()) return null;
        try {
            // datetime-local يعيد قيمة local time بصيغة YYYY-MM-DDTHH:mm
            // نحتاج لإنشاء Date object يمثل هذا الوقت المحلي بشكل صحيح
            const [datePart, timePart] = dateTimeLocalString.trim().split('T');
            if (datePart && timePart) {
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes] = timePart.split(':').map(Number);
                
                // إنشاء Date object باستخدام الوقت المحلي
                const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                if (!isNaN(localDate.getTime())) {
                    // تحويل إلى ISO string (سيتم تحويله إلى UTC تلقائياً)
                    return localDate.toISOString();
                }
            }
            // Fallback: استخدام الطريقة القديمة إذا فشل التحليل
            const date = new Date(dateTimeLocalString);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
            return null;
        } catch (error) {
            Utils.safeError('خطأ في تحويل datetime-local إلى ISO:', error);
            return null;
        }
    },

    /**
     * إنشاء معرف فريد (الطريقة القديمة - للتوافق مع الكود القديم)
     */
    generateId(prefix = 'ID') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * توليد معرف متسلسل بتنسيق [PREFIX]_[NUMBER]
     * مثل PTW_01, INC_01, إلخ
     * 
     * @param {string} prefix - البادئة (3 أحرف) مثل PTW, INC, NRM
     * @param {Array} existingData - البيانات الموجودة من قاعدة البيانات
     * @returns {string} معرف جديد بالتنسيق PREFIX_NUMBER
     */
    generateSequentialId(prefix, existingData = []) {
        try {
            if (!prefix || prefix.length !== 3) {
                console.warn('Invalid prefix:', prefix, '- must be exactly 3 characters');
                // Fallback to old method if prefix is invalid
                return this.generateId(prefix);
            }

            // تحويل البادئة إلى أحرف كبيرة
            prefix = prefix.toUpperCase();

            // استخراج جميع الأرقام الموجودة بتنسيق PREFIX_NUMBER
            const existingNumbers = [];
            if (existingData && Array.isArray(existingData)) {
                existingData.forEach(record => {
                    if (record && record.id) {
                        const id = record.id.toString();
                        // التحقق من التنسيق: PREFIX_NUMBER (مثل PTW_01, PTW_100, إلخ)
                        const pattern = new RegExp('^' + prefix + '_\\d+$');
                        if (pattern.test(id)) {
                            // استخراج الرقم
                            const numberPart = id.split('_')[1];
                            const number = parseInt(numberPart, 10);
                            if (!isNaN(number) && number > 0) {
                                existingNumbers.push(number);
                            }
                        }
                    }
                });
            }

            // حساب الرقم التالي
            let nextNumber = 1;
            if (existingNumbers.length > 0) {
                nextNumber = Math.max(...existingNumbers) + 1;
            }

            // التأكد من عدم تجاوز الحد الأقصى (1000000)
            if (nextNumber > 1000000) {
                console.warn('Warning: Sequential number exceeded maximum (1000000), using fallback');
                return this.generateId(prefix);
            }

            // إرجاع المعرف الجديد
            return prefix + '_' + nextNumber.toString();

        } catch (error) {
            console.error('Error in generateSequentialId:', error);
            // في حالة الخطأ، نستخدم الطريقة القديمة كبديل
            return this.generateId(prefix);
        }
    },

    /**
     * الحصول على البادئة المناسبة للموديول
     * @param {string} moduleName - اسم الموديول
     * @returns {string} البادئة (3 أحرف)
     */
    getModulePrefix(moduleName) {
        const prefixMap = {
            // الحوادث والسلامة
            'incidents': 'INC',
            'Incidents': 'INC',
            'nearmiss': 'NRM',
            'NearMiss': 'NRM',
            'ptw': 'PTW',
            'PTW': 'PTW',
            'violations': 'VIO',
            'Violations': 'VIO',

            // التدريب والموظفين
            'training': 'TRN',
            'Training': 'TRN',
            'employees': 'EMP',
            'Employees': 'EMP',

            // المعدات والسلامة
            'fireequipment': 'FEA',
            'FireEquipment': 'FEA',
            'fireequipmentassets': 'EFA',
            'FireEquipmentAssets': 'EFA',
            'fireequipmentinspections': 'FEI',
            'FireEquipmentInspections': 'FEI',
            'ppe': 'PPE',
            'PPE': 'PPE',
            'periodicinspections': 'PIN',
            'PeriodicInspections': 'PIN',
            'periodicinspectioncategories': 'PIC',
            'PeriodicInspectionCategories': 'PIC',
            'periodicinspectionchecklists': 'PIC',
            'PeriodicInspectionChecklists': 'PIC',
            'periodicinspectionschedules': 'PIS',
            'PeriodicInspectionSchedules': 'PIS',
            'periodicinspectionrecords': 'PIR',
            'PeriodicInspectionRecords': 'PIR',

            // المقاولين والعيادة
            // ✅ تم إزالة 'contractors' و 'Contractors' - نعتمد فقط على ApprovedContractors
            'approvedcontractors': 'ACN',
            'ApprovedContractors': 'ACN',
            'contractorevaluations': 'CEV',
            'ContractorEvaluations': 'CEV',
            'clinic': 'CLN',
            'ClinicVisits': 'CLV',
            'clinicvisits': 'CLV',
            'medications': 'MED',
            'Medications': 'MED',
            'sickleave': 'SKL',
            'SickLeave': 'SKL',
            'injuries': 'INJ',
            'Injuries': 'INJ',
            'clinicinventory': 'CLI',
            'ClinicInventory': 'CLI',

            // ISO و HSE
            'iso': 'ISO',
            'isodocuments': 'ISD',
            'ISODocuments': 'ISD',
            'isoprocedures': 'ISP',
            'ISOProcedures': 'ISP',
            'isoforms': 'ISF',
            'ISOForms': 'ISF',
            'hse': 'HSE',
            'hseaudits': 'HSA',
            'HSEAudits': 'HSA',
            'hsenonconformities': 'HSN',
            'HSENonConformities': 'HSN',
            'hsecorrectiveactions': 'HSC',
            'HSECorrectiveActions': 'HSC',
            'hseobjectives': 'HSO',
            'HSEObjectives': 'HSO',
            'hseriskassessments': 'HSR',
            'HSERiskAssessments': 'HSR',

            // تقييم المخاطر والمستندات
            'riskassessments': 'RSA',
            'RiskAssessments': 'RSA',
            'legaldocuments': 'LGD',
            'LegalDocuments': 'LGD',
            'sopjha': 'SOP',
            'SOPJHA': 'SOP',

            // المراقبة والملاحظات
            'behaviormonitoring': 'BHM',
            'BehaviorMonitoring': 'BHM',
            'chemicalsafety': 'CHS',
            'ChemicalSafety': 'CHS',
            'dailyobservations': 'DOB',
            'DailyObservations': 'DOB',
            'observationsites': 'OBS',
            'ObservationSites': 'OBS',

            // الاستدامة والبيئة
            'sustainability': 'SUS',
            'Sustainability': 'SUS',
            'environmentalaspects': 'ENA',
            'EnvironmentalAspects': 'ENA',
            'environmentalmonitoring': 'ENM',
            'EnvironmentalMonitoring': 'ENM',
            'carbonfootprint': 'CFP',
            'CarbonFootprint': 'CFP',
            'wastemanagement': 'WAM',
            'WasteManagement': 'WAM',
            'energyefficiency': 'ENE',
            'EnergyEfficiency': 'ENE',
            'watermanagement': 'WAM',
            'WaterManagement': 'WAM',
            'recyclingprograms': 'RCP',
            'RecyclingPrograms': 'RCP',

            // الطوارئ والميزانية
            'emergency': 'EMG',
            'emergencyalerts': 'EMA',
            'EmergencyAlerts': 'EMA',
            'emergencyplans': 'EMP',
            'EmergencyPlans': 'EMP',
            'emergencyplansupdates': 'EPU',
            'EmergencyPlansUpdates': 'EPU',
            'safetybudget': 'SAB',
            'SafetyBudgets': 'SAB',
            'safetybudgettransactions': 'SBT',
            'SafetyBudgetTransactions': 'SBT',

            // مؤشرات الأداء والمهام
            'safetyperformancekpis': 'SPK',
            'SafetyPerformanceKPIs': 'SPK',
            'safetyteamkpis': 'STK',
            'SafetyTeamKPIs': 'STK',
            'actiontrackingregister': 'ATR',
            'ActionTrackingRegister': 'ATR',
            'usertasks': 'UTK',
            'UserTasks': 'UTK',
            'userinstructions': 'UIN',
            'UserInstructions': 'UIN',

            // إدارة السلامة والصحة المهنية
            'safetyhealthmanagement': 'SHM',
            'SafetyHealthManagement': 'SHM',
            'safetyteammembers': 'STM',
            'SafetyTeamMembers': 'STM',
            'safetyorganizationalstructure': 'SOS',
            'SafetyOrganizationalStructure': 'SOS',
            'safetyjobdescriptions': 'SJD',
            'SafetyJobDescriptions': 'SJD',
            'safetyteamattendance': 'STA',
            'SafetyTeamAttendance': 'STA',
            'safetyteamleaves': 'STL',
            'SafetyTeamLeaves': 'STL',
            'safetyteamtasks': 'STT',
            'SafetyTeamTasks': 'STT',

            // أنواع المخالفات
            'violationtypes': 'VTY',
            'ViolationTypes': 'VTY',
            'violation_types_db': 'VTY',
            'Violation_Types_DB': 'VTY',
            'blacklist_register': 'BLR',
            'Blacklist_Register': 'BLR',

            // مصفوفات ومخزون
            'ppematrix': 'PPM',
            'PPEMatrix': 'PPM',
            'ppe_stock': 'PPS',
            'PPE_Stock': 'PPS',
            'ppe_transactions': 'PPT',
            'PPE_Transactions': 'PPT',

            // التدريب المتقدم
            'employeetrainingmatrix': 'ETM',
            'EmployeeTrainingMatrix': 'ETM',
            'contractortrainings': 'CTR',
            'ContractorTrainings': 'CTR',
            'annualtrainingplans': 'ATP',
            'AnnualTrainingPlans': 'ATP',

            // السجلات والإشعارات
            'auditlog': 'AUD',
            'AuditLog': 'AUD',
            'useractivitylog': 'UAL',
            'UserActivityLog': 'UAL',
            'notifications': 'NOT',
            'Notifications': 'NOT',
            'incidentnotifications': 'INO',
            'IncidentNotifications': 'INO',

            // إعدادات
            'form_settings_db': 'FSD',
            'Form_Settings_DB': 'FSD',
            'aiassistantsettings': 'AIA',
            'AIAssistantSettings': 'AIA',
            'userailog': 'UAI',
            'UserAILog': 'UAI',
            'safetyhealthmanagementsettings': 'SHS',
            'SafetyHealthManagementSettings': 'SHS',
            'actiontrackingsettings': 'ATS',
            'ActionTrackingSettings': 'ATS'
        };

        return prefixMap[moduleName] || 'ID';
    },

    /**
     * تشفير كلمة المرور باستخدام SHA-256
     */
    async hashPassword(password) {
        if (!password) return '';
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * التحقق من كلمة المرور (التشفير فقط - إزالة دعم النص العادي)
     */
    async verifyPassword(password, storedPassword) {
        if (!password || !storedPassword) return false;
        // الأمان يتطلب التشفير فقط - لا دعم للنص العادي
        if (!this.isSha256Hex(storedPassword)) {
            Utils.safeWarn('⚠️ محاولة التحقق من كلمة مرور غير مشفرة - مرفوضة');
            return false;
        }
        // التحقق من كلمة المرور المشفرة
        const hashedPassword = await this.hashPassword(password);
        return hashedPassword.toLowerCase() === storedPassword.toLowerCase();
    },

    /**
     * التحقق من أن كلمة المرور مشفرة
     */
    isHashedPassword(password) {
        return password && password.length === 64 && /^[a-f0-9]+$/i.test(password);
    },

    /**
     * Rate Limiting لتسجيل الدخول
     */
    RateLimiter: {
        MAX_ATTEMPTS: 5,
        LOCKOUT_DURATION: 15 * 60 * 1000, // 15 دقيقة
        ATTEMPT_WINDOW: 60 * 1000, // نافذة 1 دقيقة

        getAttemptsKey(email) {
            return `login_attempts_${email.toLowerCase()}`;
        },

        getLockoutKey(email) {
            return `login_lockout_${email.toLowerCase()}`;
        },

        async checkLockout(email) {
            const lockoutKey = this.getLockoutKey(email);
            try {
                const lockout = JSON.parse(localStorage.getItem(lockoutKey) || '{}');

                if (lockout.locked && Date.now() < lockout.until) {
                    const minutesLeft = Math.ceil((lockout.until - Date.now()) / 60000);
                    throw new Error(`الحساب مقفل مؤقتاً بسبب محاولات تسجيل دخول فاشلة متعددة. يرجى المحاولة بعد ${minutesLeft} دقيقة.`);
                }

                // إزالة القفل إذا انتهت المدة
                if (lockout.locked && Date.now() >= lockout.until) {
                    localStorage.removeItem(lockoutKey);
                    localStorage.removeItem(this.getAttemptsKey(email));
                }
            } catch (error) {
                // في حالة خطأ في parsing، نزيل البيانات القديمة
                localStorage.removeItem(lockoutKey);
                localStorage.removeItem(this.getAttemptsKey(email));
            }
        },

        async recordFailedAttempt(email) {
            const key = this.getAttemptsKey(email);
            try {
                const attempts = JSON.parse(localStorage.getItem(key) || '[]');
                const now = Date.now();

                // إزالة المحاولات القديمة (أكثر من نافذة الوقت)
                const recentAttempts = attempts.filter(time => now - time < this.ATTEMPT_WINDOW);
                recentAttempts.push(now);

                localStorage.setItem(key, JSON.stringify(recentAttempts));

                // إذا تجاوز الحد، قفل الحساب
                if (recentAttempts.length >= this.MAX_ATTEMPTS) {
                    const lockoutKey = this.getLockoutKey(email);
                    localStorage.setItem(lockoutKey, JSON.stringify({
                        locked: true,
                        until: now + this.LOCKOUT_DURATION
                    }));
                    const minutes = Math.ceil(this.LOCKOUT_DURATION / 60000);
                    throw new Error(`تم قفل الحساب مؤقتاً بسبب محاولات تسجيل دخول فاشلة متعددة. يرجى المحاولة بعد ${minutes} دقيقة.`);
                }

                const remaining = this.MAX_ATTEMPTS - recentAttempts.length;
                if (remaining > 0) {
                    throw new Error(`كلمة المرور غير صحيحة. محاولات متبقية: ${remaining}`);
                }
            } catch (error) {
                // إذا كان الخطأ من recordFailedAttempt نفسه، نرميه
                if (error.message.includes('قفل') || error.message.includes('متبقية')) {
                    throw error;
                }
                // وإلا نعيد إنشاء البيانات
                localStorage.setItem(key, JSON.stringify([Date.now()]));
                throw new Error(`كلمة المرور غير صحيحة. محاولات متبقية: ${this.MAX_ATTEMPTS - 1}`);
            }
        },

        async clearAttempts(email) {
            localStorage.removeItem(this.getAttemptsKey(email));
            localStorage.removeItem(this.getLockoutKey(email));
        }
    },

    /**
     * فحص الملفات المرفوعة
     */
    FileValidator: {
        ALLOWED_MIME_TYPES: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.ms-excel'
        ],

        ALLOWED_EXTENSIONS: [
            '.jpg', '.jpeg', '.png', '.gif', '.webp',
            '.pdf',
            '.xlsx', '.xls',
            '.docx', '.doc'
        ],

        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

        // Magic Bytes للتحقق من نوع الملف الفعلي
        FILE_SIGNATURES: {
            'image/jpeg': [0xFF, 0xD8, 0xFF],
            'image/png': [0x89, 0x50, 0x4E, 0x47],
            'image/gif': [0x47, 0x49, 0x46, 0x38],
            'application/pdf': [0x25, 0x50, 0x44, 0x46]
        },

        async validateFile(file) {
            // 1. فحص حجم الملف
            if (file.size > this.MAX_FILE_SIZE) {
                throw new Error(`حجم الملف كبير جداً. الحد الأقصى: ${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB`);
            }

            // 2. فحص الامتداد
            const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            if (!this.ALLOWED_EXTENSIONS.includes(extension)) {
                throw new Error(`امتداد الملف غير مسموح: ${extension}. الملفات المسموحة: ${this.ALLOWED_EXTENSIONS.join(', ')}`);
            }

            // 3. فحص نوع MIME
            if (file.type && !this.ALLOWED_MIME_TYPES.includes(file.type)) {
                throw new Error(`نوع الملف غير مسموح: ${file.type}`);
            }

            // 4. فحص اسم الملف (منع أسماء خطيرة)
            if (this.isDangerousFileName(file.name)) {
                throw new Error('اسم الملف غير آمن. يرجى استخدام اسم ملف صحيح');
            }

            // 5. فحص Magic Bytes (اختياري - للصور والـ PDF فقط)
            if (file.type && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
                try {
                    const arrayBuffer = await file.slice(0, 4).arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    const mimeType = this.detectMimeTypeFromBytes(bytes);

                    if (mimeType && mimeType !== file.type) {
                        throw new Error('نوع الملف المعلن لا يطابق محتوى الملف الفعلي');
                    }
                } catch (error) {
                    // إذا فشل الفحص، نسمح بالملف (لأنه قد يكون ملف صالح)
                    Utils.safeWarn('تحذير: فشل فحص محتوى الملف:', error);
                }
            }

            return true;
        },

        detectMimeTypeFromBytes(bytes) {
            for (const [mimeType, signature] of Object.entries(this.FILE_SIGNATURES)) {
                if (signature.every((byte, index) => bytes[index] === byte)) {
                    return mimeType;
                }
            }
            return null;
        },

        isDangerousFileName(fileName) {
            const dangerousPatterns = [
                /\.\./,           // Path traversal
                /[<>:"|?*]/,      // Invalid characters
                /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved names (Windows)
                /\.(exe|bat|cmd|sh|ps1|js|vbs)$/i // Executable extensions
            ];

            return dangerousPatterns.some(pattern => pattern.test(fileName));
        }
    },

    /**
     * تنسيق رسالة خطأ الاتصال بالخلفية
     * @param {string|Error} error - رسالة الخطأ أو كائن الخطأ
     * @param {string} defaultMessage - الرسالة الافتراضية إذا لم يتم التعرف على نوع الخطأ
     * @returns {object} - كائن يحتوي على message و recommendation
     */
    formatBackendError(error, defaultMessage = 'حدث خطأ في الاتصال بالخلفية') {
        const errorMessage = error?.message || error?.toString() || String(error || '');
        let message = defaultMessage;
        let recommendation = 'تحقق من إعدادات Google Integration واتصال الإنترنت';

        // التحقق من نوع الخطأ وتنسيق الرسالة
        if (errorMessage.includes('Google Apps Script غير مفعل') ||
            errorMessage.includes('غير مفعّل') ||
            errorMessage.includes('غير مفعل')) {
            message = 'Google Apps Script غير مفعّل';
            recommendation = 'يرجى تفعيل Google Apps Script من الإعدادات وإدخال رابط الخادم';
        } else if (errorMessage.includes('رابط') && (errorMessage.includes('غير صحيح') || errorMessage.includes('غير محدد'))) {
            message = 'رابط Google Apps Script غير صحيح أو غير محدد';
            recommendation = 'يجب أن ينتهي رابط الخادم بـ /exec (مثال: https://script.google.com/macros/s/.../exec)';
        } else if (errorMessage.includes('Timeout') ||
            errorMessage.includes('انتهت مهلة') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('timed out')) {
            message = 'انتهت مهلة الاتصال بالخادم';
            recommendation = 'تحقق من:\n1. اتصال الإنترنت\n2. أن Google Apps Script منشور ومفعّل\n3. عدم وجود قيود على الشبكة';
        } else if (errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('NetworkError') ||
            errorMessage.includes('CORS') ||
            errorMessage.includes('Network request failed')) {
            message = 'فشل الاتصال بالخادم';
            recommendation = 'تحقق من:\n1. اتصال الإنترنت\n2. رابط Google Apps Script صحيح\n3. أن الخادم منشور ومفعّل';
        } else if (errorMessage.includes('غير معترف به') ||
            errorMessage.includes('Action not recognized') ||
            errorMessage.includes('ACTION_NOT_RECOGNIZED')) {
            message = errorMessage; // استخدام الرسالة التفصيلية من الخادم
            recommendation = 'تحقق من أن إصدار الخادم محدث ويتوافق مع إصدار الواجهة';
        } else if (errorMessage.includes('فشل الاتصال') ||
            errorMessage.includes('Connection failed')) {
            message = errorMessage.includes('فشل الاتصال') ? errorMessage : 'فشل الاتصال بالخلفية';
            recommendation = 'تحقق من:\n1. إعدادات Google Integration\n2. اتصال الإنترنت\n3. أن Google Apps Script منشور ومفعّل';
        } else if (errorMessage.trim() !== '') {
            // إذا كانت الرسالة واضحة، نستخدمها كما هي
            message = errorMessage;
        }

        return { message, recommendation };
    },

    /**
     * عرض نافذة تأكيد
     * @param {string} title - عنوان النافذة
     * @param {string} message - رسالة التأكيد
     * @param {string} confirmText - نص زر التأكيد
     * @param {string} cancelText - نص زر الإلغاء
     * @returns {Promise<boolean>} - true إذا تم التأكيد، false إذا تم الإلغاء
     */
    confirmDialog(title, message, confirmText = 'تأكيد', cancelText = 'إلغاء') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.zIndex = '10001';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">${Utils.escapeHTML(title)}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="text-align: right; direction: rtl; padding: 1rem 0;">
                            <p style="white-space: pre-line; line-height: 1.6;">${Utils.escapeHTML(message)}</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="confirm-dialog-cancel">
                            <i class="fas fa-times ml-2"></i>
                            ${Utils.escapeHTML(cancelText)}
                        </button>
                        <button class="btn-primary" id="confirm-dialog-confirm">
                            <i class="fas fa-check ml-2"></i>
                            ${Utils.escapeHTML(confirmText)}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const confirmBtn = modal.querySelector('#confirm-dialog-confirm');
            const cancelBtn = modal.querySelector('#confirm-dialog-cancel');
            const closeBtn = modal.querySelector('.modal-close');

            const closeModal = (result) => {
                modal.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => {
                    modal.remove();
                    resolve(result);
                }, 200);
            };

            confirmBtn.addEventListener('click', () => closeModal(true));
            cancelBtn.addEventListener('click', () => closeModal(false));
            closeBtn.addEventListener('click', () => closeModal(false));

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(false);
                }
            });

            // إغلاق عند الضغط على ESC
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    closeModal(false);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }
};

// ===== Constants =====
const DEFAULT_PERIODIC_INSPECTION_CATEGORIES = [
    {
        id: 'default_periodic_vehicle',
        name: 'فحص سيارات الموظفين',
        description: 'متابعة جاهزية مركبات الموظفين ومطابقتها لمتطلبات السلامة.',
        defaultFrequency: 'monthly',
        defaultReminderDays: 5,
        isDefault: true,
        checklist: [
            { id: 'default_periodic_vehicle_1', label: 'صلاحية التأمين والرخصة', required: true },
            { id: 'default_periodic_vehicle_2', label: 'فحص الإطارات ومستوى التآكل', required: true },
            { id: 'default_periodic_vehicle_3', label: 'وجود حقيبة الإسعافات وطفاية حريق', required: false }
        ]
    },
    {
        id: 'default_periodic_forklift',
        name: 'فحص الرافعات الشوكية (الكلاركات)',
        description: 'تأكد من سلامة وتشغيل الرافعات الشوكية في مواقع العمل.',
        defaultFrequency: 'weekly',
        defaultReminderDays: 3,
        isDefault: true,
        checklist: [
            { id: 'default_periodic_forklift_1', label: 'سلامة نظام الفرامل والإيقاف', required: true },
            { id: 'default_periodic_forklift_2', label: 'سلامة شوكتي الرفع وعدم وجود تشققات', required: true },
            { id: 'default_periodic_forklift_3', label: 'فحص البطارية أو الوقود والتسريبات', required: true }
        ]
    },
    {
        id: 'default_periodic_pallet',
        name: 'فحص الهاند باليت الكهربائية',
        description: 'مراجعة جاهزية وسلامة عربات التحميل الكهربائية.',
        defaultFrequency: 'weekly',
        defaultReminderDays: 3,
        isDefault: true,
        checklist: [
            { id: 'default_periodic_pallet_1', label: 'سلامة البطارية والشحن', required: true },
            { id: 'default_periodic_pallet_2', label: 'تأكد من كفاءة الفرامل والطوارئ', required: true },
            { id: 'default_periodic_pallet_3', label: 'سلامة العجلات وعدم وجود تآكل شديد', required: false }
        ]
    },
    {
        id: 'default_periodic_emergency_light',
        name: 'فحص كشافات الطوارئ',
        description: 'التأكد من عمل كشافات الطوارئ وفعالية البطاريات المرتبطة.',
        defaultFrequency: 'monthly',
        defaultReminderDays: 5,
        isDefault: true,
        checklist: [
            { id: 'default_periodic_emergency_light_1', label: 'تشغيل يدوي للكشاف والتأكد من الإضاءة', required: true },
            { id: 'default_periodic_emergency_light_2', label: 'حالة البطارية ومؤشرات الشحن', required: true },
            { id: 'default_periodic_emergency_light_3', label: 'سلامة جسم الكشاف وخلوه من التلف', required: false }
        ]
    },
    {
        id: 'default_periodic_ladders',
        name: 'فحص السلالم الثابتة والمتحركة',
        description: 'تفقد السلالم للتأكد من سلامتها الإنشائية والتشغيلية.',
        defaultFrequency: 'quarterly',
        defaultReminderDays: 10,
        isDefault: true,
        checklist: [
            { id: 'default_periodic_ladders_1', label: 'ثبات السلم وعدم وجود اهتزاز', required: true },
            { id: 'default_periodic_ladders_2', label: 'سلامة الدرجات وعدم وجود كسر أو تشققات', required: true },
            { id: 'default_periodic_ladders_3', label: 'نظافة السلم وخلوه من الزيوت أو الشحوم', required: false }
        ]
    }
];

const DEFAULT_VIOLATION_TYPES = [
    {
        id: 'default_violation_1',
        name: 'عدم استخدام معدات الوقاية',
        description: '',
        fineAmount: 0,
        isDefault: true,
        order: 1
    },
    {
        id: 'default_violation_2',
        name: 'عدم اتباع إجراءات السلامة',
        description: '',
        fineAmount: 0,
        isDefault: true,
        order: 2
    },
    {
        id: 'default_violation_3',
        name: 'التدخين ي المناطق الممنوعة',
        description: '',
        fineAmount: 0,
        isDefault: true,
        order: 3
    },
    {
        id: 'default_violation_4',
        name: 'عدم الحصول على تصريح عمل',
        description: '',
        fineAmount: 0,
        isDefault: true,
        order: 4
    },
    {
        id: 'default_violation_5',
        name: 'أخرى',
        description: '',
        fineAmount: 0,
        isDefault: true,
        order: 5
    }
];

// ===== Violation Types Manager =====
const ViolationTypesManager = {
    ensureInitialized() {
        if (!AppState || !AppState.appData) return [];

        const now = new Date().toISOString();
        const existing = Array.isArray(AppState.appData.violationTypes)
            ? AppState.appData.violationTypes.slice()
            : [];
        const backendEnabled = (typeof GoogleIntegration !== 'undefined'
            && typeof GoogleIntegration._isBackendRpcConfigured === 'function'
            && GoogleIntegration._isBackendRpcConfigured());
        const hasViolationTypesSynced = !!(AppState?.syncMeta?.sheets && AppState.syncMeta.sheets.ViolationTypes);

        // إذا كانت الخلفية مفعلة لكن لم يتم تحميل ViolationTypes بعد، لا ننشئ الافتراضيات حتى لا نطغى على البيانات الحقيقية بعد التحميل
        if (backendEnabled && !hasViolationTypesSynced && existing.length === 0) {
            AppState.appData.violationTypes = [];
            return [];
        }
        const normalized = [];
        const seenNames = new Map();
        const seenIds = new Set();
        let shouldSave = false;

        const normalizeItem = (item, index) => {
            if (!item) return null;

            if (typeof item === 'string') {
                shouldSave = true;
                return {
                    id: Utils.generateId('VTYPE'),
                    name: item.trim(),
                    description: '',
                    isDefault: false,
                    createdAt: now,
                    updatedAt: now
                };
            }

            const name = (item.name || item.label || '').trim();
            if (!name) return null;

            let id = item.id && typeof item.id === 'string' && item.id.trim() !== ''
                ? item.id.trim()
                : '';
            if (!id) {
                id = Utils.generateId('VTYPE');
                shouldSave = true;
            }

            const description = (item.description || item.notes || '').trim();
            const parsedFineAmount = Number(item.fineAmount ?? item.defaultFineAmount ?? 0);
            const fineAmount = Number.isFinite(parsedFineAmount) && parsedFineAmount >= 0 ? parsedFineAmount : 0;
            const createdAt = item.createdAt || now;
            const updatedAt = item.updatedAt || now;
            const isDefault = item.isDefault === true;
            const order = typeof item.order === 'number' ? item.order : undefined;

            return {
                id,
                name,
                description,
                fineAmount,
                isDefault,
                createdAt,
                updatedAt,
                order
            };
        };

        existing.forEach((item, index) => {
            const normalizedItem = normalizeItem(item, index);
            if (!normalizedItem) {
                shouldSave = true;
                return;
            }

            const lowerName = normalizedItem.name.toLowerCase();
            if (seenNames.has(lowerName)) {
                shouldSave = true;
                return;
            }

            if (seenIds.has(normalizedItem.id)) {
                normalizedItem.id = Utils.generateId('VTYPE');
                shouldSave = true;
            }

            seenNames.set(lowerName, normalizedItem);
            seenIds.add(normalizedItem.id);
            normalized.push(normalizedItem);
        });

        // نضيف الأنواع الافتراضية مرة واحدة فقط عند التهيئة الأولى (عندما لا توجد أي أنواع محفوظة)
        if (normalized.length === 0) {
            DEFAULT_VIOLATION_TYPES.forEach(defaultType => {
                normalized.push({
                    id: defaultType.id,
                    name: defaultType.name,
                    description: defaultType.description || '',
                    fineAmount: Number(defaultType.fineAmount) || 0,
                    isDefault: true,
                    createdAt: now,
                    updatedAt: now,
                    order: defaultType.order
                });
                seenNames.set(defaultType.name.toLowerCase(), normalized[normalized.length - 1]);
                seenIds.add(defaultType.id);
                shouldSave = true;
            });
        }

        normalized.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 9999;
            const orderB = typeof b.order === 'number' ? b.order : 9999;
            if (orderA !== orderB) return orderA - orderB;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name, 'ar');
        });

        AppState.appData.violationTypes = normalized;

        if (shouldSave) {
            // استخدام window.DataManager كبديل إذا لم يكن DataManager متاحاً محلياً
            const dm = (typeof window !== 'undefined' && window.DataManager) ||
                (typeof DataManager !== 'undefined' && DataManager);
            if (dm && typeof dm.save === 'function') {
                dm.save();
            }
        }

        this.ensureViolationsTypeIds(normalized);
        return normalized;
    },

    ensureViolationsTypeIds(types = null) {
        const violations = AppState?.appData?.violations;
        if (!Array.isArray(violations) || violations.length === 0) return;

        const list = Array.isArray(types) ? types : (AppState.appData.violationTypes || []);
        const typeByName = new Map(list.map(type => [type.name.toLowerCase(), type]));
        let changed = false;

        violations.forEach(violation => {
            if (!violation) return;
            const currentId = violation.violationTypeId;
            const currentName = (violation.violationType || '').trim();
            if (currentId) return;
            if (!currentName) return;
            const match = typeByName.get(currentName.toLowerCase());
            if (match) {
                violation.violationTypeId = match.id;
                changed = true;
            }
        });

        if (changed) {
            // استخدام window.DataManager كبديل إذا لم يكن DataManager متاحاً محلياً
            const dm = (typeof window !== 'undefined' && window.DataManager) ||
                (typeof DataManager !== 'undefined' && DataManager);
            if (dm && typeof dm.save === 'function') {
                dm.save();
            }
        }
    },

    getAll() {
        return this.ensureInitialized().slice();
    },

    getTypeById(id) {
        if (!id) return null;
        return (AppState.appData.violationTypes || []).find(type => type.id === id) || null;
    },

    getTypeByName(name) {
        if (!name) return null;
        const lower = name.trim().toLowerCase();
        return (AppState.appData.violationTypes || []).find(type => type.name.toLowerCase() === lower) || null;
    },

    countUsage(typeOrId) {
        const violations = AppState?.appData?.violations;
        if (!Array.isArray(violations)) return 0;

        let target = null;
        if (typeof typeOrId === 'string') {
            target = this.getTypeById(typeOrId) || this.getTypeByName(typeOrId);
        } else {
            target = typeOrId;
        }
        if (!target) return 0;

        const lowerName = target.name.toLowerCase();
        return violations.reduce((count, violation) => {
            if (!violation) return count;
            if (violation.violationTypeId === target.id) return count + 1;
            const name = (violation.violationType || '').trim().toLowerCase();
            if (!violation.violationTypeId && name === lowerName) return count + 1;
            return count;
        }, 0);
    },

    addType({ name, description = '', fineAmount = 0 } = {}) {
        const trimmedName = (name || '').trim();
        if (!trimmedName) {
            throw new Error('يرجى إدخال اسم نوع المخالفة');
        }

        this.ensureInitialized();

        if (this.getTypeByName(trimmedName)) {
            throw new Error('نوع المخالفة موجود مسبقاً');
        }

        const now = new Date().toISOString();
        const parsedFineAmount = Number(fineAmount);
        const newType = {
            id: Utils.generateId('VTYPE'),
            name: trimmedName,
            description: (description || '').trim(),
            fineAmount: Number.isFinite(parsedFineAmount) && parsedFineAmount >= 0 ? parsedFineAmount : 0,
            isDefault: false,
            createdAt: now,
            updatedAt: now
        };

        AppState.appData.violationTypes.push(newType);
        this.sortTypes();
        this.persist(true);
        return newType;
    },

    updateType(id, { name, description, fineAmount, isDefault } = {}) {
        if (!id) {
            throw new Error('معرف نوع المخالفة غير محدد');
        }

        this.ensureInitialized();
        const type = this.getTypeById(id);

        if (!type) {
            throw new Error('نوع المخالفة غير موجود');
        }

        const newName = (name ?? type.name).trim();
        if (!newName) {
            throw new Error('لا يمكن أن يكون اسم النوع فارغاً');
        }

        const lowerOld = type.name.toLowerCase();
        const lowerNew = newName.toLowerCase();
        if (lowerNew !== lowerOld) {
            const existing = this.getTypeByName(newName);
            if (existing && existing.id !== id) {
                throw new Error('يوجد نوع آخر بنفس الاسم');
            }
        }

        const previousName = type.name;
        const parsedFineAmount = Number(fineAmount);
        type.name = newName;
        type.description = (description ?? type.description).trim();
        if (fineAmount !== undefined) {
            type.fineAmount = Number.isFinite(parsedFineAmount) && parsedFineAmount >= 0 ? parsedFineAmount : 0;
        } else if (!Number.isFinite(Number(type.fineAmount)) || Number(type.fineAmount) < 0) {
            type.fineAmount = 0;
        }
        if (typeof isDefault === 'boolean') {
            type.isDefault = isDefault;
        }
        type.updatedAt = new Date().toISOString();

        const renamed = this.propagateTypeRename(type.id, previousName, type.name);
        this.sortTypes();
        this.persist(true);
        if (renamed) {
            this.syncViolations();
        }
        return type;
    },

    deleteType(id) {
        if (!id) {
            throw new Error('معرف نوع المخالفة غير محدد');
        }

        this.ensureInitialized();
        const index = (AppState.appData.violationTypes || []).findIndex(type => type.id === id);
        if (index === -1) {
            throw new Error('نوع المخالفة غير موجود');
        }

        const removed = AppState.appData.violationTypes.splice(index, 1)[0];
        const violations = AppState?.appData?.violations || [];
        let changedViolations = false;

        violations.forEach(violation => {
            if (!violation) return;
            if (violation.violationTypeId === id) {
                violation.violationTypeId = '';
                if (!violation.violationType) {
                    violation.violationType = removed.name;
                }
                changedViolations = true;
            }
        });

        this.persist(true);
        if (changedViolations) {
            this.syncViolations();
        }
        return removed;
    },

    propagateTypeRename(typeId, oldName, newName) {
        const violations = AppState?.appData?.violations || [];
        if (!Array.isArray(violations) || violations.length === 0) return false;

        const lowerOld = (oldName || '').toLowerCase();
        let changed = false;

        violations.forEach(violation => {
            if (!violation) return;
            const currentName = (violation.violationType || '').trim();
            if (violation.violationTypeId === typeId) {
                if (currentName !== newName) {
                    violation.violationType = newName;
                    changed = true;
                }
            } else if (!violation.violationTypeId && currentName && currentName.toLowerCase() === lowerOld) {
                violation.violationType = newName;
                violation.violationTypeId = typeId;
                changed = true;
            }
        });

        return changed;
    },

    sortTypes() {
        const list = AppState?.appData?.violationTypes;
        if (!Array.isArray(list)) return;
        list.sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 9999;
            const orderB = typeof b.order === 'number' ? b.order : 9999;
            if (orderA !== orderB) return orderA - orderB;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name, 'ar');
        });
    },

    persist(syncSheets = true) {
        // استخدام window.DataManager كبديل إذا لم يكن DataManager متاحاً محلياً
        const dm = (typeof window !== 'undefined' && window.DataManager) ||
            (typeof DataManager !== 'undefined' && DataManager);
        if (dm && typeof dm.save === 'function') {
            dm.save();
        }

        if (syncSheets && typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.sendRequest === 'function') {
            // حفظ لقطة الأنواع الكاملة في ViolationTypes عبر الخادم (diff + حذف صفوف حقيقي)
            GoogleIntegration.sendRequest({
                action: 'saveViolationTypes',
                data: {
                    violationTypes: AppState.appData.violationTypes || [],
                    userData: AppState.currentUser || {}
                }
            }).catch(() => { });
        }
    },

    syncViolations() {
        if (typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('Violations', AppState.appData.violations).catch(() => { });
        }
    }
};

// ===== QR Code Helper =====
const QRCode = (() => {
    const existing = (typeof window !== 'undefined' && window.QRCode && typeof window.QRCode.generate === 'function')
        ? window.QRCode
        : (typeof globalThis !== 'undefined' && globalThis.QRCode && typeof globalThis.QRCode.generate === 'function')
            ? globalThis.QRCode
            : null;
    const FALLBACK_ENDPOINT = 'https://api.qrserver.com/v1/create-qr-code/';
    const MIN_SIZE = 80;
    const MAX_SIZE = 600;

    function clampSize(size) {
        const parsed = Number(size) || 0;
        return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(parsed)));
    }

    function tryExisting(data, size) {
        if (!existing) return null;
        try {
            const result = existing.generate(data, size);
            if (result) {
                return result;
            }
        } catch (error) {
            Utils.safeWarn('⚠️ فشل استخدام مولد QR الحالي:', error);
        }
        return null;
    }

    function tryQrcodeLibrary(data, size) {
        if (typeof qrcode !== 'function') return null;
        try {
            const qr = qrcode(0, 'M');
            qr.addData(String(data));
            qr.make();
            const moduleCount = typeof qr.getModuleCount === 'function' ? qr.getModuleCount() : 0;
            const cellSize = moduleCount ? Math.max(1, Math.floor(size / moduleCount)) : Math.max(2, Math.floor(size / 25));
            return qr.createDataURL(cellSize, 2);
        } catch (error) {
            Utils.safeWarn('⚠️ فشل استخدام مكتبة qrcode:', error);
        }
        return null;
    }

    function buildFallbackUrl(data, size) {
        const encoded = encodeURIComponent(String(data));
        return `${FALLBACK_ENDPOINT}?size=${size}x${size}&data=${encoded}`;
    }

    function generate(data, size = 200) {
        if (!data) return null;
        const clampedSize = clampSize(size);

        const trimmed = String(data).trim();
        if (!trimmed) return null;

        const existingResult = tryExisting(trimmed, clampedSize);
        if (existingResult) return existingResult;

        const libraryResult = tryQrcodeLibrary(trimmed, clampedSize);
        if (libraryResult) return libraryResult;

        return buildFallbackUrl(trimmed, clampedSize);
    }

    return { generate };
})();

if (typeof window !== 'undefined') {
    window.QRCode = QRCode;
}

// ===== Notification System =====
// تعريف Notification كمتغير عام (global) ليكون متاحاً لجميع الملفات
window.Notification = {
    // تخزين الإشعارات النشطة
    activeNotifications: new Map(),

    /**
     * عرض إشعار محسن مع دعم للعناوين والأوصاف والأزرار
     * @param {string|object} messageOrOptions - الرسالة أو كائن الخيارات
     * @param {string} type - نوع الإشعار (info, success, warning, error, emergency)
     * @param {number} duration - مدة العرض بالميلي ثانية (0 = دائم حتى الإغلاق اليدوي)
     * @param {object} options - خيارات إضافية (title, description, actions, priority, persistent, sound)
     */
    show(messageOrOptions, type = 'info', duration = 3000, options = {}) {
        // دعم الصيغتين: show(message, type, duration) و show({message, type, ...})
        let config = {};
        if (typeof messageOrOptions === 'string') {
            config = {
                message: messageOrOptions,
                type: type,
                duration: duration,
                ...options
            };
        } else {
            config = {
                message: messageOrOptions.message || '',
                type: messageOrOptions.type || type,
                duration: messageOrOptions.duration !== undefined ? messageOrOptions.duration : duration,
                title: messageOrOptions.title,
                description: messageOrOptions.description,
                actions: messageOrOptions.actions || [],
                priority: messageOrOptions.priority || 'normal', // normal, high, critical
                persistent: messageOrOptions.persistent || false,
                sound: messageOrOptions.sound !== false, // true by default for critical
                onClick: messageOrOptions.onClick,
                appendTo: messageOrOptions.appendTo,
                ...options
            };
        }

        let container = document.getElementById('notification-container');
        if (config.appendTo) {
            const el = typeof config.appendTo === 'string'
                ? document.querySelector(config.appendTo)
                : config.appendTo;
            if (el && el.nodeType === 1) container = el;
        }
        if (!container) {
            console.warn('⚠️ notification-container غير موجود');
            return null;
        }

        // تحديد مدة العرض بناءً على الأولوية
        if (config.priority === 'critical' && !config.persistent) {
            config.duration = config.duration || 10000; // 10 ثواني للتنبيهات الحرجة
        } else if (config.priority === 'high' && !config.persistent) {
            config.duration = config.duration || 6000; // 6 ثواني للتنبيهات العالية
        } else if (!config.persistent && config.duration === undefined) {
            config.duration = 3000; // 3 ثواني افتراضياً
        }

        // تشغيل الصوت للتنبيهات المهمة
        if (config.sound && (config.priority === 'critical' || config.priority === 'high' || config.type === 'emergency')) {
            this.playNotificationSound(config.priority);
        }

        // إنشاء عنصر الإشعار
        const notificationId = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `notification notification-${config.type} notification-priority-${config.priority}`;
        notification.setAttribute('data-priority', config.priority);

        // إضافة تأثير النبض للتنبيهات الحرجة
        if (config.priority === 'critical') {
            notification.classList.add('notification-critical-pulse');
        }

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
            emergency: 'fa-bell'
        };

        const icon = icons[config.type] || icons.info;

        // بناء محتوى الإشعار
        let contentHTML = '';

        if (config.title) {
            contentHTML += `<div class="notification-title">${Utils.escapeHTML(config.title)}</div>`;
        }

        contentHTML += `<div class="notification-message">${Utils.escapeHTML(config.message)}</div>`;

        if (config.description) {
            contentHTML += `<div class="notification-description">${Utils.escapeHTML(config.description)}</div>`;
        }

        // إضافة الأزرار إذا كانت موجودة
        let actionsHTML = '';
        if (config.actions && config.actions.length > 0) {
            actionsHTML = '<div class="notification-actions">';
            config.actions.forEach((action, index) => {
                const actionClass = action.primary ? 'notification-action-primary' : 'notification-action-secondary';
                actionsHTML += `<button class="notification-action ${actionClass}" data-action-index="${index}">${Utils.escapeHTML(action.label)}</button>`;
            });
            actionsHTML += '</div>';
        }

        notification.innerHTML = `
            <div class="notification-icon-wrapper">
                <i class="fas ${icon} notification-icon"></i>
            </div>
            <div class="notification-content">
                ${contentHTML}
                ${actionsHTML}
            </div>
            ${config.persistent ? '<button class="notification-close" aria-label="إغلاق">&times;</button>' : ''}
        `;

        // إضافة مستمعي الأحداث
        if (config.onClick) {
            notification.style.cursor = 'pointer';
            notification.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-action') && !e.target.closest('.notification-close')) {
                    config.onClick(notificationId);
                }
            });
        }

        // إضافة مستمعي الأحداث للأزرار
        if (config.actions && config.actions.length > 0) {
            notification.querySelectorAll('.notification-action').forEach((btn, index) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = config.actions[index];
                    if (action.onClick) {
                        action.onClick(notificationId);
                    }
                    if (action.dismiss !== false) {
                        this.dismiss(notificationId);
                    }
                });
            });
        }

        // إضافة زر الإغلاق للإشعارات الدائمة
        if (config.persistent) {
            const closeBtn = notification.querySelector('.notification-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.dismiss(notificationId);
                });
            }
        }

        // إضافة الإشعار إلى الحاوية
        container.appendChild(notification);

        // إضافة إلى القائمة النشطة
        this.activeNotifications.set(notificationId, {
            element: notification,
            config: config,
            timeoutId: null
        });

        // إضافة تأثير الظهور
        setTimeout(() => {
            notification.classList.add('notification-visible');
        }, 10);

        // إزالة تلقائية إذا لم يكن دائماً
        if (!config.persistent && config.duration > 0) {
            const timeoutId = setTimeout(() => {
                this.dismiss(notificationId);
            }, config.duration);

            const notificationData = this.activeNotifications.get(notificationId);
            if (notificationData) {
                notificationData.timeoutId = timeoutId;
            }
        }

        return notificationId;
    },

    /**
     * إغلاق إشعار محدد
     */
    dismiss(notificationId) {
        const notificationData = this.activeNotifications.get(notificationId);
        if (!notificationData) return;

        const { element, timeoutId } = notificationData;

        // إلغاء الـ timeout إذا كان موجوداً
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // إضافة تأثير الإغلاق
        element.classList.add('notification-dismissing');

        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
            this.activeNotifications.delete(notificationId);
        }, 300);
    },

    /**
     * إغلاق جميع الإشعارات
     */
    dismissAll() {
        this.activeNotifications.forEach((data, id) => {
            this.dismiss(id);
        });
    },

    /**
     * تشغيل صوت الإشعار
     */
    playNotificationSound(priority = 'normal') {
        try {
            // استخدام Web Audio API لإنشاء صوت بسيط
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // ترددات مختلفة حسب الأولوية
            const frequencies = {
                critical: [800, 600, 800, 600], // نغمة متعددة للحرج
                high: [600, 500],
                normal: [400]
            };

            const freq = frequencies[priority] || frequencies.normal;
            let currentTime = audioContext.currentTime;

            freq.forEach((f, index) => {
                oscillator.frequency.setValueAtTime(f, currentTime);
                gainNode.gain.setValueAtTime(0.3, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.2);
                currentTime += 0.2;
            });

            oscillator.start(currentTime);
            oscillator.stop(currentTime + 0.1);
        } catch (error) {
            // في حالة فشل Web Audio API، يمكن استخدام صوت HTML5
            console.debug('Web Audio API غير متاح:', error);
        }
    },

    /**
     * إشعار طارئ محسن للتنبيهات الحرجة
     */
    emergency(options) {
        return this.show({
            ...options,
            type: 'emergency',
            priority: 'critical',
            persistent: options.persistent !== false, // دائم افتراضياً للطوارئ
            sound: true,
            duration: 0 // لا يختفي تلقائياً
        });
    },

    // دوال الاختصار المحسنة
    success(message, options = {}) {
        try {
            if (this && typeof this.show === 'function') {
                return this.show({ message, type: 'success', ...options });
            }
        } catch (error) {
            console.warn('⚠️ خطأ في Notification.success:', error);
        }
    },

    error(message, options = {}) {
        try {
            if (this && typeof this.show === 'function') {
                return this.show({ message, type: 'error', priority: 'high', ...options });
            }
        } catch (error) {
            console.warn('⚠️ خطأ في Notification.error:', error);
        }
    },

    warning(message, options = {}) {
        try {
            if (this && typeof this.show === 'function') {
                return this.show({ message, type: 'warning', priority: 'high', ...options });
            }
        } catch (error) {
            console.warn('⚠️ خطأ في Notification.warning:', error);
        }
    },

    info(message, options = {}) {
        try {
            if (this && typeof this.show === 'function') {
                return this.show({ message, type: 'info', ...options });
            }
        } catch (error) {
            console.warn('⚠️ خطأ في Notification.info:', error);
        }
    }
};

// ===== Loading System =====
const Loading = {
    normalizeOverlayPresentation(overlay, isVisible) {
        if (!overlay) return;

        const important = 'important';
        const currentDir = (document && document.documentElement && document.documentElement.dir === 'ltr') ? 'ltr' : 'rtl';

        overlay.style.setProperty('position', 'fixed', important);
        overlay.style.setProperty('inset', '0', important);
        overlay.style.setProperty('top', '0', important);
        overlay.style.setProperty('right', '0', important);
        overlay.style.setProperty('bottom', '0', important);
        overlay.style.setProperty('left', '0', important);
        overlay.style.setProperty('width', '100vw', important);
        overlay.style.setProperty('height', '100vh', important);
        overlay.style.setProperty('min-height', '100vh', important);
        overlay.style.setProperty('z-index', '999999', important);
        overlay.style.setProperty('transform', 'none', important);
        overlay.style.setProperty('rotate', 'none', important);
        overlay.style.setProperty('writing-mode', 'horizontal-tb', important);
        overlay.style.setProperty('direction', currentDir, important);
        overlay.style.setProperty('display', isVisible ? 'flex' : 'none', important);
        overlay.style.setProperty('visibility', isVisible ? 'visible' : 'hidden', important);
        overlay.style.setProperty('opacity', isVisible ? '1' : '0', important);
        overlay.style.setProperty('pointer-events', isVisible ? 'auto' : 'none', important);
        overlay.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
        overlay.dataset.loadingVisible = isVisible ? '1' : '0';

        const spinner = overlay.querySelector('.loading-spinner');
        if (spinner) {
            spinner.style.setProperty('transform', 'none', important);
            spinner.style.setProperty('rotate', 'none', important);
            spinner.style.setProperty('writing-mode', 'horizontal-tb', important);
            spinner.style.setProperty('direction', currentDir, important);
            spinner.style.setProperty('margin', '0 auto', important);
            spinner.style.setProperty('width', 'min(92vw, 520px)', important);
            spinner.style.setProperty('max-width', 'min(92vw, 520px)', important);
        }
    },
    currentProgress: 0,
    currentMessage: '',
    defaultMessage: 'جاري التحميل...',

    show(message = 'جاري التحميل...', progress = null) {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        // تقليل الإزعاج: داخل التطبيق الرئيسي لا نعرض طبقة التحميل الكاملة
        // عندما تكون الرسالة عامة فقط (ناتجة غالباً عن تحميلات خلفية/تلقائية).
        try {
            const isAppActive = document.body && document.body.classList.contains('app-active');
            const normalizedMessage = String(message || '').trim();
            const isGenericMessage = !normalizedMessage || normalizedMessage === this.defaultMessage;
            if (isAppActive && isGenericMessage) {
                return;
            }
        } catch (e) { /* ignore */ }

        try {
            window._hseLoadingSince = Date.now();
        } catch (e) { /* ignore */ }
        this.normalizeOverlayPresentation(overlay, true);
        this.currentMessage = message;

        // تحديث الرسالة
        const messageEl = overlay.querySelector('.loading-message') || overlay.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }

        // تحديث التقدم إذا كان موجوداً
        if (progress !== null) {
            this.setProgress(progress);
        }
    },

    setProgress(percentage, message = null) {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        this.currentProgress = Math.max(0, Math.min(100, percentage));

        const messageEl = overlay.querySelector('.loading-message') || overlay.querySelector('p');

        // تحديث الرسالة إذا تم توفيرها
        if (message) {
            this.currentMessage = message;
            if (messageEl) {
                messageEl.textContent = message;
            }
        }

        // إخفاء شريط التحميل غير المحدد (animation) عند عرض تقدم مئوي واضح
        const spinner = overlay.querySelector('.loading-spinner');
        if (spinner) {
            const anim = spinner.querySelector('.loading-progress-animation');
            if (anim && anim.parentElement && anim.parentElement.parentElement) {
                anim.parentElement.parentElement.style.display = 'none';
            }
        }

        // إنشاء أو تحديث شريط التقدم
        let progressBar = overlay.querySelector('.loading-progress-bar');
        let progressFill = overlay.querySelector('.loading-progress-fill');
        let progressText = overlay.querySelector('.loading-progress-text');

        if (!progressBar && spinner) {
            progressBar = document.createElement('div');
            progressBar.className = 'loading-progress-bar';
            progressBar.style.cssText = 'width: 300px; height: 8px; background: rgba(59, 130, 246, 0.2); border-radius: 4px; margin: 12px auto 8px; overflow: hidden;';

            progressFill = document.createElement('div');
            progressFill.className = 'loading-progress-fill';
            progressFill.style.cssText = 'height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 4px; transition: width 0.3s ease; width: 0%;';

            progressText = document.createElement('div');
            progressText.className = 'loading-progress-text';
            progressText.style.cssText = 'text-align: center; color: #374151; font-weight: 700; font-size: 1.125rem; margin-top: 4px; font-family: Cairo, Segoe UI, sans-serif;';

            progressBar.appendChild(progressFill);
            // ترتيب: النص ثم الشريط ثم النسبة المئوية أسفل الشريط
            if (messageEl) {
                messageEl.insertAdjacentElement('afterend', progressBar);
                progressBar.insertAdjacentElement('afterend', progressText);
            } else {
                spinner.appendChild(progressBar);
                spinner.appendChild(progressText);
            }
        }

        if (progressFill) {
            progressFill.style.width = `${this.currentProgress}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(this.currentProgress)}%`;
            progressText.style.color = '#374151';
        }
    },

    updateMessage(message) {
        this.currentMessage = message;
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        const messageEl = overlay.querySelector('.loading-message') || overlay.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
    },

    hide() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            this.normalizeOverlayPresentation(overlay, false);
            this.currentProgress = 0;
            this.currentMessage = '';
            // إعادة إظهار شريط التحميل غير المحدد للمرة القادمة
            try {
                const spinner = overlay.querySelector('.loading-spinner');
                if (spinner) {
                    const anim = spinner.querySelector('.loading-progress-animation');
                    if (anim && anim.parentElement && anim.parentElement.parentElement) {
                        anim.parentElement.parentElement.style.display = '';
                    }
                }
            } catch (e) { /* ignore */ }
        }
        try {
            delete window._hseLoadingSince;
        } catch (e) { /* ignore */ }
    }
};

// ===== PDF Templates =====
const PDFTemplates = {
    buildDocument({
        title = '',
        content = '',
        formCode = '',
        createdAt = new Date(),
        updatedAt = null,
        meta = {},
        includeQRCode = true,
        qrData = null
    } = {}) {
        const escape = (value) => {
            if (value === undefined || value === null) return '';
            if (typeof Utils !== 'undefined' && Utils && typeof Utils.escapeHTML === 'function') {
                return Utils.escapeHTML(String(value));
            }
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const fallbackCompanyName = typeof DEFAULT_COMPANY_NAME !== 'undefined' ? DEFAULT_COMPANY_NAME : 'Americana HSE Management System';
        const companyNameRaw = AppState?.companySettings?.name || fallbackCompanyName;
        const companySecondaryNameRaw = AppState?.companySettings?.secondaryName || '';
        const companySecondaryNameTrimmed = companySecondaryNameRaw ? String(companySecondaryNameRaw).trim() : '';
        const companyName = escape(companyNameRaw);
        const companySecondaryName = escape(companySecondaryNameTrimmed);
        const companyAddress = escape(AppState?.companySettings?.address || '');
        const contactPhone = escape(AppState?.companySettings?.phone || '');
        const contactEmail = escape(AppState?.companySettings?.email || '');
        const logo = AppState?.companyLogo || '';
        const companyInitials = escape(companyNameRaw.trim().slice(0, 2) || 'HS');

        // الحصول على إعدادات الخط واللون
        const nameFontSize = AppState?.companySettings?.nameFontSize || 16;
        const secondaryNameFontSize = AppState?.companySettings?.secondaryNameFontSize || 14;
        const secondaryNameColor = AppState?.companySettings?.secondaryNameColor || '#6B7280';

        const generateDate = createdAt ? new Date(createdAt) : new Date();
        const updateDate = updatedAt ? new Date(updatedAt) : generateDate;

        const formatDateTime = (date) => {
            if (!date) return '';
            if (typeof Utils !== 'undefined' && Utils && typeof Utils.formatDateTime === 'function') {
                return Utils.formatDateTime(date, 'ar-EG');
            }
            try {
                const d = new Date(date);
                if (isNaN(d.getTime())) return '';
                const formatted = d.toLocaleString('ar-EG', {
                    hour12: true,
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                // Ensure AM/PM is displayed correctly in Arabic
                return formatted.replace(/ص/g, 'ص').replace(/م/g, 'م');
            } catch (error) {
                return escape(date);
            }
        };

        const enhancedContent = (content || '')
            .replace(/<table(?![^>]*class=)/g, '<table class="report-table"')
            .replace(/<ul(?![^>]*class=)/g, '<ul class="report-list"');

        const isDailySafetyTemplate = String(meta?.source || '').trim() === 'DailySafetyCheckList';
        const excludedMetaKeys = ['version', 'releaseDate', 'revisionDate', 'issueDate', 'includeQRCode', 'qrData', 'modifiedAt', 'titleEn', 'titleAr', 'footerLegendHtml', 'compactPdfFooter'];
        const metaRows = Object.entries(meta || {})
            .filter(([key, value]) => {
                if (value === undefined || value === null || value === '') return false;
                if (excludedMetaKeys.includes(key)) return false;
                if (isDailySafetyTemplate && key === 'source') return false;
                return true;
            })
            .map(([key, value]) => `
                <div class="meta-item">
                    <span class="meta-label">${escape(key)}</span>
                    <span class="meta-value">${escape(value)}</span>
                </div>
            `).join('');

        const contactLine = [companyAddress, contactPhone, contactEmail]
            .filter(Boolean)
            .join(' | ');

        // Get version from settings or meta, with fallback
        const defaultVersion = AppState?.companySettings?.formVersion || '1.0';
        const versionDisplay = escape(meta?.version || meta?.revisionNumber || defaultVersion);
        const issueDateSource = meta?.releaseDate || meta?.issueDate || createdAt;
        const revisionDateSource = meta?.revisionDate || meta?.modifiedAt || updatedAt || issueDateSource;
        const issueDateDisplay = issueDateSource ? escape(formatDateTime(issueDateSource)) : '-';
        const revisionDateDisplay = revisionDateSource ? escape(formatDateTime(revisionDateSource)) : '-';

        const metaIncludeQRCode = (meta && Object.prototype.hasOwnProperty.call(meta, 'includeQRCode')) ? Boolean(meta.includeQRCode) : true;
        const shouldRenderQRCode = includeQRCode !== false && metaIncludeQRCode;
        const footerLegendHtml = (typeof meta?.footerLegendHtml === 'string' && meta.footerLegendHtml.trim()) ? meta.footerLegendHtml : '';
        const compactPdfFooter = !!meta?.compactPdfFooter;
        const qrPayloadRaw = qrData != null ? qrData
            : (meta && meta.qrData != null ? meta.qrData
                : `Form: ${formCode || '-'} | Title: ${title || ''} | Company: ${companyNameRaw}`);
        const qrText = typeof qrPayloadRaw === 'string' ? qrPayloadRaw : JSON.stringify(qrPayloadRaw);
        const qrTextForScript = JSON.stringify(qrText);
        const formCodeDisplay = escape(formCode || '-');
        // تسمية كود التقرير - يمكن تخصيصها من إعدادات الشركة
        const formCodeLabel = formCode ? 'كود التقرير' : '';
        return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${escape(title || '')}</title>
    <style>
        :root { color-scheme: light; }
        @page { size: A4; margin: 25mm 20mm; }
        html {
            height: 100%;
        }
        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
            background: #f3f4f6;
            margin: 0;
            color: #1f2937;
            line-height: 1.8;
            min-height: 100%;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
        }
        .report-wrapper {
            width: 100%;
            max-width: none;
            margin: 0 auto;
            background: #ffffff;
            padding: 32px;
            box-sizing: border-box;
            box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
            border-radius: 24px;
            flex: 1 0 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .report-header {
            display: grid;
            grid-template-columns: minmax(220px, 1.2fr) minmax(320px, 2fr) minmax(96px, 140px);
            align-items: center;
            gap: 18px;
            width: 100%;
            box-sizing: border-box;
            border-bottom: 3px solid #003865;
            padding-bottom: 16px;
            margin-bottom: 20px;
            flex-shrink: 0;
        }
        .report-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 96px;
            width: 100%;
        }
        .report-logo img {
            max-height: 72px;
            max-width: min(100%, 120px);
            object-fit: contain;
            border-radius: 0;
            box-shadow: none;
        }
        .brand-placeholder {
            width: 80px;
            height: 80px;
            border-radius: 18px;
            background: linear-gradient(135deg, #003865, #1e40af);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 20px;
            box-shadow: 0 15px 30px rgba(15, 23, 42, 0.2);
        }
        .company-brand {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            gap: 6px;
            min-width: 0;
            width: 100%;
            text-align: right;
            direction: rtl;
        }
        .company-brand .company-name {
            font-size: clamp(14px, ${nameFontSize}px, 24px);
            font-weight: 700;
            color: #0f172a;
            line-height: 1.45;
            word-break: break-word;
        }
        .company-brand .company-name-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: 100%;
        }
        .company-brand .company-name-secondary {
            font-size: clamp(12px, ${secondaryNameFontSize}px, 20px);
            font-weight: 700;
            color: ${secondaryNameColor};
            line-height: 1.45;
            word-break: break-word;
        }
        .header-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 10px;
            min-width: 0;
            width: 100%;
        }
        .header-info h1 {
            margin: 0;
            font-size: clamp(20px, 2.2vw, 34px);
            font-weight: 800;
            color: #003865;
            line-height: 1.3;
            letter-spacing: 0.6px;
            word-break: break-word;
        }
        .header-title-dual {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            text-align: center;
        }
        .header-title-dual .header-title-en {
            margin: 0;
            font-size: clamp(18px, 2vw, 30px);
            font-weight: 800;
            color: #003865;
            line-height: 1.3;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #003865;
            padding-bottom: 2px;
            word-break: break-word;
        }
        .header-title-dual .header-title-ar {
            margin: 0;
            font-size: clamp(20px, 2.2vw, 32px);
            font-weight: 800;
            color: #003865;
            line-height: 1.3;
            letter-spacing: 0;
            direction: rtl;
            unicode-bidi: isolate;
            font-family: 'Tahoma', 'Cairo', 'Segoe UI', sans-serif;
            border-bottom: 2px solid #003865;
            padding-bottom: 2px;
            word-break: break-word;
        }
        .report-wrapper.dsc-report .report-header {
            direction: ltr;
            grid-template-columns: 110px minmax(0, 1fr) minmax(280px, 360px);
            grid-template-rows: auto auto;
            grid-template-areas:
                "logo company company"
                "logo title title";
            align-items: start;
            gap: 10px 14px;
        }
        .report-wrapper.dsc-report .report-logo {
            grid-area: logo;
            justify-content: flex-start;
            align-self: start;
            width: 100%;
            margin-top: 0;
            min-height: 64px;
            display: flex;
            align-items: flex-start;
        }
        .report-wrapper.dsc-report .report-logo img {
            max-height: 64px;
            max-width: 96px;
        }
        .report-wrapper.dsc-report .header-info {
            grid-area: title;
            justify-content: flex-start;
            align-self: start;
            min-width: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            margin-top: 0;
        }
        .report-wrapper.dsc-report .header-title-dual {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        }
        .report-wrapper.dsc-report .header-title-dual .header-title-en {
            white-space: nowrap;
            line-height: 1.2;
            font-size: clamp(11px, 1.05vw, 17px);
            font-weight: 700;
            border-bottom-width: 1px;
        }
        .report-wrapper.dsc-report .header-title-dual .header-title-ar {
            white-space: nowrap;
            line-height: 1.2;
            font-size: clamp(12px, 1.15vw, 19px);
            font-weight: 700;
            width: 100%;
            letter-spacing: 0 !important;
            font-family: 'Cairo', 'Tahoma', 'Segoe UI', sans-serif !important;
            text-align: center;
            border-bottom-width: 1px;
        }
        .report-wrapper.dsc-report .company-brand {
            grid-area: company;
            align-items: flex-end;
            text-align: right;
            direction: rtl;
            justify-self: stretch;
            min-width: 0;
            gap: 4px;
            align-self: start;
            padding-top: 0;
        }
        .report-wrapper.dsc-report .company-brand .company-name,
        .report-wrapper.dsc-report .company-brand .company-name-secondary {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            line-height: 1.15;
            letter-spacing: 0 !important;
            font-family: 'Cairo', 'Tahoma', 'Segoe UI', sans-serif !important;
        }
        .report-wrapper.dsc-report .company-brand .company-name {
            font-size: clamp(10px, 0.9vw, 14px);
            font-weight: 700;
        }
        .report-wrapper.dsc-report .company-brand .company-name-secondary {
            font-size: clamp(9px, 0.78vw, 12px);
            font-weight: 600;
        }
        .report-wrapper.dsc-report .footer-bottom-text span {
            display: block;
            direction: rtl;
            unicode-bidi: isolate;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            letter-spacing: 0;
            font-family: 'Cairo', 'Tahoma', 'Segoe UI', sans-serif;
            line-height: 1.25;
        }
        .header-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px 24px;
            font-size: 13px;
            color: #475569;
            justify-content: center;
        }
        .header-meta span {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        .report-body {
            font-size: 15px;
            flex: 1 1 auto;
            min-height: 0;
        }
        .report-body p {
            margin-bottom: 16px;
        }
        .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            margin: 32px 0 16px;
            padding-right: 18px;
            border-right: 4px solid #003865;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-bottom: 28px;
        }
        .summary-card {
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            border: 1px solid #bfdbfe;
            border-radius: 16px;
            padding: 18px 20px;
            box-shadow: 0 20px 45px rgba(59, 130, 246, 0.16);
        }
        .summary-card .summary-label {
            display: block;
            font-size: 13px;
            color: #1d4ed8;
            margin-bottom: 6px;
            font-weight: 600;
        }
        .summary-card .summary-value {
            font-size: 24px;
            font-weight: 700;
            color: #1e40af;
        }
        .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        }
        .report-table thead th {
            background: linear-gradient(135deg, #003865, #1e40af);
            color: #ffffff;
            padding: 16px 20px;
            font-size: 14px;
            font-weight: 600;
            text-align: right;
            letter-spacing: 0.3px;
        }
        .report-table tbody td {
            background: #ffffff;
            padding: 14px 20px;
            font-size: 14px;
            border-bottom: 1px solid #e2e8f0;
        }
        .report-table tbody tr:nth-child(even) td {
            background: #f8fafc;
        }
        .report-table tbody tr:hover td {
            background: #eff6ff;
        }
        .empty-state {
            padding: 22px;
            border: 2px dashed #bfdbfe;
            border-radius: 16px;
            background: #f8fafc;
            color: #1e3a8a;
            margin-bottom: 28px;
            font-size: 14px;
        }
        .meta-block {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 10px;
            max-width: 420px;
            width: 100%;
        }
        .meta-item {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 13px;
            color: #475569;
            padding: 6px 0;
            border-bottom: 1px dashed rgba(148, 163, 184, 0.4);
        }
        .meta-label {
            font-weight: 600;
        }
        .report-footer {
            border-top: 2px solid #e0e7ff;
            margin-top: auto;
            padding: 12px 0 0;
            font-size: 12px;
            color: #475569;
            position: relative;
            width: 100%;
            box-sizing: border-box;
            flex-shrink: 0;
        }
        .pdf-footer-legend-wrap {
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 6px;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .pdf-footer-legend-wrap .ia-export-legend {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding: 8px 10px !important;
        }
        .pdf-compact-footer .report-footer {
            padding: 6px 0 0;
            font-size: 10px;
            border-top-width: 1px;
        }
        .pdf-compact-footer .footer-watermark-frame {
            padding: 8px 12px;
            margin-top: 4px;
            border-radius: 8px;
        }
        .pdf-compact-footer .footer-meta-line {
            font-size: 10px;
            gap: 8px;
            padding: 4px 0;
            margin-top: 2px;
        }
        .pdf-compact-footer .footer-meta-item {
            font-size: 10px;
            padding: 2px 4px;
            line-height: 1.45;
        }
        .pdf-compact-footer .footer-bottom {
            gap: 6px;
            margin-top: 0;
        }
        .pdf-compact-footer .footer-bottom-text {
            font-size: 10px;
            gap: 2px;
        }
        .footer-watermark-frame {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.03), rgba(37, 99, 235, 0.05));
            border: 2px solid rgba(59, 130, 246, 0.15);
            border-radius: 12px;
            padding: 16px 20px;
            margin-top: 12px;
            box-shadow: 0 3px 8px rgba(59, 130, 246, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5);
            position: relative;
            overflow: hidden;
            width: 100%;
            box-sizing: border-box;
        }
        .footer-watermark-frame::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(59, 130, 246, 0.02) 10px,
                rgba(59, 130, 246, 0.02) 20px
            );
            pointer-events: none;
            z-index: 0;
        }
        .footer-watermark-frame > * {
            position: relative;
            z-index: 1;
        }
        .footer-bottom {
            margin-top: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
            letter-spacing: 0.2px;
            width: 100%;
            box-sizing: border-box;
        }
        .footer-bottom-qr {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100px;
            height: 100px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(30,64,175,0.12), rgba(59,130,246,0.1));
            box-shadow: 0 12px 24px rgba(30, 64, 175, 0.15);
        }
        .footer-meta-line {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            align-items: start;
            gap: 16px;
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
            padding: 8px 0;
            border-top: 1px solid rgba(59, 130, 246, 0.1);
            margin-top: 6px;
            box-sizing: border-box;
        }
        .footer-meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            white-space: normal;
            min-width: 0;
            font-size: 13px;
            line-height: 1.6;
            word-break: break-word;
            direction: rtl;
            unicode-bidi: isolate;
            letter-spacing: 0;
            font-family: 'Tahoma', 'Cairo', 'Segoe UI', sans-serif;
        }
        .footer-meta-left {
            justify-content: flex-start;
            text-align: left;
            flex: 1 1 0;
        }
        .footer-meta-center {
            justify-content: center;
            text-align: center;
            flex: 1 1 0;
        }
        .footer-meta-right {
            justify-content: flex-end;
            text-align: right;
            flex: 1 1 0;
        }
        .footer-bottom-text {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            text-align: center;
            width: 100%;
        }
        .report-list {
            padding-right: 20px;
            margin-bottom: 24px;
        }
        .report-list li {
            margin-bottom: 8px;
        }
        .permit-intro {
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(30, 64, 175, 0.08));
            border: 1px solid rgba(37, 99, 235, 0.25);
            border-radius: 18px;
            padding: 18px 22px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #0f172a;
            line-height: 1.9;
        }
        .permit-note {
            background: rgba(15, 23, 42, 0.04);
            border-radius: 16px;
            padding: 16px 20px;
            margin-bottom: 24px;
            font-size: 13px;
            color: #1f2937;
            border-right: 4px solid #2563eb;
        }
        .permit-section {
            margin-top: 36px;
        }
        .permit-section + .permit-section {
            margin-top: 32px;
        }
        .permit-section .section-description {
            font-size: 13px;
            color: #475569;
            margin-bottom: 16px;
            background: rgba(148, 163, 184, 0.15);
            padding: 14px 16px;
            border-radius: 14px;
        }
        .permit-table th {
            width: 22%;
            background: rgba(15, 23, 42, 0.82);
            color: #ffffff;
        }
        .permit-table td {
            width: 28%;
        }
        .checklist-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-top: 18px;
        }
        .checklist-group {
            background: rgba(15, 23, 42, 0.03);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .checklist-group h4 {
            margin: 0;
            font-size: 14px;
            color: #1e40af;
            border-right: 3px solid #1e40af;
            padding-right: 10px;
        }
        .check-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: #1f2937;
        }
        .check-item .check-symbol {
            width: 22px;
            height: 22px;
            border: 2px solid rgba(37, 99, 235, 0.5);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            color: rgba(37, 99, 235, 0.8);
            background: #ffffff;
        }
        .check-item.is-checked {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(37, 99, 235, 0.08));
            border-radius: 12px;
            padding: 6px 10px;
            box-shadow: inset 0 1px 2px rgba(37, 99, 235, 0.12);
        }
        .check-item.is-checked .check-symbol {
            background: #1e3a8a;
            border-color: #1e3a8a;
            color: #ffffff;
        }
        .check-extra {
            margin-right: auto;
            font-size: 12px;
            color: #475569;
        }
        .signature-table td {
            height: 48px;
        }
        .signature-table .empty-cell {
            min-height: 42px;
            border-bottom: 2px dotted rgba(148, 163, 184, 0.6);
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 12px;
            margin: 18px 0;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 14px;
            background: rgba(148, 163, 184, 0.12);
            font-size: 13px;
            color: #0f172a;
        }
        .status-item .check-symbol {
            width: 22px;
            height: 22px;
            border: 2px solid rgba(15, 23, 42, 0.35);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            background: #ffffff;
            color: rgba(15, 23, 42, 0.7);
        }
        .status-item.is-checked {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.1));
        }
        .status-item.is-checked .check-symbol {
            border-color: #0f766e;
            background: #0f766e;
            color: #ffffff;
        }
        .placeholder-line {
            display: inline-block;
            min-width: 120px;
            border-bottom: 1px dashed rgba(148, 163, 184, 0.8);
            height: 16px;
            vertical-align: middle;
        }
        .notes-block {
            background: rgba(148, 163, 184, 0.12);
            border-radius: 14px;
            padding: 12px 16px;
            font-size: 12px;
            color: #475569;
            margin-top: 12px;
        }
        .footer-bottom {
            margin-top: 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            letter-spacing: 0.3px;
        }
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            html, body {
                height: auto;
                min-height: 100vh;
            }
            body {
                background: #ffffff !important;
                visibility: visible !important;
            }
            .report-wrapper {
                box-shadow: none;
                border-radius: 0;
                width: 100%;
                max-width: 100%;
                padding: 18px 16px;
                flex: 1 0 auto;
                min-height: 100vh;
                display: flex !important;
                flex-direction: column;
                visibility: visible !important;
                background: #ffffff !important;
            }
            .report-body {
                flex: 1 1 auto;
                visibility: visible !important;
            }
            .report-footer {
                margin-top: auto;
                visibility: visible !important;
                display: block !important;
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .report-header {
                visibility: visible !important;
                display: grid !important;
                break-inside: avoid;
                page-break-inside: avoid;
                grid-template-columns: minmax(180px, 1.3fr) minmax(280px, 2fr) minmax(84px, 110px);
                gap: 14px;
            }
            .pdf-footer-legend-wrap {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .summary-card {
                box-shadow: none;
            }
            .footer-bottom-qr {
                box-shadow: none;
            }
            .footer-watermark-frame {
                box-shadow: 0 2px 6px rgba(59, 130, 246, 0.1);
                border: 2px solid rgba(59, 130, 246, 0.2);
            }
            .footer-meta-line {
                gap: 12px;
            }
            .pdf-compact-footer .footer-meta-line {
                gap: 8px;
            }
        }
        @media (max-width: 1100px) {
            .report-wrapper {
                width: 100%;
                padding: 24px;
            }
            .report-header {
                grid-template-columns: minmax(180px, 1fr) minmax(240px, 1.6fr) minmax(84px, 110px);
                gap: 14px;
            }
        }
        @media (max-width: 760px) {
            .report-wrapper {
                padding: 20px 16px;
                border-radius: 18px;
            }
            .report-header {
                grid-template-columns: 1fr;
                justify-items: center;
                text-align: center;
            }
            .company-brand {
                align-items: center;
                text-align: center;
            }
            .report-logo {
                order: -1;
            }
            .footer-meta-line {
                grid-template-columns: 1fr;
                gap: 8px;
            }
            .footer-meta-left,
            .footer-meta-center,
            .footer-meta-right {
                justify-content: center;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="report-wrapper${isDailySafetyTemplate ? ' dsc-report' : ''}${compactPdfFooter ? ' pdf-compact-footer' : ''}">
        <div class="report-header">
            <div class="company-brand">
                <div class="company-name-group">
                    <div class="company-name">${companyName}</div>
                    ${companySecondaryNameTrimmed ? `<div class="company-name company-name-secondary">${companySecondaryName}</div>` : ''}
                </div>
            </div>
            <div class="header-info">
                ${(meta && meta.titleEn != null && meta.titleAr != null)
            ? `<div class="header-title-dual"><div class="header-title-ar">${escape(meta.titleAr)}</div><div class="header-title-en">${escape(meta.titleEn)}</div></div>`
            : `<h1>${escape(title || '')}</h1>`}
                ${metaRows ? `<div class="meta-block">${metaRows}</div>` : ''}
            </div>
            <div class="report-logo">
                ${logo ? `<img src="${logo}" alt="شعار الشركة">` : `<div class="brand-placeholder">${companyInitials}</div>`}
            </div>
        </div>
        <div class="report-body">
            ${enhancedContent}
        </div>
        <div class="report-footer">
            ${footerLegendHtml ? `<div class="pdf-footer-legend-wrap">${footerLegendHtml}</div>` : ''}
            <div class="footer-watermark-frame">
                <div class="footer-bottom">
                    ${shouldRenderQRCode ? `<div id="report-qr-code" class="footer-bottom-qr"></div>` : ''}
                    <div class="footer-meta-line">
                        ${formCode ? `<span class="footer-meta-item footer-meta-left" dir="rtl">كود النموذج: ${formCodeDisplay}</span>` : ''}
                        <span class="footer-meta-item ${formCode ? 'footer-meta-center' : 'footer-meta-left'}" dir="rtl">تاريخ الإصدار: ${issueDateDisplay}</span>
                        <span class="footer-meta-item ${formCode ? 'footer-meta-right' : 'footer-meta-center'}" dir="rtl">تاريخ التعديل: ${revisionDateDisplay}</span>
                        ${!formCode ? `<span class="footer-meta-item footer-meta-right" dir="rtl">رقم الإصدار: ${versionDisplay}</span>` : ''}
                    </div>
                    <div class="footer-bottom-text">
                        <span>${companyName}</span>
                        ${companySecondaryNameTrimmed ? `<span>${companySecondaryName}</span>` : '<span>إدارة السلامة والصحة المهنية والبيئة</span>'}
                    </div>
                </div>
            </div>
        </div>
    </div>
    ${shouldRenderQRCode ? `
    <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
    <script>
        (function() {
            try {
                if (typeof qrcode === 'undefined') { return; }
                var container = document.getElementById('report-qr-code');
                if (!container) { return; }
                var qr = qrcode(0, 'M');
                qr.addData(${qrTextForScript});
                qr.make();
                container.innerHTML = qr.createImgTag(6, 0);
                var img = container.querySelector('img');
                if (img) {
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    img.style.borderRadius = '12px';
                    img.alt = 'QR Code';
                }
            } catch (error) {
                Utils.safeError('Failed to generate QR code:', error);
            }
        })();
    </script>` : ''}
</body>
</html>`;
    }
};

const FormHeader = (typeof window !== 'undefined' && window.FormHeader) ? window.FormHeader : {};
FormHeader.generatePDFHTML = function (
    formCode,
    title,
    content,
    includeQrInHeader = false,
    includeQrInFooter = true,
    meta = {},
    createdAt = new Date(),
    updatedAt = null
) {
    const extendedMeta = Object.assign({}, meta);
    if (!Object.prototype.hasOwnProperty.call(extendedMeta, 'includeQRCode')) {
        extendedMeta.includeQRCode = includeQrInFooter;
    }
    const effectiveIncludeQr = extendedMeta.includeQRCode !== false && includeQrInFooter !== false;

    return PDFTemplates.buildDocument({
        title,
        content,
        formCode,
        createdAt,
        updatedAt,
        meta: extendedMeta,
        includeQRCode: effectiveIncludeQr,
        qrData: extendedMeta.qrData || null
    });
};

if (typeof window !== 'undefined') {
    window.FormHeader = FormHeader;
}

// ===== Employee Helper =====
const EmployeeHelper = {
    isResignedEmployee(employee) {
        if (!employee || typeof employee !== 'object') return false;
        const normalize = (v) => String(v ?? '').trim().toLowerCase();
        const statusFields = [
            employee.status,
            employee.employeeStatus,
            employee.workStatus,
            employee.employmentStatus,
            employee.state,
            employee.activeStatus
        ];
        const statusText = statusFields.map(normalize).filter(Boolean).join(' | ');
        if (!statusText) return false;
        return (
            statusText.includes('مستقيل') ||
            statusText.includes('استقال') ||
            statusText.includes('resign') ||
            statusText.includes('resigned') ||
            statusText.includes('terminated') ||
            statusText.includes('inactive')
        );
    },

    getEmployees(options = {}) {
        const includeResigned = options && typeof options === 'object' && options.includeResigned === true;
        const employees = AppState?.appData?.employees;
        const list = Array.isArray(employees) ? employees : [];
        if (includeResigned) return list;
        return list.filter(emp => !this.isResignedEmployee(emp));
    },

    _lookupSeq: 0,
    _employeesLoadPromise: null,

    /**
     * تحميل بيانات الموظفين عند الحاجة (lazy load).
     * هذا مهم لأن بعض نماذج `clinic.js` تعتمد على EmployeeHelper بدون استدعاء تحميل الموظفين.
     */
    async ensureEmployeesLoaded({ includeInactive = true } = {}) {
        try {
            const employees = this.getEmployees();
            if (Array.isArray(employees) && employees.length > 0) return true;

            // إذا كان هناك تحميل جارٍ، انتظر نفس الـ Promise.
            if (this._employeesLoadPromise) {
                await this._employeesLoadPromise;
                const after = this.getEmployees();
                return Array.isArray(after) && after.length > 0;
            }

            // تشغيل بدون Backend (file://) أو عدم وجود GoogleIntegration/Config.
            if (AppState?.runningWithoutBackend) return false;
            if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') return false;
            if (!AppState?.googleConfig?.appsScript?.enabled || !AppState?.googleConfig?.appsScript?.scriptUrl) return false;

            this._employeesLoadPromise = (async () => {
                let result = await GoogleIntegration.sendRequest({
                    action: 'getAllEmployees',
                    data: { filters: { includeInactive } }
                });

                const needFallback = !result || !result.success || !Array.isArray(result.data) || result.data.length === 0;
                if (needFallback) {
                    try {
                        const alt = await GoogleIntegration.sendRequest({
                            action: 'readFromSheet',
                            data: { sheetName: 'Employees' }
                        });
                        if (alt && alt.success && Array.isArray(alt.data) && alt.data.length > 0) {
                            result = { success: true, data: alt.data };
                        }
                    } catch (eAlt) {
                        // keep original result
                    }
                }

                if (result && result.success && Array.isArray(result.data)) {
                    AppState.appData = AppState.appData || {};
                    AppState.appData.employees = result.data;
                    if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.save === 'function') {
                        window.DataManager.save();
                    }
                    return true;
                }

                return false;
            })();

            return await this._employeesLoadPromise;
        } catch (e) {
            return false;
        } finally {
            this._employeesLoadPromise = null;
        }
    },

    normalize(value) {
        if (value === undefined || value === null) return '';
        return String(value).trim();
    },

    normalizeLower(value) {
        return this.normalize(value).toLowerCase();
    },

    getPrimaryCode(employee) {
        return this.normalize(
            employee?.employeeNumber ||
            employee?.employeeCode ||
            employee?.sapId ||
            employee?.id ||
            employee?.code ||
            employee?.cardId
        );
    },

    findByCode(term) {
        const normalized = this.normalizeLower(term);
        if (!normalized) return null;

        return this.getEmployees().find(emp => {
            return [
                emp?.employeeNumber,
                emp?.employeeCode,
                emp?.sapId,
                emp?.id,
                emp?.code,
                emp?.cardId
            ].some(value => this.normalizeLower(value) === normalized);
        }) || null;
    },

    findByName(term) {
        const normalized = this.normalizeLower(term);
        if (!normalized) return null;
        return this.getEmployees().find(emp => this.normalizeLower(emp?.name) === normalized) || null;
    },

    findByPartial(term) {
        const normalized = this.normalizeLower(term);
        if (!normalized) return null;

        return this.getEmployees().find(emp => {
            return (
                this.normalizeLower(emp?.employeeNumber).includes(normalized) ||
                this.normalizeLower(emp?.employeeCode).includes(normalized) ||
                this.normalizeLower(emp?.sapId).includes(normalized) ||
                this.normalizeLower(emp?.id).includes(normalized) ||
                this.normalizeLower(emp?.code).includes(normalized) ||
                this.normalizeLower(emp?.cardId).includes(normalized) ||
                this.normalizeLower(emp?.name).includes(normalized)
            );
        }) || null;
    },

    findByTerm(term) {
        return this.findByCode(term) || this.findByName(term) || this.findByPartial(term);
    },

    findMatches(term, limit = 10) {
        const normalized = this.normalizeLower(term);
        if (!normalized) return [];

        return this.getEmployees()
            .filter(emp => {
                return (
                    this.normalizeLower(emp?.employeeNumber).includes(normalized) ||
                    this.normalizeLower(emp?.employeeCode).includes(normalized) ||
                    this.normalizeLower(emp?.sapId).includes(normalized) ||
                    this.normalizeLower(emp?.id).includes(normalized) ||
                    this.normalizeLower(emp?.code).includes(normalized) ||
                    this.normalizeLower(emp?.cardId).includes(normalized) ||
                    this.normalizeLower(emp?.name).includes(normalized)
                );
            })
            .slice(0, limit);
    },

    formatEmployeeDisplay(employee) {
        if (!employee) return '';
        const code = this.getPrimaryCode(employee);
        const name = this.normalize(employee?.name);
        const position = this.normalize(employee?.position || employee?.jobTitle);
        const department = this.normalize(employee?.department || employee?.unit || employee?.section);
        const parts = [];
        if (code) parts.push(code);
        if (name) parts.push(name);
        if (position) parts.push(position);
        if (department) parts.push(department);
        return parts.join(' - ');
    },

    setupEmployeeCodeSearch(codeInputId, nameInputId = null, onSelect = null, options = {}) {
        const codeInput = typeof codeInputId === 'string' ? document.getElementById(codeInputId) : codeInputId;
        if (!codeInput) return;

        const inlineAlertId = options.inlineAlertId || null;
        /** blur-enter: تحذير عند الخروج من الحقل أو Enter (ليس أثناء الكتابة). enter: تحذير فقط عند Enter (مناسب للعيادة). never: لا تحذير */
        const notFoundWarn = options.employeeNotFoundWarn || 'blur-enter';

        const clearInlineAlert = () => {
            if (!inlineAlertId) return;
            const box = document.getElementById(inlineAlertId);
            if (box) {
                box.innerHTML = '';
                box.style.display = 'none';
            }
        };

        const showNotFoundMessage = (msg) => {
            if (inlineAlertId) {
                const box = document.getElementById(inlineAlertId);
                if (box) {
                    box.style.display = 'block';
                    const safe = Utils.escapeHTML(msg);
                    box.innerHTML = `<div class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 text-sm text-right shadow-sm" role="alert"><i class="fas fa-exclamation-triangle ml-2" aria-hidden="true"></i>${safe}</div>`;
                    try {
                        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    } catch (e) { /* ignore */ }
                    return;
                }
            }
            if (typeof Notification !== 'undefined') {
                Notification.warning(msg);
            }
        };

        const nameInput = nameInputId ? document.getElementById(nameInputId) : null;

        /**
         * @param {'input-debounce'|'blur'|'enter'} source
         */
        const performLookup = async (source = 'input-debounce') => {
            const term = this.normalize(codeInput.value);
            if (!term) {
                if (nameInput) nameInput.value = '';
                onSelect?.(null);
                clearInlineAlert();
                return;
            }

            const lookupSeq = ++this._lookupSeq;
            await this.ensureEmployeesLoaded({ includeInactive: true });

            if (lookupSeq !== this._lookupSeq) return;

            // أثناء الكتابة: مطابقة تامة فقط لتجنب اختيار موظف خاطئ عند أرقام قصيرة؛ Enter/blur: findByTerm (يشمل الجزئي).
            const employee = source === 'input-debounce'
                ? (this.findByCode(term) || this.findByName(term))
                : this.findByTerm(term);
            if (employee) {
                clearInlineAlert();
                const primaryCode = this.getPrimaryCode(employee);
                if (primaryCode) codeInput.value = primaryCode;
                if (nameInput) nameInput.value = employee.name || '';
                onSelect?.(employee);
                return;
            }

            onSelect?.(null);

            const minLen = 4;
            if (term.length < minLen || notFoundWarn === 'never') return;

            let shouldWarn = false;
            if (notFoundWarn === 'enter') {
                shouldWarn = source === 'enter';
            } else if (notFoundWarn === 'blur-enter') {
                shouldWarn = source === 'blur' || source === 'enter';
            }

            if (shouldWarn) {
                showNotFoundMessage('لم يتم العثور على موظف بهذا الكود أو الاسم');
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                performLookup('enter').catch(() => {});
            }
        };

        let inputTimeout = null;
        const handleInput = () => {
            clearInlineAlert();
            if (inputTimeout) clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                performLookup('input-debounce').catch(() => {});
            }, 300);
        };

        if (codeInput._employeeHelperLookupBlur) {
            codeInput.removeEventListener('blur', codeInput._employeeHelperLookupBlur);
        }
        if (codeInput._employeeHelperKeyDown) {
            codeInput.removeEventListener('keydown', codeInput._employeeHelperKeyDown);
        }
        if (codeInput._employeeHelperInput) {
            codeInput.removeEventListener('input', codeInput._employeeHelperInput);
        }

        const onBlur = () => performLookup('blur').catch(() => {});
        codeInput._employeeHelperLookupBlur = onBlur;
        codeInput._employeeHelperKeyDown = handleKeyDown;
        codeInput._employeeHelperInput = handleInput;

        codeInput.addEventListener('blur', onBlur);
        codeInput.addEventListener('keydown', handleKeyDown);
        codeInput.addEventListener('input', handleInput);
    },

    setupAutocomplete(nameInputId, onSelect = null) {
        const input = typeof nameInputId === 'string' ? document.getElementById(nameInputId) : nameInputId;
        if (!input) return;

        const listId = `${input.id || nameInputId}-employee-helper-list`;
        let dataList = document.getElementById(listId);
        if (!dataList) {
            dataList = document.createElement('datalist');
            dataList.id = listId;
            document.body.appendChild(dataList);
        }

        const rebuildOptions = () => {
            const optionsHTML = this.getEmployees().map(emp => {
                const display = Utils.escapeHTML(this.formatEmployeeDisplay(emp));
                const value = Utils.escapeHTML(emp?.name || '');
                return `<option value="${value}" data-code="${Utils.escapeHTML(this.getPrimaryCode(emp))}">${display}</option>`;
            }).join('');
            dataList.innerHTML = optionsHTML;
        };

        rebuildOptions();

        // Lazy load: أعد بناء الداتا لست إذا كانت employees غير محمّلة.
        this.ensureEmployeesLoaded({ includeInactive: true }).then(() => rebuildOptions()).catch(() => {});

        input.setAttribute('list', listId);

        const handleSelection = async () => {
            const term = this.normalize(input.value);
            if (!term) {
                onSelect?.(null);
                return;
            }

            try {
                let employee = this.findByTerm(term);
                if (!employee && term.length >= 4) {
                    await this.ensureEmployeesLoaded({ includeInactive: true });
                    employee = this.findByTerm(term);
                }
                onSelect?.(employee || null);
            } catch (e) {
                onSelect?.(null);
            }
        };

        if (input._employeeHelperAutocomplete) {
            input.removeEventListener('change', input._employeeHelperAutocomplete);
            input.removeEventListener('blur', input._employeeHelperAutocomplete);
        }

        input._employeeHelperAutocomplete = handleSelection;
        input.addEventListener('change', () => handleSelection().catch(() => {}));
        input.addEventListener('blur', () => handleSelection().catch(() => {}));
    }
};

if (typeof window !== 'undefined') {
    window.EmployeeHelper = EmployeeHelper;
}

// ===== PPE Matrix Helper =====
const PPEMatrix = {
    instances: {},
    activeContainerId: null,
    predefinedItems: [
        'خوذة أمان',
        'نظارات وقاية',
        'قفازات',
        'أحذية أمان',
        'سترة عاكسة',
        'سدادات أذن',
        'كمامة',
        'بدلة واقية',
        'حزام أمان',
        'معدات حماية تنفسية'
    ],

    collectPositions() {
        const matrix = AppState?.appData?.employeePPEMatrix || {};
        const employees = AppState?.appData?.employees || [];

        const fromMatrix = Object.keys(matrix);
        const fromEmployees = employees
            .map(emp => (emp?.position || '').trim())
            .filter(Boolean);

        return Array.from(new Set([...fromMatrix, ...fromEmployees]))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
    },

    collectItems() {
        const matrix = AppState?.appData?.employeePPEMatrix || {};
        const ppeList = AppState?.appData?.ppe || [];

        const fromMatrix = Object.values(matrix)
            .flatMap(entry => entry?.requiredPPE || []);
        const fromReceipts = ppeList
            .map(item => item?.equipmentType || '')
            .filter(Boolean);

        return Array.from(new Set([
            ...this.predefinedItems,
            ...fromMatrix,
            ...fromReceipts
        ])).filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
    },

    getPositionItems(position) {
        if (!position) return [];
        const matrix = AppState?.appData?.employeePPEMatrix || {};
        const entry = matrix[position];
        if (!entry) return [];
        return Array.isArray(entry.requiredPPE) ? entry.requiredPPE.filter(Boolean) : [];
    },

    renderCheckboxMarkup(items = [], selectedItems = []) {
        const selectedSet = new Set(selectedItems.filter(Boolean));
        if (!items.length) {
            return `
                <div class="text-sm text-gray-500 bg-gray-100 border border-dashed border-gray-300 rounded p-3">
                    لا توجد أنواع مهمات وقاية مسجلة مسبقاً. يمكنك إضافة أنواع جديدة يدوياً.
                </div>
            `;
        }

        return items.map(item => `
            <label class="ppe-matrix-option flex items-center p-2 border border-gray-200 rounded hover:bg-blue-50 transition-colors cursor-pointer">
                <input type="checkbox" class="ppe-matrix-item ml-2 rounded border-gray-300 text-blue-600"
                    value="${Utils.escapeHTML(item)}" ${selectedSet.has(item) ? 'checked' : ''}>
                <span class="text-sm font-medium text-gray-700">${Utils.escapeHTML(item)}</span>
            </label>
        `).join('');
    },

    generate(containerId = 'ppe-matrix', options = {}) {
        const positions = this.collectPositions();
        const availableItems = this.collectItems();
        const omitPositionSelector = options.omitPositionSelector === true;
        const omitFooterHint = options.omitFooterHint === true;

        const selectedPosition = options.selectedPosition && positions.includes(options.selectedPosition)
            ? options.selectedPosition
            : (positions[0] || '');
        const selectedItems = options.selectedItems && Array.isArray(options.selectedItems)
            ? options.selectedItems
            : (omitPositionSelector ? [] : this.getPositionItems(selectedPosition));

        const hasPositions = positions.length > 0;
        const positionSelectHTML = omitPositionSelector ? '' : (hasPositions ? `
            <div class="mb-4">
                <label for="ppe-matrix-position" class="block text-sm font-semibold text-gray-700 mb-2">اختر الوظيفة</label>
                <select id="ppe-matrix-position" class="form-input ppe-matrix-position">
                    <option value="">-- اختر الوظيفة --</option>
                    ${positions.map(position => `
                        <option value="${Utils.escapeHTML(position)}" ${position === selectedPosition ? 'selected' : ''}>
                            ${Utils.escapeHTML(position)}
                        </option>
                    `).join('')}
                    <option value="__custom__">أخرى (إدخال يدوي)</option>
                </select>
                <input type="text" class="form-input ppe-matrix-position-custom mt-2 hidden" placeholder="أدخل اسم الوظيفة">
                <p class="text-xs text-gray-500 mt-1">يتم تحميل مهمات الوقاية تلقائياً عند اختيار الوظيفة إذا كانت مسجلة مسبقاً.</p>
            </div>
        ` : `
            <div class="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                لا توجد وظائف مسجلة في مصفوفة مهمات الوقاية. يمكنك إضافة مهمات الوقاية المطلوبة يدوياً أدناه ثم حفظ النموذج.
            </div>
        `);

        const rootExtraClass = omitPositionSelector ? ' ppe-matrix-standalone' : '';
        const footerHTML = omitFooterHint ? '' : `
                <p class="text-xs text-gray-500">
                    يتم حفظ الاختيارات مع النموذج الحالي فقط. لتحديث مصفوفة مهمات الوقاية بشكل دائم، استخدم شاشة "إدارة مهمات الوقاية".
                </p>`;

        const html = `
            <div class="ppe-matrix-root space-y-4${rootExtraClass}" data-matrix-id="${containerId}">
                ${positionSelectHTML}
                <div class="ppe-matrix-items grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    ${this.renderCheckboxMarkup(availableItems, selectedItems)}
                </div>
                <div class="flex items-center gap-2">
                    <input type="text" class="form-input flex-1 ppe-matrix-custom-input" placeholder="أضف مهمة وقاية مخصصة">
                    <button type="button" class="btn-secondary ppe-matrix-add-btn">
                        <i class="fas fa-plus ml-2"></i>إضافة
                    </button>
                </div>${footerHTML}
            </div>
            <script>
                setTimeout(() => {
                    if (window.PPEMatrix && typeof PPEMatrix.init === 'function') {
                        PPEMatrix.init('${containerId}', ${JSON.stringify({
            positions,
            items: availableItems,
            selectedPosition: omitPositionSelector ? '' : selectedPosition,
            selectedItems
        })});
                    }
                }, 0);
            </script>
        `;

        return html;
    },

    init(containerId, config = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const root = container.querySelector(`[data-matrix-id="${containerId}"]`);
        if (!root) return;

        const instance = {
            container,
            root,
            positions: Array.isArray(config.positions) ? [...config.positions] : [],
            items: Array.isArray(config.items) ? [...new Set(config.items.filter(Boolean))] : [],
            selectedItems: new Set((config.selectedItems || []).filter(Boolean)),
            selectedPosition: config.selectedPosition || '',
            customPosition: ''
        };

        this.instances[containerId] = instance;
        this.activeContainerId = containerId;

        this.bindEvents(instance);
    },

    bindEvents(instance) {
        const { root } = instance;
        if (!root) return;

        const positionSelect = root.querySelector('.ppe-matrix-position');
        const customPositionInput = root.querySelector('.ppe-matrix-position-custom');
        const addBtn = root.querySelector('.ppe-matrix-add-btn');
        const customInput = root.querySelector('.ppe-matrix-custom-input');

        if (positionSelect) {
            positionSelect.addEventListener('change', (event) => {
                const value = event.target.value;
                if (value === '__custom__') {
                    instance.selectedPosition = '';
                    instance.customPosition = '';
                    if (customPositionInput) {
                        customPositionInput.classList.remove('hidden');
                        customPositionInput.required = true;
                        customPositionInput.focus();
                    }
                    instance.selectedItems = new Set();
                    this.renderItems(instance);
                } else {
                    if (customPositionInput) {
                        customPositionInput.classList.add('hidden');
                        customPositionInput.required = false;
                        customPositionInput.value = '';
                    }
                    instance.selectedPosition = value;
                    instance.customPosition = '';
                    instance.selectedItems = new Set(this.getPositionItems(value));
                    instance.items = Array.from(new Set([...instance.items, ...instance.selectedItems]));
                    this.renderItems(instance);
                }
            });
        }

        if (customPositionInput) {
            customPositionInput.addEventListener('input', (event) => {
                instance.customPosition = event.target.value.trim();
            });
        }

        root.addEventListener('change', (event) => {
            if (event.target.matches('.ppe-matrix-item')) {
                const value = event.target.value;
                if (event.target.checked) {
                    instance.selectedItems.add(value);
                } else {
                    instance.selectedItems.delete(value);
                }
            }
        });

        if (addBtn && customInput) {
            addBtn.addEventListener('click', () => {
                const value = customInput.value.trim();
                if (!value) {
                    if (typeof Notification !== 'undefined') {
                        Notification.warning('يرجى إدخال اسم مهمة الوقاية قبل الإضافة');
                    }
                    return;
                }
                if (!instance.items.includes(value)) {
                    instance.items.push(value);
                    instance.items.sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
                }
                instance.selectedItems.add(value);
                customInput.value = '';
                this.renderItems(instance);
            });
        }

        this.renderItems(instance);
    },

    renderItems(instance) {
        const itemsContainer = instance?.root?.querySelector('.ppe-matrix-items');
        if (!itemsContainer) return;

        const markup = this.renderCheckboxMarkup(instance.items, Array.from(instance.selectedItems));
        itemsContainer.innerHTML = markup;
    },

    getActiveInstance(containerId = null) {
        const id = containerId || this.activeContainerId;
        if (!id) return null;
        return this.instances[id] || null;
    },

    getSelected(containerId = null) {
        const instance = this.getActiveInstance(containerId);
        if (!instance) return [];
        return Array.from(instance.selectedItems);
    },

    setSelected(selectedItems = [], containerId = null) {
        const instance = this.getActiveInstance(containerId);
        if (!instance) return;
        instance.selectedItems = new Set((selectedItems || []).filter(Boolean));
        instance.items = Array.from(new Set([...instance.items, ...instance.selectedItems]));
        this.renderItems(instance);
    },

    getSelectedPosition(containerId = null) {
        const instance = this.getActiveInstance(containerId);
        if (!instance) return '';
        return instance.selectedPosition || instance.customPosition || '';
    },

    setPosition(position, containerId = null) {
        const instance = this.getActiveInstance(containerId);
        if (!instance) return;
        const select = instance.root.querySelector('.ppe-matrix-position');
        const customInput = instance.root.querySelector('.ppe-matrix-position-custom');
        if (select) {
            if (instance.positions.includes(position)) {
                select.value = position;
                instance.selectedPosition = position;
                instance.customPosition = '';
                if (customInput) {
                    customInput.classList.add('hidden');
                    customInput.required = false;
                    customInput.value = '';
                }
                instance.selectedItems = new Set(this.getPositionItems(position));
                instance.items = Array.from(new Set([...instance.items, ...instance.selectedItems]));
                this.renderItems(instance);
            } else if (position) {
                select.value = '__custom__';
                if (customInput) {
                    customInput.classList.remove('hidden');
                    customInput.required = true;
                    customInput.value = position;
                }
                instance.selectedPosition = '';
                instance.customPosition = position;
                instance.selectedItems = new Set();
                this.renderItems(instance);
            }
        }
    }
};

// Export to global scope
if (typeof window !== 'undefined') {
    window.Utils = Utils;
    window.Notification = Notification;
    window.Loading = Loading;
    window.QRCode = QRCode;
    window.ViolationTypesManager = ViolationTypesManager;
    window.DEFAULT_PERIODIC_INSPECTION_CATEGORIES = DEFAULT_PERIODIC_INSPECTION_CATEGORIES;
    window.DEFAULT_VIOLATION_TYPES = DEFAULT_VIOLATION_TYPES;
    window.PDFTemplates = PDFTemplates;
    window.EmployeeHelper = EmployeeHelper;
    window.PPEMatrix = PPEMatrix;
    window.Permissions = Permissions;
    window.AppState = AppState;

    // ✅ دوال مساعدة للتحقق من صلاحيات القراءة فقط
    window.isReadOnlyRole = function(user = AppState.currentUser) {
        if (!user) return false;
        const role = (user.role || '').toLowerCase().trim();
        return role === 'read_only' || role === 'قراءة فقط';
    };

    window.canEdit = function(moduleKey, user = AppState.currentUser) {
        if (!user) return false;
        if (Permissions.isAdminRole(user.role)) return true;
        if (window.isReadOnlyRole(user)) return false;
        return Permissions.hasAccess(moduleKey || '', user);
    };

    window.canAdd = function(moduleKey, user = AppState.currentUser) {
        if (!user) return false;
        if (Permissions.isAdminRole(user.role)) return true;
        if (window.isReadOnlyRole(user)) return false;
        return Permissions.hasAccess(moduleKey || '', user);
    };

    window.canDelete = function(moduleKey, user = AppState.currentUser) {
        if (!user) return false;
        if (Permissions.isAdminRole(user.role)) return true;
        if (window.isReadOnlyRole(user)) return false;
        return Permissions.hasAccess(moduleKey || '', user);
    };

    // استدعاء تلقائي لتحديث قوائم المصنع/الموقع في جميع الموديولات عند اكتمال تحميل إعدادات النماذج
    (function () {
        function refreshAllSiteDropdowns() {
            var names = ['Training', 'Clinic', 'PTW', 'Incidents', 'Violations', 'FireEquipment', 'PeriodicInspections', 'BehaviorMonitoring'];
            for (var i = 0; i < names.length; i++) {
                try {
                    var M = window[names[i]];
                    if (M && typeof M.refreshSiteDropdowns === 'function') M.refreshSiteDropdowns();
                } catch (e) {}
            }
        }
        if (typeof window.addEventListener === 'function') {
            window.addEventListener('formSettingsUpdated', refreshAllSiteDropdowns);
        }
    })();

    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
        AppState.runningWithoutBackend = true;
    }
    window.MODULE_PERMISSIONS_CONFIG = MODULE_PERMISSIONS_CONFIG;
    window.DEFAULT_ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;
    window.AVAILABLE_ROLES = AVAILABLE_ROLES;
}

/**
 * إزالة أي حسابات افتراضية legacy من البيانات المحلية.
 * 
 * ⚠️ ملاحظة أمنية:
 * - لا نقوم بإنشاء حسابات افتراضية في الإنتاج.
 * - هذا فقط Cleanup لأي بيانات قديمة تم زرعها في نسخ سابقة (مثل نطاق @hse.local).
 * 
 * @param {{persistRemote?: boolean}} options
 * @returns {{removed: number, removedEmails: string[]}}
 */
function removeDefaultUsersIfNeeded(options = {}) {
    try {
        const users = AppState?.appData?.users;
        if (!Array.isArray(users) || users.length === 0) {
            return { removed: 0, removedEmails: [] };
        }

        const isLegacyDefaultUser = (u) => {
            try {
                const email = String(u?.email || '').toLowerCase().trim();
                return (u?.isDefaultUser === true) || email.endsWith('@hse.local');
            } catch (e) {
                return false;
            }
        };

        const removedUsers = users.filter(isLegacyDefaultUser);
        if (removedUsers.length === 0) {
            return { removed: 0, removedEmails: [] };
        }

        AppState.appData.users = users.filter(u => !isLegacyDefaultUser(u));

        // حفظ محلي
        try {
            if (typeof window !== 'undefined' && window.DataManager && typeof window.DataManager.save === 'function') {
                window.DataManager.save();
            }
        } catch (e) {
            // ignore
        }

        // حفظ عن بعد (اختياري) - فقط إذا طُلِب صراحةً
        const persistRemote = options && options.persistRemote === true;
        if (persistRemote) {
            try {
                const isAdmin = (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function')
                    ? Permissions.isCurrentUserAdmin()
                    : (AppState.currentUser?.role || '').toLowerCase() === 'admin';

                if (isAdmin && typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.autoSave === 'function' &&
                    AppState.googleConfig?.appsScript?.enabled) {
                    GoogleIntegration.autoSave('Users', AppState.appData.users).catch(() => { });
                }
            } catch (e) {
                // ignore
            }
        }

        return {
            removed: removedUsers.length,
            removedEmails: removedUsers.map(u => String(u?.email || '')).filter(Boolean)
        };
    } catch (error) {
        return { removed: 0, removedEmails: [] };
    }
}

// Export cleanup helper globally (used by Users module)
if (typeof window !== 'undefined') {
    window.removeDefaultUsersIfNeeded = removeDefaultUsersIfNeeded;
}

/**
 * Module Lifecycle Manager
 * إدارة دورة حياة الموديولات - ضمان تنفيذ الكود في الوقت الصحيح
 */
const ModuleLifecycle = {
    /**
     * تنفيذ كود فقط عندما يكون الموديول مفتوحاً
     * @param {string} moduleId - معرف القسم (مثل: 'contractors-section')
     * @param {Function} callback - الدالة المراد تنفيذها
     * @returns {boolean} - هل تم التنفيذ أم لا
     */
    executeIfModuleActive(moduleId, callback) {
        try {
            const section = document.getElementById(moduleId);
            if (section && document.contains(section)) {
                const style = getComputedStyle(section);
                // التحقق من أن القسم مرئي
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    if (typeof callback === 'function') {
                        callback(section);
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            Utils.safeWarn('⚠️ ModuleLifecycle.executeIfModuleActive error:', error);
            return false;
        }
    },

    /**
     * انتظار فتح موديول معين ثم تنفيذ الكود
     * @param {string} moduleId - معرف القسم
     * @param {Function} callback - الدالة المراد تنفيذها
     * @param {number} timeout - الحد الأقصى للانتظار (بالميلي ثانية)
     * @returns {Promise<boolean>}
     */
    async waitForModuleActive(moduleId, callback, timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const check = () => {
                if (this.executeIfModuleActive(moduleId, callback)) {
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime >= timeout) {
                    Utils.safeWarn(`⚠️ ModuleLifecycle: timeout انتظار الموديول "${moduleId}"`);
                    resolve(false);
                    return;
                }
                
                requestAnimationFrame(check);
            };
            
            check();
        });
    },

    /**
     * تسجيل معالج لحدث فتح موديول
     * @param {string} moduleId - معرف القسم
     * @param {Function} onOpen - الدالة المراد تنفيذها عند الفتح
     * @param {Function} onClose - الدالة المراد تنفيذها عند الإغلاق (اختياري)
     */
    onModuleToggle(moduleId, onOpen, onClose = null) {
        try {
            // استخدام MutationObserver لمراقبة تغييرات العرض
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                        const section = document.getElementById(moduleId);
                        if (section) {
                            const style = getComputedStyle(section);
                            const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
                            
                            if (isVisible && typeof onOpen === 'function') {
                                onOpen(section);
                            } else if (!isVisible && typeof onClose === 'function') {
                                onClose(section);
                            }
                        }
                    }
                }
            });

            // مراقبة التغييرات على القسم الرئيسي
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                observer.observe(mainContent, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }

            return observer;
        } catch (error) {
            Utils.safeWarn('⚠️ ModuleLifecycle.onModuleToggle error:', error);
            return null;
        }
    },

    /**
     * إعادة ربط Event Listeners بعد تحديث DOM
     * @param {HTMLElement} container - العنصر الحاوي
     * @param {Object} handlers - معالجات الأحداث {selector: {event: handler}}
     * @param {AbortController} abortController - للإلغاء
     */
    rebindEventListeners(container, handlers, abortController = null) {
        if (!container || !document.contains(container) || !handlers) return;

        Object.entries(handlers).forEach(([selector, events]) => {
            const elements = container.querySelectorAll(selector);
            elements.forEach(element => {
                Object.entries(events).forEach(([eventType, handler]) => {
                    if (typeof handler === 'function') {
                        const options = abortController ? { signal: abortController.signal } : {};
                        element.addEventListener(eventType, handler, options);
                    }
                });
            });
        });
    },

    /**
     * تنظيف موديول وإزالة جميع listeners
     * @param {AbortController} abortController - AbortController للموديول
     */
    cleanupModule(abortController) {
        if (abortController && typeof abortController.abort === 'function') {
            abortController.abort();
        }
    }
};

// Export ModuleLifecycle globally
if (typeof window !== 'undefined') {
    window.ModuleLifecycle = ModuleLifecycle;
}

// تصدير const aliases للتوافق مع الكود القديم
// ملاحظة: تم التعليق على إعادة التعريف لتجنب التعارض
// const Notification = window.Notification;
// const Utils = window.Utils;
// const Loading = window.Loading;

// ========================================
// نظام الترجمة العالمي (i18n)
// ========================================
const I18n = {
    // اللغة الافتراضية
    defaultLanguage: 'ar',

    // قاموس الترجمات
    translations: {
        ar: {
            // أزرار عامة
            'btn.add': 'إضافة',
            'btn.edit': 'تعديل',
            'btn.delete': 'حذف',
            'btn.save': 'حفظ',
            'btn.cancel': 'إلغاء',
            'btn.close': 'إغلاق',
            'btn.refresh': 'تحديث',
            'btn.search': 'بحث',
            'btn.reset': 'إعادة تعيين',
            'btn.export': 'تصدير',
            'btn.import': 'استيراد',
            'btn.print': 'طباعة',
            'btn.view': 'عرض',
            'btn.details': 'التفاصيل',
            'btn.back': 'رجوع',
            'btn.next': 'التالي',
            'btn.previous': 'السابق',
            'btn.submit': 'إرسال',
            'btn.approve': 'موافقة',
            'btn.reject': 'رفض',
            'btn.filter': 'تصفية',
            'btn.clear': 'مسح',
            'btn.download': 'تحميل',
            'btn.upload': 'رفع',
            'btn.new': 'جديد',
            'btn.create': 'إنشاء',
            'btn.update': 'تحديث',
            'btn.confirm': 'تأكيد',
            'btn.yes': 'نعم',
            'btn.no': 'لا',

            // عناوين الجداول
            'table.actions': 'الإجراءات',
            'table.status': 'الحالة',
            'table.date': 'التاريخ',
            'table.name': 'الاسم',
            'table.type': 'النوع',
            'table.description': 'الوصف',
            'table.notes': 'ملاحظات',
            'table.priority': 'الأولوية',
            'table.department': 'القسم',
            'table.location': 'الموقع',
            'table.code': 'الكود',
            'table.id': 'المعرف',
            'table.created': 'تاريخ الإنشاء',
            'table.updated': 'تاريخ التحديث',
            'table.by': 'بواسطة',
            'table.count': 'العدد',
            'table.total': 'المجموع',

            // رسومات الهيكل (Skeleton)
            'skeleton.loading': 'جاري التحميل...',
            'skeleton.noData': 'لا توجد بيانات',
            'skeleton.error': 'حدث خطأ أثناء التحميل',
            'skeleton.retry': 'إعادة المحاولة',
            'skeleton.empty': 'لا توجد عناصر لعرضها',

            // رسائل عامة
            'msg.success': 'تم بنجاح',
            'msg.error': 'حدث خطأ',
            'msg.warning': 'تنبيه',
            'msg.info': 'معلومات',
            'msg.confirm': 'هل أنت متأكد؟',
            'msg.saved': 'تم الحفظ بنجاح',
            'msg.deleted': 'تم الحذف بنجاح',
            'msg.updated': 'تم التحديث بنجاح',
            'msg.loading': 'جاري التحميل...',
            'msg.processing': 'جاري المعالجة...',
            'msg.noResults': 'لا توجد نتائج',
            'msg.searchPlaceholder': 'ابحث هنا...',
            'msg.select': 'اختر...',
            'msg.all': 'الكل',
            'msg.none': 'لا شيء',
            'msg.required': 'حقل مطلوب',
            'msg.invalid': 'بيانات غير صالحة',
            'msg.networkError': 'خطأ في الاتصال بالشبكة',
            'msg.serverError': 'خطأ في الخادم',
            'msg.timeout': 'انتهت المهلة',
            'msg.unauthorized': 'غير مصرح',
            'msg.forbidden': 'غير مسموح',
            'msg.notFound': 'غير موجود',

            // فلاتر
            'filter.all': 'الكل',
            'filter.active': 'نشط',
            'filter.inactive': 'غير نشط',
            'filter.pending': 'معلق',
            'filter.approved': 'معتمد',
            'filter.rejected': 'مرفوض',
            'filter.completed': 'مكتمل',
            'filter.open': 'مفتوح',
            'filter.closed': 'مغلق',
            'filter.dateFrom': 'من تاريخ',
            'filter.dateTo': 'إلى تاريخ',

            // صفحات
            'pagination.prev': 'السابق',
            'pagination.next': 'التالي',
            'pagination.first': 'الأول',
            'pagination.last': 'الأخير',
            'pagination.of': 'من',
            'pagination.items': 'عناصر',
            'pagination.page': 'صفحة',
            'pagination.showing': 'عرض',
            'pagination.to': 'إلى',

            // موديولات
            'module.dashboard': 'لوحة التحكم',
            'module.users': 'المستخدمين',
            'module.employees': 'الموظفين',
            'module.incidents': 'الحوادث',
            'module.nearmiss': 'التقارير القريبة',
            'module.ptw': 'تصاريح العمل',
            'module.training': 'التدريب',
            'module.clinic': 'العيادة',
            'module.fireequipment': 'معدات الحريق',
            'module.ppe': 'معدات الوقاية',
            'module.contractors': 'المقاولين',
            'module.violations': 'المخالفات',
            'module.reports': 'التقارير',
            'module.settings': 'الإعدادات',
            'module.behavior': 'مراقبة السلوك',
            'module.chemicals': 'المواد الكيميائية',
            'module.observations': 'المشاهدات اليومية',
            'module.iso': 'ISO',
            'module.emergency': 'الطوارئ',
            'module.risk': 'تقييم المخاطر',
            'module.documents': 'المستندات',
            'module.audit': 'التدقيق',
            'module.sustainability': 'الاستدامة',
            'module.inspections': 'الفحوصات',
            'module.safetyteam': 'فريق السلامة',

            // Settings Module specific translations
            'settings.title': 'الإعدادات',
            'settings.subtitle': 'إدارة إعدادات النظام والدمج والصلاحيات',
            'settings.tabs.company': 'بيانات الشركة والهوية',
            'settings.tabs.integration': 'الدمج والتزامن',
            'settings.tabs.cloud': 'تخزين السحابة',
            'settings.tabs.drive': 'جوجل درايف',
            'settings.tabs.sharepoint': 'مايكروسوفت شير بوينت',
            'settings.tabs.system': 'إعدادات النظام',
            'settings.tabs.forms': 'إعدادات النماذج',
            'settings.tabs.violations': 'أنواع المخالفات',
            'settings.tabs.reports': 'التقارير والإشعارات',
            'settings.tabs.email': 'إشعارات البريد الإلكتروني',
            'settings.tabs.permissions': 'الصلاحيات والموافقات',
            'settings.tabs.circuit': 'دائرة الموافقة',
            'settings.tabs.logs': 'السجلات والرصد',
            
            'settings.company.title': 'بيانات الشركة والهوية',
            'settings.company.subtitle': 'معلومات الشركة والشعار والهوية البصرية',
            'settings.company.name': 'اسم الشركة (يظهر في الرأس والتقارير)',
            'settings.company.nameHint': 'سيتم استخدام هذا الاسم في رأس التطبيق وجميع التقارير PDF.',
            'settings.company.fontSize': 'حجم خط اسم الشركة (بكسل)',
            'settings.company.fontSizeHint': 'الحجم الافتراضي: 16 بكسل. يمكنك تغييره من 8 إلى 72 بكسل.',
            'settings.company.secondaryName': 'الاسم الثانوي / السطر الإضافي (يظهر في الرأس والتقارير)',
            'settings.company.secondaryNameHint': 'سيتم عرض هذا السطر أسفل اسم الشركة في الرأس والتقارير. إذا تم تركها فارغة، لن تظهر في الواجهة أو PDF.',

            // PTW Module specific translations
            'ptw.title': 'تصاريح العمل',
            'ptw.subtitle': 'إدارة تصاريح العمل',
            'ptw.tabs.list': 'قائمة التصاريح',
            'ptw.tabs.registry': 'سجل التصاريح',
            'ptw.tabs.analytics': 'التحليلات',
            'ptw.btn.newPermit': 'تصريح جديد',
            'ptw.btn.approve': 'موافقة',
            'ptw.btn.reject': 'رفض',
            'ptw.status.pending': 'معلق',
            'ptw.status.approved': 'معتمد',
            'ptw.status.rejected': 'مرفوض',
            'ptw.status.expired': 'منتهي',
            'ptw.status.active': 'نشط',
            'ptw.form.permitType': 'نوع التصريح',
            'ptw.form.workLocation': 'موقع العمل',
            'ptw.form.workDescription': 'وصف العمل',
            'ptw.form.startDate': 'تاريخ البدء',
            'ptw.form.endDate': 'تاريخ الانتهاء',
            'ptw.form.requestingParty': 'الجهة الطالبة',
            'ptw.form.approvals': 'الموافقات',
            'ptw.safety.officer': 'مسؤول السلامة',
            'ptw.safety.required': 'موافقة السلامة مطلوبة',

            // Users Module translations
            'users.title': 'المستخدمين',
            'users.subtitle': 'إدارة المستخدمين والصلاحيات',
            'users.btn.newUser': 'مستخدم جديد',
            'users.table.name': 'الاسم',
            'users.table.email': 'البريد الإلكتروني',
            'users.table.role': 'الدور',
            'users.table.department': 'القسم',
            'users.table.status': 'الحالة',
            'users.status.active': 'نشط',
            'users.status.inactive': 'غير نشط',
            'users.form.fullName': 'الاسم الكامل',
            'users.form.email': 'البريد الإلكتروني',
            'users.form.password': 'كلمة المرور',
            'users.form.role': 'الدور الوظيفي',
            'users.form.department': 'القسم',

            // Incidents Module translations
            'incidents.title': 'الحوادث',
            'incidents.subtitle': 'تسجيل ومتابعة الحوادث',
            'incidents.btn.newIncident': 'حادث جديد',
            'incidents.table.incidentType': 'نوع الحادث',
            'incidents.table.date': 'تاريخ الحادث',
            'incidents.table.location': 'الموقع',
            'incidents.table.severity': 'الخطورة',
            'incidents.table.status': 'الحالة',
            'incidents.form.description': 'وصف الحادث',
            'incidents.form.injuredPerson': 'الشخص المصاب',
            'incidents.form.witnesses': 'الشهود',
            'incidents.form.immediateAction': 'الإجراء الفوري',
            'incidents.form.rootCause': 'السبب الجذري',
            'incidents.form.correctiveAction': 'الإجراء التصحيحي',
            'incidents.severity.low': 'منخفضة',
            'incidents.severity.medium': 'متوسطة',
            'incidents.severity.high': 'عالية',
            'incidents.severity.critical': 'حرجة',
            'incidents.status.open': 'مفتوح',
            'incidents.status.investigating': 'قيد التحقيق',
            'incidents.status.closed': 'مغلق',

            // Training Module translations
            'training.title': 'التدريب',
            'training.subtitle': 'إدارة البرامج التدريبية والشهادات',
            'training.btn.newTraining': 'برنامج تدريبي جديد',
            'training.btn.newCertificate': 'شهادة جديدة',
            'training.table.trainingName': 'اسم البرنامج',
            'training.table.trainer': 'المدرب',
            'training.table.date': 'التاريخ',
            'training.table.duration': 'المدة',
            'training.table.participants': 'المشاركون',
            'training.table.status': 'الحالة',
            'training.form.trainingType': 'نوع التدريب',
            'training.form.trainingTopic': 'موضوع التدريب',
            'training.form.trainer': 'المدرب',
            'training.form.location': 'موقع التدريب',
            'training.form.startDate': 'تاريخ البدء',
            'training.form.endDate': 'تاريخ الانتهاء',
            'training.form.duration': 'المدة (ساعات)',
            'training.status.planned': 'مخطط',
            'training.status.ongoing': 'جاري',
            'training.status.completed': 'مكتمل',
            'training.status.cancelled': 'ملغى',
            'training.certificate.title': 'الشهادات',
            'training.certificate.employee': 'الموظف',
            'training.certificate.issueDate': 'تاريخ الإصدار',
            'training.certificate.expiryDate': 'تاريخ الانتهاء',
            'training.certificate.status': 'حالة الشهادة',
            'training.certificate.valid': 'سارية',
            'training.certificate.expired': 'منتهية',

            // NearMiss Module translations
            'nearmiss.title': 'التقارير القريبة',
            'nearmiss.subtitle': 'تسجيل ومتابعة التقارير القريبة من الحوادث',
            'nearmiss.btn.newReport': 'تقرير جديد',
            'nearmiss.table.date': 'تاريخ التقرير',
            'nearmiss.table.location': 'الموقع',
            'nearmiss.table.type': 'نوع التقرير',
            'nearmiss.table.severity': 'الخطورة',
            'nearmiss.table.reporter': 'المبلغ',
            'nearmiss.table.status': 'الحالة',
            'nearmiss.form.description': 'وصف الحادث القريب',
            'nearmiss.form.immediateAction': 'الإجراء الفوري المتخذ',
            'nearmiss.form.suggestedAction': 'الإجراء المقترح',
            'nearmiss.status.reported': 'تم التبليغ',
            'nearmiss.status.underReview': 'قيد المراجعة',
            'nearmiss.status.resolved': 'تم الحل',

            // Clinic Module translations
            'clinic.title': 'العيادة',
            'clinic.subtitle': 'إدارة زيارات العيادة والحالات الطبية',
            'clinic.btn.newVisit': 'زيارة جديدة',
            'clinic.tabs.visits': 'سجل الزيارات',
            'clinic.tabs.employees': 'الموظفين',
            'clinic.tabs.contractors': 'المقاولين',
            'clinic.tabs.medications': 'الأدوية',
            'clinic.tabs.analytics': 'التحليلات',
            'clinic.table.employeeCode': 'الكود الوظيفي',
            'clinic.table.name': 'الاسم',
            'clinic.table.visitDate': 'تاريخ الزيارة',
            'clinic.table.reason': 'سبب الزيارة',
            'clinic.table.diagnosis': 'التشخيص',
            'clinic.table.status': 'الحالة',
            'clinic.table.medications': 'الأدوية',
            'clinic.form.patientType': 'نوع المريض',
            'clinic.form.patientName': 'اسم المريض',
            'clinic.form.visitDate': 'تاريخ الزيارة',
            'clinic.form.reason': 'سبب الزيارة',
            'clinic.form.diagnosis': 'التشخيص',
            'clinic.form.treatment': 'العلاج',
            'clinic.form.medications': 'الأدوية المنصرفة',
            'clinic.status.treated': 'تم العلاج',
            'clinic.status.referred': 'تم الإحالة',
            'clinic.status.followUp': 'متابعة',

            // FireEquipment Module translations
            'fire.title': 'معدات الحريق',
            'fire.subtitle': 'إدارة وفحص معدات الحريق والإطفاء',
            'fire.btn.newEquipment': 'معدات جديدة',
            'fire.btn.inspect': 'فحص',
            'fire.btn.qrScan': 'مسح QR',
            'fire.tabs.database': 'قاعدة البيانات',
            'fire.tabs.register': 'السجل',
            'fire.tabs.inspections': 'الفحوصات',
            'fire.tabs.analytics': 'التحليلات',
            'fire.table.equipmentId': 'كود الجهاز',
            'fire.table.type': 'النوع',
            'fire.table.location': 'الموقع',
            'fire.table.status': 'الحالة',
            'fire.table.lastInspection': 'آخر فحص',
            'fire.table.nextInspection': 'الفحص القادم',
            'fire.form.equipmentType': 'نوع الجهاز',
            'fire.form.deviceId': 'كود الجهاز',
            'fire.form.location': 'موقع الجهاز',
            'fire.form.installationDate': 'تاريخ التركيب',
            'fire.form.lastInspection': 'تاريخ آخر فحص',
            'fire.status.active': 'صالح',
            'fire.status.maintenance': 'يحتاج صيانة',
            'fire.status.outOfService': 'خارج الخدمة',
            'fire.inspection.monthly': 'الفحص الشهري',
            'fire.inspection.quarterly': 'الفحص ربع السنوي',

            // PPE Module translations
            'ppe.title': 'معدات الوقاية الشخصية',
            'ppe.subtitle': 'إدارة وتتبع معدات الوقاية الشخصية',
            'ppe.btn.newItem': 'صنف جديد',
            'ppe.btn.issue': 'صرف',
            'ppe.btn.return': 'إرجاع',
            'ppe.tabs.inventory': 'المخزون',
            'ppe.tabs.issuance': 'الصرف',
            'ppe.tabs.returns': 'المرتجعات',
            'ppe.tabs.analytics': 'التحليلات',
            'ppe.table.itemName': 'اسم الصنف',
            'ppe.table.category': 'الفئة',
            'ppe.table.quantity': 'الكمية',
            'ppe.table.unit': 'الوحدة',
            'ppe.table.minStock': 'الحد الأدنى',
            'ppe.table.status': 'الحالة',
            'ppe.table.employee': 'الموظف',
            'ppe.table.issueDate': 'تاريخ الصرف',
            'ppe.table.returnDate': 'تاريخ الإرجاع',
            'ppe.form.itemName': 'اسم الصنف',
            'ppe.form.category': 'الفئة',
            'ppe.form.quantity': 'الكمية',
            'ppe.form.unit': 'الوحدة',
            'ppe.form.minStock': 'الحد الأدنى للمخزون',
            'ppe.status.available': 'متاح',
            'ppe.status.lowStock': 'مخزون منخفض',
            'ppe.status.outOfStock': 'نفد من المخزون',

            // Employees Module translations
            'employees.title': 'الموظفين',
            'employees.subtitle': 'إدارة بيانات الموظفين والوظائف',
            'employees.btn.newEmployee': 'موظف جديد',
            'employees.table.employeeCode': 'الكود الوظيفي',
            'employees.table.fullName': 'الاسم الكامل',
            'employees.table.jobTitle': 'المسمى الوظيفي',
            'employees.table.department': 'القسم',
            'employees.table.factory': 'المصنع',
            'employees.table.workplace': 'مكان العمل',
            'employees.table.joinDate': 'تاريخ التعيين',
            'employees.table.status': 'الحالة',
            'employees.form.fullName': 'الاسم الكامل',
            'employees.form.employeeCode': 'الكود الوظيفي',
            'employees.form.jobTitle': 'المسمى الوظيفي',
            'employees.form.department': 'القسم',
            'employees.form.factory': 'المصنع',
            'employees.form.workplace': 'مكان العمل',
            'employees.form.phone': 'رقم الهاتف',
            'employees.form.email': 'البريد الإلكتروني',
            'employees.form.joinDate': 'تاريخ التعيين',
            'employees.status.active': 'نشط',
            'employees.status.inactive': 'غير نشط',
            'employees.status.onLeave': 'في إجازة',

            // Contractors Module translations
            'contractors.title': 'المقاولين',
            'contractors.subtitle': 'إدارة المقاولين والعقود',
            'contractors.btn.newContractor': 'مقاول جديد',
            'contractors.btn.evaluate': 'تقييم',
            'contractors.btn.approve': 'اعتماد',
            'contractors.tabs.list': 'قائمة المقاولين',
            'contractors.tabs.approved': 'المعتمدين',
            'contractors.tabs.evaluations': 'التقييمات',
            'contractors.tabs.requests': 'طلبات الاعتماد',
            'contractors.table.contractorName': 'اسم المقاول',
            'contractors.table.company': 'الشركة',
            'contractors.table.specialty': 'التخصص',
            'contractors.table.contractNumber': 'رقم العقد',
            'contractors.table.startDate': 'تاريخ البدء',
            'contractors.table.endDate': 'تاريخ الانتهاء',
            'contractors.table.status': 'الحالة',
            'contractors.form.companyName': 'اسم الشركة',
            'contractors.form.contractorName': 'اسم المقاول',
            'contractors.form.specialty': 'التخصص',
            'contractors.form.contractNumber': 'رقم العقد',
            'contractors.form.startDate': 'تاريخ بداية العقد',
            'contractors.form.endDate': 'تاريخ نهاية العقد',
            'contractors.form.contactPerson': 'الشخص المسؤول',
            'contractors.form.phone': 'رقم الهاتف',
            'contractors.form.email': 'البريد الإلكتروني',
            'contractors.status.active': 'نشط',
            'contractors.status.expired': 'منتهي',
            'contractors.status.pending': 'معلق',
            'contractors.status.approved': 'معتمد',

            // Violations Module translations
            'violations.title': 'المخالفات',
            'violations.subtitle': 'إدارة وتتبع المخالفات والجزاءات',
            'violations.btn.newViolation': 'مخالفة جديدة',
            'violations.btn.newPenalty': 'جزاء جديد',
            'violations.tabs.violations': 'المخالفات',
            'violations.tab.penalties': 'الجزاءات',
            'violations.tabs.analytics': 'التحليلات',
            'violations.table.violationType': 'نوع المخالفة',
            'violations.table.date': 'تاريخ المخالفة',
            'violations.table.employee': 'الموظف/المقاول',
            'violations.table.severity': 'درجة الخطورة',
            'violations.table.status': 'الحالة',
            'violations.table.penalty': 'الجزاء',
            'violations.form.violationDescription': 'وصف المخالفة',
            'violations.form.violationLocation': 'موقع المخالفة',
            'violations.form.violationDate': 'تاريخ المخالفة',
            'violations.form.violationTime': 'وقت المخالفة',
            'violations.form.witnesses': 'الشهود',
            'violations.form.evidence': 'الدليل/الإثبات',
            'violations.severity.low': 'منخفضة',
            'violations.severity.medium': 'متوسطة',
            'violations.severity.high': 'عالية',
            'violations.severity.critical': 'حرجة',
            'violations.status.pending': 'معلقة',
            'violations.status.approved': 'معتمدة',
            'violations.status.rejected': 'مرفوضة',

            // Reports Module translations
            'reports.title': 'التقارير',
            'reports.subtitle': 'إنشاء وإدارة التقارير',
            'reports.btn.newReport': 'تقرير جديد',
            'reports.btn.generate': 'توليد التقرير',
            'reports.btn.export': 'تصدير',
            'reports.tabs.saved': 'التقارير المحفوظة',
            'reports.tabs.generate': 'توليد تقرير',
            'reports.tabs.scheduled': 'التقارير المجدولة',
            'reports.table.reportName': 'اسم التقرير',
            'reports.table.reportType': 'نوع التقرير',
            'reports.table.createdBy': 'تم الإنشاء بواسطة',
            'reports.table.createdDate': 'تاريخ الإنشاء',
            'reports.table.lastRun': 'آخر تشغيل',
            'reports.table.status': 'الحالة',
            'reports.form.reportName': 'اسم التقرير',
            'reports.form.reportType': 'نوع التقرير',
            'reports.form.dateRange': 'نطاق التاريخ',
            'reports.form.filters': 'عوامل التصفية',
            'reports.status.active': 'نشط',
            'reports.status.inactive': 'غير نشط',

            // ISO Module translations
            'iso.title': 'نظام إدارة الجودة ISO',
            'iso.subtitle': 'إدارة متطلبات نظام إدارة الجودة والشهادات',
            'iso.btn.newDocument': 'مستند جديد',
            'iso.btn.audit': 'تدقيق جديد',
            'iso.tabs.documents': 'المستندات',
            'iso.tabs.audits': 'التدقيقات',
            'iso.tabs.certificates': 'الشهادات',
            'iso.tabs.analytics': 'التحليلات',
            'iso.table.documentCode': 'كود المستند',
            'iso.table.documentName': 'اسم المستند',
            'iso.table.version': 'الإصدار',
            'iso.table.issueDate': 'تاريخ الإصدار',
            'iso.table.reviewDate': 'تاريخ المراجعة',
            'iso.table.status': 'الحالة',
            'iso.form.documentCode': 'كود المستند',
            'iso.form.documentName': 'اسم المستند',
            'iso.form.version': 'رقم الإصدار',
            'iso.form.issueDate': 'تاريخ الإصدار',
            'iso.form.reviewDate': 'تاريخ المراجعة القادم',
            'iso.status.active': 'نشط',
            'iso.status.underReview': 'قيد المراجعة',
            'iso.status.archived': 'مؤرشف',

            // Emergency Module translations
            'emergency.title': 'الطوارئ',
            'emergency.subtitle': 'إدارة خطط الطوارئ والإخلاء',
            'emergency.btn.newPlan': 'خطة طوارئ جديدة',
            'emergency.btn.drill': 'تمرين إخلاء',
            'emergency.tabs.plans': 'خطط الطوارئ',
            'emergency.tabs.drills': 'التمارين',
            'emergency.tabs.equipment': 'معدات الطوارئ',
            'emergency.tabs.contacts': 'جهات الاتصال',
            'emergency.table.planName': 'اسم الخطة',
            'emergency.table.planType': 'نوع الخطة',
            'emergency.table.lastDrill': 'آخر تمرين',
            'emergency.table.nextDrill': 'التمرين القادم',
            'emergency.table.status': 'الحالة',
            'emergency.form.planName': 'اسم خطة الطوارئ',
            'emergency.form.planType': 'نوع الخطة',
            'emergency.form.assemblyPoint': 'نقطة التجمع',
            'emergency.form.evacuationRoutes': 'طرق الإخلاء',
            'emergency.status.active': 'نشطة',
            'emergency.status.inactive': 'غير نشطة',

            // SOP/JHA Module translations
            'sop.title': 'إجراءات العمل الآمنة',
            'sop.subtitle': 'إدارة إجراءات العمل الآمنة وتحليل المخاطر',
            'sop.btn.newSOP': 'إجراء جديد',
            'sop.btn.newJHA': 'تحليل مخاطر جديد',
            'sop.tabs.sop': 'إجراءات العمل',
            'sop.tabs.jha': 'تحليل المخاطر',
            'sop.tabs.approvals': 'الموافقات',
            'sop.table.sopCode': 'كود الإجراء',
            'sop.table.sopName': 'اسم الإجراء',
            'sop.table.department': 'القسم',
            'sop.table.revision': 'المراجعة',
            'sop.table.lastUpdate': 'آخر تحديث',
            'sop.table.status': 'الحالة',
            'sop.form.sopCode': 'كود الإجراء',
            'sop.form.sopName': 'اسم الإجراء',
            'sop.form.department': 'القسم',
            'sop.form.purpose': 'الغرض',
            'sop.form.scope': 'النطاق',
            'sop.form.responsibilities': 'المسؤوليات',
            'sop.form.procedures': 'الإجراءات',
            'sop.status.active': 'نشط',
            'sop.status.underReview': 'قيد المراجعة',
            'sop.status.obsolete': 'مهمل',

            // DailyObservations Module translations
            'daily.title': 'الملاحظات اليومية',
            'daily.subtitle': 'تسجيل الملاحظات اليومية على أرض المصنع',
            'daily.btn.newObservation': 'ملاحظة جديدة',
            'daily.table.date': 'التاريخ',
            'daily.table.observer': 'المراقب',
            'daily.table.location': 'الموقع',
            'daily.table.observation': 'الملاحظة',
            'daily.table.category': 'التصنيف',
            'daily.table.priority': 'الأولوية',
            'daily.table.status': 'الحالة',
            'daily.form.observationDate': 'تاريخ الملاحظة',
            'daily.form.observerName': 'اسم المراقب',
            'daily.form.location': 'الموقع',
            'daily.form.category': 'تصنيف الملاحظة',
            'daily.form.description': 'وصف الملاحظة',
            'daily.form.action': 'الإجراء المتخذ',
            'daily.form.responsible': 'الجهة المسؤولة',
            'daily.priority.low': 'منخفضة',
            'daily.priority.medium': 'متوسطة',
            'daily.priority.high': 'عالية',
            'daily.status.open': 'مفتوح',
            'daily.status.inProgress': 'قيد التنفيذ',
            'daily.status.closed': 'مغلق',

            // BehaviorMonitoring Module translations
            'behavior.title': 'مراقبة السلوك',
            'behavior.subtitle': 'تقييم ومراقبة سلوكيات السلامة',
            'behavior.btn.newEvaluation': 'تقييم جديد',
            'behavior.table.date': 'التاريخ',
            'behavior.table.employee': 'الموظف',
            'behavior.table.observer': 'المراقب',
            'behavior.table.score': 'النتيجة',
            'behavior.table.status': 'الحالة',
            'behavior.form.evaluationDate': 'تاريخ التقييم',
            'behavior.form.employee': 'الموظف',
            'behavior.form.observer': 'المراقب',
            'behavior.form.ppeCompliance': 'الالتزام بمعدات الوقاية',
            'behavior.form.workProcedures': 'إجراءات العمل',
            'behavior.form.attitude': 'السلوك والموقف',
            'behavior.form.comments': 'ملاحظات',
            'behavior.status.excellent': 'ممتاز',
            'behavior.status.good': 'جيد',
            'behavior.status.needsImprovement': 'يحتاج تحسين',
            'behavior.status.unsatisfactory': 'غير مرضي',

            // ChemicalSafety Module translations
            'chemical.title': 'المواد الكيميائية',
            'chemical.subtitle': 'إدارة سلامة المواد والمنتجات الكيميائية',
            'chemical.btn.newChemical': 'مادة جديدة',
            'chemical.btn.msds': 'بطاقة بيانات السلامة',
            'chemical.tabs.inventory': 'المخزون',
            'chemical.tabs.msds': 'بطاقات SDS',
            'chemical.tabs.storage': 'التخزين',
            'chemical.table.chemicalName': 'اسم المادة',
            'chemical.table.casNumber': 'رقم CAS',
            'chemical.table.hazardClass': 'فئة الخطورة',
            'chemical.table.quantity': 'الكمية',
            'chemical.table.storageLocation': 'مكان التخزين',
            'chemical.table.status': 'الحالة',
            'chemical.form.chemicalName': 'اسم المادة الكيميائية',
            'chemical.form.casNumber': 'رقم CAS',
            'chemical.form.hazardClass': 'فئة الخطورة',
            'chemical.form.quantity': 'الكمية',
            'chemical.form.unit': 'الوحدة',
            'chemical.form.storageLocation': 'مكان التخزين',
            'chemical.status.safe': 'آمن',
            'chemical.status.hazardous': 'خطير',
            'chemical.status.restricted': 'مقيد الاستخدام',

            // PeriodicInspections Module translations
            'periodic.title': 'الفحوصات الدورية',
            'periodic.subtitle': 'إدارة الفحوصات الدورية للآلات والمعدات',
            'periodic.btn.newInspection': 'فحص جديد',
            'periodic.btn.qrScan': 'مسح QR',
            'periodic.tabs.schedule': 'الجدولة',
            'periodic.tabs.register': 'السجل',
            'periodic.tabs.equipment': 'الأصول والمعدات',
            'periodic.tabs.analytics': 'التحليلات',
            'periodic.table.equipmentName': 'اسم الجهاز',
            'periodic.table.equipmentId': 'كود الجهاز',
            'periodic.table.inspectionType': 'نوع الفحص',
            'periodic.table.dueDate': 'تاريخ الاستحقاق',
            'periodic.table.status': 'الحالة',
            'periodic.table.inspector': 'الفاحص',
            'periodic.form.equipmentName': 'اسم الجهاز/المعدة',
            'periodic.form.equipmentId': 'كود الجهاز',
            'periodic.form.inspectionType': 'نوع الفحص',
            'periodic.form.frequency': 'تكرار الفحص',
            'periodic.form.lastInspection': 'تاريخ آخر فحص',
            'periodic.form.nextInspection': 'تاريخ الفحص القادم',
            'periodic.form.inspector': 'اسم الفاحص',
            'periodic.status.pending': 'معلق',
            'periodic.status.completed': 'مكتمل',
            'periodic.status.overdue': 'متأخر',
            'periodic.frequency.daily': 'يومي',
            'periodic.frequency.weekly': 'أسبوعي',
            'periodic.frequency.monthly': 'شهري',
            'periodic.frequency.quarterly': 'ربع سنوي',
            'periodic.frequency.yearly': 'سنوي',

            // SafetyBudget Module translations
            'budget.title': 'ميزانية السلامة',
            'budget.subtitle': 'إدارة ميزانية السلامة والصحة المهنية',
            'budget.btn.newItem': 'بند جديد',
            'budget.btn.approve': 'اعتماد الميزانية',
            'budget.tabs.plan': 'خطة الميزانية',
            'budget.tabs.actual': 'المصروفات الفعلية',
            'budget.tabs.variance': 'تحليل الانحراف',
            'budget.tabs.reports': 'التقارير',
            'budget.table.itemName': 'اسم البند',
            'budget.table.category': 'الفئة',
            'budget.table.planned': 'المخطط',
            'budget.table.actual': 'الفعلي',
            'budget.table.variance': 'الانحراف',
            'budget.table.status': 'الحالة',
            'budget.form.itemName': 'اسم البند الميزاني',
            'budget.form.category': 'فئة الميزانية',
            'budget.form.plannedAmount': 'المبلغ المخطط',
            'budget.form.actualAmount': 'المبلغ الفعلي',
            'budget.form.description': 'الوصف',
            'budget.category.ppe': 'معدات الوقاية',
            'budget.category.training': 'التدريب',
            'budget.category.equipment': 'الأجهزة والمعدات',
            'budget.status.underBudget': 'ضمن الميزانية',
            'budget.status.overBudget': 'تجاوز الميزانية',
        },
        en: {
            // Common Buttons
            'btn.add': 'Add',
            'btn.edit': 'Edit',
            'btn.delete': 'Delete',
            'btn.save': 'Save',
            'btn.cancel': 'Cancel',
            'btn.close': 'Close',
            'btn.refresh': 'Refresh',
            'btn.search': 'Search',
            'btn.reset': 'Reset',
            'btn.export': 'Export',
            'btn.import': 'Import',
            'btn.print': 'Print',
            'btn.view': 'View',
            'btn.details': 'Details',
            'btn.back': 'Back',
            'btn.next': 'Next',
            'btn.previous': 'Previous',
            'btn.submit': 'Submit',
            'btn.approve': 'Approve',
            'btn.reject': 'Reject',
            'btn.filter': 'Filter',
            'btn.clear': 'Clear',
            'btn.download': 'Download',
            'btn.upload': 'Upload',
            'btn.new': 'New',
            'btn.create': 'Create',
            'btn.update': 'Update',
            'btn.confirm': 'Confirm',
            'btn.yes': 'Yes',
            'btn.no': 'No',

            // Table Headers
            'table.actions': 'Actions',
            'table.status': 'Status',
            'table.date': 'Date',
            'table.name': 'Name',
            'table.type': 'Type',
            'table.description': 'Description',
            'table.notes': 'Notes',
            'table.priority': 'Priority',
            'table.department': 'Department',
            'table.location': 'Location',
            'table.code': 'Code',
            'table.id': 'ID',
            'table.created': 'Created Date',
            'table.updated': 'Updated Date',
            'table.by': 'By',
            'table.count': 'Count',
            'table.total': 'Total',

            // Skeleton Loading
            'skeleton.loading': 'Loading...',
            'skeleton.noData': 'No data available',
            'skeleton.error': 'Error loading data',
            'skeleton.retry': 'Retry',
            'skeleton.empty': 'No items to display',

            // Common Messages
            'msg.success': 'Success',
            'msg.error': 'Error occurred',
            'msg.warning': 'Warning',
            'msg.info': 'Information',
            'msg.confirm': 'Are you sure?',
            'msg.saved': 'Saved successfully',
            'msg.deleted': 'Deleted successfully',
            'msg.updated': 'Updated successfully',
            'msg.loading': 'Loading...',
            'msg.processing': 'Processing...',
            'msg.noResults': 'No results found',
            'msg.searchPlaceholder': 'Search here...',
            'msg.select': 'Select...',
            'msg.all': 'All',
            'msg.none': 'None',
            'msg.required': 'Required field',
            'msg.invalid': 'Invalid data',
            'msg.networkError': 'Network connection error',
            'msg.serverError': 'Server error',
            'msg.timeout': 'Request timeout',
            'msg.unauthorized': 'Unauthorized',
            'msg.forbidden': 'Forbidden',
            'msg.notFound': 'Not found',

            // Filters
            'filter.all': 'All',
            'filter.active': 'Active',
            'filter.inactive': 'Inactive',
            'filter.pending': 'Pending',
            'filter.approved': 'Approved',
            'filter.rejected': 'Rejected',
            'filter.completed': 'Completed',
            'filter.open': 'Open',
            'filter.closed': 'Closed',
            'filter.dateFrom': 'Date From',
            'filter.dateTo': 'Date To',

            // Pagination
            'pagination.prev': 'Previous',
            'pagination.next': 'Next',
            'pagination.first': 'First',
            'pagination.last': 'Last',
            'pagination.of': 'of',
            'pagination.items': 'items',
            'pagination.page': 'Page',
            'pagination.showing': 'Showing',
            'pagination.to': 'to',

            // Modules
            'module.dashboard': 'Dashboard',
            'module.users': 'Users',
            'module.employees': 'Employees',
            'module.incidents': 'Incidents',
            'module.nearmiss': 'Near Miss Reports',
            'module.ptw': 'Work Permits',
            'module.training': 'Training',
            'module.clinic': 'Clinic',
            'module.fireequipment': 'Fire Equipment',
            'module.ppe': 'PPE',
            'module.contractors': 'Contractors',
            'module.violations': 'Violations',
            'module.reports': 'Reports',
            'module.settings': 'Settings',
            'module.behavior': 'Behavior Monitoring',
            'module.chemicals': 'Chemical Safety',
            'module.observations': 'Daily Observations',
            'module.iso': 'ISO',
            'module.emergency': 'Emergency',
            'module.risk': 'Risk Assessment',
            'module.documents': 'Documents',
            'module.audit': 'Audit',
            'module.sustainability': 'Sustainability',
            'module.inspections': 'Inspections',
            'module.safetyteam': 'Safety Team',

            // Settings Module specific translations
            'settings.title': 'Settings',
            'settings.subtitle': 'Manage system settings, integrations, and permissions',
            'settings.tabs.company': 'Company Data & Identity',
            'settings.tabs.integration': 'Integration & Sync',
            'settings.tabs.cloud': 'Cloud Storage',
            'settings.tabs.drive': 'Google Drive',
            'settings.tabs.sharepoint': 'Microsoft SharePoint',
            'settings.tabs.system': 'System Settings',
            'settings.tabs.forms': 'Form Settings',
            'settings.tabs.violations': 'Violation Types',
            'settings.tabs.reports': 'Reports & Notifications',
            'settings.tabs.email': 'Email Notifications',
            'settings.tabs.permissions': 'Permissions & Approvals',
            'settings.tabs.circuit': 'Approval Circuit',
            'settings.tabs.logs': 'Logs & Monitoring',
            
            'settings.company.title': 'Company Data & Identity',
            'settings.company.subtitle': 'Company information, logo, and visual identity settings',
            'settings.company.name': 'Company Name (appears in header and reports)',
            'settings.company.nameHint': 'This name will be used in the application header and all PDF reports.',
            'settings.company.fontSize': 'Company Name Font Size (pixels)',
            'settings.company.fontSizeHint': 'Default font size: 16px. You can change it from 8 to 72 pixels.',
            'settings.company.secondaryName': 'Secondary Name / Additional Line (appears in header and reports)',
            'settings.company.secondaryNameHint': 'This line will be displayed below the company name in the header and reports. If left empty, it will not appear in the interface or PDF.',

            // PTW Module specific translations
            'ptw.title': 'Work Permits',
            'ptw.subtitle': 'Permit to Work Management',
            'ptw.tabs.list': 'Permits List',
            'ptw.tabs.registry': 'Permits Registry',
            'ptw.tabs.analytics': 'Analytics',
            'ptw.btn.newPermit': 'New Permit',
            'ptw.btn.approve': 'Approve',
            'ptw.btn.reject': 'Reject',
            'ptw.status.pending': 'Pending',
            'ptw.status.approved': 'Approved',
            'ptw.status.rejected': 'Rejected',
            'ptw.status.expired': 'Expired',
            'ptw.status.active': 'Active',
            'ptw.form.permitType': 'Permit Type',
            'ptw.form.workLocation': 'Work Location',
            'ptw.form.workDescription': 'Work Description',
            'ptw.form.startDate': 'Start Date',
            'ptw.form.endDate': 'End Date',
            'ptw.form.requestingParty': 'Requesting Party',
            'ptw.form.approvals': 'Approvals',
            'ptw.safety.officer': 'Safety Officer',
            'ptw.safety.required': 'Safety approval is required',

            // Users Module translations
            'users.title': 'Users',
            'users.subtitle': 'User and Permission Management',
            'users.btn.newUser': 'New User',
            'users.table.name': 'Name',
            'users.table.email': 'Email',
            'users.table.role': 'Role',
            'users.table.department': 'Department',
            'users.table.status': 'Status',
            'users.status.active': 'Active',
            'users.status.inactive': 'Inactive',
            'users.form.fullName': 'Full Name',
            'users.form.email': 'Email',
            'users.form.password': 'Password',
            'users.form.role': 'Job Role',
            'users.form.department': 'Department',

            // Incidents Module translations
            'incidents.title': 'Incidents',
            'incidents.subtitle': 'Incident Recording and Tracking',
            'incidents.btn.newIncident': 'New Incident',
            'incidents.table.incidentType': 'Incident Type',
            'incidents.table.date': 'Incident Date',
            'incidents.table.location': 'Location',
            'incidents.table.severity': 'Severity',
            'incidents.table.status': 'Status',
            'incidents.form.description': 'Incident Description',
            'incidents.form.injuredPerson': 'Injured Person',
            'incidents.form.witnesses': 'Witnesses',
            'incidents.form.immediateAction': 'Immediate Action',
            'incidents.form.rootCause': 'Root Cause',
            'incidents.form.correctiveAction': 'Corrective Action',
            'incidents.severity.low': 'Low',
            'incidents.severity.medium': 'Medium',
            'incidents.severity.high': 'High',
            'incidents.severity.critical': 'Critical',
            'incidents.status.open': 'Open',
            'incidents.status.investigating': 'Investigating',
            'incidents.status.closed': 'Closed',

            // Training Module translations
            'training.title': 'Training',
            'training.subtitle': 'Training Programs and Certificates Management',
            'training.btn.newTraining': 'New Training Program',
            'training.btn.newCertificate': 'New Certificate',
            'training.table.trainingName': 'Program Name',
            'training.table.trainer': 'Trainer',
            'training.table.date': 'Date',
            'training.table.duration': 'Duration',
            'training.table.participants': 'Participants',
            'training.table.status': 'Status',
            'training.form.trainingType': 'Training Type',
            'training.form.trainingTopic': 'Training Topic',
            'training.form.trainer': 'Trainer',
            'training.form.location': 'Training Location',
            'training.form.startDate': 'Start Date',
            'training.form.endDate': 'End Date',
            'training.form.duration': 'Duration (hours)',
            'training.status.planned': 'Planned',
            'training.status.ongoing': 'Ongoing',
            'training.status.completed': 'Completed',
            'training.status.cancelled': 'Cancelled',
            'training.certificate.title': 'Certificates',
            'training.certificate.employee': 'Employee',
            'training.certificate.issueDate': 'Issue Date',
            'training.certificate.expiryDate': 'Expiry Date',
            'training.certificate.status': 'Certificate Status',
            'training.certificate.valid': 'Valid',
            'training.certificate.expired': 'Expired',

            // NearMiss Module translations
            'nearmiss.title': 'Near Miss Reports',
            'nearmiss.subtitle': 'Record and track near miss incident reports',
            'nearmiss.btn.newReport': 'New Report',
            'nearmiss.table.date': 'Report Date',
            'nearmiss.table.location': 'Location',
            'nearmiss.table.type': 'Report Type',
            'nearmiss.table.severity': 'Severity',
            'nearmiss.table.reporter': 'Reporter',
            'nearmiss.table.status': 'Status',
            'nearmiss.form.description': 'Near Miss Description',
            'nearmiss.form.immediateAction': 'Immediate Action Taken',
            'nearmiss.form.suggestedAction': 'Suggested Action',
            'nearmiss.status.reported': 'Reported',
            'nearmiss.status.underReview': 'Under Review',
            'nearmiss.status.resolved': 'Resolved',

            // Clinic Module translations
            'clinic.title': 'Clinic',
            'clinic.subtitle': 'Manage clinic visits and medical cases',
            'clinic.btn.newVisit': 'New Visit',
            'clinic.tabs.visits': 'Visit Log',
            'clinic.tabs.employees': 'Employees',
            'clinic.tabs.contractors': 'Contractors',
            'clinic.tabs.medications': 'Medications',
            'clinic.tabs.analytics': 'Analytics',
            'clinic.table.employeeCode': 'Employee Code',
            'clinic.table.name': 'Name',
            'clinic.table.visitDate': 'Visit Date',
            'clinic.table.reason': 'Reason',
            'clinic.table.diagnosis': 'Diagnosis',
            'clinic.table.status': 'Status',
            'clinic.table.medications': 'Medications',
            'clinic.form.patientType': 'Patient Type',
            'clinic.form.patientName': 'Patient Name',
            'clinic.form.visitDate': 'Visit Date',
            'clinic.form.reason': 'Reason for Visit',
            'clinic.form.diagnosis': 'Diagnosis',
            'clinic.form.treatment': 'Treatment',
            'clinic.form.medications': 'Dispensed Medications',
            'clinic.status.treated': 'Treated',
            'clinic.status.referred': 'Referred',
            'clinic.status.followUp': 'Follow Up',

            // FireEquipment Module translations
            'fire.title': 'Fire Equipment',
            'fire.subtitle': 'Manage and inspect fire and safety equipment',
            'fire.btn.newEquipment': 'New Equipment',
            'fire.btn.inspect': 'Inspect',
            'fire.btn.qrScan': 'Scan QR',
            'fire.tabs.database': 'Database',
            'fire.tabs.register': 'Register',
            'fire.tabs.inspections': 'Inspections',
            'fire.tabs.analytics': 'Analytics',
            'fire.table.equipmentId': 'Equipment ID',
            'fire.table.type': 'Type',
            'fire.table.location': 'Location',
            'fire.table.status': 'Status',
            'fire.table.lastInspection': 'Last Inspection',
            'fire.table.nextInspection': 'Next Inspection',
            'fire.form.equipmentType': 'Equipment Type',
            'fire.form.deviceId': 'Equipment ID',
            'fire.form.location': 'Equipment Location',
            'fire.form.installationDate': 'Installation Date',
            'fire.form.lastInspection': 'Last Inspection Date',
            'fire.status.active': 'Active',
            'fire.status.maintenance': 'Needs Maintenance',
            'fire.status.outOfService': 'Out of Service',
            'fire.inspection.monthly': 'Monthly Inspection',
            'fire.inspection.quarterly': 'Quarterly Inspection',

            // PPE Module translations
            'ppe.title': 'Personal Protective Equipment',
            'ppe.subtitle': 'Manage and track personal protective equipment',
            'ppe.btn.newItem': 'New Item',
            'ppe.btn.issue': 'Issue',
            'ppe.btn.return': 'Return',
            'ppe.tabs.inventory': 'Inventory',
            'ppe.tabs.issuance': 'Issuance',
            'ppe.tabs.returns': 'Returns',
            'ppe.tabs.analytics': 'Analytics',
            'ppe.table.itemName': 'Item Name',
            'ppe.table.category': 'Category',
            'ppe.table.quantity': 'Quantity',
            'ppe.table.unit': 'Unit',
            'ppe.table.minStock': 'Min Stock',
            'ppe.table.status': 'Status',
            'ppe.table.employee': 'Employee',
            'ppe.table.issueDate': 'Issue Date',
            'ppe.table.returnDate': 'Return Date',
            'ppe.form.itemName': 'Item Name',
            'ppe.form.category': 'Category',
            'ppe.form.quantity': 'Quantity',
            'ppe.form.unit': 'Unit',
            'ppe.form.minStock': 'Minimum Stock Level',
            'ppe.status.available': 'Available',
            'ppe.status.lowStock': 'Low Stock',
            'ppe.status.outOfStock': 'Out of Stock',

            // Employees Module translations
            'employees.title': 'Employees',
            'employees.subtitle': 'Manage employee data and job positions',
            'employees.btn.newEmployee': 'New Employee',
            'employees.table.employeeCode': 'Employee Code',
            'employees.table.fullName': 'Full Name',
            'employees.table.jobTitle': 'Job Title',
            'employees.table.department': 'Department',
            'employees.table.factory': 'Factory',
            'employees.table.workplace': 'Workplace',
            'employees.table.joinDate': 'Join Date',
            'employees.table.status': 'Status',
            'employees.form.fullName': 'Full Name',
            'employees.form.employeeCode': 'Employee Code',
            'employees.form.jobTitle': 'Job Title',
            'employees.form.department': 'Department',
            'employees.form.factory': 'Factory',
            'employees.form.workplace': 'Workplace',
            'employees.form.phone': 'Phone Number',
            'employees.form.email': 'Email',
            'employees.form.joinDate': 'Join Date',
            'employees.status.active': 'Active',
            'employees.status.inactive': 'Inactive',
            'employees.status.onLeave': 'On Leave',

            // Contractors Module translations
            'contractors.title': 'Contractors',
            'contractors.subtitle': 'Manage contractors and contracts',
            'contractors.btn.newContractor': 'New Contractor',
            'contractors.btn.evaluate': 'Evaluate',
            'contractors.btn.approve': 'Approve',
            'contractors.tabs.list': 'Contractors List',
            'contractors.tabs.approved': 'Approved',
            'contractors.tabs.evaluations': 'Evaluations',
            'contractors.tabs.requests': 'Approval Requests',
            'contractors.table.contractorName': 'Contractor Name',
            'contractors.table.company': 'Company',
            'contractors.table.specialty': 'Specialty',
            'contractors.table.contractNumber': 'Contract Number',
            'contractors.table.startDate': 'Start Date',
            'contractors.table.endDate': 'End Date',
            'contractors.table.status': 'Status',
            'contractors.form.companyName': 'Company Name',
            'contractors.form.contractorName': 'Contractor Name',
            'contractors.form.specialty': 'Specialty',
            'contractors.form.contractNumber': 'Contract Number',
            'contractors.form.startDate': 'Contract Start Date',
            'contractors.form.endDate': 'Contract End Date',
            'contractors.form.contactPerson': 'Contact Person',
            'contractors.form.phone': 'Phone Number',
            'contractors.form.email': 'Email',
            'contractors.status.active': 'Active',
            'contractors.status.expired': 'Expired',
            'contractors.status.pending': 'Pending',
            'contractors.status.approved': 'Approved',

            // Violations Module translations
            'violations.title': 'Violations',
            'violations.subtitle': 'Manage and track violations and penalties',
            'violations.btn.newViolation': 'New Violation',
            'violations.btn.newPenalty': 'New Penalty',
            'violations.tabs.violations': 'Violations',
            'violations.tab.penalties': 'Penalties',
            'violations.tabs.analytics': 'Analytics',
            'violations.table.violationType': 'Violation Type',
            'violations.table.date': 'Violation Date',
            'violations.table.employee': 'Employee/Contractor',
            'violations.table.severity': 'Severity',
            'violations.table.status': 'Status',
            'violations.table.penalty': 'Penalty',
            'violations.form.violationDescription': 'Violation Description',
            'violations.form.violationLocation': 'Violation Location',
            'violations.form.violationDate': 'Violation Date',
            'violations.form.violationTime': 'Violation Time',
            'violations.form.witnesses': 'Witnesses',
            'violations.form.evidence': 'Evidence/Proof',
            'violations.severity.low': 'Low',
            'violations.severity.medium': 'Medium',
            'violations.severity.high': 'High',
            'violations.severity.critical': 'Critical',
            'violations.status.pending': 'Pending',
            'violations.status.approved': 'Approved',
            'violations.status.rejected': 'Rejected',

            // Reports Module translations
            'reports.title': 'Reports',
            'reports.subtitle': 'Create and manage reports',
            'reports.btn.newReport': 'New Report',
            'reports.btn.generate': 'Generate Report',
            'reports.btn.export': 'Export',
            'reports.tabs.saved': 'Saved Reports',
            'reports.tabs.generate': 'Generate Report',
            'reports.tabs.scheduled': 'Scheduled Reports',
            'reports.table.reportName': 'Report Name',
            'reports.table.reportType': 'Report Type',
            'reports.table.createdBy': 'Created By',
            'reports.table.createdDate': 'Created Date',
            'reports.table.lastRun': 'Last Run',
            'reports.table.status': 'Status',
            'reports.form.reportName': 'Report Name',
            'reports.form.reportType': 'Report Type',
            'reports.form.dateRange': 'Date Range',
            'reports.form.filters': 'Filters',
            'reports.status.active': 'Active',
            'reports.status.inactive': 'Inactive',

            // ISO Module translations
            'iso.title': 'ISO Quality Management System',
            'iso.subtitle': 'Manage ISO quality management requirements and certificates',
            'iso.btn.newDocument': 'New Document',
            'iso.btn.audit': 'New Audit',
            'iso.tabs.documents': 'Documents',
            'iso.tabs.audits': 'Audits',
            'iso.tabs.certificates': 'Certificates',
            'iso.tabs.analytics': 'Analytics',
            'iso.table.documentCode': 'Document Code',
            'iso.table.documentName': 'Document Name',
            'iso.table.version': 'Version',
            'iso.table.issueDate': 'Issue Date',
            'iso.table.reviewDate': 'Review Date',
            'iso.table.status': 'Status',
            'iso.form.documentCode': 'Document Code',
            'iso.form.documentName': 'Document Name',
            'iso.form.version': 'Version Number',
            'iso.form.issueDate': 'Issue Date',
            'iso.form.reviewDate': 'Next Review Date',
            'iso.status.active': 'Active',
            'iso.status.underReview': 'Under Review',
            'iso.status.archived': 'Archived',

            // Emergency Module translations
            'emergency.title': 'Emergency',
            'emergency.subtitle': 'Manage emergency plans and evacuation procedures',
            'emergency.btn.newPlan': 'New Emergency Plan',
            'emergency.btn.drill': 'Evacuation Drill',
            'emergency.tabs.plans': 'Emergency Plans',
            'emergency.tabs.drills': 'Drills',
            'emergency.tabs.equipment': 'Emergency Equipment',
            'emergency.tabs.contacts': 'Contacts',
            'emergency.table.planName': 'Plan Name',
            'emergency.table.planType': 'Plan Type',
            'emergency.table.lastDrill': 'Last Drill',
            'emergency.table.nextDrill': 'Next Drill',
            'emergency.table.status': 'Status',
            'emergency.form.planName': 'Emergency Plan Name',
            'emergency.form.planType': 'Plan Type',
            'emergency.form.assemblyPoint': 'Assembly Point',
            'emergency.form.evacuationRoutes': 'Evacuation Routes',
            'emergency.status.active': 'Active',
            'emergency.status.inactive': 'Inactive',

            // SOP/JHA Module translations
            'sop.title': 'Safe Operating Procedures',
            'sop.subtitle': 'Manage safe operating procedures and job hazard analysis',
            'sop.btn.newSOP': 'New SOP',
            'sop.btn.newJHA': 'New JHA',
            'sop.tabs.sop': 'Procedures',
            'sop.tabs.jha': 'Hazard Analysis',
            'sop.tabs.approvals': 'Approvals',
            'sop.table.sopCode': 'SOP Code',
            'sop.table.sopName': 'SOP Name',
            'sop.table.department': 'Department',
            'sop.table.revision': 'Revision',
            'sop.table.lastUpdate': 'Last Update',
            'sop.table.status': 'Status',
            'sop.form.sopCode': 'SOP Code',
            'sop.form.sopName': 'SOP Name',
            'sop.form.department': 'Department',
            'sop.form.purpose': 'Purpose',
            'sop.form.scope': 'Scope',
            'sop.form.responsibilities': 'Responsibilities',
            'sop.form.procedures': 'Procedures',
            'sop.status.active': 'Active',
            'sop.status.underReview': 'Under Review',
            'sop.status.obsolete': 'Obsolete',

            // DailyObservations Module translations
            'daily.title': 'Daily Observations',
            'daily.subtitle': 'Record daily observations on the factory floor',
            'daily.btn.newObservation': 'New Observation',
            'daily.table.date': 'Date',
            'daily.table.observer': 'Observer',
            'daily.table.location': 'Location',
            'daily.table.observation': 'Observation',
            'daily.table.category': 'Category',
            'daily.table.priority': 'Priority',
            'daily.table.status': 'Status',
            'daily.form.observationDate': 'Observation Date',
            'daily.form.observerName': 'Observer Name',
            'daily.form.location': 'Location',
            'daily.form.category': 'Observation Category',
            'daily.form.description': 'Observation Description',
            'daily.form.action': 'Action Taken',
            'daily.form.responsible': 'Responsible Party',
            'daily.priority.low': 'Low',
            'daily.priority.medium': 'Medium',
            'daily.priority.high': 'High',
            'daily.status.open': 'Open',
            'daily.status.inProgress': 'In Progress',
            'daily.status.closed': 'Closed',

            // BehaviorMonitoring Module translations
            'behavior.title': 'Behavior Monitoring',
            'behavior.subtitle': 'Evaluate and monitor safety behaviors',
            'behavior.btn.newEvaluation': 'New Evaluation',
            'behavior.table.date': 'Date',
            'behavior.table.employee': 'Employee',
            'behavior.table.observer': 'Observer',
            'behavior.table.score': 'Score',
            'behavior.table.status': 'Status',
            'behavior.form.evaluationDate': 'Evaluation Date',
            'behavior.form.employee': 'Employee',
            'behavior.form.observer': 'Observer',
            'behavior.form.ppeCompliance': 'PPE Compliance',
            'behavior.form.workProcedures': 'Work Procedures',
            'behavior.form.attitude': 'Behavior and Attitude',
            'behavior.form.comments': 'Comments',
            'behavior.status.excellent': 'Excellent',
            'behavior.status.good': 'Good',
            'behavior.status.needsImprovement': 'Needs Improvement',
            'behavior.status.unsatisfactory': 'Unsatisfactory',

            // ChemicalSafety Module translations
            'chemical.title': 'Chemical Safety',
            'chemical.subtitle': 'Manage chemical and product safety',
            'chemical.btn.newChemical': 'New Chemical',
            'chemical.btn.msds': 'Safety Data Sheet',
            'chemical.tabs.inventory': 'Inventory',
            'chemical.tabs.msds': 'SDS Cards',
            'chemical.tabs.storage': 'Storage',
            'chemical.table.chemicalName': 'Chemical Name',
            'chemical.table.casNumber': 'CAS Number',
            'chemical.table.hazardClass': 'Hazard Class',
            'chemical.table.quantity': 'Quantity',
            'chemical.table.storageLocation': 'Storage Location',
            'chemical.table.status': 'Status',
            'chemical.form.chemicalName': 'Chemical Name',
            'chemical.form.casNumber': 'CAS Number',
            'chemical.form.hazardClass': 'Hazard Class',
            'chemical.form.quantity': 'Quantity',
            'chemical.form.unit': 'Unit',
            'chemical.form.storageLocation': 'Storage Location',
            'chemical.status.safe': 'Safe',
            'chemical.status.hazardous': 'Hazardous',
            'chemical.status.restricted': 'Restricted Use',

            // PeriodicInspections Module translations
            'periodic.title': 'Periodic Inspections',
            'periodic.subtitle': 'Manage periodic inspections for machinery and equipment',
            'periodic.btn.newInspection': 'New Inspection',
            'periodic.btn.qrScan': 'Scan QR',
            'periodic.tabs.schedule': 'Schedule',
            'periodic.tabs.register': 'Register',
            'periodic.tabs.equipment': 'Equipment',
            'periodic.tabs.analytics': 'Analytics',
            'periodic.table.equipmentName': 'Equipment Name',
            'periodic.table.equipmentId': 'Equipment ID',
            'periodic.table.inspectionType': 'Inspection Type',
            'periodic.table.dueDate': 'Due Date',
            'periodic.table.status': 'Status',
            'periodic.table.inspector': 'Inspector',
            'periodic.form.equipmentName': 'Equipment Name',
            'periodic.form.equipmentId': 'Equipment ID',
            'periodic.form.inspectionType': 'Inspection Type',
            'periodic.form.frequency': 'Inspection Frequency',
            'periodic.form.lastInspection': 'Last Inspection Date',
            'periodic.form.nextInspection': 'Next Inspection Date',
            'periodic.form.inspector': 'Inspector Name',
            'periodic.status.pending': 'Pending',
            'periodic.status.completed': 'Completed',
            'periodic.status.overdue': 'Overdue',
            'periodic.frequency.daily': 'Daily',
            'periodic.frequency.weekly': 'Weekly',
            'periodic.frequency.monthly': 'Monthly',
            'periodic.frequency.quarterly': 'Quarterly',
            'periodic.frequency.yearly': 'Yearly',

            // SafetyBudget Module translations
            'budget.title': 'Safety Budget',
            'budget.subtitle': 'Manage HSE safety budget',
            'budget.btn.newItem': 'New Budget Item',
            'budget.btn.approve': 'Approve Budget',
            'budget.tabs.plan': 'Budget Plan',
            'budget.tabs.actual': 'Actual Spending',
            'budget.tabs.variance': 'Variance Analysis',
            'budget.tabs.reports': 'Reports',
            'budget.table.itemName': 'Item Name',
            'budget.table.category': 'Category',
            'budget.table.planned': 'Planned',
            'budget.table.actual': 'Actual',
            'budget.table.variance': 'Variance',
            'budget.table.status': 'Status',
            'budget.form.itemName': 'Budget Item Name',
            'budget.form.category': 'Budget Category',
            'budget.form.plannedAmount': 'Planned Amount',
            'budget.form.actualAmount': 'Actual Amount',
            'budget.form.description': 'Description',
            'budget.category.ppe': 'PPE Equipment',
            'budget.category.training': 'Training',
            'budget.category.equipment': 'Equipment',
            'budget.status.underBudget': 'Under Budget',
            'budget.status.overBudget': 'Over Budget',
        }
    },

    /**
     * الحصول على اللغة الحالية
     * @returns {string} 'ar' أو 'en'
     */
    getCurrentLanguage() {
        return AppState?.currentLanguage || localStorage.getItem('language') || this.defaultLanguage;
    },

    /**
     * التحقق من RTL
     * @returns {boolean}
     */
    isRTL() {
        return this.getCurrentLanguage() === 'ar';
    },

    /**
     * الحصول على ترجمة
     * @param {string} key - مفتاح الترجمة
     * @param {string} defaultValue - القيمة الافتراضية
     * @returns {string}
     */
    t(key, defaultValue = null) {
        const lang = this.getCurrentLanguage();
        const translation = this.translations[lang]?.[key];
        return translation || defaultValue || key;
    },

    /**
     * إضافة ترجمات جديدة
     * @param {string} lang - اللغة ('ar' أو 'en')
     * @param {Object} newTranslations - كائن الترجمات الجديدة
     */
    addTranslations(lang, newTranslations) {
        if (!this.translations[lang]) {
            this.translations[lang] = {};
        }
        Object.assign(this.translations[lang], newTranslations);
    },

    /**
     * الحصول على ترجمات موديول معين
     * @param {string} moduleName - اسم الموديول
     * @returns {Object} { t: function, isRTL: boolean, lang: string }
     */
    getModuleTranslations(moduleName) {
        const lang = this.getCurrentLanguage();
        const isRTL = this.isRTL();

        return {
            t: (key, defaultValue) => this.t(`${moduleName}.${key}`, defaultValue),
            isRTL,
            lang
        };
    }
};

// Export I18n globally
if (typeof window !== 'undefined') {
    window.I18n = I18n;
}
