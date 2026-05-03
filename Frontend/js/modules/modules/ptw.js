/**
 * PTW Module
 * تم استخراجه من app-modules.js
 */
// ===== PTW Module (Permit to Work) =====
const PTW = {
    approvals: [], // مصفوفة الموافقات
    formApprovals: [],
    formCircuitOwnerId: '__default__',
    formCircuitName: '',
    _loadPTWListTimeout: null, // للتحكم في التحميل الزائد
    _isSubmitting: false, // منع الحفظ المتكرر
    _i18nSectionObserver: null,
    _i18nBodyObserver: null,

    applyModuleI18n(root) {
        const target = root || document;
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        if (typeof i18nCore.applyI18n === 'function') i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') i18nCore.applyLiteralTranslations(target);
    },

    _t(key, fallback) {
        if (window.AppI18n && typeof window.AppI18n.t === 'function') return window.AppI18n.t(key, fallback);
        if (window.I18n && typeof window.I18n.t === 'function') return window.I18n.t(key, fallback);
        return fallback;
    },

    /**
     * عرض حالة التصريح حسب لغة الواجهة (تُبقى القيم المخزنة عربية للمنطق والفلترة).
     */
    statusLabel(raw) {
        const s = String(raw || '').trim();
        if (!s) return this._t('module.ptw.common.notSpecified', 'غير محدد');
        const map = {
            'مغلق': 'module.ptw.status.closed',
            'مفتوح': 'module.ptw.status.open',
            'مرفوض': 'module.ptw.status.rejected',
            'قيد المراجعة': 'module.ptw.status.underReview',
            'موافق عليه': 'module.ptw.status.approved',
            'اكتمل العمل بشكل آمن': 'module.ptw.status.safelyCompleted',
            'إغلاق جبري': 'module.ptw.status.forcedClose',
            'لم يكتمل العمل': 'module.ptw.status.incomplete'
        };
        const k = map[s];
        if (k) return this._t(k, s);
        return s;
    },

    approvalRoleLabel(raw) {
        const s = String(raw || '').trim();
        if (!s) return '';
        const map = {
            'مسؤول الجهة الطالبة': 'module.ptw.approval.requestingOfficer',
            'مدير منطقة الأعمال': 'module.ptw.approval.areaManager',
            'مسؤول السلامة والصحة المهنية': 'module.ptw.approval.safetyOfficer',
            'موافقة مطلوبة': 'module.ptw.approval.approvalRequired'
        };
        const k = map[s];
        if (k) return this._t(k, s);
        return s;
    },

    formatDurationI18n(diffMs) {
        if (!Number.isFinite(diffMs)) return this._t('module.ptw.duration.error', 'خطأ');
        if (diffMs < 0) return this._t('module.ptw.duration.invalid', 'غير صحيح');
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h === 0) return this._t('module.ptw.duration.minutesOnly', '{n} دقيقة').replace(/\{n\}/g, String(m));
        if (m === 0) return this._t('module.ptw.duration.hoursOnly', '{n} ساعة').replace(/\{n\}/g, String(h));
        return this._t('module.ptw.duration.hoursAndMinutes', '{h} ساعة و {m} دقيقة')
            .replace(/\{h\}/g, String(h)).replace(/\{m\}/g, String(m));
    },

    ensureI18nObservers(section) {
        if (this._i18nSectionObserver) {
            this._i18nSectionObserver.disconnect();
            this._i18nSectionObserver = null;
        }

        if (section && typeof MutationObserver !== 'undefined') {
            this._i18nSectionObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node && node.nodeType === 1) this.applyModuleI18n(node);
                    });
                });
            });
            this._i18nSectionObserver.observe(section, { childList: true, subtree: true });
        }

        if (!this._i18nBodyObserver && typeof MutationObserver !== 'undefined') {
            this._i18nBodyObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (!node || node.nodeType !== 1) return;
                        if (node.classList?.contains('modal-overlay') || node.querySelector?.('.modal-overlay')) {
                            this.applyModuleI18n(node);
                        }
                    });
                });
            });
            this._i18nBodyObserver.observe(document.body, { childList: true, subtree: true });
        }
    },

    getDefaultApprovals() {
        return [
            { role: 'مسؤول الجهة الطالبة', required: true, approved: false, rejected: false, status: 'pending', approver: '', date: '', comments: '', order: 0 },
            { role: 'مدير منطقة الأعمال', required: true, approved: false, rejected: false, status: 'pending', approver: '', date: '', comments: '', order: 1 },
            { role: 'مسؤول السلامة والصحة المهنية', required: true, approved: false, rejected: false, status: 'pending', approver: '', date: '', comments: '', order: 2, isSafetyOfficer: true }
        ];
    },

    isSafetyRole(role = '') {
        const keywords = ['السلامة', 'Safety'];
        return keywords.some(keyword => role && role.toLowerCase().includes(keyword.toLowerCase()));
    },

    // تحديث أرقام صفوف الاعتمادات
    updateApprovalNumbers(listId) {
        const tbody = document.getElementById(listId);
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, idx) => {
            const numCell = row.querySelector('td:first-child');
            if (numCell) {
                numCell.textContent = idx + 1;
            }
        });
    },

    normalizeApprovals(approvals = []) {
        if (!Array.isArray(approvals) || approvals.length === 0) {
            return this.getDefaultApprovals();
        }

        return approvals.map((approval, index) => {
            const ownerId = approval.circuitOwnerId || '__default__';
            const candidates = Array.isArray(approval.candidates)
                ? approval.candidates
                    .map(candidate => {
                        if (!candidate) return null;
                        if (candidate.id && candidate.name && candidate.email !== undefined) {
                            return candidate;
                        }
                        return ApprovalCircuits.toCandidate(ApprovalCircuits.getUserById(candidate.id || candidate));
                    })
                    .filter(Boolean)
                : [];
            let approverId = approval.approverId || approval.approverUserId || '';
            let approverName = approval.approver || '';
            let approverEmail = approval.approverEmail || '';

            if (approverId) {
                const approverUser = ApprovalCircuits.getUserById(approverId);
                if (approverUser) {
                    approverName = approverName || approverUser.name || approverUser.email || '';
                    approverEmail = approverEmail || approverUser.email || '';
                }
            } else if (approverEmail) {
                const candidate = candidates.find(candidate => candidate.email && candidate.email.toLowerCase() === approverEmail.toLowerCase());
                if (candidate) {
                    approverId = candidate.id;
                    approverName = candidate.name || approverName;
                }
            }

            const normalized = {
                role: approval.role || '',
                approverId,
                approver: approverName,
                approverEmail,
                required: approval.required !== false,
                approved: approval.approved === true,
                rejected: approval.rejected === true,
                status: approval.status || (approval.approved ? 'approved' : approval.rejected ? 'rejected' : 'pending'),
                date: approval.date || '',
                comments: approval.comments || '',
                order: typeof approval.order === 'number' ? approval.order : index,
                isSafetyOfficer: approval.isSafetyOfficer === true || this.isSafetyRole(approval.role),
                candidates,
                history: Array.isArray(approval.history) ? approval.history : [],
                assignedAt: approval.assignedAt || '',
                assignedBy: approval.assignedBy || null,
                circuitOwnerId: ownerId
            };

            if (normalized.status === 'approved') {
                normalized.approved = true;
                normalized.rejected = false;
            } else if (normalized.status === 'rejected') {
                normalized.approved = false;
                normalized.rejected = true;
            } else {
                normalized.status = 'pending';
                normalized.approved = false;
                normalized.rejected = false;
            }

            return normalized;
        }).sort((a, b) => (a.order || 0) - (b.order || 0));
    },

    getNextPendingApproval(approvals = []) {
        return approvals.find(a => a.status === 'pending');
    },

    updatePermitStatus(permit) {
        if (!permit) return;
        if (permit.isManualEntry === true) {
            const manualStatus = String(permit.status || '').trim();
            permit.approvals = [];
            permit.status = manualStatus || 'مغلق';
            return;
        }
        
        // تطبيع الاعتمادات للتأكد من صحة البيانات
        permit.approvals = this.normalizeApprovals(permit.approvals || []);

        // التحقق من وجود رفض في أي اعتماد مطلوب
        const hasRejection = permit.approvals.some(a => 
            a.status === 'rejected' && a.required !== false
        );
        
        if (hasRejection) {
            permit.status = 'مرفوض';
            permit.rejectedAt = permit.rejectedAt || new Date().toISOString();
            return;
        }

        // الحصول على جميع الاعتمادات المطلوبة
        const requiredApprovals = permit.approvals.filter(a => a.required !== false);
        
        // التحقق من أن جميع الاعتمادات المطلوبة تم اعتمادها
        const allRequiredApproved = requiredApprovals.length > 0 && 
            requiredApprovals.every(a => a.status === 'approved');
        
        // البحث عن اعتماد مسؤول السلامة
        const safetyApproval = permit.approvals.find(a => a.isSafetyOfficer === true);

        // إذا كان هناك اعتماد مسؤول السلامة، يجب أن يكون معتمداً أيضاً
        const safetyApproved = !safetyApproval || safetyApproval.status === 'approved';

        // تحديث الحالة بناءً على الاعتمادات
        if (allRequiredApproved && safetyApproved) {
            permit.status = 'موافق عليه';
            permit.approvedAt = permit.approvedAt || new Date().toISOString();
        } else {
            // التحقق من وجود اعتمادات قيد الانتظار
            const hasPending = permit.approvals.some(a => 
                a.status === 'pending' && a.required !== false
            );
            
            if (hasPending) {
                permit.status = 'قيد المراجعة';
            } else if (requiredApprovals.length === 0) {
                // إذا لم يكن هناك اعتمادات مطلوبة، يعتبر معتمداً
                permit.status = 'موافق عليه';
                permit.approvedAt = permit.approvedAt || new Date().toISOString();
            } else {
                permit.status = 'قيد المراجعة';
            }
        }
    },

    triggerNotificationsUpdate() {
        document.dispatchEvent(new CustomEvent('ptw:updated'));
    },

    notifyPermitCreated(permit) {
        const nextApproval = this.getNextPendingApproval(permit.approvals || []);
        let message = this._t('module.ptw.notify.submitted', 'تم إرسال طلب تصريح العمل للمراجعة.');
        if (nextApproval && nextApproval.role) {
            const roleDisp = this.approvalRoleLabel(nextApproval.role);
            if (nextApproval.approver) {
                message += ' ' + this._t('module.ptw.notify.nextWithApprover', 'المرحلة التالية: {role} (المسؤول: {name}).')
                    .replace(/\{role\}/g, roleDisp).replace(/\{name\}/g, String(nextApproval.approver));
            } else {
                message += ' ' + this._t('module.ptw.notify.nextNeedAssign', 'المرحلة التالية: {role}. يرجى تعيين المسؤول عن الاعتماد.')
                    .replace(/\{role\}/g, roleDisp);
            }
        }
        Notification.success(message);
    },

    updateStatusField(status) {
        const statusField = document.getElementById('ptw-status');
        if (!statusField) return;

        const value = status || statusField.getAttribute('data-current-status') || 'قيد المراجعة';
        statusField.value = value;
        statusField.setAttribute('data-current-status', value);
        statusField.disabled = true;
        statusField.classList.add('opacity-70', 'cursor-not-allowed');
        statusField.setAttribute('title', this._t('module.ptw.statusField.title', 'يتم تحديث الحالة تلقائياً عبر الاعتمادات'));
    },

    /**
     * الحصول على اختصار نوع العمل
     */
    getWorkTypePrefix(workType) {
        // إذا كان workType فارغاً أو غير محدد، نستخدم بادئة افتراضية
        if (!workType || workType.trim() === '') {
            return 'PTW';
        }
        const prefixes = {
            'ساخن': 'HTW',      // Hot Work
            'بارد': 'CTW',      // Cold Work
            'كهربائي': 'ETW',   // Electrical Work
            'حر': 'EXW',       // Excavation Work
            'ارتفاع': 'HTW',    // Height Work
            'نفط': 'OTW',       // Oil Work
            'غاز': 'GTW',       // Gas Work
            'إغلاق': 'ISW',     // Isolation Work
            'كيميائي': 'CHW',   // Chemical Work
            'آخر': 'OTW',       // Other Work
            'أعمال ساخنة': 'HTW',
            'أعمال باردة': 'CTW',
            'أعمال كهربائية': 'ETW',
            'أعمال حفر': 'EXW',
            'أعمال في الأماكن المغلقة': 'CSW',
            'أعمال أخرى': 'OTW'
        };
        return prefixes[workType] || 'PTW';
    },

    /**
     * توليد رقم تسلسلي لكل نوع عمل
     */
    generateSequentialPTWId(workType) {
        const workTypePrefix = this.getWorkTypePrefix(workType);
        const existingPTWs = AppState.appData.ptw || [];

        // لترة التصاريح بنفس نوع العمل (أو جميع التصاريح التي تبدأ بـ PTW إذا كان workType فارغاً)
        const sameTypePTWs = existingPTWs.filter(p => {
            if (!p.id) return false;
            // إذا كان workType فارغاً، نستخدم جميع التصاريح التي تبدأ بـ PTW_ أو لا تحتوي على workType
            if (!workType || workType.trim() === '') {
                return !p.workType || p.workType.trim() === '' || p.id.startsWith('PTW_');
            }
            if (!p.workType) return false;
            const ptwPrefix = this.getWorkTypePrefix(p.workType);
            return ptwPrefix === workTypePrefix;
        });

        // الحصول على آخر رقم تسلسلي لهذا النوع
        let lastNumber = 0;
        sameTypePTWs.forEach(ptw => {
            if (ptw.id && ptw.id.includes('_')) {
                const parts = ptw.id.split('_');
                if (parts.length > 1) {
                    const num = parseInt(parts[parts.length - 1]);
                    if (!isNaN(num) && num > lastNumber) {
                        lastNumber = num;
                    }
                }
            }
        });

        // إرجاع رقم تسلسلي جديد
        return String(lastNumber + 1).padStart(4, '0');
    },

    /**
     * Temporary client-side ID.
     * Backend converts it to canonical sequential ID via hybrid resolver.
     */
    generateTemporaryId(prefix) {
        const safePrefix = String(prefix || 'TMP').trim().toUpperCase();
        return `${safePrefix}_TMP_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    },

    // الحصول على قائمة المواقع من الإعدادات
    getSiteOptions() {
        try {
            const t = (key, fallback) => PTW._t(key, fallback);
            // محاولة الحصول من Permissions.formSettingsState
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                return Permissions.formSettingsState.sites.map(site => ({
                    id: site.id,
                    name: site.name
                }));
            }

            // محاولة الحصول من AppState.appData.observationSites
            if (Array.isArray(AppState.appData?.observationSites) && AppState.appData.observationSites.length > 0) {
                return AppState.appData.observationSites.map(site => ({
                    id: site.id || site.siteId || Utils.generateId('SITE'),
                    name: site.name || site.title || site.label || t('module.ptw.fallback.unnamedSite', 'موقع غير محدد')
                }));
            }

            // محاولة الحصول من DailyObservations
            if (typeof DailyObservations !== 'undefined' && Array.isArray(DailyObservations.DEFAULT_SITES)) {
                return DailyObservations.DEFAULT_SITES.map((site, index) => ({
                    id: site.id || site.siteId || Utils.generateId('SITE'),
                    name: site.name || site.title || site.label || t('module.ptw.fallback.numberedSite', 'موقع {n}').replace(/\{n\}/g, String(index + 1))
                }));
            }

            return [];
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة المواقع:', error);
            return [];
        }
    },

    /** إعادة تعبئة قوائم الموقع/المكان الفرعي عند اكتمال تحميل إعدادات النماذج (استدعاء تلقائي من حدث formSettingsUpdated) */
    refreshSiteDropdowns() {
        try {
            const sites = this.getSiteOptions();
            const esc = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : (s) => String(s == null ? '' : s);
            const t = (k, f) => this._t(k, f);
            const opts = (empty) => '<option value="">' + (empty || t('module.ptw.placeholder.selectSite', 'اختر الموقع')) + '</option>' + (sites || []).map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('');
            const locationIds = ['manual-permit-location', 'ptw-filter-location', 'ptw-location', 'analysis-location'];
            locationIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.tagName === 'SELECT') { const v = el.value; el.innerHTML = opts(t('module.ptw.placeholder.selectSite', 'اختر الموقع')); if (v) el.value = v; }
            });
            const subIds = ['manual-permit-sublocation', 'ptw-filter-sublocation', 'ptw-sublocation'];
            subIds.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.tagName === 'SELECT') {
                    const locId = (document.getElementById('ptw-location') || document.getElementById('manual-permit-location') || {}).value;
                    const places = this.getPlaceOptions(locId);
                    const ph = t('module.ptw.placeholder.selectSub', 'اختر المكان الفرعي');
                    const v = el.value;
                    el.innerHTML = '<option value="">' + ph + '</option>' + (places || []).map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
                    if (v) el.value = v;
                }
            });
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ PTW.refreshSiteDropdowns:', e); }
    },

    /**
     * الحصول على قائمة الإدارات (الجهة الطالبة للتصريح) من نفس مصدر "المسؤول عن التنفيذ" في مديول الملاحظات اليومية
     * @returns {string[]} مصفوفة أسماء الإدارات
     */
    getDepartmentOptionsForPTW() {
        try {
            if (typeof DailyObservations !== 'undefined' && typeof DailyObservations.getDepartmentOptions === 'function') {
                const list = DailyObservations.getDepartmentOptions();
                if (Array.isArray(list) && list.length > 0) return list;
            }
            if (typeof AppUtils !== 'undefined' && typeof AppUtils.getInitialFormDepartments === 'function') {
                const list = AppUtils.getInitialFormDepartments();
                if (Array.isArray(list) && list.length > 0) return list;
            }
            const settings = AppState?.companySettings || {};
            if (Array.isArray(settings.formDepartments) && settings.formDepartments.length > 0) {
                return settings.formDepartments.map((item) => String(item || '').trim()).filter(Boolean);
            }
            if (Array.isArray(settings.departments)) {
                return settings.departments.map((item) => String(item || '').trim()).filter(Boolean);
            }
            if (typeof settings.departments === 'string') {
                return settings.departments.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
            }
            return [];
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ خطأ في الحصول على قائمة الإدارات:', error);
            return [];
        }
    },

    // الحصول على قائمة الأماكن الفرعية لموقع محدد
    getPlaceOptions(siteId) {
        try {
            if (!siteId) return [];

            const sites = this.getSiteOptions();
            const selectedSite = sites.find(s => s.id === siteId);
            if (!selectedSite) return [];

            // محاولة الحصول من Permissions.formSettingsState
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.sites) {
                const site = Permissions.formSettingsState.sites.find(s => s.id === siteId);
                if (site && Array.isArray(site.places)) {
                    return site.places.map(place => ({
                        id: place.id,
                        name: place.name
                    }));
                }
            }

            // محاولة الحصول من AppState.appData.observationSites
            if (Array.isArray(AppState.appData?.observationSites)) {
                const site = AppState.appData.observationSites.find(s => (s.id || s.siteId) === siteId);
                if (site) {
                    const placesSource = Array.isArray(site.places)
                        ? site.places
                        : Array.isArray(site.locations)
                            ? site.locations
                            : Array.isArray(site.children)
                                ? site.children
                                : Array.isArray(site.areas)
                                    ? site.areas
                                    : [];
                    return placesSource.map((place, idx) => ({
                        id: place.id || place.placeId || place.value || Utils.generateId('PLACE'),
                        name: place.name || place.placeName || place.title || place.label || place.locationName || `مكان ${idx + 1}`
                    }));
                }
            }

            // محاولة الحصول من DailyObservations
            if (typeof DailyObservations !== 'undefined' && Array.isArray(DailyObservations.DEFAULT_SITES)) {
                const site = DailyObservations.DEFAULT_SITES.find(s => (s.id || s.siteId) === siteId);
                if (site) {
                    const placesSource = Array.isArray(site.places)
                        ? site.places
                        : Array.isArray(site.locations)
                            ? site.locations
                            : Array.isArray(site.children)
                                ? site.children
                                : Array.isArray(site.areas)
                                    ? site.areas
                                    : [];
                    return placesSource.map((place, idx) => ({
                        id: place.id || place.placeId || place.value || Utils.generateId('PLACE'),
                        name: place.name || place.placeName || place.title || place.label || place.locationName || `مكان ${idx + 1}`
                    }));
                }
            }

            return [];
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة الأماكن:', error);
            return [];
        }
    },

    // ======= بيانات سجل حصر التصاريح =======
    registryData: [],
    currentTab: 'permits', // 'permits' أو 'registry'

    /**
     * تهيئة وتحميل بيانات السجل
     * @param {boolean} skipBackendLoad - تجاهل تحميل البيانات من Backend (مفيد عند التحميل الأولي)
     */
    initRegistry(skipBackendLoad = false) {
        try {
            // تحميل من AppState أولاً (الأحدث)
            if (AppState.appData && AppState.appData.ptwRegistry && Array.isArray(AppState.appData.ptwRegistry)) {
                this.registryData = this.normalizeRegistryCollection(AppState.appData.ptwRegistry);
                // Persist deduplicated version back to AppState and localStorage
                AppState.appData.ptwRegistry = [...this.registryData];
                try { localStorage.setItem('hse_ptw_registry', Utils.safeStringify(this.registryData)); } catch (_) {}
                Utils.safeLog(`✅ تم تحميل ${this.registryData.length} سجل من AppState`);
                // لا نقوم بالمزامنة عند التحميل من AppState - ننتظر تحميل Backend
                return;
            }
            // تحميل من localStorage كنسخة احتياطية
            const savedData = localStorage.getItem('hse_ptw_registry');
            if (savedData) {
                try {
                    this.registryData = this.normalizeRegistryCollection(JSON.parse(savedData));
                    if (!Array.isArray(this.registryData)) {
                        this.registryData = [];
                    }
                    // تحديث AppState بالبيانات المحملة
                    if (!AppState.appData) AppState.appData = {};
                    AppState.appData.ptwRegistry = [...this.registryData];
                    Utils.safeLog(`✅ تم تحميل ${this.registryData.length} سجل من localStorage`);
                    // لا نقوم بالمزامنة عند التحميل من localStorage - ننتظر تحميل Backend
                } catch (parseError) {
                    Utils.safeError('❌ خطأ في تحليل بيانات السجل من localStorage:', parseError);
                    this.registryData = [];
                }
            } else {
                this.registryData = [];
                // التأكد من وجود مصفوفة فارغة في AppState
                if (!AppState.appData) AppState.appData = {};
                AppState.appData.ptwRegistry = [];
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل بيانات السجل:', error);
            this.registryData = [];
            if (!AppState.appData) AppState.appData = {};
            AppState.appData.ptwRegistry = [];
        }
    },

    /**
     * حفظ بيانات السجل
     * @param {Object} options - خيارات الحفظ
     * @param {boolean} options.skipSync - تجاهل المزامنة مع Google Sheets (مفيد عند التحميل الأولي)
     */
    async saveRegistryData(options = {}) {
        try {
            const { skipSync = false } = options;
            this.registryData = this.normalizeRegistryCollection(this.registryData);
            
            if (!AppState.appData) AppState.appData = {};
            // التأكد من أن البيانات محفوظة في AppState قبل حفظ DataManager
            AppState.appData.ptwRegistry = Array.isArray(this.registryData) ? [...this.registryData] : [];
            localStorage.setItem('hse_ptw_registry', Utils.safeStringify(this.registryData));

            // تحديث عرض السجل إذا كان مرئياً
            this.refreshRegistryViewIfVisible();

            // المزامنة مع Google Sheets (فقط إذا لم يتم تخطي المزامنة)
            if (!skipSync && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                await GoogleIntegration.autoSave('PTWRegistry', this.registryData);
            }
            return true;
        } catch (error) {
            Utils.safeError('❌ خطأ في حفظ بيانات السجل:', error);
            return false;
        }
    },

    async syncManualPermitRecordsToBackend(entry, permitData, options = {}) {
        const { isNewRegistryEntry = false, isNewPermit = false } = options;

        if (!entry || !permitData || typeof GoogleIntegration === 'undefined') {
            return true;
        }

        const sendSheetRecord = async (sheetName, record, appendMode = false) => {
            const payload = {
                sheetName,
                data: (typeof GoogleIntegration.prepareSheetPayload === 'function')
                    ? GoogleIntegration.prepareSheetPayload(sheetName, record)
                    : record
            };

            const spreadsheetId = AppState.googleConfig?.sheets?.spreadsheetId?.trim();
            if (spreadsheetId) {
                payload.spreadsheetId = spreadsheetId;
            }

            return GoogleIntegration.sendToAppsScript(
                appendMode ? 'appendToSheet' : 'saveToSheet',
                payload
            );
        };

        try {
            const registryResult = await sendSheetRecord('PTWRegistry', entry, isNewRegistryEntry);
            if (!registryResult || registryResult.success !== true) {
                throw new Error(registryResult?.message || 'فشل حفظ سجل التصريح اليدوي في الخلفية');
            }

            const resolvedReg = registryResult.resolvedPTWRegistry;
            const paperKey = String(entry.paperPermitNumber || permitData.paperPermitNumber || '').trim();
            const oldPermitId = String(entry.permitId || permitData.id || '').trim();

            const applyResolvedPermitIds = (newPermitId, registryRow) => {
                const pid = String(newPermitId || '').trim();
                if (!pid) return;
                permitData.id = pid;
                if (entry) {
                    entry.permitId = pid;
                    if (registryRow && registryRow.id) entry.id = registryRow.id;
                }
                if (typeof AppState !== 'undefined' && AppState.appData && Array.isArray(AppState.appData.ptw)) {
                    const pi = AppState.appData.ptw.findIndex(p => String(p.id || '').trim() === oldPermitId);
                    if (pi !== -1) {
                        AppState.appData.ptw[pi] = { ...AppState.appData.ptw[pi], id: pid };
                    }
                }
            };

            if (resolvedReg && resolvedReg.permitId) {
                applyResolvedPermitIds(resolvedReg.permitId, resolvedReg);
                if (paperKey && Array.isArray(this.registryData)) {
                    const ri = this.registryData.findIndex(r =>
                        String(r.paperPermitNumber || '').trim() === paperKey &&
                        (r.isManualEntry === true || r.isManualEntry === 'true')
                    );
                    if (ri !== -1) {
                        this.registryData[ri] = { ...this.registryData[ri], ...resolvedReg };
                    }
                }
            } else {
                try {
                    if (typeof this.loadRegistryFromBackend === 'function') {
                        await this.loadRegistryFromBackend();
                    }
                } catch (reloadErr) {
                    Utils.safeWarn('⚠️ تعذر إعادة تحميل PTWRegistry بعد الحفظ:', reloadErr);
                }

                if (paperKey && Array.isArray(this.registryData)) {
                    const refreshed = this.registryData.find(r =>
                        String(r.paperPermitNumber || '').trim() === paperKey &&
                        (r.isManualEntry === true || r.isManualEntry === 'true')
                    );
                    if (refreshed && refreshed.permitId) {
                        applyResolvedPermitIds(refreshed.permitId, refreshed);
                    }
                }
            }

            const permitResult = await sendSheetRecord('PTW', permitData, isNewPermit);
            if (!permitResult || permitResult.success !== true) {
                throw new Error(permitResult?.message || 'فشل حفظ التصريح اليدوي في الخلفية');
            }

            if (typeof GoogleIntegration.clearCache === 'function') {
                GoogleIntegration.clearCache('PTWRegistry');
                GoogleIntegration.clearCache('PTW');
            }

            // حفظ محلي بعد توحيد المعرفات مع الخلفية
            try {
                if (typeof this.saveRegistryData === 'function') {
                    await this.saveRegistryData({ skipSync: true });
                }
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    await Promise.resolve(window.DataManager.save());
                }
            } catch (persistErr) {
                Utils.safeWarn('⚠️ تعذر حفظ البيانات المحلية بعد المزامنة:', persistErr);
            }

            return true;
        } catch (error) {
            if (typeof DataManager !== 'undefined' && DataManager.addToPendingSync) {
                DataManager.addToPendingSync('PTWRegistry', entry);
                DataManager.addToPendingSync('PTW', permitData);
            }
            throw error;
        }
    },

    /**
     * تحديث عرض السجل إذا كان التبويب مرئياً
     */
    refreshRegistryViewIfVisible() {
        try {
            const registryContent = document.getElementById('ptw-registry-content');
            if (registryContent && registryContent.style.display !== 'none') {
                // السجل مرئي - تحديثه
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
                Utils.safeLog('✅ تم تحديث عرض سجل حصر التصاريح');
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحديث عرض السجل:', error);
        }
    },

    /**
     * الحصول على نص نوع التصريح للعرض (يدعم الأنواع المتعددة)
     */
    parseDateTimeValue(value) {
        if (value === null || value === undefined || value === '' || value === 'غير محدد' || String(value).trim() === 'Not specified') return null;
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : new Date(value.getTime());
        }
        if (typeof value === 'number' && isFinite(value)) {
            const numericDate = new Date(value);
            return isNaN(numericDate.getTime()) ? null : numericDate;
        }

        const stringValue = String(value).trim();
        if (!stringValue) return null;

        const dateOnlyMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            const localDate = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
            return isNaN(localDate.getTime()) ? null : localDate;
        }

        const localDateTimeMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (localDateTimeMatch) {
            const [, year, month, day, hours, minutes, seconds] = localDateTimeMatch;
            const localDateTime = new Date(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hours),
                Number(minutes),
                Number(seconds || 0),
                0
            );
            return isNaN(localDateTime.getTime()) ? null : localDateTime;
        }

        const parsedDate = new Date(stringValue);
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
    },

    formatDurationFromMilliseconds(diffMs) {
        return this.formatDurationI18n(diffMs);
    },

    dateInputToISO(dateInputValue) {
        if (!dateInputValue) return null;
        const dateOnlyMatch = String(dateInputValue).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dateOnlyMatch) return null;
        const [, year, month, day] = dateOnlyMatch;
        const localDate = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
        return isNaN(localDate.getTime()) ? null : localDate.toISOString();
    },

    calculateTotalTime(startDate, endDate) {
        if (!startDate || !endDate) return this._t('module.ptw.common.notSpecified', 'غير محدد');
        try {
            const start = this.parseDateTimeValue(startDate);
            const end = this.parseDateTimeValue(endDate);
            if (!start || !end) return this._t('module.ptw.common.notSpecified', 'غير محدد');
            return this.formatDurationFromMilliseconds(end - start);
        } catch (error) {
            return this._t('module.ptw.duration.error', 'خطأ');
        }
    },

    isUsableDurationText(value) {
        const text = String(value || '').trim();
        if (!text) return false;
        if (['غير محدد', 'غير صحيح', 'خطأ', 'Not specified', 'Invalid', 'Error'].includes(text)) return false;
        if (text === this._t('module.ptw.common.notSpecified', 'غير محدد')) return false;
        if (text === this._t('module.ptw.duration.invalid', 'غير صحيح')) return false;
        if (text === this._t('module.ptw.duration.error', 'خطأ')) return false;
        return true;
    },

    normalizeRegistryEntry(entry) {
        if (!entry || typeof entry !== 'object') return entry;

        const normalized = { ...entry };
        // Backward compatibility: old records stored "location - sublocation" in location.
        if ((!normalized.sublocation || String(normalized.sublocation).trim() === '') && typeof normalized.location === 'string') {
            const locationText = String(normalized.location).trim();
            const separatorIndex = locationText.indexOf(' - ');
            if (separatorIndex > 0) {
                const baseLocation = locationText.slice(0, separatorIndex).trim();
                const parsedSublocation = locationText.slice(separatorIndex + 3).trim();
                if (baseLocation && parsedSublocation) {
                    normalized.location = baseLocation;
                    normalized.sublocation = parsedSublocation;
                }
            }
        }

        const startSource = normalized.timeFrom || normalized.openDate || '';
        const scheduledTotal = this.calculateTotalTime(startSource, normalized.timeTo);
        const closureTotal = this.calculateTotalTime(startSource, normalized.closureDate);
        const storedTotal = String(normalized.totalTime || '').trim();

        if (!normalized.openDate && normalized.timeFrom) {
            normalized.openDate = normalized.timeFrom;
        }
        if (!normalized.timeFrom && normalized.openDate) {
            normalized.timeFrom = normalized.openDate;
        }

        if (this.isUsableDurationText(scheduledTotal)) {
            normalized.totalTime = scheduledTotal;
        } else if (this.isUsableDurationText(closureTotal)) {
            normalized.totalTime = closureTotal;
        } else {
            normalized.totalTime = this.isUsableDurationText(storedTotal) ? storedTotal : 'غير محدد';
        }

        if (normalized.isManualEntry === true) {
            normalized.approvals = [];
            normalized.skipApprovalFlow = true;
            if (!String(normalized.approvalCircuitOwnerId || '').trim()) {
                normalized.approvalCircuitOwnerId = '__manual__';
            }
            if (!String(normalized.approvalCircuitName || '').trim()) {
                normalized.approvalCircuitName = 'Manual Entry';
            }
            const st = String(normalized.status || '').trim();
            // تصريح يدوي مكتمل افتراضياً (دائرة الاعتمادات مكتملة من النموذج الورقي)
            normalized.status = st || 'اكتمل العمل بشكل آمن';
        }

        if (normalized.sequentialNumber != null && normalized.sequentialNumber !== '') {
            const sn = parseInt(String(normalized.sequentialNumber).replace(/^0+(?=\d)/, ''), 10);
            if (!isNaN(sn) && sn > 0) normalized.sequentialNumber = sn;
        }

        return normalized;
    },

    normalizeRegistryCollection(registryData) {
        if (!Array.isArray(registryData)) return [];
        const normalized = registryData.map((entry) => this.normalizeRegistryEntry(entry)).filter(Boolean);

        const preferEntry = (existing, incoming) => {
            const existingIsTmp = String(existing.id || '').includes('_TMP_');
            const newIsTmp = String(incoming.id || '').includes('_TMP_');
            if (!newIsTmp && existingIsTmp) return incoming;
            return existing;
        };

        // 1) لكل صف له id في PTWRegistry: صف واحد لكل id (يطابق عدد صفوف الورقة عادةً)
        // 2) بدون id (قديم): الإبقاء على دمج التكرار حسب sequentialNumber أو permitId
        const byRegistryId = new Map();
        const seqMap = new Map();
        const noSeqEntries = [];

        for (const entry of normalized) {
            const rid = String(entry.id || '').trim();
            if (rid) {
                if (!byRegistryId.has(rid)) {
                    byRegistryId.set(rid, entry);
                } else {
                    byRegistryId.set(rid, preferEntry(byRegistryId.get(rid), entry));
                }
                continue;
            }

            const seq = (entry.sequentialNumber != null && entry.sequentialNumber !== '')
                ? String(entry.sequentialNumber)
                : null;

            if (seq) {
                if (!seqMap.has(seq)) {
                    seqMap.set(seq, entry);
                } else {
                    const existing = seqMap.get(seq);
                    const existingIsTmp = String(existing.id || '').includes('_TMP_');
                    const newIsTmp = String(entry.id || '').includes('_TMP_');
                    if (!newIsTmp && existingIsTmp) {
                        seqMap.set(seq, entry);
                    }
                }
            } else {
                const idKey = entry.permitId;
                if (!idKey || !noSeqEntries.some(e => e.permitId === idKey)) {
                    noSeqEntries.push(entry);
                }
            }
        }

        return [...byRegistryId.values(), ...seqMap.values(), ...noSeqEntries];
    },

    normalizePermitStatus(status) {
        const t = String(status || '').trim();
        if (!t) return 'مغلق';
        if (t === 'closed' || t === 'Closed' || t === 'CLOSED' || t === 'مغلقة' || t === 'اكتمل') return 'مغلق';
        return t;
    },

    isPermitClosedStatus(status) {
        const t = this.normalizePermitStatus(status);
        return t === 'مغلق' || t === 'مرفوض' || t === 'اكتمل العمل بشكل آمن' || t === 'إغلاق جبري' || t === 'لم يكتمل العمل';
    },

    isPermitOpenStatus(status) {
        return !this.isPermitClosedStatus(status);
    },

    mergePermitsPreferRegistry(permitsFromList, permitsFromRegistry) {
        const allPermitsMap = new Map();
        (permitsFromList || []).forEach((permit) => {
            if (permit && permit.id) {
                allPermitsMap.set(permit.id, {
                    ...permit,
                    status: this.normalizePermitStatus(permit.status)
                });
            }
        });
        // Registry should override list status/details for same permit ID.
        (permitsFromRegistry || []).forEach((permit) => {
            if (permit && permit.id) {
                const existing = allPermitsMap.get(permit.id) || {};
                allPermitsMap.set(permit.id, {
                    ...existing,
                    ...permit,
                    status: this.normalizePermitStatus(permit.status),
                    isFromRegistry: true,
                    isManualEntry: permit.isManualEntry ?? existing.isManualEntry,
                    skipApprovalFlow: permit.skipApprovalFlow ?? existing.skipApprovalFlow,
                    approvalCircuitOwnerId: permit.approvalCircuitOwnerId || existing.approvalCircuitOwnerId,
                    approvalCircuitName: permit.approvalCircuitName || existing.approvalCircuitName,
                    sequentialNumber: permit.sequentialNumber ?? existing.sequentialNumber,
                    paperPermitNumber: permit.paperPermitNumber || existing.paperPermitNumber
                });
            }
        });
        return Array.from(allPermitsMap.values());
    },

    getRegistryPermitsForMetrics() {
        // قبل تهيئة الموديول يبقى registryData فارغاً بينما لوحة التحكم قد تملأ AppState.ptwRegistry (جلب مجمع)
        const localReg = Array.isArray(this.registryData) ? this.registryData : [];
        const stateReg = Array.isArray(AppState?.appData?.ptwRegistry) ? AppState.appData.ptwRegistry : [];
        const raw = localReg.length > 0 ? localReg : stateReg;
        return raw.map((registryEntry) => ({
            id: registryEntry.permitId || registryEntry.id,
            workType: Array.isArray(registryEntry.permitType)
                ? (registryEntry.permitTypeDisplay || registryEntry.permitType.join('، '))
                : (registryEntry.permitType || registryEntry.permitTypeDisplay),
            status: this.normalizePermitStatus(registryEntry.status),
            isFromRegistry: true
        }));
    },

    getPermitMetricsDataset() {
        const permitsFromList = AppState.appData.ptw || [];
        const permitsFromRegistry = this.getRegistryPermitsForMetrics();
        const merged = this.mergePermitsPreferRegistry(permitsFromList, permitsFromRegistry);
        // Source of truth for KPI counters is DB registry when available.
        const source = permitsFromRegistry.length > 0 ? permitsFromRegistry : merged;
        return { source, merged, permitsFromList, permitsFromRegistry };
    },

    getPermitTypeDisplay(entry) {
        if (!entry) return 'غير محدد';

        // إذا كان هناك permitTypeDisplay جاهز
        if (entry.permitTypeDisplay) {
            return entry.permitTypeDisplay;
        }

        // إذا كان permitType مصفوفة
        if (Array.isArray(entry.permitType)) {
            return entry.permitType.join('، ');
        }

        // إذا كان نص عادي
        if (typeof entry.permitType === 'string') {
            return entry.permitType;
        }

        return 'غير محدد';
    },

    /**
     * توليد رقم تسلسلي للسجل
     */
    generateRegistrySequentialNumber() {
        if (!this.registryData.length) return 1;
        const parseReg = (id) => {
            const m = String(id || '').match(/^REG_(\d+)$/i);
            return m ? parseInt(m[1], 10) : 0;
        };
        const parsePtw = (pid) => {
            const m = String(pid || '').match(/^PTW_(\d+)$/i);
            return m ? parseInt(m[1], 10) : 0;
        };
        const maxSeq = this.registryData.reduce((max, r) => {
            const a = parseInt(r.sequentialNumber) || 0;
            const b = parseReg(r.id);
            const c = parsePtw(r.permitId);
            const rowMax = Math.max(a, b, c);
            return rowMax > max ? rowMax : max;
        }, 0);
        return maxSeq + 1;
    },

    /**
     * إنشاء سجل جديد من تصريح
     */
    createRegistryEntry(permit) {
        if (!permit || !permit.id) {
            Utils.safeWarn('⚠️ لا يمكن إنشاء سجل: التصريح غير صالح', permit);
            return null;
        }

        try {
            const sequentialNumber = this.generateRegistrySequentialNumber();

            // الحصول على اسم الموقع - محاولة من siteName أولاً، ثم البحث في getSiteOptions، ثم استخدام location مباشرة
            let locationName = permit.siteName || permit.location || 'غير محدد';
            let locationId = permit.siteId || permit.locationId || null;
            
            if (permit.siteId && !permit.siteName) {
                const siteOption = this.getSiteOptions().find(s => s.id === permit.siteId || s.name === permit.location);
                if (siteOption) {
                    locationName = siteOption.name;
                    locationId = siteOption.id || locationId;
                }
            } else if (permit.location && !permit.siteName) {
                // محاولة البحث عن الموقع بالاسم أو ID
                const siteOption = this.getSiteOptions().find(s => s.id === permit.location || s.name === permit.location);
                if (siteOption) {
                    locationName = siteOption.name;
                    locationId = siteOption.id || locationId;
                } else {
                    locationName = permit.location; // استخدام القيمة مباشرة إذا لم يتم العثور عليها
                }
            }

            // الحصول على نوع التصريح للعرض - تحويل إلى string دائماً
            let permitType = permit.workType || 'غير محدد';
            let permitTypeDisplay = '';
            if (Array.isArray(permitType)) {
                permitTypeDisplay = permitType.join('، ');
                permitType = permitTypeDisplay; // تحويل array إلى string
            } else if (typeof permitType === 'string') {
                permitTypeDisplay = permitType;
            } else {
                permitTypeDisplay = 'غير محدد';
                permitType = 'غير محدد';
            }

            // الحصول على الموقع الفرعي
            const sublocationName = permit.sublocationName || permit.sublocation || null;
            const sublocationId = permit.sublocationId || null;

            // استخراج supervisor1 و supervisor2 كـ strings فقط (وليس objects)
            let supervisor1 = 'غير محدد';
            if (permit.approvals && permit.approvals[0]) {
                const approver1 = permit.approvals[0].approver;
                if (typeof approver1 === 'string') {
                    supervisor1 = approver1;
                } else if (typeof approver1 === 'object' && approver1) {
                    supervisor1 = approver1.name || approver1.email || approver1.id || permit.approvals[0].role || 'غير محدد';
                } else {
                    supervisor1 = permit.approvals[0].role || 'غير محدد';
                }
            }

            let supervisor2 = 'غير محدد';
            if (permit.approvals && permit.approvals[1]) {
                const approver2 = permit.approvals[1].approver;
                if (typeof approver2 === 'string') {
                    supervisor2 = approver2;
                } else if (typeof approver2 === 'object' && approver2) {
                    supervisor2 = approver2.name || approver2.email || approver2.id || permit.approvals[1].role || 'غير محدد';
                } else {
                    supervisor2 = permit.approvals[1].role || 'غير محدد';
                }
            }

            const entry = {
                id: this.generateTemporaryId('REG'),
                sequentialNumber: sequentialNumber,
                permitId: permit.id,
                // مواءمة تاريخ السجل مع تاريخ/وقت بدء العمل (نفس منطق عرض التصريح وليس تاريخ الإنشاء فقط)
                openDate: permit.startDate || permit.createdAt || new Date().toISOString(),
                permitType: permitType, // string دائماً
                permitTypeDisplay: permitTypeDisplay,
                requestingParty: String(permit.requestingParty || 'غير محدد').trim(),
                locationId: locationId ? String(locationId).trim() : null,
                location: String(locationName).trim(),
                sublocationId: sublocationId ? String(sublocationId).trim() : null,
                sublocation: sublocationName ? String(sublocationName).trim() : null,
                timeFrom: permit.startDate || permit.createdAt || new Date().toISOString(),
                timeTo: permit.endDate || 'غير محدد',
                totalTime: this.calculateTotalTime(permit.startDate, permit.endDate) || '',
                authorizedParty: String(permit.authorizedParty || 'غير محدد').trim(),
                workDescription: String(permit.workDescription || 'غير محدد').trim(),
                supervisor1: String(supervisor1).trim(),
                supervisor2: String(supervisor2).trim(),
                status: (permit.status === 'مغلق' || permit.status === 'مرفوض') ? 'مغلق' : (permit.status === 'اكتمل العمل بشكل آمن' || permit.status === 'إغلاق جبري' ? permit.status : 'مفتوح'),
                closureDate: null,
                closureReason: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            Utils.safeLog('✅ تم إنشاء سجل جديد:', entry.id, entry.sequentialNumber);
            return entry;
        } catch (error) {
            Utils.safeError('❌ خطأ في إنشاء سجل التصريح:', error);
            return null;
        }
    },

    /**
     * إضافة تصريح للسجل (يُستدعى تلقائياً)
     */
    async addToRegistry(permit) {
        try {
            if (!permit || !permit.id) {
                Utils.safeWarn('⚠️ لا يمكن إضافة تصريح للسجل: بيانات التصريح غير صالحة');
                return;
            }

            // التأكد من تهيئة السجل
            if (!Array.isArray(this.registryData)) {
                this.initRegistry();
            }

            const permitId = permit.id || permit.permitId;
            const existingEntry = this.registryData.find(r =>
                r.permitId === permitId ||
                r.permitId === permit.id ||
                r.permitId === permit.permitId ||
                r.id === permit.registryId ||
                // Match when backend resolved TMP → sequential ID: compare by paperPermitNumber
                (permit.paperPermitNumber && r.paperPermitNumber &&
                    String(r.paperPermitNumber).trim() === String(permit.paperPermitNumber).trim())
            );
            if (existingEntry) {
                Utils.safeLog('🔄 السجل موجود بالفعل - سيتم تحديثه');
                return await this.updateRegistryEntry(permit);
            }

            const entry = this.createRegistryEntry(permit);
            if (entry) {
                this.registryData.push(entry);
                await this.saveRegistryData();
                Utils.safeLog(`✅ تم تسجيل التصريح #${entry.sequentialNumber} في السجل (ID: ${entry.id})`);
            } else {
                Utils.safeError('❌ فشل إنشاء سجل التصريح');
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في إضافة التصريح للسجل:', error);
        }
    },

    /**
     * تحديث سجل تصريح
     */
    async updateRegistryEntry(permit) {
        const entryIndex = this.registryData.findIndex(r => r.permitId === permit.id);
        if (entryIndex === -1) {
            return this.addToRegistry(permit);
        }

        const entry = this.registryData[entryIndex];
        
        // الحصول على اسم الموقع
        let locationName = permit.siteName || permit.location || entry.location;
        let locationId = permit.siteId || permit.locationId || entry.locationId;
        
        if (permit.siteId || permit.locationId) {
            const siteOption = this.getSiteOptions().find(s => s.id === (permit.siteId || permit.locationId) || s.name === permit.location);
            if (siteOption) {
                locationName = siteOption.name;
                locationId = siteOption.id || locationId;
            }
        } else if (permit.location && !permit.siteName) {
            const siteOption = this.getSiteOptions().find(s => s.id === permit.location || s.name === permit.location);
            if (siteOption) {
                locationName = siteOption.name;
                locationId = siteOption.id || locationId;
            }
        }

        // تحديث نوع التصريح ونص العرض - تحويل إلى string دائماً
        let permitType = permit.workType || entry.permitType || 'غير محدد';
        let permitTypeDisplay = '';
        if (Array.isArray(permitType)) {
            permitTypeDisplay = permitType.join('، ');
            permitType = permitTypeDisplay; // تحويل array إلى string
        } else if (typeof permitType === 'string') {
            permitTypeDisplay = permitType;
        } else {
            permitTypeDisplay = entry.permitTypeDisplay || permitType || 'غير محدد';
            permitType = permitType || entry.permitType || 'غير محدد';
        }

        // استخراج supervisor1 و supervisor2 كـ strings فقط (وليس objects)
        let supervisor1 = entry.supervisor1 || 'غير محدد';
        if (permit.approvals && permit.approvals[0]) {
            const approver1 = permit.approvals[0].approver;
            if (typeof approver1 === 'string') {
                supervisor1 = approver1;
            } else if (typeof approver1 === 'object' && approver1) {
                supervisor1 = approver1.name || approver1.email || approver1.id || permit.approvals[0].role || entry.supervisor1 || 'غير محدد';
            } else {
                supervisor1 = permit.approvals[0].role || entry.supervisor1 || 'غير محدد';
            }
        }

        let supervisor2 = entry.supervisor2 || 'غير محدد';
        if (permit.approvals && permit.approvals[1]) {
            const approver2 = permit.approvals[1].approver;
            if (typeof approver2 === 'string') {
                supervisor2 = approver2;
            } else if (typeof approver2 === 'object' && approver2) {
                supervisor2 = approver2.name || approver2.email || approver2.id || permit.approvals[1].role || entry.supervisor2 || 'غير محدد';
            } else {
                supervisor2 = permit.approvals[1].role || entry.supervisor2 || 'غير محدد';
            }
        }

        // تحديث الحقول
        entry.permitType = String(permitType).trim(); // string دائماً
        entry.permitTypeDisplay = String(permitTypeDisplay || entry.permitTypeDisplay || permitType).trim();
        entry.requestingParty = String(permit.requestingParty || entry.requestingParty || 'غير محدد').trim();
        entry.locationId = locationId ? String(locationId).trim() : (entry.locationId ? String(entry.locationId).trim() : null);
        entry.location = String(locationName || entry.location || 'غير محدد').trim();
        entry.sublocationId = permit.sublocationId ? String(permit.sublocationId).trim() : (entry.sublocationId ? String(entry.sublocationId).trim() : null);
        entry.sublocation = permit.sublocationName || permit.sublocation ? String(permit.sublocationName || permit.sublocation).trim() : (entry.sublocation ? String(entry.sublocation).trim() : null);
        entry.timeFrom = permit.startDate || entry.timeFrom;
        entry.timeTo = permit.endDate || entry.timeTo;
        if (permit.startDate) {
            entry.openDate = permit.startDate;
        }
        entry.totalTime = String(this.calculateTotalTime(permit.startDate, permit.endDate) || entry.totalTime || '').trim();
        entry.authorizedParty = String(permit.authorizedParty || entry.authorizedParty || 'غير محدد').trim();
        entry.workDescription = String(permit.workDescription || entry.workDescription || 'غير محدد').trim();
        entry.supervisor1 = String(supervisor1).trim();
        entry.supervisor2 = String(supervisor2).trim();
        const isClosedStatus = (s) => s === 'مغلق' || s === 'مرفوض' || s === 'اكتمل العمل بشكل آمن' || s === 'إغلاق جبري';
        entry.status = (permit.status === 'مغلق' || permit.status === 'مرفوض') ? 'مغلق' : (permit.status === 'اكتمل العمل بشكل آمن' || permit.status === 'إغلاق جبري' ? permit.status : 'مفتوح');
        entry.updatedAt = new Date().toISOString();

        // تحديث بيانات الإغلاق إذا كان مغلقاً (مغلق أو اكتمل العمل بشكل آمن أو إغلاق جبري)
        if (isClosedStatus(permit.status) || permit.closureTime) {
            entry.closureDate = permit.closureTime || new Date().toISOString();
            entry.closureReason = permit.closureReason || 'تم الإغلاق';
            entry.totalTime = this.calculateTotalTime(entry.timeFrom, entry.closureDate);
        }

        this.registryData[entryIndex] = entry;
        await this.saveRegistryData();
    },

    /**
     * حذف سجل تصريح
     */
    async removeFromRegistry(permitId) {
        const entryIndex = this.registryData.findIndex(r => r.permitId === permitId);
        if (entryIndex !== -1) {
            this.registryData.splice(entryIndex, 1);
            await this.saveRegistryData();
        }
    },

    /**
     * تحميل بيانات PTW من Backend
     */
    async loadPTWFromBackend() {
        try {
            if (!GoogleIntegration || !AppState.googleConfig?.appsScript?.enabled) {
                if (AppState.debugMode) {
                    Utils.safeLog('⚠️ Backend غير متاح - استخدام البيانات المحلية');
                }
                return;
            }

            if (AppState.debugMode) {
                Utils.safeLog('🔄 تحميل تصاريح العمل من Backend...');
            }

            const result = await GoogleIntegration.sendRequest({
                action: 'getAllPTWs',
                data: {}
            });

            if (result && result.success && Array.isArray(result.data)) {
                // تحديث البيانات المحلية بما في Backend
                AppState.appData.ptw = result.data;

                // حفظ محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                if (AppState.debugMode) {
                    Utils.safeLog(`✅ تم تحميل ${result.data.length} تصريح من Backend`);
                }
                return true;
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ فشل تحميل البيانات من Backend:', result?.message);
                }
                return false;
            }
        } catch (error) {
            if (AppState.debugMode) {
                Utils.safeError('❌ خطأ في تحميل البيانات من Backend:', error);
            }
            return false;
        }
    },

    /**
     * تحميل بيانات PTWRegistry من Backend
     */
    async loadRegistryFromBackend() {
        try {
            if (!GoogleIntegration || !AppState.googleConfig?.appsScript?.enabled) {
                return false;
            }

            // محاولة تحميل من Backend إذا كان متاحاً
            try {
                const result = await GoogleIntegration.sendRequest({
                    action: 'readFromSheet',
                    data: {
                        sheetName: 'PTWRegistry',
                        spreadsheetId: AppState.googleConfig.sheets.spreadsheetId
                    }
                });

                if (result && result.success && Array.isArray(result.data)) {
                    // إذا كانت البيانات فارغة في Backend، تنظيف البيانات المحلية
                    if (result.data.length === 0) {
                        this.registryData = [];
                        if (!AppState.appData) AppState.appData = {};
                        AppState.appData.ptwRegistry = [];
                        localStorage.setItem('hse_ptw_registry', Utils.safeStringify([]));
                        if (AppState.debugMode) {
                            Utils.safeLog('✅ تم تنظيف البيانات المحلية - الجدول فارغ في Backend');
                        }
                        return true;
                    }
                    
                    // إذا كانت هناك بيانات في Backend، استخدامها
                    this.registryData = this.normalizeRegistryCollection(result.data);
                    if (!AppState.appData) AppState.appData = {};
                    AppState.appData.ptwRegistry = [...this.registryData];
                    localStorage.setItem('hse_ptw_registry', Utils.safeStringify(this.registryData));
                    if (AppState.debugMode) {
                        Utils.safeLog(`✅ تم تحميل ${this.registryData.length} سجل من Backend`);
                    }
                    return true;
                }
            } catch (error) {
                // إذا فشل، نستخدم البيانات المحلية
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ فشل تحميل السجل من Backend، استخدام البيانات المحلية:', error);
                }
            }
            return false;
        } catch (error) {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ خطأ في تحميل السجل من Backend:', error);
            }
            return false;
        }
    },

    /**
     * مزامنة السجل مع التصاريح الموجودة
     */
    async syncRegistryWithPermits() {
        const permits = AppState.appData.ptw || [];
        for (const permit of permits) {
            const existingEntry = this.registryData.find(r => r.permitId === permit.id);
            if (!existingEntry) {
                await this.addToRegistry(permit);
            } else {
                await this.updateRegistryEntry(permit);
            }
        }
    },

    async load() {
        // منع إعادة تحميل متداخلة (مثلاً بسبب language-changed أو إعادة دخول القسم بسرعة)
        if (this._isLoading) {
            this._reloadRequested = true;
            return;
        }

        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                if (this._isLoading) {
                    this._reloadRequested = true;
                    return;
                }
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }
        this._isLoading = true;
        // التحقق من وجود التبعيات المطلوبة
        if (typeof Utils === 'undefined') {
            console.error('Utils غير متوفر!');
            this._isLoading = false;
            return;
        }
        if (typeof AppState === 'undefined') {
            Utils.safeError('AppState غير متوفر!');
            this._isLoading = false;
            return;
        }
        if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
            try { Permissions.ensureFormSettingsState().catch(() => {}); } catch (e) { /* ignore */ }
        }

        const section = document.getElementById('ptw-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError(' قسم ptw-section غير موجود!');
            } else {
                console.error(' قسم ptw-section غير موجود!');
            }
            this._isLoading = false;
            return;
        }
        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('✅ مديول PTW يكتب في قسم: ptw-section');
        }
        const t = (key, fallback) => {
            if (window.AppI18n && typeof window.AppI18n.t === 'function') return window.AppI18n.t(key, fallback);
            if (window.I18n && typeof window.I18n.t === 'function') return window.I18n.t(key, fallback);
            return fallback;
        };

        try {
            // تحميل إحداثيات المواقع من MapCoordinatesManager (إذا كان متاحاً)
            if (typeof MapCoordinatesManager !== 'undefined' && MapCoordinatesManager.syncFromGoogleSheets) {
                MapCoordinatesManager.syncFromGoogleSheets().then(() => {
                    Utils.safeLog('✅ تم مزامنة إحداثيات المواقع من Google Sheets');
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر مزامنة إحداثيات المواقع:', error);
                });
            }

            // تحميل البيانات من Backend بشكل غير متزامن
            const loadDataPromises = [];

            // تحميل تصاريح العمل من Backend
            loadDataPromises.push(
                this.loadPTWFromBackend().catch(error => {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل تصاريح العمل من Backend:', error);
                    }
                })
            );

            // تهيئة بيانات السجل (بدون مزامنة - ننتظر تحميل Backend)
            this.initRegistry(true);

            // تحميل سجل التصاريح من Backend
            loadDataPromises.push(
                this.loadRegistryFromBackend().catch(error => {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحميل السجل من Backend:', error);
                    }
                }).then((loadedFromBackend) => {
                    // بعد تحميل السجل من Backend، قم بمزامنة مع التصاريح
                    // فقط إذا لم يتم تحميل البيانات من Backend (لأن Backend هو المصدر الأساسي)
                    if (!loadedFromBackend) {
                        return this.syncRegistryWithPermits().catch(error => {
                            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                                Utils.safeWarn('⚠️ تعذر مزامنة السجل مع التصاريح:', error);
                            }
                        });
                    }
                })
            );

            // تحميل البيانات فوراً بدون تأخير - تحسين المزامنة
            // استخدام requestAnimationFrame لتسريع البدء
            requestAnimationFrame(() => {
                Promise.all(loadDataPromises).then(() => {
                    // تحديث العرض بعد تحميل البيانات
                    if (this.currentTab === 'permits') {
                        this.loadPTWList(true);
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠️ تعذر تحميل بعض بيانات PTW:', error);
                    // تحديث العرض حتى في حالة الخطأ
                    if (this.currentTab === 'permits') {
                        this.loadPTWList(true);
                    }
                });
            });

            section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-file-alt ml-3" aria-hidden="true"></i>
                            ${t('module.ptw.title', 'إدارة تصاريح العمل')}
                        </h1>
                        <p class="section-subtitle">${t('module.ptw.subtitle', 'إصدار ومتابعة تصاريح العمل مع دائرة الاعتمادات')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="add-ptw-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            ${t('module.ptw.btn.newPermit', 'إصدار تصريح جديد')}
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- تبويبات التصاريح والسجل والموافقات -->
            <div class="ptw-tabs mt-4 mb-4 bg-white rounded-lg shadow-sm p-1 flex overflow-x-auto" style="flex-wrap: nowrap; overflow-y: visible; min-width: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
                <button id="ptw-tab-permits" class="ptw-tab-btn px-6 py-3 font-semibold text-sm rounded-md transition-all duration-200 text-blue-600 bg-blue-50 shadow-sm" style="flex-shrink: 0 !important; min-width: fit-content !important; white-space: nowrap !important; width: auto !important; max-width: none !important;" onclick="PTW.switchTab('permits')">
                    <i class="fas fa-list ml-2"></i>
                    ${t('module.ptw.tab.permits', 'قائمة التصاريح')}
                </button>
                <button id="ptw-tab-registry" class="ptw-tab-btn px-6 py-3 font-semibold text-sm rounded-md transition-all duration-200 text-gray-600 hover:bg-gray-50" style="flex-shrink: 0 !important; min-width: fit-content !important; white-space: nowrap !important; width: auto !important; max-width: none !important;" onclick="PTW.switchTab('registry')">
                    <i class="fas fa-clipboard-list ml-2"></i>
                    ${t('module.ptw.tab.registry', 'سجل حصر التصاريح')}
                </button>
                <button id="ptw-tab-map" class="ptw-tab-btn px-6 py-3 font-semibold text-sm rounded-md transition-all duration-200 text-gray-600 hover:bg-gray-50" style="flex-shrink: 0 !important; min-width: fit-content !important; white-space: nowrap !important; width: auto !important; max-width: none !important;" onclick="PTW.switchTab('map')">
                    <i class="fas fa-map-marked-alt ml-2"></i>
                    ${t('module.ptw.tab.map', 'خريطة مواقع التصاريح')}
                </button>
                <button id="ptw-tab-analysis" class="ptw-tab-btn px-6 py-3 font-semibold text-sm rounded-md transition-all duration-200 text-gray-600 hover:bg-gray-50" style="flex-shrink: 0 !important; min-width: fit-content !important; white-space: nowrap !important; width: auto !important; max-width: none !important;" onclick="PTW.switchTab('analysis')">
                    <i class="fas fa-chart-line ml-2"></i>
                    ${t('module.ptw.tab.analysis', 'تحليل البيانات')}
                </button>
                <button id="ptw-tab-approvals" class="ptw-tab-btn px-6 py-3 font-semibold text-sm rounded-md transition-all duration-200 text-gray-600 hover:bg-gray-50" style="flex-shrink: 0 !important; min-width: fit-content !important; white-space: nowrap !important; width: auto !important; max-width: none !important;" onclick="PTW.switchTab('approvals')">
                    <i class="fas fa-check-double ml-2"></i>
                    ${t('module.ptw.tab.approvals', 'الموافقات')}
                </button>
                <button id="ptw-refresh-header-btn" type="button" class="px-4 py-3 font-semibold text-sm rounded-md transition-all duration-200 border-2 border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600 ml-2" style="flex-shrink: 0 !important; min-width: fit-content !important; white-space: nowrap !important;" title="${t('module.ptw.btn.refreshTitle', 'تحديث المحتوى الحالي')}">
                    <i class="fas fa-sync-alt ml-2"></i>
                    ${t('module.common.refresh', 'تحديث')}
                </button>
            </div>
            
            <style id="ptw-scrollbar-styles">
                /* فلتر احترافي أعلى الجدول (مميز كالملاحظات اليومية) */
                .ptw-filters-row { position: relative; border-bottom: 1px solid #e2e8f0; }
                .ptw-filters-grid { width: 100%; }
                .ptw-filter-field { display: flex; flex-direction: column; gap: 6px; }
                .ptw-filter-label { font-size: 12px; font-weight: 600; color: #4a5568; letter-spacing: 0.5px; display: flex; align-items: center; }
                .ptw-filter-label i { font-size: 11px; color: #3b82f6; }
                .ptw-filter-input { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 14px; color: #2d3748; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .ptw-filter-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
                .ptw-filter-input:hover { border-color: #cbd5e0; }
                .ptw-filter-reset-btn { width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(59,130,246,0.25); display: flex; align-items: center; justify-content: center; }
                .ptw-filter-reset-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(59,130,246,0.35); }
                .ptw-filter-reset-btn:active { transform: translateY(0); }
                @media (max-width: 768px) { .ptw-filters-row { padding: 12px 16px !important; margin: 0 -16px 0 -16px !important; width: calc(100% + 32px) !important; } .ptw-filters-grid { grid-template-columns: repeat(2, 1fr) !important; } }
                /* مسطرة جانبية على اليسار، ترتيب الجدول من اليمين (RTL) */
                .ptw-table-wrapper {
                    direction: rtl;
                    overflow-x: auto;
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    scroll-behavior: smooth;
                    max-height: 70vh;
                    width: 100%;
                }
                .ptw-table-wrapper .data-table { direction: rtl; text-align: right; }
                .ptw-table-wrapper::-webkit-scrollbar { width: 12px; height: 12px; }
                .ptw-table-wrapper::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 6px; margin: 10px 0; }
                .ptw-table-wrapper::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #3b82f6, #2563eb); border-radius: 6px; border: 2px solid #f1f5f9; }
                .ptw-table-wrapper::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #2563eb, #1d4ed8); }
                .ptw-table-wrapper::-webkit-scrollbar-corner { background: #f1f5f9; border-radius: 0 0 6px 0; }
                @media (max-width: 768px) { .ptw-table-wrapper { max-height: 60vh; } .ptw-table-wrapper::-webkit-scrollbar { width: 8px; height: 8px; } }
            </style>
            <!-- محتوى التبويبات -->
            <div id="ptw-tab-content" class="min-h-[500px]">
                <div id="ptw-permits-content" class="fade-in">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <div style="width: 300px; margin: 0 auto 16px;">
                                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                    </div>
                                </div>
                                <p class="text-gray-500">${t('module.ptw.loading.permits', 'جاري تحميل قائمة التصاريح...')}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="ptw-registry-content" style="display: none;" class="fade-in">
                    ${this.renderRegistryContent()}
                </div>
                <div id="ptw-map-content" style="display: none; flex-direction: column; height: calc(100vh - 280px); min-height: 600px; width: 100%;" class="fade-in">
                    ${this.renderMapContent()}
                </div>
                <div id="ptw-analysis-content" style="display: none;" class="fade-in">
                    ${this.renderAnalysisContent()}
                </div>
                <div id="ptw-approvals-content" style="display: none;" class="fade-in">
                    ${this.renderApprovalsContent()}
                </div>
            </div>
        `;
            this.applyModuleI18n(section);
            this.ensureI18nObservers(section);
            this.formSettingsState = null;
            this.formSettingsEventsBound = false;
            this.setupEventListeners();
            this.setupRegistryEventListeners();
            
            // ✅ تحميل القائمة فوراً بعد عرض الواجهة
            setTimeout(async () => {
                try {
                    const permitsContent = document.getElementById('ptw-permits-content');
                    if (!permitsContent) return;
                    
                    const listContent = await this.renderList().catch(error => {
                        Utils.safeWarn('⚠️ خطأ في تحميل القائمة:', error);
                        return `
                            <div class="content-card">
                                <div class="card-body">
                                    <div class="empty-state">
                                        <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                        <p class="text-gray-500 mb-4">${t('module.common.loadDataError', 'حدث خطأ في تحميل البيانات')}</p>
                                        <button onclick="PTW.load()" class="btn-primary">
                                            <i class="fas fa-redo ml-2"></i>
                                            ${t('module.common.retry', 'إعادة المحاولة')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    permitsContent.innerHTML = listContent;
                    this.applyModuleI18n(permitsContent);
                    // استخدام immediate = true في التحميل الأولي
                    this.loadPTWList(true);
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل القائمة:', error);
                }
            }, 0);
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول PTW:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول PTW:', error);
            }
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">${t('module.common.loadDataRuntimeError', 'حدث خطأ أثناء تحميل البيانات')}</p>
                                <button onclick="PTW.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${t('module.common.retry', 'إعادة المحاولة')}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                this.applyModuleI18n(section);
            }
        } finally {
            this._isLoading = false;
            if (this._reloadRequested) {
                this._reloadRequested = false;
                setTimeout(() => {
                    try { this.load(); } catch (_) { /* ignore */ }
                }, 0);
            }
        }
    },

    /**
     * التبديل بين التبويبات
     */
    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        const tabBtns = document.querySelectorAll('.ptw-tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('text-blue-600', 'bg-blue-50', 'shadow-sm', 'active');
            btn.classList.add('text-gray-600', 'hover:bg-gray-50');
            // منع الانكماش - إعادة تعيين styles
            btn.style.setProperty('flex-shrink', '0', 'important');
            btn.style.setProperty('min-width', 'fit-content', 'important');
            btn.style.setProperty('white-space', 'nowrap', 'important');
            btn.style.setProperty('width', 'auto', 'important');
            btn.style.setProperty('max-width', 'none', 'important');
        });

        // التأكد من الحفاظ على styles للـ container
        const tabContainer = document.querySelector('.ptw-tabs');
        if (tabContainer) {
            tabContainer.style.setProperty('flex-wrap', 'nowrap', 'important');
            tabContainer.style.setProperty('overflow-x', 'auto', 'important');
            tabContainer.style.setProperty('overflow-y', 'visible', 'important');
        }

        const activeBtn = document.getElementById(`ptw-tab-${tab}`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-50');
            activeBtn.classList.add('text-blue-600', 'bg-blue-50', 'shadow-sm', 'active');
            // منع الانكماش - إعادة تعيين styles
            activeBtn.style.setProperty('flex-shrink', '0', 'important');
            activeBtn.style.setProperty('min-width', 'fit-content', 'important');
            activeBtn.style.setProperty('white-space', 'nowrap', 'important');
            activeBtn.style.setProperty('width', 'auto', 'important');
            activeBtn.style.setProperty('max-width', 'none', 'important');
        }

        // Switch Content - Define contents
        const permitsContent = document.getElementById('ptw-permits-content');
        const registryContent = document.getElementById('ptw-registry-content');
        const mapContent = document.getElementById('ptw-map-content');
        const analysisContent = document.getElementById('ptw-analysis-content');
        const approvalsContent = document.getElementById('ptw-approvals-content');

        // Hide all contents - إخفاء جميع المحتويات بما في ذلك الخريطة
        if (permitsContent) {
            permitsContent.style.display = 'none';
            permitsContent.style.visibility = 'hidden';
        }
        if (registryContent) {
            registryContent.style.display = 'none';
            registryContent.style.visibility = 'hidden';
        }
        if (mapContent) {
            mapContent.style.display = 'none';
            mapContent.style.visibility = 'hidden';
            mapContent.style.opacity = '0';
        }
        if (analysisContent) {
            analysisContent.style.display = 'none';
            analysisContent.style.visibility = 'hidden';
        }
        if (approvalsContent) {
            approvalsContent.style.display = 'none';
            approvalsContent.style.visibility = 'hidden';
        }

        // Show selected content
        if (tab === 'permits') {
            // التأكد من إخفاء الخريطة بشكل كامل ومطلق
            if (mapContent) {
                mapContent.style.display = 'none';
                mapContent.style.visibility = 'hidden';
                mapContent.style.opacity = '0';
                mapContent.style.position = 'absolute';
                mapContent.style.left = '-9999px';
                mapContent.style.width = '0';
                mapContent.style.height = '0';
                mapContent.style.overflow = 'hidden';
                mapContent.style.pointerEvents = 'none';
                mapContent.style.zIndex = '-1';
                // إيقاف أي عمليات تهيئة للخريطة
                if (this.mapInitTimeout) {
                    clearTimeout(this.mapInitTimeout);
                    this.mapInitTimeout = null;
                }
                // تدمير الخريطة إذا كانت موجودة
                if (this.mapInstance && this.currentTab !== 'map') {
                    try {
                        this.destroyMap();
                    } catch (e) {
                        Utils.safeWarn('⚠️ خطأ في تدمير الخريطة:', e);
                    }
                }
            }
            if (permitsContent) {
                permitsContent.style.display = 'block';
                permitsContent.style.visibility = 'visible';
                permitsContent.style.position = 'relative';
                permitsContent.style.left = 'auto';
                permitsContent.style.width = 'auto';
                permitsContent.style.height = 'auto';
                permitsContent.style.overflow = 'visible';
                permitsContent.style.pointerEvents = 'auto';
                permitsContent.style.zIndex = 'auto';
            }
        } else if (tab === 'registry') {
            // التأكد من إخفاء الخريطة بشكل كامل
            if (mapContent) {
                mapContent.style.display = 'none';
                mapContent.style.visibility = 'hidden';
                mapContent.style.opacity = '0';
                mapContent.style.position = 'absolute';
                mapContent.style.left = '-9999px';
                if (this.mapInitTimeout) {
                    clearTimeout(this.mapInitTimeout);
                    this.mapInitTimeout = null;
                }
            }
            this.initRegistry();
            if (registryContent) {
                registryContent.style.display = 'block';
                registryContent.style.visibility = 'visible';
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
            }
        } else if (tab === 'map') {
            if (mapContent) {
                try {
                    Utils.safeLog('🗺️ Switching to Map Tab');
                    // التأكد من إخفاء جميع التبويبات الأخرى أولاً بشكل كامل
                    if (permitsContent) {
                        permitsContent.style.display = 'none';
                        permitsContent.style.visibility = 'hidden';
                    }
                    if (registryContent) {
                        registryContent.style.display = 'none';
                        registryContent.style.visibility = 'hidden';
                    }
                    if (analysisContent) {
                        analysisContent.style.display = 'none';
                        analysisContent.style.visibility = 'hidden';
                    }
                    if (approvalsContent) {
                        approvalsContent.style.display = 'none';
                        approvalsContent.style.visibility = 'hidden';
                    }
                    
                    // إظهار تبويب الخريطة فقط
                    mapContent.style.display = 'flex';
                    mapContent.style.flexDirection = 'column';
                    mapContent.style.height = 'calc(100vh - 280px)';
                    mapContent.style.minHeight = '600px';
                    mapContent.style.width = '100%';
                    mapContent.style.visibility = 'visible';
                    mapContent.style.opacity = '1';
                    mapContent.style.position = 'relative';
                    mapContent.style.left = 'auto';

                    // Check and render map content if missing
                    const mapContainerCheck = document.getElementById('ptw-map');
                    if (!mapContainerCheck) {
                        mapContent.innerHTML = this.renderMapContent();
                    }

                    // التأكد من أن الحاوية لها الأبعاد الصحيحة
                    const mapContainer = document.getElementById('ptw-map-container');
                    const mapDiv = document.getElementById('ptw-map');
                    
                    if (mapContainer) {
                        // إجبار الأبعاد بشكل صريح
                        mapContainer.style.height = '100%';
                        mapContainer.style.minHeight = '600px';
                        mapContainer.style.width = '100%';
                        mapContainer.style.display = 'block';
                        mapContainer.style.visibility = 'visible';
                        
                        // استخدام requestAnimationFrame لتجنب FOUC warning
                        if (document.readyState === 'complete') {
                            requestAnimationFrame(() => {
                                const containerStyle = window.getComputedStyle(mapContainer);
                                if (containerStyle.height === '0px' || containerStyle.height === 'auto') {
                                    mapContainer.style.height = '600px';
                                }
                            });
                        } else {
                            // تعيين الأبعاد مباشرة إذا لم تكن الصفحة محملة
                            mapContainer.style.height = '600px';
                        }
                    }
                    
                    if (mapDiv) {
                        mapDiv.style.height = '100%';
                        mapDiv.style.width = '100%';
                        mapDiv.style.minHeight = '600px';
                        mapDiv.style.display = 'block';
                        mapDiv.style.visibility = 'visible';
                    }

                // Initialize map with delay to ensure DOM is ready
                if (this.mapInitTimeout) clearTimeout(this.mapInitTimeout);
                this.mapInitTimeout = setTimeout(() => {
                    // التأكد من أننا ما زلنا في تبويب الخريطة
                    if (this.currentTab === 'map' && mapContent && mapContent.style.display !== 'none') {
                        // تهيئة الخريطة (initMap يعرض رسالة الخطأ داخلياً - لا نكرر تسجيل الخطأ كـ error)
                        this.initMap().catch(error => {
                            Utils.safeWarn('⚠️ فشل تهيئة الخريطة (سيظهر للمستخدم في التبويب):', error?.message || error);
                        });
                        
                        // Force map resize after initialization
                        setTimeout(() => {
                            if (this.mapInstance && this.currentTab === 'map') {
                                if (this.mapType === 'leaflet' && typeof L !== 'undefined' && this.mapInstance && this.mapInstance.invalidateSize) {
                                    this.mapInstance.invalidateSize();
                                    Utils.safeLog('✅ تم تحديث حجم الخريطة بعد التبديل للتبويب');
                                } else if (this.mapType === 'google' && typeof google !== 'undefined' && google.maps && google.maps.event && this.mapInstance) {
                                    google.maps.event.trigger(this.mapInstance, 'resize');
                                    Utils.safeLog('✅ تم تحديث حجم Google Maps بعد التبديل للتبويب');
                                }
                            }
                        }, 400);
                    }
                }, 300);
                } catch (mapTabError) {
                    Utils.safeWarn('⚠️ خطأ عند فتح تبويب الخرائط:', mapTabError?.message || mapTabError);
                    if (mapContent) {
                        mapContent.style.display = 'flex';
                        const errorDiv = mapContent.querySelector('#ptw-map-error');
                        const errorMsg = mapContent.querySelector('#ptw-map-error-message');
                        if (errorDiv && errorMsg) {
                            errorDiv.classList.remove('hidden');
                            errorMsg.innerHTML = '<p>حدث خطأ عند تحميل الخريطة. يرجى استخدام زر إعادة المحاولة أدناه.</p>';
                            if (mapContent.querySelector('#ptw-map-loading')) mapContent.querySelector('#ptw-map-loading').style.display = 'none';
                        } else {
                            mapContent.innerHTML = '<div class="p-6 text-center"><p class="text-red-600 mb-2">حدث خطأ عند تحميل الخريطة.</p><button type="button" class="btn-primary" onclick="PTW.switchTab(\'map\')"><i class="fas fa-redo ml-2"></i>إعادة المحاولة</button></div>';
                        }
                    }
                }
            }
        } else if (tab === 'analysis') {
            // التأكد من إخفاء الخريطة بشكل كامل
            if (mapContent) {
                mapContent.style.display = 'none';
                mapContent.style.visibility = 'hidden';
                mapContent.style.opacity = '0';
                mapContent.style.position = 'absolute';
                mapContent.style.left = '-9999px';
                // إيقاف أي عمليات خريطة جارية
                if (this.mapInitTimeout) {
                    clearTimeout(this.mapInitTimeout);
                    this.mapInitTimeout = null;
                }
            }
            if (analysisContent) {
                analysisContent.style.display = 'block';
                analysisContent.style.visibility = 'visible';
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }
        } else if (tab === 'approvals') {
            // التأكد من إخفاء الخريطة بشكل كامل
            if (mapContent) {
                mapContent.style.display = 'none';
                mapContent.style.visibility = 'hidden';
                mapContent.style.opacity = '0';
                mapContent.style.position = 'absolute';
                mapContent.style.left = '-9999px';
                // إيقاف أي عمليات خريطة جارية
                if (this.mapInitTimeout) {
                    clearTimeout(this.mapInitTimeout);
                    this.mapInitTimeout = null;
                }
            }
            if (approvalsContent) {
                approvalsContent.style.display = 'block';
                approvalsContent.style.visibility = 'visible';
                approvalsContent.innerHTML = this.renderApprovalsContent();
                this.setupApprovalsEventListeners();
                Utils.safeLog('✅ Approvals Tab Displayed');
            }
        }
        
        // التأكد من إخفاء الخريطة في جميع التبويبات الأخرى بشكل نهائي ومطلق
        if (tab !== 'map' && mapContent) {
            mapContent.style.display = 'none';
            mapContent.style.visibility = 'hidden';
            mapContent.style.opacity = '0';
            mapContent.style.position = 'absolute';
            mapContent.style.left = '-9999px';
            mapContent.style.width = '0';
            mapContent.style.height = '0';
            mapContent.style.overflow = 'hidden';
            mapContent.style.pointerEvents = 'none';
            mapContent.style.zIndex = '-1';
            // إيقاف أي عمليات تهيئة للخريطة
            if (this.mapInitTimeout) {
                clearTimeout(this.mapInitTimeout);
                this.mapInitTimeout = null;
            }
            // تدمير الخريطة إذا كانت موجودة
            if (this.mapInstance && this.currentTab !== 'map') {
                try {
                    this.destroyMap();
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ في تدمير الخريطة:', e);
                }
            }
        }
    },

    /**
     * تحديث محتوى التبويب الحالي (يُستدعى من زر التحديث بالأعلى)
     */
    refreshCurrentTab() {
        const tab = this.currentTab || 'permits';
        const registryContent = document.getElementById('ptw-registry-content');
        const permitsContent = document.getElementById('ptw-permits-content');
        const mapContent = document.getElementById('ptw-map-content');
        const analysisContent = document.getElementById('ptw-analysis-content');
        const approvalsContent = document.getElementById('ptw-approvals-content');
        const refreshBtn = document.getElementById('ptw-refresh-header-btn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            const icon = refreshBtn.querySelector('i.fa-sync-alt');
            if (icon) icon.classList.add('fa-spin');
        }
        const done = () => {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                const icon = refreshBtn.querySelector('i.fa-sync-alt');
                if (icon) icon.classList.remove('fa-spin');
            }
            this.updateKPIs();
            if (typeof Notification !== 'undefined' && Notification.success) Notification.success(PTW._t('module.ptw.refresh.success', 'تم التحديث'));
        };
        try {
            if (tab === 'permits') {
                this.loadPTWList(true);
                done();
            } else if (tab === 'registry' && registryContent) {
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
                done();
            } else if (tab === 'map' && mapContent) {
                if (this.mapInstance && typeof this.updateMapMarkers === 'function') this.updateMapMarkers();
                done();
            } else if (tab === 'analysis' && analysisContent) {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
                done();
            } else if (tab === 'approvals' && approvalsContent) {
                approvalsContent.innerHTML = this.renderApprovalsContent();
                this.setupApprovalsEventListeners();
                done();
            } else {
                done();
            }
        } catch (err) {
            Utils.safeError('خطأ عند التحديث:', err);
            if (refreshBtn) { refreshBtn.disabled = false; const i = refreshBtn.querySelector('i.fa-sync-alt'); if (i) i.classList.remove('fa-spin'); }
            if (typeof Notification !== 'undefined' && Notification.error) Notification.error(PTW._t('module.ptw.refresh.error', 'حدث خطأ أثناء التحديث'));
        }
    },

    /**
     * عرض محتوى سجل حصر التصاريح
     */
    renderRegistryContent() {
        const t = (key, fallback) => this._t(key, fallback);
        // التأكد من إخفاء الخريطة في تبويب السجل
        const mapContent = document.getElementById('ptw-map-content');
        if (mapContent) {
            mapContent.style.display = 'none';
            mapContent.style.visibility = 'hidden';
            mapContent.style.opacity = '0';
            mapContent.style.position = 'absolute';
            mapContent.style.left = '-9999px';
            mapContent.style.width = '0';
            mapContent.style.height = '0';
            mapContent.style.overflow = 'hidden';
            mapContent.style.pointerEvents = 'none';
            mapContent.style.zIndex = '-1';
        }
        
        // دمج بيانات التصاريح من كلا المصدرين للتأكد من المطابقة
        const permitsFromList = AppState.appData.ptw || [];
        const permitsFromRegistry = (this.registryData || []).map(registryEntry => {
            return {
                id: registryEntry.permitId || registryEntry.id,
                workType: Array.isArray(registryEntry.permitType)
                    ? registryEntry.permitTypeDisplay || registryEntry.permitType.join('، ')
                    : registryEntry.permitType || registryEntry.permitTypeDisplay,
                status: registryEntry.status,
                isFromRegistry: true
            };
        });

        const allItems = this.mergePermitsPreferRegistry(permitsFromList, permitsFromRegistry);
        const totalCount = allItems.length;

        // عدد صفوف السجل المعروضة = صفوف الجدول = الكارت (بعد تطبيع PTWRegistry؛ دمج التكرار بمعرف السجل id وليس بمسلسل واحد فقط)
        const registryRowCount = this.registryData.length;
        const openCount = this.registryData.filter(r => this.isPermitOpenStatus(r?.status)).length;
        const closedCount = this.registryData.filter(r => this.isPermitClosedStatus(r?.status)).length;

        // حساب متوسط الوقت للحالات المغلقة (من السجل فقط)
        const closedRecords = this.registryData.filter(r => this.isPermitClosedStatus(r?.status) && (r.closureDate || r.timeTo));
        let avgTime = t('module.ptw.registry.avgNotAvailable', 'غير متاح');
        if (closedRecords.length > 0) {
            let totalMs = 0;
            closedRecords.forEach(r => {
                const start = this.parseDateTimeValue(r.timeFrom);
                const end = this.parseDateTimeValue(r.closureDate || r.timeTo);
                if (start && end && start < end) totalMs += (end - start);
            });
            if (totalMs > 0) {
                const avgHours = Math.round(totalMs / closedRecords.length / (1000 * 60 * 60));
                avgTime = t('module.ptw.registry.avgHours', '{n} ساعة').replace(/\{n\}/g, String(avgHours));
            }
        }

        return `
            <!-- أزرار التصدير والإدخال -->
            <div class="flex justify-between items-center gap-2 mb-4">
                <button id="ptw-registry-add-manual" class="btn-success">
                    <i class="fas fa-plus-circle ml-2"></i>
                    ${t('module.ptw.registry.addManual', 'إضافة تصريح يدوي / Manual Permit Entry')}
                </button>
                <div class="flex gap-2">
                    <button id="ptw-registry-import-excel" class="btn-secondary">
                        <i class="fas fa-file-import ml-2"></i>
                        ${t('module.ptw.registry.importExcel', 'استيراد Excel')}
                    </button>
                    <button id="ptw-registry-export-excel" class="btn-secondary">
                        <i class="fas fa-file-excel ml-2"></i>
                        ${t('module.ptw.registry.exportExcel', 'تصدير Excel')}
                    </button>
                    <button id="ptw-registry-export-pdf" class="btn-primary">
                        <i class="fas fa-file-pdf ml-2"></i>
                        ${t('module.ptw.registry.exportPdf', 'تصدير PDF')}
                    </button>
                </div>
            </div>
            
            <!-- بطاقات الإحصائيات -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="kpi-card kpi-info">
                    <div class="kpi-icon"><i class="fas fa-list-ol"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">${t('module.ptw.registry.totalRecords', 'إجمالي السجلات')}</h3>
                        <p class="kpi-value">${registryRowCount}</p>
                        <p class="text-xs text-gray-500 mt-1" title="${t('module.ptw.registry.mergedCountHint', 'تصاريح فريدة (قائمة PTW + سجل) حسب معرف التصريح؛ قد يختلف إن وُجد تصريح في القائمة بلا صف سجل')}">${totalCount !== registryRowCount ? `${t('module.ptw.registry.withPtwListUnique', 'مع قائمة PTW (فريد)')}: ${totalCount}` : t('module.ptw.registry.sameAsTable', 'يطابق صفوف الجدول')}</p>
                    </div>
                </div>
                <div class="kpi-card kpi-primary">
                    <div class="kpi-icon"><i class="fas fa-folder-open"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">${t('module.ptw.registry.openPermits', 'تصاريح مفتوحة')}</h3>
                        <p class="kpi-value">${openCount}</p>
                    </div>
                </div>
                <div class="kpi-card kpi-success">
                    <div class="kpi-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">${t('module.ptw.registry.closedPermits', 'تصاريح مغلقة')}</h3>
                        <p class="kpi-value">${closedCount}</p>
                    </div>
                </div>
                <div class="kpi-card kpi-warning">
                    <div class="kpi-icon"><i class="fas fa-clock"></i></div>
                    <div class="kpi-content">
                        <h3 class="kpi-label">${t('module.ptw.registry.avgTime', 'متوسط الوقت')}</h3>
                        <p class="kpi-value" style="font-size: 1.2rem;">${avgTime}</p>
                    </div>
                </div>
            </div>
            
            <!-- فلاتر البحث -->
            <div class="content-card mb-4">
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-search ml-2"></i>${t('module.ptw.registry.search', 'بحث')}
                            </label>
                            <input type="text" id="registry-search" class="form-input" placeholder="${t('module.ptw.registry.searchPlaceholder', 'ابحث برقم التصريح أو الوصف...')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-filter ml-2"></i>${t('module.ptw.registry.status', 'الحالة')}
                            </label>
                            <select id="registry-filter-status" class="form-input">
                                <option value="">${t('module.ptw.registry.allStatuses', 'جميع الحالات')}</option>
                                <option value="مفتوح">مفتوح</option>
                                <option value="مغلق">مغلق</option>
                                <option value="اكتمل العمل بشكل آمن">اكتمل العمل بشكل آمن</option>
                                <option value="لم يكتمل العمل">لم يكتمل العمل</option>
                                <option value="إغلاق جبري">إغلاق جبري</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar ml-2"></i>${t('module.ptw.registry.fromDate', 'من تاريخ')}
                            </label>
                            <input type="date" id="registry-filter-date-from" class="form-input">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar ml-2"></i>${t('module.ptw.registry.toDate', 'إلى تاريخ')}
                            </label>
                            <input type="date" id="registry-filter-date-to" class="form-input">
                            <div id="registry-filter-count-wrapper" class="text-xs text-gray-600 mt-1">
                                ${t('module.ptw.registry.permitCountInRange', 'عدد التصاريح في الفترة:')} <span id="registry-filter-count">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- جدول السجل -->
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-table ml-2"></i>
                        ${t('module.ptw.registry.tableTitle', 'جدول سجل حصر التصاريح')} (${registryRowCount} ${t('module.ptw.registry.recordWord', 'سجل')})
                    </h2>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        ${this.renderRegistryTable()}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض جدول السجل
     */
    renderRegistryTable() {
        const t = (key, fallback) => this._t(key, fallback);
        if (this.registryData.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">${t('module.ptw.registry.empty', 'لا توجد سجلات حتى الآن')}</p>
                    <p class="text-sm text-gray-400 mt-2">${t('module.ptw.registry.emptyHint', 'سيتم إضافة السجلات تلقائياً عند إنشاء تصاريح عمل جديدة')}</p>
                </div>
            `;
        }

        // ترتيب حسب المسلسل: الأقدم بالأعلى (1، 2، 3...) والأحدث بالأسفل
        const sortedData = [...this.registryData].sort((a, b) => {
            const seqA = parseInt(a.sequentialNumber) || 0;
            const seqB = parseInt(b.sequentialNumber) || 0;
            return seqA - seqB; // ترتيب تصاعدي: 1، 2، 3...
        });

        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>${t('module.ptw.registry.col.seq', 'مسلسل')}</th>
                        <th>${t('module.ptw.registry.col.date', 'التاريخ')}</th>
                        <th>${t('module.ptw.registry.col.permitType', 'نوع التصريح')}</th>
                        <th>${t('module.ptw.registry.col.requestingParty', 'الجهة الطالبة')}</th>
                        <th>${t('module.ptw.registry.col.location', 'الموقع')}</th>
                        <th>${t('module.ptw.registry.col.timeFrom', 'الوقت من')}</th>
                        <th>${t('module.ptw.registry.col.timeTo', 'الوقت إلى')}</th>
                        <th>${t('module.ptw.registry.col.totalTime', 'إجمالي الوقت')}</th>
                        <th>${t('module.ptw.registry.col.authorizedParty', 'الجهة المصرح لها')}</th>
                        <th>${t('module.ptw.registry.col.workDesc', 'وصف العمل')}</th>
                        <th>${t('module.ptw.registry.col.followUp1', 'مسئول المتابعة 01')}</th>
                        <th>${t('module.ptw.registry.col.followUp2', 'مسئول المتابعة 02')}</th>
                        <th>${t('module.ptw.registry.col.permitStatus', 'حالة التصريح')}</th>
                        <th>${t('module.ptw.registry.col.actions', 'الإجراءات')}</th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedData.forEach(entry => {
            // تحديد لون وأيقونة الحالة
            let statusClass, statusIcon;
            if (entry.status === 'مفتوح' || entry.status === 'لم يكتمل العمل') {
                statusClass = 'bg-blue-100 text-blue-800';
                statusIcon = 'fa-folder-open';
            } else if (entry.status === 'اكتمل العمل بشكل آمن') {
                statusClass = 'bg-green-100 text-green-800';
                statusIcon = 'fa-check-circle';
            } else if (entry.status === 'إغلاق جبري') {
                statusClass = 'bg-red-100 text-red-800';
                statusIcon = 'fa-lock';
            } else if (entry.status === 'مغلق') {
                statusClass = 'bg-gray-100 text-gray-800';
                statusIcon = 'fa-check-circle';
            } else {
                statusClass = 'bg-yellow-100 text-yellow-800';
                statusIcon = 'fa-clock';
            }

            /** تاريخ العمل: نفس مصدر تفاصيل التصريح (startDate المخزن في timeFrom) */
            const workStartSource = entry.timeFrom || entry.openDate;
            const registryDateStr = workStartSource && Utils.formatDate
                ? Utils.formatDate(workStartSource)
                : t('module.ptw.common.notSpecified', 'غير محدد');
            const registryDateDisplay = !workStartSource || registryDateStr === '-' ? t('module.ptw.common.notSpecified', 'غير محدد') : registryDateStr;

            /** وقت فقط — نفس أسلوب طباعة التصريح (من الساعة / إلى الساعة) */
            const formatRegistryTime = (dateStr) => {
                if (!dateStr || dateStr === t('module.ptw.common.notSpecified', 'غير محدد')) return t('module.ptw.common.notSpecified', 'غير محدد');
                try {
                    const date = this.parseDateTimeValue(dateStr);
                    if (!date || isNaN(date.getTime())) return t('module.ptw.common.notSpecified', 'غير محدد');
                    return date.toLocaleTimeString('en-GB-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: false });
                } catch {
                    return t('module.ptw.common.notSpecified', 'غير محدد');
                }
            };

            // «الوقت إلى» = نهاية مدة العمل المجدولة (endDate) كما في نموذج التصريح؛ وقت الإغلاق يُحسب في إجمالي الوقت فقط
            const timeFromDisplay = formatRegistryTime(workStartSource);
            const timeToDisplay = formatRegistryTime(entry.timeTo);

            // عرض أنواع التصريح (يمكن أن تكون مصفوفة أو نص)
            const permitTypeDisplay = this.getPermitTypeDisplay(entry);
            const permitTypeShort = permitTypeDisplay.length > 50 ? permitTypeDisplay.substring(0, 50) + '...' : permitTypeDisplay;
            const totalDisp = (entry.timeFrom && entry.timeTo)
                ? this.calculateTotalTime(entry.timeFrom, entry.timeTo)
                : (this.isUsableDurationText(entry.totalTime) ? entry.totalTime : t('module.ptw.common.notSpecified', 'غير محدد'));
            const statusText = this.statusLabel(entry.status);

            const seqRaw = entry.sequentialNumber;
            const seqDisplay = (seqRaw != null && String(seqRaw).trim() !== '' && !Number.isNaN(parseInt(String(seqRaw), 10)))
                ? String(parseInt(String(seqRaw).replace(/^0+(?=\d)/, ''), 10))
                : (String(entry.paperPermitNumber || '').trim() ? `(${String(entry.paperPermitNumber).trim()})` : '—');

            tableHTML += `
                <tr data-registry-id="${entry.id}">
                    <td class="font-bold text-blue-600">${Utils.escapeHTML(seqDisplay)}</td>
                    <td>${Utils.escapeHTML(registryDateDisplay)}</td>
                    <td title="${Utils.escapeHTML(permitTypeDisplay)}">${Utils.escapeHTML(permitTypeShort)}</td>
                    <td>${Utils.escapeHTML(entry.requestingParty)}</td>
                    <td>${Utils.escapeHTML(entry.location)}</td>
                    <td>${Utils.escapeHTML(timeFromDisplay)}</td>
                    <td>${Utils.escapeHTML(timeToDisplay)}</td>
                    <td class="font-semibold">${Utils.escapeHTML(String(totalDisp))}</td>
                    <td>${Utils.escapeHTML(entry.authorizedParty)}</td>
                    <td class="max-w-xs truncate" title="${Utils.escapeHTML(entry.workDescription)}">${Utils.escapeHTML(entry.workDescription).substring(0, 30)}...</td>
                    <td>${Utils.escapeHTML(entry.supervisor1)}</td>
                    <td>${Utils.escapeHTML(entry.supervisor2)}</td>
                    <td>
                        <span class="badge ${statusClass}">
                            <i class="fas ${statusIcon} ml-1"></i>
                            ${Utils.escapeHTML(String(statusText))}
                        </span>
                    </td>
                    <td>
                        <div class="flex items-center gap-1 flex-wrap">
                            ${entry.isManualEntry ? `
                                <button class="btn btn-primary btn-sm" onclick="PTW.viewManualPermitDetails('${entry.id}')" title="${t('module.ptw.registry.viewDetails', 'عرض التفاصيل')}">
                                    <i class="fas fa-eye ml-1"></i> ${t('module.ptw.registry.viewDetails', 'عرض التفاصيل')}
                                </button>
                            ` : `
                                <button class="btn btn-primary btn-sm" onclick="PTW.viewRegistryDetails('${entry.permitId}')" title="${t('module.ptw.registry.viewDetails', 'عرض التفاصيل')}">
                                    <i class="fas fa-eye ml-1"></i> ${t('module.ptw.registry.viewDetails', 'عرض التفاصيل')}
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table>';
        return `<div class="ptw-table-wrapper">${tableHTML}</div>`;
    },

    /**
     * عرض محتوى الخريطة
     */
    renderMapContent() {
        const t = (k, f) => this._t(k, f);
        return `
            <style>
                #ptw-map-content {
                    display: flex !important;
                    flex-direction: column !important;
                    height: calc(100vh - 280px) !important;
                    min-height: 600px !important;
                    width: 100% !important;
                }
                /* إخفاء الخريطة في التبويبات الأخرى بشكل كامل */
                #ptw-permits-content #ptw-map-content,
                #ptw-registry-content #ptw-map-content,
                #ptw-analysis-content #ptw-map-content,
                #ptw-approvals-content #ptw-map-content,
                #ptw-tab-content:not(:has(#ptw-map-content[style*="display: flex"])) #ptw-map-content {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    position: absolute !important;
                    left: -9999px !important;
                    width: 0 !important;
                    height: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                }
                #ptw-map-container {
                    flex: 1;
                    width: 100%;
                    position: relative;
                    background: #f3f4f6;
                    overflow: hidden;
                    display: block !important;
                    min-height: 600px;
                    height: 100%;
                }
                #ptw-map { 
                    z-index: 1;
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 600px;
                    position: relative;
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                }
                .ptw-permit-popup .leaflet-popup-content-wrapper { border-radius: 8px; padding: 0; }
                .ptw-permit-popup .leaflet-popup-content { margin: 0; min-width: 300px; }
                .leaflet-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            </style>
            <div class="flex flex-col h-full w-full">
                <div class="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100 mb-4" style="flex-shrink: 0;">
                    <div>
                        <h2 class="text-lg font-bold text-gray-800">
                            <i class="fas fa-map-marked-alt ml-2 text-primary-500"></i>
                            ${t('module.ptw.map.title', 'خريطة مواقع التصاريح')}
                        </h2>
                        <p class="text-sm text-gray-500 mt-1">${t('module.ptw.map.subtitle', 'عرض حالة ومواقع تصاريح العمل')}</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <select id="ptw-map-filter-status" class="form-select text-sm w-40 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">${t('module.ptw.map.filterAllStatus', 'كل الحالات')}</option>
                            <option value="مفتوح">${t('module.ptw.status.open', 'مفتوح')}</option>
                            <option value="قيد المراجعة">${t('module.ptw.status.underReview', 'قيد المراجعة')}</option>
                            <option value="موافق عليه">${t('module.ptw.status.approved', 'موافق عليه')}</option>
                            <option value="مغلق">${t('module.ptw.status.closed', 'مغلق')}</option>
                            <option value="مرفوض">${t('module.ptw.status.rejected', 'مرفوض')}</option>
                        </select>
                        <select id="ptw-map-filter-type" class="form-select text-sm w-40 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">${t('module.ptw.map.filterAllTypes', 'كل الأنواع')}</option>
                            <option value="أعمال ساخنة">${t('module.ptw.map.wt.hot', 'أعمال ساخنة')}</option>
                            <option value="أماكن مغلقة">${t('module.ptw.map.wt.enclosed', 'أماكن مغلقة')}</option>
                            <option value="أعمال على ارتفاع">${t('module.ptw.map.wt.height', 'أعمال على ارتفاع')}</option>
                            <option value="أعمال كهربائية">${t('module.ptw.map.wt.elec', 'أعمال كهربائية')}</option>
                            <option value="أعمال باردة">${t('module.ptw.map.wt.cold', 'أعمال باردة')}</option>
                        </select>
                        <div class="flex items-center gap-2 bg-white border border-gray-300 rounded-md p-1 shadow-sm">
                            <button id="ptw-map-type-normal" class="px-3 py-1.5 text-xs font-semibold rounded transition-all duration-200 bg-blue-500 text-white shadow-sm" title="${t('module.ptw.map.tooltipRoad', 'الخريطة العادية')}">
                                <i class="fas fa-map ml-1"></i>
                                ${t('module.ptw.map.mapNormal', 'عادي')}
                            </button>
                            <button id="ptw-map-type-satellite" class="px-3 py-1.5 text-xs font-semibold rounded transition-all duration-200 text-gray-700 hover:bg-gray-100" title="${t('module.ptw.map.tooltipSatellite', 'الخريطة الفضائية')}">
                                <i class="fas fa-satellite ml-1"></i>
                                ${t('module.ptw.map.mapSatellite', 'ستالايت')}
                            </button>
                            <button id="ptw-map-type-terrain" class="px-3 py-1.5 text-xs font-semibold rounded transition-all duration-200 text-gray-700 hover:bg-gray-100" title="${t('module.ptw.map.tooltipTerrain', 'الخريطة الطبوغرافية')}">
                                <i class="fas fa-mountain ml-1"></i>
                                ${t('module.ptw.map.mapTerrain', 'تضاريس')}
                            </button>
                    </div>
                        <button id="ptw-map-fullscreen-btn" class="btn-secondary text-sm px-3 py-2" title="${t('module.ptw.map.fullscreen', 'ملء الشاشة')}">
                            <i class="fas fa-expand ml-2"></i>
                        </button>
                        ${this.isAdmin() ? `
                            <button id="ptw-map-settings-btn" class="btn-secondary text-sm px-4 py-2" title="${t('module.ptw.map.locationSettingsTitle', 'إعدادات الخريطة')}">
                                <i class="fas fa-cog ml-2"></i>
                                ${t('module.ptw.map.locationSettings', 'إعدادات المواقع')}
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div id="ptw-map-container">
                    <div id="ptw-map"></div>
                        
                        <div id="ptw-map-legend" class="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg text-sm z-[400] hidden md:block border border-gray-200 opacity-90 hover:opacity-100 transition-opacity">
                            <h4 class="font-bold mb-2 text-gray-700 border-b pb-1">${t('module.ptw.map.legend', 'مفتاح الخريطة')}</h4>
                            <div class="space-y-1">
                                <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-yellow-500"></span> <span>${t('module.ptw.map.legendOpen', 'مفتوح/قيد العمل')}</span></div>
                                <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-blue-500"></span> <span>${t('module.ptw.map.legendReview', 'قيد المراجعة')}</span></div>
                                <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-green-500"></span> <span>${t('module.ptw.map.legendApproved', 'موافق عليه/ساري')}</span></div>
                                <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-gray-500"></span> <span>${t('module.ptw.map.legendClosed', 'مغلق')}</span></div>
                                <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-500"></span> <span>${t('module.ptw.map.legendRejected', 'مرفوض/منتهي')}</span></div>
                            </div>
                        </div>

                        <div id="ptw-map-loading" class="absolute inset-0 flex items-center justify-center bg-gray-100/90 backdrop-blur-sm" style="z-index: 1000;">
                            <div class="text-center">
                                <i class="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i>
                                <p class="text-gray-600 font-medium">${t('module.ptw.map.loadingMap', 'جاري تحميل الخريطة...')}</p>
                            </div>
                        </div>
                        <div id="ptw-map-error" class="hidden absolute inset-0 flex items-center justify-center bg-gray-100" style="z-index: 1000;">
                            <div class="text-center p-6 max-w-md">
                                <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                                <p class="text-gray-700 font-semibold mb-2">${t('module.ptw.map.loadErrorTitle', 'تعذر تحميل الخريطة')}</p>
                                <div id="ptw-map-error-message" class="text-sm text-gray-500 mb-4 text-right">
                                    ${t('module.ptw.map.loadErrorHint', 'يرجى التأكد من إعدادات الإحداثيات واتصال الإنترنت')}
                                </div>
                                <div class="flex gap-2 justify-center">
                                    <button onclick="PTW.initMap()" class="btn-primary">
                                        <i class="fas fa-redo ml-2"></i>
                                        ${t('module.ptw.map.retry', 'إعادة المحاولة')}
                                    </button>
                                    <button onclick="PTW.showMapDebugInfo()" class="btn-secondary">
                                        <i class="fas fa-info-circle ml-2"></i>
                                        ${t('module.ptw.map.debug', 'تشخيص')}
                                    </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // متغيرات الخريطة
    mapInstance: null,
    mapMarkers: [],
    mapType: null, // 'google' أو 'leaflet'
    currentMapType: 'normal', // 'normal', 'satellite', 'terrain'
    leafletLayers: {
        normal: null,
        satellite: null,
        terrain: null
    },
    isMapInitializing: false,
    mapInitTimeout: null,
    isFullscreen: false,
    googleMapsApiKeyChecked: false, // Cache للتحقق من وجود مفتاح API
    hasGoogleMapsApiKey: false, // Cache لنتيجة التحقق

    /**
     * تهيئة الخريطة
     */
    async initMap() {
        // التأكد من أننا في تبويب الخريطة فقط
        if (this.currentTab !== 'map') {
            Utils.safeLog('⚠️ محاولة تهيئة الخريطة خارج تبويب الخريطة - تم تجاهل الطلب');
            return;
        }

        // التحقق من وجود حاوية الخريطة وكونها مرئية
        const mapContent = document.getElementById('ptw-map-content');
        if (!mapContent || mapContent.style.display === 'none' || mapContent.style.visibility === 'hidden') {
            Utils.safeLog('⚠️ حاوية الخريطة غير مرئية - تم تجاهل الطلب');
            return;
        }

        if (this.isMapInitializing) {
            Utils.safeLog('⚠️ جاري تهيئة الخريطة حالياً - تجاهل الطلب المكرر');
            return;
        }
        this.isMapInitializing = true;

        // الحصول على الحاوية الخارجية
        const mapContainerWrapper = document.getElementById('ptw-map-container');
        const loadingDiv = document.getElementById('ptw-map-loading');
        const errorDiv = document.getElementById('ptw-map-error');

        // الحصول على div الخريطة الفعلي
        let mapContainer = document.getElementById('ptw-map');

        // إذا لم يكن موجوداً، نحاول إنشاؤه
        if (!mapContainer) {
            if (mapContainerWrapper) {
                // ✅ التحقق من أن الحاوية موجودة في DOM قبل appendChild
                if (mapContainerWrapper.parentNode && document.body.contains(mapContainerWrapper)) {
                    try {
                        // إنشاء div الخريطة داخل الحاوية
                        mapContainer = document.createElement('div');
                        mapContainer.id = 'ptw-map';
                        mapContainer.style.cssText = 'width: 100%; height: 100%; z-index: 1; position: relative; display: block; visibility: visible;';
                        mapContainerWrapper.appendChild(mapContainer);
                        Utils.safeLog('✅ تم إنشاء div الخريطة');
                    } catch (error) {
                        Utils.safeError('❌ خطأ في appendChild لحاوية الخريطة:', error);
                        // محاولة استخدام طريقة بديلة
                        if (mapContainerWrapper) {
                            mapContainerWrapper.innerHTML = '<div id="ptw-map" style="width: 100%; height: 100%; z-index: 1; position: relative; display: block; visibility: visible;"></div>';
                            mapContainer = document.getElementById('ptw-map');
                            if (mapContainer) {
                                Utils.safeLog('✅ تم إنشاء div الخريطة باستخدام innerHTML');
                            }
                        }
                    }
                } else {
                    Utils.safeError('❌ حاوية الخريطة غير موجودة في DOM - ptw-map-container غير متصل');
                    if (errorDiv) {
                        errorDiv.classList.remove('hidden');
                        const errorMsg = errorDiv.querySelector('#ptw-map-error-message');
                        if (errorMsg) {
                            errorMsg.innerHTML = '<p>' + this._t('module.ptw.mapError.containerMissing', 'خطأ: حاوية الخريطة غير موجودة. يرجى تحديث الصفحة.') + '</p>';
                        }
                    }
                    return;
                }
            } else {
                Utils.safeError('❌ حاوية الخريطة غير موجودة - ptw-map-container غير موجود');
                if (errorDiv) {
                    errorDiv.classList.remove('hidden');
                    const errorMsg = errorDiv.querySelector('#ptw-map-error-message');
                    if (errorMsg) {
                        errorMsg.innerHTML = '<p>' + this._t('module.ptw.mapError.containerMissing', 'خطأ: حاوية الخريطة غير موجودة. يرجى تحديث الصفحة.') + '</p>';
                    }
                }
                return;
            }
        }

        if (!mapContainer) {
            Utils.safeError('❌ فشل إنشاء أو العثور على div الخريطة');
            return;
        }

        Utils.safeLog('✅ تم العثور على حاوية الخريطة:', mapContainer.id);

        // تنظيف الخريطة السابقة إن وجدت
        this.destroyMap();

        // إخفاء رسالة الخطأ
        if (errorDiv) errorDiv.classList.add('hidden');

        // إظهار التحميل
        if (loadingDiv) loadingDiv.style.display = 'flex';

        // تنظيف محتوى div الخريطة فقط (لا نمسح div نفسه)
        mapContainer.innerHTML = '';

        // التأكد من أن div الخريطة له أبعاد صحيحة
        // استخدام requestAnimationFrame لتجنب FOUC warning (Layout was forced before page fully loaded)
        // الانتظار حتى تحميل CSS قبل استخدام getComputedStyle
        if (document.readyState === 'complete') {
            // إذا كانت الصفحة محملة، استخدام requestAnimationFrame للانتظار frame واحد
            requestAnimationFrame(() => {
                const containerStyle = window.getComputedStyle(mapContainer);
                if (containerStyle.width === '0px' || containerStyle.height === '0px' ||
                    containerStyle.width === 'auto' || containerStyle.height === 'auto') {
                    mapContainer.style.width = '100%';
                    mapContainer.style.height = '100%';
                    mapContainer.style.minHeight = '400px';
                }
            });
        } else {
            // إذا لم تكن الصفحة محملة بعد، تعيين الأبعاد مباشرة بدون getComputedStyle
            // لتجنب FOUC warning
            mapContainer.style.width = '100%';
            mapContainer.style.height = '100%';
            mapContainer.style.minHeight = '400px';
        }

        mapContainer.style.display = 'block';
        mapContainer.style.visibility = 'visible';
        mapContainer.style.opacity = '1';

        Utils.safeLog('✅ حاوية الخريطة جاهزة:', mapContainer.id);

        try {
            // الحصول على الإحداثيات الافتراضية للمصنع
            const defaultCoords = this.getDefaultFactoryCoordinates();

            // محاولة استخدام Google Maps أولاً
            let useGoogleMaps = false;
            try {
                // التحقق من وجود مفتاح API أولاً (مع cache)
                if (!this.googleMapsApiKeyChecked) {
                    const apiKey = AppState.googleConfig?.maps?.apiKey;
                    this.hasGoogleMapsApiKey = !!(apiKey && apiKey.trim() !== '');
                    this.googleMapsApiKeyChecked = true;
                }

                // إذا كان هناك مفتاح API، نحاول تحميل Google Maps
                if (this.hasGoogleMapsApiKey) {
                if (typeof google === 'undefined' || !google.maps) {
                    await this.loadGoogleMapsAPI();
                }

                if (typeof google !== 'undefined' && google.maps) {
                    useGoogleMaps = true;
                    }
                } else {
                    // لا يوجد مفتاح API - استخدام OpenStreetMap مباشرة بدون تحذير
                    Utils.safeLog('ℹ️ استخدام OpenStreetMap (مفتاح Google Maps API غير محدد)');
                }
            } catch (googleError) {
                // فقط عرض تحذير إذا كان هناك مفتاح API لكن فشل التحميل
                if (this.hasGoogleMapsApiKey) {
                Utils.safeWarn('⚠️ فشل تحميل Google Maps، سيتم استخدام OpenStreetMap:', googleError);
                }
                useGoogleMaps = false;
            }

            if (useGoogleMaps) {
                // استخدام Google Maps
                this.mapInstance = new google.maps.Map(mapContainer, {
                    center: { lat: defaultCoords.lat, lng: defaultCoords.lng },
                    zoom: defaultCoords.zoom || 15,
                    mapTypeId: google.maps.MapTypeId.ROADMAP,
                    mapTypeControl: true,
                    mapTypeControlOptions: {
                        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                        position: google.maps.ControlPosition.TOP_RIGHT,
                        mapTypeIds: [
                            google.maps.MapTypeId.ROADMAP,
                            google.maps.MapTypeId.SATELLITE,
                            google.maps.MapTypeId.HYBRID,
                            google.maps.MapTypeId.TERRAIN
                        ]
                    },
                    streetViewControl: true,
                    fullscreenControl: true,
                    zoomControl: true,
                    scaleControl: true,
                    rotateControl: true
                });
                this.mapType = 'google';
                this.currentMapType = 'normal';
            } else {
                // استخدام Leaflet/OpenStreetMap كبديل
                try {
                    await this.initLeafletMap(mapContainer, defaultCoords);
                    this.mapType = 'leaflet';
                    Utils.safeLog('✅ تم تحميل Leaflet بنجاح');
                } catch (leafletError) {
                    Utils.safeError('❌ فشل تحميل Leaflet:', leafletError);
                    throw new Error(`فشل تحميل الخريطة: ${leafletError.message || 'يرجى التحقق من الاتصال بالإنترنت'}`);
                }
            }

            // التحقق من أن الخريطة تم تهيئتها بنجاح
            if (!this.mapInstance) {
                throw new Error('فشل تهيئة الخريطة - mapInstance غير موجود');
            }

            Utils.safeLog('✅ الخريطة تم تهيئتها بنجاح، نوع الخريطة:', this.mapType);
            Utils.safeLog('✅ mapInstance:', this.mapInstance);
            Utils.safeLog('✅ mapContainer:', mapContainer);
            Utils.safeLog('✅ mapContainer parent:', mapContainer ? mapContainer.parentElement : 'غير موجود');

            // التحقق من أن الحاوية مرئية
            // استخدام requestAnimationFrame لتجنب FOUC warning (هذا بعد تهيئة الخريطة، لذا الصفحة محملة عادة)
            if (mapContainer) {
                if (document.readyState === 'complete') {
                    requestAnimationFrame(() => {
                        const containerRect = mapContainer.getBoundingClientRect();
                        Utils.safeLog('📐 أبعاد الحاوية (getBoundingClientRect):', containerRect.width, 'x', containerRect.height);
                        Utils.safeLog('📐 موقع الحاوية:', containerRect.left, containerRect.top);
                        Utils.safeLog('📐 الحاوية مرئية:', containerRect.width > 0 && containerRect.height > 0 ? 'نعم' : 'لا');

                        if (containerRect.width === 0 || containerRect.height === 0) {
                            Utils.safeWarn('⚠️ تحذير: الحاوية بدون أبعاد - سيتم تعيين أبعاد صريحة');
                            mapContainer.style.width = '100%';
                            mapContainer.style.height = '600px';
                            mapContainer.style.minHeight = '400px';
                        }
                    });
                } else {
                    // تعيين الأبعاد مباشرة إذا لم تكن الصفحة محملة (حالة نادرة)
                    mapContainer.style.width = '100%';
                    mapContainer.style.height = '600px';
                    mapContainer.style.minHeight = '400px';
                }
            }

            // إخفاء التحميل
            if (loadingDiv) loadingDiv.style.display = 'none';

            // إعطاء الخريطة وقت للعرض
            await new Promise(resolve => setTimeout(resolve, 500));

            // التحقق من أن الخريطة مرئية وإعادة حساب الحجم
            if (this.mapType === 'leaflet' && this.mapInstance) {
                try {
                    // إجبار الخريطة على إعادة الحساب عدة مرات للتأكد
                    this.mapInstance.invalidateSize();
                    Utils.safeLog('✅ تم تحديث حجم الخريطة (المحاولة الأولى)');

                    setTimeout(() => {
                        if (this.mapInstance) {
                            this.mapInstance.invalidateSize();
                            Utils.safeLog('✅ تم تحديث حجم الخريطة (المحاولة الثانية - 200ms)');
                        }
                    }, 200);

                    setTimeout(() => {
                        if (this.mapInstance && mapContainer) {
                            this.mapInstance.invalidateSize();
                            Utils.safeLog('✅ تم تحديث حجم الخريطة (المحاولة الثالثة - 500ms)');

                            // التحقق النهائي من أن الخريطة مرئية
                            const finalRect = mapContainer.getBoundingClientRect();
                            Utils.safeLog('📐 الأبعاد النهائية:', finalRect.width, 'x', finalRect.height);

                            // التحقق من حاوية Leaflet أيضاً
                            const leafletContainer = this.mapInstance.getContainer();
                            if (leafletContainer) {
                                const leafletRect = leafletContainer.getBoundingClientRect();
                                Utils.safeLog('📐 أبعاد حاوية Leaflet:', leafletRect.width, 'x', leafletRect.height);
                            }

                            if (finalRect.width === 0 || finalRect.height === 0) {
                                Utils.safeWarn('⚠️ تحذير: الحاوية لا تزال بدون أبعاد بعد التهيئة');
                                // محاولة إصلاح
                                mapContainer.style.width = '100%';
                                mapContainer.style.height = '600px';
                                this.mapInstance.invalidateSize();
                            } else {
                                Utils.safeLog('✅ الخريطة يجب أن تكون مرئية الآن');
                            }
                        }
                    }, 500);
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ في تحديث حجم الخريطة:', e);
                }
            }

            // التحقق النهائي من أن الخريطة مرئية
            if (this.mapInstance && this.mapType === 'leaflet') {
                // محاولة الحصول على الحاوية مع إعادة المحاولة
                const getContainerWithRetry = (retries = 3, delay = 100) => {
                    return new Promise((resolve) => {
                        const tryGetContainer = (attempt) => {
                            try {
                                if (this.mapInstance && this.mapInstance.getContainer) {
                                    const container = this.mapInstance.getContainer();
                                    if (container) {
                                        resolve(container);
                                        return;
                                    }
                                }
                                
                                if (attempt < retries) {
                                    setTimeout(() => tryGetContainer(attempt + 1), delay);
                                } else {
                                    resolve(null);
                                }
                            } catch (e) {
                                if (attempt < retries) {
                                    setTimeout(() => tryGetContainer(attempt + 1), delay);
                                } else {
                                    resolve(null);
                                }
                            }
                        };
                        tryGetContainer(0);
                    });
                };
                
                // محاولة الحصول على الحاوية
                getContainerWithRetry().then((finalCheck) => {
                    if (finalCheck) {
                        try {
                            const finalRect = finalCheck.getBoundingClientRect();
                            Utils.safeLog('📐 التحقق النهائي - أبعاد حاوية Leaflet:', finalRect.width, 'x', finalRect.height);

                            if (finalRect.width > 0 && finalRect.height > 0) {
                                Utils.safeLog('✅ الخريطة مرئية وجاهزة');
                            } else {
                                Utils.safeWarn('⚠️ تحذير: حاوية Leaflet بدون أبعاد - قد تكون مخفية');
                                // محاولة إصلاح
                                if (mapContainer) {
                                    mapContainer.style.width = '100%';
                                    mapContainer.style.height = '600px';
                                    setTimeout(() => {
                                        if (this.mapInstance && this.mapInstance.invalidateSize) {
                                            this.mapInstance.invalidateSize();
                                        }
                                    }, 100);
                                }
                            }
                        } catch (checkError) {
                            Utils.safeWarn('⚠️ خطأ في التحقق النهائي:', checkError);
                        }
                    } else {
                        // الحاوية غير متاحة بعد - قد تكون الخريطة لم تكتمل بعد
                        // هذا طبيعي في بعض الحالات، لذا سنحاول مرة أخرى بعد تأخير
                        setTimeout(() => {
                            if (this.mapInstance && this.mapInstance.getContainer) {
                                try {
                                    const retryContainer = this.mapInstance.getContainer();
                                    if (retryContainer) {
                                        Utils.safeLog('✅ تم الحصول على حاوية Leaflet بعد إعادة المحاولة');
                                    }
                                } catch (e) {
                                    // تجاهل الخطأ بصمت - قد تكون الخريطة لم تكتمل بعد
                                }
                            }
                        }, 500);
                    }
                });
            } else if (this.mapInstance && this.mapType === 'google') {
                // للخرائط Google Maps، التحقق مختلف
                try {
                    if (this.mapInstance.getDiv) {
                        const googleDiv = this.mapInstance.getDiv();
                        if (googleDiv) {
                            const googleRect = googleDiv.getBoundingClientRect();
                            Utils.safeLog('📐 التحقق النهائي - أبعاد حاوية Google Maps:', googleRect.width, 'x', googleRect.height);
                        }
                    }
                } catch (checkError) {
                    Utils.safeWarn('⚠️ خطأ في التحقق من Google Maps:', checkError);
                }
            }

            // تحديث العلامات (مع معالجة الأخطاء والتأخير للتأكد من جاهزية الخريطة)
            setTimeout(() => {
                try {
                    // التأكد من أن الخريطة جاهزة تماماً
                    if (this.mapInstance && this.mapType === 'leaflet') {
                        const container = this.mapInstance.getContainer();
                        if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
                            // إجبار الخريطة على إعادة الحساب
                            this.mapInstance.invalidateSize();
                        }
                    }
                this.updateMapMarkers();
            } catch (markerError) {
                Utils.safeWarn('⚠️ خطأ في تحديث العلامات (سيتم تجاهله):', markerError);
                // لا نرمي الخطأ هنا لأن الخريطة نفسها تعمل
            }
            }, 800);

            // إعداد مستمعي التحديثات (مع معالجة الأخطاء)
            try {
                this.setupMapEventListeners();
                // إعداد أحداث الفلاتر والإعدادات
                setTimeout(() => {
                    this.initMapFilters();
                }, 500);
                
                // إضافة مستمعي أحداث ملء الشاشة
                document.addEventListener('fullscreenchange', () => {
                    this.isFullscreen = !!document.fullscreenElement;
                    const fullscreenBtn = document.getElementById('ptw-map-fullscreen-btn');
                    if (fullscreenBtn) {
                        if (this.isFullscreen) {
                            fullscreenBtn.innerHTML = '<i class="fas fa-compress ml-2"></i>';
                            fullscreenBtn.title = 'الخروج من ملء الشاشة';
                        } else {
                            fullscreenBtn.innerHTML = '<i class="fas fa-expand ml-2"></i>';
                            fullscreenBtn.title = 'ملء الشاشة';
                        }
                    }
                    // تحديث حجم الخريطة
                    setTimeout(() => {
                        if (this.mapInstance) {
                            if (this.mapType === 'leaflet' && this.mapInstance.invalidateSize) {
                                this.mapInstance.invalidateSize();
                            } else if (this.mapType === 'google' && typeof google !== 'undefined' && google.maps && google.maps.event) {
                                google.maps.event.trigger(this.mapInstance, 'resize');
                            }
                        }
                    }, 300);
                });
            } catch (listenerError) {
                Utils.safeWarn('⚠️ خطأ في إعداد مستمعي التحديثات (سيتم تجاهله):', listenerError);
                // لا نرمي الخطأ هنا لأن الخريطة نفسها تعمل
            }

            Utils.safeLog('✅ تم تهيئة الخريطة بنجاح - الخريطة جاهزة للاستخدام');

            // إجبار إعادة رسم الخريطة بعد ثانية إضافية
            setTimeout(() => {
                if (this.mapInstance && this.mapType === 'leaflet') {
                    try {
                        // التحقق من حاوية الخريطة الخارجية أولاً
                        const mapContent = document.getElementById('ptw-map-content');
                        const mapContainerWrapper = document.getElementById('ptw-map-container');
                        const mapDiv = document.getElementById('ptw-map');
                        
                        if (mapContent && mapContainerWrapper && mapDiv) {
                            // إجبار الأبعاد على الحاويات
                            if (mapContent.style.display === 'none' || mapContent.style.visibility === 'hidden') {
                                mapContent.style.display = 'flex';
                                mapContent.style.visibility = 'visible';
                                mapContent.style.height = 'calc(100vh - 280px)';
                                mapContent.style.minHeight = '600px';
                            }
                            
                            if (mapContainerWrapper.style.height === '0px' || !mapContainerWrapper.style.height) {
                                mapContainerWrapper.style.height = '100%';
                                mapContainerWrapper.style.minHeight = '600px';
                            }
                            
                            if (mapDiv.style.height === '0px' || !mapDiv.style.height) {
                                mapDiv.style.height = '100%';
                                mapDiv.style.width = '100%';
                            }
                        }
                        
                        this.mapInstance.invalidateSize();
                        Utils.safeLog('✅ تم إعادة رسم الخريطة (2000ms)');

                        // التحقق النهائي
                        const leafletContainer = this.mapInstance.getContainer();
                        if (leafletContainer) {
                            const leafletRect = leafletContainer.getBoundingClientRect();
                            Utils.safeLog('📐 التحقق النهائي (2000ms) - أبعاد:', leafletRect.width, 'x', leafletRect.height);

                            if (leafletRect.width > 0 && leafletRect.height > 0) {
                                Utils.safeLog('✅ الخريطة مرئية ومتاحة للاستخدام');
                            } else {
                                Utils.safeWarn('⚠️ الخريطة لا تزال غير مرئية بعد 2 ثانية - محاولة إصلاح إضافية');
                                // محاولة إصلاح إضافية
                                setTimeout(() => {
                                    if (this.mapInstance && this.mapInstance.invalidateSize) {
                                        // إجبار الأبعاد مرة أخرى
                                        if (mapContainerWrapper) {
                                            mapContainerWrapper.style.height = '600px';
                                            mapContainerWrapper.style.minHeight = '600px';
                                        }
                                        if (mapDiv) {
                                            mapDiv.style.height = '600px';
                                            mapDiv.style.width = '100%';
                                        }
                                        this.mapInstance.invalidateSize();
                                        Utils.safeLog('✅ تم محاولة إصلاح الخريطة (3000ms)');
                                    }
                                }, 1000);
                            }
                        }
                    } catch (e) {
                        Utils.safeWarn('⚠️ خطأ في إعادة رسم الخريطة:', e);
                    }
                }
            }, 2000);
        } catch (error) {
            Utils.safeWarn('⚠️ تهيئة الخريطة فشلت (الرسالة معروضة للمستخدم):', error?.message || error);
            if (loadingDiv) loadingDiv.style.display = 'none';
            if (errorDiv) {
                errorDiv.classList.remove('hidden');
                const errorMsg = errorDiv.querySelector('#ptw-map-error-message');
                if (errorMsg) {
                    let errorText = error.message || 'تعذر تحميل الخريطة. يرجى التحقق من الاتصال بالإنترنت.';
                    // تحسين رسالة الخطأ
                    if (errorText.includes('Leaflet') || errorText.includes('leaflet')) {
                        errorText = 'تعذر تحميل مكتبة الخريطة. يرجى التحقق من: 1) الاتصال بالإنترنت 2) إعدادات CSP 3) تحديث الصفحة';
                    } else if (errorText.includes('Google Maps')) {
                        errorText = 'تعذر تحميل Google Maps. سيتم استخدام خريطة بديلة.';
                    } else if (errorText.includes('CSP') || errorText.includes('Content-Security-Policy')) {
                        errorText = 'تم حظر تحميل الخريطة بواسطة إعدادات الأمان. يرجى التحقق من إعدادات CSP.';
                    }
                    errorMsg.innerHTML = `
                        <p class="mb-2"><strong>خطأ:</strong> ${errorText}</p>
                        <p class="text-sm text-gray-600 mb-3">تفاصيل الخطأ: ${error.message || 'غير معروف'}</p>
                        <div class="text-sm text-gray-500">
                            <p class="mb-1">💡 نصائح:</p>
                            <ul class="list-disc list-inside space-y-1">
                                <li>تأكد من الاتصال بالإنترنت</li>
                                <li>تحقق من إعدادات Content Security Policy</li>
                                <li>جرب تحديث الصفحة (F5)</li>
                                <li>تحقق من كونسول المتصفح للمزيد من التفاصيل</li>
                            </ul>
                        </div>
                    `;
                }
            }

            // محاولة عرض خريطة بديلة
            try {
                const defaultCoords = this.getDefaultFactoryCoordinates();
                // استخدام mapContainer إذا كان موجوداً، وإلا نستخدم mapContainerWrapper
                const fallbackContainer = mapContainer || document.getElementById('ptw-map-container');
                if (fallbackContainer) {
                    this.showFallbackMap(fallbackContainer, defaultCoords);
                }
            } catch (fallbackError) {
                Utils.safeWarn('⚠️ فشل عرض الخريطة البديلة:', fallbackError);
            }
        } finally {
            this.isMapInitializing = false;
        }
    },

    /**
     * عرض خريطة بديلة باستخدام رابط خارجي
     */
    showFallbackMap(container, coords) {
        try {
            Utils.safeLog('🔄 محاولة عرض خريطة بديلة...');
            const lat = coords.lat;
            const lng = coords.lng;
            const zoom = coords.zoom || 15;

            // استخدام رابط OpenStreetMap كبديل
            if (container) {
                container.innerHTML = `
                    <div style="width: 100%; height: 100%; position: relative; background: #f3f4f6; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center; padding: 20px;">
                            <i class="fas fa-map-marked-alt text-4xl text-gray-400 mb-4"></i>
                            <p class="text-gray-600 mb-2">تعذر تحميل الخريطة التفاعلية</p>
                            <p class="text-sm text-gray-500 mb-4">الإحداثيات: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                            <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=${zoom}" 
                               target="_blank" 
                               class="btn-primary inline-block"
                               style="text-decoration: none;">
                                <i class="fas fa-external-link-alt ml-2"></i>
                                فتح الخريطة في نافذة جديدة
                            </a>
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            Utils.safeWarn('⚠️ فشل عرض الخريطة البديلة:', e);
        }
    },

    /**
     * تدمير الخريطة الحالية
     */
    destroyMap() {
        try {
            // تنظيف event listeners
            if (this.mapUpdateHandler) {
                document.removeEventListener('ptw:updated', this.mapUpdateHandler);
                this.mapUpdateHandler = null;
            }
            if (this.mapStateUpdateHandler) {
                window.removeEventListener('appstate:updated', this.mapStateUpdateHandler);
                this.mapStateUpdateHandler = null;
            }

            // حذف العلامات
            if (this.mapMarkers && this.mapMarkers.length > 0) {
                this.mapMarkers.forEach(marker => {
                    try {
                        if (this.mapType === 'google' && marker.setMap) {
                            marker.setMap(null);
                            if (marker.infoWindow) {
                                marker.infoWindow.close();
                            }
                        } else if (this.mapType === 'leaflet' && this.mapInstance) {
                            this.mapInstance.removeLayer(marker);
                        }
                    } catch (e) {
                        // تجاهل الأخطاء في الحذف
                    }
                });
                this.mapMarkers = [];
            }

            // تدمير الخريطة
            if (this.mapInstance) {
                if (this.mapType === 'leaflet' && typeof L !== 'undefined') {
                    this.mapInstance.remove();
                }
                this.mapInstance = null;
            }

            this.mapType = null;
            this.currentMapType = 'normal';
            // إخلاء مراجع الطبقات لتجنب تسريبات الذاكرة
            if (this.leafletLayers) {
                this.leafletLayers.normal = null;
                this.leafletLayers.satellite = null;
                this.leafletLayers.terrain = null;
            }
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تدمير الخريطة:', error);
        }
    },

    /**
     * تحميل Google Maps API
     */
    loadGoogleMapsAPI() {
        return new Promise((resolve, reject) => {
            // التحقق إذا كان API محملاً بالفعل
            if (typeof google !== 'undefined' && google.maps) {
                resolve();
                return;
            }

            // التحقق من وجود مفتاح API (مع cache)
            if (!this.googleMapsApiKeyChecked) {
                const apiKey = AppState.googleConfig?.maps?.apiKey;
                this.hasGoogleMapsApiKey = !!(apiKey && apiKey.trim() !== '');
                this.googleMapsApiKeyChecked = true;
            }

            // إذا لم يكن هناك مفتاح API، نرفض مباشرة بدون تحذير (لأنه متوقع)
            if (!this.hasGoogleMapsApiKey) {
                reject(new Error('مفتاح Google Maps API غير محدد'));
                return;
            }

            // التحقق إذا كان هناك script موجود بالفعل
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
            if (existingScript) {
                // الانتظار حتى يتم التحميل
                let attempts = 0;
                const maxAttempts = 100; // 10 ثواني
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (typeof google !== 'undefined' && google.maps) {
                        clearInterval(checkInterval);
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        reject(new Error('انتهت مهلة تحميل Google Maps API'));
                    }
                }, 100);
                return;
            }

            // إنشاء script جديد
            // ملاحظة: يجب استبدال مفتاح API بمفتاح صالح من Google Cloud Console
            // للحصول على مفتاح: https://console.cloud.google.com/google/maps-apis
            const apiKey = AppState.googleConfig?.maps?.apiKey;

            // إنشاء callback فريد
            const callbackName = 'PTW_GoogleMapsCallback_' + Date.now();
            let timeoutId = null;
            let resolved = false;

            window[callbackName] = () => {
                if (resolved) return;
                resolved = true;
                if (timeoutId) clearTimeout(timeoutId);
                delete window[callbackName];
                setTimeout(() => {
                    if (typeof google !== 'undefined' && google.maps) {
                        resolve();
                    } else {
                        reject(new Error('فشل تحميل Google Maps API'));
                    }
                }, 500);
            };

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=ar&region=SA&callback=${callbackName}`;
            script.async = true;
            script.defer = true;

            script.onerror = () => {
                if (resolved) return;
                resolved = true;
                if (timeoutId) clearTimeout(timeoutId);
                delete window[callbackName];
                reject(new Error('خطأ في تحميل Google Maps API - قد يكون المفتاح غير صالح أو هناك مشكلة في الاتصال'));
            };

            // timeout بعد 8 ثواني
            timeoutId = setTimeout(() => {
                if (resolved) return;
                resolved = true;
                if (typeof google === 'undefined' || !google.maps) {
                    delete window[callbackName];
                    reject(new Error('انتهت مهلة تحميل Google Maps API'));
                }
            }, 8000);

            document.head.appendChild(script);
        });
    },

    /**
     * تهيئة خريطة Leaflet (بديل مجاني)
     */
    async initLeafletMap(container, defaultCoords) {
        // التأكد من أن الحاوية فارغة
        if (container.hasChildNodes()) {
            container.innerHTML = '';
        }

        // تحميل Leaflet CSS و JS من cdnjs.cloudflare.com (متوافق مع CSP)
        if (!document.querySelector('link[href*="leaflet"]')) {
            const leafletCSS = document.createElement('link');
            leafletCSS.rel = 'stylesheet';
            leafletCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
            leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            leafletCSS.crossOrigin = 'anonymous';
            document.head.appendChild(leafletCSS);
            if (!document.querySelector('link[href*="leaflet-overrides"]')) {
                const leafletOverrides = document.createElement('link');
                leafletOverrides.rel = 'stylesheet';
                leafletOverrides.href = 'css/leaflet-overrides.css';
                document.head.appendChild(leafletOverrides);
            }
        }

        if (typeof L === 'undefined') {
            Utils.safeLog('🔄 بدء تحميل Leaflet...');
            await new Promise((resolve, reject) => {
                if (typeof L !== 'undefined') {
                    Utils.safeLog('✅ Leaflet محمّل بالفعل');
                    resolve();
                    return;
                }

                const existingScript = document.querySelector('script[src*="leaflet"]');
                if (existingScript) {
                    Utils.safeLog('⏳ انتظار تحميل Leaflet من script موجود...');
                    let attempts = 0;
                    const maxAttempts = 100; // 10 ثواني
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (typeof L !== 'undefined') {
                            clearInterval(checkInterval);
                            Utils.safeLog('✅ تم تحميل Leaflet بنجاح');
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            clearInterval(checkInterval);
                            Utils.safeError('❌ انتهت مهلة تحميل Leaflet');
                            reject(new Error('انتهت مهلة تحميل Leaflet - يرجى التحقق من الاتصال بالإنترنت'));
                        }
                    }, 100);
                    return;
                }

                Utils.safeLog('📥 تحميل Leaflet من cdnjs.cloudflare.com...');
                const leafletJS = document.createElement('script');
                leafletJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
                leafletJS.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
                leafletJS.crossOrigin = 'anonymous';

                let timeoutId = null;
                let resolved = false;

                leafletJS.onload = () => {
                    if (resolved) return;
                    resolved = true;
                    if (timeoutId) clearTimeout(timeoutId);
                    Utils.safeLog('📦 تم تحميل ملف Leaflet، جاري التحقق...');
                    setTimeout(() => {
                        if (typeof L !== 'undefined') {
                            Utils.safeLog('✅ تم تحميل Leaflet بنجاح');
                            resolve();
                        } else {
                            Utils.safeError('❌ Leaflet غير متاح بعد التحميل');
                            reject(new Error('فشل تحميل Leaflet - المكتبة غير متاحة'));
                        }
                    }, 500);
                };

                leafletJS.onerror = (error) => {
                    if (resolved) return;
                    resolved = true;
                    if (timeoutId) clearTimeout(timeoutId);
                    Utils.safeError('❌ خطأ في تحميل ملف Leaflet:', error);
                    reject(new Error('خطأ في تحميل Leaflet - يرجى التحقق من الاتصال بالإنترنت أو CSP settings'));
                };

                // timeout بعد 15 ثانية
                timeoutId = setTimeout(() => {
                    if (resolved) return;
                    resolved = true;
                    if (typeof L === 'undefined') {
                        Utils.safeError('❌ انتهت مهلة تحميل Leaflet');
                        reject(new Error('انتهت مهلة تحميل Leaflet - يرجى التحقق من الاتصال بالإنترنت'));
                    }
                }, 15000);

                document.head.appendChild(leafletJS);
                Utils.safeLog('📝 تم إضافة script Leaflet إلى الصفحة');
            });
        } else {
            Utils.safeLog('✅ Leaflet محمّل بالفعل');
        }

        // التحقق من أن Leaflet محمّل
        if (typeof L === 'undefined') {
            throw new Error('Leaflet غير محمّل - يرجى التحقق من الاتصال بالإنترنت');
        }

        // تنظيف الخريطة السابقة بشكل صحيح
        if (this.mapInstance && this.mapType === 'leaflet') {
            try {
                this.mapInstance.remove();
                this.mapInstance = null;
            } catch (e) {
                Utils.safeWarn('⚠️ خطأ في إزالة instance الخريطة السابق:', e);
            }
        }

        // تنظيف الحاوية إذا كانت مرتبطة بخريطة سابقة (Leaflet internal id)
        if (container._leaflet_id) {
            Utils.safeWarn('⚠️ الحاوية تحتوي على معرف Leaflet سابق - سيتم تنظيفه');
            container._leaflet_id = null; // إجبار Leaflet على نسيان الخريطة السابقة
            container.innerHTML = ''; // تنظيف المحتوى بالكامل
        }

        try {
            // التحقق من أن الحاوية موجودة ومرئية
            if (!container || !container.parentElement) {
                throw new Error('حاوية الخريطة غير موجودة');
            }

            // إصلاح شامل لجميع الحاويات الأم قبل التهيئة
            const mapContent = document.getElementById('ptw-map-content');
            const mapContainerWrapper = document.getElementById('ptw-map-container');
            
            // إصلاح حاوية المحتوى الرئيسية
            if (mapContent) {
                const contentStyle = window.getComputedStyle(mapContent);
                if (contentStyle.display === 'none' || contentStyle.visibility === 'hidden') {
                    mapContent.style.display = 'flex';
                    mapContent.style.visibility = 'visible';
                }
                if (!mapContent.style.height || mapContent.style.height === '0px') {
                    mapContent.style.height = 'calc(100vh - 280px)';
                    mapContent.style.minHeight = '600px';
                }
            }
            
            // إصلاح حاوية الخريطة الخارجية
            if (mapContainerWrapper) {
                const wrapperStyle = window.getComputedStyle(mapContainerWrapper);
                if (wrapperStyle.display === 'none') {
                    mapContainerWrapper.style.display = 'block';
                }
                if (!mapContainerWrapper.style.height || wrapperStyle.height === '0px') {
                    mapContainerWrapper.style.height = '100%';
                    mapContainerWrapper.style.minHeight = '600px';
                }
            }

            // التأكد من أن الحاوية مرئية
            const containerParent = container.parentElement;
            // استخدام requestAnimationFrame لتجنب FOUC warning
            if (document.readyState === 'complete') {
                requestAnimationFrame(() => {
                    if (containerParent) {
                        const parentStyle = window.getComputedStyle(containerParent);
                        if (parentStyle.display === 'none') {
                            Utils.safeWarn('⚠️ حاوية الخريطة مخفية، سيتم إظهارها');
                            containerParent.style.display = 'block';
                        }
                    }
                    
                    const containerStyle = window.getComputedStyle(container);
                    const containerWidth = containerStyle.width;
                    const containerHeight = containerStyle.height;

                    Utils.safeLog('📐 أبعاد الحاوية:', containerWidth, 'x', containerHeight);

                    if (containerWidth === '0px' || containerHeight === '0px' || containerWidth === 'auto' || containerHeight === 'auto') {
                        Utils.safeWarn('⚠️ حاوية الخريطة بدون أبعاد واضحة، سيتم تعيين أبعاد افتراضية');
                        container.style.width = '100%';
                    }
                });
            } else {
                // إذا لم تكن الصفحة محملة، تعيين الأبعاد مباشرة
                if (containerParent) {
                    containerParent.style.display = 'block';
                }
                container.style.width = '100%';
                container.style.height = '600px';
                container.style.minHeight = '400px';
                container.style.display = 'block';
            }

            // التأكد من أن الحاوية مرئية
            container.style.visibility = 'visible';
            container.style.opacity = '1';

            // تهيئة الخريطة
            Utils.safeLog('🗺️ تهيئة خريطة Leaflet...');
            Utils.safeLog('📍 الإحداثيات:', defaultCoords.lat, defaultCoords.lng, 'التكبير:', defaultCoords.zoom);
            Utils.safeLog('📦 حالة Leaflet:', typeof L !== 'undefined' ? 'محمل' : 'غير محمل');
            Utils.safeLog('📦 L.map موجود:', typeof L !== 'undefined' && typeof L.map === 'function' ? 'نعم' : 'لا');

            // التحقق النهائي من Leaflet
            if (typeof L === 'undefined' || typeof L.map !== 'function') {
                throw new Error('Leaflet غير محمل بشكل صحيح - L.map غير متاح');
            }

            // التأكد من أن الحاوية فارغة قبل التهيئة
            if (container.innerHTML && container.innerHTML.trim() !== '') {
                Utils.safeLog('🧹 تنظيف محتوى الحاوية قبل التهيئة');
                container.innerHTML = '';
            }

            // التأكد من أن الحاوية لها أبعاد قبل التهيئة
            // استخدام requestAnimationFrame لتجنب FOUC warning
            if (document.readyState === 'complete') {
                requestAnimationFrame(() => {
                    const rectBefore = container.getBoundingClientRect();
                    if (rectBefore.width === 0 || rectBefore.height === 0) {
                        Utils.safeWarn('⚠️ الحاوية بدون أبعاد قبل التهيئة، سيتم تعيين أبعاد');
                        container.style.width = '100%';
                        container.style.height = '600px';
                        container.style.minHeight = '400px';
                    }
                });
            } else {
                // تعيين الأبعاد مباشرة إذا لم تكن الصفحة محملة
                container.style.width = '100%';
                container.style.height = '600px';
                container.style.minHeight = '400px';
            }

            Utils.safeLog('🔄 إنشاء instance الخريطة...');

            // التأكد من أن الحاوية فارغة تماماً
            if (container.innerHTML && container.innerHTML.trim() !== '') {
                container.innerHTML = '';
            }

            // التأكد من أن الحاوية لها أبعاد
            // التأكد من أن الحاوية لها أبعاد (بعد التأكد من تحميل الصفحة)
            if (document.readyState === 'complete') {
                requestAnimationFrame(() => {
                    const rect = container.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) {
                        Utils.safeWarn('⚠️ الحاوية بدون أبعاد قبل التهيئة، سيتم تعيين أبعاد');
                        container.style.width = '100%';
                        container.style.height = '600px';
                    }
                });
            } else {
                // تعيين الأبعاد مباشرة إذا لم تكن الصفحة محملة
                container.style.width = '100%';
                container.style.height = '600px';
            }

            this.mapInstance = L.map(container, {
                preferCanvas: false,
                zoomControl: false // سنضيفه لاحقاً
            }).setView([defaultCoords.lat, defaultCoords.lng], defaultCoords.zoom || 15);

            Utils.safeLog('✅ تم إنشاء instance الخريطة');
            Utils.safeLog('✅ mapInstance موجود:', this.mapInstance ? 'نعم' : 'لا');
            Utils.safeLog('✅ container._leaflet_id:', container._leaflet_id);

            // التحقق من أن الخريطة تم إنشاؤها
            if (!this.mapInstance) {
                throw new Error('فشل إنشاء instance الخريطة');
            }

            // التحقق من أن Leaflet أضاف العناصر إلى الحاوية
            // ملاحظة: تم إزالة التحذير لأنه غير ضروري - الخريطة تعمل بشكل صحيح حتى لو كانت الحاوية متطابقة
            const leafletContainer = this.mapInstance.getContainer();
            // لا حاجة لعرض تحذير - الخريطة تعمل بشكل صحيح

            Utils.safeLog('✅ تم تهيئة الخريطة، جاري إضافة طبقة الخرائط...');

            // إضافة طبقات مختلفة للخريطة
            // طبقة الخريطة العادية (OpenStreetMap)
            this.leafletLayers.normal = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
                subdomains: ['a', 'b', 'c'],
                errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                tileSize: 256,
                zoomOffset: 0,
                crossOrigin: true,
                keepBuffer: 2,
                updateWhenIdle: false,
                updateWhenZooming: true
            });

            // إضافة معالجة للأخطاء للطبقة العادية
            this.leafletLayers.normal.on('tileerror', (error, tile) => {
                Utils.safeWarn('⚠️ خطأ في تحميل tile للخريطة العادية:', error);
            });

            // طبقة الخريطة الفضائية (Satellite) - حل نهائي مع مصادر احتياطية متعددة
            // استخدام نظام fallback متعدد المستويات للتعامل مع أخطاء 503
            const self = this; // للاستخدام داخل معالج الأخطاء (سياق الاستدعاء من Leaflet يختلف)
            const isOnline = typeof navigator !== 'undefined' && navigator.onLine !== false;
            
            // قائمة مصادر الخريطة الفضائية: Carto فقط — استقرار كامل وتجنب 503 من ArcGIS
            // ✅ تم إزالة Esri World_Imagery (arcgisonline.com) لأنه يعيد 503 (Service Unavailable) باستمرار
            const satelliteSources = [
                {
                    name: 'carto-voyager',
                    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | © <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: ['a', 'b', 'c', 'd']
                },
                {
                    name: 'carto-positron',
                    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | © <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: ['a', 'b', 'c', 'd']
                },
                {
                    name: 'carto-dark',
                    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | © <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: ['a', 'b', 'c', 'd']
                }
            ];

            // متغيرات تتبع حالة المصادر
            let currentSatelliteSourceIndex = 0;
            let satelliteSourceErrors = new Map(); // تتبع الأخطاء لكل مصدر
            let satelliteSourceSuccessCount = new Map(); // تتبع النجاح لكل مصدر
            
            // دالة لإنشاء طبقة فضائية من مصدر معين
            const createSatelliteLayer = (sourceIndex) => {
                if (sourceIndex >= satelliteSources.length) {
                    // إذا فشلت جميع المصادر، نعود إلى المصدر الأول
                    sourceIndex = 0;
                }
                
                const source = satelliteSources[sourceIndex];
                const layerOptions = {
                    attribution: source.attribution,
                maxZoom: 19,
                errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                tileSize: 256,
                zoomOffset: 0,
                keepBuffer: 2,
                updateWhenIdle: false,
                updateWhenZooming: true,
                    crossOrigin: false,
                    retry: isOnline ? 2 : 0,
                    retryDelay: 500
                };
                
                if (source.subdomains) {
                    layerOptions.subdomains = source.subdomains;
                }
                
                const layer = L.tileLayer(source.url, layerOptions);
                
                // إعادة تعيين عداد الأخطاء للمصدر الجديد
                satelliteSourceErrors.set(sourceIndex, 0);
                satelliteSourceSuccessCount.set(sourceIndex, 0);
                
                return layer;
            };

            // دالة معالجة الأخطاء للطبقة الفضائية (يمكن إعادة استخدامها)
            const handleSatelliteTileError = (error, tile) => {
                // في وضع ستالايت (offline)، نتجاهل الأخطاء تماماً
                if (!isOnline) {
                    if (tile && tile.el) {
                        tile.el.style.opacity = '0.1';
                        tile.el.style.display = 'none';
                    }
                    return;
                }
                
                // كتم أخطاء 503 في console تماماً - تحسين شامل
                try {
                    if (error) {
                        const errorMsg = String(error.message || error.toString() || '').toLowerCase();
                        const errorUrl = tile && tile.url ? String(tile.url).toLowerCase() : '';
                        const combinedError = errorMsg + ' ' + errorUrl;
                        
                        if (combinedError.includes('503') || 
                            combinedError.includes('service unavailable') || 
                            combinedError.includes('failed to fetch') || 
                            combinedError.includes('networkerror') ||
                            combinedError.includes('err_') ||
                            combinedError.includes('arcgisonline.com')) {
                            // منع عرض الخطأ في console - محاولة شاملة
                            if (typeof error.preventDefault === 'function') {
                                try { error.preventDefault(); } catch(e) {}
                            }
                            if (typeof error.stopPropagation === 'function') {
                                try { error.stopPropagation(); } catch(e) {}
                            }
                            if (typeof error.stopImmediatePropagation === 'function') {
                                try { error.stopImmediatePropagation(); } catch(e) {}
                            }
                            // إعادة تعيين الخطأ لمنع عرضه
                            try {
                                if (tile && tile.el && tile.el.onerror) {
                                    tile.el.onerror = null;
                                }
                            } catch(e) {}
                        }
                    }
                } catch(e) {
                    // تجاهل أي أخطاء في معالجة الأخطاء نفسها
                }
                
                // تتبع الأخطاء للمصدر الحالي
                const currentErrors = (satelliteSourceErrors.get(currentSatelliteSourceIndex) || 0) + 1;
                satelliteSourceErrors.set(currentSatelliteSourceIndex, currentErrors);
                
                // إخفاء البلاطة الفاشلة بصمت
                if (tile && tile.el) {
                    tile.el.style.opacity = '0.2';
                    try {
                        tile.el.onerror = function() { return false; };
                    } catch(e) {}
                }
                
                // حد التبديل: مصدر ArcGIS (503 متكرر) نبدّل بعد خطأ واحد؛ غيره بعد 3
                const currentSource = satelliteSources[currentSatelliteSourceIndex];
                const isArcGIS = currentSource && (currentSource.url || '').indexOf('arcgisonline.com') !== -1;
                const errorThreshold = isArcGIS ? 1 : 3;
                
                if (currentErrors >= errorThreshold && self.mapInstance && self.leafletLayers.satellite) {
                    const nextSourceIndex = (currentSatelliteSourceIndex + 1) % satelliteSources.length;
                    const nextSourceSuccess = satelliteSourceSuccessCount.get(nextSourceIndex) || 0;
                    const nextSourceErrors = satelliteSourceErrors.get(nextSourceIndex) || 0;
                    
                    if (nextSourceIndex !== currentSatelliteSourceIndex && 
                        (currentErrors > (isArcGIS ? 2 : 5) || nextSourceSuccess > nextSourceErrors || nextSourceErrors < 2)) {
                        
                        try {
                            const isActive = self.mapInstance.hasLayer(self.leafletLayers.satellite);
                            const wasVisible = isActive;
                            
                            // إزالة الطبقة القديمة
                            if (isActive) {
                                self.mapInstance.removeLayer(self.leafletLayers.satellite);
                            }
                            
                            // إنشاء طبقة جديدة من المصدر البديل
                            currentSatelliteSourceIndex = nextSourceIndex;
                            self.leafletLayers.satellite = createSatelliteLayer(currentSatelliteSourceIndex);
                            
                            // إعادة إضافة الطبقة إذا كانت مرئية
                            if (wasVisible && self.mapInstance) {
                                self.leafletLayers.satellite.addTo(self.mapInstance);
                            }
                            
                            // إعادة ربط معالج الأخطاء للطبقة الجديدة
                            self.leafletLayers.satellite.on('tileerror', handleSatelliteTileError);
                            
                            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                                Utils.safeLog(`🔄 تم التبديل التلقائي إلى مصدر خرائط فضائية بديل (${satelliteSources[currentSatelliteSourceIndex].name})`);
                                }
                            } catch (e) {
                            // تجاهل الأخطاء في التبديل
                        }
                    }
                }
            };
            
            // إنشاء الطبقة الفضائية الأولية
            this.leafletLayers.satellite = createSatelliteLayer(0);
            
            // ربط معالج الأخطاء
            this.leafletLayers.satellite.on('tileerror', handleSatelliteTileError);
            
            // تتبع النجاحات لتحسين اختيار المصدر
            this.leafletLayers.satellite.on('tileload', () => {
                const currentSuccess = (satelliteSourceSuccessCount.get(currentSatelliteSourceIndex) || 0) + 1;
                satelliteSourceSuccessCount.set(currentSatelliteSourceIndex, currentSuccess);
                
                // إعادة تعيين عداد الأخطاء عند النجاح
                satelliteSourceErrors.set(currentSatelliteSourceIndex, 0);
            });

            // طبقة الخريطة الطبوغرافية (Terrain) - استخدام CartoDB Positron (أكثر استقراراً)
            // OpenTopoMap و OpenStreetMap HOT قد يواجهان مشاكل 503
            this.leafletLayers.terrain = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | © <a href="https://carto.com/attributions">CARTO</a>',
                maxZoom: 19,
                subdomains: ['a', 'b', 'c', 'd'],
                errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                tileSize: 256,
                zoomOffset: 0,
                keepBuffer: 2,
                updateWhenIdle: false,
                updateWhenZooming: true
            });

            // معالجة الأخطاء بصمت - Leaflet سيعيد المحاولة تلقائياً
            // أخطاء 503 هي أخطاء مؤقتة من الخادم وستحل تلقائياً
            this.leafletLayers.terrain.on('tileerror', (error, tile) => {
                // إخفاء أخطاء 503 من console - هذه أخطاء مؤقتة من الخادم
                if (tile && tile.el) {
                    tile.el.style.opacity = '0.3';
                    try {
                        setTimeout(() => {
                            if (tile && tile.el && this.leafletLayers.terrain && typeof this.leafletLayers.terrain._tileShouldReload === 'function') {
                                this.leafletLayers.terrain._tileShouldReload(tile);
                            }
                        }, 2000);
                    } catch (e) {
                        // تجاهل إذا _tileShouldReload غير متوفر في إصدار Leaflet
                    }
                }
            });

            // إضافة الطبقة الافتراضية (العادية)
            this.leafletLayers.normal.addTo(this.mapInstance);
            this.currentMapType = 'normal';
            Utils.safeLog('✅ تم إضافة طبقة OpenStreetMap');

            // التحقق من أن الطبقة تم إضافتها
            const layers = this.mapInstance._layers || {};
            Utils.safeLog('✅ عدد الطبقات:', Object.keys(layers).length);

            // إضافة تحكم في التكبير
            L.control.zoom({
                position: 'topright'
            }).addTo(this.mapInstance);

            Utils.safeLog('✅ تم إضافة عناصر التحكم');

            // التحقق من أن الخريطة مرئية مع إعادة المحاولة
            const checkMapContainer = () => {
                try {
                    if (!this.mapInstance || !this.mapInstance.getContainer) {
                        // إعادة المحاولة بعد تأخير قصير
                        setTimeout(() => {
                            if (this.mapInstance && this.mapInstance.getContainer) {
                                checkMapContainer();
                            }
                        }, 100);
                        return;
                    }
                    
                    const mapContainer = this.mapInstance.getContainer();
                    if (mapContainer) {
                        const mapRect = mapContainer.getBoundingClientRect();
                        Utils.safeLog('📐 أبعاد حاوية Leaflet:', mapRect.width, 'x', mapRect.height);
                        Utils.safeLog('📐 حاوية Leaflet مرئية:', mapRect.width > 0 && mapRect.height > 0 ? 'نعم' : 'لا');

                        if (mapRect.width === 0 || mapRect.height === 0) {
                            Utils.safeWarn('⚠️ تحذير: حاوية Leaflet بدون أبعاد - قد تكون الخريطة مخفية');
                        }
                    } else {
                        // الحاوية غير متاحة بعد - إعادة المحاولة مرة واحدة
                        setTimeout(() => {
                            if (this.mapInstance && this.mapInstance.getContainer) {
                                const retryContainer = this.mapInstance.getContainer();
                                if (retryContainer) {
                                    Utils.safeLog('✅ تم الحصول على حاوية Leaflet بعد إعادة المحاولة');
                                    const retryRect = retryContainer.getBoundingClientRect();
                                    Utils.safeLog('📐 أبعاد حاوية Leaflet (بعد إعادة المحاولة):', retryRect.width, 'x', retryRect.height);
                                }
                            }
                        }, 200);
                    }
                } catch (e) {
                    // تجاهل الأخطاء - قد تكون الخريطة لم تكتمل بعد
                }
            };
            
            // بدء التحقق بعد تأخير قصير للسماح لـ Leaflet بإنشاء الحاوية
            setTimeout(checkMapContainer, 50);

            // استخدام ResizeObserver لاكتشاف متى تصبح الأبعاد متاحة
            let resizeObserver = null;
            // محاولة الحصول على الحاوية مع إعادة المحاولة
            const getContainerForObserver = () => {
                try {
                    if (this.mapInstance && this.mapInstance.getContainer) {
                        return this.mapInstance.getContainer();
                    }
                } catch (e) {
                    // تجاهل الخطأ
                }
                return null;
            };
            
            const mapContainerElement = getContainerForObserver();
            if (mapContainerElement && typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver((entries) => {
                    for (const entry of entries) {
                        const { width, height } = entry.contentRect;
                        if (width > 0 && height > 0 && this.mapInstance && this.mapInstance.invalidateSize) {
                            // إجبار إعادة حساب حجم الخريطة عندما تصبح الأبعاد متاحة
                            this.mapInstance.invalidateSize();
                            Utils.safeLog('✅ تم تحديث حجم الخريطة بواسطة ResizeObserver:', width, 'x', height);
                            // إيقاف المراقبة بعد النجاح
                            if (resizeObserver) {
                                resizeObserver.disconnect();
                                resizeObserver = null;
                            }
                        }
                    }
                });
                resizeObserver.observe(mapContainerElement);
                Utils.safeLog('✅ تم تفعيل ResizeObserver لمراقبة أبعاد الخريطة');
            }

            // إجبار الخريطة على إعادة الحساب بعد فترة قصيرة
            setTimeout(() => {
                if (this.mapInstance && this.mapInstance.invalidateSize) {
                    const container = this.mapInstance.getContainer();
                    if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
                    try {
                        this.mapInstance.invalidateSize();
                        Utils.safeLog('✅ تم تحديث حجم الخريطة بعد التهيئة (500ms)');

                        // التحقق مرة أخرى
                        const mapContainer2 = this.mapInstance.getContainer();
                        if (mapContainer2) {
                            const mapRect2 = mapContainer2.getBoundingClientRect();
                            Utils.safeLog('📐 الأبعاد بعد invalidateSize (500ms):', mapRect2.width, 'x', mapRect2.height);

                            if (mapRect2.width === 0 || mapRect2.height === 0) {
                                Utils.safeWarn('⚠️ تحذير: الحاوية لا تزال بدون أبعاد بعد invalidateSize');
                                    // إعادة المحاولة بعد تأخير إضافي
                                    setTimeout(() => {
                                        if (this.mapInstance && this.mapInstance.invalidateSize) {
                                            const retryContainer = this.mapInstance.getContainer();
                                            if (retryContainer && retryContainer.offsetWidth > 0 && retryContainer.offsetHeight > 0) {
                                                this.mapInstance.invalidateSize();
                                                Utils.safeLog('✅ تم إجبار الخريطة على إعادة الحساب (محاولة ثانية)');
                                            }
                                        }
                                    }, 1000);
                            } else {
                                Utils.safeLog('✅ الخريطة يجب أن تكون مرئية الآن');
                                // إيقاف ResizeObserver إذا كان يعمل
                                if (resizeObserver) {
                                    resizeObserver.disconnect();
                                    resizeObserver = null;
                                }
                            }
                        }
                    } catch (e) {
                        Utils.safeWarn('⚠️ خطأ في تحديث حجم الخريطة:', e);
                        }
                    } else {
                        Utils.safeWarn('⚠️ حاوية الخريطة غير مرئية - سيتم إعادة المحاولة');
                        // إعادة المحاولة بعد تأخير
                        setTimeout(() => {
                            if (this.mapInstance && this.mapInstance.invalidateSize) {
                                const retryContainer = this.mapInstance.getContainer();
                                if (retryContainer && retryContainer.offsetWidth > 0 && retryContainer.offsetHeight > 0) {
                                    this.mapInstance.invalidateSize();
                                    Utils.safeLog('✅ تم إجبار الخريطة على إعادة الحساب (محاولة ثانية)');
                                    // إيقاف ResizeObserver إذا كان يعمل
                                    if (resizeObserver) {
                                        resizeObserver.disconnect();
                                        resizeObserver = null;
                                    }
                                }
                            }
                        }, 1000);
                    }
                }
            }, 500);

            // محاولة أخرى بعد ثانية - مع إصلاح شامل للحاويات
            setTimeout(() => {
                if (this.mapInstance) {
                    try {
                        // إصلاح شامل لجميع الحاويات قبل التحقق
                        const mapContent = document.getElementById('ptw-map-content');
                        const mapContainerWrapper = document.getElementById('ptw-map-container');
                        const mapDiv = document.getElementById('ptw-map');
                        
                        // إصلاح حاوية المحتوى الرئيسية
                        if (mapContent) {
                            const contentStyle = window.getComputedStyle(mapContent);
                            if (contentStyle.display === 'none' || contentStyle.visibility === 'hidden') {
                                mapContent.style.display = 'flex';
                                mapContent.style.visibility = 'visible';
                            }
                            if (!mapContent.style.height || mapContent.style.height === '0px' || mapContent.style.height === 'auto') {
                                mapContent.style.height = 'calc(100vh - 280px)';
                                mapContent.style.minHeight = '600px';
                            }
                        }
                        
                        // إصلاح حاوية الخريطة الخارجية
                        if (mapContainerWrapper) {
                            const wrapperStyle = window.getComputedStyle(mapContainerWrapper);
                            if (wrapperStyle.display === 'none') {
                                mapContainerWrapper.style.display = 'block';
                            }
                            if (!mapContainerWrapper.style.height || mapContainerWrapper.style.height === '0px') {
                                mapContainerWrapper.style.height = '100%';
                                mapContainerWrapper.style.minHeight = '600px';
                            }
                            // التأكد من أن الحاوية لها أبعاد فعلية
                            const wrapperRect = mapContainerWrapper.getBoundingClientRect();
                            if (wrapperRect.height === 0) {
                                mapContainerWrapper.style.height = '600px';
                            }
                        }
                        
                        // إصلاح div الخريطة نفسه
                        if (mapDiv) {
                            const divStyle = window.getComputedStyle(mapDiv);
                            if (divStyle.display === 'none') {
                                mapDiv.style.display = 'block';
                            }
                            if (!mapDiv.style.height || mapDiv.style.height === '0px') {
                                mapDiv.style.height = '100%';
                                mapDiv.style.width = '100%';
                            }
                            // التأكد من أن div له أبعاد فعلية
                            const divRect = mapDiv.getBoundingClientRect();
                            if (divRect.height === 0 && mapContainerWrapper) {
                                const wrapperHeight = mapContainerWrapper.getBoundingClientRect().height;
                                if (wrapperHeight > 0) {
                                    mapDiv.style.height = wrapperHeight + 'px';
                                } else {
                                    mapDiv.style.height = '600px';
                                }
                            }
                        }
                        
                        // إجبار إعادة حساب حجم الخريطة
                        this.mapInstance.invalidateSize();
                        Utils.safeLog('✅ تم تحديث حجم الخريطة بعد التهيئة (1000ms)');

                        // التحقق النهائي بعد إصلاح الحاويات
                        const mapContainer3 = this.mapInstance.getContainer();
                        if (mapContainer3) {
                            // استخدام requestAnimationFrame للتحقق بعد أن يتم تطبيق التغييرات
                            requestAnimationFrame(() => {
                                const mapRect3 = mapContainer3.getBoundingClientRect();
                                Utils.safeLog('📐 الأبعاد النهائية (1000ms):', mapRect3.width, 'x', mapRect3.height);

                                if (mapRect3.width > 0 && mapRect3.height > 0) {
                                    Utils.safeLog('✅ الخريطة مرئية وجاهزة');
                                } else {
                                    // محاولة إصلاح نهائية قبل إظهار الخطأ
                                    if (mapDiv) {
                                        const finalDivRect = mapDiv.getBoundingClientRect();
                                        if (finalDivRect.height === 0) {
                                            mapDiv.style.height = '600px';
                                            mapDiv.style.width = '100%';
                                        }
                                    }
                                    if (mapContainerWrapper) {
                                        const finalWrapperRect = mapContainerWrapper.getBoundingClientRect();
                                        if (finalWrapperRect.height === 0) {
                                            mapContainerWrapper.style.height = '600px';
                                        }
                                    }
                                    
                                    // إعادة المحاولة بعد إصلاح نهائي
                                    setTimeout(() => {
                                        if (this.mapInstance && this.mapInstance.invalidateSize) {
                                            this.mapInstance.invalidateSize();
                                            const finalCheck = this.mapInstance.getContainer();
                                            if (finalCheck) {
                                                const finalRect = finalCheck.getBoundingClientRect();
                                                if (finalRect.width > 0 && finalRect.height > 0) {
                                                    Utils.safeLog('✅ تم إصلاح الخريطة بنجاح');
                                                } else {
                                                    Utils.safeWarn('⚠️ الخريطة قد تحتاج إلى تحديث الصفحة - تحقق من CSS للحاويات');
                                                }
                                            }
                                        }
                                    }, 500);
                                }
                            });
                        }
                    } catch (e) {
                        Utils.safeWarn('⚠️ خطأ في تحديث حجم الخريطة:', e);
                    }
                }
            }, 1000);

        } catch (error) {
            Utils.safeWarn('⚠️ تهيئة خريطة Leaflet فشلت:', error?.message || error);
            throw new Error(`فشل تهيئة الخريطة: ${error.message || 'خطأ غير معروف'}`);
        }
    },

    /**
     * عرض معلومات التشخيص
     */
    showMapDebugInfo() {
        // التحقق من مفتاح API
        const apiKey = AppState.googleConfig?.maps?.apiKey;
        const hasApiKey = apiKey && apiKey.trim() !== '';

        const debugInfo = {
            'Leaflet محمّل': typeof L !== 'undefined' ? 'نعم' : 'لا',
            'Google Maps محمّل': typeof google !== 'undefined' && typeof google.maps !== 'undefined' ? 'نعم' : 'لا',
            'إعدادات Google Maps': hasApiKey ? 'موجودة' : 'مفتاح API غير موجود',
            'CSP script-src': document.querySelector('meta[http-equiv="Content-Security-Policy"]') ? 'موجود' : 'غير موجود',
            'حاوية الخريطة': document.getElementById('ptw-map') ? 'موجودة' : 'غير موجودة',
            'الإحداثيات الافتراضية': JSON.stringify(this.getDefaultFactoryCoordinates()),
            'عدد التصاريح المفتوحة': (() => {
                const dataset = this.getPermitMetricsDataset?.();
                const source = Array.isArray(dataset?.source) ? dataset.source : (AppState.appData?.ptw || []);
                return source.filter(p => this.isPermitOpenStatus(p?.status)).length;
            })()
        };

        const infoText = Object.entries(debugInfo)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        alert('معلومات التشخيص:\n\n' + infoText + '\n\nملاحظة: إذا كان Google Maps "لا" رغم وجود المفتاح، قد يكون السبب قيود الفوترة أو النطاق.');
        if (typeof Utils !== 'undefined' && typeof Utils.safeLog === 'function') {
            Utils.safeLog('🔍 معلومات تشخيص الخريطة:', debugInfo);
        }
    },

    /**
     * الحصول على الإحداثيات الافتراضية للمصنع
     * يستخدم MapCoordinatesManager للحصول على البيانات من جميع المصادر
     * يعمل بشكل متزامن مع تحديث البيانات في الخلفية
     */
    getDefaultFactoryCoordinates() {
        // استخدام AppState مباشرة للاستجابة الفورية
        const companySettings = AppState.companySettings || {};
        let coords = null;
        
        if (companySettings.latitude && companySettings.longitude) {
            coords = {
                lat: parseFloat(companySettings.latitude),
                lng: parseFloat(companySettings.longitude),
                zoom: parseInt(companySettings.mapZoom) || 15
            };
        } else {
        // إحداثيات افتراضية (يمكن تغييرها حسب موقع المصنع)
            coords = {
            lat: 24.7136, // مثال: الرياض
            lng: 46.6753,
            zoom: 15
        };
        }
        
        // تحديث البيانات من MapCoordinatesManager في الخلفية (إذا كان متاحاً)
        if (typeof MapCoordinatesManager !== 'undefined' && MapCoordinatesManager.loadDefaultCoordinates) {
            MapCoordinatesManager.loadDefaultCoordinates().then(updatedCoords => {
                if (updatedCoords && updatedCoords.lat && updatedCoords.lng) {
                    if (!AppState.companySettings) AppState.companySettings = {};
                    AppState.companySettings.latitude = updatedCoords.lat;
                    AppState.companySettings.longitude = updatedCoords.lng;
                    AppState.companySettings.mapZoom = updatedCoords.zoom || 15;
                    Utils.safeLog('✅ تم تحديث الإحداثيات الافتراضية من MapCoordinatesManager');
                }
            }).catch(error => {
                Utils.safeWarn('⚠️ خطأ في تحديث الإحداثيات الافتراضية من MapCoordinatesManager:', error);
            });
        }
        
        return coords;
    },

    /**
     * الحصول على إحداثيات موقع من إعدادات المواقع
     */
    getSiteCoordinates(siteId, siteName) {
        try {
            // البحث في إعدادات الخريطة (الأولوية الأولى)
            const mapSites = this.getMapSites();
            const mapSite = mapSites.find(s =>
                (s.id === siteId || s.name === siteName) && s.latitude && s.longitude
            );
            if (mapSite) {
                return {
                    lat: parseFloat(mapSite.latitude),
                    lng: parseFloat(mapSite.longitude),
                    zoom: mapSite.zoom || 15
                };
            }

            // البحث في formSettingsState
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState) {
                const site = Permissions.formSettingsState.sites?.find(s =>
                    s.id === siteId || s.name === siteName
                );
                if (site && site.latitude && site.longitude) {
                    return {
                        lat: parseFloat(site.latitude),
                        lng: parseFloat(site.longitude)
                    };
                }
            }

            // البحث في observationSites
            if (Array.isArray(AppState.appData?.observationSites)) {
                const site = AppState.appData.observationSites.find(s =>
                    (s.id || s.siteId) === siteId || s.name === siteName
                );
                if (site && site.latitude && site.longitude) {
                    return {
                        lat: parseFloat(site.latitude),
                        lng: parseFloat(site.longitude)
                    };
                }
            }

            // إذا لم يتم العثور على إحداثيات، استخدام الإحداثيات الافتراضية
            return this.getDefaultFactoryCoordinates();
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على إحداثيات الموقع:', error);
            return this.getDefaultFactoryCoordinates();
        }
    },

    /**
     * التحقق من صلاحيات مدير النظام
     */
    isAdmin() {
        return AppState.currentUser?.role === 'admin' || 
               (typeof Permissions !== 'undefined' && Permissions.isAdmin && Permissions.isAdmin());
    },

    /**
     * الحصول على المواقع من الإعدادات
     * يستخدم MapCoordinatesManager للحصول على البيانات من جميع المصادر
     * يعمل بشكل متزامن مع تحديث البيانات في الخلفية
     */
    getMapSites() {
        // استخدام AppState مباشرة للاستجابة الفورية
        if (!AppState.appData) AppState.appData = {};
        if (!AppState.appData.ptwMapSites) AppState.appData.ptwMapSites = [];
        
        // تحديث البيانات من MapCoordinatesManager في الخلفية (إذا كان متاحاً)
        if (typeof MapCoordinatesManager !== 'undefined' && MapCoordinatesManager.loadMapSites) {
            MapCoordinatesManager.loadMapSites().then(sites => {
                if (sites && Array.isArray(sites) && sites.length > 0) {
                    if (!AppState.appData) AppState.appData = {};
                    AppState.appData.ptwMapSites = sites;
                    Utils.safeLog('✅ تم تحديث المواقع من MapCoordinatesManager');
                }
            }).catch(error => {
                Utils.safeWarn('⚠️ خطأ في تحديث المواقع من MapCoordinatesManager:', error);
            });
        }
        
        return AppState.appData.ptwMapSites;
    },

    /**
     * حفظ المواقع في الإعدادات
     * يستخدم MapCoordinatesManager للحفظ في جميع المصادر
     */
    async saveMapSites(sites) {
        // استخدام MapCoordinatesManager إذا كان متاحاً
        if (typeof MapCoordinatesManager !== 'undefined' && MapCoordinatesManager.saveMapSites) {
            try {
                const success = await MapCoordinatesManager.saveMapSites(sites);
                if (success) {
                    Utils.safeLog('✅ تم حفظ المواقع بنجاح باستخدام MapCoordinatesManager');
                    return;
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في حفظ المواقع باستخدام MapCoordinatesManager:', error);
            }
        }
        
        // النسخة الاحتياطية - الحفظ المباشر
        if (!AppState.appData) AppState.appData = {};
        AppState.appData.ptwMapSites = sites;
        
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        }
        
        // حفظ في Google Sheets إذا كان متاحاً
        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
            await GoogleIntegration.autoSave('PTW_MAP_SITES', sites).catch(err => {
                Utils.safeWarn('⚠️ تعذر حفظ إعدادات المواقع في Google Sheets:', err);
            });
        }
    },

    /**
     * إعدادات أحداث إعدادات الخريطة
     */
    setupMapSettingsEventListeners() {
        if (!this.isAdmin()) return;

        // زر فتح الإعدادات
        const settingsBtn = document.getElementById('ptw-map-settings-btn');
        if (settingsBtn) {
            // ✅ التحقق من أن العنصر موجود في DOM قبل replaceWith
            if (settingsBtn.parentNode && document.body.contains(settingsBtn)) {
                try {
                    settingsBtn.replaceWith(settingsBtn.cloneNode(true));
                    const newSettingsBtn = document.getElementById('ptw-map-settings-btn');
                    if (newSettingsBtn) {
                        newSettingsBtn.addEventListener('click', () => {
                            this.showMapSettingsModal();
                        });
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في replaceWith لزر الإعدادات:', error);
                    // استخدام طريقة بديلة: إضافة مستمع مباشرة
                    settingsBtn.addEventListener('click', () => {
                        this.showMapSettingsModal();
                    });
                }
            } else {
                // العنصر غير موجود في DOM - إضافة مستمع مباشرة
                settingsBtn.addEventListener('click', () => {
                    this.showMapSettingsModal();
                });
            }
        }
    },

    /**
     * عرض نافذة إعدادات الخريطة
     */
    showMapSettingsModal() {
        if (!this.isAdmin()) {
            Notification.warning(this._t('module.ptw.mapSettings.nopermission', 'ليس لديك صلاحية للوصول إلى هذه الصفحة'));
            return;
        }

        const t = (k, f) => this._t(k, f);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-cog ml-2"></i>
                        ${t('module.ptw.mapSettings.title', 'إعدادات إحداثيات المواقع')}
                    </h2>
                    <button class="modal-close" aria-label="${t('module.ptw.mapSettings.closeAria', 'إغلاق')}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${this.renderMapSettings()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => {
            if (modal && modal.parentNode) {
                modal.remove();
            }
        };

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                const ok = confirm(this._t('module.ptw.mapSettings.closeUnsaved', 'تنبيه: سيتم إغلاق النافذة.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) close();
            }
        });

        // إعدادات الأحداث
        setTimeout(() => {
            // زر إضافة موقع جديد
            const addBtn = document.getElementById('ptw-map-settings-add-site');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    this.addNewMapSite(modal);
                });
            }

            // أزرار الحفظ
            const saveBtns = modal.querySelectorAll('.save-site-btn');
            saveBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const siteId = btn.getAttribute('data-site-id');
                    this.saveMapSite(siteId, modal);
                });
            });

            // أزرار الحذف
            const deleteBtns = modal.querySelectorAll('.delete-site-btn');
            deleteBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const siteId = btn.getAttribute('data-site-id');
                    this.deleteMapSite(siteId, modal);
                });
            });

            // حفظ الإحداثيات الافتراضية
            const saveDefaultBtn = document.getElementById('ptw-save-default-coords');
            if (saveDefaultBtn) {
                saveDefaultBtn.addEventListener('click', () => {
                    this.saveDefaultCoordinates();
                });
            }
        }, 100);
    },

    /**
     * عرض إعدادات المواقع (للمدير فقط)
     */
    renderMapSettings() {
        const t = (k, f) => this._t(k, f);
        if (!this.isAdmin()) {
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">${t('module.ptw.mapSettings.nopermission', 'ليس لديك صلاحية للوصول إلى هذه الصفحة')}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // الحصول على المواقع من الإعدادات
        const sites = this.getMapSites();
        const defaultCoords = this.getDefaultFactoryCoordinates();
        const emptyAddHint = t('module.ptw.mapSettings.empty', 'لا توجد مواقع محددة. اضغط على "إضافة موقع جديد" لبدء الإضافة.');
        return `
            <div class="space-y-6">
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-cog ml-2"></i>
                            ${t('module.ptw.mapSettings.title', 'إعدادات إحداثيات المواقع')}
                        </h2>
                        <p class="text-sm text-gray-500 mt-1">${t('module.ptw.mapSettings.cardSubtitle', 'إدارة إحداثيات المواقع التي تظهر على الخريطة')}</p>
                    </div>
                    <div class="card-body">
                        <div class="mb-4">
                            <button id="ptw-map-settings-add-site" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                ${t('module.ptw.mapSettings.addNew', 'إضافة موقع جديد')}
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>${t('module.ptw.mapSettings.col.name', 'اسم الموقع')}</th>
                                        <th>${t('module.ptw.mapSettings.col.lat', 'خط العرض (Latitude)')}</th>
                                        <th>${t('module.ptw.mapSettings.col.lng', 'خط الطول (Longitude)')}</th>
                                        <th>${t('module.ptw.mapSettings.col.zoom', 'مستوى التكبير')}</th>
                                        <th>${t('module.ptw.registry.col.actions', 'الإجراءات')}</th>
                                    </tr>
                                </thead>
                                <tbody id="ptw-map-settings-sites-list">
                                    ${sites.length === 0 ? `
                                        <tr>
                                            <td colspan="5" class="text-center text-gray-500 py-8">
                                                ${emptyAddHint}
                                            </td>
                                        </tr>
                                    ` : sites.map(site => `
                                        <tr data-site-id="${Utils.escapeHTML(site.id || '')}">
                                            <td>
                                                <input type="text" class="form-input site-name-input" 
                                                    value="${Utils.escapeHTML(site.name || '')}" 
                                                    data-site-id="${Utils.escapeHTML(site.id || '')}"
                                                    placeholder="${t('module.ptw.mapSettings.placeholderSiteName', 'اسم الموقع')}">
                                            </td>
                                            <td>
                                                <input type="number" step="0.000001" class="form-input site-lat-input" 
                                                    value="${site.latitude || defaultCoords.lat}" 
                                                    data-site-id="${Utils.escapeHTML(site.id || '')}"
                                                    placeholder="24.7136">
                                            </td>
                                            <td>
                                                <input type="number" step="0.000001" class="form-input site-lng-input" 
                                                    value="${site.longitude || defaultCoords.lng}" 
                                                    data-site-id="${Utils.escapeHTML(site.id || '')}"
                                                    placeholder="46.6753">
                                            </td>
                                            <td>
                                                <input type="number" min="1" max="20" class="form-input site-zoom-input" 
                                                    value="${site.zoom || defaultCoords.zoom || 15}" 
                                                    data-site-id="${Utils.escapeHTML(site.id || '')}"
                                                    placeholder="15">
                                            </td>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <button class="btn-icon btn-icon-success save-site-btn" 
                                                        data-site-id="${Utils.escapeHTML(site.id || '')}" 
                                                        title="${t('module.ptw.mapSettings.btnSave', 'حفظ')}">
                                                        <i class="fas fa-save"></i>
                                                    </button>
                                                    <button class="btn-icon btn-icon-danger delete-site-btn" 
                                                        data-site-id="${Utils.escapeHTML(site.id || '')}" 
                                                        title="${t('module.ptw.mapSettings.btnDelete', 'حذف')}">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">
                            <i class="fas fa-map-marker-alt ml-2"></i>
                            ${t('module.ptw.mapSettings.defaultTitle', 'الإحداثيات الافتراضية')}
                        </h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.mapSettings.defaultLat', 'خط العرض الافتراضي')}</label>
                                <input type="number" step="0.000001" id="ptw-default-lat" class="form-input" 
                                    value="${defaultCoords.lat}" placeholder="24.7136">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.mapSettings.defaultLng', 'خط الطول الافتراضي')}</label>
                                <input type="number" step="0.000001" id="ptw-default-lng" class="form-input" 
                                    value="${defaultCoords.lng}" placeholder="46.6753">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.mapSettings.defaultZoom', 'مستوى التكبير الافتراضي')}</label>
                                <input type="number" min="1" max="20" id="ptw-default-zoom" class="form-input" 
                                    value="${defaultCoords.zoom || 15}" placeholder="15">
                            </div>
                        </div>
                        <div class="mt-4">
                            <button id="ptw-save-default-coords" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                ${t('module.ptw.mapSettings.saveDefault', 'حفظ الإحداثيات الافتراضية')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * إضافة موقع جديد
     */
    async addNewMapSite(modal) {
        const sites = this.getMapSites();
        const defaultCoords = this.getDefaultFactoryCoordinates();
        
        const newSite = {
            id: Utils.generateId('MAP_SITE'),
            name: '',
            latitude: defaultCoords.lat,
            longitude: defaultCoords.lng,
            zoom: defaultCoords.zoom || 15
        };

        sites.push(newSite);
        await this.saveMapSites(sites);
        
        // تحديث العرض
        if (modal) {
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = this.renderMapSettings();
                // إعادة ربط الأحداث
                setTimeout(() => {
                    const addBtn = document.getElementById('ptw-map-settings-add-site');
                    if (addBtn) {
                        addBtn.addEventListener('click', () => {
                            this.addNewMapSite(modal);
                        });
                    }
                    const saveBtns = modal.querySelectorAll('.save-site-btn');
                    saveBtns.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const siteId = btn.getAttribute('data-site-id');
                            this.saveMapSite(siteId, modal);
                        });
                    });
                    const deleteBtns = modal.querySelectorAll('.delete-site-btn');
                    deleteBtns.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const siteId = btn.getAttribute('data-site-id');
                            this.deleteMapSite(siteId, modal);
                        });
                    });
                }, 100);
            }
        }
    },

    /**
     * حفظ موقع
     */
    async saveMapSite(siteId, modal) {
        const sites = this.getMapSites();
        const site = sites.find(s => s.id === siteId);
        if (!site) return;

        const nameInput = document.querySelector(`.site-name-input[data-site-id="${siteId}"]`);
        const latInput = document.querySelector(`.site-lat-input[data-site-id="${siteId}"]`);
        const lngInput = document.querySelector(`.site-lng-input[data-site-id="${siteId}"]`);
        const zoomInput = document.querySelector(`.site-zoom-input[data-site-id="${siteId}"]`);

        if (nameInput && latInput && lngInput) {
            site.name = nameInput.value.trim();
            site.latitude = parseFloat(latInput.value) || 0;
            site.longitude = parseFloat(lngInput.value) || 0;
            site.zoom = zoomInput ? (parseInt(zoomInput.value) || 15) : 15;

            if (!site.name) {
                Notification.warning(this._t('module.ptw.mapSettings.warnings.enterSiteName', 'يرجى إدخال اسم الموقع'));
                return;
            }

            await this.saveMapSites(sites);
            Notification.success(this._t('module.ptw.mapSettings.warnings.saveSiteOk', 'تم حفظ الموقع بنجاح'));
        }
    },

    /**
     * حذف موقع
     */
    async deleteMapSite(siteId, modal) {
        if (!confirm(this._t('module.ptw.mapSettings.deleteConfirm', 'هل أنت متأكد من حذف هذا الموقع؟'))) {
            return;
        }

        const sites = this.getMapSites();
        const filtered = sites.filter(s => s.id !== siteId);
        await this.saveMapSites(filtered);
        
        Notification.success(this._t('module.ptw.mapSettings.warnings.deleteSiteOk', 'تم حذف الموقع بنجاح'));
        
        // تحديث العرض
        if (modal) {
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = this.renderMapSettings();
                // إعادة ربط الأحداث
                setTimeout(() => {
                    const addBtn = document.getElementById('ptw-map-settings-add-site');
                    if (addBtn) {
                        addBtn.addEventListener('click', () => {
                            this.addNewMapSite(modal);
                        });
                    }
                    const saveBtns = modal.querySelectorAll('.save-site-btn');
                    saveBtns.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const siteId = btn.getAttribute('data-site-id');
                            this.saveMapSite(siteId, modal);
                        });
                    });
                    const deleteBtns = modal.querySelectorAll('.delete-site-btn');
                    deleteBtns.forEach(btn => {
                        btn.addEventListener('click', () => {
                            const siteId = btn.getAttribute('data-site-id');
                            this.deleteMapSite(siteId, modal);
                        });
                    });
                }, 100);
            }
        }
    },

    /**
     * حفظ الإحداثيات الافتراضية
     * يستخدم MapCoordinatesManager للحفظ في جميع المصادر
     */
    async saveDefaultCoordinates() {
        const latInput = document.getElementById('ptw-default-lat');
        const lngInput = document.getElementById('ptw-default-lng');
        const zoomInput = document.getElementById('ptw-default-zoom');

        if (!latInput || !lngInput) {
            Notification.error(this._t('module.ptw.mapSettings.warnings.coordsGetError', 'خطأ في الحصول على الإحداثيات'));
            return;
        }

        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        const zoom = zoomInput ? (parseInt(zoomInput.value) || 15) : 15;

        if (isNaN(lat) || isNaN(lng)) {
            Notification.error(this._t('module.ptw.mapSettings.warnings.coordsInvalid', 'يرجى إدخال إحداثيات صحيحة'));
            return;
        }

        const coords = { lat, lng, zoom };

        // استخدام MapCoordinatesManager إذا كان متاحاً
        if (typeof MapCoordinatesManager !== 'undefined' && MapCoordinatesManager.saveDefaultCoordinates) {
            try {
                const success = await MapCoordinatesManager.saveDefaultCoordinates(coords);
                if (success) {
                    Notification.success(this._t('module.ptw.mapSettings.warnings.defaultSavedAll', 'تم حفظ الإحداثيات الافتراضية بنجاح في جميع المصادر'));
                    return;
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في حفظ الإحداثيات الافتراضية باستخدام MapCoordinatesManager:', error);
            }
        }

        // النسخة الاحتياطية - الحفظ المباشر
        if (!AppState.companySettings) AppState.companySettings = {};
        AppState.companySettings.latitude = lat;
        AppState.companySettings.longitude = lng;
        AppState.companySettings.mapZoom = zoom;

        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        }

        Notification.success(this._t('module.ptw.mapSettings.warnings.defaultSaved', 'تم حفظ الإحداثيات الافتراضية بنجاح'));
    },

    /**
     * تحديث العلامات على الخريطة
     */
    updateMapMarkers() {
        // التأكد من أننا في تبويب الخريطة فقط
        if (this.currentTab !== 'map') {
            return;
        }

        if (!this.mapInstance) {
            Utils.safeWarn('⚠️ الخريطة غير مهيأة - لا يمكن تحديث العلامات');
            return;
        }

        Utils.safeLog('🔄 بدء تحديث العلامات على الخريطة');

        // حذف العلامات القديمة
        this.mapMarkers.forEach(marker => {
            try {
                if (this.mapType === 'google' && typeof google !== 'undefined' && google.maps) {
                    if (marker.setMap) marker.setMap(null);
                    if (marker.infoWindow) try { marker.infoWindow.close(); } catch (e) {}
                } else if (this.mapType === 'leaflet' && this.mapInstance) {
                    try { this.mapInstance.removeLayer(marker); } catch (e) {}
                }
            } catch (e) {
                Utils.safeWarn('⚠️ خطأ في حذف علامة:', e);
            }
        });
        this.mapMarkers = [];

        // الحصول على قيم الفلاتر
        const statusFilter = document.getElementById('ptw-map-filter-status')?.value;
        const typeFilter = document.getElementById('ptw-map-filter-type')?.value;

        // تصفية التصاريح
        const filteredPermits = (AppState.appData.ptw || []).filter(permit => {
            // فلتر الحالة
            if (statusFilter) {
                if (permit.status !== statusFilter) return false;
            } else {
                // الوضع الافتراضي: عرض السارية فقط
                const status = permit.status || '';
                if (status === 'مغلق' || status === 'مرفوض' || status === 'مكتمل') return false;
            }

            // فلتر النوع
            if (typeFilter && permit.workType !== typeFilter) return false;

            return true;
        });

        Utils.safeLog('📊 عدد التصاريح للعرض:', filteredPermits.length);

        if (filteredPermits.length === 0) {
            Utils.safeLog('ℹ️ لا توجد تصاريح للعرض بعد التصفية');
            // لا نظهر إشعار هنا لمنع الإزعاج عند التصفية
            return;
        }

        // استخدام القائمة المصفاة بدلاً من openPermits
        const openPermits = filteredPermits;


        // إضافة علامة لكل تصريح مفتوح
        openPermits.forEach(permit => {
            try {
                const coords = this.getSiteCoordinates(permit.siteId, permit.location || permit.siteName);
                if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;

                if (this.mapType === 'google' && typeof google !== 'undefined' && google.maps && this.mapInstance) {
                    // استخدام Google Maps
                    const marker = new google.maps.Marker({
                        position: { lat: coords.lat, lng: coords.lng },
                        map: this.mapInstance,
                        title: `${permit.id || 'تصريح'} - ${permit.workType || 'نوع غير محدد'}`,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                            scaledSize: new google.maps.Size(32, 32)
                        },
                        animation: google.maps.Animation.DROP
                    });

                    const infoWindow = new google.maps.InfoWindow({
                        content: this.createPermitInfoWindowContent(permit)
                    });

                    marker.addListener('click', () => {
                        this.mapMarkers.forEach(m => {
                            if (m.infoWindow) {
                                m.infoWindow.close();
                            }
                        });
                        infoWindow.open(this.mapInstance, marker);
                    });

                    marker.infoWindow = infoWindow;
                    this.mapMarkers.push(marker);
                } else if (this.mapType === 'leaflet') {
                    // استخدام Leaflet
                    // التأكد من أن الخريطة جاهزة قبل إضافة العلامات
                    if (!this.mapInstance || !this.mapInstance.getContainer) {
                        Utils.safeWarn('⚠️ الخريطة غير جاهزة - سيتم تخطي هذه العلامة');
                        return;
                    }
                    const container = this.mapInstance.getContainer();
                    if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
                        Utils.safeWarn('⚠️ حاوية الخريطة غير مرئية - سيتم تخطي هذه العلامة');
                        return;
                    }
                    const marker = L.marker([coords.lat, coords.lng], {
                        title: `${permit.id || 'تصريح'} - ${permit.workType || 'نوع غير محدد'}`
                    }).addTo(this.mapInstance);

                    const popup = L.popup({
                        maxWidth: 400,
                        className: 'ptw-permit-popup'
                    }).setContent(this.createPermitInfoWindowContent(permit, 'leaflet'));

                    marker.bindPopup(popup);
                    marker.permitId = permit.id;
                    this.mapMarkers.push(marker);
                }
            } catch (error) {
                Utils.safeWarn(`⚠️ خطأ في إضافة علامة للتصريح ${permit.id}:`, error);
            }
        });

        // ضبط عرض الخريطة ليشمل جميع العلامات
        if (this.mapMarkers.length > 0) {
            try {
                if (this.mapType === 'google' && typeof google !== 'undefined' && google.maps && this.mapInstance) {
                    const bounds = new google.maps.LatLngBounds();
                    this.mapMarkers.forEach(marker => {
                        try {
                            if (marker.getPosition) bounds.extend(marker.getPosition());
                        } catch (e) {}
                    });
                    if (this.mapInstance.fitBounds) this.mapInstance.fitBounds(bounds);
                    if (this.mapMarkers.length === 1 && this.mapInstance.setZoom) this.mapInstance.setZoom(16);
                } else if (this.mapType === 'leaflet') {
                    // التأكد من أن الخريطة جاهزة وأن هناك علامات
                    if (this.mapMarkers && this.mapMarkers.length > 0 && this.mapInstance) {
                        try {
                            // التأكد من أن الخريطة مرئية ولها أبعاد
                            const container = this.mapInstance.getContainer();
                            if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
                    const group = new L.featureGroup(this.mapMarkers);
                                const bounds = group.getBounds();
                                
                                // التحقق من أن الحدود صالحة
                                if (bounds && bounds.isValid && bounds.isValid()) {
                                    this.mapInstance.fitBounds(bounds.pad(0.1), {
                                        animate: false,
                                        maxZoom: 18
                                    });

                    if (this.mapMarkers.length === 1) {
                        this.mapInstance.setZoom(16);
                                    }
                                } else {
                                    Utils.safeWarn('⚠️ حدود الخريطة غير صالحة');
                                }
                            } else {
                                Utils.safeWarn('⚠️ حاوية الخريطة غير مرئية - سيتم إعادة المحاولة');
                                // إعادة المحاولة بعد تأخير
                                setTimeout(() => {
                                    if (this.mapInstance && this.mapMarkers && this.mapMarkers.length > 0) {
                                        try {
                                            this.mapInstance.invalidateSize();
                                            const group = new L.featureGroup(this.mapMarkers);
                                            const bounds = group.getBounds();
                                            if (bounds && bounds.isValid && bounds.isValid()) {
                                                this.mapInstance.fitBounds(bounds.pad(0.1), {
                                                    animate: false,
                                                    maxZoom: 18
                                                });
                                            }
                                        } catch (retryError) {
                                            Utils.safeWarn('⚠️ فشلت إعادة المحاولة:', retryError);
                                        }
                                    }
                                }, 1000);
                            }
                        } catch (leafletError) {
                            Utils.safeWarn('⚠️ خطأ في Leaflet fitBounds:', leafletError);
                        }
                    }
                }
                Utils.safeLog(`✅ تم تحديث ${this.mapMarkers.length} علامة على الخريطة`);
            } catch (boundsError) {
                Utils.safeWarn('⚠️ خطأ في ضبط حدود الخريطة:', boundsError);
                Utils.safeLog(`✅ تم إضافة ${this.mapMarkers.length} علامة على الخريطة (بدون ضبط الحدود)`);
            }
        } else {
            Utils.safeLog('ℹ️ لا توجد علامات على الخريطة - الخريطة ستظهر بدون تصاريح');
        }
    },

    /**
     * إنشاء محتوى نافذة معلومات التصريح
     */
    createPermitInfoWindowContent(permit, mapType = 'google') {
        const remainingTime = this.calculateRemainingTime(permit.endDate);
        const openTime = permit.startDate || permit.createdAt;
        const formattedOpenTime = openTime ? Utils.formatDate(openTime) : 'غير محدد';

        return `
            <div style="min-width: 300px; max-width: 400px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 12px; border-radius: 8px 8px 0 0; margin: -8px -8px 8px -8px;">
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">
                        <i class="fas fa-file-alt" style="margin-left: 8px;"></i>
                        ${permit.id || 'تصريح'}
                    </h3>
                </div>
                <div style="padding: 8px 0;">
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #374151; display: block; margin-bottom: 4px;">نوع التصريح:</strong>
                        <span style="color: #6b7280;">${Utils.escapeHTML(permit.workType || 'غير محدد')}</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #374151; display: block; margin-bottom: 4px;">الجهة الطالبة:</strong>
                        <span style="color: #6b7280;">${Utils.escapeHTML(permit.requestingParty || 'غير محدد')}</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #374151; display: block; margin-bottom: 4px;">وقت الفتح:</strong>
                        <span style="color: #6b7280;">${formattedOpenTime}</span>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <strong style="color: #374151; display: block; margin-bottom: 4px;">الوقت المتبقي:</strong>
                        <span style="color: ${remainingTime.includes('منتهي') ? '#dc2626' : '#059669'}; font-weight: 600;">${remainingTime}</span>
                    </div>
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #374151; display: block; margin-bottom: 4px;">حالة التصريح:</strong>
                        <span class="badge badge-${this.getStatusBadgeClass(permit.status)}" style="display: inline-block; padding: 4px 8px; border-radius: 4px;">
                            ${Utils.escapeHTML(permit.status || 'غير محدد')}
                        </span>
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
                        <button onclick="PTW.viewPTW('${permit.id}'); ${mapType === 'leaflet' ? 'if(window.ptwCurrentPopup) window.ptwCurrentPopup.close();' : ''}" 
                                style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 600; transition: background 0.2s;"
                                onmouseover="this.style.background='#2563eb'"
                                onmouseout="this.style.background='#3b82f6'">
                            <i class="fas fa-eye" style="margin-left: 6px;"></i>
                            عرض تفاصيل التصريح
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * حساب الوقت المتبقي
     */
    calculateRemainingTime(endDate) {
        if (!endDate) return 'غير محدد';
        try {
            const end = this.parseDateTimeValue(endDate);
            if (!end) return 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯';
            const now = new Date();
            const diff = end - now;

            if (diff < 0) {
                return 'منتهي';
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 24) {
                const days = Math.floor(hours / 24);
                return `${days} يوم`;
            } else if (hours > 0) {
                return `${hours} ساعة و ${minutes} دقيقة`;
            } else {
                return `${minutes} دقيقة`;
            }
        } catch (error) {
            return 'غير محدد';
        }
    },

    /**
     * إعداد مستمعي التحديثات للخريطة
     */
    setupMapEventListeners() {
        // التأكد من أننا في تبويب الخريطة فقط
        if (this.currentTab !== 'map') {
            return;
        }

        // إزالة المستمعين السابقين إن وجدوا
        if (this.mapUpdateHandler) {
            document.removeEventListener('ptw:updated', this.mapUpdateHandler);
        }

        // إضافة مستمع جديد
        this.mapUpdateHandler = () => {
            if (this.currentTab === 'map' && this.mapInstance) {
                this.updateMapMarkers();
            }
        };

        document.addEventListener('ptw:updated', this.mapUpdateHandler);

        // مستمع لتحديثات AppState
        if (this.mapStateUpdateHandler) {
            window.removeEventListener('appstate:updated', this.mapStateUpdateHandler);
        }

        this.mapStateUpdateHandler = () => {
            if (this.currentTab === 'map' && this.mapInstance) {
                setTimeout(() => {
                    this.updateMapMarkers();
                }, 500);
            }
        };

        window.addEventListener('appstate:updated', this.mapStateUpdateHandler);
    },

    /**
     * عرض تفاصيل التصريح من السجل مع خيارات الطباعة والتعديل والحذف
     */
    viewRegistryDetails(permitId) {
        const item = AppState.appData.ptw.find(i => i.id === permitId);
        const registryEntry = this.registryData.find(r => r.permitId === permitId);
        const isManualPermit = registryEntry && registryEntry.isManualEntry === true;

        if (!item && !registryEntry) {
            Notification.error(this._t('module.ptw.notify.permitNotFound', 'لم يتم العثور على التصريح'));
            return;
        }

        // إذا كان تصريح يدوي، استخدم registryEntry
        if (isManualPermit && !item) {
            // عرض تفاصيل التصريح اليدوي فقط
            this.viewManualPermitDetails(registryEntry.id);
            return;
        }

        if (!item) {
            Notification.error(this._t('module.ptw.notify.permitNotFound', 'لم يتم العثور على التصريح'));
            return;
        }

        const isAdmin = AppState.currentUser?.role === 'admin';
        const isOpen = item.status !== 'مغلق' && item.status !== 'مرفوض';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        // إنشاء HTML لفريق العمل
        const teamMembers = Array.isArray(item.teamMembers) ? item.teamMembers : [];
        const teamMembersHTML = teamMembers.length > 0
            ? teamMembers.map(m => `<span class="bg-blue-50 px-2 py-1 rounded text-sm">${Utils.escapeHTML(m.name || '-')}</span>`).join(' ')
            : '<span class="text-gray-400">غير محدد</span>';

        // الحصول على نوع التصريح للعرض
        const permitTypeDisplay = registryEntry ? this.getPermitTypeDisplay(registryEntry) : (item.workType || 'غير محدد');

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; background: #ffffff;">
                <div class="modal-header modal-header-centered bg-white border-b border-gray-200 rounded-t-lg" style="padding: 20px 30px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="flex: 1;">
                        <h2 class="modal-title flex items-center gap-2" style="color: #000000; font-size: 1.5rem; font-weight: 700; margin: 0;">
                            <i class="fas fa-file-alt" style="color: #2563eb;"></i>
                            تفاصيل التصريح #${registryEntry?.sequentialNumber || item.id?.substring(0, 8)}
                        </h2>
                        <p class="text-sm mt-2" style="color: #6b7280;">
                            <i class="fas fa-calendar-alt ml-1"></i>
                            ${item.startDate ? Utils.formatDate(item.startDate) : (registryEntry?.openDate ? Utils.formatDate(registryEntry.openDate) : 'غير محدد')}
                            <span class="badge ${item.status === 'مغلق' ? 'bg-green-500' : item.status === 'مفتوح' || item.status === 'قيد المراجعة' ? 'bg-yellow-500' : 'bg-blue-500'} mr-3" style="color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem;">
                                ${item.status || (registryEntry?.status || 'غير محدد')}
                            </span>
                        </p>
                    </div>
                    <button class="hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center transition" onclick="this.closest('.modal-overlay').remove()" style="color: #374151; margin: 0 auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body p-6">
                    <!-- أزرار الإجراءات -->
                    <div class="flex flex-wrap gap-2 mb-6 p-4 bg-gray-50 rounded-lg border">
                        <button class="btn-primary btn-sm" onclick="PTW.printPermit('${permitId}')">
                            <i class="fas fa-print ml-1"></i> طباعة
                        </button>
                        <button class="btn-success btn-sm" onclick="PTW.exportPDF('${permitId}')">
                            <i class="fas fa-file-pdf ml-1"></i> تصدير PDF
                        </button>
                        ${isAdmin ? `
                            <button class="btn-warning btn-sm" onclick="this.closest('.modal-overlay').remove(); PTW.editPTW('${permitId}')">
                                <i class="fas fa-edit ml-1"></i> تعديل
                            </button>
                            <button class="btn-danger btn-sm" onclick="PTW.deletePermitFromRegistry('${permitId}')">
                                <i class="fas fa-trash ml-1"></i> حذف
                            </button>
                        ` : ''}
                        ${isOpen ? `
                            <button class="btn-secondary btn-sm" onclick="PTW.closePermitFromRegistry('${permitId}')">
                                <i class="fas fa-lock ml-1"></i> إغلاق التصريح
                            </button>
                        ` : ''}
                    </div>
                    
                    <!-- تفاصيل التصريح -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-3">
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">نوع العمل</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(registryEntry ? this.getPermitTypeDisplay(registryEntry) : (item.workType || '-'))}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الموقع</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(item.siteName || item.location || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الجهة الطالبة</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(item.requestingParty || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الجهة المصرح لها</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(item.authorizedParty || '-')}</p>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">تاريخ البدء</label>
                                <p class="font-semibold" style="color: #000000;">${item.startDate ? Utils.formatDate(item.startDate) : '-'}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">تاريخ الانتهاء</label>
                                <p class="font-semibold" style="color: #000000;">${item.endDate ? Utils.formatDate(item.endDate) : '-'}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">إجمالي الوقت</label>
                                <p class="font-semibold text-blue-600" style="color: #2563eb;">${registryEntry?.totalTime || '-'}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الحالة</label>
                                <span class="badge badge-${this.getStatusBadgeClass(item.status)}">${item.status || '-'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- وصف العمل -->
                    <div class="mt-4 bg-white p-4 rounded border">
                        <label class="text-xs text-gray-700 block mb-1" style="color: #374151;">وصف العمل</label>
                        <p style="color: #000000;">${Utils.escapeHTML(item.workDescription || 'غير محدد')}</p>
                    </div>
                    
                    <!-- فريق العمل -->
                    <div class="mt-4 bg-white p-4 rounded border">
                        <label class="text-xs text-gray-700 block mb-2" style="color: #374151;">فريق العمل</label>
                        <div class="flex flex-wrap gap-2">${teamMembersHTML}</div>
                    </div>
                    
                    <!-- مسئولي المتابعة -->
                    <div class="mt-4 grid grid-cols-2 gap-4">
                        <div class="bg-white p-3 rounded border">
                            <label class="text-xs text-gray-700 block" style="color: #374151;">مسئول المتابعة 01</label>
                            <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(registryEntry?.supervisor1 || '-')}</p>
                        </div>
                        <div class="bg-white p-3 rounded border">
                            <label class="text-xs text-gray-700 block" style="color: #374151;">مسئول المتابعة 02</label>
                            <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(registryEntry?.supervisor2 || '-')}</p>
                        </div>
                    </div>
                    
                    <!-- أزرار الإجراءات في أسفل النموذج -->
                    <div class="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-center">
                        <button class="btn-primary btn-sm" onclick="PTW.printPermit('${permitId}')">
                            <i class="fas fa-print ml-1"></i> طباعة
                        </button>
                        ${isAdmin ? `
                            <button class="btn-warning btn-sm" onclick="this.closest('.modal-overlay').remove(); PTW.editPTW('${permitId}')">
                                <i class="fas fa-edit ml-1"></i> تعديل
                            </button>
                            <button class="btn-danger btn-sm" onclick="PTW.deletePermitFromRegistry('${permitId}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-trash ml-1"></i> حذف
                            </button>
                        ` : ''}
                        ${isOpen ? `
                            <button class="btn-secondary btn-sm" onclick="PTW.closePermitFromRegistry('${permitId}')">
                                <i class="fas fa-lock ml-1"></i> إغلاق التصريح
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-footer border-t p-4 bg-gray-50 flex justify-center gap-2 form-actions-centered">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="min-width: 120px;">
                        <i class="fas fa-times ml-1"></i> إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm(PTW._t('module.ptw.mapSettings.closeUnsaved', 'تنبيه: سيتم إغلاق النافذة.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) modal.remove();
            }
        });
    },

    /**
     * عرض تفاصيل التصريح اليدوي
     */
    viewManualPermitDetails(entryId) {
        const entry = this.registryData.find(r => r.id === entryId);
        if (!entry) {
            Notification.error(this._t('module.ptw.notify.permitNotFoundM', 'لم يتم العثور على التصريح اليدوي'));
            return;
        }

        const isAdmin = AppState.currentUser?.role === 'admin';
        const permitTypeDisplay = this.getPermitTypeDisplay(entry);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; background: #ffffff;">
                <div class="modal-header modal-header-centered bg-white border-b border-gray-200 rounded-t-lg" style="padding: 20px 30px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="flex: 1;">
                        <h2 class="modal-title flex items-center gap-2" style="color: #000000; font-size: 1.5rem; font-weight: 700; margin: 0;">
                            <i class="fas fa-file-alt" style="color: #2563eb;"></i>
                            تفاصيل التصريح اليدوي #${entry.sequentialNumber}
                        </h2>
                        <p class="text-sm mt-2" style="color: #6b7280;">
                            <i class="fas fa-calendar-alt ml-1"></i>
                            ${entry.openDate ? Utils.formatDate(entry.openDate) : 'غير محدد'}
                            <span class="badge ${entry.status === 'اكتمل العمل بشكل آمن' ? 'bg-green-500' : entry.status === 'إغلاق جبري' ? 'bg-red-500' : 'bg-blue-500'} mr-3" style="color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem;">
                                ${entry.status || 'غير محدد'}
                            </span>
                        </p>
                    </div>
                    <button class="hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center transition" onclick="this.closest('.modal-overlay').remove()" style="color: #374151; margin: 0 auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-body p-6">
                    <!-- تفاصيل التصريح -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-3">
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">نوع التصريح</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(permitTypeDisplay)}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الموقع</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.location || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الجهة الطالبة</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.requestingParty || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الجهة المصرح لها</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.authorizedParty || '-')}</p>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الوقت من</label>
                                <p class="font-semibold" style="color: #000000;">${entry.timeFrom && entry.timeFrom !== 'غير محدد' ? Utils.formatDate(entry.timeFrom) : '-'}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">الوقت إلى</label>
                                <p class="font-semibold" style="color: #000000;">${entry.timeTo && entry.timeTo !== 'غير محدد' ? Utils.formatDate(entry.timeTo) : '-'}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">إجمالي الوقت</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.totalTime || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">حالة التصريح</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.status || '-')}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4 space-y-3">
                        <div class="bg-white p-3 rounded border">
                            <label class="text-xs text-gray-700 block" style="color: #374151;">وصف العمل</label>
                            <p class="whitespace-pre-wrap" style="color: #000000;">${Utils.escapeHTML(entry.workDescription || '-')}</p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">مسؤول المتابعة 01</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.supervisor1 || '-')}</p>
                            </div>
                            <div class="bg-white p-3 rounded border">
                                <label class="text-xs text-gray-700 block" style="color: #374151;">مسؤول المتابعة 02</label>
                                <p class="font-semibold" style="color: #000000;">${Utils.escapeHTML(entry.supervisor2 || '-')}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- أزرار الإجراءات في أسفل النموذج -->
                    <div class="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2 justify-center">
                        <button class="btn-primary btn-sm" onclick="PTW.printPermit('${entry.permitId || entry.id}')">
                            <i class="fas fa-print ml-1"></i> طباعة
                        </button>
                        <button class="btn-success btn-sm" onclick="PTW.exportPDF('${entry.permitId || entry.id}')">
                            <i class="fas fa-file-pdf ml-1"></i> تصدير PDF
                        </button>
                        ${isAdmin ? `
                            <button class="btn-warning btn-sm" onclick="this.closest('.modal-overlay').remove(); PTW.openManualPermitForm('${entry.id}')">
                                <i class="fas fa-edit ml-1"></i> تعديل
                            </button>
                            <button class="btn-danger btn-sm" onclick="PTW.deleteManualPermitEntry('${entry.id}'); this.closest('.modal-overlay').remove();">
                                <i class="fas fa-trash ml-1"></i> حذف
                            </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-footer border-t p-4 bg-gray-50 flex justify-center gap-2 form-actions-centered">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="min-width: 120px;">
                        <i class="fas fa-times ml-1"></i> إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // إغلاق عند الضغط خارج النموذج
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm(PTW._t('module.ptw.mapSettings.closeUnsaved', 'تنبيه: سيتم إغلاق النافذة.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) modal.remove();
            }
        });
    },

    /**
     * طباعة نموذج التصريح الحالي (قبل الحفظ)
     */
    printPermitForm() {
        const form = document.getElementById('ptw-form');
        if (!form) {
            Notification.warning(this._t('module.ptw.notify.formNotFound', 'النموذج غير موجود'));
            return;
        }

        try {
            // جمع بيانات النموذج
            const formData = this.collectFormDataForPrint();
            const permitId = this.currentEditId || formData.id || 'NEW';
            const formCode = `PTW-${permitId.substring(0, 8)}`;
            
            // إنشاء محتوى النموذج للطباعة
            const content = this.generatePrintContent(formData);
            
            // استخدام FormHeader.generatePDFHTML لإنشاء HTML مع الهيدر (بدون QR code)
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(
                    formCode,
                    `تصريح عمل #${permitId.substring(0, 8)}`,
                    content,
                    false,
                    false, // إزالة QR code
                    {
                        version: '1.0',
                        releaseDate: formData.createdAt || new Date().toISOString(),
                        revisionDate: formData.updatedAt || new Date().toISOString(),
                        'رقم التصريح': permitId.substring(0, 8)
                    },
                    formData.createdAt || new Date().toISOString(),
                    formData.updatedAt || new Date().toISOString()
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة تصريح العمل</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                        }, 800);
                    }, 500);
                };
            } else {
                Notification.error(this._t('module.ptw.notify.popupsPrint', 'يرجى السماح بالنوافذ المنبثقة للطباعة'));
            }
        } catch (error) {
            Utils.safeError('خطأ في طباعة النموذج:', error);
            Notification.error(this._t('module.ptw.notify.printErr', 'حدث خطأ أثناء الطباعة: ') + error.message);
        }
    },

    /**
     * جمع بيانات النموذج للطباعة
     */
    collectFormDataForPrint() {
        const form = document.getElementById('ptw-form');
        if (!form) return {};

        const locationSelect = document.getElementById('ptw-location');
        const sublocationSelect = document.getElementById('ptw-sublocation');
        const selectedSiteName = locationSelect?.options[locationSelect?.selectedIndex]?.text || '';
        const selectedSublocationName = sublocationSelect?.options[sublocationSelect?.selectedIndex]?.text || '';

        // جمع خيارات الأعمال
        const collectWorkSelections = (name) => {
            const selections = [];
            document.querySelectorAll(`input[name="${name}-option"]`).forEach(cb => {
                if (cb.checked) {
                    if (cb.value === 'other') {
                        const otherValue = document.getElementById(`${name}-other-text`)?.value.trim();
                        if (otherValue) {
                            selections.push(otherValue);
                        }
                    } else {
                        const label = cb.getAttribute('data-label') || cb.value;
                        selections.push(label);
                    }
                }
            });
            return selections;
        };

        // جمع الموافقات
        const approvals = [];
        const approvalRows = document.querySelectorAll('#approvals-tbody tr');
        approvalRows.forEach((row, index) => {
            const roleInput = document.getElementById(`approval-role-${index}`);
            const role = roleInput?.value.trim() || '';
            const selectEl = document.getElementById(`approval-approver-select-${index}`);
            const approverInput = document.getElementById(`approval-approver-${index}`);
            const approver = selectEl ? (selectEl.options[selectEl.selectedIndex]?.text || '') : (approverInput?.value.trim() || '');
            const statusInput = document.getElementById(`approval-status-${index}`);
            const status = statusInput?.value || 'pending';
            const dateInput = document.getElementById(`approval-date-${index}`);
            const date = dateInput?.value || '';
            const commentsInput = document.getElementById(`approval-comments-${index}`);
            const comments = commentsInput?.value.trim() || '';
            
            if (role) {
                approvals.push({ role, approver, status, date, comments });
            }
        });

        // جمع PPE
        const requiredPPE = typeof PPEMatrix !== 'undefined' ? PPEMatrix.getSelected() : [];

        // جمع Risk Assessment
        const riskAssessment = {};
        if (typeof RiskMatrix !== 'undefined') {
            const selectedCell = document.querySelector('#ptw-risk-matrix .risk-matrix-cell.selected') ||
                document.querySelector('#ptw-risk-matrix .risk-matrix-cell[data-selected="true"]');
            if (selectedCell) {
                riskAssessment.likelihood = selectedCell.getAttribute('data-likelihood') || selectedCell.getAttribute('data-probability') || '';
                riskAssessment.consequence = selectedCell.getAttribute('data-consequence') || selectedCell.getAttribute('data-severity') || '';
                riskAssessment.riskLevel = selectedCell.textContent.trim() || '';
            }
        }
        const riskNotes = document.getElementById('ptw-risk-notes')?.value.trim() || '';

        return {
            id: this.currentEditId || 'NEW',
            location: selectedSiteName,
            sublocation: selectedSublocationName,
            workDescription: document.getElementById('ptw-workDescription')?.value || '',
            startDate: document.getElementById('ptw-startDate')?.value || '',
            endDate: document.getElementById('ptw-endDate')?.value || '',
            requestingParty: (() => {
                const select = document.getElementById('ptw-requestingParty-select');
                const input = document.getElementById('ptw-requestingParty');
                if (select && select.value && select.value !== '__custom__') {
                    return select.value.trim();
                } else if (input) {
                    return input.value.trim();
                }
                return '';
            })(),
            authorizedParty: (() => {
                const select = document.getElementById('ptw-authorizedParty-select');
                const input = document.getElementById('ptw-authorizedParty');
                if (select && select.value && select.value !== '__custom__') {
                    return select.value.trim();
                } else if (input) {
                    return input.value.trim();
                }
                return '';
            })(),
            equipment: document.getElementById('ptw-equipment')?.value || '',
            tools: document.getElementById('ptw-tools')?.value || '',
            teamMembers: Array.from(document.querySelectorAll('#team-members-list .ptw-team-member-name'))
                .map(input => ({ name: input.value.trim() }))
                .filter(m => m.name),
            hotWorkDetails: collectWorkSelections('ptw-hot'),
            hotWorkOther: document.getElementById('ptw-hot-other-text')?.value.trim() || '',
            confinedSpaceDetails: collectWorkSelections('ptw-confined'),
            confinedSpaceOther: document.getElementById('ptw-confined-other-text')?.value.trim() || '',
            heightWorkDetails: collectWorkSelections('ptw-height'),
            heightWorkOther: document.getElementById('ptw-height-other-text')?.value.trim() || '',
            electricalWorkType: document.getElementById('ptw-electrical-work-type')?.value.trim() || '',
            coldWorkType: document.getElementById('ptw-cold-work-type')?.value.trim() || '',
            otherWorkType: document.getElementById('ptw-other-work-type')?.value.trim() || '',
            excavationLength: document.getElementById('ptw-excavation-length')?.value.trim() || '',
            excavationWidth: document.getElementById('ptw-excavation-width')?.value.trim() || '',
            excavationDepth: document.getElementById('ptw-excavation-depth')?.value.trim() || '',
            soilType: document.getElementById('ptw-excavation-soil')?.value.trim() || '',
            preStartChecklist: document.getElementById('ptw-preStartChecklist')?.checked || false,
            lotoApplied: document.getElementById('ptw-lotoApplied')?.checked || false,
            governmentPermits: document.getElementById('ptw-governmentPermits')?.checked || false,
            riskAssessmentAttached: document.getElementById('ptw-riskAssessmentAttached')?.checked || false,
            gasTesting: document.getElementById('ptw-gasTesting')?.checked || false,
            mocRequest: document.getElementById('ptw-mocRequest')?.checked || false,
            requiredPPE: requiredPPE,
            riskAssessment: riskAssessment,
            riskNotes: riskNotes,
            permitDisclaimer: document.getElementById('ptw-permit-disclaimer-text')?.value.trim() || '',
            approvals: approvals,
            closureStatus: document.querySelector('input[name="ptw-closure-status"]:checked')?.value || '',
            closureTime: document.getElementById('ptw-closure-time')?.value || '',
            closureReason: document.getElementById('ptw-closure-reason')?.value || '',
            // جمع موافقات إغلاق التصريح من القسم التاسع (بنفس طريقة القسم السابع)
            closureApprovals: (() => {
                const closureApprovals = [];
                const tbody = document.getElementById('closure-approvals-tbody');
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr[data-closure-approval-index]');
                    rows.forEach((row, index) => {
                        const roleInput = document.getElementById(`closure-approval-role-${index}`);
                        const approverSelect = document.getElementById(`closure-approval-approver-select-${index}`);
                        const approverInput = document.getElementById(`closure-approval-approver-${index}`);
                        const statusInput = document.getElementById(`closure-approval-status-${index}`);
                        const dateInput = document.getElementById(`closure-approval-date-${index}`);
                        const commentsInput = document.getElementById(`closure-approval-comments-${index}`);
                        
                        const approverId = approverSelect?.value || '';
                        const approverName = approverSelect?.options[approverSelect?.selectedIndex]?.text || approverInput?.value || '';
                        
                        closureApprovals.push({
                            role: roleInput?.value || '',
                            approverId: approverId,
                            approver: approverName,
                            status: statusInput?.value || 'pending',
                            date: dateInput?.value || '',
                            comments: commentsInput?.value || '',
                            required: row.getAttribute('data-required') !== 'false'
                        });
                    });
                }
                return closureApprovals;
            })(),
            closureApprovalCircuitOwnerId: document.getElementById('closure-approval-circuit-owner-id')?.value || '__default__',
            closureApprovalCircuitName: this.formClosureCircuitName || '',
            // الاحتفاظ بالبيانات القديمة للتوافق مع الإصدارات السابقة
            closureApproval: {
                name1: '',
                name2: '',
                name3: '',
                name4: '',
                signature1: '',
                signature2: '',
                signature3: '',
                signature4: ''
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    /**
     * إنشاء محتوى HTML للطباعة
     */
    generatePrintContent(formData) {
        const escape = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch {
                return dateStr;
            }
        };

        const formatDateTime = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                return date.toLocaleString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch {
                return dateStr;
            }
        };

        const teamMembersList = formData.teamMembers && formData.teamMembers.length > 0
            ? formData.teamMembers.map(m => escape(m.name)).join('، ')
            : 'غير محدد';

        // بناء قائمة الأعمال الساخنة
        let hotWorkList = formData.hotWorkDetails && formData.hotWorkDetails.length > 0
            ? formData.hotWorkDetails.map(w => escape(w)).join('، ')
            : 'لا يوجد';
        if (formData.hotWorkOther) {
            hotWorkList = (hotWorkList !== 'لا يوجد' ? hotWorkList + '، ' : '') + escape(formData.hotWorkOther);
        }

        // بناء قائمة الأماكن المغلقة
        let confinedList = formData.confinedSpaceDetails && formData.confinedSpaceDetails.length > 0
            ? formData.confinedSpaceDetails.map(w => escape(w)).join('، ')
            : 'لا يوجد';
        if (formData.confinedSpaceOther) {
            confinedList = (confinedList !== 'لا يوجد' ? confinedList + '، ' : '') + escape(formData.confinedSpaceOther);
        }

        // بناء قائمة العمل على الارتفاع
        let heightList = formData.heightWorkDetails && formData.heightWorkDetails.length > 0
            ? formData.heightWorkDetails.map(w => escape(w)).join('، ')
            : 'لا يوجد';
        if (formData.heightWorkOther) {
            heightList = (heightList !== 'لا يوجد' ? heightList + '، ' : '') + escape(formData.heightWorkOther);
        }

        // بناء قائمة المتطلبات
        const requirements = [];
        if (formData.preStartChecklist) requirements.push('قائمة التحقق بقرار بدء العمل');
        if (formData.lotoApplied) requirements.push('تطبيق نظام العزل LOTO');
        if (formData.governmentPermits) requirements.push('تصاريح جهات حكومية');
        if (formData.riskAssessmentAttached) requirements.push('تحليل المخاطر ووسائل التحكم');
        if (formData.gasTesting) requirements.push('قياس الغازات');
        if (formData.mocRequest) requirements.push('طلب تغيير فني (MOC)');
        const requirementsList = requirements.length > 0 ? requirements.join('، ') : 'لا يوجد';

        // بناء قائمة PPE
        const ppeList = formData.requiredPPE && formData.requiredPPE.length > 0
            ? formData.requiredPPE.map(p => escape(p)).join('، ')
            : 'لا يوجد';

        // بناء جدول الموافقات
        const approvalsTable = formData.approvals && formData.approvals.length > 0 ? `
            <table class="print-table" style="margin-top: 16px;">
                <thead>
                    <tr>
                        <th>الموافقات</th>
                        <th>الاسم</th>
                        <th>الحالة</th>
                        <th>التاريخ</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${formData.approvals.map(approval => `
                        <tr>
                            <td>${escape(approval.role)}</td>
                            <td>${escape(approval.approver)}</td>
                            <td>${approval.status === 'approved' ? 'معتمد' : approval.status === 'rejected' ? 'مرفوض' : 'بانتظار الاعتماد'}</td>
                            <td>${approval.date ? formatDateTime(approval.date) : '-'}</td>
                            <td>${escape(approval.comments)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p style="padding: 12px; color: #64748b;">لا توجد موافقات</p>';

        return `
            <style>
                .print-section {
                    margin: 10px 0;
                    page-break-inside: avoid;
                }
                .print-section-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: #1f2937;
                    margin-bottom: 8px;
                    padding-right: 10px;
                    border-right: 3px solid #003865;
                }
                .print-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 12px;
                }
                .print-field {
                    background: #f8fafc;
                    padding: 8px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                .print-field-label {
                    font-size: 11px;
                    color: #64748b;
                    margin-bottom: 3px;
                    font-weight: 600;
                }
                .print-field-value {
                    font-size: 12px;
                    color: #1f2937;
                    font-weight: 500;
                }
                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    font-size: 11px;
                }
                .print-table thead th {
                    background: linear-gradient(135deg, #b3e5fc 0%, #81d4fa 100%);
                    color: #01579b;
                    font-weight: bold;
                    padding: 8px 6px;
                    text-align: center;
                    border: 1px solid #0288d1;
                    font-size: 10px;
                }
                .print-table tbody td {
                    padding: 8px 6px;
                    text-align: right;
                    border: 1px solid #b0bec5;
                    background: white;
                    font-size: 10px;
                }
                .print-table tbody tr:first-child td:first-child,
                .print-table tbody tr:last-child td:first-child {
                    font-weight: bold;
                    background: #f5f5f5;
                    color: #424242;
                }
                .print-full-width {
                    grid-column: span 2;
                }
                .print-disclaimer {
                    margin: 20px 0;
                    padding: 20px;
                    background: linear-gradient(to bottom, #eff6ff, #dbeafe);
                    border-right: 4px solid #2563eb;
                    border-left: 4px solid #2563eb;
                    border-bottom: 2px solid #93c5fd;
                    border-top: 0;
                    border-radius: 12px;
                    text-align: center;
                    color: #1e3a5f;
                    font-size: ${(() => {
                        try {
                            const savedSize = localStorage.getItem('ptw_disclaimer_font_size');
                            return savedSize ? savedSize + 'px' : '15px';
                        } catch {
                            return '15px';
                        }
                    })()};
                    line-height: 2.2;
                    font-weight: 500;
                    letter-spacing: 0.3px;
                    white-space: pre-line;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                @media print {
                    body {
                        margin: 0;
                        padding: 8px;
                        font-size: 11px;
                    }
                    /* السماح باستمرار الأقسام الطويلة على صفحات A4 متعددة دون قص المحتوى */
                    .print-section {
                        page-break-inside: auto;
                        break-inside: auto;
                        margin: 8px 0;
                    }
                    .print-section-title {
                        font-size: 13px;
                        margin-bottom: 6px;
                    }
                    .print-field {
                        padding: 6px;
                    }
                    .print-table {
                        margin: 8px 0;
                    }
                    .print-table thead th,
                    .print-table tbody td {
                        padding: 6px 4px;
                        font-size: 9px;
                    }
                }
            </style>
            
            ${formData.permitDisclaimer ? `
            <div class="print-disclaimer">
                ${escape(formData.permitDisclaimer).replace(/\n/g, '<br>')}
            </div>
            ` : ''}
            
            <div class="print-section">
                <div class="print-section-title">القسم الأول : بيانات التصريح الأساسية</div>
                <div class="print-grid">
                    <div class="print-field">
                        <div class="print-field-label">الموقع / القسم</div>
                        <div class="print-field-value">${escape(formData.location)}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">المكان الفرعي</div>
                        <div class="print-field-value">${escape(formData.sublocation) || '-'}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">تاريخ البدء</div>
                        <div class="print-field-value">${formatDateTime(formData.startDate)}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">تاريخ الانتهاء</div>
                        <div class="print-field-value">${formatDateTime(formData.endDate)}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">الجهة المصرح لها بالعمل</div>
                        <div class="print-field-value">${escape(formData.authorizedParty) || '-'}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">الجهة الطالبة للتصريح</div>
                        <div class="print-field-value">${escape(formData.requestingParty) || '-'}</div>
                    </div>
                    <div class="print-field print-full-width">
                        <div class="print-field-label">المعدة / الماكينة / العملية</div>
                        <div class="print-field-value">${escape(formData.equipment) || '-'}</div>
                    </div>
                    <div class="print-field print-full-width">
                        <div class="print-field-label">الأدوات أو العدد (بعد فحصها وقبولها)</div>
                        <div class="print-field-value">${escape(formData.tools) || '-'}</div>
                    </div>
                    <div class="print-field print-full-width">
                        <div class="print-field-label">وصف العمل</div>
                        <div class="print-field-value">${escape(formData.workDescription) || '-'}</div>
                    </div>
                </div>
            </div>

            <div class="print-section">
                <div class="print-section-title">القسم الثاني : أسماء القائمين بالعمل</div>
                <div class="print-field">
                    <div class="print-field-value">${teamMembersList}</div>
                </div>
            </div>

            <div class="print-section">
                <div class="print-section-title">القسم الثالث : تحديد نوع / طبيعة الأعمال</div>
                <div class="print-grid">
                    <div class="print-field">
                        <div class="print-field-label">أعمال ساخنة</div>
                        <div class="print-field-value">${hotWorkList}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">أماكن مغلقة</div>
                        <div class="print-field-value">${confinedList}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">عمل على ارتفاع</div>
                        <div class="print-field-value">${heightList}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">تفاصيل أعمال الكهرباء</div>
                        <div class="print-field-value">${escape(formData.electricalWorkType) || '-'}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">تفاصيل الأعمال على البارد</div>
                        <div class="print-field-value">${escape(formData.coldWorkType) || '-'}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">تفاصيل أعمال أخرى</div>
                        <div class="print-field-value">${escape(formData.otherWorkType) || '-'}</div>
                    </div>
                    ${formData.excavationLength || formData.excavationWidth || formData.excavationDepth || formData.soilType ? `
                    <div class="print-field print-full-width">
                        <div class="print-field-label" style="font-weight: bold; margin-bottom: 8px;">بيانات الحفر</div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                            <div>
                                <div class="print-field-label">الطول (م)</div>
                                <div class="print-field-value">${escape(formData.excavationLength) || '-'}</div>
                            </div>
                            <div>
                                <div class="print-field-label">العرض (م)</div>
                                <div class="print-field-value">${escape(formData.excavationWidth) || '-'}</div>
                            </div>
                            <div>
                                <div class="print-field-label">العمق (م)</div>
                                <div class="print-field-value">${escape(formData.excavationDepth) || '-'}</div>
                            </div>
                            <div>
                                <div class="print-field-label">نوع التربة</div>
                                <div class="print-field-value">${escape(formData.soilType) || '-'}</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="print-section">
                <div class="print-section-title">القسم الرابع : المتطلبات والمرفقات</div>
                <div class="print-field">
                    <div class="print-field-value">${requirementsList}</div>
                </div>
            </div>

            <div class="print-section">
                <div class="print-section-title">القسم الخامس : تحديد مهمات الوقاية</div>
                <div class="print-field">
                    <div class="print-field-value">${ppeList}</div>
                </div>
            </div>

            <div class="print-section">
                <div class="print-section-title">القسم السادس : مصفوفة تقييم المخاطر</div>
                ${formData.riskAssessment && (formData.riskAssessment.likelihood || formData.riskAssessment.consequence) ? `
                <div class="print-grid">
                    <div class="print-field">
                        <div class="print-field-label">احتمالية الحدوث</div>
                        <div class="print-field-value">${escape(formData.riskAssessment.likelihood) || '-'}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">شدة العواقب</div>
                        <div class="print-field-value">${escape(formData.riskAssessment.consequence) || '-'}</div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">مستوى المخاطر</div>
                        <div class="print-field-value">${escape(formData.riskAssessment.riskLevel) || '-'}</div>
                    </div>
                </div>
                ` : '<div class="print-field"><div class="print-field-value">لم يتم تقييم المخاطر</div></div>'}
                ${formData.riskNotes ? `
                <div class="print-field print-full-width" style="margin-top: 12px;">
                    <div class="print-field-label">ملاحظات تقييم المخاطر</div>
                    <div class="print-field-value">${escape(formData.riskNotes)}</div>
                </div>
                ` : ''}
            </div>

            <div class="print-section">
                <div class="print-section-title">القسم السابع : دائرة الاعتمادات</div>
                ${approvalsTable}
            </div>

            <!-- القسم الثامن: إغلاق التصريح - يظهر دائماً -->
            <div class="print-section">
                <div class="print-section-title">القسم الثامن : إغلاق التصريح</div>
                <div style="background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e2e8f0;">
                    <p style="text-align: right; line-height: 1.5; color: #1f2937; margin: 0; font-size: 11px;">
                        تم متابعة العمل حتى النهاية وتم فحص موقع العمل والمواقع المجاورة له والتأكد من خلوها من الأخطار المحتمل حدوثها وذلك بعد عملية الانتهاء من العمل
                    </p>
                </div>
                <div class="print-grid">
                    <div class="print-field">
                        <div class="print-field-label">حالة الإغلاق</div>
                        <div class="print-field-value">
                            ${formData.closureStatus === 'completed' ? 'اكتمل العمل بشكل آمن' : 
                              formData.closureStatus === 'notCompleted' ? 'لم يكتمل العمل' : 
                              formData.closureStatus === 'forced' ? 'إغلاق جبري' : 'لم يتم الإغلاق'}
                        </div>
                    </div>
                    <div class="print-field">
                        <div class="print-field-label">الساعة</div>
                        <div class="print-field-value">${formData.closureTime ? formatDateTime(formData.closureTime) : '-'}</div>
                    </div>
                    ${formData.closureReason ? `
                    <div class="print-field print-full-width">
                        <div class="print-field-label">السبب</div>
                        <div class="print-field-value">${escape(formData.closureReason)}</div>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- القسم التاسع: اعتماد إغلاق التصريح - يظهر دائماً بعد الثامن -->
            <div class="print-section">
                <div class="print-section-title">القسم التاسع : اعتماد إغلاق التصريح</div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th colspan="5" style="text-align: center; font-size: 0.95rem;">
                                اعتماد اغلاق التصريح (يشترط جميع التوقيعات)
                            </th>
                        </tr>
                        <tr>
                            <th style="width: 15%;"></th>
                            <th style="width: 25%;">مسئول الجهة الطالبة</th>
                            <th style="width: 20%;">مدير منطقة الأعمال</th>
                            <th style="width: 25%;">مسئول السلامة والصحة المهنية</th>
                            <th style="width: 15%;">رئيس قسم السلامة والصحة المهنية</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>الاسم</td>
                            <td>${escape(formData.closureApproval?.name4 || '')}</td>
                            <td>${escape(formData.closureApproval?.name3 || '')}</td>
                            <td>${escape(formData.closureApproval?.name2 || '')}</td>
                            <td>${escape(formData.closureApproval?.name1 || '')}</td>
                        </tr>
                        <tr>
                            <td>التوقيع</td>
                            <td>${escape(formData.closureApproval?.signature4 || '')}</td>
                            <td>${escape(formData.closureApproval?.signature3 || '')}</td>
                            <td>${escape(formData.closureApproval?.signature2 || '')}</td>
                            <td>${escape(formData.closureApproval?.signature1 || '')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * تحويل سجل التصريح اليدوي (PTWRegistry) إلى شكل generatePrintContent — يحتوي كل الحقول المسجّلة يدوياً
     */
    formDataFromRegistryEntry(entry) {
        if (!entry) return null;
        const parseBool = (v) => v === true || v === 'true' || v === 1 || v === '1';
        const closureStatusFromStatus = (s) => {
            if (!s) return '';
            if (s === 'اكتمل العمل بشكل آمن') return 'completed';
            if (s === 'إغلاق جبري') return 'forced';
            if (s === 'لم يكتمل العمل') return 'notCompleted';
            return '';
        };

        let approvals = [];
        if (Array.isArray(entry.manualApprovals) && entry.manualApprovals.length) {
            approvals = entry.manualApprovals.map((a) => ({
                role: a.role || '',
                approver: a.name || a.approver || '',
                status: 'approved',
                date: a.date || '',
                comments: [a.notes, a.signature ? `توقيع: ${a.signature}` : ''].filter(Boolean).join(' — ')
            }));
        }

        const closureApproval = {
            name1: '', name2: '', name3: '', name4: '',
            signature1: '', signature2: '', signature3: '', signature4: ''
        };
        if (Array.isArray(entry.manualClosureApprovals) && entry.manualClosureApprovals.length) {
            const m = entry.manualClosureApprovals;
            if (m[0]) { closureApproval.name4 = m[0].name || ''; closureApproval.signature4 = m[0].signature || ''; }
            if (m[1]) { closureApproval.name3 = m[1].name || ''; closureApproval.signature3 = m[1].signature || ''; }
            if (m[2]) { closureApproval.name2 = m[2].name || ''; closureApproval.signature2 = m[2].signature || ''; }
            if (m[3]) { closureApproval.name1 = m[3].name || ''; closureApproval.signature1 = m[3].signature || ''; }
        }

        const requiredPPE = Array.isArray(entry.requiredPPE) && entry.requiredPPE.length
            ? entry.requiredPPE
            : (entry.ppeNotes ? String(entry.ppeNotes).split(/[،,]/).map((s) => s.trim()).filter(Boolean) : []);

        const hasRisk = entry.riskLikelihood || entry.riskConsequence || entry.riskLevel || entry.riskScore;
        const riskAssessment = hasRisk ? {
            likelihood: entry.riskLikelihood || '',
            consequence: entry.riskConsequence || '',
            riskLevel: entry.riskLevel || entry.riskScore || ''
        } : {};

        return {
            id: entry.permitId || entry.id,
            location: entry.location || '',
            sublocation: entry.sublocation || '',
            workDescription: entry.workDescription || '',
            startDate: entry.timeFrom || entry.openDate || '',
            endDate: entry.timeTo || '',
            requestingParty: entry.requestingParty || '',
            authorizedParty: entry.authorizedParty || '',
            equipment: entry.equipment || '',
            tools: entry.tools || entry.toolsList || '',
            teamMembers: Array.isArray(entry.teamMembers) ? entry.teamMembers : [],
            hotWorkDetails: Array.isArray(entry.hotWorkDetails) ? entry.hotWorkDetails : [],
            hotWorkOther: entry.hotWorkOther || '',
            confinedSpaceDetails: Array.isArray(entry.confinedSpaceDetails) ? entry.confinedSpaceDetails : [],
            confinedSpaceOther: entry.confinedSpaceOther || '',
            heightWorkDetails: Array.isArray(entry.heightWorkDetails) ? entry.heightWorkDetails : [],
            heightWorkOther: entry.heightWorkOther || '',
            electricalWorkType: entry.electricalWorkType || '',
            coldWorkType: entry.coldWorkType || '',
            otherWorkType: entry.otherWorkType || '',
            excavationLength: entry.excavationLength || '',
            excavationWidth: entry.excavationWidth || '',
            excavationDepth: entry.excavationDepth || '',
            soilType: entry.soilType || '',
            preStartChecklist: parseBool(entry.preStartChecklist),
            lotoApplied: parseBool(entry.lotoApplied),
            governmentPermits: parseBool(entry.governmentPermits),
            riskAssessmentAttached: parseBool(entry.riskAssessmentAttached),
            gasTesting: parseBool(entry.gasTesting),
            mocRequest: parseBool(entry.mocRequest),
            requiredPPE,
            riskAssessment,
            riskNotes: entry.riskNotes || '',
            approvals,
            closureStatus: entry.closureStatus || closureStatusFromStatus(entry.status),
            closureTime: entry.closureDate || entry.closureTime || '',
            closureReason: entry.closureReason || '',
            closureApproval,
            permitDisclaimer: entry.permitDisclaimer || '',
            createdAt: entry.createdAt || new Date().toISOString(),
            updatedAt: entry.updatedAt || new Date().toISOString()
        };
    },

    /**
     * تجهيز بيانات التصريح لطباعة/تصدير PDF — مطابقة لحقول النموذج المحفوظ
     */
    getPermitFormDataForPrint(item) {
        if (!item) return null;
        if (Array.isArray(this.registryData)) {
            const reg = this.registryData.find((r) => r.permitId === item.id && r.isManualEntry === true);
            if (reg) return this.formDataFromRegistryEntry(reg);
        }
        return {
            id: item.id,
            location: item.siteName || item.location || '',
            sublocation: item.sublocationName || item.sublocation || '',
            workDescription: item.workDescription || '',
            startDate: item.startDate || '',
            endDate: item.endDate || '',
            requestingParty: item.requestingParty || '',
            authorizedParty: item.authorizedParty || '',
            equipment: item.equipment || '',
            tools: item.tools || item.toolsList || '',
            teamMembers: Array.isArray(item.teamMembers) ? item.teamMembers : [],
            hotWorkDetails: Array.isArray(item.hotWorkDetails) ? item.hotWorkDetails : [],
            hotWorkOther: item.hotWorkOther || '',
            confinedSpaceDetails: Array.isArray(item.confinedSpaceDetails) ? item.confinedSpaceDetails : [],
            confinedSpaceOther: item.confinedSpaceOther || '',
            heightWorkDetails: Array.isArray(item.heightWorkDetails) ? item.heightWorkDetails : [],
            heightWorkOther: item.heightWorkOther || '',
            electricalWorkType: item.electricalWorkType || '',
            coldWorkType: item.coldWorkType || '',
            otherWorkType: item.otherWorkType || '',
            excavationLength: item.excavationLength || '',
            excavationWidth: item.excavationWidth || '',
            excavationDepth: item.excavationDepth || '',
            soilType: item.soilType || '',
            preStartChecklist: item.preStartChecklist || false,
            lotoApplied: item.lotoApplied || false,
            governmentPermits: item.governmentPermits || false,
            riskAssessmentAttached: item.riskAssessmentAttached || false,
            gasTesting: item.gasTesting || false,
            mocRequest: item.mocRequest || false,
            requiredPPE: Array.isArray(item.requiredPPE) ? item.requiredPPE : [],
            riskAssessment: item.riskAssessment || {},
            riskNotes: item.riskNotes || '',
            approvals: Array.isArray(item.approvals) ? item.approvals.map(a => ({
                role: a.role || '',
                approver: typeof a.approver === 'object' && a.approver
                    ? (a.approver.name || a.approver.email || a.approver.id || '')
                    : (a.approver || ''),
                status: a.status || 'pending',
                date: a.date || '',
                comments: a.comments || ''
            })) : [],
            closureStatus: item.closureStatus || '',
            closureTime: item.closureTime || '',
            closureReason: item.closureReason || '',
            closureApproval: item.closureApproval || {
                name1: '',
                name2: '',
                name3: '',
                name4: '',
                signature1: '',
                signature2: '',
                signature3: '',
                signature4: ''
            },
            permitDisclaimer: item.permitDisclaimer || '',
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
        };
    },

    /**
     * طباعة التصريح
     */
    printPermit(permitId) {
        const reg = Array.isArray(this.registryData)
            ? this.registryData.find((r) => r.permitId === permitId || r.id === permitId)
            : null;
        const effectiveId = reg?.permitId || permitId;
        let item = AppState.appData.ptw.find((i) => i.id === effectiveId);
        if (!item && reg && reg.isManualEntry) {
            item = {
                id: effectiveId,
                isManualEntry: true,
                createdAt: reg.createdAt,
                updatedAt: reg.updatedAt,
                startDate: reg.timeFrom,
                endDate: reg.timeTo,
                version: '1.0'
            };
        }
        if (!item) {
            Notification.error(this._t('module.ptw.notify.permitNotFound', 'لم يتم العثور على التصريح'));
            return;
        }

        const registryEntry = reg || this.registryData.find((r) => r.permitId === item.id);
        const formCode = item.isoCode || `PTW-${item.id?.substring(0, 8) || 'UNKNOWN'}`;

        const formData = this.getPermitFormDataForPrint(item);
        const content = this.generatePrintContent(formData);

        // إزالة QR code من الطباعة (includeQrInFooter = false)
        const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
            ? FormHeader.generatePDFHTML(
                formCode,
                `تصريح عمل #${registryEntry?.sequentialNumber || item.id?.substring(0, 8)}`,
                content,
                false,
                false, // إزالة QR code
                {
                    version: item.version || '1.0',
                    releaseDate: item.startDate || item.createdAt,
                    revisionDate: item.updatedAt || item.endDate || item.startDate,
                    'رقم التصريح': registryEntry?.sequentialNumber || item.id?.substring(0, 8)
                },
                item.createdAt || item.startDate,
                item.updatedAt || item.endDate || item.createdAt
            )
            : `<html><body>${content}</body></html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                    }, 800);
                }, 500);
            };
        }
    },

    /**
     * حذف التصريح من السجل (لمدير النظام فقط)
     */
    async deletePermitFromRegistry(permitId) {
        if (AppState.currentUser?.role !== 'admin') {
            Notification.error(this._t('module.ptw.notify.cannotDeletePerm', 'غير مصرح لك بحذف التصاريح'));
            return;
        }

        if (!confirm(this._t('module.ptw.notify.deletePtwFromSystem', 'هل أنت متأكد من حذف هذا التصريح؟\nسيتم حذفه نهائياً من النظام.'))) return;

        try {
            Loading.show();

            // حذف من بيانات التصاريح
            const ptwIndex = AppState.appData.ptw.findIndex(p => p.id === permitId);
            if (ptwIndex > -1) {
                AppState.appData.ptw.splice(ptwIndex, 1);
            }

            // حذف من السجل
            this.removeFromRegistry(permitId);

            // حفظ البيانات
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                await window.DataManager.save();
            }

            // إغلاق النافذة المنبثقة
            document.querySelector('.modal-overlay')?.remove();

            // تحديث العرض (استخدام immediate لتحديث فوري بعد الحذف)
            this.loadPTWList(true);
            const registryContent = document.getElementById('ptw-registry-content');
            if (registryContent && registryContent.style.display !== 'none') {
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
            }

            Notification.success(this._t('module.ptw.notify.deleted', 'تم حذف التصريح بنجاح'));
        } catch (error) {
            Utils.safeError('خطأ في حذف التصريح:', error);
            Notification.error(this._t('module.ptw.notify.deleteErr', 'حدث خطأ أثناء حذف التصريح'));
        } finally {
            Loading.hide();
        }
    },

    /**
     * إعداد مستمعي أحداث السجل
     */
    setupRegistryEventListeners() {
        // زر إضافة تصريح يدوي
        const addManualBtn = document.getElementById('ptw-registry-add-manual');
        if (addManualBtn) {
            addManualBtn.onclick = () => this.openManualPermitForm();
        }

        // استيراد Excel
        const importExcelBtn = document.getElementById('ptw-registry-import-excel');
        if (importExcelBtn) {
            importExcelBtn.onclick = () => this.showImportExcelModal();
        }

        // تصدير Excel
        const exportExcelBtn = document.getElementById('ptw-registry-export-excel');
        if (exportExcelBtn) {
            exportExcelBtn.onclick = () => this.exportRegistryToExcel();
        }

        // تصدير PDF
        const exportPdfBtn = document.getElementById('ptw-registry-export-pdf');
        if (exportPdfBtn) {
            exportPdfBtn.onclick = () => this.exportRegistryToPDF();
        }

        // البحث
        const searchInput = document.getElementById('registry-search');
        if (searchInput) {
            searchInput.oninput = () => this.applyRegistryFilters();
        }

        // فلتر الحالة
        const filterStatus = document.getElementById('registry-filter-status');
        if (filterStatus) {
            filterStatus.onchange = () => this.applyRegistryFilters();
        }

        // فلتر التاريخ
        const filterDateFrom = document.getElementById('registry-filter-date-from');
        const filterDateTo = document.getElementById('registry-filter-date-to');
        if (filterDateFrom) filterDateFrom.onchange = () => this.applyRegistryFilters();
        if (filterDateTo) filterDateTo.onchange = () => this.applyRegistryFilters();

        // مزامنة عدد الصفوف الظاهر مع الفلاتر الحالية (وإصلاح اختلاف نوع id بين DOM والبيانات)
        this.applyRegistryFilters();
    },

    /**
     * تطبيق الفلاتر على السجل
     */
    applyRegistryFilters() {
        const searchTerm = document.getElementById('registry-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('registry-filter-status')?.value || '';
        const dateFromFilter = document.getElementById('registry-filter-date-from')?.value || '';
        const dateToFilter = document.getElementById('registry-filter-date-to')?.value || '';

        const rows = document.querySelectorAll('[data-registry-id]');
        let visibleCount = 0;
        rows.forEach(row => {
            let show = true;
            const rowText = row.textContent.toLowerCase();
            const registryId = row.getAttribute('data-registry-id');
            const rid = registryId != null ? String(registryId) : '';
            const entry = this.registryData.find(r =>
                (r.id != null && String(r.id) === rid) ||
                (r.permitId != null && String(r.permitId) === rid)
            );

            if (!entry) { row.style.display = 'none'; return; }

            if (searchTerm && !rowText.includes(searchTerm)) show = false;
            if (statusFilter && entry.status !== statusFilter) show = false;
            const filterDateSource = entry.timeFrom || entry.openDate;
            if (dateFromFilter) {
                const d = filterDateSource ? new Date(filterDateSource) : null;
                const entryDate = d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
                if (!entryDate || entryDate < dateFromFilter) show = false;
            }
            if (dateToFilter) {
                const d = filterDateSource ? new Date(filterDateSource) : null;
                const entryDate = d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
                if (!entryDate || entryDate > dateToFilter) show = false;
            }

            row.style.display = show ? '' : 'none';
            if (show) {
                visibleCount += 1;
            }
        });

        const countEl = document.getElementById('registry-filter-count');
        if (countEl) {
            countEl.textContent = String(visibleCount);
        }
    },

    /**
     * تبديل ملء الشاشة / استعادة لنموذج إصدار تصريح عمل يدوي فقط (بدون تغيير بنية النموذج)
     */
    toggleManualPermitFormFullscreen(btn) {
        const modalContent = btn && btn.closest ? btn.closest('.ptw-manual-permit-modal') : null;
        if (!modalContent) return;
        const isFull = modalContent.classList.toggle('ptw-manual-permit-modal-fullscreen');
        const icon = btn.querySelector('i');
        const label = btn.querySelector('.ptw-manual-permit-fullscreen-label');
        if (icon) icon.className = isFull ? 'fas fa-compress' : 'fas fa-expand';
        if (label) label.textContent = isFull ? 'استعادة' : 'ملء الشاشة';
        btn.setAttribute('title', isFull ? 'استعادة' : 'ملء الشاشة');
    },

    /**
     * شبكة مهمات الوقاية الثابتة للتصريح اليدوي (مطابقة النموذج الورقي: 9 أعمدة × صفّان + صف خامس بخمس عناصر)
     */
    buildManualFixedPPECheckboxesHtml(selectedItems = []) {
        const esc = Utils.escapeHTML;
        const raw = new Set(
            (selectedItems || []).map((s) => String(s || '').trim()).filter(Boolean)
        );
        const normKey = (x) =>
            String(x || '')
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/[أإآٱ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/ى/g, 'ي');
        const isSel = (label) => {
            const t = String(label).trim();
            if (raw.has(t)) return true;
            const nk = normKey(t);
            for (const s of raw) {
                if (normKey(s) === nk) return true;
            }
            return false;
        };
        const rows = [
            ['حذاء سلامة', 'جوانتي سلامة', 'جوانتى احماض', 'جوانتي كهربي', 'كمامة', 'سدادة أذن', 'كاتم أذن', 'بدلة كيمائية', 'كشاف إنارة'],
            ['واقي رأس', 'نظارة واقية', 'وجه لحام', 'أذرع واقية', 'حزام أمان', 'حبل سلامة', 'جهاز تنفس', 'سترة عاكسة', 'شريط عاكس'],
            ['حواجز', 'أقماع مرور', 'وسائل اتصال', 'بطانية حريق', 'أخرى']
        ];
        let html = '<div class="ptw-manual-ppe-fixed-wrap">';
        rows.forEach((row) => {
            html += '<div class="ptw-manual-ppe-fixed-row">';
            row.forEach((label) => {
                const checked = isSel(label) ? ' checked' : '';
                html += `<label class="ptw-manual-ppe-cell"><input type="checkbox" class="manual-ppe-fixed-cb" value="${esc(label)}"${checked}><span>${esc(label)}</span></label>`;
            });
            html += '</div>';
        });
        html += '</div>';
        return html;
    },

    /**
     * فتح نموذج إدخال تصريح يدوي
     */
    openManualPermitForm(entryId = null) {
        const isEdit = entryId !== null;
        const existingEntry = entryId ? this.registryData.find(r => r.id === entryId) : null;

        // استعادة أسماء القائمين بالعمل من النص المخزن (عند التحميل من قاعدة البيانات)
        if (existingEntry && (!existingEntry.teamMembers || !existingEntry.teamMembers.length) && existingEntry.teamMembersText) {
            const text = String(existingEntry.teamMembersText).trim();
            existingEntry.teamMembers = text.split(/[،,]/).map(s => {
                s = s.trim();
                const m = s.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
                if (m) return { name: m[1].trim(), signature: m[2].trim() };
                return { name: s, signature: '' };
            }).filter(x => (x.name || x.signature));
        }
        if (existingEntry && (!existingEntry.teamMembers || !existingEntry.teamMembers.length)) {
            existingEntry.teamMembers = [{ name: '', signature: '' }];
        }
        // تحويل حقول طبيعة الأعمال من نص إلى مصفوفة (عند التحميل من الجدول)
        ['hotWorkDetails', 'confinedSpaceDetails', 'heightWorkDetails'].forEach(field => {
            if (existingEntry && existingEntry[field] != null && typeof existingEntry[field] === 'string') {
                existingEntry[field] = existingEntry[field].split(/[،,]/).map(s => s.trim()).filter(Boolean);
            }
        });

        const sites = this.getSiteOptions();
        const permitTypes = ['أعمال ساخنة', 'أعمال باردة', 'أعمال كهربائية', 'أعمال في الأماكن المغلقة', 'أعمال في الارتفاعات', 'أعمال أخرى'];
        const statusOptions = ['اكتمل العمل بشكل آمن', 'لم يكتمل العمل', 'إغلاق جبري'];
        const defaultManualClosureStatus = 'اكتمل العمل بشكل آمن';
        const effectiveManualStatus = String(existingEntry?.status || '').trim() || defaultManualClosureStatus;

        // توليد رقم مسلسل تلقائي إذا كان جديد (سيتم إعادة حسابه عند الحفظ)
        const sequentialNumber = existingEntry?.sequentialNumber || this.generateRegistrySequentialNumber();

        // الحصول على الجهات المعتمدة من قاعدة المقاولين (مع إتاحة الإدخال اليدوي)
        const approvedEntities = (typeof Contractors !== 'undefined' && typeof Contractors.getContractorOptionsForModules === 'function')
            ? (Contractors.getContractorOptionsForModules({ includeSuppliers: true, approvedOnly: true }) || [])
                .map(e => ({ name: (e.name || '').trim() }))
                .filter(e => e.name)
            : [];
        const hasApprovedEntities = approvedEntities.length > 0;
        const authorizedPartyValue = existingEntry?.authorizedParty || '';
        // الحصول على قائمة الإدارات للجهة الطالبة للتصريح
        const departmentOptions = this.getDepartmentOptionsForPTW();
        const hasDepartments = departmentOptions.length > 0;
        const requestingPartyValue = existingEntry?.requestingParty || '';
        const manualPpeSelectedItems = (() => {
            if (existingEntry?.requiredPPE && Array.isArray(existingEntry.requiredPPE) && existingEntry.requiredPPE.length) {
                return existingEntry.requiredPPE.map((s) => String(s || '').trim()).filter(Boolean);
            }
            if (existingEntry?.ppeNotes) {
                return String(existingEntry.ppeNotes)
                    .split(/[،,]/)
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
            return [];
        })();

        const safetyTeamForManual = (typeof Training !== 'undefined' && typeof Training.getSafetyTeamMembers === 'function')
            ? Training.getSafetyTeamMembers({ excludeSystemUsers: true })
            : [];
        const buildManualSupervisorOptions = (placeholder, selectedValue) => {
            const esc = Utils.escapeHTML;
            const sel = String(selectedValue || '').trim();
            const names = safetyTeamForManual.map((m) => String(m.name || '').trim()).filter(Boolean);
            let html = `<option value="">${esc(placeholder)}</option>`;
            names.forEach((n) => {
                html += `<option value="${esc(n)}"${sel === n ? ' selected' : ''}>${esc(n)}</option>`;
            });
            if (sel && !names.includes(sel)) {
                html += `<option value="${esc(sel)}" selected>${esc(sel)}</option>`;
            }
            return html;
        };
        const manualSupervisorSelectAttrs = 'class="form-input" style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px; width: 100%;" onfocus="this.style.borderColor=\'#667eea\'; this.style.boxShadow=\'0 0 0 3px rgba(102,126,234,0.15)\'" onblur="this.style.borderColor=\'#e0e7ff\'; this.style.boxShadow=\'none\'"';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 10000; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <style>
                /* أنماط المسطرة الجانبية */
                #manual-permit-modal-body {
                    scrollbar-width: auto;
                    scrollbar-color: #2196F3 #e3f2fd;
                }
                #manual-permit-modal-body::-webkit-scrollbar {
                    width: 14px;
                }
                #manual-permit-modal-body::-webkit-scrollbar-track {
                    background: linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%);
                    border-radius: 10px;
                    border: 2px solid #90caf9;
                }
                #manual-permit-modal-body::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #1976D2 0%, #1565C0 50%, #0D47A1 100%);
                    border-radius: 10px;
                    border: 2px solid #e3f2fd;
                    box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
                }
                #manual-permit-modal-body::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, #2196F3 0%, #1976D2 50%, #1565C0 100%);
                }
                #manual-permit-modal-body::-webkit-scrollbar-thumb:active {
                    background: linear-gradient(180deg, #0D47A1 0%, #1565C0 100%);
                }
                #manual-permit-modal-body::-webkit-scrollbar-button:single-button {
                    display: block;
                    height: 16px;
                    background-color: #1976D2;
                    border-radius: 5px;
                }
                #manual-permit-modal-body::-webkit-scrollbar-button:single-button:vertical:decrement {
                    background: linear-gradient(180deg, #1976D2, #1565C0);
                    border-radius: 5px 5px 0 0;
                }
                #manual-permit-modal-body::-webkit-scrollbar-button:single-button:vertical:increment {
                    background: linear-gradient(180deg, #1565C0, #1976D2);
                    border-radius: 0 0 5px 5px;
                }
                .manual-permit-same-field-slot {
                    min-height: 2.5rem;
                    position: relative;
                }
                .manual-permit-same-field-slot input.absolute {
                    box-sizing: border-box;
                }
                
                .ptw-manual-form-section {
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border: 2px solid;
                    transition: all 0.3s ease;
                }
                .ptw-manual-form-section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }
                .ptw-manual-form-section h3 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 3px solid;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ptw-manual-form-section h3 i {
                    font-size: 1.5rem;
                    padding: 10px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.3);
                }
                .manual-section-1 { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-color: #2196F3; }
                .manual-section-1 h3 { color: #1565C0; border-color: #2196F3; }
                .manual-section-1 h3 i { color: #1976D2; background: rgba(33, 150, 243, 0.1); }
                
                .manual-section-2 { background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%); border-color: #009688; }
                .manual-section-2 h3 { color: #00695C; border-color: #009688; }
                .manual-section-2 h3 i { color: #00796B; background: rgba(0, 150, 136, 0.1); }
                
                .manual-section-3 { background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-color: #9C27B0; }
                .manual-section-3 h3 { color: #6A1B9A; border-color: #9C27B0; }
                .manual-section-3 h3 i { color: #7B1FA2; background: rgba(156, 39, 176, 0.1); }
                
                .manual-section-4 { background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-color: #FF9800; }
                .manual-section-4 h3 { color: #E65100; border-color: #FF9800; }
                .manual-section-4 h3 i { color: #F57C00; background: rgba(255, 152, 0, 0.1); }
                
                .manual-section-5 { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-color: #4CAF50; }
                .manual-section-5 h3 { color: #2E7D32; border-color: #4CAF50; }
                .manual-section-5 h3 i { color: #388E3C; background: rgba(76, 175, 80, 0.1); }
                
                .manual-section-6 { background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); border-color: #E91E63; }
                .manual-section-6 h3 { color: #AD1457; border-color: #E91E63; }
                .manual-section-6 h3 i { color: #C2185B; background: rgba(233, 30, 99, 0.1); }
                
                .manual-section-7 { background: linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%); border-color: #795548; }
                .manual-section-7 h3 { color: #4E342E; border-color: #795548; }
                .manual-section-7 h3 i { color: #5D4037; background: rgba(121, 85, 72, 0.1); }
                
                .manual-section-8 { background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); border-color: #9e9e9e; }
                .manual-section-8 h3 { color: #424242; border-color: #9e9e9e; }
                .manual-section-8 h3 i { color: #616161; background: rgba(158, 158, 158, 0.1); }
                
                .manual-section-9 { background: linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%); border-color: #03a9f4; }
                .manual-section-9 h3 { color: #0277bd; border-color: #03a9f4; }
                .manual-section-9 h3 i { color: #0288d1; background: rgba(3, 169, 244, 0.1); }
                
                .manual-section-10 { background: linear-gradient(135deg, #ede7f6 0%, #d1c4e9 100%); border-color: #673ab7; }
                .manual-section-10 h3 { color: #4527a0; border-color: #673ab7; }
                .manual-section-10 h3 i { color: #512da8; background: rgba(103, 58, 183, 0.1); }

                .manual-permit-type-card {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    background: white;
                    border-radius: 12px;
                    border: 2px solid #e0e0e0;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .manual-permit-type-card:hover {
                    border-color: #9C27B0;
                    background: #f3e5f5;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(156, 39, 176, 0.2);
                }
                .manual-permit-type-card.selected {
                    border-color: #9C27B0;
                    background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                    box-shadow: 0 4px 12px rgba(156, 39, 176, 0.3);
                }
                .manual-permit-type-card input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                    margin-left: 12px;
                    accent-color: #9C27B0;
                }
                .manual-permit-type-card .type-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 12px;
                    font-size: 1.2rem;
                }
                .manual-permit-type-card .type-name {
                    font-weight: 600;
                    color: #333;
                }
                /* القائمة الجانبية - تنسيق أسهل وأكثر مئونة */
                #manual-work-type-select-wrap {
                    flex-shrink: 0; width: 220px;
                    border: 1px solid #e9d5ff; border-radius: 12px;
                    background: linear-gradient(180deg, #fdf4ff 0%, #f5e0ff 100%);
                    padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                #manual-work-type-select-wrap label {
                    display: block; font-weight: 600; color: #6b21a8;
                    margin-bottom: 10px; font-size: 0.9rem;
                }
                #manual-work-type-select {
                    width: 100%; padding: 10px 12px; border-radius: 8px;
                    border: 1px solid #d8b4fe; background: #fff;
                    font-size: 0.9rem; color: #374151;
                }
                #manual-work-type-select:focus { outline: none; border-color: #9C27B0; box-shadow: 0 0 0 2px rgba(156,39,176,0.2); }
                .manual-work-type-inline-panel {
                    flex: 1; min-width: 280px; min-height: 220px;
                    border: 1px solid #e9d5ff; border-radius: 12px;
                    background: #fefefe; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                    padding: 18px; transition: box-shadow 0.2s ease;
                }
                .manual-work-type-inline-panel:focus-within { box-shadow: 0 0 0 2px rgba(156,39,176,0.15); }
                #manual-work-type-panel-placeholder {
                    color: #7c3aed; font-size: 0.9rem; text-align: center;
                    padding: 32px 16px; line-height: 1.6;
                }
                #manual-work-type-panel-title {
                    margin: 0 0 14px 0; font-size: 1rem; font-weight: 700;
                    color: #6b21a8; padding-bottom: 10px;
                    border-bottom: 2px solid #e9d5ff;
                }
                .manual-type-panel-body label.manual-opt-row {
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 12px; margin-bottom: 6px;
                    border-radius: 10px; cursor: pointer;
                    border: 1px solid transparent; transition: all 0.15s ease;
                }
                .manual-type-panel-body label.manual-opt-row:hover { background: #faf5ff !important; }
                .manual-type-panel-body .manual-other-label { font-size: 0.85rem; font-weight: 600; color: #4b5563; margin-bottom: 6px; }
                .manual-type-panel-body .manual-other-input { width: 100%; border-radius: 8px; padding: 8px 12px; border: 1px solid #e5e7eb; }
                .manual-selected-type-chip { cursor: pointer; transition: background 0.15s ease; }
                .manual-selected-type-chip:hover { background: #ddd6fe !important; }
                .manual-selected-types-hint { font-size: 0.75rem; color: #7c3aed; margin-top: 6px; opacity: 0.9; }
                .manual-selected-types-empty { font-size: 0.8rem; color: #9ca3af; font-style: italic; padding: 8px 0; }
                .manual-panel-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                .manual-panel-type-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: #d9f99d; color: #365314; font-weight: 600; }
                @media (max-width: 768px) {
                    .manual-section-3-content > div[style*="flex"] { flex-wrap: wrap !important; }
                    #manual-work-type-select-wrap { width: 100% !important; max-width: 100%; }
                    .manual-work-type-inline-panel { min-width: 100% !important; }
                }
                /* رأس الورق + الشعار: يُحقن عبر renderPermitSystemHeader() ولا يمر بنمط نموذج PTW العادي */
                .ptw-manual-permit-modal .ptw-paper-header {
                    display: grid;
                    grid-template-columns: 1fr 1.35fr 1fr;
                    align-items: center;
                    gap: 10px 14px;
                    padding: 10px 20px;
                    margin: 0 24px;
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                    color: #fff;
                    border-radius: 0 0 12px 12px;
                    border: 1px solid rgba(255, 255, 255, 0.22);
                    border-top: none;
                    min-height: 64px;
                    max-height: 84px;
                    box-sizing: border-box;
                }
                .ptw-manual-permit-modal .ptw-paper-header-right { text-align: right; min-width: 0; }
                .ptw-manual-permit-modal .ptw-paper-header-title { font-weight: 700; font-size: 14px; color: #fff; line-height: 1.25; }
                .ptw-manual-permit-modal .ptw-paper-header-subtitle { font-size: 11px; color: rgba(255, 255, 255, 0.88); margin-top: 2px; }
                .ptw-manual-permit-modal .ptw-paper-header-center { text-align: center; min-width: 0; }
                .ptw-manual-permit-modal .ptw-paper-header-company {
                    font-size: 15px;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: 0.2px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .ptw-manual-permit-modal .ptw-paper-header-left {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    min-width: 0;
                }
                .ptw-manual-permit-modal .ptw-paper-header-logo {
                    max-height: 44px;
                    max-width: 120px;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    background: #fff;
                    border-radius: 6px;
                    padding: 3px;
                    display: block;
                    flex-shrink: 0;
                }
                .ptw-manual-permit-modal .ptw-paper-header-logo-fallback {
                    width: 72px;
                    height: 40px;
                    border: 1px solid rgba(255, 255, 255, 0.55);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.95);
                    font-size: 11px;
                    flex-shrink: 0;
                }
                @media (max-width: 640px) {
                    .ptw-manual-permit-modal .ptw-paper-header {
                        grid-template-columns: 1fr;
                        max-height: none;
                        text-align: center;
                    }
                    .ptw-manual-permit-modal .ptw-paper-header-right,
                    .ptw-manual-permit-modal .ptw-paper-header-center { text-align: center; }
                    .ptw-manual-permit-modal .ptw-paper-header-left { justify-content: center; }
                    .ptw-manual-permit-modal .ptw-paper-header-company { white-space: normal; }
                }
                /* جداول النموذج اليدوي — خلفية فاتحة ووضوح دون فرض ثيم أسود */
                .ptw-manual-permit-modal .ptw-paper-grid-table {
                    width: 100%;
                    border-collapse: collapse !important;
                    table-layout: fixed;
                    border: 1.2px solid #94a3b8 !important;
                    background: #fff;
                }
                .ptw-manual-permit-modal .ptw-paper-grid-table th,
                .ptw-manual-permit-modal .ptw-paper-grid-table td {
                    border: 1.2px solid #94a3b8 !important;
                    min-height: 42px;
                    padding: 7px 8px !important;
                    vertical-align: middle;
                }
                .ptw-manual-permit-modal .ptw-paper-grid-table th {
                    background: linear-gradient(135deg, #b3e5fc 0%, #81d4fa 100%) !important;
                    color: #111827 !important;
                    font-size: 13px;
                    font-weight: 700;
                }
                .ptw-manual-permit-modal .ptw-paper-grid-table td {
                    background: #fff !important;
                    color: #111827 !important;
                    font-size: 13px;
                }
                .ptw-manual-permit-modal .ptw-paper-grid-table td.bg-gray-50 {
                    background: #f1f5f9 !important;
                    color: #111827 !important;
                    font-weight: 700;
                }
                @media (max-width: 1024px) {
                    .ptw-manual-permit-modal .ptw-paper-grid-table th,
                    .ptw-manual-permit-modal .ptw-paper-grid-table td {
                        min-height: 38px;
                        font-size: 12px !important;
                        padding: 6px 7px !important;
                    }
                }
                @media (max-width: 768px) {
                    .ptw-manual-permit-modal .modal-content {
                        width: 100% !important;
                        max-height: 100vh !important;
                        border-radius: 0 !important;
                    }
                    .ptw-manual-permit-modal .modal-header {
                        padding: 14px 12px !important;
                    }
                    .ptw-manual-permit-modal #manual-permit-modal-body {
                        padding: 10px !important;
                        max-height: calc(100vh - 210px) !important;
                    }
                    .ptw-manual-permit-modal .ptw-manual-form-section {
                        margin-bottom: 10px !important;
                        padding: 9px !important;
                    }
                    .ptw-manual-permit-modal .ptw-manual-form-section h3 {
                        font-size: 0.95rem !important;
                        padding-bottom: 10px !important;
                    }
                    .ptw-manual-permit-modal .overflow-x-auto {
                        overflow-x: auto !important;
                    }
                    .ptw-manual-permit-modal .ptw-paper-grid-table {
                        min-width: 760px;
                    }
                }
                /* القسم الخامس — نفس ألوان/شكل باقي الأقسام؛ القيم داخل إطار شبيه بجداول النموذج الورقي */
                .ptw-manual-permit-modal .manual-section-5.ptw-manual-ppe-section {
                    overflow: visible;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-body {
                    margin-top: 0;
                }
                .ptw-manual-permit-modal .manual-section-5 #manual-ppe-matrix {
                    background: #ffffff !important;
                    border: 1.2px solid #94a3b8 !important;
                    border-radius: 10px !important;
                    padding: 18px 12px !important;
                    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.07);
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-notes-frame {
                    margin-top: 0.5rem;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 6px 8px 6px;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-notes-frame label {
                    color: #334155;
                    font-weight: 600;
                    font-size: 0.72rem;
                    margin-bottom: 4px;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-notes-frame textarea {
                    min-height: 2rem;
                    max-height: 4rem;
                    padding: 6px 8px;
                    font-size: 0.8rem;
                    line-height: 1.35;
                    resize: vertical;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-fixed-wrap {
                    width: 100%;
                    max-width: 100%;
                    overflow-x: visible;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-fixed-row {
                    display: grid;
                    grid-template-columns: repeat(9, minmax(0, 1fr));
                    gap: 12px 5px;
                    margin-bottom: 14px;
                    direction: rtl;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-fixed-row:last-child {
                    margin-bottom: 0;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-cell {
                    display: flex;
                    align-items: flex-start;
                    gap: 5px;
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: #000000 !important;
                    cursor: pointer;
                    direction: rtl;
                    min-width: 0;
                    line-height: 1.32;
                    word-break: break-word;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-cell span {
                    min-width: 0;
                }
                .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-cell input[type="checkbox"] {
                    flex-shrink: 0;
                    width: 1.05rem;
                    height: 1.05rem;
                    margin-top: 2px;
                    accent-color: #1e3a5f;
                }
                @media (max-width: 1200px) {
                    .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-fixed-row {
                        grid-template-columns: repeat(9, minmax(0, 1fr));
                        gap: 9px 4px;
                    }
                    .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-cell {
                        font-size: 0.75rem;
                    }
                }
                @media (max-width: 900px) {
                    .ptw-manual-permit-modal .manual-section-5 .ptw-manual-ppe-fixed-row {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }
            </style>
            <div class="modal-content ptw-manual-permit-modal" style="max-width: min(1720px, 99vw); width: 99%; max-height: 95vh; overflow-y: auto; padding: 0; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <!-- رأس النموذج -->
                <div class="modal-header" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-file-signature" style="font-size: 1.5rem;"></i>
                        </div>
                        <div>
                            <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0; color: white;">
                                ${isEdit ? 'تعديل تصريح عمل' : 'إصدار تصريح عمل يدوي'} – Manual Permit Entry
                            </h2>
                            <p style="font-size: 0.875rem; opacity: 0.8; margin: 4px 0 0 0;">
                                <i class="fas fa-info-circle ml-1"></i>
                                تسجيل تصريح عمل مباشر بدون دورة موافقات
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" class="ptw-manual-permit-fullscreen-btn" title="ملء الشاشة" onclick="PTW.toggleManualPermitFormFullscreen(this)" style="color: white; background: rgba(255,255,255,0.2); border: none; border-radius: 10px; cursor: pointer; padding: 0.5rem 0.75rem; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><i class="fas fa-expand"></i> <span class="ptw-manual-permit-fullscreen-label">ملء الشاشة</span></button>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; font-size: 1.5rem; background: rgba(255,255,255,0.1); border: none; width: 44px; height: 44px; border-radius: 10px; cursor: pointer; transition: all 0.3s;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                ${this.renderPermitSystemHeader()}

                <!-- نص الإعلان/التنبيه - مشابه لنموذج إصدار تصريح العمل -->
                <div style="margin: 24px 24px 0 24px; padding: 0;">
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #e1bee7 100%); border-right: 4px solid #2196F3; border-left: 4px solid #2196F3; border-radius: 12px 12px 0 0; padding: 20px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: linear-gradient(90deg, #2196F3, #673ab7, #2196F3);"></div>
                        <div style="text-align: center; padding: 12px; background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%); border-radius: 8px; border: 2px solid #bbdefb;">
                            <p style="margin: 0; font-size: 15px; line-height: 2.2; color: #1e3a5f; font-weight: 500; letter-spacing: 0.3px;">
                                تم إصدار هذا التصريح فقط للعمل الذي تم وصفه أدناه<br>
                                ولا يجوز بأي حال من الأحوال استخدامه لأي عمل آخر لم يتم وصفه<br>
                                وعليه فإنه يجب الالتزام بمدة صلاحية التصريح للعمل المذكور أدناه وفى الموقع المصرح للعمل فيه فقط.
                            </p>
                        </div>
                        <div style="margin-top: 12px; padding: 10px 16px; background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border: 2px solid #ffc107; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <i class="fas fa-hand-paper" style="color: #f57c00; font-size: 1.2rem;"></i>
                                <span style="color: #e65100; font-weight: 600; font-size: 0.9rem;">تصريح يدوي - يتم تسجيله مباشرة بدون دورة موافقات إلكترونية</span>
                            </div>
                        </div>
                        <!-- الرقم المسلسل للتصريح -->
                        <div style="margin-top: 12px; display: flex; justify-content: center; flex-direction: column; align-items: center; gap: 12px;">
                            <div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 12px 32px; border-radius: 8px; display: inline-flex; align-items: center; gap: 12px; box-shadow: 0 4px 15px rgba(30, 60, 114, 0.3);">
                                <i class="fas fa-hashtag" style="font-size: 1.3rem; opacity: 0.9;"></i>
                                <div style="text-align: center;">
                                    <span style="font-size: 0.75rem; opacity: 0.85; display: block;">رقم التصريح / Permit No.</span>
                                    <span id="manual-permit-display-number" style="font-size: 1.5rem; font-weight: 700; letter-spacing: 2px; font-family: 'Courier New', monospace;">${String(sequentialNumber).padStart(4, '0')}</span>
                                </div>
                            </div>
                            <!-- رقم التصريح الورقي -->
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                <label for="manual-paper-permit-number" style="font-size: 0.8rem; font-weight: 600; color: #1e3a5f;">
                                    رقم التصريح الورقي <span style="color: #e53e3e; font-size: 0.9rem;">*</span>
                                </label>
                                <input type="number" id="manual-paper-permit-number" min="1" step="1" placeholder="مطلوب - أدخل الرقم"
                                    value="${Utils.escapeHTML(existingEntry?.paperPermitNumber ?? '')}"
                                    style="width: 150px; text-align: center; font-size: 1.1rem; font-weight: 600; font-family: 'Courier New', monospace; padding: 8px 12px; border: 2px solid ${existingEntry?.paperPermitNumber ? '#90caf9' : '#e53e3e'}; border-radius: 8px; background: #fff; box-shadow: ${existingEntry?.paperPermitNumber ? 'none' : '0 0 0 3px rgba(229,62,62,0.1)'};">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- التثبيت يبدأ من أسفل نص الإعلان (بدون تغيير التصميم) -->
                <div class="ptw-manual-permit-sticky-start">
                <div class="modal-body" id="manual-permit-modal-body" style="padding: 24px; padding-top: 0; max-height: calc(95vh - 280px); overflow-y: scroll; background: #f8fafc; direction: ltr;">
                    <form id="manual-permit-form" style="direction: rtl;">
                        
                        <!-- القسم الأول: بيانات التصريح الأساسية -->
                        <div class="ptw-manual-form-section manual-section-1" style="margin-top: 0; border-top-left-radius: 0; border-top-right-radius: 0;">
                            <h3><i class="fas fa-info-circle"></i><span>القسم الأول : بيانات التصريح الأساسية</span></h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الموقع / القسم <span class="text-red-500">*</span></label>
                                    <select id="manual-permit-location" class="form-input transition-all focus:ring-2 focus:ring-blue-200" required>
                                        <option value="">اختر الموقع / القسم</option>
                                        ${sites.map(site => {
            let isSelected = existingEntry && (existingEntry.locationId === site.id || (existingEntry.location && (existingEntry.location.split(' - ')[0] === site.name || existingEntry.location === site.name)));
            return `<option value="${Utils.escapeHTML(site.id)}" data-site-name="${Utils.escapeHTML(site.name)}" ${isSelected ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>`;
        }).join('')}
                                    </select>
                                </div>
                                <div id="manual-permit-sublocation-wrapper" style="display: ${existingEntry?.locationId || existingEntry?.location ? 'block' : 'none'};">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">المكان الفرعي</label>
                                    <select id="manual-permit-sublocation" class="form-input transition-all focus:ring-2 focus:ring-blue-200">
                                        <option value="">اختر المكان الفرعي</option>
                                    </select>
                                    <input type="hidden" id="manual-permit-location-entries" value="${Utils.escapeHTML(JSON.stringify(existingEntry?.locationEntries || []))}">
                                    <div id="manual-selected-sublocations-container" style="display: none; margin-top: 10px;">
                                        <input type="text" id="manual-selected-sublocations-display" class="form-input transition-all focus:ring-2 focus:ring-blue-200" readonly placeholder="لا توجد أماكن فرعية مختارة">
                                        <div id="manual-selected-sublocations-list" class="flex flex-wrap gap-2 mt-2"></div>
                                        <div class="text-xs text-gray-500 mt-2">يمكن اختيار 3 أماكن فرعية كحد أقصى</div>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تاريخ البدء <span class="text-red-500">*</span></label>
                                    <input type="datetime-local" id="manual-permit-time-from" class="form-input transition-all focus:ring-2 focus:ring-blue-200" required
                                        value="${existingEntry?.timeFrom && existingEntry.timeFrom !== 'غير محدد' ? Utils.toDateTimeLocalString(existingEntry.timeFrom) : ''}">
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تاريخ الانتهاء <span class="text-red-500">*</span></label>
                                    <input type="datetime-local" id="manual-permit-time-to" class="form-input transition-all focus:ring-2 focus:ring-blue-200" required
                                        value="${existingEntry?.timeTo && existingEntry.timeTo !== 'غير محدد' ? Utils.toDateTimeLocalString(existingEntry.timeTo) : ''}">
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الجهة المصرح لها بالعمل</label>
                                    <div class="relative">
                                        <input type="text" id="manual-permit-authorized-party" class="form-input transition-all focus:ring-2 focus:ring-blue-200 w-full"
                                            ${hasApprovedEntities ? 'list="manual-authorized-party-datalist" autocomplete="off"' : ''}
                                            value="${Utils.escapeHTML(authorizedPartyValue)}"
                                            placeholder="${hasApprovedEntities ? 'اكتب للبحث في الجهات المعتمدة أو أدخل جهة يدوياً' : 'الجهة المصرح لها بالعمل'}">
                                        ${hasApprovedEntities ? `
                                        <datalist id="manual-authorized-party-datalist">
                                            ${approvedEntities.map(entity => `<option value="${Utils.escapeHTML(entity.name || '')}"></option>`).join('')}
                                        </datalist>` : ''}
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الجهة الطالبة للتصريح</label>
                                    <div class="relative">
                                        <input type="text" id="manual-permit-requesting-party" class="form-input transition-all focus:ring-2 focus:ring-blue-200 w-full"
                                            ${hasDepartments ? 'list="manual-requesting-party-datalist" autocomplete="off"' : ''}
                                            value="${Utils.escapeHTML(requestingPartyValue)}"
                                            placeholder="${hasDepartments ? 'اكتب للبحث في الإدارات أو أدخل جهة يدوياً' : 'الجهة الطالبة للتصريح (إدخال يدوي)'}">
                                        ${hasDepartments ? `
                                        <datalist id="manual-requesting-party-datalist">
                                            ${departmentOptions.map(dept => `<option value="${Utils.escapeHTML(dept)}"></option>`).join('')}
                                        </datalist>` : ''}
                                    </div>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">المعدة / الماكينة / العملية</label>
                                    <textarea id="manual-permit-equipment" class="form-input transition-all focus:ring-2 focus:ring-blue-200" rows="2" placeholder="أدخل تفاصيل المعدات أو العملية المستخدمة">${Utils.escapeHTML(existingEntry?.equipment || '')}</textarea>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الأدوات أو العدد (بعد فحصها وقبولها)</label>
                                    <textarea id="manual-permit-tools" class="form-input transition-all focus:ring-2 focus:ring-blue-200" rows="2" placeholder="أدخل قائمة الأدوات أو العدد">${Utils.escapeHTML(existingEntry?.tools || existingEntry?.toolsList || '')}</textarea>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">وصف العمل <span class="text-red-500">*</span></label>
                                    <textarea id="manual-permit-work-description" class="form-input transition-all focus:ring-2 focus:ring-blue-200" rows="4" required placeholder="وصف تفصيلي للعمل">${Utils.escapeHTML(existingEntry?.workDescription || '')}</textarea>
                                </div>
                            </div>
                            <input type="hidden" id="manual-permit-sequential" value="${sequentialNumber}">
                            <input type="hidden" id="manual-permit-date" value="${existingEntry?.openDate ? new Date(existingEntry.openDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
                            <input type="hidden" id="manual-permit-total-time" value="${Utils.escapeHTML(existingEntry?.totalTime || '')}">
                        </div>

                        <!-- القسم الثاني: أسماء القائمين بالعمل (جدول كما بالصورة) -->
                        <div class="ptw-manual-form-section manual-section-2">
                            <h3><i class="fas fa-users"></i><span>القسم الثاني : أسماء القائمين بالعمل</span></h3>
                            
                            <div class="overflow-x-auto bg-white">
                                <table class="w-full ptw-paper-grid-table" style="border-collapse: collapse; border: 1px solid #000;">
                                    <thead>
                                        <tr style="background: linear-gradient(135deg, #b3e5fc 0%, #81d4fa 100%);">
                                            <th class="p-3 text-center font-bold text-gray-900 border border-gray-800" style="width: 50%;">أسماء القائمين بالعمل</th>
                                            <th class="p-3 text-center font-bold text-gray-900 border border-gray-800" style="width: 50%; border-right: 4px solid #1e3a8a;">التوقيع</th>
                                        </tr>
                                    </thead>
                                    <tbody id="manual-team-members-list">
                                        ${(() => {
            const members = (existingEntry?.teamMembers && existingEntry.teamMembers.length) ? existingEntry.teamMembers : [{ name: '', signature: '' }];
            return members.map((member) => `
                                        <tr class="manual-team-member-row">
                                            <td class="p-2 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-team-member-name border-0 focus:ring-0" placeholder="الاسم" value="${Utils.escapeHTML(member.name || '')}"></td>
                                            <td class="p-2 border border-gray-800" style="border-right: 4px solid #1e3a8a;"><input type="text" class="form-input text-sm w-full manual-team-member-signature border-0 focus:ring-0" placeholder="التوقيع" value="${Utils.escapeHTML(member.signature || member.id || '')}"></td>
                                        </tr>
                                    `).join('');
        })()}
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" id="manual-add-team-member-btn" class="btn-secondary mt-4 hover:bg-teal-50 text-teal-700 border-teal-200">
                                <i class="fas fa-plus ml-2"></i>إضافة صف للأسفل
                            </button>
                        </div>

                        <!-- القسم الثالث: تحديد نوع/طبيعة الأعمال (حسب الصور والنص) -->
                        <div class="ptw-manual-form-section manual-section-3" style="overflow: hidden;">
                            <div class="manual-section-3-header" style="background: linear-gradient(135deg, #b3e5fc 0%, #81d4fa 50%, #4fc3f7 100%); margin: -24px -24px 0 -24px; padding: 16px 24px; text-align: center; border-bottom: 2px solid #0288d1; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px;">
                                    <i class="fas fa-clipboard-check"></i>
                                    <span>تحديد نوع / طبيعة الأعمال والعناصر التفصيلية لتنفيذ العملية</span>
                                </h3>
                            </div>
                            <div class="manual-section-3-content" style="border: 1px solid #90a4ae;">
                                <p class="text-sm text-gray-600 mb-4 p-2"><strong>خطوتان:</strong> ١) اختر نوع التصريح من القائمة على اليمين ← ٢) حدد التفاصيل أو الإدخال اليدوي في اللوحة بجانبها. تظهر الأنواع المختارة أسفل القائمة.</p>
                                <div style="display: flex; flex-direction: row; gap: 20px; flex-wrap: nowrap; align-items: flex-start;">
                                    <!-- القائمة الأساسية ثابتة اتجاه اليمين -->
                                    <div id="manual-work-type-select-wrap">
                                        <label for="manual-work-type-select">أنواع التصريح</label>
                                        <select id="manual-work-type-select" title="اختر نوعاً ثم حدد التفاصيل في اللوحة">
                                            <option value="">— اختر نوع التصريح —</option>
                                            <option value="hot">أعمال ساخنة</option>
                                            <option value="confined">أماكن مغلقة</option>
                                            <option value="height">عمل على ارتفاع</option>
                                            <option value="excavation">أعمال حفر</option>
                                            <option value="electrical">أعمال كهرباء</option>
                                            <option value="cold">أعمال على البارد</option>
                                            <option value="other">أعمال أخرى</option>
                                        </select>
                                        <div id="manual-work-type-selected-list" class="manual-selected-types-list" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e9d5ff;">
                                            <div class="manual-selected-types-title" style="font-size: 0.8rem; font-weight: 600; color: #6b21a8; margin-bottom: 8px;">أنواع التصريح المختارة</div>
                                            <div id="manual-work-type-selected-chips" style="display: flex; flex-wrap: wrap; gap: 6px; min-height: 24px;"></div>
                                            <div id="manual-work-type-selected-empty" class="manual-selected-types-empty">لم يتم اختيار أي نوع بعد</div>
                                            <div id="manual-work-type-selected-hint" class="manual-selected-types-hint" style="display: none;">انقر على أي نوع لتحرير تفاصيله</div>
                                        </div>
                                    </div>
                                    <!-- لوحة الخيارات (تفتح بالعرض عند الاختيار) -->
                                    <div id="manual-work-type-panel" class="manual-work-type-inline-panel">
                                        <div id="manual-work-type-panel-placeholder">
                                            <i class="fas fa-arrow-right" style="font-size: 1.75rem; margin-bottom: 10px; display: block; opacity: 0.7;"></i>
                                            <span>اختر نوعاً من القائمة ← ثم حدد الخيارات أو الإدخال اليدوي هنا</span>
                                        </div>
                                        <div id="manual-work-type-panel-body" style="display: none;">
                                            <div class="manual-panel-title-row">
                                                <h4 id="manual-work-type-panel-title"></h4>
                                                <span id="manual-work-type-panel-badge" class="manual-panel-type-badge" style="display: none;">مضاف</span>
                                            </div>
                                            <div id="manual-panel-hot" class="manual-type-panel-body" style="display: none;">
                                                ${['لحام', 'قطع', 'شرر/حرارة', 'أخرى'].map((opt) => `
                                                <label class="manual-opt-row" style="background: #fef2f2; border-color: #fecaca;"><input type="checkbox" name="manual-hot-work" value="${opt}" class="form-checkbox text-red-600" ${(existingEntry?.hotWorkDetails || []).includes(opt) ? 'checked' : ''}><span>${opt}</span></label>`).join('')}
                                                <div style="margin-top: 12px;"><label class="manual-other-label">إدخال يدوي</label><input type="text" id="manual-hot-work-other" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.hotWorkOther || '')}" placeholder="تفاصيل إضافية أو إدخال حر"></div>
                                            </div>
                                            <div id="manual-panel-confined" class="manual-type-panel-body" style="display: none;">
                                                ${['خزانات', 'أنابيب', 'مجاري', 'أخرى'].map((opt) => `
                                                <label class="manual-opt-row" style="background: #f9fafb; border-color: #e5e7eb;"><input type="checkbox" name="manual-confined-space" value="${opt}" class="form-checkbox text-gray-600" ${(existingEntry?.confinedSpaceDetails || []).includes(opt) ? 'checked' : ''}><span>${opt}</span></label>`).join('')}
                                                <div style="margin-top: 12px;"><label class="manual-other-label">إدخال يدوي</label><input type="text" id="manual-confined-space-other" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.confinedSpaceOther || '')}" placeholder="تفاصيل إضافية أو إدخال حر"></div>
                                            </div>
                                            <div id="manual-panel-height" class="manual-type-panel-body" style="display: none;">
                                                ${['سقالات', 'سطح', 'سلة رافعة', 'أخرى'].map((opt) => `
                                                <label class="manual-opt-row" style="background: #eff6ff; border-color: #bfdbfe;"><input type="checkbox" name="manual-height-work" value="${opt}" class="form-checkbox text-blue-600" ${(existingEntry?.heightWorkDetails || []).includes(opt) ? 'checked' : ''}><span>${opt}</span></label>`).join('')}
                                                <div style="margin-top: 12px;"><label class="manual-other-label">إدخال يدوي</label><input type="text" id="manual-height-work-other" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.heightWorkOther || '')}" placeholder="تفاصيل إضافية أو إدخال حر"></div>
                                            </div>
                                            <div id="manual-panel-excavation" class="manual-type-panel-body" style="display: none;">
                                                <label class="manual-opt-row" style="background: #fffbeb; border-color: #fef3c7;"><input type="checkbox" id="manual-excavation-check" class="form-checkbox text-yellow-600" ${(existingEntry?.excavationLength || existingEntry?.excavationWidth || existingEntry?.excavationDepth || existingEntry?.soilType) ? 'checked' : ''}><span>تطبيق أعمال حفر</span></label>
                                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
                                                    <div><label class="manual-other-label">طول</label><input type="text" id="manual-excavation-length" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.excavationLength || '')}" placeholder="—"></div>
                                                    <div><label class="manual-other-label">عرض</label><input type="text" id="manual-excavation-width" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.excavationWidth || '')}" placeholder="—"></div>
                                                    <div><label class="manual-other-label">عمق</label><input type="text" id="manual-excavation-depth" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.excavationDepth || '')}" placeholder="—"></div>
                                                    <div><label class="manual-other-label">نوع التربة</label><input type="text" id="manual-excavation-soil" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.soilType || '')}" placeholder="—"></div>
                                                </div>
                                                <div style="margin-top: 12px;"><label class="manual-other-label">إدخال يدوي</label><input type="text" id="manual-excavation-other" class="form-input manual-other-input" placeholder="ملاحظات إضافية (اختياري)"></div>
                                            </div>
                                            <div id="manual-panel-electrical" class="manual-type-panel-body" style="display: none;">
                                                <div><label class="manual-other-label">نوع العمل (من القائمة أو يدوي)</label><input type="text" id="manual-electrical-work-type" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.electricalWorkType || '')}" placeholder="مثال: تركيب، صيانة، فك، أو إدخال حر"></div>
                                            </div>
                                            <div id="manual-panel-cold" class="manual-type-panel-body" style="display: none;">
                                                <div><label class="manual-other-label">نوع العمل (من القائمة أو يدوي)</label><input type="text" id="manual-cold-work-type" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.coldWorkType || '')}" placeholder="مثال: لحام بارد، أو إدخال حر"></div>
                                            </div>
                                            <div id="manual-panel-other" class="manual-type-panel-body" style="display: none;">
                                                <div><label class="manual-other-label">نوع العمل (إدخال يدوي)</label><input type="text" id="manual-other-work-type" class="form-input manual-other-input" value="${Utils.escapeHTML(existingEntry?.otherWorkType || '')}" placeholder="اذكر نوع العمل"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- القسم الرابع: المتطلبات والمرفقات -->
                        <div class="ptw-manual-form-section manual-section-4">
                            <h3><i class="fas fa-tasks"></i><span>القسم الرابع : المتطلبات والمرفقات</span></h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <label class="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-all bg-white">
                                    <input type="checkbox" id="manual-permit-preStartChecklist" class="form-checkbox h-5 w-5 text-orange-600 rounded ml-3" ${existingEntry?.preStartChecklist ? 'checked' : ''}><span class="font-medium">قائمة التحقق بقرار بدء العمل</span>
                                </label>
                                <label class="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-all bg-white">
                                    <input type="checkbox" id="manual-permit-lotoApplied" class="form-checkbox h-5 w-5 text-orange-600 rounded ml-3" ${existingEntry?.lotoApplied ? 'checked' : ''}><span class="font-medium">تطبيق نظام العزل LOTO</span>
                                </label>
                                <label class="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-all bg-white">
                                    <input type="checkbox" id="manual-permit-governmentPermits" class="form-checkbox h-5 w-5 text-orange-600 rounded ml-3" ${existingEntry?.governmentPermits ? 'checked' : ''}><span class="font-medium">تصاريح جهات حكومية</span>
                                </label>
                                <label class="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-all bg-white">
                                    <input type="checkbox" id="manual-permit-riskAssessmentAttached" class="form-checkbox h-5 w-5 text-orange-600 rounded ml-3" ${existingEntry?.riskAssessmentAttached ? 'checked' : ''}><span class="font-medium">تحليل المخاطر ووسائل التحكم</span>
                                </label>
                                <label class="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-all bg-white">
                                    <input type="checkbox" id="manual-permit-gasTesting" class="form-checkbox h-5 w-5 text-orange-600 rounded ml-3" ${existingEntry?.gasTesting ? 'checked' : ''}><span class="font-medium">قياس الغازات</span>
                                </label>
                                <label class="flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-all bg-white">
                                    <input type="checkbox" id="manual-permit-mocRequest" class="form-checkbox h-5 w-5 text-orange-600 rounded ml-3" ${existingEntry?.mocRequest ? 'checked' : ''}><span class="font-medium">طلب تغيير فني (MOC)</span>
                                </label>
                            </div>
                        </div>

                        <!-- القسم الخامس: تحديد مهمات الوقاية -->
                        <div class="ptw-manual-form-section manual-section-5 ptw-manual-ppe-section">
                            <h3><i class="fas fa-hard-hat"></i><span>القسم الخامس : تحديد مهمات الوقاية / وسائل الوقاية الأخرى</span></h3>
                            <div class="ptw-manual-ppe-body">
                                <div id="manual-ppe-matrix">
                                    ${this.buildManualFixedPPECheckboxesHtml(manualPpeSelectedItems)}
                                </div>
                                <div class="ptw-manual-ppe-notes-frame">
                                    <label class="block">مهمات الوقاية المطلوبة (إضافي يدوي)</label>
                                    <textarea id="manual-ppe-notes" class="form-input bg-white w-full" rows="1" placeholder="إضافات نصية اختيارية...">${Utils.escapeHTML(existingEntry?.ppeNotes || (existingEntry?.requiredPPE ? existingEntry.requiredPPE.join('، ') : ''))}</textarea>
                                </div>
                            </div>
                        </div>

                        <!-- القسم السادس: مصفوفة تقييم المخاطر -->
                        <div class="ptw-manual-form-section manual-section-6">
                            <h3><i class="fas fa-exclamation-triangle"></i><span>القسم السادس : مصفوفة تقييم المخاطر</span></h3>
                            <p class="text-sm text-gray-600 mb-4 bg-white p-2 rounded border border-gray-100 inline-block">
                                <i class="fas fa-mouse-pointer text-red-500 ml-1"></i>اضغط على خلية في المصفوفة لتحديد مستوى المخاطر
                            </p>
                            
                            <!-- مصفوفة المخاطر التفاعلية (التصنيف اللوني العالمي) -->
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <div class="overflow-x-auto">
                                    <table class="w-full border-collapse text-center" id="manual-risk-matrix-table">
                                        <thead>
                                            <tr>
                                                <th class="p-2 bg-gray-100 border border-gray-400 font-bold text-sm" rowspan="2">الاحتمالية</th>
                                                <th class="p-2 text-white border border-gray-400 font-bold" colspan="5" style="background: #374151;">الخطورة (العواقب)</th>
                                            </tr>
                                            <tr>
                                                <th class="p-2 border border-gray-400 text-xs font-semibold" style="background: #dcfce7; color: #166534;">1 - طفيف</th>
                                                <th class="p-2 border border-gray-400 text-xs font-semibold" style="background: #fef9c3; color: #854d0e;">2 - بسيط</th>
                                                <th class="p-2 border border-gray-400 text-xs font-semibold" style="background: #ffedd5; color: #9a3412;">3 - متوسط</th>
                                                <th class="p-2 border border-gray-400 text-xs font-semibold" style="background: #fed7aa; color: #c2410c;">4 - خطير</th>
                                                <th class="p-2 border border-gray-400 text-xs font-semibold text-white" style="background: #b91c1c;">5 - كارثي</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${[5, 4, 3, 2, 1].map(likelihood => {
            const likelihoodLabels = { 5: 'شبه مؤكد', 4: 'محتمل جداً', 3: 'محتمل', 2: 'غير محتمل', 1: 'نادر' };
            return `<tr>
                                                <td class="p-2 bg-gray-100 border border-gray-400 font-semibold text-sm">${likelihood} - ${likelihoodLabels[likelihood]}</td>
                                                ${[1, 2, 3, 4, 5].map(consequence => {
                const riskScore = likelihood * consequence;
                let bgColor = ''; let textColor = ''; let hoverBg = ''; let riskLevel = '';
                if (riskScore <= 4) { bgColor = '#22c55e'; textColor = '#ffffff'; hoverBg = '#16a34a'; riskLevel = 'منخفض'; }
                else if (riskScore <= 9) { bgColor = '#eab308'; textColor = '#1c1917'; hoverBg = '#ca8a04'; riskLevel = 'متوسط'; }
                else if (riskScore <= 16) { bgColor = '#f97316'; textColor = '#ffffff'; hoverBg = '#ea580c'; riskLevel = 'مرتفع'; }
                else { bgColor = '#dc2626'; textColor = '#ffffff'; hoverBg = '#b91c1c'; riskLevel = 'حرج'; }
                const isSelected = existingEntry?.riskLikelihood == likelihood && existingEntry?.riskConsequence == consequence;
                return `<td class="p-0 border border-gray-400">
                                                    <button type="button" class="manual-risk-cell w-full h-full p-3 font-bold cursor-pointer transition-all border-0 ${isSelected ? 'ring-4 ring-blue-600 ring-inset' : ''}" data-likelihood="${likelihood}" data-consequence="${consequence}" data-score="${riskScore}" data-level="${riskLevel}" data-bg="${bgColor}" data-text="${textColor}" data-hover="${hoverBg}" style="background: ${bgColor}; color: ${textColor};">
                                                        ${riskScore}
                                                    </button>
                                                </td>`;
            }).join('')}
                                            </tr>`;
        }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                
                                <!-- وسيلة إيضاح التصنيف اللوني العالمي -->
                                <div class="mt-3 flex flex-wrap gap-4 justify-center text-sm">
                                    <span class="inline-flex items-center gap-2"><span class="w-5 h-5 rounded border border-gray-400" style="background: #22c55e;"></span> منخفض (1-4)</span>
                                    <span class="inline-flex items-center gap-2"><span class="w-5 h-5 rounded border border-gray-400" style="background: #eab308;"></span> متوسط (5-9)</span>
                                    <span class="inline-flex items-center gap-2"><span class="w-5 h-5 rounded border border-gray-400" style="background: #f97316;"></span> مرتفع (10-16)</span>
                                    <span class="inline-flex items-center gap-2"><span class="w-5 h-5 rounded border border-gray-400" style="background: #dc2626;"></span> حرج (17-25)</span>
                                </div>
                                
                                <!-- نتيجة تقييم المخاطر -->
                                <div id="manual-risk-result" class="mt-4 p-4 rounded-lg border-2 ${existingEntry?.riskScore ? '' : 'hidden'}" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                                    <div class="flex items-center justify-between flex-wrap gap-4">
                                        <div class="flex items-center gap-3">
                                            <div id="manual-risk-result-badge" class="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl shadow-lg" style="background: ${existingEntry?.riskScore <= 4 ? '#22c55e' : existingEntry?.riskScore <= 9 ? '#eab308' : existingEntry?.riskScore <= 16 ? '#f97316' : '#dc2626'}; color: ${existingEntry?.riskScore > 4 && existingEntry?.riskScore <= 9 ? '#1c1917' : '#ffffff'};">
                                                ${existingEntry?.riskScore || '?'}
                                            </div>
                                            <div>
                                                <p class="font-bold text-gray-800 text-lg">درجة المخاطر: <span id="manual-risk-score-display">${existingEntry?.riskScore || '—'}</span></p>
                                                <p class="text-gray-600">مستوى المخاطر: <span id="manual-risk-level-display" class="font-semibold">${existingEntry?.riskLevel || '—'}</span></p>
                                            </div>
                                        </div>
                                        <div class="text-sm text-gray-500">
                                            <p>الاحتمالية: <span id="manual-risk-likelihood-display" class="font-semibold">${existingEntry?.riskLikelihood || '—'}</span></p>
                                            <p>الخطورة: <span id="manual-risk-consequence-display" class="font-semibold">${existingEntry?.riskConsequence || '—'}</span></p>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- حقول مخفية -->
                                <input type="hidden" id="manual-risk-likelihood" value="${existingEntry?.riskLikelihood || ''}">
                                <input type="hidden" id="manual-risk-consequence" value="${existingEntry?.riskConsequence || ''}">
                                <input type="hidden" id="manual-risk-score" value="${existingEntry?.riskScore || ''}">
                                <input type="hidden" id="manual-risk-level" value="${existingEntry?.riskLevel || ''}">
                            </div>
                            
                            <div class="mt-4 bg-red-50 p-4 rounded-lg border border-red-100">
                                <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-sticky-note ml-2 text-red-500"></i>ملاحظات تقييم المخاطر</label>
                                <textarea id="manual-risk-notes" class="form-input bg-white" rows="3" placeholder="ملاحظات إضافية حول المخاطر المحتملة...">${Utils.escapeHTML(existingEntry?.riskNotes || '')}</textarea>
                            </div>
                        </div>

                        <!-- القسم السابع: دائرة الاعتمادات (كما بالصورة) -->
                        <div class="ptw-manual-form-section manual-section-7">
                            <h3><i class="fas fa-signature"></i><span>القسم السابع : دائرة الاعتمادات</span></h3>
                            
                            <!-- اعتماد التصريح (يشترط جميع التوقيعات لبدء العمل) -->
                            <div class="overflow-x-auto bg-white">
                                <table class="w-full ptw-paper-grid-table" style="border-collapse: collapse; border: 1px solid #000;">
                                    <thead>
                                        <tr>
                                            <th colspan="5" class="p-3 text-center font-bold text-white" style="background: linear-gradient(135deg, #81d4fa 0%, #4fc3f7 100%); border: 1px solid #0288d1;">
                                                اعتماد التصريح (يشترط جميع التوقيعات لبدء العمل)
                                            </th>
                                        </tr>
                                        <tr style="background: #e3f2fd; border: 1px solid #000;">
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 12%;">الاسم / التوقيع</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مسئول الجهة الطالبة</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مدير منطقة الأعمال</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مدير / مهندس الصيانة</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مسئول السلامة والصحة المهنية</th>
                                        </tr>
                                    </thead>
                                    <tbody id="manual-approvals-list">
                                        <tr class="manual-approval-row" style="border: 1px solid #000;">
                                            <td class="p-1 border border-gray-800 text-center bg-gray-50 font-medium text-sm">الاسم</td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-name" data-role="مسئول الجهة الطالبة" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مسئول الجهة الطالبة')?.name || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-name" data-role="مدير منطقة الأعمال" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مدير منطقة الأعمال')?.name || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-name" data-role="مدير / مهندس الصيانة" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مدير / مهندس الصيانة')?.name || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-name" data-role="مسئول السلامة والصحة المهنية" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مسئول السلامة والصحة المهنية')?.name || '')}"></td>
                                        </tr>
                                        <tr class="manual-approval-row" style="border: 1px solid #000;">
                                            <td class="p-1 border border-gray-800 text-center bg-gray-50 font-medium text-sm">التوقيع</td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-sig" data-role="مسئول الجهة الطالبة" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مسئول الجهة الطالبة')?.signature || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-sig" data-role="مدير منطقة الأعمال" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مدير منطقة الأعمال')?.signature || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-sig" data-role="مدير / مهندس الصيانة" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مدير / مهندس الصيانة')?.signature || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-approval-sig" data-role="مسئول السلامة والصحة المهنية" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualApprovals || []).find(a => a.role === 'مسئول السلامة والصحة المهنية')?.signature || '')}"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- القسم الثامن: إغلاق التصريح -->
                        <div class="ptw-manual-form-section manual-section-8">
                            <h3><i class="fas fa-lock"></i><span>القسم الثامن : إغلاق التصريح</span></h3>
                            <div class="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-6 shadow-md" style="text-align: center;">
                                <p class="text-gray-800 text-base leading-relaxed font-medium" style="line-height: 2.2; color: #1e40af;">
                                    <i class="fas fa-check-circle text-green-600 ml-2"></i>
                                    تم متابعة العمل حتى النهاية وتم فحص موقع العمل والمواقع المجاورة له والتأكد من خلوها من الأخطار المحتمل حدوثها
                                    <i class="fas fa-check-circle text-green-600 mr-2"></i>
                                </p>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                ${statusOptions.map((status, idx) => {
            const statusStyles = { 'اكتمل العمل بشكل آمن': { icon: 'fa-check-circle', color: '#4caf50', bg: '#e8f5e9' }, 'لم يكتمل العمل': { icon: 'fa-pause-circle', color: '#ff9800', bg: '#fff3e0' }, 'إغلاق جبري': { icon: 'fa-exclamation-circle', color: '#f44336', bg: '#ffebee' } };
            const style = statusStyles[status];
            const isSelected = effectiveManualStatus === status;
            return `<label class="flex items-center space-x-2 space-x-reverse cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-opacity-80 transition-all" style="background: ${isSelected ? style.bg : 'white'}; border-color: ${isSelected ? style.color : '#e5e7eb'};">
                                    <input type="radio" name="manual-permit-status-radio" value="${Utils.escapeHTML(status)}" class="form-radio h-5 w-5" style="accent-color: ${style.color};" ${isSelected ? 'checked' : ''} onchange="document.getElementById('manual-permit-status').value = this.value;">
                                    <i class="fas ${style.icon}" style="color: ${style.color};"></i>
                                    <span class="font-medium text-gray-700">${Utils.escapeHTML(status)}</span>
                                </label>`;
        }).join('')}
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label class="block text-sm font-bold text-gray-700 mb-2">وقت الإغلاق:</label><input type="datetime-local" id="manual-closure-time" class="form-input" value="${existingEntry?.closureDate ? Utils.toDateTimeLocalString(existingEntry.closureDate) : ''}"></div>
                                <div><label class="block text-sm font-bold text-gray-700 mb-2">السبب:</label><input type="text" id="manual-closure-reason" class="form-input" value="${Utils.escapeHTML(existingEntry?.closureReason || '')}" placeholder="اذكر سبب الإغلاق"></div>
                            </div>
                            <input type="hidden" id="manual-permit-status" value="${Utils.escapeHTML(effectiveManualStatus)}">
                        </div>

                        <!-- القسم التاسع: اعتماد إغلاق التصريح (نفس تصميم القسم السابع - كما بالصورة) -->
                        <div class="ptw-manual-form-section manual-section-9">
                            <h3><i class="fas fa-check-circle"></i><span>القسم التاسع : اعتماد إغلاق التصريح</span></h3>
                            
                            <!-- اعتماد اغلاق التصريح (يشترط جميع التوقيعات) -->
                            <div class="overflow-x-auto bg-white">
                                <table class="w-full ptw-paper-grid-table" style="border-collapse: collapse; border: 1px solid #000;">
                                    <thead>
                                        <tr>
                                            <th colspan="5" class="p-3 text-center font-bold text-gray-900" style="background: linear-gradient(135deg, #81d4fa 0%, #4fc3f7 100%); border: 1px solid #0288d1;">
                                                اعتماد اغلاق التصريح ( يشترط جميع التوقيعات)
                                            </th>
                                        </tr>
                                        <tr style="background: #e3f2fd; border: 1px solid #000;">
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 12%;">الاسم / التوقيع</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مسؤول الجهة الطالبة</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مدير منطقة الأعمال</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مسؤول السلامة والصحة المهنية</th>
                                            <th class="p-2 text-center font-semibold text-sm border border-gray-800" style="width: 22%;">مدير السلامة والصحة المهنية</th>
                                        </tr>
                                    </thead>
                                    <tbody id="manual-closure-approvals-list">
                                        <tr class="manual-closure-approval-row" style="border: 1px solid #000;">
                                            <td class="p-1 border border-gray-800 text-center bg-gray-50 font-medium text-sm">الاسم</td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-name" data-role="مسؤول الجهة الطالبة" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مسؤول الجهة الطالبة')?.name || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-name" data-role="مدير منطقة الأعمال" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مدير منطقة الأعمال')?.name || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-name" data-role="مسؤول السلامة والصحة المهنية" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مسؤول السلامة والصحة المهنية')?.name || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-name" data-role="مدير السلامة والصحة المهنية" placeholder="الاسم" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مدير السلامة والصحة المهنية')?.name || '')}"></td>
                                        </tr>
                                        <tr class="manual-closure-approval-row" style="border: 1px solid #000;">
                                            <td class="p-1 border border-gray-800 text-center bg-gray-50 font-medium text-sm">التوقيع</td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-sig" data-role="مسؤول الجهة الطالبة" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مسؤول الجهة الطالبة')?.signature || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-sig" data-role="مدير منطقة الأعمال" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مدير منطقة الأعمال')?.signature || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-sig" data-role="مسؤول السلامة والصحة المهنية" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مسؤول السلامة والصحة المهنية')?.signature || '')}"></td>
                                            <td class="p-1 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-closure-approval-sig" data-role="مدير السلامة والصحة المهنية" placeholder="التوقيع" value="${Utils.escapeHTML((existingEntry?.manualClosureApprovals || []).find(a => a.role === 'مدير السلامة والصحة المهنية')?.signature || '')}"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- القسم العاشر: مسؤولي المتابعة -->
                        <div class="ptw-manual-form-section manual-section-10">
                            <h3><i class="fas fa-user-tie"></i><span>القسم العاشر : مسؤولي المتابعة</span></h3>
                            <p class="text-sm text-gray-600 mb-4 bg-white p-2 rounded border border-gray-100 inline-block">
                                <i class="fas fa-info-circle text-indigo-500 ml-1"></i>أدخل أسماء المسؤولين عن متابعة العمل
                            </p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-user-tie ml-2 text-indigo-600"></i>مسؤول المتابعة الأول</label>
                                    <select id="manual-permit-supervisor1" ${manualSupervisorSelectAttrs}>
                                        ${buildManualSupervisorOptions('اختر مسؤول المتابعة الأول', existingEntry?.supervisor1)}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-user-tie ml-2 text-indigo-600"></i>مسؤول المتابعة الثاني</label>
                                    <select id="manual-permit-supervisor2" ${manualSupervisorSelectAttrs}>
                                        ${buildManualSupervisorOptions('اختر مسؤول المتابعة الثاني', existingEntry?.supervisor2)}
                                    </select>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                <!-- أزرار الإجراءات -->
                <div class="pt-6 border-t-2 border-gray-200" style="padding: 20px 24px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
                    <button type="button" class="btn-secondary" data-action="close" style="padding: 14px 32px; font-weight: 600; border-radius: 10px;">
                        <i class="fas fa-times ml-2"></i>إلغاء
                    </button>
                    <button type="submit" form="manual-permit-form" class="btn-primary" style="padding: 14px 40px; font-weight: 600; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 10px; box-shadow: 0 4px 15px rgba(30, 60, 114, 0.3);">
                        <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل التصريح'}
                    </button>
                </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm(PTW._t('module.ptw.form.analysis.closeUnsaved', 'تنبيه: سيتم إغلاق النموذج.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) close();
            }
        });

        // إزالة تلوين الخطأ الأحمر عن حقل رقم التصريح الورقي عند بدء الكتابة
        const paperPermitInput = modal.querySelector('#manual-paper-permit-number');
        if (paperPermitInput) {
            paperPermitInput.addEventListener('input', () => {
                paperPermitInput.style.border = '2px solid #90caf9';
                paperPermitInput.style.boxShadow = 'none';
            });
        }

        // حساب إجمالي الوقت تلقائياً
        const timeFromInput = modal.querySelector('#manual-permit-time-from');
        const timeToInput = modal.querySelector('#manual-permit-time-to');
        const totalTimeInput = modal.querySelector('#manual-permit-total-time');

        const calculateTotalTime = () => {
            const timeFrom = timeFromInput.value;
            const timeTo = timeToInput.value;
            if (!timeFrom || !timeTo) {
                totalTimeInput.value = '';
                return;
            }
            totalTimeInput.value = this.calculateTotalTime(timeFrom, timeTo);
            return;
            if (timeFrom && timeTo) {
                try {
                    const start = new Date(timeFrom);
                    const end = new Date(timeTo);
                    const diffMs = end - start;
                    if (diffMs >= 0) {
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        if (diffHours === 0) {
                            totalTimeInput.value = `${diffMinutes} دقيقة`;
                        } else if (diffMinutes === 0) {
                            totalTimeInput.value = `${diffHours} ساعة`;
                        } else {
                            totalTimeInput.value = `${diffHours} ساعة و ${diffMinutes} دقيقة`;
                        }
                    } else {
                        totalTimeInput.value = 'غير صحيح';
                    }
                } catch (error) {
                    totalTimeInput.value = 'خطأ';
                }
            } else {
                totalTimeInput.value = '';
            }
        };

        timeFromInput?.addEventListener('change', calculateTotalTime);
        timeToInput?.addEventListener('change', calculateTotalTime);

        // حساب الوقت عند التحميل إذا كانت البيانات موجودة
        if (existingEntry?.timeFrom && existingEntry?.timeTo) {
            calculateTotalTime();
        }

        // تحديث قائمة المواقع الفرعية مع اختيار تراكمي من القائمة المنسدلة بحد أقصى 3
        const locationSelect = modal.querySelector('#manual-permit-location');
        const sublocationWrapper = modal.querySelector('#manual-permit-sublocation-wrapper');
        const sublocationSelect = modal.querySelector('#manual-permit-sublocation');
        const locationEntriesInput = modal.querySelector('#manual-permit-location-entries');
        const selectedSublocationsContainer = modal.querySelector('#manual-selected-sublocations-container');
        const selectedSublocationsDisplay = modal.querySelector('#manual-selected-sublocations-display');
        const selectedSublocationsList = modal.querySelector('#manual-selected-sublocations-list');
        const maxSublocationSelections = 3;
        const selectedLocationEntries = [];

        const normalizeLocationEntry = (entry) => ({
            locationId: String(entry?.locationId || '').trim(),
            location: String(entry?.location || '').trim(),
            sublocationId: String(entry?.sublocationId || '').trim(),
            sublocation: String(entry?.sublocation || '').trim()
        });

        const syncSelectedLocationEntries = () => {
            if (locationEntriesInput) {
                locationEntriesInput.value = JSON.stringify(selectedLocationEntries);
            }
        };

        const renderSelectedSublocations = () => {
            if (!selectedSublocationsContainer || !selectedSublocationsDisplay || !selectedSublocationsList) return;
            const labels = selectedLocationEntries.map(entry => entry.sublocation || entry.location).filter(Boolean);
            const hasSelections = labels.length > 0;

            selectedSublocationsContainer.style.display = hasSelections ? 'block' : 'none';
            selectedSublocationsDisplay.value = hasSelections ? labels.join('، ') : '';
            selectedSublocationsList.innerHTML = selectedLocationEntries.map((entry, index) => `
                <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                    ${Utils.escapeHTML(entry.sublocation || entry.location)}
                    <button type="button" class="manual-remove-sublocation-btn text-blue-700 hover:text-red-600" data-index="${index}" style="background:none;border:none;cursor:pointer;font-size:14px;line-height:1;">×</button>
                </span>
            `).join('');

            selectedSublocationsList.querySelectorAll('.manual-remove-sublocation-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const index = Number(button.getAttribute('data-index'));
                    if (Number.isInteger(index) && index >= 0) {
                        selectedLocationEntries.splice(index, 1);
                        syncSelectedLocationEntries();
                        renderSelectedSublocations();
                    }
                });
            });
        };

        const populateSublocationOptions = (selectedSiteId) => {
            if (!sublocationSelect || !sublocationWrapper) return;
            if (!selectedSiteId) {
                sublocationWrapper.style.display = 'none';
                sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';
                return;
            }

            const places = this.getPlaceOptions(selectedSiteId);
            if (!Array.isArray(places) || places.length === 0) {
                sublocationWrapper.style.display = 'none';
                sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';
                return;
            }

            sublocationWrapper.style.display = 'block';
            sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>' + places.map(place => `
                <option value="${Utils.escapeHTML(place.id)}" data-place-name="${Utils.escapeHTML(place.name)}">${Utils.escapeHTML(place.name)}</option>
            `).join('');
            sublocationSelect.value = '';
        };

        const addSelectedSublocationFromDropdown = () => {
            if (!locationSelect || !sublocationSelect) return;
            const selectedSiteId = String(locationSelect.value || '').trim();
            const selectedSiteName = locationSelect.options[locationSelect.selectedIndex]?.getAttribute('data-site-name')
                || locationSelect.options[locationSelect.selectedIndex]?.textContent
                || '';
            const selectedSublocationId = String(sublocationSelect.value || '').trim();
            const selectedSublocationOption = sublocationSelect.options[sublocationSelect.selectedIndex];
            const selectedSublocationName = selectedSublocationOption?.getAttribute('data-place-name')
                || (selectedSublocationOption?.value ? selectedSublocationOption.textContent : '')
                || '';

            if (!selectedSiteId || !selectedSiteName || !selectedSublocationId || !selectedSublocationName) {
                return;
            }

            const duplicate = selectedLocationEntries.some(entry =>
                entry.locationId === selectedSiteId && entry.sublocationId === selectedSublocationId
            );
            if (duplicate) {
                Notification.warning(this._t('module.ptw.notify.sublocDup', 'تم اختيار هذا المكان الفرعي بالفعل'));
                sublocationSelect.value = '';
                return;
            }

            if (selectedLocationEntries.length >= maxSublocationSelections) {
                Notification.warning(this._t('module.ptw.notify.sublocMax3', 'يمكن اختيار 3 أماكن فرعية فقط كحد أقصى'));
                sublocationSelect.value = '';
                return;
            }

            selectedLocationEntries.push(normalizeLocationEntry({
                locationId: selectedSiteId,
                location: selectedSiteName.trim(),
                sublocationId: selectedSublocationId,
                sublocation: selectedSublocationName.trim()
            }));
            syncSelectedLocationEntries();
            renderSelectedSublocations();
            sublocationSelect.value = '';
        };

        const parseExistingSelectedSublocations = () => {
            let parsedEntries = [];
            if (locationEntriesInput?.value) {
                try {
                    const raw = JSON.parse(locationEntriesInput.value);
                    if (Array.isArray(raw)) parsedEntries = raw;
                } catch (error) {
                    parsedEntries = [];
                }
            }

            if ((!parsedEntries || parsedEntries.length === 0) && (existingEntry?.location || existingEntry?.sublocation)) {
                const siteId = String(existingEntry?.locationId || locationSelect?.value || '').trim();
                const selectedSiteName = String(
                    locationSelect?.options[locationSelect?.selectedIndex]?.getAttribute('data-site-name')
                    || ''
                ).trim();
                const rawLocationSegments = String(existingEntry?.location || '')
                    .split('|')
                    .map(item => item.trim())
                    .filter(Boolean);
                const rawSublocationIds = String(existingEntry?.sublocationId || '')
                    .split('|')
                    .map(item => item.trim())
                    .filter(Boolean);
                const rawSublocationNames = String(existingEntry?.sublocation || '')
                    .split('|')
                    .map(item => item.trim())
                    .filter(Boolean);

                if (rawSublocationNames.length > 0) {
                    parsedEntries = rawSublocationNames.map((name, index) => ({
                        locationId: siteId,
                        location: selectedSiteName || rawLocationSegments[0]?.split(' - ')[0] || existingEntry?.location || '',
                        sublocationId: rawSublocationIds[index] || '',
                        sublocation: name
                    }));
                } else {
                    parsedEntries = rawLocationSegments.map((segment, index) => {
                        const separatorIndex = segment.indexOf(' - ');
                        if (separatorIndex === -1) {
                            return {
                                locationId: siteId,
                                location: segment,
                                sublocationId: rawSublocationIds[index] || '',
                                sublocation: ''
                            };
                        }

                        return {
                            locationId: siteId,
                            location: segment.slice(0, separatorIndex).trim(),
                            sublocationId: rawSublocationIds[index] || '',
                            sublocation: segment.slice(separatorIndex + 3).trim()
                        };
                    });
                }
            }

            parsedEntries
                .map(normalizeLocationEntry)
                .filter(entry => entry.location && entry.sublocation)
                .slice(0, maxSublocationSelections)
                .forEach(entry => selectedLocationEntries.push(entry));

            syncSelectedLocationEntries();
            renderSelectedSublocations();
        };

        locationSelect?.addEventListener('change', () => {
            selectedLocationEntries.length = 0;
            syncSelectedLocationEntries();
            renderSelectedSublocations();
            populateSublocationOptions(locationSelect.value);
        });

        sublocationSelect?.addEventListener('change', addSelectedSublocationFromDropdown);

        populateSublocationOptions(locationSelect?.value);
        parseExistingSelectedSublocations();

        // مزامنة حقل المعدة/الماكينة/العملية مع حقل الأدوات أو العدد تلقائياً
        const equipmentInput = modal.querySelector('#manual-permit-equipment');
        const toolsInput = modal.querySelector('#manual-permit-tools');
        if (equipmentInput && toolsInput) {
            const syncToolsFromEquipment = () => {
                const equipmentValue = String(equipmentInput.value || '').trim();
                const currentTools = String(toolsInput.value || '').trim();
                const previousAuto = String(equipmentInput.dataset.autoToolsValue || '').trim();
                if (!currentTools || currentTools === previousAuto) {
                    toolsInput.value = equipmentValue;
                    equipmentInput.dataset.autoToolsValue = equipmentValue;
                }
            };
            syncToolsFromEquipment();
            equipmentInput.addEventListener('input', syncToolsFromEquipment);
        }

        // نسخ الاسم للتوقيع (القسم الثاني - أعضاء الفريق)
        const attachAutoCopySignature = (nameInput, signatureInput) => {
            if (!nameInput || !signatureInput) return;
            const syncSignature = () => {
                const currentName = String(nameInput.value || '').trim();
                const currentSignature = String(signatureInput.value || '').trim();
                const previousAutoValue = nameInput.dataset.autoCopiedValue || '';
                if (!currentSignature || currentSignature === previousAutoValue) {
                    signatureInput.value = currentName;
                    nameInput.dataset.autoCopiedValue = currentName;
                }
            };
            syncSignature();
            nameInput.addEventListener('input', syncSignature);
        };

        const attachAutoCopyToTeamRow = (row) => {
            attachAutoCopySignature(
                row?.querySelector('.manual-team-member-name'),
                row?.querySelector('.manual-team-member-signature')
            );
        };

        const attachAutoCopyToApprovals = (listSelector, nameSelector, sigSelector) => {
            const list = modal.querySelector(listSelector);
            if (!list) return;

            const syncRow = (nameInput) => {
                const role = nameInput?.dataset.role;
                if (!role) return;
                const signatureInput = list.querySelector(`${sigSelector}[data-role="${role}"]`);
                attachAutoCopySignature(nameInput, signatureInput);
            };

            list.querySelectorAll(nameSelector).forEach(syncRow);
            list.addEventListener('input', (event) => {
                if (event.target.matches(nameSelector)) {
                    syncRow(event.target);
                }
            });
        };

        modal.querySelectorAll('#manual-team-members-list tr.manual-team-member-row').forEach(attachAutoCopyToTeamRow);
        attachAutoCopyToApprovals('#manual-approvals-list', '.manual-approval-name', '.manual-approval-sig');
        attachAutoCopyToApprovals('#manual-closure-approvals-list', '.manual-closure-approval-name', '.manual-closure-approval-sig');

        // القائمة الأساسية ثابتة يمين؛ عند الاختيار من القائمة تفتح اللوحة بالعرض بجانبها
        const panel = modal.querySelector('#manual-work-type-panel');
        const panelPlaceholder = modal.querySelector('#manual-work-type-panel-placeholder');
        const panelBody = modal.querySelector('#manual-work-type-panel-body');
        const panelTitle = modal.querySelector('#manual-work-type-panel-title');
        const typeSelect = modal.querySelector('#manual-work-type-select');
        const selectedChipsContainer = modal.querySelector('#manual-work-type-selected-chips');
        const typeMap = { hot: 'manual-panel-hot', confined: 'manual-panel-confined', height: 'manual-panel-height', excavation: 'manual-panel-excavation', electrical: 'manual-panel-electrical', cold: 'manual-panel-cold', other: 'manual-panel-other' };
        const labelMap = { hot: 'أعمال ساخنة', confined: 'أماكن مغلقة', height: 'عمل على ارتفاع', excavation: 'أعمال حفر', electrical: 'أعمال كهرباء', cold: 'أعمال على البارد', other: 'أعمال أخرى' };
        const selectedTypesList = [];
        const selectedEmptyEl = modal.querySelector('#manual-work-type-selected-empty');
        const selectedHintEl = modal.querySelector('#manual-work-type-selected-hint');
        const panelBadgeEl = modal.querySelector('#manual-work-type-panel-badge');
        const updatePanelBadge = () => {
            if (!panelBadgeEl || !typeSelect) return;
            const inList = selectedTypesList.some(s => s.typeKey === typeSelect.value);
            panelBadgeEl.style.display = typeSelect.value && inList ? 'inline-block' : 'none';
        };
        const renderSelectedTypes = () => {
            if (!selectedChipsContainer) return;
            const hasChips = selectedTypesList.length > 0;
            if (selectedEmptyEl) selectedEmptyEl.style.display = hasChips ? 'none' : 'block';
            if (selectedHintEl) selectedHintEl.style.display = hasChips ? 'block' : 'none';
            selectedChipsContainer.innerHTML = selectedTypesList.map(({ typeKey, label }) =>
                `<span class="manual-selected-type-chip" data-type="${typeKey}" title="انقر لتحرير تفاصيل: ${label}" role="button" tabindex="0" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; background: #ede9fe; color: #5b21b6; font-size: 0.8rem; font-weight: 500;">${label}</span>`
            ).join('');
            selectedChipsContainer.querySelectorAll('.manual-selected-type-chip').forEach(chip => {
                chip.addEventListener('click', function() {
                    const t = this.getAttribute('data-type');
                    if (t && typeSelect) { typeSelect.value = t; typeSelect.dispatchEvent(new Event('change')); updatePanelBadge(); }
                });
                chip.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } });
            });
            updatePanelBadge();
        };
        const addCurrentTypeToSelected = () => {
            const type = typeSelect?.value;
            const label = type ? (labelMap[type] || type) : '';
            if (!type || !label || selectedTypesList.some(s => s.typeKey === type)) return;
            selectedTypesList.push({ typeKey: type, label });
            renderSelectedTypes();
            updatePanelBadge();
        };
        if (typeSelect && panel && panelBody) {
            typeSelect.addEventListener('change', function() {
                const type = this.value;
                const label = labelMap[type] || type;
                if (!type) {
                    if (panelPlaceholder) panelPlaceholder.style.display = 'block';
                    panelBody.style.display = 'none';
                    if (panelBadgeEl) panelBadgeEl.style.display = 'none';
                    return;
                }
                if (panelPlaceholder) panelPlaceholder.style.display = 'none';
                panelBody.style.display = 'block';
                (panel.querySelectorAll('.manual-type-panel-body') || []).forEach(el => { el.style.display = 'none'; });
                const bodyEl = modal.querySelector('#' + (typeMap[type] || ''));
                if (bodyEl) {
                    bodyEl.style.display = 'block';
                    if (panelTitle) panelTitle.textContent = label;
                }
                updatePanelBadge();
            });
            panelBody.addEventListener('change', function(e) {
                if (e.target.matches('input[type="checkbox"], input[type="text"], input[type="number"]')) addCurrentTypeToSelected();
            });
            panelBody.addEventListener('input', function(e) {
                if (e.target.matches('input[type="text"], input[type="number"]')) addCurrentTypeToSelected();
            });
        }
        if (existingEntry) {
            const addIf = (cond, typeKey) => { if (cond && !selectedTypesList.some(s => s.typeKey === typeKey)) selectedTypesList.push({ typeKey, label: labelMap[typeKey] }); };
            addIf((existingEntry.hotWorkDetails && existingEntry.hotWorkDetails.length) || existingEntry.hotWorkOther, 'hot');
            addIf((existingEntry.confinedSpaceDetails && existingEntry.confinedSpaceDetails.length) || existingEntry.confinedSpaceOther, 'confined');
            addIf((existingEntry.heightWorkDetails && existingEntry.heightWorkDetails.length) || existingEntry.heightWorkOther, 'height');
            addIf(existingEntry.excavationLength || existingEntry.excavationWidth || existingEntry.excavationDepth || existingEntry.soilType, 'excavation');
            addIf(existingEntry.electricalWorkType, 'electrical');
            addIf(existingEntry.coldWorkType, 'cold');
            addIf(existingEntry.otherWorkType, 'other');
        }
        renderSelectedTypes();

        // التحقق من اختيار حالة التصريح
        const statusRadios = modal.querySelectorAll('input[name="manual-permit-status-radio"]');
        const statusHiddenInput = modal.querySelector('#manual-permit-status');
        
        // تعيين القيمة الأولية للحالة
        if (existingEntry?.status) {
            statusRadios.forEach(radio => {
                if (radio.value === existingEntry.status) {
                    radio.checked = true;
                    statusHiddenInput.value = radio.value;
                    // تحديث تنسيق البطاقة
                    const label = radio.closest('label');
                    if (label) {
                        const statusStyles = {
                            'اكتمل العمل بشكل آمن': { color: '#4caf50', bg: '#e8f5e9' },
                            'لم يكتمل العمل': { color: '#ff9800', bg: '#fff3e0' },
                            'إغلاق جبري': { color: '#f44336', bg: '#ffebee' }
                        };
                        const style = statusStyles[radio.value];
                        if (style) {
                            label.style.borderColor = style.color;
                            label.style.background = style.bg;
                        }
                    }
                }
            });
        }

        // معالجة إضافة صف (أسماء القائمين بالعمل / التوقيع)
        modal.querySelector('#manual-add-team-member-btn')?.addEventListener('click', () => {
            const tbody = modal.querySelector('#manual-team-members-list');
            if (!tbody) return;
            const tr = document.createElement('tr');
            tr.className = 'manual-team-member-row';
            tr.innerHTML = `
                <td class="p-2 border border-gray-800"><input type="text" class="form-input text-sm w-full manual-team-member-name border-0 focus:ring-0" placeholder="الاسم" value=""></td>
                <td class="p-2 border border-gray-800" style="border-right: 4px solid #1e3a8a;"><input type="text" class="form-input text-sm w-full manual-team-member-signature border-0 focus:ring-0" placeholder="التوقيع" value=""></td>
            `;
            tbody.appendChild(tr);
            attachAutoCopyToTeamRow(tr);
        });

        // معالجة الضغط على مصفوفة المخاطر (التصنيف اللوني العالمي)
        modal.querySelectorAll('.manual-risk-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const likelihood = cell.dataset.likelihood;
                const consequence = cell.dataset.consequence;
                const score = cell.dataset.score;
                const level = cell.dataset.level;
                const bgColor = cell.dataset.bg || '#22c55e';
                const textColor = cell.dataset.text || '#ffffff';
                
                // إزالة التحديد من جميع الخلايا
                modal.querySelectorAll('.manual-risk-cell').forEach(c => {
                    c.classList.remove('ring-4', 'ring-blue-500', 'ring-blue-600', 'ring-inset');
                });
                
                // تحديد الخلية المختارة
                cell.classList.add('ring-4', 'ring-blue-600', 'ring-inset');
                
                // تحديث الحقول المخفية
                modal.querySelector('#manual-risk-likelihood').value = likelihood;
                modal.querySelector('#manual-risk-consequence').value = consequence;
                modal.querySelector('#manual-risk-score').value = score;
                modal.querySelector('#manual-risk-level').value = level;
                
                // تحديث العرض
                const resultDiv = modal.querySelector('#manual-risk-result');
                if (resultDiv) resultDiv.classList.remove('hidden');
                
                const scoreEl = modal.querySelector('#manual-risk-score-display');
                const levelEl = modal.querySelector('#manual-risk-level-display');
                const likeEl = modal.querySelector('#manual-risk-likelihood-display');
                const consEl = modal.querySelector('#manual-risk-consequence-display');
                if (scoreEl) scoreEl.textContent = score;
                if (levelEl) levelEl.textContent = level;
                if (likeEl) likeEl.textContent = likelihood;
                if (consEl) consEl.textContent = consequence;
                
                // تحديث لون الشارة حسب التصنيف اللوني العالمي
                const badge = modal.querySelector('#manual-risk-result-badge');
                if (badge) {
                    badge.style.background = bgColor;
                    badge.style.color = textColor;
                    badge.textContent = score;
                }

                // توليد وصف تلقائي في ملاحظات التقييم بناءً على الخلية المختارة
                const riskNotesInput = modal.querySelector('#manual-risk-notes');
                if (riskNotesInput) {
                    const recommendationByLevel = {
                        'منخفض': 'يمكن تنفيذ العمل مع الالتزام بالضوابط الأساسية والمتابعة الدورية.',
                        'متوسط': 'يلزم تعزيز الضوابط الوقائية والمتابعة الميدانية قبل وأثناء التنفيذ.',
                        'مرتفع': 'لا يبدأ العمل قبل اعتماد ضوابط إضافية واضحة ومتابعة إشرافية مباشرة.',
                        'حرج': 'إيقاف التنفيذ فوراً حتى إزالة/خفض الخطر واعتماد خطة تحكم مشددة.'
                    };
                    const autoText = `تقييم تلقائي: مستوى الخطر ${level} (درجة ${score}) — الاحتمالية ${likelihood} × الخطورة ${consequence}. ${recommendationByLevel[level] || ''}`.trim();
                    const existingNotes = String(riskNotesInput.value || '').trim();
                    const previousAuto = String(riskNotesInput.dataset.autoRiskText || '').trim();
                    if (!existingNotes || existingNotes === previousAuto || existingNotes.startsWith('تقييم تلقائي:')) {
                        riskNotesInput.value = autoText;
                        riskNotesInput.dataset.autoRiskText = autoText;
                    }
                }
            });
        });

        // معالجة إضافة اعتماد جديد (تصميم جدول)
        modal.querySelector('#manual-add-approval-btn')?.addEventListener('click', () => {
            const tbody = modal.querySelector('#manual-approvals-list');
            if (!tbody) return;
            const count = tbody.querySelectorAll('tr').length + 1;
            const newRow = document.createElement('tr');
            newRow.className = 'manual-approval-row border-b border-gray-100 hover:bg-amber-50 transition-colors';
            newRow.innerHTML = `
                <td class="p-2 text-center font-bold text-amber-700">${count}</td>
                <td class="p-2"><input type="text" class="form-input text-sm manual-approval-role" placeholder="الدور / المسمى" value=""></td>
                <td class="p-2"><input type="text" class="form-input text-sm manual-approval-name" placeholder="اسم المعتمد" value=""></td>
                <td class="p-2"><input type="datetime-local" class="form-input text-sm manual-approval-date" value=""></td>
                <td class="p-2"><input type="text" class="form-input text-sm manual-approval-notes" placeholder="ملاحظات" value=""></td>
                <td class="p-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors" onclick="this.closest('tr').remove(); PTW.updateApprovalNumbers('manual-approvals-list')" title="حذف"><i class="fas fa-trash-alt"></i></button></td>
            `;
            tbody.appendChild(newRow);
        });

        // معالجة إضافة اعتماد إغلاق جديد (تصميم جدول)
        modal.querySelector('#manual-add-closure-approval-btn')?.addEventListener('click', () => {
            const tbody = modal.querySelector('#manual-closure-approvals-list');
            if (!tbody) return;
            const count = tbody.querySelectorAll('tr').length + 1;
            const newRow = document.createElement('tr');
            newRow.className = 'manual-closure-approval-row border-b border-gray-100 hover:bg-cyan-50 transition-colors';
            newRow.innerHTML = `
                <td class="p-2 text-center font-bold text-cyan-700">${count}</td>
                <td class="p-2"><input type="text" class="form-input text-sm manual-closure-approval-role" placeholder="الدور / المسمى" value=""></td>
                <td class="p-2"><input type="text" class="form-input text-sm manual-closure-approval-name" placeholder="اسم المعتمد" value=""></td>
                <td class="p-2"><input type="datetime-local" class="form-input text-sm manual-closure-approval-date" value=""></td>
                <td class="p-2"><input type="text" class="form-input text-sm manual-closure-approval-notes" placeholder="ملاحظات" value=""></td>
                <td class="p-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors" onclick="this.closest('tr').remove(); PTW.updateApprovalNumbers('manual-closure-approvals-list')" title="حذف"><i class="fas fa-trash-alt"></i></button></td>
            `;
            tbody.appendChild(newRow);
        });

        
        modal.querySelector('#manual-permit-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // التحقق من اختيار حالة التصريح
            const selectedStatus = modal.querySelector('input[name="manual-permit-status-radio"]:checked');
            if (!selectedStatus) {
                const statusInput = modal.querySelector('#manual-permit-status');
                if (statusInput && !String(statusInput.value || '').trim()) {
                    statusInput.value = 'مغلق';
                }
            }
            
            await this.saveManualPermitEntry(modal, entryId);
        });
    },

    /**
     * حفظ تصريح يدوي
     */
    async saveManualPermitEntry(modal, entryId = null) {
        try {
            const markFieldInvalid = (fieldEl) => {
                if (!fieldEl) return;
                fieldEl.style.border = '2px solid #e53e3e';
                fieldEl.style.boxShadow = '0 0 0 3px rgba(229,62,62,0.15)';
            };
            const clearFieldInvalid = (fieldEl) => {
                if (!fieldEl) return;
                fieldEl.style.border = '';
                fieldEl.style.boxShadow = '';
            };

            const paperPermitInput = modal.querySelector('#manual-paper-permit-number');
            const timeFromInputEl = modal.querySelector('#manual-permit-time-from');
            const timeToInputEl = modal.querySelector('#manual-permit-time-to');
            const authorizedPartyInputEl = modal.querySelector('#manual-permit-authorized-party');
            const requestingPartyInputEl = modal.querySelector('#manual-permit-requesting-party');
            const workDescriptionInputEl = modal.querySelector('#manual-permit-work-description');

            // الحصول على بيانات الموقع والمواقع الفرعية المختارة
            const locationSelect = modal.querySelector('#manual-permit-location');
            const selectedLocationOption = locationSelect?.options[locationSelect?.selectedIndex];
            const locationId = String(locationSelect?.value || '').trim();
            const locationName = String(
                selectedLocationOption?.getAttribute('data-site-name')
                || selectedLocationOption?.textContent
                || ''
            ).trim();
            const sublocationSelect = modal.querySelector('#manual-permit-sublocation');
            const locationEntriesInput = modal.querySelector('#manual-permit-location-entries');

            // التحقق من الحقول الأساسية الإلزامية قبل أي معالجة
            [
                paperPermitInput,
                locationSelect,
                timeFromInputEl,
                timeToInputEl,
                authorizedPartyInputEl,
                requestingPartyInputEl,
                workDescriptionInputEl
            ].forEach(clearFieldInvalid);

            const requiredFieldChecks = [
                { label: 'رقم التصريح الورقي', element: paperPermitInput, value: String(paperPermitInput?.value || '').trim() },
                { label: 'الموقع / القسم', element: locationSelect, value: locationId },
                { label: 'تاريخ البدء', element: timeFromInputEl, value: String(timeFromInputEl?.value || '').trim() },
                { label: 'تاريخ الانتهاء', element: timeToInputEl, value: String(timeToInputEl?.value || '').trim() },
                { label: 'الجهة المصرح لها بالعمل', element: authorizedPartyInputEl, value: String(authorizedPartyInputEl?.value || '').trim() },
                { label: 'الجهة الطالبة للتصريح', element: requestingPartyInputEl, value: String(requestingPartyInputEl?.value || '').trim() },
                { label: 'وصف العمل', element: workDescriptionInputEl, value: String(workDescriptionInputEl?.value || '').trim() }
            ];

            const missingRequiredFields = requiredFieldChecks.filter(item => !item.value);
            if (missingRequiredFields.length > 0) {
                missingRequiredFields.forEach(item => markFieldInvalid(item.element));
                const firstMissingEl = missingRequiredFields[0]?.element;
                if (firstMissingEl && typeof firstMissingEl.focus === 'function') {
                    firstMissingEl.focus();
                    firstMissingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                Notification.error(
                    this._t('module.ptw.notify.manualRequiredFieldsDetailed', 'لا يمكن الإرسال قبل استكمال البيانات الأساسية المطلوبة:\n{fields}')
                        .replace('{fields}', missingRequiredFields.map(item => `• ${item.label}`).join('\n'))
                );
                return;
            }

            let selectedLocationEntries = [];
            if (locationEntriesInput?.value) {
                try {
                    const rawLocationEntries = JSON.parse(locationEntriesInput.value);
                    if (Array.isArray(rawLocationEntries)) {
                        selectedLocationEntries = rawLocationEntries
                            .map(entry => ({
                                locationId: String(entry?.locationId || locationId).trim(),
                                location: String(entry?.location || locationName).trim(),
                                sublocationId: String(entry?.sublocationId || '').trim(),
                                sublocation: String(entry?.sublocation || '').trim()
                            }))
                            .filter(entry => entry.location && entry.sublocation);
                    }
                } catch (error) {
                    selectedLocationEntries = [];
                }
            }

            if (selectedLocationEntries.length === 0) {
                const selectedSublocationOption = sublocationSelect?.options[sublocationSelect?.selectedIndex];
                const sublocationId = String(sublocationSelect?.value || '').trim();
                const sublocationName = String(
                    selectedSublocationOption?.getAttribute('data-place-name')
                    || (selectedSublocationOption?.value ? selectedSublocationOption.textContent : '')
                    || ''
                ).trim();

                if (locationName && sublocationName) {
                    selectedLocationEntries = [{
                        locationId,
                        location: locationName,
                        sublocationId,
                        sublocation: sublocationName
                    }];
                }
            }

            const sublocationIds = selectedLocationEntries
                .map(entry => entry.sublocationId)
                .filter(Boolean);
            const sublocationNames = selectedLocationEntries
                .map(entry => entry.sublocation)
                .filter(Boolean);
            const sublocationId = sublocationIds.length > 0 ? sublocationIds.join(' | ') : null;
            const sublocationName = sublocationNames.length > 0 ? sublocationNames.join(' | ') : null;

            // نوع التصريح يُستنتج من طبيعة الأعمال (القسم الثالث) ويُحسب لاحقاً كـ finalPermitTypes مع افتراضي "أعمال أخرى" — لا نعتمد على بطاقات manual-permit-type

            // الحصول على وقت البدء والانتهاء
            const timeFromValue = modal.querySelector('#manual-permit-time-from')?.value;
            const timeToValue = modal.querySelector('#manual-permit-time-to')?.value;
            
            // استخراج التاريخ من وقت البدء إذا لم يكن حقل التاريخ موجوداً
            const dateValue = modal.querySelector('#manual-permit-date')?.value || 
                             (timeFromValue ? timeFromValue.split('T')[0] : new Date().toISOString().split('T')[0]);
            
            // حساب إجمالي الوقت تلقائياً
            let calculatedTotalTime = '';
            if (timeFromValue && timeToValue) {
                calculatedTotalTime = this.calculateTotalTime(timeFromValue, timeToValue);
                try {
                    const start = new Date(timeFromValue);
                    const end = new Date(timeToValue);
                    const diffMs = end - start;
                    if (diffMs >= 0) {
                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        if (diffHours === 0) {
                            calculatedTotalTime = `${diffMinutes} دقيقة`;
                        } else if (diffMinutes === 0) {
                            calculatedTotalTime = `${diffHours} ساعة`;
                        } else {
                            calculatedTotalTime = `${diffHours} ساعة و ${diffMinutes} دقيقة`;
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            // جمع بيانات القائمين بالعمل (من جدول الاسم + التوقيع)
            const teamMembers = Array.from(modal.querySelectorAll('#manual-team-members-list tr.manual-team-member-row')).map(row => ({
                name: row.querySelector('.manual-team-member-name')?.value?.trim() || '',
                signature: row.querySelector('.manual-team-member-signature')?.value?.trim() || '',
                id: row.querySelector('.manual-team-member-signature')?.value?.trim() || '' // للتوافق مع العرض
            })).filter(m => m.name || m.signature);

            // جمع بيانات طبيعة الأعمال
            const hotWorkDetails = Array.from(modal.querySelectorAll('input[name="manual-hot-work"]:checked')).map(cb => cb.value);
            const confinedSpaceDetails = Array.from(modal.querySelectorAll('input[name="manual-confined-space"]:checked')).map(cb => cb.value);
            const heightWorkDetails = Array.from(modal.querySelectorAll('input[name="manual-height-work"]:checked')).map(cb => cb.value);

            // جمع بيانات الاعتمادات اليدوية (جدول القسم السابع: الاسم والتوقيع حسب الدور)
            const approvalRoles = ['مسئول الجهة الطالبة', 'مدير منطقة الأعمال', 'مدير / مهندس الصيانة', 'مسئول السلامة والصحة المهنية'];
            const manualApprovals = approvalRoles.map(role => {
                const nameEl = modal.querySelector(`.manual-approval-name[data-role="${role}"]`);
                const sigEl = modal.querySelector(`.manual-approval-sig[data-role="${role}"]`);
                return { role, name: nameEl?.value?.trim() || '', signature: sigEl?.value?.trim() || '', date: '', notes: '' };
            });

            // جمع بيانات اعتمادات الإغلاق (جدول القسم التاسع: الاسم والتوقيع حسب الدور)
            const closureApprovalRoles = ['مسؤول الجهة الطالبة', 'مدير منطقة الأعمال', 'مسؤول السلامة والصحة المهنية', 'مدير السلامة والصحة المهنية'];
            const manualClosureApprovals = closureApprovalRoles.map(role => {
                const nameEl = modal.querySelector(`.manual-closure-approval-name[data-role="${role}"]`);
                const sigEl = modal.querySelector(`.manual-closure-approval-sig[data-role="${role}"]`);
                return { role, name: nameEl?.value?.trim() || '', signature: sigEl?.value?.trim() || '', date: '', notes: '' };
            });

            // تحديد أنواع التصريح بناءً على طبيعة الأعمال المحددة
            const derivedPermitTypes = [];
            if (hotWorkDetails.length > 0) derivedPermitTypes.push('أعمال ساخنة');
            if (confinedSpaceDetails.length > 0) derivedPermitTypes.push('أعمال في الأماكن المغلقة');
            if (heightWorkDetails.length > 0) derivedPermitTypes.push('أعمال في الارتفاعات');
            const hasExcavation = modal.querySelector('#manual-excavation-check')?.checked || modal.querySelector('#manual-excavation-length')?.value?.trim() || modal.querySelector('#manual-excavation-width')?.value?.trim() || modal.querySelector('#manual-excavation-depth')?.value?.trim() || modal.querySelector('#manual-excavation-soil')?.value?.trim();
            if (hasExcavation) derivedPermitTypes.push('أعمال حفر');
            if (modal.querySelector('#manual-electrical-check')?.checked || modal.querySelector('#manual-electrical-work-type')?.value?.trim()) derivedPermitTypes.push('أعمال كهربائية');
            if (modal.querySelector('#manual-cold-check')?.checked || modal.querySelector('#manual-cold-work-type')?.value?.trim()) derivedPermitTypes.push('أعمال باردة');
            if (modal.querySelector('#manual-other-check')?.checked || modal.querySelector('#manual-other-work-type')?.value?.trim()) derivedPermitTypes.push('أعمال أخرى');
            
            // إذا لم يتم تحديد أي نوع، استخدم "أعمال أخرى"
            const finalPermitTypes = derivedPermitTypes.length > 0 ? derivedPermitTypes : ['أعمال أخرى'];

            const formData = {
                sequentialNumber: parseInt(modal.querySelector('#manual-permit-sequential')?.value || '0'),
                date: dateValue,
                permitType: finalPermitTypes,
                permitTypeDisplay: finalPermitTypes.join('، '),
                requestingParty: modal.querySelector('#manual-permit-requesting-party')?.value.trim() || '',
                locationId: locationId,
                location: locationName,
                locationEntries: selectedLocationEntries,
                sublocationId: sublocationId,
                sublocation: sublocationName,
                timeFrom: timeFromValue,
                timeTo: timeToValue,
                totalTime: modal.querySelector('#manual-permit-total-time')?.value || calculatedTotalTime,
                authorizedParty: modal.querySelector('#manual-permit-authorized-party')?.value.trim() || '',
                workDescription: modal.querySelector('#manual-permit-work-description')?.value.trim() || '',
                supervisor1: modal.querySelector('#manual-permit-supervisor1')?.value.trim() || '',
                supervisor2: modal.querySelector('#manual-permit-supervisor2')?.value.trim() || '',
                status: modal.querySelector('#manual-permit-status')?.value || 'اكتمل العمل بشكل آمن',
                // رقم التصريح الورقي
                paperPermitNumber: modal.querySelector('#manual-paper-permit-number')?.value?.trim() || '',
                // الحقول الجديدة
                equipment: modal.querySelector('#manual-permit-equipment')?.value.trim() || '',
                tools: modal.querySelector('#manual-permit-tools')?.value.trim() || '',
                teamMembers: teamMembers,
                // طبيعة الأعمال
                hotWorkDetails: hotWorkDetails,
                hotWorkOther: modal.querySelector('#manual-hot-work-other')?.value.trim() || '',
                confinedSpaceDetails: confinedSpaceDetails,
                confinedSpaceOther: modal.querySelector('#manual-confined-space-other')?.value.trim() || '',
                heightWorkDetails: heightWorkDetails,
                heightWorkOther: modal.querySelector('#manual-height-work-other')?.value.trim() || '',
                electricalWorkType: modal.querySelector('#manual-electrical-work-type')?.value.trim() || '',
                coldWorkType: modal.querySelector('#manual-cold-work-type')?.value.trim() || '',
                otherWorkType: modal.querySelector('#manual-other-work-type')?.value.trim() || '',
                // بيانات الحفر
                excavationLength: modal.querySelector('#manual-excavation-length')?.value.trim() || '',
                excavationWidth: modal.querySelector('#manual-excavation-width')?.value.trim() || '',
                excavationDepth: modal.querySelector('#manual-excavation-depth')?.value.trim() || '',
                soilType: modal.querySelector('#manual-excavation-soil')?.value.trim() || '',
                // المتطلبات والمرفقات
                preStartChecklist: modal.querySelector('#manual-permit-preStartChecklist')?.checked || false,
                lotoApplied: modal.querySelector('#manual-permit-lotoApplied')?.checked || false,
                governmentPermits: modal.querySelector('#manual-permit-governmentPermits')?.checked || false,
                riskAssessmentAttached: modal.querySelector('#manual-permit-riskAssessmentAttached')?.checked || false,
                gasTesting: modal.querySelector('#manual-permit-gasTesting')?.checked || false,
                mocRequest: modal.querySelector('#manual-permit-mocRequest')?.checked || false,
                // مهمات الوقاية
                ppeNotes: modal.querySelector('#manual-ppe-notes')?.value.trim() || '',
                // تقييم المخاطر - تسجيل كنص
                riskLikelihood: modal.querySelector('#manual-risk-likelihood')?.value || '',
                riskConsequence: modal.querySelector('#manual-risk-consequence')?.value || '',
                riskScore: modal.querySelector('#manual-risk-score')?.value || '',
                riskLevel: modal.querySelector('#manual-risk-level')?.value || '',
                riskNotes: modal.querySelector('#manual-risk-notes')?.value.trim() || '',
                // الاعتمادات اليدوية - تحويل إلى نص للتخزين
                manualApprovalsText: manualApprovals.map(a => `${a.role}: ${a.name || '—'} ${a.signature ? 'توقيع: ' + a.signature : ''}`).filter(Boolean).join(' | '),
                manualClosureApprovalsText: manualClosureApprovals.map(a => `${a.role}: ${a.name || '—'} ${a.signature ? 'توقيع: ' + a.signature : ''}`).filter(Boolean).join(' | '),
                // الاحتفاظ بالمصفوفات للتحرير
                manualApprovals: manualApprovals,
                manualClosureApprovals: manualClosureApprovals,
                // بيانات الإغلاق
                closureTime: modal.querySelector('#manual-closure-time')?.value || '',
                closureReason: modal.querySelector('#manual-closure-reason')?.value.trim() || ''
            };

            const manualPpeFromNotes = formData.ppeNotes
                ? String(formData.ppeNotes)
                    .split(/[،,]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];
            const manualPpeFromMatrix = Array.from(
                modal.querySelectorAll('#manual-ppe-matrix .manual-ppe-fixed-cb:checked')
            )
                .map((el) => String(el.value || '').trim())
                .filter(Boolean);
            const mergedRequiredPPE = [
                ...new Set(
                    [...manualPpeFromMatrix, ...manualPpeFromNotes]
                        .map((s) => String(s || '').trim())
                        .filter(Boolean)
                )
            ];
            formData.ppeNotes = mergedRequiredPPE.length ? mergedRequiredPPE.join('، ') : formData.ppeNotes;

            const paperNum = String(formData.paperPermitNumber || '').trim();
            if (!paperNum || paperNum === '0') {
                if (typeof Notification !== 'undefined' && Notification.warning) {
                    Notification.warning(PTW._t('module.ptw.notify.paperNumRequired', 'رقم التصريح الورقي إلزامي — يرجى إدخال الرقم قبل الحفظ'));
                }
                if (paperPermitInput) {
                    markFieldInvalid(paperPermitInput);
                    paperPermitInput.focus();
                    paperPermitInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            // التحقق من عدم تكرار رقم التصريح الورقي
            const duplicateEntry = this.registryData.find(r =>
                String(r.paperPermitNumber || '').trim() === paperNum &&
                r.id !== (entryId || null)
            );
            if (duplicateEntry) {
                const dupSeq = duplicateEntry.sequentialNumber || '؟';
                if (typeof Notification !== 'undefined' && Notification.error) {
                    Notification.error(PTW._t('module.ptw.notify.paperNumDup', 'رقم التصريح الورقي "{n}" مستخدم مسبقاً في السجل #{s} — يرجى إدخال رقم مختلف').replace(/\{n\}/g, paperNum).replace(/\{s\}/g, String(dupSeq)));
                }
                if (paperPermitInput) {
                    markFieldInvalid(paperPermitInput);
                    paperPermitInput.focus();
                    paperPermitInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            // تحويل التاريخ والوقت إلى ISO format
            const timeFromISO = Utils.dateTimeLocalToISO(formData.timeFrom) || new Date().toISOString();
            const timeToISO = Utils.dateTimeLocalToISO(formData.timeTo) || new Date().toISOString();
            const openDate = timeFromISO || this.dateInputToISO(formData.date) || new Date().toISOString();

            // استخدام الرقم التسلسلي المعروض للمستخدم (من hidden input)
            // لضمان التطابق بين ما يراه المستخدم وما يُحفظ فعلاً
            const displayedSeq = parseInt(formData.sequentialNumber) || 0;
            const sequentialNumber = entryId
                ? formData.sequentialNumber
                : (displayedSeq > 0 ? displayedSeq : this.generateRegistrySequentialNumber());

            // تخزين الموقع الأساسي فقط بدون دمج الموقع الفرعي (تطبيع النموذج)
            const normalizedLocation = String(formData.location || '').trim();

            // بناء كائن البيانات الكامل
            const fullEntryData = {
                sequentialNumber: sequentialNumber,
                openDate: openDate,
                permitType: formData.permitType,
                permitTypeDisplay: formData.permitTypeDisplay,
                requestingParty: formData.requestingParty,
                locationId: formData.locationId,
                location: normalizedLocation,
                locationEntries: formData.locationEntries,
                sublocationId: formData.sublocationId,
                sublocation: formData.sublocation,
                timeFrom: timeFromISO,
                timeTo: timeToISO,
                totalTime: formData.totalTime || this.calculateTotalTime(timeFromISO, timeToISO),
                authorizedParty: formData.authorizedParty,
                workDescription: formData.workDescription,
                supervisor1: formData.supervisor1 || '',
                supervisor2: formData.supervisor2 || '',
                status: formData.status,
                paperPermitNumber: formData.paperPermitNumber || '',
                // الحقول الجديدة
                equipment: formData.equipment,
                tools: formData.tools,
                toolsList: formData.tools,
                teamMembers: formData.teamMembers,
                // طبيعة الأعمال
                hotWorkDetails: formData.hotWorkDetails,
                hotWorkOther: formData.hotWorkOther,
                confinedSpaceDetails: formData.confinedSpaceDetails,
                confinedSpaceOther: formData.confinedSpaceOther,
                heightWorkDetails: formData.heightWorkDetails,
                heightWorkOther: formData.heightWorkOther,
                electricalWorkType: formData.electricalWorkType,
                coldWorkType: formData.coldWorkType,
                otherWorkType: formData.otherWorkType,
                // بيانات الحفر
                excavationLength: formData.excavationLength,
                excavationWidth: formData.excavationWidth,
                excavationDepth: formData.excavationDepth,
                soilType: formData.soilType,
                // المتطلبات والمرفقات
                preStartChecklist: formData.preStartChecklist,
                lotoApplied: formData.lotoApplied,
                governmentPermits: formData.governmentPermits,
                riskAssessmentAttached: formData.riskAssessmentAttached,
                gasTesting: formData.gasTesting,
                mocRequest: formData.mocRequest,
                // مهمات الوقاية (مصفوفة الاختيار + النص اليدوي)
                ppeNotes: formData.ppeNotes,
                requiredPPE: mergedRequiredPPE,
                // تقييم المخاطر - حقول نصية
                riskLikelihood: formData.riskLikelihood,
                riskConsequence: formData.riskConsequence,
                riskScore: formData.riskScore,
                riskLevel: formData.riskLevel,
                riskNotes: formData.riskNotes,
                // الاعتمادات اليدوية - نص للتخزين
                manualApprovalsText: formData.manualApprovalsText,
                manualClosureApprovalsText: formData.manualClosureApprovalsText,
                // الاحتفاظ بالمصفوفات للتحرير
                manualApprovals: formData.manualApprovals,
                manualClosureApprovals: formData.manualClosureApprovals,
                // تحويل بيانات فريق العمل إلى نص
                teamMembersText: formData.teamMembers.map(m => `${m.name}${(m.signature || m.id) ? ' (' + (m.signature || m.id) + ')' : ''}`).join('، '),
                // بيانات الإغلاق
                closureDate: formData.closureTime ? Utils.dateTimeLocalToISO(formData.closureTime) : (formData.status === 'اكتمل العمل بشكل آمن' || formData.status === 'إغلاق جبري' ? timeToISO : null),
                closureReason: formData.closureReason || (formData.status === 'إغلاق جبري' ? 'إغلاق جبري' : ''),
                // علامة التصريح اليدوي + معرّف المسار (للعرض في الجدول والورقة)
                isManualEntry: true,
                skipApprovalFlow: true,
                approvalCircuitOwnerId: '__manual__',
                approvalCircuitName: 'Manual Entry',
                updatedAt: new Date().toISOString()
            };

            // إنشاء أو تحديث السجل
            let entry;
            if (entryId) {
                // عند التحديث: الحفاظ على جميع البيانات الموجودة ودمجها مع البيانات الجديدة
                const existingEntry = this.registryData.find(r => r.id === entryId);
                if (!existingEntry) {
                    Notification.error(this._t('module.ptw.notify.recNotFound', 'السجل غير موجود'));
                    return;
                }
                
                entry = {
                    ...existingEntry,
                    ...fullEntryData,
                    id: existingEntry.id,
                    permitId: existingEntry.permitId || this.generateTemporaryId('PTW'),
                    createdAt: existingEntry.createdAt
                };
            } else {
                // عند الإضافة: إنشاء سجل جديد
                entry = {
                    ...fullEntryData,
                    id: this.generateTemporaryId('REG'),
                    permitId: this.generateTemporaryId('PTW'),
                    createdAt: new Date().toISOString()
                };
            }

            // إضافة أو تحديث السجل
            if (entryId) {
                const index = this.registryData.findIndex(r => r.id === entryId);
                if (index !== -1) {
                    this.registryData[index] = entry;
                } else {
                    Notification.error(this._t('module.ptw.notify.recNotInData', 'السجل غير موجود في البيانات'));
                    return;
                }
            } else {
                this.registryData.push(entry);
            }

            // إضافة أو تحديث التصريح في قائمة التصاريح (AppState.appData.ptw)
            if (!AppState.appData) AppState.appData = {};
            if (!AppState.appData.ptw) AppState.appData.ptw = [];

            // تحويل سجل التصريح إلى تنسيق التصريح
            const permitData = {
                id: entry.permitId,
                workType: Array.isArray(entry.permitType)
                    ? entry.permitTypeDisplay || entry.permitType.join('، ')
                    : entry.permitType || entry.permitTypeDisplay,
                location: entry.location,
                siteName: entry.location,
                sublocation: entry.sublocation,
                sublocationName: entry.sublocation,
                startDate: entry.openDate,
                endDate: entry.timeTo,
                status: String(entry.status || '').trim() || 'اكتمل العمل بشكل آمن',
                requestingParty: entry.requestingParty,
                authorizedParty: entry.authorizedParty,
                workDescription: entry.workDescription,
                // التصريح اليدوي لا يحتاج دائرة اعتمادات - حالة معتمدة تلقائياً
                approvals: [],
                approvalCircuitOwnerId: '__manual__',
                approvalCircuitName: 'Manual Entry',
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt,
                skipApprovalFlow: true, // تخطي دائرة الاعتمادات
                isManualEntry: true, // علامة التصريح اليدوي
                // حفظ جميع بيانات النموذج اليدوي للتعديل لاحقاً
                teamMembers: entry.teamMembers || [],
                teamMembersText: entry.teamMembersText || '',
                hotWorkDetails: entry.hotWorkDetails || [],
                hotWorkOther: entry.hotWorkOther || '',
                confinedSpaceDetails: entry.confinedSpaceDetails || [],
                confinedSpaceOther: entry.confinedSpaceOther || '',
                heightWorkDetails: entry.heightWorkDetails || [],
                heightWorkOther: entry.heightWorkOther || '',
                excavationLength: entry.excavationLength || '',
                excavationWidth: entry.excavationWidth || '',
                excavationDepth: entry.excavationDepth || '',
                soilType: entry.soilType || '',
                electricalWorkType: entry.electricalWorkType || '',
                coldWorkType: entry.coldWorkType || '',
                otherWorkType: entry.otherWorkType || '',
                preStartChecklist: entry.preStartChecklist || false,
                lotoApplied: entry.lotoApplied || false,
                governmentPermits: entry.governmentPermits || false,
                riskAssessmentAttached: entry.riskAssessmentAttached || false,
                gasTesting: entry.gasTesting || false,
                mocRequest: entry.mocRequest || false,
                ppeNotes: entry.ppeNotes || '',
                riskLikelihood: entry.riskLikelihood || '',
                riskConsequence: entry.riskConsequence || '',
                riskScore: entry.riskScore || '',
                riskLevel: entry.riskLevel || '',
                riskNotes: entry.riskNotes || '',
                manualApprovals: entry.manualApprovals || [],
                manualApprovalsText: entry.manualApprovalsText || '',
                manualClosureApprovals: entry.manualClosureApprovals || [],
                manualClosureApprovalsText: entry.manualClosureApprovalsText || '',
                closureTime: entry.closureTime || '',
                closureDate: entry.closureDate || '',
                closureReason: entry.closureReason || '',
                paperPermitNumber: entry.paperPermitNumber || '',
                sequentialNumber: entry.sequentialNumber,
                equipment: entry.equipment || '',
                tools: entry.tools || '',
                toolsList: entry.toolsList || '',
                supervisor1: entry.supervisor1 || '',
                supervisor2: entry.supervisor2 || ''
            };

            // البحث عن التصريح في القائمة
            const existingPermitIndex = AppState.appData.ptw.findIndex(p => p.id === entry.permitId);
            if (existingPermitIndex !== -1) {
                // تحديث التصريح الموجود مع الحفاظ على جميع البيانات الموجودة
                const existingPermit = AppState.appData.ptw[existingPermitIndex];
                AppState.appData.ptw[existingPermitIndex] = {
                    ...existingPermit, // الحفاظ على جميع الحقول الموجودة (مثل approvals، metadata، إلخ)
                    ...permitData, // تحديث الحقول من السجل
                    id: entry.permitId, // التأكد من الحفاظ على ID الصحيح
                    isManualEntry: true // علامة للتمييز
                };
            } else {
                // إضافة تصريح جديد
                AppState.appData.ptw.push(permitData);
            }

            // إغلاق النموذج وتحديث الواجهة فوراً (تجربة مستخدم سريعة)
            modal.remove();

            // تحديث جميع التبويبات بشكل متسق
            const registryContent = document.getElementById('ptw-registry-content');
            if (registryContent && (this.currentTab === 'registry' || registryContent.style.display !== 'none')) {
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
            }
            const permitsContent = document.getElementById('ptw-permits-content');
            if (permitsContent && (this.currentTab === 'permits' || permitsContent.style.display !== 'none')) {
                this.loadPTWList(true);
            }
            const analysisContent = document.getElementById('ptw-analysis-content');
            if (analysisContent && (this.currentTab === 'analysis' || analysisContent.style.display !== 'none')) {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }
            const approvalsContent = document.getElementById('ptw-approvals-content');
            if (approvalsContent && (this.currentTab === 'approvals' || approvalsContent.style.display !== 'none')) {
                approvalsContent.innerHTML = this.renderApprovalsContent();
                this.setupApprovalsEventListeners();
            }
            const mapContent = document.getElementById('ptw-map-content');
            if (mapContent && this.currentTab === 'map' && mapContent.style.display !== 'none') {
                if (this.mapInstance && typeof this.initMap === 'function') {
                    setTimeout(() => {
                        if (this.currentTab === 'map') this.initMap().catch(err => Utils.safeWarn('⚠️ خطأ في تحديث الخريطة:', err));
                    }, 300);
                }
            }
            this.updateKPIs();

            const isNewEntry = !entryId;
            const isNewPermit = existingPermitIndex === -1;

            if (typeof Notification !== 'undefined' && Notification.info) {
                Notification.info(this._t('module.ptw.notify.syncPtw', 'جاري المزامنة مع PTWRegistry و PTW…'));
            }

            try {
                await this.saveRegistryData({ skipSync: true });
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    await Promise.resolve(window.DataManager.save());
                }
                await this.syncManualPermitRecordsToBackend(entry, permitData, {
                    isNewRegistryEntry: isNewEntry,
                    isNewPermit: isNewPermit
                });
                Notification.success(
                    entryId
                        ? 'تم تحديث التصريح بنجاح وتمت مزامنته مع السحابة (PTWRegistry + PTW)'
                        : 'تم إضافة التصريح اليدوي بنجاح وتمت مزامنته مع السحابة (PTWRegistry + PTW)'
                );
            } catch (syncError) {
                Utils.safeError('خطأ في مزامنة التصريح اليدوي:', syncError);
                const msg = syncError && syncError.message ? String(syncError.message) : '';
                Notification.warning(
                    'تم الحفظ محلياً. فشلت مزامنة السحابة (تحقق من ورقة PTW و PTWRegistry): ' +
                    (msg || 'خطأ غير معروف') +
                    ' — يمكن إعادة المحاولة من المزامنة لاحقاً.'
                );
            }
        } catch (error) {
            Utils.safeError('خطأ في حفظ التصريح اليدوي:', error);
            Notification.error(this._t('module.ptw.notify.savePermitErr', 'حدث خطأ أثناء حفظ التصريح: ') + (error.message || this._t('module.ptw.notify.unknownError', 'خطأ غير معروف')));
        }
    },

    /**
     * حذف تصريح يدوي من السجل
     */
    async deleteManualPermitEntry(entryId) {
        if (!confirm(this._t('module.ptw.notify.deleteManualPermConfirm', 'هل أنت متأكد من حذف هذا التصريح اليدوي؟\nسيتم حذفه نهائياً من السجل.'))) return;

        try {
            const index = this.registryData.findIndex(r => r.id === entryId);
            if (index === -1) {
                Notification.error(this._t('module.ptw.notify.permitNotFound', 'لم يتم العثور على التصريح'));
                return;
            }

            // التأكد من أنه تصريح يدوي
            const entry = this.registryData[index];
            if (!entry.isManualEntry) {
                Notification.warning(this._t('module.ptw.notify.manualDeleteOnly', 'يمكن حذف التصاريح اليدوية فقط من هنا'));
                return;
            }

            this.registryData.splice(index, 1);
            await this.saveRegistryData();

            // تحديث الواجهة
            if (this.currentTab === 'registry') {
                const registryContent = document.getElementById('ptw-registry-content');
                if (registryContent) {
                    registryContent.innerHTML = this.renderRegistryContent();
                    this.setupRegistryEventListeners();
                }
            }

            Notification.success(this._t('module.ptw.notify.manualDeleteOk', 'تم حذف التصريح اليدوي بنجاح'));
        } catch (error) {
            Utils.safeError('خطأ في حذف التصريح اليدوي:', error);
            Notification.error(this._t('module.ptw.notify.deleteErr', 'حدث خطأ أثناء حذف التصريح'));
        }
    },

    /**
     * إغلاق تصريح من السجل
     */
    async closePermitFromRegistry(permitId) {
        if (!confirm(this._t('module.ptw.notify.closePermitConfirm', 'هل أنت متأكد من إغلاق هذا التصريح؟'))) return;

        const permit = AppState.appData.ptw?.find(p => p.id === permitId);
        if (!permit) {
            Notification.error(this._t('module.ptw.notify.permitNotFound', 'لم يتم العثور على التصريح'));
            return;
        }

        const closureReason = prompt(this._t('module.ptw.notify.closureReasonPrompt', 'أدخل سبب إغلاق التصريح:'));
        if (!closureReason) return;

        permit.status = 'مغلق';
        permit.closureTime = new Date().toISOString();
        permit.closureReason = closureReason;
        permit.closureStatus = 'completed';

        // حفظ التصريح
        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
            await GoogleIntegration.autoSave('PTW', AppState.appData.ptw);
        }

        // تحديث السجل
        await this.updateRegistryEntry(permit);

        // تحديث الواجهة
        this.updateKPIs();
        if (this.currentTab === 'registry') {
            const registryContent = document.getElementById('ptw-registry-content');
            if (registryContent) {
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
            }
        }

        Notification.success(this._t('module.ptw.notify.closeOk', 'تم إغلاق التصريح بنجاح'));
    },

    /**
     * تصدير السجل إلى Excel
     */
    async exportRegistryToExcel() {
        if (this.registryData.length === 0) {
            Notification.warning(this._t('module.ptw.notify.noDataExport', 'لا توجد بيانات للتصدير'));
            return;
        }

        const data = this.registryData.map(entry => ({
            'مسلسل': entry.sequentialNumber,
            'التاريخ': new Date(entry.openDate).toLocaleDateString('ar-EG'),
            'نوع التصريح': this.getPermitTypeDisplay(entry),
            'الجهة الطالبة': entry.requestingParty,
            'الموقع': entry.location,
            'الوقت من': entry.timeFrom,
            'الوقت إلى': entry.closureDate || entry.timeTo,
            'إجمالي الوقت': entry.totalTime,
            'الجهة المصرح لها': entry.authorizedParty,
            'وصف العمل': entry.workDescription,
            'مسئول المتابعة 01': entry.supervisor1,
            'مسئول المتابعة 02': entry.supervisor2,
            'حالة التصريح': entry.status
        }));

        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'سجل التصاريح');
            XLSX.writeFile(wb, `سجل_تصاريح_العمل_${new Date().toISOString().split('T')[0]}.xlsx`);
            Notification.success(this._t('module.ptw.notify.excelOk', 'تم تصدير السجل إلى Excel بنجاح'));
        } else {
            Notification.error(this._t('module.ptw.notify.xlsxNoLib', 'مكتبة Excel غير متوفرة'));
        }
    },

    /**
     * تصدير السجل إلى PDF
     */
    async exportRegistryToPDF() {
        if (this.registryData.length === 0) {
            Notification.warning(this._t('module.ptw.notify.noDataExport', 'لا توجد بيانات للتصدير'));
            return;
        }

        try {
            Loading.show('جاري تصدير PDF...');

            const formatDate = (dateString) => {
                if (!dateString) return '-';
                try {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('ar-EG');
                } catch (e) {
                    return dateString || '-';
                }
            };

            const formatDateTime = (dateString) => {
                if (!dateString) return '-';
                try {
                    const date = new Date(dateString);
                    return date.toLocaleString('ar-EG');
                } catch (e) {
                    return dateString || '-';
                }
            };

            // إنشاء صفوف الجدول
            const tableRows = this.registryData.map(entry => {
                const sequentialNumber = entry.sequentialNumber || '-';
                const openDate = formatDate(entry.openDate);
                const permitType = this.getPermitTypeDisplay(entry) || '-';
                const requestingParty = entry.requestingParty || '-';
                const location = entry.location || '-';
                const timeFrom = entry.timeFrom ? formatDateTime(entry.timeFrom) : '-';
                const timeTo = entry.closureDate ? formatDateTime(entry.closureDate) : (entry.timeTo ? formatDateTime(entry.timeTo) : '-');
                const totalTime = entry.totalTime || '-';
                const authorizedParty = entry.authorizedParty || '-';
                const workDescription = entry.workDescription || '-';
                const supervisor1 = entry.supervisor1 || '-';
                const supervisor2 = entry.supervisor2 || '-';
                const status = entry.status || '-';

                return `
                    <tr>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${Utils.escapeHTML(sequentialNumber)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(openDate)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-size: 9px;">${Utils.escapeHTML(permitType)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(requestingParty)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(location)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-size: 9px;">${Utils.escapeHTML(timeFrom)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-size: 9px;">${Utils.escapeHTML(timeTo)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(totalTime)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(authorizedParty)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-size: 9px;">${Utils.escapeHTML(workDescription)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(supervisor1)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(supervisor2)}</td>
                        <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right;">${Utils.escapeHTML(status)}</td>
                    </tr>
                `;
            }).join('');

            const formCode = `PTW-REGISTRY-${new Date().toISOString().slice(0, 10)}`;
            const formTitle = 'سجل حصر تصاريح الأعمال';

            const content = `
                <div style="margin-bottom: 20px;">
                    <h2 style="text-align: center; color: #1f2937; margin-bottom: 15px;">سجل حصر تصاريح الأعمال</h2>
                    <p style="text-align: center; color: #6b7280; font-size: 14px;">
                        إجمالي عدد التصاريح: ${this.registryData.length}
                    </p>
                </div>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
                    <thead>
                        <tr style="background-color: #3b82f6; color: white;">
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center; font-weight: bold;">مسلسل</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">التاريخ</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">نوع التصريح</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الجهة الطالبة</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الموقع</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الوقت من</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الوقت إلى</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">إجمالي الوقت</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الجهة المصرح لها</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">وصف العمل</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">مسئول المتابعة 01</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">مسئول المتابعة 02</th>
                            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: bold;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { source: 'PTWRegistry' }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Loading.hide();
                            Notification.success(this._t('module.ptw.notify.registryPrintReady', 'تم تحضير السجل للطباعة/الحفظ كـ PDF'));
                        }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error(this._t('module.ptw.notify.popupsPdf', 'يرجى السماح بالنوافذ المنبثقة لتصدير PDF'));
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error(this._t('module.ptw.notify.pdfErr', 'فشل تصدير PDF: ') + (error.message || this._t('module.ptw.notify.unknownError', 'خطأ غير معروف')));
        }
    },

    /**
     * عرض نافذة استيراد Excel
     */
    showImportExcelModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title"><i class="fas fa-file-import ml-2"></i>استيراد سجل حصر التصاريح من ملف Excel</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <p class="text-sm text-blue-800 mb-2"><strong>تعليمات الاستيراد:</strong></p>
                        <p class="text-sm text-blue-700">يجب أن يحتوي ملف Excel على الأعمدة التالية (باللغة العربية أو الإنجليزية):</p>
                        <ul class="text-sm text-blue-700 list-disc mr-6 mt-2 space-y-1">
                            <li><strong>مسلسل</strong> أو <strong>Sequential Number</strong> - رقم تسلسلي</li>
                            <li><strong>التاريخ</strong> أو <strong>Date</strong> - تاريخ فتح التصريح</li>
                            <li><strong>نوع التصريح</strong> أو <strong>Permit Type</strong> - نوع العمل</li>
                            <li><strong>الجهة الطالبة</strong> أو <strong>Requesting Party</strong> - الجهة الطالبة</li>
                            <li><strong>الموقع</strong> أو <strong>Location</strong> - موقع تنفيذ العمل</li>
                            <li><strong>الوقت من</strong> أو <strong>Time From</strong> - وقت بدء العمل</li>
                            <li><strong>الوقت إلى</strong> أو <strong>Time To</strong> - وقت انتهاء العمل</li>
                            <li><strong>إجمالي الوقت</strong> أو <strong>Total Time</strong> - إجمالي الوقت (اختياري، سيتم حسابه تلقائياً)</li>
                            <li><strong>الجهة المصرح لها</strong> أو <strong>Authorized Party</strong> - الجهة المخولة</li>
                            <li><strong>وصف العمل</strong> أو <strong>Work Description</strong> - وصف العمل</li>
                            <li><strong>مسئول المتابعة 01</strong> أو <strong>Supervisor 1</strong> - مسئول المتابعة الأول</li>
                            <li><strong>مسئول المتابعة 02</strong> أو <strong>Supervisor 2</strong> - مسئول المتابعة الثاني</li>
                            <li><strong>حالة التصريح</strong> أو <strong>Status</strong> - حالة التصريح (مفتوح/مغلق)</li>
                        </ul>
                        <p class="text-xs text-blue-700 mt-3"><strong>ملاحظة:</strong> سيتم إنشاء معرفات فريدة تلقائياً للصفحات المستوردة. إذا كان هناك سجل موجود بنفس الرقم المسلسل، سيتم تحديثه.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-file-excel ml-2"></i>
                            اختر ملف Excel (.xlsx, .xls)
                        </label>
                        <input type="file" id="registry-excel-file-input" accept=".xlsx,.xls" class="form-input">
                    </div>
                    <div id="registry-import-preview" class="hidden">
                        <h3 class="text-sm font-semibold mb-2">معاينة البيانات (أول 5 صفوف):</h3>
                        <div class="max-h-60 overflow-auto border rounded">
                            <table class="data-table text-xs">
                                <thead id="registry-preview-head"></thead>
                                <tbody id="registry-preview-body"></tbody>
                            </table>
                        </div>
                        <p id="registry-preview-count" class="text-sm text-gray-600 mt-2"></p>
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button id="registry-import-confirm-btn" class="btn-primary" disabled>
                        <i class="fas fa-upload ml-2"></i>استيراد البيانات
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const fileInput = modal.querySelector('#registry-excel-file-input');
        const confirmBtn = modal.querySelector('#registry-import-confirm-btn');
        const previewContainer = modal.querySelector('#registry-import-preview');
        const previewHead = modal.querySelector('#registry-preview-head');
        const previewBody = modal.querySelector('#registry-preview-body');
        const previewCount = modal.querySelector('#registry-preview-count');

        let importedRows = [];

        const resetPreview = () => {
            importedRows = [];
            if (previewContainer) previewContainer.classList.add('hidden');
            if (previewHead) previewHead.innerHTML = '';
            if (previewBody) previewBody.innerHTML = '';
            if (previewCount) previewCount.textContent = '';
            if (confirmBtn) confirmBtn.disabled = true;
        };

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                const ok = confirm(PTW._t('module.ptw.mapSettings.closeUnsaved', 'تنبيه: سيتم إغلاق النافذة.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) modal.remove();
            }
        });

        const handleFileChange = async (event) => {
            const file = event.target.files?.[0];
            resetPreview();
            if (!file) return;

            if (typeof XLSX === 'undefined') {
                Notification.error(this._t('module.ptw.notify.xlsxLibDetail', 'مكتبة Excel غير متوفرة. يرجى التأكد من تحميل المكتبة.'));
                return;
            }

            try {
                Loading.show('جاري قراءة الملف...');
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    Notification.error(this._t('module.ptw.notify.fileEmpty', 'الملف فارغ أو لا يحتوي على بيانات'));
                    Loading.hide();
                    return;
                }

                importedRows = jsonData;

                // عرض المعاينة
                if (jsonData.length > 0) {
                    const headers = Object.keys(jsonData[0]);
                    previewHead.innerHTML = `<tr>${headers.map(h => `<th class="px-2 py-1">${Utils.escapeHTML(h)}</th>`).join('')}</tr>`;
                    previewBody.innerHTML = jsonData.slice(0, 5).map(row =>
                        `<tr>${headers.map(h => `<td class="px-2 py-1">${Utils.escapeHTML(String(row[h] || ''))}</td>`).join('')}</tr>`
                    ).join('');
                    previewCount.textContent = `إجمالي الصفوف: ${jsonData.length}`;
                    previewContainer.classList.remove('hidden');
                    confirmBtn.disabled = false;
                }

                Loading.hide();
            } catch (error) {
                Loading.hide();
                Utils.safeError('فشل قراءة ملف Excel:', error);
                Notification.error(this._t('module.ptw.notify.readFileErr', 'فشل قراءة الملف: ') + (error.message || this._t('module.ptw.notify.unknownError', 'خطأ غير معروف')));
            }
        };

        if (fileInput) {
            fileInput.addEventListener('change', handleFileChange);
        }

        confirmBtn?.addEventListener('click', async () => {
            if (importedRows.length === 0) {
                Notification.warning(this._t('module.ptw.notify.selectFileFirst', 'يرجى اختيار ملف يحتوي على بيانات قبل الاستيراد.'));
                return;
            }
            await this.importRegistryFromExcel(importedRows, modal);
        });
    },

    /**
     * استيراد البيانات من Excel إلى السجل
     */
    async importRegistryFromExcel(rows, modal) {
        if (!rows || rows.length === 0) {
            Notification.error(this._t('module.ptw.notify.noImportData', 'لا توجد بيانات للاستيراد'));
            return;
        }

        try {
            Loading.show('جاري استيراد البيانات...');

            let imported = 0;
            let updated = 0;
            let skipped = 0;
            let errors = 0;

            // خريطة الأعمدة المحتملة (عربي/إنجليزي)
            const columnMap = {
                sequentialNumber: ['مسلسل', 'Sequential Number', 'sequentialNumber', 'مسلسل'],
                openDate: ['التاريخ', 'Date', 'openDate', 'تاريخ', 'تاريخ فتح التصريح'],
                permitType: ['نوع التصريح', 'Permit Type', 'permitType', 'نوع العمل'],
                requestingParty: ['الجهة الطالبة', 'Requesting Party', 'requestingParty', 'الجهة الطالبة'],
                location: ['الموقع', 'Location', 'location', 'موقع'],
                timeFrom: ['الوقت من', 'Time From', 'timeFrom', 'وقت من', 'بدء العمل'],
                timeTo: ['الوقت إلى', 'Time To', 'timeTo', 'وقت إلى', 'انتهاء العمل'],
                totalTime: ['إجمالي الوقت', 'Total Time', 'totalTime', 'إجمالي'],
                authorizedParty: ['الجهة المصرح لها', 'Authorized Party', 'authorizedParty', 'الجهة المصرح'],
                workDescription: ['وصف العمل', 'Work Description', 'workDescription', 'الوصف'],
                supervisor1: ['مسئول المتابعة 01', 'Supervisor 1', 'supervisor1', 'مسئول 01'],
                supervisor2: ['مسئول المتابعة 02', 'Supervisor 2', 'supervisor2', 'مسئول 02'],
                status: ['حالة التصريح', 'Status', 'status', 'الحالة']
            };

            // دالة للعثور على اسم العمود الصحيح
            const findColumn = (row, possibleNames) => {
                for (const key in row) {
                    const normalizedKey = String(key).trim();
                    for (const name of possibleNames) {
                        if (normalizedKey === name || normalizedKey.toLowerCase() === name.toLowerCase()) {
                            return row[key];
                        }
                    }
                }
                return null;
            };

            // دالة لتحويل التاريخ
            const parseDate = (dateValue) => {
                if (!dateValue) return null;
                const directParsedDate = this.parseDateTimeValue(dateValue);
                if (directParsedDate) return directParsedDate.toISOString();
                if (typeof dateValue === 'string') {
                    // محاولة تحليل التاريخ
                    const date = new Date(dateValue);
                    if (!isNaN(date.getTime())) return date.toISOString();
                }
                // معالجة Excel serial date مع دعم الوقت (الجزء الكسري)
                if (typeof dateValue === 'number') {
                    // Excel يخزن التاريخ كعدد الأيام من 1899-12-30
                    // والوقت كجزء كسري من اليوم
                    const totalDays = Math.floor(dateValue);
                    const timeFraction = dateValue - totalDays;
                    const baseDate = new Date(1899, 11, 30); // 30 ديسمبر 1899 (التوقيت المحلي)
                    const date = new Date(baseDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
                    // إضافة الوقت من الجزء الكسري
                    if (timeFraction > 0) {
                        const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        date.setHours(hours, minutes, seconds, 0);
                    }
                    if (!isNaN(date.getTime())) return date.toISOString();
                }
                return null;
            };

            for (const row of rows) {
                try {
                    // استخراج البيانات
                    const sequentialNumber = findColumn(row, columnMap.sequentialNumber);
                    const openDate = parseDate(findColumn(row, columnMap.openDate));
                    const permitType = findColumn(row, columnMap.permitType) || 'غير محدد';
                    const requestingParty = findColumn(row, columnMap.requestingParty) || 'غير محدد';
                    const location = findColumn(row, columnMap.location) || 'غير محدد';
                    const timeFrom = parseDate(findColumn(row, columnMap.timeFrom)) || openDate || new Date().toISOString();
                    const timeTo = parseDate(findColumn(row, columnMap.timeTo));
                    const totalTime = findColumn(row, columnMap.totalTime) || this.calculateTotalTime(timeFrom, timeTo);
                    const authorizedParty = findColumn(row, columnMap.authorizedParty) || 'غير محدد';
                    const workDescription = findColumn(row, columnMap.workDescription) || 'غير محدد';
                    const supervisor1 = findColumn(row, columnMap.supervisor1) || 'غير محدد';
                    const supervisor2 = findColumn(row, columnMap.supervisor2) || 'غير محدد';
                    const status = findColumn(row, columnMap.status) || 'مفتوح';

                    // التحقق من وجود رقم مسلسل
                    if (!sequentialNumber) {
                        skipped++;
                        continue;
                    }

                    // البحث عن سجل موجود بنفس الرقم المسلسل
                    const existingIndex = this.registryData.findIndex(r =>
                        r.sequentialNumber === Number(sequentialNumber) ||
                        r.sequentialNumber === String(sequentialNumber)
                    );

                    const entry = {
                        id: existingIndex >= 0 ? this.registryData[existingIndex].id : this.generateTemporaryId('REG'),
                        sequentialNumber: Number(sequentialNumber) || this.generateRegistrySequentialNumber(),
                        permitId: existingIndex >= 0 ? this.registryData[existingIndex].permitId : null,
                        openDate: openDate || new Date().toISOString(),
                        permitType: permitType,
                        requestingParty: requestingParty,
                        location: location,
                        timeFrom: timeFrom,
                        timeTo: timeTo || timeFrom,
                        totalTime: totalTime,
                        authorizedParty: authorizedParty,
                        workDescription: workDescription,
                        supervisor1: supervisor1,
                        supervisor2: supervisor2,
                        status: status,
                        closureDate: (status === 'مغلق' || status === 'مغلقة') ? (timeTo || new Date().toISOString()) : null,
                        closureReason: null,
                        createdAt: existingIndex >= 0 ? this.registryData[existingIndex].createdAt : new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    if (existingIndex >= 0) {
                        // تحديث سجل موجود
                        this.registryData[existingIndex] = entry;
                        updated++;
                    } else {
                        // إضافة سجل جديد
                        this.registryData.push(entry);
                        imported++;
                    }
                } catch (error) {
                    errors++;
                    Utils.safeError('خطأ في معالجة صف:', error);
                }
            }

            // حفظ البيانات
            await this.saveRegistryData();

            // تحديث الواجهة
            const registryContent = document.getElementById('ptw-registry-content');
            if (registryContent && this.currentTab === 'registry') {
                registryContent.innerHTML = this.renderRegistryContent();
                this.setupRegistryEventListeners();
            }

            Loading.hide();
            modal.remove();

            Notification.success(
                `تم الاستيراد بنجاح!\n` +
                `- تم إضافة: ${imported} سجل\n` +
                `- تم تحديث: ${updated} سجل\n` +
                (skipped > 0 ? `- تم تخطي: ${skipped} صف (بدون رقم مسلسل)\n` : '') +
                (errors > 0 ? `- أخطاء: ${errors} صف` : '')
            );
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في استيراد البيانات:', error);
            Notification.error(this._t('module.ptw.notify.importErr', 'حدث خطأ أثناء الاستيراد: ') + (error.message || this._t('module.ptw.notify.unknownError', 'خطأ غير معروف')));
        }
    },

    async renderList() {
        const { source: sourceItems, merged: allItems, permitsFromList, permitsFromRegistry } = this.getPermitMetricsDataset();
        const totalCount = allItems.length;
        const openCount = sourceItems.filter(p => p && this.isPermitOpenStatus(p.status)).length;
        const closedCount = sourceItems.filter(p => p && this.isPermitClosedStatus(p.status)).length;

        // قيم الفلاتر (فريدة من البيانات)
        const filterWorkTypes = [...new Set(allItems.map(p => (p.workType || '').trim()).filter(Boolean))].sort();
        const filterLocations = [...new Set(allItems.map(p => (p.siteName || p.location || '').trim()).filter(Boolean))].sort();
        const filterSublocations = [...new Set(allItems.map(p => (p.sublocationName || p.sublocation || '').trim()).filter(Boolean))].sort();
        const filterStatuses = ['مفتوح', 'قيد المراجعة', 'موافق عليه', 'مرفوض', 'مغلق', 'اكتمل العمل بشكل آمن', 'إغلاق جبري', 'لم يكتمل العمل'];

        // حساب إحصائيات أنواع التصاريح
        const workTypeStats = {};
        allItems.forEach(item => {
            const workType = item.workType || 'غير محدد';
            if (!workTypeStats[workType]) {
                workTypeStats[workType] = {
                    total: 0,
                    open: 0,
                    closed: 0
                };
            }
            workTypeStats[workType].total++;
            const st = (item.status || '').trim();
            if (st === 'مغلق' || st === 'مرفوض' || st === 'اكتمل العمل بشكل آمن' || st === 'إغلاق جبري') {
                workTypeStats[workType].closed++;
            } else {
                workTypeStats[workType].open++;
            }
        });

        // ترتيب الأنواع حسب العدد
        const sortedWorkTypes = Object.entries(workTypeStats)
            .sort((a, b) => b[1].total - a[1].total);

        // إنشاء HTML لأنواع التصاريح (أول نوع فقط للعرض في الكارت)
        const topWorkType = sortedWorkTypes.length > 0 ? sortedWorkTypes[0] : null;
        const workTypesCount = Object.keys(workTypeStats).length;
        const workTypeCardHTML = `
            <div class="relative ptw-work-type-card rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 overflow-hidden group">
                <!-- خلفية متحركة -->
                <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-14 h-14 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 border border-white/30">
                                <i class="fas fa-tags text-white text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white mb-1 drop-shadow-md">أنواع التصاريح</h3>
                                <p class="text-xs text-purple-100 font-medium">${workTypesCount} نوع مختلف</p>
                            </div>
                        </div>
                    </div>
                    <div class="ptw-card-inner rounded-xl p-4 shadow-lg backdrop-blur-sm">
                        ${topWorkType ? `
                            <div class="ptw-card-text font-bold text-base mb-4 line-clamp-2" title="${Utils.escapeHTML(topWorkType[0])}">
                                ${Utils.escapeHTML(topWorkType[0].length > 50 ? topWorkType[0].substring(0, 50) + '...' : topWorkType[0])}
                            </div>
                            <div class="flex items-center justify-between gap-2 flex-wrap">
                            <div class="ptw-stat-badge ptw-stat-open flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm">
                                <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                <span class="text-orange-700 font-bold text-sm">مفتوح: ${topWorkType[1].open}</span>
                            </div>
                                <div class="ptw-stat-badge ptw-stat-closed flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm">
                                    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span class="text-green-700 font-bold text-sm">مغلق: ${topWorkType[1].closed}</span>
                                </div>
                                <div class="ptw-stat-badge ptw-stat-total flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm">
                                    <div class="w-2 h-2 bg-gray-600 rounded-full"></div>
                                    <span class="text-gray-800 font-bold text-sm">إجمالي: ${topWorkType[1].total}</span>
                                </div>
                            </div>
                        ` : `
                            <div class="ptw-card-text text-center py-4 text-gray-500">
                                <i class="fas fa-info-circle text-2xl mb-2"></i>
                                <p class="text-sm">لا توجد أنواع تصاريح حالياً</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="content-card mb-6">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-chart-bar ml-2"></i>عدادات الحالة</h2>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <!-- كرت التصاريح المفتوحة -->
                        <div class="relative ptw-stat-card ptw-stat-card-open rounded-2xl p-6 text-center shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div class="absolute top-0 right-0 w-24 h-24 bg-white/15 rounded-full -mr-12 -mt-12"></div>
                            <div class="absolute bottom-0 left-0 w-20 h-20 bg-white/15 rounded-full -ml-10 -mb-10"></div>
                            <div class="relative z-10">
                                <div class="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 border border-white/30">
                                    <i class="fas fa-unlock-alt text-white text-2xl"></i>
                                </div>
                                <div class="text-5xl font-extrabold text-white mb-3 drop-shadow-lg" id="ptw-open-count">${openCount}</div>
                                <div class="text-base font-bold text-orange-50">عدد التصاريح المفتوحة</div>
                                <div class="mt-3 flex items-center justify-center gap-2">
                                    <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                    <span class="text-xs text-orange-100 font-medium">نشطة حالياً</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- كرت التصاريح المغلقة -->
                        <div class="relative ptw-stat-card ptw-stat-card-closed rounded-2xl p-6 text-center shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div class="absolute top-0 right-0 w-24 h-24 bg-white/15 rounded-full -mr-12 -mt-12"></div>
                            <div class="absolute bottom-0 left-0 w-20 h-20 bg-white/15 rounded-full -ml-10 -mb-10"></div>
                            <div class="relative z-10">
                                <div class="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 border border-white/30">
                                    <i class="fas fa-lock text-white text-2xl"></i>
                                </div>
                                <div class="text-5xl font-extrabold text-white mb-3 drop-shadow-lg" id="ptw-closed-count">${closedCount}</div>
                                <div class="text-base font-bold text-green-50">عدد التصاريح المغلقة</div>
                                <div class="mt-3 flex items-center justify-center gap-2">
                                    <i class="fas fa-check-circle text-white text-xs"></i>
                                    <span class="text-xs text-green-100 font-medium">مكتملة</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- كرت إجمالي التصاريح -->
                        <div class="relative ptw-stat-card ptw-stat-card-total rounded-2xl p-6 text-center shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden group">
                            <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div class="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
                            <div class="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -ml-10 -mb-10"></div>
                            <div class="relative z-10">
                                <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300 border border-white/25">
                                    <i class="fas fa-clipboard-list text-white text-2xl"></i>
                                </div>
                                <div class="text-5xl font-extrabold text-white mb-3 drop-shadow-lg" id="ptw-total-count">${totalCount}</div>
                                <div class="text-base font-bold text-gray-100">إجمالي التصاريح</div>
                                <div class="mt-3 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/25">
                                    <div class="text-xs text-gray-100 font-medium">
                                        <i class="fas fa-database text-xs ml-1"></i>
                                        ${permitsFromList.length} قائمة + ${permitsFromRegistry.length} سجل
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${workTypeCardHTML}
                    </div>
                    
                    <!-- كرت أنواع التصاريح الكامل (للتفاصيل) -->
                    ${sortedWorkTypes.length > 0 ? `
                    <div class="relative ptw-work-types-container rounded-2xl p-8 shadow-2xl overflow-hidden">
                        <!-- خلفية متحركة -->
                        <div class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                        <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                        <div class="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
                        
                        <div class="relative z-10">
                            <div class="flex items-center justify-between mb-6">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                                        <i class="fas fa-tags text-white text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 class="text-2xl font-bold text-white mb-1 drop-shadow-md">جميع أنواع التصاريح</h3>
                                        <p class="text-sm text-purple-100">تفاصيل شاملة لجميع الأنواع</p>
                                    </div>
                                </div>
                                <div class="bg-white/25 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30 shadow-lg">
                                    <span class="text-lg font-bold text-white">${Object.keys(workTypeStats).length}</span>
                                    <span class="text-sm text-purple-100 font-medium mr-1">نوع</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="ptw-work-types-stats">
                                ${sortedWorkTypes.map(([type, stats], index) => `
                                    <div class="group relative ptw-work-type-item backdrop-blur-sm rounded-xl p-4 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
                                        <div class="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-400/20 to-indigo-400/20 rounded-full -mr-10 -mt-10"></div>
                                        <div class="relative z-10">
                                            <div class="flex items-start justify-between mb-3">
                                                <div class="flex-1 min-w-0">
                                                    <div class="ptw-work-type-name font-bold text-sm mb-2 line-clamp-2 leading-tight" title="${Utils.escapeHTML(type)}">
                                                        ${Utils.escapeHTML(type)}
                                                    </div>
                                                </div>
                                                <div class="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white text-xl font-extrabold rounded-lg px-3 py-1.5 shadow-md ml-3 min-w-[3rem] text-center">
                                                    ${stats.total}
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <div class="ptw-stat-badge ptw-stat-open flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-sm">
                                                    <div class="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                                    <span class="text-orange-700 font-bold text-xs">مفتوح: ${stats.open}</span>
                                                </div>
                                                <div class="ptw-stat-badge ptw-stat-closed flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-sm">
                                                    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                                                    <span class="text-green-700 font-bold text-xs">مغلق: ${stats.closed}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-list ml-2"></i>قائمة تصاريح العمل</h2>
                </div>
                <!-- فلتر احترافي أعلى الجدول (بنفس تصميم الملاحظات اليومية) -->
                <div class="ptw-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 -20px 0 -20px; width: calc(100% + 40px); direction: rtl;">
                    <div class="ptw-filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; align-items: end;">
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-search ml-1"></i>البحث</label>
                            <input type="text" id="ptw-search" class="ptw-filter-input" placeholder="ابحث بنوع العمل أو الموقع..." style="direction: rtl; text-align: right;">
                        </div>
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-tag ml-1"></i>نوع العمل</label>
                            <select id="ptw-filter-work-type" class="ptw-filter-input" style="direction: rtl;">
                                <option value="">الكل</option>
                                ${filterWorkTypes.map(w => `<option value="${Utils.escapeHTML(w)}">${Utils.escapeHTML(w)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-map-marker-alt ml-1"></i>الموقع</label>
                            <select id="ptw-filter-location" class="ptw-filter-input" style="direction: rtl;">
                                <option value="">الكل</option>
                                ${filterLocations.map(l => `<option value="${Utils.escapeHTML(l)}">${Utils.escapeHTML(l)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-location-dot ml-1"></i>المكان الفرعي</label>
                            <select id="ptw-filter-sublocation" class="ptw-filter-input" style="direction: rtl;">
                                <option value="">الكل</option>
                                ${filterSublocations.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-info-circle ml-1"></i>الحالة</label>
                            <select id="ptw-filter-status" class="ptw-filter-input" style="direction: rtl;">
                                <option value="">الكل</option>
                                ${filterStatuses.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-calendar-alt ml-1"></i>من تاريخ</label>
                            <input type="date" id="ptw-filter-date-from" class="ptw-filter-input" style="direction: rtl;">
                        </div>
                        <div class="ptw-filter-field">
                            <label class="ptw-filter-label" style="text-align: right;"><i class="fas fa-calendar-check ml-1"></i>إلى تاريخ</label>
                            <input type="date" id="ptw-filter-date-to" class="ptw-filter-input" style="direction: rtl;">
                            <div class="text-xs text-gray-600 mt-1">
                                عدد التصاريح في الفلتر: <span id="ptw-filter-count">-</span>
                            </div>
                        </div>
                        <div class="ptw-filter-field">
                            <button id="ptw-reset-filters" class="ptw-filter-reset-btn" type="button"><i class="fas fa-redo ml-1"></i>إعادة التعيين</button>
                        </div>
                        <div class="ptw-filter-field">
                            <button id="ptw-refresh-list" class="ptw-filter-reset-btn" type="button" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);"><i class="fas fa-sync-alt ml-1"></i>تحديث</button>
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding-top: 20px;">
                    <div id="ptw-table-container" class="ptw-table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>نوع العمل</th>
                                    <th>الموقع</th>
                                    <th>المكان الفرعي</th>
                                    <th>تاريخ البدء</th>
                                    <th>تاريخ الانتهاء</th>
                                    <th>الحالة</th>
                                    <th>مسار الاعتماد</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="8" class="text-center text-gray-500 py-8">
                                        <div style="width: 300px; margin: 0 auto 16px;">
                                            <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                                <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                            </div>
                                        </div>
                                        <p class="text-gray-500">جاري التحميل...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    updateKPIs() {
        try {
            const { source: sourceItems, merged: allItems, permitsFromList, permitsFromRegistry } = this.getPermitMetricsDataset();
            const totalCount = allItems.length;
            const openCount = sourceItems.filter(p => p && this.isPermitOpenStatus(p.status)).length;
            const closedCount = sourceItems.filter(p => p && this.isPermitClosedStatus(p.status)).length;

            // تحديث الكروت الأساسية
            const openCountEl = document.getElementById('ptw-open-count');
            const closedCountEl = document.getElementById('ptw-closed-count');
            const totalCountEl = document.getElementById('ptw-total-count');

            if (openCountEl) openCountEl.textContent = openCount;
            if (closedCountEl) closedCountEl.textContent = closedCount;
            if (totalCountEl) {
                totalCountEl.textContent = totalCount;
                // تحديث النص التوضيحي
                const parentCard = totalCountEl.closest('.bg-gradient-to-br');
                if (parentCard) {
                    const subtitle = parentCard.querySelector('.text-xs.text-gray-600');
                    if (subtitle) {
                        subtitle.textContent = `من ${permitsFromList.length} قائمة + ${permitsFromRegistry.length} سجل`;
                    }
                }
            }

            // حساب إحصائيات أنواع التصاريح
            const workTypeStats = {};
            allItems.forEach(item => {
                const workType = item.workType || 'غير محدد';
                if (!workTypeStats[workType]) {
                    workTypeStats[workType] = {
                        total: 0,
                        open: 0,
                        closed: 0
                    };
                }
                workTypeStats[workType].total++;
                if (this.isPermitClosedStatus(item.status)) {
                    workTypeStats[workType].closed++;
                } else {
                    workTypeStats[workType].open++;
                }
            });

            // تحديث كرت أنواع التصاريح (الكارت الرئيسي بجانب الإجمالي)
            const sortedWorkTypes = Object.entries(workTypeStats)
                .sort((a, b) => b[1].total - a[1].total);
            
            const topWorkType = sortedWorkTypes.length > 0 ? sortedWorkTypes[0] : null;
            
            // البحث عن كارت أنواع التصاريح في الصف الأول
            const workTypeCard = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-4 .bg-gradient-to-br.from-purple-50');
            if (workTypeCard && topWorkType) {
                workTypeCard.innerHTML = `
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                                <i class="fas fa-tags text-white text-lg"></i>
                            </div>
                            <div>
                                <h3 class="text-base font-bold text-purple-800">أنواع التصاريح</h3>
                                <p class="text-xs text-purple-600">${Object.keys(workTypeStats).length} نوع</p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-purple-200">
                        <div class="font-semibold text-gray-800 text-sm mb-3 line-clamp-2" title="${Utils.escapeHTML(topWorkType[0])}">
                            ${Utils.escapeHTML(topWorkType[0].length > 50 ? topWorkType[0].substring(0, 50) + '...' : topWorkType[0])}
                        </div>
                        <div class="flex items-center justify-between gap-3 text-xs">
                            <div class="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-md">
                                <i class="fas fa-circle text-blue-500 text-[8px]"></i>
                                <span class="text-blue-700 font-semibold">مفتوح: ${topWorkType[1].open}</span>
                            </div>
                            <div class="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-md">
                                <i class="fas fa-circle text-green-500 text-[8px]"></i>
                                <span class="text-green-700 font-semibold">مغلق: ${topWorkType[1].closed}</span>
                            </div>
                            <div class="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md">
                                <i class="fas fa-circle text-gray-500 text-[8px]"></i>
                                <span class="text-gray-700 font-semibold">إجمالي: ${topWorkType[1].total}</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // تحديث كرت أنواع التصاريح الكامل (للتفاصيل)
            const workTypesContainer = document.getElementById('ptw-work-types-stats');
            if (workTypesContainer && sortedWorkTypes.length > 1) {
                workTypesContainer.innerHTML = sortedWorkTypes.map(([type, stats]) => `
                    <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                        <div class="flex-1">
                            <div class="font-semibold text-gray-800 text-sm mb-1 line-clamp-1" title="${Utils.escapeHTML(type)}">${Utils.escapeHTML(type)}</div>
                            <div class="flex items-center gap-3 text-xs text-gray-600">
                                <span class="flex items-center gap-1">
                                    <i class="fas fa-circle text-blue-500 text-[8px]"></i>
                                    مفتوح: ${stats.open}
                                </span>
                                <span class="flex items-center gap-1">
                                    <i class="fas fa-circle text-green-500 text-[8px]"></i>
                                    مغلق: ${stats.closed}
                                </span>
                                <span class="flex items-center gap-1">
                                    <i class="fas fa-circle text-gray-500 text-[8px]"></i>
                                    إجمالي: ${stats.total}
                                </span>
                            </div>
                        </div>
                        <div class="text-xl font-bold text-primary-600 ml-3">${stats.total}</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تحديث KPIs:', error);
        }
    },

    /**
     * استخراج أنواع التصاريح النشطة من بيانات التصريح
     * يُعيد مصفوفة بمفاتيح حقول IssuingAuthorities (coldWork, loto, hotWork...)
     */
    _extractPermitTypeFields(ptwData) {
        if (!ptwData) return [];
        const types = [];
        if (ptwData.hotWorkDetails && (Array.isArray(ptwData.hotWorkDetails) ? ptwData.hotWorkDetails.length > 0 : true)) {
            types.push('hotWork');
        }
        if (ptwData.confinedSpaceDetails && (Array.isArray(ptwData.confinedSpaceDetails) ? ptwData.confinedSpaceDetails.length > 0 : true)) {
            types.push('confinedSpace');
        }
        if (ptwData.heightWorkDetails && (Array.isArray(ptwData.heightWorkDetails) ? ptwData.heightWorkDetails.length > 0 : true)) {
            types.push('workAtHeight');
        }
        if (ptwData.lotoApplied === true || ptwData.lotoApplied === 'true') {
            types.push('loto');
        }
        if (ptwData.coldWorkType && String(ptwData.coldWorkType).trim()) {
            types.push('coldWork');
        }
        if (ptwData.excavationLength || ptwData.excavationWidth || ptwData.excavationDepth) {
            types.push('excavation');
        }
        // حقل permitType/workType قد يحتوي على إشارات للمقاول وخطة الرفع
        const permitTypeStr = String(ptwData.permitType || ptwData.workType || '').toLowerCase();
        if (permitTypeStr.includes('مقاول') || permitTypeStr.includes('contractor')) {
            types.push('contractorPTW');
        }
        if (permitTypeStr.includes('رفع') || permitTypeStr.includes('lifting')) {
            types.push('liftingPlan');
        }
        // إذا لم يُكتشف أي نوع، ننظر في permitType كمصفوفة أو نص
        if (types.length === 0 && ptwData.permitType) {
            const ptArr = Array.isArray(ptwData.permitType) ? ptwData.permitType : [ptwData.permitType];
            const iaModule = typeof IssuingAuthorities !== 'undefined' ? IssuingAuthorities : null;
            if (iaModule && typeof iaModule.mapPermitTypeToField === 'function') {
                ptArr.forEach(pt => {
                    const field = iaModule.mapPermitTypeToField(pt);
                    if (field && !types.includes(field)) types.push(field);
                });
            }
        }
        return [...new Set(types)];
    },

    /**
     * بناء خطوات الـ Workflow من قائمة Issuing Authorities
     *
     * الخوارزمية:
     *   - لكل نوع تصريح نشط → جلب المرشحين من القائمة
     *   - دمج جميع المرشحين (بإزالة التكرار بـ id)
     *   - G → خطوة اعتماد مباشرة
     *   - Y → خطوة اعتماد + خطوة HSE Co-Approval قبله
     *   - إذا لا يوجد مرشح صالح → إعادة null (fallback للدوائر الحالية)
     */
    async _buildIssuingAuthoritiesWorkflow(permitTypeFields) {
        if (!permitTypeFields || permitTypeFields.length === 0) return null;
        const iaModule = typeof IssuingAuthorities !== 'undefined' ? IssuingAuthorities : null;
        if (!iaModule || typeof iaModule.getAuthoritiesForPermitType !== 'function') return null;

        const allAuthoritiesMap = {};
        for (const field of permitTypeFields) {
            try {
                const list = await iaModule.getAuthoritiesForPermitType(field);
                (list || []).forEach(auth => {
                    const key = auth.id || auth.email || auth.name;
                    if (!key) return;
                    if (!allAuthoritiesMap[key]) {
                        allAuthoritiesMap[key] = { ...auth, _permitFields: [] };
                    }
                    allAuthoritiesMap[key]._permitFields.push(field);
                    // إذا كان G في أي نوع → يبقى G (الأولوية لـ G)
                    if (auth.permitLevel === 'G') {
                        allAuthoritiesMap[key].permitLevel = 'G';
                        allAuthoritiesMap[key].requiresHseCoApproval = false;
                    }
                });
            } catch (err) {
                if (typeof Utils !== 'undefined') Utils.safeWarn('_buildIssuingAuthoritiesWorkflow fetch error:', err);
            }
        }

        const authorities = Object.values(allAuthoritiesMap);
        if (authorities.length === 0) return null;

        const approvals = [];
        let order = 0;

        // نفصل G عن Y لترتيب G أولاً
        const gAuthorities = authorities.filter(a => a.permitLevel === 'G');
        const yAuthorities = authorities.filter(a => a.permitLevel === 'Y');

        // مرشحو G → خطوة واحدة مع candidates (بدون شرط إضافي)
        if (gAuthorities.length > 0) {
            approvals.push({
                role: 'مسؤول الجهة المصرح لهم بالتوقيع (G)',
                required: true,
                approved: false,
                rejected: false,
                status: 'pending',
                approver: '',
                approverEmail: '',
                approverId: '',
                date: '',
                comments: '',
                order: order++,
                isSafetyOfficer: false,
                issuingAuthoritySource: true,
                requiresHseCoApproval: false,
                candidates: gAuthorities.map(a => ({
                    id: a.id || '',
                    name: a.name || '',
                    email: a.email || '',
                    phone: a.phone || '',
                    permitLevel: 'G'
                }))
            });
        }

        // مرشحو Y → خطوة HSE Co-Approval أولاً، ثم خطوة التوقيع
        if (yAuthorities.length > 0) {
            // خطوة 1: تنسيق مدير السلامة (HSE Gate)
            const hseSafetyTeam = this._getHseSafetyTeamCandidates();
            approvals.push({
                role: 'مسؤول السلامة والصحة المهنية (تنسيق Y)',
                required: true,
                approved: false,
                rejected: false,
                status: 'pending',
                approver: '',
                approverEmail: '',
                approverId: '',
                date: '',
                comments: '',
                order: order++,
                isSafetyOfficer: true,
                issuingAuthoritySource: true,
                requiresHseCoApproval: false,
                isHseCoApprovalGate: true,
                candidates: hseSafetyTeam
            });
            // خطوة 2: توقيع الشخص (Y)
            approvals.push({
                role: 'مسؤول الجهة المصرح لهم بالتوقيع (Y - بعد تنسيق HSE)',
                required: true,
                approved: false,
                rejected: false,
                status: 'pending',
                approver: '',
                approverEmail: '',
                approverId: '',
                date: '',
                comments: '',
                order: order++,
                isSafetyOfficer: false,
                issuingAuthoritySource: true,
                requiresHseCoApproval: true,
                candidates: yAuthorities.map(a => ({
                    id: a.id || '',
                    name: a.name || '',
                    email: a.email || '',
                    phone: a.phone || '',
                    permitLevel: 'Y'
                }))
            });
        }

        if (approvals.length === 0) return null;

        return {
            approvals,
            circuitOwnerId: '__issuing_authorities__',
            circuitName: 'قائمة المصرح لهم بالتوقيع',
            issuingAuthoritiesSource: true
        };
    },

    /**
     * الحصول على مرشحي فريق السلامة لخطوة HSE Co-Approval
     */
    _getHseSafetyTeamCandidates() {
        try {
            const safetyTeam = AppState?.appData?.safetyTeam || AppState?.formSettingsState?.safetyTeam || [];
            if (Array.isArray(safetyTeam) && safetyTeam.length > 0) {
                return safetyTeam.slice(0, 5).map(m => ({
                    id: m.id || m.employeeCode || '',
                    name: m.name || m.memberName || '',
                    email: m.email || '',
                    phone: m.phone || ''
                })).filter(m => m.name);
            }
        } catch (e) {}
        return [];
    },

    async prepareApprovalsForForm(ptwData = null) {
        // التصاريح اليدوية لا تستخدم دائرة الاعتمادات النظامية
        if (ptwData && ptwData.isManualEntry === true) {
            return {
                approvals: ptwData.manualApprovals || [],
                circuitOwnerId: '__manual__',
                circuitName: 'Manual Entry',
                isManual: true
            };
        }

        if (ptwData && Array.isArray(ptwData.approvals)) {
            const circuitOwnerId = ptwData.approvalCircuitOwnerId || '__default__';
            const approvals = this.normalizeApprovals(ptwData.approvals).map((approval, index) =>
                ApprovalCircuits._attachMetadataToApproval(approval, index, circuitOwnerId)
            );
            return {
                approvals,
                circuitOwnerId,
                circuitName: ptwData.approvalCircuitName || ''
            };
        }

        // ✅ محاولة توليد الـ workflow من قائمة Issuing Authorities
        try {
            const permitTypeFields = this._extractPermitTypeFields(ptwData);
            if (permitTypeFields.length > 0) {
                const iaWorkflow = await this._buildIssuingAuthoritiesWorkflow(permitTypeFields);
                if (iaWorkflow && iaWorkflow.approvals && iaWorkflow.approvals.length > 0) {
                    const approvals = this.normalizeApprovals(iaWorkflow.approvals);
                    return {
                        approvals,
                        circuitOwnerId: iaWorkflow.circuitOwnerId,
                        circuitName: iaWorkflow.circuitName,
                        issuingAuthoritiesSource: true
                    };
                }
            }
        } catch (iaErr) {
            if (typeof Utils !== 'undefined') Utils.safeWarn('فشل توليد workflow من IssuingAuthorities، سيتم استخدام ApprovalCircuits:', iaErr);
        }

        // fallback: ApprovalCircuits الحالية
        const requesterId = AppState.currentUser?.id || '';
        const generated = ApprovalCircuits.generateApprovalsForUser(requesterId);
        const approvals = this.normalizeApprovals(generated.approvals || []);
        return {
            approvals,
            circuitOwnerId: generated.circuitOwnerId || '__default__',
            circuitName: generated.circuitName || ''
        };
    },

    /**
     * إعداد موافقات إغلاق التصريح (بنفس طريقة القسم السابع)
     */
    prepareClosureApprovalsForForm(ptwData = null) {
        // التصاريح اليدوية تستخدم اعتمادات الإغلاق اليدوية
        if (ptwData && ptwData.isManualEntry === true) {
            return {
                approvals: ptwData.manualClosureApprovals || [],
                circuitOwnerId: '__manual__',
                circuitName: 'Manual Closure Entry',
                isManual: true
            };
        }

        if (ptwData && Array.isArray(ptwData.closureApprovals)) {
            const circuitOwnerId = ptwData.closureApprovalCircuitOwnerId || '__default__';
            const approvals = this.normalizeApprovals(ptwData.closureApprovals).map((approval, index) =>
                ApprovalCircuits._attachMetadataToApproval(approval, index, circuitOwnerId)
            );
            return {
                approvals,
                circuitOwnerId,
                circuitName: ptwData.closureApprovalCircuitName || ''
            };
        }

        // استخدام نفس دائرة الاعتمادات للقسم السابع
        const requesterId = AppState.currentUser?.id || '';
        const generated = ApprovalCircuits.generateApprovalsForUser(requesterId);
        const approvals = this.normalizeApprovals(generated.approvals || []);
        return {
            approvals,
            circuitOwnerId: generated.circuitOwnerId || '__default__',
            circuitName: generated.circuitName || ''
        };
    },

    renderPermitSystemHeader() {
        const settings = AppState?.companySettings || {};
        const companyName = settings.companyName || settings.name || settings.organizationName || 'HSE System';
        const logoUrl = settings.logoUrl || settings.companyLogo || settings.logo || '';
        const formTitle = 'نموذج تصريح العمل';
        const subTitle = 'Permit To Work';

        return `
            <div class="ptw-paper-header">
                <div class="ptw-paper-header-right">
                    <div class="ptw-paper-header-title">${Utils.escapeHTML(formTitle)}</div>
                    <div class="ptw-paper-header-subtitle">${Utils.escapeHTML(subTitle)}</div>
                </div>
                <div class="ptw-paper-header-center">
                    <div class="ptw-paper-header-company">${Utils.escapeHTML(companyName)}</div>
                </div>
                <div class="ptw-paper-header-left">
                    ${logoUrl
                        ? `<img src="${Utils.escapeHTML(logoUrl)}" alt="Company Logo" class="ptw-paper-header-logo">`
                        : `<div class="ptw-paper-header-logo-fallback">LOGO</div>`
                    }
                </div>
            </div>
        `;
    },

    async renderForm(ptwData = null) {
        const isEdit = !!ptwData;
        const isManual = ptwData?.isManualEntry === true;
        const approvalPackage = await this.prepareApprovalsForForm(ptwData);
        const approvals = approvalPackage.approvals || [];
        this.formApprovals = approvals.map(approval => Object.assign({}, approval));
        this.formCircuitOwnerId = approvalPackage.circuitOwnerId || '__default__';
        const circuitName = approvalPackage.circuitName || '';
        this.formCircuitName = circuitName;
        const statusValue = ptwData?.status || 'قيد المراجعة';

        const escapeHTML = (value) => Utils.escapeHTML(value || '');
        const teamMembers = Array.isArray(ptwData?.teamMembers) && ptwData.teamMembers.length > 0
            ? ptwData.teamMembers
            : [{ name: '' }];

        const hotWorkDetails = Array.isArray(ptwData?.hotWorkDetails) ? ptwData.hotWorkDetails : [];
        const confinedSpaceDetails = Array.isArray(ptwData?.confinedSpaceDetails) ? ptwData.confinedSpaceDetails : [];
        const heightWorkDetails = Array.isArray(ptwData?.heightWorkDetails) ? ptwData.heightWorkDetails : [];

        const hotWorkOther = ptwData?.hotWorkOther || '';
        const confinedSpaceOther = ptwData?.confinedSpaceOther || '';
        const heightWorkOther = ptwData?.heightWorkOther || '';

        const closureStatus = ptwData?.closureStatus || '';
        const closureTimeValue = ptwData?.closureTime ? Utils.toDateTimeLocalString(ptwData.closureTime) : '';
        const closureReason = ptwData?.closureReason || '';
        // ✅ توحيد مصدر الجهات المعتمدة: الاعتماد على Contractors.getAllContractorsForModules (مقاولين/موردين)
        const approvedEntities = (typeof Contractors !== 'undefined' && typeof Contractors.getContractorOptionsForModules === 'function')
            ? (Contractors.getContractorOptionsForModules({ includeSuppliers: true, approvedOnly: true }) || [])
                .map(e => ({ name: (e.name || '').trim() }))
                .filter(e => e.name)
            : [];
        const hasApprovedEntities = approvedEntities.length > 0;
        const authorizedPartyValue = ptwData?.authorizedParty || '';
        // قائمة الإدارات للجهة الطالبة للتصريح (ربط بقاعدة الإدارة)
        const departmentOptionsForm = this.getDepartmentOptionsForPTW();
        const hasDepartmentsForm = departmentOptionsForm.length > 0;
        const requestingPartyValueForm = ptwData?.requestingParty || '';

        const hotOptions = [
            { id: 'welding', label: 'لحام' },
            { id: 'cutting', label: 'قطع' },
            { id: 'spark', label: 'شرر / حرارة' },
            { id: 'other', label: 'أخرى', hasOther: true }
        ];

        const confinedOptions = [
            { id: 'tanks', label: 'خزانات' },
            { id: 'pipes', label: 'أنابيب' },
            { id: 'containers', label: 'تنكات' },
            { id: 'other', label: 'أخرى', hasOther: true }
        ];

        const heightOptions = [
            { id: 'scaffold', label: 'سقالات' },
            { id: 'roof', label: 'سطح' },
            { id: 'lift', label: 'سلة رافع' },
            { id: 'other', label: 'أخرى', hasOther: true }
        ];

        const renderChecklistOptions = (options, selections, groupName, otherValue = '') => {
            return options.map(option => {
                const isChecked = option.hasOther ? !!otherValue : selections.includes(option.label);
                const toggleAttr = option.hasOther ? ` data-toggle-target="#${groupName}-other-wrapper"` : '';
                const checkbox = `
                    <label class="ptw-check-option">
                        <input type="checkbox" class="ptw-check-input" name="${groupName}-option" value="${option.id}" data-label="${option.label}"${toggleAttr} ${isChecked ? 'checked' : ''}>
                        <span>${option.label}</span>
                    </label>
                `;
                if (option.hasOther) {
                    return `
                        ${checkbox}
                        <div id="${groupName}-other-wrapper" class="ptw-other-input ${isChecked ? '' : 'hidden'}">
                            <input type="text" id="${groupName}-other-text" class="form-input" placeholder="اذكر التفاصيل" value="${escapeHTML(otherValue)}">
                        </div>
                    `;
                }
                return checkbox;
            }).join('');
        };

        const teamMembersListHTML = teamMembers.map(member => `
            <div class="ptw-team-member-row flex items-center gap-3">
                <input type="text" class="form-input flex-1 ptw-team-member-name" placeholder="اسم العامل" value="${escapeHTML(member.name)}">
                <button type="button" class="btn-icon btn-icon-danger" onclick="PTW.removeTeamMemberRow(this)" title="حذف">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        return `
            <style>
                .ptw-paper-theme {
                    background: #000;
                    color: #fff;
                    border: 1px solid #1e3a8a;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .ptw-paper-header {
                    display: grid;
                    grid-template-columns: 1fr 1.4fr 1fr;
                    align-items: center;
                    gap: 12px;
                    background: #000;
                    border-bottom: 1px solid #6b7280;
                    padding: 12px 16px;
                    min-height: 86px;
                }
                .ptw-paper-header-right { text-align: right; }
                .ptw-paper-header-title { font-weight: 700; font-size: 15px; color: #dbeafe; }
                .ptw-paper-header-subtitle { font-size: 12px; color: #93c5fd; }
                .ptw-paper-header-center { text-align: center; }
                .ptw-paper-header-company { font-size: 17px; font-weight: 700; color: #f9fafb; letter-spacing: 0.3px; }
                .ptw-paper-header-left { display: flex; justify-content: flex-end; }
                .ptw-paper-header-logo { max-height: 60px; max-width: 150px; object-fit: contain; background: #fff; border-radius: 4px; padding: 4px; }
                .ptw-paper-header-logo-fallback { width: 90px; height: 48px; border: 1px solid #6b7280; display: flex; align-items: center; justify-content: center; color: #d1d5db; font-size: 12px; }
                .ptw-form-header-centered {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ptw-form-header-centered .card-title {
                    width: 100%;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.6rem;
                    flex-wrap: wrap;
                    line-height: 1.25;
                    padding-inline: 4.5rem;
                    margin: 0;
                }
                .ptw-form-header-centered .ptw-form-id-badge {
                    position: absolute;
                    inset-inline-end: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                }

                .ptw-form-section {
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border: 2px solid;
                    transition: all 0.3s ease;
                }
                .ptw-form-section:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                    transform: translateY(-2px);
                }
                .ptw-form-section h3 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 3px solid;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ptw-form-section h3 i {
                    font-size: 1.5rem;
                    padding: 10px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.3);
                }
                .ptw-section-1 { background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-color: #2196F3; }
                .ptw-section-1 h3 { color: #1565C0; border-color: #2196F3; }
                .ptw-section-1 h3 i { color: #1976D2; background: rgba(33, 150, 243, 0.1); }
                
                .ptw-section-2 { background: linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%); border-color: #009688; }
                .ptw-section-2 h3 { color: #00695C; border-color: #009688; }
                .ptw-section-2 h3 i { color: #00796B; background: rgba(0, 150, 136, 0.1); }
                
                .ptw-section-3 { background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); border-color: #9C27B0; }
                .ptw-section-3 h3 { color: #6A1B9A; border-color: #9C27B0; }
                .ptw-section-3 h3 i { color: #7B1FA2; background: rgba(156, 39, 176, 0.1); }
                
                .ptw-section-4 { background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-color: #FF9800; }
                .ptw-section-4 h3 { color: #E65100; border-color: #FF9800; }
                .ptw-section-4 h3 i { color: #F57C00; background: rgba(255, 152, 0, 0.1); }
                
                .ptw-section-5 { background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%); border-color: #E91E63; }
                .ptw-section-5 h3 { color: #AD1457; border-color: #E91E63; }
                .ptw-section-5 h3 i { color: #C2185B; background: rgba(233, 30, 99, 0.1); }
                
                .ptw-section-6 { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-color: #4CAF50; }
                .ptw-section-6 h3 { color: #2E7D32; border-color: #4CAF50; }
                .ptw-section-6 h3 i { color: #388E3C; background: rgba(76, 175, 80, 0.1); }
                
                .ptw-section-7 { background: linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%); border-color: #795548; }
                .ptw-section-7 h3 { color: #4E342E; border-color: #795548; }
                .ptw-section-7 h3 i { color: #5D4037; background: rgba(121, 85, 72, 0.1); }
                
                .ptw-section-8 { background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); border-color: #9e9e9e; }
                .ptw-section-8 h3 { color: #424242; border-color: #9e9e9e; }
                .ptw-section-8 h3 i { color: #616161; background: rgba(158, 158, 158, 0.1); }
                
                .ptw-section-9 { background: linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%); border-color: #03a9f4; }
                .ptw-section-9 h3 { color: #0277bd; border-color: #03a9f4; }
                .ptw-section-9 h3 i { color: #0288d1; background: rgba(3, 169, 244, 0.1); }
                
                .ptw-closure-approval-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .ptw-closure-approval-table thead th {
                    background: linear-gradient(135deg, #b3e5fc 0%, #81d4fa 100%);
                    color: #01579b;
                    font-weight: bold;
                    padding: 12px;
                    text-align: center;
                    border: 1px solid #0288d1;
                }
                .ptw-closure-approval-table tbody td {
                    padding: 12px;
                    text-align: right;
                    border: 1px solid #b0bec5;
                    background: white;
                }
                .ptw-closure-approval-table tbody tr:first-child td:first-child,
                .ptw-closure-approval-table tbody tr:last-child td:first-child {
                    font-weight: bold;
                    background: #f5f5f5;
                    color: #424242;
                }
                .ptw-closure-approval-table tbody td input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .ptw-paper-theme .ptw-form-section {
                    background: #000 !important;
                    border: 1px solid #4b5563 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    margin-bottom: 16px !important;
                    padding: 12px !important;
                }
                .ptw-paper-theme .ptw-form-section:hover {
                    box-shadow: none !important;
                    transform: none !important;
                }
                .ptw-paper-theme .ptw-form-section h3 {
                    margin: -12px -12px 12px !important;
                    padding: 10px 12px !important;
                    border: 1px solid #9ca3af !important;
                    background: #cbd5e1 !important;
                    color: #111827 !important;
                    justify-content: center !important;
                    font-size: 1rem !important;
                }
                .ptw-paper-theme .ptw-form-section h3 i {
                    background: transparent !important;
                    font-size: 0.95rem !important;
                    padding: 0 !important;
                }
                .ptw-paper-theme label {
                    color: #e5e7eb !important;
                }
                .ptw-paper-theme .form-input,
                .ptw-paper-theme textarea,
                .ptw-paper-theme select,
                .ptw-paper-theme input[type="text"],
                .ptw-paper-theme input[type="datetime-local"] {
                    background: #f9fafb !important;
                    color: #111827 !important;
                    border: 1px solid #9ca3af !important;
                }
                .ptw-paper-theme .data-table {
                    width: 100%;
                    border-collapse: collapse !important;
                    table-layout: fixed;
                    background: #000;
                    border: 1.2px solid #9ca3af;
                }
                .ptw-paper-theme .data-table th,
                .ptw-paper-theme .data-table td {
                    border: 1.2px solid #9ca3af !important;
                    min-height: 42px;
                    padding: 8px 10px !important;
                    vertical-align: middle;
                }
                .ptw-paper-theme .data-table thead th {
                    background: #cbd5e1 !important;
                    color: #111827 !important;
                    font-weight: 700;
                    font-size: 13px;
                    line-height: 1.35;
                }
                .ptw-paper-theme .data-table tbody td {
                    background: #000 !important;
                    color: #f3f4f6 !important;
                    font-size: 13px;
                    line-height: 1.35;
                }
                .ptw-paper-theme .grid,
                .ptw-paper-theme .space-y-6,
                .ptw-paper-theme .space-y-4 {
                    row-gap: 14px !important;
                }
                .ptw-paper-theme .card-body {
                    padding: 12px !important;
                }
                @media (max-width: 1024px) {
                    .ptw-paper-header {
                        grid-template-columns: 1fr;
                        text-align: center;
                        gap: 8px;
                    }
                    .ptw-paper-header-left,
                    .ptw-paper-header-right {
                        justify-content: center;
                        text-align: center;
                    }
                    .ptw-paper-theme .data-table th,
                    .ptw-paper-theme .data-table td {
                        min-height: 38px;
                        padding: 7px 8px !important;
                        font-size: 12px !important;
                    }
                }
                @media (max-width: 768px) {
                    .ptw-paper-theme .ptw-form-section {
                        margin-bottom: 12px !important;
                        padding: 10px !important;
                    }
                    .ptw-paper-theme .ptw-form-section h3 {
                        margin: -10px -10px 10px !important;
                        font-size: 0.92rem !important;
                        padding: 8px 10px !important;
                    }
                    .ptw-paper-theme .table-wrapper {
                        overflow-x: auto;
                    }
                    .ptw-paper-theme .data-table {
                        min-width: 760px;
                    }
                }
                /* قفل بصري مطابق للنموذج المرجعي: إزالة أي زخارف أو تدرجات متبقية */
                .ptw-paper-theme * {
                    border-radius: 0 !important;
                    box-shadow: none !important;
                }
                .ptw-paper-theme .card-header {
                    background: #000 !important;
                    border: 1px solid #9ca3af !important;
                    margin-bottom: 12px !important;
                }
                .ptw-paper-theme .card-title,
                .ptw-paper-theme .text-gray-700,
                .ptw-paper-theme .text-gray-800,
                .ptw-paper-theme .text-gray-600,
                .ptw-paper-theme .text-gray-500,
                .ptw-paper-theme .font-medium,
                .ptw-paper-theme .font-semibold {
                    color: #e5e7eb !important;
                }
                .ptw-paper-theme .bg-red-50,
                .ptw-paper-theme .bg-blue-50,
                .ptw-paper-theme .bg-yellow-50,
                .ptw-paper-theme .bg-green-50,
                .ptw-paper-theme .bg-gray-50,
                .ptw-paper-theme .bg-white,
                .ptw-paper-theme .from-blue-100,
                .ptw-paper-theme .to-purple-100,
                .ptw-paper-theme .from-blue-50,
                .ptw-paper-theme .to-white {
                    background: #000 !important;
                }
                .ptw-paper-theme .border,
                .ptw-paper-theme [class*="border-"] {
                    border-color: #9ca3af !important;
                }
                .ptw-paper-theme .ptw-permit-disclaimer {
                    margin: 0 0 10px 0 !important;
                }
                .ptw-paper-theme #ptw-disclaimer-font-decrease,
                .ptw-paper-theme #ptw-disclaimer-font-reset,
                .ptw-paper-theme #ptw-disclaimer-font-increase,
                .ptw-paper-theme #ptw-disclaimer-font-size-display {
                    display: none !important;
                }
                .ptw-paper-theme #ptw-permit-disclaimer-text {
                    background: #000 !important;
                    color: #f3f4f6 !important;
                    border: 1px solid #9ca3af !important;
                    min-height: 92px !important;
                    line-height: 1.8 !important;
                }
                .ptw-paper-theme .btn-secondary,
                .ptw-paper-theme .btn-primary {
                    border-radius: 0 !important;
                }
            </style>
            <div class="content-card bg-gray-50 border-none shadow-none ptw-paper-theme">
                ${this.renderPermitSystemHeader()}
                <div class="card-header bg-white shadow-sm rounded-xl border border-gray-100 mb-6 p-4 flex items-center justify-between ptw-form-header-centered" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white;">
                    <h2 class="card-title text-xl" style="color: white; font-weight: 700;">
                        <span class="w-10 h-10 inline-flex items-center justify-center rounded-full bg-white bg-opacity-20 ml-3 shadow-sm">
                             <i class="fas fa-${isEdit ? 'edit' : 'plus'}"></i>
                        </span>
                        ${isEdit ? 'تعديل تصريح عمل' : 'إصدار تصريح عمل جديد'}
                    </h2>
                    <div class="text-xs font-mono bg-white bg-opacity-20 px-3 py-1 rounded-full ptw-form-id-badge" style="color: white;">
                        ${ptwData?.id || 'مسودة جديدة'}
                    </div>
                </div>
                
                <div class="card-body p-0">
                    <form id="ptw-form" class="space-y-6">
                        
                        <!-- نص الإعلان/التنبيه -->
                        <div class="ptw-permit-disclaimer" style="margin: 0 24px 0 24px; padding: 0;">
                            <div class="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 border-r-4 border-l-4 border-b-0 border-t-0 border-blue-600 rounded-t-xl shadow-md transition-all duration-300 p-5 relative overflow-hidden" 
                                style="border-right-width: 4px; border-left-width: 4px; border-bottom-width: 0; border-top-width: 0; position: relative; margin-bottom: 0;">
                                <!-- خلفية زخرفية -->
                                <div class="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
                                
                                <!-- أزرار التحكم في حجم الخط -->
                                <div class="flex items-center justify-between mb-3 pb-2 border-b border-blue-300">
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-semibold text-blue-800">
                                            <i class="fas fa-text-height ml-1"></i>
                                            حجم الخط:
                                        </span>
                                        <span id="ptw-disclaimer-font-size-display" class="text-sm font-bold text-blue-700 bg-white px-2 py-1 rounded border border-blue-400 min-w-[40px] text-center shadow-sm">15</span>
                                        <span class="text-xs text-gray-600">px</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button type="button" id="ptw-disclaimer-font-decrease" 
                                            class="btn-icon btn-icon-secondary text-blue-700 hover:bg-blue-200 border border-blue-400 rounded-lg p-2 transition-all duration-200 hover:scale-110 shadow-sm" 
                                            title="تصغير الخط">
                                            <i class="fas fa-minus"></i>
                                        </button>
                                        <button type="button" id="ptw-disclaimer-font-reset" 
                                            class="btn-icon btn-icon-secondary text-blue-700 hover:bg-blue-200 border border-blue-400 rounded-lg p-2 transition-all duration-200 hover:scale-110 shadow-sm" 
                                            title="إعادة تعيين">
                                            <i class="fas fa-redo"></i>
                                        </button>
                                        <button type="button" id="ptw-disclaimer-font-increase" 
                                            class="btn-icon btn-icon-secondary text-blue-700 hover:bg-blue-200 border border-blue-400 rounded-lg p-2 transition-all duration-200 hover:scale-110 shadow-sm" 
                                            title="تكبير الخط">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- حقل النص -->
                                <textarea id="ptw-permit-disclaimer-text" 
                                    class="w-full text-center text-gray-900 font-medium leading-relaxed resize-y min-h-[100px] border-2 border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 p-4 bg-gradient-to-br from-white to-blue-50 shadow-inner transition-all duration-200" 
                                    style="font-size: 15px; line-height: 2.2; color: #1e3a5f; text-align: center; font-weight: 500; letter-spacing: 0.3px;"
                                    placeholder="أدخل نص الإعلان هنا...">${escapeHTML(ptwData?.permitDisclaimer || 'تم إصدار هذا التصريح فقط للعمل الذي تم وصفه أدناه\nولا يجوز بأي حال من الأحوال استخدامه لأي عمل آخر لم يتم وصفه\nوعليه فإنه يجب الالتزام بمدة صلاحية التصريح للعمل المذكور أدناه وفى الموقع المصرح للعمل فيه فقط.')}</textarea>
                            </div>
                        </div>
                        
                        <!-- القسم الأول: البيانات الأساسية -->
                        <div class="ptw-form-section ptw-section-1" style="margin-top: 0; border-top-left-radius: 0; border-top-right-radius: 0;">
                             <h3>
                                <i class="fas fa-info-circle"></i>
                                <span>القسم الأول : بيانات التصريح الأساسية</span>
                             </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الموقع / القسم <span class="text-red-500">*</span></label>
                                    <select id="ptw-location" name="location" required class="form-input transition-all focus:ring-2 focus:ring-blue-200">
                                        <option value="">اختر الموقع / القسم</option>
                                        ${this.getSiteOptions().map(site => `
                                            <option value="${Utils.escapeHTML(site.id)}" ${ptwData && (ptwData.locationId === site.id || ptwData.locationId === String(site.id) || ptwData.siteId === site.id || ptwData.siteId === String(site.id) || (ptwData.location === site.id && !ptwData.locationId && !ptwData.siteId)) ? 'selected' : ''}>
                                                ${Utils.escapeHTML(site.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div id="ptw-sublocation-wrapper" style="display: ${ptwData?.locationId || ptwData?.siteId || ptwData?.location ? 'block' : 'none'};">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">المكان الفرعي</label>
                                    <select id="ptw-sublocation" name="sublocation" class="form-input transition-all focus:ring-2 focus:ring-blue-200">
                                        <option value="">اختر المكان الفرعي</option>
                                        ${this.getPlaceOptions(ptwData?.locationId || ptwData?.siteId || ptwData?.location || '').map(place => `
                                            <option value="${Utils.escapeHTML(place.id)}" ${ptwData && (ptwData.sublocationId === place.id || ptwData.sublocationId === String(place.id) || (ptwData.sublocation === place.id && !ptwData.sublocationId) || ptwData.sublocationName === place.name) ? 'selected' : ''}>
                                                ${Utils.escapeHTML(place.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تاريخ البدء <span class="text-red-500">*</span></label>
                                    <input type="datetime-local" id="ptw-startDate" name="startDate" required class="form-input transition-all focus:ring-2 focus:ring-blue-200"
                                        value="${ptwData?.startDate ? Utils.toDateTimeLocalString(ptwData.startDate) : ''}">
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تاريخ الانتهاء <span class="text-red-500">*</span></label>
                                    <input type="datetime-local" id="ptw-endDate" name="endDate" required class="form-input transition-all focus:ring-2 focus:ring-blue-200"
                                        value="${ptwData?.endDate ? Utils.toDateTimeLocalString(ptwData.endDate) : ''}">
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الجهة المصرح لها بالعمل</label>
                                    ${hasApprovedEntities ? `
                                        <div class="relative">
                                            <select id="ptw-authorizedParty-select" class="form-input transition-all focus:ring-2 focus:ring-blue-200">
                                                <option value="">اختر الجهة المعتمدة</option>
                                                ${approvedEntities.map(entity => `
                                                    <option value="${Utils.escapeHTML(entity.name || '')}" ${authorizedPartyValue === entity.name ? 'selected' : ''}>
                                                        ${Utils.escapeHTML(entity.name || '')}
                                                    </option>
                                                `).join('')}
                                                <option value="__custom__">إدخال يدوي</option>
                                            </select>
                                            <input type="text" id="ptw-authorizedParty" class="form-input transition-all focus:ring-2 focus:ring-blue-200 mt-2 hidden"
                                                value="${escapeHTML(authorizedPartyValue)}" placeholder="الجهة المصرح لها بالعمل">
                                        </div>
                                    ` : `
                                        <input type="text" id="ptw-authorizedParty" class="form-input transition-all focus:ring-2 focus:ring-blue-200"
                                            value="${escapeHTML(authorizedPartyValue)}" placeholder="الجهة المصرح لها بالعمل">
                                    `}
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الجهة الطالبة للتصريح</label>
                                    ${hasDepartmentsForm ? `
                                        <div class="relative">
                                            <select id="ptw-requestingParty-select" class="form-input transition-all focus:ring-2 focus:ring-blue-200">
                                                <option value="">اختر الإدارة</option>
                                                ${departmentOptionsForm.map(dept => `<option value="${escapeHTML(dept)}" ${requestingPartyValueForm === dept ? 'selected' : ''}>${escapeHTML(dept)}</option>`).join('')}
                                                <option value="__custom__">إدخال يدوي</option>
                                            </select>
                                            <input type="text" id="ptw-requestingParty" class="form-input transition-all focus:ring-2 focus:ring-blue-200 mt-2 hidden"
                                                value="${escapeHTML(requestingPartyValueForm)}" placeholder="الجهة الطالبة للتصريح">
                                        </div>
                                    ` : `
                                        <input type="text" id="ptw-requestingParty" class="form-input transition-all focus:ring-2 focus:ring-blue-200"
                                            value="${escapeHTML(requestingPartyValueForm)}" placeholder="الجهة الطالبة للتصريح">
                                    `}
                                </div>
                                <div class="md:col-span-3">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">المعدة / الماكينة / العملية</label>
                                    <textarea id="ptw-equipment" class="form-input transition-all focus:ring-2 focus:ring-blue-200" rows="2" placeholder="أدخل تفاصيل المعدات أو العملية المستخدمة">${escapeHTML(ptwData?.equipment)}</textarea>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الأدوات أو العدد (بعد فحصها وقبولها)</label>
                                    <textarea id="ptw-tools" class="form-input transition-all focus:ring-2 focus:ring-blue-200" rows="2" placeholder="أدخل قائمة الأدوات أو العدد">${escapeHTML(ptwData?.tools || ptwData?.toolsList)}</textarea>
                                </div>
                                <div class="md:col-span-3">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">وصف العمل <span class="text-red-500">*</span></label>
                                    <textarea id="ptw-workDescription" name="workDescription" required class="form-input transition-all focus:ring-2 focus:ring-blue-200" rows="4"
                                            placeholder="وصف تفصيلي للعمل">${escapeHTML(ptwData?.workDescription)}</textarea>
                                </div>
                            </div>
                        </div>

                         <!-- القسم الثاني: القائمين بالعمل -->
                        <div class="ptw-form-section ptw-section-2">
                            <h3>
                                <i class="fas fa-users"></i>
                                <span>القسم الثاني : أسماء القائمين بالعمل</span>
                            </h3>
                            <p class="text-sm text-gray-600 mb-4 bg-white p-2 rounded border border-gray-100 inline-block">
                                <i class="fas fa-info-circle text-teal-500 ml-1"></i>
                                أدخل أسماء فريق العمل المسؤول عن تنفيذ النشاط
                            </p>
                            <div id="team-members-list" class="space-y-3">
                                ${teamMembersListHTML}
                            </div>
                            <button type="button" id="add-team-member-btn" class="btn-secondary mt-4 hover:bg-teal-50 text-teal-700 border-teal-200">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة فرد جديد
                            </button>
                        </div>

                        <!-- القسم الثالث: طبيعة الأعمال -->
                        <div class="ptw-form-section ptw-section-3">
                            <h3>
                                <i class="fas fa-clipboard-check"></i>
                                <span>القسم الثالث : تحديد نوع / طبيعة الأعمال</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="bg-red-50 p-4 rounded-lg border border-red-100">
                                    <h4 class="font-bold text-red-800 mb-3 border-b border-red-200 pb-2">أعمال ساخنة</h4>
                                    <div class="space-y-2">
                                        ${renderChecklistOptions(hotOptions, hotWorkDetails, 'ptw-hot', hotWorkOther)}
                                    </div>
                                </div>
                                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h4 class="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">أماكن مغلقة</h4>
                                    <div class="space-y-2">
                                        ${renderChecklistOptions(confinedOptions, confinedSpaceDetails, 'ptw-confined', confinedSpaceOther)}
                                    </div>
                                </div>
                                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 class="font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2">عمل على ارتفاع</h4>
                                    <div class="space-y-2">
                                        ${renderChecklistOptions(heightOptions, heightWorkDetails, 'ptw-height', heightWorkOther)}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 bg-gray-50 p-4 rounded-lg">
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تفاصيل أعمال الكهرباء</label>
                                    <input type="text" id="ptw-electrical-work-type" class="form-input" value="${escapeHTML(ptwData?.electricalWorkType)}" placeholder="اذكر تفاصيل أعمال الكهرباء">
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تفاصيل الأعمال على البارد</label>
                                    <input type="text" id="ptw-cold-work-type" class="form-input" value="${escapeHTML(ptwData?.coldWorkType)}" placeholder="اذكر تفاصيل الأعمال على البارد">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-bold text-gray-700 mb-2">تفاصيل أعمال أخرى</label>
                                    <input type="text" id="ptw-other-work-type" class="form-input" value="${escapeHTML(ptwData?.otherWorkType)}" placeholder="اذكر تفاصيل أعمال أخرى (إن وجدت)">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                <div class="md:col-span-4 font-bold text-yellow-800 mb-2 flex items-center">
                                    <i class="fas fa-digging ml-2"></i>
                                    بيانات الحفر (إن وجد)
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">الطول (م)</label>
                                    <input type="text" id="ptw-excavation-length" class="form-input" value="${escapeHTML(ptwData?.excavationLength)}" placeholder="—">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">العرض (م)</label>
                                    <input type="text" id="ptw-excavation-width" class="form-input" value="${escapeHTML(ptwData?.excavationWidth)}" placeholder="—">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">العمق (م)</label>
                                    <input type="text" id="ptw-excavation-depth" class="form-input" value="${escapeHTML(ptwData?.excavationDepth)}" placeholder="—">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">نوع التربة</label>
                                    <input type="text" id="ptw-excavation-soil" class="form-input" value="${escapeHTML(ptwData?.soilType)}" placeholder="مثال: رملية">
                                </div>
                            </div>
                        </div>

                         <!-- القسم الرابع: المتطلبات -->
                        <div class="ptw-form-section ptw-section-4">
                            <h3>
                                <i class="fas fa-tasks"></i>
                                <span>القسم الرابع : المتطلبات والمرفقات</span>
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <label class="ptw-check-card flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all">
                                    <input type="checkbox" id="ptw-preStartChecklist" class="form-checkbox h-5 w-5 text-purple-600 rounded ml-3" ${ptwData?.preStartChecklist ? 'checked' : ''}>
                                    <span class="font-medium">قائمة التحقق بقرار بدء العمل</span>
                                </label>
                                <label class="ptw-check-card flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all">
                                    <input type="checkbox" id="ptw-lotoApplied" class="form-checkbox h-5 w-5 text-purple-600 rounded ml-3" ${ptwData?.lotoApplied ? 'checked' : ''}>
                                    <span class="font-medium">تطبيق نظام العزل LOTO</span>
                                </label>
                                <label class="ptw-check-card flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all">
                                    <input type="checkbox" id="ptw-governmentPermits" class="form-checkbox h-5 w-5 text-purple-600 rounded ml-3" ${ptwData?.governmentPermits ? 'checked' : ''}>
                                    <span class="font-medium">تصاريح جهات حكومية</span>
                                </label>
                                <label class="ptw-check-card flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all">
                                    <input type="checkbox" id="ptw-riskAssessmentAttached" class="form-checkbox h-5 w-5 text-purple-600 rounded ml-3" ${ptwData?.riskAssessmentAttached ? 'checked' : ''}>
                                    <span class="font-medium">تحليل المخاطر ووسائل التحكم</span>
                                </label>
                                <label class="ptw-check-card flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all">
                                    <input type="checkbox" id="ptw-gasTesting" class="form-checkbox h-5 w-5 text-purple-600 rounded ml-3" ${ptwData?.gasTesting ? 'checked' : ''}>
                                    <span class="font-medium">قياس الغازات</span>
                                </label>
                                <label class="ptw-check-card flex items-center p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-all">
                                    <input type="checkbox" id="ptw-mocRequest" class="form-checkbox h-5 w-5 text-purple-600 rounded ml-3" ${ptwData?.mocRequest ? 'checked' : ''}>
                                    <span class="font-medium">طلب تغيير فني (MOC)</span>
                                </label>
                            </div>
                        </div>

                        <!-- القسم الخامس: مهمات الوقاية -->
                        <div class="ptw-form-section ptw-section-5">
                            <h3>
                                <i class="fas fa-hard-hat"></i>
                                <span>القسم الخامس : تحديد مهمات الوقاية</span>
                            </h3>
                            <div id="ptw-ppe-matrix" class="bg-gray-50 rounded-lg p-2">
                                ${typeof PPEMatrix !== 'undefined' ? PPEMatrix.generate('ptw-ppe-matrix') : '<div class="text-center p-4 text-gray-500">مصفوفة المهمات غير محملة</div>'}
                            </div>
                            ${ptwData?.requiredPPE && ptwData.requiredPPE.length > 0 ? `
                                <script>
                                    setTimeout(() => {
                                        if (typeof PPEMatrix !== 'undefined') {
                                            PPEMatrix.setSelected(${JSON.stringify(ptwData.requiredPPE)});
                                        }
                                    }, 100);
                                </script>
                            ` : ''}
                        </div>

                        <!-- القسم السادس: تقييم المخاطر -->
                        <div class="ptw-form-section ptw-section-6">
                            <h3>
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>القسم السادس : مصفوفة تقييم المخاطر</span>
                            </h3>
                            <div id="ptw-risk-matrix" class="bg-white rounded-lg p-2">
                                ${typeof RiskMatrix !== 'undefined' ? RiskMatrix.generate('ptw-risk-matrix', {
            selectedLikelihood: ptwData?.riskAssessment?.likelihood ? parseInt(ptwData.riskAssessment.likelihood) : null,
            selectedConsequence: ptwData?.riskAssessment?.consequence ? parseInt(ptwData.riskAssessment.consequence) : null,
            interactive: true
        }) : `
                                    <div class="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                        <i class="fas fa-exclamation-triangle text-4xl text-gray-400 mb-3"></i>
                                        <p class="text-gray-600 font-semibold mb-2">مصفوفة تقييم المخاطر غير متاحة حالياً</p>
                                        <p class="text-sm text-gray-500">يرجى التأكد من تحميل مكون RiskMatrix</p>
                                    </div>
                                `}
                            </div>
                            ${ptwData?.riskAssessment && (ptwData.riskAssessment.likelihood || ptwData.riskAssessment.consequence) ? `
                                <script>
                                    (function() {
                                        const likelihood = ${ptwData.riskAssessment.likelihood ? parseInt(ptwData.riskAssessment.likelihood) : 'null'};
                                        const consequence = ${ptwData.riskAssessment.consequence ? parseInt(ptwData.riskAssessment.consequence) : 'null'};
                                        setTimeout(() => {
                                            if (typeof RiskMatrix !== 'undefined') {
                                                const matrixContainer = document.getElementById('ptw-risk-matrix');
                                                if (matrixContainer) {
                                                    const cells = matrixContainer.querySelectorAll('.risk-matrix-cell');
                                                    cells.forEach(cell => {
                                                        const cellLikelihood = cell.getAttribute('data-likelihood') || cell.getAttribute('data-probability');
                                                        const cellConsequence = cell.getAttribute('data-consequence') || cell.getAttribute('data-severity');
                                                        if (cellLikelihood && cellConsequence && 
                                                            likelihood !== null && consequence !== null &&
                                                            parseInt(cellLikelihood) === parseInt(likelihood) && 
                                                            parseInt(cellConsequence) === parseInt(consequence)) {
                                                            cell.classList.add('selected');
                                                            cell.setAttribute('data-selected', 'true');
                                                        }
                                                    });
                                                }
                                            }
                                        }, 300);
                                    })();
                                </script>
                            ` : ''}
                            <div class="mt-4 bg-red-50 p-4 rounded-lg border border-red-100">
                                <label class="block text-sm font-bold text-gray-700 mb-2">ملاحظات تقييم المخاطر</label>
                                <textarea id="ptw-risk-notes" class="form-input bg-white" rows="3"
                                    placeholder="ملاحظات إضافية حول المخاطر المحتملة">${escapeHTML(ptwData?.riskNotes)}</textarea>
                                
                                <!-- حقول مخفية لحفظ قيم المصفوفة -->
                                <input type="hidden" id="ptw-risk-likelihood" value="${ptwData?.riskAssessment?.likelihood || ''}">
                                <input type="hidden" id="ptw-risk-consequence" value="${ptwData?.riskAssessment?.consequence || ''}">
                            </div>
                        </div>

                        <!-- القسم السابع: الاعتمادات -->
                        <div class="ptw-form-section ptw-section-7">
                            <h3>
                                <i class="fas fa-signature"></i>
                                <span>${isManual ? 'القسم السابع : اعتمادات التصريح اليدوي' : 'القسم السابع : دائرة الاعتمادات'}</span>
                            </h3>
                            ${isManual ? `
                                <!-- التصريح اليدوي: عرض اعتمادات يدوية للقراءة فقط -->
                                <div class="bg-blue-50 text-blue-700 px-4 py-2 rounded mb-4 inline-flex items-center">
                                    <i class="fas fa-info-circle ml-2"></i>
                                    تصريح يدوي - تم تسجيل الاعتمادات يدوياً عند الإنشاء
                                </div>
                                ${(() => {
                                    const manualApprovals = ptwData?.manualApprovals || [];
                                    if (manualApprovals.length === 0) {
                                        return '<p class="text-gray-500">لا توجد اعتمادات مسجلة</p>';
                                    }
                                    return `
                                        <div class="table-wrapper" style="overflow-x: auto;">
                                            <table class="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>الدور</th>
                                                        <th>الاسم</th>
                                                        <th>التوقيع</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${manualApprovals.map(a => `
                                                        <tr>
                                                            <td>${Utils.escapeHTML(a.role || '')}</td>
                                                            <td>${Utils.escapeHTML(a.name || '-')}</td>
                                                            <td>${Utils.escapeHTML(a.signature || '-')}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `;
                                })()}
                            ` : `
                                <input type="hidden" id="approval-circuit-owner-id" value="${this.formCircuitOwnerId || ''}">
                                ${circuitName ? `<div class="bg-blue-50 text-blue-700 px-4 py-2 rounded mb-4 inline-flex items-center"><i class="fas fa-route ml-2"></i>مسار الاعتماد الحالي: <strong>${Utils.escapeHTML(circuitName)}</strong></div>` : ''}

                                <div id="approval-matrix" class="space-y-4 bg-white rounded-lg border border-gray-100 p-2">
                                    ${this.renderApprovalMatrix(approvals, isEdit)}
                                </div>
                                ${isEdit ? '<button type="button" id="add-approval-btn" class="btn-secondary mt-4"><i class="fas fa-plus ml-2"></i>إضافة موافقة يدوية</button>' : ''}
                            `}
                        </div>

                        <!-- القسم الثامن: الإغلاق -->
                        <div class="ptw-form-section ptw-section-8">
                            <h3>
                                <i class="fas fa-lock"></i>
                                <span>القسم الثامن : إغلاق التصريح</span>
                            </h3>
                            
                            <!-- النص الوصفي -->
                            <div class="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-6 shadow-md hover:shadow-lg transition-all duration-300" style="display: flex; align-items: center; justify-content: center; min-height: 100px;">
                                <p class="text-gray-800 text-base leading-relaxed mb-0 font-medium" style="text-align: center; line-height: 2.2; max-width: 90%; color: #1e40af; font-size: 16px; letter-spacing: 0.3px;">
                                    <i class="fas fa-check-circle text-green-600 ml-2" style="font-size: 18px;"></i>
                                    تم متابعة العمل حتى النهاية وتم فحص موقع العمل والمواقع المجاورة له والتأكد من خلوها من الأخطار المحتمل حدوثها وذلك بعد عملية الانتهاء من العمل
                                    <i class="fas fa-check-circle text-green-600 mr-2" style="font-size: 18px;"></i>
                                </p>
                            </div>
                            
                            <!-- خيارات الإغلاق -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <label class="flex items-center space-x-2 space-x-reverse cursor-pointer bg-white bg-opacity-60 p-3 rounded-lg border border-gray-200 hover:bg-opacity-80 transition-all">
                                    <input type="radio" name="ptw-closure-status" value="completed" class="form-radio text-green-600 h-5 w-5" ${closureStatus === 'completed' ? 'checked' : ''}>
                                    <span class="font-medium text-gray-700">اكتمل العمل بشكل آمن</span>
                                </label>
                                <label class="flex items-center space-x-2 space-x-reverse cursor-pointer bg-white bg-opacity-60 p-3 rounded-lg border border-gray-200 hover:bg-opacity-80 transition-all">
                                    <input type="radio" name="ptw-closure-status" value="notCompleted" class="form-radio text-yellow-600 h-5 w-5" ${closureStatus === 'notCompleted' ? 'checked' : ''}>
                                    <span class="font-medium text-gray-700">لم يكتمل العمل</span>
                                </label>
                                <label class="flex items-center space-x-2 space-x-reverse cursor-pointer bg-white bg-opacity-60 p-3 rounded-lg border border-gray-200 hover:bg-opacity-80 transition-all">
                                    <input type="radio" name="ptw-closure-status" value="forced" class="form-radio text-red-600 h-5 w-5" ${closureStatus === 'forced' ? 'checked' : ''}>
                                    <span class="font-medium text-gray-700">إغلاق جبري</span>
                                </label>
                            </div>
                            
                            <!-- حقول الإدخال -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">الساعة:</label>
                                    <input type="datetime-local" id="ptw-closure-time" class="form-input" value="${closureTimeValue}">
                                </div>
                                <div>
                                    <label class="block text-sm font-bold text-gray-700 mb-2">السبب:</label>
                                    <input type="text" id="ptw-closure-reason" class="form-input" value="${escapeHTML(closureReason)}" placeholder="اذكر سبب الإغلاق">
                                </div>
                            </div>
                        </div>

                        <!-- القسم التاسع: اعتماد إغلاق التصريح -->
                        <div class="ptw-form-section ptw-section-9">
                            <h3>
                                <i class="fas fa-check-circle"></i>
                                <span>${isManual ? 'القسم التاسع : اعتماد إغلاق التصريح اليدوي' : 'القسم التاسع : اعتماد إغلاق التصريح'}</span>
                            </h3>
                            ${isManual ? `
                                <!-- التصريح اليدوي: عرض اعتمادات الإغلاق يدوية للقراءة فقط -->
                                <div class="bg-green-50 text-green-700 px-4 py-2 rounded mb-4 inline-flex items-center">
                                    <i class="fas fa-info-circle ml-2"></i>
                                    تصريح يدوي - تم تسجيل اعتمادات الإغلاق يدوياً عند الإنشاء
                                </div>
                                ${(() => {
                                    const manualClosureApprovals = ptwData?.manualClosureApprovals || [];
                                    if (manualClosureApprovals.length === 0) {
                                        return '<p class="text-gray-500">لا توجد اعتمادات إغلاق مسجلة</p>';
                                    }
                                    return `
                                        <div class="table-wrapper" style="overflow-x: auto;">
                                            <table class="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>الدور</th>
                                                        <th>الاسم</th>
                                                        <th>التوقيع</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${manualClosureApprovals.map(a => `
                                                        <tr>
                                                            <td>${Utils.escapeHTML(a.role || '')}</td>
                                                            <td>${Utils.escapeHTML(a.name || '-')}</td>
                                                            <td>${Utils.escapeHTML(a.signature || '-')}</td>
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `;
                                })()}
                            ` : `
                                ${(() => {
                                    // إعداد موافقات إغلاق التصريح بنفس طريقة القسم السابع
                                    const closureApprovalPackage = this.prepareClosureApprovalsForForm(ptwData);
                                    const closureApprovals = closureApprovalPackage.approvals || [];
                                    this.formClosureApprovals = closureApprovals.map(approval => Object.assign({}, approval));
                                    this.formClosureCircuitOwnerId = closureApprovalPackage.circuitOwnerId || '__default__';
                                    const closureCircuitName = closureApprovalPackage.circuitName || '';
                                    this.formClosureCircuitName = closureCircuitName;

                                    return `
                                        <input type="hidden" id="closure-approval-circuit-owner-id" value="${this.formClosureCircuitOwnerId || ''}">
                                        ${closureCircuitName ? `<div class="bg-blue-50 text-blue-700 px-4 py-2 rounded mb-4 inline-flex items-center"><i class="fas fa-route ml-2"></i>مسار الاعتماد الحالي: <strong>${Utils.escapeHTML(closureCircuitName)}</strong></div>` : ''}

                                        <div id="closure-approval-matrix" class="space-y-4 bg-white rounded-lg border border-gray-100 p-2">
                                            ${this.renderClosureApprovalMatrix(closureApprovals, isEdit)}
                                        </div>
                                        ${isEdit ? '<button type="button" id="add-closure-approval-btn" class="btn-secondary mt-4"><i class="fas fa-plus ml-2"></i>إضافة موافقة يدوية</button>' : ''}
                                    `;
                                })()}
                            `}
                        </div>

                        <!-- أزرار الإجراءات -->
                        <div class="pt-8 mt-8 border-t-2 border-gray-300 bg-gradient-to-b from-gray-50 to-white rounded-lg p-6 shadow-md" style="position: relative; z-index: 10; margin-top: 2rem !important; padding-top: 2rem !important; display: block !important; visibility: visible !important;">
                            <div class="flex items-center justify-center gap-4 flex-wrap" style="display: flex !important; visibility: visible !important; justify-content: center !important;">
                                <button type="button" id="cancel-ptw-btn" class="btn-secondary px-6 py-3 min-w-[120px]" style="display: inline-flex !important; visibility: visible !important; opacity: 1 !important;">
                                    <i class="fas fa-times ml-2"></i>
                                    إلغاء
                                </button>
                                <button type="button" id="print-ptw-btn" class="btn-secondary px-6 py-3 min-w-[120px]" style="display: inline-flex !important; visibility: visible !important; opacity: 1 !important;">
                                    <i class="fas fa-print ml-2"></i>
                                    طباعة
                                </button>
                                <button type="submit" class="btn-primary px-8 py-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all min-w-[160px]" style="display: inline-flex !important; visibility: visible !important; opacity: 1 !important;">
                                    <i class="fas fa-save ml-2"></i>
                                    ${isEdit ? 'حفظ التعديلات' : 'إصدار التصريح'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            `;

    },

    renderApprovalMatrix(approvals = [], isEdit = false) {
        approvals = this.normalizeApprovals(approvals);
        this.formApprovals = approvals.map((approval, index) => Object.assign({}, approval, { order: index }));

        return `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموافقات</th>
                            <th>الاسم</th>
                            <th>الحالة</th>
                            <th>التاريخ</th>
                            <th>ملاحظات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="approvals-tbody">
                        ${approvals.map((approval, index) => `
                            <tr data-approval-index="${index}" data-required="${approval.required !== false}">
                                <td>
                                    <input type="text" class="form-input" style="min-width: 180px;"
                                        value="${Utils.escapeHTML(approval.role || '')}" placeholder="دور الموافق"
                                        id="approval-role-${index}" readonly>
                                </td>
                                <td>
                                    ${approval.candidates && approval.candidates.length > 0 ? `
                                        <select class="form-input approval-approver-select" id="approval-approver-select-${index}">
                                            <option value="">اختر المعتمد</option>
                                            ${approval.candidates.map(candidate => `
                                                <option value="${Utils.escapeHTML(candidate.id || '')}" ${candidate.id === approval.approverId ? 'selected' : ''}>
                                                    ${Utils.escapeHTML(candidate.name || candidate.email || '')}
                                                    ${candidate.email ? ` - ${Utils.escapeHTML(candidate.email)}` : ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    ` : `
                                        <input type="text" class="form-input" style="min-width: 180px;"
                                            value="${Utils.escapeHTML(approval.approver || '')}" placeholder="اسم المعتمد"
                                            id="approval-approver-${index}" ${isEdit ? '' : 'readonly'}>
                                        <p class="text-xs text-gray-500 mt-1">لم يتم تحديد مستخدمين لهذا المستوى.</p>
                                    `}
                                </td>
                                <td>
                                    ${(() => {
                const statusClass = approval.status === 'approved'
                    ? 'badge-success'
                    : approval.status === 'rejected'
                        ? 'badge-danger'
                        : 'badge-warning';
                const statusLabel = approval.status === 'approved'
                    ? 'معتمد'
                    : approval.status === 'rejected'
                        ? 'مرفوض'
                        : 'بانتظار الاعتماد';
                return `<span class="badge ${statusClass}">${statusLabel}</span>`;
            })()}
                                    <input type="hidden" id="approval-status-${index}" value="${approval.status}">
                                </td>
                                <td>
                                    <input type="datetime-local" class="form-input" style="min-width: 180px;"
                                        value="${approval.date ? Utils.toDateTimeLocalString(approval.date) : ''}"
                                        id="approval-date-${index}" ${isEdit ? '' : 'readonly'}>
                                </td>
                                <td>
                                    <input type="text" class="form-input" style="min-width: 200px;"
                                        value="${Utils.escapeHTML(approval.comments || '')}" placeholder="ملاحظات"
                                        id="approval-comments-${index}" ${isEdit ? '' : ''}>
                                </td>
                                <td>
                                    ${approval.candidates && approval.candidates.length > 0
                ? `<p class="text-xs text-gray-500">اختر المسؤول عن الاعتماد.</p>`
                : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * عرض مصفوفة موافقات إغلاق التصريح (بنفس طريقة القسم السابع)
     */
    renderClosureApprovalMatrix(approvals = [], isEdit = false) {
        approvals = this.normalizeApprovals(approvals);
        if (!this.formClosureApprovals) {
            this.formClosureApprovals = [];
        }
        this.formClosureApprovals = approvals.map((approval, index) => Object.assign({}, approval, { order: index }));

        return `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموافقات</th>
                            <th>الاسم</th>
                            <th>الحالة</th>
                            <th>التاريخ</th>
                            <th>ملاحظات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="closure-approvals-tbody">
                        ${approvals.map((approval, index) => `
                            <tr data-closure-approval-index="${index}" data-required="${approval.required !== false}">
                                <td>
                                    <input type="text" class="form-input" style="min-width: 180px;"
                                        value="${Utils.escapeHTML(approval.role || '')}" placeholder="دور الموافق"
                                        id="closure-approval-role-${index}" readonly>
                                </td>
                                <td>
                                    ${approval.candidates && approval.candidates.length > 0 ? `
                                        <select class="form-input closure-approval-approver-select" id="closure-approval-approver-select-${index}">
                                            <option value="">اختر المعتمد</option>
                                            ${approval.candidates.map(candidate => `
                                                <option value="${Utils.escapeHTML(candidate.id || '')}" ${candidate.id === approval.approverId ? 'selected' : ''}>
                                                    ${Utils.escapeHTML(candidate.name || candidate.email || '')}
                                                    ${candidate.email ? ` - ${Utils.escapeHTML(candidate.email)}` : ''}
                                                </option>
                                            `).join('')}
                                        </select>
                                    ` : `
                                        <input type="text" class="form-input" style="min-width: 180px;"
                                            value="${Utils.escapeHTML(approval.approver || '')}" placeholder="اسم المعتمد"
                                            id="closure-approval-approver-${index}" ${isEdit ? '' : 'readonly'}>
                                        <p class="text-xs text-gray-500 mt-1">لم يتم تحديد مستخدمين لهذا المستوى.</p>
                                    `}
                                </td>
                                <td>
                                    ${(() => {
                const statusClass = approval.status === 'approved'
                    ? 'badge-success'
                    : approval.status === 'rejected'
                        ? 'badge-danger'
                        : 'badge-warning';
                const statusLabel = approval.status === 'approved'
                    ? 'معتمد'
                    : approval.status === 'rejected'
                        ? 'مرفوض'
                        : 'بانتظار الاعتماد';
                return `<span class="badge ${statusClass}">${statusLabel}</span>`;
            })()}
                                    <input type="hidden" id="closure-approval-status-${index}" value="${approval.status}">
                                </td>
                                <td>
                                    <input type="datetime-local" class="form-input" style="min-width: 180px;"
                                        value="${approval.date ? Utils.toDateTimeLocalString(approval.date) : ''}"
                                        id="closure-approval-date-${index}" ${isEdit ? '' : 'readonly'}>
                                </td>
                                <td>
                                    <input type="text" class="form-input" style="min-width: 200px;"
                                        value="${Utils.escapeHTML(approval.comments || '')}" placeholder="ملاحظات"
                                        id="closure-approval-comments-${index}" ${isEdit ? '' : ''}>
                                </td>
                                <td>
                                    ${approval.candidates && approval.candidates.length > 0
                ? `<p class="text-xs text-gray-500">اختر المسؤول عن الاعتماد.</p>`
                : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },


    getStatusBadgeClass(status) {
        const classes = {
            'مفتوح': 'warning',
            'قيد المراجعة': 'info',
            'موافق عليه': 'success',
            'مرفوض': 'danger',
            'مغلق': 'secondary'
        };
        return classes[status] || 'secondary';
    },

    setupEventListeners(ptwData = null) {
        setTimeout(() => {
            // زر التحديث (بجانب الموافقات)
            const refreshHeaderBtn = document.getElementById('ptw-refresh-header-btn');
            if (refreshHeaderBtn) {
                refreshHeaderBtn.replaceWith(refreshHeaderBtn.cloneNode(true));
                const newRefreshBtn = document.getElementById('ptw-refresh-header-btn');
                if (newRefreshBtn) {
                    newRefreshBtn.addEventListener('click', () => this.refreshCurrentTab());
                }
            }
            // زر إصدار تصريح جديد
            const addBtn = document.getElementById('add-ptw-btn');
            const addEmptyBtn = document.getElementById('add-ptw-empty-btn');
            if (addBtn) {
                // ✅ التحقق من أن العنصر موجود في DOM قبل replaceWith
                if (addBtn.parentNode && document.body.contains(addBtn)) {
                    try {
                        addBtn.replaceWith(addBtn.cloneNode(true));
                        const newAddBtn = document.getElementById('add-ptw-btn');
                        if (newAddBtn) {
                            newAddBtn.addEventListener('click', () => {
                                Utils.safeLog('🖱️ تم النقر على زر إصدار تصريح جديد');
                                this.showForm();
                            });
                        }
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في replaceWith للزر add-ptw-btn:', error);
                        // استخدام طريقة بديلة: إزالة المستمعين وإضافة مستمع جديد
                        addBtn.addEventListener('click', () => {
                            Utils.safeLog('🖱️ تم النقر على زر إصدار تصريح جديد');
                            this.showForm();
                        });
                    }
                } else {
                    // العنصر غير موجود في DOM - إضافة مستمع مباشرة
                    addBtn.addEventListener('click', () => {
                        Utils.safeLog('🖱️ تم النقر على زر إصدار تصريح جديد');
                        this.showForm();
                    });
                }
            }
            if (addEmptyBtn) {
                // ✅ التحقق من أن العنصر موجود في DOM قبل replaceWith
                if (addEmptyBtn.parentNode && document.body.contains(addEmptyBtn)) {
                    try {
                        addEmptyBtn.replaceWith(addEmptyBtn.cloneNode(true));
                        const newAddEmptyBtn = document.getElementById('add-ptw-empty-btn');
                        if (newAddEmptyBtn) {
                            newAddEmptyBtn.addEventListener('click', () => {
                                Utils.safeLog('🖱️ تم النقر على زر إصدار تصريح جديد (من القائمة الفارغة)');
                                this.showForm();
                            });
                        }
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في replaceWith للزر add-ptw-empty-btn:', error);
                        // استخدام طريقة بديلة: إضافة مستمع مباشرة
                        addEmptyBtn.addEventListener('click', () => {
                            Utils.safeLog('🖱️ تم النقر على زر إصدار تصريح جديد (من القائمة الفارغة)');
                            this.showForm();
                        });
                    }
                } else {
                    // العنصر غير موجود في DOM - إضافة مستمع مباشرة
                    addEmptyBtn.addEventListener('click', () => {
                        Utils.safeLog('🖱️ تم النقر على زر إصدار تصريح جديد (من القائمة الفارغة)');
                        this.showForm();
                    });
                }
            }

            const searchInput = document.getElementById('ptw-search');
            const filterStatus = document.getElementById('ptw-filter-status');
            const filterWorkType = document.getElementById('ptw-filter-work-type');
            const filterLocation = document.getElementById('ptw-filter-location');
            const filterSublocation = document.getElementById('ptw-filter-sublocation');
            const filterDateFrom = document.getElementById('ptw-filter-date-from');
            const filterDateTo = document.getElementById('ptw-filter-date-to');
            const applyFilters = () => this.filterItems();
            if (searchInput) searchInput.addEventListener('input', applyFilters);
            if (filterStatus) filterStatus.addEventListener('change', applyFilters);
            if (filterWorkType) filterWorkType.addEventListener('change', applyFilters);
            if (filterLocation) {
                filterLocation.addEventListener('change', () => {
                    this.updateSublocationFilterOptions();
                    applyFilters();
                });
            }
            if (filterSublocation) filterSublocation.addEventListener('change', applyFilters);
            if (filterDateFrom) filterDateFrom.addEventListener('change', applyFilters);
            if (filterDateTo) filterDateTo.addEventListener('change', applyFilters);
            const resetFiltersBtn = document.getElementById('ptw-reset-filters');
            if (resetFiltersBtn) {
                resetFiltersBtn.addEventListener('click', () => {
                    if (searchInput) searchInput.value = '';
                    if (filterStatus) filterStatus.value = '';
                    if (filterWorkType) filterWorkType.value = '';
                    if (filterLocation) filterLocation.value = '';
                    if (filterSublocation) filterSublocation.value = '';
                    if (filterDateFrom) filterDateFrom.value = '';
                    if (filterDateTo) filterDateTo.value = '';
                    this.updateSublocationFilterOptions();
                    this.filterItems();
                });
            }
            const refreshListBtn = document.getElementById('ptw-refresh-list');
            if (refreshListBtn) refreshListBtn.addEventListener('click', () => this.loadPTWList(true));

            const form = document.getElementById('ptw-form');
            if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));
            const cancelBtn = document.getElementById('cancel-ptw-btn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.showList());
            
            // زر الطباعة
            const printBtn = document.getElementById('print-ptw-btn');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    this.printPermitForm();
                });
            }

            const addApprovalBtn = document.getElementById('add-approval-btn');
            if (addApprovalBtn) {
                addApprovalBtn.addEventListener('click', () => this.addApproval());
            }

            const addClosureApprovalBtn = document.getElementById('add-closure-approval-btn');
            if (addClosureApprovalBtn) {
                addClosureApprovalBtn.addEventListener('click', () => this.addClosureApproval());
            }

            // التحكم في حجم خط نص الإعلان
            this.setupDisclaimerFontControls();

            const addTeamMemberBtn = document.getElementById('add-team-member-btn');
            if (addTeamMemberBtn) {
                addTeamMemberBtn.addEventListener('click', () => this.addTeamMemberRow());
            }

            const toggleInputs = document.querySelectorAll('[data-toggle-target]');
            toggleInputs.forEach(input => {
                const targetSelector = input.getAttribute('data-toggle-target');
                if (!targetSelector) return;
                const target = document.querySelector(targetSelector);
                if (!target) return;
                const updateVisibility = () => {
                    if (input.checked) {
                        target.classList.remove('hidden');
                    } else {
                        target.classList.add('hidden');
                    }
                };
                input.addEventListener('change', updateVisibility);
                updateVisibility();
            });

            // إظهار/إخفاء حقل المكان الفرعي عند اختيار الموقع
            const locationSelect = document.getElementById('ptw-location');
            const sublocationWrapper = document.getElementById('ptw-sublocation-wrapper');
            const sublocationSelect = document.getElementById('ptw-sublocation');
            if (locationSelect && sublocationWrapper && sublocationSelect) {
                const updateSublocation = () => {
                    try {
                        const selectedSiteId = locationSelect.value;
                        if (selectedSiteId) {
                            sublocationWrapper.style.display = 'block';
                            const places = this.getPlaceOptions(selectedSiteId);
                            // حفظ القيمة المحددة حالياً
                            const currentValue = sublocationSelect.value;
                            sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>' +
                                places.map(place => {
                                    // التحقق من التطابق مع البيانات الحالية
                                    let isSelected = currentValue === place.id;
                                    // إذا كانت هناك بيانات محملة، تحقق منها أيضاً
                                    if (!isSelected && ptwData) {
                                        isSelected = ptwData.sublocation === place.id ||
                                            ptwData.sublocationId === place.id ||
                                            ptwData.sublocationName === place.name ||
                                            ptwData.locationName === place.name;
                                    }
                                    return `<option value="${Utils.escapeHTML(place.id)}" ${isSelected ? 'selected' : ''}>${Utils.escapeHTML(place.name)}</option>`;
                                }).join('');
                        } else {
                            sublocationWrapper.style.display = 'none';
                            sublocationSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';
                            sublocationSelect.value = '';
                        }
                    } catch (error) {
                        Utils.safeError('خطأ في تحديث المكان الفرعي:', error);
                    }
                };
                locationSelect.addEventListener('change', updateSublocation);
                // تشغيل التحديث عند التحميل للتأكد من التطابق الصحيح
                updateSublocation();
            }

            // إدارة تبديل بين القائمة والإدخال اليدوي للجهة المصرح لها
            const authorizedPartySelect = document.getElementById('ptw-authorizedParty-select');
            const authorizedPartyInput = document.getElementById('ptw-authorizedParty');
            if (authorizedPartySelect && authorizedPartyInput) {
                authorizedPartySelect.addEventListener('change', () => {
                    if (authorizedPartySelect.value === '__custom__') {
                        authorizedPartyInput.classList.remove('hidden');
                        authorizedPartySelect.classList.add('hidden');
                        authorizedPartyInput.focus();
                    } else if (authorizedPartySelect.value) {
                        authorizedPartyInput.classList.add('hidden');
                        authorizedPartyInput.value = authorizedPartySelect.value;
                    } else {
                        authorizedPartyInput.classList.add('hidden');
                        authorizedPartyInput.value = '';
                    }
                });
                // إذا كانت القيمة الحالية غير موجودة في القائمة، إظهار حقل الإدخال اليدوي
                if (authorizedPartyInput.value && !Array.from(authorizedPartySelect.options).some(opt => opt.value === authorizedPartyInput.value)) {
                    authorizedPartyInput.classList.remove('hidden');
                    authorizedPartySelect.classList.add('hidden');
                } else if (authorizedPartySelect.value && authorizedPartySelect.value !== '__custom__') {
                    authorizedPartyInput.value = authorizedPartySelect.value;
                }
            }

            // إدارة تبديل بين القائمة والإدخال اليدوي للجهة الطالبة للتصريح (الإدارات)
            const requestingPartySelectForm = document.getElementById('ptw-requestingParty-select');
            const requestingPartyInputForm = document.getElementById('ptw-requestingParty');
            if (requestingPartySelectForm && requestingPartyInputForm) {
                requestingPartySelectForm.addEventListener('change', () => {
                    if (requestingPartySelectForm.value === '__custom__') {
                        requestingPartyInputForm.classList.remove('hidden');
                        requestingPartySelectForm.classList.add('hidden');
                        requestingPartyInputForm.focus();
                    } else if (requestingPartySelectForm.value) {
                        requestingPartyInputForm.classList.add('hidden');
                        requestingPartyInputForm.value = requestingPartySelectForm.value;
                    } else {
                        requestingPartyInputForm.classList.add('hidden');
                        requestingPartyInputForm.value = '';
                    }
                });
                if (requestingPartyInputForm.value && !Array.from(requestingPartySelectForm.options).some(opt => opt.value === requestingPartyInputForm.value.trim())) {
                    requestingPartyInputForm.classList.remove('hidden');
                    requestingPartySelectForm.classList.add('hidden');
                } else if (requestingPartySelectForm.value && requestingPartySelectForm.value !== '__custom__') {
                    requestingPartyInputForm.value = requestingPartySelectForm.value;
                }
            }

            this.updateStatusField();
        }, 100);
    },

    currentEditId: null,

    async showForm(data = null) {
        if (typeof Permissions !== 'undefined' && Permissions.ensureFormSettingsState) {
            try { await Permissions.ensureFormSettingsState(); } catch (e) { /* ignore */ }
        }
        this.currentEditId = data?.id || null;

        // إنشاء المودال للنموذج
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 10000; align-items: center; justify-content: center;';

        // الحصول على محتوى النموذج
        const formContent = await this.renderForm(data);

        modal.innerHTML = `
            <div class="modal-content ptw-manual-permit-modal" style="max-width: 1400px; width: 98%; max-height: 95vh; overflow-y: auto; padding: 0; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
                <!-- رأس النموذج -->
                <div class="modal-header" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-plus" style="font-size: 1.5rem;"></i>
                        </div>
                        <div>
                            <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0; color: white;">
                                ${data?.id ? 'تعديل تصريح عمل' : 'إصدار تصريح عمل جديد'}
                            </h2>
                            <p style="font-size: 0.875rem; opacity: 0.8; margin: 4px 0 0 0;">
                                <i class="fas fa-info-circle ml-1"></i>
                                ${data?.id ? 'تعديل تصريح العمل مع دورة الموافقات' : 'إصدار تصريح عمل جديد مع دورة الموافقات'}
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 8px 12px;" onclick="this.closest('.modal-overlay').remove();">
                            <i class="fas fa-times ml-1"></i>
                            إغلاق
                        </button>
                    </div>
                </div>

                <!-- محتوى النموذج -->
                <div class="modal-body" id="ptw-form-modal-body" style="padding: 0;">
                    ${formContent}
                </div>
            </div>
        `;

        // إضافة المودال إلى الصفحة
        document.body.appendChild(modal);

        // إعداد مستمعي الأحداث
        this.setupEventListeners(data);

        // التركيز على أول حقل في النموذج
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);
    },

    async showList() {
        this.currentEditId = null;

        // التأكد من التبديل إلى تبويب التصاريح أولاً
        this.switchTab('permits');

        // الانتظار قليلاً للتأكد من أن التبويب تم تفعيله
        await new Promise(resolve => setTimeout(resolve, 50));

        // البحث عن العنصر الصحيح - التبويب الجديد أو العنصر القديم
        const content = document.getElementById('ptw-permits-content') || document.getElementById('ptw-content');
        if (content) {
            // التأكد من أن المحتوى مرئي
            content.style.display = 'block';
            content.style.visibility = 'visible';
            content.style.opacity = '1';

            content.innerHTML = await this.renderList();
            this.setupEventListeners();
            // استخدام immediate = true بعد render القائمة
            this.loadPTWList(true);

            // التمرير إلى أعلى القائمة لضمان ظهورها
            setTimeout(() => {
                content.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    },

    async handleSubmit(e) {
        e.preventDefault();

        // منع النقر المتكرر - فحص الحالة العامة
        if (this._isSubmitting) {
            Notification.info(this._t('module.ptw.notify.waitRequest', 'جاري معالجة الطلب السابق، يرجى الانتظار...'));
            return;
        }

        // منع النقر المتكرر
        const submitBtn = e.target?.querySelector('button[type="submit"]') ||
            document.querySelector('#ptw-form button[type="submit"]') ||
            e.target?.closest('form')?.querySelector('button[type="submit"]');

        if (submitBtn && submitBtn.disabled) {
            return; // النموذج قيد المعالجة
        }

        // تعطيل الزر ومنع الحفظ المتكرر
        this._isSubmitting = true;
        let originalText = '';
        if (submitBtn) {
            originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
        }

        const isNewPermit = !this.currentEditId;

        // جمع بيانات الموافقات
        const approvals = [];
        const approvalRows = document.querySelectorAll('#approvals-tbody tr');
        approvalRows.forEach((row, index) => {
            const baseApproval = Array.isArray(this.formApprovals) ? (this.formApprovals[index] || {}) : {};
            const roleInput = document.getElementById(`approval-role-${index}`);
            const role = roleInput?.value.trim() || baseApproval.role || '';
            const required = row.getAttribute('data-required') !== 'false';

            const selectEl = document.getElementById(`approval-approver-select-${index}`);
            let approverId = baseApproval.approverId || '';
            let approverName = baseApproval.approver || '';
            let approverEmail = baseApproval.approverEmail || '';

            if (selectEl) {
                approverId = selectEl.value || '';
                if (approverId) {
                    const candidate = (baseApproval.candidates || []).find(c => c.id === approverId);
                    if (candidate) {
                        approverName = candidate.name || '';
                        approverEmail = candidate.email || '';
                    } else {
                        const user = ApprovalCircuits.getUserById(approverId);
                        if (user) {
                            approverName = user.name || user.email || approverName;
                            approverEmail = user.email || approverEmail;
                        }
                    }
                } else {
                    approverName = '';
                    approverEmail = '';
                }
            } else {
                const approverInput = document.getElementById(`approval-approver-${index}`);
                approverName = approverInput?.value.trim() || approverName;
            }

            const statusInput = document.getElementById(`approval-status-${index}`);
            const status = statusInput?.value || baseApproval.status || 'pending';
            const dateInput = document.getElementById(`approval-date-${index}`);
            const dateValue = dateInput?.value || '';
            const commentsInput = document.getElementById(`approval-comments-${index}`);
            const comments = commentsInput?.value.trim() || '';

            if (role) {
                approvals.push({
                    role,
                    approver: approverName,
                    approverId,
                    approverEmail,
                    status,
                    approved: status === 'approved',
                    rejected: status === 'rejected',
                    date: dateValue ? new Date(dateValue).toISOString() : baseApproval.date || '',
                    comments,
                    order: index,
                    required,
                    candidates: Array.isArray(baseApproval.candidates) ? baseApproval.candidates : [],
                    history: Array.isArray(baseApproval.history) ? baseApproval.history : [],
                    assignedAt: baseApproval.assignedAt || '',
                    assignedBy: baseApproval.assignedBy || null,
                    isSafetyOfficer: baseApproval.isSafetyOfficer === true,
                    circuitOwnerId: baseApproval.circuitOwnerId || this.formCircuitOwnerId || '__default__'
                });
            }
        });

        const collectWorkSelections = (name) => {
            const selections = [];
            document.querySelectorAll(`input[name="${name}-option"]`).forEach(cb => {
                if (cb.checked) {
                    if (cb.value === 'other') {
                        const otherValue = document.getElementById(`${name}-other-text`)?.value.trim();
                        if (otherValue) {
                            selections.push(otherValue);
                        }
                    } else {
                        const label = cb.getAttribute('data-label') || cb.value;
                        selections.push(label);
                    }
                }
            });
            return selections;
        };

        const hotSelections = collectWorkSelections('ptw-hot');
        const confinedSelections = collectWorkSelections('ptw-confined');
        const heightSelections = collectWorkSelections('ptw-height');

        const hotOtherValue = document.getElementById('ptw-hot-other-text')?.value.trim() || '';
        const confinedOtherValue = document.getElementById('ptw-confined-other-text')?.value.trim() || '';
        const heightOtherValue = document.getElementById('ptw-height-other-text')?.value.trim() || '';

        const collectTeamMembers = () => {
            return Array.from(document.querySelectorAll('#team-members-list .ptw-team-member-row'))
                .map(row => {
                    const name = row.querySelector('.ptw-team-member-name')?.value.trim();
                    return name ? { name } : null;
                })
                .filter(Boolean);
        };

        // فحص العناصر قبل الاستخدام
        const workDescriptionEl = document.getElementById('ptw-workDescription');
        const startDateEl = document.getElementById('ptw-startDate');
        const endDateEl = document.getElementById('ptw-endDate');

        if (!workDescriptionEl || !startDateEl || !endDateEl) {
            Notification.error(this._t('module.ptw.notify.missingFormFields', 'بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.'));
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        // توليد رقم تسلسلي (بدون نوع عمل)
        const workType = ''; // تم إزالة حقل نوع العمل الرئيسي
        const workTypePrefix = 'PTW'; // استخدام بادئة افتراضية
        const sequentialId = this.generateSequentialPTWId(''); // استخدام قيمة فارغة
        const existingPermit = this.currentEditId ? AppState.appData.ptw.find(p => p.id === this.currentEditId) : null;

        const locationSelect = document.getElementById('ptw-location');
        const sublocationSelect = document.getElementById('ptw-sublocation');
        const selectedSiteId = locationSelect?.value || '';
        const selectedSiteName = locationSelect?.options[locationSelect?.selectedIndex]?.text || '';
        const selectedSublocationId = sublocationSelect?.value || '';
        const selectedSublocationName = sublocationSelect?.options[sublocationSelect?.selectedIndex]?.text || '';

        const formData = {
            id: this.currentEditId || `${workTypePrefix}_${sequentialId}`,
            workType: '', // تم إزالة حقل نوع العمل الرئيسي
            workDescription: workDescriptionEl.value.trim(),
            location: selectedSiteName || selectedSiteId,
            siteId: selectedSiteId,
            siteName: selectedSiteName,
            sublocation: selectedSublocationName || selectedSublocationId,
            sublocationId: selectedSublocationId,
            sublocationName: selectedSublocationName,
            startDate: (() => {
                const value = startDateEl.value;
                return value ? (Utils.dateTimeLocalToISO(value) || '') : '';
            })(),
            endDate: (() => {
                const value = endDateEl.value;
                return value ? (Utils.dateTimeLocalToISO(value) || '') : '';
            })(),
            status: existingPermit?.status || 'قيد المراجعة',
            approvals: this.normalizeApprovals(approvals),
            requiredPPE: typeof PPEMatrix !== 'undefined' ? PPEMatrix.getSelected() : [],
            riskAssessment: (() => {
                if (typeof RiskMatrix === 'undefined') return {};
                try {
                    // محاولة الحصول من الخلية المحددة
                    const selectedCell = document.querySelector('#ptw-risk-matrix .risk-matrix-cell.selected') ||
                        document.querySelector('#ptw-risk-matrix td.ring-2') ||
                        document.querySelector('#ptw-risk-matrix .risk-matrix-cell[data-selected="true"]');
                    if (selectedCell) {
                        const likelihood = selectedCell.getAttribute('data-likelihood') || selectedCell.getAttribute('data-probability') || '';
                        const consequence = selectedCell.getAttribute('data-consequence') || selectedCell.getAttribute('data-severity') || '';
                        const riskLevel = selectedCell.textContent.trim() || selectedCell.querySelector('.risk-matrix-cell-value')?.textContent.trim() || '';
                        return { likelihood, consequence, riskLevel };
                    }
                } catch (error) {
                    Utils.safeWarn('خطأ في قراءة مصفوفة المخاطر:', error);
                }
                return {};
            })(),
            riskNotes: document.getElementById('ptw-risk-notes')?.value.trim() || '',
            authorizedParty: (() => {
                const select = document.getElementById('ptw-authorizedParty-select');
                const input = document.getElementById('ptw-authorizedParty');
                if (select && select.value && select.value !== '__custom__') {
                    return select.value.trim();
                } else if (input) {
                    return input.value.trim();
                }
                return '';
            })(),
            requestingParty: (() => {
                const select = document.getElementById('ptw-requestingParty-select');
                const input = document.getElementById('ptw-requestingParty');
                if (select && select.value && select.value !== '__custom__') {
                    return select.value.trim();
                } else if (input) {
                    return input.value.trim();
                }
                return '';
            })(),
            equipment: document.getElementById('ptw-equipment')?.value.trim() || '',
            tools: document.getElementById('ptw-tools')?.value.trim() || '',
            toolsList: document.getElementById('ptw-tools')?.value.trim() || '',
            teamMembers: collectTeamMembers(),
            hotWorkDetails: hotSelections,
            hotWorkOther: hotOtherValue,
            confinedSpaceDetails: confinedSelections,
            confinedSpaceOther: confinedOtherValue,
            heightWorkDetails: heightSelections,
            heightWorkOther: heightOtherValue,
            electricalWorkType: document.getElementById('ptw-electrical-work-type')?.value.trim() || '',
            coldWorkType: document.getElementById('ptw-cold-work-type')?.value.trim() || '',
            otherWorkType: document.getElementById('ptw-other-work-type')?.value.trim() || '',
            excavationLength: document.getElementById('ptw-excavation-length')?.value.trim() || '',
            excavationWidth: document.getElementById('ptw-excavation-width')?.value.trim() || '',
            excavationDepth: document.getElementById('ptw-excavation-depth')?.value.trim() || '',
            soilType: document.getElementById('ptw-excavation-soil')?.value.trim() || '',
            preStartChecklist: document.getElementById('ptw-preStartChecklist')?.checked || false,
            lotoApplied: document.getElementById('ptw-lotoApplied')?.checked || false,
            governmentPermits: document.getElementById('ptw-governmentPermits')?.checked || false,
            riskAssessmentAttached: document.getElementById('ptw-riskAssessmentAttached')?.checked || false,
            gasTesting: document.getElementById('ptw-gasTesting')?.checked || false,
            mocRequest: document.getElementById('ptw-mocRequest')?.checked || false,
            closureStatus: document.querySelector('input[name="ptw-closure-status"]:checked')?.value || '',
            closureTime: (() => {
                const value = document.getElementById('ptw-closure-time')?.value;
                return value ? (Utils.dateTimeLocalToISO(value) || '') : '';
            })(),
            closureReason: document.getElementById('ptw-closure-reason')?.value.trim() || '',
            closureApproval: {
                name1: document.getElementById('ptw-closure-approval-name-1')?.value.trim() || '',
                name2: document.getElementById('ptw-closure-approval-name-2')?.value.trim() || '',
                name3: document.getElementById('ptw-closure-approval-name-3')?.value.trim() || '',
                name4: document.getElementById('ptw-closure-approval-name-4')?.value.trim() || '',
                signature1: document.getElementById('ptw-closure-approval-signature-1')?.value.trim() || '',
                signature2: document.getElementById('ptw-closure-approval-signature-2')?.value.trim() || '',
                signature3: document.getElementById('ptw-closure-approval-signature-3')?.value.trim() || '',
                signature4: document.getElementById('ptw-closure-approval-signature-4')?.value.trim() || ''
            },
            permitDisclaimer: document.getElementById('ptw-permit-disclaimer-text')?.value.trim() || existingPermit?.permitDisclaimer || '',
            createdAt: existingPermit?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            approvalCircuitOwnerId: this.formCircuitOwnerId || existingPermit?.approvalCircuitOwnerId || '__default__',
            approvalCircuitName: this.formCircuitName || existingPermit?.approvalCircuitName || ''
        };

        this.updatePermitStatus(formData);
        if (isNewPermit) {
            formData.status = 'قيد المراجعة';
        }

        this.updateStatusField(formData.status);

        if (formData.startDate && formData.endDate) {
            const tStart = this.parseDateTimeValue(formData.startDate);
            const tEnd = this.parseDateTimeValue(formData.endDate);
            if (tStart && tEnd && tEnd <= tStart) {
                Notification.error(this._t('module.ptw.notify.endBeforeStart', 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء.'));
                this._isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                return;
            }
        }

        if (!formData.workDescription || !formData.location || !formData.status) {
            Notification.error(this._t('module.ptw.notify.fillRequired', 'يرجى ملء جميع الحقول المطلوبة'));
            this._isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        // ✅ التحقق من وجود معتمدين صالحين عند استخدام Issuing Authorities كمصدر للـ workflow
        if (isNewPermit &&
            this.formCircuitOwnerId === '__issuing_authorities__' &&
            (!formData.approvals || formData.approvals.length === 0)) {
            const permitTypeFields = this._extractPermitTypeFields(formData);
            if (permitTypeFields.length > 0) {
                Notification.error(
                    'لا يوجد أشخاص مصرح لهم بالتوقيع على هذا النوع من التصاريح. ' +
                    'يرجى مراجعة قائمة المصرح لهم بالتوقيع (Issuing Authorities) أو التنسيق مع مدير النظام.'
                );
                this._isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                return;
            }
        }

        try {
            // 1. حفظ البيانات فوراً في الذاكرة
            if (this.currentEditId) {
                const index = AppState.appData.ptw.findIndex(p => p.id === this.currentEditId);
                if (index !== -1) {
                    const oldPermit = AppState.appData.ptw[index];
                    const wasOpen = oldPermit.status !== 'مغلق';
                    const nowClosed = formData.status === 'مغلق' || (formData.closureStatus && formData.closureTime);

                    AppState.appData.ptw[index] = formData;

                    // كشف إغلاق التصريح
                    if (wasOpen && nowClosed) {
                        Notification.success(this._t('module.ptw.notify.closeOk', 'تم إغلاق التصريح بنجاح'));
                    } else {
                        Notification.success(this._t('module.ptw.notify.permUpdateOk', 'تم تحديث التصريح بنجاح'));
                    }
                }
            } else {
                AppState.appData.ptw.push(formData);
                this.notifyPermitCreated(formData);
                Notification.success(this._t('module.ptw.notify.permAddOk', 'تم إضافة التصريح بنجاح'));
            }

            // التأكد من حفظ بيانات السجل في AppState قبل حفظ DataManager
            if (!AppState.appData.ptwRegistry) {
                AppState.appData.ptwRegistry = Array.isArray(this.registryData) ? [...this.registryData] : [];
            } else {
                // تحديث AppState بالبيانات الحالية
                AppState.appData.ptwRegistry = Array.isArray(this.registryData) ? [...this.registryData] : AppState.appData.ptwRegistry;
            }

            // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة (قبل المزامنة)
            this.showList();

            // 3. استعادة الزر فوراً بعد الحفظ في الذاكرة
            this._isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }

            // 4. معالجة المهام الخلفية في الخلفية (بدون انتظار)
            // استخدام Promise.allSettled لمنع فشل أحد المهام من إيقاف الأخرى
            Promise.allSettled([
                // حفظ البيانات في localStorage (في الخلفية)
                Promise.resolve().then(() => {
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    } else {
                        Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
                    }
                }).catch(error => {
                    Utils.safeError('خطأ في حفظ البيانات محلياً:', error);
                    return { success: false, error };
                }),
                // تحديث السجل
                this.currentEditId
                    ? this.updateRegistryEntry(formData).catch(error => {
                        Utils.safeError('خطأ في تحديث السجل:', error);
                        return { success: false, error };
                    })
                    : this.addToRegistry(formData).catch(error => {
                        Utils.safeError('خطأ في إضافة السجل:', error);
                        return { success: false, error };
                    }),
                // حفظ في Google Sheets
                GoogleIntegration.autoSave('PTW', AppState.appData.ptw).catch(error => {
                    Utils.safeError('خطأ في حفظ Google Sheets:', error);
                    return { success: false, error };
                })
            ]).then((results) => {
                // التحقق من نجاح المهام الخلفية
                const allSucceeded = results.every(r => r.status === 'fulfilled');
                if (!allSucceeded) {
                    Utils.safeWarn('⚠️ بعض المهام الخلفية فشلت، لكن البيانات تم حفظها محلياً');
                }
                
                this.triggerNotificationsUpdate();
                this.updateKPIs(); // تحديث KPIs بعد الحفظ

                // تحديث تبويب التحليل إذا كان مرئياً
                const analysisContent = document.getElementById('ptw-analysis-content');
                if (analysisContent && analysisContent.style.display !== 'none') {
                    analysisContent.innerHTML = this.renderAnalysisContent();
                    this.setupAnalysisEventListeners();
                }
            });
        } catch (error) {
            Notification.error(this._t('module.ptw.notify.errorGeneric', 'حدث خطأ: ') + error.message);

            // استعادة حالة الزر في حالة الخطأ
            this._isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    },

    addTeamMemberRow(name = '') {
        const container = document.getElementById('team-members-list');
        // ✅ التحقق من وجود الحاوية وأنها متصلة بالـ DOM
        if (!container || !container.parentNode || !document.body.contains(container)) {
            Utils.safeWarn('⚠️ addTeamMemberRow: container غير موجود أو غير متصل بالـ DOM');
            return;
        }
        const safeName = (typeof Utils !== 'undefined' && Utils && typeof Utils.escapeHTML === 'function')
            ? Utils.escapeHTML(name || '')
            : (name || '');
        const row = document.createElement('div');
        row.className = 'ptw-team-member-row flex items-center gap-3';
        row.innerHTML = `
            <input type="text" class="form-input flex-1 ptw-team-member-name" placeholder="اسم العامل" value="${safeName}">
            <button type="button" class="btn-icon btn-icon-danger" onclick="PTW.removeTeamMemberRow(this)" title="حذف">
                <i class="fas fa-times"></i>
            </button>
        `;
        try {
            container.appendChild(row);
        } catch (error) {
            Utils.safeError('❌ خطأ في appendChild لـ team member row:', error);
        }
    },

    removeTeamMemberRow(button) {
        const row = button?.closest('.ptw-team-member-row');
        const container = document.getElementById('team-members-list');
        if (!row || !container) return;
        if (container.children.length > 1) {
            row.remove();
        } else {
            const input = row.querySelector('.ptw-team-member-name');
            if (input) input.value = '';
        }
    },

    addApproval() {
        const tbody = document.getElementById('approvals-tbody');
        // ✅ التحقق من وجود tbody وأنه متصل بالـ DOM
        if (!tbody || !tbody.parentNode || !document.body.contains(tbody)) {
            Utils.safeWarn('⚠️ addApproval: tbody غير موجود أو غير متصل بالـ DOM');
            return;
        }

        const index = tbody.children.length;
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-approval-index', index);
        newRow.setAttribute('data-required', 'true');
        newRow.innerHTML = `
            <td>
                <input type="text" class="form-input" style="min-width: 150px;"
                    placeholder="دور الموافق" id="approval-role-${index}" required>
            </td>
            <td>
                <input type="text" class="form-input" style="min-width: 150px;"
                    placeholder="اسم الموافق" id="approval-approver-${index}">
            </td>
            <td>
                <select class="form-input" id="approval-status-${index}">
                    <option value="pending">قيد الانتظار</option>
                    <option value="approved">موافقة</option>
                    <option value="rejected">مرفوضة</option>
                </select>
            </td>
            <td>
                <input type="datetime-local" class="form-input" style="min-width: 180px;"
                    id="approval-date-${index}">
            </td>
            <td>
                <input type="text" class="form-input" style="min-width: 200px;"
                    placeholder="ملاحظات" id="approval-comments-${index}">
            </td>
            <td>
                <button type="button" onclick="PTW.removeApproval(${index})" class="btn-icon btn-icon-danger" title="حذ">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        try {
            tbody.appendChild(newRow);
        } catch (error) {
            Utils.safeError('❌ خطأ في appendChild لـ approval row:', error);
        }
    },

    removeApproval(index) {
        const tbody = document.getElementById('approvals-tbody');
        if (!tbody) return;
        const row = tbody.querySelector(`tr[data-approval-index="${index}"]`);
        if (row) {
            row.remove();
            // إعادة ترقيم الصور
            Array.from(tbody.children).forEach((row, idx) => {
                row.setAttribute('data-approval-index', idx);
            });
        }
    },

    /**
     * إضافة موافقة إغلاق يدوية (بنفس طريقة القسم السابع)
     */
    addClosureApproval() {
        const tbody = document.getElementById('closure-approvals-tbody');
        // ✅ التحقق من وجود tbody وأنه متصل بالـ DOM
        if (!tbody || !tbody.parentNode || !document.body.contains(tbody)) {
            Utils.safeWarn('⚠️ addClosureApproval: tbody غير موجود أو غير متصل بالـ DOM');
            return;
        }

        const index = tbody.children.length;
        const newRow = document.createElement('tr');
        newRow.setAttribute('data-closure-approval-index', index);
        newRow.setAttribute('data-required', 'true');
        newRow.innerHTML = `
            <td>
                <input type="text" class="form-input" style="min-width: 150px;"
                    placeholder="دور الموافق" id="closure-approval-role-${index}" required>
            </td>
            <td>
                <input type="text" class="form-input" style="min-width: 150px;"
                    placeholder="اسم الموافق" id="closure-approval-approver-${index}">
            </td>
            <td>
                <select class="form-input" id="closure-approval-status-${index}">
                    <option value="pending">قيد الانتظار</option>
                    <option value="approved">موافقة</option>
                    <option value="rejected">مرفوضة</option>
                </select>
            </td>
            <td>
                <input type="datetime-local" class="form-input" style="min-width: 180px;"
                    id="closure-approval-date-${index}">
            </td>
            <td>
                <input type="text" class="form-input" style="min-width: 200px;"
                    placeholder="ملاحظات" id="closure-approval-comments-${index}">
            </td>
            <td>
                <button type="button" onclick="PTW.removeClosureApproval(${index})" class="btn-icon btn-icon-danger" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        try {
            tbody.appendChild(newRow);
        } catch (error) {
            Utils.safeError('❌ خطأ في appendChild لـ closure approval row:', error);
        }
    },

    /**
     * حذف موافقة إغلاق
     */
    removeClosureApproval(index) {
        const tbody = document.getElementById('closure-approvals-tbody');
        if (!tbody) return;
        const row = tbody.querySelector(`tr[data-closure-approval-index="${index}"]`);
        if (row) {
            row.remove();
            // إعادة ترقيم الصفوف
            Array.from(tbody.children).forEach((row, idx) => {
                row.setAttribute('data-closure-approval-index', idx);
            });
        }
    },

    /**
     * إعداد أزرار التحكم في حجم خط نص الإعلان
     */
    setupDisclaimerFontControls() {
        const textarea = document.getElementById('ptw-permit-disclaimer-text');
        const decreaseBtn = document.getElementById('ptw-disclaimer-font-decrease');
        const increaseBtn = document.getElementById('ptw-disclaimer-font-increase');
        const resetBtn = document.getElementById('ptw-disclaimer-font-reset');
        const sizeDisplay = document.getElementById('ptw-disclaimer-font-size-display');
        
        if (!textarea || !decreaseBtn || !increaseBtn || !resetBtn || !sizeDisplay) return;

        // الحجم الافتراضي
        const defaultSize = 15;
        const minSize = 10;
        const maxSize = 24;
        const step = 1;

        // استرجاع الحجم المحفوظ أو استخدام الافتراضي
        let currentSize = parseInt(textarea.style.fontSize) || defaultSize;
        if (isNaN(currentSize)) {
            currentSize = defaultSize;
        }

        // تحديث الحجم والعرض
        const updateFontSize = (newSize) => {
            currentSize = Math.max(minSize, Math.min(maxSize, newSize));
            textarea.style.fontSize = currentSize + 'px';
            sizeDisplay.textContent = currentSize;
            
            // حفظ الحجم في localStorage
            try {
                localStorage.setItem('ptw_disclaimer_font_size', currentSize.toString());
            } catch (e) {
                Utils.safeWarn('⚠️ خطأ في حفظ حجم الخط:', e);
            }
        };

        // استرجاع الحجم المحفوظ
        try {
            const savedSize = localStorage.getItem('ptw_disclaimer_font_size');
            if (savedSize) {
                const parsed = parseInt(savedSize);
                if (!isNaN(parsed)) {
                    currentSize = parsed;
                    updateFontSize(currentSize);
                }
            }
        } catch (e) {
            Utils.safeWarn('⚠️ خطأ في استرجاع حجم الخط:', e);
        }

        // تحديث العرض الأولي
        updateFontSize(currentSize);

        // زر التصغير
        decreaseBtn.addEventListener('click', () => {
            updateFontSize(currentSize - step);
            decreaseBtn.classList.add('animate-pulse');
            setTimeout(() => decreaseBtn.classList.remove('animate-pulse'), 200);
        });

        // زر التكبير
        increaseBtn.addEventListener('click', () => {
            updateFontSize(currentSize + step);
            increaseBtn.classList.add('animate-pulse');
            setTimeout(() => increaseBtn.classList.remove('animate-pulse'), 200);
        });

        // زر إعادة التعيين
        resetBtn.addEventListener('click', () => {
            updateFontSize(defaultSize);
            resetBtn.classList.add('animate-spin');
            setTimeout(() => resetBtn.classList.remove('animate-spin'), 500);
        });
    },

    async editPTW(id) {
        // البحث في قائمة التصاريح العادية أولاً
        let item = AppState.appData.ptw.find(i => i.id === id);
        
        // إذا لم يُعثر عليه، البحث في السجل اليدوي
        if (!item && this.registryData) {
            const registryEntry = this.registryData.find(r => r.id === id || r.permitId === id);
            if (registryEntry && registryEntry.isManualEntry === true) {
                // تحويل السجل اليدوي إلى تنسيق التصريح
                item = {
                    id: registryEntry.permitId,
                    workType: Array.isArray(registryEntry.permitType)
                        ? registryEntry.permitTypeDisplay || registryEntry.permitType.join('، ')
                        : registryEntry.permitType || registryEntry.permitTypeDisplay,
                    location: registryEntry.location,
                    siteName: registryEntry.location,
                    sublocation: registryEntry.sublocation,
                    sublocationName: registryEntry.sublocation,
                    startDate: registryEntry.openDate,
                    endDate: registryEntry.timeTo,
                    status: String(registryEntry.status || '').trim() || 'مغلق',
                    requestingParty: registryEntry.requestingParty,
                    authorizedParty: registryEntry.authorizedParty,
                    workDescription: registryEntry.workDescription,
                    approvals: [],
                    approvalCircuitOwnerId: '__manual__',
                    approvalCircuitName: 'Manual Entry',
                    createdAt: registryEntry.createdAt,
                    updatedAt: registryEntry.updatedAt,
                    skipApprovalFlow: true,
                    isManualEntry: true,
                    // جميع الحقول اليدوية للتعديل
                    teamMembers: registryEntry.teamMembers || [],
                    teamMembersText: registryEntry.teamMembersText || '',
                    hotWorkDetails: registryEntry.hotWorkDetails || [],
                    hotWorkOther: registryEntry.hotWorkOther || '',
                    confinedSpaceDetails: registryEntry.confinedSpaceDetails || [],
                    confinedSpaceOther: registryEntry.confinedSpaceOther || '',
                    heightWorkDetails: registryEntry.heightWorkDetails || [],
                    heightWorkOther: registryEntry.heightWorkOther || '',
                    excavationLength: registryEntry.excavationLength || '',
                    excavationWidth: registryEntry.excavationWidth || '',
                    excavationDepth: registryEntry.excavationDepth || '',
                    soilType: registryEntry.soilType || '',
                    electricalWorkType: registryEntry.electricalWorkType || '',
                    coldWorkType: registryEntry.coldWorkType || '',
                    otherWorkType: registryEntry.otherWorkType || '',
                    preStartChecklist: registryEntry.preStartChecklist || false,
                    lotoApplied: registryEntry.lotoApplied || false,
                    governmentPermits: registryEntry.governmentPermits || false,
                    riskAssessmentAttached: registryEntry.riskAssessmentAttached || false,
                    gasTesting: registryEntry.gasTesting || false,
                    mocRequest: registryEntry.mocRequest || false,
                    ppeNotes: registryEntry.ppeNotes || '',
                    riskLikelihood: registryEntry.riskLikelihood || '',
                    riskConsequence: registryEntry.riskConsequence || '',
                    riskScore: registryEntry.riskScore || '',
                    riskLevel: registryEntry.riskLevel || '',
                    riskNotes: registryEntry.riskNotes || '',
                    manualApprovals: registryEntry.manualApprovals || [],
                    manualApprovalsText: registryEntry.manualApprovalsText || '',
                    manualClosureApprovals: registryEntry.manualClosureApprovals || [],
                    manualClosureApprovalsText: registryEntry.manualClosureApprovalsText || '',
                    closureTime: registryEntry.closureTime || '',
                    closureDate: registryEntry.closureDate || '',
                    closureReason: registryEntry.closureReason || '',
                    paperPermitNumber: registryEntry.paperPermitNumber || '',
                    equipment: registryEntry.equipment || '',
                    tools: registryEntry.tools || '',
                    toolsList: registryEntry.toolsList || '',
                    supervisor1: registryEntry.supervisor1 || '',
                    supervisor2: registryEntry.supervisor2 || ''
                };
            }
        }
        
        if (item) await this.showForm(item);
    },

    async viewPTW(id) {
        // البحث في قائمة التصاريح العادية أولاً
        let item = AppState.appData.ptw.find(i => i.id === id);
        
        // إذا لم يُعثر عليه، البحث في السجل اليدوي
        if (!item && this.registryData) {
            const registryEntry = this.registryData.find(r => r.id === id || r.permitId === id);
            if (registryEntry && registryEntry.isManualEntry === true) {
                item = {
                    id: registryEntry.permitId,
                    workType: Array.isArray(registryEntry.permitType)
                        ? registryEntry.permitTypeDisplay || registryEntry.permitType.join('، ')
                        : registryEntry.permitType || registryEntry.permitTypeDisplay,
                    location: registryEntry.location,
                    siteName: registryEntry.location,
                    sublocation: registryEntry.sublocation,
                    sublocationName: registryEntry.sublocation,
                    startDate: registryEntry.openDate,
                    endDate: registryEntry.timeTo,
                    status: String(registryEntry.status || '').trim() || 'مغلق',
                    requestingParty: registryEntry.requestingParty,
                    authorizedParty: registryEntry.authorizedParty,
                    workDescription: registryEntry.workDescription,
                    approvals: [],
                    approvalCircuitOwnerId: '__manual__',
                    approvalCircuitName: 'Manual Entry',
                    createdAt: registryEntry.createdAt,
                    updatedAt: registryEntry.updatedAt,
                    skipApprovalFlow: true,
                    isManualEntry: true,
                    teamMembers: registryEntry.teamMembers || [],
                    hotWorkDetails: registryEntry.hotWorkDetails || [],
                    hotWorkOther: registryEntry.hotWorkOther || '',
                    confinedSpaceDetails: registryEntry.confinedSpaceDetails || [],
                    confinedSpaceOther: registryEntry.confinedSpaceOther || '',
                    heightWorkDetails: registryEntry.heightWorkDetails || [],
                    heightWorkOther: registryEntry.heightWorkOther || '',
                    excavationLength: registryEntry.excavationLength || '',
                    excavationWidth: registryEntry.excavationWidth || '',
                    excavationDepth: registryEntry.excavationDepth || '',
                    soilType: registryEntry.soilType || '',
                    electricalWorkType: registryEntry.electricalWorkType || '',
                    coldWorkType: registryEntry.coldWorkType || '',
                    otherWorkType: registryEntry.otherWorkType || '',
                    ppeNotes: registryEntry.ppeNotes || '',
                    riskLikelihood: registryEntry.riskLikelihood || '',
                    riskConsequence: registryEntry.riskConsequence || '',
                    riskScore: registryEntry.riskScore || '',
                    riskLevel: registryEntry.riskLevel || '',
                    riskNotes: registryEntry.riskNotes || '',
                    manualApprovals: registryEntry.manualApprovals || [],
                    manualClosureApprovals: registryEntry.manualClosureApprovals || [],
                    closureDate: registryEntry.closureDate || '',
                    closureReason: registryEntry.closureReason || '',
                    paperPermitNumber: registryEntry.paperPermitNumber || '',
                    equipment: registryEntry.equipment || '',
                    tools: registryEntry.tools || '',
                    supervisor1: registryEntry.supervisor1 || '',
                    supervisor2: registryEntry.supervisor2 || ''
                };
            }
        }
        
        if (!item) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const isManual = item.isManualEntry === true;
        
        // التصريح اليدوي لا يعرض دائرة اعتمادات - يظهر حالة مغلقة مباشرة
        const approvals = isManual ? [] : this.normalizeApprovals(item.approvals || []);

        // إنشاء HTML لفريق العمل
        const teamMembers = Array.isArray(item.teamMembers) ? item.teamMembers : [];
        const teamMembersHTML = teamMembers.length > 0
            ? `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                ${teamMembers.map(m => `<span class="bg-gray-100 px-3 py-1 rounded text-sm">${Utils.escapeHTML(m.name || '-')}</span>`).join('')}
               </div>`
            : '<p class="text-gray-500">لا يوجد فريق محدد</p>';

        // استخراج تفاصيل الأعمال من البيانات
        const hotDetails = Array.isArray(item.hotWorkDetails) ? item.hotWorkDetails : [];
        const hotOtherValue = item.hotWorkOther || '';
        const confinedDetails = Array.isArray(item.confinedSpaceDetails) ? item.confinedSpaceDetails : [];
        const confinedOtherValue = item.confinedSpaceOther || '';
        const heightDetails = Array.isArray(item.heightWorkDetails) ? item.heightWorkDetails : [];
        const heightOtherValue = item.heightWorkOther || '';

        // دالة لعرض مجموعة الشارات
        const renderBadgeGroup = (title, details, otherValue) => {
            const badges = details.length > 0 
                ? details.map(detail => `<span class="badge badge-info mr-1 mb-1">${Utils.escapeHTML(detail)}</span>`).join('')
                : '';
            const otherText = otherValue ? `<p class="text-gray-700 mt-2"><strong>أخرى:</strong> ${Utils.escapeHTML(otherValue)}</p>` : '';
            const hasContent = badges || otherText;
            
            return `
                <div>
                    <label class="text-sm font-semibold text-gray-600">${title}:</label>
                    <div class="mt-1">
                        ${hasContent ? `${badges}${otherText}` : '<p class="text-gray-500">لا يوجد</p>'}
                    </div>
                </div>
            `;
        };

        // متغيرات أخرى للعرض (افتراضية إذا لم تكن موجودة)
        const attachmentsHTML = '';
        const requiredPPEHTML = '';
        const riskAssessmentHTML = '';
        const closureStatusLabel = item.status === 'مغلق' ? 'مغلق' : 'غير مغلق';
        const closureTimeText = item.endDate ? Utils.formatDate(item.endDate) : '-';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">تفاصيل تصريح العمل</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">نوع العمل:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.workType || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الموقع / القسم:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.siteName || item.location || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">المكان الفرعي:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.sublocationName || item.sublocation || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ البدء:</label>
                                <p class="text-gray-800">${item.startDate ? Utils.formatDate(item.startDate) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">تاريخ الانتهاء:</label>
                                <p class="text-gray-800">${item.endDate ? Utils.formatDate(item.endDate) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                <span class="badge badge-${this.getStatusBadgeClass(item.status)}">
                                    ${item.status || '-'}
                                </span>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الجهة المصرح لها:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.authorizedParty || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الجهة الطالبة للتصريح:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.requestingParty || '-')}</p>
                            </div>
                            <div class="md:col-span-2">
                                <label class="text-sm font-semibold text-gray-600">المعدة / الماكينة / العملية:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.equipment || '-')}</p>
                            </div>
                            <div class="md:col-span-2">
                                <label class="text-sm font-semibold text-gray-600">الأدوات أو العدد:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.tools || item.toolsList || '-')}</p>
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">وصف العمل:</label>
                            <p class="text-gray-800">${Utils.escapeHTML(item.workDescription || '')}</p>
                        </div>
                        <div class="border-t pt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">الفريق القائم بالعمل</h3>
                            ${teamMembersHTML}
                        </div>
                        <div class="border-t pt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">تفاصيل طبيعة الأعمال</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                ${renderBadgeGroup('أعمال ساخنة', hotDetails, hotOtherValue)}
                                ${renderBadgeGroup('أماكن مغلقة', confinedDetails, confinedOtherValue)}
                                ${renderBadgeGroup('أعمال على ارتفاع', heightDetails, heightOtherValue)}
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">تفاصيل أعمال الكهرباء:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.electricalWorkType || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">تفاصيل الأعمال على البارد:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.coldWorkType || '-')}</p>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="text-sm font-semibold text-gray-600">تفاصيل أعمال أخرى:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.otherWorkType || '-')}</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">طول أعمال الحفر (م):</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.excavationLength || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">عرض أعمال الحفر (م):</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.excavationWidth || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">عمق أعمال الحفر (م):</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.excavationDepth || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">نوع التربة:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.soilType || '-')}</p>
                                </div>
                            </div>
                        </div>
                        <div class="border-t pt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">المتطلبات والمرفقات</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                ${attachmentsHTML}
                            </div>
                        </div>
                        <div class="border-t pt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">مهمات الوقاية المطلوبة</h3>
                            ${requiredPPEHTML}
                        </div>
                        <div class="border-t pt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">نتائج تقييم المخاطر</h3>
                            ${riskAssessmentHTML}
                        </div>
                        <div class="border-t pt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">إغلاق التصريح</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                    <p class="text-gray-800">${closureStatusLabel}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">توقيت الإغلاق:</label>
                                    <p class="text-gray-800">${closureTimeText}</p>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="text-sm font-semibold text-gray-600">سبب الإغلاق:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(item.closureReason || '-')}</p>
                                </div>
                            </div>
                        </div>
                        ${isManual ? `
                        <div class="border-t pt-4 mt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">
                                <i class="fas fa-check-circle text-green-600 ml-2"></i>
                                اعتمادات التصريح اليدوي
                            </h3>
                            ${(() => {
                                const manualApprovals = item.manualApprovals || [];
                                if (manualApprovals.length === 0) {
                                    return '<p class="text-gray-500">لا توجد اعتمادات مسجلة</p>';
                                }
                                return `
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead>
                                                <tr>
                                                    <th>الدور</th>
                                                    <th>الاسم</th>
                                                    <th>التوقيع</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${manualApprovals.map(a => `
                                                    <tr>
                                                        <td>${Utils.escapeHTML(a.role || '')}</td>
                                                        <td>${Utils.escapeHTML(a.name || '-')}</td>
                                                        <td>${Utils.escapeHTML(a.signature || '-')}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `;
                            })()}
                        </div>
                        <div class="border-t pt-4 mt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-3">
                                <i class="fas fa-check-double text-blue-600 ml-2"></i>
                                اعتمادات إغلاق التصريح
                            </h3>
                            ${(() => {
                                const manualClosureApprovals = item.manualClosureApprovals || [];
                                if (manualClosureApprovals.length === 0) {
                                    return '<p class="text-gray-500">لا توجد اعتمادات إغلاق مسجلة</p>';
                                }
                                return `
                                    <div class="table-wrapper">
                                        <table class="data-table">
                                            <thead>
                                                <tr>
                                                    <th>الدور</th>
                                                    <th>الاسم</th>
                                                    <th>التوقيع</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${manualClosureApprovals.map(a => `
                                                    <tr>
                                                        <td>${Utils.escapeHTML(a.role || '')}</td>
                                                        <td>${Utils.escapeHTML(a.name || '-')}</td>
                                                        <td>${Utils.escapeHTML(a.signature || '-')}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `;
                            })()}
                        </div>
                        ` : ''}
                        ${approvals.length > 0 ? `
                        <div class="border-t pt-4 mt-4">
                            <h3 class="text-lg font-bold text-gray-800 mb-4">دائرة الاعتمادات</h3>
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>المواق</th>
                                            <th>الاسم</th>
                                            <th>الحالة</th>
                                            <th>التاريخ</th>
                                            <th>ملاحظات</th>
                                            <th>الإجراء</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${approvals.map((approval, index) => {
            const statusBadge = approval.status === 'approved'
                ? 'success'
                : approval.status === 'rejected'
                    ? 'danger'
                    : 'warning';
            const statusLabel = approval.status === 'approved'
                ? 'موافقة'
                : approval.status === 'rejected'
                    ? 'مرفوض'
                    : 'قيد الانتظار';
            const candidateOptions = (approval.candidates || []).map(candidate => `
                                                <option value="${Utils.escapeHTML(candidate.id || '')}" ${candidate.id && candidate.id === approval.approverId ? 'selected' : ''}>
                                                    ${Utils.escapeHTML(candidate.name || candidate.email || '')}
                                                    ${candidate.email ? ` - ${Utils.escapeHTML(candidate.email)}` : ''}
                                                </option>
                                            `).join('');
            const assignmentControls = approval.status === 'pending' && candidateOptions
                ? `
                                                    <div class="flex items-center gap-2 mb-2">
                                                        <select id="approval-assign-${item.id}-${index}" class="form-input">
                                                            <option value="">اختر المعتمد</option>
                                                            ${candidateOptions}
                                                        </select>
                                                        <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;" onclick="PTW.assignApproval('${item.id}', ${index})">
                                                            تعيين
                                                        </button>
                                                    </div>
                                                  `
                : '';
            const actionButtons = approval.status === 'pending'
                ? `<div class="flex flex-col gap-2">
                                                        ${assignmentControls}
                                                        <button class="btn-primary" style="padding: 4px 12px; font-size: 12px;" onclick="PTW.handleApprovalAction('${item.id}', ${index}, 'approved')">
                                                            اعتماد
                                                        </button>
                                                        <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px; background-color: #ef4444; border-color: #ef4444; color: #fff;" onclick="PTW.handleApprovalAction('${item.id}', ${index}, 'rejected')">
                                                            رفض
                                                        </button>
                                                   </div>`
                : '';
            const historyHtml = Array.isArray(approval.history) && approval.history.length > 0
                ? `<div class="mt-2 space-y-1">
                                                        ${approval.history.slice(-4).reverse().map(entry => `
                                                            <div class="text-xs text-gray-500 flex items-center gap-2">
                                                                <i class="fas fa-history text-gray-400"></i>
                                                                <span>${Utils.escapeHTML(entry.action === 'approved' ? 'موافقة' : entry.action === 'rejected' ? 'رفض' : entry.action === 'assigned' ? 'تعيين' : entry.action || '-')}</span>
                                                                <span>•</span>
                                                                <span>${entry.performedBy?.name ? Utils.escapeHTML(entry.performedBy.name) : entry.assignedBy?.name ? Utils.escapeHTML(entry.assignedBy.name) : '-'}</span>
                                                                <span>•</span>
                                                                <span>${Utils.formatDateTime(entry.timestamp)}</span>
                                                            </div>
                                                        `).join('')}
                                                   </div>`
                : '';
            return `
                                            <tr>
                                                <td>${Utils.escapeHTML(approval.role || '')}</td>
                                                <td>${Utils.escapeHTML(approval.approver || '')}</td>
                                                <td>
                                                        <span class="badge badge-${statusBadge}">
                                                            ${statusLabel}
                                                    </span>
                                                </td>
                                                <td>${approval.date ? Utils.formatDate(approval.date) : '-'}</td>
                                                <td>
                                                    ${Utils.escapeHTML(approval.comments || '')}
                                                    ${historyHtml}
                                                </td>
                                                <td>${actionButtons}</td>
                                            </tr>
                                            `;
        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer form-actions-centered">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button class="btn-primary" onclick="PTW.exportPDF('${item.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-file-pdf ml-2"></i>
                        تصدير/طباعة PDF
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const ok = confirm(PTW._t('module.ptw.mapSettings.closeUnsaved', 'تنبيه: سيتم إغلاق النافذة.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) modal.remove();
            }
        });

        // إضافة مستمعين لأزرار الموافقة والرفض بعد إضافة الـ modal
        setTimeout(() => {
            const approveButtons = modal.querySelectorAll('[onclick*="handleApprovalAction"][onclick*="approved"]');
            approveButtons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/handleApprovalAction\('([^']+)',\s*(\d+),\s*'approved'\)/);
                    if (match && match[1] && match[2]) {
                        btn.removeAttribute('onclick');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.handleApprovalAction(match[1], parseInt(match[2]), 'approved');
                        });
                    }
                }
            });

            const rejectButtons = modal.querySelectorAll('[onclick*="handleApprovalAction"][onclick*="rejected"]');
            rejectButtons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/handleApprovalAction\('([^']+)',\s*(\d+),\s*'rejected'\)/);
                    if (match && match[1] && match[2]) {
                        btn.removeAttribute('onclick');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.handleApprovalAction(match[1], parseInt(match[2]), 'rejected');
                        });
                    }
                }
            });

            // إضافة مستمعين لأزرار التخصيص
            const assignButtons = modal.querySelectorAll('[onclick*="assignApproval"]');
            assignButtons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/assignApproval\('([^']+)',\s*(\d+)\)/);
                    if (match && match[1] && match[2]) {
                        btn.removeAttribute('onclick');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.assignApproval(match[1], parseInt(match[2]));
                        });
                    }
                }
            });
        }, 50);
    },

    async handleApprovalAction(id, approvalIndex, action) {
        // منع المعالجة المتكررة
        const actionKey = `approval_${id}_${approvalIndex}`;
        if (this[`_processing_${actionKey}`]) {
            Notification.info(this._t('module.ptw.notify.approvalProcessing', 'جاري معالجة هذا الاعتماد، يرجى الانتظار...'));
            return;
        }

        const permit = AppState.appData.ptw.find(i => i.id === id);
        if (!permit) {
            Notification.error(this._t('module.ptw.notify.findPermitFail', 'تعذر العثور على تصريح العمل المحدد'));
            return;
        }

        permit.approvals = this.normalizeApprovals(permit.approvals || []);
        const approval = permit.approvals[approvalIndex];
        if (!approval) {
            Notification.error(this._t('module.ptw.notify.approvalItemMissing', 'عنصر الاعتماد غير موجود'));
            return;
        }

        if (permit.status === 'مغلق') {
            Notification.warning(this._t('module.ptw.notify.cannotEditClosed', 'لا يمكن تعديل تصريح مغلق'));
            return;
        }

        if (approval.status !== 'pending') {
            Notification.info(this._t('module.ptw.notify.approvalDone', 'تمت معالجة هذا الاعتماد بالفعل'));
            return;
        }

        const currentUserEmail = AppState.currentUser?.email ? AppState.currentUser.email.toLowerCase() : '';
        if (approval.approverEmail && currentUserEmail &&
            approval.approverEmail.toLowerCase() !== currentUserEmail &&
            AppState.currentUser?.role !== 'admin') {
            Notification.warning(this._t('module.ptw.notify.otherUser', 'هذا الاعتماد موجه إلى مستخدم آخر.'));
            return;
        }

        if (action === 'approved') {
            // التحقق من ترتيب الاعتمادات - يجب اعتماد جميع الاعتمادات المطلوبة السابقة
            const requiredApprovalsBefore = permit.approvals
                .filter((a, idx) => idx < approvalIndex && a.required !== false);
            
            const pendingBefore = requiredApprovalsBefore
                .some(a => a.status !== 'approved');
            
            if (pendingBefore) {
                const ns = this._t('module.ptw.common.notSpecified', 'غير محدد');
                const sep = this._t('module.ptw.common.listSep', '، ');
                const pendingRoles = requiredApprovalsBefore
                    .filter(a => a.status !== 'approved')
                    .map(a => this.approvalRoleLabel(a.role || ns))
                    .join(sep);
                Notification.warning(this._t('module.ptw.notify.prevApprovals', 'يجب اعتماد الموافقات السابقة أولاً: {roles}').replace(/\{roles\}/g, pendingRoles));
                return;
            }
        }

        // تعيين علامة المعالجة
        this[`_processing_${actionKey}`] = true;

        let comments = approval.comments || '';
        if (action === 'rejected') {
            const reason = prompt(this._t('module.ptw.approval.rejectPrompt', 'أدخل سبب الرفض (اختياري):'), comments);
            if (reason === null) {
                // إلغاء العملية - إزالة علامة المعالجة
                this[`_processing_${actionKey}`] = false;
                return;
            }
            comments = reason.trim();
        }

        Loading.show();
        try {
            // تحديث حالة الاعتماد
            approval.status = action === 'approved' ? 'approved' : 'rejected';
            approval.approved = action === 'approved';
            approval.rejected = action === 'rejected';
            approval.date = new Date().toISOString();
            approval.comments = comments;
            
            if (AppState.currentUser) {
                approval.approver = AppState.currentUser.name || approval.approver || '';
                approval.approverEmail = AppState.currentUser.email || approval.approverEmail || '';
                approval.approverId = AppState.currentUser.id || approval.approverId || '';
            }
            
            approval.history = Array.isArray(approval.history) ? approval.history : [];
            approval.history.push(ApprovalCircuits.buildHistoryEntry(action === 'approved' ? 'approved' : 'rejected', {
                performedBy: ApprovalCircuits.buildUserSnapshot(AppState.currentUser),
                comments,
                status: approval.status,
                timestamp: new Date().toISOString()
            }));

            // تحديث حالة التصريح بناءً على الاعتمادات
            this.updatePermitStatus(permit);
            permit.updatedAt = new Date().toISOString();

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            
            // حفظ في Google Sheets في الخلفية
            GoogleIntegration.autoSave('PTW', AppState.appData.ptw).catch(error => {
                Utils.safeError('خطأ في حفظ Google Sheets:', error);
            });

            if (action === 'approved') {
                const nextApproval = this.getNextPendingApproval(permit.approvals);
                if (permit.status === 'موافق عليه') {
                    Notification.success(this._t('module.ptw.notify.permAllApproved', 'تم اعتماد تصريح العمل بشكل نهائي بعد موافقة جميع الموافقات المطلوبة.'));
                } else {
                    const r1 = this.approvalRoleLabel(approval.role);
                    Notification.success(this._t('module.ptw.notify.stageApproved', 'تم اعتماد مرحلة "{r}".').replace(/\{r\}/g, r1));
                    if (nextApproval && nextApproval.role) {
                        const r2 = this.approvalRoleLabel(nextApproval.role);
                        Notification.info(this._t('module.ptw.notify.nextRole', 'المرحلة التالية بانتظار الاعتماد: {r}').replace(/\{r\}/g, r2));
                    } else {
                        Notification.info(this._t('module.ptw.notify.allStages', 'جميع المراحل المطلوبة تم اعتمادها.'));
                    }
                }
            } else {
                const rj = this.approvalRoleLabel(approval.role);
                Notification.error(this._t('module.ptw.notify.rejectedBy', 'تم رفض تصريح العمل من قبل "{r}".').replace(/\{r\}/g, rj));
                if (comments) {
                    Notification.info(this._t('module.ptw.notify.rejectionReason', 'سبب الرفض: {c}').replace(/\{c\}/g, comments));
                }
            }

            this.triggerNotificationsUpdate();
            this.loadPTWList();

            // تحديث تبويب التحليل إذا كان مرئياً
            const analysisContent = document.getElementById('ptw-analysis-content');
            if (analysisContent && analysisContent.style.display !== 'none') {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }

            // تحديث تبويب الموافقات إذا كان مرئياً
            const approvalsContent = document.getElementById('ptw-approvals-content');
            if (approvalsContent && approvalsContent.style.display !== 'none') {
                setTimeout(() => {
                    this.refreshApprovalsContent();
                }, 300);
            }

            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
                // إعادة فتح الـ modal مع البيانات المحدثة
                setTimeout(() => {
                    this.viewPTW(id);
                }, 100);
            }
        } catch (error) {
            Utils.safeError('خطأ أثناء معالجة الاعتماد:', error);
            Notification.error(this._t('module.ptw.notify.approvalUpdateErr', 'حدث خطأ أثناء تحديث حالة الاعتماد'));
        } finally {
            // إزالة علامة المعالجة
            this[`_processing_${actionKey}`] = false;
            Loading.hide();
        }
    },

    async assignApproval(id, approvalIndex) {
        const permit = AppState.appData.ptw.find(i => i.id === id);
        if (!permit) {
            Notification.error(this._t('module.ptw.notify.findPermitFail', 'تعذر العثور على تصريح العمل المحدد'));
            return;
        }

        permit.approvals = this.normalizeApprovals(permit.approvals || []);
        const approval = permit.approvals[approvalIndex];
        if (!approval) {
            Notification.error(this._t('module.ptw.notify.approvalItemMissing', 'عنصر الاعتماد غير موجود'));
            return;
        }

        const selectEl = document.getElementById(`approval-assign-${id}-${approvalIndex}`);
        if (!selectEl) {
            Notification.error(this._t('module.ptw.notify.cannotFindAssignee', 'تعذر تحديد خانة التعيين'));
            return;
        }

        const selectedId = selectEl.value;
        if (!selectedId) {
            Notification.warning(this._t('module.ptw.notify.selectApprover', 'يرجى اختيار المستخدم المسؤول عن هذا الاعتماد.'));
            return;
        }

        const user = ApprovalCircuits.getUserById(selectedId);
        if (!user) {
            Notification.error(this._t('module.ptw.notify.userNotInSystem', 'المستخدم المحدد غير موجود في النظام.'));
            return;
        }

        Loading.show();
        try {
            approval.approverId = user.id || user.email || '';
            approval.approver = user.name || user.email || '';
            approval.approverEmail = user.email || '';
            approval.assignedAt = new Date().toISOString();
            approval.assignedBy = ApprovalCircuits.buildUserSnapshot(AppState.currentUser);
            approval.history = Array.isArray(approval.history) ? approval.history : [];
            approval.history.push(ApprovalCircuits.buildHistoryEntry('assigned', {
                assignedBy: approval.assignedBy,
                assignedTo: ApprovalCircuits.buildUserSnapshot(user)
            }));

            this.updatePermitStatus(permit);
            permit.updatedAt = new Date().toISOString();

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            await GoogleIntegration.autoSave('PTW', AppState.appData.ptw);

            Notification.success(this._t('module.ptw.notify.assignedTo', 'تم توجيه الاعتماد إلى {name}.').replace(/\{name\}/g, approval.approver || ''));
            this.triggerNotificationsUpdate();
            this.loadPTWList();

            // تحديث تبويب التحليل إذا كان مرئياً
            const analysisContent = document.getElementById('ptw-analysis-content');
            if (analysisContent && analysisContent.style.display !== 'none') {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }

            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
                this.viewPTW(id);
            }
        } catch (error) {
            Utils.safeError('خطأ أثناء تعيين الموافقة:', error);
            Notification.error(this._t('module.ptw.notify.assignErr', 'حدث خطأ أثناء تعيين المسؤول عن الاعتماد'));
        } finally {
            Loading.hide();
        }
    },


    async deletePTW(id) {
        if (!confirm(this._t('module.ptw.notify.deletePtwShort', 'هل أنت متأكد من حذف هذا التصريح؟'))) return;
        Loading.show();
        try {
            // حذف من السجل تلقائياً
            await this.removeFromRegistry(id);

            AppState.appData.ptw = AppState.appData.ptw.filter(i => i.id !== id);
            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            // حظ تلقائي ي Google Sheets
            await GoogleIntegration.autoSave('PTW', AppState.appData.ptw);
            Loading.hide();
            Notification.success(this._t('module.ptw.notify.deleted', 'تم حذف التصريح بنجاح'));
            this.updateKPIs(); // تحديث KPIs بعد الحذف
            this.loadPTWList();
            this.triggerNotificationsUpdate();

            // تحديث تبويب التحليل إذا كان مرئياً
            const analysisContent = document.getElementById('ptw-analysis-content');
            if (analysisContent && analysisContent.style.display !== 'none') {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }
        } catch (error) {
            Notification.error(this._t('module.ptw.notify.errorGeneric', 'حدث خطأ: ') + error.message);

            // استعادة الزر في حالة الخطأ
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    },

    async exportPDF(id) {
        const reg = Array.isArray(this.registryData)
            ? this.registryData.find((r) => r.permitId === id || r.id === id)
            : null;
        const effectiveId = reg?.permitId || id;
        let item = AppState.appData.ptw.find((i) => i.id === effectiveId);
        if (!item && reg && reg.isManualEntry) {
            item = {
                id: effectiveId,
                isManualEntry: true,
                createdAt: reg.createdAt,
                updatedAt: reg.updatedAt,
                startDate: reg.timeFrom,
                endDate: reg.timeTo,
                version: '1.0'
            };
        }
        if (!item) {
            Notification.error(this._t('module.ptw.notify.permitNotFound', 'لم يتم العثور على التصريح'));
            return;
        }

        try {
            Loading.show();

            const registryEntry = reg || this.registryData.find((r) => r.permitId === item.id);
            const formCode = item.isoCode || `PTW-${item.id?.substring(0, 8) || 'UNKNOWN'}`;
            const formData = this.getPermitFormDataForPrint(item);
            const content = this.generatePrintContent(formData);

            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(
                    formCode,
                    `تصريح عمل #${registryEntry?.sequentialNumber || item.id?.substring(0, 8)}`,
                    content,
                    false,
                    false,
                    {
                        version: item.version || '1.0',
                        releaseDate: item.startDate || item.createdAt,
                        revisionDate: item.updatedAt || item.endDate || item.startDate,
                        'رقم التصريح': registryEntry?.sequentialNumber || item.id?.substring(0, 8)
                    },
                    item.createdAt || item.startDate,
                    item.updatedAt || item.endDate || item.createdAt
                )
                : `<html><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            Loading.hide();
                            Notification.success(this._t('module.ptw.notify.pdfViewReady', 'تم فتح التصريح للطباعة أو الحفظ كملف PDF'));
                        }, 1000);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error(this._t('module.ptw.notify.popupsViewPtw', 'يرجى السماح للنوافذ المنبثقة لعرض التصريح'));
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            const unk = this._t('module.ptw.notify.unknownError', 'خطأ غير معروف');
            Notification.error(this._t('module.ptw.notify.pdfErr', 'فشل تصدير PDF: ') + (error && error.message ? error.message : unk));
        }
    },

    initMapFilters() {
        // إعدادات أحداث إعدادات الخريطة
        this.setupMapSettingsEventListeners();
        ['ptw-map-filter-status', 'ptw-map-filter-type'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => this.updateMapUI());
            }
        });

        // أحداث أزرار نوع الخريطة
        const normalBtn = document.getElementById('ptw-map-type-normal');
        const satelliteBtn = document.getElementById('ptw-map-type-satellite');
        const terrainBtn = document.getElementById('ptw-map-type-terrain');
        const fullscreenBtn = document.getElementById('ptw-map-fullscreen-btn');

        if (normalBtn) {
            normalBtn.addEventListener('click', () => this.switchMapType('normal'));
        }
        if (satelliteBtn) {
            satelliteBtn.addEventListener('click', () => this.switchMapType('satellite'));
        }
        if (terrainBtn) {
            terrainBtn.addEventListener('click', () => this.switchMapType('terrain'));
        }
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
    },

    updateMapUI() {
        // التأكد من أننا في تبويب الخريطة فقط
        if (this.currentTab !== 'map') {
            return;
        }

        if (!this.mapInstance || typeof L === 'undefined') return;

        // Clear existing markers
        this.mapMarkers.forEach(marker => marker.remove());
        this.mapMarkers = [];

        const statusFilter = document.getElementById('ptw-map-filter-status')?.value;
        const typeFilter = document.getElementById('ptw-map-filter-type')?.value;

        const items = AppState.appData.ptw || [];
        const filteredItems = items.filter(item => {
            if (statusFilter && item.status !== statusFilter) return false;
            if (typeFilter && item.workType !== typeFilter) return false;
            return true;
        });

        const bounds = L.latLngBounds();
        let hasValidLocations = false;

        // Helper to find site and coordinates
        const findSite = (id, name) => {
            // البحث أولاً في إعدادات الخريطة (الأولوية الأولى)
            const mapSites = this.getMapSites();
            const mapSite = mapSites.find(s =>
                (s.id === id || s.name === name) && s.latitude && s.longitude
            );
            if (mapSite) {
                return {
                    coordinates: {
                        lat: parseFloat(mapSite.latitude),
                        lng: parseFloat(mapSite.longitude)
                    }
                };
            }

            const sources = [
                (typeof Permissions !== 'undefined' ? Permissions?.formSettingsState?.sites : null),
                AppState?.appData?.observationSites,
                (typeof DailyObservations !== 'undefined' ? DailyObservations.DEFAULT_SITES : [])
            ];

            for (const source of sources) {
                if (Array.isArray(source)) {
                    const found = source.find(s =>
                        (s.id && (s.id === id || s.id == id)) ||
                        (s.name && s.name === name) ||
                        (s.title && s.title === name) ||
                        (s.label && s.label === name)
                    );
                    if (found) return found;
                }
            }
            return null;
        };

        filteredItems.forEach(item => {
            let lat, lng;

            // 1. Try to find coordinates in the item itself
            if (item.coordinates && item.coordinates.lat && item.coordinates.lng) {
                lat = parseFloat(item.coordinates.lat);
                lng = parseFloat(item.coordinates.lng);
            } else {
                // 2. Lookup site
                const site = findSite(item.siteId, item.siteName || item.location);
                if (site) {
                    if (site.lat && site.lng) {
                        lat = parseFloat(site.lat);
                        lng = parseFloat(site.lng);
                    } else if (site.coordinates && site.coordinates.lat) {
                        lat = parseFloat(site.coordinates.lat);
                        lng = parseFloat(site.coordinates.lng);
                    }
                }
            }

            // Only map if we have valid coordinates
            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                hasValidLocations = true;
                const markerColor = this.getMarkerColor(item.status);

                // Create a custom icon with color
                const iconHtml = `<div style="background-color: ${markerColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`;
                const customIcon = L.divIcon({
                    html: iconHtml,
                    className: 'ptw-map-marker',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                    popupAnchor: [0, -9]
                });

                const marker = L.marker([lat, lng], { icon: customIcon })
                    .bindPopup(this.createMapPopup(item));

                marker.addTo(this.mapInstance);
                this.mapMarkers.push(marker);
                bounds.extend([lat, lng]);
            }
        });

        if (hasValidLocations) {
            this.mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        } else {
            // Default view if no markers
            this.mapInstance.setView([30.0444, 31.2357], 6);
        }
    },

    getMarkerColor(status) {
        switch (status) {
            case 'موافق عليه': return '#10b981'; // green
            case 'قيد المراجعة': return '#3b82f6'; // blue
            case 'مغلق': return '#6b7280'; // gray
            case 'مرفوض': return '#ef4444'; // red
            default: return '#f59e0b'; // orange/warning
        }
    },

    createMapPopup(item) {
        const escape = Utils.escapeHTML;
        return `
            <div class="ptw-map-popup p-2" style="min-width: 200px; text-align: right;">
                <h4 class="font-bold text-gray-800 mb-1 border-b pb-1 text-sm">${escape(item.workType || 'غير محدد')}</h4>
                <div class="text-xs text-gray-600 space-y-1 my-2">
                    <div class="flex justify-between"><span>${escape(item.siteName || item.location || '-')}</span> <span class="font-semibold text-gray-500">:الموقع</span></div>
                    <div class="flex justify-between"><span>${item.startDate ? Utils.formatDate(item.startDate) : '-'}</span> <span class="font-semibold text-gray-500">:التاريخ</span></div>
                    <div class="flex justify-between items-center">
                        <span class="badge badge-${this.getStatusBadgeClass(item.status)} px-1 py-0 text-[10px]">${item.status}</span>
                        <span class="font-semibold text-gray-500">:الحالة</span> 
                    </div>
                </div>
                <div class="mt-2 text-center pt-2 border-t border-gray-100">
                    <button onclick="PTW.viewPTW('${item.id}')" class="text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors">
                        عرض التفاصيل
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * التبديل بين أنواع الخرائط
     */
    switchMapType(type) {
        if (!this.mapInstance) return;

        this.currentMapType = type;

        // تحديث أزرار الواجهة
        const normalBtn = document.getElementById('ptw-map-type-normal');
        const satelliteBtn = document.getElementById('ptw-map-type-satellite');
        const terrainBtn = document.getElementById('ptw-map-type-terrain');

        [normalBtn, satelliteBtn, terrainBtn].forEach(btn => {
            if (btn) {
                try {
                    btn.classList.remove('bg-blue-500', 'text-white', 'shadow-sm');
                    btn.classList.add('text-gray-700', 'hover:bg-gray-100');
                } catch (e) {
                    // تجاهل أخطاء المتصفح extensions
                }
            }
        });

        if (this.mapType === 'google') {
            // Google Maps
            try {
                let mapTypeId;
                switch (type) {
                    case 'satellite':
                        mapTypeId = google.maps.MapTypeId.SATELLITE;
                        if (satelliteBtn) {
                            try {
                                satelliteBtn.classList.add('bg-blue-500', 'text-white', 'shadow-sm');
                                satelliteBtn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                            } catch (e) {
                                // تجاهل أخطاء المتصفح extensions
                            }
                        }
                        break;
                    case 'terrain':
                        mapTypeId = google.maps.MapTypeId.TERRAIN;
                        if (terrainBtn) {
                            try {
                                terrainBtn.classList.add('bg-blue-500', 'text-white', 'shadow-sm');
                                terrainBtn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                            } catch (e) {
                                // تجاهل أخطاء المتصفح extensions
                            }
                        }
                        break;
                    default:
                        mapTypeId = google.maps.MapTypeId.ROADMAP;
                        if (normalBtn) {
                            try {
                                normalBtn.classList.add('bg-blue-500', 'text-white', 'shadow-sm');
                                normalBtn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                            } catch (e) {
                                // تجاهل أخطاء المتصفح extensions
                            }
                        }
                }
                this.mapInstance.setMapTypeId(mapTypeId);
            } catch (error) {
                // تجاهل أخطاء المتصفح extensions
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تبديل نوع الخريطة (Google Maps):', error);
                }
            }
        } else if (this.mapType === 'leaflet') {
            // Leaflet - التأكد من وجود الطبقات (قد تكون null بعد destroyMap)
            if (!this.leafletLayers) return;
            requestAnimationFrame(() => {
                try {
                    if (!this.mapInstance || !this.leafletLayers) return;
                    // إزالة جميع الطبقات
                    try {
                        if (this.leafletLayers.normal && this.mapInstance.hasLayer(this.leafletLayers.normal)) {
                            this.mapInstance.removeLayer(this.leafletLayers.normal);
                        }
                    } catch (e) {
                        // تجاهل أخطاء المتصفح extensions
                    }
                    
                    try {
                        if (this.leafletLayers.satellite && this.mapInstance.hasLayer(this.leafletLayers.satellite)) {
                            this.mapInstance.removeLayer(this.leafletLayers.satellite);
                        }
                    } catch (e) {
                        // تجاهل أخطاء المتصفح extensions
                    }
                    
                    try {
                        if (this.leafletLayers.terrain && this.mapInstance.hasLayer(this.leafletLayers.terrain)) {
                            this.mapInstance.removeLayer(this.leafletLayers.terrain);
                        }
                    } catch (e) {
                        // تجاهل أخطاء المتصفح extensions
                    }

                    // إضافة الطبقة المختارة
                    switch (type) {
                        case 'satellite':
                            if (this.leafletLayers.satellite) {
                                try {
                                    this.leafletLayers.satellite.addTo(this.mapInstance);
                                    if (satelliteBtn) {
                                        try {
                                            satelliteBtn.classList.add('bg-blue-500', 'text-white', 'shadow-sm');
                                            satelliteBtn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                        } catch (e) {
                                            // تجاهل أخطاء المتصفح extensions
                                        }
                                    }
                                } catch (e) {
                                    // تجاهل أخطاء المتصفح extensions
                                }
                            }
                            break;
                        case 'terrain':
                            if (this.leafletLayers.terrain) {
                                try {
                                    this.leafletLayers.terrain.addTo(this.mapInstance);
                                    if (terrainBtn) {
                                        try {
                                            terrainBtn.classList.add('bg-blue-500', 'text-white', 'shadow-sm');
                                            terrainBtn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                        } catch (e) {
                                            // تجاهل أخطاء المتصفح extensions
                                        }
                                    }
                                } catch (e) {
                                    // تجاهل أخطاء المتصفح extensions
                                }
                            }
                            break;
                        default:
                            if (this.leafletLayers.normal) {
                                try {
                                    this.leafletLayers.normal.addTo(this.mapInstance);
                                    if (normalBtn) {
                                        try {
                                            normalBtn.classList.add('bg-blue-500', 'text-white', 'shadow-sm');
                                            normalBtn.classList.remove('text-gray-700', 'hover:bg-gray-100');
                                        } catch (e) {
                                            // تجاهل أخطاء المتصفح extensions
                                        }
                                    }
                                } catch (e) {
                                    // تجاهل أخطاء المتصفح extensions
                                }
                            }
                    }
                } catch (error) {
                    // تجاهل أخطاء المتصفح extensions
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ خطأ في تبديل نوع الخريطة (Leaflet):', error);
                    }
                }
            });
        }

        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog(`✅ تم التبديل إلى نوع الخريطة: ${type}`);
        }
    },

    /**
     * تبديل وضع ملء الشاشة
     */
    toggleFullscreen() {
        const mapContent = document.getElementById('ptw-map-content');
        const fullscreenBtn = document.getElementById('ptw-map-fullscreen-btn');
        
        if (!mapContent) return;

        if (!this.isFullscreen) {
            // الدخول إلى وضع ملء الشاشة
            if (mapContent.requestFullscreen) {
                mapContent.requestFullscreen();
            } else if (mapContent.webkitRequestFullscreen) {
                mapContent.webkitRequestFullscreen();
            } else if (mapContent.msRequestFullscreen) {
                mapContent.msRequestFullscreen();
            }
            this.isFullscreen = true;
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fas fa-compress ml-2"></i>';
                fullscreenBtn.title = 'الخروج من ملء الشاشة';
            }
        } else {
            // الخروج من وضع ملء الشاشة
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.isFullscreen = false;
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fas fa-expand ml-2"></i>';
                fullscreenBtn.title = 'ملء الشاشة';
            }
        }

        // تحديث حجم الخريطة بعد التبديل
        setTimeout(() => {
            if (this.mapInstance) {
                if (this.mapType === 'leaflet' && this.mapInstance.invalidateSize) {
                    this.mapInstance.invalidateSize();
                } else if (this.mapType === 'google' && typeof google !== 'undefined' && google.maps && google.maps.event && this.mapInstance) {
                    google.maps.event.trigger(this.mapInstance, 'resize');
                }
            }
        }, 300);
    },

    /**
     * خلية جدول القائمة: معرّف مسار الاعتماد والاسم الظاهر (تصريح يدوي: __manual__ + Manual Entry)
     */
    formatPermitApprovalSourceCell(item) {
        if (!item) return '<span class="text-gray-400 text-sm">—</span>';
        const owner = String(item.approvalCircuitOwnerId || '').trim();
        const name = String(item.approvalCircuitName || '').trim();
        const manual =
            item.isManualEntry === true
            || item.skipApprovalFlow === true
            || owner === '__manual__';
        if (manual) {
            const nameLine = name || 'Manual Entry';
            return `
                <div class="ptw-approval-source-cell text-xs text-right leading-snug" dir="ltr">
                    <div class="font-mono text-gray-600">__manual__</div>
                    <div class="text-gray-800 font-medium" dir="auto">${Utils.escapeHTML(nameLine)}</div>
                </div>`;
        }
        if (name) {
            return `<div class="text-xs text-gray-800">${Utils.escapeHTML(name)}</div>`;
        }
        if (owner && owner !== '__default__') {
            return `<div class="text-xs font-mono text-gray-600" dir="ltr">${Utils.escapeHTML(owner)}</div>`;
        }
        return '<span class="text-gray-400 text-sm">—</span>';
    },

    /**
     * دمج التصاريح من القائمة والسجل للاستخدام في الفلتر والعرض
     */
    getMergedPermitsForFilter() {
        const permitsFromList = AppState.appData.ptw || [];
        const permitsFromRegistry = (this.registryData || []).map(registryEntry => ({
            id: registryEntry.permitId || registryEntry.id,
            workType: Array.isArray(registryEntry.permitType)
                ? (registryEntry.permitTypeDisplay || registryEntry.permitType.join('، '))
                : (registryEntry.permitType || registryEntry.permitTypeDisplay),
            location: registryEntry.location,
            siteName: registryEntry.location,
            sublocation: registryEntry.sublocation,
            sublocationName: registryEntry.sublocation,
            startDate: registryEntry.openDate,
            endDate: registryEntry.timeTo,
            status: registryEntry.status,
            workDescription: registryEntry.workDescription,
            requestingParty: registryEntry.requestingParty,
            authorizedParty: registryEntry.authorizedParty,
            approvals: [],
            createdAt: registryEntry.createdAt,
            updatedAt: registryEntry.updatedAt,
            isFromRegistry: true,
            isManualEntry: registryEntry.isManualEntry === true || registryEntry.isManualEntry === 'true',
            skipApprovalFlow: registryEntry.skipApprovalFlow === true || registryEntry.isManualEntry === true || registryEntry.isManualEntry === 'true',
            approvalCircuitOwnerId: registryEntry.approvalCircuitOwnerId || ((registryEntry.isManualEntry === true || registryEntry.isManualEntry === 'true') ? '__manual__' : undefined),
            approvalCircuitName: registryEntry.approvalCircuitName || ((registryEntry.isManualEntry === true || registryEntry.isManualEntry === 'true') ? 'Manual Entry' : undefined),
            sequentialNumber: registryEntry.sequentialNumber,
            paperPermitNumber: registryEntry.paperPermitNumber
        }));
        return this.mergePermitsPreferRegistry(permitsFromList, permitsFromRegistry);
    },

    /**
     * تحديث خيارات المكان الفرعي حسب الموقع المحدد (المكان الفرعي مرتبط بالموقع)
     */
    updateSublocationFilterOptions() {
        const locationSelect = document.getElementById('ptw-filter-location');
        const sublocationSelect = document.getElementById('ptw-filter-sublocation');
        if (!sublocationSelect || !locationSelect) return;
        const allPermits = this.getMergedPermitsForFilter();
        const selectedLocation = (locationSelect.value || '').trim();
        let sublocations = [];
        if (selectedLocation) {
            const forLocation = allPermits.filter(p => ((p.siteName || p.location || '').trim()) === selectedLocation);
            sublocations = [...new Set(forLocation.map(p => (p.sublocationName || p.sublocation || '').trim()).filter(Boolean))].sort();
        } else {
            sublocations = [...new Set(allPermits.map(p => (p.sublocationName || p.sublocation || '').trim()).filter(Boolean))].sort();
        }
        const currentValue = sublocationSelect.value;
        sublocationSelect.innerHTML = '<option value="">الكل</option>' + sublocations.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('');
        if (sublocations.includes(currentValue)) sublocationSelect.value = currentValue;
        else sublocationSelect.value = '';
    },

    filterItems() {
        const searchTerm = (document.getElementById('ptw-search')?.value || '').trim();
        const statusFilter = (document.getElementById('ptw-filter-status')?.value || '').trim();
        const workTypeFilter = (document.getElementById('ptw-filter-work-type')?.value || '').trim();
        const locationFilter = (document.getElementById('ptw-filter-location')?.value || '').trim();
        const sublocationFilter = (document.getElementById('ptw-filter-sublocation')?.value || '').trim();
        const dateFrom = (document.getElementById('ptw-filter-date-from')?.value || '').trim();
        const dateTo = (document.getElementById('ptw-filter-date-to')?.value || '').trim();

        let filtered = this.getMergedPermitsForFilter();

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                item.workType?.toLowerCase().includes(term) ||
                item.workDescription?.toLowerCase().includes(term) ||
                item.location?.toLowerCase().includes(term) ||
                item.siteName?.toLowerCase().includes(term) ||
                item.sublocation?.toLowerCase().includes(term) ||
                item.sublocationName?.toLowerCase().includes(term) ||
                item.requestingParty?.toLowerCase().includes(term) ||
                item.authorizedParty?.toLowerCase().includes(term) ||
                String(item.approvalCircuitOwnerId || '').toLowerCase().includes(term) ||
                String(item.approvalCircuitName || '').toLowerCase().includes(term)
            );
        }
        if (statusFilter) filtered = filtered.filter(item => (item.status || '').trim() === statusFilter);
        if (workTypeFilter) filtered = filtered.filter(item => (item.workType || '').trim() === workTypeFilter);
        if (locationFilter) filtered = filtered.filter(item => ((item.siteName || item.location || '').trim()) === locationFilter);
        if (sublocationFilter) filtered = filtered.filter(item => ((item.sublocationName || item.sublocation || '').trim()) === sublocationFilter);
        if (dateFrom) {
            filtered = filtered.filter(item => {
                const d = item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '';
                return d >= dateFrom;
            });
        }
        if (dateTo) {
            filtered = filtered.filter(item => {
                const d = item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '';
                return d <= dateTo;
            });
        }
        const tbody = document.querySelector('#ptw-table-container tbody');
        if (tbody) {
            tbody.innerHTML = filtered.length === 0 ?
                '<tr><td colspan="8" class="text-center text-gray-500 py-8">لا توجد نتائج</td></tr>' :
                filtered.map(item => {
                    const skipApprovalUi = item.isManualEntry === true
                        || item.skipApprovalFlow === true
                        || String(item.approvalCircuitOwnerId || '').trim() === '__manual__';
                    let approvedCount;
                    let totalCount;
                    if (skipApprovalUi) {
                        // تصريح يدوي: دائرة الاعتمادات مكتملة من النموذج (3/3) — لا نستخدم normalizeApprovals([]) لأنه يحقن 3 خطوات غير معتمدة
                        totalCount = 3;
                        approvedCount = 3;
                    } else {
                        const approvals = this.normalizeApprovals(item.approvals || []);
                        const requiredApprovals = approvals.filter(a => a.required !== false);
                        approvedCount = requiredApprovals.filter(a => a.status === 'approved').length;
                        totalCount = requiredApprovals.length;
                    }

                    return `
                    <tr>
                        <td>${Utils.escapeHTML(item.workType || '')}</td>
                        <td>${Utils.escapeHTML(item.siteName || item.location || '')}</td>
                        <td>${Utils.escapeHTML(item.sublocationName || item.sublocation || '-')}</td>
                        <td>${item.startDate ? Utils.formatDate(item.startDate) : '-'}</td>
                        <td>${item.endDate ? Utils.formatDate(item.endDate) : '-'}</td>
                        <td>
                            <span class="badge badge-${approvedCount === totalCount && totalCount > 0 ? 'success' : 'warning'}">
                                ${totalCount > 0 ? `${approvedCount}/${totalCount}` : '—'}
                            </span>
                            <br>
                            <span class="badge badge-${this.getStatusBadgeClass(item.status)}">
                                ${Utils.escapeHTML(item.status || '-')}
                            </span>
                        </td>
                        <td class="align-top">${this.formatPermitApprovalSourceCell(item)}</td>
                        <td>
                            <div class="flex items-center gap-2">
                                <button onclick="PTW.viewPTW('${item.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button onclick="PTW.exportPDF('${item.id}')" class="btn-icon btn-icon-success" title="تصدير PDF">
                                    <i class="fas fa-file-pdf"></i>
                                </button>
                                <button onclick="PTW.editPTW('${item.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="PTW.deletePTW('${item.id}')" class="btn-icon btn-icon-danger" title="حذف">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                }).join('');
        }

        const countEl = document.getElementById('ptw-filter-count');
        if (countEl) {
            countEl.textContent = String(filtered.length);
        }

        // تحديث KPIs بعد التصفية
        this.updateKPIs();
    },

    /**
     * عرض محتوى تحليل البيانات
     */
    renderAnalysisContent() {
        // التأكد من إخفاء الخريطة في تبويب التحليل بشكل كامل
        const mapContent = document.getElementById('ptw-map-content');
        if (mapContent) {
            mapContent.style.display = 'none';
            mapContent.style.visibility = 'hidden';
            mapContent.style.opacity = '0';
            mapContent.style.position = 'absolute';
            mapContent.style.left = '-9999px';
            mapContent.style.width = '0';
            mapContent.style.height = '0';
            mapContent.style.overflow = 'hidden';
            mapContent.style.pointerEvents = 'none';
            mapContent.style.zIndex = '-1';
        }

        // التأكد من تهيئة بيانات التحليل
        if (!AppState.appData) AppState.appData = {};
        if (!AppState.appData.ptwAnalysis) {
            AppState.appData.ptwAnalysis = [];
        }

        const analysisData = AppState.appData.ptwAnalysis || [];

        // دمج بيانات التصاريح من كلا المصدرين: AppState.appData.ptw و registryData
        const permitsFromList = AppState.appData.ptw || [];
        const permitsFromRegistry = (this.registryData || []).map(registryEntry => {
            // تحويل سجل التصريح إلى تنسيق التصريح للتوافق
            return {
                id: registryEntry.permitId || registryEntry.id,
                workType: Array.isArray(registryEntry.permitType)
                    ? registryEntry.permitTypeDisplay || registryEntry.permitType.join('، ')
                    : registryEntry.permitType || registryEntry.permitTypeDisplay,
                location: registryEntry.location,
                siteName: registryEntry.location,
                sublocation: registryEntry.sublocation,
                sublocationName: registryEntry.sublocation,
                startDate: registryEntry.openDate,
                endDate: registryEntry.timeTo,
                status: registryEntry.status,
                requestingParty: registryEntry.requestingParty,
                authorizedParty: registryEntry.authorizedParty,
                workDescription: registryEntry.workDescription,
                createdAt: registryEntry.createdAt,
                updatedAt: registryEntry.updatedAt,
                isFromRegistry: true // علامة للتمييز
            };
        });

        const allPermits = this.mergePermitsPreferRegistry(permitsFromList, permitsFromRegistry);

        // إحصائيات التحليل (مطابقة لحالات التصاريح الفعلية)
        const totalPermits = allPermits.length;
        const openPermits = allPermits.filter(p => this.isPermitOpenStatus(p?.status)).length;
        const closedPermits = allPermits.filter(p => this.isPermitClosedStatus(p?.status)).length;
        const approvedPermits = allPermits.filter(p => (p.status || '').trim() === 'موافق عليه').length;
        const pendingPermits = allPermits.filter(p => p?.isManualEntry !== true && (p.status || '').trim() === 'قيد المراجعة').length;
        const rejectedPermits = allPermits.filter(p => (p.status || '').trim() === 'مرفوض').length;
        const closureRate = totalPermits > 0 ? ((closedPermits / totalPermits) * 100).toFixed(1) : '0';
        const openRate = totalPermits > 0 ? ((openPermits / totalPermits) * 100).toFixed(1) : '0';
        const approvalRate = totalPermits > 0 ? ((approvedPermits / totalPermits) * 100).toFixed(1) : '0';
        const rejectedRate = totalPermits > 0 ? ((rejectedPermits / totalPermits) * 100).toFixed(1) : '0';
        const sumCheck = openPermits + closedPermits + rejectedPermits;
        const verificationOk = totalPermits === 0 || sumCheck === totalPermits;

        const t = (k, f) => this._t(k, f);

        const workTypeLabels = (p) => {
            const wt = p.workType;
            if (Array.isArray(wt)) return wt.length ? wt : ['أخرى'];
            return wt ? [String(wt)] : ['أخرى'];
        };
        const uniqueWorkTypes = [...new Set(allPermits.flatMap(p => workTypeLabels(p).map(t => (t || '').trim()).filter(Boolean)))].filter(Boolean).sort((a, b) => (a || '').localeCompare(b || '', 'ar'));
        const uniqueAuthorized = [...new Set(allPermits.map(p => (p.authorizedParty || '').trim()).filter(Boolean))].sort((a, b) => (a || '').localeCompare(b || '', 'ar'));
        const uniqueRequesting = [...new Set(allPermits.map(p => (p.requestingParty || '').trim()).filter(Boolean))].sort((a, b) => (a || '').localeCompare(b || '', 'ar'));
        const statusOptions = ['قيد المراجعة', 'موافق عليه', 'مرفوض', 'مغلق', 'اكتمل العمل بشكل آمن', 'إغلاق جبري'];

        return `
            <div class="space-y-6" id="ptw-analysis-root">
                <!-- فلتر التحليل -->
                <div class="content-card border-2 border-indigo-100 bg-indigo-50/30">
                    <div class="card-body">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <i class="fas fa-filter ml-2"></i>
                            ${t('module.ptw.analysis.filterTitle', 'فلتر التحليل')}
                            <span id="ptw-analysis-current-count-badge" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                ${t('module.ptw.analysis.badgeAll', 'إجمالي التصاريح في التحليل: ')}<span id="ptw-analysis-current-count" class="ml-1">${totalPermits}</span>
                            </span>
                        </h3>
                        <p id="ptw-analysis-summary" class="text-xs text-gray-600 mb-3">
                            ${t('module.ptw.analysis.summaryAll', 'لا يوجد أي فلتر مطبق حالياً، يتم عرض تحليل لجميع التصاريح المسجلة ({n} تصريحاً).').replace(/\{n\}/g, String(totalPermits))}
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 ptw-analysis-filter-label" data-filter-id="ptw-analysis-date-from">${t('module.ptw.analysis.fromDate', 'من تاريخ')}</label>
                                <input type="date" id="ptw-analysis-date-from" class="form-input w-full" placeholder="${t('module.ptw.analysis.optional', 'اختياري')}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 ptw-analysis-filter-label" data-filter-id="ptw-analysis-date-to">${t('module.ptw.analysis.toDate', 'إلى تاريخ')}</label>
                                <input type="date" id="ptw-analysis-date-to" class="form-input w-full" placeholder="${t('module.ptw.analysis.optional', 'اختياري')}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 ptw-analysis-filter-label" data-filter-id="ptw-analysis-work-type">${t('module.ptw.analysis.permitType', 'نوع التصريح')}</label>
                                <select id="ptw-analysis-work-type" class="form-input w-full">
                                    <option value="">${t('module.ptw.analysis.all', '— الكل —')}</option>
                                    ${(uniqueWorkTypes.length ? uniqueWorkTypes : ['أعمال ساخنة', 'أماكن مغلقة', 'عمل على ارتفاع', 'أعمال حفر', 'أعمال كهرباء', 'أعمال أخرى']).map(w => `<option value="${Utils.escapeHTML(w)}">${Utils.escapeHTML(w)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 ptw-analysis-filter-label" data-filter-id="ptw-analysis-authorized">${t('module.ptw.analysis.authorized', 'الجهة المصرح لها (مقاول)')}</label>
                                <select id="ptw-analysis-authorized" class="form-input w-full">
                                    <option value="">${t('module.ptw.analysis.all', '— الكل —')}</option>
                                    ${uniqueAuthorized.map(a => `<option value="${Utils.escapeHTML(a)}">${Utils.escapeHTML(a)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 ptw-analysis-filter-label" data-filter-id="ptw-analysis-requesting">${t('module.ptw.analysis.requesting', 'الجهة الطالبة')}</label>
                                <select id="ptw-analysis-requesting" class="form-input w-full">
                                    <option value="">${t('module.ptw.analysis.all', '— الكل —')}</option>
                                    ${uniqueRequesting.map(r => `<option value="${Utils.escapeHTML(r)}">${Utils.escapeHTML(r)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1 ptw-analysis-filter-label" data-filter-id="ptw-analysis-status">${t('module.ptw.analysis.filterStatus', 'الحالة')}</label>
                                <select id="ptw-analysis-status" class="form-input w-full">
                                    <option value="">${t('module.ptw.analysis.all', '— الكل —')}</option>
                                    ${statusOptions.map(s => `<option value="${Utils.escapeHTML(s)}">${Utils.escapeHTML(s)}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2">
                            <button type="button" id="ptw-analysis-apply-filter" class="btn-primary"><i class="fas fa-chart-line ml-2"></i>${t('module.ptw.analysis.apply', 'تطبيق الفلتر')}</button>
                            <button type="button" id="ptw-analysis-reset-filter" class="btn-secondary"><i class="fas fa-undo ml-2"></i>${t('module.ptw.analysis.reset', 'إعادة تعيين')}</button>
                        </div>
                    </div>
                </div>

                <!-- إحصائيات التحليل (تُحدَّث حسب الفلتر) -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="content-card bg-blue-50 border-blue-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.kpiTotal', 'إجمالي التصاريح')}</p>
                                    <p id="ptw-kpi-total" class="text-2xl font-bold text-blue-600">${totalPermits}</p>
                                </div>
                                <i class="fas fa-file-alt text-3xl text-blue-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="content-card bg-amber-50 border-amber-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.kpiOpenExec', 'مفتوحة / قيد التنفيذ')}</p>
                                    <p id="ptw-kpi-open" class="text-2xl font-bold text-amber-600">${openPermits}</p>
                                    <p id="ptw-kpi-open-pct" class="text-xs text-gray-500 mt-1">${t('module.ptw.analysis.pctOfTotal', '{n}% من الإجمالي').replace(/\{n\}/g, String(openRate))}</p>
                                </div>
                                <i class="fas fa-folder-open text-3xl text-amber-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="content-card bg-green-50 border-green-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.kpiClosed', 'مغلقة / مكتملة')}</p>
                                    <p id="ptw-kpi-closed" class="text-2xl font-bold text-green-600">${closedPermits}</p>
                                    <p id="ptw-kpi-closure-pct" class="text-xs text-gray-500 mt-1">${t('module.ptw.analysis.closureShare', '{n}% نسبة الإغلاق').replace(/\{n\}/g, String(closureRate))}</p>
                                </div>
                                <i class="fas fa-check-circle text-3xl text-green-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="content-card bg-purple-50 border-purple-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.kpiApproved', 'موافق عليها')}</p>
                                    <p id="ptw-kpi-approved" class="text-2xl font-bold text-purple-600">${approvedPermits}</p>
                                    <p id="ptw-kpi-approved-pct" class="text-xs text-gray-500 mt-1">${t('module.ptw.analysis.pctOfTotal', '{n}% من الإجمالي').replace(/\{n\}/g, String(approvalRate))}</p>
                                </div>
                                <i class="fas fa-thumbs-up text-3xl text-purple-400"></i>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="content-card bg-yellow-50 border-yellow-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.kpiPending', 'قيد المراجعة')}</p>
                                    <p id="ptw-kpi-pending" class="text-2xl font-bold text-yellow-600">${pendingPermits}</p>
                                </div>
                                <i class="fas fa-clock text-3xl text-yellow-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="content-card bg-red-50 border-red-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.kpiRejected', 'مرفوضة')}</p>
                                    <p id="ptw-kpi-rejected" class="text-2xl font-bold text-red-600">${rejectedPermits}</p>
                                </div>
                                <i class="fas fa-times-circle text-3xl text-red-400"></i>
                            </div>
                        </div>
                    </div>
                    <div class="content-card bg-slate-50 border-slate-200">
                        <div class="card-body">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="text-sm text-gray-600 mb-1">${t('module.ptw.analysis.formulaLabel', 'معادلات التحليل')}</p>
                                    <p id="ptw-kpi-formulas" class="text-xs font-semibold text-slate-700 mb-0.5">${t('module.ptw.analysis.formulaText', 'نسبة الإغلاق = {c}% | المفتوحة = {o}% | المرفوضة = {r}%').replace(/\{c\}/g, String(closureRate)).replace(/\{o\}/g, String(openRate)).replace(/\{r\}/g, String(rejectedRate))}</p>
                                    <p class="text-xs text-gray-500 mt-1 border-t border-slate-200 pt-1">${t('module.ptw.analysis.verify', 'التحقق: إجمالي = مفتوحة + مغلقة + مرفوضة {ok}').replace(/\{ok\}/g, verificationOk ? '✓' : '')}</p>
                                </div>
                                <i class="fas fa-calculator text-2xl text-slate-400"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- الرسوم البيانية -->
                <div class="content-card">
                    <div class="card-body">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4"><i class="fas fa-chart-bar ml-2"></i>${t('module.ptw.analysis.chartsTitle', 'الرسوم البيانية')}</h3>
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div class="bg-white rounded-lg border border-gray-200 p-4">
                                <p class="text-sm font-medium text-gray-700 mb-2">${t('module.ptw.analysis.chartByType', 'توزيع حسب نوع التصريح')}</p>
                                <div class="relative" style="height: 260px;"><canvas id="ptw-chart-work-type"></canvas></div>
                            </div>
                            <div class="bg-white rounded-lg border border-gray-200 p-4">
                                <p class="text-sm font-medium text-gray-700 mb-2">${t('module.ptw.analysis.chartByAuth', 'توزيع حسب الجهة المصرح لها (مقاول)')}</p>
                                <div class="relative" style="height: 260px;"><canvas id="ptw-chart-authorized"></canvas></div>
                            </div>
                            <div class="bg-white rounded-lg border border-gray-200 p-4">
                                <p class="text-sm font-medium text-gray-700 mb-2">${t('module.ptw.analysis.chartByStatus', 'توزيع حسب الحالة')}</p>
                                <div class="relative" style="height: 260px;"><canvas id="ptw-chart-status"></canvas></div>
                            </div>
                            <div class="bg-white rounded-lg border border-gray-200 p-4">
                                <p class="text-sm font-medium text-gray-700 mb-2">${t('module.ptw.analysis.chartTimeline', 'التصاريح عبر الزمن (شهرياً)')}</p>
                                <div class="relative" style="height: 260px;"><canvas id="ptw-chart-timeline"></canvas></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- أزرار الإدارة والتصدير -->
                <div class="flex flex-wrap justify-between items-center gap-3">
                    <h2 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-chart-line ml-2"></i>
                        ${t('module.ptw.analysis.headerTitle', 'تحليل بيانات التصاريح')}
                    </h2>
                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" id="ptw-analysis-export-excel" class="btn-secondary" title="${t('module.ptw.analysis.exportCurrentExcel', 'تصدير التقرير الحالي (حسب الفلتر) إلى Excel')}">
                            <i class="fas fa-file-excel ml-2"></i>
                            ${t('module.ptw.registry.exportExcel', 'تصدير Excel')}
                        </button>
                        <button type="button" id="ptw-analysis-export-pdf" class="btn-secondary" title="${t('module.ptw.analysis.exportCurrentPdf', 'تصدير التقرير الحالي (حسب الفلتر) إلى PDF')}">
                            <i class="fas fa-file-pdf ml-2"></i>
                            ${t('module.ptw.registry.exportPdf', 'تصدير PDF')}
                        </button>
                        <button id="ptw-analysis-add" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            ${t('module.ptw.analysis.addNew', 'إضافة تحليل جديد')}
                        </button>
                    </div>
                </div>

                <!-- جدول التحليلات -->
                <div class="content-card">
                    <div class="card-body">
                        <div class="table-responsive ptw-table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>${t('module.ptw.analysis.tblDate', 'تاريخ التحليل')}</th>
                                        <th>${t('module.ptw.analysis.tblPeriod', 'الفترة')}</th>
                                        <th>${t('module.ptw.analysis.tblWorkType', 'نوع العمل')}</th>
                                        <th>${t('module.ptw.analysis.tblLocation', 'الموقع')}</th>
                                        <th>${t('module.ptw.analysis.tblNotes', 'الملاحظات')}</th>
                                        <th>${t('module.ptw.analysis.tblActions', 'الإجراءات')}</th>
                                    </tr>
                                </thead>
                                <tbody id="ptw-analysis-table-body">
                                    ${analysisData.length === 0 ? `
                                        <tr>
                                            <td colspan="6" class="text-center text-gray-500 py-8">
                                                ${t('module.ptw.analysis.emptyList', 'لا توجد تحليلات مسجلة بعد. اضغط على "إضافة تحليل جديد" لبدء التحليل.')}
                                            </td>
                                        </tr>
                                    ` : analysisData.map(item => {
            const safeId = Utils.escapeHTML(String(item.id || ''));
            const formattedDate = item.analysisDate
                ? (typeof Utils.formatDate === 'function'
                    ? Utils.formatDate(item.analysisDate)
                    : new Date(item.analysisDate).toLocaleDateString('ar-SA'))
                : '-';
            return `
                                        <tr data-analysis-id="${safeId}">
                                            <td>${formattedDate}</td>
                                            <td>${Utils.escapeHTML(item.period || '-')}</td>
                                            <td>${Utils.escapeHTML(item.workType || '-')}</td>
                                            <td>${Utils.escapeHTML(item.location || '-')}</td>
                                            <td class="max-w-xs truncate">${Utils.escapeHTML(item.notes || '-')}</td>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <button onclick="PTW.editAnalysis('${safeId}')" class="btn-icon btn-icon-primary" title="${t('module.ptw.analysis.btnEdit', 'تعديل')}">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button onclick="PTW.deleteAnalysis('${safeId}')" class="btn-icon btn-icon-danger" title="${t('module.ptw.analysis.btnDelete', 'حذف')}">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * جلب قائمة التصاريح المدمجة (القائمة + السجل) للتحليل
     */
    getAnalysisPermits() {
        const permitsFromList = AppState.appData && AppState.appData.ptw ? AppState.appData.ptw : [];
        const permitsFromRegistry = (this.registryData || []).map(registryEntry => ({
            id: registryEntry.permitId || registryEntry.id,
            workType: Array.isArray(registryEntry.permitType) ? (registryEntry.permitTypeDisplay || registryEntry.permitType.join('، ')) : (registryEntry.permitType || registryEntry.permitTypeDisplay),
            location: registryEntry.location,
            siteName: registryEntry.location,
            sublocation: registryEntry.sublocation,
            startDate: registryEntry.openDate,
            endDate: registryEntry.timeTo,
            status: registryEntry.status,
            requestingParty: registryEntry.requestingParty,
            authorizedParty: registryEntry.authorizedParty,
            workDescription: registryEntry.workDescription,
            createdAt: registryEntry.createdAt,
            updatedAt: registryEntry.updatedAt
        }));
        return this.mergePermitsPreferRegistry(permitsFromList, permitsFromRegistry);
    },

    /**
     * تطبيق فلتر التحليل من واجهة المستخدم وإرجاع التصاريح المصفاة
     */
    getFilteredAnalysisPermits() {
        const all = this.getAnalysisPermits();
        const dateFromEl = document.getElementById('ptw-analysis-date-from');
        const dateToEl = document.getElementById('ptw-analysis-date-to');
        const workTypeEl = document.getElementById('ptw-analysis-work-type');
        const authorizedEl = document.getElementById('ptw-analysis-authorized');
        const requestingEl = document.getElementById('ptw-analysis-requesting');
        const statusEl = document.getElementById('ptw-analysis-status');

        const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
        const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value) : null;
        const workType = workTypeEl && workTypeEl.value ? workTypeEl.value.trim() : '';
        const authorized = authorizedEl && authorizedEl.value ? authorizedEl.value.trim() : '';
        const requesting = requestingEl && requestingEl.value ? requestingEl.value.trim() : '';
        const status = statusEl && statusEl.value ? statusEl.value.trim() : '';

        return all.filter(p => {
            const wt = p.workType;
            const types = Array.isArray(wt) ? wt : (wt ? [String(wt)] : []);
            const matchWorkType = !workType || types.some(t => (t || '').trim() === workType);
            const matchAuthorized = !authorized || (p.authorizedParty || '').trim() === authorized;
            const matchRequesting = !requesting || (p.requestingParty || '').trim() === requesting;
            const matchStatus = !status || (p.status || '').trim() === status;
            let dateOk = true;
            if (dateFrom || dateTo) {
                const d = p.startDate || p.openDate || p.createdAt || p.endDate;
                const permitDate = d ? new Date(d) : null;
                if (!permitDate) dateOk = false;
                else {
                    if (dateFrom && permitDate < dateFrom) dateOk = false;
                    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); if (permitDate > end) dateOk = false; }
                }
            }
            return matchWorkType && matchAuthorized && matchRequesting && matchStatus && dateOk;
        });
    },

    /**
     * تحديث مؤشرات الأداء والرسوم البيانية في تبويب التحليل حسب التصاريح المصفاة
     */
    updateAnalysisChartsAndKPIs(permits) {
        const t = (k, f) => this._t(k, f);
        const list = Array.isArray(permits) ? permits : this.getFilteredAnalysisPermits();
        const total = list.length;
        const openPermits = list.filter(p => this.isPermitOpenStatus(p?.status)).length;
        const closedPermits = list.filter(p => this.isPermitClosedStatus(p?.status)).length;
        const approvedPermits = list.filter(p => (p.status || '').trim() === 'موافق عليه').length;
        const pendingPermits = list.filter(p => p?.isManualEntry !== true && (p.status || '').trim() === 'قيد المراجعة').length;
        const rejectedPermits = list.filter(p => (p.status || '').trim() === 'مرفوض').length;
        const closureRate = total > 0 ? ((closedPermits / total) * 100).toFixed(1) : '0';
        const openRate = total > 0 ? ((openPermits / total) * 100).toFixed(1) : '0';
        const approvalRate = total > 0 ? ((approvedPermits / total) * 100).toFixed(1) : '0';
        const rejectedRate = total > 0 ? ((rejectedPermits / total) * 100).toFixed(1) : '0';
        const sumCheck = openPermits + closedPermits + rejectedPermits;
        const verificationOk = total === 0 || sumCheck === total;

        const setEl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setEl('ptw-kpi-total', total);
        setEl('ptw-kpi-open', openPermits);
        setEl('ptw-kpi-open-pct', t('module.ptw.analysis.pctOfTotal', '{n}% من الإجمالي').replace(/\{n\}/g, String(openRate)));
        setEl('ptw-kpi-closed', closedPermits);
        setEl('ptw-kpi-closure-pct', t('module.ptw.analysis.closureShare', '{n}% نسبة الإغلاق').replace(/\{n\}/g, String(closureRate)));
        setEl('ptw-kpi-approved', approvedPermits);
        setEl('ptw-kpi-approved-pct', t('module.ptw.analysis.pctOfTotal', '{n}% من الإجمالي').replace(/\{n\}/g, String(approvalRate)));
        setEl('ptw-kpi-pending', pendingPermits);
        setEl('ptw-kpi-rejected', rejectedPermits);
        setEl('ptw-kpi-formulas', t('module.ptw.analysis.formulaText', 'نسبة الإغلاق = {c}% | المفتوحة = {o}% | المرفوضة = {r}%')
            .replace(/\{c\}/g, String(closureRate)).replace(/\{o\}/g, String(openRate)).replace(/\{r\}/g, String(rejectedRate)));

        const countBadge = document.getElementById('ptw-analysis-current-count');
        if (countBadge) {
            countBadge.textContent = String(total);
        }

        const summaryEl = document.getElementById('ptw-analysis-summary');
        if (summaryEl) {
            if (total === 0) {
                summaryEl.textContent = t('module.ptw.analysis.summaryNoData', 'لا توجد تصاريح مطابقة لمعايير الفلتر الحالية. جرّب توسيع الفترة أو إزالة بعض الفلاتر للحصول على بيانات للتحليل.');
            } else {
                const parts = [];
                const fromVal = document.getElementById('ptw-analysis-date-from')?.value || '';
                const toVal = document.getElementById('ptw-analysis-date-to')?.value || '';
                const wtVal = document.getElementById('ptw-analysis-work-type')?.value || '';
                const authVal = document.getElementById('ptw-analysis-authorized')?.value || '';
                const reqVal = document.getElementById('ptw-analysis-requesting')?.value || '';
                const stVal = document.getElementById('ptw-analysis-status')?.value || '';

                if (fromVal || toVal) {
                    const rangeText = (fromVal && toVal)
                        ? (t('module.ptw.analysis.fromWord', 'من') + ' ' + fromVal + ' ' + t('module.ptw.analysis.toConnector', 'إلى') + ' ' + toVal)
                        : (fromVal ? (t('module.ptw.analysis.fromWord', 'من') + ' ' + fromVal) : (t('module.ptw.analysis.until', 'حتى') + ' ' + toVal));
                    parts.push(t('module.ptw.analysis.range', 'الفترة: ') + rangeText);
                }
                if (wtVal) parts.push(t('module.ptw.analysis.wt', 'نوع التصريح: ') + wtVal);
                if (authVal) parts.push(t('module.ptw.analysis.ap', 'الجهة المصرح لها: ') + authVal);
                if (reqVal) parts.push(t('module.ptw.analysis.rp', 'الجهة الطالبة: ') + reqVal);
                if (stVal) parts.push(t('module.ptw.analysis.st', 'الحالة: ') + stVal);

                const filterText = parts.length ? parts.join(t('module.ptw.analysis.partSep', ' | ')) : t('module.ptw.analysis.noFilters', 'بدون فلاتر (جميع التصاريح)');
                summaryEl.textContent = t('module.ptw.analysis.currentCount', 'عدد التصاريح في الفلتر الحالي: ') + total + t('module.ptw.analysis.filterSep', ' — ') + filterText;
            }
        }

        if (!document.getElementById('ptw-analysis-filter-badge-styles')) {
            const style = document.createElement('style');
            style.id = 'ptw-analysis-filter-badge-styles';
            style.textContent = `
                .ptw-analysis-filter-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 22px;
                    height: 18px;
                    padding: 1px 6px;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: #ffffff;
                    border-radius: 9999px;
                    font-size: 10px;
                    font-weight: 700;
                    margin-right: 4px;
                    margin-left: 4px;
                    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.35);
                }
            `;
            document.head.appendChild(style);
        }

        const filterIds = [
            'ptw-analysis-date-from',
            'ptw-analysis-date-to',
            'ptw-analysis-work-type',
            'ptw-analysis-authorized',
            'ptw-analysis-requesting',
            'ptw-analysis-status'
        ];

        filterIds.forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            const wrapper = input.closest('div');
            if (!wrapper) return;
            const label = wrapper.querySelector('.ptw-analysis-filter-label[data-filter-id="' + id + '"]');
            if (!label) return;

            const existing = label.querySelector('.ptw-analysis-filter-badge');
            if (existing) existing.remove();

            let isActive = false;
            if (input.tagName === 'INPUT') {
                isActive = !!input.value;
            } else if (input.tagName === 'SELECT') {
                isActive = !!input.value;
            }

            if (isActive && total > 0) {
                const badge = document.createElement('span');
                badge.className = 'ptw-analysis-filter-badge';
                badge.title = t('module.ptw.analysis.badgeCountTitle', 'عدد التصاريح المطابقة لهذا الفلتر مع الفلاتر الأخرى');
                badge.textContent = String(total);
                const icon = label.querySelector('i');
                if (icon && icon.nextSibling) {
                    icon.insertAdjacentElement('afterend', badge);
                } else {
                    label.appendChild(badge);
                }
            }
        });

        if (typeof Chart === 'undefined') return;
        const chartIds = ['ptw-chart-work-type', 'ptw-chart-authorized', 'ptw-chart-status', 'ptw-chart-timeline'];
        if (!this.analysisCharts) this.analysisCharts = {};
        chartIds.forEach(id => {
            if (this.analysisCharts[id]) { this.analysisCharts[id].destroy(); this.analysisCharts[id] = null; }
        });

        const workTypeLabels = (p) => { const wt = p.workType; if (Array.isArray(wt)) return wt.length ? wt : ['أخرى']; return wt ? [String(wt)] : ['أخرى']; };
        const workTypeCounts = {};
        list.forEach(p => workTypeLabels(p).forEach(t => { const k = (t || '').trim() || 'أخرى'; workTypeCounts[k] = (workTypeCounts[k] || 0) + 1; }));
        const workTypeData = Object.entries(workTypeCounts).sort((a, b) => b[1] - a[1]);
        const authorizedCounts = {};
        list.forEach(p => { const k = (p.authorizedParty || '').trim() || 'غير محدد'; authorizedCounts[k] = (authorizedCounts[k] || 0) + 1; });
        const authorizedData = Object.entries(authorizedCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
        const statusCounts = {};
        list.forEach(p => { const k = (p.status || '').trim() || 'غير محدد'; statusCounts[k] = (statusCounts[k] || 0) + 1; });
        const statusData = Object.entries(statusCounts);
        const monthCounts = {};
        list.forEach(p => {
            const d = p.startDate || p.openDate || p.createdAt || p.endDate;
            const date = d ? new Date(d) : null;
            const key = date ? (date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')) : 'غير محدد';
            monthCounts[key] = (monthCounts[key] || 0) + 1;
        });
        const monthKeys = Object.keys(monthCounts).filter(k => k !== 'غير محدد').sort();
        const timelineData = monthKeys.map(k => ({ label: k, count: monthCounts[k] }));

        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#f97316'];
        const createPie = (canvasId, labels, values, title) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            this.analysisCharts[canvasId] = new Chart(ctx, {
                type: 'doughnut',
                data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 1 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', rtl: true } } }
            });
        };
        const createBar = (canvasId, labels, values, title) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            this.analysisCharts[canvasId] = new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets: [{ label: t('module.ptw.analysis.chartCount', 'العدد'), data: values, backgroundColor: colors[0], borderColor: '#1d4ed8', borderWidth: 1 }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
            });
        };
        const createLine = (canvasId, labels, values) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            this.analysisCharts[canvasId] = new Chart(ctx, {
                type: 'line',
                data: { labels, datasets: [{ label: t('module.ptw.analysis.permitsPerMonth', 'عدد التصاريح'), data: values, borderColor: colors[0], backgroundColor: colors[0] + '33', fill: true, tension: 0.2 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            });
        };

        if (workTypeData.length) createPie('ptw-chart-work-type', workTypeData.map(([l]) => l), workTypeData.map(([, c]) => c));
        if (authorizedData.length) createBar('ptw-chart-authorized', authorizedData.map(([l]) => l), authorizedData.map(([, c]) => c));
        if (statusData.length) createPie('ptw-chart-status', statusData.map(([l]) => l), statusData.map(([, c]) => c));
        if (timelineData.length) createLine('ptw-chart-timeline', timelineData.map(({ label }) => label), timelineData.map(({ count }) => count));
    },

    /**
     * تصدير تقرير التحليل (حسب الفلتر الحالي) إلى Excel
     */
    exportAnalysisReportToExcel() {
        const list = this.getFilteredAnalysisPermits();
        if (!list || list.length === 0) {
            Notification.warning(this._t('module.ptw.notify.analysisNoExport', 'لا توجد بيانات للتصدير. غيّر الفلتر أو أضف تصاريح.'));
            return;
        }
        const t = (k, f) => this._t(k, f);
        const _lang = (typeof AppState !== 'undefined' && AppState.currentLanguage) || (typeof localStorage !== 'undefined' && localStorage.getItem('language')) || 'ar';
        const _dateLoc = _lang === 'en' ? 'en-GB' : 'ar-EG';
        const formatDate = (d) => {
            if (!d) return '-';
            try { return new Date(d).toLocaleDateString(_dateLoc); } catch (e) { return String(d); }
        };
        const sep = this._t('module.ptw.common.listSep', '، ');
        const workTypeStr = (p) => Array.isArray(p.workType) ? (p.workType || []).join(sep) : (p.workType || '-');
        const kSeq = t('module.ptw.excelColSeq', 'م');
        const kType = t('module.ptw.excelColPermitType', 'نوع التصريح');
        const kReq = t('module.ptw.excelColReq', 'الجهة الطالبة');
        const kAuth = t('module.ptw.excelColAuth', 'الجهة المصرح لها');
        const kLoc = t('module.ptw.excelColLoc', 'الموقع');
        const kDate = t('module.ptw.excelColDate', 'التاريخ');
        const kSt = t('module.ptw.excelColStatus', 'الحالة');
        const kDesc = t('module.ptw.excelColWorkDesc', 'وصف العمل');
        const data = list.map((p, i) => ({
            [kSeq]: i + 1,
            [kType]: workTypeStr(p),
            [kReq]: (p.requestingParty || '-'),
            [kAuth]: (p.authorizedParty || '-'),
            [kLoc]: (p.location || p.siteName || '-'),
            [kDate]: formatDate(p.startDate || p.openDate || p.createdAt),
            [kSt]: this.statusLabel(p.status || '-'),
            [kDesc]: (p.workDescription || '-').toString().slice(0, 200)
        }));
        if (typeof XLSX === 'undefined') {
            Notification.error(this._t('module.ptw.notify.xlsxNoLib', 'مكتبة Excel غير متوفرة'));
            return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        const sheetName = t('module.ptw.excelSheetAnalysis', 'تقرير التحليل');
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const dateFrom = document.getElementById('ptw-analysis-date-from')?.value || '';
        const dateTo = document.getElementById('ptw-analysis-date-to')?.value || '';
        const name = t('module.ptw.excelNameAnalysis', 'تقرير_تحليل_التصاريح_{f}_{t}.xlsx')
            .replace(/\{f\}/g, (dateFrom || t('module.ptw.excelNameAll', 'كل')).replace(/\s/g, '_'))
            .replace(/\{t\}/g, (dateTo || t('module.ptw.excelNameTime', 'الوقت')).replace(/\s/g, '_'));
        XLSX.writeFile(wb, name);
        Notification.success(this._t('module.ptw.notify.analysisExportXlsxOk', 'تم تصدير تقرير التحليل إلى Excel بنجاح'));
    },

    /**
     * تصدير تقرير التحليل (حسب الفلتر الحالي) إلى PDF
     */
    async exportAnalysisReportToPDF() {
        const list = this.getFilteredAnalysisPermits();
        if (!list || list.length === 0) {
            Notification.warning(this._t('module.ptw.notify.analysisNoExport', 'لا توجد بيانات للتصدير. غيّر الفلتر أو أضف تصاريح.'));
            return;
        }
        const t = (k, f) => this._t(k, f);
        const _lang = (typeof AppState !== 'undefined' && AppState.currentLanguage) || (typeof localStorage !== 'undefined' && localStorage.getItem('language')) || 'ar';
        const _dateLoc = _lang === 'en' ? 'en-GB' : 'ar-EG';
        const isRtl = _lang !== 'en';
        const htmlDir = isRtl ? 'rtl' : 'ltr';
        const htmlLang = _lang === 'en' ? 'en' : 'ar';
        const alignMain = isRtl ? 'right' : 'left';
        try {
            Loading.show(t('module.ptw.pdf.exportLoading', 'جاري تصدير التقرير PDF...'));
            const formatDate = (d) => { if (!d) return '-'; try { return new Date(d).toLocaleDateString(_dateLoc); } catch (e) { return String(d); } };
            const sep = this._t('module.ptw.common.listSep', '، ');
            const workTypeStr = (p) => Array.isArray(p.workType) ? (p.workType || []).join(sep) : (p.workType || '-');
            const dateFromEl = document.getElementById('ptw-analysis-date-from');
            const dateToEl = document.getElementById('ptw-analysis-date-to');
            const workTypeEl = document.getElementById('ptw-analysis-work-type');
            const authorizedEl = document.getElementById('ptw-analysis-authorized');
            const requestingEl = document.getElementById('ptw-analysis-requesting');
            const statusEl = document.getElementById('ptw-analysis-status');
            const filterParts = [];
            if (dateFromEl && dateFromEl.value) filterParts.push(t('module.ptw.analysis.fromDate', 'من تاريخ') + ': ' + dateFromEl.value);
            if (dateToEl && dateToEl.value) filterParts.push(t('module.ptw.analysis.toDate', 'إلى تاريخ') + ': ' + dateToEl.value);
            if (workTypeEl && workTypeEl.value) filterParts.push(t('module.ptw.analysis.permitType', 'نوع التصريح') + ': ' + workTypeEl.value);
            if (authorizedEl && authorizedEl.value) filterParts.push(t('module.ptw.analysis.authorized', 'الجهة المصرح لها (مقاول)') + ': ' + authorizedEl.value);
            if (requestingEl && requestingEl.value) filterParts.push(t('module.ptw.analysis.requesting', 'الجهة الطالبة') + ': ' + requestingEl.value);
            if (statusEl && statusEl.value) filterParts.push(t('module.ptw.analysis.filterStatus', 'الحالة') + ': ' + statusEl.value);
            const partSep = t('module.ptw.analysis.partSep', ' | ');
            const filterText = filterParts.length ? filterParts.join(partSep) : t('module.ptw.analysis.noFilters', 'بدون فلتر (جميع التصاريح)');
            const openCount = list.filter(p => { const s = (p.status || '').trim(); return s !== 'مغلق' && s !== 'مرفوض' && s !== 'اكتمل العمل بشكل آمن' && s !== 'إغلاق جبري'; }).length;
            const closedCount = list.filter(p => { const s = (p.status || '').trim(); return s === 'مغلق' || s === 'اكتمل العمل بشكل آمن' || s === 'إغلاق جبري'; }).length;
            const kSeq = t('module.ptw.excelColSeq', 'م');
            const kType = t('module.ptw.excelColPermitType', 'نوع التصريح');
            const kReq = t('module.ptw.excelColReq', 'الجهة الطالبة');
            const kAuth = t('module.ptw.excelColAuth', 'الجهة المصرح لها');
            const kLoc = t('module.ptw.excelColLoc', 'الموقع');
            const kDate = t('module.ptw.excelColDate', 'التاريخ');
            const kSt = t('module.ptw.excelColStatus', 'الحالة');
            const kDesc = t('module.ptw.excelColWorkDesc', 'وصف العمل');
            const tableRows = list.map((p, i) => `
                <tr>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: center;">${i + 1}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain}; font-size: 9px;">${Utils.escapeHTML(workTypeStr(p))}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain};">${Utils.escapeHTML(p.requestingParty || '-')}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain};">${Utils.escapeHTML(p.authorizedParty || '-')}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain};">${Utils.escapeHTML(p.location || p.siteName || '-')}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain};">${formatDate(p.startDate || p.openDate || p.createdAt)}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain};">${Utils.escapeHTML(this.statusLabel(p.status || '-'))}</td>
                    <td style="border: 1px solid #d1d5db; padding: 5px; text-align: ${alignMain}; font-size: 9px; max-width: 120px;">${Utils.escapeHTML((p.workDescription || '-').toString().slice(0, 80))}</td>
                </tr>
            `).join('');
            const title = t('module.ptw.pdf.analysisReportTitle', 'تقرير تحليل تصاريح العمل');
            const filterLine = t('module.ptw.pdf.filterCriteriaLine', 'معايير الفلتر: {text}').replace(/\{text\}/g, filterText);
            const totalsLine = t('module.ptw.pdf.totalsLine', 'إجمالي: {total} | مفتوحة: {open} | مغلقة: {closed}')
                .replace(/\{total\}/g, String(list.length))
                .replace(/\{open\}/g, String(openCount))
                .replace(/\{closed\}/g, String(closedCount));
            const content = `
                <div style="margin-bottom: 18px;">
                    <h2 style="text-align: center; color: #1f2937; margin-bottom: 10px;">${Utils.escapeHTML(title)}</h2>
                    <p style="text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 6px;">${Utils.escapeHTML(filterLine)}</p>
                    <p style="text-align: center; color: #374151; font-size: 12px;">${Utils.escapeHTML(totalsLine)}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                        <tr style="background-color: #3b82f6; color: white;">
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${Utils.escapeHTML(kSeq)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kType)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kReq)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kAuth)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kLoc)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kDate)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kSt)}</th>
                            <th style="border: 1px solid #d1d5db; padding: 6px; text-align: ${alignMain};">${Utils.escapeHTML(kDesc)}</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            `;
            const formCode = 'PTW-ANALYSIS-' + new Date().toISOString().slice(0, 10);
            const formTitle = title;
            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, formTitle, content, false, true, { source: 'PTWAnalysis' }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="${htmlDir}" lang="${htmlLang}"><head><meta charset="UTF-8"><title>${Utils.escapeHTML(formTitle)}</title></head><body>${content}</body></html>`;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        setTimeout(() => { URL.revokeObjectURL(url); Loading.hide(); Notification.success(PTW._t('module.ptw.pdf.readyPrint', 'تم تحضير التقرير للطباعة/الحفظ كـ PDF')); }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error(this._t('module.ptw.notify.popupsPdf', 'يرجى السماح بالنوافذ المنبثقة لتصدير PDF'));
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير تقرير التحليل PDF:', error);
            const unk = this._t('module.ptw.notify.unknownError', 'خطأ غير معروف');
            Notification.error(this._t('module.ptw.notify.pdfErr', 'فشل تصدير PDF: ') + (error && error.message ? error.message : unk));
        }
    },

    /**
     * تهيئة أحداث تبويب التحليل
     */
    setupAnalysisEventListeners() {
        if (!this.analysisCharts) this.analysisCharts = {};
        const addBtn = document.getElementById('ptw-analysis-add');
        if (addBtn) {
            const newAddBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newAddBtn, addBtn);
            newAddBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showAnalysisForm();
            });
        }

        const exportExcelBtn = document.getElementById('ptw-analysis-export-excel');
        if (exportExcelBtn) {
            const btn = exportExcelBtn.cloneNode(true);
            exportExcelBtn.parentNode.replaceChild(btn, exportExcelBtn);
            btn.addEventListener('click', () => this.exportAnalysisReportToExcel());
        }
        const exportPdfBtn = document.getElementById('ptw-analysis-export-pdf');
        if (exportPdfBtn) {
            const btn = exportPdfBtn.cloneNode(true);
            exportPdfBtn.parentNode.replaceChild(btn, exportPdfBtn);
            btn.addEventListener('click', () => this.exportAnalysisReportToPDF());
        }

        const applyFilterBtn = document.getElementById('ptw-analysis-apply-filter');
        if (applyFilterBtn) {
            const btn = applyFilterBtn.cloneNode(true);
            applyFilterBtn.parentNode.replaceChild(btn, applyFilterBtn);
            btn.addEventListener('click', () => this.updateAnalysisChartsAndKPIs(this.getFilteredAnalysisPermits()));
        }
        const resetFilterBtn = document.getElementById('ptw-analysis-reset-filter');
        if (resetFilterBtn) {
            const btn = resetFilterBtn.cloneNode(true);
            resetFilterBtn.parentNode.replaceChild(btn, resetFilterBtn);
            btn.addEventListener('click', () => {
                const from = document.getElementById('ptw-analysis-date-from');
                const to = document.getElementById('ptw-analysis-date-to');
                const wt = document.getElementById('ptw-analysis-work-type');
                const auth = document.getElementById('ptw-analysis-authorized');
                const req = document.getElementById('ptw-analysis-requesting');
                const st = document.getElementById('ptw-analysis-status');
                if (from) from.value = ''; if (to) to.value = '';
                if (wt) wt.value = ''; if (auth) auth.value = ''; if (req) req.value = ''; if (st) st.value = '';
                this.updateAnalysisChartsAndKPIs(this.getFilteredAnalysisPermits());
            });
        }

        setTimeout(() => {
            this.updateAnalysisChartsAndKPIs(this.getFilteredAnalysisPermits());
        }, 150);

        setTimeout(() => {
            const editButtons = document.querySelectorAll('[onclick*="PTW.editAnalysis"]');
            editButtons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes('editAnalysis')) {
                    const match = onclickAttr.match(/editAnalysis\('([^']+)'\)/);
                    if (match && match[1]) {
                        btn.removeAttribute('onclick');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.editAnalysis(match[1]);
                        });
                    }
                }
            });

            const deleteButtons = document.querySelectorAll('[onclick*="PTW.deleteAnalysis"]');
            deleteButtons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes('deleteAnalysis')) {
                    const match = onclickAttr.match(/deleteAnalysis\('([^']+)'\)/);
                    if (match && match[1]) {
                        btn.removeAttribute('onclick');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.deleteAnalysis(match[1]);
                        });
                    }
                }
            });
        }, 100);
    },

    /**
     * عرض نموذج إضافة/تعديل تحليل
     */
    showAnalysisForm(analysisId = null) {
        // التأكد من تهيئة البيانات
        if (!AppState.appData) AppState.appData = {};
        if (!AppState.appData.ptwAnalysis) AppState.appData.ptwAnalysis = [];
        if (!AppState.appData.ptw) AppState.appData.ptw = [];

        const analysisData = analysisId ? AppState.appData.ptwAnalysis.find(a => a && a.id === analysisId) : null;
        const allPermits = AppState.appData.ptw || [];
        const workTypes = [...new Set(allPermits.map(p => p && p.workType).filter(Boolean))];
        const locations = [...new Set(allPermits.map(p => (p && (p.siteName || p.location))).filter(Boolean))];
        const t = (k, f) => this._t(k, f);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header modal-header-centered">
                    <h2 class="modal-title">
                        <i class="fas fa-chart-line ml-2"></i>
                        ${analysisData ? t('module.ptw.analysis.form.titleEdit', 'تعديل تحليل') : t('module.ptw.analysis.form.titleAdd', 'إضافة تحليل جديد')}
                    </h2>
                    <button class="modal-close" aria-label="${t('module.ptw.analysis.form.closeAria', 'إغلاق')}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="ptw-analysis-form" class="modal-body">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.analysis.form.dateLabel', 'تاريخ التحليل')} <span class="text-red-500">*</span></label>
                            <input type="date" id="analysis-date" required class="form-input"
                                value="${analysisData?.analysisDate ? new Date(analysisData.analysisDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.analysis.form.periodLabel', 'الفترة')}</label>
                            <input type="text" id="analysis-period" class="form-input" placeholder="${t('module.ptw.analysis.form.periodPh', 'مثال: يناير 2024')}"
                                value="${Utils.escapeHTML(analysisData?.period || '')}">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.analysis.form.workType', 'نوع العمل')}</label>
                                <select id="analysis-work-type" class="form-input">
                                    <option value="">${t('module.ptw.analysis.form.allTypes', 'جميع الأنواع')}</option>
                                    ${workTypes.map(type => `
                                        <option value="${Utils.escapeHTML(type)}" ${analysisData?.workType === type ? 'selected' : ''}>
                                            ${Utils.escapeHTML(type)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.analysis.form.location', 'الموقع')}</label>
                                <select id="analysis-location" class="form-input">
                                    <option value="">${t('module.ptw.analysis.form.allSites', 'جميع المواقع')}</option>
                                    ${locations.map(loc => `
                                        <option value="${Utils.escapeHTML(loc)}" ${analysisData?.location === loc ? 'selected' : ''}>
                                            ${Utils.escapeHTML(loc)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.analysis.form.notesLabel', 'الملاحظات والتحليل')}</label>
                            <textarea id="analysis-notes" class="form-input" rows="6" placeholder="${t('module.ptw.analysis.form.notesPh', 'أدخل ملاحظات التحليل والنتائج...')}">${Utils.escapeHTML(analysisData?.notes || '')}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.ptw.analysis.form.recsLabel', 'التوصيات')}</label>
                            <textarea id="analysis-recommendations" class="form-input" rows="4" placeholder="${t('module.ptw.analysis.form.recsPh', 'أدخل التوصيات...')}">${Utils.escapeHTML(analysisData?.recommendations || '')}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer mt-6 form-actions-centered">
                        <button type="button" class="btn-secondary" data-action="close">${t('module.ptw.analysis.form.cancel', 'إلغاء')}</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            ${analysisData ? t('module.ptw.analysis.form.update', 'تحديث') : t('module.ptw.analysis.form.save', 'حفظ')}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => {
            if (modal && modal.parentNode) {
                modal.remove();
            }
        };
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }
        const cancelBtn = modal.querySelector('[data-action="close"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', close);
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-overlay')) {
                const ok = confirm(PTW._t('module.ptw.form.analysis.closeUnsaved', 'تنبيه: سيتم إغلاق النموذج.\\nقد تفقد أي بيانات غير محفوظة.\\n\\nهل تريد الإغلاق؟').replace(/\\n/g, '\n'));
                if (ok) close();
            }
        });

        const form = document.getElementById('ptw-analysis-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveAnalysis(analysisId, modal);
            });
        } else {
            Utils.safeError('❌ لم يتم العثور على نموذج التحليل');
        }
    },

    /**
     * حفظ تحليل
     */
    async saveAnalysis(analysisId, modal) {
        try {
            // التحقق من وجود جميع العناصر قبل الاستخدام
            const dateInput = document.getElementById('analysis-date');
            if (!dateInput || !dateInput.value) {
                Notification.error(this._t('module.ptw.notify.dateRequired', 'يرجى إدخال تاريخ التحليل'));
                return;
            }

            // التحقق من صحة التاريخ
            const dateValue = new Date(dateInput.value);
            if (isNaN(dateValue.getTime())) {
                Notification.error(this._t('module.ptw.notify.dateInvalid', 'تاريخ التحليل غير صحيح'));
                return;
            }

            const formData = {
                id: analysisId || Utils.generateId('PTW_ANALYSIS'),
                analysisDate: dateValue.toISOString(),
                period: (document.getElementById('analysis-period')?.value || '').trim(),
                workType: (document.getElementById('analysis-work-type')?.value || '').trim(),
                location: (document.getElementById('analysis-location')?.value || '').trim(),
                notes: (document.getElementById('analysis-notes')?.value || '').trim(),
                recommendations: (document.getElementById('analysis-recommendations')?.value || '').trim(),
                createdAt: analysisId && AppState.appData.ptwAnalysis ? (AppState.appData.ptwAnalysis.find(a => a && a.id === analysisId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (!AppState.appData.ptwAnalysis) {
                AppState.appData.ptwAnalysis = [];
            }

            if (analysisId) {
                const index = AppState.appData.ptwAnalysis.findIndex(a => a && a.id === analysisId);
                if (index !== -1) {
                    AppState.appData.ptwAnalysis[index] = { ...AppState.appData.ptwAnalysis[index], ...formData };
                } else {
                    Utils.safeWarn('⚠️ لم يتم العثور على التحليل للتحديث، سيتم إضافة تحليل جديد');
                    AppState.appData.ptwAnalysis.push(formData);
                }
            } else {
                AppState.appData.ptwAnalysis.push(formData);
            }

            // حفظ البيانات
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            Notification.success(analysisId ? this._t('module.ptw.notify.analysisUpdated', 'تم تحديث التحليل بنجاح') : this._t('module.ptw.notify.analysisAdded', 'تم إضافة التحليل بنجاح'));
            if (modal && modal.parentNode) {
                modal.remove();
            }

            // تحديث العرض
            const analysisContent = document.getElementById('ptw-analysis-content');
            if (analysisContent) {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في حفظ التحليل:', error);
            Notification.error(this._t('module.ptw.notify.analysisSaveErr', 'حدث خطأ أثناء حفظ التحليل'));
        }
    },

    /**
     * تعديل تحليل
     */
    editAnalysis(analysisId) {
        this.showAnalysisForm(analysisId);
    },

    /**
     * حذف تحليل
     */
    async deleteAnalysis(analysisId) {
        if (!confirm(this._t('module.ptw.notify.deleteAnalysisConfirm', 'هل أنت متأكد من حذف هذا التحليل؟'))) {
            return;
        }

        try {
            if (!AppState.appData) {
                AppState.appData = {};
            }
            if (!AppState.appData.ptwAnalysis) {
                AppState.appData.ptwAnalysis = [];
            }

            const initialLength = AppState.appData.ptwAnalysis.length;
            AppState.appData.ptwAnalysis = AppState.appData.ptwAnalysis.filter(a => a && a.id !== analysisId);

            if (AppState.appData.ptwAnalysis.length === initialLength) {
                Utils.safeWarn('⚠️ لم يتم العثور على التحليل للحذف');
                Notification.warning(this._t('module.ptw.notify.analysisNotFound', 'لم يتم العثور على التحليل المحدد'));
                return;
            }

            // حفظ البيانات
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            Notification.success(this._t('module.ptw.notify.analysisDeleted', 'تم حذف التحليل بنجاح'));

            // تحديث العرض
            const analysisContent = document.getElementById('ptw-analysis-content');
            if (analysisContent) {
                analysisContent.innerHTML = this.renderAnalysisContent();
                this.setupAnalysisEventListeners();
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في حذف التحليل:', error);
            Notification.error(this._t('module.ptw.notify.analysisDeleteErr', 'حدث خطأ أثناء حذف التحليل'));
        }
    },

    renderApprovalsContent() {
        // التأكد من إخفاء الخريطة في تبويب الموافقات بشكل كامل
        const mapContent = document.getElementById('ptw-map-content');
        if (mapContent) {
            mapContent.style.display = 'none';
            mapContent.style.visibility = 'hidden';
            mapContent.style.opacity = '0';
            mapContent.style.position = 'absolute';
            mapContent.style.left = '-9999px';
            mapContent.style.width = '0';
            mapContent.style.height = '0';
            mapContent.style.overflow = 'hidden';
            mapContent.style.pointerEvents = 'none';
            mapContent.style.zIndex = '-1';
        }

        try {
            const t = (k, f) => this._t(k, f);
            const currentUserEmail = AppState.currentUser?.email?.toLowerCase() || '';

            // Filter pending approvals for current user with error handling
            // التأكد من تحديث حالة التصاريح قبل الفلترة
            const allPermits = (AppState.appData.ptw || []).map(p => {
                try {
                    // تحديث حالة التصريح بناءً على الاعتمادات
                    if (p && p.approvals) {
                        this.updatePermitStatus(p);
                    }
                    return p;
                } catch (error) {
                    Utils.safeError('خطأ في تحديث حالة التصريح:', error);
                    return p;
                }
            });

            const pendingPermits = allPermits.filter(p => {
                try {
                    const st = (p?.status || '').trim();
                    if (!p || p.isManualEntry === true || p.skipApprovalFlow === true) return false;
                    if (!p || st === 'مغلق' || st === 'مرفوض' || st === 'اكتمل العمل بشكل آمن' || st === 'إغلاق جبري') return false;

                    // Check normalized approvals with error handling
                    const approvals = this.normalizeApprovals(p.approvals || []);
                    const pending = approvals.find(a => a && a.status === 'pending');

                    if (!pending) return false;

                    // Check if user is assigned or is in candidates
                    const isAssignedToUser = pending.approverEmail &&
                        pending.approverEmail.toLowerCase() === currentUserEmail;

                    // Also check if user is in candidates list (if no specific approver assigned yet)
                    const isInCandidates = !pending.approverEmail && Array.isArray(pending.candidates) &&
                        pending.candidates.some(c => c && c.email && c.email.toLowerCase() === currentUserEmail);

                    // Also check by approverId if email is not available
                    const currentUserId = AppState.currentUser?.id || '';
                    const isAssignedById = !isAssignedToUser && pending.approverId && 
                        (pending.approverId === currentUserId || pending.approverId === currentUserEmail);

                    return isAssignedToUser || isInCandidates || isAssignedById;
                } catch (error) {
                    Utils.safeError('خطأ في معالجة تصريح في الموافقات:', error);
                    return false;
                }
            }).sort((a, b) => {
                // ترتيب حسب تاريخ الإنشاء (الأحدث أولاً) أو تاريخ الموافقة المعلقة
                const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            // Generate HTML
            return `
            <div class="space-y-6">
                <!-- My Pending Approvals -->
                <div class="content-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                     <div class="card-header bg-gradient-to-r from-blue-50 to-white border-b border-blue-100 p-4 flex justify-between items-center">
                        <h2 class="card-title text-blue-800 font-bold text-lg">
                            <i class="fas fa-signature ml-2 text-blue-600"></i>
                            ${t('module.ptw.approvals.myPending', 'الموافقات المعلقة الخاصة بي')}
                            <span class="mr-2 bg-blue-100 text-blue-700 text-xs py-1 px-2 rounded-full">${pendingPermits.length}</span>
                        </h2>
                        <button onclick="PTW.refreshApprovalsContent()" class="btn-secondary btn-sm flex items-center gap-2" title="${t('module.ptw.approvals.updateList', 'تحديث القائمة')}">
                            <i class="fas fa-sync-alt"></i>
                            <span>${t('module.common.refresh', 'تحديث')}</span>
                        </button>
                    </div>
                    <div class="card-body p-0">
                        ${pendingPermits.length ? `
                            <div class="overflow-x-auto">
                                <table class="w-full text-right">
                                    <thead class="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                                        <tr>
                                            <th class="px-6 py-4">${t('module.ptw.approvals.colPermit', 'رقم التصريح')}</th>
                                            <th class="px-6 py-4">${t('module.ptw.approvals.colWorkType', 'نوع العمل')}</th>
                                            <th class="px-6 py-4">${t('module.ptw.approvals.colLocation', 'الموقع')}</th>
                                            <th class="px-6 py-4">${t('module.ptw.approvals.colStart', 'تاريخ البدء')}</th>
                                            <th class="px-6 py-4">${t('module.ptw.approvals.colStatus', 'الحالة')}</th>
                                            <th class="px-6 py-4">${t('module.ptw.approvals.colAction', 'الإجراء')}</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100">
                                        ${pendingPermits.map(item => {
                try {
                    const itemId = item?.id || '';
                    const ns = t('module.ptw.common.notSpecified', 'غير محدد');
                    const workType = Utils.escapeHTML(String(item?.workType || ns));
                    const location = Utils.escapeHTML(String(item?.location || item?.siteName || ns));
                    const startDate = item?.startDate ? (typeof Utils.formatDate === 'function' ? Utils.formatDate(item.startDate) : new Date(item.startDate).toLocaleDateString('ar-SA')) : '-';
                    
                    // الحصول على تفاصيل الموافقة المعلقة
                    const approvals = this.normalizeApprovals(item.approvals || []);
                    const pendingApproval = approvals.find(a => a && a.status === 'pending');
                    const pendingRoleRaw = pendingApproval ? (pendingApproval.role || t('module.ptw.approval.approvalRequired', 'موافقة مطلوبة')) : t('module.ptw.approval.approvalRequired', 'موافقة مطلوبة');
                    const requesterName = String(item?.requesterName || item?.requestedBy?.name || item?.requestedBy || ns);
                    const requesterLine = requesterName !== ns
                        ? `<div class="text-xs text-gray-500 mt-1">${t('module.ptw.approvals.fromRequester', 'من: {name}').replace(/\{name\}/g, Utils.escapeHTML(requesterName))}</div>`
                        : '';
                    const statusText = this.statusLabel(item?.status || 'قيد المراجعة');
                    const roleLine = this.approvalRoleLabel(pendingRoleRaw);

                    return `
                                                    <tr class="hover:bg-gray-50 transition-colors">
                                                        <td class="px-6 py-4">
                                                            <div class="font-mono text-sm text-gray-700 font-semibold">#${Utils.escapeHTML(String(itemId))}</div>
                                                            ${requesterLine}
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <div class="font-medium text-gray-800">${workType}</div>
                                                            ${roleLine ? `<div class="text-xs text-blue-600 mt-1">
                                                                <i class="fas fa-tasks mr-1"></i>${Utils.escapeHTML(roleLine)}
                                                            </div>` : ''}
                                                        </td>
                                                        <td class="px-6 py-4 text-gray-600 text-sm">${location}</td>
                                                        <td class="px-6 py-4">
                                                            <div class="text-gray-600 text-sm">${startDate}</div>
                                                            ${item?.createdAt ? `<div class="text-xs text-gray-500 mt-1">
                                                                ${t('module.ptw.approvals.createdOn', 'إنشاء: ')}${typeof Utils.formatDate === 'function' ? Utils.formatDate(item.createdAt) : new Date(item.createdAt).toLocaleDateString('ar-SA')}
                                                            </div>` : ''}
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                <i class="fas fa-clock mr-1"></i> ${t('module.ptw.approvals.badge', 'بانتظار موافقتك')}
                                                            </span>
                                                            <div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(String(statusText))}</div>
                                                        </td>
                                                        <td class="px-6 py-4">
                                                            <button onclick="PTW.viewPTW('${Utils.escapeHTML(String(itemId))}')" class="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm flex items-center justify-center">
                                                                <i class="fas fa-eye ml-1"></i> ${t('module.ptw.approvals.review', 'مراجعة')}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `;
                } catch (error) {
                    Utils.safeError('خطأ في عرض عنصر الموافقات:', error);
                    return '';
                }
            }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                <div class="bg-gray-50 rounded-full p-4 mb-3">
                                    <i class="fas fa-check text-gray-300 text-3xl"></i>
                                </div>
                                <h3 class="text-gray-900 font-medium">${t('module.ptw.approvals.noneTitle', 'لا يوجد موافقات معلقة')}</h3>
                                <p class="text-gray-500 text-sm mt-1">${t('module.ptw.approvals.noneSub', 'جميع المهام الموكلة إليك مكتملة.')}</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Approval Circuits Integration -->
                 <div class="content-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="card-header bg-gradient-to-r from-purple-50 to-white border-b border-purple-100 p-4">
                        <h2 class="card-title text-purple-800 font-bold text-lg">
                            <i class="fas fa-project-diagram ml-2 text-purple-600"></i>
                             ${t('module.ptw.approvals.circuits', 'إدارة مسارات الاعتماد')}
                        </h2>
                    </div>
                    <div class="card-body p-6">
                        <div id="approval-circuits-container">
                             ${typeof ApprovalCircuits !== 'undefined' && typeof ApprovalCircuits.renderManager === 'function'
                    ? (() => {
                        try {
                            return ApprovalCircuits.renderManager('ptw');
                        } catch (error) {
                            Utils.safeError('خطأ في عرض مدير مسارات الاعتماد:', error);
                            return `
                            <div class="text-center py-8">
                                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <i class="fas fa-exclamation-triangle text-yellow-600 text-2xl mb-2"></i>
                                    <p class="text-yellow-800 text-sm">${t('module.ptw.approvals.circuitsError', 'حدث خطأ أثناء تحميل مدير مسارات الاعتماد. يرجى المحاولة مرة أخرى.')}</p>
                                </div>
                            </div>
                        `;
                        }
                    })()
                    : `
                                    <div class="text-center py-8">
                                        <div class="bg-purple-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                            <i class="fas fa-route text-purple-400 text-2xl"></i>
                                        </div>
                                        <h3 class="text-lg font-medium text-gray-900 mb-2">${t('module.ptw.approvals.circuitsTitle', 'نظام مسارات الاعتماد')}</h3>
                                        <p class="text-gray-500 text-sm max-w-md mx-auto mb-6">${t('module.ptw.approvals.circuitsDesc', 'يمكنك إدارة تكوينات مسارات الاعتماد وتحديد الموافقين من خلال لوحة تحكم الاعتمادات.')}</p>
                                        <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 max-w-2xl mx-auto text-right">
                                            <h4 class="font-bold text-blue-800 mb-2 text-sm">${t('module.ptw.approvals.circuitsHow', 'كيف تعمل الاعتمادات؟')}</h4>
                                            <ul class="text-sm text-blue-700 space-y-2 list-disc list-inside">
                                                <li>${t('module.ptw.approvals.circuitsLi1', 'يتم تحديد مسار الاعتماد بناءً على نوع التصريح والموقع.')}</li>
                                                <li>${t('module.ptw.approvals.circuitsLi2', 'يمكن للمسؤولين تعيين موافقين محددين لكل مرحلة.')}</li>
                                                <li>${t('module.ptw.approvals.circuitsLi3', 'تصل إشعارات للموافقين عند وصول دورهم في الاعتماد.')}</li>
                                            </ul>
                                        </div>
                                    </div>
                                `
                }
                        </div>
                    </div>
                 </div>
            </div>
        `;
        } catch (error) {
            Utils.safeError('خطأ في عرض محتوى الموافقات:', error);
            const te = (k, f) => this._t(k, f);
            return `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">${te('module.ptw.approvals.errorLoad', 'حدث خطأ أثناء تحميل قسم الموافقات')}</p>
                            <button onclick="PTW.switchTab('approvals')" class="btn-primary">
                                <i class="fas fa-redo ml-2"></i>
                                ${te('module.common.retry', 'إعادة المحاولة')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * تهيئة أحداث تبويب الموافقات
     */
    /**
     * تحديث محتوى تبويب الموافقات
     */
    refreshApprovalsContent() {
        try {
            const approvalsContent = document.getElementById('ptw-approvals-content');
            if (approvalsContent) {
                approvalsContent.innerHTML = this.renderApprovalsContent();
                this.setupApprovalsEventListeners();
                Utils.safeLog('✅ تم تحديث محتوى الموافقات');
                
                // إظهار إشعار نجاح
                if (typeof Notification !== 'undefined') {
                    Notification.success(this._t('module.ptw.approvals.notifyUpdated', 'تم تحديث قائمة الموافقات المعلقة'));
                }
            }
        } catch (error) {
            Utils.safeError('خطأ في تحديث محتوى الموافقات:', error);
            if (typeof Notification !== 'undefined') {
                Notification.error(this._t('module.ptw.approvals.notifyErr', 'حدث خطأ أثناء تحديث الموافقات'));
            }
        }
    },

    setupApprovalsEventListeners() {
        // إضافة مستمعين لأزرار المراجعة في جدول الموافقات
        setTimeout(() => {
            const viewButtons = document.querySelectorAll('[onclick*="PTW.viewPTW"]');
            viewButtons.forEach(btn => {
                const onclickAttr = btn.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes('viewPTW')) {
                    const match = onclickAttr.match(/viewPTW\('([^']+)'\)/);
                    if (match && match[1]) {
                        btn.removeAttribute('onclick');
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.viewPTW(match[1]);
                        });
                    }
                }
            });

            // إضافة مستمع لتحديث المحتوى بعد إغلاق نافذة عرض التصريح
            // يتم استدعاء refreshApprovalsContent بعد الموافقة أو الرفض
            const refreshBtn = document.querySelector('[onclick*="refreshApprovalsContent"]');
            if (refreshBtn && !refreshBtn.dataset.listenerAttached) {
                refreshBtn.removeAttribute('onclick');
                refreshBtn.addEventListener('click', () => this.refreshApprovalsContent());
                refreshBtn.dataset.listenerAttached = 'true';
            }

            // إضافة مستمعين لأزرار الموافقة والرفض في viewPTW modal
            // هذه الأزرار يتم إنشاؤها ديناميكياً في viewPTW، لذا سنتعامل معها هناك
        }, 100);
    },

    /**
     * تحميل قائمة التصاريح مع منع التحميل الزائد (debounce)
     */
    loadPTWList(immediate = false) {
        // إلغاء الاستدعاء السابق إذا كان موجوداً
        if (this._loadPTWListTimeout) {
            clearTimeout(this._loadPTWListTimeout);
            this._loadPTWListTimeout = null;
        }

        const executeLoad = () => {
            try {
                this.updateKPIs();
                const container = document.querySelector('#ptw-table-container');
                if (!container) return;

                // التأكد من وجود الجدول
                let table = container.querySelector('table');
                if (!table) {
                    // إنشاء الجدول إذا لم يكن موجوداً
                    table = document.createElement('table');
                    table.className = 'data-table';
                    table.innerHTML = `
                        <thead>
                            <tr>
                                <th>نوع العمل</th>
                                <th>الموقع</th>
                                <th>المكان الفرعي</th>
                                <th>تاريخ البدء</th>
                                <th>تاريخ الانتهاء</th>
                                <th>الحالة</th>
                                <th>مسار الاعتماد</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colspan="8" class="text-center text-gray-500 py-8">
                                    <div style="width: 300px; margin: 0 auto 16px;">
                                        <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                        </div>
                                    </div>
                                    <p class="text-gray-500">جاري التحميل...</p>
                                </td>
                            </tr>
                        </tbody>
                    `;
                    container.innerHTML = '';
                    // ✅ التحقق من أن container متصل بالـ DOM قبل appendChild
                    if (container.parentNode && document.body.contains(container)) {
                        try {
                            container.appendChild(table);
                        } catch (error) {
                            Utils.safeError('❌ خطأ في appendChild للجدول:', error);
                        }
                    }
                } else {
                    // ✅ التحقق من أن table متصل بالـ DOM قبل التعديل
                    if (table.parentNode && document.body.contains(table)) {
                        // التأكد من وجود thead و tbody
                        if (!table.querySelector('thead')) {
                            const thead = document.createElement('thead');
                            thead.innerHTML = `
                                <tr>
                                    <th>نوع العمل</th>
                                    <th>الموقع</th>
                                    <th>المكان الفرعي</th>
                                    <th>تاريخ البدء</th>
                                    <th>تاريخ الانتهاء</th>
                                    <th>الحالة</th>
                                    <th>مسار الاعتماد</th>
                                    <th>الإجراءات</th>
                                </tr>
                            `;
                            try {
                                table.insertBefore(thead, table.firstChild);
                            } catch (error) {
                                Utils.safeError('❌ خطأ في insertBefore للـ thead:', error);
                            }
                        }
                        if (!table.querySelector('tbody')) {
                            const tbody = document.createElement('tbody');
                            tbody.innerHTML = `
                                <tr>
                                    <td colspan="8" class="text-center text-gray-500 py-8">
                                        <div style="width: 300px; margin: 0 auto 16px;">
                                            <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                                <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                            </div>
                                        </div>
                                        <p class="text-gray-500">جاري التحميل...</p>
                                    </td>
                                </tr>
                            `;
                            try {
                                table.appendChild(tbody);
                            } catch (error) {
                                Utils.safeError('❌ خطأ في appendChild للـ tbody:', error);
                            }
                        }
                    }
                }

                this.filterItems();
                this.updateSublocationFilterOptions();
            } catch (error) {
                Utils.safeError('❌ خطأ في تحميل قائمة التصاريح:', error);
            }
        };

        // إذا كان immediate، تنفيذ فوري، وإلا debounce
        if (immediate) {
            executeLoad();
        } else {
            this._loadPTWListTimeout = setTimeout(executeLoad, 100);
        }
    },

    /**
     * حماية أزرار التبويبات من الانكماش
     */
    protectTabButtons() {
        const tabButtons = document.querySelectorAll('.ptw-tab-btn');
        const tabsContainer = document.querySelector('.ptw-tabs');

        if (tabsContainer) {
            // حماية container
            tabsContainer.style.setProperty('flex-wrap', 'nowrap', 'important');
            tabsContainer.style.setProperty('min-width', '0', 'important');
            tabsContainer.style.setProperty('width', '100%', 'important');
            tabsContainer.style.setProperty('max-width', '100%', 'important');
            tabsContainer.style.setProperty('box-sizing', 'border-box', 'important');
        }

        tabButtons.forEach(btn => {
            // إزالة flex-1 class إذا كان موجوداً
            btn.classList.remove('flex-1');

            // إعادة تعيين styles لمنع الانكماش
            btn.style.setProperty('flex-shrink', '0', 'important');
            btn.style.setProperty('flex-grow', '0', 'important');
            btn.style.setProperty('flex-basis', 'auto', 'important');
            btn.style.setProperty('min-width', 'fit-content', 'important');
            btn.style.setProperty('white-space', 'nowrap', 'important');
            btn.style.setProperty('width', 'auto', 'important');
            btn.style.setProperty('max-width', 'none', 'important');
            btn.style.setProperty('box-sizing', 'border-box', 'important');
        });
    },

    /**
     * إعداد مراقب لحماية التبويبات من التعديلات
     * مع تنظيف صحيح لمنع memory leaks
     */
    setupTabProtection() {
        // تنظيف المراقبين السابقين إذا كانوا موجودين
        if (this._tabProtectionObserver) {
            this._tabProtectionObserver.disconnect();
            this._tabProtectionObserver = null;
        }
        if (this._tabResizeHandler) {
            window.removeEventListener('resize', this._tabResizeHandler);
            this._tabResizeHandler = null;
        }
        if (this._tabResizeTimeout) {
            clearTimeout(this._tabResizeTimeout);
            this._tabResizeTimeout = null;
        }

        // مراقب MutationObserver لحماية التبويبات
        const tabsContainer = document.querySelector('.ptw-tabs');
        if (!tabsContainer) return;

        // استخدام debounce لتقليل عدد الاستدعاءات
        let mutationTimeout;
        const observer = new MutationObserver((mutations) => {
            clearTimeout(mutationTimeout);
            mutationTimeout = setTimeout(() => {
                let needsProtection = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const target = mutation.target;
                        if (target.classList.contains('ptw-tab-btn')) {
                            // إعادة تطبيق الحماية إذا تم تعديل style
                            if (target.style.flexShrink !== '0' || target.style.minWidth !== 'fit-content') {
                                needsProtection = true;
                            }
                        }
                    }
                });
                if (needsProtection) {
                    this.protectTabButtons();
                }
            }, 50); // debounce 50ms
        });

        // حفظ المرجع للتنظيف لاحقاً
        this._tabProtectionObserver = observer;

        // مراقبة التبويبات
        const tabButtons = document.querySelectorAll('.ptw-tab-btn');
        tabButtons.forEach(btn => {
            observer.observe(btn, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        });

        // مراقبة resize لمنع الانكماش مع debounce
        const resizeHandler = () => {
            if (this._tabResizeTimeout) {
                clearTimeout(this._tabResizeTimeout);
            }
            this._tabResizeTimeout = setTimeout(() => {
                this.protectTabButtons();
            }, 150); // debounce 150ms
        };

        // حفظ المرجع للتنظيف
        this._tabResizeHandler = resizeHandler;
        window.addEventListener('resize', resizeHandler, { passive: true });

        // حماية بعد إعادة التحميل (مرة واحدة فقط)
        if (!this._loadHandlerBound) {
            const loadHandler = () => {
                setTimeout(() => {
                    this.protectTabButtons();
                }, 200);
            };
            window.addEventListener('load', loadHandler, { once: true });
            this._loadHandlerBound = true;
        }
    },

    /**
     * تنظيف جميع المراقبين والـ event listeners
     */
    cleanupTabProtection() {
        if (this._tabProtectionObserver) {
            this._tabProtectionObserver.disconnect();
            this._tabProtectionObserver = null;
        }
        if (this._tabResizeHandler) {
            window.removeEventListener('resize', this._tabResizeHandler);
            this._tabResizeHandler = null;
        }
        if (this._tabResizeTimeout) {
            clearTimeout(this._tabResizeTimeout);
            this._tabResizeTimeout = null;
        }
        this._loadHandlerBound = false;
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('🧹 تنظيف موارد PTW module...');
            }

            // تنظيف tab protection
            this.cleanupTabProtection();

            // تنظيف الخريطة إذا كانت موجودة
            if (typeof this.destroyMap === 'function') {
                this.destroyMap();
            }

            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ تم تنظيف موارد PTW module');
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في تنظيف PTW module:', error);
            }
        }
    }
};
// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof PTW !== 'undefined') {
            window.PTW = PTW;

            window.addEventListener('formSettingsUpdated', function () {
                try { if (typeof PTW !== 'undefined' && PTW.refreshSiteDropdowns) PTW.refreshSiteDropdowns(); } catch (e) {}
            });

            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ PTW module loaded and available on window.PTW');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير PTW:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof PTW !== 'undefined') {
            try {
                window.PTW = PTW;
            } catch (e) {
                console.error('❌ فشل تصدير PTW:', e);
            }
        }
    }
})();
