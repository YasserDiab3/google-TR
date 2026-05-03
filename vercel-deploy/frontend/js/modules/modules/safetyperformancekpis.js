/**
 * SafetyPerformanceKPIs Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Safety Performance KPIs Module (مؤشرات الأداء لإدارة السلامة) =====
const SafetyPerformanceKPIs = {
    filters: {
        period: 'monthly', // monthly, quarterly, yearly
        department: '',
        location: '',
        startDate: '',
        endDate: ''
    },
    kpiTargets: {},
    activeTab: 'overview',
    scorecardYear: new Date().getFullYear(),
    _isAdminUser: false,
    _lockNonAdminView: false,
    _scorecardSourceDataLoaded: false,
    _scorecardSourceDataPromise: null,
    _scorecardWatchStarted: false,
    _scorecardWatchInterval: null,
    _scorecardRefreshTimer: null,
    _lastScorecardSignature: '',
    _scorecardCache: new Map(),
    _chartScorecardUiState: {
        group: 'all',
        months: 12,
        compact: false,
        search: '',
        chartType: 'line'
    },
    _chartScorecardCharts: [],

    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('safety-performance-kpis-section');

        // التحقق من الصلاحيات - فقط للمدير
        const isAdmin = (() => {
            if (typeof Permissions?.isCurrentUserAdmin === 'function') {
                try {
                    return Permissions.isCurrentUserAdmin();
                } catch (error) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                        Utils.safeWarn('⚠️ تعذر تحديد صلاحيات المستخدم عبر Permissions.isCurrentUserAdmin:', error);
                    } else {
                        console.warn('⚠️ تعذر تحديد صلاحيات المستخدم عبر Permissions.isCurrentUserAdmin:', error);
                    }
                }
            }
            return (AppState.currentUser?.role || '').toLowerCase() === 'admin';
        })();

        this._isAdminUser = isAdmin;
        if (!isAdmin && this._lockNonAdminView) {
            // لا تترك الواجهة فارغة (مهم لاختبار AppTester)
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
                                <p class="text-gray-500">${SafetyPerformanceKPIs._t('module.kpi.noPermission','ليس لديك صلاحية للوصول إلى هذا القسم')}</p>
                                <p class="text-sm text-gray-400 mt-2">${SafetyPerformanceKPIs._t('module.kpi.noPermissionRedirect','سيتم تحويلك إلى لوحة التحكم')}</p>
                            </div>
                        </div>
                    </div>
                `;
                SafetyPerformanceKPIs.applyModuleI18n(section);
            }
            Notification.error(SafetyPerformanceKPIs._t('module.kpi.noPermission','ليس لديك صلاحية للوصول إلى هذا القسم'));
            UI.showSection('dashboard');
            return;
        }

        if (!section) {
            const msg = SafetyPerformanceKPIs._t('module.kpi.notif.sectionNotFound', 'عنصر safety-performance-kpis-section غير موجود');
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError(msg);
            } else {
                console.error(msg);
            }
            return;
        }

        try {
            // Skeleton فوري قبل أي render قد يكون بطيئاً
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-gauge-high ml-3"></i>
                            ${SafetyPerformanceKPIs._t('module.kpi.title', 'مؤشرات الأداء لإدارة السلامة')}
                        </h1>
                        <p class="section-subtitle">${SafetyPerformanceKPIs._t('module.common.loading', 'جاري التحميل...')}</p>
                    </div>
                </div>
                <div class="content-card mt-6">
                    <div class="card-body">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">${SafetyPerformanceKPIs._t('module.kpi.loading', 'جاري تجهيز الواجهة...')}</p>
                        </div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(section);

            // تحميل الأهداف المحفوظة
            this.loadKPITargets();
            const scorecardSourceDataPromise = this.ensureScorecardSourceData().catch(error => {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('تعذر تحميل مصادر بيانات السكور كارد في الخلفية:', error);
                }
                return null;
            });

            // تحميل المحتوى بشكل آمن مع timeout محسّن
            let content = '';
            try {
                const contentPromise = this.render();
                content = await Utils.promiseWithTimeout(
                    contentPromise,
                    10000,
                    () => new Error('Timeout: render took too long')
                );
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                } else {
                    console.warn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                }
                // عرض محتوى افتراضي مع إمكانية إعادة المحاولة
                content = `
                    <div class="section-header">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-gauge-high ml-3"></i>
                                ${SafetyPerformanceKPIs._t('module.kpi.title', 'مؤشرات الأداء لإدارة السلامة')}
                            </h1>
                        </div>
                    </div>
                    <div class="content-card mt-6">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">${SafetyPerformanceKPIs._t('module.kpi.loadError', 'حدث خطأ في تحميل البيانات')}</p>
                                <button onclick="SafetyPerformanceKPIs.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${SafetyPerformanceKPIs._t('module.kpi.retry', 'إعادة المحاولة')}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }

            section.innerHTML = content;
            this.applyModuleI18n(section);
            this.enhanceWithScorecardTab(section);
            this.applyModuleI18n(section);
            
            // تهيئة الأحداث بعد عرض الواجهة
            try {
                this.setupEventListeners();
                this.startScorecardAutoRefresh();
                
                // تحديث KPIs فوراً بعد عرض الواجهة (حتى لو كانت البيانات فارغة)
                // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
                try {
                    // استخدام setTimeout بسيط لضمان أن DOM جاهز
                    setTimeout(() => {
                        this.updateAllKPIs();
                    }, 0);
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في updateAllKPIs الأولي:', error);
                }
                
                // تحديث KPIs بعد تحميل البيانات من Backend (للتحديث)
                setTimeout(() => {
                    try {
                        this.updateAllKPIs();
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في updateAllKPIs:', error);
                    }
                }, 100);

                scorecardSourceDataPromise.then(() => {
                    try {
                        this._scorecardCache.clear();
                        this.populateScorecardYearSelector();
                        this.queueScorecardRefresh(true);
                        this.updateAllKPIs();
                    } catch (error) {
                        if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                            Utils.safeWarn('تعذر تحديث السكور كارد بعد اكتمال تحميل المصادر:', error);
                        }
                    }
                });
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في setupEventListeners:', error);
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول مؤشرات الأداء:', error);
            const unk = SafetyPerformanceKPIs._t('module.kpi.unknownError', 'خطأ غير معروف');
            section.innerHTML = `
                <div class="section-header">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-gauge-high ml-3"></i>
                            ${SafetyPerformanceKPIs._t('module.kpi.title', 'مؤشرات الأداء لإدارة السلامة')}
                        </h1>
                    </div>
                </div>
                <div class="mt-6">
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-2">${SafetyPerformanceKPIs._t('module.kpi.loadError', 'حدث خطأ أثناء تحميل البيانات')}</p>
                                <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : unk}</p>
                                <button onclick="SafetyPerformanceKPIs.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${SafetyPerformanceKPIs._t('module.kpi.retry', 'إعادة المحاولة')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            SafetyPerformanceKPIs.applyModuleI18n(section);
        }
    },

    _t(key, fallback = '') {
        try {
            const core = window.AppI18n || window.I18n;
            if (core && typeof core.t === 'function') {
                const val = core.t(key);
                return (val && val !== key) ? val : (fallback || key);
            }
        } catch (_) {}
        return fallback || key;
    },

    applyModuleI18n(root) {
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyModuleI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyModuleI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        const target = root || document.getElementById('safety-performance-kpis-section') || document;
        i18nCore.applyModuleI18n(target);
    },

    /** أسماء أشهر مختصرة حسب اللغة (لرؤوس الجداول) */
    getMonthAbbreviations() {
        const keys = [
            'module.kpi.month.jan', 'module.kpi.month.feb', 'module.kpi.month.mar', 'module.kpi.month.apr',
            'module.kpi.month.may', 'module.kpi.month.jun', 'module.kpi.month.jul', 'module.kpi.month.aug',
            'module.kpi.month.sep', 'module.kpi.month.oct', 'module.kpi.month.nov', 'module.kpi.month.dec'
        ];
        const fallbacks = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return keys.map((k, i) => this._t(k, fallbacks[i]));
    },

    renderOverviewTab() {
        const t = (k, f) => this._t(k, f);
        const isRTL = (window.AppI18n?.getCurrentLang?.() || window.I18n?.getCurrentLang?.() || 'ar') === 'ar';
        const iconMargin = isRTL ? 'ml-2' : 'mr-2';
        return `
            <!-- ===================== HERO SUMMARY BAR ===================== -->
            <div class="mt-4" style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1d4ed8 100%);border-radius:16px;padding:1.5rem 1.75rem;box-shadow:0 8px 32px rgba(15,23,42,.35);">
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1rem;align-items:stretch;">
                    <!-- Days Without Incident -->
                    <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:1rem;text-align:center;position:relative;overflow:hidden;">
                        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#22c55e,#86efac);border-radius:12px 12px 0 0;"></div>
                        <div style="width:42px;height:42px;margin:0 auto .75rem;background:rgba(34,197,94,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-shield-alt" style="color:#4ade80;font-size:1.1rem;"></i>
                        </div>
                        <div id="hero-days-without" style="font-size:2rem;font-weight:900;color:#fff;line-height:1;margin-bottom:.25rem;">-</div>
                        <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${t('module.kpi.hero.daysWithout','أيام بدون حوادث')}</div>
                        <div style="font-size:.68rem;color:#64748b;margin-top:.25rem;">${t('module.kpi.hero.ytd','حتى الآن')}</div>
                    </div>
                    <!-- Total Incidents -->
                    <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:1rem;text-align:center;position:relative;overflow:hidden;">
                        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ef4444,#fca5a5);border-radius:12px 12px 0 0;"></div>
                        <div style="width:42px;height:42px;margin:0 auto .75rem;background:rgba(239,68,68,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-exclamation-triangle" style="color:#f87171;font-size:1.1rem;"></i>
                        </div>
                        <div id="hero-total-incidents" style="font-size:2rem;font-weight:900;color:#fff;line-height:1;margin-bottom:.25rem;">-</div>
                        <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${t('module.kpi.hero.totalIncidents','إجمالي الحوادث')}</div>
                        <div style="font-size:.68rem;color:#64748b;margin-top:.25rem;">${t('module.kpi.hero.thisMonth','هذا الشهر')}</div>
                    </div>
                    <!-- LTIFR -->
                    <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:1rem;text-align:center;position:relative;overflow:hidden;">
                        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f97316,#fdba74);border-radius:12px 12px 0 0;"></div>
                        <div style="width:42px;height:42px;margin:0 auto .75rem;background:rgba(249,115,22,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-sync-alt" style="color:#fb923c;font-size:1.1rem;"></i>
                        </div>
                        <div id="hero-ltifr" style="font-size:2rem;font-weight:900;color:#fff;line-height:1;margin-bottom:.25rem;">-</div>
                        <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${t('module.kpi.hero.ltifr','معدل LTIFR')}</div>
                        <div style="font-size:.68rem;color:#64748b;margin-top:.25rem;">${t('module.kpi.hero.ytd','حتى الآن')}</div>
                    </div>
                    <!-- Training Rate -->
                    <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:1rem;text-align:center;position:relative;overflow:hidden;">
                        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#a5b4fc);border-radius:12px 12px 0 0;"></div>
                        <div style="width:42px;height:42px;margin:0 auto .75rem;background:rgba(99,102,241,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-graduation-cap" style="color:#818cf8;font-size:1.1rem;"></i>
                        </div>
                        <div id="hero-training-rate" style="font-size:2rem;font-weight:900;color:#fff;line-height:1;margin-bottom:.25rem;">-</div>
                        <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${t('module.kpi.hero.trainingRate','معدل التدريب')}</div>
                        <div style="font-size:.68rem;color:#64748b;margin-top:.25rem;">${t('module.kpi.hero.thisMonth','هذا الشهر')}</div>
                    </div>
                    <!-- Open PTW -->
                    <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:1rem;text-align:center;position:relative;overflow:hidden;">
                        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#06b6d4,#67e8f9);border-radius:12px 12px 0 0;"></div>
                        <div style="width:42px;height:42px;margin:0 auto .75rem;background:rgba(6,182,212,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;">
                            <i class="fas fa-id-card" style="color:#22d3ee;font-size:1.1rem;"></i>
                        </div>
                        <div id="hero-open-ptw" style="font-size:2rem;font-weight:900;color:#fff;line-height:1;margin-bottom:.25rem;">-</div>
                        <div style="font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">${t('module.kpi.hero.openPTW','تصاريح مفتوحة')}</div>
                        <div style="font-size:.68rem;color:#64748b;margin-top:.25rem;">${t('module.kpi.hero.thisMonth','هذا الشهر')}</div>
                    </div>
                </div>
            </div>

            <!-- ===================== FILTERS ===================== -->
            <div class="content-card mt-5" style="border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.06);">
                <div class="card-header" style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;border-radius:14px 14px 0 0;">
                    <h2 class="card-title" style="color:#374151;">
                        <i class="fas fa-sliders-h ${iconMargin}" style="color:#6366f1;"></i>
                        ${t('module.kpi.filter.title','التصفية والبحث')}
                    </h2>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.period','الفترة الزمنية')}</label>
                            <select id="kpi-filter-period" class="form-input">
                                <option value="monthly">${t('module.kpi.filter.monthly','شهري')}</option>
                                <option value="quarterly">${t('module.kpi.filter.quarterly','ربع سنوي')}</option>
                                <option value="yearly">${t('module.kpi.filter.yearly','سنوي')}</option>
                                <option value="custom">${t('module.kpi.filter.custom','مخصص')}</option>
                            </select>
                        </div>
                        <div id="kpi-custom-dates" class="hidden">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.fromDate','من تاريخ')}</label>
                            <input type="date" id="kpi-filter-start-date" class="form-input">
                        </div>
                        <div id="kpi-custom-dates-end" class="hidden">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.toDate','إلى تاريخ')}</label>
                            <input type="date" id="kpi-filter-end-date" class="form-input">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.department','الإدارة')}</label>
                            <select id="kpi-filter-department" class="form-input">
                                <option value="">${t('module.kpi.filter.allDepartments','جميع الإدارات')}</option>
                                ${this.getDepartmentOptions()}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.location','الموقع')}</label>
                            <select id="kpi-filter-location" class="form-input">
                                <option value="">${t('module.kpi.filter.allLocations','جميع المواقع')}</option>
                                ${this.getLocationOptions()}
                            </select>
                        </div>
                    </div>
                    <div class="mt-4 flex gap-2 flex-wrap">
                        <button id="kpi-apply-filters" class="btn-primary" style="gap:.4rem;">
                            <i class="fas fa-search ${iconMargin}"></i>
                            ${t('module.kpi.filter.apply','تطبيق التصفية')}
                        </button>
                        <button id="kpi-reset-filters" class="btn-secondary">
                            <i class="fas fa-redo ${iconMargin}"></i>
                            ${t('module.kpi.filter.reset','إعادة تعيين')}
                        </button>
                    </div>
                </div>
            </div>

            <!-- ===================== LEADING INDICATORS ===================== -->
            <div class="mt-5">
                <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(5,150,105,.1);border:1px solid #a7f3d0;">
                    <div style="background:linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%);padding:1.1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
                        <div>
                            <h2 style="color:#fff;font-size:1.05rem;font-weight:700;margin:0;display:flex;align-items:center;gap:.5rem;">
                                <span style="background:rgba(255,255,255,.15);padding:.3rem .5rem;border-radius:8px;"><i class="fas fa-arrow-trend-up" style="color:#6ee7b7;"></i></span>
                                ${t('module.kpi.leading.title','المؤشرات الاستباقية')}
                                <span style="font-size:.7rem;background:rgba(110,231,183,.2);color:#6ee7b7;border:1px solid rgba(110,231,183,.3);border-radius:20px;padding:.15rem .6rem;font-weight:600;">${t('module.kpi.leading.badge','استباقي')}</span>
                            </h2>
                            <p style="color:#a7f3d0;font-size:.78rem;margin:.3rem 0 0;">${t('module.kpi.leading.subtitle','مؤشرات تقيس أداء الوقاية والتحكم قبل وقوع الحوادث')}</p>
                        </div>
                        <div id="leading-score-badge" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:.4rem .9rem;text-align:center;display:none;">
                            <div style="font-size:1.2rem;font-weight:900;color:#fff;" id="leading-score-value">-</div>
                            <div style="font-size:.65rem;color:#a7f3d0;font-weight:600;">${t('module.kpi.leading.overallScore','النقاط الإجمالية')}</div>
                        </div>
                    </div>
                    <div style="background:#f0fdf4;padding:1.25rem;">
                        <div id="leading-indicators-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${this.renderLeadingIndicators()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===================== LAGGING INDICATORS ===================== -->
            <div class="mt-5">
                <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(185,28,28,.1);border:1px solid #fecaca;">
                    <div style="background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 50%,#b91c1c 100%);padding:1.1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
                        <div>
                            <h2 style="color:#fff;font-size:1.05rem;font-weight:700;margin:0;display:flex;align-items:center;gap:.5rem;">
                                <span style="background:rgba(255,255,255,.15);padding:.3rem .5rem;border-radius:8px;"><i class="fas fa-arrow-trend-down" style="color:#fca5a5;"></i></span>
                                ${t('module.kpi.lagging.title','المؤشرات التراجعية')}
                                <span style="font-size:.7rem;background:rgba(252,165,165,.2);color:#fca5a5;border:1px solid rgba(252,165,165,.3);border-radius:20px;padding:.15rem .6rem;font-weight:600;">${t('module.kpi.lagging.badge','تراجعي')}</span>
                            </h2>
                            <p style="color:#fecaca;font-size:.78rem;margin:.3rem 0 0;">${t('module.kpi.lagging.subtitle','مؤشرات تقيس النتائج الفعلية لما حدث')}</p>
                        </div>
                    </div>
                    <div style="background:#fff5f5;padding:1.25rem;">
                        <div id="lagging-indicators-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            ${this.renderLaggingIndicators()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===================== CHARTS GRID ===================== -->
            <div class="mt-5">
                <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;">
                    <span style="background:linear-gradient(135deg,#6366f1,#8b5cf6);width:4px;height:24px;border-radius:2px;display:inline-block;"></span>
                    <h2 style="font-size:1.1rem;font-weight:700;color:#1e293b;margin:0;">
                        <i class="fas fa-chart-bar ${iconMargin}" style="color:#6366f1;"></i>
                        ${t('module.kpi.chart.title','الرسوم البيانية والتحليلات')}
                    </h2>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <!-- Incidents Chart -->
                    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(239,68,68,.1);border:1px solid #fee2e2;">
                        <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);padding:.85rem 1.1rem;border-bottom:1px solid #fecaca;display:flex;align-items:center;gap:.6rem;">
                            <span style="background:#ef4444;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                            <h3 style="font-size:.88rem;font-weight:700;color:#991b1b;margin:0;">
                                <i class="fas fa-chart-bar ${iconMargin}"></i>
                                ${t('module.kpi.chart.incidents','الحوادث والإصابات الشهرية')}
                            </h3>
                        </div>
                        <div style="padding:1rem;">
                            <div id="incidents-chart-container" style="height:280px;"></div>
                        </div>
                    </div>
                    <!-- Dept Distribution Chart -->
                    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(59,130,246,.1);border:1px solid #bfdbfe;">
                        <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);padding:.85rem 1.1rem;border-bottom:1px solid #bfdbfe;display:flex;align-items:center;gap:.6rem;">
                            <span style="background:#3b82f6;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                            <h3 style="font-size:.88rem;font-weight:700;color:#1e40af;margin:0;">
                                <i class="fas fa-chart-pie ${iconMargin}"></i>
                                ${t('module.kpi.chart.deptDistribution','توزيع الحوادث حسب الإدارة')}
                            </h3>
                        </div>
                        <div style="padding:1rem;">
                            <div id="department-chart-container" style="height:280px;"></div>
                        </div>
                    </div>
                    <!-- LTIFR Chart -->
                    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(139,92,246,.1);border:1px solid #ddd6fe;">
                        <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe);padding:.85rem 1.1rem;border-bottom:1px solid #ddd6fe;display:flex;align-items:center;gap:.6rem;">
                            <span style="background:#8b5cf6;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                            <h3 style="font-size:.88rem;font-weight:700;color:#5b21b6;margin:0;">
                                <i class="fas fa-chart-line ${iconMargin}"></i>
                                ${t('module.kpi.chart.ltifr','معدل LTIFR عبر الزمن')}
                            </h3>
                        </div>
                        <div style="padding:1rem;">
                            <div id="trir-chart-container" style="height:280px;"></div>
                        </div>
                    </div>
                    <!-- Training Chart -->
                    <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(16,185,129,.1);border:1px solid #a7f3d0;">
                        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:.85rem 1.1rem;border-bottom:1px solid #a7f3d0;display:flex;align-items:center;gap:.6rem;">
                            <span style="background:#10b981;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                            <h3 style="font-size:.88rem;font-weight:700;color:#065f46;margin:0;">
                                <i class="fas fa-chart-area ${iconMargin}"></i>
                                ${t('module.kpi.chart.training','معدل الالتزام بالتدريب')}
                            </h3>
                        </div>
                        <div style="padding:1rem;">
                            <div id="training-chart-container" style="height:280px;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===================== DEPARTMENT COMPARISON ===================== -->
            <div class="mt-5" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid #e2e8f0;">
                <div style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);padding:.85rem 1.1rem;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:.6rem;">
                    <span style="background:#0f172a;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                    <h3 style="font-size:.88rem;font-weight:700;color:#0f172a;margin:0;">
                        <i class="fas fa-balance-scale ${iconMargin}"></i>
                        ${t('module.kpi.chart.deptComparison','مقارنة بين الإدارات / المواقع')}
                    </h3>
                </div>
                <div style="padding:1rem;">
                    <div id="department-comparison-container" style="height:380px;"></div>
                </div>
            </div>

            <!-- ===================== HEATMAP ===================== -->
            <div class="mt-5 mb-2" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid #e2e8f0;">
                <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:.85rem 1.1rem;border-bottom:1px solid #475569;display:flex;align-items:center;gap:.6rem;">
                    <span style="background:#f59e0b;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                    <h3 style="font-size:.88rem;font-weight:700;color:#f1f5f9;margin:0;">
                        <i class="fas fa-th ${iconMargin}"></i>
                        ${t('module.kpi.chart.heatmap','خريطة الحرارة - أداء السلامة حسب الإدارة والموقع')}
                    </h3>
                </div>
                <div style="padding:1rem;">
                    <div id="heatmap-container"></div>
                </div>
            </div>
        `;
    },

    switchTab(tabName) {
        this.activeTab = tabName;
        this.load();
    },

    renderAnnualPlanTab() {
        const t = (k, f) => this._t(k, f);
        const months = this.getMonthAbbreviations();
        const years = this.getScorecardYearRange();
        const currentYear = new Date().getFullYear();
        const isReadOnly = (typeof window !== 'undefined' && typeof window.isReadOnlyRole === 'function') 
            ? window.isReadOnlyRole() 
            : false;
        const canEdit = !isReadOnly && (this.isAdminUser() || (typeof Permissions !== 'undefined' && Permissions.hasAccess('kpi-annual-plan')));
        
        return `
            <div class="content-card">
                <div class="card-header bg-gradient-to-r from-blue-50 to-indigo-50 border-b-4 border-blue-600">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-calendar-alt text-blue-600 text-2xl"></i>
                            <div>
                                <h2 class="card-title text-blue-800">
                                    ${t('module.kpi.annual.title','مؤشرات الأداء (KPIs) - الخطة السنوية')}
                                </h2>
                                <p class="text-sm text-blue-700 mt-1">${t('module.kpi.annual.subtitle','الخطة السنوية لمؤشرات الأداء مع المتابعة الشهرية')}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 items-center flex-wrap">
                            <select id="kpi-annual-year-selector" class="form-input" style="min-width: 100px;">
                                ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                            <button onclick="SafetyPerformanceKPIs.exportAnnualPlanToExcel()" class="btn-success" style="padding: 0.5rem 0.75rem; white-space: nowrap;" title="${t('module.kpi.exportExcel','تصدير Excel')}">
                                <i class="fas fa-file-excel"></i>
                                <span class="hidden lg:inline mr-1">${t('module.kpi.common.excel','Excel')}</span>
                            </button>
                            <button onclick="SafetyPerformanceKPIs.exportAnnualPlanToPDF()" class="btn-secondary" style="padding: 0.5rem 0.75rem; white-space: nowrap;" title="${t('module.kpi.exportPDF','تصدير PDF')}">
                                <i class="fas fa-file-pdf"></i>
                                <span class="hidden lg:inline mr-1">PDF</span>
                            </button>
                            ${canEdit ? `
                            <button onclick="SafetyPerformanceKPIs.addKPIAnnualPlan()" class="btn-primary" style="padding: 0.5rem 1.25rem; white-space: nowrap; min-width: 180px; font-weight: 600;">
                                <i class="fas fa-plus ml-2"></i>
                                ${t('module.kpi.annual.addKPI','إضافة مؤشر جديد')}
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="card-body" style="overflow-x: auto;">
                    <table class="kpi-annual-plan-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 90px;">${t('module.kpi.annual.col.type','النوع')}</th>
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 120px;">${t('module.kpi.annual.col.objective','OBJECTIVE')}</th>
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 150px;">${t('module.kpi.annual.col.kpi','KPI')}</th>
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 120px;">${t('module.kpi.annual.col.target','TARGET')}</th>
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px;">${t('module.kpi.annual.col.goal','GOAL')}</th>
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 250px;">${t('module.kpi.annual.col.improvement','IMPROVEMENT PLAN')}</th>
                                ${months.map(m => `<th style="padding: 12px 4px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 50px; background: #3b82f6;">${m}</th>`).join('')}
                                <th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px; background: #f97316;">${t('module.kpi.annual.col.total','Total')}</th>
                                ${canEdit ? `<th style="padding: 12px 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 100px;">${t('module.kpi.annual.col.actions','Actions')}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody id="kpi-annual-plan-body">
                            <tr>
                                <td colspan="21" style="padding: 40px; text-align: center; color: #6b7280;">
                                    <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
                                    <p>${t('module.kpi.annual.loading','جاري تحميل البيانات...')}</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Legend / Abbreviations -->
            <div class="content-card mt-6">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-info-circle ml-2"></i>
                        ${t('module.kpi.annual.abbrev','مفتاح الاختصارات')}
                    </h2>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div><strong>(1) HSE:</strong> ${t('module.kpi.annual.legendHse','الصحة والسلامة والبيئة')}</div>
                        <div><strong>(2) LTI:</strong> ${t('module.kpi.annual.legendLti','الإصابة المؤدية لانقطاع العمل')}</div>
                        <div><strong>(3) AIR:</strong> ${t('module.kpi.annual.legendAir','نسبة الحوادث')}</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderMonitoringPlanTab() {
        const t = (k, f) => this._t(k, f);
        const months = this.getMonthAbbreviations();
        const years = this.getScorecardYearRange();
        const currentYear = new Date().getFullYear();
        const isReadOnly = (typeof window !== 'undefined' && typeof window.isReadOnlyRole === 'function') 
            ? window.isReadOnlyRole() 
            : false;
        const canEdit = !isReadOnly && (this.isAdminUser() || (typeof Permissions !== 'undefined' && Permissions.hasAccess('hse-monitoring-plan')));
        const frequencies = [
            { key: 'Weekly', label: t('module.kpi.monitoring.freq.weekly','الأنشطة الأسبوعية'), icon: 'fa-calendar-week', color: 'yellow' },
            { key: 'Monthly', label: t('module.kpi.monitoring.freq.monthly','الأنشطة الشهرية'), icon: 'fa-calendar-alt', color: 'blue' },
            { key: 'Semi-Annually', label: t('module.kpi.monitoring.freq.semiAnnually','الأنشطة نصف السنوية'), icon: 'fa-calendar', color: 'purple' },
            { key: 'Annually', label: t('module.kpi.monitoring.freq.annually','الأنشطة السنوية'), icon: 'fa-calendar-check', color: 'green' }
        ];

        return `
            <div class="content-card">
                <div class="card-header bg-gradient-to-r from-green-50 to-emerald-50 border-b-4 border-green-600">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-clipboard-check text-green-600 text-2xl"></i>
                            <div>
                                <h2 class="card-title text-green-800">
                                    ${t('module.kpi.monitoring.title','خطة متابعة HSE')}
                                </h2>
                                <p class="text-sm text-green-700 mt-1">${t('module.kpi.monitoring.subtitle','خطة متابعة HSE - التنفيذ والمتابعة الشهرية')}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 items-center flex-wrap">
                            <select id="hse-monitoring-year-selector" class="form-input" style="min-width: 100px;">
                                ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                            <button onclick="SafetyPerformanceKPIs.exportMonitoringPlanToExcel()" class="btn-success" style="padding: 0.5rem 0.75rem; white-space: nowrap;" title="${t('module.kpi.monitoring.excelTitle','تصدير Excel')}">
                                <i class="fas fa-file-excel"></i>
                                <span class="hidden lg:inline mr-1">${t('module.kpi.common.excel','Excel')}</span>
                            </button>
                            <button onclick="SafetyPerformanceKPIs.exportMonitoringPlanToPDF()" class="btn-secondary" style="padding: 0.5rem 0.75rem; white-space: nowrap;" title="${t('module.kpi.exportPDF','تصدير PDF')}">
                                <i class="fas fa-file-pdf"></i>
                                <span class="hidden lg:inline mr-1">PDF</span>
                            </button>
                            ${canEdit ? `
                            <button onclick="SafetyPerformanceKPIs.addHSEMonitoringPlan()" class="btn-primary" style="padding: 0.5rem 1.25rem; white-space: nowrap; min-width: 180px; font-weight: 600;">
                                <i class="fas fa-plus ml-2"></i>
                                ${t('module.kpi.monitoring.addActivity','إضافة نشاط جديد')}
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    ${frequencies.map(freq => `
                        <div class="mb-8">
                            <div class="bg-${freq.color}-50 border-l-4 border-${freq.color}-500 p-4 mb-4 rounded-lg">
                                <h3 class="text-lg font-bold text-${freq.color}-800">
                                    <i class="fas ${freq.icon} ml-2"></i>
                                    ${freq.label}
                                </h3>
                            </div>
                            <div style="overflow-x: auto;">
                                <table class="hse-monitoring-table" style="width: 100%; border-collapse: collapse; font-size: 10px;">
                                    <thead>
                                        <tr style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 100px;">${t('module.kpi.monitoring.col.activity','النشاط')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 120px;">${t('module.kpi.monitoring.col.description','وصف النشاط')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px;">${t('module.kpi.monitoring.col.area','المنطقة')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px;">${t('module.kpi.monitoring.col.frequency','التكرار')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 100px;">${t('module.kpi.monitoring.col.responsibility','المسؤولية')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 100px;">${t('module.kpi.monitoring.col.record','وثيقة التسجيل')}</th>
                                            ${months.map(m => `<th style="padding: 10px 4px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 60px; background: #3b82f6;" title="${t('module.kpi.monitoring.hintTarget','مستهدف')}">${m}T</th>`).join('')}
                                            ${months.map(m => `<th style="padding: 10px 4px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 60px; background: #10b981;" title="${t('module.kpi.monitoring.hintExecuted','منفذ')}">${m}E</th>`).join('')}
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px; background: #f97316;">${t('module.kpi.monitoring.col.totalTarget','الإجمالي المستهدف')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px; background: #10b981;">${t('module.kpi.monitoring.col.totalExecuted','الإجمالي المنفذ')}</th>
                                            <th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 80px; background: #8b5cf6;">${t('module.kpi.monitoring.col.score','النسبة %')}</th>
                                            ${canEdit ? `<th style="padding: 10px 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; min-width: 100px;">${t('module.kpi.monitoring.col.actions','الإجراءات')}</th>` : ''}
                                        </tr>
                                    </thead>
                                    <tbody id="hse-monitoring-${freq.key.toLowerCase().replace('-', '')}-body">
                                        <tr>
                                            <td colspan="30" style="padding: 30px; text-align: center; color: #6b7280;">
                                                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                                                <p>${t('module.kpi.monitoring.loading','جاري تحميل البيانات...')}</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderLeadingIndicators() {
        const t = (k, f) => this._t(k, f);
        return `
            ${this.renderKPICard('inspection-tours', t('module.kpi.leading.inspectionTours','الجولات التفتيشية المنفذة'), 'inspection-tours', 'fa-walking', '#2563eb', '#dbeafe', t('module.kpi.unit.tour','جولة'))}
            ${this.renderKPICard('observations-recorded', t('module.kpi.leading.observations','الملاحظات المسجلة والمعالجة'), 'observations', 'fa-clipboard-list', '#4f46e5', '#e0e7ff', t('module.kpi.unit.observation','ملاحظة'))}
            ${this.renderKPICard('corrective-actions-closure', t('module.kpi.leading.actionsClosure','نسبة إغلاق الإجراءات التصحيحية'), 'actions-closure', 'fa-check-double', '#059669', '#d1fae5', '%')}
            ${this.renderKPICard('training-courses', t('module.kpi.leading.trainingCourses','الدورات التدريبية المنفذة'), 'training-courses', 'fa-graduation-cap', '#0d9488', '#ccfbf1', t('module.kpi.unit.course','دورة'))}
            ${this.renderKPICard('training-attendance', t('module.kpi.leading.trainingAttendance','نسبة حضور الموظفين للتدريب'), 'training-attendance', 'fa-users', '#0284c7', '#e0f2fe', '%')}
            ${this.renderKPICard('ptw-approved', t('module.kpi.leading.ptwApproved','تصاريح العمل المعتمدة والمنفذة'), 'ptw-approved', 'fa-id-card', '#7c3aed', '#ede9fe', t('module.kpi.unit.permit','تصريح'))}
            ${this.renderKPICard('ppe-compliance', t('module.kpi.leading.ppeCompliance','نسبة الالتزام باستخدام معدات الوقاية'), 'ppe-compliance', 'fa-hard-hat', '#d97706', '#fef3c7', '%')}
            ${this.renderKPICard('periodic-inspections-on-time', t('module.kpi.leading.inspectionsOnTime','الفحوصات الدورية المنجزة في الموعد'), 'inspections-on-time', 'fa-calendar-check', '#16a34a', '#dcfce7', t('module.kpi.unit.inspection','فحص'))}
            ${this.renderKPICard('safety-meetings', t('module.kpi.leading.safetyMeetings','عدد الاجتماعات والتوعيات الخاصة بالسلامة'), 'safety-meetings', 'fa-handshake', '#0369a1', '#e0f2fe', t('module.kpi.unit.meeting','اجتماع'))}
        `;
    },

    renderLaggingIndicators() {
        const t = (k, f) => this._t(k, f);
        return `
            ${this.renderKPICard('total-injuries', t('module.kpi.lagging.totalInjuries','عدد الإصابات المسجلة'), 'injuries', 'fa-user-injured', '#dc2626', '#fee2e2', t('module.kpi.unit.injury','إصابة'))}
            ${this.renderKPICard('lti-count', t('module.kpi.lagging.ltiCount','عدد الإصابات المؤدية لتوقف عن العمل'), 'lti', 'fa-bed', '#b91c1c', '#fee2e2', t('module.kpi.unit.injury','إصابة'))}
            ${this.renderKPICard('ltifr', t('module.kpi.lagging.ltifr','معدل تكرار الإصابات (LTIFR)'), 'ltifr', 'fa-sync-alt', '#ea580c', '#ffedd5', '')}
            ${this.renderKPICard('severity-rate', t('module.kpi.lagging.severityRate','معدل شدة الإصابات'), 'severity', 'fa-exclamation-circle', '#e11d48', '#ffe4e6', '%')}
            ${this.renderKPICard('near-miss-count', t('module.kpi.lagging.nearMissCount','عدد الحوادث الوشيكة المسجلة'), 'nearmiss-count', 'fa-eye', '#ca8a04', '#fef9c3', t('module.kpi.unit.incident','حادث'))}
            ${this.renderKPICard('fire-incidents', t('module.kpi.lagging.fireIncidents','عدد الحرائق أو الحوادث في معدات الإطفاء'), 'fire-incidents', 'fa-fire', '#c2410c', '#ffedd5', t('module.kpi.unit.incident','حادث'))}
            ${this.renderKPICard('lost-days', t('module.kpi.lagging.lostDays','عدد الأيام المهدورة بسبب الإصابات'), 'lost-days', 'fa-calendar-times', '#9f1239', '#ffe4e6', t('module.kpi.unit.day','يوم'))}
            ${this.renderKPICard('accident-cost', t('module.kpi.lagging.accidentCost','تكلفة الحوادث'), 'accident-cost', 'fa-dollar-sign', '#991b1b', '#fee2e2', t('module.kpi.unit.sar','ريال'))}
        `;
    },

    renderKPICard(id, label, type, icon, accentColor, bgColor, defaultUnit = '') {
        const t = (k, f) => this._t(k, f);
        const isLagging = ['injuries','lti','ltifr','severity','nearmiss-count','fire-incidents','lost-days','accident-cost'].includes(type);
        const borderColor = isLagging ? '#fca5a5' : '#bbf7d0';
        const headerBg = isLagging ? 'rgba(254,226,226,.5)' : 'rgba(220,252,231,.5)';
        return `
            <div style="background:#fff;border-radius:14px;border:1px solid ${borderColor};box-shadow:0 2px 10px rgba(0,0,0,.06);overflow:hidden;transition:box-shadow .2s,transform .2s;" 
                 onmouseover="this.style.boxShadow='0 8px 24px rgba(0,0,0,.13)';this.style.transform='translateY(-2px)';" 
                 onmouseout="this.style.boxShadow='0 2px 10px rgba(0,0,0,.06)';this.style.transform='translateY(0)';">
                <!-- Card Header -->
                <div style="background:${headerBg};border-bottom:1px solid ${borderColor};padding:.65rem .9rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
                    <div style="display:flex;align-items:center;gap:.55rem;flex:1;min-width:0;">
                        <div style="width:34px;height:34px;border-radius:9px;background:${bgColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.1);">
                            <i class="fas ${icon}" style="color:${accentColor};font-size:.9rem;"></i>
                        </div>
                        <div style="min-width:0;">
                            <h3 style="font-size:.75rem;font-weight:700;color:#1e293b;margin:0;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${label}">${label}</h3>
                            <p style="font-size:.65rem;color:#64748b;margin:.1rem 0 0;" id="${id}-period">${t('module.kpi.card.thisMonth','هذا الشهر')}</p>
                        </div>
                    </div>
                    <div id="${id}-status" style="display:none;width:8px;height:8px;border-radius:50%;background:#d1d5db;flex-shrink:0;"></div>
                </div>
                <!-- Card Body -->
                <div style="padding:.85rem .9rem;">
                    <!-- Value + Unit -->
                    <div style="display:flex;align-items:baseline;gap:.35rem;margin-bottom:.6rem;">
                        <span id="${id}-value" style="font-size:1.95rem;font-weight:900;color:#0f172a;line-height:1;">-</span>
                        <span id="${id}-unit" style="font-size:.85rem;font-weight:600;color:#64748b;">${defaultUnit}</span>
                    </div>
                    <!-- Target Row -->
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem;">
                        <span style="font-size:.7rem;color:#64748b;font-weight:600;">${t('module.kpi.card.target','الهدف:')}</span>
                        <span id="${id}-target" style="font-size:.7rem;font-weight:700;color:#374151;">-</span>
                    </div>
                    <!-- Progress Bar -->
                    <div>
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem;">
                            <span style="font-size:.68rem;color:#64748b;font-weight:600;">${t('module.kpi.card.achievement','نسبة الإنجاز')}</span>
                            <span id="${id}-progress" style="font-size:.7rem;font-weight:800;color:${accentColor};">-</span>
                        </div>
                        <div style="width:100%;background:#f1f5f9;border-radius:99px;height:6px;overflow:hidden;">
                            <div id="${id}-progress-bar" style="height:6px;border-radius:99px;width:0%;background:${accentColor};transition:width .6s ease;"></div>
                        </div>
                    </div>
                    <!-- Trend -->
                    <div id="${id}-trend" style="margin-top:.55rem;display:flex;align-items:center;gap:.35rem;font-size:.68rem;color:#94a3b8;">
                        <i class="fas fa-minus"></i>
                        <span>${t('module.kpi.card.noChange','لا يوجد تغيير')}</span>
                    </div>
                </div>
            </div>
        `;
    },

    getDepartmentOptions() {
        const departments = new Set();
        const data = AppState.appData;

        // من الحوادث
        (data.incidents || []).forEach(inc => {
            if (inc.affectedDepartment) departments.add(inc.affectedDepartment);
        });

        // من الملاحظات
        (data.dailyObservations || []).forEach(obs => {
            if (obs.department) departments.add(obs.department);
        });

        // من إعدادات الشركة
        const settingsDepts = AppState.companySettings?.formDepartments || [];
        settingsDepts.forEach(dept => departments.add(dept));

        return Array.from(departments).sort().map(dept =>
            `<option value="${Utils.escapeHTML(dept)}">${Utils.escapeHTML(dept)}</option>`
        ).join('');
    },

    getLocationOptions() {
        const locations = new Set();
        const data = AppState.appData;

        (data.incidents || []).forEach(inc => {
            if (inc.location) locations.add(inc.location);
        });

        (data.nearmiss || []).forEach(nm => {
            if (nm.location) locations.add(nm.location);
        });

        return Array.from(locations).sort().map(loc =>
            `<option value="${Utils.escapeHTML(loc)}">${Utils.escapeHTML(loc)}</option>`
        ).join('');
    },

    isAdminUser() {
        if (this._isAdminUser === true) return true;
        if (typeof Permissions?.isCurrentUserAdmin === 'function') {
            try {
                return Permissions.isCurrentUserAdmin();
            } catch (error) {
                return (AppState.currentUser?.role || '').toLowerCase() === 'admin';
            }
        }
        return (AppState.currentUser?.role || '').toLowerCase() === 'admin';
    },

    getScorecardMonths() {
        return [
            { index: 0, key: '01', label: 'January' },
            { index: 1, key: '02', label: 'February' },
            { index: 2, key: '03', label: 'March' },
            { index: 3, key: '04', label: 'April' },
            { index: 4, key: '05', label: 'May' },
            { index: 5, key: '06', label: 'June' },
            { index: 6, key: '07', label: 'July' },
            { index: 7, key: '08', label: 'August' },
            { index: 8, key: '09', label: 'September' },
            { index: 9, key: '10', label: 'October' },
            { index: 10, key: '11', label: 'November' },
            { index: 11, key: '12', label: 'December' }
        ];
    },

    getScorecardManualRecords() {
        if (!AppState.appData || typeof AppState.appData !== 'object') AppState.appData = {};
        if (!Array.isArray(AppState.appData.safetyPerformanceKPIs)) {
            AppState.appData.safetyPerformanceKPIs = [];
        }
        return AppState.appData.safetyPerformanceKPIs;
    },

    getScorecardYearRange() {
        const years = new Set([this.scorecardYear, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]);
        this.getScorecardManualRecords().forEach(record => {
            const year = Number(record?.year);
            if (Number.isFinite(year) && year > 2000) years.add(year);
        });
        (AppState.appData?.externalWorkforceMonthly || []).forEach(record => {
            const year = Number(record?.year);
            if (Number.isFinite(year) && year > 2000) years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    },

    parseScorecardDate(value) {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    },

    createMonthlyArray(defaultValue = 0) {
        return new Array(12).fill(defaultValue);
    },

    currentYtdLimit(year) {
        const now = new Date();
        return year === now.getFullYear() ? now.getMonth() : 11;
    },

    isFutureMonth(year, monthIndex) {
        const now = new Date();
        return year > now.getFullYear() || (year === now.getFullYear() && monthIndex > now.getMonth());
    },

    getCollectionVersion(list = []) {
        if (!Array.isArray(list) || list.length === 0) return '0';
        let max = 0;
        list.forEach(item => {
            const date = this.parseScorecardDate(item?.updatedAt || item?.createdAt || item?.date || item?.startDate || item?.visitDate || item?.injuryDate);
            if (date) max = Math.max(max, date.getTime());
        });
        return `${list.length}:${max}`;
    },

    getScorecardSignature() {
        const data = AppState.appData || {};
        const keys = [
            'incidents',
            'nearmiss',
            'ptw',
            'ptwRegistry',
            'training',
            'trainingAttendance',
            'trainingCertificates',
            'contractorTrainings',
            'clinicVisits',
            'sickLeave',
            'injuries',
            'employees',
            'externalWorkforceMonthly',
            'safetyPerformanceKPIs'
        ];
        const parts = keys.map(key => `${key}:${this.getCollectionVersion(data[key] || [])}`);
        parts.push(`year:${this.scorecardYear}`);
        return parts.join('|');
    },

    async ensureScorecardSourceData() {
        if (this._scorecardSourceDataLoaded) return;
        if (this._scorecardSourceDataPromise) {
            await this._scorecardSourceDataPromise;
            return;
        }

        const data = AppState.appData || (AppState.appData = {});
        const tasks = [];
        const readSheet = (sheetName, key) => {
            if (Array.isArray(data[key]) && data[key].length > 0) return;
            if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.readFromSheets !== 'function') return;
            tasks.push(
                GoogleIntegration.readFromSheets(sheetName, 15000)
                    .then(result => {
                        if (Array.isArray(result)) data[key] = result;
                    })
                    .catch(() => {})
            );
        };
        const requestData = (action, key) => {
            if (Array.isArray(data[key]) && data[key].length > 0) return;
            if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') return;
            tasks.push(
                GoogleIntegration.sendRequest({ action, data: {} })
                    .then(result => {
                        if (result?.success && Array.isArray(result.data)) data[key] = result.data;
                    })
                    .catch(() => {})
            );
        };

        readSheet('Incidents', 'incidents');
        readSheet('NearMiss', 'nearmiss');
        readSheet('PTW', 'ptw');
        readSheet('PTWRegistry', 'ptwRegistry');
        readSheet('ClinicVisits', 'clinicVisits');
        readSheet('SickLeave', 'sickLeave');
        readSheet('Injuries', 'injuries');
        readSheet('Employees', 'employees');
        readSheet('ExternalWorkforceMonthly', 'externalWorkforceMonthly');
        readSheet('SafetyPerformanceKPIs', 'safetyPerformanceKPIs');
        requestData('getAllTrainings', 'training');
        requestData('getAllTrainingAttendance', 'trainingAttendance');
        requestData('getAllTrainingCertificates', 'trainingCertificates');
        requestData('getAllContractorTrainings', 'contractorTrainings');

        this._scorecardSourceDataPromise = Promise.allSettled(tasks).finally(() => {
            this._scorecardSourceDataLoaded = true;
            this._scorecardSourceDataPromise = null;
        });

        await this._scorecardSourceDataPromise;
    },

    buildScorecardStyles() {
        return `
            <style id="safety-performance-scorecard-styles">
                .spk-tab-shell { margin-top: 1.5rem; }
                .spk-tab-bar { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
                .spk-tab-btn { border: 1px solid #dbeafe; background: #eff6ff; color: #1d4ed8; padding: 0.8rem 1.2rem; border-radius: 14px; font-weight: 700; transition: 0.2s ease; cursor: pointer; }
                .spk-tab-btn.active { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #fff; border-color: #0f172a; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18); }
                .spk-tab-panel.hidden { display: none; }
                .spk-scorecard-hero { background: linear-gradient(135deg, #fff7e6 0%, #ffffff 52%, #eff6ff 100%); border: 1px solid #e5e7eb; border-radius: 22px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08); }
                .spk-scorecard-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
                .spk-scorecard-eyebrow { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.04em; color: #1d4ed8; text-transform: uppercase; }
                .spk-scorecard-note { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }
                .spk-scorecard-note-chip { border-radius: 999px; padding: 0.45rem 0.8rem; font-size: 0.82rem; font-weight: 700; }
                .spk-chip-blue { background: #dbeafe; color: #1e40af; }
                .spk-chip-yellow { background: #fef3c7; color: #92400e; }
                .spk-scorecard-table-wrap { overflow: auto; border: 1px solid #d1d5db; border-radius: 18px; background: #fff; }
                .spk-scorecard-table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 0.82rem; direction: ltr; }
                .spk-scorecard-table th, .spk-scorecard-table td { border: 1px solid #1f2937; padding: 0.45rem 0.55rem; text-align: center; white-space: nowrap; }
                .spk-scorecard-table th:first-child, .spk-scorecard-table td:first-child { position: sticky; left: 0; z-index: 2; background: #fff; text-align: left; min-width: 255px; max-width: 255px; white-space: normal; }
                .spk-scorecard-table thead th:first-child { z-index: 4; }
                .spk-scorecard-table thead th { background: #ffffff; font-weight: 800; }
                .spk-scorecard-table .spk-ytd-head { color: #0ea5e9; font-weight: 800; }
                .spk-row-section td { background: #ffffff; border: 0; font-size: 1rem; font-weight: 800; color: #0369a1; text-align: left; padding: 1rem 0.5rem 0.35rem; }
                .spk-row-subsection td { background: #ffffff; border-left: 0; border-right: 0; font-weight: 800; color: #0f766e; text-align: left; padding-top: 0.55rem; padding-bottom: 0.35rem; }
                .spk-row-subsection .spk-subsection-ytd { text-align: center; color: #0ea5e9; font-weight: 800; }
                .spk-label-cell { font-weight: 600; direction: ltr; }
                .spk-cell-blue { background: #dceaf6; }
                .spk-cell-yellow { background: #fff6cf; }
                .spk-cell-neutral { background: #ffffff; }
                .spk-cell-manual { background: #dbeafe; box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.18); }
                .spk-manual-input, .spk-manual-select { width: 100%; min-width: 82px; border: 0; background: transparent; text-align: center; font-weight: 700; color: #1e3a8a; outline: none; }
                .spk-manual-input[disabled], .spk-manual-select[disabled] { color: #475569; cursor: default; }
                .spk-row-total td:first-child { font-weight: 800; }
                .spk-muted { color: #64748b; font-size: 0.78rem; margin-top: 0.75rem; }
                @media (max-width: 1024px) { .spk-scorecard-title { flex-direction: column; } .spk-scorecard-table { font-size: 0.76rem; } .spk-scorecard-table th:first-child, .spk-scorecard-table td:first-child { min-width: 210px; max-width: 210px; } }
                @media (max-width: 768px) { .spk-tab-btn { width: 100%; justify-content: center; } .spk-scorecard-hero { padding: 1rem; border-radius: 18px; } }
            </style>
        `;
    },

    renderScorecardShell() {
        const t = (k, f) => this._t(k, f);
        return `
            <div class="spk-scorecard-hero">
                <div class="spk-scorecard-title">
                    <div>
                        <div class="spk-scorecard-eyebrow">${t('module.kpi.scorecard.eyebrow', 'مصدر الحقيقة الواحد')}</div>
                        <h2 class="text-2xl font-black text-slate-900 mt-2">${t('module.kpi.scorecard.title', 'لوحة مؤشرات أداء السلامة')}</h2>
                        <p class="text-sm text-slate-600 mt-2">${t('module.kpi.scorecard.subtitle', 'لوحة شهرية مرتبطة بالحوادث والصحة المهنية والتصاريح والتدريب والملاحظات والموارد البشرية.')}</p>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="text-sm font-semibold text-slate-700" for="spk-scorecard-year">${t('module.kpi.scorecard.year', 'السنة')}</label>
                        <select id="spk-scorecard-year" class="form-input !w-auto min-w-[120px]"></select>
                    </div>
                </div>
                <div class="spk-scorecard-note">
                    <span class="spk-scorecard-note-chip spk-chip-blue">${t('module.kpi.scorecard.chipBlue', 'يُدخل فقط في الخلايا الزرقاء عند عدم توفر مصدر مباشر')}</span>
                    <span class="spk-scorecard-note-chip spk-chip-yellow">${t('module.kpi.scorecard.chipYellow', 'الخلايا الصفراء تُحسب تلقائياً')}</span>
                </div>
            </div>
            <div class="spk-scorecard-table-wrap">
                <div id="spk-scorecard-table-container"></div>
            </div>
            <p class="spk-muted">${t('module.kpi.scorecard.footer', 'تُحدَّث اللوحة تلقائياً عند فتح الصفحة وعند تغيّر البيانات المرتبطة.')}</p>
        `;
    },

    enhanceWithScorecardTab(section) {
        if (!section || section.querySelector('#spk-tab-overview')) {
            this.populateScorecardYearSelector();
            this.renderScorecardTable();
            this.applyScorecardAccessState();
            return;
        }

        section.insertAdjacentHTML('afterbegin', this.buildScorecardStyles());

        const header = section.querySelector('.section-header');
        if (!header) return;

        const t = (k, f) => this._t(k, f);
        // إضافة التبويبات الجديدة مع التبويبات الموجودة
        const tabShell = document.createElement('div');
        tabShell.className = 'spk-tab-shell';
        tabShell.innerHTML = `
            <div class="spk-tab-bar">
                <button type="button" id="spk-tab-overview" class="spk-tab-btn active" data-tab="overview">${t('module.kpi.tab.kpisOverview', 'نظرة عامة — KPIs')}</button>
                <button type="button" id="spk-tab-annual-plan" class="spk-tab-btn" data-tab="annual-plan">
                    <i class="fas fa-calendar-alt ml-1"></i>
                    ${t('module.kpi.tab.kpisAnnual', 'الخطة السنوية')}
                </button>
                <button type="button" id="spk-tab-monitoring-plan" class="spk-tab-btn" data-tab="monitoring-plan">
                    <i class="fas fa-clipboard-check ml-1"></i>
                    ${t('module.kpi.tab.hseMonitoring', 'خطة متابعة HSE')}
                </button>
                <button type="button" id="spk-tab-scorecard" class="spk-tab-btn" data-tab="scorecard">${t('module.kpi.tab.scorecard', 'لوحة مؤشرات أداء السلامة')}</button>
            </div>
        `;
        this.applyModuleI18n(tabShell);
        header.insertAdjacentElement('afterend', tabShell);

        const nodesToMove = [];
        let sibling = tabShell.nextSibling;
        while (sibling) {
            const next = sibling.nextSibling;
            nodesToMove.push(sibling);
            sibling = next;
        }

        // إنشاء لوحات التبويب الأربعة
        const overviewPanel = document.createElement('div');
        overviewPanel.id = 'spk-overview-panel';
        overviewPanel.className = 'spk-tab-panel';
        nodesToMove.forEach(node => overviewPanel.appendChild(node));

        // لوحة الخطة السنوية
        const annualPlanPanel = document.createElement('div');
        annualPlanPanel.id = 'spk-annual-plan-panel';
        annualPlanPanel.className = 'spk-tab-panel hidden';
        annualPlanPanel.innerHTML = this.renderAnnualPlanTab();
        this.applyModuleI18n(annualPlanPanel);

        // لوحة خطة المتابعة
        const monitoringPlanPanel = document.createElement('div');
        monitoringPlanPanel.id = 'spk-monitoring-plan-panel';
        monitoringPlanPanel.className = 'spk-tab-panel hidden';
        monitoringPlanPanel.innerHTML = this.renderMonitoringPlanTab();
        this.applyModuleI18n(monitoringPlanPanel);

        // لوحة السكور كارد
        const scorecardPanel = document.createElement('div');
        scorecardPanel.id = 'spk-scorecard-panel';
        scorecardPanel.className = 'spk-tab-panel hidden';
        scorecardPanel.innerHTML = this.renderScorecardShell();
        this.applyModuleI18n(scorecardPanel);

        section.appendChild(overviewPanel);
        section.appendChild(annualPlanPanel);
        section.appendChild(monitoringPlanPanel);
        section.appendChild(scorecardPanel);

        // ربط أحداث التبديل
        tabShell.querySelectorAll('.spk-tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab') || 'overview';
                this.switchScorecardTab(tabName);
            });
        });

        // إضافة event listener لقائمة السنوات في الخطة السنوية
        const annualYearSelector = document.getElementById('kpi-annual-year-selector');
        if (annualYearSelector) {
            annualYearSelector.addEventListener('change', () => {
                this.loadKPIAnnualPlans();
            });
        }

        // إضافة event listener لقائمة السنوات في خطة المتابعة
        const monitoringYearSelector = document.getElementById('hse-monitoring-year-selector');
        if (monitoringYearSelector) {
            monitoringYearSelector.addEventListener('change', () => {
                this.loadHSEMonitoringPlans();
            });
        }

        const yearSelect = scorecardPanel.querySelector('#spk-scorecard-year');
        if (yearSelect) {
            yearSelect.addEventListener('change', (event) => {
                const year = Number(event.target.value);
                if (Number.isFinite(year) && year > 2000) {
                    this.scorecardYear = year;
                    this.renderScorecardTable(true);
                }
            });
        }

        scorecardPanel.addEventListener('change', (event) => {
            const target = event.target;
            if (!target || !target.matches('[data-scorecard-manual]')) return;
            const metric = target.getAttribute('data-scorecard-manual') || '';
            const year = Number(target.getAttribute('data-year'));
            const month = Number(target.getAttribute('data-month'));
            this.saveScorecardManualValue(metric, year, month, target.value);
        });

        scorecardPanel.addEventListener('blur', (event) => {
            const target = event.target;
            if (!target || !target.matches('.spk-manual-input')) return;
            const metric = target.getAttribute('data-scorecard-manual') || '';
            const year = Number(target.getAttribute('data-year'));
            const month = Number(target.getAttribute('data-month'));
            this.saveScorecardManualValue(metric, year, month, target.value);
        }, true);

        this.populateScorecardYearSelector();
        this.applyScorecardAccessState();
        this.renderScorecardTable(true);
        this.applyModuleI18n(section);
    },

    switchScorecardTab(tab) {
        this.activeTab = tab;
        
        // تحديث أزرار التبويب
        document.querySelectorAll('.spk-tab-btn').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === tab);
        });

        // إظهار/إخفاء اللوحات
        const panels = {
            'overview': 'spk-overview-panel',
            'annual-plan': 'spk-annual-plan-panel',
            'monitoring-plan': 'spk-monitoring-plan-panel',
            'scorecard': 'spk-scorecard-panel'
        };

        Object.keys(panels).forEach(panelTab => {
            const panel = document.getElementById(panels[panelTab]);
            if (panel) {
                panel.classList.toggle('hidden', panelTab !== tab);
            }
        });

        // تحميل البيانات عند التبديل
        if (tab === 'annual-plan') {
            this.loadKPIAnnualPlans();
        } else if (tab === 'monitoring-plan') {
            this.loadHSEMonitoringPlans();
        } else if (tab === 'scorecard') {
            this.populateScorecardYearSelector();
            this.renderScorecardTable();
        }
    },

    populateScorecardYearSelector() {
        const select = document.getElementById('spk-scorecard-year');
        if (!select) return;
        select.innerHTML = this.getScorecardYearRange()
            .map(year => `<option value="${year}" ${year === this.scorecardYear ? 'selected' : ''}>${year}</option>`)
            .join('');
    },

    applyScorecardAccessState() {
        const canManage = this.isAdminUser();
        ['kpis-export-excel-btn', 'kpis-export-pdf-btn', 'kpis-settings-btn'].forEach(id => {
            const button = document.getElementById(id);
            if (!button) return;
            button.style.display = canManage ? '' : 'none';
            button.disabled = !canManage;
        });

        document.querySelectorAll('.spk-manual-input, .spk-manual-select').forEach(input => {
            input.disabled = !canManage;
        });
    },

    switchTab(tab) {
        this.activeTab = tab === 'scorecard' ? 'scorecard' : 'overview';
        const overview = document.getElementById('spk-overview-panel');
        const scorecard = document.getElementById('spk-scorecard-panel');
        document.querySelectorAll('.spk-tab-btn').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === this.activeTab);
        });
        overview?.classList.toggle('hidden', this.activeTab !== 'overview');
        scorecard?.classList.toggle('hidden', this.activeTab !== 'scorecard');
        if (this.activeTab === 'scorecard') {
            this.populateScorecardYearSelector();
            this.renderScorecardTable();
        }
    },

    queueScorecardRefresh(force = false) {
        clearTimeout(this._scorecardRefreshTimer);
        this._scorecardRefreshTimer = setTimeout(() => {
            if (document.getElementById('spk-scorecard-table-container')) {
                this.renderScorecardTable(force);
            }
        }, 80);
    },

    startScorecardAutoRefresh() {
        if (this._scorecardWatchStarted) return;
        this._scorecardWatchStarted = true;

        const refresh = (force = false) => this.queueScorecardRefresh(force);
        document.addEventListener('data-saved', () => refresh(true));
        document.addEventListener('ptw:updated', () => refresh(true));
        document.addEventListener('loginSuccess', () => refresh(true));
        window.addEventListener('syncDataCompleted', () => refresh(true));
        window.addEventListener('employeesDataUpdated', () => refresh(true));
        window.addEventListener('focus', () => refresh());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') refresh();
        });

        this._scorecardWatchInterval = window.setInterval(() => {
            if (!document.getElementById('spk-scorecard-table-container')) return;
            const signature = this.getScorecardSignature();
            if (signature !== this._lastScorecardSignature) this.renderScorecardTable();
        }, 3000);
    },

    isEmployeeInactiveRecord(employee = {}) {
        const status = String(employee?.status || employee?.employmentStatus || '').trim().toLowerCase();
        return status === 'inactive' || status === 'غير نشط';
    },

    getOperationalEmployeesForMonth(employees = [], year, monthIndex) {
        const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        return employees.filter(employee => {
            if (!employee) return false;
            const hireDate = this.parseScorecardDate(employee.hireDate || employee.startDate || employee.createdAt);
            const resignationDate = this.parseScorecardDate(employee.resignationDate || employee.terminationDate || employee.endDate);
            if (hireDate && hireDate > monthEnd) return false;
            if (resignationDate && resignationDate <= monthEnd) return false;
            if (this.isEmployeeInactiveRecord(employee) && !resignationDate) return false;
            return true;
        }).length;
    },

    getExternalWorkforceMonthKey(monthIndex) {
        return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][monthIndex] || '';
    },

    getExternalWorkforceForMonth(year, monthIndex) {
        const monthKey = this.getExternalWorkforceMonthKey(monthIndex);
        if (!monthKey) return 0;

        const Emp = typeof Employees !== 'undefined' ? Employees : (typeof window !== 'undefined' ? window.Employees : null);
        if (Emp && typeof Emp.getAvailableContractorsForExternalWorkforce === 'function' && typeof Emp.getExternalWorkforceRecord === 'function') {
            const contractors = Emp.getAvailableContractorsForExternalWorkforce();
            if (Array.isArray(contractors) && contractors.length > 0) {
                return contractors.reduce((sum, contractor) => {
                    const rec = Emp.getExternalWorkforceRecord(year, contractor.stableKey);
                    if (!rec) return sum;
                    const v = parseFloat(rec[monthKey]);
                    return sum + (Number.isFinite(v) && v >= 0 ? v : 0);
                }, 0);
            }
        }

        return (AppState.appData?.externalWorkforceMonthly || []).reduce((sum, record) => {
            if (!record || Number(record.year) !== Number(year)) return sum;
            return sum + (parseFloat(record[monthKey]) || 0);
        }, 0);
    },

    getContractorDerivedHoursForMonth(year, monthIndex) {
        const count = this.getExternalWorkforceForMonth(year, monthIndex);
        const derived = Number(count || 0) * 8 * 22;
        return parseFloat(derived.toFixed(2));
    },

    getManualScorecardRecord(year, monthIndex) {
        const month = String(monthIndex + 1).padStart(2, '0');
        return this.getScorecardManualRecords().find(record =>
            record &&
            record.recordType === 'scorecard-manual' &&
            Number(record.year) === Number(year) &&
            String(record.month).padStart(2, '0') === month
        );
    },

    getManualScorecardValue(metricKey, year, monthIndex) {
        const record = this.getManualScorecardRecord(year, monthIndex);
        return record ? record[metricKey] : undefined;
    },

    getHoursWorkedValue(year, monthIndex, employeesCount) {
        const manual = this.getManualScorecardValue('hoursWorked', year, monthIndex);
        if (manual !== undefined && manual !== null && String(manual).trim() !== '') {
            const parsed = parseFloat(manual);
            if (Number.isFinite(parsed)) return parsed;
        }

        const derived = Number(employeesCount || 0) * 8 * 22;
        return parseFloat(derived.toFixed(2));
    },

    getTextBag(record = {}) {
        const investigationTypes = Array.isArray(record?.investigation?.incidentTypes)
            ? record.investigation.incidentTypes.join(' ')
            : '';
        return [
            record?.incidentType,
            record?.type,
            record?.title,
            record?.description,
            record?.reason,
            record?.diagnosis,
            record?.visitType,
            record?.status,
            record?.name,
            record?.subject,
            record?.topic,
            record?.certificateName,
            investigationTypes
        ].filter(Boolean).join(' ').toLowerCase();
    },

    matchesNeboshRecord(record = {}) {
        const bag = this.getTextBag(record);
        return bag.includes('nebosh') || bag.includes('hse lead') || bag.includes('uae hse');
    },

    normalizeNeboshStatus(record = {}) {
        const text = this.getTextBag(record);
        if (text.includes('certified') || text.includes('valid') || text.includes('سارية') || text.includes('معتمد')) return 'Certified';
        if (text.includes('expired') || text.includes('منتهي')) return 'Expired';
        if (text.includes('progress') || text.includes('planned') || text.includes('مخطط') || text.includes('جاري')) return 'In Progress';
        return 'Certified';
    },

    getNeboshStatusForMonth(year, monthIndex) {
        const manual = this.getManualScorecardValue('neboshStatus', year, monthIndex);
        if (manual !== undefined && manual !== null && String(manual).trim() !== '') return String(manual).trim();

        const cutoff = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        const certificates = (AppState.appData.trainingCertificates || [])
            .filter(record => this.matchesNeboshRecord(record))
            .map(record => ({
                date: this.parseScorecardDate(record.expiryDate || record.issueDate || record.date || record.createdAt),
                status: this.normalizeNeboshStatus(record)
            }))
            .filter(item => item.date && item.date <= cutoff)
            .sort((a, b) => b.date - a.date);
        if (certificates.length > 0) return certificates[0].status;

        const trainings = (AppState.appData.training || [])
            .filter(record => this.matchesNeboshRecord(record))
            .map(record => ({
                date: this.parseScorecardDate(record.startDate || record.date || record.createdAt),
                status: (String(record.status || '').toLowerCase().includes('completed') || String(record.status || '').includes('مكتمل'))
                    ? 'Certified'
                    : 'In Progress'
            }))
            .filter(item => item.date && item.date <= cutoff)
            .sort((a, b) => b.date - a.date);

        return trainings.length > 0 ? trainings[0].status : '';
    },

    async saveScorecardManualValue(metricKey, year, monthIndex, rawValue) {
        if (!this.isAdminUser()) return;
        if (!metricKey || !Number.isFinite(year) || !Number.isFinite(monthIndex)) return;

        const month = String(monthIndex + 1).padStart(2, '0');
        const records = this.getScorecardManualRecords();
        let record = this.getManualScorecardRecord(year, monthIndex);

        if (!record) {
            record = {
                id: `SPK-${year}-${month}`,
                recordType: 'scorecard-manual',
                year,
                month,
                createdAt: new Date().toISOString()
            };
            records.push(record);
        }

        if (metricKey === 'hoursWorked') {
            const trimmed = String(rawValue ?? '').trim();
            if (!trimmed) {
                record.hoursWorked = '';
            } else {
                const permanent = parseFloat(trimmed);
                if (!Number.isFinite(permanent)) {
                    record.hoursWorked = '';
                } else {
                    const contractorH = this.getContractorDerivedHoursForMonth(year, monthIndex);
                    record.hoursWorked = parseFloat((Math.max(0, permanent) + contractorH).toFixed(2));
                }
            }
        } else {
            record[metricKey] = String(rawValue || '').trim();
        }

        record.updatedAt = new Date().toISOString();
        record.updatedBy = AppState.currentUser?.name || AppState.currentUser?.email || 'admin';

        this._scorecardCache.clear();
        this.renderScorecardTable(true);
        if (typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.autoSave === 'function') {
            GoogleIntegration.autoSave('SafetyPerformanceKPIs', records).catch(() => {});
        }
    },

    isLostTimeIncident(record = {}) {
        const bag = this.getTextBag(record);
        const types = Array.isArray(record?.investigation?.incidentTypes) ? record.investigation.incidentTypes : [];
        const lostDays = parseFloat(record.lostDays || record.daysLost || record.lostTimeDays || record.timeOffWork || 0) || 0;
        return types.includes('injury-lost') || lostDays > 0 || bag.includes('lost time') || bag.includes('توقف عن العمل') || bag.includes(' lti');
    },

    isFirstAidIncident(record = {}) {
        const bag = this.getTextBag(record);
        return bag.includes('first aid') || bag.includes('اسعافات') || bag.includes('إسعافات') || bag.includes('اسعاف');
    },

    isNonLostTimeIncident(record = {}) {
        const bag = this.getTextBag(record);
        const types = Array.isArray(record?.investigation?.incidentTypes) ? record.investigation.incidentTypes : [];
        if (this.isLostTimeIncident(record) || this.isFirstAidIncident(record)) return false;
        return types.includes('injury-no-lost') || bag.includes('nlti') || bag.includes('إصابة') || bag.includes('injury');
    },

    isRecordableIncident(record = {}) {
        const bag = this.getTextBag(record);
        const types = Array.isArray(record?.investigation?.incidentTypes) ? record.investigation.incidentTypes : [];
        if (types.includes('fatality') || bag.includes('fatality') || bag.includes('وفاة')) return true;
        return this.isLostTimeIncident(record) || this.isNonLostTimeIncident(record) || bag.includes('recordable');
    },

    isIllnessVisit(record = {}) {
        const bag = this.getTextBag(record);
        return bag.includes('مرض') || bag.includes('illness') || bag.includes('occupational');
    },

    isOccHealthHazard(record = {}) {
        const bag = this.getTextBag(record);
        return bag.includes('health') || bag.includes('صحة') || bag.includes('ergonomic') || bag.includes('chemical') || bag.includes('dust') || bag.includes('noise');
    },

    categorizePermitType(record = {}) {
        const bag = this.getTextBag({ ...record, type: record?.workType || record?.permitType || record?.permitTypeDisplay });
        if (bag.includes('height') || bag.includes('ارتفاع')) return 'height';
        if (bag.includes('elect') || bag.includes('كهرب') || bag.includes('loto') || bag.includes('lockout') || bag.includes('tagout')) return 'electrical';
        if (bag.includes('hot') || bag.includes('ساخن')) return 'hot';
        return 'other';
    },

    getMonthIndexForYear(value, year) {
        const date = this.parseScorecardDate(value);
        if (!date || date.getFullYear() !== year) return -1;
        return date.getMonth();
    },

    buildScorecardBaseYear(year) {
        const cacheKey = `base:${year}:${this.getScorecardSignature()}`;
        const cached = this._scorecardCache.get(cacheKey);
        if (cached) return cached;

        const data = AppState.appData || {};
        const employees = Array.isArray(data.employees) ? data.employees : [];
        const base = {
            year,
            directEmployeeCounts: this.createMonthlyArray(0),
            contractorEmployeeCounts: this.createMonthlyArray(0),
            employeeCounts: this.createMonthlyArray(0),
            hoursWorked: this.createMonthlyArray(0),
            lti: this.createMonthlyArray(0),
            nlti: this.createMonthlyArray(0),
            firstAid: this.createMonthlyArray(0),
            recordable: this.createMonthlyArray(0),
            hazards: this.createMonthlyArray(0),
            occLti: this.createMonthlyArray(0),
            occNlti: this.createMonthlyArray(0),
            occHazards: this.createMonthlyArray(0),
            permitsHeight: this.createMonthlyArray(0),
            permitsElectrical: this.createMonthlyArray(0),
            permitsHot: this.createMonthlyArray(0),
            permitsOther: this.createMonthlyArray(0),
            trainingSessions: this.createMonthlyArray(0),
            trainingAttendees: this.createMonthlyArray(0),
            trainingHours: this.createMonthlyArray(0),
            neboshStatus: this.createMonthlyArray('')
        };

        for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
            base.directEmployeeCounts[monthIndex] = this.getOperationalEmployeesForMonth(employees, year, monthIndex);
            base.contractorEmployeeCounts[monthIndex] = this.getExternalWorkforceForMonth(year, monthIndex);
            base.employeeCounts[monthIndex] = base.directEmployeeCounts[monthIndex] + base.contractorEmployeeCounts[monthIndex];
            base.hoursWorked[monthIndex] = this.getHoursWorkedValue(year, monthIndex, base.employeeCounts[monthIndex]);
            base.neboshStatus[monthIndex] = this.getNeboshStatusForMonth(year, monthIndex);
        }

        (data.incidents || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.date || record?.incidentDate || record?.createdAt, year);
            if (monthIndex < 0) return;
            if (this.isLostTimeIncident(record)) base.lti[monthIndex] += 1;
            else if (this.isNonLostTimeIncident(record)) base.nlti[monthIndex] += 1;
            if (this.isFirstAidIncident(record)) base.firstAid[monthIndex] += 1;
            if (this.isRecordableIncident(record)) base.recordable[monthIndex] += 1;
        });

        (data.nearmiss || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.date || record?.createdAt, year);
            if (monthIndex < 0) return;
            base.hazards[monthIndex] += 1;
            if (this.isOccHealthHazard(record)) base.occHazards[monthIndex] += 1;
        });

        (data.clinicVisits || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.visitDate || record?.createdAt, year);
            if (monthIndex < 0) return;
            if (this.isIllnessVisit(record)) base.occNlti[monthIndex] += 1;
        });

        (data.sickLeave || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.startDate || record?.createdAt, year);
            if (monthIndex < 0) return;
            base.occLti[monthIndex] += 1;
        });

        const permitMap = new Map();
        [...(data.ptw || []), ...(data.ptwRegistry || [])].forEach(record => {
            const permitId = record?.permitId || record?.id || `${record?.workType || record?.permitType || 'permit'}-${record?.startDate || record?.openDate || record?.createdAt || ''}`;
            if (!permitMap.has(permitId)) permitMap.set(permitId, record);
        });
        permitMap.forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.startDate || record?.openDate || record?.createdAt || record?.timeFrom, year);
            if (monthIndex < 0) return;
            const category = this.categorizePermitType(record);
            if (category === 'height') base.permitsHeight[monthIndex] += 1;
            else if (category === 'electrical') base.permitsElectrical[monthIndex] += 1;
            else if (category === 'hot') base.permitsHot[monthIndex] += 1;
            else base.permitsOther[monthIndex] += 1;
        });

        const attendanceByTraining = new Map();
        (data.trainingAttendance || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.date || record?.attendanceDate || record?.createdAt, year);
            if (monthIndex < 0) return;
            base.trainingAttendees[monthIndex] += 1;
            base.trainingHours[monthIndex] += parseFloat(record?.totalHours || record?.hours || 0) || 0;
            if (record?.trainingId) attendanceByTraining.set(String(record.trainingId), true);
        });

        (data.training || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.startDate || record?.date || record?.createdAt, year);
            if (monthIndex < 0) return;
            base.trainingSessions[monthIndex] += 1;
            const id = String(record?.id || '');
            if (!id || !attendanceByTraining.has(id)) {
                const attendees = parseFloat(record?.participantsCount || record?.attendeesCount || (Array.isArray(record?.participants) ? record.participants.length : 0) || 0) || 0;
                const hours = parseFloat(record?.totalHours || record?.hours || record?.trainingHours || 0) || 0;
                base.trainingAttendees[monthIndex] += attendees;
                base.trainingHours[monthIndex] += hours;
            }
        });

        (data.contractorTrainings || []).forEach(record => {
            const monthIndex = this.getMonthIndexForYear(record?.date || record?.trainingDate || record?.createdAt, year);
            if (monthIndex < 0) return;
            base.trainingSessions[monthIndex] += 1;
            base.trainingAttendees[monthIndex] += parseFloat(record?.traineesCount || record?.attendees || 0) || 0;
            base.trainingHours[monthIndex] += parseFloat(record?.totalHours || record?.hours || 0) || 0;
        });

        this._scorecardCache.set(cacheKey, base);
        return base;
    },

    sumYtd(values = [], limit = 11) {
        return values.slice(0, limit + 1).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    },

    averageYtd(values = [], limit = 11) {
        const slice = values.slice(0, limit + 1).filter(value => value !== '' && value !== null && value !== undefined);
        if (!slice.length) return 0;
        return slice.reduce((sum, value) => sum + (parseFloat(value) || 0), 0) / slice.length;
    },

    calculateRateSeries(numeratorSeries = [], denominatorSeries = []) {
        return numeratorSeries.map((value, index) => {
            const denominator = parseFloat(denominatorSeries[index] || 0) || 0;
            return denominator > 0 ? (parseFloat(value || 0) * 1000000) / denominator : 0;
        });
    },

    calculateRollingSeries(currentYearSeries = [], previousYearSeries = [], currentYearHours = [], previousYearHours = []) {
        const mergedNumerator = [...previousYearSeries, ...currentYearSeries];
        const mergedHours = [...previousYearHours, ...currentYearHours];
        const result = this.createMonthlyArray(0);

        for (let index = 12; index < 24; index += 1) {
            const start = Math.max(0, index - 11);
            const numerator = mergedNumerator.slice(start, index + 1).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
            const hours = mergedHours.slice(start, index + 1).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
            result[index - 12] = hours > 0 ? (numerator * 1000000) / hours : 0;
        }
        return result;
    },

    buildScorecardData(year) {
        const signature = `${this.getScorecardSignature()}|model`;
        const cacheKey = `model:${year}:${signature}`;
        if (this._scorecardCache.has(cacheKey)) return this._scorecardCache.get(cacheKey);

        const base = this.buildScorecardBaseYear(year);
        const prevBase = this.buildScorecardBaseYear(year - 1);
        const ytdLimit = this.currentYtdLimit(year);
        const permitTotal = base.permitsHeight.map((value, index) => value + base.permitsElectrical[index] + base.permitsHot[index] + base.permitsOther[index]);
        const occRecordable = base.occLti.map((value, index) => value + base.occNlti[index]);
        const ltir = this.calculateRateSeries(base.lti, base.hoursWorked);
        const trir = this.calculateRateSeries(base.recordable, base.hoursWorked);
        const occLtir = this.calculateRateSeries(base.occLti, base.hoursWorked);
        const occTrir = this.calculateRateSeries(occRecordable, base.hoursWorked);
        const rollingLtir = this.calculateRollingSeries(base.lti, prevBase.lti, base.hoursWorked, prevBase.hoursWorked);
        const rollingTrir = this.calculateRollingSeries(base.recordable, prevBase.recordable, base.hoursWorked, prevBase.hoursWorked);
        const rollingOccLtir = this.calculateRollingSeries(base.occLti, prevBase.occLti, base.hoursWorked, prevBase.hoursWorked);
        const rollingOccTrir = this.calculateRollingSeries(occRecordable, prevBase.occLti.map((value, index) => value + prevBase.occNlti[index]), base.hoursWorked, prevBase.hoursWorked);
        const trainingHoursPerFte = base.trainingHours.map((value, index) => {
            const employees = parseFloat(base.employeeCounts[index] || 0) || 0;
            return employees > 0 ? value / employees : 0;
        });
        const trainingMinutesPerFte = trainingHoursPerFte.map(value => value * 60);
        const trainingHoursPerFteYtd = base.trainingHours.map((_, index) => {
            const totalHours = this.sumYtd(base.trainingHours, index);
            const avgEmployees = this.averageYtd(base.employeeCounts, index);
            return avgEmployees > 0 ? totalHours / avgEmployees : 0;
        });

        const toDerivedHoursFromHeadcount = (count) => {
            const derived = Number(count || 0) * 8 * 22;
            return parseFloat(derived.toFixed(2));
        };
        const contractorHoursDisplay = base.contractorEmployeeCounts.map(c => toDerivedHoursFromHeadcount(c));
        const permanentHoursDisplay = base.hoursWorked.map((total, i) => {
            const t = parseFloat(total) || 0;
            const ch = contractorHoursDisplay[i] || 0;
            return Math.max(0, parseFloat((t - ch).toFixed(2)));
        });
        const combinedHoursDisplay = base.hoursWorked.map(total => {
            const t = parseFloat(total);
            return Number.isFinite(t) ? parseFloat(t.toFixed(2)) : 0;
        });

        const model = {
            year,
            ytdLimit,
            months: this.getScorecardMonths(),
            rows: {
                employeeCounts: base.employeeCounts,
                directEmployeeCounts: base.directEmployeeCounts,
                contractorEmployeeCounts: base.contractorEmployeeCounts,
                hoursWorked: base.hoursWorked,
                contractorHoursDisplay,
                permanentHoursDisplay,
                combinedHoursDisplay,
                lti: base.lti,
                nlti: base.nlti,
                firstAid: base.firstAid,
                recordable: base.recordable,
                ltir,
                trir,
                rollingLtir,
                rollingTrir,
                hazards: base.hazards,
                occLti: base.occLti,
                occNlti: base.occNlti,
                occRecordable,
                occLtir,
                occTrir,
                rollingOccLtir,
                rollingOccTrir,
                occHazards: base.occHazards,
                permitsHeight: base.permitsHeight,
                permitsElectrical: base.permitsElectrical,
                permitsHot: base.permitsHot,
                permitsOther: base.permitsOther,
                permitTotal,
                trainingSessions: base.trainingSessions,
                trainingAttendees: base.trainingAttendees,
                trainingHours: base.trainingHours,
                trainingHoursPerFte,
                trainingMinutesPerFte,
                trainingHoursPerFteYtd,
                neboshStatus: base.neboshStatus
            }
        };

        this._scorecardCache.set(cacheKey, model);
        return model;
    },

    formatScorecardValue(value, decimals = 0, monthIndex = -1, year = this.scorecardYear) {
        if (typeof value === 'string') return value;
        if (this.isFutureMonth(year, monthIndex)) return '';
        const number = parseFloat(value || 0) || 0;
        return number.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    getYtdValue(values = [], type = 'sum', limit = this.currentYtdLimit(this.scorecardYear), denominators = null) {
        if (type === 'avg') return this.averageYtd(values, limit);
        if (type === 'rate') {
            const numerator = this.sumYtd(values, limit);
            const denominator = this.sumYtd(denominators || [], limit);
            return denominator > 0 ? (numerator * 1000000) / denominator : 0;
        }
        if (type === 'last') return values[Math.min(limit, values.length - 1)] || 0;
        return this.sumYtd(values, limit);
    },

    renderScorecardTable(force = false) {
        const container = document.getElementById('spk-scorecard-table-container');
        if (!container) return;

        const signature = this.getScorecardSignature();
        if (!force && signature === this._lastScorecardSignature && container.dataset.signature === signature) {
            this.applyScorecardAccessState();
            return;
        }

        const model = this.buildScorecardData(this.scorecardYear);
        container.innerHTML = this.renderScorecardTableHtml(model);
        this.applyModuleI18n(container);
        container.dataset.signature = signature;
        this._lastScorecardSignature = signature;
        this.applyScorecardAccessState();
    },

    renderScorecardTableHtml(model) {
        const t = (k, f) => this._t(k, f);
        const months = model.months;
        const ytdLimit = model.ytdLimit;
        const year = model.year;
        const rows = model.rows;
        const hasNeboshSource = (AppState.appData.trainingCertificates || []).some(record => this.matchesNeboshRecord(record))
            || (AppState.appData.training || []).some(record => this.matchesNeboshRecord(record));
        const manualNebosh = !hasNeboshSource;

        const renderCells = (values, tone, decimals = 0, options = {}) => months.map(month => {
            const classes = [`spk-cell-${tone}`];
            const value = values[month.index];
            if (options.manual === 'hoursWorked') {
                classes.push('spk-cell-manual');
                return `<td class="${classes.join(' ')}"><input type="number" class="spk-manual-input" step="0.01" value="${value || ''}" data-scorecard-manual="hoursWorked" data-year="${year}" data-month="${month.index}"></td>`;
            }
            if (options.manual === 'neboshStatus') {
                classes.push('spk-cell-manual');
                const current = String(value || '');
                const optionsList = [
                    { value: '', label: '-' },
                    { value: 'Certified', label: t('module.kpi.scorecard.nebosh.certified', 'Certified') },
                    { value: 'In Progress', label: t('module.kpi.scorecard.nebosh.inProgress', 'In Progress') },
                    { value: 'Expired', label: t('module.kpi.scorecard.nebosh.expired', 'Expired') },
                    { value: 'Not Available', label: t('module.kpi.scorecard.nebosh.notAvailable', 'Not Available') }
                ];
                return `<td class="${classes.join(' ')}"><select class="spk-manual-select" data-scorecard-manual="neboshStatus" data-year="${year}" data-month="${month.index}">${optionsList.map(choice => `<option value="${choice.value}" ${choice.value === current ? 'selected' : ''}>${choice.label}</option>`).join('')}</select></td>`;
            }
            return `<td class="${classes.join(' ')}">${this.formatScorecardValue(value, decimals, month.index, year)}</td>`;
        }).join('');

        const renderMetricRow = (label, values, tone, ytdValue, ytdTone = tone, decimals = 0, options = {}) => `
            <tr class="${options.total ? 'spk-row-total' : ''}">
                <td class="spk-label-cell">${label}</td>
                ${renderCells(values, tone, decimals, options)}
                <td class="spk-cell-${ytdTone}">${typeof ytdValue === 'string' ? ytdValue : this.formatScorecardValue(ytdValue, decimals)}</td>
            </tr>
        `;

        return `
            <table class="spk-scorecard-table">
                <thead>
                    <tr>
                        <th>${t('module.kpi.scorecard.table.title', 'HEALTH & SAFETY PERFORMANCE SCORECARD')} ${year}</th>
                        ${months.map(month => `<th>${month.label}</th>`).join('')}
                        <th class="spk-ytd-head">${t('module.kpi.scorecard.table.cumulativeYtd', 'Cumulative YTD')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${renderMetricRow(t('module.kpi.scorecard.row.operationalEmployees','Number of Permanent Employees'), rows.directEmployeeCounts, 'blue', this.getYtdValue(rows.directEmployeeCounts, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.contractorEmployees','Number of Temporary Workers'), rows.contractorEmployeeCounts, 'blue', this.getYtdValue(rows.contractorEmployeeCounts, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.contractorHoursDisplay','Total Temporary Workers Hours'), rows.contractorHoursDisplay, 'blue', this.getYtdValue(rows.contractorHoursDisplay, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.totalHoursWorked','Total Employee Hours Worked'), rows.permanentHoursDisplay, 'blue', this.getYtdValue(rows.permanentHoursDisplay, 'sum', ytdLimit), 'yellow', 0, { manual: 'hoursWorked' })}
                    ${renderMetricRow(t('module.kpi.scorecard.row.combinedHoursDisplay','Combined Total Hours (Employees + Temps)'), rows.combinedHoursDisplay, 'blue', this.getYtdValue(rows.combinedHoursDisplay, 'sum', ytdLimit), 'yellow', 0)}
                    <tr class="spk-row-section"><td colspan="14">${t('module.kpi.scorecard.section.accidentRates','1 Accident, Incident, & Illness Rates')}</td></tr>
                    <tr class="spk-row-subsection"><td colspan="13">${t('module.kpi.scorecard.section.safetyReported','1.1 Safety (number reported)')}</td><td class="spk-subsection-ytd">${t('module.kpi.scorecard.table.cumulativeYtd','Cumulative YTD')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.lti','LTI - Lost Time Incidents'), rows.lti, 'blue', this.getYtdValue(rows.lti, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.nlti','NLTI - Non Lost Time Incidents'), rows.nlti, 'blue', this.getYtdValue(rows.nlti, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.firstAid','First Aid Cases'), rows.firstAid, 'blue', this.getYtdValue(rows.firstAid, 'sum', ytdLimit), 'yellow', 0)}
                    <tr class="spk-row-subsection"><td colspan="14">${t('module.kpi.scorecard.section.inMonthValues','IN MONTH VALUES')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.ltir','LTIR - Lost Time Incident Rate'), rows.ltir, 'yellow', this.getYtdValue(rows.lti, 'rate', ytdLimit, rows.hoursWorked), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.trir','TRIR - Total Recordable Incident Rate'), rows.trir, 'yellow', this.getYtdValue(rows.recordable, 'rate', ytdLimit, rows.hoursWorked), 'yellow', 2)}
                    <tr class="spk-row-subsection"><td colspan="13">${t('module.kpi.scorecard.section.rolling12','ROLLING 12 MONTH VALUES')}</td><td class="spk-subsection-ytd">${t('module.kpi.scorecard.table.ytd12avg','YTD 12 Mth Ave')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.ltir','LTIR - Lost Time Incident Rate'), rows.rollingLtir, 'yellow', this.getYtdValue(rows.rollingLtir, 'avg', ytdLimit), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.trir','TRIR - Total Recordable Incident Rate'), rows.rollingTrir, 'yellow', this.getYtdValue(rows.rollingTrir, 'avg', ytdLimit), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.nearMissHazards','Near Miss/Hazards Reported'), rows.hazards, 'blue', this.getYtdValue(rows.hazards, 'sum', ytdLimit), 'yellow', 0)}
                    <tr class="spk-row-subsection"><td colspan="13">${t('module.kpi.scorecard.section.occupationalHealth','1.2 Occupational Health (number reported)')}</td><td class="spk-subsection-ytd">${t('module.kpi.scorecard.table.cumulativeYtd','Cumulative YTD')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.ltoi','LTOI - Lost Time Occupational Illness'), rows.occLti, 'blue', this.getYtdValue(rows.occLti, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.nltoi','NLTOI - Non Lost Time Occupational Illness'), rows.occNlti, 'blue', this.getYtdValue(rows.occNlti, 'sum', ytdLimit), 'yellow', 0)}
                    <tr class="spk-row-subsection"><td colspan="14">${t('module.kpi.scorecard.section.inMonthValues','IN MONTH VALUES')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.ltoir','LTOIR - Lost Time Occ. Illness Rate'), rows.occLtir, 'yellow', this.getYtdValue(rows.occLti, 'rate', ytdLimit, rows.hoursWorked), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.troir','TROIR - Total Recordable Occ Illness Rate'), rows.occTrir, 'yellow', this.getYtdValue(rows.occRecordable, 'rate', ytdLimit, rows.hoursWorked), 'yellow', 2)}
                    <tr class="spk-row-subsection"><td colspan="13">${t('module.kpi.scorecard.section.rolling12','ROLLING 12 MONTH VALUES')}</td><td class="spk-subsection-ytd">${t('module.kpi.scorecard.table.ytd12avg','YTD 12 Mth Ave')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.ltoir','LTOIR - Lost Time Occ. Illness Rate'), rows.rollingOccLtir, 'yellow', this.getYtdValue(rows.rollingOccLtir, 'avg', ytdLimit), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.troir','TROIR - Total Recordable Occ Illness Rate'), rows.rollingOccTrir, 'yellow', this.getYtdValue(rows.rollingOccTrir, 'avg', ytdLimit), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.occNearMissHazards','Occ Health Near Miss/Hazards Reported'), rows.occHazards, 'blue', this.getYtdValue(rows.occHazards, 'sum', ytdLimit), 'yellow', 0)}
                    <tr class="spk-row-section"><td colspan="14">${t('module.kpi.scorecard.section.permits','2 Permits to Work')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.permits.heights','Heights'), rows.permitsHeight, 'blue', this.getYtdValue(rows.permitsHeight, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.permits.electrical','Electrical Work / LOTO'), rows.permitsElectrical, 'blue', this.getYtdValue(rows.permitsElectrical, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.permits.hot','Hot Work'), rows.permitsHot, 'blue', this.getYtdValue(rows.permitsHot, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.permits.others','All Others'), rows.permitsOther, 'blue', this.getYtdValue(rows.permitsOther, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.permits.total','TOTAL PER MONTH'), rows.permitTotal, 'yellow', this.getYtdValue(rows.permitTotal, 'sum', ytdLimit), 'yellow', 0, { total: true })}
                    <tr class="spk-row-section"><td colspan="14">${t('module.kpi.scorecard.section.training','3 Health & Safety Training')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.training.sessions','Total Number sessions run'), rows.trainingSessions, 'blue', this.getYtdValue(rows.trainingSessions, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.training.attendees','Total Number of attendees'), rows.trainingAttendees, 'blue', this.getYtdValue(rows.trainingAttendees, 'sum', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.training.hours','Total Number H&S Training Hours'), rows.trainingHours, 'blue', this.getYtdValue(rows.trainingHours, 'sum', ytdLimit), 'yellow', 2)}
                    <tr class="spk-row-subsection"><td colspan="13">${t('module.kpi.scorecard.section.trainingMetrics','Training Metrics')}</td><td class="spk-subsection-ytd">${t('module.kpi.scorecard.table.averageYtd','Average YTD')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.training.hoursPerFte','Training Hours per Operational FTE'), rows.trainingHoursPerFte, 'yellow', this.getYtdValue(rows.trainingHoursPerFte, 'avg', ytdLimit), 'yellow', 2)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.training.minutesPerFte','equates to Minutes of training per FTE'), rows.trainingMinutesPerFte, 'yellow', this.getYtdValue(rows.trainingMinutesPerFte, 'avg', ytdLimit), 'yellow', 0)}
                    ${renderMetricRow(t('module.kpi.scorecard.row.training.hoursPerFteYtd','equates to Hours of training per FTE YTD'), rows.trainingHoursPerFteYtd, 'yellow', this.getYtdValue(rows.trainingHoursPerFteYtd, 'last', ytdLimit), 'yellow', 2)}
                    <tr class="spk-row-section"><td colspan="14">${t('module.kpi.scorecard.section.nebosh','4 NEBOSH Training')}</td></tr>
                    ${renderMetricRow(t('module.kpi.scorecard.row.neboshStatus','Certification status of UAE HSE Lead'), rows.neboshStatus, manualNebosh ? 'blue' : 'neutral', rows.neboshStatus[Math.min(ytdLimit, 11)] || '-', manualNebosh ? 'blue' : 'neutral', 0, manualNebosh ? { manual: 'neboshStatus' } : {})}
                </tbody>
            </table>
        `;
    },

    setupEventListeners() {
        // Filters
        const periodSelect = document.getElementById('kpi-filter-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                const customDates = document.getElementById('kpi-custom-dates');
                const customDatesEnd = document.getElementById('kpi-custom-dates-end');
                if (e.target.value === 'custom') {
                    customDates?.classList.remove('hidden');
                    customDatesEnd?.classList.remove('hidden');
                } else {
                    customDates?.classList.add('hidden');
                    customDatesEnd?.classList.add('hidden');
                }
            });
        }

        document.getElementById('kpi-apply-filters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('kpi-reset-filters')?.addEventListener('click', () => {
            this.resetFilters();
        });

        // Export buttons
        document.getElementById('kpis-export-excel-btn')?.addEventListener('click', () => {
            this.exportToExcel();
        });

        document.getElementById('kpis-export-pdf-btn')?.addEventListener('click', () => {
            this.exportToPDF();
        });

        // Settings button
        document.getElementById('kpis-settings-btn')?.addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Load data for new tabs if they are active
        if (this.activeTab === 'annual-plan') {
            this.loadKPIAnnualPlans();
        } else if (this.activeTab === 'monitoring-plan') {
            this.loadHSEMonitoringPlans();
        }
    },

    applyFilters() {
        const period = document.getElementById('kpi-filter-period')?.value || 'monthly';
        const department = document.getElementById('kpi-filter-department')?.value || '';
        const location = document.getElementById('kpi-filter-location')?.value || '';
        const startDate = document.getElementById('kpi-filter-start-date')?.value || '';
        const endDate = document.getElementById('kpi-filter-end-date')?.value || '';

        this.filters = { period, department, location, startDate, endDate };
        this.updateAllKPIs();
    },

    resetFilters() {
        this.filters = {
            period: 'monthly',
            department: '',
            location: '',
            startDate: '',
            endDate: ''
        };

        document.getElementById('kpi-filter-period').value = 'monthly';
        document.getElementById('kpi-filter-department').value = '';
        document.getElementById('kpi-filter-location').value = '';
        document.getElementById('kpi-filter-start-date').value = '';
        document.getElementById('kpi-filter-end-date').value = '';
        document.getElementById('kpi-custom-dates')?.classList.add('hidden');
        document.getElementById('kpi-custom-dates-end')?.classList.add('hidden');

        this.updateAllKPIs();
    },

    getDateRange() {
        const now = new Date();
        let start, end;

        if (this.filters.period === 'custom' && this.filters.startDate && this.filters.endDate) {
            start = new Date(this.filters.startDate);
            end = new Date(this.filters.endDate);
            end.setHours(23, 59, 59, 999);
        } else if (this.filters.period === 'yearly') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        } else if (this.filters.period === 'quarterly') {
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
            end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59);
        } else { // monthly
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }

        return { start, end };
    },

    updateAllKPIs() {
        const { start, end } = this.getDateRange();
        const data = this.getFilteredData(start, end);

        // Update Leading Indicators
        const inspectionTours = this.calculateInspectionTours(data);
        this.updateKPI('inspection-tours', inspectionTours.completed, 'جولة', 'inspection-tours', inspectionTours.planned);

        const observations = this.calculateObservationsRecorded(data);
        this.updateKPI('observations-recorded', observations.total, 'ملاحظة', 'observations', null, observations.processed);

        const actionsClosure = this.calculateCorrectiveActionsClosure(data);
        this.updateKPI('corrective-actions-closure', actionsClosure.percentage, '%', 'actions-closure', 100);

        const trainingCourses = this.calculateTrainingCourses(data);
        this.updateKPI('training-courses', trainingCourses.completed, 'دورة', 'training-courses', trainingCourses.total);

        const trainingAttendance = this.calculateTrainingAttendance(data);
        this.updateKPI('training-attendance', trainingAttendance.percentage, '%', 'training-attendance', 100);

        const ptwApproved = this.calculatePTWApproved(data);
        this.updateKPI('ptw-approved', ptwApproved.approved, 'تصريح', 'ptw-approved', ptwApproved.total);

        const ppeCompliance = this.calculatePPECompliance(data);
        this.updateKPI('ppe-compliance', ppeCompliance.percentage, '%', 'ppe-compliance', 100);

        const inspectionsOnTime = this.calculatePeriodicInspectionsOnTime(data);
        this.updateKPI('periodic-inspections-on-time', inspectionsOnTime.onTime, 'فحص', 'inspections-on-time', inspectionsOnTime.total);

        const safetyMeetings = this.calculateSafetyMeetings(data);
        this.updateKPI('safety-meetings', safetyMeetings, 'اجتماع', 'safety-meetings');

        // Update Lagging Indicators
        const totalInjuries = this.calculateTotalInjuries(data);
        this.updateKPI('total-injuries', totalInjuries, 'إصابة', 'injuries');

        const ltiCount = this.calculateLTICount(data);
        this.updateKPI('lti-count', ltiCount, 'إصابة', 'lti');

        const ltifr = this.calculateLTIFR(data);
        this.updateKPI('ltifr', ltifr, '', 'ltifr');

        const severityRate = this.calculateSeverityRate(data);
        this.updateKPI('severity-rate', severityRate, '%', 'severity');

        const nearMissCount = this.calculateNearMissCount(data);
        this.updateKPI('near-miss-count', nearMissCount, 'حادث', 'nearmiss-count');

        const fireIncidents = this.calculateFireIncidents(data);
        this.updateKPI('fire-incidents', fireIncidents, 'حادث', 'fire-incidents');

        const lostDays = this.calculateLostDays(data);
        this.updateKPI('lost-days', lostDays, 'يوم', 'lost-days');

        const accidentCost = this.calculateAccidentCost(data);
        this.updateKPI('accident-cost', parseFloat(accidentCost).toLocaleString('ar-SA'), 'ريال', 'accident-cost');

        // Update charts
        this.updateCharts(data, start, end);
        this.queueScorecardRefresh();
    },

    getFilteredData(start, end) {
        const data = AppState.appData;
        const deptFilter = this.filters.department;
        const locFilter = this.filters.location;

        const filterByDateDeptLoc = (item, dateField, deptField = 'department', locField = 'location') => {
            const itemDate = new Date(item[dateField] || item.date || item.createdAt);
            const matchDate = itemDate >= start && itemDate <= end;
            const matchDept = !deptFilter || (item[deptField] || item.affectedDepartment || '').includes(deptFilter);
            const matchLoc = !locFilter || (item[locField] || item.location || '').includes(locFilter);
            return matchDate && matchDept && matchLoc;
        };

        return {
            incidents: (data.incidents || []).filter(inc => filterByDateDeptLoc(inc, 'date', 'affectedDepartment', 'location')),
            nearmiss: (data.nearmiss || []).filter(nm => filterByDateDeptLoc(nm, 'date', 'department', 'location')),
            dailyObservations: (data.dailyObservations || []).filter(obs => filterByDateDeptLoc(obs, 'date', 'department')),
            training: (data.training || []).filter(tr => {
                const trDate = new Date(tr.date || tr.startDate || tr.createdAt);
                return trDate >= start && trDate <= end;
            }),
            ptw: (data.ptw || []).filter(p => {
                const pDate = new Date(p.startDate || p.createdAt);
                return pDate >= start && pDate <= end;
            }),
            periodicInspectionRecords: (data.periodicInspectionRecords || []).filter(rec => {
                const recDate = new Date(rec.inspectionDate || rec.createdAt);
                return recDate >= start && recDate <= end;
            }),
            periodicInspectionSchedules: (data.periodicInspectionSchedules || []).filter(sch => {
                const schDate = new Date(sch.scheduledDate || sch.createdAt);
                return schDate >= start && schDate <= end;
            }),
            fireEquipmentInspections: (data.fireEquipmentInspections || []).filter(ins => {
                const insDate = new Date(ins.inspectionDate || ins.createdAt);
                return insDate >= start && insDate <= end;
            }),
            actionTrackingRegister: (data.actionTrackingRegister || []).filter(act => {
                const actDate = new Date(act.dueDate || act.createdAt);
                return actDate >= start && actDate <= end;
            }),
            hseCorrectiveActions: (data.hseCorrectiveActions || []).filter(act => {
                const actDate = new Date(act.date || act.createdAt);
                return actDate >= start && actDate <= end;
            }),
            clinicRecords: (data.clinicRecords || []).filter(rec => {
                const recDate = new Date(rec.date || rec.visitDate || rec.createdAt);
                return recDate >= start && recDate <= end;
            }),
            medicalInjuries: (data.medicalInjuries || []).filter(inj => {
                const injDate = new Date(inj.date || inj.injuryDate || inj.createdAt);
                return injDate >= start && injDate <= end;
            }),
            ppeRecords: (data.ppe || []).filter(ppe => {
                const ppeDate = new Date(ppe.date || ppe.issueDate || ppe.createdAt);
                return ppeDate >= start && ppeDate <= end;
            }),
            safetyMeetings: (data.safetyMeetings || []).filter(meeting => {
                const meetingDate = new Date(meeting.date || meeting.meetingDate || meeting.createdAt);
                return meetingDate >= start && meetingDate <= end;
            }),
            inspectionTours: (data.inspectionTours || []).filter(tour => {
                const tourDate = new Date(tour.date || tour.tourDate || tour.createdAt);
                return tourDate >= start && tourDate <= end;
            }),
            safetyBudgetTransactions: (data.safetyBudgetTransactions || []).filter(tr => {
                const trDate = new Date(tr.date || tr.createdAt);
                return trDate >= start && trDate <= end;
            })
        };
    },

    calculateIncidents(data) {
        return data.incidents.length;
    },

    calculateNearMiss(data) {
        return data.nearmiss.length + data.dailyObservations.length;
    },

    calculateTRIR(data) {
        const employees = AppState.appData.employees || [];
        const totalEmployees = employees.filter(e => e && e.active !== false).length || 200;
        const hoursPerDay = 8;
        const workDaysPerMonth = 22;
        const monthsPerYear = 12;
        const totalWorkHours = totalEmployees * hoursPerDay * workDaysPerMonth * (this.filters.period === 'yearly' ? 12 : this.filters.period === 'quarterly' ? 3 : 1);

        const recordableInjuries = data.incidents.length;
        const trir = totalWorkHours > 0 ? ((recordableInjuries * 200000) / totalWorkHours) : 0;
        return trir.toFixed(2);
    },

    calculateSeverityRate(data) {
        const highSeverity = data.incidents.filter(inc =>
            (inc.severity || '').toLowerCase().includes('عالية') ||
            (inc.severity || '').toLowerCase().includes('high')
        ).length;
        const total = data.incidents.length;
        return total > 0 ? ((highSeverity / total) * 100).toFixed(1) : '0.0';
    },

    calculateTrainingCompletion(data) {
        const completed = data.training.filter(tr =>
            (tr.status || '').includes('مكتمل') || (tr.status || '').includes('completed')
        ).length;
        const total = data.training.length;
        return total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
    },

    calculateCorrectiveActions(data) {
        const closed = data.actionTrackingRegister.filter(act =>
            (act.status || '').includes('مغلق') || (act.status || '').includes('مكتمل') ||
            (act.status || '').includes('closed') || (act.status || '').includes('completed')
        ).length;
        const total = data.actionTrackingRegister.length;
        return total > 0 ? ((closed / total) * 100).toFixed(1) : '0.0';
    },

    calculatePTWCompliance(data) {
        const compliant = data.ptw.filter(p =>
            (p.status || '').includes('موافق') || (p.status || '').includes('approved')
        ).length;
        const total = data.ptw.length;
        return total > 0 ? ((compliant / total) * 100).toFixed(1) : '0.0';
    },

    calculatePeriodicInspections(data) {
        const completed = data.periodicInspectionRecords.filter(rec =>
            (rec.status || '').includes('مكتمل') || (rec.status || '').includes('completed')
        ).length;
        const total = data.periodicInspectionRecords.length;
        return total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
    },

    calculateFireEquipment(data) {
        const completed = data.fireEquipmentInspections.filter(ins =>
            (ins.status || '').includes('مكتمل') || (ins.status || '').includes('completed')
        ).length;
        const total = data.fireEquipmentInspections.length;
        return total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
    },

    calculateSafetyBudget(data) {
        const totalSpent = data.safetyBudgetTransactions.reduce((sum, tr) =>
            sum + (parseFloat(tr.amount) || 0), 0
        );
        const budgets = AppState.appData.safetyBudgets || [];
        const totalBudget = budgets.reduce((sum, bud) =>
            sum + (parseFloat(bud.amount) || 0), 0
        );
        return totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0.0';
    },

    calculateImprovementRate(data) {
        // مقارنة مع الفترة السابقة
        const { start, end } = this.getDateRange();
        const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - periodDays);
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);

        const prevData = this.getFilteredData(prevStart, prevEnd);
        const currentIncidents = data.incidents.length;
        const prevIncidents = prevData.incidents.length;

        if (prevIncidents === 0) return currentIncidents === 0 ? '0.0' : '-100.0';
        const improvement = ((prevIncidents - currentIncidents) / prevIncidents) * 100;
        return improvement.toFixed(1);
    },

    calculateComplianceRate(data) {
        const totalItems = data.incidents.length + data.nearmiss.length;
        const resolved = data.incidents.filter(i =>
            (i.status || '').includes('مغلق') || (i.status || '').includes('closed')
        ).length + data.nearmiss.filter(n =>
            (n.status || '').includes('مغلق') || (n.status || '').includes('closed')
        ).length;
        return totalItems > 0 ? ((resolved / totalItems) * 100).toFixed(1) : '100.0';
    },

    // ===== Leading Indicators Calculations =====

    calculateInspectionTours(data) {
        // الجولات التفتيشية المنفذة مقابل المخطط
        const completed = (data.inspectionTours || []).filter(tour =>
            (tour.status || '').includes('مكتمل') || (tour.status || '').includes('completed')
        ).length;
        const planned = (data.inspectionTours || []).length;
        return { completed, planned, percentage: planned > 0 ? ((completed / planned) * 100).toFixed(1) : '0.0' };
    },

    calculateObservationsRecorded(data) {
        // الملاحظات المسجلة والمعالجة
        const total = (data.dailyObservations || []).length;
        const processed = (data.dailyObservations || []).filter(obs =>
            (obs.status || '').includes('معالج') || (obs.status || '').includes('مغلق') ||
            (obs.status || '').includes('processed') || (obs.status || '').includes('closed')
        ).length;
        return { total, processed, percentage: total > 0 ? ((processed / total) * 100).toFixed(1) : '0.0' };
    },

    calculateCorrectiveActionsClosure(data) {
        // نسبة إغلاق الإجراءات التصحيحية خلال الوقت المحدد
        const allActions = [...(data.actionTrackingRegister || []), ...(data.hseCorrectiveActions || [])];
        const closed = allActions.filter(act => {
            const isClosed = (act.status || '').includes('مغلق') || (act.status || '').includes('مكتمل') ||
                (act.status || '').includes('closed') || (act.status || '').includes('completed');
            if (!isClosed) return false;
            // Check if closed within due date
            const dueDate = new Date(act.dueDate || act.targetDate || act.createdAt);
            const closedDate = new Date(act.closedDate || act.completedDate || act.updatedAt || new Date());
            return closedDate <= dueDate;
        }).length;
        const total = allActions.length;
        return { closed, total, percentage: total > 0 ? ((closed / total) * 100).toFixed(1) : '0.0' };
    },

    calculateTrainingCourses(data) {
        // عدد الدورات التدريبية المنفذة مقابل الخطة
        const completed = (data.training || []).filter(tr =>
            (tr.status || '').includes('مكتمل') || (tr.status || '').includes('completed')
        ).length;
        const total = (data.training || []).length;
        return { completed, total, percentage: total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0' };
    },

    calculateTrainingAttendance(data) {
        // نسبة حضور الموظفين للتدريب
        const trainings = data.training || [];
        let totalAttendees = 0;
        let totalExpected = 0;

        trainings.forEach(tr => {
            const expected = parseInt(tr.expectedAttendees || tr.attendeesCount || 0);
            const actual = parseInt(tr.actualAttendees || (tr.attendees ? tr.attendees.length : 0));
            totalExpected += expected;
            totalAttendees += actual;
        });

        return {
            attendees: totalAttendees,
            expected: totalExpected,
            percentage: totalExpected > 0 ? ((totalAttendees / totalExpected) * 100).toFixed(1) : '0.0'
        };
    },

    calculatePTWApproved(data) {
        // عدد تصاريح العمل المعتمدة والمنفذة بأمان
        const approved = (data.ptw || []).filter(p =>
            (p.status || '').includes('موافق') || (p.status || '').includes('approved') ||
            (p.status || '').includes('مكتمل') || (p.status || '').includes('completed')
        ).length;
        const total = (data.ptw || []).length;
        return { approved, total, percentage: total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0' };
    },

    calculatePPECompliance(data) {
        // نسبة الالتزام باستخدام معدات الوقاية الشخصية (PPE Compliance)
        const ppeRecords = data.ppeRecords || [];
        const compliant = ppeRecords.filter(ppe =>
            (ppe.complianceStatus || '').includes('متوافق') ||
            (ppe.complianceStatus || '').includes('compliant') ||
            (ppe.status || '').includes('مستخدم') || (ppe.status || '').includes('used')
        ).length;
        const total = ppeRecords.length;
        return { compliant, total, percentage: total > 0 ? ((compliant / total) * 100).toFixed(1) : '0.0' };
    },

    calculatePeriodicInspectionsOnTime(data) {
        // عدد الفحوصات الدورية المنجزة في موعدها
        const records = data.periodicInspectionRecords || [];
        const schedules = data.periodicInspectionSchedules || [];

        const onTime = records.filter(rec => {
            const inspectionDate = new Date(rec.inspectionDate || rec.date);
            const schedule = schedules.find(sch => sch.id === rec.scheduleId || sch.categoryId === rec.categoryId);
            if (!schedule) return false;
            const dueDate = new Date(schedule.scheduledDate || schedule.dueDate);
            return inspectionDate <= dueDate;
        }).length;

        const total = records.length;
        return { onTime, total, percentage: total > 0 ? ((onTime / total) * 100).toFixed(1) : '0.0' };
    },

    calculateSafetyMeetings(data) {
        // عدد الاجتماعات والتوعيات الخاصة بالسلامة
        const meetings = data.safetyMeetings || [];
        return meetings.length;
    },

    // ===== Lagging Indicators Calculations =====

    calculateTotalInjuries(data) {
        // عدد الإصابات المسجلة
        const injuries = [...(data.incidents || []).filter(inc =>
            (inc.type || '').includes('إصابة') || (inc.type || '').includes('injury')
        ), ...(data.medicalInjuries || []), ...(data.clinicRecords || []).filter(rec =>
            (rec.type || '').includes('إصابة') || (rec.type || '').includes('injury')
        )];
        return injuries.length;
    },

    calculateLTICount(data) {
        // عدد الإصابات المؤدية لتوقف عن العمل (LTI - Lost Time Injury)
        const lti = [...(data.incidents || []), ...(data.medicalInjuries || [])].filter(item => {
            const lostDays = parseInt(item.lostDays || item.daysLost || item.timeOffWork || 0);
            const isLTI = (item.severity || '').includes('LTI') ||
                (item.type || '').includes('LTI') ||
                lostDays > 0 ||
                (item.result || '').includes('توقف') ||
                (item.result || '').includes('lost time');
            return isLTI;
        });
        return lti.length;
    },

    calculateLTIFR(data) {
        // معدل تكرار الإصابات (LTIFR - Lost Time Injury Frequency Rate)
        const employees = AppState.appData.employees || [];
        const totalEmployees = employees.filter(e => e && e.active !== false).length || 200;
        const hoursPerDay = 8;
        const workDaysPerMonth = 22;
        const periodMonths = this.filters.period === 'yearly' ? 12 : this.filters.period === 'quarterly' ? 3 : 1;
        const totalWorkHours = totalEmployees * hoursPerDay * workDaysPerMonth * periodMonths;

        const ltiCount = this.calculateLTICount(data);
        const ltifr = totalWorkHours > 0 ? ((ltiCount * 1000000) / totalWorkHours) : 0;
        return ltifr.toFixed(2);
    },

    calculateSeverityRate(data) {
        // معدل شدة الإصابات (Severity Rate)
        const incidents = [...(data.incidents || []), ...(data.medicalInjuries || [])];
        const totalLostDays = incidents.reduce((sum, inc) => {
            return sum + (parseInt(inc.lostDays || inc.daysLost || inc.timeOffWork || 0));
        }, 0);
        const totalInjuries = incidents.length;
        return totalInjuries > 0 ? (totalLostDays / totalInjuries).toFixed(1) : '0.0';
    },

    calculateNearMissCount(data) {
        // عدد الحوادث الوشيكة المسجلة
        return (data.nearmiss || []).length;
    },

    calculateFireIncidents(data) {
        // عدد الحرائق أو الحوادث في معدات الإطفاء
        const fireIncidents = [...(data.incidents || []).filter(inc =>
            (inc.type || '').includes('حريق') || (inc.type || '').includes('fire') ||
            (inc.description || '').includes('حريق') || (inc.description || '').includes('fire')
        ), ...(data.fireEquipmentInspections || []).filter(ins =>
            (ins.status || '').includes('عطل') || (ins.status || '').includes('fault') ||
            (ins.findings || '').includes('عطل') || (ins.findings || '').includes('fault')
        )];
        return fireIncidents.length;
    },

    calculateLostDays(data) {
        // عدد الأيام المهدورة بسبب الإصابات
        const incidents = [...(data.incidents || []), ...(data.medicalInjuries || [])];
        const totalLostDays = incidents.reduce((sum, inc) => {
            return sum + (parseInt(inc.lostDays || inc.daysLost || inc.timeOffWork || 0));
        }, 0);
        return totalLostDays;
    },

    calculateAccidentCost(data) {
        // تكلفة الحوادث (مباشرة / غير مباشرة)
        const incidents = data.incidents || [];
        const totalCost = incidents.reduce((sum, inc) => {
            const directCost = parseFloat(inc.directCost || inc.cost || 0);
            const indirectCost = parseFloat(inc.indirectCost || 0);
            return sum + directCost + indirectCost;
        }, 0);
        return totalCost.toFixed(2);
    },

    updateKPI(id, value, unit, type, targetValue = null, additionalInfo = null) {
        const valueEl = document.getElementById(`${id}-value`);
        const unitEl = document.getElementById(`${id}-unit`);
        const targetEl = document.getElementById(`${id}-target`);
        const progressEl = document.getElementById(`${id}-progress`);
        const progressBarEl = document.getElementById(`${id}-progress-bar`);
        const trendEl = document.getElementById(`${id}-trend`);
        const statusEl = document.getElementById(`${id}-status`);

        if (valueEl) {
            const numValue = parseFloat(value) || 0;
            valueEl.textContent = numValue.toLocaleString('ar-SA');
        }
        if (unitEl && unit) unitEl.textContent = unit;

        // Use provided target or get from saved targets
        const target = targetValue !== null ? targetValue : (this.getKPITarget(type) || 0);
        if (targetEl) {
            if (target > 0) {
                targetEl.textContent = target.toLocaleString('ar-SA') + (unit || '');
            } else {
                targetEl.textContent = additionalInfo ? `${additionalInfo} / ${value}` : '-';
            }
        }

        const numValue = parseFloat(value) || 0;
        let progress = 0;
        let statusColor = 'gray';

        // For percentage-based KPIs, progress is the value itself
        if (unit === '%' && target === 100) {
            progress = numValue;
            statusColor = numValue >= 90 ? 'green' : numValue >= 70 ? 'yellow' : 'red';
        } else if (target > 0) {
            // For count-based KPIs, calculate progress against target
            progress = Math.min((numValue / target) * 100, 100);
            statusColor = progress >= 100 ? 'green' : progress >= 75 ? 'yellow' : 'red';
        } else {
            // For lagging indicators (lower is better), use inverse logic
            if (type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days')) {
                statusColor = numValue === 0 ? 'green' : numValue <= 2 ? 'yellow' : 'red';
            }
        }

        if (progressEl) progressEl.textContent = progress.toFixed(1) + '%';
        if (progressBarEl) {
            progressBarEl.style.width = progress + '%';
            const colorClass = statusColor === 'green' ? 'bg-green-500' :
                statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-red-500';
            progressBarEl.className = `h-2.5 rounded-full transition-all duration-500 shadow-sm ${colorClass}`;
        }

        // Update status badge
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.className = `status-badge ${statusColor === 'green' ? 'status-success' : statusColor === 'yellow' ? 'status-warning' : 'status-danger'}`;
        }

        // Trend calculation (simplified - compare with previous period)
        const trend = this.calculateTrend(type, numValue);
        if (trendEl) {
            if (trend > 0) {
                const trendText = type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days')
                    ? 'تراجع' : 'تحسن';
                const trendColor = type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days')
                    ? 'text-red-500' : 'text-green-500';
                trendEl.innerHTML = `<i class="fas fa-arrow-${type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days') ? 'down' : 'up'} ${trendColor}"></i><span class="${trendColor}">${trendText} ${Math.abs(trend).toFixed(1)}%</span>`;
            } else if (trend < 0) {
                const trendText = type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days')
                    ? 'تحسن' : 'تراجع';
                const trendColor = type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days')
                    ? 'text-green-500' : 'text-red-500';
                trendEl.innerHTML = `<i class="fas fa-arrow-${type.includes('injuries') || type.includes('lti') || type.includes('fire') || type.includes('cost') || type.includes('lost-days') ? 'up' : 'down'} ${trendColor}"></i><span class="${trendColor}">${trendText} ${Math.abs(trend).toFixed(1)}%</span>`;
            } else {
                trendEl.innerHTML = `<i class="fas fa-minus text-gray-400"></i><span class="text-gray-500">${this._t('module.kpi.card.noChange','لا يوجد تغيير')}</span>`;
            }
        }
    },

    calculateTrend(type, currentValue) {
        // Simplified trend - in real implementation, compare with previous period
        return 0; // Placeholder
    },

    updateCharts(data, start, end) {
        this.renderIncidentsChart(data, start, end);
        this.renderDepartmentChart(data);
        this.renderTRIRChart(data, start, end);
        this.renderTrainingChart(data, start, end);
        this.renderDepartmentComparison(data);
        this.renderHeatmap(data);
    },

    renderChartNoDataState(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="h-full min-h-[180px] flex items-center justify-center">
                <div class="text-center text-slate-500">
                    <i class="fas fa-chart-line text-2xl mb-2 text-slate-300"></i>
                    <div class="text-sm font-semibold">${message || this._t('module.kpi.chart.noData', 'لا توجد بيانات ضمن الفترة المحددة')}</div>
                </div>
            </div>
        `;
    },

    renderIncidentsChart(data, start, end, containerId = 'incidents-chart-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Group by date
        const incidentsByDate = {};
        data.incidents.forEach(inc => {
            const date = new Date(inc.date || inc.incidentDate || inc.createdAt);
            const dateKey = date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
            incidentsByDate[dateKey] = (incidentsByDate[dateKey] || 0) + 1;
        });

        const labels = Object.keys(incidentsByDate).sort();
        const values = labels.map(label => incidentsByDate[label]);
        if (!labels.length) {
            this.renderChartNoDataState(container, this._t('module.kpi.chart.noIncidents', 'لا توجد حوادث ضمن الفترة المحددة'));
            return;
        }

        const canvasId = `${containerId}-canvas`;
        container.innerHTML = `
            <div class="text-center p-8">
                <canvas id="${canvasId}" style="max-height: 250px;"></canvas>
            </div>
        `;

        // Simple bar chart using CSS
        setTimeout(() => {
            const canvas = document.getElementById(canvasId);
            if (canvas && canvas.getContext) {
                const ctx = canvas.getContext('2d');
                const maxValue = Math.max(...values, 1);
                const barWidth = canvas.width / labels.length;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                values.forEach((val, idx) => {
                    const barHeight = (val / maxValue) * canvas.height * 0.8;
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(idx * barWidth, canvas.height - barHeight, barWidth - 2, barHeight);
                });
            } else {
                // Fallback to HTML/CSS chart
                container.innerHTML = `
                    <div class="space-y-2">
                        ${labels.map((label, idx) => `
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-gray-600 w-20">${label}</span>
                                <div class="flex-1 bg-gray-200 rounded h-4 relative">
                                    <div class="bg-red-500 h-4 rounded" style="width: ${(values[idx] / Math.max(...values, 1)) * 100}%"></div>
                                </div>
                                <span class="text-xs font-semibold w-8">${values[idx]}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }, 100);
    },

    renderDepartmentChart(data, containerId = 'department-chart-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const deptCounts = {};
        data.incidents.forEach(inc => {
            const dept = inc.affectedDepartment || 'غير محدد';
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });

        const total = Object.values(deptCounts).reduce((a, b) => a + b, 0);
        if (!total) {
            this.renderChartNoDataState(container, this._t('module.kpi.chart.noDeptData', 'لا توجد بيانات توزيع إدارات للفترة المحددة'));
            return;
        }

        container.innerHTML = `
            <div class="space-y-3">
                ${Object.entries(deptCounts).map(([dept, count]) => {
            const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            return `
                        <div class="flex items-center gap-3">
                            <div class="flex-1">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-sm font-semibold">${Utils.escapeHTML(dept)}</span>
                                    <span class="text-xs text-gray-600">${percentage}%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                            <span class="text-sm font-bold w-12 text-right">${count}</span>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    renderTRIRChart(data, start, end, containerId = 'trir-chart-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Calculate LTIFR for each month in the period
        const ltifrValues = [];
        const labels = [];
        let current = new Date(start);

        while (current <= end) {
            const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
            const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
            const monthData = this.getFilteredData(monthStart, monthEnd);
            const ltifr = parseFloat(this.calculateLTIFR(monthData));
            ltifrValues.push(ltifr);
            labels.push(current.toLocaleDateString('ar-SA', { month: 'short' }));
            current.setMonth(current.getMonth() + 1);
        }

        const maxValue = Math.max(...ltifrValues, 1);
        container.innerHTML = `
            <div class="space-y-2">
                ${labels.map((label, idx) => `
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-600 w-20">${label}</span>
                        <div class="flex-1 bg-gray-200 rounded h-4 relative">
                            <div class="bg-purple-500 h-4 rounded transition-all" style="width: ${Math.min((ltifrValues[idx] / maxValue) * 100, 100)}%"></div>
                        </div>
                        <span class="text-xs font-semibold w-12">${ltifrValues[idx]}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderTrainingChart(data, start, end, containerId = 'training-chart-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const completed = data.training.filter(tr =>
            (tr.status || '').includes('مكتمل') || (tr.status || '').includes('completed')
        ).length;
        const total = data.training.length;
        const percentage = total > 0 ? ((completed / total) * 100) : 0;

        container.innerHTML = `
            <div class="text-center">
                <div class="relative inline-block">
                    <svg class="transform -rotate-90 w-48 h-48">
                        <circle cx="96" cy="96" r="80" stroke="#e5e7eb" stroke-width="16" fill="none"></circle>
                        <circle cx="96" cy="96" r="80" stroke="#3b82f6" stroke-width="16" fill="none"
                            stroke-dasharray="${2 * Math.PI * 80}"
                            stroke-dashoffset="${2 * Math.PI * 80 * (1 - percentage / 100)}"
                            stroke-linecap="round"></circle>
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="text-center">
                            <div class="text-3xl font-bold text-blue-600">${percentage.toFixed(1)}%</div>
                            <div class="text-sm text-gray-600">${completed} / ${total}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderDepartmentComparison(data, containerId = 'department-comparison-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const deptStats = {};
        const departments = new Set();

        data.incidents.forEach(inc => {
            const dept = inc.affectedDepartment || 'غير محدد';
            departments.add(dept);
            if (!deptStats[dept]) {
                deptStats[dept] = { incidents: 0, nearmiss: 0, training: 0 };
            }
            deptStats[dept].incidents++;
        });

        data.nearmiss.forEach(nm => {
            const dept = nm.department || 'غير محدد';
            departments.add(dept);
            if (!deptStats[dept]) {
                deptStats[dept] = { incidents: 0, nearmiss: 0, training: 0 };
            }
            deptStats[dept].nearmiss++;
        });

        const maxValue = Math.max(...Object.values(deptStats).map(s => s.incidents + s.nearmiss), 1);
        if (!departments.size) {
            this.renderChartNoDataState(container, this._t('module.kpi.chart.noComparisonData', 'لا توجد بيانات مقارنة للإدارات/المواقع في هذه الفترة'));
            return;
        }

        container.innerHTML = `
            <div class="space-y-4">
                ${Array.from(departments).map(dept => {
            const stats = deptStats[dept] || { incidents: 0, nearmiss: 0, training: 0 };
            const total = stats.incidents + stats.nearmiss;
            const width = (total / maxValue) * 100;
            return `
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-sm font-semibold">${Utils.escapeHTML(dept)}</span>
                                <span class="text-xs text-gray-600">${total} حادث</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                                <div class="absolute left-0 top-0 h-full bg-red-500" style="width: ${(stats.incidents / maxValue) * 100}%"></div>
                                <div class="absolute left-0 top-0 h-full bg-orange-500" style="width: ${(stats.nearmiss / maxValue) * 100}%; margin-left: ${(stats.incidents / maxValue) * 100}%"></div>
                            </div>
                            <div class="flex gap-4 mt-1 text-xs text-gray-600">
                                <span>حوادث: ${stats.incidents}</span>
                                <span>وشيكة: ${stats.nearmiss}</span>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    renderHeatmap(data, containerId = 'heatmap-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const deptLocMatrix = {};
        const departments = new Set();
        const locations = new Set();

        data.incidents.forEach(inc => {
            const dept = inc.affectedDepartment || 'غير محدد';
            const loc = inc.location || 'غير محدد';
            departments.add(dept);
            locations.add(loc);
            const key = `${dept}|${loc}`;
            deptLocMatrix[key] = (deptLocMatrix[key] || 0) + 1;
        });

        const maxValue = Math.max(...Object.values(deptLocMatrix), 1);
        if (!departments.size || !locations.size) {
            this.renderChartNoDataState(container, this._t('module.kpi.chart.noHeatmapData', 'لا توجد بيانات كافية لبناء خريطة الحرارة'));
            return;
        }

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse">
                    <thead>
                        <tr>
                            <th class="border p-2 text-sm font-semibold bg-gray-100">الإدارة / الموقع</th>
                            ${Array.from(locations).map(loc => `
                                <th class="border p-2 text-sm font-semibold bg-gray-100">${Utils.escapeHTML(loc)}</th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from(departments).map(dept => `
                            <tr>
                                <td class="border p-2 text-sm font-semibold bg-gray-50">${Utils.escapeHTML(dept)}</td>
                                ${Array.from(locations).map(loc => {
            const key = `${dept}|${loc}`;
            const value = deptLocMatrix[key] || 0;
            const intensity = (value / maxValue) * 100;
            const bgColor = intensity > 75 ? 'bg-red-600' :
                intensity > 50 ? 'bg-orange-500' :
                    intensity > 25 ? 'bg-yellow-400' :
                        'bg-green-400';
            return `
                                        <td class="border p-2 text-center ${bgColor} text-white font-semibold">
                                            ${value}
                                        </td>
                                    `;
        }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    loadKPITargets() {
        const saved = localStorage.getItem('hse_kpi_targets');
        if (saved) {
            try {
                this.kpiTargets = JSON.parse(saved);
            } catch (e) {
                Utils.safeWarn('فشل تحميل أهداف KPIs:', e);
                this.kpiTargets = {};
            }
        }
    },

    saveKPITargets() {
        localStorage.setItem('hse_kpi_targets', JSON.stringify(this.kpiTargets));
    },

    getKPITarget(type) {
        return this.kpiTargets[type] || 0;
    },

    showSettingsModal() {
        const t = (k, f) => this._t(k, f);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;" dir="auto">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-cog ml-2"></i>
                        ${t('module.kpi.settings.title','إعدادات أهداف مؤشرات الأداء')}
                    </h2>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4" style="padding: 1.5rem;">
                    ${this.renderTargetInputs()}
                </div>
                <div class="modal-footer" style="justify-content: flex-start; gap: 0.75rem;">
                    <button id="save-kpi-targets" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>
                        ${t('module.kpi.settings.save','حفظ')}
                    </button>
                    <button class="btn-secondary modal-close">
                        <i class="fas fa-times ml-2"></i>
                        ${t('module.kpi.settings.cancel','إلغاء')}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.getElementById('save-kpi-targets')?.addEventListener('click', () => {
            this.saveTargetsFromModal(modal);
            modal.remove();
        });
    },

    renderTargetInputs() {
        const t = (k, f) => this._t(k, f);
        const leadingTargets = [
            { key: 'inspection-tours', label: t('module.kpi.leading.inspectionTours','الجولات التفتيشية المنفذة'), unit: t('module.kpi.unit.tour','جولة') },
            { key: 'observations', label: t('module.kpi.leading.observations','الملاحظات المسجلة والمعالجة'), unit: t('module.kpi.unit.observation','ملاحظة') },
            { key: 'actions-closure', label: t('module.kpi.leading.actionsClosure','نسبة إغلاق الإجراءات التصحيحية'), unit: '%' },
            { key: 'training-courses', label: t('module.kpi.leading.trainingCourses','الدورات التدريبية المنفذة'), unit: t('module.kpi.unit.course','دورة') },
            { key: 'training-attendance', label: t('module.kpi.leading.trainingAttendance','نسبة حضور الموظفين للتدريب'), unit: '%' },
            { key: 'ptw-approved', label: t('module.kpi.leading.ptwApproved','تصاريح العمل المعتمدة والمنفذة'), unit: t('module.kpi.unit.permit','تصريح') },
            { key: 'ppe-compliance', label: t('module.kpi.leading.ppeCompliance','نسبة الالتزام باستخدام معدات الوقاية'), unit: '%' },
            { key: 'inspections-on-time', label: t('module.kpi.leading.inspectionsOnTime','الفحوصات الدورية المنجزة في الموعد'), unit: t('module.kpi.unit.inspection','فحص') },
            { key: 'safety-meetings', label: t('module.kpi.leading.safetyMeetings','عدد الاجتماعات والتوعيات الخاصة بالسلامة'), unit: t('module.kpi.unit.meeting','اجتماع') }
        ];

        const laggingTargets = [
            { key: 'injuries', label: t('module.kpi.lagging.totalInjuries','عدد الإصابات المسجلة'), unit: t('module.kpi.unit.injury','إصابة') },
            { key: 'lti', label: t('module.kpi.lagging.ltiCount','عدد الإصابات المؤدية لتوقف عن العمل (LTI)'), unit: t('module.kpi.unit.injury','إصابة') },
            { key: 'ltifr', label: t('module.kpi.lagging.ltifr','معدل تكرار الإصابات (LTIFR)'), unit: '' },
            { key: 'severity', label: t('module.kpi.lagging.severityRate','معدل شدة الإصابات'), unit: '%' },
            { key: 'nearmiss-count', label: t('module.kpi.lagging.nearMissCount','عدد الحوادث الوشيكة المسجلة'), unit: t('module.kpi.unit.incident','حادث') },
            { key: 'fire-incidents', label: t('module.kpi.lagging.fireIncidents','عدد الحرائق أو الحوادث في معدات الإطفاء'), unit: t('module.kpi.unit.incident','حادث') },
            { key: 'lost-days', label: t('module.kpi.lagging.lostDays','عدد الأيام المهدورة بسبب الإصابات'), unit: t('module.kpi.unit.day','يوم') },
            { key: 'accident-cost', label: t('module.kpi.lagging.accidentCost','تكلفة الحوادث (مباشرة / غير مباشرة)'), unit: t('module.kpi.unit.sar','ريال') }
        ];

        const placeholder = t('module.kpi.settings.placeholder','الهدف');

        return `
            <div class="space-y-6" dir="auto">
                <!-- Leading Indicators Section -->
                <div>
                    <h3 class="text-lg font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-300">
                        <i class="fas fa-arrow-trend-up ml-2"></i>
                        ${t('module.kpi.settings.leadingSection','المؤشرات الاستباقية')} (Leading Indicators)
                    </h3>
                    <div class="space-y-4">
                        ${leadingTargets.map(item => `
                            <div class="flex items-center gap-3">
                                <label class="flex-1 text-sm font-semibold text-gray-700 min-w-0">${item.label}</label>
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    ${item.unit ? `<span class="text-sm text-gray-600 whitespace-nowrap">${item.unit}</span>` : ''}
                                    <input type="number" 
                                        id="target-${item.key}" 
                                        class="form-input w-32" 
                                        value="${this.kpiTargets[item.key] || ''}" 
                                        placeholder="${placeholder}"
                                        step="0.1"
                                        dir="ltr">
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Lagging Indicators Section -->
                <div>
                    <h3 class="text-lg font-bold text-red-700 mb-4 pb-2 border-b-2 border-red-300">
                        <i class="fas fa-arrow-trend-down ml-2"></i>
                        ${t('module.kpi.settings.laggingSection','المؤشرات التراجعية')} (Lagging Indicators)
                    </h3>
                    <div class="space-y-4">
                        ${laggingTargets.map(item => `
                            <div class="flex items-center gap-3">
                                <label class="flex-1 text-sm font-semibold text-gray-700 min-w-0">${item.label}</label>
                                <div class="flex items-center gap-2 flex-shrink-0">
                                    ${item.unit ? `<span class="text-sm text-gray-600 whitespace-nowrap">${item.unit}</span>` : ''}
                                    <input type="number" 
                                        id="target-${item.key}" 
                                        class="form-input w-32" 
                                        value="${this.kpiTargets[item.key] || ''}" 
                                        placeholder="${placeholder}"
                                        step="0.1"
                                        dir="ltr">
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    saveTargetsFromModal(modal) {
        const leadingTargets = ['inspection-tours', 'observations', 'actions-closure', 'training-courses', 'training-attendance', 'ptw-approved', 'ppe-compliance', 'inspections-on-time', 'safety-meetings'];
        const laggingTargets = ['injuries', 'lti', 'ltifr', 'severity', 'nearmiss-count', 'fire-incidents', 'lost-days', 'accident-cost'];
        const allTargets = [...leadingTargets, ...laggingTargets];

        allTargets.forEach(key => {
            const input = modal.querySelector(`#target-${key}`);
            if (input) {
                const value = parseFloat(input.value);
                if (!isNaN(value) && value >= 0) {
                    this.kpiTargets[key] = value;
                }
            }
        });
        this.saveKPITargets();
        Notification.success(this._t('module.kpi.notify.settingsSaved','تم حفظ الأهداف بنجاح'));
        this.updateAllKPIs();
    },

    getRenderedScorecardTable() {
        return document.querySelector('#spk-scorecard-table-container .spk-scorecard-table');
    },

    getExportableScorecardTable() {
        const table = this.getRenderedScorecardTable();
        if (!table) return null;

        const clone = table.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(field => {
            const cell = field.closest('td, th');
            if (!cell) return;

            let value = '';
            if (field.tagName === 'SELECT') {
                value = field.options[field.selectedIndex]?.text || '';
            } else {
                value = field.value || '';
            }

            cell.textContent = value === '-' ? '' : value;
        });

        return clone;
    },

    exportScorecardToExcel() {
        const table = this.getExportableScorecardTable();
        if (!table || typeof XLSX === 'undefined') {
            Notification.error(this._t('module.kpi.notify.excelError','تعذر تصدير السكور كارد إلى Excel'));
            return;
        }
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.table_to_sheet(table, { raw: true });
        worksheet['!cols'] = [{ wch: 34 }].concat(new Array(12).fill({ wch: 14 }), [{ wch: 18 }]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Safety Scorecard');
        XLSX.writeFile(workbook, `Safety_Performance_Scorecard_${this.scorecardYear}.xlsx`);
        Notification.success(this._t('module.kpi.notify.excelSuccess','تم تصدير Safety Performance Scorecard إلى Excel'));
    },

    exportScorecardToPDF() {
        const table = this.getExportableScorecardTable();
        if (!table) {
            Notification.error(this._t('module.kpi.notify.pdfError','تعذر تصدير السكور كارد إلى PDF'));
            return;
        }

        const reportTitle = `Safety Performance Scorecard ${this.scorecardYear}`;
        const exportDate = new Date().toISOString();
        const styles = document.getElementById('safety-performance-scorecard-styles')?.outerHTML || '';
        const content = `
            ${styles}
            <style>
                .spk-scorecard-print {
                    direction: ltr;
                    font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
                }
                .spk-scorecard-print__meta {
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
                .spk-scorecard-print__meta strong {
                    color: #0F172A;
                }
                .spk-scorecard-table {
                    width: 100%;
                    min-width: auto;
                }
                .spk-scorecard-table th:first-child,
                .spk-scorecard-table td:first-child {
                    position: static;
                }
                @media print {
                    .spk-scorecard-print__meta {
                        break-inside: avoid;
                    }
                }
            </style>
            <div class="spk-scorecard-print" dir="ltr" lang="en">
                <div class="spk-scorecard-print__meta">
                    <div><strong>Report:</strong> Safety Performance Scorecard</div>
                    <div><strong>Year:</strong> ${Utils.escapeHTML(String(this.scorecardYear))}</div>
                    <div><strong>Generated:</strong> ${Utils.escapeHTML(exportDate.slice(0, 10))}</div>
                </div>
                ${table.outerHTML}
            </div>
        `;

        const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
            ? FormHeader.generatePDFHTML(
                `SAFETY-SCORECARD-${this.scorecardYear}`,
                reportTitle,
                content,
                false,
                true,
                {
                    version: '1.0',
                    source: 'SafetyPerformanceScorecard',
                    reportYear: this.scorecardYear,
                    releaseDate: exportDate,
                    revisionDate: exportDate
                },
                exportDate,
                exportDate
            )
            : `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><title>${reportTitle}</title></head><body style="font-family:Arial,'Segoe UI',Tahoma,sans-serif;padding:20px;">${content}</body></html>`;

        const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
            URL.revokeObjectURL(url);
            Notification.error(this._t('module.kpi.notify.pdfBlocked','يرجى السماح بالنوافذ المنبثقة لإتمام تصدير PDF'));
            return;
        }

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 400);
        };
        Notification.success(this._t('module.kpi.notify.pdfSuccess','تم فتح معاينة PDF الخاصة بالسكور كارد'));
    },

    async exportToExcel() {
        try {
            if (!this.isAdminUser()) {
                Notification.error(this._t('module.kpi.notify.excelError','التصدير متاح لمدير النظام فقط'));
                return;
            }
            if (this.activeTab === 'scorecard') {
                this.exportScorecardToExcel();
                return;
            }
            const { start, end } = this.getDateRange();
            const data = this.getFilteredData(start, end);

            // Leading Indicators
            const inspectionTours = this.calculateInspectionTours(data);
            const observations = this.calculateObservationsRecorded(data);
            const actionsClosure = this.calculateCorrectiveActionsClosure(data);
            const trainingCourses = this.calculateTrainingCourses(data);
            const trainingAttendance = this.calculateTrainingAttendance(data);
            const ptwApproved = this.calculatePTWApproved(data);
            const ppeCompliance = this.calculatePPECompliance(data);
            const inspectionsOnTime = this.calculatePeriodicInspectionsOnTime(data);
            const safetyMeetings = this.calculateSafetyMeetings(data);

            // Lagging Indicators
            const totalInjuries = this.calculateTotalInjuries(data);
            const ltiCount = this.calculateLTICount(data);
            const ltifr = this.calculateLTIFR(data);
            const severityRate = this.calculateSeverityRate(data);
            const nearMissCount = this.calculateNearMissCount(data);
            const fireIncidents = this.calculateFireIncidents(data);
            const lostDays = this.calculateLostDays(data);
            const accidentCost = this.calculateAccidentCost(data);

            const kpiData = [
                ['مؤشر الأداء', 'القيمة', 'الهدف', 'نسبة الإنجاز', 'النوع'],
                // Leading Indicators
                ['=== المؤشرات الاستباقية (Leading Indicators) ===', '', '', '', ''],
                ['الجولات التفتيشية المنفذة', inspectionTours.completed, inspectionTours.planned, inspectionTours.percentage + '%', 'استباقي'],
                ['الملاحظات المسجلة والمعالجة', observations.total, observations.processed, observations.percentage + '%', 'استباقي'],
                ['نسبة إغلاق الإجراءات التصحيحية', actionsClosure.percentage + '%', '100%', actionsClosure.percentage + '%', 'استباقي'],
                ['الدورات التدريبية المنفذة', trainingCourses.completed, trainingCourses.total, trainingCourses.percentage + '%', 'استباقي'],
                ['نسبة حضور الموظفين للتدريب', trainingAttendance.percentage + '%', '100%', trainingAttendance.percentage + '%', 'استباقي'],
                ['تصاريح العمل المعتمدة والمنفذة', ptwApproved.approved, ptwApproved.total, ptwApproved.percentage + '%', 'استباقي'],
                ['نسبة الالتزام باستخدام معدات الوقاية', ppeCompliance.percentage + '%', '100%', ppeCompliance.percentage + '%', 'استباقي'],
                ['الفحوصات الدورية المنجزة في الموعد', inspectionsOnTime.onTime, inspectionsOnTime.total, inspectionsOnTime.percentage + '%', 'استباقي'],
                ['عدد الاجتماعات والتوعيات الخاصة بالسلامة', safetyMeetings, this.getKPITarget('safety-meetings'), '', 'استباقي'],
                // Lagging Indicators
                ['=== المؤشرات التراجعية (Lagging Indicators) ===', '', '', '', ''],
                ['عدد الإصابات المسجلة', totalInjuries, this.getKPITarget('injuries'), '', 'تراجعي'],
                ['عدد الإصابات المؤدية لتوقف عن العمل (LTI)', ltiCount, this.getKPITarget('lti'), '', 'تراجعي'],
                ['معدل تكرار الإصابات (LTIFR)', ltifr, this.getKPITarget('ltifr'), '', 'تراجعي'],
                ['معدل شدة الإصابات', severityRate, this.getKPITarget('severity'), '', 'تراجعي'],
                ['عدد الحوادث الوشيكة المسجلة', nearMissCount, this.getKPITarget('nearmiss-count'), '', 'تراجعي'],
                ['عدد الحرائق أو الحوادث في معدات الإطفاء', fireIncidents, this.getKPITarget('fire-incidents'), '', 'تراجعي'],
                ['عدد الأيام المهدورة بسبب الإصابات', lostDays, this.getKPITarget('lost-days'), '', 'تراجعي'],
                ['تكلفة الحوادث (مباشرة / غير مباشرة)', accidentCost, this.getKPITarget('accident-cost'), '', 'تراجعي']
            ];

            if (typeof XLSX !== 'undefined') {
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(kpiData);
                XLSX.utils.book_append_sheet(wb, ws, 'مؤشرات الأداء');
                XLSX.writeFile(wb, `مؤشرات_الأداء_${new Date().toISOString().slice(0, 10)}.xlsx`);
                Notification.success(this._t('module.kpi.notify.excelSuccess','تم تصدير البيانات بنجاح'));
            } else {
                Notification.error(this._t('module.kpi.notify.excelError','مكتبة Excel غير متاحة'));
            }
        } catch (error) {
            Utils.safeError('خطأ في التصدير:', error);
            Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء التصدير: ') + error.message);
        }
    },

    async exportToPDF() {
        try {
            if (!this.isAdminUser()) {
                Notification.error(this._t('module.kpi.notify.pdfError','التصدير متاح لمدير النظام فقط'));
                return;
            }
            if (this.activeTab === 'scorecard') {
                this.exportScorecardToPDF();
                return;
            }
            const { start, end } = this.getDateRange();
            const data = this.getFilteredData(start, end);

            // محاولة استخدام jsPDF أولاً
            if (typeof window.jsPDF !== 'undefined') {
                try {
                    const { jsPDF } = window.jsPDF;
                    const doc = new jsPDF('l', 'mm', 'a4');

                    // Title
                    doc.setFontSize(18);
                    doc.text('مؤشرات الأداء لإدارة السلامة', 150, 15, { align: 'center' });

                    doc.setFontSize(12);
                    doc.text(`الفترة: ${start.toLocaleDateString('ar-SA')} - ${end.toLocaleDateString('ar-SA')}`, 150, 25, { align: 'center' });

                    // Leading Indicators
                    const inspectionTours = this.calculateInspectionTours(data);
                    const observations = this.calculateObservationsRecorded(data);
                    const actionsClosure = this.calculateCorrectiveActionsClosure(data);
                    const trainingCourses = this.calculateTrainingCourses(data);
                    const trainingAttendance = this.calculateTrainingAttendance(data);
                    const ptwApproved = this.calculatePTWApproved(data);
                    const ppeCompliance = this.calculatePPECompliance(data);
                    const inspectionsOnTime = this.calculatePeriodicInspectionsOnTime(data);
                    const safetyMeetings = this.calculateSafetyMeetings(data);

                    // Lagging Indicators
                    const totalInjuries = this.calculateTotalInjuries(data);
                    const ltiCount = this.calculateLTICount(data);
                    const ltifr = this.calculateLTIFR(data);
                    const severityRate = this.calculateSeverityRate(data);
                    const nearMissCount = this.calculateNearMissCount(data);
                    const fireIncidents = this.calculateFireIncidents(data);
                    const lostDays = this.calculateLostDays(data);
                    const accidentCost = this.calculateAccidentCost(data);

                    // KPI Table
                    const tableData = [
                        ['المؤشر', 'القيمة', 'الهدف'],
                        // Leading Indicators
                        ['=== المؤشرات الاستباقية ===', '', ''],
                        ['الجولات التفتيشية المنفذة', inspectionTours.completed, inspectionTours.planned],
                        ['الملاحظات المسجلة والمعالجة', observations.total, observations.processed],
                        ['نسبة إغلاق الإجراءات التصحيحية', actionsClosure.percentage + '%', '100%'],
                        ['الدورات التدريبية المنفذة', trainingCourses.completed, trainingCourses.total],
                        ['نسبة حضور الموظفين للتدريب', trainingAttendance.percentage + '%', '100%'],
                        ['تصاريح العمل المعتمدة والمنفذة', ptwApproved.approved, ptwApproved.total],
                        ['نسبة الالتزام باستخدام معدات الوقاية', ppeCompliance.percentage + '%', '100%'],
                        ['الفحوصات الدورية المنجزة في الموعد', inspectionsOnTime.onTime, inspectionsOnTime.total],
                        ['عدد الاجتماعات والتوعيات الخاصة بالسلامة', safetyMeetings, this.getKPITarget('safety-meetings')],
                        // Lagging Indicators
                        ['=== المؤشرات التراجعية ===', '', ''],
                        ['عدد الإصابات المسجلة', totalInjuries, this.getKPITarget('injuries')],
                        ['عدد الإصابات المؤدية لتوقف عن العمل (LTI)', ltiCount, this.getKPITarget('lti')],
                        ['معدل تكرار الإصابات (LTIFR)', ltifr, this.getKPITarget('ltifr')],
                        ['معدل شدة الإصابات', severityRate, this.getKPITarget('severity')],
                        ['عدد الحوادث الوشيكة المسجلة', nearMissCount, this.getKPITarget('nearmiss-count')],
                        ['عدد الحرائق أو الحوادث في معدات الإطفاء', fireIncidents, this.getKPITarget('fire-incidents')],
                        ['عدد الأيام المهدورة بسبب الإصابات', lostDays, this.getKPITarget('lost-days')],
                        ['تكلفة الحوادث (مباشرة / غير مباشرة)', accidentCost, this.getKPITarget('accident-cost')]
                    ];

                    if (typeof doc.autoTable !== 'undefined') {
                        doc.autoTable({
                            head: [tableData[0]],
                            body: tableData.slice(1),
                            startY: 35,
                            styles: { font: 'Arial', fontSize: 10, halign: 'right' },
                            headStyles: { fillColor: [59, 130, 246], textColor: 255 }
                        });
                    } else {
                        // Fallback: إضافة البيانات كـ text
                        let yPos = 35;
                        tableData.slice(1).forEach(row => {
                            doc.text(row.join(' | '), 20, yPos);
                            yPos += 10;
                        });
                    }

                    doc.save(`مؤشرات_الأداء_${new Date().toISOString().slice(0, 10)}.pdf`);
                    Notification.success(this._t('module.kpi.notify.pdfSuccess','تم تصدير PDF بنجاح'));
                    return;
                } catch (error) {
                    Utils.safeWarn('فشل استخدام jsPDF، سيتم استخدام طريقة HTML:', error);
                }
            }

            // Fallback: استخدام window.open مع HTML
            const inspectionTours = this.calculateInspectionTours(data);
            const observations = this.calculateObservationsRecorded(data);
            const actionsClosure = this.calculateCorrectiveActionsClosure(data);
            const trainingCourses = this.calculateTrainingCourses(data);
            const trainingAttendance = this.calculateTrainingAttendance(data);
            const ptwApproved = this.calculatePTWApproved(data);
            const ppeCompliance = this.calculatePPECompliance(data);
            const inspectionsOnTime = this.calculatePeriodicInspectionsOnTime(data);
            const safetyMeetings = this.calculateSafetyMeetings(data);
            const totalInjuries = this.calculateTotalInjuries(data);
            const ltiCount = this.calculateLTICount(data);
            const ltifr = this.calculateLTIFR(data);
            const severityRate = this.calculateSeverityRate(data);
            const nearMissCount = this.calculateNearMissCount(data);
            const fireIncidents = this.calculateFireIncidents(data);
            const lostDays = this.calculateLostDays(data);
            const accidentCost = this.calculateAccidentCost(data);

            const kpiRows = [
                // Leading Indicators
                ['=== المؤشرات الاستباقية ===', '', ''],
                ['الجولات التفتيشية المنفذة', inspectionTours.completed, inspectionTours.planned],
                ['الملاحظات المسجلة والمعالجة', observations.total, observations.processed],
                ['نسبة إغلاق الإجراءات التصحيحية', actionsClosure.percentage + '%', '100%'],
                ['الدورات التدريبية المنفذة', trainingCourses.completed, trainingCourses.total],
                ['نسبة حضور الموظفين للتدريب', trainingAttendance.percentage + '%', '100%'],
                ['تصاريح العمل المعتمدة والمنفذة', ptwApproved.approved, ptwApproved.total],
                ['نسبة الالتزام باستخدام معدات الوقاية', ppeCompliance.percentage + '%', '100%'],
                ['الفحوصات الدورية المنجزة في الموعد', inspectionsOnTime.onTime, inspectionsOnTime.total],
                ['عدد الاجتماعات والتوعيات الخاصة بالسلامة', safetyMeetings, this.getKPITarget('safety-meetings')],
                // Lagging Indicators
                ['=== المؤشرات التراجعية ===', '', ''],
                ['عدد الإصابات المسجلة', totalInjuries, this.getKPITarget('injuries')],
                ['عدد الإصابات المؤدية لتوقف عن العمل (LTI)', ltiCount, this.getKPITarget('lti')],
                ['معدل تكرار الإصابات (LTIFR)', ltifr, this.getKPITarget('ltifr')],
                ['معدل شدة الإصابات', severityRate, this.getKPITarget('severity')],
                ['عدد الحوادث الوشيكة المسجلة', nearMissCount, this.getKPITarget('nearmiss-count')],
                ['عدد الحرائق أو الحوادث في معدات الإطفاء', fireIncidents, this.getKPITarget('fire-incidents')],
                ['عدد الأيام المهدورة بسبب الإصابات', lostDays, this.getKPITarget('lost-days')],
                ['تكلفة الحوادث (مباشرة / غير مباشرة)', accidentCost, this.getKPITarget('accident-cost')]
            ].map(row => {
                if (row[0].includes('===')) {
                    return `<tr style="background-color: #e5e7eb;"><td colspan="3" style="text-align: center; font-weight: bold; padding: 10px;">${Utils.escapeHTML(row[0])}</td></tr>`;
                }
                return `
                    <tr>
                        <td>${Utils.escapeHTML(row[0])}</td>
                        <td class="text-center">${Utils.escapeHTML(String(row[1]))}</td>
                        <td class="text-center">${Utils.escapeHTML(String(row[2]))}</td>
                    </tr>
                `;
            }).join('');

            const content = `
                <div style="margin-bottom: 20px;">
                    <h3 style="text-align: center; margin-bottom: 10px;">مؤشرات الأداء لإدارة السلامة</h3>
                    <p style="text-align: center; color: #666;">
                        الفترة: ${start.toLocaleDateString('ar-SA')} - ${end.toLocaleDateString('ar-SA')}
                    </p>
                </div>
                <table class="report-table" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #3b82f6; color: white;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">المؤشر</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">القيمة</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">الهدف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${kpiRows}
                    </tbody>
                </table>
            `;

            const html = PDFTemplates.buildDocument({
                title: 'مؤشرات الأداء لإدارة السلامة',
                formCode: 'KPI-REPORT',
                content,
                createdAt: new Date(),
                meta: {
                    'الفترة': `${start.toLocaleDateString('ar-SA')} - ${end.toLocaleDateString('ar-SA')}`,
                    'عدد المؤشرات': '17',
                    'المؤشرات الاستباقية': '9',
                    'المؤشرات التراجعية': '8'
                }
            });

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Notification.error(this._t('module.kpi.notify.pdfBlocked','يرجى السماح للنوافذ المنبثقة للطباعة'));
                return;
            }

            printWindow.document.write(html);
            printWindow.document.close();

            setTimeout(() => {
                printWindow.print();
            }, 500);

            Notification.success(this._t('module.kpi.notify.targetsSuccess','تم فتح نافذة الطباعة. يمكنك حفظها كـ PDF من قائمة الطباعة.'));
        } catch (error) {
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error(this._t('module.kpi.notify.targetsError','حدث خطأ أثناء تصدير PDF: ') + error.message);
        }
    }
};

SafetyPerformanceKPIs.renderOverviewMiniStat = function (id, label, icon, tone, unit) {
    return `
        <div class="rounded-[24px] border border-white/80 bg-white/92 p-4" style="box-shadow: 0 14px 35px rgba(15,23,42,0.08);">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">${unit}</div>
                    <div class="mt-2 text-sm font-bold text-slate-700">${label}</div>
                </div>
                <div class="h-11 w-11 rounded-2xl flex items-center justify-center text-${tone}-600 bg-${tone}-50 border border-${tone}-100">
                    <i class="fas ${icon}"></i>
                </div>
            </div>
            <div class="mt-5 flex items-end gap-2">
                <span id="${id}" class="text-3xl font-black text-slate-900">-</span>
                <span class="text-sm font-semibold text-slate-400">${unit}</span>
            </div>
        </div>
    `;
};

SafetyPerformanceKPIs.renderOverviewChartCard = function (containerId, title, icon, tone, description) {
    return `
        <div class="content-card overflow-hidden" style="border: 1px solid rgba(148,163,184,0.14); box-shadow: 0 18px 38px rgba(15,23,42,0.06);">
            <div class="card-header" style="background: linear-gradient(135deg, rgba(255,255,255,0.94), rgba(248,250,252,0.96)); border-bottom: 1px solid rgba(148,163,184,0.14);">
                <div class="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 class="card-title text-slate-900">
                            <i class="fas ${icon} ml-2 text-${tone}-600"></i>
                            ${title}
                        </h2>
                        <p class="text-sm text-slate-500 mt-2">${description}</p>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div id="${containerId}" style="height: 300px;"></div>
            </div>
        </div>
    `;
};

SafetyPerformanceKPIs.renderKPICard = function (id, label, type, icon, color, defaultUnit = '') {
    const t = (k, f) => SafetyPerformanceKPIs._t(k, f);
    const ringColor = color.includes('red') || color.includes('rose')
        ? 'rgba(244,63,94,0.22)'
        : color.includes('orange') || color.includes('yellow')
            ? 'rgba(245,158,11,0.22)'
            : 'rgba(16,185,129,0.22)';

    return `
        <article class="group rounded-[26px] border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1" style="box-shadow: 0 16px 40px rgba(15,23,42,0.07);">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">${type}</div>
                    <h3 class="mt-2 text-sm font-bold leading-6 text-slate-800">${label}</h3>
                    <p class="text-xs text-slate-500 mt-2" id="${id}-period">${t('module.kpi.card.thisMonth','هذا الشهر')}</p>
                </div>
                <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-${color}-600 bg-${color}-50 border border-${color}-100 shrink-0" style="box-shadow: inset 0 0 0 1px ${ringColor};">
                    <i class="fas ${icon} text-lg"></i>
                </div>
            </div>

            <div class="mt-6">
                <div class="flex items-end justify-between gap-3 flex-wrap">
                    <div class="flex items-end gap-2">
                        <span class="text-4xl font-black text-slate-900 leading-none" id="${id}-value">-</span>
                        <span class="text-sm font-bold text-slate-400 pb-1" id="${id}-unit">${defaultUnit}</span>
                    </div>
                    <div class="status-badge status-success" id="${id}-status" style="display:none;"></div>
                </div>

                <div class="mt-5 grid grid-cols-2 gap-3">
                    <div class="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3">
                        <div class="text-[11px] font-bold text-slate-500">${t('module.kpi.hero.target','الهدف')}</div>
                        <div class="mt-1 text-sm font-black text-slate-800" id="${id}-target">-</div>
                    </div>
                    <div class="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3">
                        <div class="text-[11px] font-bold text-slate-500">${t('module.kpi.card.achievement','الإنجاز')}</div>
                        <div class="mt-1 text-sm font-black text-slate-800" id="${id}-progress">-</div>
                    </div>
                </div>

                <div class="mt-5">
                    <div class="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div class="h-full rounded-full bg-${color}-500 transition-all duration-500" id="${id}-progress-bar" style="width:0%"></div>
                    </div>
                </div>

                <div class="mt-4 flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2 text-xs" id="${id}-trend">
                        <i class="fas fa-minus text-slate-400"></i>
                        <span class="text-slate-500">${t('module.kpi.card.noChange','لا يوجد تغيير')}</span>
                    </div>
                </div>
            </div>
        </article>
    `;
};

SafetyPerformanceKPIs.render = async function () {
    const t = (k, f) => SafetyPerformanceKPIs._t(k, f);
    return `
        <div class="section-header">
            <div class="flex items-center justify-between flex-wrap gap-4">
                <div class="min-w-0">
                    <h1 class="section-title">
                        <i class="fas fa-gauge-high ml-3"></i>
                        ${t('module.kpi.title','مؤشرات الأداء لإدارة السلامة')}
                    </h1>
                    <p class="section-subtitle">${t('module.kpi.subtitle','رصد وتحليل مؤشرات أداء السلامة والصحة المهنية')}</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button id="kpis-export-excel-btn" class="btn-success" title="${t('module.kpi.exportExcel','تصدير Excel')}">
                        <i class="fas fa-file-excel ml-2"></i>
                        ${t('module.kpi.common.excel','Excel')}
                    </button>
                    <button id="kpis-export-pdf-btn" class="btn-secondary">
                        <i class="fas fa-file-pdf ml-2"></i>
                        ${t('module.kpi.exportPDF','تصدير PDF')}
                    </button>
                    <button id="kpis-settings-btn" class="btn-primary">
                        <i class="fas fa-cog ml-2"></i>
                        ${t('module.kpi.settings','إعدادات الأهداف')}
                    </button>
                </div>
            </div>
        </div>

        <div class="content-card mt-6 overflow-hidden" style="border: 1px solid rgba(148,163,184,0.18); box-shadow: 0 24px 50px rgba(15,23,42,0.08);">
            <div class="card-body" style="background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 45%, #ffffff 100%);">
                <div class="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-6 items-start">
                    <div class="min-w-0">
                        <div class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-sky-700 bg-sky-100 border border-sky-200">
                            <i class="fas fa-wave-square"></i>
                            ${t('module.kpi.tab.kpisOverview','نظرة عامة — KPIs')}
                        </div>
                        <h2 class="mt-4 text-3xl font-black text-slate-900 leading-tight">${t('module.kpi.overview.headline','لوحة متابعة يومية لمؤشرات السلامة')}</h2>
                        <p class="mt-3 text-sm text-slate-600 leading-7">${t('module.kpi.overview.intro','واجهة وصول سريع للمؤشرات والاتجاهات، مع نفس آلية التحديث والتكامل داخل التطبيق.')}</p>
                        <div class="mt-5 flex flex-wrap gap-3">
                            <div class="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 min-w-[180px]">
                                <div class="text-xs font-semibold text-slate-500">${t('module.kpi.overview.activePeriod','الفترة النشطة')}</div>
                                <div class="mt-1 text-sm font-bold text-slate-900" id="overview-period-label">${t('module.kpi.filter.monthly','شهري')}</div>
                            </div>
                            <div class="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 min-w-[220px]">
                                <div class="text-xs font-semibold text-slate-500">${t('module.kpi.overview.timeRange','النطاق الزمني')}</div>
                                <div class="mt-1 text-sm font-bold text-slate-900" id="overview-range-label">-</div>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-[28px] border border-slate-200 bg-white/92 p-4" style="box-shadow: 0 18px 40px rgba(15,23,42,0.08);">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 class="text-base font-black text-slate-900">${t('module.kpi.overview.quickFilterTitle','تصفية وبحث سريع')}</h3>
                                <p class="text-xs text-slate-500 mt-1">${t('module.kpi.overview.quickFilterHint','تصفية المؤشرات حسب الفترة أو الإدارة أو الموقع.')}</p>
                            </div>
                            <div class="h-10 w-10 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
                                <i class="fas fa-sliders"></i>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.period','الفترة الزمنية')}</label>
                                <select id="kpi-filter-period" class="form-input">
                                    <option value="monthly">${t('module.kpi.filter.monthly','شهري')}</option>
                                    <option value="quarterly">${t('module.kpi.filter.quarterly','ربع سنوي')}</option>
                                    <option value="yearly">${t('module.kpi.filter.yearly','سنوي')}</option>
                                    <option value="custom">${t('module.kpi.filter.custom','مخصص')}</option>
                                </select>
                            </div>
                            <div id="kpi-custom-dates" class="hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.fromDate','من تاريخ')}</label>
                                <input type="date" id="kpi-filter-start-date" class="form-input">
                            </div>
                            <div id="kpi-custom-dates-end" class="hidden">
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.toDate','إلى تاريخ')}</label>
                                <input type="date" id="kpi-filter-end-date" class="form-input">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.department','الإدارة')}</label>
                                <select id="kpi-filter-department" class="form-input">
                                    <option value="">${t('module.kpi.filter.allDepartments','جميع الإدارات')}</option>
                                    ${this.getDepartmentOptions()}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.filter.location','الموقع')}</label>
                                <select id="kpi-filter-location" class="form-input">
                                    <option value="">${t('module.kpi.filter.allLocations','جميع المواقع')}</option>
                                    ${this.getLocationOptions()}
                                </select>
                            </div>
                        </div>
                        <div class="mt-4 flex gap-2 flex-wrap">
                            <button id="kpi-apply-filters" class="btn-primary">
                                <i class="fas fa-search ml-2"></i>
                                ${t('module.kpi.filter.apply','تطبيق التصفية')}
                            </button>
                            <button id="kpi-reset-filters" class="btn-secondary">
                                <i class="fas fa-redo ml-2"></i>
                                ${t('module.kpi.filter.reset','إعادة تعيين')}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
                    ${this.renderOverviewMiniStat('overview-incidents-total', t('module.kpi.overview.mini.incidents','إجمالي الحوادث والإصابات'), 'fa-triangle-exclamation', 'rose', t('module.kpi.overview.unit.record','سجل'))}
                    ${this.renderOverviewMiniStat('overview-observations-total', t('module.kpi.overview.mini.observations','الملاحظات والحوادث الوشيكة'), 'fa-binoculars', 'amber', t('module.kpi.overview.unit.case','حالة'))}
                    ${this.renderOverviewMiniStat('overview-training-total', t('module.kpi.overview.mini.training','برامج التدريب المنفذة'), 'fa-graduation-cap', 'emerald', t('module.kpi.overview.unit.program','برنامج'))}
                    ${this.renderOverviewMiniStat('overview-ptw-total', t('module.kpi.overview.mini.ptw','تصاريح العمل النشطة'), 'fa-id-badge', 'indigo', t('module.kpi.overview.unit.permitU','تصريح'))}
                </div>

                <div class="mt-5 flex flex-wrap gap-3">
                    <button class="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-sky-200 hover:text-sky-700" data-kpi-jump="leading-kpis-section">
                        <i class="fas fa-arrow-trend-up ml-2 text-emerald-600"></i>
                        ${t('module.kpi.leading.title','المؤشرات الاستباقية')}
                    </button>
                    <button class="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:text-rose-700" data-kpi-jump="lagging-kpis-section">
                        <i class="fas fa-arrow-trend-down ml-2 text-rose-600"></i>
                        ${t('module.kpi.lagging.title','المؤشرات التراجعية')}
                    </button>
                    <button class="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700" data-kpi-jump="charts-kpis-section">
                        <i class="fas fa-chart-line ml-2 text-indigo-600"></i>
                        ${t('module.kpi.overview.jump.charts','الرسوم والتحليلات')}
                    </button>
                    <button class="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-amber-200 hover:text-amber-700" data-kpi-jump="comparison-kpis-section">
                        <i class="fas fa-table-cells-large ml-2 text-amber-600"></i>
                        ${t('module.kpi.overview.jump.comparison','المقارنات وخريطة الحرارة')}
                    </button>
                </div>
            </div>
        </div>

        <div id="leading-kpis-section" class="mt-6 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div class="content-card overflow-hidden" style="border: 1px solid rgba(16,185,129,0.18); box-shadow: 0 18px 42px rgba(16,185,129,0.08);">
                <div class="card-header" style="background: linear-gradient(135deg, rgba(16,185,129,0.16), rgba(16,185,129,0.06)); border-bottom: 1px solid rgba(16,185,129,0.18);">
                    <div class="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h2 class="card-title text-emerald-900">
                                <i class="fas fa-arrow-trend-up ml-2"></i>
                                ${t('module.kpi.leading.title','المؤشرات الاستباقية')}
                            </h2>
                            <p class="text-sm text-emerald-800 mt-2">${t('module.kpi.leading.subtitle','مؤشرات تقيس أداء الوقاية والتحكم قبل وقوع الحوادث')}</p>
                        </div>
                        <div class="rounded-2xl bg-white/90 px-3 py-2 text-xs font-bold text-emerald-700 border border-emerald-100">${t('module.kpi.leading.badge','استباقي')}</div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="leading-indicators-container" class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                        ${this.renderLeadingIndicators()}
                    </div>
                </div>
            </div>

            <div id="lagging-kpis-section" class="content-card overflow-hidden" style="border: 1px solid rgba(244,63,94,0.18); box-shadow: 0 18px 42px rgba(244,63,94,0.08);">
                <div class="card-header" style="background: linear-gradient(135deg, rgba(244,63,94,0.16), rgba(244,63,94,0.06)); border-bottom: 1px solid rgba(244,63,94,0.18);">
                    <div class="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h2 class="card-title text-rose-900">
                                <i class="fas fa-arrow-trend-down ml-2"></i>
                                ${t('module.kpi.lagging.title','المؤشرات التراجعية')}
                            </h2>
                            <p class="text-sm text-rose-800 mt-2">${t('module.kpi.lagging.subtitle','مؤشرات تقيس النتائج الفعلية لما حدث')}</p>
                        </div>
                        <div class="rounded-2xl bg-white/90 px-3 py-2 text-xs font-bold text-rose-700 border border-rose-100">${t('module.kpi.lagging.badge','تراجعي')}</div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="lagging-indicators-container" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4">
                        ${this.renderLaggingIndicators()}
                    </div>
                </div>
            </div>
        </div>

        <div id="charts-kpis-section" class="mt-6">
            <div class="flex items-center justify-between gap-4 flex-wrap mb-4">
                <div>
                    <h2 class="text-xl font-black text-slate-900">
                        <i class="fas fa-chart-line ml-2 text-sky-600"></i>
                        ${t('module.kpi.chart.title','الرسوم البيانية والتحليلات')}
                    </h2>
                    <p class="text-sm text-slate-500 mt-1"></p>
                </div>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                ${this.renderOverviewChartCard('incidents-chart-container', t('module.kpi.chart.incidents','الحوادث والإصابات الشهرية'), 'fa-chart-column', 'rose', t('module.kpi.overview.chartDesc.incidents','اتجاه الحوادث والإصابات خلال الفترة.'))}
                ${this.renderOverviewChartCard('department-chart-container', t('module.kpi.chart.deptDistribution','توزيع الحوادث حسب الإدارة'), 'fa-chart-pie', 'blue', t('module.kpi.overview.chartDesc.dept','الإدارات الأعلى تعرضاً ومتابعة بؤر المخاطر.'))}
                ${this.renderOverviewChartCard('trir-chart-container', t('module.kpi.chart.ltifr','معدل LTIFR عبر الزمن'), 'fa-chart-line', 'violet', t('module.kpi.overview.chartDesc.ltifr','تغيّر مؤشرات الإصابات عبر الفترات.'))}
                ${this.renderOverviewChartCard('training-chart-container', t('module.kpi.chart.training','معدل الالتزام بالتدريب'), 'fa-chart-area', 'emerald', t('module.kpi.overview.chartDesc.training','تقدم التدريب ومستوى الالتزام.'))}
            </div>
        </div>

        <div id="comparison-kpis-section" class="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mt-6">
            <div class="content-card overflow-hidden">
                <div class="card-header" style="background: linear-gradient(135deg, rgba(15,23,42,0.04), rgba(59,130,246,0.06));">
                    <h2 class="card-title text-slate-900">
                        <i class="fas fa-balance-scale ml-2 text-sky-700"></i>
                        ${t('module.kpi.chart.deptComparison','مقارنة بين الإدارات / المواقع')}
                    </h2>
                    <p class="text-sm text-slate-500 mt-2">${t('module.kpi.overview.comparisonSub','مقارنة مباشرة لاكتشاف الفجوات وفرص التحسين.')}</p>
                </div>
                <div class="card-body">
                    <div id="department-comparison-container" style="height: 400px;"></div>
                </div>
            </div>

            <div class="content-card overflow-hidden">
                <div class="card-header" style="background: linear-gradient(135deg, rgba(15,23,42,0.04), rgba(244,63,94,0.06));">
                    <h2 class="card-title text-slate-900">
                        <i class="fas fa-th ml-2 text-rose-600"></i>
                        ${t('module.kpi.chart.heatmapTitle','خريطة الحرارة')}
                    </h2>
                    <p class="text-sm text-slate-500 mt-2">${t('module.kpi.overview.heatmapSub','عرض بصري لمناطق الكثافة في الأداء والمخاطر.')}</p>
                </div>
                <div class="card-body">
                    <div id="heatmap-container"></div>
                </div>
            </div>
        </div>
    `;
};

SafetyPerformanceKPIs.updateOverviewQuickStats = function () {
    const { start, end } = this.getDateRange();
    const data = this.getFilteredData(start, end);
    const t = (k, f) => this._t(k, f);
    const periodLabels = {
        monthly: t('module.kpi.filter.monthly', 'شهري'),
        quarterly: t('module.kpi.filter.quarterly', 'ربع سنوي'),
        yearly: t('module.kpi.filter.yearly', 'سنوي'),
        custom: t('module.kpi.filter.custom', 'مخصص')
    };

    const incidentsTotal = (data.incidents || []).length + (data.medicalInjuries || []).length;
    const observationsTotal = (data.nearmiss || []).length + (data.dailyObservations || []).length;
    const trainingTotal = (data.training || []).length;
    const permitsTotal = (data.ptw || []).length;

    const setText = (id, value) => {
        const node = document.getElementById(id);
        if (node) node.textContent = value;
    };

    const loc = (window.AppI18n && window.AppI18n.getCurrentLang && window.AppI18n.getCurrentLang() === 'en') ? 'en-US' : 'ar-SA';
    const formatRange = `${start.toLocaleDateString(loc)} - ${end.toLocaleDateString(loc)}`;
    setText('overview-period-label', periodLabels[this.filters.period] || periodLabels.monthly);
    setText('overview-range-label', formatRange);
    setText('overview-incidents-total', incidentsTotal.toLocaleString(loc));
    setText('overview-observations-total', observationsTotal.toLocaleString(loc));
    setText('overview-training-total', trainingTotal.toLocaleString(loc));
    setText('overview-ptw-total', permitsTotal.toLocaleString(loc));
};

const __originalSafetyPerformanceKPIsUpdateAllKPIs = SafetyPerformanceKPIs.updateAllKPIs;
SafetyPerformanceKPIs.updateAllKPIs = function () {
    __originalSafetyPerformanceKPIsUpdateAllKPIs.call(this);
    this.updateOverviewQuickStats();
};

const __originalSafetyPerformanceKPIsSetupEventListeners = SafetyPerformanceKPIs.setupEventListeners;
SafetyPerformanceKPIs.setupEventListeners = function () {
    __originalSafetyPerformanceKPIsSetupEventListeners.call(this);

    document.querySelectorAll('[data-kpi-jump]').forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-kpi-jump');
            const target = targetId ? document.getElementById(targetId) : null;
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
};

SafetyPerformanceKPIs.getScorecardExportHeaderInfo = function (reportTitle, exportDate = new Date()) {
    const companyName = String(AppState?.companySettings?.name || AppState?.companyName || 'Americana HSE Management System').trim();
    const secondaryName = String(AppState?.companySettings?.secondaryName || 'إدارة السلامة والصحة المهنية والبيئة').trim();
    const exportDateTime = (typeof Utils !== 'undefined' && typeof Utils.formatDateTime === 'function')
        ? Utils.formatDateTime(exportDate)
        : new Date(exportDate).toISOString().slice(0, 19).replace('T', ' ');
    return { companyName, secondaryName, reportTitle, exportDateTime };
};

SafetyPerformanceKPIs.buildScorecardExcelWorksheet = function (tableRows, reportTitle, exportDate = new Date()) {
    const info = this.getScorecardExportHeaderInfo(reportTitle, exportDate);
    const columnCount = Math.max(...tableRows.map(row => Array.isArray(row) ? row.length : 0), 1);
    const aoa = [
        [info.companyName],
        [info.secondaryName],
        [info.reportTitle],
        [`Year: ${this.scorecardYear} | Generated: ${info.exportDateTime}`],
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
    worksheet['!cols'] = [{ wch: 34 }].concat(new Array(12).fill({ wch: 14 }), [{ wch: 18 }]);
    return worksheet;
};

SafetyPerformanceKPIs.exportScorecardToExcel = function () {
    const table = this.getExportableScorecardTable();
    if (!table || typeof XLSX === 'undefined') {
        Notification.error(this._t('module.kpi.notify.excelError','تعذر تصدير السكور كارد إلى Excel'));
        return;
    }

    const baseSheet = XLSX.utils.table_to_sheet(table, { raw: true });
    const tableRows = XLSX.utils.sheet_to_json(baseSheet, { header: 1, raw: false, blankrows: true });
    const workbook = XLSX.utils.book_new();
    const worksheet = this.buildScorecardExcelWorksheet(
        tableRows,
        `Safety Performance Scorecard ${this.scorecardYear}`,
        new Date()
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Safety Scorecard');
    XLSX.writeFile(workbook, `Safety_Performance_Scorecard_${this.scorecardYear}.xlsx`);
    Notification.success(this._t('module.kpi.notify.excelSuccess','تم تصدير Safety Performance Scorecard إلى Excel'));
};

SafetyPerformanceKPIs.exportScorecardToPDF = function () {
    const table = this.getExportableScorecardTable();
    if (!table) {
        Notification.error(this._t('module.kpi.notify.pdfError','تعذر تصدير السكور كارد إلى PDF'));
        return;
    }

    const reportTitle = `Safety Performance Scorecard ${this.scorecardYear}`;
    const exportDate = new Date().toISOString();
    const styles = document.getElementById('safety-performance-scorecard-styles')?.outerHTML || '';
    const content = `
        ${styles}
        <style>
            @page {
                size: A4 landscape;
                margin: 12mm 10mm;
            }
            .report-wrapper {
                width: 100% !important;
                max-width: 100% !important;
                padding: 18px 16px !important;
            }
            .report-header {
                grid-template-columns: minmax(220px, 1.2fr) minmax(360px, 2fr) minmax(90px, 120px) !important;
                gap: 16px !important;
            }
            .report-footer,
            .footer-watermark-frame,
            .footer-bottom,
            .footer-meta-line {
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
            }
            .footer-meta-line {
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 12px !important;
            }
            .spk-scorecard-print {
                direction: ltr;
                font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
                width: 100%;
            }
            .spk-scorecard-print__meta {
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
            .spk-scorecard-print__meta strong {
                color: #0F172A;
            }
            .spk-scorecard-table {
                width: 100%;
                min-width: auto;
                table-layout: fixed;
            }
            .spk-scorecard-table th:first-child,
            .spk-scorecard-table td:first-child {
                position: static;
            }
            .spk-scorecard-table th,
            .spk-scorecard-table td {
                font-size: 10px !important;
                padding: 6px 5px !important;
            }
            @media print {
                .spk-scorecard-print__meta {
                    break-inside: avoid;
                }
            }
        </style>
        <div class="spk-scorecard-print" dir="ltr" lang="en">
            <div class="spk-scorecard-print__meta">
                <div><strong>Report:</strong> Safety Performance Scorecard</div>
                <div><strong>Year:</strong> ${Utils.escapeHTML(String(this.scorecardYear))}</div>
                <div><strong>Generated:</strong> ${Utils.escapeHTML(exportDate.slice(0, 10))}</div>
            </div>
            ${table.outerHTML}
        </div>
    `;

    const htmlContent = (typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function')
        ? FormHeader.generatePDFHTML(
            `SAFETY-SCORECARD-${this.scorecardYear}`,
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
        : `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="UTF-8"><title>${reportTitle}</title></head><body style="font-family:Arial,'Segoe UI',Tahoma,sans-serif;padding:20px;">${content}</body></html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (!printWindow) {
        URL.revokeObjectURL(url);
        Notification.error(SafetyPerformanceKPIs._t('module.kpi.notify.pdfBlocked','يرجى السماح بالنوافذ المنبثقة لإتمام تصدير PDF'));
        return;
    }

    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.print();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 400);
    };
    Notification.success(SafetyPerformanceKPIs._t('module.kpi.notify.pdfSuccess','تم فتح معاينة PDF الخاصة بالسكور كارد'));
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof SafetyPerformanceKPIs !== 'undefined') {
            window.SafetyPerformanceKPIs = SafetyPerformanceKPIs;

            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ SafetyPerformanceKPIs module loaded and available on window.SafetyPerformanceKPIs');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير SafetyPerformanceKPIs:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof SafetyPerformanceKPIs !== 'undefined') {
            try {
                window.SafetyPerformanceKPIs = SafetyPerformanceKPIs;
            } catch (e) {
                console.error('❌ فشل تصدير SafetyPerformanceKPIs:', e);
            }
        }
    }
})();

// ===== KPI Annual Plan Methods =====
SafetyPerformanceKPIs.loadKPIAnnualPlans = async function() {
    try {
        const yearSelector = document.getElementById('kpi-annual-year-selector');
        const year = yearSelector ? parseInt(yearSelector.value) : new Date().getFullYear();
        
        const response = await GoogleIntegration.callBackend('getKPIAnnualPlans', { filters: { year } });
        
        if (response && response.success) {
            this.renderKPIAnnualPlanTable(response.data || []);
        } else {
            throw new Error(response?.message || 'Failed to load KPI annual plans');
        }
    } catch (error) {
        console.error('Error loading KPI annual plans:', error);
        const tbody = document.getElementById('kpi-annual-plan-body');
        if (tbody) {
            const errMsg = SafetyPerformanceKPIs._t('module.kpi.loadError','حدث خطأ في تحميل البيانات');
            const retryLbl = SafetyPerformanceKPIs._t('module.kpi.retry','إعادة المحاولة');
            tbody.innerHTML = `
                <tr>
                    <td colspan="20" style="padding: 40px; text-align: center; color: #6b7280;">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3 text-yellow-500"></i>
                        <p>${errMsg}</p>
                        <p class="text-sm mt-2">${Utils.escapeHTML(error.message || '')}</p>
                        <button onclick="SafetyPerformanceKPIs.loadKPIAnnualPlans()" class="btn-primary mt-4">
                            <i class="fas fa-redo ml-2"></i>
                            ${retryLbl}
                        </button>
                    </td>
                </tr>
            `;
        }
    }
};

SafetyPerformanceKPIs.renderKPIAnnualPlanTable = function(data) {
    const tbody = document.getElementById('kpi-annual-plan-body');
    if (!tbody) return;

    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const isReadOnly = (typeof window !== 'undefined' && typeof window.isReadOnlyRole === 'function') 
        ? window.isReadOnlyRole() 
        : false;
    const canEdit = !isReadOnly && (this.isAdminUser() || (typeof Permissions !== 'undefined' && Permissions.hasAccess('kpi-annual-plan')));

    if (!data || data.length === 0) {
        const colSpan = canEdit ? 21 : 20;
        const noDataMsg = this._t('module.kpi.annual.noData','لا توجد بيانات - اضغط على "إضافة مؤشر جديد" للبدء');
        tbody.innerHTML = `
            <tr>
                <td colspan="${colSpan}" style="padding: 40px; text-align: center; color: #6b7280;">
                    <i class="fas fa-inbox text-3xl mb-3"></i>
                    <p>${noDataMsg}</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(plan => {
        const total = months.reduce((sum, m) => sum + (parseFloat(plan[m]) || 0), 0);
        const indicatorType = plan.indicatorType || 'Leading';
        const typeBadge = indicatorType === 'Leading' 
            ? '<span class="badge bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">📈 Leading</span>'
            : '<span class="badge bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">📉 Lagging</span>';
        
        return `
            <tr class="hover:bg-blue-50 transition-colors">
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${typeBadge}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${Utils.escapeHTML(plan.objective || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${Utils.escapeHTML(plan.kpi || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${Utils.escapeHTML(plan.target || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${Utils.escapeHTML(plan.goal || '-')}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; max-width: 250px; overflow-wrap: break-word;">${Utils.escapeHTML(plan.improvementPlan || '-')}</td>
                ${months.map(m => `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${plan[m] || '0'}</td>`).join('')}
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold; background: #fef3c7;">${total}</td>
                ${canEdit ? `
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">
                    <button onclick="SafetyPerformanceKPIs.editKPIAnnualPlan('${plan.id}')" class="text-blue-600 hover:text-blue-800 mx-1" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="SafetyPerformanceKPIs.deleteKPIAnnualPlan('${plan.id}')" class="text-red-600 hover:text-red-800 mx-1" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
                ` : ''}
            </tr>
        `;
    }).join('');
};

SafetyPerformanceKPIs.addKPIAnnualPlan = function() {
    const t = (k, f) => this._t(k, f);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = new Date().getFullYear();
    
    const panel = document.getElementById('spk-annual-plan-panel');
    if (!panel) return;
    
    panel.innerHTML = `
        <div class="content-card">
            <div class="card-header bg-gradient-to-r from-blue-50 to-indigo-50 border-b-4 border-blue-600">
                <div class="flex items-center justify-between">
                    <h2 class="card-title text-blue-800">
                        <i class="fas fa-plus-circle ml-2"></i>
                        ${t('module.kpi.annual.form.title.add','إضافة مؤشر KPI جديد')} - ${year}
                    </h2>
                    <button onclick="SafetyPerformanceKPIs.cancelAddKPIAnnualPlan()" class="btn-secondary">
                        <i class="fas fa-times ml-2"></i>
                        ${t('module.kpi.annual.form.cancel','إلغاء')}
                    </button>
                </div>
            </div>
            <div class="card-body">
                <form id="kpi-annual-plan-form" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.annual.form.type','نوع المؤشر')} *</label>
                            <select id="kpi-plan-indicator-type" class="form-input" required>
                                <option value="Leading">📈 Leading - ${t('module.kpi.annual.form.leading','استباقي')}</option>
                                <option value="Lagging">📉 Lagging - ${t('module.kpi.annual.form.lagging','تراجعي')}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.annual.form.objective','الهدف الاستراتيجي')} *</label>
                            <input type="text" id="kpi-plan-objective" class="form-input" placeholder="e.g., HSE Trainings" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.annual.form.kpi','المؤشر (KPI)')} *</label>
                            <input type="text" id="kpi-plan-kpi" class="form-input" placeholder="e.g., Number of unique employees attended" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.annual.form.target','المستهدف')}</label>
                            <input type="text" id="kpi-plan-target" class="form-input" placeholder="e.g., Training program for employees">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.annual.form.goal','الغاية')}</label>
                            <input type="text" id="kpi-plan-goal" class="form-input" placeholder="e.g., 300">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">${t('module.kpi.annual.form.improvement','خطة التحسين')}</label>
                        <textarea id="kpi-plan-improvement" class="form-input" rows="3" placeholder="Describe the improvement plan..."></textarea>
                    </div>
                    
                    <h3 class="text-lg font-bold mt-6 mb-4 border-t pt-4">${t('module.kpi.annual.form.monthlyValues','القيم الشهرية')} - ${year}</h3>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        ${months.map(m => `
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">${m}</label>
                                <input type="number" id="kpi-plan-${m.toLowerCase()}" class="form-input" value="0" min="0">
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="flex gap-3 mt-6 pt-4 border-t">
                        <button type="button" id="kpi-save-btn" onclick="SafetyPerformanceKPIs.saveKPIAnnualPlan()" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            <span id="kpi-save-text">${t('module.kpi.annual.form.save','حفظ المؤشر')}</span>
                        </button>
                        <button type="button" onclick="SafetyPerformanceKPIs.cancelAddKPIAnnualPlan()" class="btn-secondary">
                            <i class="fas fa-times ml-2"></i>
                            ${t('module.kpi.annual.form.cancel','إلغاء')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    if (window.AppI18n?.applyModuleI18n) window.AppI18n.applyModuleI18n(panel);
    else if (window.I18n?.applyModuleI18n) window.I18n.applyModuleI18n(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

SafetyPerformanceKPIs.cancelAddKPIAnnualPlan = function() {
    this.activeTab = 'annual-plan';
    const panel = document.getElementById('spk-annual-plan-panel');
    if (panel) {
        panel.innerHTML = this.renderAnnualPlanTab();
        if (window.AppI18n?.applyModuleI18n) window.AppI18n.applyModuleI18n(panel);
        else if (window.I18n?.applyModuleI18n) window.I18n.applyModuleI18n(panel);
    }
    // Reload data immediately
    setTimeout(() => this.loadKPIAnnualPlans(), 50);
};

SafetyPerformanceKPIs.saveKPIAnnualPlan = async function(id = null) {
    try {
        // Show loading state
        const saveBtn = document.getElementById('kpi-save-btn');
        const saveText = document.getElementById('kpi-save-text');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (saveText) {
            saveText.textContent = this._t('module.kpi.annual.form.saving', 'جاري الحفظ...');
        }

        const planData = {
            id: id,
            year: new Date().getFullYear(),
            indicatorType: document.getElementById('kpi-plan-indicator-type')?.value || 'Leading',
            objective: document.getElementById('kpi-plan-objective')?.value || '',
            kpi: document.getElementById('kpi-plan-kpi')?.value || '',
            target: document.getElementById('kpi-plan-target')?.value || '',
            goal: document.getElementById('kpi-plan-goal')?.value || '',
            improvementPlan: document.getElementById('kpi-plan-improvement')?.value || '',
            jan: document.getElementById('kpi-plan-jan')?.value || '0',
            feb: document.getElementById('kpi-plan-feb')?.value || '0',
            mar: document.getElementById('kpi-plan-mar')?.value || '0',
            apr: document.getElementById('kpi-plan-apr')?.value || '0',
            may: document.getElementById('kpi-plan-may')?.value || '0',
            jun: document.getElementById('kpi-plan-jun')?.value || '0',
            jul: document.getElementById('kpi-plan-jul')?.value || '0',
            aug: document.getElementById('kpi-plan-aug')?.value || '0',
            sep: document.getElementById('kpi-plan-sep')?.value || '0',
            oct: document.getElementById('kpi-plan-oct')?.value || '0',
            nov: document.getElementById('kpi-plan-nov')?.value || '0',
            dec: document.getElementById('kpi-plan-dec')?.value || '0'
        };

        const response = await GoogleIntegration.callBackend('saveKPIAnnualPlan', planData);
        
        if (response && response.success) {
            Notification.success(id ? this._t('module.kpi.notify.updateSuccess','تم تحديث المؤشر بنجاح') : this._t('module.kpi.notify.saveSuccess','تم إضافة المؤشر بنجاح'));
            this.activeTab = 'annual-plan';
            const panel = document.getElementById('spk-annual-plan-panel');
            if (panel) {
                panel.innerHTML = this.renderAnnualPlanTab();
                if (window.AppI18n?.applyModuleI18n) window.AppI18n.applyModuleI18n(panel);
                else if (window.I18n?.applyModuleI18n) window.I18n.applyModuleI18n(panel);
            }
            setTimeout(() => this.loadKPIAnnualPlans(), 50);
        } else {
            throw new Error(response?.message || 'Failed to save');
        }
    } catch (error) {
        console.error('Error saving KPI annual plan:', error);
        Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء الحفظ: ') + error.message);
    } finally {
        const saveBtn = document.getElementById('kpi-save-btn');
        const saveText = document.getElementById('kpi-save-text');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (saveText) {
            saveText.textContent = this._t('module.kpi.annual.form.save','حفظ المؤشر');
        }
    }
};

SafetyPerformanceKPIs.editKPIAnnualPlan = async function(id) {
    try {
        const year = new Date().getFullYear();
        const response = await GoogleIntegration.callBackend('getKPIAnnualPlans', { filters: { year } });
        
        if (response && response.success) {
            const plan = (response.data || []).find(p => p.id === id);
            if (!plan) {
                Notification.error(this._t('module.kpi.notify.notFound','المؤشر غير موجود'));
                return;
            }

            this.addKPIAnnualPlan();
            
            // Fill form with existing data
            setTimeout(() => {
                document.getElementById('kpi-plan-objective').value = plan.objective || '';
                document.getElementById('kpi-plan-kpi').value = plan.kpi || '';
                document.getElementById('kpi-plan-target').value = plan.target || '';
                document.getElementById('kpi-plan-goal').value = plan.goal || '';
                document.getElementById('kpi-plan-improvement').value = plan.improvementPlan || '';
                
                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                months.forEach(m => {
                    const input = document.getElementById(`kpi-plan-${m}`);
                    if (input) input.value = plan[m] || '0';
                });
            }, 100);
        }
    } catch (error) {
        console.error('Error loading KPI plan for edit:', error);
        Notification.error(this._t('module.kpi.notify.loadError','حدث خطأ أثناء تحميل البيانات'));
    }
};

SafetyPerformanceKPIs.deleteKPIAnnualPlan = async function(id) {
    if (!confirm(this._t('module.kpi.notify.deleteConfirm','هل أنت متأكد من حذف هذا المؤشر؟'))) return;
    
    try {
        const response = await GoogleIntegration.callBackend('deleteKPIAnnualPlan', { planId: id });
        
        if (response && response.success) {
            Notification.success(this._t('module.kpi.notify.deleteSuccess','تم حذف المؤشر بنجاح'));
            this.loadKPIAnnualPlans();
        } else {
            throw new Error(response?.message || 'Failed to delete');
        }
    } catch (error) {
        console.error('Error deleting KPI annual plan:', error);
        Notification.error(this._t('module.kpi.notify.deleteError','حدث خطأ أثناء الحذف: ') + error.message);
    }
};

// ===== HSE Monitoring Plan Methods =====
SafetyPerformanceKPIs.loadHSEMonitoringPlans = async function() {
    try {
        const yearSelector = document.getElementById('hse-monitoring-year-selector');
        const year = yearSelector ? parseInt(yearSelector.value) : new Date().getFullYear();
        
        // Load both Annual Plan and Monitoring Plan data in parallel
        const [annualResponse, monitoringResponse] = await Promise.all([
            GoogleIntegration.callBackend('getKPIAnnualPlans', { filters: { year } }),
            GoogleIntegration.callBackend('getHSEMonitoringPlans', { filters: { year } })
        ]);
        
        // Get data from both sources
        const annualData = (annualResponse && annualResponse.success) ? (annualResponse.data || []) : [];
        const monitoringData = (monitoringResponse && monitoringResponse.success) ? (monitoringResponse.data || []) : [];
        
        // Create a map of monitoring data by activity for quick lookup
        const monitoringMap = {};
        monitoringData.forEach(m => {
            monitoringMap[m.activity] = m;
        });
        
        // Merge: Annual Plan KPIs become the base for Monitoring Plan
        const mergedData = annualData.map(annual => {
            const monitoring = monitoringMap[annual.objective] || {};
            return {
                id: annual.id,
                activity: annual.objective,
                activityDescription: annual.kpi,
                area: annual.target || '-',
                frequency: 'Monthly',
                responsibility: annual.improvementPlan || '-',
                recordDocument: annual.goal || '-',
                indicatorType: annual.indicatorType || 'Leading',
                // Monthly targets from Annual Plan
                target_jan: annual.jan || '0',
                target_feb: annual.feb || '0',
                target_mar: annual.mar || '0',
                target_apr: annual.apr || '0',
                target_may: annual.may || '0',
                target_jun: annual.jun || '0',
                target_jul: annual.jul || '0',
                target_aug: annual.aug || '0',
                target_sep: annual.sep || '0',
                target_oct: annual.oct || '0',
                target_nov: annual.nov || '0',
                target_dec: annual.dec || '0',
                // Monthly executed from Monitoring Plan (if exists)
                executed_jan: monitoring.executed_jan || '0',
                executed_feb: monitoring.executed_feb || '0',
                executed_mar: monitoring.executed_mar || '0',
                executed_apr: monitoring.executed_apr || '0',
                executed_may: monitoring.executed_may || '0',
                executed_jun: monitoring.executed_jun || '0',
                executed_jul: monitoring.executed_jul || '0',
                executed_aug: monitoring.executed_aug || '0',
                executed_sep: monitoring.executed_sep || '0',
                executed_oct: monitoring.executed_oct || '0',
                executed_nov: monitoring.executed_nov || '0',
                executed_dec: monitoring.executed_dec || '0',
            };
        });
        
        // Also add standalone monitoring activities (not linked to Annual Plan)
        monitoringData.forEach(m => {
            if (!annualData.find(a => a.objective === m.activity)) {
                mergedData.push(m);
            }
        });
        
        this.renderHSEMonitoringTables(mergedData);
    } catch (error) {
        console.error('Error loading HSE monitoring plans:', error);
        const tbody = document.getElementById('hse-monitoring-weekly-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="30" style="padding: 40px; text-align: center; color: #6b7280;">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3 text-yellow-500"></i>
                        <p>حدث خطأ في تحميل البيانات</p>
                        <button onclick="SafetyPerformanceKPIs.loadHSEMonitoringPlans()" class="btn-primary mt-4">
                            <i class="fas fa-redo ml-2"></i>
                            إعادة المحاولة
                        </button>
                    </td>
                </tr>
            `;
        }
    }
};

SafetyPerformanceKPIs.renderHSEMonitoringTables = function(data) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const frequencies = {
        'Weekly': 'weekly',
        'Monthly': 'monthly',
        'Semi-Annually': 'semiannually',
        'Annually': 'annually'
    };
    // Safe fallback for permission check
    const isReadOnly = (typeof window !== 'undefined' && typeof window.isReadOnlyRole === 'function') 
        ? window.isReadOnlyRole() 
        : false;
    const canEdit = !isReadOnly && (this.isAdminUser() || (typeof Permissions !== 'undefined' && Permissions.hasAccess('hse-monitoring-plan')));

    Object.keys(frequencies).forEach(freq => {
        const tbody = document.getElementById(`hse-monitoring-${frequencies[freq]}-body`);
        if (!tbody) return;

        const freqData = (data || []).filter(d => d.frequency === freq);

        if (freqData.length === 0) {
            const colSpan = canEdit ? 30 : 29;
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" style="padding: 30px; text-align: center; color: #6b7280;">
                        <i class="fas fa-inbox text-2xl mb-2"></i>
                        <p>لا توجد بيانات${canEdit ? '' : ''}</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = freqData.map(plan => {
            const totalTarget = months.reduce((sum, m) => sum + (parseFloat(plan['target_' + m]) || 0), 0);
            const totalExecuted = months.reduce((sum, m) => sum + (parseFloat(plan['executed_' + m]) || 0), 0);
            const score = totalTarget > 0 ? ((totalExecuted / totalTarget) * 100).toFixed(1) : '0.0';

            return `
                <tr class="hover:bg-green-50 transition-colors">
                    <td style="padding: 6px; border: 1px solid #e5e7eb;">${Utils.escapeHTML(plan.activity || '-')}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; max-width: 120px; overflow-wrap: break-word;">${Utils.escapeHTML(plan.activityDescription || '-')}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${Utils.escapeHTML(plan.area || '-')}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${Utils.escapeHTML(plan.frequency || '-')}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb;">${Utils.escapeHTML(plan.responsibility || '-')}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; max-width: 100px; overflow-wrap: break-word;">${Utils.escapeHTML(plan.recordDocument || '-')}</td>
                    ${months.map(m => `<td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; background: #eff6ff;">${plan['target_' + m] || '0'}</td>`).join('')}
                    ${months.map(m => `<td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; background: #ecfdf5;">${plan['executed_' + m] || '0'}</td>`).join('')}
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold; background: #fef3c7;">${totalTarget}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold; background: #d1fae5;">${totalExecuted}</td>
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; font-weight: bold; background: #ede9fe;">${score}%</td>
                    ${canEdit ? `
                    <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">
                        <button onclick="SafetyPerformanceKPIs.editHSEMonitoringPlan('${plan.id}')" class="text-blue-600 hover:text-blue-800 mx-1" title="تعديل">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="SafetyPerformanceKPIs.deleteHSEMonitoringPlan('${plan.id}')" class="text-red-600 hover:text-red-800 mx-1" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                    ` : ''}
                </tr>
            `;
        }).join('');
    });
};

SafetyPerformanceKPIs.addHSEMonitoringPlan = function() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = new Date().getFullYear();
    
    // إنشاء نموذج مضمن
    const panel = document.getElementById('spk-monitoring-plan-panel');
    if (!panel) return;
    
    panel.innerHTML = `
        <div class="content-card">
            <div class="card-header bg-gradient-to-r from-green-50 to-emerald-50 border-b-4 border-green-600">
                <div class="flex items-center justify-between">
                    <h2 class="card-title text-green-800">
                        <i class="fas fa-plus-circle ml-2"></i>
                        إضافة نشاط جديد - خطة متابعة HSE ${year}
                    </h2>
                    <button onclick="SafetyPerformanceKPIs.cancelAddHSEMonitoringPlan()" class="btn-secondary">
                        <i class="fas fa-times ml-2"></i>
                        إلغاء
                    </button>
                </div>
            </div>
            <div class="card-body">
                <form id="hse-monitoring-plan-form" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Activity / النشاط *</label>
                            <input type="text" id="hse-plan-activity" class="form-input" placeholder="e.g., Employees training" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Activity Description / الوصف</label>
                            <input type="text" id="hse-plan-description" class="form-input" placeholder="e.g., Training">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Area / المنطقة *</label>
                            <input type="text" id="hse-plan-area" class="form-input" placeholder="e.g., Management" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Frequency / التكرار *</label>
                            <select id="hse-plan-frequency" class="form-input" required>
                                <option value="Weekly">أسبوعي (Weekly)</option>
                                <option value="Monthly">شهري (Monthly)</option>
                                <option value="Semi-Annually">نصف سنوي (Semi-Annually)</option>
                                <option value="Annually">سنوي (Annually)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Responsibility / المسئول *</label>
                            <input type="text" id="hse-plan-responsibility" class="form-input" placeholder="e.g., HSE Engineer" required>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Record Document / وثيقة التسجيل</label>
                            <input type="text" id="hse-plan-record" class="form-input" placeholder="e.g., HRD-FRM-15-01">
                        </div>
                    </div>
                    
                    <h3 class="text-lg font-bold mt-6 mb-4 border-t pt-4">Monthly Targets & Executed for ${year} / الأهداف والتنفيذ الشهري</h3>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        ${months.map(m => `
                            <div class="border p-3 rounded-lg bg-gray-50">
                                <label class="block text-sm font-bold text-gray-800 mb-2">${m}</label>
                                <div class="mb-2">
                                    <label class="block text-xs text-blue-600 mb-1">Target / الهدف</label>
                                    <input type="number" id="hse-plan-target-${m.toLowerCase()}" class="form-input" value="0" min="0">
                                </div>
                                <div>
                                    <label class="block text-xs text-green-600 mb-1">Executed / المنفذ</label>
                                    <input type="number" id="hse-plan-executed-${m.toLowerCase()}" class="form-input" value="0" min="0">
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="flex gap-3 mt-6 pt-4 border-t">
                        <button type="button" id="hse-save-btn" onclick="SafetyPerformanceKPIs.saveHSEMonitoringPlan()" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            <span id="hse-save-text">حفظ النشاط</span>
                        </button>
                        <button type="button" onclick="SafetyPerformanceKPIs.cancelAddHSEMonitoringPlan()" class="btn-secondary">
                            <i class="fas fa-times ml-2"></i>
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Scroll to top for better UX
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

SafetyPerformanceKPIs.cancelAddHSEMonitoringPlan = function() {
    // Instant cancel - just reload the tab view
    this.activeTab = 'monitoring-plan';
    const panel = document.getElementById('spk-monitoring-plan-panel');
    if (panel) {
        panel.innerHTML = this.renderMonitoringPlanTab();
    }
    // Reload data immediately
    setTimeout(() => this.loadHSEMonitoringPlans(), 50);
};

SafetyPerformanceKPIs.saveHSEMonitoringPlan = async function(id = null) {
    try {
        // Show loading state
        const saveBtn = document.getElementById('hse-save-btn');
        const saveText = document.getElementById('hse-save-text');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (saveText) {
            saveText.textContent = 'جاري الحفظ...';
        }

        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const planData = {
            id: id,
            year: new Date().getFullYear(),
            activity: document.getElementById('hse-plan-activity')?.value || '',
            activityDescription: document.getElementById('hse-plan-description')?.value || '',
            area: document.getElementById('hse-plan-area')?.value || '',
            frequency: document.getElementById('hse-plan-frequency')?.value || '',
            responsibility: document.getElementById('hse-plan-responsibility')?.value || '',
            recordDocument: document.getElementById('hse-plan-record')?.value || ''
        };

        months.forEach(m => {
            planData['target_' + m] = document.getElementById(`hse-plan-target-${m}`)?.value || '0';
            planData['executed_' + m] = document.getElementById(`hse-plan-executed-${m}`)?.value || '0';
        });

        const response = await GoogleIntegration.callBackend('saveHSEMonitoringPlan', planData);
        
        if (response && response.success) {
            Notification.success(id ? this._t('module.kpi.notify.updateSuccess','تم تحديث النشاط بنجاح') : this._t('module.kpi.notify.saveSuccess','تم إضافة النشاط بنجاح'));
            // Instant reload
            this.activeTab = 'monitoring-plan';
            const panel = document.getElementById('spk-monitoring-plan-panel');
            if (panel) {
                panel.innerHTML = this.renderMonitoringPlanTab();
            }
            setTimeout(() => this.loadHSEMonitoringPlans(), 50);
        } else {
            throw new Error(response?.message || 'Failed to save');
        }
    } catch (error) {
        console.error('Error saving HSE monitoring plan:', error);
        Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء الحفظ: ') + error.message);
    } finally {
        // Reset button state
        const saveBtn = document.getElementById('hse-save-btn');
        const saveText = document.getElementById('hse-save-text');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (saveText) {
            saveText.textContent = this._t('module.kpi.annual.form.save','حفظ النشاط');
        }
    }
};

SafetyPerformanceKPIs.editHSEMonitoringPlan = async function(id) {
    try {
        const year = new Date().getFullYear();
        const response = await GoogleIntegration.callBackend('getHSEMonitoringPlans', { filters: { year } });
        
        if (response && response.success) {
            const plan = (response.data || []).find(p => p.id === id);
            if (!plan) {
                Notification.error(this._t('module.kpi.notify.activityNotFound','النشاط غير موجود'));
                return;
            }

            this.addHSEMonitoringPlan();
            
            // Fill form with existing data
            setTimeout(() => {
                document.getElementById('hse-plan-activity').value = plan.activity || '';
                document.getElementById('hse-plan-description').value = plan.activityDescription || '';
                document.getElementById('hse-plan-area').value = plan.area || '';
                document.getElementById('hse-plan-frequency').value = plan.frequency || '';
                document.getElementById('hse-plan-responsibility').value = plan.responsibility || '';
                document.getElementById('hse-plan-record').value = plan.recordDocument || '';
                
                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                months.forEach(m => {
                    const targetInput = document.getElementById(`hse-plan-target-${m}`);
                    const executedInput = document.getElementById(`hse-plan-executed-${m}`);
                    if (targetInput) targetInput.value = plan['target_' + m] || '0';
                    if (executedInput) executedInput.value = plan['executed_' + m] || '0';
                });
            }, 100);
        }
    } catch (error) {
        console.error('Error loading HSE monitoring plan for edit:', error);
        Notification.error(this._t('module.kpi.notify.loadError','حدث خطأ أثناء تحميل البيانات'));
    }
};

SafetyPerformanceKPIs.deleteHSEMonitoringPlan = async function(id) {
    if (!confirm(this._t('module.kpi.notify.deleteConfirm','هل أنت متأكد من حذف هذا النشاط؟'))) return;
    
    try {
        const response = await GoogleIntegration.callBackend('deleteHSEMonitoringPlan', { planId: id });
        
        if (response && response.success) {
            Notification.success(this._t('module.kpi.notify.deleteSuccess','تم حذف النشاط بنجاح'));
            this.loadHSEMonitoringPlans();
        } else {
            throw new Error(response?.message || 'Failed to delete');
        }
    } catch (error) {
        console.error('Error deleting HSE monitoring plan:', error);
        Notification.error(this._t('module.kpi.notify.deleteError','حدث خطأ أثناء الحذف: ') + error.message);
    }
};

// ===== Export Functions for Annual Plan =====
SafetyPerformanceKPIs.exportAnnualPlanToExcel = async function() {
    try {
        const yearSelector = document.getElementById('kpi-annual-year-selector');
        const year = yearSelector ? parseInt(yearSelector.value) : new Date().getFullYear();
        
        const response = await GoogleIntegration.callBackend('getKPIAnnualPlans', { filters: { year } });
        
        if (!response || !response.success || !response.data || response.data.length === 0) {
            Notification.warning(this._t('module.kpi.notify.noData','لا توجد بيانات للتصدير'));
            return;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // بناء ملف Excel
        let csvContent = '\uFEFF'; // BOM for UTF-8
        csvContent += 'OBJECTIVE,KPI,TARGET,GOAL,IMPROVEMENT PLAN,' + months.join(',') + ',TOTAL\n';
        
        response.data.forEach(plan => {
            const total = months.reduce((sum, m) => sum + (parseFloat(plan[m.toLowerCase()]) || 0), 0);
            const row = [
                `"${(plan.objective || '').replace(/"/g, '""')}"`,
                `"${(plan.kpi || '').replace(/"/g, '""')}"`,
                `"${(plan.target || '').replace(/"/g, '""')}"`,
                `"${(plan.goal || '').replace(/"/g, '""')}"`,
                `"${(plan.improvementPlan || '').replace(/"/g, '""')}"`,
                ...months.map(m => plan[m.toLowerCase()] || '0'),
                total
            ];
            csvContent += row.join(',') + '\n';
        });

        // تنزيل الملف
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `KPI_Annual_Plan_${year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        Notification.success(this._t('module.kpi.notify.excelSuccess','تم تصدير البيانات بنجاح'));
    } catch (error) {
        console.error('Error exporting Annual Plan to Excel:', error);
        Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء التصدير: ') + error.message);
    }
};

SafetyPerformanceKPIs.exportAnnualPlanToPDF = async function() {
    try {
        const yearSelector = document.getElementById('kpi-annual-year-selector');
        const year = yearSelector ? parseInt(yearSelector.value) : new Date().getFullYear();
        
        const response = await GoogleIntegration.callBackend('getKPIAnnualPlans', { filters: { year } });
        
        if (!response || !response.success || !response.data || response.data.length === 0) {
            Notification.warning(this._t('module.kpi.notify.noData','لا توجد بيانات للتصدير'));
            return;
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // بناء محتوى HTML للـ PDF
        let htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>KPI Annual Plan ${year}</title>
                <style>
                    @page { size: A4 landscape; margin: 1cm; }
                    @media print {
                        @page { size: A4 landscape; margin: 1cm; }
                    }
                    body { font-family: Arial, sans-serif; padding: 20px; direction: ltr; }
                    h1 { color: #667eea; text-align: center; margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; font-size: 9px; }
                    th, td { border: 1px solid #ddd; padding: 6px 4px; text-align: center; }
                    th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-weight: 600; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .total { background-color: #fef3c7; font-weight: bold; }
                    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
                </style>
            </head>
            <body>
                <h1>Key Performance Indicators (KPIs) - Annual Plan ${year}</h1>
                <table>
                    <thead>
                        <tr>
                            <th>OBJECTIVE</th>
                            <th>KPI</th>
                            <th>TARGET</th>
                            <th>GOAL</th>
                            <th>IMPROVEMENT PLAN</th>
                            ${months.map(m => `<th>${m}</th>`).join('')}
                            <th class="total">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        response.data.forEach(plan => {
            const total = months.reduce((sum, m) => sum + (parseFloat(plan[m.toLowerCase()]) || 0), 0);
            htmlContent += `
                <tr>
                    <td style="text-align: left;">${Utils.escapeHTML(plan.objective || '-')}</td>
                    <td style="text-align: left;">${Utils.escapeHTML(plan.kpi || '-')}</td>
                    <td>${Utils.escapeHTML(plan.target || '-')}</td>
                    <td>${Utils.escapeHTML(plan.goal || '-')}</td>
                    <td style="text-align: left; max-width: 200px; word-wrap: break-word;">${Utils.escapeHTML(plan.improvementPlan || '-')}</td>
                    ${months.map(m => `<td>${plan[m.toLowerCase()] || '0'}</td>`).join('')}
                    <td class="total">${total}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                    </tbody>
                </table>
                <div class="footer">
                    <p>Generated on: ${new Date().toLocaleDateString('en-US')}</p>
                    <p>HSE Management System - Safety Performance KPIs</p>
                </div>
            </body>
            </html>
        `;

        // فتح نافذة الطباعة
        const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
            URL.revokeObjectURL(url);
            Notification.error(this._t('module.kpi.notify.pdfBlocked','يرجى السماح بالنوافذ المنبثقة لإتمام التصدير'));
            return;
        }

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 400);
        };
        
        Notification.success(this._t('module.kpi.notify.pdfSuccess','تم فتح معاينة PDF بنجاح'));
    } catch (error) {
        console.error('Error exporting Annual Plan to PDF:', error);
        Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء التصدير: ') + error.message);
    }
};

// ===== Export Functions for HSE Monitoring Plan =====
SafetyPerformanceKPIs.exportMonitoringPlanToExcel = async function() {
    try {
        const yearSelector = document.getElementById('hse-monitoring-year-selector');
        const year = yearSelector ? parseInt(yearSelector.value) : new Date().getFullYear();
        
        const response = await GoogleIntegration.callBackend('getHSEMonitoringPlans', { filters: { year } });
        
        if (!response || !response.success || !response.data || response.data.length === 0) {
            Notification.warning(this._t('module.kpi.notify.noData','لا توجد بيانات للتصدير'));
            return;
        }

        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // بناء ملف Excel
        let csvContent = '\uFEFF'; // BOM for UTF-8
        csvContent += 'FREQUENCY,ACTIVITY,ACTIVITY DESCRIPTION,AREA,RESPONSIBILITY,RECORD DOCUMENT,';
        csvContent += monthNames.map(m => m + ' Target').join(',') + ',';
        csvContent += monthNames.map(m => m + ' Executed').join(',') + ',';
        csvContent += 'TOTAL TARGET,TOTAL EXECUTED,SCORE %\n';
        
        response.data.forEach(plan => {
            const totalTarget = months.reduce((sum, m) => sum + (parseFloat(plan['target_' + m]) || 0), 0);
            const totalExecuted = months.reduce((sum, m) => sum + (parseFloat(plan['executed_' + m]) || 0), 0);
            const score = totalTarget > 0 ? ((totalExecuted / totalTarget) * 100).toFixed(1) : '0.0';
            
            const row = [
                `"${(plan.frequency || '').replace(/"/g, '""')}"`,
                `"${(plan.activity || '').replace(/"/g, '""')}"`,
                `"${(plan.activityDescription || '').replace(/"/g, '""')}"`,
                `"${(plan.area || '').replace(/"/g, '""')}"`,
                `"${(plan.responsibility || '').replace(/"/g, '""')}"`,
                `"${(plan.recordDocument || '').replace(/"/g, '""')}"`,
                ...months.map(m => plan['target_' + m] || '0'),
                ...months.map(m => plan['executed_' + m] || '0'),
                totalTarget,
                totalExecuted,
                score + '%'
            ];
            csvContent += row.join(',') + '\n';
        });

        // تنزيل الملف
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `HSE_Monitoring_Plan_${year}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        Notification.success(this._t('module.kpi.notify.excelSuccess','تم تصدير البيانات بنجاح'));
    } catch (error) {
        console.error('Error exporting Monitoring Plan to Excel:', error);
        Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء التصدير: ') + error.message);
    }
};

SafetyPerformanceKPIs.exportMonitoringPlanToPDF = async function() {
    try {
        const yearSelector = document.getElementById('hse-monitoring-year-selector');
        const year = yearSelector ? parseInt(yearSelector.value) : new Date().getFullYear();
        
        const response = await GoogleIntegration.callBackend('getHSEMonitoringPlans', { filters: { year } });
        
        if (!response || !response.success || !response.data || response.data.length === 0) {
            Notification.warning(this._t('module.kpi.notify.noData','لا توجد بيانات للتصدير'));
            return;
        }

        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const frequencies = ['Weekly', 'Monthly', 'Semi-Annually', 'Annually'];
        
        // بناء محتوى HTML للـ PDF
        let htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>HSE Monitoring Plan ${year}</title>
                <style>
                    @page { size: A4 landscape; margin: 1cm; }
                    @media print {
                        @page { size: A4 landscape; margin: 1cm; }
                    }
                    body { font-family: Arial, sans-serif; padding: 20px; direction: ltr; }
                    h1 { color: #10b981; text-align: center; margin-bottom: 10px; }
                    h2 { color: #059669; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #10b981; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 5px 3px; text-align: center; }
                    th { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; font-weight: 600; font-size: 7px; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .target-col { background-color: #eff6ff; }
                    .executed-col { background-color: #ecfdf5; }
                    .total-target { background-color: #fef3c7; font-weight: bold; }
                    .total-executed { background-color: #d1fae5; font-weight: bold; }
                    .score { background-color: #ede9fe; font-weight: bold; }
                    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; }
                </style>
            </head>
            <body>
                <h1>HSE MONITORING PLAN ${year}</h1>
                <p style="text-align: center; color: #666;">خطة متابعة HSE - التنفيذ والمتابعة الشهرية</p>
        `;
        
        frequencies.forEach(freq => {
            const freqData = response.data.filter(d => d.frequency === freq);
            if (freqData.length === 0) return;
            
            htmlContent += `<h2>${freq} Activities</h2>`;
            htmlContent += '<table><thead><tr>';
            htmlContent += '<th>Activity</th><th>Description</th><th>Area</th><th>Responsibility</th><th>Record Document</th>';
            htmlContent += monthNames.map(m => `<th class="target-col">${m}T</th>`).join('');
            htmlContent += monthNames.map(m => `<th class="executed-col">${m}E</th>`).join('');
            htmlContent += '<th class="total-target">Total Target</th>';
            htmlContent += '<th class="total-executed">Total Executed</th>';
            htmlContent += '<th class="score">Score %</th>';
            htmlContent += '</tr></thead><tbody>';
            
            freqData.forEach(plan => {
                const totalTarget = months.reduce((sum, m) => sum + (parseFloat(plan['target_' + m]) || 0), 0);
                const totalExecuted = months.reduce((sum, m) => sum + (parseFloat(plan['executed_' + m]) || 0), 0);
                const score = totalTarget > 0 ? ((totalExecuted / totalTarget) * 100).toFixed(1) : '0.0';
                
                htmlContent += '<tr>';
                htmlContent += `<td style="text-align: left;">${Utils.escapeHTML(plan.activity || '-')}</td>`;
                htmlContent += `<td style="text-align: left;">${Utils.escapeHTML(plan.activityDescription || '-')}</td>`;
                htmlContent += `<td>${Utils.escapeHTML(plan.area || '-')}</td>`;
                htmlContent += `<td>${Utils.escapeHTML(plan.responsibility || '-')}</td>`;
                htmlContent += `<td style="text-align: left;">${Utils.escapeHTML(plan.recordDocument || '-')}</td>`;
                htmlContent += months.map(m => `<td class="target-col">${plan['target_' + m] || '0'}</td>`).join('');
                htmlContent += months.map(m => `<td class="executed-col">${plan['executed_' + m] || '0'}</td>`).join('');
                htmlContent += `<td class="total-target">${totalTarget}</td>`;
                htmlContent += `<td class="total-executed">${totalExecuted}</td>`;
                htmlContent += `<td class="score">${score}%</td>`;
                htmlContent += '</tr>';
            });
            
            htmlContent += '</tbody></table>';
        });
        
        htmlContent += `
                <div class="footer">
                    <p>Generated on: ${new Date().toLocaleDateString('en-US')}</p>
                    <p>HSE Management System - Monitoring Plan</p>
                </div>
            </body>
            </html>
        `;

        // فتح نافذة الطباعة
        const blob = new Blob(['\ufeff' + htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        
        if (!printWindow) {
            URL.revokeObjectURL(url);
            Notification.error(this._t('module.kpi.notify.pdfBlocked','يرجى السماح بالنوافذ المنبثقة لإتمام التصدير'));
            return;
        }

        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 400);
        };
        
        Notification.success(this._t('module.kpi.notify.pdfSuccess','تم فتح معاينة PDF بنجاح'));
    } catch (error) {
        console.error('Error exporting Monitoring Plan to PDF:', error);
        Notification.error(this._t('module.kpi.notify.saveError','حدث خطأ أثناء التصدير: ') + error.message);
    }
};


const __origEnhanceWithScorecardTab = SafetyPerformanceKPIs.enhanceWithScorecardTab;
SafetyPerformanceKPIs.enhanceWithScorecardTab = function (section) {
    __origEnhanceWithScorecardTab.call(this, section);
    const tabBar = section ? section.querySelector('.spk-tab-bar') : null;
    if (!tabBar || tabBar.querySelector('#spk-tab-chart-scorecard')) return;

    const t = (k, f) => this._t(k, f);
    const scoreBtn = tabBar.querySelector('#spk-tab-scorecard');
    const chartBtn = document.createElement('button');
    chartBtn.type = 'button';
    chartBtn.id = 'spk-tab-chart-scorecard';
    chartBtn.className = 'spk-tab-btn';
    chartBtn.setAttribute('data-tab', 'chart-scorecard');
    chartBtn.innerHTML = `<i class="fas fa-chart-line ml-1"></i>${t('module.kpi.tab.chartScoreCard', 'Chart Score Card')}`;
    if (scoreBtn && scoreBtn.nextSibling) tabBar.insertBefore(chartBtn, scoreBtn.nextSibling);
    else tabBar.appendChild(chartBtn);

    const chartPanel = document.createElement('div');
    chartPanel.id = 'spk-chart-scorecard-panel';
    chartPanel.className = 'spk-tab-panel hidden';
    chartPanel.innerHTML = this.renderChartScorecardShell();
    this.applyModuleI18n(chartPanel);
    section.appendChild(chartPanel);

    chartBtn.addEventListener('click', () => this.switchScorecardTab('chart-scorecard'));
};

const __origSwitchScorecardTab = SafetyPerformanceKPIs.switchScorecardTab;
SafetyPerformanceKPIs.switchScorecardTab = function (tab) {
    __origSwitchScorecardTab.call(this, tab);
    const chartPanel = document.getElementById('spk-chart-scorecard-panel');
    const showChart = tab === 'chart-scorecard';
    if (chartPanel) chartPanel.classList.toggle('hidden', !showChart);

    document.querySelectorAll('.spk-tab-btn').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-tab') === tab);
    });

    if (showChart) {
        const { start, end } = this.getDateRange();
        const data = this.getFilteredData(start, end);
        this.renderChartScorecardVisuals(data, start, end);
    }
};

const __origUpdateAllKPIs_v2 = SafetyPerformanceKPIs.updateAllKPIs;
SafetyPerformanceKPIs.updateAllKPIs = function () {
    __origUpdateAllKPIs_v2.call(this);
    if (this.activeTab === 'chart-scorecard' && document.getElementById('spk-chart-scorecard-panel')) {
        const { start, end } = this.getDateRange();
        const data = this.getFilteredData(start, end);
        this.renderChartScorecardVisuals(data, start, end);
    }
};


// ===== Final clarity override: Chart Score Card mirrors Score Card model exactly =====
SafetyPerformanceKPIs.renderChartScorecardShell = function () {
    const t = (k, f) => this._t(k, f);
    const ui = this._chartScorecardUiState || { group: 'all', months: 12, compact: false, search: '', chartType: 'line' };
    const selectedMonths = Number(ui.months) || 12;
    return `
        <style>
            #chart-scorecard-grid.spk-compact-mode .chart-scorecard-card .card-header { padding: 8px 10px !important; }
            #chart-scorecard-grid.spk-compact-mode .chart-scorecard-card .card-body { padding: 9px !important; }
            #chart-scorecard-grid.spk-compact-mode .chart-scorecard-card .card-title { font-size: 0.95rem !important; }
            #chart-scorecard-grid.spk-compact-mode .chart-scorecard-card .text-xl { font-size: 1rem !important; }
            .spk-chart-controls-row { display: grid; grid-template-columns: 1fr; gap: 8px; align-items: end; }
            .spk-chart-control { margin: 0; min-width: 0; }
            .spk-chart-control-title { display: block; margin-bottom: 4px; font-size: 11px; font-weight: 700; color: #475569; line-height: 1.2; white-space: nowrap; }
            .spk-chart-control-field { height: 32px !important; font-size: 12px !important; }
            #chart-scorecard-compact-toggle.spk-chart-control-field { margin-top: 0 !important; padding: 0 10px; white-space: nowrap; }
            @media (min-width: 1280px) {
                .spk-chart-controls-row { grid-template-columns: 1.05fr 1.05fr 1.4fr 1fr 1fr; }
            }
        </style>
        <div class="spk-scorecard-hero" style="margin-bottom:1rem;">
            <div class="spk-scorecard-title">
                <div>
                    <div class="spk-scorecard-eyebrow">${t('module.kpi.scorecard.eyebrow', 'مصدر الحقيقة الواحد')}</div>
                    <h2 class="text-xl font-black text-slate-900 mt-2">${t('module.kpi.tab.chartScoreCard', 'Chart Score Card')}</h2>
                    <p class="text-sm text-slate-600 mt-2">${t('module.kpi.chart.subtitle', 'عرض بياني احترافي مطابق لبيانات لوحة التحكم، مقسّم إلى 11 وحدة تحليلية.')}</p>
                </div>
            </div>
        </div>
        <div class="content-card mb-4" style="border:1px solid rgba(15,23,42,.08);">
            <div class="card-body" style="padding:12px 14px;">
                <div class="spk-chart-controls-row">
                    <label class="spk-chart-control">
                        <span class="spk-chart-control-title">${t('module.kpi.chart.control.group', 'نوع المؤشر')}</span>
                        <select id="chart-scorecard-group" class="form-select spk-chart-control-field">
                            <option value="all" ${ui.group === 'all' ? 'selected' : ''}>${t('module.kpi.chart.group.all', 'الكل')}</option>
                            <option value="leading" ${ui.group === 'leading' ? 'selected' : ''}>${t('module.kpi.chart.group.leading', 'استباقي')}</option>
                            <option value="lagging" ${ui.group === 'lagging' ? 'selected' : ''}>${t('module.kpi.chart.group.lagging', 'تراجعي')}</option>
                            <option value="capacity" ${ui.group === 'capacity' ? 'selected' : ''}>${t('module.kpi.chart.group.capacity', 'سعة/موارد')}</option>
                        </select>
                    </label>
                    <label class="spk-chart-control">
                        <span class="spk-chart-control-title">${t('module.kpi.chart.control.months', 'النطاق الزمني')}</span>
                        <select id="chart-scorecard-months" class="form-select spk-chart-control-field">
                            <option value="3" ${selectedMonths === 3 ? 'selected' : ''}>${t('module.kpi.chart.months.3', 'آخر 3 أشهر')}</option>
                            <option value="6" ${selectedMonths === 6 ? 'selected' : ''}>${t('module.kpi.chart.months.6', 'آخر 6 أشهر')}</option>
                            <option value="12" ${selectedMonths === 12 ? 'selected' : ''}>${t('module.kpi.chart.months.12', 'آخر 12 شهر')}</option>
                        </select>
                    </label>
                    <label class="spk-chart-control">
                        <span class="spk-chart-control-title">${t('module.kpi.chart.control.search', 'بحث داخل الكروت')}</span>
                        <input id="chart-scorecard-search" type="search" class="form-input spk-chart-control-field"
                            placeholder="${t('module.kpi.chart.searchPlaceholder', 'اكتب اسم المؤشر...')}" value="${Utils.escapeHTML(ui.search || '')}">
                    </label>
                    <button id="chart-scorecard-compact-toggle" class="btn-secondary spk-chart-control-field">
                        <i class="fas ${ui.compact ? 'fa-expand-arrows-alt' : 'fa-compress-arrows-alt'} ml-1"></i>
                        ${ui.compact ? t('module.kpi.chart.compact.off', 'إلغاء الوضع المضغوط') : t('module.kpi.chart.compact.on', 'تفعيل الوضع المضغوط')}
                    </button>
                    <label class="spk-chart-control">
                        <span class="spk-chart-control-title">${t('module.kpi.chart.control.chartType', 'نمط الرسم')}</span>
                        <select id="chart-scorecard-chart-type" class="form-select spk-chart-control-field">
                            <option value="line" ${ui.chartType === 'line' ? 'selected' : ''}>${t('module.kpi.chart.type.line', 'خطي')}</option>
                            <option value="bar" ${ui.chartType === 'bar' ? 'selected' : ''}>${t('module.kpi.chart.type.bar', 'أعمدة')}</option>
                        </select>
                    </label>
                </div>
            </div>
        </div>
        <div id="chart-scorecard-grid" class="grid grid-cols-1 xl:grid-cols-2 gap-4"></div>
    `;
};

SafetyPerformanceKPIs.renderChartScorecardDetailCard = function (config = {}) {
    const {
        title = '',
        subtitle = '',
        tone = 'blue',
        currentValue = 0,
        ytdValue = 0,
        unit = '',
        score = 0,
        series = [],
        labels = [],
        metricLabel = '',
        ytdLabel = '',
        cardId = '',
        group = 'all'
    } = config;
    const palettes = {
        blue: { line: '#2563eb', fill: 'rgba(37,99,235,.14)', text: '#1e3a8a', soft: '#dbeafe', border: 'rgba(59,130,246,.22)' },
        emerald: { line: '#059669', fill: 'rgba(5,150,105,.14)', text: '#065f46', soft: '#d1fae5', border: 'rgba(16,185,129,.22)' },
        amber: { line: '#d97706', fill: 'rgba(217,119,6,.14)', text: '#92400e', soft: '#fef3c7', border: 'rgba(245,158,11,.22)' },
        rose: { line: '#e11d48', fill: 'rgba(225,29,72,.14)', text: '#9f1239', soft: '#ffe4e6', border: 'rgba(244,63,94,.22)' },
        violet: { line: '#7c3aed', fill: 'rgba(124,58,237,.14)', text: '#5b21b6', soft: '#ede9fe', border: 'rgba(139,92,246,.22)' }
    };
    const p = palettes[tone] || palettes.blue;

    const cleanSeries = (series || []).map(v => Number(v) || 0);
    const maxV = Math.max(...cleanSeries, 1);
    const minV = Math.min(...cleanSeries, 0);
    const range = Math.max(maxV - minV, 1);
    const width = 220;
    const height = 56;
    const stepX = cleanSeries.length > 1 ? width / (cleanSeries.length - 1) : width;
    const points = cleanSeries.map((v, i) => {
        const x = i * stepX;
        const y = height - (((v - minV) / range) * (height - 10)) - 5;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    const areaPoints = `0,${height} ${points} ${width},${height}`;

    const gaugePct = Math.max(0, Math.min(100, Number(score) || 0));
    const r = 26;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - gaugePct / 100);

    const formatValue = (v) => {
        const n = Number(v) || 0;
        return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    const pointNodes = cleanSeries.map((v, i) => {
        const x = i * stepX;
        const y = height - (((v - minV) / range) * (height - 10)) - 5;
        const label = labels[i] || `M${i + 1}`;
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.4" fill="${p.line}" opacity="0.9"><title>${Utils.escapeHTML(`${label}: ${formatValue(v)} ${unit || ''}`)}</title></circle>`;
    }).join('');

    return `
        <div class="content-card overflow-hidden chart-scorecard-card" data-chart-card-id="${Utils.escapeHTML(cardId)}" data-chart-group="${Utils.escapeHTML(group)}" style="border:1px solid ${p.border}; box-shadow:0 10px 22px rgba(15,23,42,.07);">
            <div class="card-header" style="background:linear-gradient(135deg,#fff,#f8fafc); border-bottom:1px solid ${p.border}; padding:10px 12px;">
                <h2 class="card-title text-slate-900">${title}</h2>
                <p class="text-xs text-slate-500 mt-1">${subtitle}</p>
            </div>
            <div class="card-body" style="padding:12px;">
                <div class="grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                        <div class="text-xs font-bold mb-1" style="color:${p.text};">${metricLabel}</div>
                        <div class="text-xl font-black text-slate-900">${formatValue(currentValue)} <span class="text-xs font-bold text-slate-400">${unit}</span></div>
                        <div class="text-xs text-slate-500 mt-1">${ytdLabel}: <span class="font-bold text-slate-700">${formatValue(ytdValue)}</span></div>
                    </div>
                    <div class="rounded-2xl p-2" style="background:${p.soft};">
                        <svg width="58" height="58" viewBox="0 0 64 64" aria-hidden="true">
                            <circle cx="32" cy="32" r="${r}" fill="none" stroke="rgba(15,23,42,.12)" stroke-width="8"></circle>
                            <circle cx="32" cy="32" r="${r}" fill="none" stroke="${p.line}" stroke-width="8" stroke-linecap="round"
                                stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 32 32)"></circle>
                            <text x="32" y="36" text-anchor="middle" font-size="12" font-weight="800" fill="${p.text}">${gaugePct.toFixed(0)}%</text>
                        </svg>
                    </div>
                </div>
                <div class="mt-3 rounded-xl p-2" style="background:rgba(15,23,42,.03);">
                    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
                        <polyline points="${areaPoints}" fill="${p.fill}" stroke="none"></polyline>
                        <polyline points="${points}" fill="none" stroke="${p.line}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
                        ${pointNodes}
                    </svg>
                    <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>${labels[0] || ''}</span>
                        <span>${labels[labels.length - 1] || ''}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
};

SafetyPerformanceKPIs.renderChartScorecardVisuals = function () {
    const t = (k, f) => this._t(k, f);
    const grid = document.getElementById('chart-scorecard-grid');
    if (!grid) return;
    this.destroyChartScorecardCharts();
    if (!this._chartScorecardUiState) {
        this._chartScorecardUiState = { group: 'all', months: 12, compact: false, search: '', chartType: 'line' };
    }
    const ui = this._chartScorecardUiState;
    if (typeof Chart === 'undefined') {
        grid.innerHTML = `<div class="content-card"><div class="card-body text-sm text-slate-500">${t('module.kpi.chart.noData', 'لا توجد بيانات ضمن الفترة المحددة')}</div></div>`;
        this.bindChartScorecardControls();
        return;
    }

    const model = this.buildScorecardData(this.scorecardYear);
    const rows = model.rows || {};
    const monthIndex = Math.min(model.ytdLimit || 0, 11);
    const ytd = (series, type = 'sum', denominator = null) => {
        if (type === 'rate') return this.getYtdValue(series || [], 'rate', monthIndex, denominator || []);
        if (type === 'avg') return this.getYtdValue(series || [], 'avg', monthIndex);
        if (type === 'last') return this.getYtdValue(series || [], 'last', monthIndex);
        return this.getYtdValue(series || [], 'sum', monthIndex);
    };
    const cm = (series) => series && series.length ? (series[monthIndex] || 0) : 0;
    const fmt0 = (v) => this.formatScorecardValue(v, 0, monthIndex, this.scorecardYear);
    const fmt2 = (v) => this.formatScorecardValue(v, 2, monthIndex, this.scorecardYear);

    const permitTotalMonth = (cm(rows.permitsHeight) || 0) + (cm(rows.permitsElectrical) || 0) + (cm(rows.permitsHot) || 0) + (cm(rows.permitsOther) || 0);
    const permitTotalYtd = ytd(rows.permitsHeight) + ytd(rows.permitsElectrical) + ytd(rows.permitsHot) + ytd(rows.permitsOther);

    const months = model.months || [];
    const allMonthLabels = months.map(m => m.label);
    const monthsToShow = Math.max(3, Math.min(12, Number(ui.months) || 12));
    const sliceTail = (arr = []) => (arr || []).slice(Math.max(0, (arr || []).length - monthsToShow));
    const monthLabels = sliceTail(allMonthLabels);
    const rollingScore = (arr = [], invert = false) => {
        const vals = arr.map(v => Number(v) || 0);
        const avg = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
        const pct = invert ? Math.max(0, 100 - (avg * 12)) : Math.min(100, avg > 100 ? 100 : avg);
        return pct;
    };

    const trendDatasets = [
        { key: 'permitTotal', label: t('module.kpi.scorecard.row.permits.total', 'TOTAL PER MONTH'), data: sliceTail(rows.permitTotal || []), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.18)', group: 'leading' },
        { key: 'trainingHours', label: t('module.kpi.scorecard.row.training.hours', 'Training Hours'), data: sliceTail(rows.trainingHours || []), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.18)', group: 'leading' },
        { key: 'trir', label: t('module.kpi.scorecard.row.trir', 'TRIR'), data: sliceTail(rows.trir || []), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,.18)', group: 'lagging' },
        { key: 'ltir', label: t('module.kpi.chart.card.ltirInMonth', 'LTIR'), data: sliceTail(rows.ltir || []), borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,.18)', group: 'lagging' },
        { key: 'employeeCounts', label: t('module.kpi.chart.card.operationalEmployeesCurrent', 'Operational Employees'), data: sliceTail(rows.employeeCounts || []), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.18)', group: 'capacity' }
    ];
    const filteredTrend = trendDatasets.filter(ds => ui.group === 'all' || ds.group === ui.group).filter(ds => {
        const q = String(ui.search || '').trim().toLowerCase();
        return !q || ds.label.toLowerCase().includes(q);
    });
    const trendForMain = filteredTrend.length ? filteredTrend : trendDatasets;

    const kpiOverall = ((rollingScore(sliceTail(rows.trainingHours || []), false) + rollingScore(sliceTail(rows.permitTotal || []), false) + rollingScore(sliceTail(rows.trir || []), true)) / 3);
    grid.innerHTML = `
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.chart.overall', 'Overall Performance Index')}</h2>
                <p class="text-xs text-slate-500 mt-1">${t('module.kpi.chart.subtitle', 'لوحة رسوم بيانية تنفيذية مبنية على نفس بيانات لوحة التحكم.')}</p>
            </div>
            <div class="card-body">
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div class="rounded-lg p-2 bg-slate-50 text-center"><div class="text-[10px] text-slate-500">${t('module.kpi.scorecard.row.permits.total', 'TOTAL PER MONTH')}</div><div class="text-sm font-bold">${fmt0(permitTotalMonth)}</div></div>
                    <div class="rounded-lg p-2 bg-slate-50 text-center"><div class="text-[10px] text-slate-500">${t('module.kpi.scorecard.row.trir', 'TRIR')}</div><div class="text-sm font-bold">${fmt2(cm(rows.trir))}</div></div>
                    <div class="rounded-lg p-2 bg-slate-50 text-center"><div class="text-[10px] text-slate-500">${t('module.kpi.chart.overall', 'Overall')}</div><div class="text-sm font-bold">${fmt2(kpiOverall)}%</div></div>
                </div>
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-main-trend-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.scorecard.section.permits', '2 Permits to Work')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-permits-stacked-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.scorecard.section.training', '3 Health & Safety Training')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-training-mix-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.chart.card.safetyRates', 'Safety Rates')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-safety-rates-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.chart.card.workforceHours.title', '0 Workforce & Hours')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-workforce-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.chart.card.safetyReported.subtitle', 'LTI / NLTI / First Aid / Near Miss')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-incidents-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.chart.card.occupationalHealth.subtitle', 'LTOI / NLTOI / Occ Health Near Miss')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-occ-health-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.scorecard.section.nebosh', '4 NEBOSH Training')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-nebosh-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.scorecard.section.trainingMetrics', 'Training Metrics')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-training-fte-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.scorecard.row.totalHoursWorked', 'Total Employee Hours Worked')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-hours-chart"></canvas></div>
            </div>
        </div>
        <div class="content-card">
            <div class="card-header">
                <h2 class="card-title">${t('module.kpi.chart.card.sections', 'Sections')}</h2>
            </div>
            <div class="card-body">
                <div style="height:${ui.compact ? '220px' : '300px'}"><canvas id="spk-performance-balance-chart"></canvas></div>
            </div>
        </div>
    `;

    const baseType = ui.chartType === 'bar' ? 'bar' : 'line';
    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-main-trend-chart'), {
        type: baseType,
        data: { labels: monthLabels, datasets: trendForMain.map(ds => ({ ...ds, tension: 0.35, fill: baseType === 'line' })) },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.chart.control.group', 'نوع المؤشر') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-permits-stacked-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [
                { label: t('module.kpi.scorecard.row.permits.heights', 'Heights'), data: sliceTail(rows.permitsHeight || []), backgroundColor: 'rgba(37,99,235,.72)' },
                { label: t('module.kpi.scorecard.row.permits.electrical', 'Electrical-LOTO'), data: sliceTail(rows.permitsElectrical || []), backgroundColor: 'rgba(5,150,105,.72)' },
                { label: t('module.kpi.scorecard.row.permits.hot', 'Hot Work'), data: sliceTail(rows.permitsHot || []), backgroundColor: 'rgba(217,119,6,.72)' },
                { label: t('module.kpi.scorecard.row.permits.other', 'All Others'), data: sliceTail(rows.permitsOther || []), backgroundColor: 'rgba(124,58,237,.72)' }
            ]
        },
        options: this.getChartScorecardOptions({ stacked: true, title: t('module.kpi.scorecard.section.permits', '2 Permits to Work') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-training-mix-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [
                { type: 'bar', label: t('module.kpi.scorecard.row.training.sessions', 'Training Sessions'), data: sliceTail(rows.trainingSessions || []), backgroundColor: 'rgba(5,150,105,.72)' },
                { type: 'line', label: t('module.kpi.scorecard.row.training.hours', 'Training Hours'), data: sliceTail(rows.trainingHours || []), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.14)', yAxisID: 'y1', tension: 0.35 }
            ]
        },
        options: this.getChartScorecardOptions({ dualAxis: true, title: t('module.kpi.scorecard.section.training', '3 Health & Safety Training') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-safety-rates-chart'), {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                { label: 'TRIR', data: sliceTail(rows.trir || []), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,.14)', tension: 0.35, fill: true },
                { label: 'LTIR', data: sliceTail(rows.ltir || []), borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,.14)', tension: 0.35, fill: true },
                { label: 'LTOIR', data: sliceTail(rows.ltoir || []), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.14)', tension: 0.35, fill: true }
            ]
        },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.chart.card.safetyRates', 'Safety Rates') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-workforce-chart'), {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                { label: t('module.kpi.chart.card.operationalEmployeesCurrent', 'Operational Employees'), data: sliceTail(rows.employeeCounts || []), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.14)', tension: 0.35, fill: true },
                { label: t('module.kpi.chart.card.employeeHoursCurrent', 'Employee Hours Worked'), data: sliceTail(rows.hoursWorked || []), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.14)', tension: 0.35, fill: false, yAxisID: 'y1' }
            ]
        },
        options: this.getChartScorecardOptions({ dualAxis: true, title: t('module.kpi.chart.card.workforceHours.subtitle', 'Number Operational employees / Total Employee Hours Worked') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-incidents-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [
                { label: 'LTI', data: sliceTail(rows.lti || []), backgroundColor: 'rgba(225,29,72,.72)' },
                { label: 'NLTI', data: sliceTail(rows.nlti || []), backgroundColor: 'rgba(245,158,11,.72)' },
                { label: 'First Aid', data: sliceTail(rows.firstAid || []), backgroundColor: 'rgba(59,130,246,.72)' },
                { label: 'Near Miss', data: sliceTail(rows.nearMiss || []), backgroundColor: 'rgba(5,150,105,.72)' }
            ]
        },
        options: this.getChartScorecardOptions({ stacked: true, title: t('module.kpi.chart.card.safetyReported.subtitle', 'LTI / NLTI / First Aid / Near Miss') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-occ-health-chart'), {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [
                { label: 'LTOI', data: sliceTail(rows.ltoi || []), borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,.14)', tension: 0.35, fill: true },
                { label: 'NLTOI', data: sliceTail(rows.nltoi || []), borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,.14)', tension: 0.35, fill: true },
                { label: t('module.kpi.scorecard.row.occNearMissHazards', 'Occ Health Near Miss/Hazards Reported'), data: sliceTail(rows.occHazards || []), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.14)', tension: 0.35, fill: false }
            ]
        },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.chart.card.occupationalHealth.subtitle', 'LTOI / NLTOI / Occ Health Near Miss') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-nebosh-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: t('module.kpi.scorecard.row.neboshStatus', 'Certification status of UAE HSE Lead'),
                data: sliceTail((rows.neboshStatus || []).map((v) => (String(v || '').toLowerCase().includes('cert') || String(v || '').includes('معتمد')) ? 1 : (String(v || '').trim() ? 0.5 : 0))),
                backgroundColor: 'rgba(124,58,237,.72)'
            }]
        },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.scorecard.section.nebosh', '4 NEBOSH Training') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-training-fte-chart'), {
        type: 'line',
        data: {
            labels: monthLabels,
            datasets: [{
                label: t('module.kpi.scorecard.row.training.hoursPerFte', 'Training Hours per Operational FTE'),
                data: sliceTail(rows.trainingHoursPerFte || []),
                borderColor: '#059669',
                backgroundColor: 'rgba(5,150,105,.14)',
                tension: 0.35,
                fill: true
            }]
        },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.scorecard.section.trainingMetrics', 'Training Metrics') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-hours-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: t('module.kpi.scorecard.row.totalHoursWorked', 'Total Employee Hours Worked'),
                data: sliceTail(rows.hoursWorked || []),
                backgroundColor: 'rgba(37,99,235,.72)'
            }]
        },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.scorecard.row.totalHoursWorked', 'Total Employee Hours Worked') })
    }));

    this._chartScorecardCharts.push(new Chart(document.getElementById('spk-performance-balance-chart'), {
        type: 'bar',
        data: {
            labels: [
                t('module.kpi.chart.leadingScore', 'Leading'),
                t('module.kpi.chart.laggingScore', 'Lagging'),
                t('module.kpi.chart.overall', 'Overall')
            ],
            datasets: [{
                label: t('module.kpi.chart.overall', 'Overall Performance Index'),
                data: [
                    (rollingScore(sliceTail(rows.permitTotal || []), false) + rollingScore(sliceTail(rows.trainingHours || []), false)) / 2,
                    (rollingScore(sliceTail(rows.trir || []), true) + rollingScore(sliceTail(rows.ltir || []), true)) / 2,
                    kpiOverall
                ],
                backgroundColor: ['rgba(5,150,105,.72)', 'rgba(225,29,72,.72)', 'rgba(37,99,235,.72)']
            }]
        },
        options: this.getChartScorecardOptions({ stacked: false, title: t('module.kpi.chart.card.sectionsValue', 'Workforce, Rates, PTW, Training, NEBOSH') })
    }));

    grid.classList.toggle('spk-compact-mode', !!ui.compact);
    this.bindChartScorecardControls();
};

SafetyPerformanceKPIs.destroyChartScorecardCharts = function () {
    if (!Array.isArray(this._chartScorecardCharts)) {
        this._chartScorecardCharts = [];
        return;
    }
    this._chartScorecardCharts.forEach((c) => {
        try { c && c.destroy && c.destroy(); } catch (e) { /* noop */ }
    });
    this._chartScorecardCharts = [];
};

SafetyPerformanceKPIs.getChartScorecardOptions = function (cfg = {}) {
    const { stacked = false, dualAxis = false, title = '' } = cfg;
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true, position: 'bottom' },
            title: { display: !!title, text: title },
            tooltip: { enabled: true, padding: 10, bodySpacing: 5 }
        },
        scales: {
            x: { stacked, grid: { display: false } },
            y: { stacked, beginAtZero: true },
            ...(dualAxis ? { y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } } } : {})
        }
    };
};

SafetyPerformanceKPIs.bindChartScorecardControls = function () {
    const groupEl = document.getElementById('chart-scorecard-group');
    const monthsEl = document.getElementById('chart-scorecard-months');
    const searchEl = document.getElementById('chart-scorecard-search');
    const compactEl = document.getElementById('chart-scorecard-compact-toggle');
    const chartTypeEl = document.getElementById('chart-scorecard-chart-type');
    if (!groupEl || !monthsEl || !searchEl || !compactEl || !chartTypeEl) return;
    if (!this._chartScorecardUiState) {
        this._chartScorecardUiState = { group: 'all', months: 12, compact: false, search: '', chartType: 'line' };
    }

    const rerender = () => this.renderChartScorecardVisuals();

    if (groupEl.dataset.bound !== 'true') {
        groupEl.addEventListener('change', () => {
            this._chartScorecardUiState.group = groupEl.value || 'all';
            rerender();
        });
        groupEl.dataset.bound = 'true';
    }

    if (monthsEl.dataset.bound !== 'true') {
        monthsEl.addEventListener('change', () => {
            this._chartScorecardUiState.months = Number(monthsEl.value) || 12;
            rerender();
        });
        monthsEl.dataset.bound = 'true';
    }

    if (searchEl.dataset.bound !== 'true') {
        searchEl.addEventListener('input', () => {
            this._chartScorecardUiState.search = searchEl.value || '';
            rerender();
        });
        searchEl.dataset.bound = 'true';
    }

    if (compactEl.dataset.bound !== 'true') {
        compactEl.addEventListener('click', (e) => {
            e.preventDefault();
            this._chartScorecardUiState.compact = !this._chartScorecardUiState.compact;
            rerender();
        });
        compactEl.dataset.bound = 'true';
    }

    if (chartTypeEl.dataset.bound !== 'true') {
        chartTypeEl.addEventListener('change', () => {
            this._chartScorecardUiState.chartType = chartTypeEl.value || 'line';
            rerender();
        });
        chartTypeEl.dataset.bound = 'true';
    }
};
