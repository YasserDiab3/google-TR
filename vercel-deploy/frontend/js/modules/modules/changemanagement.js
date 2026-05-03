/**
 * Change Management Module
 * موديول إدارة التغيرات (مشابه SAP Management of Change - MoC)
 * تسجيل وموافقة ومتابعة طلبات التغيير: تقني، إداري، تنظيمي
 */
const ChangeManagement = {
    applyModuleI18n(root) {
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        const target = root || document.getElementById('change-management-section') || document;
        i18nCore.applyI18n(target);
        i18nCore.applyLiteralTranslations(target);
    },
    t(key, fallback) {
        const i18nCore = (window.AppI18n && typeof window.AppI18n.t === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.t === 'function') ? window.I18n : null);
        if (i18nCore) {
            return i18nCore.t(key, null, fallback || key);
        }
        return fallback || key;
    },
    state: {
        currentView: 'list',
        activeTab: 'requests',
        lastRequests: [],
        filters: {
            status: 'all',
            changeType: 'all',
            priority: 'all',
            impact: 'all',
            relatedModule: '',
            search: '',
            startDate: '',
            endDate: ''
        },
        currentRequest: null,
        _loadInProgress: false,
        _searchDebounce: null
    },

    /**
     * تحميل الموديول — عرض الواجهة فوراً ثم جلب البيانات بدون تعليق
     */
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('change-management-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('قسم change-management-section غير موجود!');
            }
            return;
        }

        try {
            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-exchange-alt ml-3"></i>
                                ${this.t('nav.changeManagement', 'إدارة التغييرات')}
                            </h1>
                            <p class="section-subtitle">${this.t('module.changeManagement.subtitle', 'تسجيل وموافقة ومتابعة طلبات التغيير (تقني، إداري، تنظيمي)')}</p>
                        </div>
                        <div class="flex gap-2">
                            <button type="button" id="change-btn-statistics" class="btn-secondary" onclick="ChangeManagement.showStatistics()">
                                <i class="fas fa-chart-bar ml-2"></i>
                                الإحصائيات
                            </button>
                            <button type="button" id="change-btn-add" class="btn-primary" onclick="ChangeManagement.showCreateForm()">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة طلب تغيير
                            </button>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <div class="change-tabs flex gap-1 border-b border-gray-200 pb-0">
                        <button type="button" class="change-tab-btn tab-btn active" data-tab="requests" onclick="ChangeManagement.switchTab('requests')">
                            <i class="fas fa-list ml-2"></i> الطلبات
                        </button>
                        <button type="button" class="change-tab-btn tab-btn" data-tab="register" onclick="ChangeManagement.switchTab('register')">
                            <i class="fas fa-history ml-2"></i> سجل التغييرات
                        </button>
                        <button type="button" class="change-tab-btn tab-btn" data-tab="approvals" onclick="ChangeManagement.switchTab('approvals')">
                            <i class="fas fa-inbox ml-2"></i> طلبات الموافقة
                        </button>
                    </div>
                </div>
                <div class="mt-6" id="change-tab-requests">
                    ${this.renderRequestsListHTML()}
                </div>
                <div class="mt-6" id="change-tab-register" style="display:none;">
                    <div class="content-card" style="overflow:hidden;">
                        <div class="card-header border-b px-4 py-3" style="background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(14,165,233,0.08));text-align:center;">
                            <h3 class="card-title text-lg font-semibold" style="margin:0;">جميع الطلبات المسجلة والمستلمة مع حالتها</h3>
                        </div>
                        <div class="card-body" style="padding:0;">
                            <div id="change-register-list-container" style="max-height:480px;overflow-y:auto;overflow-x:auto;"><p class="text-gray-500 p-4">لا توجد طلبات في السجل</p></div>
                        </div>
                        <div class="card-footer" style="display:flex;justify-content:center;gap:8px;padding:1rem;border-top:1px solid var(--border-color);background:var(--bg-secondary);">
                            <button type="button" class="btn-secondary btn-sm" onclick="ChangeManagement.exportToExcel()" title="تصدير إلى Excel">
                                <i class="fas fa-file-excel ml-2"></i> تصدير Excel
                            </button>
                            <button type="button" class="btn-secondary btn-sm" onclick="ChangeManagement.exportToPDF()" title="تصدير إلى PDF">
                                <i class="fas fa-file-pdf ml-2"></i> تصدير PDF
                            </button>
                        </div>
                    </div>
                </div>
                <div class="mt-6" id="change-tab-approvals" style="display:none;">
                    ${this.renderApprovalsListHTML()}
                </div>
            `;
            this.applyModuleI18n(section);

            this.setupEventListeners();
            this.state._loadInProgress = false;
            this.loadChangeRequests();
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('خطأ في تحميل موديول إدارة التغيرات:', error);
            section.innerHTML = `
                <div class="section-header">
                    <h1 class="section-title"><i class="fas fa-exchange-alt ml-3"></i> إدارة التغيرات</h1>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button type="button" onclick="ChangeManagement.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i> إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(section);
        }
    },

    renderRequestsListHTML() {
        const f = this.state.filters || {};
        const v = (key, def) => (f[key] !== undefined && f[key] !== null && f[key] !== '') ? String(f[key]) : def;
        const escAttr = (s) => String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
        const searchVal = escAttr((f.search !== undefined && f.search !== null) ? f.search : '');
        const moduleVal = escAttr((f.relatedModule && f.relatedModule !== 'all') ? f.relatedModule : '');
        return `
            <div class="content-card cm-requests-panel" style="overflow:hidden;">
                <div class="card-header border-b px-4 py-3 cm-requests-card-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div class="text-right flex-1 min-w-0">
                            <h3 class="card-title text-lg font-semibold" style="margin:0;">الطلبات</h3>
                            <p class="text-sm text-gray-500 m-0 mt-1">عرض وتصفية طلبات التغيير الفني والإداري</p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="cm-requests-count-badge" id="change-requests-count" title="عدد الطلبات المعروضة">—</span>
                            <button type="button" class="btn-secondary btn-sm" onclick="ChangeManagement.loadChangeRequests()" title="تحديث القائمة">
                                <i class="fas fa-sync-alt ml-1"></i> تحديث
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body" style="padding:0;">
                    <div class="cm-requests-toolbar">
                        <div class="cm-requests-toolbar-grid">
                            <div class="cm-requests-field cm-requests-field-span2">
                                <label class="cm-requests-label" for="change-search">بحث</label>
                                <input type="search" id="change-search" class="form-input form-input-sm" placeholder="رقم الطلب، الموضوع، المقدم…" value="${searchVal}" autocomplete="off">
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-status-filter">الحالة</label>
                                <select id="change-status-filter" class="form-select form-select-sm">
                                    <option value="all" ${v('status', 'all') === 'all' ? 'selected' : ''}>الكل</option>
                                    <option value="Draft" ${v('status', 'all') === 'Draft' ? 'selected' : ''}>مسودة</option>
                                    <option value="In Review" ${v('status', 'all') === 'In Review' ? 'selected' : ''}>قيد المراجعة</option>
                                    <option value="Approved" ${v('status', 'all') === 'Approved' ? 'selected' : ''}>معتمد</option>
                                    <option value="Rejected" ${v('status', 'all') === 'Rejected' ? 'selected' : ''}>مرفوض</option>
                                    <option value="In Implementation" ${v('status', 'all') === 'In Implementation' ? 'selected' : ''}>قيد التنفيذ</option>
                                    <option value="Completed" ${v('status', 'all') === 'Completed' ? 'selected' : ''}>منفذ</option>
                                    <option value="Closed" ${v('status', 'all') === 'Closed' ? 'selected' : ''}>مغلق</option>
                                </select>
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-type-filter">نوع التغيير</label>
                                <select id="change-type-filter" class="form-select form-select-sm">
                                    <option value="all" ${v('changeType', 'all') === 'all' ? 'selected' : ''}>الكل</option>
                                    <option value="Technical" ${v('changeType', 'all') === 'Technical' ? 'selected' : ''}>تقني</option>
                                    <option value="Administrative" ${v('changeType', 'all') === 'Administrative' ? 'selected' : ''}>إداري</option>
                                    <option value="Organizational" ${v('changeType', 'all') === 'Organizational' ? 'selected' : ''}>تنظيمي</option>
                                </select>
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-priority-filter">الأولوية</label>
                                <select id="change-priority-filter" class="form-select form-select-sm">
                                    <option value="all" ${v('priority', 'all') === 'all' ? 'selected' : ''}>الكل</option>
                                    <option value="1-VeryHigh" ${v('priority', 'all') === '1-VeryHigh' ? 'selected' : ''}>عالي جداً</option>
                                    <option value="2-High" ${v('priority', 'all') === '2-High' ? 'selected' : ''}>عالي</option>
                                    <option value="3-Medium" ${v('priority', 'all') === '3-Medium' ? 'selected' : ''}>متوسط</option>
                                    <option value="4-Low" ${v('priority', 'all') === '4-Low' ? 'selected' : ''}>منخفض</option>
                                </select>
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-impact-filter">الأثر</label>
                                <select id="change-impact-filter" class="form-select form-select-sm">
                                    <option value="all" ${v('impact', 'all') === 'all' ? 'selected' : ''}>الكل</option>
                                    <option value="1-Minor" ${v('impact', 'all') === '1-Minor' ? 'selected' : ''}>بسيط</option>
                                    <option value="2-Major" ${v('impact', 'all') === '2-Major' ? 'selected' : ''}>كبير</option>
                                    <option value="3-Critical" ${v('impact', 'all') === '3-Critical' ? 'selected' : ''}>حرج</option>
                                </select>
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-module-filter">وحدة مرتبطة</label>
                                <input type="text" id="change-module-filter" class="form-input form-input-sm" placeholder="اختياري" value="${moduleVal}">
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-start-date">من تاريخ</label>
                                <input type="date" id="change-start-date" class="form-input form-input-sm" value="${v('startDate', '')}">
                            </div>
                            <div class="cm-requests-field">
                                <label class="cm-requests-label" for="change-end-date">إلى تاريخ</label>
                                <input type="date" id="change-end-date" class="form-input form-input-sm" value="${v('endDate', '')}">
                            </div>
                        </div>
                        <div class="cm-requests-toolbar-actions">
                            <button type="button" class="btn-secondary btn-sm" onclick="ChangeManagement.resetChangeRequestFilters()">
                                <i class="fas fa-undo ml-1"></i> مسح الفلاتر
                            </button>
                        </div>
                    </div>
                    <div id="change-requests-list-container" class="cm-requests-list-container">
                        <div class="empty-state py-8" id="change-requests-initial"><p class="text-gray-500">لا توجد طلبات تغيير</p></div>
                    </div>
                </div>
                <div class="card-footer" style="display:flex;justify-content:center;gap:8px;padding:1rem;border-top:1px solid var(--border-color);background:var(--bg-secondary);">
                    <button type="button" class="btn-secondary btn-sm" onclick="ChangeManagement.exportToExcel()" title="تصدير إلى Excel">
                        <i class="fas fa-file-excel ml-2"></i> تصدير Excel
                    </button>
                    <button type="button" class="btn-secondary btn-sm" onclick="ChangeManagement.exportToPDF()" title="تصدير إلى PDF">
                        <i class="fas fa-file-pdf ml-2"></i> تصدير PDF
                    </button>
                </div>
            </div>
        `;
    },

    /** تبويب طلبات الموافقة */
    renderApprovalsListHTML() {
        return `
            <div class="content-card" style="overflow:hidden;">
                <div class="card-header border-b px-4 py-3" style="background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(14,165,233,0.08));text-align:center;">
                    <h3 class="card-title text-lg font-semibold" style="margin:0;">طلبات الموافقة</h3>
                    <p class="text-sm text-gray-500 m-0 mt-1">الطلبات التي تتطلب اعتمادك حسب دائرة الاعتماد الإلكترونية</p>
                </div>
                <div class="card-body" style="padding:0;">
                    <div id="change-approvals-list-container" style="max-height:480px;overflow-y:auto;overflow-x:auto;padding:1rem;">
                        <div class="empty-state py-8"><p class="text-gray-500">لا توجد طلبات موافقة حالياً</p></div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadChangeRequests() {
        const container = document.getElementById('change-requests-list-container');
        if (!container) return;
        if (this.state._loadInProgress) return;

        if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
            const c = document.getElementById('change-requests-count');
            if (c) c.textContent = '—';
            container.innerHTML = this.showEmptyState('يجب تفعيل Google Integration أولاً');
            this.applyModuleI18n(container);
            return;
        }

        this.state._loadInProgress = true;
        const countEl = document.getElementById('change-requests-count');
        if (countEl) countEl.textContent = '…';
        container.innerHTML = `
            <div class="empty-state py-8 cm-requests-loading" id="change-requests-loading">
                <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3"></i>
                <p class="text-gray-500">جاري تحميل الطلبات...</p>
            </div>
        `;
        this.applyModuleI18n(container);
        const apprContainer = document.getElementById('change-approvals-list-container');
        if (apprContainer && this.state.activeTab === 'approvals') {
            apprContainer.innerHTML = `
                <div class="empty-state py-8">
                    <i class="fas fa-spinner fa-spin text-3xl text-blue-500 mb-3"></i>
                    <p class="text-gray-500">جاري تحميل طلبات الموافقة...</p>
                </div>
            `;
            this.applyModuleI18n(apprContainer);
        }

        try {
            const response = await GoogleIntegration.sendRequest({
                action: 'getAllChangeRequests',
                data: { filters: this.buildFilters() }
            });

            if (response.success) {
                const data = response.data || [];
                this.state.lastRequests = data;
                this.renderRequestsList(data);
                if (this.state.activeTab === 'register') {
                    this.renderRegisterTable(data);
                }
                if (this.state.activeTab === 'approvals') {
                    this.renderApprovalsList(data);
                }
                const pendingCount = (data || []).filter(r => this.isApprovalPendingForCurrentUser(r)).length;
                if (pendingCount > 0 && typeof Notification !== 'undefined' && Notification.info) {
                    Notification.info('لديك ' + pendingCount + ' طلب موافقة في انتظارك');
                }
            } else {
                if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('خطأ في تحميل الطلبات:', response.message);
                const ce = document.getElementById('change-requests-count');
                if (ce) ce.textContent = '—';
                container.innerHTML = this.showEmptyState('حدث خطأ أثناء تحميل الطلبات');
                this.applyModuleI18n(container);
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('خطأ في تحميل الطلبات:', error);
            const ce = document.getElementById('change-requests-count');
            if (ce) ce.textContent = '—';
            container.innerHTML = this.showEmptyState('حدث خطأ أثناء تحميل الطلبات');
            this.applyModuleI18n(container);
        } finally {
            this.state._loadInProgress = false;
        }
    },

    buildFilters() {
        const f = {};
        const status = document.getElementById('change-status-filter')?.value;
        if (status && status !== 'all') f.status = status;
        const changeType = document.getElementById('change-type-filter')?.value;
        if (changeType && changeType !== 'all') f.changeType = changeType;
        const priority = document.getElementById('change-priority-filter')?.value;
        if (priority && priority !== 'all') f.priority = priority;
        const impact = document.getElementById('change-impact-filter')?.value;
        if (impact && impact !== 'all') f.impact = impact;
        const relatedModule = document.getElementById('change-module-filter')?.value;
        if (relatedModule && String(relatedModule).trim()) f.relatedModule = String(relatedModule).trim();
        const search = document.getElementById('change-search')?.value;
        if (search) f.search = search;
        const startDate = document.getElementById('change-start-date')?.value;
        if (startDate) f.startDate = startDate;
        const endDate = document.getElementById('change-end-date')?.value;
        if (endDate) f.endDate = endDate;
        return f;
    },

    renderRequestsList(requests) {
        const container = document.getElementById('change-requests-list-container');
        if (!container) return;

        const countEl = document.getElementById('change-requests-count');
        const n = requests ? requests.length : 0;
        if (countEl) countEl.textContent = String(n);

        if (!requests || requests.length === 0) {
            container.innerHTML = `<div class="cm-requests-empty">${this.showEmptyState('لا توجد طلبات تغيير مطابقة للفلتر')}</div>`;
            this.applyModuleI18n(container);
            return;
        }

        const safe = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(v || '')) : String(v || '');
        container.innerHTML = `
            <div class="cm-requests-stack space-y-3">
                ${requests.map(r => this.renderRequestCard(r, safe)).join('')}
            </div>
        `;
        this.applyModuleI18n(container);
    },

    /** مزامنة الفلاتر من الواجهة إلى الحالة */
    syncFiltersFromUI() {
        this.state.filters = {
            status: document.getElementById('change-status-filter')?.value || 'all',
            changeType: document.getElementById('change-type-filter')?.value || 'all',
            priority: document.getElementById('change-priority-filter')?.value || 'all',
            impact: document.getElementById('change-impact-filter')?.value || 'all',
            relatedModule: document.getElementById('change-module-filter')?.value || '',
            search: document.getElementById('change-search')?.value || '',
            startDate: document.getElementById('change-start-date')?.value || '',
            endDate: document.getElementById('change-end-date')?.value || ''
        };
    },

    resetChangeRequestFilters() {
        this.state.filters = {
            status: 'all',
            changeType: 'all',
            priority: 'all',
            impact: 'all',
            relatedModule: '',
            search: '',
            startDate: '',
            endDate: ''
        };
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('change-status-filter', 'all');
        setVal('change-type-filter', 'all');
        setVal('change-priority-filter', 'all');
        setVal('change-impact-filter', 'all');
        setVal('change-module-filter', '');
        setVal('change-search', '');
        setVal('change-start-date', '');
        setVal('change-end-date', '');
        this.loadChangeRequests();
    },

    /** تحديد ما إذا كان هناك طلب يحتاج موافقة المستخدم الحالي */
    isApprovalPendingForCurrentUser(req) {
        try {
            if (!req || !req.approvalFlowJson) return false;
            const user = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : {};
            const userEmail = (user.email || user.id || '').toString();
            const userDept = (user.department || '').toString();
            const canFinalApprove = typeof Permissions !== 'undefined' && Permissions.hasAccess && Permissions.hasAccess('change-management');

            let flow = [];
            if (Array.isArray(req.approvalFlowJson)) {
                flow = req.approvalFlowJson;
            } else if (typeof req.approvalFlowJson === 'string' && req.approvalFlowJson) {
                try { flow = JSON.parse(req.approvalFlowJson); } catch (e) { flow = []; }
            }
            if (!flow || !flow.length) return false;

            const pendingStep = flow.find(s => s && s.status === 'pending');
            if (!pendingStep) return false;

            // إذا كانت الخطوة موجهة لبريد/مستخدم معين
            if (pendingStep.approvedByEmail && userEmail) {
                if (pendingStep.approvedByEmail === userEmail) return true;
            }

            const role = (pendingStep.role || '').toString();
            if (role === 'requester_department') {
                const fromDept = (req.fromDepartment || req.requestingDepartment || '').toString();
                return userDept && fromDept && userDept === fromDept;
            }
            if (role === 'target_department') {
                const toDept = (req.toDepartment || req.responsibleImplementingDepartment || '').toString();
                return userDept && toDept && userDept === toDept;
            }
            if (role === 'final_approval') {
                return !!canFinalApprove;
            }

            return false;
        } catch (e) {
            return false;
        }
    },

    /** عرض قائمة طلبات الموافقة للمستخدم الحالي */
    renderApprovalsList(requests) {
        const container = document.getElementById('change-approvals-list-container');
        if (!container) return;
        const list = Array.isArray(requests) ? requests : [];
        const pendingForUser = list.filter(r => this.isApprovalPendingForCurrentUser(r));

        if (!pendingForUser.length) {
            container.innerHTML = `
                <div class="empty-state py-8">
                    <i class="fas fa-check-circle text-4xl text-green-400 mb-4"></i>
                    <p class="text-gray-500">لا توجد طلبات موافقة في انتظارك حالياً</p>
                </div>
            `;
            this.applyModuleI18n(container);
            return;
        }

        const safe = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(v || '')) : String(v || '');

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse text-sm" style="border-color: var(--border-color);">
                    <thead>
                        <tr>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">رقم الطلب</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">الموضوع</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">الإدارة الطالبة</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">الإدارة المعنية</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">خطوة الاعتماد</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">الحالة</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">التاريخ</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pendingForUser.map((r, i) => {
                            const displayNumber = this.getDisplayRequestNumber(r) || (r.requestNumber || r.id || '');
                            const stepInfo = this.getCurrentApprovalStepLabel(r);
                            return `
                                <tr class="border-b hover:opacity-90" style="border-color: var(--border-color); background: ${i % 2 === 0 ? 'var(--card-bg)' : 'rgba(241,245,249,0.8)'};">
                                    <td class="p-3">${safe(displayNumber)}</td>
                                    <td class="p-3">${safe(r.title || '—')}</td>
                                    <td class="p-3">${safe(r.fromDepartment || r.requestingDepartment || '—')}</td>
                                    <td class="p-3">${safe(r.toDepartment || r.responsibleImplementingDepartment || '—')}</td>
                                    <td class="p-3">${safe(stepInfo.stepLabel)}</td>
                                    <td class="p-3">${safe(stepInfo.statusLabel)}</td>
                                    <td class="p-3">${this.formatDate(r.requestedAt || r.createdAt)}</td>
                                    <td class="p-3">
                                        <div class="flex flex-wrap gap-1">
                                            <button type="button" onclick="ChangeManagement.handleApprovalAction('${safe(r.id)}','approve')" class="btn-primary btn-sm">
                                                <i class="fas fa-check ml-1"></i> اعتماد
                                            </button>
                                            <button type="button" onclick="ChangeManagement.handleApprovalAction('${safe(r.id)}','reject')" class="btn-secondary btn-sm btn-danger">
                                                <i class="fas fa-times ml-1"></i> رفض
                                            </button>
                                            <button type="button" onclick="ChangeManagement.showRequestDetail('${safe(r.id)}')" class="btn-secondary btn-sm">
                                                <i class="fas fa-eye ml-1"></i> تفاصيل
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        this.applyModuleI18n(container);
    },

    /** إرجاع رقم الطلب للعرض بصيغة MOC-XX فقط */
    getDisplayRequestNumber(req) {
        if (!req) return '';
        const rawId = (req.requestNumber || req.id || '').toString();
        if (!rawId) return '';

        // إذا كان المعرف على صيغة CRQ_رقم نحوله إلى MOC-رقم برقمين
        const crqMatch = /^CRQ_(\d+)$/.exec(rawId);
        if (crqMatch && crqMatch[1]) {
            const n = parseInt(crqMatch[1], 10);
            const padded = isNaN(n) ? crqMatch[1] : String(n).padStart(2, '0');
            return 'MOC-' + padded;
        }

        // إذا كان الحقل نفسه MOC-XX نستخدمه كما هو
        if (rawId.indexOf('MOC-') === 0) {
            return rawId;
        }

        // في باقي الحالات نعرض المعرف كما هو بدون CRQ مدموج
        return rawId;
    },

    renderRequestCard(req, safe) {
        if (!safe) safe = (v) => String(v || '');
        const id = safe(req.id);
        const title = safe(req.title || 'بدون عنوان');
        const desc = (req.description || '').substring(0, 120);
        const descSafe = safe(desc + (req.description && req.description.length > 120 ? '...' : ''));
        const requestedBy = safe(req.requestedBy || 'غير محدد');
        const statusColors = {
            'Draft': 'bg-gray-100 text-gray-800',
            'In Review': 'bg-blue-100 text-blue-800',
            'Approved': 'bg-green-100 text-green-800',
            'Rejected': 'bg-red-100 text-red-800',
            'In Implementation': 'bg-purple-100 text-purple-800',
            'Completed': 'bg-teal-100 text-teal-800',
            'Closed': 'bg-gray-100 text-gray-600'
        };
        const priorityColors = {
            '1-VeryHigh': 'bg-red-100 text-red-800',
            '2-High': 'bg-orange-100 text-orange-800',
            '3-Medium': 'bg-yellow-100 text-yellow-800',
            '4-Low': 'bg-green-100 text-green-800'
        };
        const num = safe(this.getDisplayRequestNumber(req) || (req.requestNumber || req.id || ''));
        return `
            <article class="cm-request-card" role="button" tabindex="0" onclick="ChangeManagement.showRequestDetail('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();ChangeManagement.showRequestDetail('${id}');}">
                <div class="cm-request-card-inner">
                    <div class="cm-request-card-main">
                        <div class="cm-request-card-top">
                            <span class="cm-request-number">${num}</span>
                            <div class="cm-request-badges">
                                <span class="cm-request-badge cm-request-badge-status ${statusColors[req.status] || 'bg-gray-100'}">${this.getStatusLabel(req.status)}</span>
                                <span class="cm-request-badge cm-request-badge-prio ${priorityColors[req.priority] || 'bg-gray-100'}">${this.getPriorityLabel(req.priority)}</span>
                            </div>
                        </div>
                        <h3 class="cm-request-title">${title}</h3>
                        <p class="cm-request-desc">${descSafe}</p>
                        <div class="cm-request-meta">
                            <span class="cm-request-meta-item" title="مقدم الطلب"><i class="fas fa-user ml-1"></i>${requestedBy}</span>
                            <span class="cm-request-meta-item" title="التاريخ"><i class="fas fa-calendar ml-1"></i>${this.formatDate(req.requestedAt || req.createdAt)}</span>
                            <span class="cm-request-meta-item" title="نوع التغيير"><i class="fas fa-exchange-alt ml-1"></i>${this.getChangeTypeLabel(req.changeType)}</span>
                        </div>
                    </div>
                    <div class="cm-request-card-aside">
                        <button type="button" onclick="event.stopPropagation(); ChangeManagement.showRequestDetail('${id}')" class="btn-secondary btn-sm cm-request-view-btn">
                            <i class="fas fa-eye ml-1"></i> عرض
                        </button>
                    </div>
                </div>
            </article>
        `;
    },

    showCreateForm() {
        const btn = document.getElementById('change-btn-add');
        if (btn) {
            btn.disabled = true;
            setTimeout(() => { btn.disabled = false; }, 400);
        }
        const docTypes = [
            'إجراءات عمل / تعليمات العمل',
            'دراسات تقييم المخاطر / القياسات البيئية',
            'الرسومات الهندسية الخاصة بالموقع',
            'خطط الصيانة الوقائية',
            'خطة الطوارئ'
        ];
        const docRows = docTypes.map((t, i) => `
            <tr>
                <td class="p-2 border"><select name="docType_${i}" class="form-select form-select-sm"><option value="${t}">${t}</option><option value="أخرى">أخرى</option></select></td>
                <td class="p-2 border"><input type="text" name="docName_${i}" class="form-input form-input-sm" placeholder="اسم الوثيقة"></td>
                <td class="p-2 border"><input type="text" name="docCode_${i}" class="form-input form-input-sm" placeholder="كود الوثيقة"></td>
                <td class="p-2 border"><input type="text" name="docResponsible_${i}" class="form-input form-input-sm" placeholder="المسئول عن التعديل"></td>
                <td class="p-2 border"><input type="date" name="docPlanDate_${i}" class="form-input form-input-sm"></td>
            </tr>
        `).join('');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content change-form-modal" style="max-width: 920px; max-height: 95vh; overflow-y: auto;">
                <div class="modal-header change-form-modal-header" style="background: var(--primary-color, #2563eb); color: #fff; border-radius: 8px 8px 0 0; display: flex; justify-content: center; align-items: center; position: relative; padding: 1rem 3rem;">
                    <h2 class="modal-title change-form-modal-title" style="color: #fff; margin: 0; text-align: center; flex: 1; font-size: 1.4rem; font-weight: 700;">نموذج مقترح تغيير (فني / إداري)</h2>
                    <div style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" class="change-form-fullscreen-btn" title="ملء الشاشة" onclick="ChangeManagement.toggleChangeFormFullscreen(this)" style="color: #fff; opacity: 0.9; background: rgba(255,255,255,0.2); border: none; border-radius: 8px; cursor: pointer; padding: 0.5rem 0.75rem; font-size: 0.9rem;"><i class="fas fa-expand"></i> <span class="change-form-fullscreen-label">ملء الشاشة</span></button>
                    </div>
                    <button type="button" onclick="this.closest('.modal-overlay').remove()" class="modal-close" style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #fff; opacity: 0.9; background: transparent; border: none; cursor: pointer; padding: 0.5rem;"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body change-form-modal-body" style="background: var(--bg-primary, #fff); overflow-y: auto; flex: 1;">
                    <div class="change-form-request-number-bar" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.75rem 1rem; margin-bottom:1rem; background: var(--bg-secondary); border-radius:10px; border: 1px solid var(--border-color);">
                        <span style="font-weight:600; color: var(--text-primary);">رقم الطلب:</span>
                        <span id="change-form-request-number" style="font-weight:700; color: var(--primary-color); font-size:1.1rem;">جاري التحميل...</span>
                    </div>
                    <form id="change-request-form" onsubmit="ChangeManagement.handleCreateSubmit(event)">
                        <input type="hidden" name="docRowsCount" value="${docTypes.length}">
                        <div class="change-form-section change-form-section-card" data-section="1">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">1</span> <i class="fas fa-file-alt ml-2"></i> بيانات الطلب</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="form-label">التاريخ *</label>
                                    <input type="date" name="requestedAt" class="form-input" required>
                                </div>
                                <div>
                                    <label class="form-label">من / إدارة *</label>
                                    <input type="text" name="fromDepartment" class="form-input" required placeholder="الإدارة الطالبة">
                                </div>
                                <div>
                                    <label class="form-label">المصنع</label>
                                    <select name="factoryId" id="change-form-factory" class="form-select">
                                        <option value="">اختر المصنع</option>
                                    </select>
                                    <input type="hidden" name="factoryName" id="change-form-factory-name" value="">
                                </div>
                                <div>
                                    <label class="form-label">الموقع الفرعي</label>
                                    <select name="subLocationId" id="change-form-sub" class="form-select">
                                        <option value="">اختر الموقع الفرعي</option>
                                    </select>
                                    <input type="hidden" name="subLocationName" id="change-form-sub-name" value="">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">الموضوع *</label>
                                    <input type="text" name="title" class="form-input" required placeholder="موضوع مقترح التغيير">
                                </div>
                                <div>
                                    <label class="form-label">نوع التغيير *</label>
                                    <select name="changeType" id="change-form-type" class="form-select" required onchange="ChangeManagement.toggleFormSections()">
                                        <option value="Technical">طلب تغيير فني</option>
                                        <option value="Administrative">طلب تغيير إداري (نقل/تكليف للفنيين)</option>
                                    </select>
                                </div>
                                <div id="technical-subtype-wrap">
                                    <label class="form-label">نوع التغيير الفني المقترح</label>
                                    <div class="flex gap-4 mt-2">
                                        <label class="inline-flex items-center"><input type="radio" name="technicalChangeSubType" value="ProductionProcess" class="ml-2"> تغيير في عملية إنتاجية</label>
                                        <label class="inline-flex items-center"><input type="radio" name="technicalChangeSubType" value="NonProductionProcess" class="ml-2"> تغيير في عملية غير إنتاجية</label>
                                    </div>
                                </div>
                                <div id="administrative-fields-wrap" style="display:none;" class="md:col-span-2">
                                    <label class="form-label">نوع التغيير المقترح (إداري)</label>
                                    <div class="flex flex-wrap gap-4 mt-2">
                                        <label class="inline-flex items-center"><input type="radio" name="administrativeChangeSubType" value="AssignmentRequest" class="ml-2"> طلب تكليف</label>
                                        <label class="inline-flex items-center"><input type="radio" name="administrativeChangeSubType" value="TransferTechnicians" class="ml-2"> نقل للفنيين</label>
                                        <label class="inline-flex items-center"><input type="radio" name="administrativeChangeSubType" value="Other" class="ml-2"> أخرى</label>
                                    </div>
                                </div>
                                <div id="admin-employee-row" style="display:none;" class="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2 border-t pt-4 mt-2">
                                    <div>
                                        <label class="form-label">الكود الوظيفي (رقم الموظف) *</label>
                                        <input type="text" name="employeeCode" id="change-form-employee-code" class="form-input" placeholder="أدخل الكود ثم انقر خارج الحقل لتحميل البيانات" autocomplete="off">
                                    </div>
                                    <div>
                                        <label class="form-label">اسم الموظف</label>
                                        <input type="text" name="employeeName" id="change-form-employee-name" class="form-input" placeholder="يُملأ تلقائياً من الكود" readonly>
                                    </div>
                                    <div id="change-form-employee-card" class="md:col-span-2" style="display:none; padding:0.75rem 1rem; background: rgba(37,99,235,0.08); border-radius:10px; border: 1px solid rgba(37,99,235,0.25);">
                                        <div class="text-sm font-semibold mb-2" style="color: var(--primary-color);"><i class="fas fa-user-check ml-2"></i> بيانات الموظف</div>
                                        <div id="change-form-employee-card-body" class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm"></div>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="form-label">موقع التغيير</label>
                                        <input type="text" name="adminChangeLocation" class="form-input" placeholder="موقع التغيير">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="form-label">وصف المهام الحالية</label>
                                        <textarea name="currentTasksDescription" class="form-textarea" rows="3" placeholder="وصف المهام الحالية للموظف"></textarea>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="form-label">وصف المهام الجديدة</label>
                                        <textarea name="newTasksDescription" class="form-textarea" rows="3" placeholder="وصف المهام الجديدة بعد النقل/التكليف"></textarea>
                                    </div>
                                    <div>
                                        <label class="form-label">مسئول الإدارة / القسم الطالب للتغيير</label>
                                        <input type="text" name="responsibleRequestingDepartment" class="form-input">
                                    </div>
                                    <div>
                                        <label class="form-label">مسئول الإدارة / القسم الذي سيتم تنفيذ التغيير به</label>
                                        <input type="text" name="responsibleImplementingDepartment" class="form-input">
                                    </div>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">استمرارية التغيير المقترح</label>
                                    <div class="flex flex-wrap gap-4 mt-2">
                                        <label class="inline-flex items-center"><input type="radio" name="changeContinuity" value="Permanent" class="ml-2" checked> دائم</label>
                                        <label class="inline-flex items-center"><input type="radio" name="changeContinuity" value="Temporary" class="ml-2"> مؤقت حتى تاريخ</label>
                                        <input type="date" name="temporaryUntilDate" id="temporaryUntilDate" class="form-input" style="display:none;">
                                    </div>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">أولوية التغيير المقترح</label>
                                    <div class="flex flex-wrap gap-4 mt-2">
                                        <label class="inline-flex items-center"><input type="radio" name="priorityType" value="Normal" class="ml-2" checked> عادي</label>
                                        <label class="inline-flex items-center"><input type="radio" name="priorityType" value="Urgent" class="ml-2"> عاجل : توضيح السبب</label>
                                    </div>
                                    <textarea name="priorityUrgentReason" id="priorityUrgentReason" class="form-textarea mt-2" rows="2" placeholder="توضيح سبب العجلة" style="display:none;"></textarea>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">وصف التغيير المقترح *</label>
                                    <textarea name="description" class="form-textarea" rows="4" required placeholder="وصف تفصيلي للتغيير الفني/الإداري المقترح"></textarea>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">المستندات المرفقة</label>
                                    <textarea name="attachedDocumentsText" class="form-textarea" rows="2" placeholder="قائمة المستندات المرفقة"></textarea>
                                </div>
                                <div>
                                    <label class="form-label">إلى / إدارة (موقع التغيير)</label>
                                    <input type="text" name="toDepartment" class="form-input" placeholder="الإدارة المستهدفة">
                                </div>
                                <div>
                                    <label class="form-label">أخرى (موقع)</label>
                                    <input type="text" name="locationOther" class="form-input" placeholder="تفاصيل أخرى للموقع">
                                </div>
                            </div>
                        </div>
                        <div class="change-form-section change-form-section-card" data-section="2">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">2</span> <i class="fas fa-users-cog ml-2"></i> لجنة إدارة التغيرات</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="form-label">الإدارة / القسم الطالب للتغيير</label>
                                    <input type="text" name="requestingDepartment" class="form-input">
                                </div>
                                <div>
                                    <label class="form-label">إدارات / أقسام أخرى</label>
                                    <input type="text" name="otherDepartments" class="form-input">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">الإدارات أو الأقسام المتأثرة بالتغيير المقترح</label>
                                    <textarea name="affectedDepartments" class="form-textarea" rows="2"></textarea>
                                </div>
                            </div>
                        </div>
                        <div id="admin-health-section" style="display:none;" class="change-form-section change-form-section-card" data-section="3">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">3</span> <i class="fas fa-heartbeat ml-2"></i> الحالة الصحية للموظف</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="md:col-span-2">
                                    <label class="form-label">إصابة سابقة</label>
                                    <input type="text" name="previousInjury" class="form-input" placeholder="إن وجدت">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">أمراض مزمنة</label>
                                    <input type="text" name="chronicDiseases" class="form-input" placeholder="إن وجدت">
                                </div>
                                <div class="md:col-span-2">
                                    <label class="form-label">ملاحظات صحية</label>
                                    <textarea name="healthNotes" class="form-textarea" rows="2" placeholder="أي ملاحظات إضافية عن الحالة الصحية"></textarea>
                                </div>
                            </div>
                        </div>
                        <div id="admin-training-section" style="display:none;" class="change-form-section change-form-section-card" data-section="4">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">4</span> <i class="fas fa-graduation-cap ml-2"></i> تحديد برامج التدريب والتوعية والمتطلبات الأخرى نتيجة التغيير</h3>
                            <div class="overflow-x-auto">
                                <table class="w-full border-collapse text-sm change-form-training-table">
                                    <thead>
                                        <tr>
                                            <th class="p-2 border text-right font-semibold">المتطلبات / المرفقات</th>
                                            <th class="p-2 border text-right font-semibold">تاريخ مخطط</th>
                                            <th class="p-2 border text-right font-semibold">مسئول التنفيذ</th>
                                            <th class="p-2 border text-right font-semibold">تاريخ التنفيذ</th>
                                            <th class="p-2 border text-right font-semibold">ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td class="p-2 border">توعية بالموقع الجديد والمخاطر المحتملة</td><td class="p-2 border"><input type="date" name="trainingReq_0_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_0_responsible" class="form-input form-input-sm" placeholder="مسئول التنفيذ"></td><td class="p-2 border"><input type="date" name="trainingReq_0_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_0_notes" class="form-input form-input-sm" placeholder="ملاحظات"></td></tr>
                                        <tr><td class="p-2 border">تدريب على رأس العمل للمهام الجديدة</td><td class="p-2 border"><input type="date" name="trainingReq_1_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_1_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_1_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_1_notes" class="form-input form-input-sm"></td></tr>
                                        <tr><td class="p-2 border">توعية بتحليل المخاطر ووسائل التحكم تتضمن PPE</td><td class="p-2 border"><input type="date" name="trainingReq_2_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_2_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_2_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_2_notes" class="form-input form-input-sm"></td></tr>
                                        <tr><td class="p-2 border">توعية على خطة الطوارئ</td><td class="p-2 border"><input type="date" name="trainingReq_3_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_3_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_3_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_3_notes" class="form-input form-input-sm"></td></tr>
                                        <tr><td class="p-2 border">فحوص طبية قبل تنفيذ النقل / التكليف</td><td class="p-2 border"><input type="date" name="trainingReq_4_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_4_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_4_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_4_notes" class="form-input form-input-sm"></td></tr>
                                        <tr><td class="p-2 border">فحوص طبية دورية</td><td class="p-2 border"><input type="date" name="trainingReq_5_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_5_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_5_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_5_notes" class="form-input form-input-sm"></td></tr>
                                        <tr><td class="p-2 border">خطة التدريب / مصفوفة التدريب</td><td class="p-2 border"><input type="date" name="trainingReq_6_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_6_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_6_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_6_notes" class="form-input form-input-sm"></td></tr>
                                        <tr><td class="p-2 border"><input type="text" name="trainingReq_7_other" class="form-input form-input-sm" placeholder="أخرى — حدد المتطلب"></td><td class="p-2 border"><input type="date" name="trainingReq_7_plannedDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_7_responsible" class="form-input form-input-sm"></td><td class="p-2 border"><input type="date" name="trainingReq_7_executionDate" class="form-input form-input-sm w-full"></td><td class="p-2 border"><input type="text" name="trainingReq_7_notes" class="form-input form-input-sm"></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div id="documents-table-section" class="change-form-section change-form-section-card" data-section="5">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">5</span> <i class="fas fa-file-contract ml-2"></i> الوثائق والمستندات المتعلقة بالسلامة والصحة المهنية والبيئة المطلوب تعديلها</h3>
                            <div class="overflow-x-auto">
                                <table class="w-full border-collapse text-sm">
                                    <thead>
                                        <tr class="bg-gray-100">
                                            <th class="p-2 border text-right">نوع الوثيقة / المستند</th>
                                            <th class="p-2 border text-right">اسم الوثيقة / المستند</th>
                                            <th class="p-2 border text-right">كود الوثيقة / المستند</th>
                                            <th class="p-2 border text-right">المسئول عن التعديل</th>
                                            <th class="p-2 border text-right">التاريخ المخطط للتعديل</th>
                                        </tr>
                                    </thead>
                                    <tbody>${docRows}</tbody>
                                </table>
                            </div>
                        </div>
                        <div class="change-form-section change-form-section-card" data-section="6">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">6</span> <i class="fas fa-user-friends ml-2"></i> أعضاء لجنة دراسة التغييرات</h3>
                            <textarea name="committeeMembersJson" class="form-textarea" rows="3" placeholder="أسماء الأعضاء (سطر لكل عضو أو قائمة مفصولة بفاصلة)"></textarea>
                        </div>
                        <div class="change-form-section change-form-section-card" data-section="7">
                            <h3 class="change-form-section-title"><span class="change-form-section-num">7</span> <i class="fas fa-clipboard-check ml-2"></i> توصيات لجنة دراسة التغييرات</h3>
                            <textarea name="committeeRecommendations" class="form-textarea" rows="3" placeholder="توصيات اللجنة (إن وجدت)"></textarea>
                        </div>
                        <div class="change-form-section change-form-section-card grid grid-cols-1 md:grid-cols-2 gap-4" data-section="8">
                            <h3 class="change-form-section-title w-full" style="grid-column: 1 / -1;"><span class="change-form-section-num">8</span> <i class="fas fa-exclamation-triangle ml-2"></i> تقييم المخاطر والتنفيذ</h3>
                            <div>
                                <label class="form-label">تقييم المخاطر</label>
                                <textarea name="riskAssessment" class="form-textarea" rows="2"></textarea>
                            </div>
                            <div>
                                <label class="form-label">إجراءات التخفيف</label>
                                <textarea name="mitigationActions" class="form-textarea" rows="2"></textarea>
                            </div>
                            <div>
                                <label class="form-label">تاريخ مستهدف للتنفيذ</label>
                                <input type="date" name="dueDate" class="form-input">
                            </div>
                        </div>
                        <div class="modal-footer mt-4 flex gap-2 justify-center" style="border-top: 1px solid var(--border-color, #e5e7eb); padding-top: 1rem;">
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">إلغاء</button>
                            <button type="submit" class="btn-primary" style="background: var(--primary-color, #2563eb);"><i class="fas fa-save ml-2"></i> حفظ الطلب</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const today = new Date().toISOString().slice(0, 10);
        const dateInput = modal.querySelector('input[name="requestedAt"]');
        if (dateInput) dateInput.value = today;
        this.toggleFormSections();
        this.fetchAndShowNextRequestNumber(modal);
        this.fillFactoryAndSubLocationOptions(modal);
        this.setupChangeFormModalDragAndFullscreen(modal);
        const employeeCodeInput = modal.querySelector('#change-form-employee-code');
        if (employeeCodeInput) {
            employeeCodeInput.addEventListener('blur', () => this.lookupEmployeeByCode());
            employeeCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.lookupEmployeeByCode(); } });
        }
        modal.querySelectorAll('input[name="changeContinuity"]').forEach(r => {
            r.addEventListener('change', function() {
                const t = modal.querySelector('#temporaryUntilDate');
                if (t) t.style.display = this.value === 'Temporary' ? 'block' : 'none';
            });
        });
        modal.querySelectorAll('input[name="priorityType"]').forEach(r => {
            r.addEventListener('change', function() {
                const t = modal.querySelector('#priorityUrgentReason');
                if (t) t.style.display = this.value === 'Urgent' ? 'block' : 'none';
            });
        });
    },

    /** تبديل ملء الشاشة / استعادة لنموذج مقترح التغيير فقط */
    toggleChangeFormFullscreen(btn) {
        const modalContent = btn && btn.closest ? btn.closest('.change-form-modal') : null;
        if (!modalContent) return;
        const isFull = modalContent.classList.toggle('change-form-modal-fullscreen');
        const icon = btn.querySelector('i');
        const label = btn.querySelector('.change-form-fullscreen-label');
        if (icon) icon.className = isFull ? 'fas fa-compress' : 'fas fa-expand';
        if (label) label.textContent = isFull ? 'استعادة' : 'ملء الشاشة';
        btn.setAttribute('title', isFull ? 'استعادة' : 'ملء الشاشة');
    },

    /** تحريك النموذج بالسحب وزر ملء الشاشة */
    setupChangeFormModalDragAndFullscreen(modal) {
        const content = modal.querySelector('.change-form-modal.change-form-modal-draggable');
        const dragHandle = modal.querySelector('.change-form-drag-handle');
        const fullscreenBtn = modal.querySelector('.change-form-btn-fullscreen');
        if (!content || !dragHandle) return;

        let isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
        dragHandle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = content.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            content.style.position = 'fixed';
            content.style.left = startLeft + 'px';
            content.style.top = startTop + 'px';
            content.style.margin = '0';
        });
        const onMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            content.style.left = (startLeft + dx) + 'px';
            content.style.top = (startTop + dy) + 'px';
        };
        const onUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                content.classList.toggle('change-form-modal-fullscreen');
                const icon = fullscreenBtn.querySelector('i');
                if (icon) {
                    icon.className = content.classList.contains('change-form-modal-fullscreen') ? 'fas fa-compress' : 'fas fa-expand';
                }
                fullscreenBtn.title = content.classList.contains('change-form-modal-fullscreen') ? 'استعادة الحجم' : 'ملء الشاشة';
            });
        }
    },

    /** ملء قوائم المصنع والموقع الفرعي من قاعدة البيانات (observationSites / Form_Sites & Form_Places) */
    fillFactoryAndSubLocationOptions(modal) {
        const container = modal && modal.querySelector ? modal : document;
        const factorySelect = container.querySelector('#change-form-factory');
        const subSelect = container.querySelector('#change-form-sub');
        const factoryNameInput = container.querySelector('#change-form-factory-name');
        const subNameInput = container.querySelector('#change-form-sub-name');
        if (!factorySelect || !subSelect) return;

        const sites = (typeof AppState !== 'undefined' && AppState.appData && Array.isArray(AppState.appData.observationSites))
            ? AppState.appData.observationSites
            : [];
        factorySelect.innerHTML = '<option value="">اختر المصنع</option>';
        sites.forEach(site => {
            const id = String(site.id || '').trim();
            const name = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(site.name || '')) : String(site.name || '');
            if (id && name) factorySelect.appendChild(new Option(name, id));
        });

        subSelect.innerHTML = '<option value="">اختر الموقع الفرعي</option>';
        if (factoryNameInput) factoryNameInput.value = '';
        if (subNameInput) subNameInput.value = '';

        const updateSubLocations = () => {
            const siteId = String(factorySelect.value || '').trim();
            subSelect.innerHTML = '<option value="">اختر الموقع الفرعي</option>';
            if (subNameInput) subNameInput.value = '';
            const selectedOpt = factorySelect.options[factorySelect.selectedIndex];
            if (factoryNameInput) factoryNameInput.value = selectedOpt ? selectedOpt.text : '';
            if (!siteId) return;
            const site = sites.find(s => String(s.id || '').trim() === siteId);
            const places = (site && Array.isArray(site.places)) ? site.places : [];
            places.forEach(place => {
                const pid = String(place.id || '').trim();
                const pname = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(place.name || '')) : String(place.name || '');
                if (pid && pname) subSelect.appendChild(new Option(pname, pid));
            });
        };

        factorySelect.addEventListener('change', () => {
            updateSubLocations();
        });

        subSelect.addEventListener('change', () => {
            const opt = subSelect.options[subSelect.selectedIndex];
            if (subNameInput) subNameInput.value = opt ? opt.text : '';
        });
    },

    async fetchAndShowNextRequestNumber(modal) {
        const el = modal ? modal.querySelector('#change-form-request-number') : document.getElementById('change-form-request-number');
        if (!el) return;
        try {
            const response = await GoogleIntegration.sendRequest({ action: 'getNextChangeRequestNumber', data: {} });
            if (response && response.success && response.data && response.data.requestNumber) {
                el.textContent = response.data.requestNumber;
                el.style.color = 'var(--primary-color)';
            } else {
                el.textContent = 'سيُعيّن عند الحفظ';
            }
        } catch (e) {
            el.textContent = 'سيُعيّن عند الحفظ';
        }
    },

    lookupEmployeeByCode() {
        const codeInput = document.getElementById('change-form-employee-code');
        const nameInput = document.getElementById('change-form-employee-name');
        const card = document.getElementById('change-form-employee-card');
        const cardBody = document.getElementById('change-form-employee-card-body');
        if (!codeInput || !nameInput || !card) return;
        const code = String(codeInput.value || '').trim();
        if (!code) {
            nameInput.value = '';
            if (cardBody) cardBody.innerHTML = '';
            card.style.display = 'none';
            return;
        }
        const employees = (typeof AppState !== 'undefined' && AppState.appData && Array.isArray(AppState.appData.employees)) ? AppState.appData.employees : [];
        const emp = employees.find(e => {
            const n = e.employeeNumber != null ? String(e.employeeNumber).trim() : '';
            const id = e.id != null ? String(e.id).trim() : '';
            return n === code || id === code;
        });
        if (emp) {
            nameInput.value = emp.name || '';
            if (cardBody) {
                const esc = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(v || '—')) : String(v || '—');
                cardBody.innerHTML = `
                    <div><span style="color: var(--text-secondary);">الاسم:</span> <strong>${esc(emp.name)}</strong></div>
                    <div><span style="color: var(--text-secondary);">القسم:</span> ${esc(emp.department)}</div>
                    <div><span style="color: var(--text-secondary);">الوظيفة:</span> ${esc(emp.job)}</div>
                    <div><span style="color: var(--text-secondary);">الموقع:</span> ${esc(emp.location || emp.branch)}</div>
                `;
            }
            card.style.display = 'block';
            if (typeof Notification !== 'undefined' && Notification.success) Notification.success('تم تحميل بيانات الموظف');
        } else {
            nameInput.value = '';
            if (cardBody) cardBody.innerHTML = '';
            card.style.display = 'none';
            if (code && typeof Notification !== 'undefined' && Notification.warning) Notification.warning('لم يتم العثور على موظف بهذا الكود');
        }
    },

    /** تفاعل القائمة المنسدلة: إظهار/إخفاء أقسام الفني أو الإداري حسب نوع الطلب */
    toggleFormSections() {
        const sel = document.getElementById('change-form-type');
        const isTechnical = sel && sel.value === 'Technical';
        const isAdmin = sel && sel.value === 'Administrative';

        const technicalSubtypeWrap = document.getElementById('technical-subtype-wrap');
        const documentsTableSection = document.getElementById('documents-table-section');
        const administrativeFieldsWrap = document.getElementById('administrative-fields-wrap');
        const adminEmployeeRow = document.getElementById('admin-employee-row');
        const adminHealthSection = document.getElementById('admin-health-section');
        const adminTrainingSection = document.getElementById('admin-training-section');

        if (technicalSubtypeWrap) technicalSubtypeWrap.style.display = isTechnical ? 'block' : 'none';
        if (documentsTableSection) documentsTableSection.style.display = isTechnical ? 'block' : 'none';
        if (administrativeFieldsWrap) administrativeFieldsWrap.style.display = isAdmin ? 'block' : 'none';
        if (adminEmployeeRow) adminEmployeeRow.style.display = isAdmin ? 'block' : 'none';
        if (adminHealthSection) adminHealthSection.style.display = isAdmin ? 'block' : 'none';
        if (adminTrainingSection) adminTrainingSection.style.display = isAdmin ? 'block' : 'none';
    },

    toggleTechnicalSubType() {
        this.toggleFormSections();
    },

    async handleCreateSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        const user = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : {};
        const priorityType = fd.get('priorityType') || 'Normal';
        const priority = priorityType === 'Urgent' ? '2-High' : '3-Medium';
        const requestedAt = fd.get('requestedAt') || new Date().toISOString().slice(0, 10);

        const docRowsCount = parseInt(form.querySelector('input[name="docRowsCount"]')?.value || '5', 10);
        const documentsToAmend = [];
        for (let i = 0; i < docRowsCount; i++) {
            const docType = fd.get('docType_' + i);
            const docName = fd.get('docName_' + i);
            const docCode = fd.get('docCode_' + i);
            const docResponsible = fd.get('docResponsible_' + i);
            const docPlanDate = fd.get('docPlanDate_' + i);
            if (docType || docName || docCode || docResponsible || docPlanDate) {
                documentsToAmend.push({
                    documentType: docType || '',
                    documentName: docName || '',
                    documentCode: docCode || '',
                    responsibleForAmendment: docResponsible || '',
                    plannedAmendmentDate: docPlanDate || ''
                });
            }
        }
        let committeeMembersJson = fd.get('committeeMembersJson') || '';
        if (committeeMembersJson && typeof committeeMembersJson === 'string') {
            committeeMembersJson = committeeMembersJson.trim();
        }

        const trainingReqLabels = [
            'توعية بالموقع الجديد والمخاطر المحتملة',
            'تدريب على رأس العمل للمهام الجديدة',
            'توعية بتحليل المخاطر ووسائل التحكم تتضمن PPE',
            'توعية على خطة الطوارئ',
            'فحوص طبية قبل تنفيذ النقل / التكليف',
            'فحوص طبية دورية',
            'خطة التدريب / مصفوفة التدريب',
            null
        ];
        const trainingRequirements = [];
        for (let i = 0; i < 8; i++) {
            const requirement = i === 7 ? (fd.get('trainingReq_7_other') || '').trim() : (trainingReqLabels[i] || '');
            const plannedDate = fd.get('trainingReq_' + i + '_plannedDate') || '';
            const responsible = fd.get('trainingReq_' + i + '_responsible') || '';
            const executionDate = fd.get('trainingReq_' + i + '_executionDate') || '';
            const notes = fd.get('trainingReq_' + i + '_notes') || '';
            if (requirement || plannedDate || responsible || executionDate || notes) {
                trainingRequirements.push({
                    requirement: requirement || (trainingReqLabels[i] || 'أخرى'),
                    plannedDate: plannedDate,
                    responsible: responsible,
                    executionDate: executionDate,
                    notes: notes
                });
            }
        }

        const data = {
            title: fd.get('title'),
            description: fd.get('description'),
            changeType: fd.get('changeType') || 'Administrative',
            priority: priority,
            impact: '1-Minor',
            fromDepartment: fd.get('fromDepartment') || '',
            toDepartment: fd.get('toDepartment') || '',
            locationOther: fd.get('adminChangeLocation') || fd.get('locationOther') || '',
            technicalChangeSubType: fd.get('technicalChangeSubType') || '',
            changeContinuity: fd.get('changeContinuity') || 'Permanent',
            temporaryUntilDate: fd.get('temporaryUntilDate') || '',
            priorityUrgentReason: fd.get('priorityUrgentReason') || '',
            attachedDocumentsText: fd.get('attachedDocumentsText') || '',
            requestingDepartment: fd.get('requestingDepartment') || '',
            otherDepartments: fd.get('otherDepartments') || '',
            affectedDepartments: fd.get('affectedDepartments') || '',
            documentsToAmendJson: documentsToAmend.length ? JSON.stringify(documentsToAmend) : '',
            committeeMembersJson: committeeMembersJson,
            committeeRecommendations: fd.get('committeeRecommendations') || '',
            riskAssessment: fd.get('riskAssessment') || '',
            mitigationActions: fd.get('mitigationActions') || '',
            dueDate: fd.get('dueDate') || '',
            employeeName: fd.get('employeeName') || '',
            employeeCode: fd.get('employeeCode') || '',
            currentTasksDescription: fd.get('currentTasksDescription') || '',
            newTasksDescription: fd.get('newTasksDescription') || '',
            administrativeChangeSubType: fd.get('administrativeChangeSubType') || '',
            responsibleRequestingDepartment: fd.get('responsibleRequestingDepartment') || '',
            responsibleImplementingDepartment: fd.get('responsibleImplementingDepartment') || '',
            previousInjury: fd.get('previousInjury') || '',
            chronicDiseases: fd.get('chronicDiseases') || '',
            healthNotes: fd.get('healthNotes') || '',
            trainingRequirementsJson: trainingRequirements.length ? JSON.stringify(trainingRequirements) : '',
            requestedBy: user.name || user.email || 'غير محدد',
            requestedByEmail: user.email || '',
            requestedAt: requestedAt,
            factoryId: fd.get('factoryId') || '',
            factoryName: fd.get('factoryName') || '',
            subLocationId: fd.get('subLocationId') || '',
            subLocationName: fd.get('subLocationName') || '',
            createdBy: user.email || user.name || 'غير محدد'
        };

        const overlay = form.closest('.modal-overlay');
        if (overlay) overlay.remove();
        if (typeof Notification !== 'undefined' && Notification.info) Notification.info('جاري الحفظ...');

        (async () => {
            try {
                const response = await GoogleIntegration.sendRequest({
                    action: 'addChangeRequest',
                    data: data
                });
                if (response && response.success) {
                    if (typeof Notification !== 'undefined' && Notification.success) Notification.success('تم إضافة طلب التغيير بنجاح');
                    this.loadChangeRequests();
                } else {
                    if (typeof Notification !== 'undefined' && Notification.error) Notification.error(response?.message || 'فشل الحفظ');
                }
            } catch (err) {
                if (typeof Notification !== 'undefined' && Notification.error) Notification.error('حدث خطأ أثناء الحفظ');
            }
        })();
    },

    async showRequestDetail(requestId) {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) return;

        // محاولة استخدام البيانات المخزنة محلياً أولاً لتسريع الفتح
        let req = null;
        if (Array.isArray(this.state.lastRequests) && this.state.lastRequests.length) {
            req = this.state.lastRequests.find(r => String(r.id) === String(requestId));
        }

        // إذا لم نجدها أو أردنا أحدث نسخة من Google Sheets، نستدعي السيرفر
        if (!req) {
            if (typeof Loading !== 'undefined' && Loading.show) Loading.show('جاري تحميل التفاصيل...');
            try {
                const response = await GoogleIntegration.sendRequest({
                    action: 'getChangeRequest',
                    data: { requestId: requestId }
                });
                if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
                if (!response || !response.success || !response.data) {
                    if (typeof Notification !== 'undefined' && Notification.error) Notification.error('طلب التغيير غير موجود');
                    return;
                }
                req = response.data;
            } catch (err) {
                if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
                if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('showRequestDetail:', err);
                if (typeof Notification !== 'undefined' && Notification.error) Notification.error('حدث خطأ في تحميل التفاصيل');
                return;
            }
        }

        this.state.currentRequest = req;

        const safe = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(v || '')) : String(v || '');
        const canApprove = typeof Permissions !== 'undefined' && Permissions.hasAccess && Permissions.hasAccess('change-management');
            const isDraft = req.status === 'Draft';
            const isInReview = req.status === 'In Review';
            const isApproved = req.status === 'Approved';
            const isRejected = req.status === 'Rejected';
            const isInImpl = req.status === 'In Implementation';
            const isCompleted = req.status === 'Completed';
            const isClosed = req.status === 'Closed';

        let timeLogHTML = '';
        try {
            const log = req.timeLog;
            const arr = Array.isArray(log) ? log : (typeof log === 'string' && log ? JSON.parse(log) : []);
            if (arr.length) {
                timeLogHTML = arr.slice().reverse().map(entry => `
                        <div class="border-b border-gray-100 pb-2 mb-2 last:border-0">
                            <span class="text-sm font-medium">${safe(entry.action || '')}</span>
                            <span class="text-gray-500 text-sm"> — ${safe(entry.user || '')} — ${this.formatDate(entry.timestamp)}</span>
                            ${entry.note ? `<p class="text-sm text-gray-600 mt-1">${safe(entry.note)}</p>` : ''}
                        </div>
                    `).join('');
            } else {
                timeLogHTML = '<p class="text-gray-500 text-sm">لا يوجد سجل</p>';
            }
        } catch (e) {
            timeLogHTML = '<p class="text-gray-500 text-sm">لا يوجد سجل</p>';
        }

        const displayNumber = this.getDisplayRequestNumber(req) || (req.requestNumber || req.id || '');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header" style="display:flex;align-items:center;justify-content:center;position:relative;">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="modal-close" style="position:absolute;right:0;top:50%;transform:translateY(-50%);"><i class="fas fa-times"></i></button>
                        <h2 class="modal-title" style="margin:0;text-align:center;flex:1;">${safe(displayNumber)} — ${safe(req.title)}</h2>
                    </div>
                    <div class="modal-body" style="padding:0;">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4" style="background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(14,165,233,0.06));border-bottom:1px solid rgba(59,130,246,0.2);">
                            <div><span class="text-gray-500">الحالة:</span> <strong>${this.getStatusLabel(req.status)}</strong></div>
                            <div><span class="text-gray-500">نوع التغيير:</span> ${this.getChangeTypeLabel(req.changeType)}</div>
                            <div><span class="text-gray-500">الأولوية:</span> ${this.getPriorityLabel(req.priority)}</div>
                            <div><span class="text-gray-500">الأثر:</span> ${this.getImpactLabel(req.impact)}</div>
                            <div><span class="text-gray-500">مقدم الطلب:</span> ${safe(req.requestedBy)}</div>
                            <div><span class="text-gray-500">التاريخ:</span> ${this.formatDate(req.requestedAt || req.createdAt)}</div>
                            ${req.relatedModule ? `<div><span class="text-gray-500">الموديول المرتبط:</span> ${safe(req.relatedModule)}</div>` : ''}
                        </div>
                        <div class="p-4 mb-0" style="background:rgba(251,191,36,0.06);border-bottom:1px solid rgba(251,191,36,0.2);">
                            <span class="text-gray-500 block mb-1">الوصف:</span>
                            <p class="text-gray-800">${safe(req.description || '—')}</p>
                        </div>
                        ${(req.riskAssessment || req.mitigationActions) ? `<div class="p-4 mb-0" style="background:rgba(239,68,68,0.05);border-bottom:1px solid rgba(239,68,68,0.15);">
                            ${req.riskAssessment ? `<div class="mb-3"><span class="text-gray-500 block mb-1">تقييم المخاطر:</span><p class="text-gray-800">${safe(req.riskAssessment)}</p></div>` : ''}
                            ${req.mitigationActions ? `<div><span class="text-gray-500 block mb-1">إجراءات التخفيف:</span><p class="text-gray-800">${safe(req.mitigationActions)}</p></div>` : ''}
                        </div>` : ''}
                        <div class="p-4" style="background:rgba(148,163,184,0.08);">
                            <h3 class="font-semibold mb-2" style="background:rgba(71,85,105,0.15);padding:8px 12px;margin:-16px -16px 12px -16px;border-radius:4px;">سجل الأنشطة</h3>
                            <div class="p-3 rounded" style="background:#f8fafc;max-height:200px;overflow-y:auto;overflow-x:hidden;border:1px solid #e2e8f0;">${timeLogHTML}</div>
                        </div>
                    </div>
                    <div class="modal-footer" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:1rem 1.5rem;border-top:1px solid var(--border-color, #e5e7eb);background:var(--bg-secondary, #f9fafb);">
                        <button type="button" onclick="ChangeManagement.exportSingleRequestToPDF('${safe(req.id)}');" class="btn-secondary">
                            <i class="fas fa-file-pdf ml-1"></i> تصدير تقرير الطلب
                        </button>
                        ${isDraft && canApprove ? `<button type="button" onclick="ChangeManagement.updateRequestStatus('${safe(req.id)}','In Review'); this.closest('.modal-overlay').remove();" class="btn-primary"><i class="fas fa-paper-plane ml-2"></i> إرسال للمراجعة</button>` : ''}
                        ${isInReview && canApprove ? `
                            <button type="button" onclick="ChangeManagement.updateRequestStatus('${safe(req.id)}','Approved'); this.closest('.modal-overlay').remove();" class="btn-primary"><i class="fas fa-check ml-2"></i> موافقة</button>
                            <button type="button" onclick="ChangeManagement.rejectRequest('${safe(req.id)}');" class="btn-secondary btn-danger"><i class="fas fa-times ml-2"></i> رفض</button>
                        ` : ''}
                        ${isApproved && canApprove ? `<button type="button" onclick="ChangeManagement.updateRequestStatus('${safe(req.id)}','In Implementation'); this.closest('.modal-overlay').remove();" class="btn-primary"><i class="fas fa-play ml-2"></i> بدء التنفيذ</button>` : ''}
                        ${isInImpl && canApprove ? `<button type="button" onclick="ChangeManagement.updateRequestStatus('${safe(req.id)}','Completed'); this.closest('.modal-overlay').remove();" class="btn-primary"><i class="fas fa-check-double ml-2"></i> تم التنفيذ</button>` : ''}
                        ${(isCompleted || isInImpl) && canApprove && !isClosed ? `<button type="button" onclick="ChangeManagement.updateRequestStatus('${safe(req.id)}','Closed'); this.closest('.modal-overlay').remove();" class="btn-secondary"><i class="fas fa-lock ml-2"></i> إغلاق</button>` : ''}
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">إغلاق</button>
                    </div>
                </div>
            `;
        document.body.appendChild(modal);
    },

    async updateRequestStatus(requestId, status) {
        const user = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : {};
        const updatedBy = user.name || user.email || 'System';
        const updateData = {
            status: status,
            updatedBy: user.email || user.name || updatedBy,
            updateNote: 'تحديث الحالة إلى ' + this.getStatusLabel(status)
        };
        if (status === 'Approved') updateData.approvedBy = updatedBy;
        if (status === 'Rejected') updateData.rejectedBy = updatedBy;
        if (status === 'Completed') updateData.implementedBy = updatedBy;
        if (status === 'Closed') updateData.closedBy = updatedBy;

        try {
            const response = await GoogleIntegration.sendRequest({
                action: 'updateChangeRequest',
                data: {
                    requestId: requestId,
                    updateData: updateData
                }
            });
            if (response && response.success) {
                if (typeof Notification !== 'undefined' && Notification.success) Notification.success('تم تحديث الحالة');
                await this.loadChangeRequests();
            } else {
                if (typeof Notification !== 'undefined' && Notification.error) Notification.error(response?.message || 'فشل التحديث');
            }
        } catch (err) {
            if (typeof Notification !== 'undefined' && Notification.error) Notification.error('حدث خطأ أثناء التحديث');
        }
    },

    rejectRequest(requestId) {
        const reason = prompt('سبب الرفض (اختياري):');
        const user = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : {};
        const updatedBy = user.name || user.email || 'System';
        const updateData = {
            status: 'Rejected',
            rejectedBy: updatedBy,
            rejectionReason: reason || 'بدون سبب',
            updatedBy: user.email || user.name || updatedBy,
            updateNote: 'تم رفض الطلب'
        };
        GoogleIntegration.sendRequest({
            action: 'updateChangeRequest',
            data: { requestId: requestId, updateData: updateData }
        }).then(response => {
            if (response && response.success) {
                if (typeof Notification !== 'undefined' && Notification.success) Notification.success('تم رفض الطلب');
                this.loadChangeRequests();
            }
            document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        });
    },

    async showStatistics() {
        const btn = document.getElementById('change-btn-statistics');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري التحميل...';
        }
        if (typeof Loading !== 'undefined' && Loading.show) Loading.show('جاري تحميل الإحصائيات...');
        try {
            const response = await GoogleIntegration.sendRequest({
                action: 'getChangeRequestStatistics',
                data: { filters: this.buildFilters() }
            });
            if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
            if (!response || !response.success) {
                if (typeof Notification !== 'undefined' && Notification.error) Notification.error('فشل تحميل الإحصائيات');
                return;
            }
            const d = response.data || {};
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 700px;">
                    <div class="modal-header">
                        <h2 class="modal-title">إحصائيات إدارة التغيرات</h2>
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="modal-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div class="bg-blue-50 p-4 rounded text-center">
                                <div class="text-2xl font-bold text-blue-600">${d.total || 0}</div>
                                <div class="text-sm text-gray-600">إجمالي الطلبات</div>
                            </div>
                            <div class="bg-green-50 p-4 rounded text-center">
                                <div class="text-2xl font-bold text-green-600">${d.byStatus && d.byStatus.Approved ? d.byStatus.Approved : 0}</div>
                                <div class="text-sm text-gray-600">معتمد</div>
                            </div>
                            <div class="bg-red-50 p-4 rounded text-center">
                                <div class="text-2xl font-bold text-red-600">${d.byStatus && d.byStatus.Rejected ? d.byStatus.Rejected : 0}</div>
                                <div class="text-sm text-gray-600">مرفوض</div>
                            </div>
                            <div class="bg-teal-50 p-4 rounded text-center">
                                <div class="text-2xl font-bold text-teal-600">${d.byStatus && d.byStatus.Completed ? d.byStatus.Completed : 0}</div>
                                <div class="text-sm text-gray-600">منفذ</div>
                            </div>
                        </div>
                        <div class="mb-4">
                            <h3 class="font-semibold mb-2">حسب الحالة</h3>
                            ${this.renderStatsBars(d.byStatus)}
                        </div>
                        <div class="mb-4">
                            <h3 class="font-semibold mb-2">حسب نوع التغيير</h3>
                            ${this.renderStatsBars(d.byChangeType)}
                        </div>
                        <div>
                            <h3 class="font-semibold mb-2">حسب الأولوية</h3>
                            ${this.renderStatsBars(d.byPriority)}
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (err) {
            if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
            if (typeof Notification !== 'undefined' && Notification.error) Notification.error('حدث خطأ في تحميل الإحصائيات');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fas fa-chart-bar ml-2"></i> الإحصائيات';
            }
        }
    },

    renderStatsBars(obj) {
        if (!obj || typeof obj !== 'object') return '<p class="text-gray-500">لا توجد بيانات</p>';
        const total = Object.values(obj).reduce((a, b) => a + b, 0);
        if (total === 0) return '<p class="text-gray-500">لا توجد بيانات</p>';
        return Object.entries(obj).map(([key, count]) => {
            const pct = total > 0 ? (count / total * 100).toFixed(1) : 0;
            const label = this.getStatusLabel(key) || this.getChangeTypeLabel(key) || this.getPriorityLabel(key) || key;
            return `
                <div class="mb-2">
                    <div class="flex justify-between text-sm mb-1">
                        <span>${label}</span>
                        <span>${count} (${pct}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    getModuleOptions() {
        const list = ['incidents', 'nearmiss', 'ptw', 'training', 'clinic', 'fire-equipment', 'ppe', 'violations', 'contractors', 'daily-observations', 'risk-assessment', 'sop-jha', 'action-tracking', 'settings', 'Other'];
        return list.map(m => `<option value="${m}">${m}</option>`).join('');
    },

    /** وصف الخطوة الحالية في دائرة الاعتماد */
    getCurrentApprovalStepLabel(req) {
        try {
            let flow = [];
            if (Array.isArray(req.approvalFlowJson)) {
                flow = req.approvalFlowJson;
            } else if (typeof req.approvalFlowJson === 'string' && req.approvalFlowJson) {
                try { flow = JSON.parse(req.approvalFlowJson); } catch (e) { flow = []; }
            }
            if (!flow || !flow.length) {
                return { stepLabel: 'غير محدد', statusLabel: this.getStatusLabel(req.status) };
            }
            const pending = flow.find(s => s && s.status === 'pending');
            const rejected = flow.find(s => s && s.status === 'rejected');
            const step = pending || rejected || flow[flow.length - 1];

            let stepLabel = step && step.name ? step.name : 'غير محدد';
            let statusLabel = '';
            const status = (step && step.status) || '';
            if (status === 'pending') statusLabel = 'قيد الاعتماد';
            else if (status === 'approved') statusLabel = 'معتمد';
            else if (status === 'rejected') statusLabel = 'مرفوض';
            else statusLabel = this.getStatusLabel(req.status);

            return { stepLabel, statusLabel };
        } catch (e) {
            return { stepLabel: 'غير محدد', statusLabel: this.getStatusLabel(req.status) };
        }
    },

    getStatusLabel(s) {
        const labels = { 'Draft': 'مسودة', 'In Review': 'قيد المراجعة', 'Approved': 'معتمد', 'Rejected': 'مرفوض', 'In Implementation': 'قيد التنفيذ', 'Completed': 'منفذ', 'Closed': 'مغلق' };
        return labels[s] || s;
    },

    getChangeTypeLabel(s) {
        const labels = { 'Technical': 'تقني', 'Administrative': 'إداري', 'Organizational': 'تنظيمي' };
        return labels[s] || s;
    },

    getPriorityLabel(s) {
        const labels = { '1-VeryHigh': 'عالي جداً', '2-High': 'عالي', '3-Medium': 'متوسط', '4-Low': 'منخفض' };
        return labels[s] || s;
    },

    getImpactLabel(s) {
        const labels = { '1-Minor': 'بسيط', '2-Major': 'كبير', '3-Critical': 'حرج' };
        return labels[s] || s;
    },

    formatDate(dateString) {
        if (!dateString) return '—';
        try {
            return new Date(dateString).toLocaleDateString('ar-SA');
        } catch (e) {
            return dateString;
        }
    },

    /** تفاصيل الطلب كاملة للتصدير */
    getExportData() {
        const list = this.state.lastRequests || [];
        return list.map(r => {
            const desc = r.description || '';
            const adminSub = r.administrativeChangeSubType ? (r.administrativeChangeSubType === 'AssignmentRequest' ? 'طلب تكليف' : r.administrativeChangeSubType === 'TransferTechnicians' ? 'نقل للفنيين' : 'أخرى') : '';
            const techSub = r.technicalChangeSubType ? (r.technicalChangeSubType === 'ProductionProcess' ? 'عملية إنتاجية' : 'عملية غير إنتاجية') : '';
            const displayNumber = this.getDisplayRequestNumber(r);
            return {
                'رقم الطلب (MOC)': displayNumber || r.requestNumber || r.id,
                'رقم النظام (CRQ)': r.id || '',
                'التاريخ': this.formatDate(r.requestedAt || r.createdAt),
                'الموضوع': r.title || '—',
                'نوع التغيير': this.getChangeTypeLabel(r.changeType),
                'نوع فرعي (فني/إداري)': techSub || adminSub || '—',
                'الحالة': this.getStatusLabel(r.status),
                'الأولوية': this.getPriorityLabel(r.priority),
                'الأثر': this.getImpactLabel(r.impact),
                'مقدم الطلب': r.requestedBy || '—',
                'من إدارة': r.fromDepartment || '—',
                'إلى إدارة': r.toDepartment || '—',
                'المصنع': r.factoryName || '—',
                'الموقع الفرعي': r.subLocationName || '—',
                'موقع آخر': r.locationOther || '—',
                'استمرارية التغيير': r.changeContinuity === 'Permanent' ? 'دائم' : (r.changeContinuity === 'Temporary' ? 'مؤقت' : '—'),
                'تاريخ انتهاء المؤقت': this.formatDate(r.temporaryUntilDate),
                'سبب العجلة': r.priorityUrgentReason || '—',
                'الوصف الكامل': desc,
                'المستندات المرفقة': r.attachedDocumentsText || '—',
                'الإدارة الطالبة': r.requestingDepartment || '—',
                'إدارات أخرى': r.otherDepartments || '—',
                'الإدارات المتأثرة': r.affectedDepartments || '—',
                'توصيات اللجنة': r.committeeRecommendations || '—',
                'تقييم المخاطر': r.riskAssessment || '—',
                'إجراءات التخفيف': r.mitigationActions || '—',
                'تاريخ مستهدف للتنفيذ': this.formatDate(r.dueDate),
                'اسم الموظف': r.employeeName || '—',
                'كود الموظف': r.employeeCode || '—',
                'المهام الحالية': r.currentTasksDescription || '—',
                'المهام الجديدة': r.newTasksDescription || '—',
                'مسئول الطالب': r.responsibleRequestingDepartment || '—',
                'مسئول المنفذ': r.responsibleImplementingDepartment || '—',
                'إصابة سابقة': r.previousInjury || '—',
                'أمراض مزمنة': r.chronicDiseases || '—',
                'ملاحظات صحية': r.healthNotes || '—',
                'سبب الرفض': r.rejectionReason || '—'
            };
        });
    },

    /** هيدر وفوتر التصدير كما في نماذج النظام (اسم الشركة، الشعار، تاريخ التصدير) */
    getExportHeaderFooter() {
        const companyName = (typeof AppState !== 'undefined' && AppState.companySettings && AppState.companySettings.name)
            ? String(AppState.companySettings.name).trim()
            : (typeof AppState !== 'undefined' && AppState.companyName) ? String(AppState.companyName).trim() : '';
        const logoUrl = (typeof AppState !== 'undefined' && (AppState.companyLogo || (AppState.companySettings && AppState.companySettings.logo)))
            ? (AppState.companyLogo || AppState.companySettings.logo || '')
            : '';
        const reportTitle = 'طلبات التغيير - إدارة التغيرات';
        const exportDate = this.formatDate(new Date().toISOString());
        const formatDateTime = (typeof Utils !== 'undefined' && Utils.formatDateTime) ? Utils.formatDateTime : (d) => this.formatDate(d);
        const exportDateTime = formatDateTime(new Date().toISOString());
        return { companyName, logoUrl, reportTitle, exportDate, exportDateTime };
    },

    exportToExcel() {
        try {
            const data = this.getExportData();
            if (!data || data.length === 0) {
                if (typeof Notification !== 'undefined') Notification.warning('لا توجد بيانات للتصدير');
                return;
            }
            if (typeof XLSX === 'undefined') {
                if (typeof Notification !== 'undefined') Notification.error('مكتبة Excel غير متاحة. يرجى تحديث الصفحة والمحاولة مرة أخرى');
                return;
            }
            if (typeof Loading !== 'undefined') Loading.show('جاري إنشاء ملف Excel...');
            const hf = this.getExportHeaderFooter();
            const headerRows = [
                [hf.companyName || 'إدارة التغيرات'],
                [hf.reportTitle],
                ['تاريخ التصدير: ' + hf.exportDateTime],
                []
            ];
            const colHeaders = Object.keys(data[0] || {});
            const dataRows = data.map(r => colHeaders.map(k => (r[k] != null && r[k] !== undefined ? String(r[k]) : '')));
            const footerRow = colHeaders.map((_, i) => (i === 0 ? '— تم التصدير في ' + hf.exportDateTime + ' —' : ''));
            const aoa = headerRows.concat([colHeaders], dataRows, [footerRow]);
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            const wideKeys = ['الوصف الكامل', 'المستندات المرفقة', 'المهام الحالية', 'المهام الجديدة', 'توصيات اللجنة', 'تقييم المخاطر', 'إجراءات التخفيف', 'سبب العجلة', 'سبب الرفض'];
            ws['!cols'] = colHeaders.map(k => ({ wch: wideKeys.indexOf(k) >= 0 ? 45 : (k.length > 12 ? 22 : 14) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'طلبات التغيير');
            const name = `طلبات_التغيير_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, name);
            if (typeof Loading !== 'undefined') Loading.hide();
            if (typeof Notification !== 'undefined') Notification.success('تم تصدير البيانات إلى Excel بنجاح');
        } catch (err) {
            if (typeof Loading !== 'undefined') Loading.hide();
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('تصدير Excel:', err);
            if (typeof Notification !== 'undefined') Notification.error('فشل التصدير: ' + (err.message || err));
        }
    },

    exportToPDF() {
        try {
            const data = this.getExportData();
            if (!data || data.length === 0) {
                if (typeof Notification !== 'undefined') Notification.warning('لا توجد بيانات للتصدير');
                return;
            }
            if (typeof Loading !== 'undefined') Loading.show('جاري إنشاء PDF...');
            const hf = this.getExportHeaderFooter();
            const safe = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(v || '')) : String(v || '');

            if (typeof window.jsPDF !== 'undefined') {
                const { jsPDF } = window.jsPDF;
                const doc = new jsPDF('l', 'mm', 'a4');
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();

                doc.setFontSize(10);
                if (hf.companyName) doc.text(hf.companyName, pageW / 2, 10, { align: 'center' });
                doc.setFontSize(14);
                doc.setFont(undefined, 'bold');
                doc.text(hf.reportTitle, pageW / 2, hf.companyName ? 18 : 12, { align: 'center' });
                doc.setFont(undefined, 'normal');
                doc.setFontSize(9);
                doc.text('تاريخ التصدير: ' + hf.exportDateTime + '  |  عدد الطلبات: ' + data.length, 14, hf.companyName ? 25 : 20);
                const startY = hf.companyName ? 30 : 25;

                const colHeaders = Object.keys(data[0] || {});
                const headers = colHeaders;
                const rows = data.map(r => colHeaders.map(k => String(r[k] != null && r[k] !== undefined ? r[k] : '—')));
                const footerText = hf.companyName ? hf.companyName + ' — ' + hf.reportTitle + ' — تم التصدير في ' + hf.exportDateTime : 'تم التصدير في ' + hf.exportDateTime;

                if (typeof doc.autoTable !== 'undefined') {
                    doc.autoTable({
                        head: [headers],
                        body: rows,
                        startY: startY,
                        styles: { fontSize: 5, cellPadding: 1 },
                        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 5 },
                        alternateRowStyles: { fillColor: [245, 247, 250] },
                        margin: { left: 8, right: 8 },
                        overflow: 'linebreak',
                        didDrawPage: (data) => {
                            doc.setFontSize(8);
                            doc.setTextColor(128, 128, 128);
                            doc.text(footerText, pageW / 2, pageH - 10, { align: 'center' });
                            doc.setTextColor(0, 0, 0);
                        }
                    });
                } else {
                    let y = startY;
                    rows.forEach((row) => {
                        if (y > pageH - 25) { doc.addPage('l', 'a4'); y = 20; }
                        doc.setFontSize(5);
                        doc.text(row.join(' | '), 8, y, { maxWidth: pageW - 16 });
                        y += 5;
                    });
                    doc.setFontSize(8);
                    doc.setTextColor(128, 128, 128);
                    doc.text(footerText, pageW / 2, pageH - 10, { align: 'center' });
                }
                doc.save(`طلبات_التغيير_${new Date().toISOString().slice(0, 10)}.pdf`);
            } else {
                const logoHtml = hf.logoUrl ? `<img src="${safe(hf.logoUrl)}" alt="" style="max-height:48px; max-width:120px; object-fit:contain;">` : '';
                const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${safe(hf.reportTitle)}</title>
<style>
@page { margin: 1.5cm; }
body { font-family: 'Cairo', Tahoma, sans-serif; margin: 0; padding: 15px; }
.export-header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 15px; }
.export-header .company-name { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 4px; }
.export-header .report-title { font-size: 16px; color: #2563eb; }
.export-header .export-meta { font-size: 11px; color: #666; margin-top: 6px; }
.export-footer { text-align: center; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 15px; font-size: 10px; color: #666; }
table { border-collapse: collapse; width: 100%; font-size: 9px; table-layout: fixed; }
th, td { border: 1px solid #ddd; padding: 6px; text-align: right; }
th { background: #2563eb; color: #fff; }
tr:nth-child(even) { background: #f5f7fa; }
</style></head><body>
<div class="export-header">
  ${logoHtml}
  ${hf.companyName ? '<div class="company-name">' + safe(hf.companyName) + '</div>' : ''}
  <div class="report-title">${safe(hf.reportTitle)}</div>
  <div class="export-meta">تاريخ التصدير: ${safe(hf.exportDateTime)}  |  عدد الطلبات: ${data.length}</div>
</div>
<table><thead><tr>${(Object.keys(data[0] || {})).map(k => '<th>' + safe(k) + '</th>').join('')}</tr></thead><tbody>
${data.map(r => '<tr>' + (Object.keys(data[0] || {})).map(k => '<td>' + safe(r[k]) + '</td>').join('') + '</tr>').join('')}
</tbody></table>
<div class="export-footer">${safe(hf.companyName || '')} ${hf.companyName ? '— ' : ''}${safe(hf.reportTitle)} — تم التصدير في ${safe(hf.exportDateTime)}</div>
</body></html>`;
                const win = window.open('', '_blank');
                win.document.write(html);
                win.document.close();
                win.print();
                win.onafterprint = () => win.close();
            }
            if (typeof Loading !== 'undefined') Loading.hide();
            if (typeof Notification !== 'undefined') Notification.success('تم تصدير البيانات إلى PDF بنجاح');
        } catch (err) {
            if (typeof Loading !== 'undefined') Loading.hide();
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('تصدير PDF:', err);
            if (typeof Notification !== 'undefined') Notification.error('فشل التصدير: ' + (err.message || err));
        }
    },

    /**
     * تنفيذ إجراء اعتماد / رفض على خطوة دائرة الاعتماد الحالية
     */
    async handleApprovalAction(requestId, decision) {
        try {
            if (!requestId || (decision !== 'approve' && decision !== 'reject')) return;
            const user = (typeof AppState !== 'undefined' && AppState.currentUser) ? AppState.currentUser : {};
            const approverName = user.name || user.email || 'غير محدد';
            const approverEmail = user.email || user.id || '';

            let rejectionReason = '';
            if (decision === 'reject') {
                rejectionReason = window.prompt('برجاء توضيح سبب الرفض:', '') || 'بدون سبب';
            }

            if (typeof Loading !== 'undefined' && Loading.show) Loading.show('جاري تحديث حالة الاعتماد...');

            // الحصول على آخر نسخة من الطلب من الخادم
            const response = await GoogleIntegration.sendRequest({
                action: 'getChangeRequest',
                data: { requestId }
            });
            if (!response || !response.success || !response.data) {
                if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
                if (typeof Notification !== 'undefined' && Notification.error) Notification.error('تعذر تحميل بيانات الطلب');
                return;
            }
            const req = response.data;

            let flow = [];
            if (Array.isArray(req.approvalFlowJson)) {
                flow = req.approvalFlowJson;
            } else if (typeof req.approvalFlowJson === 'string' && req.approvalFlowJson) {
                try { flow = JSON.parse(req.approvalFlowJson); } catch (e) { flow = []; }
            }
            if (!flow || !flow.length) {
                if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
                if (typeof Notification !== 'undefined' && Notification.warning) Notification.warning('لا توجد دائرة اعتماد معرفة لهذا الطلب');
                return;
            }

            const pendingIndex = flow.findIndex(s => s && s.status === 'pending');
            if (pendingIndex === -1) {
                if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
                if (typeof Notification !== 'undefined' && Notification.info) Notification.info('لا توجد خطوة قيد الاعتماد حالياً');
                return;
            }

            const step = flow[pendingIndex];
            const nowIso = new Date().toISOString();

            if (decision === 'approve') {
                step.status = 'approved';
                step.approvedByEmail = approverEmail;
                step.approvedByName = approverName;
                step.approvedAt = nowIso;
            } else {
                step.status = 'rejected';
                step.rejectedByEmail = approverEmail;
                step.rejectedByName = approverName;
                step.rejectedAt = nowIso;
                step.rejectionReason = rejectionReason;
            }

            // إعادة حساب حالة الاعتماد العامة
            let approvalStatus = 'in_progress';
            let currentApprovalStep = '';
            let newStatus = req.status || 'Draft';
            const hasRejected = flow.some(s => s && s.status === 'rejected');
            let nextPending = null;
            if (!hasRejected) {
                nextPending = flow.find(s => s && s.status === 'pending');
            }

            if (hasRejected) {
                approvalStatus = 'rejected';
                const rejectedStep = flow.find(s => s && s.status === 'rejected');
                currentApprovalStep = rejectedStep && rejectedStep.id ? rejectedStep.id : '';
                newStatus = 'Rejected';
            } else if (!nextPending) {
                approvalStatus = 'approved';
                currentApprovalStep = '';
                if (newStatus === 'Draft' || newStatus === 'In Review' || !newStatus) {
                    newStatus = 'Approved';
                }
            } else {
                approvalStatus = 'in_progress';
                currentApprovalStep = nextPending.id || '';
                if (newStatus === 'Draft') {
                    newStatus = 'In Review';
                }
            }

            const updateData = {
                approvalFlowJson: JSON.stringify(flow),
                approvalStatus: approvalStatus,
                currentApprovalStep: currentApprovalStep,
                status: newStatus,
                updatedBy: approverEmail || approverName,
                updateNote: decision === 'approve'
                    ? 'اعتماد خطوة في دائرة اعتماد إدارة التغيرات'
                    : 'رفض خطوة في دائرة اعتماد إدارة التغيرات'
            };

            if (approvalStatus === 'approved') {
                updateData.approvedBy = approverName;
                updateData.approvedAt = nowIso;
            }
            if (approvalStatus === 'rejected') {
                updateData.rejectedBy = approverName;
                updateData.rejectedAt = nowIso;
                updateData.rejectionReason = rejectionReason;
            }

            const updateResponse = await GoogleIntegration.sendRequest({
                action: 'updateChangeRequest',
                data: {
                    requestId: requestId,
                    updateData: updateData
                }
            });

            if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();

            if (!updateResponse || !updateResponse.success) {
                if (typeof Notification !== 'undefined' && Notification.error) Notification.error(updateResponse?.message || 'فشل تحديث حالة الاعتماد');
                return;
            }

            if (typeof Notification !== 'undefined' && Notification.success) {
                Notification.success(decision === 'approve' ? 'تم اعتماد الطلب بنجاح' : 'تم رفض الطلب بنجاح');
            }
            // إعادة تحميل الطلبات لتحديث التبويبات
            this.loadChangeRequests();
        } catch (error) {
            if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('handleApprovalAction:', error);
            if (typeof Notification !== 'undefined' && Notification.error) Notification.error('حدث خطأ أثناء تنفيذ إجراء الاعتماد');
        }
    },

    /**
     * تصدير تقرير مفصل لطلب تغيير واحد إلى PDF بنفس تصميم نماذج النظام
     */
    async exportSingleRequestToPDF(requestId) {
        try {
            const list = Array.isArray(this.state.lastRequests) ? this.state.lastRequests : [];
            let req = list.find(r => String(r.id) === String(requestId));

            // إذا لم يكن موجوداً في الذاكرة، نحاول جلبه من Google Apps Script
            if (!req && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                if (typeof Loading !== 'undefined' && Loading.show) Loading.show('جاري تحميل بيانات الطلب...');
                const response = await GoogleIntegration.sendRequest({
                    action: 'getChangeRequest',
                    data: { requestId }
                });
                if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
                if (response && response.success && response.data) {
                    req = response.data;
                } else {
                    if (typeof Notification !== 'undefined' && Notification.error) Notification.error('تعذر تحميل بيانات الطلب للتصدير');
                    return;
                }
            }

            if (!req) {
                if (typeof Notification !== 'undefined' && Notification.warning) Notification.warning('لا توجد بيانات الطلب للتصدير');
                return;
            }

            const safe = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML)
                ? Utils.escapeHTML(String(v || ''))
                : String(v || '');

            const displayNumber = this.getDisplayRequestNumber(req) || (req.requestNumber || req.id || '');
            const formCode = `MOC-${safe(req.id || '')}`;
            const formTitle = 'طلب إدارة التغيرات - نموذج مقترح تغيير';

            const changeTypeLabel = this.getChangeTypeLabel(req.changeType);
            const priorityLabel = this.getPriorityLabel(req.priority);
            const impactLabel = this.getImpactLabel(req.impact);

            const requestedAt = this.formatDate(req.requestedAt || req.createdAt);
            const dueDate = this.formatDate(req.dueDate);

            const continuity = req.changeContinuity === 'Permanent'
                ? 'دائم'
                : req.changeContinuity === 'Temporary'
                    ? `مؤقت حتى ${this.formatDate(req.temporaryUntilDate)}`
                    : 'غير محدد';

            const sectionRow = (label, value) => `
                <tr>
                    <td style="border:1px solid #e5e7eb;padding:8px 10px;background:#f9fafb;font-weight:600;width:28%;">${label}</td>
                    <td style="border:1px solid #e5e7eb;padding:8px 10px;">${safe(value || '—')}</td>
                </tr>
            `;

            let documentsHtml = '';
            try {
                let docs = req.documentsToAmendJson;
                if (typeof docs === 'string' && docs) {
                    docs = JSON.parse(docs);
                }
                if (Array.isArray(docs) && docs.length) {
                    documentsHtml = `
                        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
                            <thead>
                                <tr>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">نوع الوثيقة</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">اسم الوثيقة</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">الكود</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">المسئول</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">تاريخ مخطط</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${docs.map(d => `
                                    <tr>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(d.documentType)}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(d.documentName)}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(d.documentCode)}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(d.responsibleForAmendment)}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(this.formatDate(d.plannedAmendmentDate))}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            } catch (e) {
                documentsHtml = '';
            }

            let trainingHtml = '';
            try {
                let training = req.trainingRequirementsJson;
                if (typeof training === 'string' && training) {
                    training = JSON.parse(training);
                }
                if (Array.isArray(training) && training.length) {
                    trainingHtml = `
                        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
                            <thead>
                                <tr>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">المتطلب</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">تاريخ مخطط</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">مسئول التنفيذ</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">تاريخ التنفيذ</th>
                                    <th style="border:1px solid #e5e7eb;padding:6px 8px;background:#f3f4f6;">ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${training.map(t => `
                                    <tr>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(t.requirement)}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(this.formatDate(t.plannedDate))}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(t.responsible)}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(this.formatDate(t.executionDate))}</td>
                                        <td style="border:1px solid #e5e7eb;padding:6px 8px;">${safe(t.notes)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            } catch (e) {
                trainingHtml = '';
            }

            const content = `
                <div style="margin-bottom:18px;">
                    <h2 style="text-align:center;color:#111827;margin:0 0 6px;font-size:18px;">نموذج مقترح تغيير (فني / إداري)</h2>
                    <p style="text-align:center;color:#4b5563;margin:0;font-size:12px;">رقم الطلب: ${safe(displayNumber)}</p>
                </div>

                <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px;">
                    ${sectionRow('رقم النظام (CRQ)', req.id)}
                    ${sectionRow('التاريخ', requestedAt)}
                    ${sectionRow('من / إدارة', req.fromDepartment)}
                    ${sectionRow('إلى / إدارة (موقع التغيير)', req.toDepartment)}
                    ${sectionRow('المصنع', req.factoryName)}
                    ${sectionRow('الموقع الفرعي', req.subLocationName)}
                    ${sectionRow('موقع آخر', req.locationOther)}
                    ${sectionRow('نوع التغيير', changeTypeLabel)}
                    ${sectionRow('أولوية التغيير', priorityLabel)}
                    ${sectionRow('الأثر', impactLabel)}
                    ${sectionRow('استمرارية التغيير', continuity)}
                    ${sectionRow('تاريخ مستهدف للتنفيذ', dueDate)}
                    ${sectionRow('مقدم الطلب', req.requestedBy)}
                </table>

                <div style="margin-top:16px;margin-bottom:10px;font-weight:700;color:#111827;">وصف التغيير المقترح</div>
                <div style="border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;min-height:60px;font-size:12px;">${safe(req.description || '')}</div>

                ${req.attachedDocumentsText ? `
                    <div style="margin-top:16px;margin-bottom:10px;font-weight:700;color:#111827;">المستندات المرفقة</div>
                    <div style="border:1px solid #e5e7eb;padding:10px 12px;border-radius:6px;min-height:40px;font-size:12px;">${safe(req.attachedDocumentsText)}</div>
                ` : ''}

                ${(req.requestingDepartment || req.otherDepartments || req.affectedDepartments) ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">لجنة إدارة التغيرات</div>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;">
                        ${req.requestingDepartment ? sectionRow('الإدارة / القسم الطالب للتغيير', req.requestingDepartment) : ''}
                        ${req.otherDepartments ? sectionRow('إدارات / أقسام أخرى', req.otherDepartments) : ''}
                        ${req.affectedDepartments ? sectionRow('الإدارات أو الأقسام المتأثرة', req.affectedDepartments) : ''}
                    </table>
                ` : ''}

                ${(req.employeeCode || req.employeeName || req.adminChangeLocation) ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">بيانات الموظف (للتغييرات الإدارية)</div>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;">
                        ${req.employeeCode ? sectionRow('الكود الوظيفي', req.employeeCode) : ''}
                        ${req.employeeName ? sectionRow('اسم الموظف', req.employeeName) : ''}
                        ${req.adminChangeLocation ? sectionRow('موقع التغيير', req.adminChangeLocation) : ''}
                        ${req.currentTasksDescription ? sectionRow('وصف المهام الحالية', req.currentTasksDescription) : ''}
                        ${req.newTasksDescription ? sectionRow('وصف المهام الجديدة', req.newTasksDescription) : ''}
                        ${req.responsibleRequestingDepartment ? sectionRow('مسئول الإدارة / القسم الطالب للتغيير', req.responsibleRequestingDepartment) : ''}
                        ${req.responsibleImplementingDepartment ? sectionRow('مسئول الإدارة / القسم المنفذ', req.responsibleImplementingDepartment) : ''}
                    </table>
                ` : ''}

                ${(req.previousInjury || req.chronicDiseases || req.healthNotes) ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">الحالة الصحية للموظف</div>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;">
                        ${req.previousInjury ? sectionRow('إصابة سابقة', req.previousInjury) : ''}
                        ${req.chronicDiseases ? sectionRow('أمراض مزمنة', req.chronicDiseases) : ''}
                        ${req.healthNotes ? sectionRow('ملاحظات صحية', req.healthNotes) : ''}
                    </table>
                ` : ''}

                ${trainingHtml ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">برامج التدريب والتوعية والمتطلبات الأخرى</div>
                    ${trainingHtml}
                ` : ''}

                ${documentsHtml ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">الوثائق المطلوب تعديلها</div>
                    ${documentsHtml}
                ` : ''}

                ${(req.committeeMembersJson || req.committeeRecommendations) ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">لجنة دراسة التغييرات</div>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;">
                        ${req.committeeMembersJson ? sectionRow('أعضاء اللجنة', req.committeeMembersJson) : ''}
                        ${req.committeeRecommendations ? sectionRow('توصيات اللجنة', req.committeeRecommendations) : ''}
                    </table>
                ` : ''}

                ${(req.riskAssessment || req.mitigationActions) ? `
                    <div style="margin-top:18px;margin-bottom:10px;font-weight:700;color:#111827;">تقييم المخاطر وإجراءات التخفيف</div>
                    ${req.riskAssessment ? `
                        <div style="margin-bottom:8px;font-size:12px;">
                            <div style="font-weight:600;margin-bottom:4px;">تقييم المخاطر</div>
                            <div style="border:1px solid #e5e7eb;padding:8px 10px;border-radius:6px;">${safe(req.riskAssessment)}</div>
                        </div>
                    ` : ''}
                    ${req.mitigationActions ? `
                        <div style="font-size:12px;">
                            <div style="font-weight:600;margin-bottom:4px;">إجراءات التخفيف</div>
                            <div style="border:1px solid #e5e7eb;padding:8px 10px;border-radius:6px;">${safe(req.mitigationActions)}</div>
                        </div>
                    ` : ''}
                ` : ''}
            `;

            const createdAt = req.createdAt || new Date().toISOString();
            const updatedAt = req.updatedAt || req.createdAt || new Date().toISOString();

            const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
                ? FormHeader.generatePDFHTML(
                    formCode,
                    formTitle,
                    content,
                    false,
                    true,
                    { source: 'ChangeManagement', changeType: req.changeType || '', id: req.id || '', requestNumber: req.requestNumber || '' },
                    createdAt,
                    updatedAt
                )
                : `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${formTitle}</title></head><body style="font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;padding:20px;">${content}</body></html>`;

            const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (!win && typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('يرجى السماح بالنوافذ المنبثقة لتصدير التقرير');
            }
        } catch (error) {
            if (typeof Loading !== 'undefined' && Loading.hide) Loading.hide();
            if (typeof Utils !== 'undefined' && Utils.safeError) Utils.safeError('خطأ في تصدير تقرير طلب التغيير:', error);
            if (typeof Notification !== 'undefined' && Notification.error) Notification.error('فشل تصدير التقرير: ' + (error && error.message ? error.message : String(error)));
        }
    },

    handleSearch(value) {
        this.state.filters.search = value;
        if (this.state._searchDebounce) clearTimeout(this.state._searchDebounce);
        this.state._searchDebounce = setTimeout(() => {
            this.state._searchDebounce = null;
            this.loadChangeRequests();
        }, 350);
    },

    switchTab(tab) {
        this.state.activeTab = tab;
        const reqPanel = document.getElementById('change-tab-requests');
        const regPanel = document.getElementById('change-tab-register');
        const apprPanel = document.getElementById('change-tab-approvals');
        const btns = document.querySelectorAll('.change-tab-btn');
        if (btns.length) {
            btns.forEach(function(b) {
                b.classList.toggle('active', b.getAttribute('data-tab') === tab);
            });
        }
        if (reqPanel) reqPanel.style.display = tab === 'requests' ? 'block' : 'none';
        if (regPanel) regPanel.style.display = tab === 'register' ? 'block' : 'none';
        if (apprPanel) apprPanel.style.display = tab === 'approvals' ? 'block' : 'none';
        if (tab === 'register') {
            if (this.state.lastRequests && this.state.lastRequests.length > 0) {
                this.renderRegisterTable(this.state.lastRequests);
            } else {
                this.loadChangeRequests();
            }
        } else if (tab === 'approvals') {
            if (this.state.lastRequests && this.state.lastRequests.length > 0) {
                this.renderApprovalsList(this.state.lastRequests);
            } else {
                this.loadChangeRequests();
            }
        }
    },

    renderRegisterTable(requests) {
        const container = document.getElementById('change-register-list-container');
        if (!container) return;
        const safe = (v) => (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML(String(v || '')) : String(v || '');
        if (!requests || requests.length === 0) {
            container.innerHTML = '<div class="empty-state py-8"><i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i><p class="text-gray-500">لا توجد طلبات في السجل</p></div>';
            this.applyModuleI18n(container);
            return;
        }
        const statusColors = { 'Draft': 'bg-gray-100 text-gray-800', 'In Review': 'bg-blue-100 text-blue-800', 'Approved': 'bg-green-100 text-green-800', 'Rejected': 'bg-red-100 text-red-800', 'In Implementation': 'bg-purple-100 text-purple-800', 'Completed': 'bg-teal-100 text-teal-800', 'Closed': 'bg-gray-100 text-gray-600' };
        container.innerHTML = `
            <div class="change-register-table-wrap" style="overflow-x:auto;">
                <table class="w-full border-collapse text-sm" style="border-color: var(--border-color);">
                    <thead>
                        <tr>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">رقم الطلب</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">الموضوع</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">نوع التغيير</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">الحالة</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">مقدم الطلب</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">التاريخ</th>
                            <th class="p-3 text-right font-semibold" style="position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#3b82f6,#0ea5e9);color:#fff;border-bottom:1px solid #0284c7;">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map((r, i) => `
                            <tr class="border-b hover:opacity-90" style="border-color: var(--border-color); background: ${i % 2 === 0 ? 'var(--card-bg)' : 'rgba(241,245,249,0.8)'};">
                                <td class="p-3">${safe(this.getDisplayRequestNumber(r) || (r.requestNumber || r.id || ''))}</td>
                                <td class="p-3">${safe(r.title || '—')}</td>
                                <td class="p-3">${this.getChangeTypeLabel(r.changeType)}</td>
                                <td class="p-3"><span class="px-2 py-1 rounded text-xs font-medium ${statusColors[r.status] || 'bg-gray-100'}">${this.getStatusLabel(r.status)}</span></td>
                                <td class="p-3">${safe(r.requestedBy || '—')}</td>
                                <td class="p-3">${this.formatDate(r.requestedAt || r.createdAt)}</td>
                                <td class="p-3"><button type="button" onclick="ChangeManagement.showRequestDetail('${safe(r.id)}')" class="btn-secondary btn-sm"><i class="fas fa-eye ml-1"></i> عرض</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        this.applyModuleI18n(container);
    },

    applyFilters() {
        this.loadChangeRequests();
    },

    showEmptyState(message) {
        return `
            <div class="empty-state">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">${message}</p>
            </div>
        `;
    },

    setupEventListeners() {
        if (this._changeRequestsFilterDelegation) return;
        this._changeRequestsFilterDelegation = true;
        const onFilterChange = () => {
            this.syncFiltersFromUI();
            this.loadChangeRequests();
        };
        const debounceSearch = () => {
            if (this.state._searchDebounce) clearTimeout(this.state._searchDebounce);
            this.state._searchDebounce = setTimeout(() => {
                this.state._searchDebounce = null;
                onFilterChange();
            }, 400);
        };
        document.addEventListener('change', (e) => {
            const t = e.target;
            if (!t || !t.id) return;
            const ids = ['change-status-filter', 'change-type-filter', 'change-priority-filter', 'change-impact-filter', 'change-start-date', 'change-end-date'];
            if (ids.indexOf(t.id) !== -1) onFilterChange();
        });
        document.addEventListener('input', (e) => {
            const t = e.target;
            if (t && t.id === 'change-search') debounceSearch();
            else if (t && t.id === 'change-module-filter') debounceSearch();
        });
    }
};

(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof ChangeManagement !== 'undefined') {
            window.ChangeManagement = ChangeManagement;
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ ChangeManagement module loaded and available on window.ChangeManagement');
            }
        }
    } catch (error) {
        if (typeof console !== 'undefined') console.error('خطأ في تصدير ChangeManagement:', error);
        if (typeof window !== 'undefined' && typeof ChangeManagement !== 'undefined') {
            try { window.ChangeManagement = ChangeManagement; } catch (e) {}
        }
    }
})();
