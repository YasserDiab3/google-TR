/**
 * Violations Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Violations Module (مخالفات الموظفين والمقاولين) =====
const Violations = {
    currentFilters: {
        personType: '',
        violationType: '',
        severity: '',
        status: ''
    },

    parseFineAmount(value) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') {
            return Number.isFinite(value) && value >= 0 ? value : 0;
        }
        const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
        const easternArabicDigits = '۰۱۲۳۴۵۶۷۸۹';
        const toAsciiDigits = (input) => String(input || '').replace(/[٠-٩۰-۹]/g, (char) => {
            const idxArabicIndic = arabicIndicDigits.indexOf(char);
            if (idxArabicIndic >= 0) return String(idxArabicIndic);
            const idxEasternArabic = easternArabicDigits.indexOf(char);
            return idxEasternArabic >= 0 ? String(idxEasternArabic) : char;
        });
        const normalized = String(value)
            .trim();
        const normalizedDigits = toAsciiDigits(normalized)
            .replace(/[,\u066C]/g, '')
            .replace(/\u066B/g, '.')
            .replace(/[^\d.\-]/g, '');
        const parsed = Number(normalizedDigits);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    },

    normalizeViolationRecord(record) {
        if (!record || typeof record !== 'object') return null;
        const fineAmountRaw =
            record.fineAmount ??
            record.defaultFineAmount ??
            record.fine_amount ??
            record.fine ??
            record.amount ??
            record['القيمة المالية'] ??
            record['قيمة مالية'] ??
            0;
        const fineAmount = this.parseFineAmount(fineAmountRaw);
        const personType = record.personType || (record.contractorName ? 'contractor' : 'employee');
        return {
            ...record,
            personType,
            fineAmount
        };
    },

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        // التحقق من المتطلبات الأساسية
        if (typeof Utils === 'undefined') {
            console.error('❌ Utils غير متوفر - يرجى تحديث الصفحة');
            const section = document.getElementById('violations-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-3"></i>
                                <h3 class="text-lg font-semibold text-gray-800 mb-2">فشل تحميل الموديول</h3>
                                <p class="text-gray-500 mb-4">يرجى تحديث الصفحة</p>
                                <button onclick="location.reload()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>تحديث الصفحة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            return;
        }

        const section = document.getElementById('violations-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('⚠️ قسم violations-section غير موجود');
            }
            return;
        }
        try {
            // التأكد من وجود AppState
            if (typeof AppState === 'undefined') {
                const errorMsg = '❌ AppState غير متوفر. يرجى تحديث الصفحة.';
                Utils.safeError(errorMsg);
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-3"></i>
                                <h3 class="text-lg font-semibold text-gray-800 mb-2">فشل تحميل الموديول</h3>
                                <p class="text-gray-500 mb-4">يرجى تحديث الصفحة</p>
                                <button onclick="location.reload()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>تحديث الصفحة
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            // التأكد من وجود البيانات
            if (!AppState.appData) {
                AppState.appData = {};
            }
            if (!AppState.appData.violations) {
                AppState.appData.violations = [];
            }
            if (!AppState.appData.blacklistRegister) {
                AppState.appData.blacklistRegister = [];
            }

            // التحقق من وجود ViolationTypesManager قبل الاستدعاء
            if (typeof ViolationTypesManager !== 'undefined' && ViolationTypesManager.ensureInitialized) {
                try {
                    ViolationTypesManager.ensureInitialized();
                } catch (vtError) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ خطأ في تهيئة ViolationTypesManager:', vtError);
                    }
                }
            } else {
                // استخدام القيم الافتراضية إذا لم يكن ViolationTypesManager متوفراً
                if (!AppState.appData.violationTypes || !Array.isArray(AppState.appData.violationTypes)) {
                    AppState.appData.violationTypes = [];
                }
            }

            // ✅ تحميل مباشر من قاعدة البيانات/Sheets عند أول فتح (بدون تكرار طلبات متوازية)
            const hasViolationsData = Array.isArray(AppState.appData.violations) && AppState.appData.violations.length > 0;
            const lastSync = (() => {
                try { return localStorage.getItem('violations_last_sync'); } catch (e) { return null; }
            })();
            const cacheAge = lastSync ? (Date.now() - parseInt(lastSync, 10)) : Infinity;
            const CACHE_DURATION = 10 * 60 * 1000; // 10 دقائق
            const isStale = cacheAge >= CACHE_DURATION;
            if ((!hasViolationsData || isStale) && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.readFromSheets) {
                try {
                    await Promise.race([
                        this.ensureViolationsCoreDataLoaded({ force: isStale && hasViolationsData }),
                        new Promise(resolve => setTimeout(resolve, 1200)),
                    ]);
                } catch (e) {
                    // تجاهل — سنعرض البيانات المحلية ثم نحدّث في الخلفية
                }
            }

            section.innerHTML = `
            <div class="section-header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); border-radius: 16px; padding: 24px 32px; margin-bottom: 24px; box-shadow: 0 8px 32px rgba(220, 38, 38, 0.25);">
                <div class="flex items-center justify-between">
                    <div class="text-center w-full" style="flex-grow: 1;">
                        <h1 class="section-title" style="color: white; font-size: 2rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2); margin-bottom: 8px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-exclamation-triangle ml-3" style="font-size: 1.8rem;"></i>
                            سجل المخالفات
                        </h1>
                        <p class="section-subtitle" style="color: rgba(255,255,255,0.9); font-size: 1rem; margin: 0;">تسجيل ومتابعة مخالفات الموظفين والمقاولين</p>
                    </div>
                    <button id="add-violation-btn" class="btn-primary" style="background: white; color: #dc2626; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s ease;">
                        <i class="fas fa-plus ml-2"></i>
                        تسجيل مخالفة جديدة
                    </button>
                </div>
            </div>
            <div class="mt-6">
                <!-- Tabs Navigation -->
                <div class="tabs-container mb-4">
                    <div class="tabs-nav" style="flex-wrap: nowrap; overflow-x: auto; overflow-y: visible; min-width: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
                        <button class="tab-btn active" data-tab="all" onclick="Violations.switchTab('all')" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-list ml-2"></i>جميع المخالفات
                        </button>
                        <button class="tab-btn" data-tab="employees" onclick="Violations.switchTab('employees')" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-user-tie ml-2"></i>مخالفات الموظفين
                        </button>
                        <button class="tab-btn" data-tab="contractors" onclick="Violations.switchTab('contractors')" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-users-cog ml-2"></i>مخالفات المقاولين
                        </button>
                        <button class="tab-btn" data-tab="analytics" onclick="Violations.switchTab('analytics')" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-chart-bar ml-2"></i>تحليل البيانات
                        </button>
                        <button class="tab-btn" data-tab="blacklist" onclick="Violations.switchTabAsync('blacklist')" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-user-slash ml-2"></i>سجل الممنوعين من الدخول – Blacklist
                        </button>
                        <button id="violations-btn-refresh" type="button" class="tab-btn" onclick="Violations.refreshModule()" title="تحديث البيانات" style="flex-shrink: 0; min-width: fit-content; white-space: nowrap; width: auto; max-width: none;">
                            <i class="fas fa-sync-alt ml-2"></i>تحديث
                        </button>
                    </div>
                </div>
                
                <!-- Tab Content -->
                <div id="violations-tab-content">
                    <div class="content-card" id="violations-list-tab">
                    <div class="card-header">
                        <h2 class="card-title"><i class="fas fa-list ml-2"></i>قائمة المخالفات</h2>
                    </div>
                    <div class="card-body">
                        ${this.renderAllViolationsStats()}
                        <div id="violations-filters-container" class="mb-4">
                            ${this.renderFilters()}
                        </div>
                        <div id="violations-list">
                            ${this.renderViolationsList()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
            this.setupEventListeners();

            // ✅ تحديث خلفي بعد العرض (بدون إعادة بناء كامل إذا كانت البيانات محدثة)
            Promise.resolve(this.ensureViolationsCoreDataLoaded({ force: false }))
                .then(() => {
                    try {
                        const stats = document.getElementById('violations-stats-cards');
                        if (stats) stats.outerHTML = this.renderAllViolationsStats();
                        const list = document.getElementById('violations-list');
                        if (list) list.innerHTML = this.renderViolationsList();
                        const filters = document.getElementById('violations-filters-container');
                        if (filters) filters.innerHTML = this.renderFilters();
                    } catch (e) {}
                })
                .catch(() => {});
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول المخالفات:', error);
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-exclamation-circle ml-3"></i>
                            سجل المخالفات
                        </h1>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button onclick="Violations.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    إعادة المحاولة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * تحميل بيانات المخالفات الأساسية من Google Sheets مرة واحدة (مع منع التكرار)
     */
    async ensureViolationsCoreDataLoaded({ force = false } = {}) {
        if (this._violationsCoreLoadPromise && !force) {
            return this._violationsCoreLoadPromise;
        }
        this._violationsCoreLoadPromise = (async () => {
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.readFromSheets) return;

            const isEnabled = AppState?.googleConfig?.appsScript?.enabled && AppState?.googleConfig?.appsScript?.scriptUrl;
            if (!isEnabled) return;

            const [violationsData, typesData] = await Promise.all([
                GoogleIntegration.readFromSheets('Violations').catch(() => null),
                GoogleIntegration.readFromSheets('ViolationTypes').catch(() => null),
            ]);

            if (Array.isArray(violationsData)) {
                AppState.appData.violations = violationsData
                    .map((item) => this.normalizeViolationRecord(item))
                    .filter(Boolean);
            }
            if (Array.isArray(typesData)) {
                AppState.appData.violationTypes = typesData;
            }

            try {
                if (typeof ViolationTypesManager !== 'undefined' && ViolationTypesManager.ensureInitialized) {
                    ViolationTypesManager.ensureInitialized();
                }
            } catch (e) {}

            try { localStorage.setItem('violations_last_sync', String(Date.now())); } catch (e) {}

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                try { window.DataManager.save(); } catch (e) {}
            }
        })().finally(() => {
            this._violationsCoreLoadPromise = null;
        });
        return this._violationsCoreLoadPromise;
    },

    renderViolationsList() {
        try {
            const violations = this.getFilteredViolations();
            if (!violations || violations.length === 0) {
                const message = this.hasActiveFilters()
                    ? 'لا توجد مخالفات مطابقة لعوامل التصفية الحالية'
                    : 'لا توجد مخالفات مسجلة';
                return `<div class="empty-state"><p class="text-gray-500">${message}</p></div>`;
            }
            return `
                <div class="table-responsive" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
                    <table class="data-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">اسم الموظف/المقاول</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">نوع المخالفة</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">القيمة المالية</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الموقع</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">التاريخ</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الشدة</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الحالة</th>
                                <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${violations.map((violation, index) => `
                                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#fef2f2'}; transition: all 0.2s ease;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='${index % 2 === 0 ? '#ffffff' : '#fef2f2'}'">
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca; font-weight: 500;">
                                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                            <i class="fas ${violation.employeeName ? 'fa-user-tie' : 'fa-hard-hat'}" style="color: ${violation.employeeName ? '#3b82f6' : '#f59e0b'};"></i>
                                            ${Utils.escapeHTML(violation.employeeName || violation.contractorName || '-')}
                                        </div>
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca;">
                                        ${Utils.escapeHTML(violation.violationType || '-')}
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca; font-weight: 600; color: #166534;">
                                        ${Number(violation.fineAmount || 0).toLocaleString('ar-EG')} ج.م
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca; font-size: 0.85rem; color: #6b7280;">
                                        ${Utils.escapeHTML(violation.violationLocation || '-')}
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca;">
                                        ${violation.violationDate ? Utils.formatDate(violation.violationDate) : '-'}
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca;">
                                        <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; background: ${violation.severity === 'عالية' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : violation.severity === 'متوسطة' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #2563eb)'}; color: white; box-shadow: 0 2px 6px ${violation.severity === 'عالية' ? 'rgba(239,68,68,0.3)' : violation.severity === 'متوسطة' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'};">
                                            ${violation.severity || '-'}
                                        </span>
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca;">
                                        <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; background: ${violation.status === 'محلول' ? 'linear-gradient(135deg, #10b981, #059669)' : violation.status === 'قيد المراجعة' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #f59e0b, #d97706)'}; color: white;">
                                            ${violation.status || '-'}
                                        </span>
                                    </td>
                                    <td style="padding: 14px 12px; text-align: center; border-bottom: 1px solid #fecaca;">
                                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                            <button onclick="Violations.viewViolation('${violation.id}')" style="width: 36px; height: 36px; border-radius: 8px; border: none; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(59,130,246,0.3);" title="عرض التفاصيل">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button onclick="Violations.showViolationForm('${violation.id}')" style="width: 36px; height: 36px; border-radius: 8px; border: none; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(139,92,246,0.3);" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="Violations.exportPDF('${violation.id}')" style="width: 36px; height: 36px; border-radius: 8px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(16,185,129,0.3);" title="تصدير PDF">
                                                <i class="fas fa-file-pdf"></i>
                                            </button>
                                            <button onclick="Violations.deleteViolation('${violation.id}')" style="width: 36px; height: 36px; border-radius: 8px; border: none; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(239,68,68,0.3);" title="حذف">
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
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('خطأ في renderViolationsList:', error);
            }
            return `<div class="empty-state"><p class="text-gray-500">حدث خطأ في عرض البيانات</p></div>`;
        }
    },

    renderAllViolationsStats() {
        const violations = this.getFilteredViolations();
        const total = violations.length;
        const employeeCount = violations.filter(v => v && (v.personType === 'employee' || (!!v.employeeName && !v.contractorName))).length;
        const contractorCount = violations.filter(v => v && (v.personType === 'contractor' || !!v.contractorName)).length;
        const totalFineAmount = violations.reduce((sum, violation) => {
            const amount = Number(violation?.fineAmount || 0);
            return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
        }, 0);

        return `
            <div id="violations-stats-cards" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <div class="stat-card" style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border: 1px solid #fca5a5;">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="stat-label">إجمالي المخالفات</p>
                            <p class="text-2xl font-bold text-red-700">${total}</p>
                        </div>
                        <i class="fas fa-list text-red-600 text-xl"></i>
                    </div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border: 1px solid #86efac;">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="stat-label">إجمالي القيمة المالية</p>
                            <p class="text-2xl font-bold text-green-700">${totalFineAmount.toLocaleString('ar-EG')} ج.م</p>
                        </div>
                        <i class="fas fa-money-bill-wave text-green-600 text-xl"></i>
                    </div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border: 1px solid #93c5fd;">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="stat-label">مخالفات الموظفين</p>
                            <p class="text-2xl font-bold text-blue-700">${employeeCount}</p>
                        </div>
                        <i class="fas fa-user-tie text-blue-600 text-xl"></i>
                    </div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%); border: 1px solid #fdba74;">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="stat-label">مخالفات المقاولين</p>
                            <p class="text-2xl font-bold text-orange-700">${contractorCount}</p>
                        </div>
                        <i class="fas fa-users-cog text-orange-600 text-xl"></i>
                    </div>
                </div>
            </div>
        `;
    },

    hasActiveFilters() {
        const filters = this.currentFilters || {};
        return !!(filters.personType || filters.violationType || filters.severity || filters.status);
    },

    getFilteredViolations() {
        try {
            if (typeof AppState === 'undefined' || !AppState.appData) {
                return [];
            }
            const violations = (AppState.appData.violations || [])
                .map((item) => this.normalizeViolationRecord(item))
                .filter(Boolean);
            const filters = this.currentFilters || {};

            const personFilter = filters.personType || '';
            const typeFilter = (filters.violationType || '').toLowerCase();
            const severityFilter = filters.severity || '';
            const statusFilter = filters.status || '';

            return violations.filter(violation => {
                if (!violation) return false;

                if (personFilter === 'employee' && !violation.employeeName) return false;
                if (personFilter === 'contractor' && !violation.contractorName) return false;

                if (typeFilter) {
                    const violationType = (violation.violationType || '').trim().toLowerCase();
                    if (violationType !== typeFilter) return false;
                }

                if (severityFilter && (violation.severity || '') !== severityFilter) return false;
                if (statusFilter && (violation.status || '') !== statusFilter) return false;

                return true;
            });
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('خطأ في getFilteredViolations:', error);
            }
            return [];
        }
    },

    renderFilters(defaultPersonType = '') {
        const filters = this.currentFilters || {};
        if (defaultPersonType) {
            filters.personType = defaultPersonType;
        }

        // التحقق من وجود ViolationTypesManager
        let types = [];
        if (typeof ViolationTypesManager !== 'undefined' && ViolationTypesManager.ensureInitialized && ViolationTypesManager.getAll) {
            try {
                ViolationTypesManager.ensureInitialized();
                types = ViolationTypesManager.getAll();
            } catch (vtError) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في الحصول على أنواع المخالفات:', vtError);
                }
                types = [];
            }
        } else {
            // استخدام القيم الافتراضية
            types = (typeof AppState !== 'undefined' && AppState?.appData?.violationTypes) ? AppState.appData.violationTypes : [];
        }

        const typeOptions = types.map(type => `
            <option value="${Utils.escapeHTML(type.name)}" ${filters.violationType === type.name ? 'selected' : ''}>
                ${Utils.escapeHTML(type.name)}
            </option>
        `).join('');

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">نوع الشخص</label>
                    <select id="violations-filter-person" class="form-input">
                        <option value="" ${filters.personType === '' ? 'selected' : ''}>جميع الأشخاص</option>
                        <option value="employee" ${filters.personType === 'employee' ? 'selected' : ''}>الموظفون</option>
                        <option value="contractor" ${filters.personType === 'contractor' ? 'selected' : ''}>المقاولون</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">نوع المخالفة</label>
                    <select id="violations-filter-type" class="form-input">
                        <option value="" ${filters.violationType === '' ? 'selected' : ''}>جميع الأنواع</option>
                        ${typeOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">الشدة</label>
                    <select id="violations-filter-severity" class="form-input">
                        <option value="" ${filters.severity === '' ? 'selected' : ''}>جميع الدرجات</option>
                        <option value="عالية" ${filters.severity === 'عالية' ? 'selected' : ''}>عالية</option>
                        <option value="متوسطة" ${filters.severity === 'متوسطة' ? 'selected' : ''}>متوسطة</option>
                        <option value="منخضة" ${filters.severity === 'منخضة' ? 'selected' : ''}>منخضة</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                    <select id="violations-filter-status" class="form-input">
                        <option value="" ${filters.status === '' ? 'selected' : ''}>جميع الحالات</option>
                        <option value="قيد المراجعة" ${filters.status === 'قيد المراجعة' ? 'selected' : ''}>قيد المراجعة</option>
                        <option value="محلول" ${filters.status === 'محلول' ? 'selected' : ''}>محلول</option>
                        <option value="غير محلول" ${filters.status === 'غير محلول' ? 'selected' : ''}>غير محلول</option>
                    </select>
                </div>
                <div class="md:col-span-2 lg:col-span-4 flex items-end">
                    <button type="button" id="violations-filter-reset" class="btn-secondary">
                        <i class="fas fa-undo ml-2"></i>إعادة تعيين التصفية
                    </button>
                </div>
            </div>
        `;
    },

    bindFilters() {
        const personSelect = document.getElementById('violations-filter-person');
        const typeSelect = document.getElementById('violations-filter-type');
        const severitySelect = document.getElementById('violations-filter-severity');
        const statusSelect = document.getElementById('violations-filter-status');
        const resetBtn = document.getElementById('violations-filter-reset');

        if (personSelect) {
            personSelect.value = this.currentFilters.personType || '';
            personSelect.onchange = () => {
                this.currentFilters.personType = personSelect.value;
                this.refreshViolationsView();
            };
        }

        if (typeSelect) {
            typeSelect.value = this.currentFilters.violationType || '';
            typeSelect.onchange = () => {
                this.currentFilters.violationType = typeSelect.value;
                this.refreshViolationsView();
            };
        }

        if (severitySelect) {
            severitySelect.value = this.currentFilters.severity || '';
            severitySelect.onchange = () => {
                this.currentFilters.severity = severitySelect.value;
                this.refreshViolationsView();
            };
        }

        if (statusSelect) {
            statusSelect.value = this.currentFilters.status || '';
            statusSelect.onchange = () => {
                this.currentFilters.status = statusSelect.value;
                this.refreshViolationsView();
            };
        }

        if (resetBtn) {
            resetBtn.onclick = () => {
                this.currentFilters = {
                    personType: '',
                    violationType: '',
                    severity: '',
                    status: ''
                };
                this.refreshViolationsView();
            };
        }
    },

    refreshViolationsView() {
        const listContainer = document.getElementById('violations-list');
        if (listContainer) {
            // Check which tab is active
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'all';
            switch (activeTab) {
                case 'employees':
                    listContainer.innerHTML = this.renderEmployeeViolationsList();
                    break;
                case 'contractors':
                    listContainer.innerHTML = this.renderContractorViolationsList();
                    break;
                case 'analytics':
                    // Analytics tab doesn't need refresh
                    return;
                default:
                    listContainer.innerHTML = this.renderViolationsList();
            }
        }
        const statsContainer = document.getElementById('violations-stats-cards');
        if (statsContainer) {
            statsContainer.outerHTML = this.renderAllViolationsStats();
        }
        const filtersContainer = document.getElementById('violations-filters-container');
        if (filtersContainer) {
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'all';
            const defaultPersonType = activeTab === 'employees' ? 'employee' : activeTab === 'contractors' ? 'contractor' : '';
            filtersContainer.innerHTML = this.renderFilters(defaultPersonType);
        }
        this.bindFilters();
    },

    setupEventListeners() {
        setTimeout(() => {
            const addBtn = document.getElementById('add-violation-btn');
            if (addBtn) addBtn.addEventListener('click', () => this.showViolationForm());
            this.bindFilters();
        }, 100);
    },

    async switchTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
            // التأكد من الحفاظ على styles لمنع التكسير
            if (!btn.style.flexShrink) {
                btn.style.setProperty('flex-shrink', '0', 'important');
                btn.style.setProperty('min-width', 'fit-content', 'important');
                btn.style.setProperty('white-space', 'nowrap', 'important');
                btn.style.setProperty('width', 'auto', 'important');
                btn.style.setProperty('max-width', 'none', 'important');
            }
        });
        
        // التأكد من الحفاظ على styles للـ container
        const tabContainer = document.querySelector('.tabs-nav');
        if (tabContainer && !tabContainer.style.flexWrap) {
            tabContainer.style.setProperty('flex-wrap', 'nowrap', 'important');
            tabContainer.style.setProperty('overflow-x', 'auto', 'important');
            tabContainer.style.setProperty('overflow-y', 'visible', 'important');
        }

        // Update content
        const contentContainer = document.getElementById('violations-tab-content');
        if (!contentContainer) return;

        switch (tabName) {
            case 'all':
                contentContainer.innerHTML = `
                    <div class="content-card" id="violations-list-tab">
                        <div class="card-header">
                            <h2 class="card-title"><i class="fas fa-list ml-2"></i>قائمة المخالفات</h2>
                        </div>
                        <div class="card-body">
                            ${this.renderAllViolationsStats()}
                            <div id="violations-filters-container" class="mb-4">
                                ${this.renderFilters()}
                            </div>
                            <div id="violations-list">
                                ${this.renderViolationsList()}
                            </div>
                        </div>
                    </div>
                `;
                this.bindFilters();
                break;
            case 'employees':
                contentContainer.innerHTML = `
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title"><i class="fas fa-user-tie ml-2"></i>مخالفات الموظفين</h2>
                        </div>
                        <div class="card-body">
                            <div id="violations-filters-container" class="mb-4">
                                ${this.renderFilters('employee')}
                            </div>
                            <div id="violations-list">
                                ${this.renderEmployeeViolationsList()}
                            </div>
                        </div>
                    </div>
                `;
                this.bindFilters();
                break;
            case 'contractors':
                contentContainer.innerHTML = `
                    <div class="content-card">
                        <div class="card-header">
                            <h2 class="card-title"><i class="fas fa-users-cog ml-2"></i>مخالفات المقاولين</h2>
                        </div>
                        <div class="card-body">
                            <div id="violations-filters-container" class="mb-4">
                                ${this.renderFilters('contractor')}
                            </div>
                            <div class="mb-4 flex items-center justify-end">
                                <button type="button" class="btn-primary" onclick="Violations.showContractorViolationsReportDialog()">
                                    <i class="fas fa-file-pdf ml-2"></i>تصدير تقرير مخالفة المقاولين
                                </button>
                            </div>
                            <div id="violations-list">
                                ${this.renderContractorViolationsList()}
                            </div>
                        </div>
                    </div>
                `;
                this.bindFilters();
                break;
            case 'analytics':
                contentContainer.innerHTML = this.renderAnalyticsTab();
                break;
            case 'blacklist':
                // عرض الواجهة مباشرة مع البيانات المحلية (إن وجدت)
                contentContainer.innerHTML = this.renderBlacklistTab();
                this.setupBlacklistEventListeners();
                // تحميل البيانات من Google Sheets في الخلفية وتحديث الواجهة
                this.loadBlacklistDataAsync().then(() => {
                    // تحديث الواجهة بعد تحميل البيانات
                    this.refreshBlacklistDisplay();
                }).catch(error => {
                    Utils.safeWarn('⚠️ خطأ في تحميل بيانات Blacklist:', error);
                });
                break;
        }
    },

    /**
     * Wrapper function للتعامل مع async في onclick
     */
    async switchTabAsync(tabName) {
        try {
            await this.switchTab(tabName);
        } catch (error) {
            Utils.safeError('خطأ في التبديل إلى التبويب:', error);
        }
    },

    /**
     * تحديث المديول (إعادة تحميل البيانات مع الحفاظ على التبويب الحالي)
     */
    refreshModule() {
        const btn = document.getElementById('violations-btn-refresh');
        if (btn) {
            btn.disabled = true;
            const icon = btn.querySelector('i.fa-sync-alt');
            if (icon) icon.classList.add('fa-spin');
        }
        const loadPromise = typeof this.load === 'function' ? this.load() : Promise.resolve();
        Promise.resolve(loadPromise).finally(() => {
            const refBtn = document.getElementById('violations-btn-refresh');
            if (refBtn) {
                refBtn.disabled = false;
                const refIcon = refBtn.querySelector('i.fa-sync-alt');
                if (refIcon) refIcon.classList.remove('fa-spin');
            }
        });
    },

    renderEmployeeViolationsList() {
        const violations = this.getFilteredViolations().filter(v =>
            v.employeeName || v.personType === 'employee' || (!v.contractorName && v.employeeName)
        );
        if (violations.length === 0) {
            return `<div class="empty-state"><p class="text-gray-500">لا توجد مخالفات للموظفين</p></div>`;
        }
        return `
            <div class="table-responsive" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">اسم الموظف</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الكود الوظيفي</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">نوع المخالفة</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">التاريخ</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الشدة</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الإجراء المتخذ</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الحالة</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${violations.map(violation => `
                        <tr>
                            <td>${Utils.escapeHTML(violation.employeeName || '')}</td>
                            <td>${Utils.escapeHTML(violation.employeeCode || violation.employeeNumber || '-')}</td>
                            <td>${Utils.escapeHTML(violation.violationType || '')}</td>
                            <td>${violation.violationDate ? Utils.formatDate(violation.violationDate) : '-'}</td>
                            <td>
                                <span class="badge badge-${violation.severity === 'عالية' ? 'danger' : violation.severity === 'متوسطة' ? 'warning' : 'info'}">
                                    ${violation.severity || '-'}
                                </span>
                            </td>
                            <td>${Utils.escapeHTML(violation.actionTaken || '')}</td>
                            <td>
                                <span class="badge badge-${violation.status === 'محلول' ? 'success' : 'warning'}">
                                    ${violation.status || '-'}
                                </span>
                            </td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <button onclick="Violations.viewViolation('${violation.id}')" class="btn-icon btn-icon-primary" title="عرض">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="Violations.showViolationForm(${JSON.stringify(violation).replace(/"/g, '&quot;')})" class="btn-icon btn-icon-warning" title="تعديل">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="Violations.deleteViolation('${violation.id}')" class="btn-icon btn-icon-danger" title="حذف">
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
    },

    renderContractorViolationsList() {
        const violations = this.getFilteredViolations().filter(v =>
            v.contractorName || v.personType === 'contractor'
        );
        if (violations.length === 0) {
            return `<div class="empty-state"><p class="text-gray-500">لا توجد مخالفات للمقاولين</p></div>`;
        }
        return `
            <div class="table-responsive" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">اسم المقاول</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">نوع المخالفة</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">التاريخ</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الشدة</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الإجراء المتخذ</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الحالة</th>
                        <th style="color: white; font-weight: 600; padding: 16px 12px; text-align: center; font-size: 0.9rem;">الإجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${violations.map(violation => `
                        <tr>
                            <td>${Utils.escapeHTML(violation.contractorName || '')}</td>
                            <td>${Utils.escapeHTML(violation.violationType || '')}</td>
                            <td>${violation.violationDate ? Utils.formatDate(violation.violationDate) : '-'}</td>
                            <td>
                                <span class="badge badge-${violation.severity === 'عالية' ? 'danger' : violation.severity === 'متوسطة' ? 'warning' : 'info'}">
                                    ${violation.severity || '-'}
                                </span>
                            </td>
                            <td>${Utils.escapeHTML(violation.actionTaken || '')}</td>
                            <td>
                                <span class="badge badge-${violation.status === 'محلول' ? 'success' : 'warning'}">
                                    ${violation.status || '-'}
                                </span>
                            </td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <button onclick="Violations.viewViolation('${violation.id}')" class="btn-icon btn-icon-primary" title="عرض">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="Violations.showViolationForm(${JSON.stringify(violation).replace(/"/g, '&quot;')})" class="btn-icon btn-icon-warning" title="تعديل">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="Violations.deleteViolation('${violation.id}')" class="btn-icon btn-icon-danger" title="حذف">
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
    },

    getContractorViolationsExportOptions() {
        const optionsMap = new Map();
        const addOption = (id, name) => {
            const cleanName = String(name || '').replace(/\s+/g, ' ').trim();
            if (!cleanName) return;
            const key = String(id || cleanName).trim();
            if (!optionsMap.has(key)) {
                optionsMap.set(key, { id: key, name: cleanName });
            }
        };

        const appViolations = Array.isArray(AppState.appData?.violations) ? AppState.appData.violations : [];
        appViolations.forEach(v => {
            if (v?.contractorName) addOption(v.contractorId || v.contractorName, v.contractorName);
        });

        const approved = Array.isArray(AppState.appData?.approvedContractors) ? AppState.appData.approvedContractors : [];
        approved.forEach(c => addOption(c?.contractorId || c?.id || c?.code, c?.companyName || c?.name || c?.contractorName));

        const contractors = Array.isArray(AppState.appData?.contractors) ? AppState.appData.contractors : [];
        contractors.forEach(c => addOption(c?.id || c?.contractorId || c?.code, c?.name || c?.companyName || c?.contractorName));

        return Array.from(optionsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
    },

    showContractorViolationsReportDialog() {
        const contractors = this.getContractorViolationsExportOptions();
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const months = [];
        for (let i = 0; i < 24; i++) {
            const date = new Date(currentYear, currentDate.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
            months.push({ value: monthKey, label: monthLabel });
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-file-pdf ml-2"></i>
                        تصدير تقرير مخالفات المقاولين
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-building ml-2"></i>
                            اختر المقاول
                        </label>
                        <select id="contractor-violations-report-select" class="form-input">
                            <option value="">جميع المقاولين</option>
                            ${contractors.map(contractor => `
                                <option value="${Utils.escapeHTML(String(contractor.id ?? '').trim())}">
                                    ${Utils.escapeHTML(contractor.name || 'بدون اسم')}
                                </option>
                            `).join('')}
                        </select>
                        <p class="text-xs text-gray-500 mt-2">
                            <i class="fas fa-info-circle ml-1"></i>
                            اختر مقاولاً محدداً لعرض تقريره فقط، أو اتركه فارغاً لعرض جميع المقاولين
                        </p>
                    </div>

                    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 16px;">
                        <label class="block text-sm font-semibold text-gray-700 mb-3">
                            <i class="fas fa-calendar-alt ml-2"></i>
                            فترة التصدير
                        </label>
                        <div class="space-y-3">
                            <div class="flex items-center">
                                <input type="radio" id="contractor-violations-range-all" name="contractor-violations-range-type" value="all" class="ml-2" checked>
                                <label for="contractor-violations-range-all" class="text-sm text-gray-700 cursor-pointer">جميع السجلات</label>
                            </div>
                            <div class="flex items-center">
                                <input type="radio" id="contractor-violations-range-month" name="contractor-violations-range-type" value="month" class="ml-2">
                                <label for="contractor-violations-range-month" class="text-sm text-gray-700 cursor-pointer mr-2">شهر محدد</label>
                                <select id="contractor-violations-report-month" class="form-input flex-1" disabled style="max-width: 300px;">
                                    <option value="">اختر الشهر</option>
                                    ${months.map(month => `<option value="${month.value}">${month.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="flex items-center">
                                <input type="radio" id="contractor-violations-range-custom" name="contractor-violations-range-type" value="custom" class="ml-2">
                                <label for="contractor-violations-range-custom" class="text-sm text-gray-700 cursor-pointer mr-2">فترة محددة</label>
                                <div class="flex items-center gap-2 flex-1" style="max-width: 400px;">
                                    <input type="date" id="contractor-violations-report-from-date" class="form-input flex-1" disabled>
                                    <span class="text-sm text-gray-600">إلى</span>
                                    <input type="date" id="contractor-violations-report-to-date" class="form-input flex-1" disabled>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                    <button type="button" class="btn-primary" id="generate-contractor-violations-report-btn">
                        <i class="fas fa-file-export ml-2"></i>
                        إنشاء التقرير
                    </button>
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

        const rangeInputs = modal.querySelectorAll('input[name="contractor-violations-range-type"]');
        const monthSelect = modal.querySelector('#contractor-violations-report-month');
        const fromDateInput = modal.querySelector('#contractor-violations-report-from-date');
        const toDateInput = modal.querySelector('#contractor-violations-report-to-date');

        const updateDateFields = () => {
            const selectedType = modal.querySelector('input[name="contractor-violations-range-type"]:checked')?.value || 'all';
            monthSelect.disabled = selectedType !== 'month';
            monthSelect.required = selectedType === 'month';
            fromDateInput.disabled = selectedType !== 'custom';
            fromDateInput.required = selectedType === 'custom';
            toDateInput.disabled = selectedType !== 'custom';
            toDateInput.required = selectedType === 'custom';
        };
        rangeInputs.forEach(input => input.addEventListener('change', updateDateFields));

        modal.querySelector('#generate-contractor-violations-report-btn')?.addEventListener('click', async () => {
            const contractorSelect = modal.querySelector('#contractor-violations-report-select');
            const selectedContractorId = contractorSelect?.value ? String(contractorSelect.value).trim() : '';
            const selectedContractorName = selectedContractorId
                ? String(contractorSelect?.options?.[contractorSelect.selectedIndex]?.textContent || '').replace(/\s+/g, ' ').trim()
                : '';
            const dateRangeType = modal.querySelector('input[name="contractor-violations-range-type"]:checked')?.value || 'all';
            const month = modal.querySelector('#contractor-violations-report-month')?.value || '';
            const fromDate = modal.querySelector('#contractor-violations-report-from-date')?.value || '';
            const toDate = modal.querySelector('#contractor-violations-report-to-date')?.value || '';

            if (dateRangeType === 'month' && !month) {
                Notification.warning('يرجى اختيار الشهر المطلوب');
                return;
            }
            if (dateRangeType === 'custom') {
                if (!fromDate || !toDate) {
                    Notification.warning('يرجى اختيار تاريخ البداية والنهاية للفترة');
                    return;
                }
                if (new Date(fromDate) > new Date(toDate)) {
                    Notification.warning('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
                    return;
                }
            }

            close();
            await this.generateContractorViolationsReport(selectedContractorId, {
                dateRangeType,
                month,
                fromDate,
                toDate
            }, selectedContractorName);
        });
    },

    async generateContractorViolationsReport(contractorId = '', dateFilter = {}, selectedContractorName = '') {
        const normalizedContractorId = String(contractorId || '').trim();
        const normalizedName = String(selectedContractorName || '').replace(/\s+/g, ' ').trim().toLowerCase();
        let violations = (AppState.appData.violations || []).filter(v => v.contractorName || v.personType === 'contractor');

        if (normalizedContractorId || normalizedName) {
            violations = violations.filter(v => {
                const recordId = String(v.contractorId || '').trim();
                const recordName = String(v.contractorName || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (normalizedContractorId && recordId && normalizedContractorId === recordId) return true;
                if (normalizedName && recordName && (recordName === normalizedName || recordName.includes(normalizedName) || normalizedName.includes(recordName))) return true;
                return false;
            });
        }

        const { dateRangeType = 'all', month = '', fromDate = '', toDate = '' } = dateFilter || {};
        if (dateRangeType === 'month' && month) {
            const [year, monthNum] = month.split('-');
            violations = violations.filter(v => {
                if (!v.violationDate) return false;
                const d = new Date(v.violationDate);
                return d.getFullYear() === parseInt(year, 10) && (d.getMonth() + 1) === parseInt(monthNum, 10);
            });
        } else if (dateRangeType === 'custom' && fromDate && toDate) {
            const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
            const end = new Date(toDate); end.setHours(23, 59, 59, 999);
            violations = violations.filter(v => {
                if (!v.violationDate) return false;
                const d = new Date(v.violationDate);
                return d >= start && d <= end;
            });
        }

        if (!violations.length) {
            Notification.warning('لا توجد بيانات لمخالفات المقاولين وفق المحددات المختارة');
            return;
        }

        try {
            Loading.show('جاري إنشاء تقرير مخالفات المقاولين...');

            const highCount = violations.filter(v => String(v.severity || '').trim() === 'عالية').length;
            const mediumCount = violations.filter(v => String(v.severity || '').trim() === 'متوسطة').length;
            const lowCount = violations.filter(v => String(v.severity || '').trim() === 'منخضة').length;
            const resolvedCount = violations.filter(v => String(v.status || '').trim() === 'محلول').length;
            const unresolvedCount = Math.max(0, violations.length - resolvedCount);
            const resolutionRate = violations.length > 0 ? Math.round((resolvedCount / violations.length) * 100) : 0;
            const uniqueContractors = new Set(violations.map(v => String(v.contractorName || '').trim()).filter(Boolean)).size;

            let periodInfo = '';
            if (dateRangeType === 'month' && month) {
                const [y, m] = month.split('-');
                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                periodInfo = d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
            } else if (dateRangeType === 'custom' && fromDate && toDate) {
                periodInfo = `من ${Utils.formatDate(fromDate)} إلى ${Utils.formatDate(toDate)}`;
            }

            const rowsHtml = violations.map((v, index) => `
                <tr>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${index + 1}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(v.contractorName || '-')}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(v.violationType || '-')}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${v.violationDate ? Utils.formatDate(v.violationDate) : '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${Utils.escapeHTML(v.severity || '-')}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(v.actionTaken || '-')}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${Utils.escapeHTML(v.status || '-')}</td>
                </tr>
            `).join('');

            const headingName = selectedContractorName ? ` - ${Utils.escapeHTML(selectedContractorName)}` : '';
            const content = `
                <div style="margin-bottom: 24px;">
                    <h2 style="font-size: 20px; margin-bottom: 12px; color: #991B1B; font-weight: 700;">تقرير مخالفات المقاولين${headingName}</h2>
                    ${periodInfo ? `<div style="margin-bottom: 16px; padding: 12px; background: #FFF7ED; border-right: 4px solid #F59E0B; border-radius: 8px;"><strong style="color: #D97706;">الفترة:</strong> <span style="color: #1F2937;">${Utils.escapeHTML(periodInfo)}</span></div>` : ''}
                    <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                        <div style="flex: 1 1 180px; padding: 14px; border-radius: 10px; background: #FEF2F2; border: 1px solid #FECACA;"><div style="font-size: 12px; color: #B91C1C; margin-bottom: 6px; font-weight: 600;">إجمالي المخالفات</div><div style="font-size: 24px; font-weight: 700; color: #991B1B;">${violations.length}</div></div>
                        <div style="flex: 1 1 180px; padding: 14px; border-radius: 10px; background: #EFF6FF; border: 1px solid #BFDBFE;"><div style="font-size: 12px; color: #1D4ED8; margin-bottom: 6px; font-weight: 600;">عدد المقاولين</div><div style="font-size: 24px; font-weight: 700; color: #1E3A8A;">${uniqueContractors}</div></div>
                        <div style="flex: 1 1 180px; padding: 14px; border-radius: 10px; background: #FFF7ED; border: 1px solid #FED7AA;"><div style="font-size: 12px; color: #C2410C; margin-bottom: 6px; font-weight: 600;">عالية / متوسطة / منخفضة</div><div style="font-size: 20px; font-weight: 700; color: #9A3412;">${highCount} / ${mediumCount} / ${lowCount}</div></div>
                        <div style="flex: 1 1 180px; padding: 14px; border-radius: 10px; background: #ECFDF5; border: 1px solid #BBF7D0;"><div style="font-size: 12px; color: #047857; margin-bottom: 6px; font-weight: 600;">معدل الحل</div><div style="font-size: 24px; font-weight: 700; color: #065F46;">${resolutionRate}%</div><div style="font-size: 11px; color: #065F46; margin-top: 4px;">محلول: ${resolvedCount} | غير محلول: ${unresolvedCount}</div></div>
                    </div>
                </div>
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 18px; margin-bottom: 12px; color: #991B1B; font-weight: 700; border-bottom: 2px solid #DC2626; padding-bottom: 8px;">جدول المخالفات</h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; direction: rtl;">
                        <thead>
                            <tr style="background: #B91C1C; color: #FFFFFF;">
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">#</th>
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">اسم المقاول</th>
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">نوع المخالفة</th>
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">التاريخ</th>
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">الشدة</th>
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">الإجراء المتخذ</th>
                                <th style="padding: 12px 8px; border: 1px solid #991B1B; text-align: center; font-weight: 700;">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            `;

            const formCode = `CONTRACTOR-VIOL-${new Date().toISOString().slice(0, 10)}`;
            const reportTitle = selectedContractorName ? `تقرير مخالفات المقاول: ${selectedContractorName}` : 'تقرير مخالفات المقاولين';
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(formCode, reportTitle, content, false, true, { source: 'ContractorViolationsTab', contractorId: contractorId || '', contractorName: selectedContractorName || '' }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${reportTitle}</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const reportWindow = window.open(url, '_blank');
            if (reportWindow) {
                reportWindow.onload = () => {
                    try {
                        reportWindow.print();
                    } finally {
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        Loading.hide();
                    }
                };
            } else {
                URL.revokeObjectURL(url);
                Loading.hide();
                Notification.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
                return;
            }

            Notification.success('تم إنشاء تقرير مخالفات المقاولين بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في إنشاء تقرير مخالفات المقاولين:', error);
            Notification.error('تعذر إنشاء تقرير مخالفات المقاولين: ' + (error.message || 'خطأ غير معروف'));
        }
    },

    async deleteViolation(id) {
        if (!id) {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('معرف المخالفة غير موجود', 'error');
            }
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذه المخالفة؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        if (typeof Loading !== 'undefined' && Loading.show) {
            Loading.show('جاري حذف المخالفة...');
        }

        try {
            // 1. الحصول على بيانات المخالفة قبل الحذف للتنظيف
            const violation = (AppState.appData?.violations || []).find(v => v.id === id);
            const contractorId = violation?.contractorId || '';
            const contractorName = violation?.contractorName || '';
            const employeeId = violation?.employeeId || '';
            const employeeCode = violation?.employeeCode || violation?.employeeNumber || '';
            const employeeName = violation?.employeeName || '';

            // 2. حذف من قاعدة البيانات (Backend)
            let result;
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.callBackend) {
                result = await GoogleIntegration.callBackend('deleteViolationFromSheet', { id: id });
            } else {
                throw new Error('خدمة الاتصال بالخلفية غير متوفرة');
            }

            if (result && result.success) {
                // 3. تحديث البيانات المحلية
                if (AppState.appData && AppState.appData.violations) {
                    AppState.appData.violations = AppState.appData.violations.filter(v => v.id !== id);
                }

                // 4. تنظيف أي مراجع في بيانات المقاولين (إذا كانت موجودة)
                if (contractorId || contractorName) {
                    const contractors = AppState.appData?.contractors || [];
                    contractors.forEach(contractor => {
                        if (contractor && (
                            contractor.id === contractorId || 
                            contractor.name === contractorName ||
                            contractor.contractorName === contractorName
                        )) {
                            // إذا كان المقاول يحتوي على مصفوفة violations، نزيل المخالفة منها
                            if (Array.isArray(contractor.violations)) {
                                contractor.violations = contractor.violations.filter(v => v.id !== id);
                            }
                            // تنظيف أي مراجع أخرى
                            if (contractor.violationIds && Array.isArray(contractor.violationIds)) {
                                contractor.violationIds = contractor.violationIds.filter(vId => vId !== id);
                            }
                        }
                    });
                }

                // 5. تنظيف أي مراجع في بيانات الموظفين (إذا كانت موجودة)
                if (employeeId || employeeCode || employeeName) {
                    const employees = AppState.appData?.employees || [];
                    employees.forEach(employee => {
                        if (employee && (
                            employee.id === employeeId ||
                            employee.employeeNumber === employeeCode ||
                            employee.employeeCode === employeeCode ||
                            employee.name === employeeName
                        )) {
                            // إذا كان الموظف يحتوي على مصفوفة violations، نزيل المخالفة منها
                            if (Array.isArray(employee.violations)) {
                                employee.violations = employee.violations.filter(v => v.id !== id);
                            }
                            // تنظيف أي مراجع أخرى
                            if (employee.violationIds && Array.isArray(employee.violationIds)) {
                                employee.violationIds = employee.violationIds.filter(vId => vId !== id);
                            }
                        }
                    });
                }

                // 6. حفظ البيانات المحلية
                if (typeof DataManager !== 'undefined' && DataManager.save) {
                    DataManager.save();
                }

                // 7. تحديث جميع العروض
                this.refreshViolationsView();

                // 8. تحديث عروض المقاولين والموظفين إذا كانت مفتوحة
                if (typeof Contractors !== 'undefined' && Contractors.load) {
                    try {
                        const currentSection = AppState?.currentSection || '';
                        // ✅ CRITICAL: منع استدعاء load إذا كان قيد التنفيذ
                        if (currentSection === 'contractors' && !Contractors._isLoading) {
                            Contractors.load();
                        }
                    } catch (e) {
                        console.warn('Could not refresh contractors view:', e);
                    }
                }

                if (typeof Employees !== 'undefined' && Employees.loadEmployeesList) {
                    try {
                        const currentSection = AppState?.currentSection || '';
                        if (currentSection === 'employees') {
                            Employees.loadEmployeesList();
                        }
                    } catch (e) {
                        console.warn('Could not refresh employees view:', e);
                    }
                }

                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('تم حذف المخالفة بنجاح من قاعدة البيانات وجميع السجلات المرتبطة', 'success');
                }
            } else {
                throw new Error(result?.message || 'فشل حذف المخالفة من قاعدة البيانات');
            }
        } catch (error) {
            console.error('Error deleting violation:', error);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('حدث خطأ أثناء حذف المخالفة: ' + error.message, 'error');
            } else {
                alert('حدث خطأ أثناء حذف المخالفة: ' + error.message);
            }
        } finally {
            if (typeof Loading !== 'undefined' && Loading.hide) {
                Loading.hide();
            }
        }
    },

    renderAnalyticsTab() {
        const violations = AppState.appData.violations || [];
        const employeeViolations = violations.filter(v => v.employeeName || v.personType === 'employee' || (!v.contractorName && v.employeeName));
        const contractorViolations = violations.filter(v => v.contractorName || v.personType === 'contractor');

        // إحصائيات عامة
        const totalViolations = violations.length;
        const highSeverity = violations.filter(v => v.severity === 'عالية').length;
        const mediumSeverity = violations.filter(v => v.severity === 'متوسطة').length;
        const lowSeverity = violations.filter(v => v.severity === 'منخضة').length;
        const resolved = violations.filter(v => v.status === 'محلول').length;
        const pending = violations.filter(v => v.status === 'قيد المراجعة').length;
        const unresolved = violations.filter(v => v.status === 'غير محلول').length;

        // إحصائيات حسب النوع
        const violationsByType = {};
        violations.forEach(v => {
            const type = v.violationType || 'غير محدد';
            violationsByType[type] = (violationsByType[type] || 0) + 1;
        });

        // إحصائيات حسب الشهر
        const violationsByMonth = {};
        violations.forEach(v => {
            if (v.violationDate) {
                const date = new Date(v.violationDate);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                violationsByMonth[monthKey] = (violationsByMonth[monthKey] || 0) + 1;
            }
        });

        // أكثر الموظفين مخالفة
        const employeeViolationsCount = {};
        employeeViolations.forEach(v => {
            const name = v.employeeName || 'غير معروف';
            employeeViolationsCount[name] = (employeeViolationsCount[name] || 0) + 1;
        });
        const topEmployees = Object.entries(employeeViolationsCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        // أكثر المقاولين مخالفة
        const contractorViolationsCount = {};
        contractorViolations.forEach(v => {
            const name = v.contractorName || 'غير معروف';
            contractorViolationsCount[name] = (contractorViolationsCount[name] || 0) + 1;
        });
        const topContractors = Object.entries(contractorViolationsCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-chart-bar ml-2"></i>تحليل بيانات المخالفات</h2>
                </div>
                <div class="card-body">
                    <!-- ملخص إحصائي -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div class="stat-card">
                            <div class="stat-icon bg-blue-100 text-blue-600">
                                <i class="fas fa-exclamation-circle"></i>
                            </div>
                            <div class="stat-content">
                                <h3 class="stat-value">${typeof totalViolations === 'number' ? totalViolations.toLocaleString('en-US') : totalViolations}</h3>
                                <p class="stat-label">إجمالي المخالفات</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon bg-red-100 text-red-600">
                                <i class="fas fa-user-tie"></i>
                            </div>
                            <div class="stat-content">
                                <h3 class="stat-value">${employeeViolations.length.toLocaleString('en-US')}</h3>
                                <p class="stat-label">مخالفات الموظفين</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon bg-orange-100 text-orange-600">
                                <i class="fas fa-users-cog"></i>
                            </div>
                            <div class="stat-content">
                                <h3 class="stat-value">${contractorViolations.length.toLocaleString('en-US')}</h3>
                                <p class="stat-label">مخالفات المقاولين</p>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon bg-green-100 text-green-600">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <h3 class="stat-value">${typeof resolved === 'number' ? resolved.toLocaleString('en-US') : resolved}</h3>
                                <p class="stat-label">مخالفات محلولة</p>
                            </div>
                        </div>
                    </div>

                    <!-- إحصائيات الشدة -->
                    <div class="content-card mb-6">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-chart-pie ml-2"></i>توزيع المخالفات حسب الشدة</h3>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="p-4 bg-red-50 rounded-lg">
                                    <div class="text-2xl font-bold text-red-600">${highSeverity}</div>
                                    <div class="text-sm text-gray-600">عالية</div>
                                    <div class="text-xs text-gray-500 mt-1">${totalViolations > 0 ? ((highSeverity / totalViolations) * 100).toFixed(1) : 0}%</div>
                                </div>
                                <div class="p-4 bg-yellow-50 rounded-lg">
                                    <div class="text-2xl font-bold text-yellow-600">${mediumSeverity}</div>
                                    <div class="text-sm text-gray-600">متوسطة</div>
                                    <div class="text-xs text-gray-500 mt-1">${totalViolations > 0 ? ((mediumSeverity / totalViolations) * 100).toFixed(1) : 0}%</div>
                                </div>
                                <div class="p-4 bg-blue-50 rounded-lg">
                                    <div class="text-2xl font-bold text-blue-600">${lowSeverity}</div>
                                    <div class="text-sm text-gray-600">منخفضة</div>
                                    <div class="text-xs text-gray-500 mt-1">${totalViolations > 0 ? ((lowSeverity / totalViolations) * 100).toFixed(1) : 0}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- إحصائيات الحالة -->
                    <div class="content-card mb-6">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-tasks ml-2"></i>توزيع المخالفات حسب الحالة</h3>
                        </div>
                        <div class="card-body">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="p-4 bg-green-50 rounded-lg">
                                    <div class="text-2xl font-bold text-green-600">${resolved}</div>
                                    <div class="text-sm text-gray-600">محلول</div>
                                    <div class="text-xs text-gray-500 mt-1">${totalViolations > 0 ? ((resolved / totalViolations) * 100).toFixed(1) : 0}%</div>
                                </div>
                                <div class="p-4 bg-yellow-50 rounded-lg">
                                    <div class="text-2xl font-bold text-yellow-600">${pending}</div>
                                    <div class="text-sm text-gray-600">قيد المراجعة</div>
                                    <div class="text-xs text-gray-500 mt-1">${totalViolations > 0 ? ((pending / totalViolations) * 100).toFixed(1) : 0}%</div>
                                </div>
                                <div class="p-4 bg-red-50 rounded-lg">
                                    <div class="text-2xl font-bold text-red-600">${unresolved}</div>
                                    <div class="text-sm text-gray-600">غير محلول</div>
                                    <div class="text-xs text-gray-500 mt-1">${totalViolations > 0 ? ((unresolved / totalViolations) * 100).toFixed(1) : 0}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- أكثر الموظفين مخالفة -->
                    ${topEmployees.length > 0 ? `
                    <div class="content-card mb-6">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-user-tie ml-2"></i>أكثر الموظفين مخالفة</h3>
                        </div>
                        <div class="card-body">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>الترتيب</th>
                                        <th>اسم الموظف</th>
                                        <th>عدد المخالفات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topEmployees.map(([name, count], index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${Utils.escapeHTML(name)}</td>
                                            <td><span class="badge badge-warning">${count}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}

                    <!-- أكثر المقاولين مخالفة -->
                    ${topContractors.length > 0 ? `
                    <div class="content-card mb-6">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-users-cog ml-2"></i>أكثر المقاولين مخالفة</h3>
                        </div>
                        <div class="card-body">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>الترتيب</th>
                                        <th>اسم المقاول</th>
                                        <th>عدد المخالفات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${topContractors.map(([name, count], index) => `
                                        <tr>
                                            <td>${index + 1}</td>
                                            <td>${Utils.escapeHTML(name)}</td>
                                            <td><span class="badge badge-warning">${count}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}

                    <!-- توزيع المخالفات حسب النوع -->
                    ${Object.keys(violationsByType).length > 0 ? `
                    <div class="content-card mb-6">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-list ml-2"></i>توزيع المخالفات حسب النوع</h3>
                        </div>
                        <div class="card-body">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>نوع المخالفة</th>
                                        <th>عدد المخالفات</th>
                                        <th>النسبة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(violationsByType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => `
                                        <tr>
                                            <td>${Utils.escapeHTML(type)}</td>
                                            <td><span class="badge badge-info">${count}</span></td>
                                            <td>${totalViolations > 0 ? ((count / totalViolations) * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}

                    <!-- توزيع المخالفات حسب الشهر -->
                    ${Object.keys(violationsByMonth).length > 0 ? `
                    <div class="content-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas fa-calendar ml-2"></i>توزيع المخالفات حسب الشهر</h3>
                        </div>
                        <div class="card-body">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>الشهر</th>
                                        <th>عدد المخالفات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(violationsByMonth)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([month, count]) => {
                        const [year, monthNum] = month.split('-');
                        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                        return `
                                        <tr>
                                            <td>${monthNames[parseInt(monthNum) - 1]} ${year}</td>
                                            <td><span class="badge badge-info">${count}</span></td>
                                        </tr>
                                    `;
                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}

                    ${totalViolations === 0 ? '<div class="empty-state"><p class="text-gray-500">لا توجد بيانات متاحة للتحليل</p></div>' : ''}
                </div>
            </div>
        `;
    },

    /**
     * تحميل قائمة المقاولين في select element
     * @param {HTMLElement} selectElement - عنصر select المراد تحميل المقاولين فيه
     * @param {string} selectedValue - القيمة المحددة مسبقاً (اسم المقاول)
     * @param {string} selectedContractorId - معرف المقاول المحدد مسبقاً
     */
    loadContractorsIntoSelect(selectElement, selectedValue = '', selectedContractorId = '') {
        if (!selectElement || selectElement.tagName !== 'SELECT') {
            Utils.safeWarn('⚠️ loadContractorsIntoSelect: عنصر select غير صالح');
            return;
        }

        // ✅ مصدر موحّد: استخدام Contractors مباشرة (بدون الاعتماد على Clinic)
        if (typeof Contractors !== 'undefined' && typeof Contractors.populateContractorSelect === 'function') {
            Contractors.populateContractorSelect(selectElement, {
                placeholder: '-- اختر المقاول --',
                selectedValue,
                selectedContractorId,
                valueMode: 'name', // نموذج المخالفة يحفظ الاسم + contractorId في dataset
                showServiceType: true,
                includeSuppliers: false,
                approvedOnly: false // ✅ إصلاح: تضمين جميع المقاولين (بما فيهم غير المعتمدين)
            });
            return;
        }

        // بديل محسّن: تحميل جميع المقاولين من AppState
        let contractors = [];

        // محاولة استخدام الدالة المساعدة الجديدة أولاً
        if (typeof Contractors !== 'undefined' && typeof Contractors.getAllContractorsForModules === 'function') {
            try {
                const allContractors = Contractors.getAllContractorsForModules();
                if (allContractors && allContractors.length > 0) {
                    const contractorMap = new Map(); // لإزالة التكرار
                    allContractors.forEach(contractor => {
                        const name = (contractor.name || '').trim();
                        if (!name || name === 'غير معروف') return;

                        // ✅ إصلاح: إزالة التكرار بشكل صحيح (code → id → name)
                        const code = ((contractor.code || contractor.isoCode || '') + '').trim().toUpperCase();
                        const lic = ((contractor.licenseNumber || '') + '').trim();
                        const key = (/^CON-\d+$/i.test(code) ? `CODE:${code}` : (lic ? `LIC:${lic}` : (contractor.id ? `ID:${contractor.id}` : `NAME:${name.toLowerCase()}`)));

                        if (!contractorMap.has(key)) {
                            contractorMap.set(key, {
                                id: contractor.id || '',
                                name: name,
                                serviceType: (contractor.serviceType || '').trim(),
                                licenseNumber: (contractor.licenseNumber || '').trim()
                            });
                        }
                    });
                    contractors = Array.from(contractorMap.values())
                        .sort((a, b) => {
                            const nameA = a.name.toLowerCase();
                            const nameB = b.name.toLowerCase();
                            return nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' });
                        });
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على المقاولين من getAllContractorsForModules:', error);
            }
        }

        // بديل: استخدام getApprovedOptions
        if (contractors.length === 0 && typeof Contractors !== 'undefined' && typeof Contractors.getApprovedOptions === 'function') {
            try {
                const approved = Contractors.getApprovedOptions(false);
                if (approved && approved.length > 0) {
                    contractors = approved.map(item => ({
                        id: item.id || item.contractorId || '',
                        name: (item.name || '').trim(),
                        serviceType: (item.serviceType || '').trim(),
                        licenseNumber: (item.licenseNumber || '').trim()
                    })).filter(c => c.name); // تصفية المقاولين بدون أسماء
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في الحصول على المقاولين المعتمدة:', error);
            }
        }

        // ✅ إذا لم توجد مقاولين، استخدم المقاولين المعتمدين النشطين من AppState
        if (contractors.length === 0) {
            const allContractors = AppState.appData.approvedContractors || [];
            const contractorMap = new Map(); // لإزالة التكرار

            allContractors
                .filter(c => c && (c.companyName || c.name) && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE') // تصفية غير النشطين
                .forEach(contractor => {
                    const name = (contractor.companyName || contractor.name || '').trim();
                    if (!name || name === 'غير معروف') return;

                    // إزالة التكرار بناءً على الاسم
                    if (!contractorMap.has(name)) {
                        contractorMap.set(name, {
                            id: contractor.id || '',
                            name: name,
                            serviceType: (contractor.serviceType || '').trim(),
                            licenseNumber: (contractor.licenseNumber || contractor.contractNumber || '').trim()
                        });
                    }
                });

            contractors = Array.from(contractorMap.values())
                .sort((a, b) => {
                    const nameA = a.name.toLowerCase();
                    const nameB = b.name.toLowerCase();
                    return nameA.localeCompare(nameB, 'ar', { sensitivity: 'base' });
                });
        }

        // مسح الخيارات الحالية
        selectElement.innerHTML = '<option value="">-- اختر المقاول --</option>';

        // استخدام DocumentFragment لتحسين الأداء
        const fragment = document.createDocumentFragment();
        let selectedOption = null;

        // إضافة المقاولين
        contractors.forEach(contractor => {
            if (!contractor || !contractor.name) return;

            const option = document.createElement('option');
            option.value = contractor.name; // القيمة الأصلية للاستخدام في value
            option.textContent = contractor.name; // textContent آمن تلقائياً من XSS
            if (contractor.serviceType) {
                option.textContent += ` - ${contractor.serviceType}`;
            }
            option.dataset.contractorId = contractor.id || '';

            // تحديد القيمة المحددة مسبقاً
            if (selectedValue && contractor.name === selectedValue) {
                option.selected = true;
                selectedOption = option;
            } else if (selectedContractorId && contractor.id === selectedContractorId) {
                option.selected = true;
                selectedOption = option;
            }

            fragment.appendChild(option);
        });

        selectElement.appendChild(fragment);

        // إذا لم يتم العثور على القيمة المحددة، حاول تعيينها يدوياً
        if (selectedValue && !selectedOption && selectElement.value !== selectedValue) {
            try {
                selectElement.value = selectedValue;
            } catch (e) {
                // القيمة غير موجودة في القائمة
                Utils.safeWarn('⚠️ المقاول المحدد غير موجود في القائمة:', selectedValue);
            }
        }
    },

    async showViolationForm(violationDataOrId = null) {
        // دعم تمرير ID أو كائن كامل
        let violationData = null;
        if (typeof violationDataOrId === 'string') {
            // إذا تم تمرير ID، نبحث عن البيانات
            violationData = AppState.appData.violations?.find(v => v.id === violationDataOrId) || null;
        } else if (typeof violationDataOrId === 'object') {
            violationData = violationDataOrId;
        }
        violationData = this.normalizeViolationRecord(violationData);
        const isEdit = !!violationData;
        const recordPersonType = String(violationData?.personType || '').trim().toLowerCase();
        const isContractorRecord = recordPersonType === 'contractor' || (!!violationData?.contractorName && !violationData?.employeeName);
        const isEmployeeRecord = !isContractorRecord;
        const selectedLocationValue = String(violationData?.violationLocationId || violationData?.violationLocation || '').trim();
        const selectedPlaceValue = String(violationData?.violationPlaceId || violationData?.violationPlace || '').trim();

        // التحقق من وجود ViolationTypesManager
        let violationTypes = [];
        if (typeof ViolationTypesManager !== 'undefined' && ViolationTypesManager.ensureInitialized && ViolationTypesManager.getAll) {
            try {
                ViolationTypesManager.ensureInitialized();
                violationTypes = ViolationTypesManager.getAll();
            } catch (vtError) {
                Utils.safeWarn('⚠️ خطأ في الحصول على أنواع المخالفات:', vtError);
                violationTypes = AppState?.appData?.violationTypes || [];
            }
        } else {
            violationTypes = AppState?.appData?.violationTypes || [];
        }
        const selectedTypeId = violationData?.violationTypeId || '';
        const selectedTypeName = (violationData?.violationType || '').trim();
        const currentUserRole = (AppState?.currentUser?.role || '').toString().trim().toLowerCase();
        const canManagerEditFineAmount = ['admin', 'manager', 'مدير', 'مدير النظام', 'system-manager', 'system_admin'].includes(currentUserRole);
        const typeOptions = violationTypes.map(type => {
            const isSelected = selectedTypeId
                ? type.id === selectedTypeId
                : type.name === selectedTypeName;
            const typeFineAmount = Number(type?.fineAmount || 0);
            return `
                <option value="${Utils.escapeHTML(type.name)}" data-type-id="${Utils.escapeHTML(type.id)}" data-fine-amount="${typeFineAmount}" ${isSelected ? 'selected' : ''}>
                    ${Utils.escapeHTML(type.name)}
                </option>
            `;
        }).join('');
        const hasSelectedType = violationTypes.some(type => selectedTypeId
            ? type.id === selectedTypeId
            : type.name === selectedTypeName);
        const legacyTypeOption = !hasSelectedType && selectedTypeName
            ? `
                <option value="${Utils.escapeHTML(selectedTypeName)}" data-type-id="${Utils.escapeHTML(selectedTypeId)}" data-fine-amount="${Number(violationData?.fineAmount || 0)}" selected>
                    ${Utils.escapeHTML(selectedTypeName)} (غير معرف)
                </option>
            `
            : '';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-exclamation-triangle ml-2 text-yellow-600"></i>
                        ${isEdit ? 'تعديل مخالفة' : 'تسجيل مخالفة جديدة'}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="violation-form" class="space-y-4">
                        <!-- الصف الأول: نوع المخالفة والكود الوظيفي -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-user-tag ml-2 text-blue-600"></i>
                                    نوع الشخص *
                                </label>
                                <select id="violation-person-type" required class="form-input">
                                    <option value="">اختر النوع</option>
                                    <option value="employee" ${isEmployeeRecord ? 'selected' : ''}>موظف</option>
                                    <option value="contractor" ${isContractorRecord ? 'selected' : ''}>مقاول</option>
                                </select>
                            </div>
                            <div id="violation-employee-code-container" style="display: ${isEmployeeRecord ? 'block' : 'none'};">
                                <label for="violation-employee-code" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-id-card ml-2"></i>
                                    الكود الوظيفي المخالف *
                                </label>
                                <input type="text" id="violation-employee-code" class="form-input"
                                    value="${violationData?.employeeCode || violationData?.employeeNumber || ''}" 
                                    placeholder="أدخل الكود الوظيفي (سيتم تعبئة البيانات تلقائياً)"
                                    ${isEmployeeRecord ? 'required' : ''}>
                            </div>
                        </div>
                        
                        <!-- الصف الثاني: اسم الموظف والوظيفة -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="violation-person-name" class="block text-sm font-semibold text-gray-700 mb-2" id="violation-person-name-label">اسم المخالف *</label>
                                <input type="text" id="violation-person-name" required class="form-input"
                                    value="${violationData?.employeeName || violationData?.contractorName || ''}" 
                                    placeholder="${isEmployeeRecord ? 'سيتم التعبئة تلقائياً' : 'اسم المقاول'}"
                                    ${isEmployeeRecord ? 'readonly' : ''}
                                    style="display: ${isContractorRecord ? 'none' : 'block'};">
                                <label for="violation-contractor-select" class="block text-sm font-semibold text-gray-700 mb-2" style="display: ${isContractorRecord ? 'block' : 'none'};">المقاول *</label>
                                <select id="violation-contractor-select" class="form-input"
                                    style="display: ${isContractorRecord ? 'block' : 'none'};"
                                    ${isContractorRecord ? 'required' : ''}>
                                    <option value="">-- اختر المقاول --</option>
                                </select>
                            </div>
                            <div id="violation-employee-position-container" style="display: ${isEmployeeRecord ? 'block' : 'none'};">
                                <label for="violation-employee-position" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                <input type="text" id="violation-employee-position" class="form-input"
                                    value="${violationData?.employeePosition || ''}" 
                                    placeholder="سيتم التعبئة تلقائياً" readonly>
                            </div>
                        </div>
                        
                        <!-- الصف الثالث: الإدارة وتاريخ المخالفة -->
                        <div class="grid grid-cols-2 gap-4">
                            <div id="violation-employee-department-container" style="display: ${isEmployeeRecord ? 'block' : 'none'};">
                                <label for="violation-employee-department" class="block text-sm font-semibold text-gray-700 mb-2">الإدارة</label>
                                <input type="text" id="violation-employee-department" class="form-input"
                                    value="${violationData?.employeeDepartment || ''}" 
                                    placeholder="سيتم التعبئة تلقائياً" readonly>
                            </div>
                            <div>
                                <label for="violation-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ المخالفة *</label>
                                <input type="date" id="violation-date" required class="form-input"
                                    value="${violationData?.violationDate ? new Date(violationData.violationDate).toISOString().slice(0, 10) : ''}">
                            </div>
                        </div>
                        
                        <!-- الصف الرابع: وقت المخالفة ونوع المخالفة -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="violation-time" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-clock ml-2 text-purple-600"></i>
                                    وقت المخالفة *
                                </label>
                                <input type="time" id="violation-time" required class="form-input"
                                    value="${violationData?.violationTime || ''}">
                            </div>
                            <div>
                                <label for="violation-type" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-exclamation-circle ml-2 text-red-600"></i>
                                    نوع المخالفة *
                                </label>
                                <select id="violation-type" required class="form-input">
                                    <option value="">اختر النوع</option>
                                    ${legacyTypeOption}
                                    ${typeOptions}
                                </select>
                            </div>
                            <div>
                                <label for="violation-fine-amount" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-money-bill-wave ml-2 text-green-600"></i>
                                    القيمة المالية (ج.م)
                                </label>
                                <input type="number" id="violation-fine-amount" class="form-input" min="0" step="1"
                                    value="${Number(violationData?.fineAmount || 0)}"
                                    placeholder="القيمة المالية">
                                <p class="text-xs text-gray-500 mt-1">
                                    ${canManagerEditFineAmount ? 'يتم التحديد تلقائياً ويمكنك التعديل لأنك مدير.' : 'يتم التحديد تلقائياً حسب نوع المخالفة، والتعديل متاح للمدير فقط.'}
                                </p>
                            </div>
                        </div>
                        <!-- حقول المقاول (تظهر فقط عند اختيار مقاول) -->
                        <div id="violation-contractor-fields-container" style="display: ${isContractorRecord ? 'block' : 'none'};">
                            <div class="grid grid-cols-2 gap-4">
                                <div id="violation-contractor-worker-container">
                                    <label for="violation-contractor-worker" class="block text-sm font-semibold text-gray-700 mb-2">اسم العامل التابع للمقاول</label>
                                    <input type="text" id="violation-contractor-worker" class="form-input"
                                        value="${violationData?.contractorWorker || ''}" 
                                        placeholder="اسم العامل">
                                </div>
                                <div id="violation-contractor-position-container">
                                    <label for="violation-contractor-position" class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                    <input type="text" id="violation-contractor-position" class="form-input"
                                        value="${violationData?.contractorPosition || ''}" 
                                        placeholder="وظيفة العامل">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mt-4">
                                <div id="violation-contractor-department-container">
                                    <label for="violation-contractor-department" class="block text-sm font-semibold text-gray-700 mb-2">الإدارة</label>
                                    <input type="text" id="violation-contractor-department" class="form-input"
                                        value="${violationData?.contractorDepartment || ''}" 
                                        placeholder="الإدارة التابعة له">
                            </div>
                            <div>
                                    <label for="violation-contractor-location" class="block text-sm font-semibold text-gray-700 mb-2">الموقع *</label>
                                    <select id="violation-contractor-location" required class="form-input">
                                        <option value="">-- اختر الموقع --</option>
                                    </select>
                            </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label for="violation-contractor-place" class="block text-sm font-semibold text-gray-700 mb-2">مكان المخالفة *</label>
                                    <select id="violation-contractor-place" required class="form-input">
                                        <option value="">-- اختر مكان المخالفة --</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- حقول الموقع ومكان المخالفة (للموظف) -->
                        <div id="violation-location-fields-container" style="display: ${isEmployeeRecord ? 'block' : 'none'};">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label for="violation-employee-location" class="block text-sm font-semibold text-gray-700 mb-2">الموقع *</label>
                                    <select id="violation-employee-location" required class="form-input">
                                        <option value="">-- اختر الموقع --</option>
                                    </select>
                                </div>
                                <div>
                                    <label for="violation-employee-place" class="block text-sm font-semibold text-gray-700 mb-2">مكان المخالفة *</label>
                                    <select id="violation-employee-place" required class="form-input">
                                        <option value="">-- اختر مكان المخالفة --</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- الصف الخامس: الشدة والحالة -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-signal ml-2 text-orange-600"></i>
                                    الشدة *
                                </label>
                                <select id="violation-severity" required class="form-input">
                                    <option value="">اختر الشدة</option>
                                    <option value="عالية" ${violationData?.severity === 'عالية' ? 'selected' : ''}>عالية</option>
                                    <option value="متوسطة" ${violationData?.severity === 'متوسطة' ? 'selected' : ''}>متوسطة</option>
                                    <option value="منخضة" ${violationData?.severity === 'منخضة' ? 'selected' : ''}>منخضة</option>
                                </select>
                            </div>
                            <div>
                                <label for="violation-status" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-info-circle ml-2 text-blue-600"></i>
                                    الحالة *
                                </label>
                                <select id="violation-status" required class="form-input">
                                    <option value="">اختر الحالة</option>
                                    <option value="قيد المراجعة" ${violationData?.status === 'قيد المراجعة' ? 'selected' : ''}>قيد المراجعة</option>
                                    <option value="محلول" ${violationData?.status === 'محلول' ? 'selected' : ''}>محلول</option>
                                    <option value="غير محلول" ${violationData?.status === 'غير محلول' ? 'selected' : ''}>غير محلول</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- الصورة وتفاصيل المخالفة والإجراء المتخذ -->
                            <div class="col-span-2">
                                <label for="violation-photo-input" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-image ml-2"></i>
                                    صورة المخالفة (غير إلزامي)
                                </label>
                                <input type="file" id="violation-photo-input" accept="image/*" class="form-input">
                                <div id="violation-photo-preview" class="mt-2 ${violationData?.photo ? '' : 'hidden'}">
                                    <img src="${violationData?.photo || ''}" alt="صورة المخالفة" class="w-48 h-48 object-cover rounded border" id="violation-photo-img">
                                <button type="button" onclick="const photoInput = document.getElementById('violation-photo-input'); if (photoInput) photoInput.value=''; const photoPreview = document.getElementById('violation-photo-preview'); if (photoPreview) photoPreview.classList.add('hidden');" class="mt-1 text-xs text-red-600">حذف الصورة</button>
                                </div>
                            </div>
                            <div class="col-span-2">
                                <label for="violation-details" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-file-alt ml-2 text-amber-600"></i>
                                    تفاصيل المخالفة
                                </label>
                                <textarea id="violation-details" class="form-input" rows="3"
                                    placeholder="اكتب تفاصيل المخالفة ووصفها الكامل...">${violationData?.violationDetails || ''}</textarea>
                            </div>
                            <div class="col-span-2">
                                <label for="violation-action" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-tasks ml-2 text-indigo-600"></i>
                                    الإجراء المتخذ
                                </label>
                                <textarea id="violation-action" class="form-input" rows="3"
                                    placeholder="وصف الإجراء المتخذ بشأن المخالفة...">${violationData?.actionTaken || ''}</textarea>
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                <i class="fas fa-times ml-2"></i>إلغاء
                            </button>
                            <button type="submit" id="violation-submit-btn" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل المخالفة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Setup employee autocomplete for employee type
        const personTypeSelect = document.getElementById('violation-person-type');
        const employeeCodeContainer = document.getElementById('violation-employee-code-container');
        const employeeCodeInput = document.getElementById('violation-employee-code');
        const personNameInput = document.getElementById('violation-person-name');
        const personNameLabel = document.getElementById('violation-person-name-label');

        const contractorSelect = document.getElementById('violation-contractor-select');

        // تحميل قائمة المقاولين في القائمة المنسدلة
        if (contractorSelect) {
            const currentValue = violationData?.contractorName || '';
            const currentContractorId = violationData?.contractorId || '';
            this.loadContractorsIntoSelect(contractorSelect, currentValue, currentContractorId);
        }

        // الحصول على عناصر الحقول
        const employeePositionContainer = document.getElementById('violation-employee-position-container');
        const employeeDepartmentContainer = document.getElementById('violation-employee-department-container');
        const employeePositionInput = document.getElementById('violation-employee-position');
        const employeeDepartmentInput = document.getElementById('violation-employee-department');

        const contractorFieldsContainer = document.getElementById('violation-contractor-fields-container');
        const contractorWorkerContainer = document.getElementById('violation-contractor-worker-container');
        const contractorPositionContainer = document.getElementById('violation-contractor-position-container');
        const contractorDepartmentContainer = document.getElementById('violation-contractor-department-container');
        const contractorWorkerInput = document.getElementById('violation-contractor-worker');
        const contractorPositionInput = document.getElementById('violation-contractor-position');
        const contractorDepartmentInput = document.getElementById('violation-contractor-department');

        const locationFieldsContainer = document.getElementById('violation-location-fields-container');
        const violationTypeSelect = document.getElementById('violation-type');
        const fineAmountInput = document.getElementById('violation-fine-amount');
        const typeById = new Map((violationTypes || []).map(type => [String(type.id || '').trim(), type]));
        const typeByName = new Map((violationTypes || []).map(type => [String(type.name || '').trim().toLowerCase(), type]));

        const getDefaultFineAmountForSelectedType = () => {
            const selectedOption = violationTypeSelect?.selectedOptions?.[0];
            const typeId = selectedOption?.getAttribute('data-type-id') || '';
            const typeName = (violationTypeSelect?.value || '').trim().toLowerCase();
            const type = (typeId && typeById.get(typeId)) || (typeName && typeByName.get(typeName)) || null;
            const optionFine = Number(selectedOption?.getAttribute('data-fine-amount') || 0);
            const mappedFine = Number(type?.fineAmount ?? optionFine ?? 0);
            return Number.isFinite(mappedFine) && mappedFine >= 0 ? mappedFine : 0;
        };

        const applyFineAmountFromType = ({ force = false } = {}) => {
            if (!fineAmountInput) return;
            const defaultFineAmount = getDefaultFineAmountForSelectedType();
            if (force || !canManagerEditFineAmount || fineAmountInput.value === '') {
                fineAmountInput.value = String(defaultFineAmount);
            }
        };

        if (fineAmountInput) {
            fineAmountInput.readOnly = !canManagerEditFineAmount;
        }
        if (violationTypeSelect) {
            violationTypeSelect.addEventListener('change', () => applyFineAmountFromType({ force: true }));
            // دعم تحديث فوري إضافي على بعض المتصفحات التي تُطلق input أثناء التنقل
            violationTypeSelect.addEventListener('input', () => applyFineAmountFromType({ force: true }));
        }
        if (fineAmountInput && canManagerEditFineAmount && violationData && violationData.fineAmount !== undefined && violationData.fineAmount !== null) {
            fineAmountInput.value = String(Number(violationData.fineAmount) || 0);
        } else {
            applyFineAmountFromType({ force: true });
        }

        personTypeSelect.addEventListener('change', (e) => {
            const personType = e.target.value;
            if (personType === 'employee') {
                // إظهار حقل الكود الوظيفي
                employeeCodeContainer.style.display = 'block';
                employeeCodeInput.required = true;
                employeeCodeInput.placeholder = 'أدخل الكود الوظيفي (سيتم تعبئة البيانات تلقائياً)';

                // إظهار حقل الاسم وإخفاء قائمة المقاولين
                personNameInput.style.display = 'block';
                personNameInput.readOnly = true;
                personNameInput.placeholder = 'سيتم التعبئة تلقائياً';
                personNameInput.value = '';
                personNameInput.required = true;
                if (contractorSelect) {
                    contractorSelect.style.display = 'none';
                    contractorSelect.required = false;
                }

                // إظهار حقول الموظف
                if (employeePositionContainer) employeePositionContainer.style.display = 'block';
                if (employeeDepartmentContainer) employeeDepartmentContainer.style.display = 'block';

                // إخفاء حقول المقاول
                if (contractorFieldsContainer) contractorFieldsContainer.style.display = 'none';

                // إظهار حقول الموقع للموظف
                if (locationFieldsContainer) locationFieldsContainer.style.display = 'block';

                // تحميل خيارات الموقع للموظف
                this.loadLocationOptions('employee').then(() => {
                    const employeeLocationSelect = document.getElementById('violation-employee-location');
                    if (employeeLocationSelect) {
                        // إزالة المعالجات القديمة إن وجدت
                        const newSelect = employeeLocationSelect.cloneNode(true);
                        employeeLocationSelect.parentNode.replaceChild(newSelect, employeeLocationSelect);
                        const updatedSelect = document.getElementById('violation-employee-location');
                        if (updatedSelect) {
                            updatedSelect.addEventListener('change', (e) => {
                                const selectedSiteId = e.target.value;
                                this.loadPlaceOptions(selectedSiteId, '', 'employee');
                            });
                        }
                    }
                });

                // تحديث التسمية
                if (personNameLabel) personNameLabel.textContent = 'اسم الموظف *';

                // تعيل البحث بالكود الوظيي
                if (typeof EmployeeHelper !== 'undefined' && employeeCodeInput && employeeCodeInput.parentNode) {
                    try {
                        // إزالة المعالجات القديمة
                        const newCodeInput = employeeCodeInput.cloneNode(true);
                        employeeCodeInput.parentNode.replaceChild(newCodeInput, employeeCodeInput);

                        // الحصول على العنصر الجديد
                        const updatedCodeInput = document.getElementById('violation-employee-code');
                        if (updatedCodeInput) {
                            EmployeeHelper.setupEmployeeCodeSearch('violation-employee-code', 'violation-person-name', (employee) => {
                                if (employee) {
                                    const nameField = document.getElementById('violation-person-name');
                                    const positionField = document.getElementById('violation-employee-position');
                                    const departmentField = document.getElementById('violation-employee-department');
                                    if (nameField) nameField.value = employee.name || '';
                                    if (positionField) positionField.value = employee.position || employee.jobTitle || '';
                                    if (departmentField) departmentField.value = employee.department || employee.section || '';
                                }
                            });
                        }
                    } catch (error) {
                        Utils.safeError('خطأ في إعداد البحث بالكود الوظيفي:', error);
                        // محاولة بدون replaceChild
                        if (employeeCodeInput) {
                            EmployeeHelper.setupEmployeeCodeSearch('violation-employee-code', 'violation-person-name', (employee) => {
                                if (employee) {
                                    const nameField = document.getElementById('violation-person-name');
                                    const positionField = document.getElementById('violation-employee-position');
                                    const departmentField = document.getElementById('violation-employee-department');
                                    if (nameField) nameField.value = employee.name || '';
                                    if (positionField) positionField.value = employee.position || employee.jobTitle || '';
                                    if (departmentField) departmentField.value = employee.department || employee.section || '';
                                }
                            });
                        }
                    }
                }
            } else {
                applyFineAmountFromType({ force: true });
                // إخاء حقل الكود الوظيي
                employeeCodeContainer.style.display = 'none';
                employeeCodeInput.required = false;
                employeeCodeInput.value = '';

                // إظهار قائمة المقاولين وإخفاء حقل الاسم
                personNameInput.style.display = 'none';
                personNameInput.required = false;
                personNameInput.value = '';
                if (contractorSelect) {
                    contractorSelect.style.display = 'block';
                    contractorSelect.required = true;

                    // إعادة تحميل قائمة المقاولين عند التبديل إلى نوع مقاول
                    this.loadContractorsIntoSelect(contractorSelect);
                }

                // إخفاء حقول الموظف
                if (employeePositionContainer) employeePositionContainer.style.display = 'none';
                if (employeeDepartmentContainer) employeeDepartmentContainer.style.display = 'none';

                // إظهار حقول المقاول
                if (contractorFieldsContainer) contractorFieldsContainer.style.display = 'block';

                // تحميل خيارات الموقع للمقاول
                this.loadLocationOptions('contractor').then(() => {
                    const contractorLocationSelect = document.getElementById('violation-contractor-location');
                    if (contractorLocationSelect) {
                        // إزالة المعالجات القديمة إن وجدت
                        const newSelect = contractorLocationSelect.cloneNode(true);
                        contractorLocationSelect.parentNode.replaceChild(newSelect, contractorLocationSelect);
                        const updatedSelect = document.getElementById('violation-contractor-location');
                        if (updatedSelect) {
                            updatedSelect.addEventListener('change', (e) => {
                                const selectedSiteId = e.target.value;
                                this.loadPlaceOptions(selectedSiteId, '', 'contractor');
                            });
                        }
                    }
                });

                // إخفاء حقول الموقع للموظف (لأن المقاول له حقول موقع خاصة به)
                if (locationFieldsContainer) locationFieldsContainer.style.display = 'none';

                // تحديث التسمية
                if (personNameLabel) personNameLabel.textContent = 'اسم المقاول *';
            }
        });

        // تفعيل البحث عند تحديث النموذج إذا كان موظف
        if (typeof EmployeeHelper !== 'undefined' && violationData?.employeeName && employeeCodeInput && employeeCodeInput.parentNode) {
            try {
                // إزالة المعالجات القديمة
                const newCodeInput = employeeCodeInput.cloneNode(true);
                employeeCodeInput.parentNode.replaceChild(newCodeInput, employeeCodeInput);

                // الحصول على العنصر الجديد
                const updatedCodeInput = document.getElementById('violation-employee-code');
                if (updatedCodeInput) {
                    EmployeeHelper.setupEmployeeCodeSearch('violation-employee-code', 'violation-person-name', (employee) => {
                        if (employee) {
                            const nameField = document.getElementById('violation-person-name');
                            const positionField = document.getElementById('violation-employee-position');
                            const departmentField = document.getElementById('violation-employee-department');
                            if (nameField) nameField.value = employee.name || '';
                            if (positionField) positionField.value = employee.position || employee.jobTitle || '';
                            if (departmentField) departmentField.value = employee.department || employee.section || '';
                        }
                    });
                }
            } catch (error) {
                Utils.safeError('خطأ في إعداد البحث بالكود الوظيفي:', error);
                // محاولة بدون replaceChild
                if (employeeCodeInput) {
                    EmployeeHelper.setupEmployeeCodeSearch('violation-employee-code', 'violation-person-name', (employee) => {
                        if (employee) {
                            const nameField = document.getElementById('violation-person-name');
                            const positionField = document.getElementById('violation-employee-position');
                            const departmentField = document.getElementById('violation-employee-department');
                            if (nameField) nameField.value = employee.name || '';
                            if (positionField) positionField.value = employee.position || employee.jobTitle || '';
                            if (departmentField) departmentField.value = employee.department || employee.section || '';
                        }
                    });
                }
            }
        }

        // تحميل قائمة المواقع حسب نوع الشخص (افتراضي: موظف)
        const initialPersonType = isContractorRecord ? 'contractor' : 'employee';
        // تحميل خيارات الموقع للموظف (الافتراضي) والمقاول
        setTimeout(async () => {
            await this.loadLocationOptions('employee');
            await this.loadLocationOptions('contractor');

            // إعداد event listeners للموقع والأماكن للموظف
            const employeeLocationSelect = document.getElementById('violation-employee-location');
            const employeePlaceSelect = document.getElementById('violation-employee-place');
            if (employeeLocationSelect && employeePlaceSelect) {
                // إزالة المعالجات القديمة إن وجدت
                const newLocationSelect = employeeLocationSelect.cloneNode(true);
                employeeLocationSelect.parentNode.replaceChild(newLocationSelect, employeeLocationSelect);
                const newPlaceSelect = employeePlaceSelect.cloneNode(true);
                employeePlaceSelect.parentNode.replaceChild(newPlaceSelect, employeePlaceSelect);

                // إعادة الحصول على العناصر
                const updatedLocationSelect = document.getElementById('violation-employee-location');
                const updatedPlaceSelect = document.getElementById('violation-employee-place');
                if (updatedLocationSelect) {
                    updatedLocationSelect.addEventListener('change', (e) => {
                        const selectedSiteId = e.target.value;
                        this.loadPlaceOptions(selectedSiteId, '', 'employee');
                    });
                }
            }

            // إعداد event listeners للموقع والأماكن للمقاول
            const contractorLocationSelect = document.getElementById('violation-contractor-location');
            const contractorPlaceSelect = document.getElementById('violation-contractor-place');
            if (contractorLocationSelect && contractorPlaceSelect) {
                // إزالة المعالجات القديمة إن وجدت
                const newLocationSelect = contractorLocationSelect.cloneNode(true);
                contractorLocationSelect.parentNode.replaceChild(newLocationSelect, contractorLocationSelect);
                const newPlaceSelect = contractorPlaceSelect.cloneNode(true);
                contractorPlaceSelect.parentNode.replaceChild(newPlaceSelect, contractorPlaceSelect);

                // إعادة الحصول على العناصر
                const updatedLocationSelect = document.getElementById('violation-contractor-location');
                const updatedPlaceSelect = document.getElementById('violation-contractor-place');
                if (updatedLocationSelect) {
                    updatedLocationSelect.addEventListener('change', (e) => {
                        const selectedSiteId = e.target.value;
                        this.loadPlaceOptions(selectedSiteId, '', 'contractor');
                    });
                }
            }

            // إذا كان النوع الافتراضي هو موظف، تأكد من إعداد حقول الموظف
            if (initialPersonType === 'employee' && personTypeSelect.value === 'employee') {
                // إعداد البحث بالكود الوظيفي للموظف
                if (typeof EmployeeHelper !== 'undefined') {
                    const codeInput = document.getElementById('violation-employee-code');
                    if (codeInput) {
                        try {
                            EmployeeHelper.setupEmployeeCodeSearch('violation-employee-code', 'violation-person-name', (employee) => {
                                if (employee) {
                                    const nameField = document.getElementById('violation-person-name');
                                    const positionField = document.getElementById('violation-employee-position');
                                    const departmentField = document.getElementById('violation-employee-department');
                                    if (nameField) nameField.value = employee.name || '';
                                    if (positionField) positionField.value = employee.position || employee.jobTitle || '';
                                    if (departmentField) departmentField.value = employee.department || employee.section || '';
                                }
                            });
                        } catch (error) {
                            Utils.safeError('خطأ في إعداد البحث بالكود الوظيفي:', error);
                        }
                    }
                }
            }
        }, 100);

        // تعيين القيم إذا كان التعديل (سيتم إعداد event listeners في setTimeout)
        if (selectedLocationValue) {
            setTimeout(() => {
                if (initialPersonType === 'employee') {
                    const employeeLocationSelect = document.getElementById('violation-employee-location');
                    if (employeeLocationSelect) {
                        employeeLocationSelect.value = selectedLocationValue;
                        if (selectedLocationValue) {
                            this.loadPlaceOptions(selectedLocationValue, selectedPlaceValue, 'employee');
                        }
                    }
                } else if (initialPersonType === 'contractor') {
                    const contractorLocationSelect = document.getElementById('violation-contractor-location');
                    if (contractorLocationSelect) {
                        contractorLocationSelect.value = selectedLocationValue;
                        if (selectedLocationValue) {
                            this.loadPlaceOptions(selectedLocationValue, selectedPlaceValue, 'contractor');
                        }
                    }
                }
            }, 200);
        }

        // Setup photo preview
        const photoInput = document.getElementById('violation-photo-input');
        const photoPreview = document.getElementById('violation-photo-preview');
        const photoImg = document.getElementById('violation-photo-img');
        if (photoInput && photoPreview && photoImg) {
            photoInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        Notification.error('حجم الصورة كبير جداً. الحد الأقصى 2MB');
                        photoInput.value = '';
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        photoImg.src = e.target.result;
                        photoPreview.classList.remove('hidden');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // الحصول على النموذج وزر الإرسال
        const form = modal.querySelector('#violation-form');
        const submitBtn = modal.querySelector('#violation-submit-btn') || form?.querySelector('button[type="submit"]');

        if (!form || !submitBtn) {
            if (AppState.debugMode) Utils.safeError('❌ النموذج أو زر الإرسال غير موجود');
            Notification.error('خطأ في تحميل النموذج. يرجى إعادة المحاولة.');
            return;
        }

        // ========== كود جديد بسيط ونظيف ==========

        // معالج النقر على زر التسجيل
        const handleSubmit = async (e) => {
            // منع السلوك الافتراضي للنموذج
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }

            // منع النقر المزدوج
            if (submitBtn.disabled) {
                if (AppState.debugMode) Utils.safeLog('⚠️ النموذج قيد المعالجة...');
                return;
            }

            // تعطيل الزر لمنع النقر المزدوج
            const btn = submitBtn;
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحفظ...';

            try {
                // جمع البيانات من النموذج
                const personType = document.getElementById('violation-person-type')?.value;
                const violationDate = document.getElementById('violation-date')?.value;
                const violationTime = document.getElementById('violation-time')?.value;
                const violationType = document.getElementById('violation-type')?.value;
                const severity = document.getElementById('violation-severity')?.value;
                const status = document.getElementById('violation-status')?.value;
                const violationDetails = document.getElementById('violation-details')?.value.trim() || '';
                const actionTaken = document.getElementById('violation-action')?.value.trim() || '';
                const fineAmountRaw = document.getElementById('violation-fine-amount')?.value;
                let fineAmount = '';
                if (fineAmountRaw !== '' && fineAmountRaw !== null && fineAmountRaw !== undefined) {
                    const fineAmountParsed = this.parseFineAmount(fineAmountRaw);
                    if (Number.isFinite(fineAmountParsed) && fineAmountParsed >= 0) {
                        fineAmount = fineAmountParsed;
                    }
                } else {
                    fineAmount = this.parseFineAmount(getDefaultFineAmountForSelectedType());
                }

                // التحقق من البيانات الإلزامية
                const missing = [];
                if (!personType) missing.push('نوع المخالفة (موظف/مقاول)');
                if (!violationDate) missing.push('تاريخ المخالفة');
                if (!violationTime) missing.push('وقت المخالفة');
                if (!violationType) missing.push('نوع المخالفة');
                if (!severity) missing.push('شدة المخالفة');
                if (!status) missing.push('حالة المخالفة');

                // التحقق من بيانات الشخص
                let personName = '';
                let contractorId = '';
                if (personType === 'employee') {
                    const code = document.getElementById('violation-employee-code')?.value.trim();
                    personName = document.getElementById('violation-person-name')?.value.trim();
                    if (!code) missing.push('الكود الوظيفي');
                    if (!personName) missing.push('اسم الموظف');
                } else if (personType === 'contractor') {
                    const contractorSelect = document.getElementById('violation-contractor-select');
                    if (!contractorSelect || !contractorSelect.value) {
                        missing.push('اسم المقاول');
                    } else {
                        personName = contractorSelect.value;
                        const selectedOption = contractorSelect.options[contractorSelect.selectedIndex];
                        contractorId = selectedOption?.dataset.contractorCode || selectedOption?.dataset.contractorId || '';
                    }
                }

                // التحقق من الموقع ومكان المخالفة
                let location = '';
                let locationName = '';
                let place = '';
                let placeName = '';
                if (personType === 'employee') {
                    const locationSelect = document.getElementById('violation-employee-location');
                    const placeSelect = document.getElementById('violation-employee-place');
                    location = locationSelect?.value || '';
                    locationName = locationSelect?.options[locationSelect?.selectedIndex]?.text || '';
                    place = placeSelect?.value || '';
                    placeName = placeSelect?.options[placeSelect?.selectedIndex]?.text || '';
                } else if (personType === 'contractor') {
                    const locationSelect = document.getElementById('violation-contractor-location');
                    const placeSelect = document.getElementById('violation-contractor-place');
                    location = locationSelect?.value || '';
                    locationName = locationSelect?.options[locationSelect?.selectedIndex]?.text || '';
                    place = placeSelect?.value || '';
                    placeName = placeSelect?.options[placeSelect?.selectedIndex]?.text || '';
                }
                if (!location) missing.push('الموقع');
                if (!place) missing.push('مكان المخالفة');

                // إذا كانت هناك حقول ناقصة
                if (missing.length > 0) {
                    const message = `يرجى استكمال البيانات الإلزامية التالية قبل التسجيل:\n\n${missing.map(f => '• ' + f).join('\n')}`;
                    Notification.error(message, { duration: 6000 });
                    btn.disabled = false;
                    btn.innerHTML = originalText;

                    // إبراز الحقول الناقصة
                    missing.forEach(field => {
                        let inputId = '';
                        if (field.includes('الكود الوظيفي')) inputId = 'violation-employee-code';
                        else if (field.includes('اسم الموظف')) inputId = 'violation-person-name';
                        else if (field.includes('اسم المقاول')) inputId = 'violation-contractor-select';
                        else if (field.includes('تاريخ')) inputId = 'violation-date';
                        else if (field.includes('وقت')) inputId = 'violation-time';
                        else if (field.includes('نوع المخالفة')) inputId = 'violation-type';
                        else if (field.includes('الشدة')) inputId = 'violation-severity';
                        else if (field.includes('الحالة')) inputId = 'violation-status';
                        else if (field.includes('الموقع')) inputId = personType === 'employee' ? 'violation-employee-location' : 'violation-contractor-location';
                        else if (field.includes('مكان المخالفة')) inputId = personType === 'employee' ? 'violation-employee-place' : 'violation-contractor-place';

                        if (inputId) {
                            const input = document.getElementById(inputId);
                            if (input) {
                                input.classList.add('border-red-500', 'ring-2', 'ring-red-300');
                                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => {
                                    input.classList.remove('border-red-500', 'ring-2', 'ring-red-300');
                                }, 3000);
                            }
                        }
                    });
                    return;
                }

                // معالجة الصورة
                let photo = violationData?.photo || '';
                const photoInput = document.getElementById('violation-photo-input');
                if (photoInput?.files.length > 0) {
                    const file = photoInput.files[0];
                    if (file.size > 2 * 1024 * 1024) {
                        Notification.error('حجم الصورة كبير جداً. الحد الأقصى 2MB');
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                        return;
                    }
                    try {
                        photo = await Violations.convertImageToBase64(file);
                    } catch (err) {
                        if (AppState.debugMode) Utils.safeWarn('خطأ في تحويل الصورة:', err);
                    }
                }

                // رفع الصورة إلى Google Drive
                if (photo && photo.startsWith('data:')) {
                    try {
                        const uploadResult = await GoogleIntegration.uploadFileToDrive?.(
                            photo,
                            `violation_${violationData?.id || Utils.generateId('VIOLATION')}_${Date.now()}.jpg`,
                            'image/jpeg',
                            'Violations'
                        );
                        if (uploadResult?.success) {
                            photo = uploadResult.directLink || uploadResult.shareableLink || photo;
                        }
                    } catch (err) {
                        if (AppState.debugMode) Utils.safeWarn('خطأ في رفع الصورة:', err);
                    }
                }

                // إنشاء كائن البيانات
                const violationTypeOption = violationTypeSelect?.selectedOptions?.[0];
                const violationTypeId = violationTypeOption?.getAttribute('data-type-id') || '';

                const violationDateTime = violationDate && violationTime
                    ? new Date(`${violationDate}T${violationTime}`).toISOString()
                    : new Date().toISOString();

                const formData = {
                    id: violationData?.id || Utils.generateId('VIOLATION'),
                    isoCode: violationData?.isoCode || generateISOCode('VIOL', AppState.appData.violations || []),
                    personType: personType,
                    employeeId: personType === 'employee' ? (violationData?.employeeId || Utils.generateId('EMP')) : '',
                    employeeName: personType === 'employee' ? personName : '',
                    employeeCode: personType === 'employee' ? document.getElementById('violation-employee-code')?.value.trim() || '' : '',
                    employeeNumber: personType === 'employee' ? document.getElementById('violation-employee-code')?.value.trim() || '' : '',
                    employeePosition: personType === 'employee' ? document.getElementById('violation-employee-position')?.value.trim() || '' : '',
                    employeeDepartment: personType === 'employee' ? document.getElementById('violation-employee-department')?.value.trim() || '' : '',
                    contractorId: personType === 'contractor' ? contractorId : '',
                    contractorName: personType === 'contractor' ? personName : '',
                    contractorWorker: personType === 'contractor' ? document.getElementById('violation-contractor-worker')?.value.trim() || '' : '',
                    contractorPosition: personType === 'contractor' ? document.getElementById('violation-contractor-position')?.value.trim() || '' : '',
                    contractorDepartment: personType === 'contractor' ? document.getElementById('violation-contractor-department')?.value.trim() || '' : '',
                    violationTypeId: violationTypeId,
                    violationType: violationType,
                    fineAmount: this.parseFineAmount(fineAmount),
                    violationDate: violationDateTime,
                    violationTime: violationTime,
                    // حفظ ID الموقع واسمه
                    violationLocation: locationName && locationName !== '-- اختر الموقع --' ? locationName : location,
                    violationLocationId: location ? String(location).trim() : null,
                    // حفظ ID المكان واسمه
                    violationPlace: placeName && placeName !== '-- اختر مكان المخالفة --' ? placeName : place,
                    violationPlaceId: place ? String(place).trim() : null,
                    violationDetails: violationDetails,
                    severity: severity,
                    actionTaken: actionTaken,
                    status: status,
                    photo: photo,
                    createdAt: violationData?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // حفظ في AppState
                if (!AppState.appData.violations) {
                    AppState.appData.violations = [];
                }

                if (isEdit && violationData?.id) {
                    const index = AppState.appData.violations.findIndex(v => v.id === violationData.id);
                    if (index !== -1) {
                        // نحافظ على البيانات المرتبطة القديمة (المرفقات/المرجعيات) أثناء التعديل
                        AppState.appData.violations[index] = {
                            ...AppState.appData.violations[index],
                            ...formData,
                            id: violationData.id,
                            isoCode: violationData.isoCode || formData.isoCode,
                            createdAt: violationData.createdAt || formData.createdAt,
                            updatedAt: new Date().toISOString()
                        };
                    } else {
                        throw new Error('تعذر العثور على سجل المخالفة الأصلي للتعديل. أعد تحميل الصفحة ثم حاول مرة أخرى.');
                    }
                } else {
                    AppState.appData.violations.push(formData);
                }

                // حفظ محلياً
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }

                // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
                modal.remove();
                
                // 3. عرض رسالة نجاح فورية
                Notification.success(`تم ${isEdit ? 'تحديث' : 'تسجيل'} المخالفة بنجاح`);
                
                // 4. تحديث القائمة فوراً
                if (typeof Violations !== 'undefined' && Violations.load) {
                    Violations.load();
                }
                
                // 5. معالجة المهام الخلفية (Google Sheets) في الخلفية
                GoogleIntegration.autoSave('Violations', AppState.appData.violations).catch(err => {
                    if (AppState.debugMode) Utils.safeWarn('خطأ في حفظ Google Sheets:', err);
                    Notification.warning('تم الحفظ محلياً لكن فشل الحفظ في Google Sheets');
                });

            } catch (error) {
                Utils.safeError('❌ خطأ في حفظ المخالفة:', error);
                Notification.error('حدث خطأ أثناء حفظ المخالفة: ' + (error.message || error.toString()));
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        };

        // ربط معالج الأحداث - نستخدم submit فقط لتجنب التنفيذ المزدوج
        form.addEventListener('submit', handleSubmit, { once: false });

        // إزالة أي معالجات قديمة للزر
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        const updatedSubmitBtn = modal.querySelector('#violation-submit-btn') || modal.querySelector('button[type="submit"]');

        // ربط معالج click كنسخة احتياطية (مع منع السلوك الافتراضي)
        if (updatedSubmitBtn) {
            updatedSubmitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (updatedSubmitBtn.disabled) return;
                handleSubmit(e);
            });
        }

        // إغلاق النموذج عند النقر خارجه
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // إغلاق النموذج عند الضغط على ESC
        const handleEscape = (e) => {
            if (e.key === 'Escape' && document.body.contains(modal)) {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    },

    getSiteOptions() {
        try {
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
                    name: site.name || site.title || site.label || 'موقع غير محدد'
                }));
            }

            // محاولة الحصول من DailyObservations
            if (typeof DailyObservations !== 'undefined' && Array.isArray(DailyObservations.DEFAULT_SITES)) {
                return DailyObservations.DEFAULT_SITES.map((site, index) => ({
                    id: site.id || site.siteId || Utils.generateId('SITE'),
                    name: site.name || site.title || site.label || `موقع ${index + 1}`
                }));
            }

            return [];
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة المواقع:', error);
            return [];
        }
    },

    refreshSiteDropdowns() {
        try {
            var sites = this.getSiteOptions();
            var esc = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : function(s) { return String(s == null ? '' : s); };
            var opts = '<option value="">اختر المصنع</option>' + (sites || []).map(function(s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('');
            var el = document.getElementById('blacklist-factory');
            if (el && el.tagName === 'SELECT') { var v = el.value; el.innerHTML = opts; if (v) el.value = v; }
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ Violations.refreshSiteDropdowns:', e); }
    },

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
                        id: place.id || place.placeId || Utils.generateId('PLACE'),
                        name: place.name || place.placeName || 'مكان غير محدد'
                    }));
                }
            }

            // محاولة الحصول من AppState.appData.observationSites
            if (Array.isArray(AppState.appData?.observationSites)) {
                const site = AppState.appData.observationSites.find(s =>
                    (s.id === siteId) || (s.siteId === siteId) || (s.name === siteId)
                );
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

    async loadLocationOptions(personType = 'employee') {
        try {
            // التأكد من تحميل إعدادات النماذج
            if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
                await Permissions.ensureFormSettingsState();
            }

            const sites = this.getSiteOptions();
            const locationSelectId = personType === 'employee' ? 'violation-employee-location' : 'violation-contractor-location';
            const locationSelect = document.getElementById(locationSelectId);

            if (!locationSelect) return;

            locationSelect.innerHTML = '<option value="">-- اختر الموقع --</option>';

            if (sites && sites.length > 0) {
                sites.forEach(site => {
                    const option = document.createElement('option');
                    option.value = site.id;
                    option.textContent = site.name;
                    locationSelect.appendChild(option);
                });
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل المواقع:', error);
        }
    },

    loadPlaceOptions(siteId, selectedPlaceId = '', personType = 'employee') {
        try {
            const placeSelectId = personType === 'employee' ? 'violation-employee-place' : 'violation-contractor-place';
            const placeSelect = document.getElementById(placeSelectId);
            if (!placeSelect) return;

            placeSelect.innerHTML = '<option value="">-- اختر مكان المخالفة --</option>';

            if (!siteId) {
                return;
            }

            const places = this.getPlaceOptions(siteId);
            if (places && places.length > 0) {
                places.forEach(place => {
                    const option = document.createElement('option');
                    option.value = place.id;
                    option.textContent = place.name;
                    if (selectedPlaceId && (place.id === selectedPlaceId || place.name === selectedPlaceId)) {
                        option.selected = true;
                    }
                    placeSelect.appendChild(option);
                });
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل الأماكن:', error);
        }
    },

    async convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    async viewViolation(id) {
        const violation = AppState.appData.violations.find(v => v.id === id);
        if (!violation) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 750px; border-radius: 16px; overflow: hidden;">
                <div class="modal-header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px 24px;">
                    <h2 class="modal-title" style="color: white; display: flex; align-items: center; gap: 12px; font-size: 1.3rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                        تفاصيل المخالفة
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white; background: rgba(255,255,255,0.2); border-radius: 8px; width: 36px; height: 36px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div class="space-y-4">
                        <!-- معلومات المخالف (نفس التصميم للموظفين والمقاولين) -->
                        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                            <h3 style="font-weight: 600; color: #991b1b; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-user"></i> معلومات المخالف
                            </h3>
                            <div class="grid grid-cols-2 gap-4">
                                ${(violation.contractorName || violation.personType === 'contractor') ? `
                                <!-- مقاول: اسم المخالف (العامل) + الوظيفة + اسم المقاول + الإدارة -->
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">اسم المخالف:</label>
                                    <p class="text-gray-800 font-medium">${Utils.escapeHTML(violation.contractorWorker || violation.employeeName || violation.contractorName || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الوظيفة:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.contractorPosition || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">اسم المقاول:</label>
                                    <p class="text-gray-800 font-medium">${Utils.escapeHTML(violation.contractorName || '-')}</p>
                                </div>
                                ${violation.contractorDepartment ? `
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الإدارة:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.contractorDepartment || '-')}</p>
                                </div>
                                ` : ''}
                                ` : `
                                <!-- موظف: اسم المخالف + الكود الوظيفي + الوظيفة + الإدارة -->
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">اسم المخالف:</label>
                                    <p class="text-gray-800 font-medium">${Utils.escapeHTML(violation.employeeName || '-')}</p>
                                </div>
                                ${violation.employeeCode ? `
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الكود الوظيفي:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.employeeCode || violation.employeeNumber || '-')}</p>
                                </div>
                                ` : ''}
                                ${violation.employeePosition ? `
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الوظيفة:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.employeePosition || '-')}</p>
                                </div>
                                ` : ''}
                                ${violation.employeeDepartment ? `
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الإدارة:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.employeeDepartment || '-')}</p>
                                </div>
                                ` : ''}
                                `}
                            </div>
                        </div>

                        <!-- تفاصيل المخالفة -->
                        <div style="background: #fff7ed; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                            <h3 style="font-weight: 600; color: #c2410c; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-info-circle"></i> تفاصيل المخالفة
                            </h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">نوع المخالفة:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.violationType || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">تاريخ المخالفة:</label>
                                    <p class="text-gray-800">${violation.violationDate ? Utils.formatDate(violation.violationDate) : '-'}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الموقع:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.violationLocation || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">المكان:</label>
                                    <p class="text-gray-800">${Utils.escapeHTML(violation.violationPlace || '-')}</p>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الشدة:</label>
                                    <span style="display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 0.85rem; font-weight: 600; background: ${violation.severity === 'عالية' ? '#fef2f2' : violation.severity === 'متوسطة' ? '#fffbeb' : '#eff6ff'}; color: ${violation.severity === 'عالية' ? '#dc2626' : violation.severity === 'متوسطة' ? '#d97706' : '#2563eb'}; border: 1px solid ${violation.severity === 'عالية' ? '#fecaca' : violation.severity === 'متوسطة' ? '#fde68a' : '#bfdbfe'};">
                                        ${violation.severity || '-'}
                                    </span>
                                </div>
                                <div>
                                    <label class="text-sm font-semibold text-gray-600">الحالة:</label>
                                    <span style="display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 0.85rem; font-weight: 600; background: ${violation.status === 'محلول' ? '#ecfdf5' : '#fef3c7'}; color: ${violation.status === 'محلول' ? '#059669' : '#d97706'}; border: 1px solid ${violation.status === 'محلول' ? '#a7f3d0' : '#fde68a'};">
                                        ${violation.status || '-'}
                                    </span>
                                </div>
                            </div>
                            ${violation.violationDetails ? `
                            <div class="mt-4">
                                <label class="text-sm font-semibold text-gray-600">تفاصيل المخالفة:</label>
                                <p class="text-gray-800 mt-1 p-3 bg-white rounded-lg border">${Utils.escapeHTML(violation.violationDetails)}</p>
                            </div>
                            ` : ''}
                        </div>

                        <!-- الإجراء المتخذ -->
                        ${violation.actionTaken ? `
                        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                            <h3 style="font-weight: 600; color: #166534; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-tasks"></i> الإجراء المتخذ
                            </h3>
                            <p class="text-gray-800 p-3 bg-white rounded-lg border">${Utils.escapeHTML(violation.actionTaken)}</p>
                        </div>
                        ` : ''}

                        <!-- صورة المخالفة -->
                        ${(() => {
                            const photoUrl = this.processPhoto(violation.photo);
                            if (!photoUrl) return '';
                            const disp = typeof Utils.resolveDriveAwareImgDisplay === 'function'
                                ? Utils.resolveDriveAwareImgDisplay(photoUrl)
                                : { canonical: photoUrl, displaySrc: photoUrl, needsProxy: false, proxyFileId: '' };
                            const proxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(disp) : '';
                            return `
                        <div style="background: #f8fafc; border-radius: 12px; padding: 16px;">
                            <h3 style="font-weight: 600; color: #475569; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-image"></i> صورة المخالفة
                            </h3>
                            <img src="${Utils.escapeHTML(disp.displaySrc)}" alt="صورة المخالفة"${proxyAttr} class="violation-detail-photo w-full max-w-md h-64 object-cover rounded-lg border-2 border-gray-200 shadow-sm"
                                 onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22200%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                        </div>
                        `;})()}
                    </div>
                </div>
                <div class="modal-footer" style="background: #f8fafc; padding: 16px 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; border-radius: 10px;">إغلاق</button>
                    <button class="btn-primary" onclick="Violations.exportPDF('${violation.id}'); this.closest('.modal-overlay').remove();" style="background: linear-gradient(135deg, #10b981, #059669); padding: 10px 20px; border-radius: 10px;">
                        <i class="fas fa-file-pdf ml-2"></i>تصدير PDF
                    </button>
                    <button class="btn-primary" onclick="Violations.showViolationForm('${violation.id}'); this.closest('.modal-overlay').remove();" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 10px 20px; border-radius: 10px;">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(modal, {
                onFetchFail: (img) => {
                    try {
                        img.onerror = null;
                        img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22200%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';
                    } catch (e) { /* ignore */ }
                }
            });
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async exportPDF(id) {
        const violation = AppState.appData.violations.find(v => v.id === id);
        if (!violation) {
            Notification.error('المخالفة غير موجودة');
            return;
        }

        try {
            Loading.show();

            const companyLogo = (typeof AppState !== 'undefined' && AppState.companyLogo) ? AppState.companyLogo : '';
            const companySettings = (typeof AppState !== 'undefined' && AppState.companySettings)
                ? AppState.companySettings
                : { name: DEFAULT_COMPANY_NAME, address: '', phone: '', email: '' };
            const qrCodeData = `${window.location.origin}/violation/${violation.id}`;
            const qrCode = typeof QRCode !== 'undefined' ? QRCode.generate(qrCodeData, 100) : null;
            const formCode = violation.isoCode || `VIOL-${violation.id?.substring(0, 8) || 'UNKNOWN'}`;

            const htmlContent = FormHeader.generatePDFHTML(
                formCode,
                'تقرير مخالفة',
                `
                <table>
                    <tr><th>كود ISO</th><td>${Utils.escapeHTML(violation.isoCode || '')}</td></tr>
                    <tr><th>اسم المخالف</th><td>${Utils.escapeHTML((violation.contractorName || violation.personType === 'contractor') ? (violation.contractorWorker || violation.employeeName || violation.contractorName || '') : (violation.employeeName || ''))}</td></tr>
                    ${(violation.contractorName || violation.personType === 'contractor') ? `
                    ${violation.contractorPosition ? `<tr><th>الوظيفة</th><td>${Utils.escapeHTML(violation.contractorPosition || '')}</td></tr>` : ''}
                    <tr><th>اسم المقاول</th><td>${Utils.escapeHTML(violation.contractorName || '')}</td></tr>
                    ${violation.contractorDepartment ? `<tr><th>الإدارة</th><td>${Utils.escapeHTML(violation.contractorDepartment || '')}</td></tr>` : ''}
                    ` : `
                    ${violation.employeeCode ? `<tr><th>الكود الوظيفي</th><td>${Utils.escapeHTML(violation.employeeCode || violation.employeeNumber || '')}</td></tr>` : ''}
                    ${violation.employeePosition ? `<tr><th>الوظيفة</th><td>${Utils.escapeHTML(violation.employeePosition || '')}</td></tr>` : ''}
                    ${violation.employeeDepartment ? `<tr><th>الإدارة</th><td>${Utils.escapeHTML(violation.employeeDepartment || '')}</td></tr>` : ''}
                    `}
                    <tr><th>نوع المخالفة</th><td>${Utils.escapeHTML(violation.violationType || '')}</td></tr>
                    <tr><th>تاريخ المخالفة</th><td>${violation.violationDate ? Utils.formatDate(violation.violationDate) : '-'}</td></tr>
                    <tr><th>الموقع</th><td>${Utils.escapeHTML(violation.violationLocation || '')}</td></tr>
                    <tr><th>المكان</th><td>${Utils.escapeHTML(violation.violationPlace || '')}</td></tr>
                    <tr><th>الشدة</th><td>${Utils.escapeHTML(violation.severity || '')}</td></tr>
                    <tr><th>الحالة</th><td>${Utils.escapeHTML(violation.status || '')}</td></tr>
                    ${violation.violationDetails ? `<tr><th>تفاصيل المخالفة</th><td>${Utils.escapeHTML(violation.violationDetails || '')}</td></tr>` : ''}
                    <tr><th>الإجراء المتخذ</th><td>${Utils.escapeHTML(violation.actionTaken || '')}</td></tr>
                </table>
                ${(() => {
                    const photoUrl = this.processPhoto(violation.photo);
                    return photoUrl ? `
                    <div class="section-title">صورة المخالفة:</div>
                    <div style="text-align: center; margin: 20px 0;">
                        <img src="${Utils.escapeHTML(photoUrl)}" alt="صورة المخالفة" style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 8px;"
                             onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';">
                    </div>
                ` : '';})()}
                `,
                false, // لا QR في الرأس
                true,  // QR في الوتر
                { version: '1.0' },
                violation.createdAt,
                violation.updatedAt
            );

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    // Wait for images to load before printing
                    const images = printWindow.document.querySelectorAll('img');
                    let imagesLoaded = 0;
                    const totalImages = images.length;

                    if (totalImages === 0) {
                        // No images, print immediately
                        setTimeout(() => {
                            printWindow.print();
                            setTimeout(() => {
                                URL.revokeObjectURL(url);
                            }, 1000);
                            Loading.hide();
                        }, 300);
                    } else {
                        // Wait for all images to load
                        const checkAllImagesLoaded = () => {
                            if (imagesLoaded >= totalImages) {
                                setTimeout(() => {
                                    printWindow.print();
                                    setTimeout(() => {
                                        URL.revokeObjectURL(url);
                                    }, 1000);
                                    Loading.hide();
                                }, 300);
                            }
                        };

                        images.forEach(img => {
                            if (img.complete) {
                                // Image already loaded
                                imagesLoaded++;
                                checkAllImagesLoaded();
                            } else {
                                // Wait for image to load
                                img.onload = () => {
                                    imagesLoaded++;
                                    checkAllImagesLoaded();
                                };
                                img.onerror = () => {
                                    // Image failed to load, still proceed
                                    imagesLoaded++;
                                    checkAllImagesLoaded();
                                };
                            }
                        });

                        // Fallback: print after 3 seconds even if not all images loaded
                        setTimeout(() => {
                            if (imagesLoaded < totalImages) {
                                printWindow.print();
                                setTimeout(() => {
                                    URL.revokeObjectURL(url);
                                }, 1000);
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
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل في تصدير PDF: ' + error.message);
        }
    },

    // ===== Blacklist Register Functions =====
    /**
     * تحميل بيانات Blacklist من Google Sheets
     */
    async loadBlacklistDataAsync() {
        try {
            // التأكد من وجود AppState و GoogleIntegration
            if (typeof AppState === 'undefined' || !AppState.appData) {
                AppState.appData = {};
            }
            if (!AppState.appData.blacklistRegister) {
                AppState.appData.blacklistRegister = [];
            }

            // التحقق من تفعيل Google Integration
            const isGoogleEnabled = AppState.googleConfig?.appsScript?.enabled && AppState.googleConfig?.appsScript?.scriptUrl;
            const isGoogleIntegrationAvailable = typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.sendRequest === 'function';

            if (!isGoogleEnabled || !isGoogleIntegrationAvailable) {
                // إذا لم يكن Google Integration متاحاً، استخدام البيانات المحلية
                if (AppState.debugMode) {
                    Utils.safeLog('⚠️ Google Integration غير متاح - استخدام البيانات المحلية فقط');
                }
                return;
            }

            // تحميل البيانات من Google Sheets (بدون عرض مؤشر تحميل - الواجهة تُعرض أولاً)
            const result = await GoogleIntegration.sendRequest({
                action: 'readFromSheet',
                data: {
                    sheetName: 'Blacklist_Register',
                    spreadsheetId: AppState.googleConfig?.sheets?.spreadsheetId
                }
            }).catch(error => {
                Utils.safeWarn('⚠️ تعذر تحميل بيانات Blacklist من Google Sheets:', error);
                return { success: false, data: [] };
            });

            let dataUpdated = false;
            if (result && result.success && Array.isArray(result.data)) {
                AppState.appData.blacklistRegister = result.data;
                dataUpdated = true;
                if (AppState.debugMode) {
                    Utils.safeLog(`✅ تم تحميل ${result.data.length} سجل Blacklist من Google Sheets`);
                }
            } else {
                // التأكد من وجود مصفوفة فارغة إذا لم يتم تحميل البيانات
                if (!AppState.appData.blacklistRegister) {
                    AppState.appData.blacklistRegister = [];
                }
            }

            // حفظ البيانات محلياً بعد التحميل
            if (dataUpdated && typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                try {
                    window.DataManager.save();
                } catch (saveError) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ خطأ في حفظ البيانات محلياً:', saveError);
                    }
                }
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل بيانات Blacklist:', error);
            // التأكد من وجود مصفوفة فارغة في حالة الخطأ
            if (!AppState.appData.blacklistRegister) {
                AppState.appData.blacklistRegister = [];
            }
        }
    },

    /**
     * تحديث عرض Blacklist بعد تحميل البيانات
     */
    refreshBlacklistDisplay() {
        const contentContainer = document.getElementById('violations-tab-content');
        if (!contentContainer) return;

        // التحقق من أن التبويب النشط هو blacklist
        const activeTab = document.querySelector('.tab-btn.active[data-tab="blacklist"]');
        if (!activeTab) return;

        try {
            // تحديث الإحصائيات - البحث عن container الإحصائيات
            const cardBody = contentContainer.querySelector('.card-body');
            if (cardBody) {
                // البحث عن grid container للإحصائيات (قد يكون بأي من الصيغ)
                const statsContainer = cardBody.querySelector('.grid.grid-cols-1') || 
                                      cardBody.querySelector('.grid') ||
                                      cardBody.querySelector('[class*="grid-cols"]');
                if (statsContainer && statsContainer.parentElement) {
                    statsContainer.outerHTML = this.renderBlacklistStats();
                } else {
                    // إذا لم نجد container، نبحث عن أول div في card-body ونستبدله
                    const firstGrid = cardBody.querySelector('div > div.grid');
                    if (firstGrid) {
                        firstGrid.outerHTML = this.renderBlacklistStats();
                    }
                }
            }

            // تحديث الكروت
            const cardsContainer = document.getElementById('blacklist-cards-container');
            if (cardsContainer) {
                cardsContainer.innerHTML = this.renderBlacklistCards();
            }

            // تحديث الجدول
            const tableContainer = document.getElementById('blacklist-table-container');
            if (tableContainer) {
                tableContainer.innerHTML = this.renderBlacklistTable();
            }

            // إعادة إعداد Event Listeners
            this.setupBlacklistEventListeners();
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تحديث عرض Blacklist:', error);
        }
    },

    renderBlacklistTab() {
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <h2 class="card-title">
                            <i class="fas fa-user-slash ml-2"></i>
                            سجل الممنوعين من الدخول – Blacklist
                        </h2>
                        <button id="blacklist-add-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            تسجيل ممنوع من الدخول جديد
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- إحصائيات سريعة -->
                    ${this.renderBlacklistStats()}
                    
                    <!-- كروت عرض البيانات -->
                    <div id="blacklist-cards-container" class="mb-6">
                        ${this.renderBlacklistCards()}
                    </div>
                    
                    <!-- جدول عرض البيانات -->
                    <div id="blacklist-table-container">
                        ${this.renderBlacklistTable()}
                    </div>
                </div>
            </div>
        `;
    },

    renderBlacklistStats() {
        const blacklistRecords = AppState.appData?.blacklistRegister || [];
        const totalCount = blacklistRecords.length;
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const thisMonthCount = blacklistRecords.filter(r => {
            if (!r.banDate) return false;
            const date = new Date(r.banDate);
            return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
        }).length;

        // حساب عدد المصانع/المواقع الفريدة
        const uniqueFactoryLocation = new Set();
        blacklistRecords.forEach(r => {
            if (r.factory && r.location) {
                uniqueFactoryLocation.add(`${r.factory} - ${r.location}`);
            } else if (r.factory) {
                uniqueFactoryLocation.add(r.factory);
            } else if (r.location) {
                uniqueFactoryLocation.add(r.location);
            }
        });
        const factoryLocationCount = uniqueFactoryLocation.size;

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div class="stat-card blacklist-stat-card blacklist-stat-total" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border: none; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.3), 0 2px 4px -1px rgba(220, 38, 38, 0.2); transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgba(220, 38, 38, 0.4), 0 4px 6px -2px rgba(220, 38, 38, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(220, 38, 38, 0.3), 0 2px 4px -1px rgba(220, 38, 38, 0.2)';">
                    <div class="stat-icon" style="background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(10px); width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <i class="fas fa-user-slash"></i>
                    </div>
                    <div class="stat-content" style="flex: 1;">
                        <h3 class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; line-height: 1.2; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${typeof totalCount === 'number' ? totalCount.toLocaleString('en-US') : totalCount}</h3>
                        <p class="stat-label" style="font-size: 1rem; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin: 0; letter-spacing: 0.3px;">إجمالي الممنوعين</p>
                    </div>
                </div>
                <div class="stat-card blacklist-stat-card blacklist-stat-month" style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); border: none; box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.3), 0 2px 4px -1px rgba(234, 88, 12, 0.2); transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgba(234, 88, 12, 0.4), 0 4px 6px -2px rgba(234, 88, 12, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(234, 88, 12, 0.3), 0 2px 4px -1px rgba(234, 88, 12, 0.2)';">
                    <div class="stat-icon" style="background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(10px); width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div class="stat-content" style="flex: 1;">
                        <h3 class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; line-height: 1.2; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${typeof thisMonthCount === 'number' ? thisMonthCount.toLocaleString('en-US') : thisMonthCount}</h3>
                        <p class="stat-label" style="font-size: 1rem; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin: 0; letter-spacing: 0.3px;">هذا الشهر</p>
                    </div>
                </div>
                <div class="stat-card blacklist-stat-card blacklist-stat-details" style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); border: none; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.3), 0 2px 4px -1px rgba(217, 119, 6, 0.2); transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgba(217, 119, 6, 0.4), 0 4px 6px -2px rgba(217, 119, 6, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(217, 119, 6, 0.3), 0 2px 4px -1px rgba(217, 119, 6, 0.2)';">
                    <div class="stat-icon" style="background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(10px); width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="stat-content" style="flex: 1;">
                        <h3 class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; line-height: 1.2; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${blacklistRecords.filter(r => r.banReason && r.banReason.length > 50).length.toLocaleString('en-US')}</h3>
                        <p class="stat-label" style="font-size: 1rem; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin: 0; letter-spacing: 0.3px;">ممنوعين مع تفاصيل</p>
                    </div>
                </div>
                <div class="stat-card blacklist-stat-card blacklist-stat-factory-location" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: none; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.3), 0 2px 4px -1px rgba(124, 58, 237, 0.2); transition: all 0.3s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgba(124, 58, 237, 0.4), 0 4px 6px -2px rgba(124, 58, 237, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(124, 58, 237, 0.3), 0 2px 4px -1px rgba(124, 58, 237, 0.2)';">
                    <div class="stat-icon" style="background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(10px); width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <i class="fas fa-industry"></i>
                    </div>
                    <div class="stat-content" style="flex: 1;">
                        <h3 class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; line-height: 1.2; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${typeof factoryLocationCount === 'number' ? factoryLocationCount.toLocaleString('en-US') : factoryLocationCount}</h3>
                        <p class="stat-label" style="font-size: 1rem; font-weight: 600; color: rgba(255, 255, 255, 0.95); margin: 0; letter-spacing: 0.3px;">المصنع - الموقع</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * معالجة وعرض الصور بشكل صحيح (Base64 أو URL)
     * @param {string} photoData - بيانات الصورة (Base64 أو URL)
     * @returns {string|null} - رابط صالح للاستخدام في img src
     */
    getPhotoSource(photoData) {
        if (typeof Utils !== 'undefined' && typeof Utils.extractImageSourceCandidate === 'function') {
            return Utils.extractImageSourceCandidate(photoData);
        }
        if (!photoData) {
            return '';
        }
        return typeof photoData === 'string' ? photoData : '';
    },

    normalizeGoogleDrivePhotoUrl(url) {
        if (typeof Utils !== 'undefined' && typeof Utils.normalizeGoogleDriveImageUrl === 'function') {
            return Utils.normalizeGoogleDriveImageUrl(url);
        }
        return String(url || '').trim();
    },

    processPhoto(photoData) {
        if (typeof Utils !== 'undefined' && typeof Utils.normalizeImageSource === 'function') {
            const normalized = Utils.normalizeImageSource(photoData);
            if (normalized) {
                return normalized;
            }
        }

        const rawPhoto = this.getPhotoSource(photoData);
        if (!rawPhoto) {
            return null;
        }

        let trimmed = String(rawPhoto).trim().replace(/^['"`]+|['"`]+$/g, '');
        if (!trimmed) {
            return null;
        }

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
            return payload ? `${header},${payload}` : null;
        }

        if (/^https?:\/\//i.test(trimmed)) {
            return this.normalizeGoogleDrivePhotoUrl(trimmed);
        }

        const compactBase64 = trimmed.replace(/\s+/g, '');
        if (compactBase64.length > 100 && /^[A-Za-z0-9+/=]+$/.test(compactBase64.substring(0, Math.min(120, compactBase64.length)))) {
            return 'data:image/jpeg;base64,' + compactBase64;
        }

        if (AppState.debugMode) {
            console.warn('⚠️ صورة غير صالحة:', trimmed.substring(0, 100));
        }
        return null;
    },

    _onBlacklistCardPhotoError(img) {
        try {
            if (!img) return;
            img.onerror = null;
            const d = document.createElement('div');
            d.className = 'w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center border-2 border-red-200 dark:border-red-800';
            d.innerHTML = '<i class="fas fa-user text-red-500 dark:text-red-400 text-2xl"></i>';
            img.replaceWith(d);
        } catch (e) { /* ignore */ }
    },

    _onBlacklistTablePhotoError(img) {
        try {
            if (!img) return;
            img.onerror = null;
            img.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2212%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';
        } catch (e) { /* ignore */ }
    },

    _hydrateBlacklistDrivePhotos() {
        try {
            if (typeof Utils.hydrateDriveProxyImages !== 'function') return;
            const fail = (img) => {
                if (!img) return;
                const cls = img.className || '';
                if (cls.indexOf('blacklist-table-photo') !== -1) {
                    this._onBlacklistTablePhotoError(img);
                } else if (cls.indexOf('blacklist-detail-photo') !== -1) {
                    this._onBlacklistTablePhotoError(img);
                } else if (cls.indexOf('blacklist-form-photo') !== -1) {
                    this._onBlacklistTablePhotoError(img);
                } else {
                    this._onBlacklistCardPhotoError(img);
                }
            };
            const cards = document.getElementById('blacklist-cards-container');
            const table = document.getElementById('blacklist-table');
            if (cards) Utils.hydrateDriveProxyImages(cards, { onFetchFail: fail });
            if (table) Utils.hydrateDriveProxyImages(table, { onFetchFail: fail });
        } catch (e) { /* ignore */ }
    },

    renderBlacklistCards() {
        const blacklistRecords = AppState.appData?.blacklistRegister || [];
        if (blacklistRecords.length === 0) {
            return `
                <div class="empty-state py-8">
                    <i class="fas fa-user-slash text-gray-400 text-5xl mb-4"></i>
                    <p class="text-gray-500 text-lg">لا توجد سجلات ممنوعين من الدخول</p>
                    <p class="text-gray-400 text-sm mt-2">انقر على "تسجيل ممنوع من الدخول جديد" لإضافة سجل جديد</p>
                </div>
            `;
        }

        const sortedRecords = [...blacklistRecords].sort((a, b) => {
            const dateA = new Date(a.banDate || a.createdAt || 0);
            const dateB = new Date(b.banDate || b.createdAt || 0);
            return dateB - dateA;
        });

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${sortedRecords.map(record => {
                    const photoUrl = this.processPhoto(record);
                    const disp = photoUrl && typeof Utils.resolveDriveAwareImgDisplay === 'function'
                        ? Utils.resolveDriveAwareImgDisplay(photoUrl)
                        : { canonical: photoUrl || '', displaySrc: photoUrl || '', needsProxy: false, proxyFileId: '' };
                    const imgSrc = disp.canonical ? disp.displaySrc : '';
                    const proxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(disp) : '';
                    return `
                    <div class="content-card blacklist-card" style="position: relative; overflow: hidden;">
                        <div class="absolute top-0 right-0 w-20 h-20 bg-red-100 dark:bg-red-900/20 opacity-10 rounded-bl-full"></div>
                        <div class="relative z-10">
                            <div class="p-4">
                                <div class="flex items-start justify-between mb-3">
                                    <div class="flex items-center gap-3">
                                        ${photoUrl ? `
                                            <img src="${Utils.escapeHTML(imgSrc)}" alt="صورة"${proxyAttr}
                                                data-photo-url="${Utils.escapeHTML(photoUrl)}"
                                                class="blacklist-card-photo w-16 h-16 rounded-full object-cover border-2 border-red-200 dark:border-red-800 cursor-pointer shadow-sm"
                                                onclick="Violations.viewBlacklistPhoto(this.dataset.photoUrl)"
                                                title="انقر لعرض الصورة"
                                                onerror="Violations._onBlacklistCardPhotoError(this)">
                                        ` : `
                                            <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center border-2 border-red-200 dark:border-red-800">
                                                <i class="fas fa-user text-red-500 dark:text-red-400 text-2xl"></i>
                                            </div>
                                        `}
                                        <div>
                                            <h3 class="font-bold text-gray-800 dark:text-gray-100 text-lg">${Utils.escapeHTML(record.fullName || 'غير محدد')}</h3>
                                            <p class="text-sm text-gray-600 dark:text-gray-400">#${record.serialNumber || '-'}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <button onclick="Violations.editBlacklistRecord('${record.id}')" 
                                            class="btn-icon btn-icon-warning text-xs" title="تعديل">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="Violations.deleteBlacklistRecord('${record.id}')" 
                                            class="btn-icon btn-icon-danger text-xs" title="حذف">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="space-y-2 text-sm">
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-id-card text-red-500 dark:text-red-400 w-4"></i>
                                        <span class="text-gray-600 dark:text-gray-400">رقم البطاقة:</span>
                                        <span class="font-semibold text-gray-800 dark:text-gray-200">${Utils.escapeHTML(record.idNumber || '-')}</span>
                                    </div>
                                    ${record.job ? `
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-briefcase text-red-500 dark:text-red-400 w-4"></i>
                                        <span class="text-gray-600 dark:text-gray-400">الوظيفة:</span>
                                        <span class="font-semibold text-gray-800 dark:text-gray-200">${Utils.escapeHTML(record.job)}</span>
                                    </div>
                                    ` : ''}
                                    ${record.contractor ? `
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-building text-cyan-500 dark:text-cyan-400 w-4"></i>
                                        <span class="text-gray-600 dark:text-gray-400">الشركة - المقاول:</span>
                                        <span class="font-semibold text-gray-800 dark:text-gray-200">${Utils.escapeHTML(record.contractor)}</span>
                                    </div>
                                    ` : ''}
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-industry text-red-500 dark:text-red-400 w-4"></i>
                                        <span class="text-gray-600 dark:text-gray-400">المصنع:</span>
                                        <span class="font-semibold text-gray-800 dark:text-gray-200">${Utils.escapeHTML(record.factory || '-')}</span>
                                    </div>
                                    ${record.location ? `
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-map-marker-alt text-red-500 dark:text-red-400 w-4"></i>
                                        <span class="text-gray-600 dark:text-gray-400">الموقع:</span>
                                        <span class="font-semibold text-gray-800 dark:text-gray-200">${Utils.escapeHTML(record.location)}</span>
                                    </div>
                                    ` : ''}
                                    <div class="flex items-center gap-2">
                                        <i class="fas fa-calendar text-red-500 dark:text-red-400 w-4"></i>
                                        <span class="text-gray-600 dark:text-gray-400">تاريخ المنع:</span>
                                        <span class="font-semibold text-red-600 dark:text-red-400">${record.banDate ? Utils.formatDate(record.banDate) : '-'}</span>
                                    </div>
                                    ${record.banReason ? `
                                    <div class="pt-2 border-t border-red-100 dark:border-red-900/50">
                                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">سبب المنع:</p>
                                        <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">${Utils.escapeHTML(record.banReason)}</p>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-t border-red-100 dark:border-red-900/30 flex items-center justify-between text-xs">
                                <span class="text-gray-600 dark:text-gray-400">
                                    <i class="fas fa-user-edit ml-1 text-red-500 dark:text-red-400"></i>
                                    ${Utils.escapeHTML(record.editor || 'غير محدد')}
                                </span>
                                ${record.bannedBy ? `
                                <span class="text-gray-600 dark:text-gray-400">
                                    <i class="fas fa-user-shield ml-1 text-red-500 dark:text-red-400"></i>
                                    ${Utils.escapeHTML(record.bannedBy)}
                                </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;}).join('')}
            </div>
        `;
    },

    async showBlacklistForm(blacklistData = null) {
        const isEdit = !!blacklistData;

        // التأكد من تحميل إعدادات النماذج
        if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
            try {
                await Permissions.ensureFormSettingsState();
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل إعدادات النماذج:', error);
            }
        }

        const blacklistRecords = AppState.appData?.blacklistRegister || [];
        const nextSerial = blacklistRecords.length > 0
            ? Math.max(...blacklistRecords.map(r => parseInt(r.serialNumber) || 0)) + 1
            : 1;

        // استخدام نفس نظام تحميل المواقع والأماكن المستخدم في violations
        const sites = this.getSiteOptions();
        const siteOptions = sites.map(site =>
            `<option value="${Utils.escapeHTML(site.name)}" data-site-id="${site.id}" ${blacklistData?.factory === site.name || blacklistData?.factoryId === site.id ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>`
        ).join('');

        // تحميل الإدارات
        const settings = AppState.appData?.formSettings || {};
        const departments = settings.departments || [];
        // تحويل الإدارات إلى قائمة للـ datalist (اسم فقط)
        const departmentList = departments.map(dept => {
            // إذا كان dept كائن، نأخذ name، وإذا كان نصًا، نستخدمه مباشرة
            return typeof dept === 'object' ? dept.name : dept;
        }).filter(Boolean);
        const departmentOptions = departmentList.map(dept =>
            `<option value="${Utils.escapeHTML(dept)}"></option>`
        ).join('');

        // الحصول على الأماكن حسب المصنع المحدد
        const selectedSiteId = blacklistData?.factoryId || sites.find(s => s.name === blacklistData?.factory)?.id || '';
        const placeOptions = selectedSiteId ? this.getPlaceOptions(selectedSiteId).map(place =>
            `<option value="${Utils.escapeHTML(place.name)}" data-place-id="${place.id}" ${blacklistData?.location === place.name || blacklistData?.locationId === place.id ? 'selected' : ''}>${Utils.escapeHTML(place.name)}</option>`
        ).join('') : '<option value="">-- اختر الموقع أولاً --</option>';

        // الحصول على المستخدم الحالي
        const currentUser = AppState.currentUser || { name: 'غير محدد', email: '' };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-user-slash ml-2 text-red-600"></i>
                        ${isEdit ? 'تعديل بيانات الممنوع من الدخول' : 'تسجيل ممنوع من الدخول جديد'}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${this.renderBlacklistFormContent(blacklistData, nextSerial, siteOptions, placeOptions, departmentOptions, currentUser)}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Setup form event listeners (async)
        this.setupBlacklistFormInModal(modal, blacklistData).catch(error => {
            Utils.safeWarn('⚠️ خطأ في إعداد نموذج Blacklist:', error);
        });

        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(modal, {
                onFetchFail: (img) => this._onBlacklistTablePhotoError(img)
            });
        }

        // إغلاق النموذج عند النقر خارجه
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // إغلاق النموذج عند الضغط على ESC
        const handleEscape = (e) => {
            if (e.key === 'Escape' && document.body.contains(modal)) {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    },

    renderBlacklistFormContent(blacklistData, nextSerial, siteOptions, placeOptions, departmentOptions, currentUser) {
        const isEdit = !!blacklistData;
        const previewPhotoUrl = this.processPhoto(blacklistData);
        const previewDisp = previewPhotoUrl && typeof Utils.resolveDriveAwareImgDisplay === 'function'
            ? Utils.resolveDriveAwareImgDisplay(previewPhotoUrl)
            : { canonical: previewPhotoUrl || '', displaySrc: previewPhotoUrl || '', needsProxy: false, proxyFileId: '' };
        const previewImgSrc = previewDisp.canonical ? previewDisp.displaySrc : '';
        const previewProxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(previewDisp) : '';
        return `
            <form id="blacklist-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <!-- م (رقم مسلسل) -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-hashtag ml-2 text-blue-600"></i>
                            م (رقم مسلسل)
                        </label>
                        <input type="text" id="blacklist-serial" class="form-input" 
                            value="${isEdit ? (blacklistData.serialNumber || nextSerial) : nextSerial}" 
                            readonly>
                    </div>

                    <!-- تاريخ المنع * -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-calendar ml-2 text-red-600"></i>
                            تاريخ المنع *
                        </label>
                        <input type="date" id="blacklist-ban-date" required class="form-input" 
                            value="${blacklistData?.banDate ? new Date(blacklistData.banDate).toISOString().slice(0, 10) : ''}">
                    </div>

                    <!-- المصنع * -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-industry ml-2 text-gray-600"></i>
                            المصنع *
                        </label>
                        <select id="blacklist-factory" required class="form-input">
                            <option value="">-- اختر المصنع --</option>
                            ${siteOptions}
                        </select>
                    </div>

                    <!-- الموقع * -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-map-marker-alt ml-2 text-green-600"></i>
                            الموقع *
                        </label>
                        <select id="blacklist-location" required class="form-input">
                            <option value="">-- اختر الموقع --</option>
                            ${placeOptions}
                        </select>
                    </div>

                    <!-- الاسم رباعي * -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-user ml-2 text-purple-600"></i>
                            الاسم رباعي *
                        </label>
                        <input type="text" id="blacklist-name" required class="form-input" 
                            value="${Utils.escapeHTML(blacklistData?.fullName || '')}" 
                            placeholder="الاسم الكامل">
                    </div>

                    <!-- رقم البطاقة الشخصية * -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-id-card ml-2 text-orange-600"></i>
                            رقم البطاقة الشخصية *
                        </label>
                        <input type="text" id="blacklist-id-number" required class="form-input" 
                            value="${Utils.escapeHTML(blacklistData?.idNumber || '')}" 
                            placeholder="رقم البطاقة">
                    </div>

                    <!-- الوظيفة -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-briefcase ml-2 text-indigo-600"></i>
                            الوظيفة
                        </label>
                        <input type="text" id="blacklist-job" class="form-input" 
                            value="${Utils.escapeHTML(blacklistData?.job || '')}" 
                            placeholder="الوظيفة">
                    </div>

                    <!-- الشركة - المقاول -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-building ml-2 text-cyan-600"></i>
                            الشركة - المقاول
                        </label>
                        <input type="text" id="blacklist-contractor" class="form-input" 
                            list="blacklist-contractors-list" 
                            value="${Utils.escapeHTML(blacklistData?.contractor || '')}" 
                            placeholder="اختر أو اكتب اسم الشركة/المقاول">
                        <datalist id="blacklist-contractors-list">
                            <!-- سيتم تحميل المقاولين ديناميكياً -->
                        </datalist>
                    </div>

                    <!-- الإدارة التابع لها -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-building ml-2 text-teal-600"></i>
                            الإدارة التابع لها
                        </label>
                        <input type="text" id="blacklist-department" class="form-input" 
                            list="blacklist-departments-list" 
                            value="${Utils.escapeHTML(blacklistData?.department || '')}" 
                            placeholder="اختر أو اكتب الإدارة">
                        <datalist id="blacklist-departments-list">
                            ${departmentOptions}
                        </datalist>
                    </div>

                    <!-- القائم بالمنع -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-user-shield ml-2 text-yellow-600"></i>
                            القائم بالمنع
                        </label>
                        <input type="text" id="blacklist-banned-by" class="form-input" 
                            value="${Utils.escapeHTML(blacklistData?.bannedBy || '')}" 
                            placeholder="اسم القائم بالمنع">
                    </div>

                    <!-- محرر البيانات -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-user-edit ml-2 text-gray-600"></i>
                            محرر البيانات
                        </label>
                        <input type="text" id="blacklist-editor" class="form-input" 
                            value="${Utils.escapeHTML(blacklistData?.editor || currentUser.name)}" 
                            readonly>
                    </div>

                    <!-- الصورة الشخصية -->
                    <div class="md:col-span-2 lg:col-span-3">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-image ml-2"></i>
                            الصورة الشخصية
                        </label>
                        <input type="file" id="blacklist-photo-input" accept="image/*" class="form-input">
                        <div id="blacklist-photo-preview" class="mt-2 ${previewPhotoUrl ? '' : 'hidden'}">
                            <img src="${previewImgSrc ? Utils.escapeHTML(previewImgSrc) : ''}" alt="صورة شخصية"${previewProxyAttr}
                                class="blacklist-form-photo w-32 h-32 object-cover rounded border" id="blacklist-photo-img">
                            <button type="button" onclick="const blPhotoInput = document.getElementById('blacklist-photo-input'); if (blPhotoInput) blPhotoInput.value=''; const blPhotoPreview = document.getElementById('blacklist-photo-preview'); if (blPhotoPreview) blPhotoPreview.classList.add('hidden');" 
                                class="mt-2 text-sm text-red-600 hover:text-red-800">
                                <i class="fas fa-trash ml-1"></i>حذف الصورة
                            </button>
                        </div>
                    </div>

                    <!-- سبب المنع * -->
                    <div class="md:col-span-2 lg:col-span-3">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-exclamation-triangle ml-2 text-red-600"></i>
                            سبب المنع *
                        </label>
                        <textarea id="blacklist-ban-reason" required class="form-input" rows="3" 
                            placeholder="سبب منع الدخول">${Utils.escapeHTML(blacklistData?.banReason || '')}</textarea>
                    </div>

                    <!-- ملاحظات عامة -->
                    <div class="md:col-span-2 lg:col-span-3">
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-sticky-note ml-2 text-gray-600"></i>
                            ملاحظات عامة
                        </label>
                        <textarea id="blacklist-notes" class="form-input" rows="3" 
                            placeholder="ملاحظات إضافية">${Utils.escapeHTML(blacklistData?.notes || '')}</textarea>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-4 pt-4 border-t">
                    <button type="button" id="blacklist-cancel-btn" class="btn-secondary">
                        <i class="fas fa-times ml-2"></i>إلغاء
                    </button>
                    <button type="submit" id="blacklist-submit-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>${isEdit ? 'حفظ التعديلات' : 'تسجيل'}
                    </button>
                </div>
            </form>
        `;
    },

    async setupBlacklistFormInModal(modal, blacklistData) {
        const isEdit = !!blacklistData;
        const form = modal.querySelector('#blacklist-form');
        if (form) {
            form.dataset.editId = isEdit ? blacklistData.id : '';
        }

        // معالج النموذج
        if (form) {
            form.addEventListener('submit', (e) => this.handleBlacklistSubmit(e));
        }

        // معالج إلغاء النموذج
        const cancelBtn = modal.querySelector('#blacklist-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
        }

        // معالج رفع الصورة
        const photoInput = modal.querySelector('#blacklist-photo-input');
        if (photoInput) {
            photoInput.addEventListener('change', (e) => this.handleBlacklistPhotoUpload(e));
        }

        // تحميل قائمة المقاولين في datalist
        const contractorInput = modal.querySelector('#blacklist-contractor');
        const contractorsDatalist = modal.querySelector('#blacklist-contractors-list');
        if (contractorInput && contractorsDatalist) {
            try {
                // الحصول على قائمة المقاولين
                let contractors = [];
                
                // محاولة استخدام getAllContractorsForModules
                if (typeof Contractors !== 'undefined' && typeof Contractors.getAllContractorsForModules === 'function') {
                    contractors = Contractors.getAllContractorsForModules() || [];
                }
                
                // ✅ تحسين: بديل: استخدام AppState (بما في ذلك المعتمدين) - مباشرة بدون تأخير
                if (contractors.length === 0) {
                    // دمج المقاولين النشطين فقط من مصادر مختلفة
                    const allContractors = [
                        ...(AppState.appData?.approvedContractors || []),
                        ...(AppState.appData?.contractors || [])
                    ].filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE');
                    // إزالة التكرار بناءً على ID
                    const uniqueContractors = Array.from(
                        new Map(allContractors.map(c => [c.id || c.contractorId, c])).values()
                    );
                    contractors = uniqueContractors
                        .filter(c => c && (c.name || c.companyName || c.contractorName))
                        .map(c => ({
                            id: c.id || c.contractorId || '',
                            name: (c.name || c.companyName || c.contractorName || '').trim()
                        }))
                        .filter(c => c.name && c.name !== 'غير معروف')
                        .sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
                }

                // إضافة المقاولين إلى datalist (اسم المقاول فقط بدون الإدارة)
                contractorsDatalist.innerHTML = contractors.map(c => 
                    `<option value="${Utils.escapeHTML(c.name)}" data-contractor-id="${c.id || ''}"></option>`
                ).join('');

                // التأكد من أن قيمة المقاول في الحقل هي اسم المقاول فقط (بدون الإدارة)
                if (blacklistData?.contractor) {
                    // إذا كانت القيمة تحتوي على " - " (فاصل بين المقاول والإدارة)، نأخذ الجزء الأول فقط
                    const contractorValue = blacklistData.contractor.split(' - ')[0].trim();
                    contractorInput.value = contractorValue;
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل قائمة المقاولين:', error);
            }
        }

        // معالج تغيير المصنع (لتحميل الأماكن)
        const factorySelect = modal.querySelector('#blacklist-factory');
        if (factorySelect) {
            factorySelect.addEventListener('change', async (e) => {
                const selectedOption = e.target.selectedOptions[0];
                const siteId = selectedOption?.dataset.siteId || selectedOption?.value;
                await this.loadBlacklistPlaces(siteId);
            });

            // تحميل الأماكن عند فتح النموذج للتعديل
            if (isEdit && blacklistData?.factoryId) {
                const siteId = blacklistData.factoryId;
                try {
                    await this.loadBlacklistPlaces(siteId);
                    // تحديد الموقع بعد تحميله
                    setTimeout(() => {
                        const locationSelect = modal.querySelector('#blacklist-location');
                        if (locationSelect && blacklistData?.location) {
                            locationSelect.value = blacklistData.location;
                        }
                    }, 100);
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل الأماكن:', error);
                }
            }
        }
    },


    renderBlacklistTable() {
        const blacklistRecords = AppState.appData?.blacklistRegister || [];
        const sortedRecords = [...blacklistRecords].sort((a, b) => {
            const dateA = new Date(a.banDate || a.createdAt || 0);
            const dateB = new Date(b.banDate || b.createdAt || 0);
            return dateB - dateA;
        });

        if (sortedRecords.length === 0) {
            return `
                <div class="mt-6">
                    <div class="empty-state">
                        <i class="fas fa-user-slash text-gray-400 text-4xl mb-4"></i>
                        <p class="text-gray-500">لا توجد سجلات ممنوعين من الدخول</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="mt-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-gray-800">
                        <i class="fas fa-list ml-2"></i>قائمة الممنوعين من الدخول
                    </h3>
                    <div class="flex items-center gap-2">
                        <input type="text" id="blacklist-search" class="form-input" 
                            placeholder="بحث..." style="width: 250px;">
                        <button id="blacklist-export-pdf" class="btn-secondary">
                            <i class="fas fa-file-pdf ml-2"></i>PDF
                        </button>
                        <button id="blacklist-export-excel" class="btn-secondary">
                            <i class="fas fa-file-excel ml-2"></i>Excel
                        </button>
                    </div>
                </div>
                <div class="table-wrapper" style="overflow-x: auto;">
                    <table class="data-table" id="blacklist-table">
                        <thead>
                            <tr>
                        <th>م</th>
                        <th>تاريخ المنع</th>
                        <th>المصنع</th>
                        <th>الموقع</th>
                        <th>الاسم رباعي</th>
                        <th>رقم البطاقة</th>
                        <th>الوظيفة</th>
                        <th>الشركة - المقاول</th>
                        <th>الإدارة</th>
                        <th>القائم بالمنع</th>
                        <th>محرر البيانات</th>
                        <th>الصورة</th>
                        <th>سبب المنع</th>
                        <th>ملاحظات</th>
                        <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="blacklist-table-body">
                            ${sortedRecords.map(record => {
                                const photoUrl = this.processPhoto(record);
                                const disp = photoUrl && typeof Utils.resolveDriveAwareImgDisplay === 'function'
                                    ? Utils.resolveDriveAwareImgDisplay(photoUrl)
                                    : { canonical: photoUrl || '', displaySrc: photoUrl || '', needsProxy: false, proxyFileId: '' };
                                const imgSrc = disp.canonical ? disp.displaySrc : '';
                                const proxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(disp) : '';
                                return `
                                <tr>
                                    <td>${record.serialNumber || '-'}</td>
                                    <td>${record.banDate ? Utils.formatDate(record.banDate) : '-'}</td>
                                    <td>${Utils.escapeHTML(record.factory || '-')}</td>
                                    <td>${Utils.escapeHTML(record.location || '-')}</td>
                                    <td>${Utils.escapeHTML(record.fullName || '-')}</td>
                                    <td>${Utils.escapeHTML(record.idNumber || '-')}</td>
                                    <td>${Utils.escapeHTML(record.job || '-')}</td>
                                    <td>${Utils.escapeHTML(record.contractor || '-')}</td>
                                    <td>${Utils.escapeHTML(record.department || '-')}</td>
                                    <td>${Utils.escapeHTML(record.bannedBy || '-')}</td>
                                    <td>${Utils.escapeHTML(record.editor || '-')}</td>
                                    <td>
                                        ${photoUrl ? 
                `<img src="${Utils.escapeHTML(imgSrc)}" alt="صورة"${proxyAttr} class="blacklist-table-photo w-12 h-12 object-cover rounded cursor-pointer"
                                                data-photo-url="${Utils.escapeHTML(photoUrl)}"
                                                onclick="Violations.viewBlacklistPhoto(this.dataset.photoUrl)" title="انقر لعرض الصورة"
                                                onerror="Violations._onBlacklistTablePhotoError(this)">` 
                : '-'}
                                    </td>
                                    <td class="max-w-xs truncate" title="${Utils.escapeHTML(record.banReason || '')}">
                                        ${Utils.escapeHTML((record.banReason || '-').substring(0, 50))}${(record.banReason || '').length > 50 ? '...' : ''}
                                    </td>
                                    <td class="max-w-xs truncate" title="${Utils.escapeHTML(record.notes || '')}">
                                        ${Utils.escapeHTML((record.notes || '-').substring(0, 30))}${(record.notes || '').length > 30 ? '...' : ''}
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button onclick="Violations.viewBlacklistDetails('${record.id}')" 
                                                class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button onclick="Violations.editBlacklistRecord('${record.id}')" 
                                                class="btn-icon btn-icon-warning" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="Violations.deleteBlacklistRecord('${record.id}')" 
                                                class="btn-icon btn-icon-danger" title="حذف">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async setupBlacklistEventListeners() {
        setTimeout(async () => {
            // التأكد من تحميل البيانات
            if (!AppState.appData.blacklistRegister) {
                AppState.appData.blacklistRegister = [];
            }

            // التأكد من تحميل إعدادات النماذج
            if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
                try {
                    await Permissions.ensureFormSettingsState();
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل إعدادات النماذج:', error);
                }
            }

            // معالج نموذج التسجيل (فقط للنموذج الموجود في الصفحة الرئيسية، ليس modal)
            const form = document.getElementById('blacklist-form');
            if (form && !form.closest('.modal-overlay')) {
                // إزالة event listener القديم إن وجد
                const newForm = form.cloneNode(true);
                form.parentNode.replaceChild(newForm, form);
                newForm.addEventListener('submit', (e) => this.handleBlacklistSubmit(e));
            }

            // معالج رفع الصورة (فقط إذا كان موجوداً في الصفحة الرئيسية)
            const photoInput = document.getElementById('blacklist-photo-input');
            if (photoInput && !photoInput.closest('.modal-overlay')) {
                photoInput.addEventListener('change', (e) => this.handleBlacklistPhotoUpload(e));
            }

            // معالج البحث
            const searchInput = document.getElementById('blacklist-search');
            if (searchInput) {
                // إزالة event listeners القديمة
                const newSearchInput = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                newSearchInput.addEventListener('input', (e) => this.filterBlacklistTable(e.target.value));
            }

            // ✅ إضافة معالج زر التسجيل (مهم جداً)
            const addBtn = document.getElementById('blacklist-add-btn');
            if (addBtn) {
                // التحقق من أن listener لم يتم إضافته مسبقاً
                if (!addBtn.dataset.listenerAttached) {
                    addBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                            this.showBlacklistForm();
                        } catch (error) {
                            Utils.safeError('خطأ في فتح نموذج Blacklist:', error);
                            Notification.error('حدث خطأ أثناء فتح النموذج. يرجى المحاولة مرة أخرى.');
                        }
                    });
                    addBtn.dataset.listenerAttached = 'true';
                    if (AppState.debugMode) {
                        Utils.safeLog('✅ تم ربط زر "تسجيل ممنوع من الدخول جديد" بنجاح');
                    }
                } else {
                    if (AppState.debugMode) {
                        Utils.safeLog('ℹ️ زر "تسجيل ممنوع من الدخول جديد" مربوط مسبقاً');
                    }
                }
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ زر "blacklist-add-btn" غير موجود في DOM');
                }
            }

            // معالج تغيير المصنع (فقط إذا كان موجوداً في الصفحة الرئيسية)
            const factorySelect = document.getElementById('blacklist-factory');
            if (factorySelect && !factorySelect.closest('.modal-overlay')) {
                factorySelect.addEventListener('change', async (e) => {
                    const selectedOption = e.target.selectedOptions[0];
                    const siteId = selectedOption?.dataset.siteId || selectedOption?.value;
                    await this.loadBlacklistPlaces(siteId);
                });
            }

            // معالجات التصدير
            const exportPdfBtn = document.getElementById('blacklist-export-pdf');
            if (exportPdfBtn) {
                const newExportPdfBtn = exportPdfBtn.cloneNode(true);
                exportPdfBtn.parentNode.replaceChild(newExportPdfBtn, exportPdfBtn);
                newExportPdfBtn.addEventListener('click', () => this.exportBlacklistToPDF());
            }

            const exportExcelBtn = document.getElementById('blacklist-export-excel');
            if (exportExcelBtn) {
                const newExportExcelBtn = exportExcelBtn.cloneNode(true);
                exportExcelBtn.parentNode.replaceChild(newExportExcelBtn, exportExcelBtn);
                newExportExcelBtn.addEventListener('click', () => this.exportBlacklistToExcel());
            }

            this._hydrateBlacklistDrivePhotos();
        }, 100);
    },

    async handleBlacklistSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const isEdit = !!form.dataset.editId;

        // معالجة الصورة
        let photo = isEdit ?
            (AppState.appData?.blacklistRegister?.find(r => r.id === form.dataset.editId)?.photo || '') : '';

        // البحث عن photoInput داخل modal
        const modal = form.closest('.modal-overlay');
        const photoInput = modal ? modal.querySelector('#blacklist-photo-input') : document.getElementById('blacklist-photo-input');
        if (photoInput?.files?.[0]) {
            const file = photoInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                Notification.error('حجم الصورة كبير جداً. الحد الأقصى 2MB');
                return;
            }
            try {
                photo = await this.convertImageToBase64(file);
            } catch (err) {
                if (AppState.debugMode) Utils.safeWarn('خطأ في تحويل الصورة:', err);
            }
        }

        // الحصول على IDs للمواقع (من داخل modal)
        const factorySelect = modal ? modal.querySelector('#blacklist-factory') : document.getElementById('blacklist-factory');
        const locationSelect = modal ? modal.querySelector('#blacklist-location') : document.getElementById('blacklist-location');

        const factoryOption = factorySelect?.selectedOptions[0];
        const locationOption = locationSelect?.selectedOptions[0];

        // الحصول على باقي الحقول
        const getFieldValue = (id) => {
            const field = modal ? modal.querySelector(`#${id}`) : document.getElementById(id);
            return field?.value || '';
        };

        const formData = {
            id: form.dataset.editId || Utils.generateId('BLACKLIST'),
            serialNumber: getFieldValue('blacklist-serial'),
            factory: factorySelect?.value || '',
            factoryId: factoryOption?.dataset.siteId || '',
            location: locationSelect?.value || '',
            locationId: locationOption?.dataset.placeId || '',
            fullName: getFieldValue('blacklist-name'),
            idNumber: getFieldValue('blacklist-id-number'),
            photo: photo,
            job: getFieldValue('blacklist-job'),
            contractor: (getFieldValue('blacklist-contractor') || '').trim().split(' - ')[0], // اسم المقاول فقط (بدون الإدارة)
            department: getFieldValue('blacklist-department'),
            banReason: getFieldValue('blacklist-ban-reason'),
            banDate: getFieldValue('blacklist-ban-date'),
            bannedBy: getFieldValue('blacklist-banned-by'),
            editor: getFieldValue('blacklist-editor'),
            notes: getFieldValue('blacklist-notes'),
            createdAt: isEdit ?
                (AppState.appData?.blacklistRegister?.find(r => r.id === form.dataset.editId)?.createdAt || new Date().toISOString()) :
                new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // رفع الصورة إذا كانت Base64
        if (photo && photo.startsWith('data:')) {
            try {
                const uploadResult = await GoogleIntegration.uploadFileToDrive?.(
                    photo,
                    `blacklist_${formData.id}_${Date.now()}.jpg`,
                    'image/jpeg',
                    'Blacklist_Register'
                );
                if (uploadResult?.success && (uploadResult.directLink || uploadResult.shareableLink)) {
                    formData.photo = uploadResult.directLink || uploadResult.shareableLink;
                    if (AppState.debugMode) console.log('✅ تم رفع الصورة بنجاح:', formData.photo);
                } else {
                    // إذا فشل الرفع، نحتفظ بـ Base64 كحل مؤقت
                    if (AppState.debugMode) console.warn('⚠️ فشل في رفع الصورة، سيتم الاحتفاظ بـ Base64');
                    Notification.warning('فشل في رفع الصورة إلى Drive. سيتم حفظ الصورة مؤقتاً.');
                }
            } catch (err) {
                if (AppState.debugMode) Utils.safeWarn('❌ خطأ في رفع الصورة:', err);
                Notification.error('خطأ في رفع الصورة: ' + err.message);
                // نحتفظ بـ Base64 في حالة الفشل
            }
        }

        await this.saveBlacklistRecord(formData, isEdit);
    },

    async saveBlacklistRecord(recordData, isEdit) {
        Loading.show();
        try {
            if (!AppState.appData.blacklistRegister) {
                AppState.appData.blacklistRegister = [];
            }

            if (isEdit) {
                const index = AppState.appData.blacklistRegister.findIndex(r => r.id === recordData.id);
                if (index !== -1) {
                    AppState.appData.blacklistRegister[index] = recordData;
                } else {
                    AppState.appData.blacklistRegister.push(recordData);
                }
            } else {
                AppState.appData.blacklistRegister.push(recordData);
            }

            // حفظ محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // حفظ في Google Sheets
            try {
                await GoogleIntegration.autoSave('Blacklist_Register', AppState.appData.blacklistRegister);
            } catch (err) {
                if (AppState.debugMode) Utils.safeWarn('خطأ في حفظ Google Sheets:', err);
                Notification.warning('تم الحفظ محلياً لكن فشل الحفظ في Google Sheets');
            }

            Loading.hide();
            Notification.success(`تم ${isEdit ? 'تحديث' : 'تسجيل'} السجل بنجاح`);

            // إغلاق النموذج إذا كان مفتوحاً
            const existingModal = document.querySelector('.modal-overlay');
            if (existingModal && existingModal.querySelector('#blacklist-form')) {
                existingModal.remove();
            }

            // تحديث الكروت والجدول
            const cardsContainer = document.getElementById('blacklist-cards-container');
            if (cardsContainer) {
                cardsContainer.innerHTML = this.renderBlacklistCards();
                this.setupBlacklistEventListeners();
            }

            const tableContainer = document.getElementById('blacklist-table-container');
            if (tableContainer) {
                tableContainer.innerHTML = this.renderBlacklistTable();
                this.setupBlacklistEventListeners();
            }

            // تحديث الإحصائيات
            const cardBody = document.querySelector('#violations-tab-content .card-body');
            if (cardBody) {
                const existingStats = cardBody.querySelector('.grid.grid-cols-1.md\\:grid-cols-3');
                if (existingStats) {
                    existingStats.outerHTML = this.renderBlacklistStats();
                }
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حفظ السجل:', error);
            Notification.error('فشل في حفظ السجل: ' + error.message);
        }
    },

    handleBlacklistPhotoUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // البحث داخل modal أولاً
            const modal = document.querySelector('.modal-overlay');
            const preview = modal ? modal.querySelector('#blacklist-photo-preview') : document.getElementById('blacklist-photo-preview');
            const img = modal ? modal.querySelector('#blacklist-photo-img') : document.getElementById('blacklist-photo-img');
            if (preview && img) {
                img.src = event.target.result;
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    },

    async loadBlacklistPlaces(siteId) {
        try {
            // التأكد من تحميل إعدادات النماذج
            if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
                await Permissions.ensureFormSettingsState();
            }

            // البحث عن locationSelect داخل modal أولاً، ثم في document
            const modal = document.querySelector('.modal-overlay');
            const locationSelect = modal ? modal.querySelector('#blacklist-location') : document.getElementById('blacklist-location');
            if (!locationSelect) return;

            locationSelect.innerHTML = '<option value="">-- اختر الموقع --</option>';

            const places = this.getPlaceOptions(siteId);

            places.forEach(place => {
                const option = document.createElement('option');
                option.value = place.name;
                option.dataset.placeId = place.id;
                option.textContent = place.name;
                locationSelect.appendChild(option);
            });
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تحميل الأماكن:', error);
        }
    },


    filterBlacklistTable(searchTerm) {
        const tbody = document.getElementById('blacklist-table-body');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    editBlacklistRecord(recordId) {
        const record = AppState.appData?.blacklistRegister?.find(r => r.id === recordId);
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        this.showBlacklistForm(record);
    },

    async deleteBlacklistRecord(recordId) {
        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;

        Loading.show();
        try {
            if (AppState.appData?.blacklistRegister) {
                AppState.appData.blacklistRegister = AppState.appData.blacklistRegister.filter(r => r.id !== recordId);
            }

            // حفظ محلياً
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            // حفظ في Google Sheets
            try {
                await GoogleIntegration.autoSave('Blacklist_Register', AppState.appData.blacklistRegister);
            } catch (err) {
                if (AppState.debugMode) Utils.safeWarn('خطأ في حفظ Google Sheets:', err);
                Notification.warning('تم الحذف محلياً لكن فشل الحفظ في Google Sheets');
            }

            Loading.hide();
            Notification.success('تم حذف السجل بنجاح');

            // إعادة تحميل التبويب
            const activeTabBtn = document.querySelector('.tab-btn.active[data-tab="blacklist"]');
            if (activeTabBtn) {
                await this.switchTab('blacklist');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حذف السجل:', error);
            Notification.error('فشل في حذف السجل: ' + error.message);
        }
    },

    viewBlacklistPhoto(photoUrl) {
        if (!photoUrl) {
            Notification.error('لا توجد صورة');
            return;
        }

        // ✅ معالجة الصورة بشكل صحيح (تحويل الروابط القديمة إذا لزم)
        const processedUrl = this.processPhoto(photoUrl);
        if (!processedUrl) {
            Notification.error('رابط الصورة غير صالح');
            return;
        }

        const openPhotoModal = (src) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">الصورة الشخصية</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <img src="${Utils.escapeHTML(src)}" alt="صورة شخصية" style="width: 100%; max-height: 70vh; object-fit: contain;"
                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23ddd%22 width=%22400%22 height=%22300%22/%3E%3Ctext fill=%22%23666%22 font-family=%22sans-serif%22 font-size=%2220%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eفشل تحميل الصورة%3C/text%3E%3C/svg%3E';">
                </div>
            </div>
        `;
            document.body.appendChild(modal);
        };

        const disp = typeof Utils.resolveDriveAwareImgDisplay === 'function'
            ? Utils.resolveDriveAwareImgDisplay(processedUrl)
            : { needsProxy: false, proxyFileId: '' };
        if (disp.needsProxy && typeof Utils.fetchDriveImageDataUri === 'function') {
            Utils.fetchDriveImageDataUri(disp.proxyFileId).then((dataUri) => {
                if (dataUri) openPhotoModal(dataUri);
                else Notification.error('تعذر تحميل الصورة من Google Drive');
            }).catch(() => Notification.error('تعذر تحميل الصورة'));
            return;
        }

        openPhotoModal(processedUrl);
    },

    viewBlacklistDetails(recordId) {
        const record = AppState.appData?.blacklistRegister?.find(r => r.id === recordId);
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        // ✅ معالجة الصورة بشكل صحيح
        const photoUrl = this.processPhoto(record);
        const photoDisp = photoUrl && typeof Utils.resolveDriveAwareImgDisplay === 'function'
            ? Utils.resolveDriveAwareImgDisplay(photoUrl)
            : { canonical: photoUrl || '', displaySrc: photoUrl || '', needsProxy: false, proxyFileId: '' };
        const photoImgSrc = photoDisp.canonical ? photoDisp.displaySrc : '';
        const photoProxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(photoDisp) : '';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-user-slash ml-2"></i>
                        تفاصيل سجل الممنوع من الدخول
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="blacklist-details-content">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الرقم التسلسلي</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.serialNumber || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">تاريخ المنع</label>
                            <p class="text-gray-800">${record.banDate ? Utils.formatDate(record.banDate) : '-'}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">المصنع</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.factory || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الموقع</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.location || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الاسم رباعي</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.fullName || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">رقم البطاقة</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.idNumber || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الوظيفة</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.job || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الشركة - المقاول</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.contractor || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">الإدارة</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.department || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">القائم بالمنع</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.bannedBy || '-')}</p>
                        </div>
                        <div>
                            <label class="text-sm font-semibold text-gray-600">محرر البيانات</label>
                            <p class="text-gray-800">${Utils.escapeHTML(record.editor || '-')}</p>
                        </div>
                        ${record.createdAt ? `
                        <div>
                            <label class="text-sm font-semibold text-gray-600">تاريخ الإنشاء</label>
                            <p class="text-gray-800">${Utils.formatDateTime(record.createdAt)}</p>
                        </div>
                        ` : ''}
                        ${record.updatedAt ? `
                        <div>
                            <label class="text-sm font-semibold text-gray-600">تاريخ آخر تحديث</label>
                            <p class="text-gray-800">${Utils.formatDateTime(record.updatedAt)}</p>
                        </div>
                        ` : ''}
                    </div>
                    ${photoUrl ? `
                    <div class="mt-4">
                        <label class="text-sm font-semibold text-gray-600 mb-2 block">الصورة الشخصية</label>
                        <div class="flex justify-center">
                            <img src="${Utils.escapeHTML(photoImgSrc)}" alt="صورة شخصية"${photoProxyAttr}
                                class="blacklist-detail-photo max-w-xs max-h-64 object-cover rounded-lg cursor-pointer border-2 border-gray-200"
                                data-photo-url="${Utils.escapeHTML(photoUrl)}"
                                onclick="Violations.viewBlacklistPhoto(this.dataset.photoUrl)"
                                title="انقر لعرض الصورة بحجم كامل"
                                onerror="Violations._onBlacklistTablePhotoError(this)">
                        </div>
                    </div>
                    ` : ''}
                    <div class="mt-4">
                        <label class="text-sm font-semibold text-gray-600 mb-2 block">سبب المنع</label>
                        <p class="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">${Utils.escapeHTML(record.banReason || '-')}</p>
                    </div>
                    ${record.notes ? `
                    <div class="mt-4">
                        <label class="text-sm font-semibold text-gray-600 mb-2 block">ملاحظات</label>
                        <p class="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">${Utils.escapeHTML(record.notes)}</p>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="Violations.printBlacklistDetails('${recordId}')">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                    <button type="button" class="btn-warning" onclick="Violations.editBlacklistRecord('${recordId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>تعديل
                    </button>
                    <button type="button" class="btn-danger" onclick="if(confirm('هل أنت متأكد من حذف هذا السجل؟')) { Violations.deleteBlacklistRecord('${recordId}'); this.closest('.modal-overlay').remove(); }">
                        <i class="fas fa-trash ml-2"></i>حذف
                    </button>
                    <button type="button" class="btn-primary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(modal, {
                onFetchFail: (img) => this._onBlacklistTablePhotoError(img)
            });
        }
    },

    printBlacklistDetails(recordId) {
        const record = AppState.appData?.blacklistRegister?.find(r => r.id === recordId);
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        // ✅ معالجة الصورة بشكل صحيح
        const photoUrl = this.processPhoto(record);

        try {
            Loading.show('جاري إعداد الطباعة...');

            const formCode = `BLACKLIST-${(record.id || record.serialNumber || 'UNKNOWN').substring(0, 12)}`;
            const title = 'تفاصيل الممنوع من الدخول - Blacklist Details';

            // بناء محتوى التقرير
            const content = `
                <div class="summary-grid">
                    <div class="summary-card">
                        <span class="summary-label">الرقم التسلسلي</span>
                        <span class="summary-value">${Utils.escapeHTML(record.serialNumber || '-')}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">تاريخ المنع</span>
                        <span class="summary-value">${record.banDate ? Utils.formatDate(record.banDate) : '-'}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">المصنع</span>
                        <span class="summary-value">${Utils.escapeHTML(record.factory || '-')}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">الموقع</span>
                        <span class="summary-value">${Utils.escapeHTML(record.location || '-')}</span>
                    </div>
                </div>

                <div class="section-title">معلومات الشخص الممنوع</div>
                <table class="report-table">
                    <tr>
                        <th style="width: 30%;">الاسم رباعي</th>
                        <td>${Utils.escapeHTML(record.fullName || '-')}</td>
                    </tr>
                    <tr>
                        <th>رقم البطاقة</th>
                        <td>${Utils.escapeHTML(record.idNumber || '-')}</td>
                    </tr>
                    <tr>
                        <th>الوظيفة</th>
                        <td>${Utils.escapeHTML(record.job || '-')}</td>
                    </tr>
                    <tr>
                        <th>الشركة - المقاول</th>
                        <td>${Utils.escapeHTML(record.contractor || '-')}</td>
                    </tr>
                    <tr>
                        <th>الإدارة</th>
                        <td>${Utils.escapeHTML(record.department || '-')}</td>
                    </tr>
                </table>

                ${photoUrl ? `
                <div class="section-title">الصورة الشخصية</div>
                <div style="text-align: center; margin: 20px 0;">
                    <img src="${Utils.escapeHTML(photoUrl)}" alt="صورة شخصية" style="max-width: 300px; max-height: 400px; border: 2px solid #ddd; border-radius: 8px; object-fit: contain;" 
                         onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22300%22 height=%22400%22/%3E%3Ctext fill=%22%23999%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3Eفشل تحميل الصورة%3C/text%3E%3C/svg%3E';">
                </div>
                ` : ''}

                <div class="section-title">تفاصيل المنع</div>
                <table class="report-table">
                    <tr>
                        <th style="width: 30%;">سبب المنع</th>
                        <td style="white-space: pre-wrap;">${Utils.escapeHTML(record.banReason || '-')}</td>
                    </tr>
                    ${record.notes ? `
                    <tr>
                        <th>ملاحظات</th>
                        <td style="white-space: pre-wrap;">${Utils.escapeHTML(record.notes)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <th>القائم بالمنع</th>
                        <td>${Utils.escapeHTML(record.bannedBy || '-')}</td>
                    </tr>
                    <tr>
                        <th>محرر البيانات</th>
                        <td>${Utils.escapeHTML(record.editor || '-')}</td>
                    </tr>
                    ${record.createdAt ? `
                    <tr>
                        <th>تاريخ الإنشاء</th>
                        <td>${Utils.formatDateTime(record.createdAt)}</td>
                    </tr>
                    ` : ''}
                    ${record.updatedAt ? `
                    <tr>
                        <th>تاريخ آخر تحديث</th>
                        <td>${Utils.formatDateTime(record.updatedAt)}</td>
                    </tr>
                    ` : ''}
                </table>
            `;

            // استخدام FormHeader.generatePDFHTML لإضافة الهيدر
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(
                    formCode,
                    title,
                    content,
                    false,  // includeQrInHeader = false
                    true,   // includeQrInFooter = true
                    {
                        version: '1.0',
                        releaseDate: record.createdAt || new Date().toISOString(),
                        revisionDate: record.updatedAt || record.createdAt || new Date().toISOString(),
                        'الرقم التسلسلي': record.serialNumber || record.id || '',
                        qrData: {
                            type: 'Blacklist',
                            id: record.id,
                            serialNumber: record.serialNumber
                        }
                    },
                    record.createdAt || new Date().toISOString(),
                    record.updatedAt || record.createdAt || new Date().toISOString()
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title></head><body>${content}</body></html>`;

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
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة التفاصيل:', error);
            Notification.error('فشل في الطباعة: ' + error.message);
        }
    },

    async exportBlacklistToPDF() {
        try {
            const blacklistRecords = AppState.appData?.blacklistRegister || [];
            if (blacklistRecords.length === 0) {
                Notification.warning('لا توجد بيانات للتصدير');
                return;
            }

            Loading.show('جاري إنشاء PDF...');

            // محاولة استخدام jsPDF أولاً
            if (typeof window.jsPDF !== 'undefined') {
                try {
                    const { jsPDF } = window.jsPDF;
                    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

                    // العنوان
                    doc.setFontSize(18);
                    doc.text('قائمة الممنوعين من الدخول - Blacklist Register', 150, 15, { align: 'center' });

                    // المعلومات
                    doc.setFontSize(10);
                    doc.text(`تاريخ التصدير: ${Utils.formatDateTime(new Date().toISOString())}`, 14, 22);
                    doc.text(`عدد السجلات: ${blacklistRecords.length}`, 14, 27);

                    // البيانات
                    const tableData = blacklistRecords.map(record => [
                        record.serialNumber || '-',
                        record.banDate ? Utils.formatDate(record.banDate) : '-',
                        Utils.escapeHTML(record.factory || '-'),
                        Utils.escapeHTML(record.location || '-'),
                        Utils.escapeHTML(record.fullName || '-'),
                        Utils.escapeHTML(record.idNumber || '-'),
                        Utils.escapeHTML(record.job || '-'),
                        Utils.escapeHTML(record.contractor || '-'),
                        Utils.escapeHTML(record.department || '-'),
                        Utils.escapeHTML(record.bannedBy || '-'),
                        Utils.escapeHTML(record.banReason || '-').substring(0, 50)
                    ]);

                    if (typeof doc.autoTable !== 'undefined') {
                        doc.autoTable({
                            head: [['م', 'تاريخ المنع', 'المصنع', 'الموقع', 'الاسم رباعي', 'رقم البطاقة', 'الوظيفة', 'الشركة', 'الإدارة', 'القائم بالمنع', 'سبب المنع']],
                            body: tableData,
                            startY: 35,
                            styles: { fontSize: 7, font: 'Arial', cellPadding: 2 },
                            headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
                            alternateRowStyles: { fillColor: [245, 247, 250] },
                            margin: { left: 14, right: 14 },
                            overflow: 'linebreak'
                        });
                    } else {
                        // Fallback if autoTable is not available
                        let y = 35;
                        tableData.forEach((row, index) => {
                            if (y > 180) {
                                doc.addPage();
                                y = 20;
                            }
                            doc.setFontSize(8);
                            doc.text(`${index + 1}. ${row[4]} - ${row[3]}`, 14, y);
                            y += 7;
                        });
                    }

                    // حفظ الملف
                    const fileName = `قائمة_الممنوعين_من_الدخول_${new Date().toISOString().slice(0, 10)}.pdf`;
                    doc.save(fileName);
                    Loading.hide();
                    Notification.success('تم تصدير البيانات إلى PDF بنجاح');
                    return;
                } catch (pdfError) {
                    Utils.safeWarn('فشل استخدام jsPDF، سيتم استخدام طريقة HTML:', pdfError);
                }
            }

            // Fallback: استخدام HTML للطباعة
            const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>قائمة الممنوعين من الدخول</title>
    <style>
        @media print {
            @page { margin: 1cm; size: A4 landscape; }
            body { margin: 0; }
            .no-print { display: none !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #003865;
            padding-bottom: 15px;
        }
        .header h1 {
            color: #003865;
            font-size: 24px;
            margin-bottom: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: right;
        }
        th {
            background: #3b82f6;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background: #f5f7fa;
        }
        .print-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 12px 24px;
            background: #003865;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">
        <i class="fas fa-print"></i> طباعة
    </button>
    <div class="header">
        <h1>قائمة الممنوعين من الدخول - Blacklist Register</h1>
        <p>تاريخ التصدير: ${Utils.formatDateTime(new Date().toISOString())} | عدد السجلات: ${blacklistRecords.length}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th>م</th>
                <th>تاريخ المنع</th>
                <th>المصنع</th>
                <th>الموقع</th>
                <th>الاسم رباعي</th>
                <th>رقم البطاقة</th>
                <th>الوظيفة</th>
                <th>الشركة - المقاول</th>
                <th>الإدارة</th>
                <th>القائم بالمنع</th>
                <th>محرر البيانات</th>
                <th>سبب المنع</th>
                <th>ملاحظات</th>
            </tr>
        </thead>
        <tbody>
            ${blacklistRecords.map(record => `
                <tr>
                    <td>${Utils.escapeHTML(record.serialNumber || '-')}</td>
                    <td>${record.banDate ? Utils.formatDate(record.banDate) : '-'}</td>
                    <td>${Utils.escapeHTML(record.factory || '-')}</td>
                    <td>${Utils.escapeHTML(record.location || '-')}</td>
                    <td>${Utils.escapeHTML(record.fullName || '-')}</td>
                    <td>${Utils.escapeHTML(record.idNumber || '-')}</td>
                    <td>${Utils.escapeHTML(record.job || '-')}</td>
                    <td>${Utils.escapeHTML(record.contractor || '-')}</td>
                    <td>${Utils.escapeHTML(record.department || '-')}</td>
                    <td>${Utils.escapeHTML(record.bannedBy || '-')}</td>
                    <td>${Utils.escapeHTML(record.editor || '-')}</td>
                    <td>${Utils.escapeHTML((record.banReason || '-').substring(0, 100))}</td>
                    <td>${Utils.escapeHTML((record.notes || '-').substring(0, 50))}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

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
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل في تصدير PDF: ' + error.message);
        }
    },

    exportBlacklistToExcel() {
        try {
            const blacklistRecords = AppState.appData?.blacklistRegister || [];
            if (blacklistRecords.length === 0) {
                Notification.warning('لا توجد بيانات للتصدير');
                return;
            }

            Loading.show('جاري إنشاء ملف Excel...');

            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة Excel غير متاحة. يرجى التأكد من تحميل مكتبة SheetJS');
                return;
            }

            // تحضير البيانات
            const excelData = blacklistRecords.map(record => ({
                'م': record.serialNumber || '',
                'تاريخ المنع': record.banDate ? Utils.formatDate(record.banDate) : '',
                'المصنع': record.factory || '',
                'الموقع': record.location || '',
                'الاسم رباعي': record.fullName || '',
                'رقم البطاقة': record.idNumber || '',
                'الوظيفة': record.job || '',
                'الشركة - المقاول': record.contractor || '',
                'الإدارة': record.department || '',
                'القائم بالمنع': record.bannedBy || '',
                'محرر البيانات': record.editor || '',
                'سبب المنع': record.banReason || '',
                'ملاحظات': record.notes || '',
                'تاريخ الإنشاء': record.createdAt ? Utils.formatDateTime(record.createdAt) : '',
                'تاريخ آخر تحديث': record.updatedAt ? Utils.formatDateTime(record.updatedAt) : ''
            }));

            // إنشاء workbook
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // تحديد عرض الأعمدة
            const columnWidths = [
                { wch: 8 },   // م
                { wch: 12 },  // تاريخ المنع
                { wch: 15 },  // المصنع
                { wch: 15 },  // الموقع
                { wch: 25 },  // الاسم رباعي
                { wch: 15 },  // رقم البطاقة
                { wch: 20 },  // الوظيفة
                { wch: 20 },  // الشركة - المقاول
                { wch: 15 },  // الإدارة
                { wch: 20 },  // القائم بالمنع
                { wch: 20 },  // محرر البيانات
                { wch: 40 },  // سبب المنع
                { wch: 40 },  // ملاحظات
                { wch: 18 },  // تاريخ الإنشاء
                { wch: 18 }   // تاريخ آخر تحديث
            ];
            worksheet['!cols'] = columnWidths;

            // إضافة ورقة العمل إلى الكتاب
            XLSX.utils.book_append_sheet(workbook, worksheet, 'قائمة الممنوعين');

            // حفظ الملف
            const date = new Date().toISOString().slice(0, 10);
            const fileName = `قائمة_الممنوعين_من_الدخول_${date}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            Loading.hide();
            Notification.success('تم تصدير البيانات إلى Excel بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification.error('فشل في تصدير Excel: ' + error.message);
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Violations !== 'undefined') {
            window.Violations = Violations;

            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Violations module loaded and available on window.Violations');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Violations:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Violations !== 'undefined') {
            try {
                window.Violations = Violations;
            } catch (e) {
                console.error('❌ فشل تصدير Violations:', e);
            }
        }
    }
})();

// استخدام الثوابت من contractors.js لتجنب التكرار
// CONTRACTOR_EVALUATION_DEFAULT_ITEMS موجود في contractors.js
// CONTRACTOR_APPROVAL_REQUIREMENTS_DEFAULT موجود في contractors.js
// جميع الثوابت المتعلقة بالمقاولين موجودة في contractors.js
