/**
 * Employees Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Employees Module (قاعدة بيانات الموظين) =====
const Employees = {
    // Cache للبيانات مع timestamp
    cache: {
        data: null,
        lastLoad: null,
        lastUpdate: null,
        isUpdating: false
    },
    
    // إعدادات التحديث التلقائي
    config: {
        cacheTimeout: 5 * 60 * 1000, // 5 دقائق - صلاحية الـ cache
        backgroundUpdateInterval: 10 * 60 * 1000, // 10 دقائق - فترة التحديث في الخلفية
        backgroundUpdateTimer: null,
        _refreshedOnceForInactive: false // مرة واحدة لكل جلسة لجلب المستقيلين من الخادم
    },
    activeTab: 'employees-list',
    externalWorkforceYear: new Date().getFullYear(),
    _externalWorkforceLoaded: false,
    _externalWorkforceLoadPromise: null,
    _externalWorkforceCache: new Map(),
    _getI18nCore() {
        return (window.AppI18n && typeof window.AppI18n.t === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.t === 'function') ? window.I18n : null);
    },
    t(key, fallback) {
        const i18nCore = this._getI18nCore();
        if (i18nCore) return i18nCore.t(key, null, fallback || key);
        return fallback || key;
    },
    applyModuleI18n(root) {
        const i18nCore = this._getI18nCore();
        if (!i18nCore) return;
        const target = root || document.getElementById('employees-section') || document;
        if (typeof i18nCore.applyI18n === 'function') i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') i18nCore.applyLiteralTranslations(target);
    },

    // ===== Photo loading guards (avoid repeated 503) =====
    _photoFailKey(photoKey) {
        return `hse_emp_photo_failed_${String(photoKey || '').trim()}`;
    },
    _getDriveIdFromUrl(url) {
        try {
            const s = String(url || '').trim();
            if (!s) return '';
            const m = s.match(/[?&]id=([^&]+)/) || s.match(/\/file\/d\/([^/]+)/);
            return m ? String(m[1] || '').trim() : '';
        } catch (e) {
            return '';
        }
    },
    _normalizeEmployeePhotoUrl(photoUrl, employeeId = '') {
        try {
            const raw = typeof Utils !== 'undefined' && typeof Utils.extractImageSourceCandidate === 'function'
                ? String(Utils.extractImageSourceCandidate(photoUrl) || '').trim()
                : String(photoUrl || '').trim();
            if (!raw) return '';

            // Normalize Google Drive links when helper exists
            let normalized = raw;
            if (typeof Utils !== 'undefined' && typeof Utils.normalizeImageSource === 'function') {
                normalized = Utils.normalizeImageSource(raw) || raw;
            } else if (typeof window !== 'undefined' && typeof window.__convertGoogleDriveUrl === 'function') {
                normalized = window.__convertGoogleDriveUrl(raw) || raw;
            }

            const driveId = this._getDriveIdFromUrl(normalized);
            const photoKey = driveId || employeeId || normalized;

            // If failed recently in this tab, skip re-request to avoid spam/slowdowns
            const failedAt = sessionStorage.getItem(this._photoFailKey(photoKey));
            if (failedAt) return '';

            return normalized;
        } catch (e) {
            return '';
        }
    },
    _setupEmployeePhotoFallbacks(rootEl) {
        try {
            const root = rootEl || document;
            const images = root.querySelectorAll('img[data-emp-photo="1"]');
            if (!images || images.length === 0) return;

            images.forEach((img) => {
                if (!img || img.dataset._fallbackBound === '1') return;
                img.dataset._fallbackBound = '1';
                const photoKey = (img.dataset.photoKey || '').trim();

                img.addEventListener('error', () => {
                    try {
                        if (photoKey) sessionStorage.setItem(this._photoFailKey(photoKey), Date.now().toString());
                    } catch (e) { /* ignore */ }

                    try {
                        const parent = img.parentElement;
                        if (parent) {
                            parent.innerHTML = '<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>';
                        }
                    } catch (e) { /* ignore */ }
                }, { passive: true });
            });
        } catch (e) {
            // ignore
        }
    },

    /**
     * التحقق من صلاحيات المستخدم للتحرير والحذف
     * فقط لمدير النظام (admin) - باقي الأدوار يمكنهم العرض والبحث فقط
     */
    canEditOrDelete() {
        const user = AppState.currentUser;
        if (!user) return false;
        
        const role = (user.role || '').toLowerCase();
        
        // فقط المدير لديه صلاحيات التعديل والحذف
        return role === 'admin';
    },

    /**
     * التحقق من صلاحيات المستخدم للإضافة والاستيراد
     * فقط لمدير النظام (admin) - باقي الأدوار يمكنهم العرض والبحث فقط
     */
    canAddOrImport() {
        const user = AppState.currentUser;
        if (!user) return false;
        
        const role = (user.role || '').toLowerCase();
        
        // فقط المدير لديه صلاحيات الإضافة والاستيراد
        return role === 'admin';
    },

    getEmployeesDetailedPermissionsState() {
        try {
            if (typeof Permissions !== 'undefined' && typeof Permissions.getEffectivePermissions === 'function') {
                const effective = Permissions.getEffectivePermissions();
                const detailed = effective?.employeesPermissions;
                if (detailed && typeof detailed === 'object' && !Array.isArray(detailed)) {
                    return detailed;
                }
            }
        } catch (error) {
            // ignore and fallback
        }

        const raw = AppState.currentUser?.permissions?.employeesPermissions;
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    },

    canViewEmployeesRegistryTab() {
        if (this.canAddOrImport()) return true;
        if (typeof Permissions !== 'undefined' && typeof Permissions.hasAccess === 'function' && !Permissions.hasAccess('employees')) {
            return false;
        }

        const detailed = this.getEmployeesDetailedPermissionsState();
        if (!detailed) return true;
        return detailed['employees-list'] !== false;
    },

    canViewExternalWorkforceTab() {
        if (this.canAddOrImport()) return true;
        if (typeof Permissions !== 'undefined' && typeof Permissions.hasAccess === 'function' && !Permissions.hasAccess('employees')) {
            return false;
        }

        const detailed = this.getEmployeesDetailedPermissionsState();
        if (!detailed) return true;
        return detailed['external-workforce'] === true;
    },

    canManageExternalWorkforceTab() {
        return this.canAddOrImport();
    },

    /**
     * التحقق من صحة التاريخ
     */
    isValidDate(dateString) {
        if (!dateString) return false;
        try {
            const date = new Date(dateString);
            return date instanceof Date && !isNaN(date.getTime());
        } catch (error) {
            return false;
        }
    },

    /**
     * تحويل تاريخ إلى صيغة YYYY-MM-DD بدون مشاكل timezone
     * يدعم: Date / ISO String / YYYY-MM-DD / أرقام Excel (serial) / صيغ dd/mm/yyyy
     */
    normalizeDateOnly(input) {
        if (input === null || input === undefined || input === '') return '';

        // Date object
        if (input instanceof Date && !isNaN(input.getTime())) {
            const y = input.getFullYear();
            const m = String(input.getMonth() + 1).padStart(2, '0');
            const d = String(input.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // Excel serial number (SheetJS may return number)
        if (typeof input === 'number' && isFinite(input)) {
            try {
                if (typeof XLSX !== 'undefined' && XLSX?.SSF?.parse_date_code) {
                    const dc = XLSX.SSF.parse_date_code(input);
                    if (dc && dc.y && dc.m && dc.d) {
                        const y = String(dc.y).padStart(4, '0');
                        const m = String(dc.m).padStart(2, '0');
                        const d = String(dc.d).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        let s = String(input).trim();
        if (!s) return '';

        // Unwrap JSON-quoted strings (e.g. "\"2020-01-01T00:00:00.000Z\"")
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            try {
                const parsed = JSON.parse(s);
                if (typeof parsed === 'string') {
                    s = parsed.trim();
                } else {
                    s = s.substring(1, s.length - 1).trim();
                }
            } catch (e0) {
                s = s.substring(1, s.length - 1).trim();
            }
            if (!s) return '';
        }

        // Already YYYY-MM-DD (or ISO starting with it)
        const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (ymd) return ymd[1];

        // dd/mm/yyyy or dd-mm-yyyy
        const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (dmy) {
            const day = String(dmy[1]).padStart(2, '0');
            const month = String(dmy[2]).padStart(2, '0');
            const year = dmy[3].length === 2 ? `20${dmy[3]}` : String(dmy[3]).padStart(4, '0');
            return `${year}-${month}-${day}`;
        }

        // yyyy/mm/dd or yyyy-m-d
        const ymd2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (ymd2) {
            const year = String(ymd2[1]).padStart(4, '0');
            const month = String(ymd2[2]).padStart(2, '0');
            const day = String(ymd2[3]).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Fallback: parse as Date then format local YYYY-MM-DD
        try {
            const d = new Date(s);
            if (!isNaN(d.getTime())) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            }
        } catch (e) {
            // ignore
        }

        return '';
    },

    /**
     * تحويل أي تاريخ إلى Date محلي (لاستخدامه في الحسابات فقط)
     */
    parseLocalDate(input) {
        if (!input) return null;
        if (input instanceof Date && !isNaN(input.getTime())) return input;
        let s = String(input).trim();
        if (!s) return null;

        // Unwrap JSON-quoted strings
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            try {
                const parsed = JSON.parse(s);
                if (typeof parsed === 'string') {
                    s = parsed.trim();
                } else {
                    s = s.substring(1, s.length - 1).trim();
                }
            } catch (e0) {
                s = s.substring(1, s.length - 1).trim();
            }
            if (!s) return null;
        }

        // Prefer YYYY-MM-DD parsing as local date (avoid UTC parsing differences)
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
            const y = Number(m[1]);
            const mo = Number(m[2]) - 1;
            const d = Number(m[3]);
            const dt = new Date(y, mo, d);
            return isNaN(dt.getTime()) ? null : dt;
        }

        // Otherwise rely on Date parsing (handles ISO with timezone)
        const dt = new Date(s);
        return isNaN(dt.getTime()) ? null : dt;
    },

    /**
     * تنسيق التاريخ بشكل آمن
     */
    formatDateSafe(dateString) {
        return this.normalizeDateOnly(dateString);
    },

    /**
     * حساب السن بناءً على تاريخ الميلاد
     */
    calculateAge(birthDate) {
        if (!birthDate) return '';
        try {
            const birth = this.parseLocalDate(birthDate);
            if (!birth) return '';
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age >= 0 ? age : '';
        } catch (error) {
            return '';
        }
    },

    async load() {
        // إضافة مستمع لتغيير اللغة
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        // التحقق من وجود التبعيات المطلوبة
        if (typeof Utils === 'undefined') {
            console.error('Utils غير متوفر!');
            return;
        }
        if (typeof AppState === 'undefined') {
            // لا تترك الواجهة فارغة (مهم لاختبارات AppTester وتجربة المستخدم)
            const section = document.getElementById('employees-section');
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-2">${this.t('module.employees.unableLoad', 'تعذر تحميل قاعدة بيانات الموظفين')}</p>
                                <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                                <button onclick="location.reload()" class="btn-primary mt-4">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${this.t('module.common.refreshPage', 'تحديث الصفحة')}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            Utils.safeError('AppState غير متوفر!');
            return;
        }

        const section = document.getElementById('employees-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError(' قسم employees-section غير موجود!');
            } else {
                console.error(' قسم employees-section غير موجود!');
            }
            return;
        }
        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('✅ مديول Employees يكتب ي قسم: employees-section');
        }

        try {
            const canAddOrImport = this.canAddOrImport();

            // ⚡️ مهم: عرض Skeleton فوراً بدون انتظار المزامنة مع Google Sheets
            // هذا يمنع "الواجهة فارغة" و Timeout في AppTester (مهلة 15 ثانية للـ UI)
            section.innerHTML = `
                <div class="section-header">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-user-tie ml-3"></i>
                                ${this.t('module.employees.title', 'قاعدة بيانات الموظفين')}
                            </h1>
                            <p class="section-subtitle">${canAddOrImport
                                ? this.t('module.employees.subtitleAdmin', 'إدارة بيانات الموظفين مع إمكانية استيراد من Excel')
                                : this.t('module.employees.subtitleViewer', 'عرض وبحث في قاعدة بيانات الموظفين')}</p>
                        </div>
                        ${canAddOrImport ? `
                        <div class="flex gap-2">
                            <button id="import-employees-excel-btn" class="btn-secondary">
                                <i class="fas fa-file-excel ml-2"></i>
                                ${this.t('module.employees.importExcel', 'استيراد من Excel')}
                            </button>
                            <button id="add-employee-btn" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                ${this.t('module.employees.addNewEmployee', 'إضافة موظف جديد')}
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div id="employees-content" class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <div style="width: 300px; margin: 0 auto 16px;">
                                    <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                        <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                    </div>
                                </div>
                                <p class="text-gray-500">${this.t('module.employees.loadingList', 'جاري تحميل قائمة الموظفين...')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(section);
            
            // ✅ تحميل القائمة فوراً بعد عرض الواجهة (سيتم استدعاء setupEventListeners من renderList)
            setTimeout(async () => {
                try {
                    const contentArea = document.getElementById('employees-content');
                    if (!contentArea) return;
                    
                    const listContent = await this.renderList().catch(error => {
                        Utils.safeWarn('⚠️ خطأ في تحميل القائمة:', error);
                        return `
                            <div class="content-card">
                                <div class="card-body">
                                    <div class="empty-state">
                                        <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                        <p class="text-gray-500 mb-4">${this.t('module.common.loadDataError', 'حدث خطأ في تحميل البيانات')}</p>
                                        <button onclick="Employees.load()" class="btn-primary">
                                            <i class="fas fa-redo ml-2"></i>
                                            ${this.t('module.common.retry', 'إعادة المحاولة')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    
                    contentArea.innerHTML = listContent;
                    this.applyModuleI18n(contentArea);
                    
                    // ✅ إعادة إعداد event listeners بعد تحميل المحتوى
                    this.setupEventListeners();
                    
                    // ✅ تحميل القائمة بعد إعداد event listeners
                    await this.loadEmployeesList();
                    
                    // ✅ تطبيق الفلاتر إذا كان هناك قيم
                    setTimeout(async () => {
                        try {
                            const filters = this.getFilterValues();
                            if (filters.search || filters.department || filters.branch || filters.location || 
                                filters.job || filters.position || filters.gender) {
                                await this.applyFilters();
                            }
                        } catch (error) {
                            if (AppState.debugMode) {
                                Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                            }
                        }
                    }, 200);
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل القائمة:', error);
                }
            }, 0);
            
            // التمرير السلس إلى حقل البحث بعد تحميل المحتوى
            requestAnimationFrame(() => {
                if (this.activeTab === 'employees-list') this.scrollToSearchField();
            });
            
            // بدء التحديث التلقائي في الخلفية
            this.startBackgroundUpdate();

            // مزامنة البيانات في الخلفية بدون إيقاف الواجهة
            // (لا ننتظرها حتى لا نتجاوز مهلة التحميل/الاختبار)
            Promise.resolve()
                .then(async () => {
                    try {
                        // إذا كانت البيانات المحلية موجودة، نعرضها فوراً ثم نحدّث في الخلفية
                        await this.ensureEmployeesLoaded(false);
                        // تحديث القائمة بعد اكتمال المزامنة (إن وُجدت بيانات جديدة)
                        this.loadEmployeesList();
                    } catch (e) {
                        // لا نكسر الواجهة - مجرد تحذير
                        Utils.safeWarn('⚠️ تعذر مزامنة بيانات الموظفين في الخلفية:', e);
                    }
                });
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول الموظفين:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول الموظفين:', error);
            }
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">${this.t('module.common.loadDataRuntimeError', 'حدث خطأ أثناء تحميل البيانات')}</p>
                                <button onclick="Employees.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${this.t('module.common.retry', 'إعادة المحاولة')}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                this.applyModuleI18n(section);
            }
        }
    },

    /**
     * تحديد إذا كان الموظف غير نشط (مستقيل)
     * يدعم: status = 'inactive' أو 'غير نشط' أو وجود تاريخ استقالة
     */
    isEmployeeInactive(employee) {
        if (!employee) return false;
        const status = (employee.status != null && employee.status !== '') ? String(employee.status).trim() : '';
        const resignationDate = (employee.resignationDate != null && employee.resignationDate !== '') ? String(employee.resignationDate).trim() : '';
        if (resignationDate) return true;
        if (status === 'inactive' || status.toLowerCase() === 'inactive') return true;
        if (status === 'غير نشط') return true;
        return false;
    },

    /**
     * حساب الإحصائيات للموظفين
     */
    calculateStatistics() {
        const employees = AppState.appData.employees || [];
        
        if (employees.length === 0) {
            return {
                total: 0,
                averageAge: 0,
                genderStats: { male: 0, female: 0 },
                averageExperience: 0,
                inactiveCount: 0
            };
        }

        // حساب عدد الموظفين (النشطين فقط - لا يشمل المستقيلين أو من تم إلغاء تفعيلهم)
        const activeEmployees = employees.filter(e => !this.isEmployeeInactive(e));
        const total = activeEmployees.length;

        // حساب متوسط السن
        let totalAge = 0;
        let ageCount = 0;
        employees.forEach(emp => {
            const age = this.calculateAge(emp.birthDate);
            if (age && age > 0) {
                totalAge += age;
                ageCount++;
            }
        });
        const averageAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;

        // حساب النوع (ذكر/أنثى)
        let maleCount = 0;
        let femaleCount = 0;
        let unknownCount = 0; // لتتبع القيم غير المعروفة للتشخيص
        
        // دالة مساعدة لتطبيع قيمة النوع
        const normalizeGender = (genderValue) => {
            if (!genderValue) return '';
            // تحويل إلى نص وإزالة المسافات الزائدة
            let normalized = String(genderValue).trim().replace(/\s+/g, ' ').trim();
            // إزالة أي أحرف غير مرئية أو خاصة
            normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
            return normalized;
        };
        
        // دالة مساعدة للتحقق من النوع
        const checkGender = (genderValue) => {
            const normalized = normalizeGender(genderValue);
            if (!normalized) return { isMale: false, isFemale: false };
            
            // تحويل لحروف صغيرة للنصوص الإنجليزية
            const genderLower = normalized.toLowerCase();
            // الحصول على أول حرف كبير (للقيم المكونة من حرف واحد فقط)
            const genderFirstChar = normalized.length === 1 ? normalized.toUpperCase() : '';
            
            // قائمة بالقيم المحتملة للذكر (شاملة)
            const maleValues = [
                'ذكر',           // القيمة العربية الافتراضية
                'male',          // الإنجليزية
                'm',             // حرف واحد
                'M',             // حرف واحد كبير
                'ذكر ',          // مع مسافة في النهاية (سيتم إزالتها بالتطبيع)
                ' ذكر',          // مع مسافة في البداية (سيتم إزالتها بالتطبيع)
            ];
            
            // قائمة بالقيم المحتملة للأنثى (شاملة)
            const femaleValues = [
                'أنثى',          // القيمة العربية الافتراضية
                'female',        // الإنجليزية
                'f',             // حرف واحد
                'F',             // حرف واحد كبير
                'أنثى ',         // مع مسافة في النهاية (سيتم إزالتها بالتطبيع)
                ' أنثى',         // مع مسافة في البداية (سيتم إزالتها بالتطبيع)
            ];
            
            // التحقق من الذكر
            const isMale = normalized === 'ذكر' ||
                          genderLower === 'male' ||
                          genderFirstChar === 'M' ||
                          maleValues.some(val => normalizeGender(val) === normalized);
            
            // التحقق من الأنثى
            const isFemale = normalized === 'أنثى' ||
                            genderLower === 'female' ||
                            genderFirstChar === 'F' ||
                            femaleValues.some(val => normalizeGender(val) === normalized);
            
            return { isMale, isFemale, normalized };
        };
        
        employees.forEach(emp => {
            const genderCheck = checkGender(emp.gender);
            
            if (genderCheck.isMale) {
                maleCount++;
            } else if (genderCheck.isFemale) {
                femaleCount++;
            } else {
                unknownCount++;
                // عدم تسجيل تحذير لكل موظف (قيمة فارغة أو غير معروفة للنوع شائعة ولا تعتبر خطأ)
            }
        });
        
        // تسجيل إحصائية واحدة فقط عند وجود قيم غير محددة (وفي وضع التصحيح فقط لتقليل الضوضاء)
        if (unknownCount > 0 && typeof AppState !== 'undefined' && AppState.debugMode && typeof console !== 'undefined' && console.log) {
            console.log(`📊 [Employees] إحصائيات النوع - ذكر: ${maleCount}, أنثى: ${femaleCount}, غير محدد/فارغ: ${unknownCount} من ${total}`);
        }

        // حساب متوسط سنوات الخبرة (من تاريخ التعيين)
        let totalExperience = 0;
        let experienceCount = 0;
        const today = new Date();
        
        employees.forEach(emp => {
            if (emp.hireDate) {
                try {
                    const hireDate = this.parseLocalDate(emp.hireDate);
                    if (hireDate) {
                        const yearsDiff = today.getFullYear() - hireDate.getFullYear();
                        const monthDiff = today.getMonth() - hireDate.getMonth();
                        const dayDiff = today.getDate() - hireDate.getDate();
                        
                        let experienceYears = yearsDiff;
                        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                            experienceYears--;
                        }
                        
                        if (experienceYears >= 0) {
                            totalExperience += experienceYears;
                            experienceCount++;
                        }
                    }
                } catch (error) {
                    // تجاهل التواريخ غير الصحيحة
                }
            }
        });
        
        const averageExperience = experienceCount > 0 ? (totalExperience / experienceCount).toFixed(1) : 0;

        // ✅ حساب عدد الموظفين غير النشطين (المستقيلين) - يدعم inactive / غير نشط / تاريخ استقالة
        const inactiveCount = employees.filter(e => this.isEmployeeInactive(e)).length;

        return {
            total,
            averageAge,
            genderStats: {
                male: maleCount,
                female: femaleCount
            },
            averageExperience: parseFloat(averageExperience),
            inactiveCount // ✅ عدد المستقيلين
        };
    },

    /**
     * عرض كروت الإحصائيات
     */
    renderStatsCards() {
        const container = document.getElementById('employees-stats-cards');
        if (!container) return;

        const stats = this.calculateStatistics();
        
        // ✅ تحديث عدد المستقيلين في الزر
        this.updateInactiveCount();

        const cards = [
            {
                id: 'total',
                title: this.t('module.employees.stats.totalEmployees', 'عدد الموظفين'),
                value: stats.total,
                icon: 'fas fa-users',
                color: 'blue',
                gradient: 'from-blue-500 to-blue-600',
                bgGradient: 'from-blue-50 to-blue-100',
                borderColor: 'border-blue-200',
                textColor: 'text-blue-700',
                iconBg: 'bg-blue-100',
                description: this.t('module.employees.stats.totalEmployeesDesc', 'إجمالي عدد الموظفين المسجلين')
            },
            {
                id: 'average-age',
                title: this.t('module.employees.stats.avgAge', 'متوسط السن'),
                value: stats.averageAge > 0 ? `${stats.averageAge} ${this.t('module.common.yearsUnit', 'سنة')}` : this.t('module.common.notAvailable', 'غير متاح'),
                icon: 'fas fa-birthday-cake',
                color: 'green',
                gradient: 'from-green-500 to-green-600',
                bgGradient: 'from-green-50 to-green-100',
                borderColor: 'border-green-200',
                textColor: 'text-green-700',
                iconBg: 'bg-green-100',
                description: this.t('module.employees.stats.avgAgeDesc', 'متوسط عمر الموظفين')
            },
            {
                id: 'gender',
                title: this.t('module.employees.gender', 'النوع'),
                value: `${stats.genderStats.male} ${this.t('module.employees.genderMale', 'ذكر')} / ${stats.genderStats.female} ${this.t('module.employees.genderFemale', 'أنثى')}`,
                icon: 'fas fa-venus-mars',
                color: 'purple',
                gradient: 'from-purple-500 to-purple-600',
                bgGradient: 'from-purple-50 to-purple-100',
                borderColor: 'border-purple-200',
                textColor: 'text-purple-700',
                iconBg: 'bg-purple-100',
                description: this.t('module.employees.stats.genderDistDesc', 'توزيع الموظفين حسب النوع')
            },
            {
                id: 'experience',
                title: this.t('module.employees.stats.avgExperience', 'متوسط سنوات الخبرة'),
                value: stats.averageExperience > 0 ? `${stats.averageExperience} ${this.t('module.common.yearsUnit', 'سنة')}` : this.t('module.common.notAvailable', 'غير متاح'),
                icon: 'fas fa-briefcase',
                color: 'orange',
                gradient: 'from-orange-500 to-orange-600',
                bgGradient: 'from-orange-50 to-orange-100',
                borderColor: 'border-orange-200',
                textColor: 'text-orange-700',
                iconBg: 'bg-orange-100',
                description: this.t('module.employees.stats.avgExperienceDesc', 'متوسط سنوات الخبرة من تاريخ التعيين')
            }
        ];

        container.innerHTML = cards.map(card => {
            return `
                <div class="stats-card content-card transform transition-all duration-300 hover:scale-105 hover:shadow-xl border-2 ${card.borderColor} bg-gradient-to-br ${card.bgGradient}" 
                     style="position: relative; overflow: hidden;">
                    <!-- Pattern overlay -->
                    <div class="absolute top-0 right-0 w-32 h-32 opacity-10" style="background: radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px); background-size: 20px 20px;"></div>
                    
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-4">
                            <div class="${card.iconBg} p-3 rounded-xl shadow-md">
                                <i class="${card.icon} text-${card.color}-600 text-2xl"></i>
                            </div>
                        </div>
                        
                        <div class="mb-2">
                            <h3 class="text-sm font-semibold ${card.textColor} mb-1">${card.title}</h3>
                            <p class="text-xs text-gray-600">${card.description}</p>
                        </div>
                        
                        <div class="flex items-end justify-between mt-4">
                            <div class="text-2xl font-bold ${card.textColor}">
                                ${typeof card.value === 'number' ? card.value.toLocaleString('en-US') : card.value}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    getExternalWorkforceMonths() {
        const viewState = this.getExternalWorkforceViewState();
        const formatter = new Intl.DateTimeFormat(viewState.lang === 'en' ? 'en-US' : 'ar-EG', { month: 'short' });
        return [
            { key: 'jan', index: 0 },
            { key: 'feb', index: 1 },
            { key: 'mar', index: 2 },
            { key: 'apr', index: 3 },
            { key: 'may', index: 4 },
            { key: 'jun', index: 5 },
            { key: 'jul', index: 6 },
            { key: 'aug', index: 7 },
            { key: 'sep', index: 8 },
            { key: 'oct', index: 9 },
            { key: 'nov', index: 10 },
            { key: 'dec', index: 11 }
        ].map(month => ({
            ...month,
            label: formatter.format(new Date(2026, month.index, 1))
        }));
    },

    getExternalWorkforceViewState() {
        const lang = typeof I18n !== 'undefined' && typeof I18n.getCurrentLanguage === 'function'
            ? I18n.getCurrentLanguage()
            : (AppState?.currentLanguage || localStorage.getItem('language') || 'ar');
        const isRTL = typeof I18n !== 'undefined' && typeof I18n.isRTL === 'function'
            ? I18n.isRTL()
            : lang === 'ar';

        return {
            lang,
            isRTL,
            dir: isRTL ? 'rtl' : 'ltr',
            stickySide: isRTL ? 'right' : 'left',
            textAlign: isRTL ? 'right' : 'left',
            labels: {
                employeesTab: lang === 'en' ? 'Employee Database' : 'قاعدة بيانات الموظفين',
                externalTab: lang === 'en' ? 'External Workforce / Contractors' : 'العمالة الخارجية / المقاولين',
                contractor: lang === 'en' ? 'Company / Contractor' : 'الشركة / المقاول',
                noCode: lang === 'en' ? 'No code' : 'بدون كود',
                total: 'Total',
                externalTotal: lang === 'en' ? 'Total External Workforce' : 'إجمالي العمالة الخارجية',
                directEmployees: lang === 'en' ? 'Direct Employees' : 'العمالة المثبتة',
                combinedTotal: lang === 'en' ? 'Combined Total' : 'الإجمالي المشترك',
                estimatedHours: lang === 'en' ? 'Estimated Work Hours' : 'ساعات العمل التقديرية'
            }
        };
    },

    getExternalWorkforceRecords() {
        if (!AppState.appData || typeof AppState.appData !== 'object') AppState.appData = {};
        if (!Array.isArray(AppState.appData.externalWorkforceMonthly)) {
            AppState.appData.externalWorkforceMonthly = [];
        }
        return AppState.appData.externalWorkforceMonthly;
    },

    getExternalWorkforceYearOptions() {
        const years = new Set([this.externalWorkforceYear, new Date().getFullYear(), new Date().getFullYear() - 1]);
        this.getExternalWorkforceRecords().forEach(record => {
            const year = Number(record?.year);
            if (Number.isFinite(year) && year > 2000) years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    },

    normalizeExternalWorkforceContractor(record = {}, index = 0) {
        const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        const contractorId = clean(record.contractorId || record.id);
        const contractorCode = clean(record.contractorCode || record.code || record.isoCode);
        const contractorName = clean(record.contractorName || record.companyName || record.name || record.company || `Contractor ${index + 1}`);
        const stableKey = (contractorCode || contractorId || contractorName.toLowerCase()).toLowerCase();

        return { contractorId, contractorCode, contractorName, stableKey };
    },

    async ensureExternalWorkforceDataLoaded(forceReload = false) {
        if (this._externalWorkforceLoaded && !forceReload) return true;
        if (this._externalWorkforceLoadPromise && !forceReload) return this._externalWorkforceLoadPromise;

        const data = AppState.appData || (AppState.appData = {});
        const tasks = [];

        if ((!Array.isArray(data.approvedContractors) || data.approvedContractors.length === 0) &&
            typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.readFromSheets === 'function') {
            tasks.push(
                GoogleIntegration.readFromSheets('ApprovedContractors', 15000)
                    .then(result => {
                        if (Array.isArray(result)) data.approvedContractors = result;
                    })
                    .catch(() => {})
            );
        }

        if ((forceReload || !Array.isArray(data.externalWorkforceMonthly) || data.externalWorkforceMonthly.length === 0) &&
            typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.readFromSheets === 'function') {
            tasks.push(
                GoogleIntegration.readFromSheets('ExternalWorkforceMonthly', 15000)
                    .then(result => {
                        if (Array.isArray(result)) data.externalWorkforceMonthly = result;
                    })
                    .catch(() => {})
            );
        }

        this._externalWorkforceLoadPromise = Promise.allSettled(tasks).then(() => {
            this._externalWorkforceLoaded = true;
            return true;
        }).finally(() => {
            this._externalWorkforceLoadPromise = null;
        });

        return this._externalWorkforceLoadPromise;
    },

    getAvailableContractorsForExternalWorkforce() {
        let contractors = [];
        try {
            if (typeof Contractors !== 'undefined' && typeof Contractors.getAllContractorsForModules === 'function') {
                contractors = Contractors.getAllContractorsForModules() || [];
            }
        } catch (error) {
            contractors = [];
        }

        if (!Array.isArray(contractors) || contractors.length === 0) {
            contractors = (AppState.appData.approvedContractors || []).filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE');
        }

        const unique = new Map();
        contractors.forEach((record, index) => {
            const normalized = this.normalizeExternalWorkforceContractor(record, index);
            if (!normalized.stableKey || unique.has(normalized.stableKey)) return;
            unique.set(normalized.stableKey, normalized);
        });

        return Array.from(unique.values()).sort((a, b) => a.contractorName.localeCompare(b.contractorName, 'ar'));
    },

    getExternalWorkforceRecord(year, stableKey) {
        return this.getExternalWorkforceRecords().find(record =>
            record &&
            Number(record.year) === Number(year) &&
            this.normalizeExternalWorkforceContractor(record).stableKey === stableKey
        ) || null;
    },

    getExternalWorkforceMonthlyValue(record, monthKey) {
        const value = parseFloat(record?.[monthKey]);
        return Number.isFinite(value) && value >= 0 ? value : 0;
    },

    getOperationalEmployeesForMonth(monthIndex, year = this.externalWorkforceYear) {
        const employees = AppState.appData.employees || [];
        const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

        return employees.filter(employee => {
            if (!employee) return false;
            const hireDate = this.parseLocalDate(employee.hireDate || employee.startDate || employee.createdAt);
            const resignationDate = this.parseLocalDate(employee.resignationDate || employee.endDate || employee.terminationDate);
            if (hireDate && hireDate > monthEnd) return false;
            if (resignationDate && resignationDate <= monthEnd) return false;
            if (this.isEmployeeInactive(employee) && !resignationDate) return false;
            return true;
        }).length;
    },

    buildExternalWorkforceModel(year = this.externalWorkforceYear) {
        const getVersion = (list = [], fields = []) => {
            if (!Array.isArray(list) || list.length === 0) return '0:0';
            let max = 0;
            list.forEach(item => {
                const rawValue = fields.map(field => item?.[field]).find(Boolean);
                const parsed = rawValue ? new Date(rawValue) : null;
                if (parsed && !Number.isNaN(parsed.getTime())) {
                    max = Math.max(max, parsed.getTime());
                }
            });
            return `${list.length}:${max}`;
        };

        const cacheKey = `external:${year}:${getVersion(this.getExternalWorkforceRecords(), ['updatedAt', 'createdAt'])}:${getVersion(AppState.appData.approvedContractors || [], ['updatedAt', 'createdAt', 'approvalDate'])}:${getVersion(AppState.appData.employees || [], ['updatedAt', 'createdAt', 'hireDate', 'resignationDate'])}`;
        if (this._externalWorkforceCache.has(cacheKey)) {
            return this._externalWorkforceCache.get(cacheKey);
        }

        const months = this.getExternalWorkforceMonths();
        const contractors = this.getAvailableContractorsForExternalWorkforce();
        const rows = contractors.map(contractor => {
            const record = this.getExternalWorkforceRecord(year, contractor.stableKey) || {};
            const values = months.map(month => this.getExternalWorkforceMonthlyValue(record, month.key));
            return {
                ...contractor,
                recordId: record.id || `EWM-${year}-${contractor.stableKey}`,
                values,
                total: values.reduce((sum, value) => sum + value, 0)
            };
        });

        const monthTotals = months.map((_, monthIndex) => rows.reduce((sum, row) => sum + (row.values[monthIndex] || 0), 0));
        const directEmployees = months.map(month => this.getOperationalEmployeesForMonth(month.index, year));
        const combined = months.map((_, monthIndex) => directEmployees[monthIndex] + monthTotals[monthIndex]);
        const estimatedHours = combined.map(value => value * 8 * 22);

        const model = {
            year,
            months,
            rows,
            monthTotals,
            directEmployees,
            combined,
            estimatedHours,
            grandTotal: monthTotals.reduce((sum, value) => sum + value, 0)
        };

        this._externalWorkforceCache.clear();
        this._externalWorkforceCache.set(cacheKey, model);
        return model;
    },

    renderExternalWorkforcePanel() {
        const canManage = this.canManageExternalWorkforceTab();
        const viewState = this.getExternalWorkforceViewState();
        const labels = {
            title: viewState.lang === 'en' ? 'External Workforce / Contractors' : 'العمالة الخارجية / المقاولين',
            description: viewState.lang === 'en'
                ? 'Monthly table linked to approved contractors and used automatically in Safety Performance Scorecard to calculate combined headcount and work hours.'
                : 'جدول شهري مرتبط بالمقاولين المعتمدين ويُستخدم تلقائيًا داخل Safety Performance Scorecard لحساب العدد الكلي وساعات العمل.',
            year: viewState.lang === 'en' ? 'Year' : 'السنة',
            admin: viewState.lang === 'en' ? 'Admin Edit' : 'تحرير إداري',
            viewOnly: viewState.lang === 'en' ? 'View Only' : 'عرض فقط',
            exportExcel: viewState.lang === 'en' ? 'Export Excel' : 'تصدير Excel',
            exportPdf: viewState.lang === 'en' ? 'Export PDF' : 'تصدير PDF',
            importExcel: viewState.lang === 'en' ? 'Import Excel' : 'استيراد اكسيل'
        };
        labels.title = viewState.lang === 'en' ? 'External Workforce / Contractors' : '\u0627\u0644\u0639\u0645\u0627\u0644\u0629 \u0627\u0644\u062e\u0627\u0631\u062c\u064a\u0629 / \u0627\u0644\u0645\u0642\u0627\u0648\u0644\u064a\u0646';
        labels.description = viewState.lang === 'en'
            ? 'Monthly table linked to approved contractors and used automatically in Safety Performance Scorecard to calculate combined headcount and work hours.'
            : '\u062c\u062f\u0648\u0644 \u0634\u0647\u0631\u064a \u0645\u0631\u062a\u0628\u0637 \u0628\u0627\u0644\u0645\u0642\u0627\u0648\u0644\u064a\u0646 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u064a\u0646 \u0648\u064a\u064f\u0633\u062a\u062e\u062f\u0645 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u062f\u0627\u062e\u0644 Safety Performance Scorecard \u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u062f\u062f \u0627\u0644\u0643\u0644\u064a \u0648\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644.';
        labels.year = viewState.lang === 'en' ? 'Year' : '\u0627\u0644\u0633\u0646\u0629';
        labels.admin = viewState.lang === 'en' ? 'Admin Edit' : '\u062a\u062d\u0631\u064a\u0631 \u0625\u062f\u0627\u0631\u064a';
        labels.viewOnly = viewState.lang === 'en' ? 'View Only' : '\u0639\u0631\u0636 \u0641\u0642\u0637';
        labels.exportExcel = viewState.lang === 'en' ? 'Export Excel' : '\u062a\u0635\u062f\u064a\u0631 Excel';
        labels.exportPdf = viewState.lang === 'en' ? 'Export PDF' : '\u062a\u0635\u062f\u064a\u0631 PDF';
        labels.importExcel = viewState.lang === 'en' ? 'Import Excel' : '\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0643\u0633\u064a\u0644';
        return `
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 class="card-title">
                                <i class="fas fa-helmet-safety ml-2"></i>
                                العمالة الخارجية / المقاولين
                            </h2>
                            <p class="text-sm text-gray-600 mt-2">جدول شهري مرتبط بالمقاولين المعتمدين ويُستخدم تلقائيًا داخل Safety Performance Scorecard لحساب العدد الكلي وساعات العمل.</p>
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                            <label class="text-sm font-semibold text-gray-700" for="external-workforce-year">السنة</label>
                            <select id="external-workforce-year" class="form-input" style="min-width: 120px;"></select>
                            ${canManage ? '<span class="text-xs px-3 py-2 rounded-full bg-blue-100 text-blue-700 font-semibold">تحرير إداري</span>' : '<span class="text-xs px-3 py-2 rounded-full bg-gray-100 text-gray-600 font-semibold">عرض فقط</span>'}
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="external-workforce-summary" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"></div>
                    <div class="table-wrapper" style="overflow-x: auto;">
                        <div id="external-workforce-table-container"></div>
                    </div>
                </div>
            </div>
        `;
    },

    populateExternalWorkforceYearSelector() {
        const select = document.getElementById('external-workforce-year');
        if (!select) return;
        select.innerHTML = this.getExternalWorkforceYearOptions()
            .map(year => `<option value="${year}" ${year === this.externalWorkforceYear ? 'selected' : ''}>${year}</option>`)
            .join('');
    },

    renderExternalWorkforceSummary(model) {
        const container = document.getElementById('external-workforce-summary');
        if (!container || !model) return;

        const ytdLimit = model.year === new Date().getFullYear() ? new Date().getMonth() : 11;
        const ytdContractors = model.monthTotals.slice(0, ytdLimit + 1).reduce((sum, value) => sum + value, 0);
        const ytdDirectEmployees = model.directEmployees.slice(0, ytdLimit + 1).reduce((sum, value) => sum + value, 0);
        const ytdCombined = model.combined.slice(0, ytdLimit + 1).reduce((sum, value) => sum + value, 0);
        const ytdHours = model.estimatedHours.slice(0, ytdLimit + 1).reduce((sum, value) => sum + value, 0);

        const cards = [
            { label: 'إجمالي العمالة الخارجية YTD', value: ytdContractors, color: '#0ea5e9', icon: 'fa-users-viewfinder' },
            { label: 'إجمالي العمالة المثبتة YTD', value: ytdDirectEmployees, color: '#2563eb', icon: 'fa-user-check' },
            { label: 'الإجمالي المشترك YTD', value: ytdCombined, color: '#16a34a', icon: 'fa-people-group' },
            { label: 'ساعات العمل التقديرية YTD', value: ytdHours.toLocaleString('en-US'), color: '#f59e0b', icon: 'fa-clock' }
        ];

        container.innerHTML = cards.map(card => `
            <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-sm font-semibold text-gray-500">${card.label}</div>
                        <div class="text-3xl font-black mt-3" style="color:${card.color};">${card.value}</div>
                    </div>
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style="background:${card.color};">
                        <i class="fas ${card.icon}"></i>
                    </div>
                </div>
            </div>
        `).join('');
    },

    ensureExternalWorkforceToolbar() {
        const panel = document.getElementById('employees-external-panel');
        if (!panel) return;

        const header = panel.querySelector('.card-header');
        const title = panel.querySelector('.card-title');
        const description = panel.querySelector('.card-header p');
        const yearLabel = panel.querySelector('label[for="external-workforce-year"]');
        const badge = panel.querySelector('.rounded-full');
        const controlsRow = yearLabel?.parentElement;
        const canManage = this.canManageExternalWorkforceTab();
        const labels = this.getExternalWorkforceViewState().labels;
        const meta = {
            description: this.getExternalWorkforceViewState().lang === 'en'
                ? 'Monthly table linked to approved contractors and used automatically in Safety Performance Scorecard to calculate combined headcount and work hours.'
                : '\u062c\u062f\u0648\u0644 \u0634\u0647\u0631\u064a \u0645\u0631\u062a\u0628\u0637 \u0628\u0627\u0644\u0645\u0642\u0627\u0648\u0644\u064a\u0646 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u064a\u0646 \u0648\u064a\u064f\u0633\u062a\u062e\u062f\u0645 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u062f\u0627\u062e\u0644 Safety Performance Scorecard \u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u062f\u062f \u0627\u0644\u0643\u0644\u064a \u0648\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644.',
            year: this.getExternalWorkforceViewState().lang === 'en' ? 'Year' : '\u0627\u0644\u0633\u0646\u0629',
            admin: this.getExternalWorkforceViewState().lang === 'en' ? 'Admin Edit' : '\u062a\u062d\u0631\u064a\u0631 \u0625\u062f\u0627\u0631\u064a',
            viewOnly: this.getExternalWorkforceViewState().lang === 'en' ? 'View Only' : '\u0639\u0631\u0636 \u0641\u0642\u0637',
            exportExcel: this.getExternalWorkforceViewState().lang === 'en' ? 'Export Excel' : '\u062a\u0635\u062f\u064a\u0631 Excel',
            exportPdf: this.getExternalWorkforceViewState().lang === 'en' ? 'Export PDF' : '\u062a\u0635\u062f\u064a\u0631 PDF',
            importExcel: this.getExternalWorkforceViewState().lang === 'en' ? 'Import Excel' : '\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0643\u0633\u064a\u0644'
        };

        if (title) {
            title.innerHTML = `<i class="fas fa-helmet-safety ml-2"></i>${labels.externalTab}`;
        }
        if (description) description.textContent = meta.description;
        if (yearLabel) yearLabel.textContent = meta.year;
        if (badge) badge.textContent = canManage ? meta.admin : meta.viewOnly;
        if (!controlsRow) return;

        let actions = document.getElementById('external-workforce-actions');
        if (!actions) {
            actions = document.createElement('div');
            actions.id = 'external-workforce-actions';
            actions.className = 'flex items-center gap-3 flex-wrap';
            actions.innerHTML = `
                <button type="button" id="external-workforce-export-excel-btn" class="btn-secondary">
                    <i class="fas fa-file-excel ml-2"></i>
                    <span></span>
                </button>
                <button type="button" id="external-workforce-export-pdf-btn" class="btn-secondary">
                    <i class="fas fa-file-pdf ml-2"></i>
                    <span></span>
                </button>
                ${canManage ? `
                <button type="button" id="external-workforce-import-excel-btn" class="btn-secondary">
                    <i class="fas fa-file-import ml-2"></i>
                    <span></span>
                </button>
                <input type="file" id="external-workforce-import-input" accept=".xlsx,.xls" style="display:none;">
                ` : ''}
            `;
            controlsRow.insertBefore(actions, controlsRow.firstChild);
        }

        const excelLabel = actions.querySelector('#external-workforce-export-excel-btn span');
        const pdfLabel = actions.querySelector('#external-workforce-export-pdf-btn span');
        const importLabel = actions.querySelector('#external-workforce-import-excel-btn span');
        if (excelLabel) excelLabel.textContent = meta.exportExcel;
        if (pdfLabel) pdfLabel.textContent = meta.exportPdf;
        if (importLabel) importLabel.textContent = meta.importExcel;
    },

    getExternalWorkforceExportRows(year = this.externalWorkforceYear) {
        const model = this.buildExternalWorkforceModel(year);
        const labels = this.getExternalWorkforceViewState().labels;
        const header = [labels.contractor, 'Code', ...model.months.map(month => month.label), labels.total];
        const rows = model.rows.map(row => [
            row.contractorName,
            row.contractorCode || row.contractorId || '',
            ...row.values,
            row.total
        ]);
        rows.push([labels.externalTotal, '', ...model.monthTotals, model.grandTotal]);
        rows.push([labels.directEmployees, '', ...model.directEmployees, model.directEmployees.reduce((sum, value) => sum + value, 0)]);
        rows.push([labels.combinedTotal, '', ...model.combined, model.combined.reduce((sum, value) => sum + value, 0)]);
        rows.push([labels.estimatedHours, '', ...model.estimatedHours, model.estimatedHours.reduce((sum, value) => sum + value, 0)]);
        return { model, header, rows };
    },

    exportExternalWorkforceToExcel() {
        if (typeof XLSX === 'undefined') {
            Notification.error('XLSX library is not available');
            return;
        }

        const { model, header, rows } = this.getExternalWorkforceExportRows();
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'External Workforce');
        XLSX.writeFile(workbook, `external_workforce_${model.year}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    },

    exportExternalWorkforceToPDF() {
        const { model, header, rows } = this.getExternalWorkforceExportRows();
        const viewState = this.getExternalWorkforceViewState();
        const reportTitle = `${viewState.labels.externalTab} - ${model.year}`;
        const exportDate = new Date().toISOString();
        const tableRows = [header, ...rows].map((row, index) => `
            <tr>
                ${row.map(cell => `<${index === 0 ? 'th' : 'td'}>${Utils.escapeHTML(String(cell ?? ''))}</${index === 0 ? 'th' : 'td'}>`).join('')}
            </tr>
        `).join('');

        const content = `
            <style>
                .external-workforce-report {
                    direction: ${viewState.dir};
                    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                }
                .external-workforce-report__meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 18px;
                    padding: 12px 16px;
                    border: 1px solid #D7E3F1;
                    border-radius: 12px;
                    background: #F8FBFF;
                    font-size: 13px;
                    color: #334155;
                }
                .external-workforce-report__meta strong {
                    color: #0F172A;
                }
                .external-workforce-report__table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    direction: ${viewState.dir};
                }
                .external-workforce-report__table th,
                .external-workforce-report__table td {
                    border: 1px solid #334155;
                    padding: 8px 6px;
                    text-align: center;
                    font-size: 11px;
                    word-break: break-word;
                }
                .external-workforce-report__table th {
                    background: #B7D2EA;
                    color: #102A43;
                    font-weight: 700;
                }
                .external-workforce-report__table td:first-child,
                .external-workforce-report__table th:first-child {
                    font-weight: 700;
                    background: #DCEAF7;
                }
                @media print {
                    .external-workforce-report__meta {
                        break-inside: avoid;
                    }
                }
            </style>
            <div class="external-workforce-report" dir="${viewState.dir}" lang="${viewState.lang}">
                <div class="external-workforce-report__meta">
                    <div><strong>${Utils.escapeHTML(viewState.labels.year)}:</strong> ${Utils.escapeHTML(String(model.year))}</div>
                    <div><strong>${Utils.escapeHTML(viewState.labels.externalTab)}</strong></div>
                    <div><strong>${Utils.escapeHTML(viewState.labels.totalHoursYtd || 'YTD Hours')}:</strong> ${Utils.escapeHTML(String(model.hoursYtd || 0))}</div>
                </div>
                <table class="external-workforce-report__table">${tableRows}</table>
            </div>
        `;

        const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
            ? FormHeader.generatePDFHTML(
                `EXT-WORKFORCE-${model.year}`,
                reportTitle,
                content,
                false,
                true,
                {
                    version: '1.0',
                    source: 'ExternalWorkforceMonthly',
                    reportYear: model.year,
                    releaseDate: exportDate,
                    revisionDate: exportDate
                },
                exportDate,
                exportDate
            )
            : `<!DOCTYPE html><html lang="${viewState.lang}" dir="${viewState.dir}"><head><meta charset="UTF-8"><title>${Utils.escapeHTML(reportTitle)}</title></head><body style="font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:${viewState.dir};padding:20px;">${content}</body></html>`;

        const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
            URL.revokeObjectURL(url);
            Notification.error('Unable to open print window');
            return;
        }

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 400);
        };
    },

    async importExternalWorkforceExcelFile(file) {
        if (!file || !this.canManageExternalWorkforceTab()) return;
        if (typeof XLSX === 'undefined') {
            Notification.error('XLSX library is not available');
            return;
        }

        Loading.show();
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });
            if (!Array.isArray(aoa) || aoa.length < 2) throw new Error('File is empty');

            const header = aoa[0].map(cell => String(cell || '').trim().toLowerCase());
            const contractors = this.getAvailableContractorsForExternalWorkforce();
            const year = Number(this.externalWorkforceYear);
            const monthMap = {
                jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
                may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
                oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
                'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3, 'ابريل': 3, 'مايو': 4, 'يونيو': 5,
                'يوليو': 6, 'أغسطس': 7, 'اغسطس': 7, 'سبتمبر': 8, 'أكتوبر': 9, 'اكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11
            };
            const monthKeys = this.getExternalWorkforceMonths().map(month => month.key);
            const companyIndex = header.findIndex(value => value.includes('contractor') || value.includes('company') || value.includes('الشركة') || value.includes('المقاول'));
            const codeIndex = header.findIndex(value => value === 'code' || value.includes('contractor code') || value.includes('الكود'));
            const monthIndexes = {};
            header.forEach((value, index) => {
                const normalized = value.replace(/\./g, '').trim();
                if (monthMap[normalized] !== undefined) {
                    monthIndexes[monthKeys[monthMap[normalized]]] = index;
                }
            });

            const records = this.getExternalWorkforceRecords();
            let updatedRows = 0;
            aoa.slice(1).forEach(row => {
                const rawName = companyIndex >= 0 ? String(row[companyIndex] || '').trim() : '';
                const rawCode = codeIndex >= 0 ? String(row[codeIndex] || '').trim() : '';
                if (!rawName && !rawCode) return;

                const contractor = contractors.find(item =>
                    (rawCode && (item.contractorCode || '').trim().toLowerCase() === rawCode.toLowerCase()) ||
                    (rawName && item.contractorName.trim().toLowerCase() === rawName.toLowerCase())
                );
                if (!contractor) return;

                let record = this.getExternalWorkforceRecord(year, contractor.stableKey);
                if (!record) {
                    record = {
                        id: `EWM-${year}-${contractor.stableKey}`,
                        year,
                        contractorId: contractor.contractorId || '',
                        contractorCode: contractor.contractorCode || '',
                        contractorName: contractor.contractorName || '',
                        createdAt: new Date().toISOString()
                    };
                    records.push(record);
                }

                monthKeys.forEach(monthKey => {
                    const columnIndex = monthIndexes[monthKey];
                    if (columnIndex === undefined) return;
                    record[monthKey] = Math.max(0, parseInt(row[columnIndex] || '0', 10) || 0);
                });
                record.total = monthKeys.reduce((sum, key) => sum + (parseInt(record[key] || '0', 10) || 0), 0);
                record.updatedAt = new Date().toISOString();
                record.updatedBy = AppState.currentUser?.name || AppState.currentUser?.email || 'admin';
                updatedRows += 1;
            });

            this._externalWorkforceCache.clear();
            this.renderExternalWorkforceTable();
            if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') DataManager.save();
            if (typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.autoSave === 'function') {
                await GoogleIntegration.autoSave('ExternalWorkforceMonthly', records).catch(() => {});
            }
            window.dispatchEvent(new CustomEvent('employeesDataUpdated', { detail: { externalWorkforce: true, year } }));
            Notification.success(`Imported ${updatedRows} rows successfully`);
        } catch (error) {
            Notification.error(`Failed to import file: ${error.message}`);
        } finally {
            Loading.hide();
        }
    },

    renderExternalWorkforceTable() {
        const container = document.getElementById('external-workforce-table-container');
        if (!container) return;

        const model = this.buildExternalWorkforceModel(this.externalWorkforceYear);
        const viewState = this.getExternalWorkforceViewState();
        const { dir, stickySide, textAlign, labels } = viewState;
        this.renderExternalWorkforceSummary(model);
        const canManage = this.canManageExternalWorkforceTab();
        const monthHeaders = model.months.map(month => `<th style="min-width: 74px;">${month.label}</th>`).join('');

        const bodyRows = model.rows.map((row, rowIndex) => {
            const cells = model.months.map((month, monthIndex) => {
                const value = row.values[monthIndex] || 0;
                const content = canManage
                    ? `<input type="number" min="0" step="1" class="form-input external-workforce-input" style="min-width:70px;text-align:center;padding:6px 8px;" value="${value}" data-row="${rowIndex}" data-contractor-key="${row.stableKey}" data-month="${month.key}" />`
                    : `<span class="font-semibold text-slate-700">${value}</span>`;
                return `<td style="background:#dceaf6;">${content}</td>`;
            }).join('');

            return `
                <tr>
                    <td class="sticky-cell" style="background:#c7dcef; font-weight:700; text-align:${textAlign};">
                        <div>${Utils.escapeHTML(row.contractorName)}</div>
                        <div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(row.contractorCode || row.contractorId || 'بدون كود')}</div>
                    </td>
                    ${cells}
                    <td style="background:#dceaf6; font-weight:800;">${row.total}</td>
                </tr>
            `;
        }).join('');

        const totalsCells = model.monthTotals.map(value => `<td style="background:#fff6cf; font-weight:800;">${value}</td>`).join('');
        const directCells = model.directEmployees.map(value => `<td style="background:#eef2ff; font-weight:700;">${value}</td>`).join('');
        const combinedCells = model.combined.map(value => `<td style="background:#ecfdf5; font-weight:800;">${value}</td>`).join('');
        const hoursCells = model.estimatedHours.map(value => `<td style="background:#fff7ed; font-weight:700;">${value.toLocaleString('en-US')}</td>`).join('');

        container.innerHTML = `
            <style>
                .external-workforce-table { width: max-content; min-width: 100%; border-collapse: collapse; direction: ltr; }
                .external-workforce-table th, .external-workforce-table td { border: 1px solid #1f2937; padding: 8px; text-align: center; white-space: nowrap; }
                .external-workforce-table thead th { background: #b7d2ea; font-weight: 800; }
                @media (max-width: 768px) {
                    .external-workforce-table th, .external-workforce-table td { padding: 6px; font-size: 12px; }
                }
            </style>
            <table class="external-workforce-table">
                <thead>
                    <tr>
                        <th class="sticky-cell" style="position:sticky; right:0; min-width:240px; z-index:2; text-align:right;">الشركة / المقاول</th>
                        ${monthHeaders}
                        <th style="min-width:80px;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows}
                    <tr>
                        <td class="sticky-cell" style="position:sticky; right:0; background:#fff6cf; z-index:1; font-weight:800; text-align:right;">إجمالي العمالة الخارجية</td>
                        ${totalsCells}
                        <td style="background:#fff6cf; font-weight:900;">${model.grandTotal}</td>
                    </tr>
                    <tr>
                        <td class="sticky-cell" style="position:sticky; right:0; background:#eef2ff; z-index:1; font-weight:800; text-align:right;">العمالة المثبتة</td>
                        ${directCells}
                        <td style="background:#eef2ff; font-weight:900;">${model.directEmployees.reduce((sum, value) => sum + value, 0)}</td>
                    </tr>
                    <tr>
                        <td class="sticky-cell" style="position:sticky; right:0; background:#ecfdf5; z-index:1; font-weight:800; text-align:right;">الإجمالي المشترك</td>
                        ${combinedCells}
                        <td style="background:#ecfdf5; font-weight:900;">${model.combined.reduce((sum, value) => sum + value, 0)}</td>
                    </tr>
                    <tr>
                        <td class="sticky-cell" style="position:sticky; right:0; background:#fff7ed; z-index:1; font-weight:800; text-align:right;">ساعات العمل التقديرية</td>
                        ${hoursCells}
                        <td style="background:#fff7ed; font-weight:900;">${model.estimatedHours.reduce((sum, value) => sum + value, 0).toLocaleString('en-US')}</td>
                    </tr>
                </tbody>
            </table>
        `;

        const table = container.querySelector('.external-workforce-table');
        if (!table) return;

        let shell = container.querySelector('.external-workforce-shell');
        if (!shell) {
            shell = document.createElement('div');
            shell.className = 'external-workforce-shell';
            table.parentNode.insertBefore(shell, table);
            shell.appendChild(table);
        }

        shell.setAttribute('dir', dir);
        Object.assign(shell.style, {
            width: '100%',
            maxWidth: '100%',
            maxHeight: 'min(70vh, calc(100vh - 260px))',
            overflow: 'auto',
            border: '1px solid #cbd5e1',
            borderRadius: '18px',
            background: '#ffffff'
        });

        Object.assign(table.style, {
            width: 'max(100%, 1180px)',
            borderCollapse: 'separate',
            borderSpacing: '0',
            direction: dir,
            tableLayout: 'fixed'
        });

        table.querySelectorAll('th, td').forEach(cell => {
            cell.style.padding = 'clamp(6px, 0.7vw, 10px)';
            cell.style.fontSize = 'clamp(11px, 0.85vw, 14px)';
        });

        const headerCells = Array.from(table.querySelectorAll('thead th'));
        headerCells.forEach(cell => {
            cell.style.position = 'sticky';
            cell.style.top = '0';
            cell.style.zIndex = '4';
            cell.style.background = '#b7d2ea';
        });

        if (headerCells[0]) {
            headerCells[0].textContent = labels.contractor;
            headerCells[0].classList.add('sticky-cell');
            headerCells[0].style.textAlign = textAlign;
        }
        if (headerCells[headerCells.length - 1]) {
            headerCells[headerCells.length - 1].textContent = labels.total;
        }

        table.querySelectorAll('.sticky-cell').forEach(cell => {
            cell.style.position = 'sticky';
            cell.style.left = '';
            cell.style.right = '';
            cell.style[stickySide] = '0';
            cell.style.zIndex = cell.closest('thead') ? '6' : '2';
            cell.style.minWidth = 'clamp(170px, 18vw, 240px)';
            cell.style.maxWidth = 'clamp(170px, 18vw, 260px)';
            cell.style.whiteSpace = 'normal';
            cell.style.wordBreak = 'break-word';
        });

        const tableRows = Array.from(table.querySelectorAll('tbody tr'));
        const dataRows = tableRows.slice(0, model.rows.length);
        dataRows.forEach((rowElement, index) => {
            const stickyCell = rowElement.querySelector('.sticky-cell');
            const contractor = model.rows[index];
            if (!stickyCell || !contractor) return;
            stickyCell.style.textAlign = textAlign;
            stickyCell.innerHTML = `
                <div>${Utils.escapeHTML(contractor.contractorName)}</div>
                <div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML(contractor.contractorCode || contractor.contractorId || labels.noCode)}</div>
            `;
        });

        const summaryLabels = [labels.externalTotal, labels.directEmployees, labels.combinedTotal, labels.estimatedHours];
        tableRows.slice(-4).forEach((rowElement, index) => {
            const stickyCell = rowElement.querySelector('.sticky-cell');
            if (!stickyCell) return;
            stickyCell.textContent = summaryLabels[index] || stickyCell.textContent;
            stickyCell.style.textAlign = textAlign;
        });

        table.querySelectorAll('.external-workforce-input').forEach(input => {
            input.style.width = '100%';
            input.style.minWidth = '0';
            input.style.height = window.innerWidth <= 768 ? '32px' : '36px';
            input.style.padding = '6px 8px';
            input.style.textAlign = 'center';
        });

        if (window.innerWidth <= 768) {
            shell.style.maxHeight = 'min(62vh, calc(100vh - 220px))';
            table.style.width = 'max(100%, 980px)';
        }
    },

    async saveExternalWorkforceValue(stableKey, monthKey, rawValue) {
        if (!this.canManageExternalWorkforceTab()) return;

        const contractor = this.getAvailableContractorsForExternalWorkforce().find(item => item.stableKey === stableKey);
        if (!contractor) return;

        const year = Number(this.externalWorkforceYear);
        const records = this.getExternalWorkforceRecords();
        let record = this.getExternalWorkforceRecord(year, stableKey);
        if (!record) {
            record = {
                id: `EWM-${year}-${stableKey}`,
                year,
                contractorId: contractor.contractorId || '',
                contractorCode: contractor.contractorCode || '',
                contractorName: contractor.contractorName || '',
                createdAt: new Date().toISOString()
            };
            records.push(record);
        }

        record[monthKey] = Math.max(0, parseInt(rawValue || '0', 10) || 0);
        record.total = this.getExternalWorkforceMonths().reduce((sum, month) => sum + (parseInt(record[month.key] || '0', 10) || 0), 0);
        record.updatedAt = new Date().toISOString();
        record.updatedBy = AppState.currentUser?.name || AppState.currentUser?.email || 'admin';

        this._externalWorkforceCache.clear();
        this.renderExternalWorkforceTable();

        if (typeof DataManager !== 'undefined' && typeof DataManager.save === 'function') {
            DataManager.save();
        }
        if (typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('ExternalWorkforceMonthly', records).catch(() => {});
        }

        window.dispatchEvent(new CustomEvent('employeesDataUpdated', {
            detail: { externalWorkforce: true, year }
        }));
    },

    switchTab(tabName) {
        const nextTab = tabName === 'external-workforce' ? 'external-workforce' : 'employees-list';
        this.activeTab = nextTab;

        document.querySelectorAll('[data-employees-tab]').forEach(button => {
            const isActive = button.getAttribute('data-employees-tab') === nextTab;
            button.classList.toggle('active', isActive);
            button.style.background = isActive ? 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)' : '#eff6ff';
            button.style.color = isActive ? '#fff' : '#1d4ed8';
            button.style.borderColor = isActive ? '#0f172a' : '#bfdbfe';
        });

        const employeesPanel = document.getElementById('employees-list-panel');
        const externalPanel = document.getElementById('employees-external-panel');
        if (employeesPanel) employeesPanel.classList.toggle('hidden', nextTab !== 'employees-list');
        if (externalPanel) externalPanel.classList.toggle('hidden', nextTab !== 'external-workforce');

        if (nextTab === 'external-workforce') {
            this.populateExternalWorkforceYearSelector();
            this.ensureExternalWorkforceDataLoaded().then(() => this.renderExternalWorkforceTable()).catch(() => {});
        } else if (this.canViewEmployeesRegistryTab()) {
            this.loadEmployeesList();
            this.scrollToSearchField();
        }
    },

    async renderList() {
        const canAdmin = this.canAddOrImport();
        const canViewRegistry = this.canViewEmployeesRegistryTab();
        const canViewExternal = this.canViewExternalWorkforceTab();
        const preferredTab = canViewRegistry ? 'employees-list' : (canViewExternal ? 'external-workforce' : 'employees-list');
        if ((this.activeTab === 'employees-list' && !canViewRegistry) || (this.activeTab === 'external-workforce' && !canViewExternal)) {
            this.activeTab = preferredTab;
        }
        return `
            <style>
                .employees-tab-bar {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    margin-bottom: 1rem;
                }
                .employees-tab-btn {
                    border: 1px solid #bfdbfe;
                    background: #eff6ff;
                    color: #1d4ed8;
                    padding: 0.8rem 1.15rem;
                    border-radius: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: 0.2s ease;
                }
                .employees-tab-btn.active {
                    background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
                    color: #ffffff;
                    border-color: #0f172a;
                    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
                }
                @media (max-width: 768px) {
                    .employees-tab-btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            </style>
            <div class="employees-tab-bar">
                ${canViewRegistry ? `<button type="button" class="employees-tab-btn ${this.activeTab === 'employees-list' ? 'active' : ''}" data-employees-tab="employees-list"><i class="fas fa-id-card ml-2"></i>${this.getExternalWorkforceViewState().labels.employeesTab}</button>` : ''}
                ${canViewExternal ? `<button type="button" class="employees-tab-btn ${this.activeTab === 'external-workforce' ? 'active' : ''}" data-employees-tab="external-workforce"><i class="fas fa-helmet-safety ml-2"></i>${this.getExternalWorkforceViewState().labels.externalTab}</button>` : ''}
            </div>
            <div id="employees-list-panel" class="${this.activeTab !== 'employees-list' || !canViewRegistry ? 'hidden' : ''}">
            <div id="employees-stats-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"></div>
            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            ${this.t('module.employees.employeeList', 'قائمة الموظفين')}
                        </h2>
                        <div class="flex items-center gap-4 flex-wrap">
                            <button id="refresh-employees-btn" class="btn-secondary" title="${this.t('module.employees.refreshFromDbTitle', 'تحديث البيانات من قاعدة البيانات')}">
                                <i class="fas fa-sync-alt ml-2"></i>
                                ${this.t('module.common.refresh', 'تحديث')}
                            </button>
                            ${canAdmin ? `
                            <button id="refresh-employee-names-btn" class="btn-secondary" title="${this.t('module.employees.refreshNamesTitle', 'تحديث/تنظيف أسماء الموظفين ثم حفظها')}">
                                <i class="fas fa-font ml-2"></i>
                                ${this.t('module.employees.refreshNames', 'تحديث الأسماء')}
                            </button>
                            <button id="delete-all-employees-btn" class="btn-danger" title="${this.t('module.employees.deleteAllTitle', 'حذف جميع بيانات الموظفين (عملية خطيرة)')}">
                                <i class="fas fa-trash-alt ml-2"></i>
                                ${this.t('module.employees.deleteAll', 'حذف الجميع')}
                            </button>
                            ` : ''}
                            <input 
                                type="text" 
                                id="employees-search" 
                                class="form-input" 
                                style="max-width: 300px;"
                                placeholder="${this.t('module.common.searchDots', 'البحث...')}"
                            >
                        </div>
                    </div>
                    <!-- ✅ زر Toggle لعرض الموظفين غير النشطين - منفصل عن حقل البحث -->
                    <div class="flex items-center justify-end mt-4" style="direction: rtl;">
                        <!-- ✅ زر Toggle لعرض الموظفين غير النشطين - تصميم احترافي مع عدد المستقيلين -->
                        <label class="toggle-switch-container" id="show-inactive-employees-container" style="display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; padding: 10px 16px; border-radius: 10px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 2px solid #dee2e6; transition: all 0.3s ease; min-width: 200px;">
                            <input type="checkbox" id="show-inactive-employees" style="display: none;">
                            <div class="toggle-switch" style="position: relative; width: 56px; height: 30px; background: #cbd5e0; border-radius: 15px; transition: all 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); flex-shrink: 0;">
                                <div class="toggle-slider" style="position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; background: white; border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                            </div>
                            <div class="flex items-center gap-2" style="flex: 1;">
                                <i class="fas fa-user-slash toggle-icon" style="font-size: 16px; color: #6c757d; transition: all 0.3s ease;"></i>
                                <span class="toggle-label" style="font-size: 14px; font-weight: 600; color: #495057; white-space: nowrap; transition: all 0.3s ease;">
                                    ${this.t('module.employees.showInactive', 'عرض المستقيلين')}
                                </span>
                                <span class="inactive-count-badge" id="inactive-employees-count" style="display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 22px; padding: 0 8px; background: #dc2626; color: white; border-radius: 11px; font-size: 11px; font-weight: 700; margin-right: 4px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3); transition: all 0.3s ease;">
                                    0
                                </span>
                            </div>
                        </label>
                        <style>
                            #show-inactive-employees-container {
                                position: relative;
                            }
                            #show-inactive-employees-container input:checked + .toggle-switch {
                                background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
                                box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15), inset 0 2px 4px rgba(0,0,0,0.1) !important;
                            }
                            #show-inactive-employees-container input:checked + .toggle-switch .toggle-slider {
                                transform: translateX(26px) !important;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
                            }
                            #show-inactive-employees-container input:checked ~ .flex .toggle-icon {
                                color: #dc2626 !important;
                            }
                            #show-inactive-employees-container input:checked ~ .flex .toggle-label {
                                color: #dc2626 !important;
                                font-weight: 700 !important;
                            }
                            #show-inactive-employees-container input:checked ~ .flex .inactive-count-badge {
                                background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
                                box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4) !important;
                                transform: scale(1.1) !important;
                            }
                            #show-inactive-employees-container:hover {
                                background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%) !important;
                                border-color: #adb5bd !important;
                            }
                            #show-inactive-employees-container:hover .toggle-switch {
                                box-shadow: inset 0 2px 4px rgba(0,0,0,0.15) !important;
                            }
                        </style>
                    </div>
                    </div>
                </div>
                <!-- ✅ الفلاتر في صف واحد احترافي - مشابه لـ DailyObservations و Clinic -->
                <div class="employees-filters-row" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 16px 20px; margin: 0 -20px 0 -20px; width: calc(100% + 40px); direction: rtl; border-bottom: 1px solid #dee2e6;">
                    <style>
                        .employees-filters-row .filter-field {
                            display: flex;
                            flex-direction: column;
                            gap: 6px;
                        }
                        .employees-filters-row .filter-label {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            font-size: 13px;
                            font-weight: 600;
                            color: #495057;
                            margin-bottom: 4px;
                        }
                        .employees-filters-row .filter-label i {
                            color: #6c757d;
                            font-size: 14px;
                        }
                        .employees-filters-row .filter-input {
                            width: 100%;
                            padding: 8px 12px;
                            border: 1px solid #ced4da;
                            border-radius: 6px;
                            font-size: 14px;
                            background: white;
                            transition: all 0.2s;
                        }
                        .employees-filters-row .filter-input:focus {
                            outline: none;
                            border-color: #3b82f6;
                            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                        }
                        .employees-filters-row .filter-count-badge {
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            min-width: 24px;
                            height: 20px;
                            padding: 2px 8px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border-radius: 12px;
                            font-size: 11px;
                            font-weight: 700;
                            margin-right: 4px;
                            box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
                        }
                        .employees-filters-row .filter-reset-btn {
                            width: 100%;
                            padding: 10px 16px;
                            background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            transition: all 0.2s;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                        }
                        .employees-filters-row .filter-reset-btn:hover {
                            background: linear-gradient(135deg, #5a6268 0%, #495057 100%);
                            transform: translateY(-1px);
                            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                        }
                        .employees-filters-row .filters-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                            gap: 16px;
                            align-items: end;
                        }
                        @media (max-width: 1200px) {
                            .employees-filters-row .filters-grid {
                                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                            }
                        }
                    </style>
                    <div class="filters-grid">
                        <!-- حقل البحث -->
                        <div class="filter-field" style="min-width: 180px;">
                            <label for="employees-search-filter" class="filter-label" style="text-align: right;">
                                <i class="fas fa-search"></i>${this.t('module.common.search', 'البحث')}
                            </label>
                            <input type="text" id="employees-search-filter" class="filter-input" placeholder="${this.t('module.employees.searchAllData', 'ابحث في جميع البيانات...')}" style="direction: rtl; text-align: right;">
                        </div>
                        
                        <!-- فلتر القسم -->
                        <div class="filter-field" style="min-width: 160px;">
                            <label for="employee-filter-department" class="filter-label" style="text-align: right;">
                                <i class="fas fa-building"></i>${this.t('module.employees.department', 'القسم')}
                            </label>
                            <select id="employee-filter-department" class="filter-input" style="direction: rtl;">
                                <option value="">${this.t('module.common.all', 'الكل')}</option>
                            </select>
                        </div>
                        
                        <!-- فلتر الفرع -->
                        <div class="filter-field" style="min-width: 160px;">
                            <label for="employee-filter-branch" class="filter-label" style="text-align: right;">
                                <i class="fas fa-sitemap"></i>${this.t('module.employees.branch', 'الفرع')}
                            </label>
                            <select id="employee-filter-branch" class="filter-input" style="direction: rtl;">
                                <option value="">${this.t('module.common.all', 'الكل')}</option>
                            </select>
                        </div>
                        
                        <!-- فلتر الموقع -->
                        <div class="filter-field" style="min-width: 160px;">
                            <label for="employee-filter-location" class="filter-label" style="text-align: right;">
                                <i class="fas fa-map-marker-alt"></i>${this.t('module.employees.location', 'الموقع')}
                            </label>
                            <select id="employee-filter-location" class="filter-input" style="direction: rtl;">
                                <option value="">${this.t('module.common.all', 'الكل')}</option>
                            </select>
                        </div>
                        
                        <!-- فلتر الوظيفة -->
                        <div class="filter-field" style="min-width: 160px;">
                            <label for="employee-filter-job" class="filter-label" style="text-align: right;">
                                <i class="fas fa-briefcase"></i>${this.t('module.employees.job', 'الوظيفة')}
                            </label>
                            <select id="employee-filter-job" class="filter-input" style="direction: rtl;">
                                <option value="">${this.t('module.common.all', 'الكل')}</option>
                            </select>
                        </div>
                        
                        <!-- فلتر المنصب -->
                        <div class="filter-field" style="min-width: 160px;">
                            <label for="employee-filter-position" class="filter-label" style="text-align: right;">
                                <i class="fas fa-user-tie"></i>${this.t('module.employees.position', 'المنصب')}
                            </label>
                            <select id="employee-filter-position" class="filter-input" style="direction: rtl;">
                                <option value="">${this.t('module.common.all', 'الكل')}</option>
                            </select>
                        </div>
                        
                        <!-- فلتر النوع -->
                        <div class="filter-field" style="min-width: 160px;">
                            <label for="employee-filter-gender" class="filter-label" style="text-align: right;">
                                <i class="fas fa-venus-mars"></i>${this.t('module.employees.gender', 'النوع')}
                            </label>
                            <select id="employee-filter-gender" class="filter-input" style="direction: rtl;">
                                <option value="">${this.t('module.common.all', 'الكل')}</option>
                                <option value="ذكر">${this.t('module.employees.genderMale', 'ذكر')}</option>
                                <option value="أنثى">${this.t('module.employees.genderFemale', 'أنثى')}</option>
                            </select>
                        </div>
                        
                        <!-- زر إعادة التعيين -->
                        <div class="filter-field" style="min-width: 140px;">
                            <button id="employee-reset-filters" class="filter-reset-btn">
                                <i class="fas fa-redo"></i>${this.t('module.common.reset', 'إعادة تعيين')}
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="employees-table-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">${this.t('module.common.loading', 'جاري التحميل...')}</p>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            ${canViewExternal ? `
            <div id="employees-external-panel" class="${this.activeTab !== 'external-workforce' ? 'hidden' : ''}">
                ${this.renderExternalWorkforcePanel()}
            </div>
            ` : ''}
        `;
    },

    /**
     * التأكد من تحميل بيانات الموظفين (من Cache أو من Backend)
     */
    async ensureEmployeesLoaded(forceReload = false) {
        // منع التحميل المتزامن المتكرر
        if (this.cache.isUpdating && !forceReload) {
            // انتظار انتهاء التحميل الحالي
            // تحسين: تقليل التأخير من 100ms إلى 50ms لتسريع التحميل
            while (this.cache.isUpdating) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            // التحقق مرة أخرى بعد انتهاء التحميل
            if (AppState.appData.employees && Array.isArray(AppState.appData.employees) && AppState.appData.employees.length > 0) {
                return true;
            }
        }

        // التحقق من وجود البيانات في AppState أولاً
        const hasLocalData = AppState.appData.employees && Array.isArray(AppState.appData.employees) && AppState.appData.employees.length > 0;
        
        // التحقق من Cache
        const hasValidCache = this.cache.data && 
                             this.cache.lastLoad && 
                             (Date.now() - this.cache.lastLoad) < this.config.cacheTimeout &&
                             !forceReload;

        // إذا كانت البيانات موجودة في AppState و Cache صالح، لا حاجة للتحميل
        if (hasLocalData && hasValidCache) {
            if (AppState.debugMode) {
                Utils.safeLog(`✅ استخدام بيانات الموظفين من Cache (${this.cache.data.length} موظف)`);
            }
            // تحديث AppState من Cache إذا لزم الأمر
            if (this.cache.data && this.cache.data.length > 0) {
                AppState.appData.employees = this.cache.data;
            }
            // ✅ مرة واحدة لكل جلسة: إذا عداد المستقيلين 0 والكاش قد يكون قديماً، جلب كامل من الخادم في الخلفية
            if (!this.config._refreshedOnceForInactive && AppState.appData.employees.length > 0 && AppState.googleConfig?.appsScript?.enabled) {
                const inactiveInCache = (AppState.appData.employees || []).filter(e => this.isEmployeeInactive(e)).length;
                if (inactiveInCache === 0) {
                    this.config._refreshedOnceForInactive = true;
                    this.loadEmployeesFromBackend(true).then(() => {
                        window.dispatchEvent(new CustomEvent('employeesDataUpdated', { detail: {} }));
                    }).catch(() => {});
                }
            }
            return true;
        }

        // إذا كانت البيانات موجودة في AppState ولكن Cache منتهي الصلاحية، تحديث في الخلفية
        if (hasLocalData && !hasValidCache && !forceReload) {
            // استخدام البيانات المحلية مباشرة وتحديث في الخلفية
            this.cache.data = AppState.appData.employees;
            this.cache.lastLoad = Date.now();
            this.cache.lastUpdate = Date.now();
            
            // تحديث في الخلفية بدون تأخير
            this.updateEmployeesInBackground();
            return true;
        }

        // إذا لم تكن البيانات موجودة، تحميل من Backend
        return await this.loadEmployeesFromBackend(forceReload);
    },

    /**
     * تحميل بيانات الموظفين من قاعدة البيانات (Google Sheets)
     */
    async loadEmployeesFromBackend(forceReload = false) {
        // منع التحميل المتزامن المتكرر
        if (this.cache.isUpdating && !forceReload) {
            if (AppState.debugMode) {
                Utils.safeLog('⚠️ تحميل البيانات قيد التنفيذ بالفعل، انتظار...');
            }
            // انتظار انتهاء التحميل الحالي
            // تحسين: تقليل التأخير من 100ms إلى 50ms لتسريع التحميل
            while (this.cache.isUpdating) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            // التحقق مرة أخرى بعد انتهاء التحميل
            if (AppState.appData.employees && Array.isArray(AppState.appData.employees) && AppState.appData.employees.length > 0) {
                return true;
            }
        }

        // تعيين flag لمنع التحميلات المتزامنة
        this.cache.isUpdating = true;

        try {
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                if (AppState.debugMode) {
                    Utils.safeLog('⚠️ Google Apps Script غير مفعّل - استخدام البيانات المحلية فقط');
                }
                // استخدام البيانات المحلية إذا كانت موجودة
                if (AppState.appData.employees && Array.isArray(AppState.appData.employees)) {
                    this.cache.data = AppState.appData.employees;
                    this.cache.lastLoad = Date.now();
                    this.cache.lastUpdate = Date.now();
                }
                this.cache.isUpdating = false;
                return false;
            }

            // التحقق من وجود GoogleIntegration
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendRequest) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ GoogleIntegration غير متاح');
                }
                // استخدام البيانات المحلية إذا كانت موجودة
                if (AppState.appData.employees && Array.isArray(AppState.appData.employees)) {
                    this.cache.data = AppState.appData.employees;
                    this.cache.lastLoad = Date.now();
                    this.cache.lastUpdate = Date.now();
                }
                this.cache.isUpdating = false;
                return false;
            }

            // محاولة تحميل البيانات من Backend باستخدام getAllEmployees
            // ✅ includeInactive: true لاستلام جميع الموظفين (نشطين + مستقيلين) حتى يظهر عداد المستقيلين بشكل صحيح
            try {
                const result = await GoogleIntegration.sendRequest({
                    action: 'getAllEmployees',
                    data: { filters: { includeInactive: true } }
                });

                if (result && result.success && Array.isArray(result.data)) {
                    // تحديث AppState بالبيانات من قاعدة البيانات
                    AppState.appData.employees = result.data;
                    
                    // تحديث Cache
                    this.cache.data = result.data;
                    this.cache.lastLoad = Date.now();
                    this.cache.lastUpdate = Date.now();
                    
                    // حفظ البيانات محلياً
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    }

                    if (AppState.debugMode) {
                        Utils.safeLog(`✅ تم تحميل ${result.data.length} موظف من قاعدة البيانات`);
                    }
                    this.cache.isUpdating = false;
                    return true;
                } else {
                    // إذا فشل getAllEmployees، جرب readFromSheet مباشرة
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ getAllEmployees فشل، جاري المحاولة بـ readFromSheet...');
                    }
                    
                    const sheetResult = await GoogleIntegration.sendRequest({
                        action: 'readFromSheet',
                        data: { 
                            sheetName: 'Employees',
                            spreadsheetId: AppState.googleConfig.sheets.spreadsheetId
                        }
                    });

                    if (sheetResult && sheetResult.success && Array.isArray(sheetResult.data)) {
                        AppState.appData.employees = sheetResult.data;
                        
                        // تحديث Cache
                        this.cache.data = sheetResult.data;
                        this.cache.lastLoad = Date.now();
                        this.cache.lastUpdate = Date.now();
                        
                        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                            window.DataManager.save();
                        }

                        if (AppState.debugMode) {
                            Utils.safeLog(`✅ تم تحميل ${sheetResult.data.length} موظف من Google Sheets`);
                        }
                        this.cache.isUpdating = false;
                        return true;
                    }
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ خطأ في تحميل بيانات الموظفين من Backend:', error);
                }
                // في حالة الخطأ، نستخدم البيانات المحلية إذا كانت موجودة
                if (AppState.appData.employees && Array.isArray(AppState.appData.employees)) {
                    this.cache.data = AppState.appData.employees;
                    this.cache.lastLoad = Date.now();
                    this.cache.lastUpdate = Date.now();
                }
                this.cache.isUpdating = false;
                return false;
            }

            this.cache.isUpdating = false;
            return false;
        } catch (error) {
            if (AppState.debugMode) {
                Utils.safeError('❌ خطأ في loadEmployeesFromBackend:', error);
            }
            // في حالة الخطأ، نستخدم البيانات المحلية إذا كانت موجودة
            if (AppState.appData.employees && Array.isArray(AppState.appData.employees)) {
                this.cache.data = AppState.appData.employees;
                this.cache.lastLoad = Date.now();
                this.cache.lastUpdate = Date.now();
            }
            this.cache.isUpdating = false;
            return false;
        }
    },

    /**
     * تحديث بيانات الموظفين في الخلفية بدون تأخير
     */
    async updateEmployeesInBackground() {
        // منع التحديث المتزامن
        if (this.cache.isUpdating) {
            return;
        }

        this.cache.isUpdating = true;
        
        try {
            // التحقق من تفعيل Google Integration
            if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
                return;
            }

            // التحقق من وجود GoogleIntegration
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendRequest) {
                return;
            }

            // محاولة تحميل البيانات من Backend
            const result = await GoogleIntegration.sendRequest({
                action: 'getAllEmployees',
                data: { filters: { includeInactive: true } }
            });

            if (result && result.success && Array.isArray(result.data)) {
                // تحديث AppState والCache فقط إذا تغيرت البيانات
                const currentCount = AppState.appData.employees?.length || 0;
                const newCount = result.data.length;
                
                if (currentCount !== newCount || JSON.stringify(AppState.appData.employees) !== JSON.stringify(result.data)) {
                    AppState.appData.employees = result.data;
                    this.cache.data = result.data;
                    this.cache.lastUpdate = Date.now();
                    
                    // حفظ البيانات محلياً
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    }

                    if (AppState.debugMode) {
                        Utils.safeLog(`🔄 تم تحديث بيانات الموظفين في الخلفية (${result.data.length} موظف)`);
                    }
                    
                    // إرسال حدث لتحديث الواجهة إذا كان الموديول مفتوحاً
                    window.dispatchEvent(new CustomEvent('employeesDataUpdated', { 
                        detail: { count: result.data.length } 
                    }));
                }
            }
        } catch (error) {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ خطأ في تحديث بيانات الموظفين في الخلفية:', error);
            }
        } finally {
            this.cache.isUpdating = false;
        }
    },

    /**
     * بدء التحديث التلقائي في الخلفية
     */
    startBackgroundUpdate() {
        // إيقاف التحديث السابق إذا كان موجوداً
        if (this.config.backgroundUpdateTimer) {
            clearInterval(this.config.backgroundUpdateTimer);
        }

        // بدء التحديث التلقائي كل فترة زمنية محددة
        this.config.backgroundUpdateTimer = setInterval(() => {
            this.updateEmployeesInBackground();
        }, this.config.backgroundUpdateInterval);

        if (AppState.debugMode) {
            Utils.safeLog(`✅ تم بدء التحديث التلقائي لبيانات الموظفين (كل ${this.config.backgroundUpdateInterval / 60000} دقيقة)`);
        }
    },

    /**
     * إيقاف التحديث التلقائي في الخلفية
     */
    stopBackgroundUpdate() {
        if (this.config.backgroundUpdateTimer) {
            clearInterval(this.config.backgroundUpdateTimer);
            this.config.backgroundUpdateTimer = null;
        }
    },

    /**
     * تنظيف جميع الموارد عند إلغاء تحميل الموديول
     * يمنع تسريبات الذاكرة (Memory Leaks)
     */
    cleanup() {
        try {
            if (AppState.debugMode) {
                Utils.safeLog('🧹 تنظيف موارد Employees module...');
            }

            // إيقاف التحديث التلقائي في الخلفية
            this.stopBackgroundUpdate();

            // إزالة مستمعات الأحداث
            if (this.handleDataUpdate) {
                window.removeEventListener('employeesDataUpdated', this.handleDataUpdate);
                this.handleDataUpdate = null;
            }

            // تنظيف مراجع DOM (سيتم تنظيفها تلقائياً عند إزالة العناصر من DOM)
            
            if (AppState.debugMode) {
                Utils.safeLog('✅ تم تنظيف موارد Employees module');
            }
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في تنظيف Employees module:', error);
        }
    },

    async loadEmployeesList(showInactive = false) {
        const container = document.getElementById('employees-table-container');
        if (!container) {
            if (AppState.debugMode) {
                Utils.safeWarn('⚠️ employees-table-container غير موجود في loadEmployeesList');
            }
            return;
        }

        // استخدام البيانات من AppState (يجب أن تكون محملة مسبقاً من load())
        let employees = AppState.appData.employees || [];
        
        if (AppState.debugMode) {
            Utils.safeLog(`📊 loadEmployeesList: إجمالي الموظفين = ${employees.length}, showInactive = ${showInactive}`);
        }

        // ✅ تصفية الموظفين النشطين فقط (ما لم يُطلب خلاف ذلك) - استخدام isEmployeeInactive
        if (!showInactive) {
            const beforeFilter = employees.length;
            employees = employees.filter(e => !this.isEmployeeInactive(e));
            if (AppState.debugMode) {
                Utils.safeLog(`📊 بعد التصفية (نشطين فقط): ${employees.length} من ${beforeFilter}`);
            }
        } else {
            if (AppState.debugMode) {
                Utils.safeLog(`📊 عرض جميع الموظفين (بما في ذلك غير النشطين): ${employees.length}`);
            }
        }

        // تحديث كروت الإحصائيات أولاً
        this.renderStatsCards();
        
        // ✅ تحديث عدد المستقيلين في الزر
        this.updateInactiveCount();

        const canAddOrImport = this.canAddOrImport();
        const canEditOrDelete = this.canEditOrDelete();

        // استخدام DocumentFragment لتقليل reflow
        const fragment = document.createDocumentFragment();

        if (employees.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';
            emptyDiv.innerHTML = `
                <i class="fas fa-user-tie text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">${this.t('module.employees.emptyList', 'لا يوجد موظفين مسجلين')}</p>
                ${canAddOrImport ? `
                <button id="add-employee-empty-btn" class="btn-primary mt-4">
                    <i class="fas fa-plus ml-2"></i>
                    ${this.t('module.employees.addNewEmployee', 'إضافة موظف جديد')}
                </button>
                ` : ''}
            `;
            fragment.appendChild(emptyDiv);
            container.innerHTML = '';
            container.appendChild(fragment);
            // إعادة إعداد event listeners بعد تحديث DOM
            requestAnimationFrame(() => {
                const addEmptyBtn = document.getElementById('add-employee-empty-btn');
                if (addEmptyBtn && this.canAddOrImport()) {
                    addEmptyBtn.addEventListener('click', () => this.showForm());
                }
            });
            return;
        }

        // بناء الجدول باستخدام DocumentFragment لتقليل reflow
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';
        tableWrapper.style.cssText = 'width: 100%; max-width: 100%; overflow-x: auto;';

        const table = document.createElement('table');
        table.className = 'data-table table-header-blue';
        table.style.cssText = 'width: 100%; min-width: 100%; table-layout: auto;';

        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th style="min-width: 80px;">${this.t('module.employees.table.photo', 'الصورة')}</th>
                <th style="min-width: 100px;">${this.t('module.employees.table.employeeNumber', 'الرقم الوظيفي')}</th>
                <th style="min-width: 150px;">${this.t('module.employees.table.name', 'الاسم')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.department', 'القسم')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.job', 'الوظيفة')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.table.nationalId', 'رقم البطاقة')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.table.birthDate', 'تاريخ الميلاد')}</th>
                <th style="min-width: 80px;">${this.t('module.employees.table.age', 'السن')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.table.hireDate', 'تاريخ التعيين')}</th>
                <th style="min-width: 80px;">${this.t('module.employees.gender', 'النوع')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.table.phone', 'الهاتف')}</th>
                <th style="min-width: 120px;">${this.t('module.employees.table.insuranceNo', 'الرقم التأميني')}</th>
                <th style="min-width: 150px;">${this.t('module.employees.table.actions', 'الإجراءات')}</th>
            </tr>
        `;

        const tbody = document.createElement('tbody');
        employees.forEach(employee => {
            const birthDate = this.formatDateSafe(employee.birthDate);
            const hireDate = this.formatDateSafe(employee.hireDate);
            const age = this.calculateAge(employee.birthDate);
            
            // ✅ تحديد إذا كان الموظف غير نشط (مستقيل)
            const isInactive = this.isEmployeeInactive(employee);
            const rowStyle = isInactive ? 'opacity: 0.7; background-color: #f8f9fa;' : '';
            
            const tr = document.createElement('tr');
            if (isInactive) {
                tr.style.cssText = rowStyle;
            }
            const driveId = this._getDriveIdFromUrl(employee.photo || '');
            const photoKey = (driveId || employee.id || employee.employeeNumber || employee.name || '').toString();
            const photoSrc = this._normalizeEmployeePhotoUrl(employee.photo, employee.id);
            const photoDisp = photoSrc && typeof Utils.resolveDriveAwareImgDisplay === 'function'
                ? Utils.resolveDriveAwareImgDisplay(photoSrc)
                : { canonical: photoSrc || '', displaySrc: photoSrc || '', needsProxy: false, proxyFileId: '' };
            const imgTagSrc = photoDisp.canonical ? photoDisp.displaySrc : '';
            const photoProxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(photoDisp) : '';

            tr.innerHTML = `
                <td style="word-wrap: break-word;">
                    ${photoSrc ? `<img data-emp-photo="1" data-photo-key="${Utils.escapeHTML(photoKey)}" src="${Utils.escapeHTML(imgTagSrc)}" alt="${Utils.escapeHTML(employee.name || '')}"${photoProxyAttr} class="w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>`}
                </td>
                <td style="word-wrap: break-word; white-space: normal;">
                    ${Utils.escapeHTML(employee.employeeNumber || '')}
                    ${isInactive ? `<span class="badge badge-warning ml-2" style="font-size: 10px; padding: 2px 6px;">${this.t('module.employees.inactive', 'غير نشط')}</span>` : ''}
                </td>
                <td style="word-wrap: break-word; white-space: normal; max-width: 200px;">
                    ${Utils.escapeHTML(employee.name || '')}
                    ${isInactive && employee.resignationDate ? `<br><span class="text-xs text-gray-500" style="font-size: 11px;">${this.t('module.employees.resignedOn', 'استقال')}: ${this.formatDateSafe(employee.resignationDate)}</span>` : ''}
                </td>
                <td style="word-wrap: break-word; white-space: normal; max-width: 150px;">${Utils.escapeHTML(employee.department || '')}</td>
                <td style="word-wrap: break-word; white-space: normal; max-width: 150px;">${Utils.escapeHTML(employee.job || employee.position || '')}</td>
                <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.nationalId || '')}</td>
                <td style="word-wrap: break-word; white-space: normal;">${birthDate || ''}</td>
                <td style="word-wrap: break-word; white-space: normal;">${age ? age + ' ' + this.t('module.common.yearsUnit', 'سنة') : ''}</td>
                <td style="word-wrap: break-word; white-space: normal;">${hireDate || ''}</td>
                <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.gender || '')}</td>
                <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.phone || '')}</td>
                <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.insuranceNumber || '')}</td>
                ${canEditOrDelete ? `
                <td style="min-width: 150px;">
                    <div class="flex items-center gap-2 flex-wrap">
                        <button onclick="Employees.viewEmployee('${employee.id}')" class="btn-icon btn-icon-info" title="${this.t('module.common.view', 'عرض')}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="Employees.editEmployee('${employee.id}')" class="btn-icon btn-icon-primary" title="${this.t('module.common.edit', 'تعديل')}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="Employees.deactivateEmployee('${employee.id}')" class="btn-icon btn-icon-danger" title="${this.t('module.employees.deactivate', 'إلغاء تفعيل')}">
                            <i class="fas fa-user-slash"></i>
                        </button>
                    </div>
                </td>
                ` : `
                <td>
                    <span class="text-gray-400 text-sm">—</span>
                </td>
                `}
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        fragment.appendChild(tableWrapper);

        // تحديث DOM مرة واحدة فقط
        container.innerHTML = '';
        container.appendChild(fragment);
        this.applyModuleI18n(container);

        // ✅ تثبيت fallback لصور الموظفين (503 Drive) بعد تحديث DOM
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => {
                this._setupEmployeePhotoFallbacks(container);
                if (typeof Utils.hydrateDriveProxyImages === 'function') {
                    Utils.hydrateDriveProxyImages(container, {
                        onFetchFail: (img) => {
                            try {
                                const key = (img.dataset.photoKey || '').trim();
                                if (key) sessionStorage.setItem(this._photoFailKey(key), Date.now().toString());
                            } catch (e) { /* ignore */ }
                            try {
                                const parent = img.parentElement;
                                if (parent) {
                                    parent.innerHTML = '<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>';
                                }
                            } catch (e2) { /* ignore */ }
                        }
                    });
                }
            }, { timeout: 600 });
        } else {
            setTimeout(() => {
                this._setupEmployeePhotoFallbacks(container);
                if (typeof Utils.hydrateDriveProxyImages === 'function') {
                    Utils.hydrateDriveProxyImages(container, {
                        onFetchFail: (img) => {
                            try {
                                const key = (img.dataset.photoKey || '').trim();
                                if (key) sessionStorage.setItem(this._photoFailKey(key), Date.now().toString());
                            } catch (e) { /* ignore */ }
                            try {
                                const parent = img.parentElement;
                                if (parent) {
                                    parent.innerHTML = '<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>';
                                }
                            } catch (e2) { /* ignore */ }
                        }
                    });
                }
            }, 0);
        }
        
        // ✅ تعبئة الفلاتر بالقيم المتاحة بعد تحميل القائمة
        this.populateFilters();
        
        // ✅ تطبيق الفلاتر إذا كان هناك فلاتر نشطة (بما في ذلك showInactive)
        requestAnimationFrame(async () => {
            try {
                const filters = this.getFilterValues();
                // ✅ التحقق من showInactive أيضاً
                if (filters.search || filters.department || filters.branch || filters.location || 
                    filters.job || filters.position || filters.gender || filters.showInactive) {
                    await this.applyFilters();
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                }
            }
        });
    },
    
    /**
     * تعبئة الفلاتر بالقيم المتاحة من بيانات الموظفين
     */
    populateFilters() {
        const employees = AppState.appData.employees || [];
        
        // جمع القيم الفريدة لكل حقل
        const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();
        const branches = [...new Set(employees.map(e => e.branch).filter(Boolean))].sort();
        const locations = [...new Set(employees.map(e => e.location).filter(Boolean))].sort();
        const jobs = [...new Set(employees.map(e => e.job || e.position).filter(Boolean))].sort();
        const positions = [...new Set(employees.map(e => e.position || e.job).filter(Boolean))].sort();
        
        // تعبئة فلتر القسم
        const deptSelect = document.getElementById('employee-filter-department');
        if (deptSelect) {
            const currentValue = deptSelect.value;
            deptSelect.innerHTML = '<option value="">الكل</option>' + 
                departments.map(d => `<option value="${Utils.escapeHTML(d)}" ${d === currentValue ? 'selected' : ''}>${Utils.escapeHTML(d)}</option>`).join('');
        }
        
        // تعبئة فلتر الفرع
        const branchSelect = document.getElementById('employee-filter-branch');
        if (branchSelect) {
            const currentValue = branchSelect.value;
            branchSelect.innerHTML = '<option value="">الكل</option>' + 
                branches.map(b => `<option value="${Utils.escapeHTML(b)}" ${b === currentValue ? 'selected' : ''}>${Utils.escapeHTML(b)}</option>`).join('');
        }
        
        // تعبئة فلتر الموقع
        const locationSelect = document.getElementById('employee-filter-location');
        if (locationSelect) {
            const currentValue = locationSelect.value;
            locationSelect.innerHTML = '<option value="">الكل</option>' + 
                locations.map(l => `<option value="${Utils.escapeHTML(l)}" ${l === currentValue ? 'selected' : ''}>${Utils.escapeHTML(l)}</option>`).join('');
        }
        
        // تعبئة فلتر الوظيفة
        const jobSelect = document.getElementById('employee-filter-job');
        if (jobSelect) {
            const currentValue = jobSelect.value;
            jobSelect.innerHTML = '<option value="">الكل</option>' + 
                jobs.map(j => `<option value="${Utils.escapeHTML(j)}" ${j === currentValue ? 'selected' : ''}>${Utils.escapeHTML(j)}</option>`).join('');
        }
        
        // تعبئة فلتر المنصب
        const positionSelect = document.getElementById('employee-filter-position');
        if (positionSelect) {
            const currentValue = positionSelect.value;
            positionSelect.innerHTML = '<option value="">الكل</option>' + 
                positions.map(p => `<option value="${Utils.escapeHTML(p)}" ${p === currentValue ? 'selected' : ''}>${Utils.escapeHTML(p)}</option>`).join('');
        }
    },

    setupEventListeners() {
        // ✅ استخدام setTimeout للتأكد من وجود جميع العناصر في DOM
        setTimeout(() => {
            // إزالة المستمعات السابقة لتجنب التكرار
            window.removeEventListener('employeesDataUpdated', this.handleDataUpdate);
            
            // إضافة مستمع لتحديثات البيانات في الخلفية
            this.handleDataUpdate = (event) => {
                if (event.detail?.externalWorkforce) {
                    clearTimeout(this._employeesUpdateDebounceTimer);
                    this._externalWorkforceCache.clear();
                    this._employeesUpdateDebounceTimer = setTimeout(() => {
                        if (document.getElementById('external-workforce-table-container')) {
                            this.renderExternalWorkforceTable();
                        }
                    }, 60);
                    return;
                }

                if (event.detail && event.detail.count) {
                    // Debounce لتجنب handler ثقيل عند تكرار التحديثات المتتالية
                    clearTimeout(this._employeesUpdateDebounceTimer);
                    this._employeesUpdateDebounceTimer = setTimeout(() => {
                        const container = document.getElementById('employees-table-container');
                        if (container) {
                            // ✅ تجنّب Violation: اجعل rAF خفيفاً وادفع العمل الثقيل إلى setTimeout
                            requestAnimationFrame(() => setTimeout(() => this.loadEmployeesList(), 0));
                        } else {
                            this.renderStatsCards();
                        }
                    }, 120);
                }
            };
            window.addEventListener('employeesDataUpdated', this.handleDataUpdate);

            document.querySelectorAll('[data-employees-tab]').forEach(button => {
                button.addEventListener('click', () => this.switchTab(button.getAttribute('data-employees-tab') || 'employees-list'));
            });

            this.ensureExternalWorkforceToolbar();

            const externalYearSelect = document.getElementById('external-workforce-year');
            if (externalYearSelect) {
                externalYearSelect.addEventListener('change', async (event) => {
                    const year = Number(event.target.value);
                    if (!Number.isFinite(year) || year < 2000) return;
                    this.externalWorkforceYear = year;
                    await this.ensureExternalWorkforceDataLoaded();
                    this.renderExternalWorkforceTable();
                });
            }

            const externalTableContainer = document.getElementById('external-workforce-table-container');
            if (externalTableContainer) {
                const saveHandler = async (event) => {
                    const target = event.target;
                    if (!target || !target.matches('.external-workforce-input')) return;
                    await this.saveExternalWorkforceValue(
                        target.getAttribute('data-contractor-key') || '',
                        target.getAttribute('data-month') || '',
                        target.value
                    );
                };

                externalTableContainer.addEventListener('change', saveHandler);
                externalTableContainer.addEventListener('blur', saveHandler, true);
            }

            document.getElementById('external-workforce-export-excel-btn')?.addEventListener('click', () => {
                this.exportExternalWorkforceToExcel();
            });

            document.getElementById('external-workforce-export-pdf-btn')?.addEventListener('click', () => {
                this.exportExternalWorkforceToPDF();
            });

            const externalImportBtn = document.getElementById('external-workforce-import-excel-btn');
            const externalImportInput = document.getElementById('external-workforce-import-input');
            if (externalImportBtn && externalImportInput) {
                externalImportBtn.addEventListener('click', () => externalImportInput.click());
                externalImportInput.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await this.importExternalWorkforceExcelFile(file);
                    event.target.value = '';
                });
            }

            if (this.canViewExternalWorkforceTab()) {
                this.populateExternalWorkforceYearSelector();
                if (this.activeTab === 'external-workforce' || !this.canViewEmployeesRegistryTab()) {
                    this.ensureExternalWorkforceDataLoaded().then(() => this.renderExternalWorkforceTable()).catch(() => {});
                }
            }
            
            const addBtn = document.getElementById('add-employee-btn');
            const addEmptyBtn = document.getElementById('add-employee-empty-btn');
            const importBtn = document.getElementById('import-employees-excel-btn');
            const refreshBtn = document.getElementById('refresh-employees-btn');
            const refreshNamesBtn = document.getElementById('refresh-employee-names-btn');
            const deleteAllBtn = document.getElementById('delete-all-employees-btn');

            // ✅ التحقق من وجود الأزرار
            if (AppState.debugMode) {
                Utils.safeLog('🔍 فحص الأزرار:', {
                    refreshBtn: !!refreshBtn,
                    refreshNamesBtn: !!refreshNamesBtn,
                    deleteAllBtn: !!deleteAllBtn,
                    searchInput: !!document.getElementById('employees-search'),
                    filterSearchInput: !!document.getElementById('employees-search-filter')
                });
            }

            if (addBtn && this.canAddOrImport()) addBtn.addEventListener('click', () => this.showForm());
            if (addEmptyBtn && this.canAddOrImport()) addEmptyBtn.addEventListener('click', () => this.showForm());
            if (importBtn && this.canAddOrImport()) importBtn.addEventListener('click', () => this.showImportExcel());
            
            // ✅ زر التحديث - إزالة أي مستمعات سابقة وإضافة جديدة
            if (refreshBtn) {
                // إزالة المستمعات السابقة
                const newRefreshBtn = refreshBtn.cloneNode(true);
                refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
                
                newRefreshBtn.addEventListener('click', async () => {
                    newRefreshBtn.disabled = true;
                    const originalHTML = newRefreshBtn.innerHTML;
                    newRefreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري التحديث...';
                    
                    // ✅ إضافة Loading indicator
                    if (typeof Loading !== 'undefined') {
                        Loading.show();
                    }
                    
                    try {
                        // إجبار إعادة التحميل
                        const loaded = await this.loadEmployeesFromBackend(true);
                        if (loaded) {
                            // ✅ تحديث القائمة مع الحفاظ على حالة showInactive
                            const showInactive = document.getElementById('show-inactive-employees')?.checked || false;
                            await this.loadEmployeesList(showInactive);
                            
                            // ✅ تطبيق جميع الفلاتر بعد التحديث
                            await this.applyFilters();
                            
                            if (typeof Notification !== 'undefined') {
                                Notification.success('تم تحديث البيانات بنجاح');
                            }
                        } else {
                            if (typeof Notification !== 'undefined') {
                                Notification.warning('لم يتم العثور على بيانات جديدة');
                            }
                        }
                    } catch (error) {
                        if (typeof Notification !== 'undefined') {
                            Notification.error('حدث خطأ أثناء تحديث البيانات: ' + error.message);
                        }
                        Utils.safeError('خطأ في تحديث بيانات الموظفين:', error);
                    } finally {
                        if (typeof Loading !== 'undefined') {
                            Loading.hide();
                        }
                        newRefreshBtn.disabled = false;
                        newRefreshBtn.innerHTML = originalHTML;
                    }
                });
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ زر التحديث غير موجود!');
                }
            }

            if (refreshNamesBtn && this.canAddOrImport()) {
                refreshNamesBtn.addEventListener('click', async () => this.refreshEmployeeNames());
            }

            if (deleteAllBtn && this.canAddOrImport()) {
                deleteAllBtn.addEventListener('click', async () => this.deleteAllEmployees());
            }

            // ✅ حقل البحث في header - إضافة debounce
            const searchInput = document.getElementById('employees-search');
            if (searchInput) {
                // إزالة أي مستمعات سابقة لتجنب التكرار
                const newSearchInput = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                
                let searchTimeout = null;
                const applySearch = async () => {
                    try {
                        // مزامنة مع حقل البحث في الفلتر
                        const filterSearchInput = document.getElementById('employees-search-filter');
                        if (filterSearchInput) {
                            filterSearchInput.value = newSearchInput.value;
                        }
                        await this.applyFilters();
                    } catch (error) {
                        if (AppState.debugMode) {
                            Utils.safeError('خطأ في البحث:', error);
                        }
                    }
                };
                
                newSearchInput.addEventListener('input', (e) => {
                    // إلغاء البحث السابق إذا كان موجوداً
                    if (searchTimeout) {
                        clearTimeout(searchTimeout);
                    }
                    
                    // البحث بعد 300ms من توقف المستخدم عن الكتابة
                    searchTimeout = setTimeout(applySearch, 300);
                });
                
                // ✅ إضافة event listener للبحث الفوري عند الضغط على Enter
                newSearchInput.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchTimeout) {
                            clearTimeout(searchTimeout);
                        }
                        await applySearch();
                    }
                });
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ حقل البحث في header غير موجود!');
                }
            }
            
            // ✅ حقل البحث في الفلتر
            const filterSearchInput = document.getElementById('employees-search-filter');
            if (filterSearchInput) {
                // إزالة أي مستمعات سابقة لتجنب التكرار
                const newFilterSearchInput = filterSearchInput.cloneNode(true);
                filterSearchInput.parentNode.replaceChild(newFilterSearchInput, filterSearchInput);
                
                let filterSearchTimeout = null;
                const applyFilterSearch = async () => {
                    try {
                        // مزامنة مع حقل البحث في header
                        if (searchInput) {
                            searchInput.value = newFilterSearchInput.value;
                        }
                        await this.applyFilters();
                    } catch (error) {
                        if (AppState.debugMode) {
                            Utils.safeError('خطأ في البحث:', error);
                        }
                    }
                };
                
                // ✅ إضافة debounce للبحث لتحسين الأداء
                newFilterSearchInput.addEventListener('input', (e) => {
                    // إلغاء البحث السابق إذا كان موجوداً
                    if (filterSearchTimeout) {
                        clearTimeout(filterSearchTimeout);
                    }
                    
                    // البحث بعد 300ms من توقف المستخدم عن الكتابة
                    filterSearchTimeout = setTimeout(applyFilterSearch, 300);
                });
                
                // ✅ إضافة event listener للبحث الفوري عند الضغط على Enter
                newFilterSearchInput.addEventListener('keydown', async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filterSearchTimeout) {
                            clearTimeout(filterSearchTimeout);
                        }
                        await applyFilterSearch();
                    }
                });
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ حقل البحث في الفلتر غير موجود!');
                }
            }
            
            // ✅ إضافة event listeners للفلاتر
            const filterSelects = [
                'employee-filter-department',
                'employee-filter-branch',
                'employee-filter-location',
                'employee-filter-job',
                'employee-filter-position',
                'employee-filter-gender'
            ];
            
            filterSelects.forEach(filterId => {
                const select = document.getElementById(filterId);
                if (select) {
                    select.addEventListener('change', async () => {
                        try {
                            await this.applyFilters();
                        } catch (error) {
                            if (AppState.debugMode) {
                                Utils.safeError('خطأ في الفلتر:', error);
                            }
                        }
                    });
                }
            });
            
            // ✅ زر إعادة تعيين الفلاتر - إزالة أي مستمعات سابقة
            const resetFiltersBtn = document.getElementById('employee-reset-filters');
            if (resetFiltersBtn) {
                // إزالة المستمعات السابقة
                const newResetBtn = resetFiltersBtn.cloneNode(true);
                resetFiltersBtn.parentNode.replaceChild(newResetBtn, resetFiltersBtn);
                
                newResetBtn.addEventListener('click', async () => {
                    try {
                        await this.resetFilters();
                    } catch (error) {
                        if (AppState.debugMode) {
                            Utils.safeError('خطأ في إعادة تعيين الفلاتر:', error);
                        }
                        if (typeof Notification !== 'undefined') {
                            Notification.error('حدث خطأ أثناء إعادة تعيين الفلاتر');
                        }
                    }
                });
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ زر إعادة التعيين غير موجود!');
                }
            }

            // ✅ إضافة event listener لزر Toggle عرض الموظفين غير النشطين
            let showInactiveCheckbox = document.getElementById('show-inactive-employees');
            if (showInactiveCheckbox) {
                // إزالة أي مستمعات سابقة
                const newCheckbox = showInactiveCheckbox.cloneNode(true);
                showInactiveCheckbox.parentNode.replaceChild(newCheckbox, showInactiveCheckbox);
                
                newCheckbox.addEventListener('change', async (e) => {
                    const isChecked = e.target.checked;
                    
                    if (AppState.debugMode) {
                        Utils.safeLog(`🔄 تغيير حالة عرض المستقيلين: ${isChecked ? 'عرض' : 'إخفاء'}`);
                    }
                    
                    try {
                        // ✅ إضافة Loading indicator
                        if (typeof Loading !== 'undefined') {
                            Loading.show();
                        }
                        
                        // ✅ تحديث لون الزر حسب الحالة
                        const container = document.getElementById('show-inactive-employees-container');
                        if (container) {
                            if (isChecked) {
                                // ✅ لون أحمر عند التفعيل (عرض المستقيلين)
                                container.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                                container.style.borderColor = '#dc2626';
                                container.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
                            } else {
                                // ✅ لون رمادي عند الإلغاء (إخفاء المستقيلين)
                                container.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
                                container.style.borderColor = '#dee2e6';
                                container.style.boxShadow = 'none';
                            }
                        }
                        
                        // ✅ تحميل القائمة مع الحالة الجديدة
                        await this.loadEmployeesList(isChecked);
                        
                        // ✅ التأكد من أن checkbox محدث قبل تطبيق الفلاتر
                        const checkbox = document.getElementById('show-inactive-employees');
                        if (checkbox && checkbox.checked !== isChecked) {
                            checkbox.checked = isChecked;
                        }
                        
                        // ✅ تطبيق جميع الفلاتر بعد تحميل القائمة (مع التأكد من showInactive)
                        await this.applyFilters();
                        
                        // ✅ تحديث عدد المستقيلين بعد تطبيق الفلاتر
                        this.updateInactiveCount();
                        
                        // ✅ إظهار إشعار
                        if (typeof Notification !== 'undefined') {
                            Notification.success(isChecked ? 
                                'تم عرض الموظفين غير النشطين (المستقيلين)' : 
                                'تم إخفاء الموظفين غير النشطين'
                            );
                        }
                    } catch (error) {
                        // إرجاع حالة checkbox في حالة الخطأ
                        newCheckbox.checked = !isChecked;
                        
                        if (AppState.debugMode) {
                            Utils.safeError('خطأ في تحميل القائمة:', error);
                        }
                        if (typeof Notification !== 'undefined') {
                            Notification.error('حدث خطأ أثناء تحميل البيانات');
                        }
                    } finally {
                        if (typeof Loading !== 'undefined') {
                            Loading.hide();
                        }
                        // ✅ تحديث عدد المستقيلين دائماً في النهاية
                        this.updateInactiveCount();
                    }
                });
                
                // ✅ تحديث عدد المستقيلين عند تحميل الصفحة (مع تأخير للتأكد من جاهزية الـ DOM)
                this.updateInactiveCount();
                // ✅ تحديث إضافي بعد 300ms لضمان ظهور العدد
                setTimeout(() => this.updateInactiveCount(), 300);
            } else {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ زر عرض المستقيلين غير موجود!');
                }
            }
            
            // ✅ تحديث عدد المستقيلين عند تحديث البيانات
            window.addEventListener('employeesDataUpdated', () => {
                this.updateInactiveCount();
                // ✅ تحديث إضافي للتأكد من الظهور
                setTimeout(() => this.updateInactiveCount(), 100);
            });
            
            // ✅ تطبيق الفلاتر عند تحميل الصفحة إذا كان هناك قيم
            requestAnimationFrame(async () => {
                try {
                    const filters = this.getFilterValues();
                    if (filters.search || filters.department || filters.branch || filters.location || 
                        filters.job || filters.position || filters.gender || filters.showInactive) {
                        await this.applyFilters();
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                    }
                }
            });

            const form = document.getElementById('employee-form');
            if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));
            const cancelBtn = document.getElementById('cancel-employee-btn');
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.showList());

            this.setupPhotoPreview();
        }, 100); // ✅ تأخير 100ms للتأكد من وجود جميع العناصر
    },

    /**
     * تحديث/تنظيف أسماء الموظفين ثم حفظها (Admin فقط)
     */
    async refreshEmployeeNames() {
        if (!this.canAddOrImport()) {
            Notification?.error?.('ليس لديك صلاحية لتنفيذ هذا الإجراء');
            return;
        }

        const btn = document.getElementById('refresh-employee-names-btn');
        const originalHTML = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري تحديث الأسماء...';
        }

        // ✅ إضافة Loading indicator
        if (typeof Loading !== 'undefined') {
            Loading.show();
        }

        try {
            // 1) اجلب أحدث نسخة من الشيت (حتى نصلح الأسماء على آخر بيانات)
            await this.loadEmployeesFromBackend(true);

            const employees = Array.isArray(AppState.appData.employees) ? AppState.appData.employees : [];
            if (employees.length === 0) {
                Notification?.warning?.('لا توجد بيانات موظفين');
                return;
            }

            // 2) تنظيف الاسماء (trim + collapse spaces)
            let changed = 0;
            const cleaned = employees.map(e => {
                const nameRaw = (e?.name ?? '');
                const name = String(nameRaw).replace(/\s+/g, ' ').trim();
                if (name !== String(nameRaw)) changed++;
                return { ...e, name };
            });

            AppState.appData.employees = cleaned;
            this.cache.data = cleaned;
            this.cache.lastLoad = Date.now();
            this.cache.lastUpdate = Date.now();

            // 3) حفظ (محلي + Sheets)
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
            await GoogleIntegration.autoSave('Employees', AppState.appData.employees);

            // ✅ تحديث القائمة مع الحفاظ على حالة showInactive
            const showInactive = document.getElementById('show-inactive-employees')?.checked || false;
            this.renderStatsCards();
            this.loadEmployeesList(showInactive);
            
            // ✅ تطبيق جميع الفلاتر بعد تحديث الأسماء
            requestAnimationFrame(async () => {
                try {
                    await this.applyFilters();
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                    }
                }
            });
            
            Notification?.success?.(changed > 0 ? `تم تحديث الأسماء (${changed} تعديلات)` : 'لا توجد تغييرات في الأسماء');
        } catch (error) {
            Notification?.error?.('حدث خطأ أثناء تحديث الأسماء: ' + (error?.message || error));
            Utils.safeError('خطأ في تحديث أسماء الموظفين:', error);
        } finally {
            if (typeof Loading !== 'undefined') {
                Loading.hide();
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }
    },

    /**
     * حذف جميع بيانات الموظفين (Admin فقط)
     */
    async deleteAllEmployees() {
        if (!this.canAddOrImport()) {
            Notification?.error?.('ليس لديك صلاحية لتنفيذ هذا الإجراء');
            return;
        }

        const confirmed = window.confirm('تحذير: سيتم حذف جميع بيانات الموظفين. هل أنت متأكد؟');
        if (!confirmed) return;

        const pin = window.prompt('أدخل الرقم السري للحذف:');
        if (pin === null) {
            Notification?.warning?.('تم إلغاء العملية');
            return;
        }

        const btn = document.getElementById('delete-all-employees-btn');
        const originalHTML = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الحذف...';
        }

        try {
            if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.callBackend) {
                throw new Error('GoogleIntegration غير متاح');
            }

            // ✅ حذف من الخلفية أولاً (محمي برقم سري في Apps Script)
            const res = await GoogleIntegration.callBackend('deleteAllEmployees', { pin: String(pin || '').trim() });
            if (!res || !res.success) {
                throw new Error(res?.message || 'فشل حذف بيانات الموظفين من قاعدة البيانات');
            }

            // ✅ ثم مسح البيانات محلياً (الواجهة الأمامية)
            AppState.appData.employees = [];
            this.cache.data = [];
            this.cache.lastLoad = Date.now();
            this.cache.lastUpdate = Date.now();

            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }

            this.renderStatsCards();
            // ✅ تحميل القائمة وتطبيق الفلاتر بعد الحذف
            const showInactive = document.getElementById('show-inactive-employees')?.checked || false;
            this.loadEmployeesList(showInactive);
            requestAnimationFrame(async () => {
                try {
                    await this.applyFilters();
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                    }
                }
            });
            Notification?.success?.(res?.message || 'تم حذف جميع بيانات الموظفين بنجاح');
        } catch (error) {
            Notification?.error?.('حدث خطأ أثناء حذف البيانات: ' + (error?.message || error));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }
    },

    setupPhotoPreview() {
        const photoInput = document.getElementById('employee-photo-input');
        const preview = document.getElementById('employee-photo-preview');
        const icon = document.getElementById('employee-photo-icon');

        if (photoInput && preview && icon) {
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                        icon.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    },

    currentEditId: null,

    async showForm(employeeData = null) {
        // التحقق من الصلاحيات للإضافة
        if (!employeeData && !this.canAddOrImport()) {
            Notification.error('ليس لديك صلاحية لإضافة موظف جديد');
            return;
        }
        
        // التحقق من الصلاحيات للتعديل
        if (employeeData && !this.canEditOrDelete()) {
            Notification.error('ليس لديك صلاحية لتعديل الموظف');
            return;
        }

        this.currentEditId = employeeData?.id || null;
        const content = document.getElementById('employees-content');
        if (!content) return;

        content.innerHTML = await this.renderForm(employeeData);
        this.applyModuleI18n(content);
        this.setupEventListeners();
    },

    async renderForm(employeeData = null) {
        const isEdit = !!employeeData;
        return `
            <div class="content-card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-${isEdit ? 'edit' : 'user-plus'} ml-2"></i>
                        ${isEdit ? this.t('module.employees.editEmployee', 'تعديل موظف') : this.t('module.employees.addNewEmployee', 'إضافة موظف جديد')}
                    </h2>
                </div>
                <div class="card-body">
                    <form id="employee-form" class="space-y-6">
                        <div class="grid grid-cols-2 gap-6">
                            <div class="col-span-2">
                                <label for="employee-photo-input" class="block text-sm font-semibold text-gray-700 mb-2">
                                    <i class="fas fa-image ml-2"></i>
                                    ${this.t('module.employees.employeePhoto', 'صورة الموظف')}
                                </label>
                                <div class="flex items-center gap-4">
                                    <div class="w-32 h-32 rounded-full border-2 border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                                        <img id="employee-photo-preview" src="${employeeData?.photo || ''}" alt="${this.t('module.employees.employeePhoto', 'صورة الموظف')}" style="width: 100%; height: 100%; object-fit: cover; display: ${employeeData?.photo ? 'block' : 'none'};">
                                        <i id="employee-photo-icon" class="fas fa-user text-4xl text-gray-400" style="display: ${employeeData?.photo ? 'none' : 'block'}"></i>
                                    </div>
                                    <div class="flex-1">
                                        <input 
                                            type="file" 
                                            id="employee-photo-input" 
                                            accept="image/*"
                                            class="form-input"
                                        >
                                        <p class="text-xs text-gray-500 mt-1">${this.t('module.employees.photoHint', 'يجب أن تكون صورة مربعة بحجم لا يتجاوز 2MB')}</p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label for="employee-name" class="block text-sm font-semibold text-gray-700 mb-2">${this.t('module.employees.fullNameRequired', 'الاسم الكامل *')}</label>
                                <input type="text" id="employee-name" required class="form-input" value="${employeeData?.name || ''}" placeholder="${this.t('module.employees.fullName', 'الاسم الكامل')}">
                            </div>
                            <div>
                                <label for="employee-sap-id" class="block text-sm font-semibold text-gray-700 mb-2">الكود الوظيفي (ID SAP) *</label>
                                <input type="text" id="employee-sap-id" required class="form-input" value="${employeeData?.sapId || employeeData?.employeeNumber || ''}" placeholder="ID SAP">
                            </div>
                            <div>
                                <label for="employee-number" class="block text-sm font-semibold text-gray-700 mb-2">${this.t('module.employees.employeeNumberRequired', 'الرقم الوظيفي *')}</label>
                                <input type="text" id="employee-number" required class="form-input" value="${employeeData?.employeeNumber || ''}" placeholder="${this.t('module.employees.employeeNumber', 'الرقم الوظيفي')}">
                            </div>
                            <div>
                                <label for="employee-hire-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ التعيين *</label>
                                <input type="date" id="employee-hire-date" required class="form-input" value="${employeeData?.hireDate ? this.formatDateSafe(employeeData.hireDate) : ''}">
                            </div>
                            <div>
                                <label for="employee-birth-date" class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الميلاد</label>
                                <input type="date" id="employee-birth-date" class="form-input" value="${employeeData?.birthDate ? this.formatDateSafe(employeeData.birthDate) : ''}">
                            </div>
                            <div>
                                <label for="employee-department" class="block text-sm font-semibold text-gray-700 mb-2">القسم *</label>
                                <input type="text" id="employee-department" required class="form-input" value="${employeeData?.department || ''}" placeholder="القسم">
                            </div>
                            <div>
                                <label for="employee-position" class="block text-sm font-semibold text-gray-700 mb-2">المنصب (Job) *</label>
                                <input type="text" id="employee-position" required class="form-input" value="${employeeData?.position || ''}" placeholder="المنصب">
                            </div>
                            <div>
                                <label for="employee-branch" class="block text-sm font-semibold text-gray-700 mb-2">الرع (Branch)</label>
                                <input type="text" id="employee-branch" class="form-input" value="${employeeData?.branch || ''}" placeholder="الرع">
                            </div>
                            <div>
                                <label for="employee-location" class="block text-sm font-semibold text-gray-700 mb-2">الموقع (Location)</label>
                                <input type="text" id="employee-location" class="form-input" value="${employeeData?.location || ''}" placeholder="الموقع">
                            </div>
                            <div>
                                <label for="employee-gender" class="block text-sm font-semibold text-gray-700 mb-2">الجنس (Gender)</label>
                                <select id="employee-gender" class="form-input">
                                    <option value="">اختر الجنس</option>
                                    <option value="ذكر" ${employeeData?.gender === 'ذكر' ? 'selected' : ''}>ذكر</option>
                                    <option value="أنثى" ${employeeData?.gender === 'أنثى' ? 'selected' : ''}>أنثى</option>
                                </select>
                            </div>
                            <div>
                                <label for="employee-national-id" class="block text-sm font-semibold text-gray-700 mb-2">رقم البطاقة القومية</label>
                                <input type="text" id="employee-national-id" class="form-input" value="${employeeData?.nationalId || ''}" placeholder="رقم البطاقة القومية">
                            </div>
                            <div>
                                <label for="employee-email" class="block text-sm font-semibold text-gray-700 mb-2">البريد الإلكتروني</label>
                                <input type="email" id="employee-email" class="form-input" value="${employeeData?.email || ''}" placeholder="البريد الإلكتروني">
                            </div>
                            <div>
                                <label for="employee-phone" class="block text-sm font-semibold text-gray-700 mb-2">الهاتف</label>
                                <input type="tel" id="employee-phone" class="form-input" value="${employeeData?.phone || ''}" placeholder="رقم الهاتف">
                            </div>
                            <div>
                                <label for="employee-insurance-number" class="block text-sm font-semibold text-gray-700 mb-2">الرقم التأميني</label>
                                <input type="text" id="employee-insurance-number" class="form-input" value="${employeeData?.insuranceNumber || ''}" placeholder="الرقم التأميني">
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-4 pt-4 border-t">
                            <button type="button" id="cancel-employee-btn" class="btn-secondary">${this.t('module.common.cancel', 'إلغاء')}</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save ml-2"></i>${isEdit ? this.t('module.common.saveChanges', 'حفظ التعديلات') : this.t('module.employees.addEmployee', 'إضافة الموظف')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async showImportExcel() {
        // التحقق من الصلاحيات
        if (!this.canAddOrImport()) {
            Notification.error(this.t('module.employees.noImportPermission', 'ليس لديك صلاحية لاستيراد الموظفين'));
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-file-excel ml-2"></i>${this.t('module.employees.importModalTitle', 'استيراد الموظفين من ملف Excel')}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="bg-blue-50 border border-blue-200 rounded p-4">
                            <p class="text-sm text-blue-800 mb-2"><strong>ملاحظة مهمة:</strong></p>
                            <p class="text-sm text-blue-700 mb-2">يجب أن يحتوي ملف Excel على الأعمدة التالية:</p>
                            <ul class="text-sm text-blue-700 list-disc mr-6 mt-2 space-y-1">
                                <li><strong>ID SAP</strong> أو <strong>رقم SAP</strong> - الكود الوظيفي</li>
                                <li><strong>رقم الموظف</strong> أو <strong>الرقم الوظيفي</strong> أو <strong>Employee Number</strong> - (سيتم استخدامه كـ ID)</li>
                                <li><strong>اسم الموظف</strong> أو <strong>Employee Name</strong> - إلزامي</li>
                                <li><strong>تاريخ التعيين</strong> أو <strong>Hire Date</strong></li>
                                <li><strong>Job</strong> أو <strong>المنصب</strong></li>
                                <li><strong>Department</strong> أو <strong>القسم</strong></li>
                                <li><strong>Branch</strong> أو <strong>الرع</strong></li>
                                <li><strong>Location</strong> أو <strong>الموقع</strong></li>
                                <li><strong>Gender</strong> أو <strong>الجنس</strong></li>
                                <li><strong>رقم البطاقة القومى</strong> أو <strong>National ID</strong></li>
                                <li><strong>تاريخ الميلاد</strong> أو <strong>Date of Birth</strong></li>
                                <li><strong>الرقم التأميني</strong> أو <strong>Insurance Number</strong></li>
                            </ul>
                        </div>
                        <div>
                            <label for="employee-excel-file-input" class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-file-excel ml-2"></i>
                                اختر مل Excel (.xlsx, .xls)
                            </label>
                            <input type="file" id="employee-excel-file-input" accept=".xlsx,.xls" class="form-input">
                        </div>
                        <div id="employee-import-preview" class="hidden">
                            <h3 class="text-sm font-semibold mb-2">معاينة البيانات (أول 5 صورة):</h3>
                            <div class="max-h-60 overflow-auto border rounded">
                                <table class="data-table text-xs">
                                    <thead id="employee-preview-head"></thead>
                                    <tbody id="employee-preview-body"></tbody>
                                </table>
                            </div>
                            <p id="employee-preview-count" class="text-sm text-gray-600 mt-2"></p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${this.t('module.common.cancel', 'إلغاء')}</button>
                    <button type="button" id="employee-import-confirm-btn" class="btn-primary" disabled>
                        <i class="fas fa-check ml-2"></i>
                        ${this.t('module.employees.confirmImport', 'تأكيد الاستيراد')}
                    </button>
                </div>
            </div>
        `;
        this.applyModuleI18n(modal);
        document.body.appendChild(modal);

        const fileInput = document.getElementById('employee-excel-file-input');
        const preview = document.getElementById('employee-import-preview');
        const confirmBtn = document.getElementById('employee-import-confirm-btn');
        let importedData = [];

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            Loading.show();
            try {
                // قراءة مل Excel باستخدام SheetJS
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

                if (data.length < 2) {
                    Notification.error(this.t('module.employees.invalidFile', 'الملف فارغ أو غير صحيح'));
                    Loading.hide();
                    return;
                }

                const headers = data[0].map(h => String(h || '').trim());
                importedData = data.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        const cell = row[index];
                        obj[header] = (cell === undefined || cell === null) ? '' : cell;
                    });
                    return obj;
                }).filter(row => String(row[headers[0]] || '').trim() !== ''); // تصفية الصفوف الفارغة

                // عرض المعاينة
                const previewHead = document.getElementById('employee-preview-head');
                const previewBody = document.getElementById('employee-preview-body');
                const previewCount = document.getElementById('employee-preview-count');

                previewHead.innerHTML = `<tr>${headers.map(h => `<th>${Utils.escapeHTML(h)}</th>`).join('')}</tr>`;
                previewBody.innerHTML = importedData.slice(0, 5).map(row =>
                    `<tr>${headers.map(h => `<td>${Utils.escapeHTML(String(row[h] || ''))}</td>`).join('')}</tr>`
                ).join('');

                previewCount.textContent = `${this.t('module.employees.totalRows', 'إجمالي الصفوف')}: ${importedData.length}`;
                preview.classList.remove('hidden');
                confirmBtn.disabled = false;

                Loading.hide();
            } catch (error) {
                Loading.hide();
                Notification.error(this.t('module.employees.readFileFailed', 'فشل قراءة الملف') + ': ' + error.message);
            }
        });

        confirmBtn.addEventListener('click', async () => {
            if (importedData.length === 0) return;

            Loading.show();
            try {
                let successCount = 0;
                let errorCount = 0;
                const safeStr = (v) => (v === null || v === undefined) ? '' : String(v).trim();

                importedData.forEach(row => {
                    try {
                        // محاولة العثور على البيانات في أي عمود ممكن
                        const name = row['اسم الموظ'] || row['اسم الموظف'] || row['Employee Name'] || row['Name'] || row['name'] || '';
                        const sapId = row['ID SAP'] || row['رقم SAP'] || row['SAP ID'] || row['sap_id'] || '';
                        const employeeNumberRaw = row['رقم الموظف'] || row['الرقم الوظيفي'] || row['Employee Number'] || row['employee_number'] || '';
                        const hireDate = row['تاريخ التعيين'] || row['Hire Date'] || row['hire_date'] || '';
                        const job = row['Job'] || row['job'] || row['المنصب'] || '';
                        const dept = row['Department'] || row['department'] || row['القسم'] || '';
                        const branch = row['Branch'] || row['branch'] || row['الرع'] || '';
                        const location = row['Location'] || row['location'] || row['الموقع'] || '';
                        const gender = row['Gender'] || row['gender'] || row['الجنس'] || '';
                        const nationalId = row['رقم البطاقة القومى'] || row['National ID'] || row['national_id'] || '';
                        const birthDate = row['تاريخ الميلاد'] || row['Date of Birth'] || row['birth_date'] || '';
                        const email = row['Email'] || row['email'] || row['البريد الإلكتروني'] || '';
                        const phone = row['Phone'] || row['phone'] || row['الهات'] || '';
                        const insuranceNumber = row['الرقم التأميني'] || row['Insurance Number'] || row['insurance_number'] || row['رقم التأمين'] || '';

                        const employeeNumber = safeStr(employeeNumberRaw) || safeStr(sapId);

                        if (!name && !employeeNumber) {
                            errorCount++;
                            return;
                        }

                        // التحقق من عدم وجود الموظف مسبقاً
                        const existing = AppState.appData.employees.find(e =>
                            (e.employeeNumber && e.employeeNumber === employeeNumber) ||
                            (e.name && e.name.toLowerCase() === safeStr(name).toLowerCase())
                        );

                        if (!existing) {
                            const employee = {
                                // ✅ مطلوب: id = رقم الموظف (employeeNumber)
                                id: employeeNumber || Utils.generateId('EMP'),
                                name: safeStr(name),
                                employeeNumber: employeeNumber || Utils.generateId('EMP'),
                                sapId: safeStr(sapId),
                                // ✅ مطلوب: تواريخ بصيغة YYYY-MM-DD بدون ISO Z / timezone shift
                                hireDate: this.normalizeDateOnly(hireDate) || this.normalizeDateOnly(new Date()),
                                // ✅ توافق مع Header Employees: لدينا job و position
                                job: safeStr(job),
                                position: safeStr(job),
                                department: safeStr(dept),
                                branch: safeStr(branch),
                                location: safeStr(location),
                                gender: safeStr(gender),
                                // ✅ رقم البطاقة: تخزين كنص
                                nationalId: safeStr(nationalId),
                                birthDate: this.normalizeDateOnly(birthDate),
                                email: safeStr(email),
                                phone: safeStr(phone),
                                insuranceNumber: safeStr(insuranceNumber),
                                photo: '',
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            AppState.appData.employees.push(employee);
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (err) {
                        errorCount++;
                    }
                });

                // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
                await GoogleIntegration.autoSave('Employees', AppState.appData.employees);

                // تحديث Cache
                this.cache.data = AppState.appData.employees;
                this.cache.lastLoad = Date.now();
                this.cache.lastUpdate = Date.now();

                Loading.hide();
                Notification.success(`تم استيراد ${successCount} موظف${errorCount > 0 ? ` (فشل ${errorCount} موظفين)` : ''}`);
                modal.remove();
                
                // تحديث الكروت الإحصائية
                this.renderStatsCards();
                
                // ✅ تطبيق جميع الفلاتر بعد الاستيراد
                const showInactive = document.getElementById('show-inactive-employees')?.checked || false;
                this.loadEmployeesList(showInactive);
                requestAnimationFrame(() => {
                    this.applyFilters();
                });
            } catch (error) {
                Loading.hide();
                Notification.error('فشل الاستيراد: ' + error.message);
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async handleSubmit(e) {
        e.preventDefault();

        // منع النقر المتكرر
        const submitBtn = e.target?.querySelector('button[type="submit"]') || 
                         document.querySelector('#employee-form button[type="submit"]');
        
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

        const employeeData = this.currentEditId ? AppState.appData.employees.find(e => e.id === this.currentEditId) : null;

        let photoBase64 = employeeData?.photo || '';
        const photoInput = document.getElementById('employee-photo-input');
        if (photoInput && photoInput.files.length > 0) {
            const file = photoInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                Notification.error('حجم الصورة كبير جداً. الحد الأقصى هو 2MB');
                // استعادة الزر عند الخطأ
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                return;
            }
            photoBase64 = await this.convertImageToBase64(file);
        }

        // فحص العناصر قبل الاستخدام
        const nameEl = document.getElementById('employee-name');
        const employeeNumberEl = document.getElementById('employee-number');
        const sapIdEl = document.getElementById('employee-sap-id');
        const hireDateEl = document.getElementById('employee-hire-date');
        const birthDateEl = document.getElementById('employee-birth-date');
        const departmentEl = document.getElementById('employee-department');
        const positionEl = document.getElementById('employee-position');
        const branchEl = document.getElementById('employee-branch');
        const locationEl = document.getElementById('employee-location');
        const genderEl = document.getElementById('employee-gender');
        const nationalIdEl = document.getElementById('employee-national-id');
        const emailEl = document.getElementById('employee-email');
        const phoneEl = document.getElementById('employee-phone');
        const insuranceNumberEl = document.getElementById('employee-insurance-number');
        
        if (!nameEl || !employeeNumberEl || !sapIdEl || !departmentEl || !positionEl || 
            !branchEl || !locationEl || !genderEl || !emailEl || !phoneEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }

        // ✅ في وضع التعديل: إذا ترك المستخدم التاريخ فارغاً، لا نمسح القيمة القديمة
        const isEditMode = !!this.currentEditId;
        const prevHireDate = isEditMode ? (employeeData?.hireDate || '') : '';
        const prevBirthDate = isEditMode ? (employeeData?.birthDate || '') : '';

        const formData = {
            // ✅ مطلوب: id = رقم الموظف (employeeNumber)
            id: employeeNumberEl.value.trim() || this.currentEditId || Utils.generateId('EMP'),
            name: nameEl.value.trim(),
            employeeNumber: employeeNumberEl.value.trim(),
            sapId: sapIdEl.value.trim(),
            // ✅ مطلوب: حفظ التاريخ بصيغة YYYY-MM-DD بدون مشاكل timezone
            hireDate: hireDateEl?.value ? this.normalizeDateOnly(hireDateEl.value) : (isEditMode ? this.normalizeDateOnly(prevHireDate) : this.normalizeDateOnly(new Date())),
            birthDate: birthDateEl?.value ? this.normalizeDateOnly(birthDateEl.value) : (isEditMode ? this.normalizeDateOnly(prevBirthDate) : ''),
            department: departmentEl.value.trim(),
            // ✅ توافق مع Header Employees: لدينا job و position
            job: positionEl.value.trim(),
            position: positionEl.value.trim(),
            branch: branchEl.value.trim(),
            location: locationEl.value.trim(),
            gender: genderEl.value,
            nationalId: nationalIdEl?.value.trim() || '',
            email: emailEl.value.trim(),
            phone: phoneEl.value.trim(),
            insuranceNumber: insuranceNumberEl?.value.trim() || '',
            photo: photoBase64,
            // ✅ إضافة: status و resignationDate لإدارة استقالات الموظفين
            status: isEditMode ? (employeeData?.status || 'active') : 'active', // افتراضي: نشط
            resignationDate: isEditMode ? (employeeData?.resignationDate || '') : '', // فارغ للموظفين الجدد
            createdAt: this.currentEditId ? employeeData?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!formData.name || !formData.sapId || !formData.employeeNumber || !formData.department || !formData.position) {
            Notification.error('يرجى ملء جميع الحقول المطلوبة (الاسم، الكود الوظيفي، الرقم الوظيفي، القسم، المنصب)');
            // استعادة الزر عند الخطأ
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        // ✅ منع تعارض الـ id (لأن id أصبح = رقم الموظف)
        const proposedId = String(formData.id || '').trim();
        if (!proposedId) {
            Notification.error('رقم الموظف غير صالح (لا يمكن إنشاء id فارغ)');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }
        const isDuplicateId = AppState.appData.employees.some(e => {
            const eid = String(e?.id || '').trim();
            if (!eid) return false;
            // في حالة التعديل: نسمح بنفس id القديم فقط
            if (this.currentEditId && eid === String(this.currentEditId).trim()) return false;
            return eid === proposedId;
        });
        if (isDuplicateId) {
            Notification.error('رقم الموظف مستخدم بالفعل. يرجى اختيار رقم آخر.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        Loading.show();
        try {
            if (this.currentEditId) {
                const index = AppState.appData.employees.findIndex(e => e.id === this.currentEditId);
                if (index !== -1) {
                    AppState.appData.employees[index] = formData;
                    // إذا تغيّر id (بسبب تغيير رقم الموظف) نحدّث currentEditId
                    this.currentEditId = proposedId;
                }
                Notification.success('تم تحديث الموظف بنجاح');
            } else {
                AppState.appData.employees.push(formData);
                Notification.success('تم إضافة الموظف بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            // حفظ تلقائي في Google Sheets
            await GoogleIntegration.autoSave('Employees', AppState.appData.employees);

            // تحديث Cache
            this.cache.data = AppState.appData.employees;
            this.cache.lastLoad = Date.now();
            this.cache.lastUpdate = Date.now();

            Loading.hide();
            
            // استعادة الزر بعد النجاح
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            
            // تحديث الكروت الإحصائية
            this.renderStatsCards();
            
            this.showList();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
            
            // استعادة الزر في حالة الخطأ
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
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

    async showList() {
        this.currentEditId = null;
        if (!this.canViewEmployeesRegistryTab() && this.canViewExternalWorkforceTab()) {
            this.activeTab = 'external-workforce';
        } else if (!this.canViewExternalWorkforceTab()) {
            this.activeTab = 'employees-list';
        }
        const content = document.getElementById('employees-content');
        if (content) {
            content.innerHTML = await this.renderList();
            this.applyModuleI18n(content);
            // استخدام requestAnimationFrame لضمان عدم حدوث reflow متعدد
            requestAnimationFrame(() => {
                this.setupEventListeners();
                if (this.canViewEmployeesRegistryTab() && this.activeTab === 'employees-list') {
                    this.loadEmployeesList();
                } else if (this.canViewExternalWorkforceTab()) {
                    this.populateExternalWorkforceYearSelector();
                    this.ensureExternalWorkforceDataLoaded().then(() => this.renderExternalWorkforceTable()).catch(() => {});
                }
                // التمرير السلس إلى حقل البحث بعد تحميل القائمة
                if (this.activeTab === 'employees-list') this.scrollToSearchField();
            });
        }
    },

    async editEmployee(id) {
        // التحقق من الصلاحيات
        if (!this.canEditOrDelete()) {
            Notification.error('ليس لديك صلاحية لتعديل الموظف');
            return;
        }

        const employee = AppState.appData.employees.find(e => e.id === id);
        if (employee) await this.showForm(employee);
    },

    async printEmployee(id) {
        const employee = AppState.appData.employees.find(e => e.id === id);
        if (!employee) {
            Notification.error('الموظف غير موجود');
            return;
        }

        try {
            Loading.show();

            let printPhotoSrc = '';
            const normPhoto = this._normalizeEmployeePhotoUrl(employee.photo, employee.id);
            if (normPhoto && typeof Utils.resolveDriveAwareImgDisplay === 'function') {
                const pd = Utils.resolveDriveAwareImgDisplay(normPhoto);
                if (pd.needsProxy && typeof Utils.fetchDriveImageDataUri === 'function') {
                    try {
                        printPhotoSrc = await Utils.fetchDriveImageDataUri(pd.proxyFileId) || '';
                    } catch (e) { printPhotoSrc = ''; }
                }
                if (!printPhotoSrc) printPhotoSrc = pd.canonical || normPhoto;
            } else if (normPhoto) {
                printPhotoSrc = normPhoto;
            }
            
            const birthDate = this.formatDateSafe(employee.birthDate);
            const hireDate = this.formatDateSafe(employee.hireDate);
            const age = this.calculateAge(employee.birthDate);
            
            // تنسيق التاريخ بالعربية
            const formatDate = (dateStr) => {
                if (!dateStr) return '-';
                try {
                    const date = new Date(dateStr);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;
                    const day = date.getDate();
                    // تحويل الأرقام إلى عربية
                    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                    const toArabic = (num) => String(num).split('').map(d => arabicNumbers[parseInt(d)] || d).join('');
                    return `${toArabic(year)}/${toArabic(month)}/${toArabic(day)}`;
                } catch {
                    return dateStr;
                }
            };

            // تنسيق الوقت للطباعة
            const now = new Date();
            const printDate = formatDate(now.toISOString().split('T')[0]);
            const printTime = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            // الحصول على اسم الشركة من AppState أو استخدام القيمة الافتراضية
            const companyName = AppState?.companySettings?.name || AppState?.appData?.companyName || 'الشركة';

            const content = `
                <style>
                    @page { size: A4; margin: 20mm; }
                    body {
                        font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                        direction: rtl;
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        color: #1f2937;
                    }
                    .employee-card {
                        max-width: 800px;
                        margin: 0 auto;
                        background: #ffffff;
                        padding: 30px;
                    }
                    .card-header {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .company-name {
                        font-size: 18px;
                        font-weight: 700;
                        color: #2563eb;
                        margin-bottom: 5px;
                    }
                    .card-title {
                        font-size: 22px;
                        font-weight: 700;
                        color: #1e40af;
                        margin-bottom: 10px;
                    }
                    .header-line {
                        width: 100%;
                        height: 2px;
                        background: #2563eb;
                        margin: 10px 0 20px 0;
                    }
                    .employee-photo {
                        text-align: center;
                        margin: 20px 0 30px 0;
                    }
                    .employee-photo img {
                        width: 150px;
                        height: 150px;
                        border-radius: 50%;
                        object-fit: cover;
                        border: 3px solid #e5e7eb;
                    }
                    .employee-photo-placeholder {
                        width: 150px;
                        height: 150px;
                        border-radius: 50%;
                        background: #f3f4f6;
                        margin: 0 auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 3px solid #e5e7eb;
                    }
                    .employee-photo-placeholder svg {
                        width: 80px;
                        height: 80px;
                        fill: #9ca3af;
                    }
                    .employee-details {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 15px;
                        margin-bottom: 30px;
                    }
                    .detail-field {
                        background: #f9fafb;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        padding: 12px 15px;
                    }
                    .detail-label {
                        font-size: 13px;
                        font-weight: 600;
                        color: #6b7280;
                        margin-bottom: 5px;
                    }
                    .detail-value {
                        font-size: 15px;
                        font-weight: 500;
                        color: #1f2937;
                    }
                    .card-footer {
                        text-align: center;
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 12px;
                        color: #6b7280;
                        line-height: 1.8;
                    }
                    .footer-text {
                        margin-bottom: 8px;
                    }
                    .print-date {
                        font-size: 11px;
                        color: #9ca3af;
                    }
                    @media print {
                        body { background: #ffffff; }
                        .employee-card { box-shadow: none; }
                    }
                </style>
                <div class="employee-card">
                    <div class="card-header">
                        <div class="company-name">${Utils.escapeHTML(companyName)}</div>
                        <div class="card-title">بطاقة بيانات موظف</div>
                        <div class="header-line"></div>
                    </div>
                    <div class="employee-photo">
                        ${printPhotoSrc
                            ? `<img src="${Utils.escapeHTML(printPhotoSrc)}" alt="${Utils.escapeHTML(employee.name || '')}"
                                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'employee-photo-placeholder\\'><svg viewBox=\\'0 0 24 24\\' xmlns=\\'http://www.w3.org/2000/svg\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg></div>';">`
                            : `<div class="employee-photo-placeholder">
                                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                </div>`}
                    </div>
                    <div class="employee-details">
                        <div class="detail-field">
                            <div class="detail-label">الرقم الوظيفي</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.employeeNumber || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">الاسم الكامل</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.name || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">الوظيفة</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.position || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">القسم</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.department || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">تاريخ الميلاد</div>
                            <div class="detail-value">${formatDate(birthDate)}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">رقم البطاقة القومية</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.nationalId || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">تاريخ التعيين</div>
                            <div class="detail-value">${formatDate(hireDate)}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">السن</div>
                            <div class="detail-value">${age ? age + ' سنة' : '-'}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">رقم الهاتف</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.phone || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">النوع</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.gender === 'ذكر' ? 'Male' : employee.gender === 'أنثى' ? 'Female' : employee.gender || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">البريد الإلكتروني</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.email || '-')}</div>
                        </div>
                        <div class="detail-field">
                            <div class="detail-label">الرقم التأميني</div>
                            <div class="detail-value">${Utils.escapeHTML(employee.insuranceNumber || '-')}</div>
                        </div>
                    </div>
                    <div class="card-footer">
                        <div class="footer-text">هذا المستند تم إنشاؤه آلياً من نظام إدارة الموارد البشرية</div>
                        <div class="print-date">تاريخ الطباعة: ${printDate} - ${printTime}</div>
                    </div>
                </div>
            `;

            const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>بطاقة بيانات موظف - ${Utils.escapeHTML(employee.name || '')}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    ${content}
</head>
<body>
    ${content}
</body>
</html>`;

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
                                Loading.hide();
                            }, 800);
                        }, 300);
                    } else {
                        // Wait for all images to load
                        const checkAllImagesLoaded = () => {
                            if (imagesLoaded >= totalImages) {
                                setTimeout(() => {
                                    printWindow.print();
                                    setTimeout(() => {
                                        URL.revokeObjectURL(url);
                                        Loading.hide();
                                    }, 800);
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
                                    Loading.hide();
                                }, 800);
                            }
                        }, 3000);
                    }
                };
            } else {
                URL.revokeObjectURL(url);
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة بيانات الموظف:', error);
            Notification.error('حدث خطأ أثناء الطباعة: ' + error.message);
        }
    },

    async viewEmployee(id) {
        const employee = AppState.appData.employees.find(e => e.id === id);
        if (!employee) return;

        const birthDate = this.formatDateSafe(employee.birthDate);
        const hireDate = this.formatDateSafe(employee.hireDate);
        const age = this.calculateAge(employee.birthDate);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">${this.t('module.employees.employeeDetails', 'تفاصيل الموظف')}</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="text-center mb-4">
                            ${(() => {
                                const p = this._normalizeEmployeePhotoUrl(employee.photo, employee.id);
                                if (!p) return `<div class="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mx-auto"><i class="fas fa-user text-5xl text-gray-400"></i></div>`;
                                const disp = typeof Utils.resolveDriveAwareImgDisplay === 'function'
                                    ? Utils.resolveDriveAwareImgDisplay(p)
                                    : { canonical: p, displaySrc: p, needsProxy: false, proxyFileId: '' };
                                const pa = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(disp) : '';
                                return `<img src="${Utils.escapeHTML(disp.displaySrc)}" alt="${Utils.escapeHTML(employee.name || '')}"${pa} class="emp-detail-photo w-32 h-32 rounded-full object-cover mx-auto border-4 border-gray-200">`;
                            })()}
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.fullName', 'الاسم الكامل')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.name || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.employeeNumber', 'الرقم الوظيفي')}:</label>
                                <p class="text-gray-800 font-mono">${Utils.escapeHTML(employee.employeeNumber || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.department', 'القسم')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.department || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.job', 'الوظيفة')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.position || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.table.nationalId', 'رقم البطاقة')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.nationalId || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.table.birthDate', 'تاريخ الميلاد')}:</label>
                                <p class="text-gray-800">${birthDate || ''}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.table.age', 'السن')}:</label>
                                <p class="text-gray-800">${age ? age + ' ' + this.t('module.common.yearsUnit', 'سنة') : ''}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.table.hireDate', 'تاريخ التعيين')}:</label>
                                <p class="text-gray-800">${hireDate || ''}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.gender', 'النوع')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.gender || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.table.phone', 'الهاتف')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.phone || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.table.insuranceNo', 'الرقم التأميني')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.insuranceNumber || '')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">${this.t('module.employees.email', 'البريد الإلكتروني')}:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(employee.email || '')}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">${this.t('module.common.close', 'إغلاق')}</button>
                    <button class="btn-secondary" onclick="Employees.printEmployee('${employee.id}')">
                        <i class="fas fa-print ml-2"></i>${this.t('module.common.print', 'طباعة')}
                    </button>
                    ${Employees.canEditOrDelete() ? `
                    <button class="btn-primary" onclick="Employees.editEmployee('${employee.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>${this.t('module.common.edit', 'تعديل')}
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
        this.applyModuleI18n(modal);
        document.body.appendChild(modal);
        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(modal, {
                onFetchFail: (img) => {
                    try {
                        const d = document.createElement('div');
                        d.className = 'w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mx-auto';
                        d.innerHTML = '<i class="fas fa-user text-5xl text-gray-400"></i>';
                        img.replaceWith(d);
                    } catch (e) { /* ignore */ }
                }
            });
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * إلغاء تفعيل موظف (Soft Delete) - بدلاً من الحذف الكامل
     * ✅ يتم تعطيل الموظف بدلاً من حذفه من قاعدة البيانات
     */
    async deactivateEmployee(id) {
        // التحقق من الصلاحيات
        if (!this.canEditOrDelete()) {
            Notification.error('ليس لديك صلاحية لإلغاء تفعيل الموظف');
            return;
        }

        const employee = AppState.appData.employees.find(e => e.id === id);
        if (!employee) {
            Notification.error('الموظف غير موجود');
            return;
        }

        if (!confirm(`هل أنت متأكد من إلغاء تفعيل الموظف "${employee.name}"؟\nسيتم إخفاؤه من القوائم ولكن سيتم الاحتفاظ ببياناته في النظام.`)) return;
        
        Loading.show();
        try {
            // ✅ تحديث حالة الموظف بدلاً من الحذف
            const employeeIndex = AppState.appData.employees.findIndex(e => e.id === id);
            if (employeeIndex !== -1) {
                AppState.appData.employees[employeeIndex].status = 'inactive';
                AppState.appData.employees[employeeIndex].resignationDate = this.normalizeDateOnly(new Date());
                AppState.appData.employees[employeeIndex].updatedAt = new Date().toISOString();
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            
            // حفظ تلقائي في Google Sheets
            await GoogleIntegration.autoSave('Employees', AppState.appData.employees);
            
            // ✅ محاولة استخدام deactivateEmployee من Backend إذا كان متاحاً
            if (AppState.googleConfig.appsScript.enabled) {
                try {
                    await GoogleIntegration.sendToAppsScript('deactivateEmployee', { employeeId: id });
                } catch (error) {
                    Utils.safeWarn('⚠️ فشل إلغاء تفعيل الموظف من Google Sheets، سيتم المحاولة لاحقاً:', error);
                }
            }
            
            // تحديث Cache
            this.cache.data = AppState.appData.employees;
            this.cache.lastLoad = Date.now();
            this.cache.lastUpdate = Date.now();
            
            Loading.hide();
            Notification.success('تم إلغاء تفعيل الموظف بنجاح');
            
            // تحديث الكروت الإحصائية
            this.renderStatsCards();
            
            // ✅ تطبيق جميع الفلاتر بعد إلغاء التفعيل
            const showInactive = document.getElementById('show-inactive-employees')?.checked || false;
            this.loadEmployeesList(showInactive);
            requestAnimationFrame(async () => {
                try {
                    await this.applyFilters();
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                    }
                }
            });
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * حذف موظف (Hard Delete) - محفوظ للتوافق مع الكود القديم
     * ⚠️ يُنصح باستخدام deactivateEmployee بدلاً من هذه الدالة
     * @deprecated استخدم deactivateEmployee بدلاً من هذه الدالة
     */
    async deleteEmployee(id) {
        // التحقق من الصلاحيات
        if (!this.canEditOrDelete()) {
            Notification.error('ليس لديك صلاحية لحذف الموظف');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذا الموظف نهائياً؟\n⚠️ تحذير: هذه العملية لا يمكن التراجع عنها!')) return;
        Loading.show();
        try {
            AppState.appData.employees = (AppState.appData.employees || []).filter(e => e.id !== id);
            // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
            // حفظ تلقائي في Google Sheets
            await GoogleIntegration.autoSave('Employees', AppState.appData.employees);
            
            // تحديث Cache
            this.cache.data = AppState.appData.employees;
            this.cache.lastLoad = Date.now();
            this.cache.lastUpdate = Date.now();
            
            Loading.hide();
            Notification.success('تم حذف الموظف بنجاح');
            
            // تحديث الكروت الإحصائية
            this.renderStatsCards();
            
            // ✅ تطبيق جميع الفلاتر بعد الحذف
            const showInactive = document.getElementById('show-inactive-employees')?.checked || false;
            this.loadEmployeesList(showInactive);
            requestAnimationFrame(async () => {
                try {
                    await this.applyFilters();
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeError('خطأ في تطبيق الفلاتر:', error);
                    }
                }
            });
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
        }
    },

    /**
     * التمرير السلس إلى حقل البحث
     */
    scrollToSearchField() {
        setTimeout(() => {
            const searchInput = document.getElementById('employees-search');
            if (searchInput) {
                const currentScrollY = window.scrollY || document.documentElement.scrollTop;
                const targetY = Math.max(0, (searchInput.offsetTop || 0) - 20);
                const viewportBottom = currentScrollY + window.innerHeight;
                const notVisible = targetY < currentScrollY || targetY > (viewportBottom - 100);
                if (notVisible) {
                    window.scrollTo({
                        top: targetY,
                        behavior: 'smooth'
                    });
                }
            }
        }, 0);
    },

    /**
     * جمع قيم الفلاتر من الواجهة
     */
    getFilterValues() {
        return {
            search: document.getElementById('employees-search-filter')?.value || document.getElementById('employees-search')?.value || '',
            department: document.getElementById('employee-filter-department')?.value || '',
            branch: document.getElementById('employee-filter-branch')?.value || '',
            location: document.getElementById('employee-filter-location')?.value || '',
            job: document.getElementById('employee-filter-job')?.value || '',
            position: document.getElementById('employee-filter-position')?.value || '',
            gender: document.getElementById('employee-filter-gender')?.value || '',
            showInactive: document.getElementById('show-inactive-employees')?.checked || false
        };
    },

    async filterEmployees(searchTerm = '', showInactive = false, filters = null) {
        try {
            // ✅ جمع قيم الفلاتر من الواجهة إذا لم يتم تمريرها
            if (!filters) {
                const filterValues = this.getFilterValues();
                searchTerm = searchTerm || filterValues.search;
                // ✅ احترام قيمة showInactive الممررة أولاً، ثم من الواجهة
                showInactive = showInactive !== undefined && showInactive !== null ? showInactive : (filterValues.showInactive || false);
                filters = filterValues;
                // ✅ تحديث showInactive في filters لضمان الاتساق
                filters.showInactive = showInactive;
            } else {
                // ✅ إذا تم تمرير filters، استخدام showInactive من filters
                showInactive = filters.showInactive !== undefined && filters.showInactive !== null ? filters.showInactive : showInactive;
            }
            
            // ✅ التأكد من أن الجدول موجود، وإذا لم يكن موجوداً، تحميل القائمة أولاً
            const container = document.getElementById('employees-table-container');
            if (!container) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ employees-table-container غير موجود');
                }
                return;
            }
            
            let tbody = container.querySelector('tbody');
            
            // إذا لم يكن الجدول موجوداً (مثلاً تم استبداله بـ empty-state)، تحميل القائمة أولاً
            if (!tbody) {
                // تحميل القائمة مع إعدادات showInactive
                await this.loadEmployeesList(showInactive);
                // إعادة البحث عن tbody بعد تحميل القائمة
                tbody = container.querySelector('tbody');
                // إذا لم يكن موجوداً بعد التحميل، الخروج
                if (!tbody) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('⚠️ tbody غير موجود بعد تحميل القائمة');
                    }
                    return;
                }
            }
        
        let employees = AppState.appData.employees || [];
        
        // ✅ تصفية الموظفين النشطين فقط (ما لم يُطلب خلاف ذلك) - استخدام isEmployeeInactive
        if (!showInactive) {
            employees = employees.filter(e => !this.isEmployeeInactive(e));
        }
        
        let filtered = employees;
        const canEditOrDelete = this.canEditOrDelete();

        // ✅ تطبيق البحث مع trim لإزالة المسافات الزائدة - البحث في جميع البيانات
        if (searchTerm && searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            filtered = filtered.filter(employee =>
                // ✅ البحث في جميع الحقول: الاسم، الكود، الرقم، الوظيفة، الإدارة، الفرع، الموقع، إلخ
                (employee.name && employee.name.toLowerCase().includes(term)) ||
                (employee.employeeNumber && String(employee.employeeNumber).toLowerCase().includes(term)) ||
                (employee.sapId && String(employee.sapId).toLowerCase().includes(term)) ||
                (employee.department && employee.department.toLowerCase().includes(term)) ||
                (employee.position && employee.position.toLowerCase().includes(term)) ||
                (employee.job && employee.job.toLowerCase().includes(term)) ||
                (employee.branch && employee.branch.toLowerCase().includes(term)) ||
                (employee.location && employee.location.toLowerCase().includes(term)) ||
                (employee.nationalId && employee.nationalId.toLowerCase().includes(term)) ||
                (employee.phone && employee.phone.toLowerCase().includes(term)) ||
                (employee.insuranceNumber && employee.insuranceNumber.toLowerCase().includes(term)) ||
                (employee.email && employee.email.toLowerCase().includes(term)) ||
                (employee.gender && employee.gender.toLowerCase().includes(term))
            );
        }
        
        // ✅ تطبيق الفلاتر الإضافية
        if (filters.department) {
            filtered = filtered.filter(e => String(e.department || '').trim() === String(filters.department).trim());
        }
        if (filters.branch) {
            filtered = filtered.filter(e => String(e.branch || '').trim() === String(filters.branch).trim());
        }
        if (filters.location) {
            filtered = filtered.filter(e => String(e.location || '').trim() === String(filters.location).trim());
        }
        if (filters.job) {
            filtered = filtered.filter(e => String(e.job || '').trim() === String(filters.job).trim());
        }
        if (filters.position) {
            filtered = filtered.filter(e => String(e.position || '').trim() === String(filters.position).trim());
        }
        if (filters.gender) {
            filtered = filtered.filter(e => String(e.gender || '').trim() === String(filters.gender).trim());
        }

        // استخدام DocumentFragment لتقليل reflow
        const fragment = document.createDocumentFragment();
        
        // عدد الأعمدة: 13 (12 أعمدة بيانات + عمود الإجراءات)
        const colSpan = 13;
        
        if (filtered.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="${colSpan}" class="text-center text-gray-500 py-8">لا توجد نتائج</td>`;
            fragment.appendChild(tr);
        } else {
            filtered.forEach(employee => {
                const birthDate = this.formatDateSafe(employee.birthDate);
                const hireDate = this.formatDateSafe(employee.hireDate);
                const age = this.calculateAge(employee.birthDate);
                
                // ✅ تحديد إذا كان الموظف غير نشط (مستقيل)
                const isInactive = this.isEmployeeInactive(employee);
                const rowStyle = isInactive ? 'opacity: 0.7; background-color: #f8f9fa;' : '';
                
                const tr = document.createElement('tr');
                if (isInactive) {
                    tr.style.cssText = rowStyle;
                }
                const fPhotoSrc = this._normalizeEmployeePhotoUrl(employee.photo, employee.id);
                const fDriveId = this._getDriveIdFromUrl(employee.photo || '');
                const fPhotoKey = (fDriveId || employee.id || employee.employeeNumber || employee.name || '').toString();
                const fDisp = fPhotoSrc && typeof Utils.resolveDriveAwareImgDisplay === 'function'
                    ? Utils.resolveDriveAwareImgDisplay(fPhotoSrc)
                    : { canonical: fPhotoSrc || '', displaySrc: fPhotoSrc || '', needsProxy: false, proxyFileId: '' };
                const fImgSrc = fDisp.canonical ? fDisp.displaySrc : '';
                const fProxyAttr = typeof Utils.driveProxyImgAttrs === 'function' ? Utils.driveProxyImgAttrs(fDisp) : '';
                tr.innerHTML = `
                    <td style="word-wrap: break-word;">
                        ${fPhotoSrc ? `<img data-emp-photo="1" data-photo-key="${Utils.escapeHTML(fPhotoKey)}" src="${Utils.escapeHTML(fImgSrc)}" alt="${Utils.escapeHTML(employee.name || '')}"${fProxyAttr} class="w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>`}
                    </td>
                    <td style="word-wrap: break-word; white-space: normal;">
                        ${Utils.escapeHTML(employee.employeeNumber || '')}
                        ${isInactive ? '<span class="badge badge-warning ml-2" style="font-size: 10px; padding: 2px 6px;">غير نشط</span>' : ''}
                    </td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 200px;">
                        ${Utils.escapeHTML(employee.name || '')}
                        ${isInactive && employee.resignationDate ? `<br><span class="text-xs text-gray-500" style="font-size: 11px;">استقال: ${this.formatDateSafe(employee.resignationDate)}</span>` : ''}
                    </td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 150px;">${Utils.escapeHTML(employee.department || '')}</td>
                    <td style="word-wrap: break-word; white-space: normal; max-width: 150px;">${Utils.escapeHTML(employee.job || employee.position || '')}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.nationalId || '')}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${birthDate || ''}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${age ? age + ' سنة' : ''}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${hireDate || ''}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.gender || '')}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.phone || '')}</td>
                    <td style="word-wrap: break-word; white-space: normal;">${Utils.escapeHTML(employee.insuranceNumber || '')}</td>
                    ${canEditOrDelete ? `
                    <td style="min-width: 150px;">
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="Employees.viewEmployee('${employee.id}')" class="btn-icon btn-icon-info" title="عرض">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="Employees.editEmployee('${employee.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="Employees.deactivateEmployee('${employee.id}')" class="btn-icon btn-icon-danger" title="إلغاء تفعيل">
                                <i class="fas fa-user-slash"></i>
                            </button>
                        </div>
                    </td>
                    ` : `
                    <td>
                        <span class="text-gray-400 text-sm">—</span>
                    </td>
                    `}
                `;
                fragment.appendChild(tr);
            });
        }

        // تحديث DOM مرة واحدة فقط لتقليل reflow
        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        if (typeof Utils.hydrateDriveProxyImages === 'function') {
            Utils.hydrateDriveProxyImages(tbody, {
                onFetchFail: (img) => {
                    try {
                        const key = (img.dataset.photoKey || '').trim();
                        if (key) sessionStorage.setItem(this._photoFailKey(key), Date.now().toString());
                    } catch (e) { /* ignore */ }
                    try {
                        const parent = img.parentElement;
                        if (parent) {
                            parent.innerHTML = '<div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center"><i class="fas fa-user text-gray-400"></i></div>';
                        }
                    } catch (e2) { /* ignore */ }
                }
            });
        }
        
        // ✅ تحديث شارات العد على الفلاتر النشطة (مشابه لـ DailyObservations)
        this.updateFilterBadges(employees, filtered, filters);
        
            // ✅ إضافة visual feedback: عرض عدد النتائج في Console (للتحقق)
            if (AppState.debugMode && searchTerm) {
                Utils.safeLog(`🔍 نتائج البحث: ${filtered.length} من ${employees.length} موظف`);
            }
        } catch (error) {
            // معالجة الأخطاء بشكل صحيح
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في filterEmployees:', error);
            } else {
                console.error('❌ خطأ في filterEmployees:', error);
            }
        }
    },
    
    /**
     * تحديث شارات العد على الفلاتر النشطة (مشابه لـ DailyObservations)
     */
    updateFilterBadges(allEmployees, filteredEmployees, filters) {
        try {
            // ✅ التأكد من وجود filters
            if (!filters) {
                if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ updateFilterBadges: filters غير موجودة');
                }
                return;
            }
            
            // دالة مساعدة لإزالة شارة موجودة وإضافة شارة جديدة
            const updateFilterLabel = (filterId, filterValue, filteredCount) => {
                try {
                    const filterElement = document.getElementById(filterId);
                    if (!filterElement) {
                        if (AppState.debugMode && filterValue) {
                            Utils.safeWarn(`⚠️ updateFilterLabel: ${filterId} غير موجود`);
                        }
                        return;
                    }
                    
                    // البحث عن label المرتبط بهذا الفلتر
                    const filterField = filterElement.closest('.filter-field');
                    if (!filterField) {
                        if (AppState.debugMode && filterValue) {
                            Utils.safeWarn(`⚠️ updateFilterLabel: filter-field غير موجود لـ ${filterId}`);
                        }
                        return;
                    }
                    
                    const label = filterField.querySelector('.filter-label');
                    if (!label) {
                        if (AppState.debugMode && filterValue) {
                            Utils.safeWarn(`⚠️ updateFilterLabel: filter-label غير موجود لـ ${filterId}`);
                        }
                        return;
                    }
                    
                    // إزالة الشارة الموجودة إن وجدت
                    const existingBadge = label.querySelector('.filter-count-badge');
                    if (existingBadge) {
                        existingBadge.remove();
                    }
                    
                    // إذا كان الفلتر نشطاً، إضافة الشارة
                    if (filterValue && filterValue.trim() !== '') {
                        const badge = document.createElement('span');
                        badge.className = 'filter-count-badge';
                        badge.title = 'عدد النتائج المفلترة';
                        badge.textContent = filteredCount;
                        
                        // إدراج الشارة بعد الأيقونة
                        const icon = label.querySelector('i');
                        if (icon) {
                            icon.insertAdjacentElement('afterend', badge);
                        } else {
                            label.insertBefore(badge, label.firstChild);
                        }
                        
                        if (AppState.debugMode) {
                            Utils.safeLog(`✅ تم إضافة شارة العدد (${filteredCount}) لـ ${filterId}`);
                        }
                    }
                } catch (error) {
                    // تجاهل الأخطاء في تحديث الشارات
                    if (AppState.debugMode) {
                        Utils.safeWarn('خطأ في تحديث شارة الفلتر:', error);
                    }
                }
            };
        
        // تحديث كل فلتر
        if (filters.department) {
            updateFilterLabel('employee-filter-department', filters.department, filteredEmployees.length);
        } else {
            updateFilterLabel('employee-filter-department', '', 0);
        }
        
        if (filters.branch) {
            updateFilterLabel('employee-filter-branch', filters.branch, filteredEmployees.length);
        } else {
            updateFilterLabel('employee-filter-branch', '', 0);
        }
        
        if (filters.location) {
            updateFilterLabel('employee-filter-location', filters.location, filteredEmployees.length);
        } else {
            updateFilterLabel('employee-filter-location', '', 0);
        }
        
        if (filters.job) {
            updateFilterLabel('employee-filter-job', filters.job, filteredEmployees.length);
        } else {
            updateFilterLabel('employee-filter-job', '', 0);
        }
        
        if (filters.position) {
            updateFilterLabel('employee-filter-position', filters.position, filteredEmployees.length);
        } else {
            updateFilterLabel('employee-filter-position', '', 0);
        }
        
        if (filters.gender) {
            updateFilterLabel('employee-filter-gender', filters.gender, filteredEmployees.length);
        } else {
            updateFilterLabel('employee-filter-gender', '', 0);
        }
        
            // ✅ تحديث شارة البحث إذا كان هناك نص بحث
            if (filters.search && filters.search.trim()) {
                try {
                    const searchInput = document.getElementById('employees-search-filter') || document.getElementById('employees-search');
                    if (searchInput) {
                        const filterField = searchInput.closest('.filter-field');
                        if (filterField) {
                            const label = filterField.querySelector('.filter-label');
                            if (label) {
                                const existingBadge = label.querySelector('.filter-count-badge');
                                if (existingBadge) {
                                    existingBadge.remove();
                                }
                                
                                const badge = document.createElement('span');
                                badge.className = 'filter-count-badge';
                                badge.title = 'عدد النتائج المفلترة';
                                badge.textContent = filteredEmployees.length;
                                
                                const icon = label.querySelector('i');
                                if (icon) {
                                    icon.insertAdjacentElement('afterend', badge);
                                } else {
                                    label.insertBefore(badge, label.firstChild);
                                }
                            }
                        }
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('خطأ في تحديث شارة البحث:', error);
                    }
                }
            } else {
                // إزالة شارة البحث إذا لم يكن هناك نص
                try {
                    const searchInput = document.getElementById('employees-search-filter') || document.getElementById('employees-search');
                    if (searchInput) {
                        const filterField = searchInput.closest('.filter-field');
                        if (filterField) {
                            const label = filterField.querySelector('.filter-label');
                            if (label) {
                                const existingBadge = label.querySelector('.filter-count-badge');
                                if (existingBadge) {
                                    existingBadge.remove();
                                }
                            }
                        }
                    }
                } catch (error) {
                    if (AppState.debugMode) {
                        Utils.safeWarn('خطأ في إزالة شارة البحث:', error);
                    }
                }
            }
        } catch (error) {
            // تجاهل الأخطاء في تحديث الشارات
            if (AppState.debugMode) {
                Utils.safeError('خطأ في updateFilterBadges:', error);
            }
        }
    },
    
    /**
     * تطبيق جميع الفلاتر
     */
    async applyFilters() {
        try {
            const filters = this.getFilterValues();
            await this.filterEmployees(filters.search, filters.showInactive, filters);
            // ✅ تحديث عدد المستقيلين بعد تطبيق الفلاتر
            this.updateInactiveCount();
        } catch (error) {
            // معالجة الأخطاء بشكل صحيح
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في applyFilters:', error);
            } else {
                console.error('❌ خطأ في applyFilters:', error);
            }
        } finally {
            // ✅ تحديث عدد المستقيلين دائماً بعد تطبيق الفلاتر
            this.updateInactiveCount();
        }
    },
    
    /**
     * إعادة تعيين جميع الفلاتر
     */
    async resetFilters() {
        // إعادة تعيين حقل البحث
        const searchInput = document.getElementById('employees-search');
        const filterSearchInput = document.getElementById('employees-search-filter');
        if (searchInput) searchInput.value = '';
        if (filterSearchInput) filterSearchInput.value = '';
        
        // إعادة تعيين جميع الفلاتر
        const filterSelects = [
            'employee-filter-department',
            'employee-filter-branch',
            'employee-filter-location',
            'employee-filter-job',
            'employee-filter-position',
            'employee-filter-gender'
        ];
        
        filterSelects.forEach(filterId => {
            const select = document.getElementById(filterId);
            if (select) {
                select.value = '';
            }
        });
        
        // إعادة تعيين checkbox المستقيلين
        const showInactiveCheckbox = document.getElementById('show-inactive-employees');
        if (showInactiveCheckbox) {
            showInactiveCheckbox.checked = false;
        }
        
        // ✅ إعادة تعيين مظهر الزر
        const container = document.getElementById('show-inactive-employees-container');
        if (container) {
            container.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
            container.style.borderColor = '#dee2e6';
            container.style.boxShadow = 'none';
        }
        
        // تطبيق الفلاتر (جميعها فارغة)
        await this.applyFilters();
        
        // ✅ تحديث عدد المستقيلين بعد إعادة التعيين
        this.updateInactiveCount();
    },
    
    /**
     * تحديث عدد المستقيلين في الزر
     * @param {number} retryCount - عدد محاولات إعادة المحاولة (داخلي)
     */
    updateInactiveCount(retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 100; // مللي ثانية
        
        const doUpdate = () => {
            try {
                const employees = AppState.appData.employees || [];
                const inactiveCount = employees.filter(e => this.isEmployeeInactive(e)).length;
                
                const countBadge = document.getElementById('inactive-employees-count');
                if (countBadge) {
                    // ✅ تحديث المحتوى
                    countBadge.textContent = inactiveCount;
                    
                    // ✅ لون الشارة: رمادي عند 0 (محايد)، أحمر عند وجود مستقيلين
                    const isZero = inactiveCount === 0;
                    const bgColor = isZero ? '#6b7280' : '#dc2626';
                    const boxShadow = isZero ? '0 2px 4px rgba(107, 114, 128, 0.3)' : '0 2px 4px rgba(220, 38, 38, 0.3)';
                    countBadge.style.cssText = `
                        display: inline-flex !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        align-items: center;
                        justify-content: center;
                        min-width: 24px;
                        height: 22px;
                        padding: 0 8px;
                        background: ${bgColor};
                        color: white;
                        border-radius: 11px;
                        font-size: 11px;
                        font-weight: 700;
                        margin-right: 4px;
                        box-shadow: ${boxShadow};
                        transition: all 0.3s ease;
                    `;
                    
                    // ✅ تطبيق تأثير خاص إذا كان checkbox مفعل (عرض المستقيلين)
                    const checkbox = document.getElementById('show-inactive-employees');
                    if (checkbox && checkbox.checked && !isZero) {
                        countBadge.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                        countBadge.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.4)';
                        countBadge.style.transform = 'scale(1.1)';
                    } else {
                        countBadge.style.transform = 'scale(1)';
                    }
                    
                    if (AppState.debugMode) {
                        Utils.safeLog(`📊 عدد المستقيلين: ${inactiveCount}`);
                    }
                } else if (retryCount < maxRetries) {
                    // ✅ إذا لم يوجد العنصر، إعادة المحاولة بعد تأخير
                    if (AppState.debugMode) {
                        Utils.safeLog(`⏳ العنصر غير موجود، إعادة المحاولة ${retryCount + 1}/${maxRetries}...`);
                    }
                    setTimeout(() => {
                        this.updateInactiveCount(retryCount + 1);
                    }, retryDelay);
                } else if (AppState.debugMode) {
                    Utils.safeWarn('⚠️ تعذر العثور على عنصر عداد المستقيلين بعد عدة محاولات');
                }
            } catch (error) {
                if (AppState.debugMode) {
                    Utils.safeWarn('خطأ في تحديث عدد المستقيلين:', error);
                }
            }
        };
        
        // ✅ استخدام requestAnimationFrame لضمان أن الـ DOM جاهز
        if (retryCount === 0) {
            requestAnimationFrame(doUpdate);
        } else {
            doUpdate();
        }
    },

    /**
     * تهيئة الموديول - تحميل البيانات عند بدء التطبيق
     * يمكن استدعاؤها من خارج الموديول لضمان تحميل البيانات
     */
    async init() {
        try {
            // التحقق من وجود البيانات المحلية
            const hasLocalData = AppState.appData.employees && 
                                Array.isArray(AppState.appData.employees) && 
                                AppState.appData.employees.length > 0;

            // إذا كانت البيانات موجودة، تحديث Cache
            if (hasLocalData) {
                this.cache.data = AppState.appData.employees;
                this.cache.lastLoad = Date.now();
                this.cache.lastUpdate = Date.now();
                
                if (AppState.debugMode) {
                    Utils.safeLog(`✅ تم تهيئة بيانات الموظفين من البيانات المحلية (${this.cache.data.length} موظف)`);
                }
            } else {
                // إذا لم تكن البيانات موجودة، محاولة تحميلها
                await this.ensureEmployeesLoaded();
            }

            // بدء التحديث التلقائي في الخلفية
            this.startBackgroundUpdate();
        } catch (error) {
            if (AppState.debugMode) {
                Utils.safeError('❌ خطأ في تهيئة موديول الموظفين:', error);
            }
        }
    }
};

// دالة مساعدة لتوليد كود ISO للنماذج
function generateISOCode(prefix, dataArray) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = (dataArray || []).length + 1;
    return `${prefix}-${year}${month}-${String(count).padStart(4, '0')}`;
}

Employees.getExternalWorkforceExportHeaderInfo = function (reportTitle, exportDate = new Date()) {
    const companyName = String(AppState?.companySettings?.name || AppState?.companyName || 'Americana HSE Management System').trim();
    const secondaryName = String(AppState?.companySettings?.secondaryName || 'إدارة السلامة والصحة المهنية والبيئة').trim();
    const exportDateTime = (typeof Utils !== 'undefined' && typeof Utils.formatDateTime === 'function')
        ? Utils.formatDateTime(exportDate)
        : new Date(exportDate).toISOString().slice(0, 19).replace('T', ' ');
    return { companyName, secondaryName, reportTitle, exportDateTime };
};

Employees.buildExternalWorkforceExcelWorksheet = function (header, rows, reportTitle, exportDate = new Date()) {
    const info = this.getExternalWorkforceExportHeaderInfo(reportTitle, exportDate);
    const tableRows = [header, ...rows];
    const columnCount = Math.max(...tableRows.map(row => Array.isArray(row) ? row.length : 0), 1);
    const aoa = [
        [info.companyName],
        [info.secondaryName],
        [info.reportTitle],
        [`Generated: ${info.exportDateTime}`],
        [],
        ...tableRows
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: columnCount - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: columnCount - 1 } }
    ];
    worksheet['!cols'] = [{ wch: 28 }, { wch: 14 }].concat(new Array(Math.max(columnCount - 3, 0)).fill({ wch: 14 }), [{ wch: 16 }]);
    return worksheet;
};

Employees.exportExternalWorkforceToExcel = function () {
    if (typeof XLSX === 'undefined') {
        Notification.error('XLSX library is not available');
        return;
    }

    const { model, header, rows } = this.getExternalWorkforceExportRows();
    const reportTitle = `${this.getExternalWorkforceViewState().labels.externalTab} - ${model.year}`;
    const workbook = XLSX.utils.book_new();
    const worksheet = this.buildExternalWorkforceExcelWorksheet(header, rows, reportTitle, new Date());
    XLSX.utils.book_append_sheet(workbook, worksheet, 'External Workforce');
    XLSX.writeFile(workbook, `external_workforce_${model.year}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

Employees.exportExternalWorkforceToPDF = function () {
    const { model, header, rows } = this.getExternalWorkforceExportRows();
    const viewState = this.getExternalWorkforceViewState();
    const reportTitle = `${viewState.labels.externalTab} - ${model.year}`;
    const exportDate = new Date().toISOString();
    const tableRows = [header, ...rows].map((row, index) => `
        <tr>
            ${row.map(cell => `<${index === 0 ? 'th' : 'td'}>${Utils.escapeHTML(String(cell ?? ''))}</${index === 0 ? 'th' : 'td'}>`).join('')}
        </tr>
    `).join('');

    const content = `
        <style>
            .external-workforce-report {
                direction: ${viewState.dir};
                font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
            }
            .external-workforce-report__meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                margin-bottom: 18px;
                padding: 12px 16px;
                border: 1px solid #D7E3F1;
                border-radius: 12px;
                background: #F8FBFF;
                font-size: 13px;
                color: #334155;
            }
            .external-workforce-report__meta strong {
                color: #0F172A;
            }
            .external-workforce-report__table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                direction: ${viewState.dir};
            }
            .external-workforce-report__table th,
            .external-workforce-report__table td {
                border: 1px solid #334155;
                padding: 8px 6px;
                text-align: center;
                font-size: 11px;
                word-break: break-word;
            }
            .external-workforce-report__table th {
                background: #B7D2EA;
                color: #102A43;
                font-weight: 700;
            }
            .external-workforce-report__table td:first-child,
            .external-workforce-report__table th:first-child {
                font-weight: 700;
                background: #DCEAF7;
            }
            @media print {
                .external-workforce-report__meta {
                    break-inside: avoid;
                }
            }
        </style>
        <div class="external-workforce-report" dir="${viewState.dir}" lang="${viewState.lang}">
            <div class="external-workforce-report__meta">
                <div><strong>${Utils.escapeHTML(viewState.labels.year)}:</strong> ${Utils.escapeHTML(String(model.year))}</div>
                <div><strong>${Utils.escapeHTML(viewState.labels.externalTab)}</strong></div>
                <div><strong>${Utils.escapeHTML(viewState.labels.totalHoursYtd || 'YTD Hours')}:</strong> ${Utils.escapeHTML(String(model.hoursYtd || 0))}</div>
            </div>
            <table class="external-workforce-report__table">${tableRows}</table>
        </div>
    `;

    const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
        ? FormHeader.generatePDFHTML(
            `EXT-WORKFORCE-${model.year}`,
            reportTitle,
            content,
            false,
            true,
            {
                version: '1.0',
                releaseDate: exportDate,
                revisionDate: exportDate,
                includeQRCode: true
            },
            exportDate,
            exportDate
        )
        : `<!DOCTYPE html><html lang="${viewState.lang}" dir="${viewState.dir}"><head><meta charset="UTF-8"><title>${Utils.escapeHTML(reportTitle)}</title></head><body style="font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;direction:${viewState.dir};padding:20px;">${content}</body></html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
        URL.revokeObjectURL(url);
        Notification.error('تعذر فتح نافذة الطباعة');
        return;
    }

    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 400);
    };
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Employees !== 'undefined') {
            window.Employees = Employees;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Employees module loaded and available on window.Employees');
            }
            
            // تهيئة الموديول عند تحميل الصفحة (إذا كان المستخدم مسجل دخول)
            if (typeof AppState !== 'undefined' && AppState.currentUser) {
                // تأخير بسيط لضمان تحميل جميع المتطلبات
                setTimeout(() => {
                    if (window.Employees && window.Employees.init) {
                        window.Employees.init().catch(error => {
                            if (AppState.debugMode) {
                                Utils.safeWarn('⚠️ فشل تهيئة موديول الموظفين:', error);
                            }
                        });
                    }
                }, 2000); // تأخير 2 ثانية لضمان تحميل جميع المتطلبات
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Employees:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Employees !== 'undefined') {
            try {
                window.Employees = Employees;
            } catch (e) {
                console.error('❌ فشل تصدير Employees:', e);
            }
        }
    }
})();
