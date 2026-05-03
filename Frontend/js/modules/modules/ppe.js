/**
 * PPE Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
const PPE = {
    state: {
        activeTab: 'receipts', // receipts, stock-control
        isSwitchingTab: false, // منع التبديل المتزامن
        eventListeners: new Map(), // تتبع مستمعي الأحداث للتنظيف
        stockItemsCache: null, // Cache لبيانات المخزون
        stockItemsCacheTime: null, // وقت التخزين المؤقت
        stockCacheExpiry: 5 * 60 * 1000, // انتهاء صلاحية Cache بعد 5 دقائق
        lastSyncTime: null, // وقت آخر مزامنة
        /** فلاتر سجل الاستلامات (نفس نمط سجل التردد / المستندات القانونية) */
        filters: {
            receipts: {
                search: '',
                equipmentType: '',
                status: '',
                dateFrom: '',
                dateTo: ''
            }
        }
    },

    _t(key, fallback) {
        if (window.AppI18n && typeof window.AppI18n.t === 'function') {
            return window.AppI18n.t(key, fallback);
        }
        if (window.I18n && typeof window.I18n.t === 'function') {
            return window.I18n.t(key, fallback);
        }
        return fallback;
    },

    applyModuleI18n(root) {
        const el = root && root.nodeType ? root : document.getElementById('ppe-section');
        if (!el) return;
        const i18n = (window.AppI18n && typeof window.AppI18n.applyModuleI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyModuleI18n === 'function') ? window.I18n : null);
        if (i18n) i18n.applyModuleI18n(el);
    },

    ensurePpeFilterStyles() {
        if (document.getElementById('ppe-module-filter-styles')) return;
        const style = document.createElement('style');
        style.id = 'ppe-module-filter-styles';
        style.textContent = `
            .ppe-visits-filters-row { position: relative; }
            .ppe-visits-filters-row .filters-grid { width: 100%; }
            .ppe-visits-filters-row .filter-field { display: flex; flex-direction: column; gap: 6px; }
            .ppe-visits-filters-row .filter-label {
                font-size: 12px; font-weight: 600; color: #4a5568; text-transform: uppercase;
                letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px;
            }
            .ppe-visits-filters-row .filter-label i { font-size: 11px; color: #667eea; }
            .ppe-visits-filters-row .filter-input {
                width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px;
                background: white; font-size: 14px; color: #2d3748; transition: all 0.2s ease;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .ppe-visits-filters-row .filter-input:focus {
                outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .ppe-visits-filters-row .filter-reset-btn {
                width: 100%; padding: 10px 16px; min-height: 42px; border-radius: 12px;
                border: 1px solid #cbd5e1; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                color: #0f172a; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s ease;
                display: flex; align-items: center; justify-content: center; gap: 4px;
            }
            .ppe-visits-filters-row .filter-reset-btn:hover {
                transform: translateY(-1px); box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
            }
            .ppe-visits-filters-row .filter-count-badge {
                display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 20px;
                padding: 2px 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border-radius: 12px; font-size: 11px; font-weight: 700; margin-inline-start: 4px;
            }
        `;
        document.head.appendChild(style);
    },

    getDisplayStatus(status) {
        const s = String(status || '').trim();
        if (s === 'مستلم') return this._t('module.ppe.status.received', 'مستلم');
        if (s === 'قيد التسليم') return this._t('module.ppe.status.pending', 'قيد التسليم');
        return s || '—';
    },

    isStatusReceived(status) {
        return String(status || '').trim() === 'مستلم';
    },

    getFilteredPpeReceipts(ppeList) {
        const list = Array.isArray(ppeList) ? ppeList : [];
        const f = this.state.filters?.receipts || {};
        const search = (f.search || '').trim().toLowerCase();
        const type = f.equipmentType || '';
        const status = f.status || '';
        const from = f.dateFrom ? new Date(f.dateFrom + 'T00:00:00') : null;
        const to = f.dateTo ? new Date(f.dateTo + 'T23:59:59.999') : null;
        if (from && isNaN(from.getTime())) return list;
        if (to && isNaN(to.getTime())) return list;

        return list.filter((item) => {
            if (type && String(item.equipmentType || '') !== type) return false;
            if (status && String(item.status || '') !== status) return false;
            if (from || to) {
                if (!item.receiptDate) return false;
                const rd = new Date(item.receiptDate);
                if (isNaN(rd.getTime())) return false;
                if (from && rd < from) return false;
                if (to && rd > to) return false;
            }
            if (search) {
                const hay = [
                    item.receiptNumber, item.id, item.employeeName, item.employeeCode, item.employeeNumber,
                    item.equipmentType, item.status, item.employeeDepartment
                ].map((x) => String(x || '').toLowerCase()).join(' | ');
                if (!hay.includes(search)) return false;
            }
            return true;
        });
    },

    hasActiveReceiptFilters() {
        const f = this.state.filters?.receipts || {};
        return !!(f.search || f.equipmentType || f.status || f.dateFrom || f.dateTo);
    },

    resetReceiptFilters() {
        if (!this.state.filters) this.state.filters = {};
        this.state.filters.receipts = {
            search: '',
            equipmentType: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
    },

    /**
     * محتوى سجل الاستلامات: فلاتر ديناميكية + جدول (نفس نمط visits-filters-row)
     */
    buildPPEListHtml() {
        const t = (k, f) => this._t(k, f);
        this.ensurePpeFilterStyles();
        const ppeList = AppState.appData.ppe || [];
        const filters = this.state.filters?.receipts || {};
        const filtered = this.getFilteredPpeReceipts(ppeList);
        const hasFilters = this.hasActiveReceiptFilters();
        const isRTL = typeof document !== 'undefined'
            && (document.documentElement.getAttribute('dir') === 'rtl'
                || (window.AppI18n && window.AppI18n.getCurrentLang && window.AppI18n.getCurrentLang() === 'ar'));
        const esc = (v) => Utils.escapeHTML(v);

        if (ppeList.length === 0) {
            return `<div class="empty-state"><p class="text-gray-500">${esc(t('module.ppe.empty.noReceipts', 'لا توجد استلامات مسجلة'))}</p></div>`;
        }

        const uniqueTypes = [...new Set(ppeList.map(p => p.equipmentType).filter(Boolean))].sort();
        const uniqueStatuses = ['مستلم', 'قيد التسليم'];

        const filterRow = `
            <div class="ppe-visits-filters-row visits-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 0 14px 0; width: 100%; direction: ${isRTL ? 'rtl' : 'ltr'};">
                <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end;">
                    <div class="filter-field" style="min-width: 180px;">
                        <label class="filter-label" for="ppe-receipts-search">
                            <i class="fas fa-search ml-1"></i>${esc(t('module.ppe.filter.search', 'بحث'))}
                        </label>
                        <input type="text" id="ppe-receipts-search" class="form-input pr-10 filter-input" placeholder="${esc(t('module.ppe.filter.searchPlaceholder', ''))}" value="${esc(filters.search || '')}">
                    </div>
                    <div class="filter-field" style="min-width: 160px;">
                        <label class="filter-label" for="ppe-receipts-filter-type">
                            <i class="fas fa-hard-hat ml-1"></i>${esc(t('module.ppe.filter.equipmentType', 'نوع المعدة'))}
                            ${filters.equipmentType ? `<span class="filter-count-badge" title="${esc(t('module.ppe.filter.badgeCount', ''))}">${filtered.length}</span>` : ''}
                        </label>
                        <select id="ppe-receipts-filter-type" class="form-input filter-input">
                            <option value="">${esc(t('module.common.all', 'الكل'))}</option>
                            ${uniqueTypes.map((typ) => `<option value="${esc(typ)}" ${filters.equipmentType === typ ? 'selected' : ''}>${esc(typ)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-field" style="min-width: 160px;">
                        <label class="filter-label" for="ppe-receipts-filter-status">
                            <i class="fas fa-signal ml-1"></i>${esc(t('module.ppe.filter.status', 'الحالة'))}
                            ${filters.status ? `<span class="filter-count-badge" title="${esc(t('module.ppe.filter.badgeCount', ''))}">${filtered.length}</span>` : ''}
                        </label>
                        <select id="ppe-receipts-filter-status" class="form-input filter-input">
                            <option value="">${esc(t('module.common.all', 'الكل'))}</option>
                            ${uniqueStatuses.map((st) => `<option value="${esc(st)}" ${filters.status === st ? 'selected' : ''}>${esc(this.getDisplayStatus(st))}</option>`).join('')}
                        </select>
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="ppe-receipts-date-from"><i class="fas fa-calendar-alt ml-1"></i>${esc(t('module.ppe.filter.dateFrom', 'من تاريخ الاستلام'))}</label>
                        <input type="date" id="ppe-receipts-date-from" class="form-input filter-input" value="${esc(filters.dateFrom || '')}">
                    </div>
                    <div class="filter-field">
                        <label class="filter-label" for="ppe-receipts-date-to"><i class="fas fa-calendar-check ml-1"></i>${esc(t('module.ppe.filter.dateTo', 'إلى تاريخ الاستلام'))}</label>
                        <input type="date" id="ppe-receipts-date-to" class="form-input filter-input" value="${esc(filters.dateTo || '')}">
                    </div>
                    <div class="filter-field" style="min-width: 170px;">
                        <button type="button" id="ppe-receipts-reset-filters" class="filter-reset-btn" title="${esc(t('module.ppe.filter.resetTitle', ''))}">
                            <i class="fas fa-rotate-left ml-1"></i>${esc(t('module.ppe.filter.reset', 'إعادة تعيين الفلاتر'))}
                        </button>
                    </div>
                </div>
            </div>`;

        const noMatchBlock = (hasFilters && filtered.length === 0) ? `
            <div class="empty-state">
                <i class="fas fa-filter text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500 mb-2">${esc(t('module.ppe.filter.noMatch', 'لا توجد نتائج مطابقة'))}</p>
                <button type="button" id="ppe-receipts-clear-empty-filters" class="btn-secondary mt-2">
                    <i class="fas fa-undo-alt ml-2"></i>${esc(t('module.ppe.filter.clearEmpty', 'مسح الفلاتر'))}
                </button>
            </div>
        ` : '';

        if (filtered.length === 0) {
            return filterRow + noMatchBlock;
        }

        const viewTitle = t('module.common.view', 'عرض');
        const pdfT = t('module.kpi.exportPDF', 'تصدير PDF');
        const editTitle = t('module.common.edit', 'تعديل');
        const delTitle = t('module.ppe.btn.deleteReceipt', 'حذف');
        const table = `
            <table class="data-table table-header-blue">
                <thead>
                    <tr>
                        <th>${esc(t('module.ppe.table.receiptNo', 'رقم الإيصال'))}</th>
                        <th>${esc(t('module.ppe.table.employeeName', 'اسم الموظف'))}</th>
                        <th>${esc(t('module.ppe.table.employeeCode', 'الكود الوظيفي'))}</th>
                        <th>${esc(t('module.ppe.table.equipmentType', 'نوع المعدة'))}</th>
                        <th>${esc(t('module.ppe.table.quantity', 'الكمية'))}</th>
                        <th>${esc(t('module.ppe.table.receiptDate', 'تاريخ الاستلام'))}</th>
                        <th>${esc(t('module.ppe.table.status', 'الحالة'))}</th>
                        <th>${esc(t('module.ppe.table.actions', 'الإجراءات'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map((item) => {
            const stDisp = this.getDisplayStatus(item.status);
            const idJs = String(item.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `
                        <tr>
                            <td class="font-mono font-semibold">${esc(item.receiptNumber || item.id || '')}</td>
                            <td>${esc(item.employeeName || '')}</td>
                            <td>${esc(item.employeeCode || item.employeeNumber || '')}</td>
                            <td>${esc(item.equipmentType || '')}</td>
                            <td>${item.quantity || 0}</td>
                            <td>${item.receiptDate ? Utils.formatDate(item.receiptDate) : '-'}</td>
                            <td>
                                <span class="badge badge-${this.isStatusReceived(item.status) ? 'success' : 'warning'}">
                                    ${esc(stDisp)}
                                </span>
                            </td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <button onclick="PPE.viewPPE('${idJs}')" class="btn-icon btn-icon-info" title="${esc(viewTitle)}">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="PPE.exportPDF('${idJs}')" class="btn-icon btn-icon-success" title="${esc(pdfT)}">
                                        <i class="fas fa-file-pdf"></i>
                                    </button>
                                    <button onclick="PPE.showPPEForm(${JSON.stringify(item).replace(/"/g, '&quot;')});" class="btn-icon btn-icon-primary" title="${esc(editTitle)}">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="PPE.deletePPE('${idJs}')" class="btn-icon btn-icon-danger" title="${esc(delTitle)}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
        }).join('')}
                </tbody>
            </table>
        `;

        return filterRow + table;
    },

    _receiptsFilterTimer: null,

    refreshReceiptsListUI() {
        const container = document.getElementById('ppe-list');
        if (!container) return;
        container.innerHTML = this.buildPPEListHtml();
        this.applyModuleI18n(container);
        this.bindReceiptsFilters();
    },

    bindReceiptsFilters() {
        if (this.state.activeTab !== 'receipts') return;
        const run = (fn) => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(fn);
            } else {
                setTimeout(fn, 0);
            }
        };
        const search = document.getElementById('ppe-receipts-search');
        if (search) {
            const h = (e) => {
                this.state.filters.receipts.search = (e.target && e.target.value) || '';
                clearTimeout(this._receiptsFilterTimer);
                this._receiptsFilterTimer = setTimeout(() => run(() => this.refreshReceiptsListUI()), 220);
            };
            search.addEventListener('input', h);
        }
        const typeEl = document.getElementById('ppe-receipts-filter-type');
        if (typeEl) {
            typeEl.addEventListener('change', (e) => {
                this.state.filters.receipts.equipmentType = (e.target && e.target.value) || '';
                this.refreshReceiptsListUI();
            });
        }
        const statusEl = document.getElementById('ppe-receipts-filter-status');
        if (statusEl) {
            statusEl.addEventListener('change', (e) => {
                this.state.filters.receipts.status = (e.target && e.target.value) || '';
                this.refreshReceiptsListUI();
            });
        }
        const fromEl = document.getElementById('ppe-receipts-date-from');
        if (fromEl) {
            fromEl.addEventListener('change', (e) => {
                this.state.filters.receipts.dateFrom = (e.target && e.target.value) || '';
                this.refreshReceiptsListUI();
            });
        }
        const toEl = document.getElementById('ppe-receipts-date-to');
        if (toEl) {
            toEl.addEventListener('change', (e) => {
                this.state.filters.receipts.dateTo = (e.target && e.target.value) || '';
                this.refreshReceiptsListUI();
            });
        }
        const resetEl = document.getElementById('ppe-receipts-reset-filters');
        if (resetEl) {
            resetEl.addEventListener('click', () => {
                this.resetReceiptFilters();
                this.refreshReceiptsListUI();
            });
        }
        const clearEmpty = document.getElementById('ppe-receipts-clear-empty-filters');
        if (clearEmpty) {
            clearEmpty.addEventListener('click', () => {
                this.resetReceiptFilters();
                this.refreshReceiptsListUI();
            });
        }
    },

    /**
     * ✅ مسح Cache لتحديث البيانات بعد المزامنة
     * يتم استدعاؤها من RealtimeSyncManager عند تحديث البيانات
     */
    clearCache() {
        // ✅ حفظ البيانات الحالية في AppState قبل مسح Cache
        if (this.state.stockItemsCache) {
            AppState.appData.ppeStock = this.state.stockItemsCache;
            // ✅ حفظ في localStorage أيضاً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
        }
        
        this.state.stockItemsCache = null;
        this.state.stockItemsCacheTime = null;
        this.state.lastSyncTime = Date.now();
        Utils.safeLog('🔄 PPE: تم مسح Cache لتحديث البيانات');
    },

    /**
     * ✅ تحميل البيانات مسبقاً في الخلفية
     * يتم استدعاؤها عند تحميل المديول لضمان توفر البيانات
     */
    async preloadData() {
        try {
            // تحميل بيانات الاستلامات
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                try {
                    const ppeResult = await GoogleIntegration.sendToAppsScript('getAllPPE', {});
                    if (ppeResult && ppeResult.success && Array.isArray(ppeResult.data)) {
                        AppState.appData.ppe = ppeResult.data;
                        // ✅ حفظ البيانات في localStorage للاستخدام لاحقاً
                        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                            window.DataManager.save();
                        }
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل بيانات الاستلامات:', error);
                }
            }

            // تحميل بيانات المخزون (فقط إذا كان التبويب النشط هو stock-control)
            if (this.state.activeTab === 'stock-control') {
                await this.loadStockItems(true); // forceRefresh = true
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في preloadData:', error);
        }
    },

    /**
     * ✅ عرض محتوى التبويب مع البيانات المتوفرة (fallback)
     * يُستخدم في حالة timeout أو خطأ في التحميل
     */
    renderActiveTabContentWithFallback() {
        try {
            switch (this.state.activeTab) {
                case 'stock-control':
                    const stockItems = AppState.appData.ppeStock || [];
                    if (stockItems.length === 0) {
                        return `
                            <div class="empty-state">
                                <div style="width: 300px; margin: 0 auto 16px;">
                                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                    </div>
                                </div>
                                <p class="text-gray-500 mb-4">${this._t('module.ppe.loading.stockData', 'جاري تحميل بيانات المخزون...')}</p>
                            </div>
                        `;
                    }
                    // عرض البيانات المتوفرة
                    return `
                        <div class="space-y-6">
                            ${this.renderStockTableSync(stockItems)}
                        </div>
                    `;
                case 'receipts':
                default:
                    return this.renderPPEListSync();
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في renderActiveTabContentWithFallback:', error);
            return `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p class="text-gray-500 mb-4">${Utils.escapeHTML(this._t('module.ppe.empty.loadContentError', 'حدث خطأ أثناء تحميل المحتوى'))}</p>
                    <button onclick="PPE.load()" class="btn-primary">
                        <i class="fas fa-redo ml-2"></i>${Utils.escapeHTML(this._t('module.common.retry', 'إعادة المحاولة'))}
                    </button>
                </div>
            `;
        }
    },

    /**
     * ✅ عرض قائمة الاستلامات بشكل متزامن (بدون await)
     */
    renderPPEListSync() {
        return this.buildPPEListHtml();
    },

    /**
     * ✅ عرض جدول المخزون بشكل متزامن (بدون await)
     */
    renderStockTableSync(stockItems) {
        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        if (!stockItems || stockItems.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-box-open text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">${ut(t('module.ppe.empty.noStock', 'لا توجد أصناف في المخزون'))}</p>
                </div>
            `;
        }
        return `
            <div class="overflow-x-auto">
                <table class="data-table table-header-blue">
                    <thead>
                        <tr>
                            <th>${ut(t('module.ppe.stock.itemCode', 'كود الصنف'))}</th>
                            <th>${ut(t('module.ppe.stock.itemName', 'اسم الصنف'))}</th>
                            <th>${ut(t('module.ppe.stock.category', 'الفئة'))}</th>
                            <th>${ut(t('module.ppe.stock.in', 'الوارد'))}</th>
                            <th>${ut(t('module.ppe.stock.out', 'المنصرف'))}</th>
                            <th>${ut(t('module.ppe.stock.balance', 'الرصيد'))}</th>
                            <th>${ut(t('module.ppe.stock.reorder', 'حد إعادة الطلب'))}</th>
                            <th>${ut(t('module.ppe.stock.supplier', 'المورد'))}</th>
                            <th>${ut(t('module.ppe.table.actions', 'الإجراءات'))}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stockItems.map(item => {
                            const balance = parseFloat(item.balance || 0);
                            const minThreshold = parseFloat(item.minThreshold || 0);
                            const isLowStock = balance < minThreshold;
                            return `
                                <tr class="${isLowStock ? 'bg-red-50' : ''}">
                                    <td class="font-mono font-semibold">${Utils.escapeHTML(item.itemCode || '')}</td>
                                    <td>${Utils.escapeHTML(item.itemName || '')}</td>
                                    <td>${Utils.escapeHTML(item.category || '')}</td>
                                    <td class="text-green-600 font-semibold">${parseFloat(item.stock_IN || 0).toFixed(0)}</td>
                                    <td class="text-red-600 font-semibold">${parseFloat(item.stock_OUT || 0).toFixed(0)}</td>
                                    <td class="font-bold ${isLowStock ? 'text-red-600' : 'text-blue-600'}">${balance.toFixed(0)}</td>
                                    <td>${minThreshold.toFixed(0)}</td>
                                    <td>${Utils.escapeHTML(item.supplier || '')}</td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button onclick="PPE.editStockItem('${item.itemId}')" class="btn-icon btn-icon-warning" title="${ut(t('module.common.edit', 'تعديل'))}">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="PPE.deleteStockItem('${item.itemId}')" class="btn-icon btn-icon-danger" title="${ut(t('module.ppe.btn.deleteItem', 'حذف'))}">
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
        `;
    },

    /**
     * ✅ تحديث التبويب النشط فقط دون إعادة تحميل الموديول بالكامل
     * يُستخدم بعد المزامنة لتحديث البيانات مباشرة
     */
    async refreshActiveTab() {
        try {
            // ✅ مسح Cache لضمان تحميل البيانات الجديدة
            this.clearCache();
            
            const tabContentContainer = document.getElementById('ppe-tab-content');
            if (!tabContentContainer) {
                Utils.safeWarn('⚠️ PPE: لم يتم العثور على حاوية محتوى التبويب');
                return;
            }
            
            // ✅ تحميل البيانات الجديدة أولاً
            try {
                if (this.state.activeTab === 'stock-control') {
                    await this.loadStockItems(true); // forceRefresh = true
                } else {
                    // تحميل بيانات الاستلامات
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                        try {
                            const ppeResult = await GoogleIntegration.sendToAppsScript('getAllPPE', {});
                            if (ppeResult && ppeResult.success && Array.isArray(ppeResult.data)) {
                                AppState.appData.ppe = ppeResult.data;
                                // ✅ حفظ البيانات في localStorage
                                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                                    window.DataManager.save();
                                }
                            }
                        } catch (error) {
                            Utils.safeWarn('⚠️ خطأ في تحميل بيانات الاستلامات:', error);
                        }
                    }
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل البيانات أثناء refreshActiveTab:', error);
            }
            
            // عرض مؤشر تحميل خفيف (بدون overlay كامل)
            const originalContent = tabContentContainer.innerHTML;
            tabContentContainer.style.opacity = '0.6';
            tabContentContainer.style.pointerEvents = 'none';
            
            try {
                // ✅ تحميل محتوى التبويب الجديد بدون Loading overlay
                const newContent = await this.renderActiveTabContent(false);
                tabContentContainer.innerHTML = newContent;
                this.applyModuleI18n(tabContentContainer);
                if (this.state.activeTab === 'receipts') {
                    this.ensurePpeFilterStyles();
                    this.bindReceiptsFilters();
                }
                Utils.safeLog('✅ PPE: تم تحديث التبويب النشط بنجاح');
            } catch (error) {
                Utils.safeError('❌ PPE: خطأ في تحديث التبويب:', error);
                // استعادة المحتوى الأصلي في حالة الخطأ
                tabContentContainer.innerHTML = originalContent;
            } finally {
                tabContentContainer.style.opacity = '1';
                tabContentContainer.style.pointerEvents = 'auto';
            }
        } catch (error) {
            Utils.safeError('❌ PPE: خطأ في refreshActiveTab:', error);
        }
    },

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('ppe-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ قسم ppe-section غير موجود');
            } else {
                console.warn('⚠️ قسم ppe-section غير موجود');
            }
            return;
        }

        // ✅ تحسين: التأكد من وجود البيانات الأساسية بشكل أسرع
        try {
            if (!AppState || !AppState.appData) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ AppState غير جاهز - جاري الانتظار...');
                } else {
                    console.warn('⚠️ AppState غير جاهز - جاري الانتظار...');
                }
                await new Promise(resolve => {
                    let attempts = 0;
                    const maxAttempts = 50; // ✅ تقليل من 100 إلى 50 (2.5 ثانية بدلاً من 5)
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (AppState && AppState.appData) {
                            clearInterval(checkInterval);
                            resolve();
                        } else if (attempts >= maxAttempts) {
                            clearInterval(checkInterval);
                            if (!AppState) AppState = {};
                            if (!AppState.appData) AppState.appData = {};
                            resolve();
                        }
                    }, 50);
                });
            }
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ خطأ في التحقق من AppState:', error);
            } else {
                console.warn('⚠️ خطأ في التحقق من AppState:', error);
            }
            if (!AppState) AppState = {};
            if (!AppState.appData) AppState.appData = {};
        }

        try {
            // ✅ تحسين: التأكد من وجود جميع البيانات المطلوبة
            if (!AppState.appData.ppe) {
                AppState.appData.ppe = [];
            }
            if (!AppState.appData.ppeStock) {
                AppState.appData.ppeStock = [];
            }

            // ✅ تحسين: تحميل البيانات مباشرة في الخلفية قبل عرض الواجهة
            const dataLoadPromise = this.preloadData();

            // ✅ تحسين: عرض الواجهة فوراً بالبيانات المتوفرة (إن وجدت)
            // هذا يضمن عدم وجود واجهة فارغة حتى لو فشل تحميل البيانات
            let tabContent = '';
            try {
                // محاولة تحميل المحتوى مع البيانات المتوفرة أولاً
                const tabContentPromise = this.renderActiveTabContent(false); // false = بدون Loading overlay
                tabContent = await Utils.promiseWithTimeout(
                    tabContentPromise,
                    3000, // ✅ تقليل timeout من 5 ثوان إلى 3 ثوان
                    this._t('module.ppe.timeout.content', 'انتهت مهلة تحميل المحتوى')
                );
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تحميل محتوى التبويب:', error);
                } else {
                    console.warn('⚠️ خطأ في تحميل محتوى التبويب:', error);
                }
                // ✅ استخدام fallback مع البيانات المتوفرة
                tabContent = this.renderActiveTabContentWithFallback();
            }

            // ✅ انتظار تحميل البيانات في الخلفية (بدون حجب الواجهة)
            dataLoadPromise.catch(error => {
                Utils.safeWarn('⚠️ خطأ في تحميل البيانات في الخلفية:', error);
            });

            const t = (k, f) => this._t(k, f);
            const ut = (s) => Utils.escapeHTML(s);
        section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-hard-hat ml-3"></i>
                            ${ut(t('module.ppe.title', 'إدارة مهمات الوقاية الشخصية'))}
                        </h1>
                        <p class="section-subtitle">${ut(t('module.ppe.subtitle', 'تسجيل ومتابعة استلام مهمات الوقاية الشخصية'))}</p>
                    </div>
                    <div class="flex gap-2">
                        ${this.state.activeTab === 'receipts' ? `
                            <button id="view-ppe-matrix-btn" class="btn-secondary">
                                <i class="fas fa-table ml-2"></i>
                                ${ut(t('module.ppe.btn.matrix', 'مصفوفة مهمات الوقاية'))}
                            </button>
                            <button id="add-ppe-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                ${ut(t('module.ppe.btn.newReceipt', 'تسجيل استلام جديد'))}
                            </button>
                            <button id="ppe-refresh-btn" type="button" class="btn-secondary border-2 border-green-500 text-green-600 hover:bg-green-50" title="${ut(t('module.ppe.btn.refreshTitle', 'تحديث المحتوى الحالي'))}">
                                <i class="fas fa-sync-alt ml-2"></i>
                                ${ut(t('module.ppe.btn.refresh', 'تحديث'))}
                            </button>
                        ` : `
                            <button id="add-stock-item-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                ${ut(t('module.ppe.btn.addStockItem', 'إضافة صنف جديد'))}
                            </button>
                            <button id="add-transaction-btn" class="btn-secondary">
                                <i class="fas fa-exchange-alt ml-2"></i>
                                ${ut(t('module.ppe.btn.addTransaction', 'إضافة حركة'))}
                            </button>
                        `}
                    </div>
                </div>
            </div>
            <div class="mt-6">
                <div class="content-card">
                    <div class="card-header" style="padding: 0; border-bottom: none;">
                        <div class="ppe-tabs-container">
                            <button type="button" class="ppe-tab-btn ${this.state.activeTab === 'receipts' ? 'active' : ''}" data-tab="receipts">
                                <i class="fas fa-receipt"></i>
                                ${ut(t('module.ppe.tab.receipts', 'سجل الاستلامات'))}
                            </button>
                            <button type="button" class="ppe-tab-btn ${this.state.activeTab === 'stock-control' ? 'active' : ''}" data-tab="stock-control">
                                <i class="fas fa-boxes"></i>
                                ${ut(t('module.ppe.tab.stock', 'إدارة مخزون مهمات الوقاية'))}
                            </button>
                        </div>
                    </div>
                    <div class="card-body" style="padding-top: 1.5rem;">
                        <div id="ppe-tab-content">
                            ${tabContent}
                        </div>
                    </div>
                </div>
            </div>
        `;
            // تهيئة الأحداث بعد عرض الواجهة
            try {
                this.ensurePpeFilterStyles();
                this.setupEventListeners();
                this.applyModuleI18n(section);
                if (this.state.activeTab === 'receipts') {
                    this.bindReceiptsFilters();
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في setupEventListeners:', error);
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول معدات الحماية الشخصية:', error);
            const te = (k, f) => this._t(k, f);
            const ut = (s) => Utils.escapeHTML(s);
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-hard-hat ml-3"></i>
                            ${ut(te('module.ppe.title', 'إدارة مهمات الوقاية الشخصية'))}
                        </h1>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">${ut(te('module.ppe.empty.loadError', 'حدث خطأ أثناء تحميل البيانات'))}</p>
                                <button onclick="PPE.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${ut(te('module.common.retry', 'إعادة المحاولة'))}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * تحميل محتوى التبويب النشط
     * @param {boolean} showLoadingOverlay - عرض Loading overlay (افتراضي: true)
     */
    async renderActiveTabContent(showLoadingOverlay = true) {
        try {
            switch (this.state.activeTab) {
                case 'stock-control':
                    // ✅ تحميل البيانات مباشرة عند الدخول للتبويب
                    if (showLoadingOverlay) {
                        Loading.show(this._t('module.ppe.loading.stock', 'جاري تحميل بيانات المخزون...'));
                    }
                    try {
                        const content = await this.renderStockControlTab();
                        if (showLoadingOverlay) {
                            Loading.hide();
                        }
                        return content;
                    } catch (error) {
                        if (showLoadingOverlay) {
                            Loading.hide();
                        }
                        Utils.safeError('❌ خطأ في تحميل تبويب المخزون:', error);
                        return `
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">${Utils.escapeHTML(this._t('module.ppe.empty.loadStockError', 'حدث خطأ أثناء تحميل بيانات المخزون'))}</p>
                                <button onclick="PPE.switchTab('stock-control')" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>${Utils.escapeHTML(this._t('module.common.retry', 'إعادة المحاولة'))}
                                </button>
                            </div>
                        `;
                    }
                case 'receipts':
                default:
                    return await this.renderReceiptsTab();
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في renderActiveTabContent:', error);
            if (showLoadingOverlay) {
                Loading.hide();
            }
            return `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p class="text-gray-500 mb-4">${Utils.escapeHTML(this._t('module.ppe.empty.loadContentError', 'حدث خطأ أثناء تحميل المحتوى'))}</p>
                    <button onclick="PPE.load()" class="btn-primary">
                        <i class="fas fa-redo ml-2"></i>${Utils.escapeHTML(this._t('module.common.retry', 'إعادة المحاولة'))}
                    </button>
                </div>
            `;
        }
    },

    async renderReceiptsTab() {
        return `
            <div id="ppe-list">
                ${this.buildPPEListHtml()}
            </div>
        `;
    },

    /**
     * تنظيف مستمعي الأحداث السابقين
     */
    cleanupEventListeners() {
        this.state.eventListeners.forEach((listener, element) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(listener.event, listener.handler);
            }
        });
        this.state.eventListeners.clear();
    },

    setupEventListeners() {
        // تنظيف المستمعين السابقين أولاً
        this.cleanupEventListeners();

        setTimeout(() => {
            // Tab switching
            const tabButtons = document.querySelectorAll('.ppe-tab-btn');
            tabButtons.forEach(btn => {
                const handler = () => {
                    const tab = btn.getAttribute('data-tab');
                    if (tab && !this.state.isSwitchingTab) {
                        this.switchTab(tab);
                    }
                };
                btn.addEventListener('click', handler);
                // حفظ المستمع للتنظيف لاحقاً
                this.state.eventListeners.set(btn, { event: 'click', handler });
            });

            // Receipts tab buttons
            const addBtn = document.getElementById('add-ppe-btn');
            const viewMatrixBtn = document.getElementById('view-ppe-matrix-btn');
            if (addBtn) {
                const handler = () => this.showPPEForm();
                addBtn.addEventListener('click', handler);
                this.state.eventListeners.set(addBtn, { event: 'click', handler });
            }
            if (viewMatrixBtn) {
                const handler = () => this.showPPEMatrix();
                viewMatrixBtn.addEventListener('click', handler);
                this.state.eventListeners.set(viewMatrixBtn, { event: 'click', handler });
            }
            const refreshBtn = document.getElementById('ppe-refresh-btn');
            if (refreshBtn) {
                const handler = () => this.refreshActiveTab();
                refreshBtn.addEventListener('click', handler);
                this.state.eventListeners.set(refreshBtn, { event: 'click', handler });
            }

            // Stock control tab buttons
            const addStockItemBtn = document.getElementById('add-stock-item-btn');
            const addTransactionBtn = document.getElementById('add-transaction-btn');
            if (addStockItemBtn) {
                const handler = () => this.showStockItemForm();
                addStockItemBtn.addEventListener('click', handler);
                this.state.eventListeners.set(addStockItemBtn, { event: 'click', handler });
            }
            if (addTransactionBtn) {
                const handler = () => this.showTransactionForm();
                addTransactionBtn.addEventListener('click', handler);
                this.state.eventListeners.set(addTransactionBtn, { event: 'click', handler });
            }
        }, 100);
    },

    /**
     * تحديث أزرار الهيدر حسب التبويب النشط
     */
    updateHeaderButtons() {
        const headerButtonsContainer = document.querySelector('#ppe-section .section-header .flex.gap-2');
        if (!headerButtonsContainer) return;

        // تنظيف مستمعي الأحداث للأزرار القديمة قبل استبدالها
        const oldButtons = [
            document.getElementById('add-ppe-btn'),
            document.getElementById('view-ppe-matrix-btn'),
            document.getElementById('ppe-refresh-btn'),
            document.getElementById('add-stock-item-btn'),
            document.getElementById('add-transaction-btn')
        ].filter(Boolean);

        oldButtons.forEach(btn => {
            if (this.state.eventListeners.has(btn)) {
                const listener = this.state.eventListeners.get(btn);
                btn.removeEventListener(listener.event, listener.handler);
                this.state.eventListeners.delete(btn);
            }
        });

        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        // استبدال الأزرار
        if (this.state.activeTab === 'receipts') {
            headerButtonsContainer.innerHTML = `
                <button id="view-ppe-matrix-btn" class="btn-secondary">
                    <i class="fas fa-table ml-2"></i>
                    ${ut(t('module.ppe.btn.matrix', 'مصفوفة مهمات الوقاية'))}
                </button>
                <button id="add-ppe-btn" class="btn-primary">
                    <i class="fas fa-plus ml-2"></i>
                    ${ut(t('module.ppe.btn.newReceipt', 'تسجيل استلام جديد'))}
                </button>
                <button id="ppe-refresh-btn" type="button" class="btn-secondary border-2 border-green-500 text-green-600 hover:bg-green-50" title="${ut(t('module.ppe.btn.refreshTitle', 'تحديث المحتوى الحالي'))}">
                    <i class="fas fa-sync-alt ml-2"></i>
                    ${ut(t('module.ppe.btn.refresh', 'تحديث'))}
                </button>
            `;
        } else {
            headerButtonsContainer.innerHTML = `
                <button id="add-stock-item-btn" class="btn-primary">
                    <i class="fas fa-plus ml-2"></i>
                    ${ut(t('module.ppe.btn.addStockItem', 'إضافة صنف جديد'))}
                </button>
                <button id="add-transaction-btn" class="btn-secondary">
                    <i class="fas fa-exchange-alt ml-2"></i>
                    ${ut(t('module.ppe.btn.addTransaction', 'إضافة حركة'))}
                </button>
            `;
        }
        this.applyModuleI18n(headerButtonsContainer);

        // إعادة إعداد مستمعي الأحداث للأزرار الجديدة
        const addBtn = document.getElementById('add-ppe-btn');
        const viewMatrixBtn = document.getElementById('view-ppe-matrix-btn');
        const addStockItemBtn = document.getElementById('add-stock-item-btn');
        const addTransactionBtn = document.getElementById('add-transaction-btn');

        if (addBtn) {
            const handler = () => this.showPPEForm();
            addBtn.addEventListener('click', handler);
            this.state.eventListeners.set(addBtn, { event: 'click', handler });
        }
        if (viewMatrixBtn) {
            const handler = () => this.showPPEMatrix();
            viewMatrixBtn.addEventListener('click', handler);
            this.state.eventListeners.set(viewMatrixBtn, { event: 'click', handler });
        }
        const refreshBtn = document.getElementById('ppe-refresh-btn');
        if (refreshBtn) {
            const handler = () => this.refreshActiveTab();
            refreshBtn.addEventListener('click', handler);
            this.state.eventListeners.set(refreshBtn, { event: 'click', handler });
        }
        if (addStockItemBtn) {
            const handler = () => this.showStockItemForm();
            addStockItemBtn.addEventListener('click', handler);
            this.state.eventListeners.set(addStockItemBtn, { event: 'click', handler });
        }
        if (addTransactionBtn) {
            const handler = () => this.showTransactionForm();
            addTransactionBtn.addEventListener('click', handler);
            this.state.eventListeners.set(addTransactionBtn, { event: 'click', handler });
        }
    },

    async switchTab(tabName) {
        // منع التبديل المتزامن
        if (this.state.isSwitchingTab) {
            Utils.safeWarn('⚠️ التبديل بين التبويبات قيد التنفيذ بالفعل');
            return;
        }

        // التحقق من أن التبويب مختلف
        if (this.state.activeTab === tabName) {
            return;
        }

        try {
            this.state.isSwitchingTab = true;
            this.state.activeTab = tabName;
            
            // تحديث حالة التبويبات (إزالة active من الكل وإضافتها للتبويب المحدد)
            const tabBtns = document.querySelectorAll('.ppe-tab-btn');
            tabBtns.forEach(btn => {
                btn.classList.remove('active');
                const btnTab = btn.getAttribute('data-tab');
                if (btnTab === tabName) {
                    btn.classList.add('active');
                }
            });
            
            // تحديث محتوى التبويب فقط (بدلاً من إعادة تحميل الموديول بالكامل)
            const tabContentContainer = document.getElementById('ppe-tab-content');
            if (tabContentContainer) {
                try {
                    // ✅ تحسين: عرض مؤشر تحميل خفيف بدون تغيير المحتوى بالكامل
                    tabContentContainer.style.opacity = '0.5';
                    tabContentContainer.style.pointerEvents = 'none';
                    
                    // عرض مؤشر التحميل فقط إذا كان التبويب الجديد هو المخزون
                    if (tabName === 'stock-control') {
                        tabContentContainer.innerHTML = `
                            <div class="empty-state">
                                <div style="width: 300px; margin: 0 auto 16px;">
                                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                    </div>
                                </div>
                                <p class="text-gray-500 mb-4">${this._t('module.ppe.loading.stockData', 'جاري تحميل بيانات المخزون...')}</p>
                            </div>
                        `;
                    }
                    
                    // تحميل محتوى التبويب الجديد
                    const newContent = await this.renderActiveTabContent();
                    tabContentContainer.innerHTML = newContent;
                    this.applyModuleI18n(tabContentContainer);
                    if (tabName === 'receipts') {
                        this.ensurePpeFilterStyles();
                        this.bindReceiptsFilters();
                    }
                    Utils.safeLog(`✅ PPE: تم التبديل إلى تبويب ${tabName}`);
                } catch (error) {
                    Utils.safeError('❌ خطأ في تحميل محتوى التبويب:', error);
                    tabContentContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">${Utils.escapeHTML(this._t('module.ppe.empty.loadError', 'حدث خطأ أثناء تحميل البيانات'))}</p>
                            <button onclick="PPE.switchTab('${tabName}')" class="btn-primary">
                                <i class="fas fa-redo ml-2"></i>
                                ${Utils.escapeHTML(this._t('module.common.retry', 'إعادة المحاولة'))}
                            </button>
                        </div>
                    `;
                } finally {
                    // ✅ استعادة الشفافية دائماً
                    tabContentContainer.style.opacity = '1';
                    tabContentContainer.style.pointerEvents = 'auto';
                }
            }
            
            // تحديث أزرار الهيدر
            this.updateHeaderButtons();
            
        } catch (error) {
            Utils.safeError('❌ خطأ في التبديل بين التبويبات:', error);
        } finally {
            this.state.isSwitchingTab = false;
        }
    },

    async showPPEForm(ppeData = null) {
        const isEdit = !!ppeData;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const employeesList = AppState.appData.employees || [];
        const initialCodeRaw = (ppeData?.employeeCode || ppeData?.employeeNumber || '').toString().trim();
        const initialCode = initialCodeRaw.length ? initialCodeRaw : '';
        const initialEmployee = initialCode
            ? employeesList.find(emp => {
                const codes = [
                    emp.employeeNumber,
                    emp.employeeCode,
                    emp.sapId,
                    emp.id,
                    emp.nationalId,
                    emp.cardId
                ].map(value => (value || '').toString().trim().toLowerCase());
                return codes.includes(initialCode.toLowerCase());
            })
            : null;
        const employeeInfo = {
            name: initialEmployee?.name || ppeData?.employeeName || '',
            department: initialEmployee?.department || ppeData?.employeeDepartment || '',
            position: initialEmployee?.position || ppeData?.employeePosition || '',
            branch: initialEmployee?.branch || ppeData?.employeeBranch || '',
            location: initialEmployee?.location || ppeData?.employeeLocation || ''
        };
        const formatInfo = (value) => value ? Utils.escapeHTML(value) : '—';
        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        const stReceived = t('module.ppe.status.received', 'مستلم');
        const stPending = t('module.ppe.status.pending', 'قيد التسليم');
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px; border-radius: 1rem; overflow: hidden;">
                <div class="modal-header" style="background: linear-gradient(135deg, #1d4ed8, #0f766e); color: #ffffff; text-align: center; position: relative; padding: 1rem 1.5rem;">
                    <h2 class="modal-title" style="margin: 0 auto; font-weight: 700; letter-spacing: 0.03em;">
                        ${isEdit ? ut(t('module.ppe.title.editReceipt', 'تعديل استلام')) : ut(t('module.ppe.title.newReceipt', 'تسجيل استلام جديد'))}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #ffffff;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="ppe-form" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.employeeCode', 'الكود الوظيفي *'))}</label>
                                <div class="relative">
                                    <input type="text" id="ppe-employee-code" required class="form-input pr-12"
                                        value="${Utils.escapeHTML(ppeData?.employeeCode || ppeData?.employeeNumber || '')}"
                                        placeholder="${ut(t('module.ppe.searchEmployeeTitle', 'أدخل الكود الوظيفي أو امسح الباركود'))}" autocomplete="off">
                                    <button type="button" id="ppe-search-code-btn"
                                        class="absolute inset-y-0 left-0 flex items-center justify-center w-10 text-gray-500 hover:text-gray-700"
                                        title="${ut(t('module.ppe.searchEmployeeTitle', 'بحث عن الموظف'))}">
                                        <i class="fas fa-search"></i>
                                    </button>
                                    </div>
                                <p class="text-xs text-gray-500 mt-1">
                                    ${ut(t('module.ppe.hint.employeeCode', ''))}
                                </p>
                                </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.employeeName', 'اسم الموظف'))}</label>
                                <div class="relative">
                                    <input type="text" id="ppe-employee-name" class="form-input"
                                        value="${Utils.escapeHTML(ppeData?.employeeName || '')}"
                                        placeholder="${ut(t('module.ppe.placeholder.employeeName', ''))}" autocomplete="off">
                                    <div id="ppe-employee-dropdown" class="hse-lookup-dropdown absolute z-50 hidden w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"></div>
                            </div>
                            </div>
                        </div>

                        <input type="hidden" id="ppe-employee-department" value="${Utils.escapeHTML(employeeInfo.department)}">
                        <input type="hidden" id="ppe-employee-position" value="${Utils.escapeHTML(employeeInfo.position)}">
                        <input type="hidden" id="ppe-employee-branch" value="${Utils.escapeHTML(employeeInfo.branch)}">
                        <input type="hidden" id="ppe-employee-location" value="${Utils.escapeHTML(employeeInfo.location)}">

                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                                    <p class="text-gray-500 mb-1">${ut(t('module.ppe.label.name', 'الاسم'))}</p>
                                    <p id="ppe-employee-info-name" class="font-semibold text-gray-800">${formatInfo(employeeInfo.name)}</p>
                            </div>
                                <div>
                                    <p class="text-gray-500 mb-1">${ut(t('module.ppe.label.department', 'القسم'))}</p>
                                    <p id="ppe-employee-info-department" class="font-semibold text-gray-800">${formatInfo(employeeInfo.department)}</p>
                                </div>
                                <div>
                                    <p class="text-gray-500 mb-1">${ut(t('module.ppe.label.position', 'المنصب'))}</p>
                                    <p id="ppe-employee-info-position" class="font-semibold text-gray-800">${formatInfo(employeeInfo.position)}</p>
                                </div>
                            </div>
                            <div class="text-xs text-gray-500 flex flex-wrap gap-4 mt-3">
                                <span id="ppe-employee-info-branch" class="${employeeInfo.branch ? '' : 'hidden'}">
                                    ${employeeInfo.branch ? `${ut(t('module.ppe.label.branch', 'الفرع'))}: ${Utils.escapeHTML(employeeInfo.branch)}` : ''}
                                </span>
                                <span id="ppe-employee-info-location" class="${employeeInfo.location ? '' : 'hidden'}">
                                    ${employeeInfo.location ? `${ut(t('module.ppe.label.location', 'الموقع'))}: ${Utils.escapeHTML(employeeInfo.location)}` : ''}
                                </span>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="text-sm font-semibold text-gray-800">${ut(t('module.ppe.items.title', 'الأصناف المستلمة *'))}</h3>
                                    <button type="button" id="ppe-add-item-btn" class="btn-secondary text-xs px-3 py-1">
                                        <i class="fas fa-plus ml-1"></i>${ut(t('module.ppe.items.addRow', 'إضافة صنف آخر'))}
                                    </button>
                                </div>
                                <div id="ppe-items-container" class="space-y-3">
                                    <div class="ppe-item-row grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                        <div class="md:col-span-2">
                                            <label class="block text-xs font-semibold text-gray-700 mb-1">${ut(t('module.ppe.label.equipmentType', 'نوع المعدة *'))}</label>
                                            <select id="ppe-equipment-type" required class="form-input ppe-equipment-type">
                                                <option value="">${ut(t('module.ppe.equip.loading', 'جاري التحميل...'))}</option>
                                            </select>
                                            <p class="text-[11px] text-gray-500 mt-1">
                                                ${ut(t('module.ppe.hint.fromStock', ''))}
                                            </p>
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold text-gray-700 mb-1">${ut(t('module.ppe.label.qty', 'الكمية *'))}</label>
                                            <div class="flex items-center gap-2">
                                                <input type="number" id="ppe-quantity" required class="form-input ppe-quantity" min="1"
                                                    value="${ppeData?.quantity || 1}" placeholder="${ut(t('module.ppe.table.quantity', 'الكمية'))}">
                                                <button type="button" class="btn-secondary ppe-remove-item hidden text-xs px-3 py-2">
                                                    <i class="fas fa-trash-alt ml-1"></i>${ut(t('module.ppe.btn.removeRow', 'حذف'))}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">
                                    ${ut(t('module.ppe.items.hint', ''))}
                                </p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.receiptDate', 'تاريخ الاستلام *'))}</label>
                                    <input type="date" id="ppe-receipt-date" required class="form-input"
                                        value="${ppeData?.receiptDate ? new Date(ppeData.receiptDate).toISOString().slice(0, 10) : ''}">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.status', 'الحالة *'))}</label>
                                    <select id="ppe-status" required class="form-input">
                                        <option value="مستلم" ${ppeData?.status === 'مستلم' ? 'selected' : ''}>${ut(stReceived)}</option>
                                        <option value="قيد التسليم" ${ppeData?.status === 'قيد التسليم' ? 'selected' : ''}>${ut(stPending)}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.notes', 'ملاحظات'))}</label>
                                <textarea id="ppe-notes" class="form-input" rows="3"
                                    placeholder="${ut(t('module.ppe.placeholder.notes', ''))}">${Utils.escapeHTML(ppeData?.notes || '')}</textarea>
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${ut(t('module.common.cancel', 'إلغاء'))}</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? ut(t('module.common.saveChanges', 'حفظ التعديلات')) : ut(t('module.ppe.btn.saveReceipt', 'تسجيل الاستلام'))}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.applyModuleI18n(modal);

        // Setup employee code search and autocomplete for PPE form
        setTimeout(() => {
            const codeInput = document.getElementById('ppe-employee-code');
            const nameInput = document.getElementById('ppe-employee-name');
            const dropdown = document.getElementById('ppe-employee-dropdown');
            const searchBtn = document.getElementById('ppe-search-code-btn');
            const departmentInput = document.getElementById('ppe-employee-department');
            const positionInput = document.getElementById('ppe-employee-position');
            const branchInput = document.getElementById('ppe-employee-branch');
            const locationInput = document.getElementById('ppe-employee-location');
            const infoName = document.getElementById('ppe-employee-info-name');
            const infoDepartment = document.getElementById('ppe-employee-info-department');
            const infoPosition = document.getElementById('ppe-employee-info-position');
            const infoBranch = document.getElementById('ppe-employee-info-branch');
            const infoLocation = document.getElementById('ppe-employee-info-location');
            const employees = AppState.appData.employees || [];

            const Lb = (k, f) => PPE._t(k, f);
            const updateInfoDisplay = (info = {}) => {
                if (infoName) infoName.textContent = info.name || '—';
                if (infoDepartment) infoDepartment.textContent = info.department || '—';
                if (infoPosition) infoPosition.textContent = info.position || '—';
                if (infoBranch) {
                    if (info.branch) {
                        infoBranch.textContent = `${Lb('module.ppe.label.branch', 'الفرع')}: ${info.branch}`;
                        infoBranch.classList.remove('hidden');
                    } else {
                        infoBranch.textContent = '';
                        infoBranch.classList.add('hidden');
                    }
                }
                if (infoLocation) {
                    if (info.location) {
                        infoLocation.textContent = `${Lb('module.ppe.label.location', 'الموقع')}: ${info.location}`;
                        infoLocation.classList.remove('hidden');
                    } else {
                        infoLocation.textContent = '';
                        infoLocation.classList.add('hidden');
                    }
                }
            };

            const applyEmployee = (employee, { notifySuccess = false, notifyFail = false } = {}) => {
                if (!employee) {
                    if (notifyFail) {
                        Notification.warning(Lb('module.ppe.notify.employeeNotFound', 'لم يتم العثور على موظف بهذا الكود'));
                    }
                    updateInfoDisplay({
                        name: nameInput?.value?.trim() || '—',
                        department: departmentInput?.value || '',
                        position: positionInput?.value || '',
                        branch: branchInput?.value || '',
                        location: locationInput?.value || ''
                    });
                    return false;
                }

                const codeValue = employee.employeeNumber || employee.employeeCode || employee.sapId || employee.id || '';
                if (codeInput && codeValue) {
                    codeInput.value = codeValue;
                }
                if (nameInput) nameInput.value = employee.name || '';
                if (departmentInput) departmentInput.value = employee.department || '';
                if (positionInput) positionInput.value = employee.position || '';
                if (branchInput) branchInput.value = employee.branch || '';
                if (locationInput) locationInput.value = employee.location || '';

                updateInfoDisplay({
                    name: employee.name || '—',
                    department: employee.department || '',
                    position: employee.position || '',
                    branch: employee.branch || '',
                    location: employee.location || ''
                });

                if (notifySuccess) {
                    Notification.success(Lb('module.ppe.notify.employeeLoaded', 'تم جلب بيانات الموظف بنجاح'));
                }
                return true;
            };

            const findEmployeeByCode = (code) => {
                if (!code) return null;
                const normalized = code.trim().toLowerCase();
                if (!normalized) return null;

                let result = null;
                if (typeof EmployeeHelper !== 'undefined' && typeof EmployeeHelper.findByCode === 'function') {
                    result = EmployeeHelper.findByCode(code) || EmployeeHelper.findByCode(normalized);
                }
                if (result) return result;

                return employees.find(emp => (
                    [
                        emp.employeeNumber,
                        emp.employeeCode,
                        emp.sapId,
                        emp.id,
                        emp.nationalId,
                        emp.cardId
                    ].some(value => String(value || '').trim().toLowerCase() === normalized)
                )) || null;
            };

            const handleCodeSearch = ({ notify = true } = {}) => {
                const codeValue = codeInput?.value?.trim();
                if (!codeValue) return;
                const employee = findEmployeeByCode(codeValue);
                applyEmployee(employee, { notifySuccess: notify, notifyFail: notify });
            };

            if (codeInput) {
                codeInput.addEventListener('blur', () => handleCodeSearch({ notify: false }));
                codeInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        handleCodeSearch({ notify: true });
                    }
                });
            }

            if (searchBtn) {
                searchBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    handleCodeSearch({ notify: true });
                });
            }

            if (nameInput && dropdown) {
                nameInput.addEventListener('input', (event) => {
                    const searchTerm = event.target.value.trim();
                    dropdown.innerHTML = '';
                    dropdown.classList.add('hidden');

                    if (searchTerm.length < 2) return;

                    const lower = searchTerm.toLowerCase();
                    const matches = employees.filter(emp => {
                        const values = [emp.name, emp.employeeNumber, emp.employeeCode, emp.sapId];
                        return values.some(value => String(value || '').toLowerCase().includes(lower));
                    }).slice(0, 12);

                    if (!matches.length) return;

                    matches.forEach(emp => {
                        const option = document.createElement('button');
                        option.type = 'button';
                        option.className = 'w-full text-right p-3 hover:bg-blue-50 focus:bg-blue-100 focus:outline-none border-b border-gray-100 last:border-b-0';

                        const title = document.createElement('div');
                        title.className = 'font-semibold text-gray-800';
                        title.textContent = emp.name || 'بدون اسم';

                        const subtitle = document.createElement('div');
                        subtitle.className = 'text-xs text-gray-500 mt-1';
                        subtitle.textContent = [emp.employeeNumber || emp.employeeCode || emp.sapId || '', emp.department || '', emp.position || '']
                            .filter(Boolean)
                            .join(' • ');

                        option.appendChild(title);
                        option.appendChild(subtitle);
                        option.addEventListener('click', () => {
                            applyEmployee(emp, { notifySuccess: false, notifyFail: false });
                            dropdown.classList.add('hidden');
                        });

                        dropdown.appendChild(option);
                    });

                    dropdown.classList.remove('hidden');
                });
            }

            const modalClickHandler = (event) => {
                if (dropdown && !dropdown.contains(event.target) && nameInput && !nameInput.contains(event.target)) {
                    dropdown.classList.add('hidden');
                }
                if (event.target === modal) {
                    modal.remove();
                }
            };
            modal.addEventListener('click', modalClickHandler);

            updateInfoDisplay({
                name: employeeInfo.name || nameInput?.value?.trim() || '—',
                department: employeeInfo.department || departmentInput?.value || '',
                position: employeeInfo.position || positionInput?.value || '',
                branch: employeeInfo.branch || branchInput?.value || '',
                location: employeeInfo.location || locationInput?.value || ''
            });

            // إعداد إدارة صفوف الأصناف (إمكانية إضافة أكثر من صنف لنفس الموظف)
            const itemsContainer = document.getElementById('ppe-items-container');
            const addItemBtn = document.getElementById('ppe-add-item-btn');

            const refreshRemoveButtonsVisibility = () => {
                if (!itemsContainer) return;
                const rows = Array.from(itemsContainer.querySelectorAll('.ppe-item-row'));
                rows.forEach(row => {
                    const removeBtn = row.querySelector('.ppe-remove-item');
                    if (!removeBtn) return;
                    const shouldHide = rows.length === 1 || isEdit;
                    if (shouldHide) {
                        removeBtn.classList.add('hidden');
                    } else {
                        removeBtn.classList.remove('hidden');
                    }
                });
            };

            const attachRemoveHandler = (row) => {
                if (!itemsContainer || !row) return;
                const removeBtn = row.querySelector('.ppe-remove-item');
                if (!removeBtn) return;

                removeBtn.addEventListener('click', () => {
                    const rows = Array.from(itemsContainer.querySelectorAll('.ppe-item-row'));
                    if (rows.length <= 1) return;
                    row.remove();
                    refreshRemoveButtonsVisibility();
                });
            };

            const createItemRow = () => {
                if (!itemsContainer) return null;
                const baseRow = itemsContainer.querySelector('.ppe-item-row');
                if (!baseRow) return null;

                const newRow = baseRow.cloneNode(true);

                const selectEl = newRow.querySelector('.ppe-equipment-type');
                if (selectEl) {
                    selectEl.value = '';
                    if (selectEl.id === 'ppe-equipment-type') {
                        selectEl.removeAttribute('id');
                    }
                }

                const quantityEl = newRow.querySelector('.ppe-quantity');
                if (quantityEl) {
                    quantityEl.value = '1';
                    if (quantityEl.id === 'ppe-quantity') {
                        quantityEl.removeAttribute('id');
                    }
                }

                itemsContainer.appendChild(newRow);
                attachRemoveHandler(newRow);
                refreshRemoveButtonsVisibility();

                // التأكد من تحميل قائمة الأصناف في الصف الجديد
                this.loadPPEItemsForDropdown();

                return newRow;
            };

            if (itemsContainer) {
                const initialRows = Array.from(itemsContainer.querySelectorAll('.ppe-item-row'));
                initialRows.forEach(row => attachRemoveHandler(row));
                refreshRemoveButtonsVisibility();
            }

            if (addItemBtn) {
                if (isEdit) {
                    addItemBtn.classList.add('hidden');
                } else {
                    addItemBtn.addEventListener('click', (event) => {
                        event.preventDefault();
                        createItemRow();
                    });
                }
            }

            // Load PPE items list from stock and populate equipment type dropdown
            this.loadPPEItemsForDropdown(ppeData?.equipmentType);
            
            // Setup form submit handler
            const form = modal.querySelector('#ppe-form');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    // منع النقر المتكرر
                    const submitBtn = form?.querySelector('button[type="submit"]') || 
                                     e.target?.querySelector('button[type="submit"]');
                    
                    if (submitBtn && submitBtn.disabled) {
                        return; // النموذج قيد المعالجة
                    }

                    // تعطيل الزر لمنع النقر المتكرر
                    let originalText = '';
                    if (submitBtn) {
                        originalText = submitBtn.innerHTML;
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
                    }

                    // توليد رقم إيصال مسلسل
                    const existingPPE = AppState.appData.ppe || [];
                    const currentYear = new Date().getFullYear();
                    const existingNumbers = existingPPE
                        .filter(p => p.receiptNumber && p.receiptNumber.startsWith(`PPE-${currentYear}-`))
                        .map(p => {
                            const match = p.receiptNumber.match(/\d+$/);
                            return match ? parseInt(match[0]) : 0;
                        });
                    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
                    const receiptNumber = isEdit && ppeData?.receiptNumber
                        ? ppeData.receiptNumber
                        : `PPE-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                    // فحص العناصر قبل الاستخدام
                    const employeeNameEl = document.getElementById('ppe-employee-name');
                    const employeeCodeEl = document.getElementById('ppe-employee-code');
                    const employeeDepartmentEl = document.getElementById('ppe-employee-department');
                    const employeePositionEl = document.getElementById('ppe-employee-position');
                    const employeeBranchEl = document.getElementById('ppe-employee-branch');
                    const employeeLocationEl = document.getElementById('ppe-employee-location');
                    const itemsContainerEl = document.getElementById('ppe-items-container');
                    const receiptDateEl = document.getElementById('ppe-receipt-date');
                    const statusEl = document.getElementById('ppe-status');
                    const notesEl = document.getElementById('ppe-notes');
                    
                    if (!employeeNameEl || !employeeCodeEl || !employeeDepartmentEl || !employeePositionEl || 
                        !employeeBranchEl || !employeeLocationEl || !itemsContainerEl || 
                        !receiptDateEl || !statusEl) {
                        Notification.error(PPE._t('module.ppe.notify.fieldsMissing', 'بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.'));
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        return;
                    }

                    if (!receiptDateEl.value) {
                        Notification.error(PPE._t('module.ppe.notify.dateRequired', 'يرجى تحديد تاريخ الاستلام.'));
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        return;
                    }

                    const itemRows = Array.from(itemsContainerEl.querySelectorAll('.ppe-item-row'));
                    if (!itemRows.length) {
                        Notification.error(PPE._t('module.ppe.notify.itemsRequired', 'يجب إضافة صنف واحد على الأقل قبل حفظ الاستلام.'));
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        return;
                    }

                    const equipmentItems = [];
                    for (const row of itemRows) {
                        const typeSelect = row.querySelector('.ppe-equipment-type');
                        const quantityInput = row.querySelector('.ppe-quantity');

                        if (!typeSelect || !quantityInput) {
                            Notification.error(PPE._t('module.ppe.notify.rowsIncomplete', 'بعض صفوف الأصناف غير مكتملة. يرجى التأكد من أن كل صف يحتوي على نوع وكمية.'));
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = originalText;
                            }
                            return;
                        }

                        const typeValue = (typeSelect.value || '').trim();
                        const quantityValue = parseInt(quantityInput.value, 10) || 0;

                        if (!typeValue) {
                            Notification.error(PPE._t('module.ppe.notify.selectEquipmentEachRow', 'يرجى اختيار نوع المعدة لكل صف قبل الحفظ.'));
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = originalText;
                            }
                            return;
                        }

                        if (quantityValue <= 0) {
                            Notification.error(PPE._t('module.ppe.notify.qtyPositive', 'الكمية لكل صنف يجب أن تكون رقمًا أكبر من صفر.'));
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = originalText;
                            }
                            return;
                        }

                        equipmentItems.push({
                            equipmentType: typeValue,
                            quantity: quantityValue
                        });
                    }

                    const commonData = {
                        receiptNumber: receiptNumber,
                        employeeName: employeeNameEl.value.trim(),
                        employeeCode: employeeCodeEl.value.trim(),
                        employeeNumber: employeeCodeEl.value.trim(),
                        employeeDepartment: employeeDepartmentEl.value.trim(),
                        employeePosition: employeePositionEl.value.trim(),
                        employeeBranch: employeeBranchEl.value.trim(),
                        employeeLocation: employeeLocationEl.value.trim(),
                        receiptDate: new Date(receiptDateEl.value).toISOString(),
                        status: statusEl.value,
                        notes: (notesEl?.value || '').trim()
                    };

                    try {
                        // 1. حفظ البيانات فوراً في الذاكرة
                        if (isEdit) {
                            const index = AppState.appData.ppe.findIndex(p => p.id === ppeData.id);
                            if (index !== -1) {
                                const firstItem = equipmentItems[0] || { equipmentType: '', quantity: 0 };
                                const existing = AppState.appData.ppe[index] || {};
                                const updatedRecord = {
                                    ...existing,
                                    ...commonData,
                                    equipmentType: firstItem.equipmentType,
                                    quantity: firstItem.quantity,
                                    createdAt: existing.createdAt || ppeData?.createdAt || new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                };
                                AppState.appData.ppe[index] = updatedRecord;
                            }
                        } else {
                            const existingPPEData = AppState.appData.ppe || [];
                            const newItems = [];

                            equipmentItems.forEach(item => {
                                const allExisting = existingPPEData.concat(newItems);
                                const id = Utils.generateSequentialId('PPE', allExisting);
                                const record = {
                                    id,
                                    ...commonData,
                                    equipmentType: item.equipmentType,
                                    quantity: item.quantity,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                };
                                newItems.push(record);
                                AppState.appData.ppe.push(record);
                            });
                        }
                        
                        // حفظ البيانات باستخدام window.DataManager
                        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                            window.DataManager.save();
                        } else {
                            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
                        }
                        
                        // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
                        modal.remove();
                        
                        // 3. عرض رسالة نجاح فورية
                        Notification.success(isEdit
                            ? PPE._t('module.ppe.notify.updateSuccess', 'تم تحديث الاستلام بنجاح')
                            : PPE._t('module.ppe.notify.saveSuccess', 'تم تسجيل الاستلام بنجاح'));
                        
                        // 4. استعادة الزر بعد النجاح
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        
                        // 5. ✅ تحديث التبويب النشط فقط (أسرع من إعادة تحميل كامل)
                        this.refreshActiveTab();
                        
                        // 6. معالجة المهام الخلفية (Google Sheets) في الخلفية
                        GoogleIntegration.autoSave('PPE', AppState.appData.ppe).catch(error => {
                            Utils.safeError('خطأ في حفظ Google Sheets:', error);
                        });
                    } catch (error) {
                        Notification.error(PPE._t('module.ppe.notify.saveRuntimeError', 'حدث خطأ أثناء الحفظ') + ': ' + (error.message || error));
                        
                        // استعادة الزر في حالة الخطأ
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                    }
                });
            }
        }, 200);
    },

    async loadPPEItemsForDropdown(selectedValue = null) {
        const equipmentTypeSelect = document.getElementById('ppe-equipment-type') 
            || document.querySelector('.ppe-equipment-type');
        if (!equipmentTypeSelect) return;

        try {
            // Load items from backend
            let items = [];
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                const result = await GoogleIntegration.sendToAppsScript('getPPEItemsList', {});
                if (result && result.success && result.data) {
                    items = result.data;
                }
            }

            // Fallback: collect from existing PPE data
            if (items.length === 0) {
                const ppeList = AppState.appData.ppe || [];
                const uniqueTypes = [...new Set(ppeList.map(p => p.equipmentType).filter(Boolean))];
                items = uniqueTypes.map(type => ({ itemName: type, itemCode: '' }));
            }

            // Also add predefined items if not already present
            const predefinedItems = [
                'خوذة أمان', 'نظارات وقاية', 'قفازات', 'أحذية أمان',
                'سترة عاكسة', 'سدادات أذن', 'كمامة', 'بدلة واقية',
                'حزام أمان', 'معدات حماية تنفسية', 'خوذة', 'نظارات وقاية'
            ];
            
            predefinedItems.forEach(item => {
                if (!items.some(i => (i.itemName || '').trim() === item.trim())) {
                    items.push({ itemName: item, itemCode: '' });
                }
            });

            // Clear and populate dropdown
            equipmentTypeSelect.innerHTML = '<option value="">اختر النوع</option>';
            
            items.forEach(item => {
                const itemName = (item.itemName || '').trim();
                if (!itemName) return;
                
                const option = document.createElement('option');
                option.value = itemName;
                option.textContent = item.itemCode ? `${item.itemCode} - ${itemName}` : itemName;
                
                if (selectedValue && (itemName === selectedValue || item.itemCode === selectedValue)) {
                    option.selected = true;
                }
                
                equipmentTypeSelect.appendChild(option);
            });

            const optionsHTML = equipmentTypeSelect.innerHTML;

            // مزامنة نفس الخيارات مع جميع قوائم الأنواع في صفوف الأصناف
            const allSelects = document.querySelectorAll('.ppe-equipment-type');
            allSelects.forEach(select => {
                if (select === equipmentTypeSelect) return;
                const previousValue = select.value;
                select.innerHTML = optionsHTML;
                if (previousValue) {
                    select.value = previousValue;
                }
            });

            // If no items found, show default options
            if (items.length === 0) {
                const defaultOptions = [
                    { value: 'خوذة', label: 'خوذة' },
                    { value: 'نظارات وقاية', label: 'نظارات وقاية' },
                    { value: 'قفازات', label: 'قفازات' },
                    { value: 'أحذية أمان', label: 'أحذية أمان' },
                    { value: 'بدلة واقية', label: 'بدلة واقية' },
                    { value: 'أخرى', label: 'أخرى' }
                ];
                
                defaultOptions.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (selectedValue === opt.value) {
                        option.selected = true;
                    }
                    equipmentTypeSelect.appendChild(option);
                });
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل قائمة مهمات الوقاية:', error);
            // Set default options on error
            equipmentTypeSelect.innerHTML = `
                <option value="">اختر النوع</option>
                <option value="خوذة" ${selectedValue === 'خوذة' ? 'selected' : ''}>خوذة</option>
                <option value="نظارات وقاية" ${selectedValue === 'نظارات وقاية' ? 'selected' : ''}>نظارات وقاية</option>
                <option value="قفازات" ${selectedValue === 'قفازات' ? 'selected' : ''}>قفازات</option>
                <option value="أحذية أمان" ${selectedValue === 'أحذية أمان' ? 'selected' : ''}>أحذية أمان</option>
                <option value="بدلة واقية" ${selectedValue === 'بدلة واقية' ? 'selected' : ''}>بدلة واقية</option>
                <option value="أخرى" ${selectedValue === 'أخرى' ? 'selected' : ''}>أخرى</option>
            `;

            const optionsHTML = equipmentTypeSelect.innerHTML;
            const allSelects = document.querySelectorAll('.ppe-equipment-type');
            allSelects.forEach(select => {
                if (select === equipmentTypeSelect) return;
                const previousValue = select.value;
                select.innerHTML = optionsHTML;
                if (previousValue) {
                    select.value = previousValue;
                }
            });
        }
    },

    async viewPPE(id) {
        const item = AppState.appData.ppe.find(p => p.id === id);
        if (!item) return;

        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        const stLabel = this.getDisplayStatus(item.status);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const idJs = String(item.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header" style="text-align: center; position: relative;">
                    <h2 class="modal-title" style="margin: 0 auto; text-align: center;">${ut(t('module.ppe.title.viewReceipt', 'تفاصيل الاستلام'))}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.receiptNo', 'رقم الإيصال'))}:</label>
                                <p class="text-gray-800 font-mono font-semibold text-lg">${Utils.escapeHTML(item.receiptNumber || item.id || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.employeeName', 'اسم الموظف'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.employeeName || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.employeeCode', 'الكود الوظيفي'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.employeeCode || item.employeeNumber || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.label.department', 'القسم'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.employeeDepartment || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.label.position', 'المنصب'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.employeePosition || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.label.branch', 'الفرع'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.employeeBranch || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.label.location', 'الموقع'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.employeeLocation || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.equipmentType', 'نوع المعدة'))}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(item.equipmentType || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.quantity', 'الكمية'))}:</label>
                                <p class="text-gray-800">${item.quantity || 0}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.receiptDate', 'تاريخ الاستلام'))}:</label>
                                <p class="text-gray-800">${item.receiptDate ? Utils.formatDate(item.receiptDate) : '-'}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.table.status', 'الحالة'))}:</label>
                                <span class="badge badge-${this.isStatusReceived(item.status) ? 'success' : 'warning'}">
                                    ${ut(stLabel)}
                                </span>
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="text-sm font-semibold text-gray-600">${ut(t('module.ppe.label.notes', 'ملاحظات'))}:</label>
                            <p class="text-gray-800 whitespace-pre-wrap">${Utils.escapeHTML(item.notes || t('module.ppe.notes.none', 'لا توجد ملاحظات'))}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: center; gap: 10px;">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${ut(t('module.common.close', 'إغلاق'))}</button>
                    <button class="btn-success" onclick="PPE.exportPDF('${idJs}');">
                        <i class="fas fa-file-pdf ml-2"></i>${ut(t('module.kpi.exportPDF', 'تصدير PDF'))}
                    </button>
                    <button class="btn-primary" onclick="PPE.showPPEForm(${JSON.stringify(item).replace(/"/g, '&quot;')}); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>${ut(t('module.common.edit', 'تعديل'))}
                    </button>
                    <button class="btn-danger" onclick="PPE.deletePPE('${idJs}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-trash ml-2"></i>${ut(t('module.ppe.btn.deleteReceipt', 'حذف'))}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.applyModuleI18n(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async deletePPE(id) {
        if (!id) {
            Notification.error(this._t('module.ppe.notify.idMissing', 'معرف الاستلام غير موجود'));
            return;
        }

        const item = AppState.appData.ppe.find(p => p.id === id);
        if (!item) {
            Notification.error(this._t('module.ppe.notify.receiptNotFound', 'الاستلام غير موجود'));
            return;
        }

        const confirmMessage = `${this._t('module.ppe.confirm.delete', 'هل أنت متأكد من حذف هذا الاستلام؟')}\n\n${item.receiptNumber || item.id} — ${item.employeeName || ''}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        Loading.show();

        try {
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                const result = await GoogleIntegration.sendToAppsScript('deletePPE', { ppeId: id });
                
                if (result && result.success) {
                    // حذف من AppState
                    if (AppState.appData.ppe) {
                        AppState.appData.ppe = AppState.appData.ppe.filter(p => p.id !== id);
                    }
                    
                    Notification.success(this._t('module.ppe.notify.deleteSuccess', 'تم حذف الاستلام بنجاح'));
                    await this.load(); // إعادة تحميل البيانات
                } else {
                    Notification.error(result?.message || this._t('module.ppe.notify.deleteError', 'حدث خطأ أثناء حذف الاستلام'));
                }
            } else {
                // Fallback to local storage
                if (AppState.appData.ppe) {
                    AppState.appData.ppe = AppState.appData.ppe.filter(p => p.id !== id);
                    Notification.success(this._t('module.ppe.notify.deleteSuccess', 'تم حذف الاستلام بنجاح'));
                    await this.load();
                } else {
                    Notification.error(this._t('module.ppe.empty.noReceipts', 'لا توجد بيانات'));
                }
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في حذف الاستلام:', error);
            Notification.error(this._t('module.ppe.notify.deleteError', 'حدث خطأ أثناء حذف الاستلام') + ': ' + (error.message || error));
        } finally {
            Loading.hide();
        }
    },

    async exportPDF(id) {
        const item = AppState.appData.ppe.find(p => p.id === id);
        if (!item) {
            Notification.error(this._t('module.ppe.notify.receiptNotFound', 'الاستلام غير موجود'));
            return;
        }

        try {
            Loading.show();

            const formCode = item.receiptNumber || `PPE-${item.id?.substring(0, 8) || 'UNKNOWN'}`;
            const escape = (value) => Utils.escapeHTML(value || '');
            const formatDate = (value) => value ? Utils.formatDate(value) : '-';
            const content = `
                <table>
                    <tr><th>رقم الإيصال</th><td>${escape(item.receiptNumber || item.id)}</td></tr>
                    <tr><th>اسم الموظف</th><td>${escape(item.employeeName)}</td></tr>
                    <tr><th>الكود الوظيفي</th><td>${escape(item.employeeCode || item.employeeNumber)}</td></tr>
                    <tr><th>القسم</th><td>${escape(item.employeeDepartment)}</td></tr>
                    <tr><th>المنصب</th><td>${escape(item.employeePosition)}</td></tr>
                    <tr><th>الفرع</th><td>${escape(item.employeeBranch)}</td></tr>
                    <tr><th>الموقع</th><td>${escape(item.employeeLocation)}</td></tr>
                    <tr><th>نوع المعدة</th><td>${escape(item.equipmentType)}</td></tr>
                    <tr><th>الكمية</th><td>${item.quantity || 0}</td></tr>
                    <tr><th>تاريخ الاستلام</th><td>${formatDate(item.receiptDate)}</td></tr>
                    <tr><th>الحالة</th><td>${escape(item.status)}</td></tr>
                </table>
            `;

            const qrPayload = {
                type: 'PPE',
                id: item.id,
                code: formCode,
                url: `${window.location.origin}/ppe/${item.id}`
            };

            const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
                ? FormHeader.generatePDFHTML(
                    formCode,
                    this._t('module.ppe.pdf.receiptTitle', 'إيصال استلام مهمات الوقاية الشخصية'),
                    content,
                    false,
                    true,
                    {
                        version: '1.0',
                        releaseDate: item.receiptDate || item.createdAt,
                        revisionDate: item.updatedAt || item.receiptDate || item.createdAt,
                        qrData: qrPayload
                    },
                    item.createdAt,
                    item.updatedAt || item.receiptDate || item.createdAt
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>${Utils.escapeHTML(this._t('module.ppe.pdf.pageTitle', 'إيصال مهمات الوقاية الشخصية'))}</title></head><body>${content}</body></html>`;

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
                        }, 800);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error(this._t('module.ppe.notify.pdfBlocked', 'يرجى السماح للنوافذ المنبثقة لعرض التقرير'));
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF للاستلام:', error);
            Notification.error(this._t('module.ppe.notify.pdfError', 'فشل في تصدير PDF') + ': ' + error.message);
        }
    },

    /**
     * عرض مصوة مهمات الوقاية لكل موظ حسب الوظية
     */
    async showPPEMatrix() {
        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1400px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-table ml-2"></i>
                        ${ut(t('module.ppe.title.matrix', 'مصفوفة مهمات الوقاية الشخصية لكل موظف'))}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <div class="flex gap-2 items-center">
                            <input type="text" id="ppe-matrix-search" class="form-input" style="max-width: 400px;" 
                                placeholder="${ut(t('module.ppe.matrix.searchPlaceholder', ''))}">
                            <button id="add-ppe-matrix-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                ${ut(t('module.ppe.matrix.addEdit', 'إضافة/تعديل مصفوفة لوظيفة'))}
                            </button>
                        </div>
                    </div>
                    <div id="ppe-matrix-content">
                        ${await this.renderPPEMatrix()}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${ut(t('module.common.close', 'إغلاق'))}</button>
                    <button class="btn-primary" onclick="PPE.exportPPEMatrix()">
                        <i class="fas fa-file-excel ml-2"></i>${ut(t('module.ppe.matrix.exportExcel', 'تصدير Excel'))}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.applyModuleI18n(modal);

        // Setup search
        const searchInput = document.getElementById('ppe-matrix-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterPPEMatrix(e.target.value.trim());
            });
        }

        // Setup add matrix button
        const addMatrixBtn = document.getElementById('add-ppe-matrix-btn');
        if (addMatrixBtn) {
            addMatrixBtn.addEventListener('click', () => {
                this.showAddPPEMatrixForm();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async renderPPEMatrix() {
        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        const employees = AppState.appData.employees || [];
        const matrixByCode = AppState.appData.employeePPEMatrixByCode || {};
        const ppeList = AppState.appData.ppe || [];

        // ✅ إرجاع التصميم السابق: عرض مصفوفة لكل موظف بشكل فردي
        if (employees.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-table text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">${ut(t('module.ppe.empty.matrixNoEmployees', 'لا توجد بيانات موظفين'))}</p>
                </div>
            `;
        }

        // إنشاء مصفوفة لكل موظف
        const matrixRows = employees.map(emp => {
            const code = emp.employeeNumber || emp.sapId || '';
            const name = emp.name || emp.employeeName || '-';
            const position = emp.position || t('module.ppe.label.undefinedDept', 'غير محدد');
            const department = emp.department || '-';
            
            // الحصول على مهمات الوقاية المطلوبة من المصفوفة
            const requiredPPE = matrixByCode[code] || [];
            
            // الحصول على مهمات الوقاية المستلمة من جدول PPE
            const employeePPE = ppeList.filter(p => 
                (p.employeeCode === code || p.employeeNumber === code)
            );
            const receivedPPE = [...new Set(employeePPE.map(p => p.equipmentType).filter(Boolean))];

            return {
                code,
                name,
                position,
                department,
                requiredPPE,
                receivedPPE
            };
        });

        return `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>${ut(t('module.ppe.table.matrix.code', 'الكود الوظيفي'))}</th>
                            <th>${ut(t('module.ppe.table.matrix.name', 'اسم الموظف'))}</th>
                            <th>${ut(t('module.ppe.table.matrix.job', 'الوظيفة'))}</th>
                            <th>${ut(t('module.ppe.table.matrix.dept', 'القسم/الإدارة'))}</th>
                            <th>${ut(t('module.ppe.table.matrix.required', 'مهمات الوقاية المطلوبة'))}</th>
                            <th>${ut(t('module.ppe.table.matrix.received', 'مهمات الوقاية المستلمة'))}</th>
                            <th>${ut(t('module.ppe.table.actions', 'الإجراءات'))}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matrixRows.map(emp => {
            const requiredPPEHtml = emp.requiredPPE.length > 0 
                ? emp.requiredPPE.map(ppe => `<span class="badge badge-success mr-1 mb-1">${Utils.escapeHTML(ppe)}</span>`).join('')
                : `<span class="text-gray-500 text-sm">${ut(t('module.ppe.matrix.notSet', 'لم يتم تحديد'))}</span>`;
            
            const receivedPPEHtml = emp.receivedPPE.length > 0
                ? emp.receivedPPE.map(ppe => `<span class="badge badge-info mr-1 mb-1">${Utils.escapeHTML(ppe)}</span>`).join('')
                : `<span class="text-gray-500 text-sm">${ut(t('module.ppe.matrix.noneReceived', 'لا توجد'))}</span>`;

            return `
                                <tr data-employee-code="${Utils.escapeHTML(emp.code)}" data-employee-name="${Utils.escapeHTML(emp.name)}" data-position="${Utils.escapeHTML(emp.position)}">
                                    <td><strong class="font-mono">${Utils.escapeHTML(emp.code || '-')}</strong></td>
                                    <td>${Utils.escapeHTML(emp.name)}</td>
                                    <td>${Utils.escapeHTML(emp.position)}</td>
                                    <td>${Utils.escapeHTML(emp.department)}</td>
                                    <td>
                                        <div class="flex flex-wrap gap-1">
                                            ${requiredPPEHtml}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="flex flex-wrap gap-1">
                                            ${receivedPPEHtml}
                                        </div>
                                    </td>
                                    <td>
                                        <button onclick="PPE.editEmployeePPEMatrix('${Utils.escapeHTML(emp.code)}')" class="btn-icon btn-icon-primary" title="${ut(t('module.common.edit', 'تعديل'))}">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    filterPPEMatrix(searchTerm) {
        const tbody = document.querySelector('#ppe-matrix-content tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[data-employee-code]');
        rows.forEach(row => {
            const code = row.getAttribute('data-employee-code') || '';
            const name = row.getAttribute('data-employee-name') || '';
            const position = row.getAttribute('data-position') || '';
            const searchLower = searchTerm.toLowerCase();

            if (!searchTerm || 
                code.toLowerCase().includes(searchLower) ||
                name.toLowerCase().includes(searchLower) ||
                position.toLowerCase().includes(searchLower)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    async showAddPPEMatrixForm(position = null) {
        const isEdit = !!position;
        const matrix = AppState.appData.employeePPEMatrix || {};
        const ppeList = AppState.appData.ppe || [];
        const ppeTypes = [...new Set(ppeList.map(p => p.equipmentType).filter(Boolean))];
        const employees = AppState.appData.employees || [];
        const positions = [...new Set(employees.map(e => e.position).filter(Boolean))];
        const matrixData = position ? matrix[position] : null;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-plus-circle ml-2"></i>
                        ${isEdit ? 'تعديل مصفوفة مهمات الوقاية' : 'إضاءة مصفوفة مهمات الوقاية لوظية'}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="ppe-matrix-form" class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة *</label>
                                ${isEdit ? `
                                    <input type="text" id="ppe-matrix-position" value="${Utils.escapeHTML(position)}" class="form-input" readonly>
                                ` : `
                                    <select id="ppe-matrix-position" required class="form-input">
                                        <option value="">اختر الوظيفة</option>
                                        ${positions.map(p => `
                                            <option value="${Utils.escapeHTML(p)}" ${matrix[p] ? 'disabled' : ''}>${Utils.escapeHTML(p)}${matrix[p] ? ' (موجودة بالفعل)' : ''}</option>
                                        `).join('')}
                                        <option value="__custom__">إضافة وظيفة جديدة</option>
                                    </select>
                                    <input type="text" id="ppe-matrix-position-custom" class="form-input mt-2" style="display: none;" placeholder="أدخل اسم الوظيفة">
                                `}
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">مهمات الوقاية المطلوبة لهذه الوظيفة *</label>
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    ${ppeTypes.map((type, index) => `
                                        <label class="flex items-center p-2 border rounded cursor-pointer hover:bg-blue-50 transition-colors">
                                            <input type="checkbox" name="ppe-type" value="${Utils.escapeHTML(type)}" 
                                                ${matrixData && matrixData.requiredPPE && matrixData.requiredPPE.includes(type) ? 'checked' : ''}
                                                class="ml-2 rounded border-gray-300 text-blue-600">
                                            <span class="text-sm font-medium">${Utils.escapeHTML(type)}</span>
                                        </label>
                                    `).join('')}
                                    ${ppeTypes.length === 0 ? `
                                        <div class="col-span-3 text-center text-gray-500 py-4">
                                            لا توجد أنواع مهمات وقاية مسجلة. يرجى إضافة استلامات مهمات وقاية أولاً.
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="mt-4">
                                    <input type="text" id="ppe-matrix-custom-type" class="form-input" placeholder="أو أدخل نوع مهمة وقاية مخصصة">
                                    <button type="button" onclick="
                                        const customType = document.getElementById('ppe-matrix-custom-type');
                                        if(customType && customType.value.trim()) {
                                            const container = document.querySelector('#ppe-matrix-form .grid');
                                            const newLabel = document.createElement('label');
                                            newLabel.className = 'flex items-center p-2 border rounded cursor-pointer hover:bg-blue-50 transition-colors';
                                            const typeValue = customType.value.trim();
                                            newLabel.innerHTML = '<input type=\\'checkbox\\' name=\\'ppe-type\\' value=\\'' + typeValue + '\\' checked class=\\'ml-2 rounded border-gray-300 text-blue-600\\'><span class=\\'text-sm font-medium\\'>' + typeValue + '</span>';
                                            container.appendChild(newLabel);
                                            customType.value = '';
                                        }
                                    " class="btn-secondary mt-2">
                                        <i class="fas fa-plus ml-2"></i>إضافة
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p class="text-sm text-blue-800">
                                <i class="fas fa-info-circle ml-1"></i>
                                <strong>ملاحظة:</strong> سيتم تطبيق هذه المصفوفة على جميع الموظفين الذين لديهم هذه الوظيفة.
                            </p>
                        </div>
                        
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'إضافة المصفوفة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // معالج زر الإغلاق مع التحقق من التغييرات غير المحفوظة
        let hasUnsavedChanges = false;
        const closeBtn = modal.querySelector('[data-action="close"]');
        const modalCloseBtn = modal.querySelector('.modal-close');
        
        const closeModal = () => {
            if (hasUnsavedChanges && !isSaving) {
                const ok = confirm('تنبيه: لديك تغييرات غير محفوظة.\n\nهل تريد الإغلاق دون حفظ؟');
                if (!ok) return;
            }
            modal.remove();
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', closeModal);
        }

        // Handle custom position input
        const positionSelect = document.getElementById('ppe-matrix-position');
        const customPositionInput = document.getElementById('ppe-matrix-position-custom');
        if (positionSelect && customPositionInput) {
            positionSelect.addEventListener('change', () => {
                if (positionSelect.value === '__custom__') {
                    customPositionInput.style.display = 'block';
                    customPositionInput.required = true;
                } else {
                    customPositionInput.style.display = 'none';
                    customPositionInput.required = false;
                }
            });
        }

        const form = modal.querySelector('#ppe-matrix-form');
        let isSaving = false;

        // تتبع التغييرات في النموذج
        form.addEventListener('change', () => {
            hasUnsavedChanges = true;
        });
        form.addEventListener('input', () => {
            hasUnsavedChanges = true;
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (isSaving) return; // منع الإرسال المتكرر

            const selectedPosition = isEdit ? position : (positionSelect?.value === '__custom__' ? customPositionInput?.value.trim() : positionSelect?.value);
            if (!selectedPosition) {
                Notification.error('يرجى تحديد الوظيفة');
                return;
            }

            const checkedPPE = Array.from(form.querySelectorAll('input[name="ppe-type"]:checked')).map(cb => cb.value);
            if (checkedPPE.length === 0) {
                Notification.error('يرجى تحديد مهمات وقاية واحدة على الأقل');
                return;
            }

            isSaving = true;
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn?.innerHTML;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
            }

            try {
                // الحصول على جميع الموظفين بهذه الوظيفة (بناءً على الكود الوظيفي من جدول قاعدة بيانات الموظفين)
                const employeesWithPosition = employees.filter(e => e.position === selectedPosition).map(e => e.employeeNumber || e.sapId || '');

                if (!AppState.appData.employeePPEMatrix) {
                    AppState.appData.employeePPEMatrix = {};
                }

                const matrixData = AppState.appData.employeePPEMatrix[selectedPosition] || {};

                // تحديث مصفوفة مهمات الوقاية للوظيفة (مرتبطة بقاعدة بيانات الموظفين عبر الكود الوظيفي)
                AppState.appData.employeePPEMatrix[selectedPosition] = {
                    requiredPPE: checkedPPE,
                    employees: employeesWithPosition, // قائمة الكود الوظيفي للموظفين بهذه الوظيفة
                    updatedAt: new Date().toISOString(),
                    createdAt: matrixData?.createdAt || new Date().toISOString()
                };

                // تحديث مصفوفة مهمات الوقاية لكل موظف بناءً على الكود الوظيفي
                if (!AppState.appData.employeePPEMatrixByCode) {
                    AppState.appData.employeePPEMatrixByCode = {};
                }

                employeesWithPosition.forEach(code => {
                    if (code) {
                        if (!AppState.appData.employeePPEMatrixByCode[code]) {
                            AppState.appData.employeePPEMatrixByCode[code] = [];
                        }
                        // إضافة مهمات الوقاية المطلوبة لهذا الموظف (إذا لم تكن موجودة)
                        checkedPPE.forEach(ppe => {
                            if (!AppState.appData.employeePPEMatrixByCode[code].includes(ppe)) {
                                AppState.appData.employeePPEMatrixByCode[code].push(ppe);
                            }
                        });
                    }
                });

                // ✅ 1. حفظ البيانات في الذاكرة فوراً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                } else {
                    Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
                }

                // ✅ 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
                hasUnsavedChanges = false;
                Notification.success('تم ' + (isEdit ? 'تحديث' : 'إضافة') + ' مصفوفة مهمات الوقاية للوظيفة "' + selectedPosition + '" بنجاح');
                modal.remove();
                this.showPPEMatrix();

                // ✅ 3. معالجة المهام الخلفية في الخلفية (بدون انتظار)
                Promise.allSettled([
                    // حفظ في Google Sheets
                    GoogleIntegration.autoSave('PPEMatrix', AppState.appData.employeePPEMatrix).catch(error => {
                        Utils.safeError('خطأ في حفظ Google Sheets:', error);
                        return { success: false, error };
                    }),
                    // حفظ مصفوفة الموظفين أيضاً
                    GoogleIntegration.autoSave('EmployeePPEMatrixByCode', AppState.appData.employeePPEMatrixByCode).catch(error => {
                        Utils.safeError('خطأ في حفظ مصفوفة الموظفين في Google Sheets:', error);
                        return { success: false, error };
                    })
                ]).then((results) => {
                    // التحقق من نجاح المهام الخلفية (اختياري - فقط للتسجيل)
                    const allSucceeded = results.every(r => r.status === 'fulfilled');
                    if (!allSucceeded) {
                        Utils.safeWarn('⚠️ بعض المهام الخلفية لم تكتمل بنجاح، لكن البيانات محفوظة محلياً');
                    }
                }).catch(error => {
                    Utils.safeError('خطأ في معالجة المهام الخلفية:', error);
                });

            } catch (error) {
                Notification.error(PPE._t('module.ppe.notify.saveRuntimeError', 'حدث خطأ') + ': ' + error.message);
                Utils.safeError('خطأ في حفظ مصفوفة مهمات الوقاية:', error);
                
                // استعادة الزر في حالة الخطأ
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
                isSaving = false;
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (hasUnsavedChanges && !isSaving) {
                    const ok = confirm('تنبيه: لديك تغييرات غير محفوظة.\n\nهل تريد الإغلاق دون حفظ؟');
                    if (!ok) return;
                }
                modal.remove();
            }
        });
    },

    async editPPEMatrix(position) {
        this.showAddPPEMatrixForm(position);
    },

    /**
     * ✅ تعديل مصفوفة مهمات الوقاية لموظف فردي (التصميم السابق)
     */
    async editEmployeePPEMatrix(employeeCode) {
        const employees = AppState.appData.employees || [];
        const employee = employees.find(e => (e.employeeNumber || e.sapId) === employeeCode);
        
        if (!employee) {
            Notification.error('الموظف غير موجود');
            return;
        }

        const matrixByCode = AppState.appData.employeePPEMatrixByCode || {};
        const currentPPE = matrixByCode[employeeCode] || [];
        const ppeList = AppState.appData.ppe || [];
        const ppeTypes = [...new Set(ppeList.map(p => p.equipmentType).filter(Boolean))];

        // إضافة أنواع مهمات الوقاية المحددة مسبقاً
        const predefinedPPE = [
            'خوذة أمان', 'نظارات وقاية', 'قفازات', 'أحذية أمان',
            'سترة عاكسة', 'سدادات أذن', 'كمامة', 'بدلة واقية',
            'حزام أمان', 'معدات حماية تنفسية'
        ];
        const allPPETypes = [...new Set([...predefinedPPE, ...ppeTypes])];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل مصفوفة مهمات الوقاية - ${Utils.escapeHTML(employee.name || employeeCode)}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4 p-3 bg-gray-50 rounded">
                        <p><strong>الكود الوظيفي:</strong> ${Utils.escapeHTML(employeeCode)}</p>
                        <p><strong>اسم الموظف:</strong> ${Utils.escapeHTML(employee.name || '-')}</p>
                        <p><strong>الوظيفة:</strong> ${Utils.escapeHTML(employee.position || '-')}</p>
                        <p><strong>القسم:</strong> ${Utils.escapeHTML(employee.department || '-')}</p>
                    </div>
                    <form id="employee-ppe-matrix-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">مهمات الوقاية المطلوبة *</label>
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    ${allPPETypes.map((type, index) => `
                                        <label class="flex items-center p-2 border rounded cursor-pointer hover:bg-blue-50 transition-colors">
                                            <input type="checkbox" name="ppe-type" value="${Utils.escapeHTML(type)}" 
                                                ${currentPPE.includes(type) ? 'checked' : ''}
                                                class="ml-2 rounded border-gray-300 text-blue-600">
                                            <span class="text-sm font-medium">${Utils.escapeHTML(type)}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>حفظ
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = modal.querySelector('#employee-ppe-matrix-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const checkboxes = form.querySelectorAll('input[name="ppe-type"]:checked');
            const selectedPPE = Array.from(checkboxes).map(cb => cb.value);

            try {
                if (!AppState.appData.employeePPEMatrixByCode) {
                    AppState.appData.employeePPEMatrixByCode = {};
                }
                
                AppState.appData.employeePPEMatrixByCode[employeeCode] = selectedPPE;

                // حفظ البيانات
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                Notification.success('تم تحديث مصفوفة مهمات الوقاية للموظف بنجاح');
                modal.remove();
                
                // تحديث عرض المصفوفة
                const contentContainer = document.getElementById('ppe-matrix-content');
                if (contentContainer) {
                    contentContainer.innerHTML = await this.renderPPEMatrix();
                }

                // حفظ في Google Sheets في الخلفية
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    GoogleIntegration.autoSave('EmployeePPEMatrixByCode', AppState.appData.employeePPEMatrixByCode).catch(error => {
                        Utils.safeError('خطأ في حفظ Google Sheets:', error);
                    });
                }
            } catch (error) {
                Notification.error(PPE._t('module.ppe.notify.saveRuntimeError', 'حدث خطأ') + ': ' + error.message);
                Utils.safeError('خطأ في حفظ مصفوفة مهمات الوقاية:', error);
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async viewPositionEmployees(position) {
        const matrix = AppState.appData.employeePPEMatrix || {};
        const matrixData = matrix[position];
        const employees = AppState.appData.employees || [];
        const positionEmployees = employees.filter(e => e.position === position);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        // بناء HTML للجدول
        const requiredPPEHtml = matrixData && matrixData.requiredPPE ?
            matrixData.requiredPPE.map(ppe => `<span class="badge badge-success mr-2">${Utils.escapeHTML(ppe)}</span>`).join('') :
            'لم يتم تحديد';

        let employeesTableHtml = '';
        if (positionEmployees.length > 0) {
            employeesTableHtml = `
                <div class="table-wrapper" style="overflow-x: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>الكود الوظيفي</th>
                                <th>اسم الموظف</th>
                                <th>القسم/الإدارة</th>
                                <th>مهمات الوقاية المستلمة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${positionEmployees.map(emp => {
                const code = emp.employeeNumber || emp.sapId || '';
                // الحصول على مهمات الوقاية المستلمة من جدول PPE
                const employeePPE = (AppState.appData.ppe || []).filter(p =>
                    (p.employeeCode === code || p.employeeNumber === code)
                );
                // الحصول على مهمات الوقاية المطلوبة من المصفوفة (مرتبطة بالكود الوظيفي)
                const matrixByCode = AppState.appData.employeePPEMatrixByCode || {};
                const requiredPPE = matrixByCode[code] || [];

                const receivedPPEHtml = employeePPE.length > 0 ?
                    employeePPE.map(p => `<span class="badge badge-info">${Utils.escapeHTML(p.equipmentType || '')}</span>`).join('') :
                    '<span class="text-gray-500 text-sm">لا توجد</span>';

                const requiredPPEHtml = requiredPPE.length > 0 ?
                    requiredPPE.map(ppe => `<span class="badge badge-success">${Utils.escapeHTML(ppe)}</span>`).join('') :
                    '<span class="text-gray-500 text-sm">لم يتم تحديد</span>';

                return `
                                    <tr>
                                        <td><strong>${Utils.escapeHTML(code || '-')}</strong></td>
                                        <td>${Utils.escapeHTML(emp.name || '-')}</td>
                                        <td>${Utils.escapeHTML(emp.department || '-')}</td>
                                        <td>
                                            <div class="mb-2">
                                                <strong class="text-sm text-gray-600">المطلوبة:</strong>
                                                <div class="flex flex-wrap gap-2 mt-1">
                                                    ${requiredPPEHtml}
                                                </div>
                                            </div>
                                            <div>
                                                <strong class="text-sm text-gray-600">المستلمة:</strong>
                                                <div class="flex flex-wrap gap-2 mt-1">
                                                    ${receivedPPEHtml}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                `;
            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            employeesTableHtml = `
                <div class="empty-state">
                    <i class="fas fa-users text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا يوجد موظفين بهذه الوظيفة</p>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-users ml-2"></i>
                        الموظفين في الوظيفة: ${Utils.escapeHTML(position)}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p class="text-sm text-blue-800">
                                <strong>مهمات الوقاية المطلوبة:</strong>
                                ${requiredPPEHtml}
                            </p>
                        </div>
                    </div>
                    ${employeesTableHtml}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async exportPPEMatrix() {
        try {
            Loading.show();

            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error(this._t('module.ppe.notify.xlsxMissing', 'مكتبة SheetJS غير محمّلة. يرجى تحديث الصفحة'));
                return;
            }

            const matrix = AppState.appData.employeePPEMatrix || {};
            const employees = AppState.appData.employees || [];

            const excelData = Object.keys(matrix).map(position => {
                const matrixData = matrix[position];
                const positionEmployees = employees.filter(e => e.position === position);

                return {
                    'الوظية': position,
                    'عدد الموظين': positionEmployees.length,
                    'مهمات الوقاية المطلوبة': matrixData.requiredPPE ? matrixData.requiredPPE.join(', ') : ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'مصفوفة مهمات الوقاية');

            XLSX.writeFile(wb, 'مصوة_مهمات_الوقاية_' + new Date().toISOString().slice(0, 10) + '.xlsx');

            Loading.hide();
            Notification.success(this._t('module.ppe.notify.matrixExportOk', 'تم تصدير مصفوفة مهمات الوقاية بنجاح'));
        } catch (error) {
            Loading.hide();
            Notification.error(this._t('module.ppe.notify.matrixExportErr', 'حدث خطأ') + ': ' + error.message);
        }
    },

    // ===== PPE Stock Control Functions =====

    async renderStockControlTab() {
        try {
            // ✅ تحميل البيانات مباشرة مع معالجة الأخطاء
        const stockItems = await this.loadStockItems();
            
            if (!Array.isArray(stockItems)) {
                Utils.safeWarn('⚠️ stockItems ليست مصفوفة:', stockItems);
                return `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                        <p class="text-gray-500 mb-4">${Utils.escapeHTML(this._t('module.ppe.empty.loadStockError', 'خطأ في تحميل بيانات المخزون'))}</p>
                        <button onclick="PPE.switchTab('stock-control')" class="btn-primary">
                            <i class="fas fa-redo ml-2"></i>${Utils.escapeHTML(this._t('module.common.retry', 'إعادة المحاولة'))}
                        </button>
                    </div>
                `;
            }
            
        const lowStockItems = stockItems.filter(item => {
                if (!item) return false;
            const balance = parseFloat(item.balance || 0);
            const minThreshold = parseFloat(item.minThreshold || 0);
            return balance < minThreshold;
        });

        return `
            <div class="space-y-6">
                ${await this.renderStockDashboard(stockItems, lowStockItems)}
                ${await this.renderStockTable(stockItems)}
            </div>
        `;
        } catch (error) {
            Utils.safeError('❌ خطأ في renderStockControlTab:', error);
            return `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                    <p class="text-gray-500 mb-4">${Utils.escapeHTML(this._t('module.ppe.empty.stockErrorTab', 'حدث خطأ أثناء تحميل تبويب المخزون'))}: ${Utils.escapeHTML(String(error.message || error))}</p>
                    <button onclick="PPE.switchTab('stock-control')" class="btn-primary">
                        <i class="fas fa-redo ml-2"></i>${Utils.escapeHTML(this._t('module.common.retry', 'إعادة المحاولة'))}
                    </button>
                </div>
            `;
        }
    },

    async renderStockDashboard(stockItems, lowStockItems) {
        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        const totalItems = stockItems.length;
        const totalBalance = stockItems.reduce((sum, item) => sum + parseFloat(item.balance || 0), 0);
        const totalIn = stockItems.reduce((sum, item) => sum + parseFloat(item.stock_IN || 0), 0);
        const totalOut = stockItems.reduce((sum, item) => sum + parseFloat(item.stock_OUT || 0), 0);

        return `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">${ut(t('module.ppe.stock.dashboard.totalItems', 'إجمالي الأصناف'))}</p>
                            <p class="text-2xl font-bold text-gray-800">${totalItems}</p>
                        </div>
                        <div class="text-3xl text-blue-500">
                            <i class="fas fa-boxes"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">${ut(t('module.ppe.stock.dashboard.totalBalance', 'إجمالي الرصيد'))}</p>
                            <p class="text-2xl font-bold text-gray-800">${totalBalance.toFixed(0)}</p>
                        </div>
                        <div class="text-3xl text-green-500">
                            <i class="fas fa-check-circle"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">${ut(t('module.ppe.stock.dashboard.totalIn', 'إجمالي الوارد'))}</p>
                            <p class="text-2xl font-bold text-gray-800">${totalIn.toFixed(0)}</p>
                        </div>
                        <div class="text-3xl text-yellow-500">
                            <i class="fas fa-arrow-down"></i>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-600">${ut(t('module.ppe.stock.dashboard.totalOut', 'إجمالي المنصرف'))}</p>
                            <p class="text-2xl font-bold text-gray-800">${totalOut.toFixed(0)}</p>
                        </div>
                        <div class="text-3xl text-red-500">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                    </div>
                </div>
            </div>
            ${lowStockItems.length > 0 ? `
                <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-red-500 text-2xl ml-3"></i>
                        <div>
                            <h3 class="font-bold text-red-800">${ut(t('module.ppe.stock.lowTitle', 'تحذير: مخزون منخفض'))}</h3>
                            <p class="text-sm text-red-700 mt-1">${lowStockItems.length} ${ut(t('module.ppe.stock.lowDesc', 'صنف/أصناف تحت حد إعادة الطلب'))}</p>
                        </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        ${lowStockItems.slice(0, 5).map(item => `
                            <span class="badge badge-warning">
                                ${Utils.escapeHTML(item.itemName || item.itemCode)} (${parseFloat(item.balance || 0).toFixed(0)})
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    },

    async renderStockTable(stockItems) {
        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        if (!stockItems || stockItems.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-box-open text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">${ut(t('module.ppe.empty.noStock', 'لا توجد أصناف في المخزون'))}</p>
                    <button onclick="PPE.showStockItemForm()" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>${ut(t('module.ppe.btn.addStockItem', 'إضافة صنف جديد'))}
                    </button>
                </div>
            `;
        }

        return `
            <div class="content-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-list ml-2"></i>${ut(t('module.ppe.stock.tableTitle', 'جدول المخزون'))}</h3>
                </div>
                <div class="card-body">
                    <div class="table-wrapper" style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${ut(t('module.ppe.stock.itemCode', 'كود الصنف'))}</th>
                                    <th>${ut(t('module.ppe.stock.itemName', 'اسم الصنف'))}</th>
                                    <th>${ut(t('module.ppe.stock.category', 'الفئة'))}</th>
                                    <th>${ut(t('module.ppe.stock.in', 'الوارد'))}</th>
                                    <th>${ut(t('module.ppe.stock.out', 'المنصرف'))}</th>
                                    <th>${ut(t('module.ppe.stock.balance', 'الرصيد'))}</th>
                                    <th>${ut(t('module.ppe.stock.reorder', 'حد إعادة الطلب'))}</th>
                                    <th>${ut(t('module.ppe.stock.supplier', 'المورد'))}</th>
                                    <th>${ut(t('module.ppe.table.lastUpdate', 'آخر تحديث'))}</th>
                                    <th>${ut(t('module.ppe.table.status', 'الحالة'))}</th>
                                    <th>${ut(t('module.ppe.table.actions', 'الإجراءات'))}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stockItems.map(item => {
                                    const balance = parseFloat(item.balance || 0);
                                    const minThreshold = parseFloat(item.minThreshold || 0);
                                    const isLowStock = balance < minThreshold;
                                    const rowClass = isLowStock ? 'bg-red-50' : '';
                                    
                                    return `
                                        <tr class="${rowClass}" data-item-id="${item.itemId || ''}">
                                            <td class="font-mono font-semibold">${Utils.escapeHTML(item.itemCode || '')}</td>
                                            <td>${Utils.escapeHTML(item.itemName || '')}</td>
                                            <td>${Utils.escapeHTML(item.category || '')}</td>
                                            <td>${parseFloat(item.stock_IN || 0).toFixed(0)}</td>
                                            <td>${parseFloat(item.stock_OUT || 0).toFixed(0)}</td>
                                            <td class="font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}">
                                                ${balance.toFixed(0)}
                                            </td>
                                            <td>${minThreshold.toFixed(0)}</td>
                                            <td>${Utils.escapeHTML(item.supplier || '')}</td>
                                            <td>${item.lastUpdate ? Utils.formatDate(item.lastUpdate) : '-'}</td>
                                            <td>
                                                ${isLowStock ? `
                                                    <span class="badge badge-warning">
                                                        <i class="fas fa-exclamation-triangle ml-1"></i>
                                                        ${ut(t('module.ppe.status.lowStock', 'مخزون منخفض'))}
                                                    </span>
                                                ` : `
                                                    <span class="badge badge-success">${ut(t('module.ppe.status.available', 'متوفر'))}</span>
                                                `}
                                            </td>
                                            <td>
                                                <div class="flex items-center gap-2">
                                                    <button onclick="PPE.showStockItemForm('${item.itemId}')" class="btn-icon btn-icon-primary" title="${ut(t('module.common.edit', 'تعديل'))}">
                                                        <i class="fas fa-edit"></i>
                                                    </button>
                                                    <button onclick="PPE.showStockTransactions('${item.itemId}')" class="btn-icon btn-icon-info" title="${ut(t('module.ppe.btn.transactions', 'الحركات'))}">
                                                        <i class="fas fa-list"></i>
                                                    </button>
                                                    <button onclick="PPE.showTransactionForm('${item.itemId}')" class="btn-icon btn-icon-success" title="${ut(t('module.ppe.btn.addMovement', 'إضافة حركة'))}">
                                                        <i class="fas fa-plus"></i>
                                                    </button>
                                                    <button onclick="PPE.deleteStockItem('${item.itemId}')" class="btn-icon btn-icon-danger" title="${ut(t('module.ppe.btn.deleteItem', 'حذف الصنف'))}">
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
        `;
    },

    async loadStockItems(forceRefresh = false) {
        try {
            // ✅ تحسين الأداء: التحقق من Cache أولاً لتجنب طلبات غير ضرورية
            const now = Date.now();
            const cacheValid = this.state.stockItemsCache && 
                              this.state.stockItemsCacheTime && 
                              (now - this.state.stockItemsCacheTime) < this.state.stockCacheExpiry;
            
            if (!forceRefresh && cacheValid) {
                Utils.safeLog('✅ استخدام بيانات المخزون من Cache');
                // ✅ ضمان حفظ البيانات في AppState أيضاً
                if (this.state.stockItemsCache && !AppState.appData.ppeStock) {
                    AppState.appData.ppeStock = this.state.stockItemsCache;
                }
                return this.state.stockItemsCache;
            }

            // ✅ تحسين: محاولة تحميل البيانات من Backend مع timeout
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                try {
                    // ✅ إضافة timeout للطلب (10 ثوان)
                    const loadPromise = GoogleIntegration.sendToAppsScript('getAllPPEStockItems', { filters: {} });
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout: تحميل البيانات استغرق وقتاً طويلاً')), 10000)
                    );
                    
                    const result = await Promise.race([loadPromise, timeoutPromise]);
                    
                    if (result && result.success) {
                        const stockItems = Array.isArray(result.data) ? result.data : [];
                        
                        // ✅ حفظ البيانات في AppState للاستخدام لاحقاً
                        if (!AppState.appData.ppeStock) {
                            AppState.appData.ppeStock = [];
                        }
                        AppState.appData.ppeStock = stockItems;
                        
                        // ✅ تحديث Cache
                        this.state.stockItemsCache = stockItems;
                        this.state.stockItemsCacheTime = now;
                        
                        // ✅ حفظ البيانات في localStorage للاستخدام لاحقاً
                        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                            window.DataManager.save();
                        }
                        
                        return stockItems;
                    } else {
                        // في حالة فشل الطلب، استخدام البيانات المحلية أو Cache
                        if (this.state.stockItemsCache) {
                            Utils.safeWarn('⚠️ فشل تحميل أصناف المخزون من Backend، استخدام Cache:', result?.message || 'خطأ غير معروف');
                            return this.state.stockItemsCache;
                        }
                        Utils.safeWarn('⚠️ فشل تحميل أصناف المخزون من Backend، استخدام البيانات المحلية:', result?.message || 'خطأ غير معروف');
                        return AppState.appData.ppeStock || [];
                    }
                } catch (backendError) {
                    // في حالة خطأ في الاتصال أو timeout، استخدام البيانات المحلية أو Cache
                    if (this.state.stockItemsCache) {
                        Utils.safeWarn('⚠️ خطأ في الاتصال بـ Backend، استخدام Cache:', backendError);
                        return this.state.stockItemsCache;
                    }
                    Utils.safeWarn('⚠️ خطأ في الاتصال بـ Backend، استخدام البيانات المحلية:', backendError);
                    return AppState.appData.ppeStock || [];
                }
            }
            // إذا لم يكن GoogleIntegration متاحاً، استخدام البيانات المحلية أو Cache
            if (this.state.stockItemsCache) {
                // ✅ ضمان حفظ البيانات في AppState
                if (!AppState.appData.ppeStock) {
                    AppState.appData.ppeStock = this.state.stockItemsCache;
                }
                return this.state.stockItemsCache;
            }
            return AppState.appData.ppeStock || [];
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل أصناف المخزون:', error);
            // في حالة أي خطأ، إرجاع Cache أو بيانات محلية
            return this.state.stockItemsCache || AppState.appData.ppeStock || [];
        }
    },

    async showStockItemForm(itemId = null) {
        const isEdit = !!itemId;
        let stockItem = null;
        
        if (isEdit) {
            const stockItems = await this.loadStockItems();
            stockItem = stockItems.find(item => item.itemId === itemId);
        }

        const t = (k, f) => this._t(k, f);
        const ut = (s) => Utils.escapeHTML(s);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">${isEdit ? ut(t('module.ppe.title.stockItemEdit', 'تعديل صنف')) : ut(t('module.ppe.title.stockItemAdd', 'إضافة صنف جديد'))}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="stock-item-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.stock.itemCode', 'كود الصنف'))} *</label>
                                <input type="text" id="stock-item-code" required class="form-input"
                                    value="${Utils.escapeHTML(stockItem?.itemCode || '')}"
                                    placeholder="${ut(t('module.ppe.placeholder.itemCode', ''))}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.stock.itemName', 'اسم الصنف'))} *</label>
                                <input type="text" id="stock-item-name" required class="form-input"
                                    value="${Utils.escapeHTML(stockItem?.itemName || '')}"
                                    placeholder="${ut(t('module.ppe.placeholder.itemName', ''))}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.category', 'الفئة'))}</label>
                                <input type="text" id="stock-item-category" class="form-input"
                                    value="${Utils.escapeHTML(stockItem?.category || '')}"
                                    placeholder="${ut(t('module.ppe.stock.category', 'الفئة'))}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.minThreshold', 'حد إعادة الطلب *'))}</label>
                                <input type="number" id="stock-item-min-threshold" required class="form-input" min="0"
                                    value="${stockItem?.minThreshold || 0}"
                                    placeholder="${ut(t('module.ppe.stock.reorder', ''))}">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${ut(t('module.ppe.label.supplier', 'المورد'))}</label>
                                <input type="text" id="stock-item-supplier" class="form-input"
                                    value="${Utils.escapeHTML(stockItem?.supplier || '')}"
                                    placeholder="${ut(t('module.ppe.label.supplier', ''))}">
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${ut(t('module.common.cancel', 'إلغاء'))}</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? ut(t('module.common.saveChanges', 'حفظ التعديلات')) : ut(t('module.ppe.btn.addItem', 'إضافة الصنف'))}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.applyModuleI18n(modal);

        const form = modal.querySelector('#stock-item-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Loading.show();

            try {
                // فحص العناصر قبل الاستخدام
                const itemCodeEl = document.getElementById('stock-item-code');
                const itemNameEl = document.getElementById('stock-item-name');
                const categoryEl = document.getElementById('stock-item-category');
                const minThresholdEl = document.getElementById('stock-item-min-threshold');
                const supplierEl = document.getElementById('stock-item-supplier');
                
                if (!itemCodeEl || !itemNameEl || !categoryEl || !minThresholdEl || !supplierEl) {
                    Loading.hide();
                    Notification.error(PPE._t('module.ppe.notify.fieldsMissing', 'بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.'));
                    return;
                }

                const itemCode = itemCodeEl.value.trim();
                const itemName = itemNameEl.value.trim();
                
                // ✅ التحقق من تكرار كود الصنف في Frontend (عند الإضافة والتحديث)
                if (itemCode) {
                    const stockItems = await this.loadStockItems();
                    const existingItem = stockItems.find(item => 
                        (isEdit ? item.itemId !== stockItem.itemId : true) && // استثناء الصنف الحالي عند التحديث
                        item.itemCode && 
                        String(item.itemCode).trim().toLowerCase() === itemCode.toLowerCase()
                    );
                    if (existingItem) {
                        Loading.hide();
                        Notification.error(PPE._t('module.ppe.notify.duplicateCode', 'كود الصنف موجود بالفعل. يرجى استخدام كود آخر.'));
                        itemCodeEl.focus();
                        itemCodeEl.style.borderColor = '#ef4444';
                        return;
                    }
                }
                
                // ✅ التحقق من تكرار اسم الصنف في Frontend (عند الإضافة والتحديث)
                if (itemName) {
                    const stockItems = await this.loadStockItems();
                    const existingItemByName = stockItems.find(item => 
                        (isEdit ? item.itemId !== stockItem.itemId : true) && // استثناء الصنف الحالي عند التحديث
                        item.itemName && 
                        String(item.itemName).trim().toLowerCase() === itemName.toLowerCase()
                    );
                    if (existingItemByName) {
                        Loading.hide();
                        Notification.error(PPE._t('module.ppe.notify.duplicateName', 'اسم الصنف موجود بالفعل. يرجى استخدام اسم آخر.'));
                        itemNameEl.focus();
                        itemNameEl.style.borderColor = '#ef4444';
                        return;
                    }
                }

                const stockData = {
                    itemId: stockItem?.itemId || Utils.generateId('STOCK'),
                    itemCode: itemCode,
                    itemName: itemNameEl.value.trim(),
                    category: categoryEl.value.trim(),
                    minThreshold: parseFloat(minThresholdEl.value) || 0,
                    supplier: supplierEl.value.trim(),
                    stock_IN: stockItem?.stock_IN || 0,
                    stock_OUT: stockItem?.stock_OUT || 0,
                    balance: stockItem?.balance || 0,
                    lastUpdate: new Date().toISOString(),
                    createdAt: stockItem?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                    const result = await GoogleIntegration.sendToAppsScript('addOrUpdatePPEStockItem', stockData);
                    if (result && result.success) {
                        // ✅ مسح Cache لتحديث البيانات في المرة القادمة
                        this.clearCache();
                        
                        // ✅ إغلاق النموذج فوراً
                        modal.remove();
                        Loading.hide();
                        
                        Notification.success(`تم ${isEdit ? 'تحديث' : 'إضافة'} الصنف بنجاح`);
                        
                        // ✅ تحديث التبويب النشط فقط (أسرع من إعادة تحميل كامل)
                        this.refreshActiveTab();
                        return; // منع Loading.hide() في finally
                    } else {
                        // ✅ عرض رسالة الخطأ من Backend (مثل "كود الصنف موجود")
                        const errorMessage = result?.message || 'حدث خطأ أثناء حفظ الصنف';
                        Notification.error(errorMessage);
                        
                        // إذا كان الخطأ متعلقاً بكود الصنف أو اسم الصنف، إبراز الحقل المناسب
                        if (errorMessage.includes('كود الصنف موجود')) {
                            itemCodeEl.style.borderColor = '#ef4444';
                            itemCodeEl.focus();
                        } else if (errorMessage.includes('اسم الصنف موجود')) {
                            itemNameEl.style.borderColor = '#ef4444';
                            itemNameEl.focus();
                        }
                    }
                } else {
                    // Fallback to local storage
                    if (!AppState.appData.ppeStock) {
                        AppState.appData.ppeStock = [];
                    }
                    if (isEdit) {
                        const index = AppState.appData.ppeStock.findIndex(item => item.itemId === stockItem.itemId);
                        if (index !== -1) {
                            // ✅ التحقق من عدم تكرار كود الصنف عند التحديث (في local storage)
                            if (itemCode) {
                                const duplicateCode = AppState.appData.ppeStock.find((item, idx) => 
                                    idx !== index && 
                                    item.itemCode && 
                                    String(item.itemCode).trim().toLowerCase() === itemCode.toLowerCase()
                                );
                                if (duplicateCode) {
                                    Loading.hide();
                                    Notification.error(PPE._t('module.ppe.notify.duplicateCode', 'كود الصنف موجود بالفعل. يرجى استخدام كود آخر.'));
                                    itemCodeEl.focus();
                                    itemCodeEl.style.borderColor = '#ef4444';
                                    return;
                                }
                            }
                            // ✅ التحقق من عدم تكرار اسم الصنف عند التحديث (في local storage)
                            if (itemName) {
                                const duplicateName = AppState.appData.ppeStock.find((item, idx) => 
                                    idx !== index && 
                                    item.itemName && 
                                    String(item.itemName).trim().toLowerCase() === itemName.toLowerCase()
                                );
                                if (duplicateName) {
                                    Loading.hide();
                                    Notification.error(PPE._t('module.ppe.notify.duplicateName', 'اسم الصنف موجود بالفعل. يرجى استخدام اسم آخر.'));
                                    itemNameEl.focus();
                                    itemNameEl.style.borderColor = '#ef4444';
                                    return;
                                }
                            }
                            AppState.appData.ppeStock[index] = stockData;
                        }
                    } else {
                        // ✅ التحقق من عدم تكرار كود الصنف عند الإضافة (في local storage)
                        if (itemCode) {
                            const duplicateCode = AppState.appData.ppeStock.find(item => 
                                item.itemCode && 
                                String(item.itemCode).trim().toLowerCase() === itemCode.toLowerCase()
                            );
                            if (duplicateCode) {
                                Loading.hide();
                                Notification.error(PPE._t('module.ppe.notify.duplicateCode', 'كود الصنف موجود بالفعل. يرجى استخدام كود آخر.'));
                                itemCodeEl.focus();
                                itemCodeEl.style.borderColor = '#ef4444';
                                return;
                            }
                        }
                        // ✅ التحقق من عدم تكرار اسم الصنف عند الإضافة (في local storage)
                        if (itemName) {
                            const duplicateName = AppState.appData.ppeStock.find(item => 
                                item.itemName && 
                                String(item.itemName).trim().toLowerCase() === itemName.toLowerCase()
                            );
                            if (duplicateName) {
                                Loading.hide();
                                Notification.error(PPE._t('module.ppe.notify.duplicateName', 'اسم الصنف موجود بالفعل. يرجى استخدام اسم آخر.'));
                                itemNameEl.focus();
                                itemNameEl.style.borderColor = '#ef4444';
                                return;
                            }
                        }
                        AppState.appData.ppeStock.push(stockData);
                    }
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    }
                    
                    // ✅ مسح Cache
                    this.clearCache();
                    
                    // ✅ إغلاق النموذج فوراً
                    modal.remove();
                    Loading.hide();
                    
                    Notification.success(`تم ${isEdit ? 'تحديث' : 'إضافة'} الصنف بنجاح`);
                    
                    // ✅ تحديث التبويب النشط فقط
                    this.refreshActiveTab();
                    return; // منع Loading.hide() في finally
                }
            } catch (error) {
                Notification.error(PPE._t('module.ppe.notify.saveRuntimeError', 'حدث خطأ') + ': ' + error.message);
            } finally {
                Loading.hide();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async showTransactionForm(itemId = null) {
        const stockItems = await this.loadStockItems();
        const selectedItem = itemId ? stockItems.find(item => item.itemId === itemId) : null;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">إضافة حركة (وارد/منصرف)</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="transaction-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الصنف *</label>
                            <select id="transaction-item-id" required class="form-input">
                                <option value="">اختر الصنف</option>
                                ${stockItems.map(item => `
                                    <option value="${item.itemId}" ${selectedItem && selectedItem.itemId === item.itemId ? 'selected' : ''}>
                                        ${Utils.escapeHTML(item.itemCode || '')} - ${Utils.escapeHTML(item.itemName || '')}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع الحركة *</label>
                                <select id="transaction-action" required class="form-input">
                                    <option value="">اختر النوع</option>
                                    <option value="IN">وارد</option>
                                    <option value="OUT">منصرف</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الكمية *</label>
                                <input type="number" id="transaction-quantity" required class="form-input" min="1"
                                    placeholder="الكمية">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ *</label>
                                <input type="date" id="transaction-date" required class="form-input"
                                    value="${new Date().toISOString().slice(0, 10)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">صرف إلى</label>
                                <input type="text" id="transaction-issued-to" class="form-input"
                                    placeholder="اسم المستلم (للمنصرف)">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                            <textarea id="transaction-remarks" class="form-input" rows="3"
                                placeholder="ملاحظات إضافية"></textarea>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>حفظ الحركة
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const form = modal.querySelector('#transaction-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Loading.show();

            try {
                // فحص العناصر قبل الاستخدام
                const itemIdEl = document.getElementById('transaction-item-id');
                const actionEl = document.getElementById('transaction-action');
                const quantityEl = document.getElementById('transaction-quantity');
                const dateEl = document.getElementById('transaction-date');
                const issuedToEl = document.getElementById('transaction-issued-to');
                const remarksEl = document.getElementById('transaction-remarks');
                
                if (!itemIdEl || !actionEl || !quantityEl || !dateEl || !issuedToEl || !remarksEl) {
                    Loading.hide();
                    Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
                    return;
                }

                const transactionData = {
                    itemId: itemIdEl.value,
                    action: actionEl.value,
                    quantity: parseFloat(quantityEl.value) || 0,
                    date: new Date(dateEl.value).toISOString(),
                    issuedTo: issuedToEl.value.trim(),
                    remarks: remarksEl.value.trim(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                    const result = await GoogleIntegration.sendToAppsScript('addPPETransaction', transactionData);
                    if (result && result.success) {
                        // ✅ مسح Cache لتحديث البيانات في المرة القادمة (لأن الحركات تؤثر على الرصيد)
                        this.clearCache();
                        
                        // ✅ إغلاق النموذج فوراً
                        modal.remove();
                        Loading.hide();
                        
                        Notification.success('تم إضافة الحركة بنجاح');
                        
                        // ✅ تحديث التبويب النشط فقط (أسرع من إعادة تحميل كامل)
                        this.refreshActiveTab();
                        return; // منع Loading.hide() في finally
                    } else {
                        Notification.error(result?.message || 'حدث خطأ أثناء إضافة الحركة');
                    }
                } else {
                    // Fallback to local storage
                    transactionData.id = Utils.generateId('TRANS');
                    if (!AppState.appData.ppeTransactions) {
                        AppState.appData.ppeTransactions = [];
                    }
                    AppState.appData.ppeTransactions.push(transactionData);
                    
                    // Update stock balance locally
                    if (!AppState.appData.ppeStock) {
                        AppState.appData.ppeStock = [];
                    }
                    const stockItem = AppState.appData.ppeStock.find(item => item.itemId === transactionData.itemId);
                    if (stockItem) {
                        if (transactionData.action === 'IN') {
                            stockItem.stock_IN = (parseFloat(stockItem.stock_IN || 0) + transactionData.quantity);
                        } else {
                            stockItem.stock_OUT = (parseFloat(stockItem.stock_OUT || 0) + transactionData.quantity);
                        }
                        stockItem.balance = parseFloat(stockItem.stock_IN || 0) - parseFloat(stockItem.stock_OUT || 0);
                        stockItem.lastUpdate = new Date().toISOString();
                    }
                    
                    // ✅ مسح Cache
                    this.clearCache();
                    
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    }
                    
                    // ✅ إغلاق النموذج فوراً
                    modal.remove();
                    Loading.hide();
                    
                    Notification.success('تم إضافة الحركة بنجاح');
                    
                    // ✅ تحديث التبويب النشط فقط
                    this.refreshActiveTab();
                    return; // منع Loading.hide() في finally
                }
            } catch (error) {
                Notification.error(PPE._t('module.ppe.notify.saveRuntimeError', 'حدث خطأ') + ': ' + error.message);
            } finally {
                Loading.hide();
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async showStockTransactions(itemId) {
        if (!itemId) {
            Notification.error('معرف الصنف غير موجود');
            return;
        }

        Loading.show();

        try {
            // الحصول على بيانات الصنف
            let stockItems = [];
            try {
                stockItems = await this.loadStockItems();
                if (!Array.isArray(stockItems)) {
                    stockItems = [];
                }
            } catch (loadError) {
                Utils.safeWarn('⚠️ خطأ في تحميل أصناف المخزون:', loadError);
                stockItems = AppState.appData.ppeStock || [];
            }
            
            const stockItem = stockItems.find(item => item && item.itemId === itemId);
            
            if (!stockItem) {
                Loading.hide();
                Notification.error('الصنف غير موجود أو لم يتم تحميله');
                return;
            }

            // الحصول على الحركات من Backend
            let transactions = [];
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                try {
                    const result = await GoogleIntegration.sendToAppsScript('getAllPPETransactions', { filters: { itemId: itemId } });
                    if (result && result.success) {
                        transactions = Array.isArray(result.data) ? result.data : [];
                    } else {
                        // في حالة فشل الطلب، استخدام البيانات المحلية
                        Utils.safeWarn('⚠️ فشل جلب الحركات من Backend، استخدام البيانات المحلية:', result?.message || 'خطأ غير معروف');
                        transactions = (AppState.appData.ppeTransactions || []).filter(t => t && t.itemId === itemId);
                    }
                } catch (backendError) {
                    // في حالة خطأ في الاتصال، استخدام البيانات المحلية
                    Utils.safeWarn('⚠️ خطأ في الاتصال بـ Backend، استخدام البيانات المحلية:', backendError);
                    transactions = (AppState.appData.ppeTransactions || []).filter(t => t && t.itemId === itemId);
                }
            } else {
                // Fallback to local storage
                transactions = (AppState.appData.ppeTransactions || []).filter(t => t && t.itemId === itemId);
            }
            
            // التأكد من أن transactions هي مصفوفة
            if (!Array.isArray(transactions)) {
                transactions = [];
            }

            Loading.hide();

            // إنشاء النافذة المنبثقة
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            
            // ترتيب الحركات حسب التاريخ (الأحدث أولاً)
            transactions.sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt || 0);
                const dateB = new Date(b.date || b.createdAt || 0);
                return dateB - dateA;
            });

            // حساب الإجماليات
            const totalIn = transactions
                .filter(t => t.action === 'IN')
                .reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);
            const totalOut = transactions
                .filter(t => t.action === 'OUT')
                .reduce((sum, t) => sum + parseFloat(t.quantity || 0), 0);
            const currentBalance = totalIn - totalOut;

            // بناء جدول الحركات
            let transactionsTableHtml = '';
            if (transactions.length === 0) {
                transactionsTableHtml = `
                    <div class="empty-state py-8">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                        <p class="text-gray-500">لا توجد حركات مسجلة لهذا الصنف</p>
                    </div>
                `;
            } else {
                transactionsTableHtml = `
                    <div class="table-wrapper" style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>التاريخ</th>
                                    <th>نوع الحركة</th>
                                    <th>الكمية</th>
                                    <th>صادر إلى</th>
                                    <th>ملاحظات</th>
                                    <th>تاريخ الإنشاء</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map(transaction => {
                                    const actionType = transaction.action === 'IN' ? 'وارد' : 'منصرف';
                                    const actionClass = transaction.action === 'IN' ? 'badge-success' : 'badge-warning';
                                    const actionIcon = transaction.action === 'IN' ? 'fa-arrow-down' : 'fa-arrow-up';
                                    
                                    return `
                                        <tr>
                                            <td>${transaction.date ? Utils.formatDate(transaction.date) : '-'}</td>
                                            <td>
                                                <span class="badge ${actionClass}">
                                                    <i class="fas ${actionIcon} ml-1"></i>
                                                    ${actionType}
                                                </span>
                                            </td>
                                            <td class="font-semibold">${parseFloat(transaction.quantity || 0).toFixed(0)}</td>
                                            <td>${Utils.escapeHTML(transaction.issuedTo || '-')}</td>
                                            <td>${Utils.escapeHTML(transaction.remarks || '-')}</td>
                                            <td class="text-sm text-gray-500">${transaction.createdAt ? Utils.formatDate(transaction.createdAt) : '-'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            modal.innerHTML = `
                <div class="modal-content" style="max-width: 1000px;">
                    <div class="modal-header">
                        <h2 class="modal-title">
                            <i class="fas fa-list-alt ml-2"></i>
                            سجل الحركات - ${Utils.escapeHTML(stockItem.itemName || stockItem.itemCode || 'صنف')}
                        </h2>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <!-- معلومات الصنف -->
                        <div class="bg-gray-50 rounded-lg p-4 mb-6">
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p class="text-xs text-gray-500 mb-1">كود الصنف</p>
                                    <p class="font-semibold text-gray-800">${Utils.escapeHTML(stockItem.itemCode || '-')}</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 mb-1">اسم الصنف</p>
                                    <p class="font-semibold text-gray-800">${Utils.escapeHTML(stockItem.itemName || '-')}</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 mb-1">الرصيد الحالي</p>
                                    <p class="font-semibold text-green-600">${parseFloat(stockItem.balance || 0).toFixed(0)}</p>
                                </div>
                                <div>
                                    <p class="text-xs text-gray-500 mb-1">عدد الحركات</p>
                                    <p class="font-semibold text-gray-800">${transactions.length}</p>
                                </div>
                            </div>
                        </div>

                        <!-- ملخص الحركات -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm text-green-700 mb-1">إجمالي الوارد</p>
                                        <p class="text-2xl font-bold text-green-600">${totalIn.toFixed(0)}</p>
                                    </div>
                                    <i class="fas fa-arrow-down text-green-500 text-2xl"></i>
                                </div>
                            </div>
                            <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm text-orange-700 mb-1">إجمالي المنصرف</p>
                                        <p class="text-2xl font-bold text-orange-600">${totalOut.toFixed(0)}</p>
                                    </div>
                                    <i class="fas fa-arrow-up text-orange-500 text-2xl"></i>
                                </div>
                            </div>
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="text-sm text-blue-700 mb-1">الرصيد المحسوب</p>
                                        <p class="text-2xl font-bold text-blue-600">${currentBalance.toFixed(0)}</p>
                                    </div>
                                    <i class="fas fa-calculator text-blue-500 text-2xl"></i>
                                </div>
                            </div>
                        </div>

                        <!-- جدول الحركات -->
                        <div class="mb-4">
                            <h3 class="text-lg font-semibold text-gray-800 mb-3">
                                <i class="fas fa-table ml-2"></i>
                                تفاصيل الحركات
                            </h3>
                            ${transactionsTableHtml}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times ml-2"></i>
                            إغلاق
                        </button>
                        <button class="btn-primary" onclick="PPE.showTransactionForm('${itemId}'); this.closest('.modal-overlay').remove();">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة حركة جديدة
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // إغلاق النافذة عند النقر خارجها
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

        } catch (error) {
            Loading.hide();
            Utils.safeError('❌ خطأ في عرض سجل الحركات:', error);
            Notification.error('حدث خطأ أثناء عرض سجل الحركات: ' + (error.message || error));
        }
    },

    async deleteStockItem(itemId) {
        if (!itemId) {
            Notification.error('معرف الصنف غير موجود');
            return;
        }

        // الحصول على بيانات الصنف لعرض اسمه في رسالة التأكيد
        const stockItems = await this.loadStockItems();
        const stockItem = stockItems.find(item => item && item.itemId === itemId);
        
        if (!stockItem) {
            Notification.error('الصنف غير موجود');
            return;
        }

        // رسالة تأكيد الحذف
        const confirmMessage = `هل أنت متأكد من حذف الصنف "${stockItem.itemName || stockItem.itemCode}"؟\n\n` +
                              `⚠️ تحذير: لا يمكن حذف الصنف إذا كان يحتوي على حركات مسجلة.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        Loading.show();

        try {
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript) {
                const result = await GoogleIntegration.sendToAppsScript('deletePPEStockItem', { itemId: itemId });
                
                if (result && result.success) {
                    // ✅ مسح Cache لتحديث البيانات
                    this.state.stockItemsCache = null;
                    this.state.stockItemsCacheTime = null;
                    
                    Notification.success('تم حذف الصنف بنجاح');
                    await this.load(); // إعادة تحميل البيانات
                } else {
                    Notification.error(result?.message || 'حدث خطأ أثناء حذف الصنف');
                }
            } else {
                // Fallback to local storage
                if (AppState.appData.ppeStock) {
                    AppState.appData.ppeStock = AppState.appData.ppeStock.filter(item => item.itemId !== itemId);
                    // ✅ مسح Cache
                    this.state.stockItemsCache = null;
                    this.state.stockItemsCacheTime = null;
                    
                    Notification.success('تم حذف الصنف بنجاح');
                    await this.load();
                } else {
                    Notification.error('لا توجد بيانات محلية للحذف');
                }
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في حذف الصنف:', error);
            Notification.error('حدث خطأ أثناء حذف الصنف: ' + (error.message || error));
        } finally {
            Loading.hide();
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof PPE !== 'undefined') {
            window.PPE = PPE;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ PPE module loaded and available on window.PPE');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير PPE:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof PPE !== 'undefined') {
            try {
                window.PPE = PPE;
            } catch (e) {
                console.error('❌ فشل تصدير PPE:', e);
            }
        }
    }
})();