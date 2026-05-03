/**
 * NearMiss Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== NearMiss Module =====
const NearMiss = {
    TYPES: [
        { value: 'حادث وشيك', label: 'حادث وشيك' },
        { value: 'تصرف غير آمن', label: 'تصرف غير آمن' },
        { value: 'وضع غير آمن', label: 'وضع غير آمن' },
        { value: 'حادث', label: 'حادث' },
        { value: 'مقترح', label: 'مقترح' }
    ],
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

    state: {
        filters: {
            search: '',
            type: '',
            department: '',
            startDate: '',
            endDate: ''
        },
        currentAttachments: [],
        editingId: null
    },

    /**
     * معالجة روابط المرفقات (تحويل روابط Google Drive القديمة و Base64)
     */
    processAttachmentUrl(url) {
        if (!url || typeof url !== 'string') return null;

        let trimmed = url.trim();

        // تحويل روابط Google Drive القديمة
        const oldDrivePattern = /https?:\/\/drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/;
        const oldDriveMatch = trimmed.match(oldDrivePattern);
        if (oldDriveMatch) {
            const fileId = oldDriveMatch[1];
            trimmed = 'https://lh3.googleusercontent.com/d/' + fileId;
        }

        // إذا كانت URL عادية أو Base64 مع prefix
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
            return trimmed;
        }

        // ✅ معالجة Base64 بدون prefix (سلسلة طويلة من الأحرف)
        if (trimmed.length > 100 && /^[A-Za-z0-9+/=]+$/.test(trimmed.substring(0, 100))) {
            return 'data:image/jpeg;base64,' + trimmed;
        }

        return null;
    },

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        try {
            const section = document.getElementById('nearmiss-section');
            if (!section) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError(' قسم nearmiss-section غير موجود!');
                } else {
                    console.error(' قسم nearmiss-section غير موجود!');
                }
                return;
            }

            // التحقق من وجود Utils و AppState
            if (typeof Utils === 'undefined') {
                console.error('Utils غير متوفر!');
                return;
            }

            if (typeof AppState === 'undefined') {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('AppState غير متوفر!');
                } else {
                    console.error('AppState غير متوفر!');
                }
                return;
            }

            this.ensureDataIntegrity();

            // دالة مساعدة للهروب من HTML
            const escapeHTML = (str) => {
                if (typeof Utils !== 'undefined' && Utils.escapeHTML) {
                    return Utils.escapeHTML(str);
                }
                return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
            };

            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-eye ml-3"></i>
                                إدارة الحوادث الوشيكة
                            </h1>
                            <p class="section-subtitle">توثيق الملاحظات الطارئة وتعزيز معايير السلامة</p>
                        </div>
                        <div class="flex gap-2">
                            <button id="add-nearmiss-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                تسجيل ملاحظة جديدة
                            </button>
                        </div>
                    </div>
                </div>
                <div class="mt-6 space-y-6">
                    <div id="nearmiss-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4"></div>
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title">
                                <i class="fas fa-filter ml-2"></i>
                                عوامل التصفية المتقدمة
                            </h2>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 mb-2">بحث حر</label>
                                    <input type="text" id="nearmiss-filter-search" class="form-input" placeholder="النوع، الموقع، الوصف أو صاحب الملاحظة" value="${escapeHTML(this.state.filters.search)}">
                                </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-2">نوع الحادث</label>
                                <select id="nearmiss-filter-type" class="form-input">
                                    ${this.renderTypeOptions(this.state.filters.type)}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-2">الإدارة</label>
                                <select id="nearmiss-filter-department" class="form-input">
                                    ${this.renderDepartmentOptions(this.state.filters.department)}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-2">بداية الفترة</label>
                                <input type="date" id="nearmiss-filter-start" class="form-input" value="${this.state.filters.startDate}">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-2">نهاية الفترة</label>
                                <input type="date" id="nearmiss-filter-end" class="form-input" value="${this.state.filters.endDate}">
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-3 mt-4">
                            <button id="nearmiss-reset-filters" class="btn-link text-blue-600">
                                <i class="fas fa-undo ml-1"></i>
                                إعادة التعيين
                            </button>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between flex-wrap gap-3">
                            <h2 class="card-title">
                                <i class="fas fa-clipboard-list ml-2"></i>
                                سجل الملاحظات
                            </h2>
                            <span id="nearmiss-result-count" class="text-sm text-gray-500"></span>
                        </div>
                    </div>
                    <div class="card-body" id="nearmiss-table-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">جاري التحميل...</p>
                        </div>
                    </div>
                </div>
                </div>
            `;
            this.applyModuleI18n(section);
            this.ensureI18nObservers(section);

            this.bindBaseEvents();
            this.updateSummary();
            this.renderTable();
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول الحوادث الوشيكة:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول الحوادث الوشيكة:', error);
            }
            const section = document.getElementById('nearmiss-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button onclick="NearMiss.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                this.applyModuleI18n(section);
            }
        }
    },

    ensureDataIntegrity() {
        if (!Array.isArray(AppState.appData.nearmiss)) {
            AppState.appData.nearmiss = [];
        }
        AppState.appData.nearmiss = AppState.appData.nearmiss.map((item) => this.normalizeRecord(item));
    },

    normalizeRecord(record = {}) {
        const defaultType = this.TYPES[0].value;
        const id = record.id || Utils.generateId('NEARMISS');
        let isoDate;
        try {
            isoDate = record.date ? new Date(record.date).toISOString() : new Date().toISOString();
        } catch (error) {
            isoDate = new Date().toISOString();
        }
        const attachments = Array.isArray(record.attachments)
            ? record.attachments.map((attachment) => this.normalizeAttachment(attachment)).filter(Boolean)
            : [];
        const createdBy = record.createdBy ? record.createdBy : this.getCurrentUserSummary(record.createdBy);
        const correctiveProposed = record.correctiveProposed === true
            || record.correctiveAction === true
            || record.correctiveProposal === true
            || record.corrective === true
            || record.suggestedAction === true;

        return {
            id,
            type: this.TYPES.some((item) => item.value === record.type) ? record.type : (record.type || defaultType),
            date: isoDate,
            observerName: record.observerName || record.reportedBy || '',
            phone: record.phone || record.contactPhone || '',
            location: record.location || record.place || '',
            department: record.department || record.departmentName || '',
            description: record.description || record.details || record.title || '',
            correctiveProposed,
            correctiveDescription: correctiveProposed
                ? (record.correctiveDescription || record.correctiveDetails || record.suggestedActionDescription || '')
                : '',
            attachments,
            createdBy,
            createdById: record.createdById || createdBy?.id || '',
            createdAt: record.createdAt || isoDate,
            updatedAt: record.updatedAt || isoDate,
            updatedBy: record.updatedBy || null,
            status: record.status || (correctiveProposed ? 'مفتوح' : 'مغلق'),
            reportedBy: record.reportedBy || record.observerName || ''
        };
    },

    normalizeAttachment(attachment) {
        if (!attachment) return null;
        const data = attachment.data || attachment.base64 || '';
        if (!data) return null;
        const size = attachment.size || Math.round((data.length * 3) / 4 / 1024);
        return {
            id: attachment.id || Utils.generateId('ATT'),
            name: attachment.name || 'attachment',
            type: attachment.type || this.detectMimeType(attachment.name || ''),
            data,
            size,
            uploadedAt: attachment.uploadedAt || new Date().toISOString()
        };
    },


    detectMimeType(fileName = '') {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (ext === 'pdf') return 'application/pdf';
        if (ext === 'png') return 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
        return 'application/octet-stream';
    },

    getCurrentUserSummary(fallback = null) {
        if (fallback && typeof fallback === 'object') {
            return fallback;
        }
        if (!AppState.currentUser) {
            return {
                name: 'نظام',
                email: '',
                role: ''
            };
        }
        return {
            id: AppState.currentUser.id || '',
            name: AppState.currentUser.name || '',
            email: AppState.currentUser.email || '',
            role: AppState.currentUser.role || ''
        };
    },

    getDepartmentOptions() {
        const departments = new Set();
        (AppState.appData.nearmiss || []).forEach((item) => {
            const value = (item.department || '').trim();
            if (value) {
                departments.add(value);
            }
        });
        (AppState.appData.employees || []).forEach((employee) => {
            const value = (employee.department || '').trim();
            if (value) {
                departments.add(value);
            }
        });
        return Array.from(departments).sort((a, b) => a.localeCompare(b, 'ar'));
    },

    renderTypeOptions(selectedValue = '') {
        const options = ['<option value="">جميع الأنواع</option>'];
        this.TYPES.forEach((type) => {
            options.push(`<option value="${Utils.escapeHTML(type.value)}" ${type.value === selectedValue ? 'selected' : ''}>${Utils.escapeHTML(type.label)}</option>`);
        });
        return options.join('');
    },

    renderDepartmentOptions(selectedValue = '') {
        const options = ['<option value="">جميع الإدارات</option>'];
        this.getDepartmentOptions().forEach((department) => {
            options.push(`<option value="${Utils.escapeHTML(department)}" ${department === selectedValue ? 'selected' : ''}>${Utils.escapeHTML(department)}</option>`);
        });
        return options.join('');
    },

    bindBaseEvents() {
        const addBtn = document.getElementById('add-nearmiss-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showForm());
        }

        const searchInput = document.getElementById('nearmiss-filter-search');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => this.handleFilterChange('search', event.target.value));
        }

        const typeSelect = document.getElementById('nearmiss-filter-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (event) => this.handleFilterChange('type', event.target.value));
        }

        const departmentSelect = document.getElementById('nearmiss-filter-department');
        if (departmentSelect) {
            departmentSelect.addEventListener('change', (event) => this.handleFilterChange('department', event.target.value));
        }

        const startInput = document.getElementById('nearmiss-filter-start');
        if (startInput) {
            startInput.addEventListener('change', (event) => this.handleFilterChange('startDate', event.target.value));
        }

        const endInput = document.getElementById('nearmiss-filter-end');
        if (endInput) {
            endInput.addEventListener('change', (event) => this.handleFilterChange('endDate', event.target.value));
        }

        const resetBtn = document.getElementById('nearmiss-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.resetFilters();
            });
        }
    },

    handleFilterChange(key, value) {
        if (!Object.prototype.hasOwnProperty.call(this.state.filters, key)) {
            return;
        }
        const sanitizedValue = typeof value === 'string' ? value.trim() : value;
        this.state.filters = {
            ...this.state.filters,
            [key]: sanitizedValue
        };
        this.renderTable();
    },

    resetFilters() {
        this.state.filters = {
            search: '',
            type: '',
            department: '',
            startDate: '',
            endDate: ''
        };

        const searchInput = document.getElementById('nearmiss-filter-search');
        if (searchInput) searchInput.value = '';

        const typeSelect = document.getElementById('nearmiss-filter-type');
        if (typeSelect) typeSelect.value = '';

        const departmentSelect = document.getElementById('nearmiss-filter-department');
        if (departmentSelect) departmentSelect.value = '';

        const startInput = document.getElementById('nearmiss-filter-start');
        if (startInput) startInput.value = '';

        const endInput = document.getElementById('nearmiss-filter-end');
        if (endInput) endInput.value = '';

        this.renderTable();
    },

    getFilteredItems() {
        this.ensureDataIntegrity();

        const { search, type, department, startDate, endDate } = this.state.filters;
        let items = (AppState.appData.nearmiss || []).filter((item) => !!item);

        if (type) {
            items = items.filter((item) => (item.type || '').toLowerCase() === type.toLowerCase());
        }

        if (department) {
            items = items.filter((item) => (item.department || '').toLowerCase() === department.toLowerCase());
        }

        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            items = items.filter((item) => {
                const eventDate = new Date(item.date);
                return eventDate >= start;
            });
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            items = items.filter((item) => {
                const eventDate = new Date(item.date);
                return eventDate <= end;
            });
        }

        if (search) {
            const term = search.toLowerCase();
            items = items.filter((item) => [
                item.type,
                item.location,
                item.department,
                item.observerName,
                item.phone,
                item.description,
                item.correctiveDescription
            ].some((value) => value && value.toLowerCase().includes(term)));
        }

        return items.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    updateSummary() {
        const container = document.getElementById('nearmiss-summary');
        if (!container) return;
        container.innerHTML = this.renderSummaryCards();
        this.applyModuleI18n(container);
    },

    renderSummaryCards() {
        const records = AppState.appData.nearmiss || [];
        const total = records.length;
        const corrective = records.filter((item) => item.correctiveProposed).length;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonth = records.filter((item) => new Date(item.date) >= monthStart).length;

        const departmentFrequency = {};
        records.forEach((item) => {
            const value = (item.department || '').trim();
            if (!value) return;
            departmentFrequency[value] = (departmentFrequency[value] || 0) + 1;
        });
        const topDepartment = Object.entries(departmentFrequency)
            .sort((a, b) => b[1] - a[1])[0];

        const topDepartmentLabel = topDepartment
            ? `${Utils.escapeHTML(topDepartment[0])} (${topDepartment[1]})`
            : 'لا يوجد بيانات';

        return `
            <div class="summary-card">
                <div class="summary-card-icon bg-indigo-100 text-indigo-600">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <div>
                    <p class="summary-card-label">إجمالي الملاحظات</p>
                    <p class="summary-card-value">${total}</p>
                    <p class="text-xs text-gray-500 mt-1">${thisMonth} ملاحظة خلال هذا الشهر</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon bg-emerald-100 text-emerald-600">
                    <i class="fas fa-lightbulb"></i>
                </div>
                <div>
                    <p class="summary-card-label">مقترحات تصحيحية</p>
                    <p class="summary-card-value">${corrective}</p>
                    <p class="text-xs text-gray-500 mt-1">تشمل إجراءات متابعة مطلوبة</p>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-icon bg-blue-100 text-blue-600">
                    <i class="fas fa-building"></i>
                </div>
                <div>
                    <p class="summary-card-label">أكثر إدارة تسجيلاً</p>
                    <p class="summary-card-value">${topDepartmentLabel}</p>
                </div>
            </div>
        `;
    },

    renderTable() {
        const container = document.getElementById('nearmiss-table-container');
        if (!container) return;

        const items = this.getFilteredItems();
        const countLabel = document.getElementById('nearmiss-result-count');
        if (countLabel) {
            countLabel.textContent = items.length
                ? `${items.length} ملاحظة`
                : 'لا توجد نتائج مطابقة';
        }

        if (!items.length) {
            this.renderEmptyState(container);
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table table-header-orange">
                    <thead>
                        <tr>
                            <th>النوع</th>
                            <th>التاريخ والوقت</th>
                            <th>صاحب الملاحظة</th>
                            <th>الموقع</th>
                            <th>الإدارة</th>
                            <th>الإجراء التصحيحي</th>
                            <th>المرفقات</th>
                            <th style="width: 140px;">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item) => `
                            <tr>
                                <td>
                                    <span class="badge ${this.formatTypeBadge(item.type)}">${Utils.escapeHTML(item.type || '')}</span>
                                </td>
                                <td>
                                    <div class="text-sm text-gray-800">${item.date ? Utils.formatDateTime(item.date) : '-'}</div>
                                </td>
                                <td>
                                    <div class="font-semibold text-gray-900">${Utils.escapeHTML(item.observerName || '-')}</div>
                                    ${item.phone ? `<div class="text-xs text-gray-500">${Utils.escapeHTML(item.phone)}</div>` : ''}
                                </td>
                                <td>${Utils.escapeHTML(item.location || '-')}</td>
                                <td>${Utils.escapeHTML(item.department || '-')}</td>
                                <td>${this.formatCorrectiveBadge(item)}</td>
                                <td>
                                    ${item.attachments && item.attachments.length
                ? `<span class="badge badge-secondary">${item.attachments.length}</span>`
                : '<span class="text-xs text-gray-400">لا يوجد</span>'}
                                </td>
                                <td>
                                    <div class="flex items-center gap-2">
                                        <button class="btn-icon btn-icon-info" data-action="view-nearmiss" data-id="${item.id}" title="عرض التفاصيل">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn-icon btn-icon-primary" data-action="edit-nearmiss" data-id="${item.id}" title="تعديل">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-icon btn-icon-danger" data-action="delete-nearmiss" data-id="${item.id}" title="حذف">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        this.applyModuleI18n(container);

        this.bindTableActions();
    },

    renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">لا توجد ملاحظات مطابقة لعوامل التصفية الحالية</p>
                <button id="nearmiss-empty-create" class="btn-primary mt-4">
                    <i class="fas fa-plus ml-2"></i>
                    تسجيل ملاحظة جديدة
                </button>
            </div>
        `;
        this.applyModuleI18n(container);
        const emptyBtn = document.getElementById('nearmiss-empty-create');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', () => this.showForm());
        }
    },

    bindTableActions() {
        document.querySelectorAll('[data-action="view-nearmiss"]').forEach((button) => {
            button.addEventListener('click', () => this.viewNearMiss(button.getAttribute('data-id')));
        });
        document.querySelectorAll('[data-action="edit-nearmiss"]').forEach((button) => {
            button.addEventListener('click', () => this.editNearMiss(button.getAttribute('data-id')));
        });
        document.querySelectorAll('[data-action="delete-nearmiss"]').forEach((button) => {
            button.addEventListener('click', () => this.deleteNearMiss(button.getAttribute('data-id')));
        });
    },

    formatTypeBadge(type = '') {
        switch (type) {
            case 'حادث وشيك':
                return 'badge-warning';
            case 'تصرف غير آمن':
                return 'badge-info';
            case 'وضع غير آمن':
                return 'badge-secondary';
            case 'حادث':
                return 'badge-danger';
            case 'مقترح':
                return 'badge-primary';
            default:
                return 'badge-info';
        }
    },

    formatCorrectiveBadge(record) {
        if (record.correctiveProposed) {
            return '<span class="badge badge-info">مقترح</span>';
        }
        return '<span class="badge badge-secondary">لا يوجد</span>';
    },

    showForm(data = null) {
        const record = data ? this.normalizeRecord(data) : null;
        this.state.editingId = record?.id || null;
        this.state.currentAttachments = record?.attachments
            ? record.attachments.map((attachment) => this.normalizeAttachment(attachment)).filter(Boolean)
            : [];

        const modal = this.buildFormModal(record);
        document.body.appendChild(modal);
        this.applyModuleI18n(modal);
        this.bindFormEvents(modal, record);
        this.renderAttachmentsPreview();
        this.toggleCorrectiveSection(record?.correctiveProposed === true);
    },

    buildFormModal(record) {
        const showCorrective = record?.correctiveProposed === true;
        const yesChecked = showCorrective ? 'checked' : '';
        const noChecked = showCorrective ? '' : 'checked';
        const departmentOptions = this.getDepartmentOptions();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-${record ? 'edit' : 'plus-circle'} ml-2"></i>
                        ${record ? 'تعديل ملاحظة' : 'تسجيل ملاحظة جديدة'}
                    </h2>
                    <button class="modal-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="nearmiss-form" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع الحادث *</label>
                                <select id="nearmiss-type" class="form-input" required>
                                    ${this.renderTypeOptions(record?.type || '')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ والوقت *</label>
                                <input type="datetime-local" id="nearmiss-date" class="form-input" required value="${record?.date ? Utils.toDateTimeLocalString(record.date) : ''}">
                            </div>
                            <div>
                                <label for="nearmiss-observer" class="block text-sm font-semibold text-gray-700 mb-2">اسم صاحب الملاحظة *</label>
                                <input type="text" id="nearmiss-observer" class="form-input" required value="${Utils.escapeHTML(record?.observerName || '')}" placeholder="اكتب الاسم الثلاثي">
                            </div>
                            <div>
                                <label for="nearmiss-phone" class="block text-sm font-semibold text-gray-700 mb-2">رقم التليفون</label>
                                <input type="tel" id="nearmiss-phone" class="form-input" value="${Utils.escapeHTML(record?.phone || '')}" placeholder="+20XXXXXXXXXX أو 01XXXXXXXXX">
                            </div>
                            <div>
                                <label for="nearmiss-location" class="block text-sm font-semibold text-gray-700 mb-2">مكان الملاحظة بالمصنع *</label>
                                <input type="text" id="nearmiss-location" class="form-input" required value="${Utils.escapeHTML(record?.location || '')}" placeholder="حدد الموقع بدقة">
                            </div>
                            <div>
                                <label for="nearmiss-department" class="block text-sm font-semibold text-gray-700 mb-2">الإدارة التابع لها *</label>
                                <input type="text" id="nearmiss-department" class="form-input" list="nearmiss-departments-list" required value="${Utils.escapeHTML(record?.department || '')}" placeholder="اختر أو اكتب الإدارة">
                                <datalist id="nearmiss-departments-list">
                                    ${departmentOptions.map((department) => `<option value="${Utils.escapeHTML(department)}"></option>`).join('')}
                                </datalist>
                            </div>
                        </div>
                        <div>
                            <label for="nearmiss-description" class="block text-sm font-semibold text-gray-700 mb-2">وصف الملاحظة بكل دقة *</label>
                            <textarea id="nearmiss-description" class="form-input" rows="4" required placeholder="أضف تفاصيل كاملة وواضحة">${Utils.escapeHTML(record?.description || '')}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">هل تقترح أي إجراء تصحيحي؟ *</label>
                            <div class="flex items-center gap-6">
                                <label class="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="radio" name="nearmiss-corrective" value="yes" class="form-radio" ${yesChecked}>
                                    نعم
                                </label>
                                <label class="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="radio" name="nearmiss-corrective" value="no" class="form-radio" ${noChecked}>
                                    لا
                                </label>
                            </div>
                        </div>
                        <div id="nearmiss-corrective-wrapper" class="${showCorrective ? '' : 'hidden'}">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">وصف الإجراء المقترح *</label>
                            <textarea id="nearmiss-corrective-description" class="form-input" rows="3" ${showCorrective ? 'required' : ''} placeholder="صف الإجراء التصحيحي المطلوب">${Utils.escapeHTML(record?.correctiveDescription || '')}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">صور أو مستندات توضيحية (اختياري)</label>
                            <input type="file" id="nearmiss-attachments" class="form-input" accept="image/*,.pdf" multiple>
                            <p class="text-xs text-gray-500 mt-2">يسمح بملفات JPG أو PNG أو PDF بحد أقصى 5MB لكل ملف.</p>
                            <div id="nearmiss-attachments-preview" class="mt-3 space-y-2"></div>
                        </div>
                        <div class="flex items-center justify-end gap-3 pt-4 border-t">
                            <button type="button" id="nearmiss-cancel-btn" class="btn-secondary">إلغاء</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>
                                ${record ? 'تحديث الملاحظة' : 'حفظ الملاحظة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        return modal;
    },

    bindFormEvents(modal, record) {
        const form = modal.querySelector('#nearmiss-form');
        if (form) {
            form.addEventListener('submit', (event) => this.handleSubmit(event));
        }

        const closeBtn = modal.querySelector('[data-action="close-modal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal(modal));
        }

        const cancelBtn = modal.querySelector('#nearmiss-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal(modal));
        }

        const attachmentsInput = modal.querySelector('#nearmiss-attachments');
        if (attachmentsInput) {
            attachmentsInput.addEventListener('change', (event) => this.handleAttachmentsChange(event.target.files));
        }

        const correctiveRadios = modal.querySelectorAll('input[name="nearmiss-corrective"]');
        correctiveRadios.forEach((radio) => {
            radio.addEventListener('change', (event) => this.toggleCorrectiveSection(event.target.value === 'yes'));
        });

        const attachmentsPreview = modal.querySelector('#nearmiss-attachments-preview');
        if (attachmentsPreview) {
            attachmentsPreview.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-remove-attachment]');
                if (button) {
                    this.removeAttachment(button.getAttribute('data-remove-attachment'));
                }
            });
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal(modal);
            }
        });

        setTimeout(() => {
            modal.querySelector('#nearmiss-type')?.focus();
        }, 100);
    },

    toggleCorrectiveSection(show) {
        const wrapper = document.getElementById('nearmiss-corrective-wrapper');
        const textarea = document.getElementById('nearmiss-corrective-description');
        if (!wrapper || !textarea) return;
        if (show) {
            wrapper.classList.remove('hidden');
            textarea.setAttribute('required', 'required');
        } else {
            wrapper.classList.add('hidden');
            textarea.removeAttribute('required');
            textarea.value = '';
        }
    },

    renderAttachmentsPreview() {
        const container = document.getElementById('nearmiss-attachments-preview');
        if (!container) return;

        if (!this.state.currentAttachments.length) {
            container.innerHTML = '<p class="text-sm text-gray-500">لم يتم إرفاق ملفات بعد.</p>';
            return;
        }

        container.innerHTML = this.state.currentAttachments.map((attachment) => `
            <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <div>
                    <div class="text-sm font-medium text-gray-800">${Utils.escapeHTML(attachment.name)}</div>
                    <div class="text-xs text-gray-500">${attachment.size ? `${attachment.size} KB` : ''}</div>
                </div>
                <div class="flex items-center gap-3">
                    <a href="${attachment.data}" target="_blank" class="text-sm text-blue-600 hover:underline">عرض</a>
                    <button type="button" class="btn-icon btn-icon-danger" data-remove-attachment="${attachment.id}" title="إزالة">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    async handleAttachmentsChange(fileList) {
        if (!fileList || !fileList.length) return;

        const files = Array.from(fileList);
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
        const maxSize = 5 * 1024 * 1024;
        const newAttachments = [];

        for (const file of files) {
            const extension = (file.name.split('.').pop() || '').toLowerCase();
            if (!allowedExtensions.includes(extension)) {
                Notification.warning(`الملف ${file.name} غير مدعوم. يسمح بملفات JPG أو PNG أو PDF فقط.`);
                continue;
            }
            if (file.size > maxSize) {
                Notification.warning(`الملف ${file.name} يتجاوز الحد الأقصى المسموح به (5MB).`);
                continue;
            }

            try {
                const base64 = await this.readFileAsBase64(file);
                newAttachments.push({
                    id: Utils.generateId('ATT'),
                    name: file.name,
                    type: file.type || this.detectMimeType(file.name),
                    data: base64,
                    size: Math.round(file.size / 1024),
                    uploadedAt: new Date().toISOString()
                });
            } catch (error) {
                Notification.error(`تعذر تحميل الملف ${file.name}`);
            }
        }

        if (newAttachments.length) {
            this.state.currentAttachments = [...this.state.currentAttachments, ...newAttachments];
            this.renderAttachmentsPreview();
        }

        const input = document.getElementById('nearmiss-attachments');
        if (input) {
            input.value = '';
        }
    },

    removeAttachment(attachmentId) {
        if (!attachmentId) return;
        this.state.currentAttachments = this.state.currentAttachments.filter((attachment) => attachment.id !== attachmentId);
        this.renderAttachmentsPreview();
    },

    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    },

    validatePhone(phone) {
        if (!phone) return false;
        // إزالة المسافات والأحرف الخاصة
        const normalized = phone.replace(/[\s\-\(\)]/g, '');

        // التحقق من الأرقام المصرية
        // +20XXXXXXXXXX (11 رقم بعد +20)
        if (normalized.startsWith('+20')) {
            const digits = normalized.substring(3).replace(/\D/g, '');
            return digits.length === 10 && digits.startsWith('1');
        }

        // 01XXXXXXXXX (11 رقم يبدأ بـ 01)
        if (normalized.startsWith('01')) {
            const digits = normalized.replace(/\D/g, '');
            return digits.length === 11 && digits.startsWith('01');
        }

        // 0XXXXXXXXX (10 أو 11 رقم يبدأ بـ 0)
        if (normalized.startsWith('0')) {
            const digits = normalized.replace(/\D/g, '');
            return digits.length >= 10 && digits.length <= 11;
        }

        // إذا كان الرقم يبدأ مباشرة بأرقام (بدون +20 أو 0)
        const digits = normalized.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 11;
    },

    async handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const modal = form.closest('.modal-overlay');

        // منع النقر المتكرر
        const submitBtn = form?.querySelector('button[type="submit"]') || 
                         document.querySelector('.modal-overlay button[type="submit"]');
        
        if (submitBtn && submitBtn.disabled) {
            return; // النموذج قيد المعالجة
        }

        const type = form.querySelector('#nearmiss-type')?.value || '';
        const dateInput = form.querySelector('#nearmiss-date')?.value || '';
        const observerName = (form.querySelector('#nearmiss-observer')?.value || '').trim();
        const phone = (form.querySelector('#nearmiss-phone')?.value || '').trim();
        const location = (form.querySelector('#nearmiss-location')?.value || '').trim();
        const department = (form.querySelector('#nearmiss-department')?.value || '').trim();
        const description = (form.querySelector('#nearmiss-description')?.value || '').trim();
        const correctiveValue = form.querySelector('input[name="nearmiss-corrective"]:checked')?.value || 'no';
        const correctiveProposed = correctiveValue === 'yes';
        const correctiveDescription = correctiveProposed
            ? (form.querySelector('#nearmiss-corrective-description')?.value || '').trim()
            : '';

        if (!type || !dateInput || !observerName || !location || !department || !description) {
            Notification.error('يرجى تعبئة جميع الحقول المطلوبة');
            return;
        }

        if (phone && !this.validatePhone(phone)) {
            Notification.error('يرجى إدخال رقم تليفون صحيح');
            return;
        }

        if (correctiveProposed && !correctiveDescription) {
            Notification.error('يرجى وصف الإجراء التصحيحي المقترح');
            return;
        }

        // ✅ إصلاح: استخدام تحويل صحيح لـ datetime-local
        let isoDate;
        try {
            isoDate = Utils.dateTimeLocalToISO(dateInput) || new Date(dateInput).toISOString();
        } catch (error) {
            Notification.error('صيغة التاريخ غير صحيحة');
            return;
        }

        let attachments = this.state.currentAttachments.map((attachment) => this.normalizeAttachment(attachment)).filter(Boolean);
        const now = new Date().toISOString();

        // تعطيل الزر لمنع النقر المتكرر
        let originalText = '';
        if (submitBtn) {
            originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';
        }

        try {
            // معالجة attachments ورفعها إلى Google Drive
            if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                Loading.show('جاري رفع المرفقات إلى Google Drive...');
                try {
                    Utils.safeLog('NearMiss: قبل processAttachments - عدد المرفقات: ' + attachments.length);
                    if (attachments.length > 0) {
                        Utils.safeLog('NearMiss: أول مرفق قبل المعالجة:', {
                            name: attachments[0].name,
                            hasData: !!attachments[0].data,
                            hasDirectLink: !!attachments[0].directLink
                        });
                    }
                    attachments = await GoogleIntegration.processAttachments?.(
                        attachments,
                        'NearMiss'
                    ) || attachments;
                    Utils.safeLog('NearMiss: بعد processAttachments - عدد المرفقات: ' + attachments.length);
                    if (attachments.length > 0) {
                        Utils.safeLog('NearMiss: أول مرفق بعد المعالجة:', {
                            name: attachments[0].name,
                            directLink: attachments[0].directLink ? attachments[0].directLink.substring(0, 50) + '...' : 'لا يوجد'
                        });
                    }
                } catch (uploadError) {
                    Utils.safeError('خطأ في رفع المرفقات:', uploadError);
                    Notification.warning('تم حفظ الملاحظة لكن فشل رفع بعض المرفقات');
                }
            }

            if (this.state.editingId) {
                const index = AppState.appData.nearmiss.findIndex((item) => item.id === this.state.editingId);
                if (index === -1) {
                    throw new Error('تعذر العثور على الملاحظة المحددة');
                }
                const existing = this.normalizeRecord(AppState.appData.nearmiss[index]);
                const updatedRecord = {
                    ...existing,
                    type,
                    date: isoDate,
                    observerName,
                    phone,
                    location,
                    department,
                    description,
                    correctiveProposed,
                    correctiveDescription,
                    attachments,
                    status: existing.status || (correctiveProposed ? 'مفتوح' : 'مغلق'),
                    updatedAt: now,
                    updatedBy: this.getCurrentUserSummary(),
                    reportedBy: observerName
                };
                AppState.appData.nearmiss[index] = updatedRecord;
            } else {
                const createdBy = this.getCurrentUserSummary();
                const newRecord = {
                    id: Utils.generateSequentialId('NRM', AppState.appData?.nearmiss || []),
                    type,
                    date: isoDate,
                    observerName,
                    phone,
                    location,
                    department,
                    description,
                    correctiveProposed,
                    correctiveDescription,
                    attachments,
                    createdBy,
                    createdById: createdBy?.id || AppState.currentUser?.id || '',
                    createdAt: now,
                    updatedAt: now,
                    updatedBy: null,
                    status: correctiveProposed ? 'مفتوح' : 'مغلق',
                    reportedBy: observerName
                };
                AppState.appData.nearmiss.push(newRecord);
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
            this.closeModal(modal);
            
            // 3. عرض رسالة نجاح فورية
            Notification.success(this.state.editingId ? 'تم تحديث الملاحظة بنجاح' : 'تم تسجيل الملاحظة بنجاح');
            
            // 4. استعادة الزر بعد النجاح
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            
            // 5. تحديث القائمة فوراً
            this.updateSummary();
            this.renderTable();
            this.refreshFilterOptions();
            
            // 6. معالجة المهام الخلفية (Google Sheets) في الخلفية
            if (GoogleIntegration?.sendRequest) {
                Promise.resolve().then(async () => {
                    try {
                        if (this.state.editingId) {
                            await GoogleIntegration.sendRequest({
                                action: 'updateNearMiss',
                                data: { nearMissId: this.state.editingId, updateData: updatedRecord }
                            });
                        } else {
                            await GoogleIntegration.sendRequest({
                                action: 'addNearMiss',
                                data: newRecord
                            });
                        }
                    } catch (error) {
                        Utils.safeWarn('⚠ فشل حفظ الحوادث الوشيكة في Google Sheets:', error);
                    }
                }).catch(error => {
                    Utils.safeWarn('⚠ فشل حفظ الحوادث الوشيكة في Google Sheets:', error);
                });
            }
        } catch (error) {
            Utils.safeError('خطأ في حفظ الحادث الوشيك:', error);
            Notification.error(error.message || 'حدث خطأ أثناء حفظ البيانات');
            
            // استعادة الزر في حالة الخطأ
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        } finally {
            this.state.currentAttachments = [];
            this.state.editingId = null;
        }
    },

    closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
        this.state.currentAttachments = [];
        this.state.editingId = null;
    },

    refreshFilterOptions() {
        const departmentSelect = document.getElementById('nearmiss-filter-department');
        if (departmentSelect) {
            departmentSelect.innerHTML = this.renderDepartmentOptions(this.state.filters.department);
        }
    },

    viewNearMiss(id) {
        if (!id) return;
        const record = AppState.appData.nearmiss.find((item) => item.id === id);
        if (!record) {
            Notification.error('تعذر العثور على الملاحظة المحددة');
            return;
        }
        const modal = this.buildDetailModal(this.normalizeRecord(record));
        document.body.appendChild(modal);
        this.applyModuleI18n(modal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal(modal);
            }
        });
    },

    buildDetailModal(record) {
        const attachmentsHtml = record.attachments && record.attachments.length
            ? record.attachments.map((attachment) => {
                // ✅ التحقق مما إذا كان المرفق صورة - بدون short-circuit
                const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(attachment.name || '');
                const hasImageMimeType = attachment.type && attachment.type.startsWith('image/');
                const isImage = hasImageMimeType || hasImageExtension;
                const attachmentUrl = this.processAttachmentUrl(attachment.data);

                if (isImage && attachmentUrl) {
                    return `
                        <div class="bg-gray-50 border border-gray-200 rounded p-3">
                            <div class="flex items-center justify-between mb-2">
                                <div>
                                    <div class="text-sm font-medium text-gray-800">${Utils.escapeHTML(attachment.name)}</div>
                                    <div class="text-xs text-gray-500">${attachment.size ? `${attachment.size} KB` : ''}</div>
                                </div>
                                <a href="${attachmentUrl}" target="_blank" class="text-sm text-blue-600 hover:underline" download="${Utils.escapeHTML(attachment.name)}">تحميل</a>
                            </div>
                            <img src="${Utils.escapeHTML(attachmentUrl)}" alt="${Utils.escapeHTML(attachment.name)}" class="max-w-full h-auto rounded border" style="max-height: 300px;"
                                 onerror="this.onerror=null; this.style.display='none';">
                        </div>
                    `;
                } else {
                    return `
                        <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                            <div>
                                <div class="text-sm font-medium text-gray-800">${Utils.escapeHTML(attachment.name)}</div>
                                <div class="text-xs text-gray-500">${attachment.size ? `${attachment.size} KB` : ''}</div>
                            </div>
                            <div class="flex items-center gap-3">
                                <a href="${attachmentUrl || attachment.data}" target="_blank" class="text-sm text-blue-600 hover:underline" download="${Utils.escapeHTML(attachment.name)}">تحميل</a>
                            </div>
                        </div>
                    `;
                }
            }).join('')
            : '<p class="text-sm text-gray-500">لا توجد مرفقات</p>';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-eye ml-2"></i>
                        تفاصيل الملاحظة
                    </h2>
                    <button class="modal-close" data-action="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="detail-label">نوع الحادث</label>
                            <p class="detail-value">${Utils.escapeHTML(record.type)}</p>
                        </div>
                        <div>
                            <label class="detail-label">التاريخ والوقت</label>
                            <p class="detail-value">${Utils.formatDateTime(record.date)}</p>
                        </div>
                        <div>
                            <label class="detail-label">اسم صاحب الملاحظة</label>
                            <p class="detail-value">${Utils.escapeHTML(record.observerName || '-')}</p>
                            ${record.phone ? `<p class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(record.phone)}</p>` : ''}
                        </div>
                        <div>
                            <label class="detail-label">الإدارة</label>
                            <p class="detail-value">${Utils.escapeHTML(record.department || '-')}</p>
                        </div>
                        <div>
                            <label class="detail-label">مكان الملاحظة</label>
                            <p class="detail-value">${Utils.escapeHTML(record.location || '-')}</p>
                        </div>
                        <div>
                            <label class="detail-label">الإجراء التصحيحي</label>
                            <p class="detail-value">${record.correctiveProposed ? 'تم اقتراح إجراء تصحيحي' : 'لا يوجد إجراء مقترح'}</p>
                        </div>
                    </div>
                    <div>
                        <label class="detail-label">وصف الملاحظة</label>
                        <p class="detail-value whitespace-pre-line">${Utils.escapeHTML(record.description || '-')}</p>
                    </div>
                    ${record.correctiveProposed ? `
                        <div>
                            <label class="detail-label">وصف الإجراء المقترح</label>
                            <p class="detail-value whitespace-pre-line">${Utils.escapeHTML(record.correctiveDescription || '-')}</p>
                        </div>
                    ` : ''}
                    <div>
                        <label class="detail-label">المرفقات</label>
                        <div class="space-y-2">
                            ${attachmentsHtml}
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 border-t pt-4 space-y-1">
                        <div>أنشئ بواسطة: ${Utils.escapeHTML(record.createdBy?.name || 'غير محدد')}</div>
                        <div>تاريخ الإنشاء: ${Utils.formatDateTime(record.createdAt)}</div>
                        <div>آخر تحديث: ${Utils.formatDateTime(record.updatedAt)}</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" data-action="close-modal">إغلاق</button>
                    <button class="btn-secondary" data-action="detail-print" data-id="${record.id}">
                        <i class="fas fa-print ml-2"></i>
                        طباعة
                    </button>
                    <button class="btn-primary" data-action="detail-edit" data-id="${record.id}">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
                    </button>
                </div>
            </div>
        `;

        const closeBtn = modal.querySelector('[data-action="close-modal"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal(modal));
        }
        const editBtn = modal.querySelector('[data-action="detail-edit"]');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const recordId = editBtn.getAttribute('data-id');
                this.closeModal(modal);
                this.editNearMiss(recordId);
            });
        }
        const printBtn = modal.querySelector('[data-action="detail-print"]');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                const recordId = printBtn.getAttribute('data-id');
                this.printNearMiss(recordId);
            });
        }

        return modal;
    },

    /**
     * طباعة تفاصيل الملاحظة
     */
    printNearMiss(id) {
        const record = AppState.appData.nearmiss.find((item) => item.id === id);
        if (!record) {
            Notification.error('تعذر العثور على الملاحظة المحددة');
            return;
        }

        try {
            Loading.show('جاري إعداد الطباعة...');

            // معالجة المرفقات
            const attachmentsHtml = record.attachments && record.attachments.length
                ? record.attachments.map((attachment) => {
                    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(attachment.name || '');
                    const hasImageMimeType = attachment.type && attachment.type.startsWith('image/');
                    const isImage = hasImageMimeType || hasImageExtension;
                    const attachmentUrl = this.processAttachmentUrl(attachment.data);

                    if (isImage && attachmentUrl) {
                        return `
                            <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                                <div style="font-weight: bold; margin-bottom: 5px;">${Utils.escapeHTML(attachment.name)}</div>
                                <img src="${Utils.escapeHTML(attachmentUrl)}" alt="${Utils.escapeHTML(attachment.name)}" style="max-width: 100%; max-height: 300px; border: 1px solid #ddd; border-radius: 4px;"
                                     onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                            </div>
                        `;
                    } else {
                        return `
                            <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                                <div style="font-weight: bold;">${Utils.escapeHTML(attachment.name)}</div>
                            </div>
                        `;
                    }
                }).join('')
                : '<p style="color: #999;">لا توجد مرفقات</p>';

            const formCode = `NEAR-${record.id?.substring(0, 8) || 'UNKNOWN'}`;
            const title = 'تقرير الملاحظة - Near Miss Report';

            const content = `
                <table class="report-table" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <th style="width: 30%; padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">نوع الحادث</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(record.type || '-')}</td>
                    </tr>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">التاريخ والوقت</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${record.date ? Utils.formatDateTime(record.date) : '-'}</td>
                    </tr>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">اسم صاحب الملاحظة</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(record.observerName || '-')}</td>
                    </tr>
                    ${record.phone ? `
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">رقم الهاتف</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(record.phone)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">الإدارة</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(record.department || '-')}</td>
                    </tr>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">مكان الملاحظة</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${Utils.escapeHTML(record.location || '-')}</td>
                    </tr>
                    <tr>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;">الإجراء التصحيحي</th>
                        <td style="padding: 8px; border: 1px solid #ddd;">${record.correctiveProposed ? 'تم اقتراح إجراء تصحيحي' : 'لا يوجد إجراء مقترح'}</td>
                    </tr>
                </table>

                <div style="margin-top: 20px;">
                    <h3 style="font-weight: bold; margin-bottom: 10px;">وصف الملاحظة</h3>
                    <p style="white-space: pre-wrap; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${Utils.escapeHTML(record.description || '-')}</p>
                </div>

                ${record.correctiveProposed ? `
                <div style="margin-top: 20px;">
                    <h3 style="font-weight: bold; margin-bottom: 10px;">وصف الإجراء المقترح</h3>
                    <p style="white-space: pre-wrap; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${Utils.escapeHTML(record.correctiveDescription || '-')}</p>
                </div>
                ` : ''}

                <div style="margin-top: 20px;">
                    <h3 style="font-weight: bold; margin-bottom: 10px;">المرفقات</h3>
                    ${attachmentsHtml}
                </div>
            `;

            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(
                    formCode,
                    title,
                    content,
                    false,
                    true,
                    { version: '1.0' },
                    record.createdAt,
                    record.updatedAt
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    // انتظار تحميل الصور
                    const images = printWindow.document.querySelectorAll('img');
                    let imagesLoaded = 0;
                    const totalImages = images.length;

                    if (totalImages === 0) {
                        setTimeout(() => {
                            printWindow.print();
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                            Loading.hide();
                        }, 300);
                    } else {
                        const checkAllImagesLoaded = () => {
                            if (imagesLoaded >= totalImages) {
                                setTimeout(() => {
                                    printWindow.print();
                                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                                    Loading.hide();
                                }, 300);
                            }
                        };

                        images.forEach(img => {
                            if (img.complete) {
                                imagesLoaded++;
                                checkAllImagesLoaded();
                            } else {
                                img.onload = () => {
                                    imagesLoaded++;
                                    checkAllImagesLoaded();
                                };
                                img.onerror = () => {
                                    imagesLoaded++;
                                    checkAllImagesLoaded();
                                };
                            }
                        });

                        setTimeout(() => {
                            if (imagesLoaded < totalImages) {
                                printWindow.print();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                                Loading.hide();
                            }
                        }, 3000);
                    }
                };
            } else {
                URL.revokeObjectURL(url);
                Loading.hide();
                Notification.error('يرجى السماح بنوافذ منبثقة للطباعة');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة الملاحظة:', error);
            Notification.error('فشل في طباعة الملاحظة: ' + error.message);
        }
    },

    editNearMiss(id) {
        if (!id) return;
        const record = AppState.appData.nearmiss.find((item) => item.id === id);
        if (!record) {
            Notification.error('تعذر العثور على الملاحظة المحددة');
            return;
        }
        this.showForm(record);
    },

    async deleteNearMiss(id) {
        if (!id) return;
        const record = AppState.appData.nearmiss.find((item) => item.id === id);
        if (!record) {
            Notification.error('تعذر العثور على الملاحظة المحددة');
            return;
        }
        if (!confirm('هل أنت متأكد من حذف هذه الملاحظة؟')) return;

        Loading.show();
        try {
            AppState.appData.nearmiss = AppState.appData.nearmiss.filter((item) => item.id !== id);
            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            if (GoogleIntegration?.sendRequest) {
                try {
                    await GoogleIntegration.sendRequest({
                        action: 'deleteNearMiss',
                        data: { nearMissId: id }
                    });
                } catch (error) {
                    Utils.safeWarn('⚠ فشل حذف الحوادث الوشيكة من Google Sheets:', error);
                }
            }
            Notification.success('تم حذف الملاحظة بنجاح');
        } catch (error) {
            Utils.safeError('خطأ في حذف الحادث الوشيك:', error);
            Notification.error('حدث خطأ أثناء حذف الملاحظة');
        } finally {
            Loading.hide();
            this.updateSummary();
            this.renderTable();
            this.refreshFilterOptions();
        }
    }
};
// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof NearMiss !== 'undefined') {
            window.NearMiss = NearMiss;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ NearMiss module loaded and available on window.NearMiss');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير NearMiss:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof NearMiss !== 'undefined') {
            try {
                window.NearMiss = NearMiss;
            } catch (e) {
                console.error('❌ فشل تصدير NearMiss:', e);
            }
        }
    }
})();