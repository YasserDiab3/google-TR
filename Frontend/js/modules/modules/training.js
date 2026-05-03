/**
 * Training Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== Training Module =====
const Training = {
    applyModuleI18n(root) {
        const i18nCore = (window.AppI18n && typeof window.AppI18n.applyI18n === 'function')
            ? window.AppI18n
            : ((window.I18n && typeof window.I18n.applyI18n === 'function') ? window.I18n : null);
        if (!i18nCore) return;
        const target = root || document.getElementById('training-section') || document;
        i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') {
            i18nCore.applyLiteralTranslations(target);
        }
    },
    currentEditId: null,
    trainingAnalysisCharts: null,
    /** يمنع طلبات متوازية متعددة لنفس تحميل بيانات التدريب */
    _trainingDataLoadPromise: null,
    /** true بعد أول محاولة جلب كاملة من الخادم (أو وضع بدون خادم) حتى لا يبقى تبويب المقاولين/الحضور بانتظار بيانات جزئية فقط */
    _trainingBackendFetchOk: false,
    /** التبويب النشط حالياً (programs | contractors | attendance | analysis) */
    _currentActiveTab: 'programs',
    /** كاش HTML لكل تبويب لتجنب إعادة الرسم عند التبديل */
    _tabCache: { programs: null, contractors: null, attendance: null, analysis: null },
    /** علامات «بحاجة لإعادة بناء» لكل تبويب */
    _tabDirty: { programs: true, contractors: true, attendance: true, analysis: true },
    /** إذا كان إجراء المجمّع غير مدعوم في نسخة Apps Script الحالية، نتجاوزه مباشرة في المحاولات التالية */
    _bundleActionUnsupported: false,
    /** سياق مؤقت لخيارات نافذة تصدير تقرير التحليل (يُفرَّغ بعد التصدير) */
    _analysisExportContext: null,

    ensureData() {
        const data = AppState.appData || {};
        if (!Array.isArray(data.training)) data.training = [];
        if (!Array.isArray(data.trainingSessions)) data.trainingSessions = [];
        if (!Array.isArray(data.trainingCertificates)) data.trainingCertificates = [];
        if (!Array.isArray(data.trainingAttendance)) data.trainingAttendance = [];
        if (!Array.isArray(data.contractorTrainings)) data.contractorTrainings = [];
        if (!data.employeeTrainingMatrix || typeof data.employeeTrainingMatrix !== 'object') {
            data.employeeTrainingMatrix = {};
        }
        if (!data.trainingAnalysisData || typeof data.trainingAnalysisData !== 'object') {
            data.trainingAnalysisData = {};
        }
        AppState.appData = data;
        
        // ✅ إصلاح البيانات الموجودة: إضافة أوقات افتراضية للسجلات التي لا تحتوي على أوقات
        this.fixExistingContractorTrainingTimes();
    },

    /**
     * عدد المشاركين من سجل تدريب — منطق موحد: نفضّل participantsCount الرقمي، وإلا طول مصفوفة participants.
     */
    getParticipantsCount(record) {
        if (!record || typeof record !== 'object') return 0;
        const n = Number(record.participantsCount);
        if (Number.isFinite(n)) return n;
        return Array.isArray(record.participants) ? record.participants.length : 0;
    },

    /** إجمالي ساعات التدريب المسجلة للبرنامج (كما في الشيت — غالباً إجمالي ساعات × مشاركين) */
    getTrainingProgramHours(record) {
        if (!record || typeof record !== 'object') return 0;
        const h = parseFloat(record.totalHours ?? record.trainingHours ?? record.hours ?? 0);
        return Number.isFinite(h) ? h : 0;
    },

    /**
     * إرجاع مصفوفة المشاركين من سجل تدريب — مع دعم تحليل JSON إذا كان الحقل نصاً (من الورقة).
     */
    getParticipantsArray(record) {
        if (!record || typeof record !== 'object') return [];
        const p = record.participants;
        if (Array.isArray(p)) return p;
        if (typeof p === 'string' && p.trim()) {
            try {
                const parsed = JSON.parse(p);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    },

    /**
     * إصلاح البيانات الموجودة: إضافة أوقات افتراضية للسجلات التي لا تحتوي على أوقات
     */
    fixExistingContractorTrainingTimes() {
        const contractorTrainings = AppState.appData?.contractorTrainings;
        if (!Array.isArray(contractorTrainings) || contractorTrainings.length === 0) {
            return;
        }

        let needsSave = false;
        let fixedCount = 0;

        contractorTrainings.forEach(training => {
            if (!training) return;

            // التحقق من وجود أوقات صحيحة
            const startVal = training.startTime || training.fromTime;
            const endVal = training.endTime || training.toTime;
            const hasValidStartTime = startVal && String(startVal).trim() !== '' && startVal !== '—' && startVal !== '-' && startVal !== 'null' && startVal !== 'undefined';
            const hasValidEndTime = endVal && String(endVal).trim() !== '' && endVal !== '—' && endVal !== '-' && endVal !== 'null' && endVal !== 'undefined';

            // إذا كانت الأوقات فارغة أو غير صحيحة، إضافة أوقات افتراضية (مطابق لتدريب الموظفين)
            if (!hasValidStartTime || !hasValidEndTime) {
                fixedCount++;
                if (!hasValidStartTime) {
                    training.startTime = '09:00';
                    if (training.fromTime !== undefined) training.fromTime = '09:00';
                    needsSave = true;
                }
                if (!hasValidEndTime) {
                    training.endTime = '10:00';
                    if (training.toTime !== undefined) training.toTime = '10:00';
                    needsSave = true;
                }

                const startForCalc = training.startTime || training.fromTime;
                const endForCalc = training.endTime || training.toTime;
                if (startForCalc && endForCalc) {
                    const duration = this.calculateDuration(startForCalc, endForCalc);
                    if (duration > 0) {
                        if (!training.durationMinutes || training.durationMinutes === 0) {
                            training.durationMinutes = duration;
                            needsSave = true;
                        }
                        if (!training.totalHours || training.totalHours === 0) {
                            const traineesCount = parseInt(training.traineesCount || training.attendees || 0, 10);
                            if (traineesCount > 0) {
                                training.totalHours = parseFloat(((duration / 60) * traineesCount).toFixed(2));
                                needsSave = true;
                            }
                        }
                    }
                }
            }
        });

        // حفظ البيانات إذا تم إجراء تغييرات
        if (needsSave) {
            if (typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog(`✅ تم إصلاح ${fixedCount} سجل تدريب بإضافة أوقات افتراضية`);
            }
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
        }
    },

    /**
     * حساب المدة بين وقتين بالدقائق
     */
    calculateDuration(fromTime, toTime) {
        if (!fromTime || !toTime) return 0;

        try {
            const from = fromTime.split(':');
            const to = toTime.split(':');
            
            if (from.length < 2 || to.length < 2) return 0;
            
            const fromMinutes = parseInt(from[0], 10) * 60 + parseInt(from[1], 10);
            const toMinutes = parseInt(to[0], 10) * 60 + parseInt(to[1], 10);
            
            let duration = toMinutes - fromMinutes;
            
            // التعامل مع الحالة التي يكون فيها الوقت عبر منتصف الليل
            if (duration < 0) {
                duration += 24 * 60; // إضافة يوم كامل
            }
            
            return duration;
        } catch (error) {
            return 0;
        }
    },

    // ===== Configurable Data Analysis (مثل العيادة الطبية) =====
    getTrainingAnalysisStorageKeys() {
        return {
            cards: 'training_infoCards',
            items: 'training_analysisItems'
        };
    },

    getTrainingDefaultAnalysisCards() {
        return [
            {
                id: 'card_total_trainings',
                title: 'إجمالي البرامج',
                icon: 'fas fa-graduation-cap',
                color: 'blue',
                description: 'إجمالي عدد برامج التدريب',
                enabled: true,
                mode: 'metric',
                metric: 'totalTrainings'
            },
            {
                id: 'card_completed_trainings',
                title: 'برامج مكتملة',
                icon: 'fas fa-check-circle',
                color: 'green',
                description: 'عدد البرامج المكتملة',
                enabled: true,
                mode: 'metric',
                metric: 'completedTrainings'
            },
            {
                id: 'card_total_participants',
                title: 'إجمالي المشاركين',
                icon: 'fas fa-users',
                color: 'purple',
                description: 'إجمالي عدد المشاركين في البرامج',
                enabled: true,
                mode: 'metric',
                metric: 'totalParticipants'
            },
            {
                id: 'card_contractor_trainings',
                title: 'تدريبات المقاولين',
                icon: 'fas fa-briefcase',
                color: 'amber',
                description: 'عدد تدريبات المقاولين',
                enabled: true,
                mode: 'metric',
                metric: 'contractorTrainings'
            },
            {
                id: 'card_total_hours',
                title: 'إجمالي ساعات التدريب',
                icon: 'fas fa-clock',
                color: 'indigo',
                description: 'إجمالي ساعات التدريب المسجلة',
                enabled: true,
                mode: 'metric',
                metric: 'totalTrainingHours'
            },
            {
                id: 'card_unique_employees',
                title: 'الموظفون المدربون',
                icon: 'fas fa-user-graduate',
                color: 'teal',
                description: 'عدد الموظفين الفريدين المدربين',
                enabled: true,
                mode: 'metric',
                metric: 'uniqueEmployees'
            }
        ];
    },

    getTrainingDefaultAnalysisItems() {
        return [
            { id: 'trainings_by_status', label: 'البرامج حسب الحالة', enabled: true, dataset: 'training', field: 'status', chartType: 'doughnut' },
            { id: 'trainings_by_type', label: 'البرامج حسب النوع', enabled: true, dataset: 'training', field: 'trainingType', chartType: 'bar' },
            { id: 'trainings_by_month', label: 'البرامج حسب الشهر', enabled: true, dataset: 'training', field: 'byMonth', chartType: 'line' },
            { id: 'contractor_by_company', label: 'تدريبات المقاولين حسب الشركة', enabled: false, dataset: 'contractorTrainings', field: 'contractorName', chartType: 'bar' },
            { id: 'contractor_by_topic', label: 'تدريبات المقاولين حسب الموضوع', enabled: false, dataset: 'contractorTrainings', field: 'topic', chartType: 'bar' },
            { id: 'attendance_by_type', label: 'الحضور حسب نوع التدريب', enabled: false, dataset: 'trainingAttendance', field: 'trainingType', chartType: 'doughnut' },
            { id: 'attendance_by_factory', label: 'الحضور حسب المصنع', enabled: false, dataset: 'trainingAttendance', field: 'factoryName', chartType: 'bar' },
            { id: 'attendance_by_department', label: 'الحضور حسب الإدارة', enabled: false, dataset: 'trainingAttendance', field: 'department', chartType: 'bar' }
        ];
    },

    async ensureChartJSLoaded() {
        if (typeof Chart !== 'undefined') return true;

        const existingScript = document.querySelector('script[src*="chart.js"], script[src*="chartjs"]');
        if (existingScript) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (typeof Chart !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(true);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(typeof Chart !== 'undefined');
                }, 5000);
            });
        }

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            script.crossOrigin = 'anonymous';

            let done = false;
            const finish = (ok) => {
                if (done) return;
                done = true;
                resolve(!!ok);
            };

            script.onload = () => setTimeout(() => finish(typeof Chart !== 'undefined'), 400);
            script.onerror = () => {
                const fallback = document.createElement('script');
                fallback.type = 'text/javascript';
                fallback.async = true;
                fallback.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
                fallback.crossOrigin = 'anonymous';
                fallback.onload = () => setTimeout(() => finish(typeof Chart !== 'undefined'), 400);
                fallback.onerror = () => finish(false);
                document.head.appendChild(fallback);
            };

            setTimeout(() => finish(typeof Chart !== 'undefined'), 8000);

            try {
                document.head.appendChild(script);
            } catch (e) {
                finish(false);
            }
        });
    },

    async load() {
        // مستمع تغيير اللغة: لا يعيد تحميل الموديول كاملاً ولا يطلب الشبكة؛
        // يطبق i18n على القسم ويبطل الكاش ثم يعيد رسم التبويب النشط فقط.
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                try {
                    const sec = document.getElementById('training-section');
                    if (sec) this.applyModuleI18n(sec);
                } catch (e) { /* ignore */ }
                this._markAllTabsDirty();
                if (this._currentActiveTab) {
                    this.switchTab(this._currentActiveTab);
                }
            });
            this._languageChangeListenerAdded = true;
        }
        this.ensureData();
        if (typeof Permissions !== 'undefined' && typeof Permissions.ensureFormSettingsState === 'function') {
            try { Permissions.ensureFormSettingsState().catch(() => {}); } catch (e) { /* ignore */ }
        }
        const section = document.getElementById('training-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError(' قسم training-section غير موجود!');
            } else {
                console.error(' قسم training-section غير موجود!');
            }
            return;
        }
        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('✅ مديول Training يكتب في قسم: training-section');
        }

        try {
            // التحقق من صلاحيات المستخدم
            const isAdmin = this.isCurrentUserAdmin();
            
            // عرض الواجهة أولاً لتحسين تجربة المستخدم
            section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-graduation-cap ml-3"></i>
                            إدارة التدريبات
                        </h1>
                        <p class="section-subtitle">تسجيل ومتابعة برامج التدريب ومصفوفة التدريب للموظين</p>
                    </div>
                    <div class="flex gap-2">
                        ${isAdmin ? `
                        <button id="view-annual-training-plan-btn" class="btn-secondary">
                            <i class="fas fa-calendar-check ml-2"></i>
                            الخطة التدريبية السنوية
                        </button>
                        <button id="view-training-matrix-btn" class="btn-secondary">
                            <i class="fas fa-table ml-2"></i>
                            مصفوفة التدريب
                        </button>
                        ` : ''}
                        <button id="add-training-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            نموذج حضور تدريب
                        </button>
                        <button id="training-refresh-btn" class="btn-secondary" title="تحديث البيانات">
                            <i class="fas fa-sync-alt ml-2"></i>
                            تحديث
                        </button>
                        <button id="add-contractor-training-header-btn" class="btn-primary">
                            <i class="fas fa-briefcase ml-2"></i>
                            تسجيل تدريب مقاول
                        </button>
                    </div>
                </div>
            </div>
            <div id="training-content" class="mt-6">
                <style>
                    .tabs-container {
                        margin-bottom: 1.5rem;
                    }
                    .tabs-header {
                        display: flex;
                        gap: 0.5rem;
                        border-bottom: 2px solid #e5e7eb;
                        padding-bottom: 0;
                    }
                    .tab-btn {
                        padding: 0.75rem 1.5rem;
                        background: none;
                        border: none;
                        border-bottom: 3px solid transparent;
                        color: #6b7280;
                        font-size: 0.9375rem;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        position: relative;
                        margin-bottom: -2px;
                    }
                    .tab-btn:hover {
                        color: #3b82f6;
                        background-color: rgba(59, 130, 246, 0.05);
                    }
                    .tab-btn.active {
                        color: #3b82f6;
                        border-bottom-color: #3b82f6;
                        font-weight: 600;
                    }
                    .tab-btn i {
                        font-size: 14px;
                    }
                    @media (max-width: 768px) {
                        .tabs-header {
                            flex-wrap: wrap;
                            gap: 0.25rem;
                        }
                        .tab-btn {
                            padding: 0.625rem 1rem;
                            font-size: 0.875rem;
                        }
                    }
                </style>
                <div class="tabs-container mb-6">
                    <div class="tabs-header">
                        <button class="tab-btn active" data-tab="programs" onclick="Training.switchTab('programs')">
                            <i class="fas fa-list ml-2"></i>
                            برامج التدريب
                        </button>
                        <button class="tab-btn" data-tab="contractors" onclick="Training.switchTab('contractors')">
                            <i class="fas fa-briefcase ml-2"></i>
                            تدريبات المقاولين والشركات الخارجية
                        </button>
                        <button class="tab-btn" data-tab="attendance" onclick="Training.switchTab('attendance')">
                            <i class="fas fa-clipboard-check ml-2"></i>
                            سجل التدريب للموظفين
                        </button>
                        ${this.isCurrentUserAdmin() ? `
                        <button class="tab-btn" data-tab="analysis" onclick="Training.switchTab('analysis')">
                            <i class="fas fa-chart-bar ml-2"></i>
                            تحليل البيانات
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div id="training-tab-content">
                    ${this.buildProgramsTabMarkup()}
                </div>
            </div>
        `;
            this.applyModuleI18n(section);
            this.setupEventListeners();

            // ✅ التبويب الافتراضي «programs» مرسوم بالفعل عبر buildProgramsTabMarkup داخل innerHTML أعلاه.
            // نملأ كاش التبويب من DOM الحالي ونعتمد على hydrate لتحميل قائمة البرامج (loadTrainingList) مرة واحدة.
            this._currentActiveTab = 'programs';
            try {
                const tabContent = document.getElementById('training-tab-content');
                if (tabContent) {
                    this._tabCache.programs = tabContent.innerHTML;
                    this._tabDirty.programs = false;
                }
            } catch (e) { /* ignore */ }
            this._hydrateTab('programs');

            // البيانات من Backend في الخلفية: تحديث الكاش/الواجهة عبر persistAndRefreshUi.
            this.loadTrainingDataAsync().catch(error => {
                Utils.safeWarn('⚠️ تعذر تحميل بعض بيانات التدريب:', error);
            });
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول التدريب:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول التدريب:', error);
            }
            if (section) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">حدث خطأ أثناء تحميل البيانات</p>
                                <button onclick="Training.load()" class="btn-primary">
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

    /**
     * تحديث البيانات من الخادم
     */
    async refresh() {
        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('🔄 تحديث بيانات التدريب...');
        }
        if (typeof Notification !== 'undefined' && Notification.info) {
            Notification.info('جاري تحديث البيانات...');
        }
        
        await this.load();
        
        if (typeof Notification !== 'undefined' && Notification.success) {
            Notification.success('تم تحديث البيانات بنجاح');
        }
    },

    async loadTrainingDataAsync() {
        if (this._trainingDataLoadPromise) {
            return this._trainingDataLoadPromise;
        }
        this._trainingDataLoadPromise = this._runLoadTrainingDataAsync().finally(() => {
            this._trainingDataLoadPromise = null;
        });
        return this._trainingDataLoadPromise;
    },

    async _runLoadTrainingDataAsync() {
        // ✅ تحسين: استخدام البيانات المحلية أولاً فوراً
        const hasLocalData = AppState.appData?.training?.length > 0 || 
                            AppState.appData?.trainingSessions?.length > 0 ||
                            AppState.appData?.trainingCertificates?.length > 0;
        
        // تحديث القائمة فوراً بالبيانات المحلية إذا كانت موجودة وكان تبويب البرامج نشطاً.
        // التبويبات الأخرى ستُحدّث عبر persistAndRefreshUi بعد اكتمال الجلب فقط لتفادي تكرار الرسم.
        if (hasLocalData && this._currentActiveTab === 'programs') {
            this.loadTrainingList();
        }

        // التحقق من تفعيل Google Integration قبل إجراء الطلبات
        if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) {
            if (AppState.debugMode) {
                Utils.safeLog('⚠️ Google Apps Script غير مفعل - استخدام البيانات المحلية فقط');
            }
            this._trainingBackendFetchOk = true;
            return;
        }

        // التحقق من توفر GoogleIntegration
        if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') {
            Utils.safeWarn('⚠️ GoogleIntegration غير متاح - استخدام البيانات المحلية');
            this._trainingBackendFetchOk = true;
            return;
        }

        // طابور GoogleIntegration ينفّذ طلبات متتالية: 5 طلبات كانت تُراكم ~60–80 ثانية.
        // 1) تفضيل getTrainingModuleBundle (طلب شبكة واحد من الخادم).
        // 2) إصلاح تصنيف «ثقيل» لـ getAll* في google-integration + __timeoutMs للطلبات الاحتياطية.
        const bundleTimeoutMs = 25000;
        const fallbackTimeoutMs = 12000;
        const timeoutMessage = 'انتهت مهلة الاتصال بالخادم\n\nتحقق من الاتصال وإعدادات Google Apps Script.';

        // حفظ/قراءة حالة عدم دعم getTrainingModuleBundle بين جلسات المتصفح
        const bundleUnsupportedKey = 'training_bundle_action_unsupported';
        try {
            if (localStorage.getItem(bundleUnsupportedKey) === '1') {
                this._bundleActionUnsupported = true;
            }
        } catch (e) { /* ignore */ }

        const persistAndRefreshUi = () => {
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
            try { localStorage.setItem('training_last_sync', String(Date.now())); } catch (e) {}

            // البيانات تغيّرت: علّم جميع التبويبات بأنها تحتاج إعادة بناء عند زيارتها.
            this._markAllTabsDirty();

            // حدّث التبويب النشط فقط لتفادي إعادة الرسم المكلفة لتبويبات غير ظاهرة.
            const active = this._currentActiveTab || 'programs';
            if (active === 'programs') {
                this.loadTrainingList();
            } else if (active === 'contractors') {
                this.refreshContractorTrainingList();
            } else if (active === 'attendance') {
                this.loadAttendanceRegistry();
            } else if (active === 'analysis') {
                this.updateTrainingAnalysisResults();
            }

            this._trainingBackendFetchOk = true;
        };

        try {
            let bundleRaw = null;
            if (!this._bundleActionUnsupported) {
                bundleRaw = await Utils.promiseWithTimeout(
                    GoogleIntegration.sendRequest({
                        action: 'getTrainingModuleBundle',
                        data: { filters: {}, __timeoutMs: bundleTimeoutMs }
                    }),
                    bundleTimeoutMs + 1500,
                    timeoutMessage
                ).catch((err) => {
                    const msg = String(err?.message || err || '');
                    if (
                        msg.includes('getTrainingModuleBundle') &&
                        (msg.includes('غير معترف') || msg.toLowerCase().includes('not recognized'))
                    ) {
                        this._bundleActionUnsupported = true;
                        try { localStorage.setItem(bundleUnsupportedKey, '1'); } catch (e) { /* ignore */ }
                        Utils.safeWarn('⚠️ إجراء getTrainingModuleBundle غير متاح في نسخة الخادم الحالية، سيتم استخدام الجلب المنفصل مباشرة.');
                    } else {
                        Utils.safeWarn('⚠️ تحميل مجمّع التدريب تعذّر، سيتم الطلبات المنفصلة:', err);
                    }
                    return null;
                });
            }

            const bundle = bundleRaw && bundleRaw.success === true && bundleRaw.data && typeof bundleRaw.data === 'object'
                ? bundleRaw.data
                : null;

            if (bundle) {
                if (Array.isArray(bundle.training)) {
                    AppState.appData.training = bundle.training;
                    Utils.safeLog(`✅ تم تحميل ${bundle.training.length} برنامج تدريبي (مجمّع)`);
                }
                if (Array.isArray(bundle.trainingSessions)) AppState.appData.trainingSessions = bundle.trainingSessions;
                if (Array.isArray(bundle.trainingCertificates)) AppState.appData.trainingCertificates = bundle.trainingCertificates;
                if (Array.isArray(bundle.trainingAttendance)) AppState.appData.trainingAttendance = bundle.trainingAttendance;
                if (Array.isArray(bundle.contractorTrainings)) AppState.appData.contractorTrainings = bundle.contractorTrainings;
                persistAndRefreshUi();
                return;
            }

            const requestWithTimeout = (promise) => Utils.promiseWithTimeout(promise, fallbackTimeoutMs, timeoutMessage);
            const dataOpts = { filters: {}, __timeoutMs: fallbackTimeoutMs };
            const runAction = async (action, warnLabel) => {
                const result = await requestWithTimeout(
                    GoogleIntegration.sendRequest({ action, data: { ...dataOpts } })
                ).catch(error => {
                    const errorMsg = error?.message || error?.toString() || '';
                    if (errorMsg.includes('انتهت مهلة الاتصال') || errorMsg.includes('timeout')) {
                        Utils.safeWarn('⚠️ انتهت مهلة الاتصال بالخادم - استخدام البيانات المحلية');
                    } else {
                        Utils.safeWarn(`⚠️ تعذر تحميل ${warnLabel}:`, error);
                    }
                    return { success: false, data: [] };
                });
                return (result && result.success && Array.isArray(result.data)) ? result.data : null;
            };

            // أولوية التحميل حسب التبويب النشط لتقليل التأخير المرئي.
            const active = this._currentActiveTab || 'programs';
            if (active === 'contractors') {
                const contractorData = await runAction('getAllContractorTrainings', 'تدريبات المقاولين');
                if (contractorData) AppState.appData.contractorTrainings = contractorData;
                persistAndRefreshUi();
                runAction('getAllTrainings', 'برامج التدريب').then((data) => { if (data) { AppState.appData.training = data; this._markAllTabsDirty(); } });
                runAction('getAllTrainingAttendance', 'سجل الحضور').then((data) => { if (data) { AppState.appData.trainingAttendance = data; this._markAllTabsDirty(); } });
                runAction('getAllTrainingSessions', 'جلسات التدريب').then((data) => { if (data) { AppState.appData.trainingSessions = data; this._markAllTabsDirty(); } });
                runAction('getAllTrainingCertificates', 'الشهادات').then((data) => { if (data) { AppState.appData.trainingCertificates = data; this._markAllTabsDirty(); } });
                return;
            }
            if (active === 'attendance') {
                const attendanceData = await runAction('getAllTrainingAttendance', 'سجل الحضور');
                if (attendanceData) AppState.appData.trainingAttendance = attendanceData;
                const trainingData = await runAction('getAllTrainings', 'برامج التدريب');
                if (trainingData) AppState.appData.training = trainingData;
                persistAndRefreshUi();
                runAction('getAllContractorTrainings', 'تدريبات المقاولين').then((data) => { if (data) { AppState.appData.contractorTrainings = data; this._markAllTabsDirty(); } });
                runAction('getAllTrainingSessions', 'جلسات التدريب').then((data) => { if (data) { AppState.appData.trainingSessions = data; this._markAllTabsDirty(); } });
                runAction('getAllTrainingCertificates', 'الشهادات').then((data) => { if (data) { AppState.appData.trainingCertificates = data; this._markAllTabsDirty(); } });
                return;
            }

            // باقي الحالات (programs/analysis): ابدأ ببرامج التدريب ثم أكمل بقية البيانات.
            const trainingData = await runAction('getAllTrainings', 'برامج التدريب');
            if (trainingData) {
                AppState.appData.training = trainingData;
                Utils.safeLog(`✅ تم تحميل ${trainingData.length} برنامج تدريبي`);
            }
            persistAndRefreshUi();
            runAction('getAllTrainingSessions', 'جلسات التدريب').then((data) => { if (data) { AppState.appData.trainingSessions = data; this._markAllTabsDirty(); } });
            runAction('getAllTrainingCertificates', 'الشهادات').then((data) => { if (data) { AppState.appData.trainingCertificates = data; this._markAllTabsDirty(); } });
            runAction('getAllTrainingAttendance', 'سجل الحضور').then((data) => { if (data) { AppState.appData.trainingAttendance = data; this._markAllTabsDirty(); } });
            runAction('getAllContractorTrainings', 'تدريبات المقاولين').then((data) => { if (data) { AppState.appData.contractorTrainings = data; this._markAllTabsDirty(); } });
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل بيانات التدريب:', error);
            this._trainingBackendFetchOk = true;
        }
    },

    getStats() {
        this.ensureData();
        const trainings = AppState.appData.training || [];
        const now = new Date();

        let totalParticipants = 0;
        let upcomingCount = 0;
        let completedCount = 0;

        trainings.forEach(training => {
            const participantsCount = this.getParticipantsCount(training);
            totalParticipants += participantsCount;

            if (training.status === 'مكتمل') {
                completedCount += 1;
            }

            const startDate = training.startDate ? new Date(training.startDate) : null;
            if (training.status === 'مخطط' || (startDate && startDate >= now)) {
                upcomingCount += 1;
            }
        });

        return {
            totalTrainings: trainings.length,
            upcomingTrainings: upcomingCount,
            completedTrainings: completedCount,
            totalParticipants: totalParticipants
        };
    },

    /** إحصائيات برامج التدريب من مصفوفة معينة (للاستخدام مع البيانات المفلترة) */
    getStatsFromTrainingsArray(trainings) {
        const list = Array.isArray(trainings) ? trainings : [];
        const now = new Date();
        let totalParticipants = 0, upcomingCount = 0, completedCount = 0;
        list.forEach(training => {
            totalParticipants += this.getParticipantsCount(training);
            if (training.status === 'مكتمل') completedCount += 1;
            const startDate = training.startDate ? new Date(training.startDate) : null;
            if (training.status === 'مخطط' || (startDate && startDate >= now)) upcomingCount += 1;
        });
        return { totalTrainings: list.length, upcomingTrainings: upcomingCount, completedTrainings: completedCount, totalParticipants };
    },

    getContractorTrainingStats(monthFilter = '') {
        this.ensureData();
        const contractorTrainings = AppState.appData.contractorTrainings || [];
        const contractorOptions = this.getContractorOptions();
        // ✅ إصلاح: بناء contractorMap بتحويل المفتاح إلى string لضمان التطابق
        // ملاحظة مهمة: استخدام ?? بدل || لتفادي فقدان قيم مثل 0
        const contractorMap = new Map(contractorOptions.map(c => [String(c?.id ?? '').trim(), c.name || '']));
        
        // إضافة المقاولين النشطين القديمة إذا لم تكن موجودة
        if (contractorMap.size === 0) {
            const legacyContractors = (AppState.appData.contractors || []).filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE');
            legacyContractors.forEach(contractor => {
                if (contractor?.id) {
                    // ✅ إصلاح: تطبيع المفتاح
                    contractorMap.set(String(contractor.id).trim(), contractor.name || contractor.company || contractor.contractorName || '');
                }
            });
        }

        // تصفية البيانات حسب الشهر إذا تم تحديده
        let filteredTrainings = contractorTrainings;
        if (monthFilter) {
            filteredTrainings = contractorTrainings.filter(t => {
                if (!t.date) return false;
                const date = new Date(t.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === monthFilter;
            });
        }

        // حساب الإحصائيات
        const uniqueTopics = new Set();
        const uniqueContractors = new Set();
        const uniqueTrainers = new Set();
        let totalTrainees = 0;
        
        const contractorDetails = {};
        const trainerDetails = {};
        
        // حساب عدد التدريبات في الشهر الحالي
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let currentMonthCount = 0;

        filteredTrainings.forEach(training => {
            // الموضوعات التدريبية
            if (training.topic) {
                uniqueTopics.add(training.topic);
            }

            // المقاولين
            // ✅ إصلاح: تطبيع contractorId قبل البحث في الـ map
            const normalizedContractorId = String(training.contractorId || '').trim();
            // ✅ إصلاح جذري: لا نسمح للـ Map أن يستبدل الاسم المحفوظ في السجل (لتفادي ظهور مقاول آخر بسبب تعارض IDs)
            const storedContractorName = String(training.contractorName || '').replace(/\s+/g, ' ').trim();
            const hasStoredName = storedContractorName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedContractorName);
            const contractorName = hasStoredName
                ? storedContractorName
                : (contractorMap.get(normalizedContractorId) || storedContractorName || 'غير محدد');
            if (normalizedContractorId || training.contractorName) {
                uniqueContractors.add(contractorName);
            }

            // القائمون بالتدريب
            const trainer = training.trainer || training.conductedBy || 'غير محدد';
            if (training.trainer || training.conductedBy) {
                uniqueTrainers.add(trainer);
            }

            // عدد المتدربين
            const traineesCount = Number(training.traineesCount || training.attendees || 0);
            totalTrainees += traineesCount;

            // ساعات التدريب
            const totalHours = parseFloat(training.totalHours || training.trainingHours || 0);

            // تفاصيل المقاول
            if (!contractorDetails[contractorName]) {
                contractorDetails[contractorName] = {
                    count: 0,
                    trainees: 0,
                    hours: 0
                };
            }
            contractorDetails[contractorName].count += 1;
            contractorDetails[contractorName].trainees += traineesCount;
            contractorDetails[contractorName].hours += totalHours;

            // تفاصيل المدرب
            if (!trainerDetails[trainer]) {
                trainerDetails[trainer] = {
                    count: 0,
                    trainees: 0,
                    hours: 0
                };
            }
            trainerDetails[trainer].count += 1;
            trainerDetails[trainer].trainees += traineesCount;
            trainerDetails[trainer].hours += totalHours;

            // عدد التدريبات في الشهر الحالي
            if (training.date) {
                const date = new Date(training.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (monthKey === currentMonthKey) {
                    currentMonthCount += 1;
                }
            }
        });

        return {
            uniqueTopics: uniqueTopics.size,
            uniqueContractors: uniqueContractors.size,
            totalTrainees: totalTrainees,
            uniqueTrainers: uniqueTrainers.size,
            currentMonthCount: currentMonthCount,
            contractorDetails: contractorDetails,
            trainerDetails: trainerDetails
        };
    },

    renderContractorDetailsTable(contractorDetails) {
        const entries = Object.entries(contractorDetails);
        if (entries.length === 0) {
            return '<tr><td colspan="4" class="text-center text-gray-500 py-4">لا توجد بيانات</td></tr>';
        }

        return entries
            .sort((a, b) => b[1].count - a[1].count)
            .map(([name, data]) => `
                <tr>
                    <td>${Utils.escapeHTML(name)}</td>
                    <td class="text-center"><span class="badge badge-info">${data.count}</span></td>
                    <td class="text-center"><span class="badge badge-success">${data.trainees}</span></td>
                    <td class="text-center">${data.hours.toFixed(2)}</td>
                </tr>
            `).join('');
    },

    renderTrainerDetailsTable(trainerDetails) {
        const entries = Object.entries(trainerDetails);
        if (entries.length === 0) {
            return '<tr><td colspan="4" class="text-center text-gray-500 py-4">لا توجد بيانات</td></tr>';
        }

        return entries
            .sort((a, b) => b[1].hours - a[1].hours)
            .map(([name, data]) => `
                <tr>
                    <td>${Utils.escapeHTML(name)}</td>
                    <td class="text-center"><span class="badge badge-info">${data.count}</span></td>
                    <td class="text-center"><span class="badge badge-success">${data.trainees}</span></td>
                    <td class="text-center">${data.hours.toFixed(2)}</td>
                </tr>
            `).join('');
    },

    // =========================
    // Power BI-like analytics (interactive)
    // =========================

    getContractorAnalyticsState() {
        this._contractorAnalyticsState = this._contractorAnalyticsState || {
            contractor: '',
            trainer: '',
            topic: '',
            location: '',
            search: '',
            view: 'contractor', // contractor | trainer | details
            sortBy: 'hours', // count | trainees | hours | date
            sortDir: 'desc', // asc | desc
            drillKey: '' // contractor name OR trainer name (based on view)
        };
        return this._contractorAnalyticsState;
    },

    getContractorTrainingAnalyticsModel(monthFilter = '') {
        this.ensureData();
        const contractorTrainings = Array.isArray(AppState.appData.contractorTrainings) ? AppState.appData.contractorTrainings : [];
        const contractorOptions = this.getContractorOptions();
        const contractorMap = new Map((contractorOptions || []).map(c => [String(c?.id || '').trim(), String(c?.name || '').trim()]));

        const toMonthKey = (d) => {
            if (!d) return '';
            const date = new Date(d);
            if (Number.isNaN(date.getTime())) return '';
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        const normalizeText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
        const normalizeKey = (v) => normalizeText(v).toLowerCase();

        const records = contractorTrainings
            .filter(t => {
                if (!monthFilter) return true;
                return toMonthKey(t?.date) === monthFilter;
            })
            .map(t => {
                const contractorId = String(t?.contractorId ?? '').trim();
        // ✅ لا نسمح للـ Map باستبدال الاسم المحفوظ في السجل (لتفادي تعارض IDs)
        const storedName = normalizeText(t?.contractorName || 'غير محدد');
        const hasStored = storedName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedName);
        const contractorName = hasStored ? storedName : normalizeText(contractorMap.get(contractorId) || storedName || 'غير محدد');
                const trainer = normalizeText(t?.trainer || t?.conductedBy || 'غير محدد');
                const topic = normalizeText(t?.topic || '—');
                const location = normalizeText(t?.location || '—');
                const subLocation = normalizeText(t?.subLocation || '—');
                const trainees = Number(t?.traineesCount || t?.attendees || 0) || 0;
                const hours = parseFloat(t?.totalHours || t?.trainingHours || 0) || 0;
                const date = t?.date ? new Date(t.date) : null;

                return {
                    raw: t,
                    date,
                    dateKey: t?.date ? String(t.date) : '',
                    monthKey: toMonthKey(t?.date),
                    contractorId,
                    contractorName,
                    contractorNameKey: normalizeKey(contractorName),
                    trainer,
                    trainerKey: normalizeKey(trainer),
                    topic,
                    topicKey: normalizeKey(topic),
                    location,
                    locationKey: normalizeKey(location),
                    subLocation,
                    trainees,
                    hours
                };
            });

        const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));

        const dimensions = {
            contractors: uniq(records.map(r => r.contractorName)),
            trainers: uniq(records.map(r => r.trainer)),
            topics: uniq(records.map(r => r.topic)),
            locations: uniq(records.map(r => r.location))
        };

        return { monthFilter, records, dimensions };
    },

    computeContractorAnalytics(model, state) {
        const normalizeKey = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const contractorKey = normalizeKey(state.contractor);
        const trainerKey = normalizeKey(state.trainer);
        const topicKey = normalizeKey(state.topic);
        const locationKey = normalizeKey(state.location);
        const searchKey = normalizeKey(state.search);

        const filtered = (model.records || []).filter(r => {
            if (contractorKey && r.contractorNameKey !== contractorKey) return false;
            if (trainerKey && r.trainerKey !== trainerKey) return false;
            if (topicKey && r.topicKey !== topicKey) return false;
            if (locationKey && r.locationKey !== locationKey) return false;
            if (searchKey) {
                const hay = `${r.contractorNameKey} ${r.trainerKey} ${r.topicKey} ${r.locationKey}`;
                if (!hay.includes(searchKey)) return false;
            }
            return true;
        });

        const totals = {
            programs: filtered.length,
            trainees: filtered.reduce((s, r) => s + (r.trainees || 0), 0),
            hours: filtered.reduce((s, r) => s + (r.hours || 0), 0),
            contractors: new Set(filtered.map(r => r.contractorNameKey)).size,
            trainers: new Set(filtered.map(r => r.trainerKey)).size,
            topics: new Set(filtered.map(r => r.topicKey)).size
        };

        const pivotBy = (keyField, labelField) => {
            const map = new Map();
            filtered.forEach(r => {
                const key = r[keyField] || '';
                const label = r[labelField] || 'غير محدد';
                if (!key) return;
                if (!map.has(key)) map.set(key, { key, label, count: 0, trainees: 0, hours: 0 });
                const agg = map.get(key);
                agg.count += 1;
                agg.trainees += r.trainees || 0;
                agg.hours += r.hours || 0;
            });
            return Array.from(map.values());
        };

        const contractorsPivot = pivotBy('contractorNameKey', 'contractorName');
        const trainersPivot = pivotBy('trainerKey', 'trainer');

        const sortDir = state.sortDir === 'asc' ? 1 : -1;
        const sortMetric = state.sortBy || 'hours';
        const sortPivot = (rows) => {
            const sorted = rows.slice().sort((a, b) => {
                const av = a[sortMetric] ?? 0;
                const bv = b[sortMetric] ?? 0;
                if (bv === av) return (a.label || '').localeCompare(b.label || '', 'ar', { sensitivity: 'base' }) * sortDir;
                return (bv - av) * sortDir;
            });
            return sorted;
        };

        const topContractors = sortPivot(contractorsPivot).slice(0, 20);
        const topTrainers = sortPivot(trainersPivot).slice(0, 20);

        const drillKey = normalizeKey(state.drillKey);
        const drilled = drillKey
            ? filtered.filter(r => (state.view === 'trainer' ? r.trainerKey === drillKey : r.contractorNameKey === drillKey))
            : filtered;

        const detailsSorted = drilled.slice().sort((a, b) => {
            if (state.view !== 'details' && state.sortBy !== 'date') return 0;
            const at = a.date ? a.date.getTime() : 0;
            const bt = b.date ? b.date.getTime() : 0;
            return (bt - at) * sortDir;
        });

        return { filtered, totals, topContractors, topTrainers, details: detailsSorted };
    },

    renderContractorAnalyticsDashboard(model, state) {
        const safe = (v) => Utils.escapeHTML(String(v ?? ''));
        // ✅ استخدام الأرقام الإنجليزية (en-US) في جميع الكروت والإحصائيات
        const fmt = (n, digits = 0) => {
            const num = Number(n) || 0;
            return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
        };

        const computed = this.computeContractorAnalytics(model, state);
        const drillLabel = state.drillKey ? String(state.drillKey) : '';

        const optionList = (items, selected) => {
            const selKey = String(selected ?? '').replace(/\s+/g, ' ').trim();
            return [`<option value="">الكل</option>`]
                .concat(items.map(v => `<option value="${safe(v)}" ${selKey === String(v) ? 'selected' : ''}>${safe(v)}</option>`))
                .join('');
        };

        const tabBtn = (id, label, icon, active) => `
            <button type="button" class="btn-secondary btn-sm" id="${id}" style="${active ? 'background:#EEF2FF;border-color:#C7D2FE;color:#1E3A8A;' : ''}">
                <i class="fas ${icon} ml-2"></i>${label}
            </button>
        `;

        const renderPivotTable = (rows, mode) => {
            if (!rows.length) {
                return `<div style="padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #fafbfc 0%, #f3f4f6 100%); border-radius: 12px; border: 2px dashed #e5e7eb;">
                    <i class="fas fa-inbox" style="font-size: 2.5rem; color: #d1d5db; margin-bottom: 12px; display: block;"></i>
                    <p style="color: #9ca3af; font-size: 0.9rem; margin: 0;">لا توجد بيانات مطابقة للفلاتر الحالية</p>
                </div>`;
            }
            return `
                <div style="overflow: auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; max-height: 400px; scrollbar-width: thin; scrollbar-color: #667eea #e0e7ff;">
                    <style>
                        .pivot-table-container::-webkit-scrollbar { width: 6px; height: 6px; }
                        .pivot-table-container::-webkit-scrollbar-track { background: #e0e7ff; border-radius: 10px; }
                        .pivot-table-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #667eea, #764ba2); border-radius: 10px; }
                    </style>
                    <table class="table-auto w-full" style="min-width: 640px; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                <th style="padding: 14px 16px; font-size: 12px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                    <i class="fas ${mode === 'trainer' ? 'fa-user-tie' : 'fa-building'} ml-2"></i>${mode === 'trainer' ? 'القائم بالتدريب' : 'المقاول'}
                                </th>
                                <th style="padding: 14px 12px; font-size: 12px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                    <i class="fas fa-clipboard-list ml-1"></i>البرامج
                                </th>
                                <th style="padding: 14px 12px; font-size: 12px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                    <i class="fas fa-users ml-1"></i>المتدربين
                                </th>
                                <th style="padding: 14px 12px; font-size: 12px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                    <i class="fas fa-clock ml-1"></i>الساعات
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((r, idx) => `
                                <tr class="hover:bg-indigo-50 cursor-pointer transition-all duration-200" data-analytics-drill="${safe(r.label)}" data-analytics-mode="${mode}" style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};" onmouseover="this.style.background='#eef2ff'; this.style.transform='scale(1.005)'" onmouseout="this.style.background='${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}'; this.style.transform='scale(1)'">
                                    <td style="padding: 12px 16px; font-size: 12px; text-align: right; border-bottom: 1px solid #f0f0f0;">
                                        <span style="color: #4c51bf; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                            <span style="width: 8px; height: 8px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; flex-shrink: 0;"></span>
                                            ${safe(r.label)}
                                        </span>
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${fmt(r.count)}</span>
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${fmt(r.trainees)}</span>
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${fmt(r.hours, 2)}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size: 0.75rem; color: #9ca3af; margin-top: 8px; text-align: center;">
                    <i class="fas fa-mouse-pointer ml-1"></i>اضغط على أي صف للتعمق في التفاصيل
                </p>
            `;
        };

        const renderDetails = () => {
            const rows = computed.details.slice(0, 300);
            if (!rows.length) return `<div style="padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #fafbfc 0%, #f3f4f6 100%); border-radius: 12px; border: 2px dashed #e5e7eb;">
                <i class="fas fa-folder-open" style="font-size: 2.5rem; color: #d1d5db; margin-bottom: 12px; display: block;"></i>
                <p style="color: #9ca3af; font-size: 0.9rem; margin: 0;">لا توجد تفاصيل للعرض</p>
            </div>`;
            return `
                <div class="details-table-container" style="overflow: auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; max-height: 450px; scrollbar-width: thin; scrollbar-color: #667eea #e0e7ff;">
                    <style>
                        .details-table-container::-webkit-scrollbar { width: 6px; height: 6px; }
                        .details-table-container::-webkit-scrollbar-track { background: #e0e7ff; border-radius: 10px; }
                        .details-table-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #667eea, #764ba2); border-radius: 10px; }
                    </style>
                    <table class="table-auto w-full" style="min-width: 980px; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-calendar ml-1"></i>التاريخ
                                </th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-book ml-1"></i>الموضوع
                                </th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-user-tie ml-1"></i>المدرب
                                </th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-building ml-1"></i>المقاول
                                </th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-users ml-1"></i>المتدربين
                                </th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-clock ml-1"></i>الساعات
                                </th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); white-space: nowrap;">
                                    <i class="fas fa-map-marker-alt ml-1"></i>الموقع
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((r, idx) => `
                                <tr class="hover:bg-indigo-50 transition-all duration-200" style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}'">
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0; white-space: nowrap;">
                                        <span style="background: #f3f4f6; padding: 3px 8px; border-radius: 6px; color: #4b5563;">${r.raw?.date ? safe(Utils.formatDate(r.raw.date)) : '-'}</span>
                                    </td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${safe(r.topic || '-')}">${safe(r.topic || '-')}</td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0;">
                                        <span style="color: #4c51bf; font-weight: 500;">${safe(r.trainer || '-')}</span>
                                    </td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0;">
                                        <span style="color: #059669; font-weight: 500;">${safe(r.contractorName || '-')}</span>
                                    </td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 10px;">${fmt(r.trainees)}</span>
                                    </td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 10px;">${fmt(r.hours, 2)}</span>
                                    </td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${safe(r.location || '-')}">${safe(r.location || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 8px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <span style="font-size: 0.75rem; color: #6b7280;"><i class="fas fa-info-circle ml-1"></i>يتم عرض أول 300 سجل فقط لتحسين الأداء</span>
                    <span style="font-size: 0.75rem; color: #4c51bf; font-weight: 600;"><i class="fas fa-table ml-1"></i>إجمالي: ${rows.length} سجل</span>
                </div>
            `;
        };

        return `
            <div class="grid grid-cols-1 gap-4" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
                <!-- Slicers - فلاتر التحليل -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%); border-radius: 16px; padding: 22px 24px; border: 1px solid #e0e7ff; box-shadow: 0 4px 12px rgba(102,126,234,0.1);">
                    <!-- Header Section -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(224,231,255,0.6);">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #4c51bf; display: flex; align-items: center; gap: 10px; letter-spacing: -0.2px;">
                            <i class="fas fa-filter" style="color: #667eea; font-size: 0.9rem;"></i>
                            فلاتر التحليل
                        </h4>
                        <button type="button" id="contractor-analytics-reset-btn" style="background: white; border: 1.5px solid #e5e7eb; padding: 8px 16px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; color: #6b7280; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; gap: 7px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" onmouseover="this.style.background='#f9fafb'; this.style.borderColor='#d1d5db'; this.style.boxShadow='0 2px 6px rgba(0,0,0,0.08)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='white'; this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
                            <i class="fas fa-redo-alt" style="font-size: 0.75rem;"></i>إعادة تعيين
                        </button>
                    </div>
                    <!-- Filters Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style="margin-bottom: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #4b5563; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                <i class="fas fa-building" style="color: #667eea; font-size: 0.7rem; width: 14px; text-align: center;"></i>
                                <span>المقاول</span>
                            </label>
                            <select id="contractor-analytics-contractor" class="form-input" style="border: 2px solid #e0e7ff; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; transition: all 0.25s ease; background: white; min-height: 42px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.12), 0 2px 6px rgba(102,126,234,0.15)'; this.style.transform='translateY(-1px)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.transform='translateY(0)'">${optionList(model.dimensions.contractors, state.contractor)}</select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #4b5563; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                <i class="fas fa-user-tie" style="color: #667eea; font-size: 0.7rem; width: 14px; text-align: center;"></i>
                                <span>القائم بالتدريب</span>
                            </label>
                            <select id="contractor-analytics-trainer" class="form-input" style="border: 2px solid #e0e7ff; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; transition: all 0.25s ease; background: white; min-height: 42px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.12), 0 2px 6px rgba(102,126,234,0.15)'; this.style.transform='translateY(-1px)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.transform='translateY(0)'">${optionList(model.dimensions.trainers, state.trainer)}</select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #4b5563; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                <i class="fas fa-book" style="color: #667eea; font-size: 0.7rem; width: 14px; text-align: center;"></i>
                                <span>الموضوع</span>
                            </label>
                            <select id="contractor-analytics-topic" class="form-input" style="border: 2px solid #e0e7ff; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; transition: all 0.25s ease; background: white; min-height: 42px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.12), 0 2px 6px rgba(102,126,234,0.15)'; this.style.transform='translateY(-1px)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.transform='translateY(0)'">${optionList(model.dimensions.topics, state.topic)}</select>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #4b5563; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                <i class="fas fa-map-marker-alt" style="color: #667eea; font-size: 0.7rem; width: 14px; text-align: center;"></i>
                                <span>الموقع</span>
                            </label>
                            <select id="contractor-analytics-location" class="form-input" style="border: 2px solid #e0e7ff; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; transition: all 0.25s ease; background: white; min-height: 42px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.12), 0 2px 6px rgba(102,126,234,0.15)'; this.style.transform='translateY(-1px)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.transform='translateY(0)'">${optionList(model.dimensions.locations, state.location)}</select>
                        </div>
                    </div>
                    <!-- Search Section -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: #4b5563; display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                            <i class="fas fa-search" style="color: #667eea; font-size: 0.7rem; width: 14px; text-align: center;"></i>
                            <span>بحث سريع</span>
                        </label>
                        <input id="contractor-analytics-search" class="form-input" placeholder="ابحث..." value="${safe(state.search)}" style="border: 2px solid #e0e7ff; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; transition: all 0.25s ease; background: white; min-height: 42px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.12), 0 2px 6px rgba(102,126,234,0.15)'; this.style.transform='translateY(-1px)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'; this.style.transform='translateY(0)'">
                    </div>
                </div>

                <!-- KPI Cards - بطاقات المؤشرات -->
                <div class="contractor-analytics-kpi-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px;">
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 3px 10px rgba(102,126,234,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <i class="fas fa-clipboard-list" style="font-size: 10px;"></i>البرامج
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: white; line-height: 1.1;">${fmt(computed.totals.programs)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 3px 10px rgba(16,185,129,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <i class="fas fa-users" style="font-size: 10px;"></i>المتدربين
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: white; line-height: 1.1;">${fmt(computed.totals.trainees)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 3px 10px rgba(245,158,11,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <i class="fas fa-clock" style="font-size: 10px;"></i>الساعات
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: white; line-height: 1.1;">${fmt(computed.totals.hours, 2)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 3px 10px rgba(59,130,246,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <i class="fas fa-building" style="font-size: 10px;"></i>المقاولين
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: white; line-height: 1.1;">${fmt(computed.totals.contractors)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); box-shadow: 0 3px 10px rgba(236,72,153,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <i class="fas fa-user-tie" style="font-size: 10px;"></i>المدربين
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: white; line-height: 1.1;">${fmt(computed.totals.trainers)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); box-shadow: 0 3px 10px rgba(139,92,246,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                            <i class="fas fa-book" style="font-size: 10px;"></i>الموضوعات
                        </div>
                        <div style="font-size: 22px; font-weight: 800; color: white; line-height: 1.1;">${fmt(computed.totals.topics)}</div>
                    </div>
                </div>
                <style>
                    @media (max-width: 1024px) {
                        .contractor-analytics-kpi-grid { grid-template-columns: repeat(3, 1fr) !important; }
                    }
                    @media (max-width: 640px) {
                        .contractor-analytics-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    }
                </style>

                <!-- Tabs + Sort - التبويبات والفرز -->
                <div style="background: white; border-radius: 14px; padding: 16px 20px; border: 1px solid #e5e7eb; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <button type="button" id="contractor-analytics-tab-contractor" style="padding: 10px 18px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; border: 2px solid ${state.view === 'contractor' ? '#667eea' : '#e5e7eb'}; background: ${state.view === 'contractor' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; color: ${state.view === 'contractor' ? 'white' : '#6b7280'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: ${state.view === 'contractor' ? '0 4px 12px rgba(102,126,234,0.3)' : 'none'};" onmouseover="if(!this.classList.contains('active')){this.style.borderColor='#c7d2fe'; this.style.background='#f5f3ff'}" onmouseout="if(!this.classList.contains('active')){this.style.borderColor='#e5e7eb'; this.style.background='white'}">
                                <i class="fas fa-building"></i>ملخص حسب المقاول
                            </button>
                            <button type="button" id="contractor-analytics-tab-trainer" style="padding: 10px 18px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; border: 2px solid ${state.view === 'trainer' ? '#667eea' : '#e5e7eb'}; background: ${state.view === 'trainer' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; color: ${state.view === 'trainer' ? 'white' : '#6b7280'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: ${state.view === 'trainer' ? '0 4px 12px rgba(102,126,234,0.3)' : 'none'};" onmouseover="if(!this.classList.contains('active')){this.style.borderColor='#c7d2fe'; this.style.background='#f5f3ff'}" onmouseout="if(!this.classList.contains('active')){this.style.borderColor='#e5e7eb'; this.style.background='white'}">
                                <i class="fas fa-user-tie"></i>ملخص حسب المدرب
                            </button>
                            <button type="button" id="contractor-analytics-tab-details" style="padding: 10px 18px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; border: 2px solid ${state.view === 'details' ? '#667eea' : '#e5e7eb'}; background: ${state.view === 'details' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'}; color: ${state.view === 'details' ? 'white' : '#6b7280'}; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: ${state.view === 'details' ? '0 4px 12px rgba(102,126,234,0.3)' : 'none'};" onmouseover="if(!this.classList.contains('active')){this.style.borderColor='#c7d2fe'; this.style.background='#f5f3ff'}" onmouseout="if(!this.classList.contains('active')){this.style.borderColor='#e5e7eb'; this.style.background='white'}">
                                <i class="fas fa-list-alt"></i>عرض التفاصيل
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <label style="font-size: 0.7rem; font-weight: 600; color: #6b7280; white-space: nowrap;">
                                    <i class="fas fa-sort-amount-down ml-1" style="color: #667eea;"></i>فرز:
                                </label>
                                <select id="contractor-analytics-sortby" class="form-input" style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; font-size: 0.75rem; min-width: 100px; background: white;">
                                    <option value="hours" ${state.sortBy === 'hours' ? 'selected' : ''}>الساعات</option>
                                    <option value="trainees" ${state.sortBy === 'trainees' ? 'selected' : ''}>المتدربين</option>
                                    <option value="count" ${state.sortBy === 'count' ? 'selected' : ''}>عدد البرامج</option>
                                    <option value="date" ${state.sortBy === 'date' ? 'selected' : ''}>التاريخ</option>
                                </select>
                                <select id="contractor-analytics-sortdir" class="form-input" style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; font-size: 0.75rem; min-width: 90px; background: white;">
                                    <option value="desc" ${state.sortDir === 'desc' ? 'selected' : ''}>تنازلي</option>
                                    <option value="asc" ${state.sortDir === 'asc' ? 'selected' : ''}>تصاعدي</option>
                                </select>
                            </div>
                            ${drillLabel ? `<button type="button" id="contractor-analytics-clear-drill" style="padding: 8px 14px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; border: 1px solid #fcd34d; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'"><i class="fas fa-times-circle"></i>إلغاء التعمق: ${safe(drillLabel)}</button>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Content - المحتوى الرئيسي -->
                <div style="background: white; border-radius: 14px; padding: 20px; border: 1px solid #e5e7eb; box-shadow: 0 2px 6px rgba(0,0,0,0.04); min-height: 300px;">
                    ${state.view === 'trainer'
                        ? renderPivotTable(computed.topTrainers, 'trainer')
                        : state.view === 'details'
                            ? renderDetails()
                            : renderPivotTable(computed.topContractors, 'contractor')}
                </div>
            </div>
        `;
    },

    refreshContractorAnalytics(monthFilter = '') {
        const dashboard = document.getElementById('contractor-analytics-dashboard');
        if (!dashboard) return;
        const state = this.getContractorAnalyticsState();
        const model = this.getContractorTrainingAnalyticsModel(monthFilter);
        dashboard.innerHTML = this.renderContractorAnalyticsDashboard(model, state);
        this.bindContractorAnalyticsEvents(monthFilter);
    },

    bindContractorAnalyticsEvents(monthFilter = '') {
        const state = this.getContractorAnalyticsState();

        const wire = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', fn);
        };

        wire('contractor-analytics-contractor', (e) => {
            state.contractor = String(e.target.value || '');
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });
        wire('contractor-analytics-trainer', (e) => {
            state.trainer = String(e.target.value || '');
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });
        wire('contractor-analytics-topic', (e) => {
            state.topic = String(e.target.value || '');
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });
        wire('contractor-analytics-location', (e) => {
            state.location = String(e.target.value || '');
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });
        wire('contractor-analytics-sortby', (e) => {
            state.sortBy = String(e.target.value || 'hours');
            this.refreshContractorAnalytics(monthFilter);
        });
        wire('contractor-analytics-sortdir', (e) => {
            state.sortDir = String(e.target.value || 'desc');
            this.refreshContractorAnalytics(monthFilter);
        });

        const search = document.getElementById('contractor-analytics-search');
        if (search) {
            search.addEventListener('input', (e) => {
                state.search = String(e.target.value || '');
                // تحديث خفيف بدون فقد التركيز
                this.refreshContractorAnalytics(monthFilter);
            });
        }

        const tabContractor = document.getElementById('contractor-analytics-tab-contractor');
        if (tabContractor) tabContractor.addEventListener('click', () => {
            state.view = 'contractor';
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });
        const tabTrainer = document.getElementById('contractor-analytics-tab-trainer');
        if (tabTrainer) tabTrainer.addEventListener('click', () => {
            state.view = 'trainer';
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });
        const tabDetails = document.getElementById('contractor-analytics-tab-details');
        if (tabDetails) tabDetails.addEventListener('click', () => {
            state.view = 'details';
            this.refreshContractorAnalytics(monthFilter);
        });

        const clearDrill = document.getElementById('contractor-analytics-clear-drill');
        if (clearDrill) clearDrill.addEventListener('click', () => {
            state.drillKey = '';
            this.refreshContractorAnalytics(monthFilter);
        });

        const resetBtn = document.getElementById('contractor-analytics-reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            this._contractorAnalyticsState = {
                contractor: '',
                trainer: '',
                topic: '',
                location: '',
                search: '',
                view: 'contractor',
                sortBy: 'hours',
                sortDir: 'desc',
                drillKey: ''
            };
            this.refreshContractorAnalytics(monthFilter);
        });

        // Drill-down from pivot rows
        const dashboard = document.getElementById('contractor-analytics-dashboard');
        if (dashboard) {
            dashboard.querySelectorAll('[data-analytics-drill]')?.forEach(row => {
                row.addEventListener('click', () => {
                    const key = String(row.getAttribute('data-analytics-drill') || '').trim();
                    const mode = String(row.getAttribute('data-analytics-mode') || '').trim();
                    state.view = mode === 'trainer' ? 'trainer' : 'contractor';
                    state.drillKey = key;
                    // عند الـ drill نعرض التفاصيل مباشرة
                    state.view = 'details';
                    this.refreshContractorAnalytics(monthFilter);
                });
            });
        }
    },

    // =========================
    // تحليل تفاعلي لتدريبات الموظفين (Slicers + Pivot + Drill-down)
    // =========================

    getEmployeeAnalyticsState() {
        this._employeeAnalyticsState = this._employeeAnalyticsState || {
            trainer: '',
            topic: '',
            location: '',
            trainingType: '',
            search: '',
            view: 'trainer', // trainer | topic | details
            sortBy: 'hours',
            sortDir: 'desc',
            drillKey: ''
        };
        return this._employeeAnalyticsState;
    },

    getEmployeeTrainingAnalyticsModel(monthFilter = '') {
        this.ensureData();
        const trainings = Array.isArray(AppState.appData.training) ? AppState.appData.training : [];

        const toMonthKey = (d) => {
            if (!d) return '';
            const date = new Date(d);
            if (Number.isNaN(date.getTime())) return '';
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        const normalizeText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
        const normalizeKey = (v) => normalizeText(v).toLowerCase();

        const records = trainings
            .filter(t => {
                if (!monthFilter) return true;
                const d = t?.startDate || t?.date || t?.createdAt;
                return toMonthKey(d) === monthFilter;
            })
            .map(t => {
                const topic = normalizeText(t?.name || t?.subject || '—');
                const trainer = normalizeText(t?.trainer || t?.conductedBy || 'غير محدد');
                const location = normalizeText(t?.location || '—');
                const trainingType = normalizeText(t?.trainingType || 'داخلي');
                const participants = Array.isArray(t.participants) ? t.participants : [];
                const trainees = this.getParticipantsCount(t);
                const hours = parseFloat(t?.hours || t?.totalHours || 0) || 0;
                const date = (t?.startDate || t?.date) ? new Date(t.startDate || t.date) : null;

                return {
                    raw: t,
                    date,
                    dateKey: t?.startDate || t?.date ? String(t.startDate || t.date) : '',
                    monthKey: toMonthKey(t?.startDate || t?.date),
                    topic,
                    topicKey: normalizeKey(topic),
                    trainer,
                    trainerKey: normalizeKey(trainer),
                    location,
                    locationKey: normalizeKey(location),
                    trainingType,
                    trainingTypeKey: normalizeKey(trainingType),
                    trainees,
                    hours
                };
            });

        const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));

        const dimensions = {
            trainers: uniq(records.map(r => r.trainer)),
            topics: uniq(records.map(r => r.topic)),
            locations: uniq(records.map(r => r.location)),
            trainingTypes: uniq(records.map(r => r.trainingType))
        };

        return { monthFilter, records, dimensions };
    },

    computeEmployeeAnalytics(model, state) {
        const normalizeKey = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const trainerKey = normalizeKey(state.trainer);
        const topicKey = normalizeKey(state.topic);
        const locationKey = normalizeKey(state.location);
        const trainingTypeKey = normalizeKey(state.trainingType);
        const searchKey = normalizeKey(state.search);

        const filtered = (model.records || []).filter(r => {
            if (trainerKey && r.trainerKey !== trainerKey) return false;
            if (topicKey && r.topicKey !== topicKey) return false;
            if (locationKey && r.locationKey !== locationKey) return false;
            if (trainingTypeKey && r.trainingTypeKey !== trainingTypeKey) return false;
            if (searchKey) {
                const hay = `${r.trainerKey} ${r.topicKey} ${r.locationKey} ${r.trainingTypeKey}`;
                if (!hay.includes(searchKey)) return false;
            }
            return true;
        });

        const totals = {
            programs: filtered.length,
            trainees: filtered.reduce((s, r) => s + (r.trainees || 0), 0),
            hours: filtered.reduce((s, r) => s + (r.hours || 0), 0),
            trainers: new Set(filtered.map(r => r.trainerKey)).size,
            topics: new Set(filtered.map(r => r.topicKey)).size
        };

        const pivotBy = (keyField, labelField) => {
            const map = new Map();
            filtered.forEach(r => {
                const key = r[keyField] || '';
                const label = r[labelField] || 'غير محدد';
                if (!key) return;
                if (!map.has(key)) map.set(key, { key, label, count: 0, trainees: 0, hours: 0 });
                const agg = map.get(key);
                agg.count += 1;
                agg.trainees += r.trainees || 0;
                agg.hours += r.hours || 0;
            });
            return Array.from(map.values());
        };

        const trainersPivot = pivotBy('trainerKey', 'trainer');
        const topicsPivot = pivotBy('topicKey', 'topic');

        const sortDir = state.sortDir === 'asc' ? 1 : -1;
        const sortMetric = state.sortBy || 'hours';
        const sortPivot = (rows) => {
            const sorted = rows.slice().sort((a, b) => {
                const av = a[sortMetric] ?? 0;
                const bv = b[sortMetric] ?? 0;
                if (bv === av) return (a.label || '').localeCompare(b.label || '', 'ar', { sensitivity: 'base' }) * sortDir;
                return (bv - av) * sortDir;
            });
            return sorted;
        };

        const topTrainers = sortPivot(trainersPivot).slice(0, 20);
        const topTopics = sortPivot(topicsPivot).slice(0, 20);

        const drillKey = normalizeKey(state.drillKey);
        const drilled = drillKey
            ? filtered.filter(r => (state.view === 'topic' ? r.topicKey === drillKey : r.trainerKey === drillKey))
            : filtered;

        const detailsSorted = drilled.slice().sort((a, b) => {
            if (state.view !== 'details' && state.sortBy !== 'date') return 0;
            const at = a.date ? a.date.getTime() : 0;
            const bt = b.date ? b.date.getTime() : 0;
            return (bt - at) * sortDir;
        });

        return { filtered, totals, topTrainers, topTopics, details: detailsSorted };
    },

    renderEmployeeAnalyticsDashboard(model, state) {
        const safe = (v) => Utils.escapeHTML(String(v ?? ''));
        const fmt = (n, digits = 0) => {
            const num = Number(n) || 0;
            return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
        };

        const computed = this.computeEmployeeAnalytics(model, state);
        const drillLabel = state.drillKey ? String(state.drillKey) : '';

        const optionList = (items, selected) => {
            const selKey = String(selected ?? '').replace(/\s+/g, ' ').trim();
            return [`<option value="">الكل</option>`]
                .concat(items.map(v => `<option value="${safe(v)}" ${selKey === String(v) ? 'selected' : ''}>${safe(v)}</option>`))
                .join('');
        };

        const renderPivotTable = (rows, mode) => {
            if (!rows.length) {
                return `<div style="padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 100%); border-radius: 12px; border: 2px dashed #99f6e4;">
                    <i class="fas fa-inbox" style="font-size: 2.5rem; color: #5eead4; margin-bottom: 12px; display: block;"></i>
                    <p style="color: #0f766e; font-size: 0.9rem; margin: 0;">لا توجد بيانات مطابقة للفلاتر الحالية</p>
                </div>`;
            }
            return `
                <div class="employee-pivot-table-container" style="overflow: auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #99f6e4; max-height: 400px; scrollbar-width: thin; scrollbar-color: #0d9488 #ccfbf1;">
                    <style>
                        .employee-pivot-table-container::-webkit-scrollbar { width: 6px; height: 6px; }
                        .employee-pivot-table-container::-webkit-scrollbar-track { background: #ccfbf1; border-radius: 10px; }
                        .employee-pivot-table-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #0d9488, #059669); border-radius: 10px; }
                    </style>
                    <table class="table-auto w-full" style="min-width: 640px; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%);">
                                <th style="padding: 14px 16px; font-size: 12px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #0d9488 0%, #059669 100%);">
                                    <i class="fas ${mode === 'topic' ? 'fa-book' : 'fa-user-tie'} ml-2"></i>${mode === 'topic' ? 'البرنامج / الموضوع' : 'القائم بالتدريب'}
                                </th>
                                <th style="padding: 14px 12px; font-size: 12px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #0d9488 0%, #059669 100%);">
                                    <i class="fas fa-clipboard-list ml-1"></i>البرامج
                                </th>
                                <th style="padding: 14px 12px; font-size: 12px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #0d9488 0%, #059669 100%);">
                                    <i class="fas fa-users ml-1"></i>المشاركين
                                </th>
                                <th style="padding: 14px 12px; font-size: 12px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; background: linear-gradient(135deg, #0d9488 0%, #059669 100%);">
                                    <i class="fas fa-clock ml-1"></i>الساعات
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((r, idx) => `
                                <tr class="hover:bg-teal-50 cursor-pointer transition-all duration-200" data-analytics-drill="${safe(r.label)}" data-analytics-mode="${mode}" style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdfa'};" onmouseover="this.style.background='#ccfbf1'; this.style.transform='scale(1.005)'" onmouseout="this.style.background='${idx % 2 === 0 ? '#ffffff' : '#f0fdfa'}'; this.style.transform='scale(1)'">
                                    <td style="padding: 12px 16px; font-size: 12px; text-align: right; border-bottom: 1px solid #f0f0f0;">
                                        <span style="color: #0f766e; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                            <span style="width: 8px; height: 8px; background: linear-gradient(135deg, #0d9488, #059669); border-radius: 50%; flex-shrink: 0;"></span>
                                            ${safe(r.label)}
                                        </span>
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #ccfbf1; color: #0f766e; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${fmt(r.count)}</span>
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${fmt(r.trainees)}</span>
                                    </td>
                                    <td style="padding: 12px; font-size: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                                        <span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 20px; font-weight: 600;">${fmt(r.hours, 2)}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size: 0.75rem; color: #0f766e; margin-top: 8px; text-align: center;">
                    <i class="fas fa-mouse-pointer ml-1"></i>اضغط على أي صف للتعمق في التفاصيل
                </p>
            `;
        };

        const renderDetails = () => {
            const rows = computed.details.slice(0, 300);
            if (!rows.length) return `<div style="padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 100%); border-radius: 12px; border: 2px dashed #99f6e4;">
                <i class="fas fa-folder-open" style="font-size: 2.5rem; color: #5eead4; margin-bottom: 12px; display: block;"></i>
                <p style="color: #0f766e; font-size: 0.9rem; margin: 0;">لا توجد تفاصيل للعرض</p>
            </div>`;
            return `
                <div class="employee-details-table-container" style="overflow: auto; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #99f6e4; max-height: 450px; scrollbar-width: thin; scrollbar-color: #0d9488 #ccfbf1;">
                    <style>
                        .employee-details-table-container::-webkit-scrollbar { width: 6px; height: 6px; }
                        .employee-details-table-container::-webkit-scrollbar-track { background: #ccfbf1; border-radius: 10px; }
                        .employee-details-table-container::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #0d9488, #059669); border-radius: 10px; }
                    </style>
                    <table class="table-auto w-full" style="min-width: 980px; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #0d9488 0%, #059669 100%);">
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">التاريخ</th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">الموضوع</th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">المدرب</th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">نوع التدريب</th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">المشاركين</th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: center; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">الساعات</th>
                                <th style="padding: 14px 12px; font-size: 11px; text-align: right; color: white; font-weight: 700; position: sticky; top: 0; z-index: 10; white-space: nowrap;">الموقع</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((r, idx) => `
                                <tr class="hover:bg-teal-50 transition-all duration-200" style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdfa'};" onmouseover="this.style.background='#ccfbf1'" onmouseout="this.style.background='${idx % 2 === 0 ? '#ffffff' : '#f0fdfa'}'">
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0; white-space: nowrap;">${r.raw?.startDate || r.raw?.date ? safe(Utils.formatDate(r.raw.startDate || r.raw.date)) : '-'}</td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0; max-width: 200px;" title="${safe(r.topic || '-')}">${safe(r.topic || '-')}</td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0;"><span style="color: #0f766e; font-weight: 500;">${safe(r.trainer || '-')}</span></td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 10px;">${safe(r.trainingType || '-')}</span></td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0;"><span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 10px;">${fmt(r.trainees)}</span></td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: center; border-bottom: 1px solid #f0f0f0;"><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 10px;">${fmt(r.hours, 2)}</span></td>
                                    <td style="padding: 10px 12px; font-size: 11px; text-align: right; border-bottom: 1px solid #f0f0f0; max-width: 150px;" title="${safe(r.location || '-')}">${safe(r.location || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding: 8px 12px; background: #f0fdfa; border-radius: 8px; border: 1px solid #99f6e4;">
                    <span style="font-size: 0.75rem; color: #0f766e;"><i class="fas fa-info-circle ml-1"></i>يتم عرض أول 300 سجل فقط لتحسين الأداء</span>
                    <span style="font-size: 0.75rem; color: #0d9488; font-weight: 600;"><i class="fas fa-table ml-1"></i>إجمالي: ${rows.length} سجل</span>
                </div>
            `;
        };

        return `
            <div class="grid grid-cols-1 gap-4" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
                <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%); border-radius: 16px; padding: 22px 24px; border: 1px solid #99f6e4; box-shadow: 0 4px 12px rgba(13,148,136,0.12);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(153,246,228,0.6);">
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f766e; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-filter" style="color: #0d9488;"></i>فلاتر التحليل
                        </h4>
                        <button type="button" id="employee-analytics-reset-btn" style="background: white; border: 1.5px solid #99f6e4; padding: 8px 16px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; color: #0f766e; cursor: pointer; transition: all 0.25s ease; display: flex; align-items: center; gap: 7px;" onmouseover="this.style.background='#f0fdfa'" onmouseout="this.style.background='white'">
                            <i class="fas fa-redo-alt"></i>إعادة تعيين
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style="margin-bottom: 16px;">
                        <div><label style="font-size: 0.75rem; font-weight: 600; color: #134e4a; display: flex; align-items: center; gap: 6px;"><i class="fas fa-user-tie" style="color: #0d9488;"></i>المدرب</label>
                            <select id="employee-analytics-trainer" class="form-input" style="border: 2px solid #99f6e4; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; background: white; min-height: 42px;">${optionList(model.dimensions.trainers, state.trainer)}</select></div>
                        <div><label style="font-size: 0.75rem; font-weight: 600; color: #134e4a; display: flex; align-items: center; gap: 6px;"><i class="fas fa-book" style="color: #0d9488;"></i>الموضوع</label>
                            <select id="employee-analytics-topic" class="form-input" style="border: 2px solid #99f6e4; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; background: white; min-height: 42px;">${optionList(model.dimensions.topics, state.topic)}</select></div>
                        <div><label style="font-size: 0.75rem; font-weight: 600; color: #134e4a; display: flex; align-items: center; gap: 6px;"><i class="fas fa-map-marker-alt" style="color: #0d9488;"></i>الموقع</label>
                            <select id="employee-analytics-location" class="form-input" style="border: 2px solid #99f6e4; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; background: white; min-height: 42px;">${optionList(model.dimensions.locations, state.location)}</select></div>
                        <div><label style="font-size: 0.75rem; font-weight: 600; color: #134e4a; display: flex; align-items: center; gap: 6px;"><i class="fas fa-tag" style="color: #0d9488;"></i>نوع التدريب</label>
                            <select id="employee-analytics-trainingType" class="form-input" style="border: 2px solid #99f6e4; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; background: white; min-height: 42px;">${optionList(model.dimensions.trainingTypes, state.trainingType)}</select></div>
                    </div>
                    <div><label style="font-size: 0.75rem; font-weight: 600; color: #134e4a; display: flex; align-items: center; gap: 6px;"><i class="fas fa-search" style="color: #0d9488;"></i>بحث سريع</label>
                        <input id="employee-analytics-search" class="form-input" placeholder="ابحث..." value="${safe(state.search)}" style="border: 2px solid #99f6e4; border-radius: 10px; padding: 10px 12px; font-size: 0.85rem; background: white; min-height: 42px;"></div>
                </div>

                <div class="employee-analytics-kpi-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #0d9488 0%, #059669 100%); box-shadow: 0 3px 10px rgba(13,148,136,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px;"><i class="fas fa-clipboard-list" style="font-size: 10px;"></i> البرامج</div>
                        <div style="font-size: 22px; font-weight: 800; color: white;">${fmt(computed.totals.programs)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #059669 0%, #047857 100%); box-shadow: 0 3px 10px rgba(5,150,105,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px;"><i class="fas fa-users" style="font-size: 10px;"></i> المشاركين</div>
                        <div style="font-size: 22px; font-weight: 800; color: white;">${fmt(computed.totals.trainees)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #0f766e 0%, #0d5c4a 100%); box-shadow: 0 3px 10px rgba(15,118,110,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px;"><i class="fas fa-clock" style="font-size: 10px;"></i> الساعات</div>
                        <div style="font-size: 22px; font-weight: 800; color: white;">${fmt(computed.totals.hours, 2)}</div>
                    </div>
                    <div style="padding: 14px 12px; border-radius: 10px; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); box-shadow: 0 3px 10px rgba(20,184,166,0.25); min-height: 70px; display: flex; flex-direction: column; justify-content: center;">
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; margin-bottom: 4px;"><i class="fas fa-user-tie" style="font-size: 10px;"></i> المدربين</div>
                        <div style="font-size: 22px; font-weight: 800; color: white;">${fmt(computed.totals.trainers)}</div>
                    </div>
                </div>
                <style>@media (max-width: 1024px){ .employee-analytics-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; } }</style>

                <div style="background: white; border-radius: 14px; padding: 16px 20px; border: 1px solid #99f6e4; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <button type="button" id="employee-analytics-tab-trainer" style="padding: 10px 18px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; border: 2px solid ${state.view === 'trainer' ? '#0d9488' : '#e5e7eb'}; background: ${state.view === 'trainer' ? 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' : 'white'}; color: ${state.view === 'trainer' ? 'white' : '#6b7280'}; cursor: pointer;">
                                <i class="fas fa-user-tie"></i>ملخص حسب المدرب
                            </button>
                            <button type="button" id="employee-analytics-tab-topic" style="padding: 10px 18px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; border: 2px solid ${state.view === 'topic' ? '#0d9488' : '#e5e7eb'}; background: ${state.view === 'topic' ? 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' : 'white'}; color: ${state.view === 'topic' ? 'white' : '#6b7280'}; cursor: pointer;">
                                <i class="fas fa-book"></i>ملخص حسب البرنامج/الموضوع
                            </button>
                            <button type="button" id="employee-analytics-tab-details" style="padding: 10px 18px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; border: 2px solid ${state.view === 'details' ? '#0d9488' : '#e5e7eb'}; background: ${state.view === 'details' ? 'linear-gradient(135deg, #0d9488 0%, #059669 100%)' : 'white'}; color: ${state.view === 'details' ? 'white' : '#6b7280'}; cursor: pointer;">
                                <i class="fas fa-list-alt"></i>عرض التفاصيل
                            </button>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 6px; background: #f0fdfa; padding: 6px 12px; border-radius: 8px; border: 1px solid #99f6e4;">
                                <label style="font-size: 0.7rem; font-weight: 600; color: #0f766e;">فرز:</label>
                                <select id="employee-analytics-sortby" class="form-input" style="border: 1px solid #99f6e4; border-radius: 6px; padding: 6px 10px; font-size: 0.75rem; min-width: 100px; background: white;">
                                    <option value="hours" ${state.sortBy === 'hours' ? 'selected' : ''}>الساعات</option>
                                    <option value="trainees" ${state.sortBy === 'trainees' ? 'selected' : ''}>المشاركين</option>
                                    <option value="count" ${state.sortBy === 'count' ? 'selected' : ''}>عدد البرامج</option>
                                    <option value="date" ${state.sortBy === 'date' ? 'selected' : ''}>التاريخ</option>
                                </select>
                                <select id="employee-analytics-sortdir" class="form-input" style="border: 1px solid #99f6e4; border-radius: 6px; padding: 6px 10px; font-size: 0.75rem; min-width: 90px; background: white;">
                                    <option value="desc" ${state.sortDir === 'desc' ? 'selected' : ''}>تنازلي</option>
                                    <option value="asc" ${state.sortDir === 'asc' ? 'selected' : ''}>تصاعدي</option>
                                </select>
                            </div>
                            ${drillLabel ? `<button type="button" id="employee-analytics-clear-drill" style="padding: 8px 14px; border-radius: 8px; font-size: 0.75rem; font-weight: 600; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; border: 1px solid #fcd34d; cursor: pointer;"><i class="fas fa-times-circle"></i> إلغاء التعمق: ${safe(drillLabel)}</button>` : ''}
                        </div>
                    </div>
                </div>

                <div style="background: white; border-radius: 14px; padding: 20px; border: 1px solid #e5e7eb; box-shadow: 0 2px 6px rgba(0,0,0,0.04); min-height: 300px;">
                    ${state.view === 'topic' ? renderPivotTable(computed.topTopics, 'topic') : state.view === 'details' ? renderDetails() : renderPivotTable(computed.topTrainers, 'trainer')}
                </div>
            </div>
        `;
    },

    refreshEmployeeAnalytics(monthFilter = '') {
        const dashboard = document.getElementById('employee-analytics-dashboard');
        if (!dashboard) return;
        const state = this.getEmployeeAnalyticsState();
        const model = this.getEmployeeTrainingAnalyticsModel(monthFilter);
        dashboard.innerHTML = this.renderEmployeeAnalyticsDashboard(model, state);
        this.bindEmployeeAnalyticsEvents(monthFilter);
    },

    bindEmployeeAnalyticsEvents(monthFilter = '') {
        const state = this.getEmployeeAnalyticsState();
        const getMonth = () => (document.getElementById('employee-month-filter') || {}).value || '';
        const refresh = () => this.refreshEmployeeAnalytics(getMonth());

        const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); };

        wire('employee-analytics-trainer', (e) => { state.trainer = String(e.target.value || ''); state.drillKey = ''; refresh(); });
        wire('employee-analytics-topic', (e) => { state.topic = String(e.target.value || ''); state.drillKey = ''; refresh(); });
        wire('employee-analytics-location', (e) => { state.location = String(e.target.value || ''); state.drillKey = ''; refresh(); });
        wire('employee-analytics-trainingType', (e) => { state.trainingType = String(e.target.value || ''); state.drillKey = ''; refresh(); });
        wire('employee-analytics-sortby', (e) => { state.sortBy = String(e.target.value || 'hours'); refresh(); });
        wire('employee-analytics-sortdir', (e) => { state.sortDir = String(e.target.value || 'desc'); refresh(); });

        const search = document.getElementById('employee-analytics-search');
        if (search) search.addEventListener('input', (e) => { state.search = String(e.target.value || ''); refresh(); });

        const tabTrainer = document.getElementById('employee-analytics-tab-trainer');
        if (tabTrainer) tabTrainer.addEventListener('click', () => { state.view = 'trainer'; state.drillKey = ''; refresh(); });
        const tabTopic = document.getElementById('employee-analytics-tab-topic');
        if (tabTopic) tabTopic.addEventListener('click', () => { state.view = 'topic'; state.drillKey = ''; refresh(); });
        const tabDetails = document.getElementById('employee-analytics-tab-details');
        if (tabDetails) tabDetails.addEventListener('click', () => { state.view = 'details'; refresh(); });

        const clearDrill = document.getElementById('employee-analytics-clear-drill');
        if (clearDrill) clearDrill.addEventListener('click', () => { state.drillKey = ''; refresh(); });

        const resetBtn = document.getElementById('employee-analytics-reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            this._employeeAnalyticsState = { trainer: '', topic: '', location: '', trainingType: '', search: '', view: 'trainer', sortBy: 'hours', sortDir: 'desc', drillKey: '' };
            refresh();
        });

        const dashboard = document.getElementById('employee-analytics-dashboard');
        if (dashboard) {
            dashboard.querySelectorAll('[data-analytics-drill]')?.forEach(row => {
                row.addEventListener('click', () => {
                    const key = String(row.getAttribute('data-analytics-drill') || '').trim();
                    const mode = String(row.getAttribute('data-analytics-mode') || '').trim();
                    state.view = mode === 'topic' ? 'topic' : 'trainer';
                    state.drillKey = key;
                    state.view = 'details';
                    refresh();
                });
            });
        }
    },

    // =========================
    // تحليل تفاعلي لسجل التدريب للموظفين (Slicers + Pivot + Drill-down) - بيانات trainingAttendance
    // =========================

    getAttendanceAnalyticsState() {
        this._attendanceAnalyticsState = this._attendanceAnalyticsState || {
            employee: '',
            topic: '',
            department: '',
            factory: '',
            trainingType: '',
            trainer: '',
            search: '',
            view: 'employee',
            drillMode: 'employee', // 'employee' | 'topic' عند التعمق لاستخدامه في الفلتر
            sortBy: 'hours',
            sortDir: 'desc',
            drillKey: ''
        };
        return this._attendanceAnalyticsState;
    },

    getAttendanceAnalyticsModel(monthFilter = '') {
        this.ensureData();
        const list = AppState.appData.trainingAttendance || [];
        const toMonthKey = (d) => {
            if (!d) return '';
            const date = new Date(d);
            return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };
        const normalizeText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
        const normalizeKey = (v) => normalizeText(v).toLowerCase();

        const records = list
            .filter(r => {
                if (!monthFilter) return true;
                const d = r?.date || r?.attendanceDate || r?.createdAt;
                return toMonthKey(d) === monthFilter;
            })
            .map(r => {
                const employee = normalizeText(r?.employeeName || r?.employee || '—');
                const topic = normalizeText(r?.topic || '—');
                const department = normalizeText(r?.department || '—');
                const factory = normalizeText(r?.factoryName || r?.factory || '—');
                const trainingType = normalizeText(r?.trainingType || 'داخلي');
                const trainer = normalizeText(r?.trainerName || r?.trainer || r?.conductedBy || '—');
                const hours = parseFloat(r?.totalHours || 0) || 0;
                const date = (r?.date || r?.attendanceDate) ? new Date(r.date || r.attendanceDate) : null;
                return {
                    raw: r,
                    date,
                    employee,
                    employeeKey: normalizeKey(employee),
                    topic,
                    topicKey: normalizeKey(topic),
                    department,
                    departmentKey: normalizeKey(department),
                    factory,
                    factoryKey: normalizeKey(factory),
                    trainingType,
                    trainingTypeKey: normalizeKey(trainingType),
                    trainer,
                    trainerKey: normalizeKey(trainer),
                    hours
                };
            });

        const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }));
        return {
            monthFilter,
            records,
            dimensions: {
                employees: uniq(records.map(x => x.employee)),
                topics: uniq(records.map(x => x.topic)),
                departments: uniq(records.map(x => x.department)),
                factories: uniq(records.map(x => x.factory)),
                trainingTypes: uniq(records.map(x => x.trainingType)),
                trainers: uniq(records.map(x => x.trainer))
            }
        };
    },

    computeAttendanceAnalytics(model, state) {
        const normalizeKey = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const filtered = (model.records || []).filter(r => {
            if (state.employee && r.employeeKey !== normalizeKey(state.employee)) return false;
            if (state.topic && r.topicKey !== normalizeKey(state.topic)) return false;
            if (state.department && r.departmentKey !== normalizeKey(state.department)) return false;
            if (state.factory && r.factoryKey !== normalizeKey(state.factory)) return false;
            if (state.trainingType && r.trainingTypeKey !== normalizeKey(state.trainingType)) return false;
            if (state.trainer && r.trainerKey !== normalizeKey(state.trainer)) return false;
            const sk = normalizeKey(state.search);
            if (sk && !(`${r.employeeKey} ${r.topicKey} ${r.departmentKey} ${r.factoryKey} ${r.trainerKey}`).includes(sk)) return false;
            return true;
        });
        const totals = {
            records: filtered.length,
            hours: filtered.reduce((s, r) => s + (r.hours || 0), 0),
            employees: new Set(filtered.map(r => r.employeeKey)).size,
            topics: new Set(filtered.map(r => r.topicKey)).size
        };
        const pivotBy = (keyField, labelField) => {
            const map = new Map();
            filtered.forEach(r => {
                const key = r[keyField] || '';
                const label = r[labelField] || '—';
                if (!key) return;
                if (!map.has(key)) map.set(key, { key, label, count: 0, hours: 0 });
                const agg = map.get(key);
                agg.count += 1;
                agg.hours += r.hours || 0;
            });
            return Array.from(map.values());
        };
        const sortDir = state.sortDir === 'asc' ? 1 : -1;
        const sortMetric = state.sortBy || 'hours';
        const sortPivot = (rows) => rows.slice().sort((a, b) => {
            const av = a[sortMetric] ?? 0;
            const bv = b[sortMetric] ?? 0;
            if (bv === av) return (a.label || '').localeCompare(b.label || '', 'ar', { sensitivity: 'base' }) * sortDir;
            return (bv - av) * sortDir;
        });
        const topEmployees = sortPivot(pivotBy('employeeKey', 'employee')).slice(0, 20);
        const topTopics = sortPivot(pivotBy('topicKey', 'topic')).slice(0, 20);
        const drillKey = normalizeKey(state.drillKey);
        const drilled = drillKey
            ? filtered.filter(r => (state.drillMode === 'topic' ? r.topicKey === drillKey : r.employeeKey === drillKey))
            : filtered;
        const detailsSorted = drilled.slice().sort((a, b) => {
            const at = a.date ? a.date.getTime() : 0;
            const bt = b.date ? b.date.getTime() : 0;
            return (bt - at) * sortDir;
        });
        return { filtered, totals, topEmployees, topTopics, details: detailsSorted };
    },

    renderAttendanceAnalyticsDashboard(model, state) {
        const safe = (v) => Utils.escapeHTML(String(v ?? ''));
        const fmt = (n, d = 0) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
        const computed = this.computeAttendanceAnalytics(model, state);
        const drillLabel = state.drillKey ? String(state.drillKey) : '';
        const optionList = (items, selected) => {
            const sel = String(selected ?? '').trim();
            return ['<option value="">الكل</option>'].concat(items.map(v => `<option value="${safe(v)}" ${sel === String(v) ? 'selected' : ''}>${safe(v)}</option>`)).join('');
        };
        const renderPivotTable = (rows, mode) => {
            if (!rows.length) {
                return `<div style="padding:40px 20px;text-align:center;background:linear-gradient(180deg,#f0fdfa 0%,#ccfbf1 100%);border-radius:12px;border:2px dashed #99f6e4;"><i class="fas fa-inbox" style="font-size:2.5rem;color:#5eead4;"></i><p style="color:#0f766e;margin:8px 0 0;">لا توجد بيانات مطابقة للفلاتر</p></div>`;
            }
            return `
                <div class="attendance-pivot-container" style="overflow:auto;border-radius:12px;border:1px solid #99f6e4;max-height:400px;">
                    <table class="table-auto w-full" style="min-width:560px;">
                        <thead><tr style="background:linear-gradient(135deg,#0d9488 0%,#059669 100%);">
                            <th style="padding:14px;font-size:12px;text-align:right;color:white;">${mode === 'topic' ? 'الموضوع' : 'الموظف'}</th>
                            <th style="padding:14px;font-size:12px;text-align:center;color:white;">السجلات</th>
                            <th style="padding:14px;font-size:12px;text-align:center;color:white;">الساعات</th>
                        </tr></thead>
                        <tbody>
                            ${rows.map((r, i) => `
                                <tr data-analytics-drill="${safe(r.label)}" data-analytics-mode="${mode}" style="background:${i % 2 ? '#f0fdfa' : '#fff'};cursor:pointer;" class="hover:bg-teal-50">
                                    <td style="padding:12px;font-size:12px;color:#0f766e;font-weight:600;">${safe(r.label)}</td>
                                    <td style="padding:12px;text-align:center;"><span style="background:#ccfbf1;color:#0f766e;padding:4px 10px;border-radius:20px;font-weight:600;">${fmt(r.count)}</span></td>
                                    <td style="padding:12px;text-align:center;"><span style="background:#fef3c7;color:#92400e;padding:4px 10px;border-radius:20px;font-weight:600;">${fmt(r.hours, 2)}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size:0.75rem;color:#0f766e;margin-top:8px;text-align:center;">اضغط على أي صف للتعمق</p>
            `;
        };
        const renderDetails = () => {
            const rows = computed.details.slice(0, 300);
            if (!rows.length) return `<div style="padding:40px;text-align:center;background:#f0fdfa;border-radius:12px;border:2px dashed #99f6e4;"><p style="color:#0f766e;">لا توجد تفاصيل</p></div>`;
            return `
                <div style="overflow:auto;border-radius:12px;border:1px solid #99f6e4;max-height:450px;">
                    <table class="table-auto w-full" style="min-width:900px;">
                        <thead><tr style="background:linear-gradient(135deg,#0d9488 0%,#059669 100%);">
                            <th style="padding:10px;font-size:11px;color:white;text-align:center;">التاريخ</th>
                            <th style="padding:10px;font-size:11px;color:white;text-align:right;">الموضوع</th>
                            <th style="padding:10px;font-size:11px;color:white;text-align:right;">الموظف</th>
                            <th style="padding:10px;font-size:11px;color:white;text-align:center;">نوع التدريب</th>
                            <th style="padding:10px;font-size:11px;color:white;text-align:right;">الإدارة</th>
                            <th style="padding:10px;font-size:11px;color:white;text-align:center;">الساعات</th>
                        </tr></thead>
                        <tbody>
                            ${rows.map((r, i) => `
                                <tr style="background:${i % 2 ? '#f0fdfa' : '#fff'}">
                                    <td style="padding:10px;font-size:11px;">${(r.raw?.date || r.raw?.attendanceDate) ? safe(Utils.formatDate(r.raw.date || r.raw.attendanceDate)) : '-'}</td>
                                    <td style="padding:10px;font-size:11px;">${safe(r.topic)}</td>
                                    <td style="padding:10px;font-size:11px;">${safe(r.employee)}</td>
                                    <td style="padding:10px;font-size:11px;">${safe(r.trainingType)}</td>
                                    <td style="padding:10px;font-size:11px;">${safe(r.department)}</td>
                                    <td style="padding:10px;font-size:11px;text-align:center;">${fmt(r.hours, 2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size:0.75rem;color:#0f766e;margin-top:8px;">أول 300 سجل</p>
            `;
        };
        return `
            <div class="grid grid-cols-1 gap-4">
                <div style="background:linear-gradient(135deg,#f0fdfa 0%,#ccfbf1 100%);border-radius:16px;padding:22px;border:1px solid #99f6e4;">
                    <h4 style="margin:0 0 16px;font-size:0.95rem;font-weight:700;color:#0f766e;"><i class="fas fa-filter" style="color:#0d9488;"></i> فلاتر التحليل</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">الموظف</label><select id="attendance-analytics-employee" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;">${optionList(model.dimensions.employees, state.employee)}</select></div>
                        <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">الموضوع</label><select id="attendance-analytics-topic" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;">${optionList(model.dimensions.topics, state.topic)}</select></div>
                        <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">الإدارة</label><select id="attendance-analytics-department" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;">${optionList(model.dimensions.departments, state.department)}</select></div>
                        <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">المصنع</label><select id="attendance-analytics-factory" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;">${optionList(model.dimensions.factories, state.factory)}</select></div>
                        <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">نوع التدريب</label><select id="attendance-analytics-trainingType" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;">${optionList(model.dimensions.trainingTypes, state.trainingType)}</select></div>
                        <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">المحاضر</label><select id="attendance-analytics-trainer" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;">${optionList(model.dimensions.trainers, state.trainer)}</select></div>
                    </div>
                    <div><label style="font-size:0.75rem;font-weight:600;color:#134e4a;">بحث سريع</label><input id="attendance-analytics-search" placeholder="ابحث..." value="${safe(state.search)}" class="form-input" style="border:2px solid #99f6e4;border-radius:10px;padding:10px;width:100%;"></div>
                    <div style="margin-top:12px;"><button type="button" id="attendance-analytics-reset-btn" style="background:white;border:1.5px solid #99f6e4;padding:8px 16px;border-radius:10px;font-weight:600;color:#0f766e;cursor:pointer;"><i class="fas fa-redo-alt"></i> إعادة تعيين</button></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
                    <div style="padding:14px;border-radius:10px;background:linear-gradient(135deg,#0d9488,#059669);color:white;"><div style="font-size:11px;">السجلات</div><div style="font-size:22px;font-weight:800;">${fmt(computed.totals.records)}</div></div>
                    <div style="padding:14px;border-radius:10px;background:linear-gradient(135deg,#059669,#047857);color:white;"><div style="font-size:11px;">الساعات</div><div style="font-size:22px;font-weight:800;">${fmt(computed.totals.hours, 2)}</div></div>
                    <div style="padding:14px;border-radius:10px;background:linear-gradient(135deg,#0f766e,#0d5c4a);color:white;"><div style="font-size:11px;">الموظفين</div><div style="font-size:22px;font-weight:800;">${fmt(computed.totals.employees)}</div></div>
                    <div style="padding:14px;border-radius:10px;background:linear-gradient(135deg,#14b8a6,#0d9488);color:white;"><div style="font-size:11px;">الموضوعات</div><div style="font-size:22px;font-weight:800;">${fmt(computed.totals.topics)}</div></div>
                </div>
                <div style="background:white;border-radius:14px;padding:16px;border:1px solid #e5e7eb;">
                    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:space-between;">
                        <div style="display:flex;gap:8px;">
                            <button type="button" id="attendance-analytics-tab-employee" style="padding:10px 18px;border-radius:10px;font-size:0.8rem;font-weight:600;border:2px solid ${state.view === 'employee' ? '#0d9488' : '#e5e7eb'};background:${state.view === 'employee' ? 'linear-gradient(135deg,#0d9488,#059669)' : 'white'};color:${state.view === 'employee' ? 'white' : '#6b7280'};cursor:pointer;"><i class="fas fa-user"></i> حسب الموظف</button>
                            <button type="button" id="attendance-analytics-tab-topic" style="padding:10px 18px;border-radius:10px;font-size:0.8rem;font-weight:600;border:2px solid ${state.view === 'topic' ? '#0d9488' : '#e5e7eb'};background:${state.view === 'topic' ? 'linear-gradient(135deg,#0d9488,#059669)' : 'white'};color:${state.view === 'topic' ? 'white' : '#6b7280'};cursor:pointer;"><i class="fas fa-book"></i> حسب الموضوع</button>
                            <button type="button" id="attendance-analytics-tab-details" style="padding:10px 18px;border-radius:10px;font-size:0.8rem;font-weight:600;border:2px solid ${state.view === 'details' ? '#0d9488' : '#e5e7eb'};background:${state.view === 'details' ? 'linear-gradient(135deg,#0d9488,#059669)' : 'white'};color:${state.view === 'details' ? 'white' : '#6b7280'};cursor:pointer;"><i class="fas fa-list-alt"></i> التفاصيل</button>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <label style="font-size:0.7rem;font-weight:600;color:#6b7280;">فرز:</label>
                            <select id="attendance-analytics-sortby" style="border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;font-size:0.75rem;"><option value="hours" ${state.sortBy === 'hours' ? 'selected' : ''}>الساعات</option><option value="count" ${state.sortBy === 'count' ? 'selected' : ''}>عدد السجلات</option></select>
                            <select id="attendance-analytics-sortdir" style="border:1px solid #e5e7eb;border-radius:6px;padding:6px 10px;font-size:0.75rem;"><option value="desc" ${state.sortDir === 'desc' ? 'selected' : ''}>تنازلي</option><option value="asc" ${state.sortDir === 'asc' ? 'selected' : ''}>تصاعدي</option></select>
                            ${drillLabel ? `<button type="button" id="attendance-analytics-clear-drill" style="padding:8px 14px;border-radius:8px;font-size:0.75rem;font-weight:600;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;cursor:pointer;"><i class="fas fa-times-circle"></i> إلغاء التعمق: ${safe(drillLabel)}</button>` : ''}
                        </div>
                    </div>
                </div>
                <div style="background:white;border-radius:14px;padding:20px;border:1px solid #e5e7eb;min-height:300px;">
                    ${state.view === 'topic' ? renderPivotTable(computed.topTopics, 'topic') : state.view === 'details' ? renderDetails() : renderPivotTable(computed.topEmployees, 'employee')}
                </div>
            </div>
        `;
    },

    refreshAttendanceAnalytics(monthFilter = '') {
        const dashboard = document.getElementById('attendance-analytics-dashboard');
        if (!dashboard) return;
        const state = this.getAttendanceAnalyticsState();
        const model = this.getAttendanceAnalyticsModel(monthFilter);
        dashboard.innerHTML = this.renderAttendanceAnalyticsDashboard(model, state);
        this.bindAttendanceAnalyticsEvents(monthFilter);
    },

    bindAttendanceAnalyticsEvents(monthFilter = '') {
        const state = this.getAttendanceAnalyticsState();
        const getMonth = () => (document.getElementById('attendance-month-filter') || {}).value || '';
        const refresh = () => this.refreshAttendanceAnalytics(getMonth());
        const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); };
        wire('attendance-analytics-employee', (e) => { state.employee = e.target.value || ''; state.drillKey = ''; refresh(); });
        wire('attendance-analytics-topic', (e) => { state.topic = e.target.value || ''; state.drillKey = ''; refresh(); });
        wire('attendance-analytics-department', (e) => { state.department = e.target.value || ''; state.drillKey = ''; refresh(); });
        wire('attendance-analytics-factory', (e) => { state.factory = e.target.value || ''; state.drillKey = ''; refresh(); });
        wire('attendance-analytics-trainingType', (e) => { state.trainingType = e.target.value || ''; state.drillKey = ''; refresh(); });
        wire('attendance-analytics-trainer', (e) => { state.trainer = e.target.value || ''; state.drillKey = ''; refresh(); });
        wire('attendance-analytics-sortby', (e) => { state.sortBy = e.target.value || 'hours'; refresh(); });
        wire('attendance-analytics-sortdir', (e) => { state.sortDir = e.target.value || 'desc'; refresh(); });
        const search = document.getElementById('attendance-analytics-search');
        if (search) search.addEventListener('input', (e) => { state.search = e.target.value || ''; refresh(); });
        const tabEmployee = document.getElementById('attendance-analytics-tab-employee');
        if (tabEmployee) tabEmployee.addEventListener('click', () => { state.view = 'employee'; state.drillKey = ''; refresh(); });
        const tabTopic = document.getElementById('attendance-analytics-tab-topic');
        if (tabTopic) tabTopic.addEventListener('click', () => { state.view = 'topic'; state.drillKey = ''; refresh(); });
        const tabDetails = document.getElementById('attendance-analytics-tab-details');
        if (tabDetails) tabDetails.addEventListener('click', () => { state.view = 'details'; refresh(); });
        const clearDrill = document.getElementById('attendance-analytics-clear-drill');
        if (clearDrill) clearDrill.addEventListener('click', () => { state.drillKey = ''; refresh(); });
        const resetBtn = document.getElementById('attendance-analytics-reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            this._attendanceAnalyticsState = { employee: '', topic: '', department: '', factory: '', trainingType: '', trainer: '', search: '', view: 'employee', drillMode: 'employee', sortBy: 'hours', sortDir: 'desc', drillKey: '' };
            refresh();
        });
        const dashboard = document.getElementById('attendance-analytics-dashboard');
        if (dashboard) {
            dashboard.querySelectorAll('[data-analytics-drill]').forEach(row => {
                row.addEventListener('click', () => {
                    const key = String(row.getAttribute('data-analytics-drill') || '').trim();
                    const mode = String(row.getAttribute('data-analytics-mode') || '').trim();
                    state.drillMode = mode === 'topic' ? 'topic' : 'employee';
                    state.drillKey = key;
                    state.view = 'details';
                    refresh();
                });
            });
        }
    },

    /**
     * رسم بياني لتفاصيل التدريبات حسب المقاول
     */
    renderContractorDetailsChart(contractorDetails) {
        const entries = Object.entries(contractorDetails);
        if (entries.length === 0) {
            return `
                <div class="flex items-center justify-center text-gray-400" style="min-height: 120px;">
                    <div class="text-center">
                        <i class="fas fa-chart-bar text-2xl mb-2 opacity-50"></i>
                        <p class="text-xs">لا توجد بيانات للعرض</p>
                    </div>
                </div>
            `;
        }

        // ترتيب حسب عدد التدريبات وأخذ أعلى 8
        const sortedEntries = entries.sort((a, b) => b[1].count - a[1].count).slice(0, 8);
        const maxCount = Math.max(...sortedEntries.map(e => e[1].count), 1);
        const maxTrainees = Math.max(...sortedEntries.map(e => e[1].trainees), 1);
        const maxHours = Math.max(...sortedEntries.map(e => e[1].hours), 1);

        const gradientColors = [
            'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
            'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
            'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)'
        ];

        return `
            <div class="space-y-2.5" style="padding: 4px 0; max-height: 400px; overflow-y: auto;">
                ${sortedEntries.map(([name, data], index) => {
                    const countPercent = (data.count / maxCount) * 100;
                    const traineesPercent = (data.trainees / maxTrainees) * 100;
                    const hoursPercent = (data.hours / maxHours) * 100;
                    const gradient = gradientColors[index % gradientColors.length];
                    const shortName = name.length > 20 ? name.substring(0, 18) + '...' : name;
                    const rank = index + 1;
                    
                    return `
                        <div class="group relative" style="padding: 8px 10px; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border-radius: 8px; border: 1px solid #E2E8F0; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" 
                             onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'; this.style.borderColor='#CBD5E1';"
                             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 2px rgba(0,0,0,0.04)'; this.style.borderColor='#E2E8F0';">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2 flex-1 min-w-0">
                                    <div class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-xs" style="background: ${gradient}; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
                                        ${rank}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <h4 class="text-xs font-semibold text-gray-800 truncate" title="${Utils.escapeHTML(name)}" style="font-size: 11px; line-height: 1.3;">
                                            <i class="fas fa-building text-xs ml-1" style="color: #64748B; font-size: 9px;"></i>${Utils.escapeHTML(shortName)}
                                        </h4>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 flex-shrink-0">
                                    <span class="px-1.5 py-0.5 rounded text-white text-xs font-medium" style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); font-size: 9px;">
                                        <i class="fas fa-book" style="font-size: 8px; margin-left: 2px;"></i>${data.count}
                                    </span>
                                    <span class="px-1.5 py-0.5 rounded text-white text-xs font-medium" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); font-size: 9px;">
                                        <i class="fas fa-users" style="font-size: 8px; margin-left: 2px;"></i>${data.trainees}
                                    </span>
                                    <span class="px-1.5 py-0.5 rounded text-white text-xs font-medium" style="background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); font-size: 9px;">
                                        <i class="fas fa-clock" style="font-size: 8px; margin-left: 2px;"></i>${data.hours.toFixed(1)}س
                                    </span>
                                </div>
                            </div>
                            
                            <div class="space-y-1.5">
                                <div class="relative">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="text-xs text-gray-600 font-medium" style="font-size: 9px;">
                                            <i class="fas fa-book" style="color: #3B82F6; font-size: 8px; margin-left: 2px;"></i>التدريبات
                                        </span>
                                        <span class="text-xs font-bold text-gray-700" style="font-size: 9px;">${data.count}</span>
                                    </div>
                                    <div class="h-2 rounded-full overflow-hidden bg-gray-100" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                                        <div class="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                                             style="width: ${countPercent}%; background: ${gradient}; box-shadow: 0 1px 3px rgba(0,0,0,0.12);"
                                             title="عدد التدريبات: ${data.count}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="relative">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="text-xs text-gray-600 font-medium" style="font-size: 9px;">
                                            <i class="fas fa-users" style="color: #10B981; font-size: 8px; margin-left: 2px;"></i>المتدربين
                                        </span>
                                        <span class="text-xs font-bold text-gray-700" style="font-size: 9px;">${data.trainees}</span>
                                    </div>
                                    <div class="h-2 rounded-full overflow-hidden bg-gray-100" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                                        <div class="h-full rounded-full transition-all duration-500 ease-out" 
                                             style="width: ${traineesPercent}%; background: linear-gradient(135deg, #10B981 0%, #059669 100%); box-shadow: 0 1px 3px rgba(16,185,129,0.25);"
                                             title="عدد المتدربين: ${data.trainees}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="relative">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="text-xs text-gray-600 font-medium" style="font-size: 9px;">
                                            <i class="fas fa-clock" style="color: #8B5CF6; font-size: 8px; margin-left: 2px;"></i>الساعات
                                        </span>
                                        <span class="text-xs font-bold text-gray-700" style="font-size: 9px;">${data.hours.toFixed(1)}</span>
                                    </div>
                                    <div class="h-2 rounded-full overflow-hidden bg-gray-100" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                                        <div class="h-full rounded-full transition-all duration-500 ease-out" 
                                             style="width: ${hoursPercent}%; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); box-shadow: 0 1px 3px rgba(139,92,246,0.25);"
                                             title="ساعات التدريب: ${data.hours.toFixed(2)}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <style>
                .space-y-2\\.5 > * + * { margin-top: 0.625rem; }
                .space-y-1\\.5 > * + * { margin-top: 0.375rem; }
            </style>
        `;
    },

    /**
     * رسم بياني لتفاصيل القائمين بالتدريب
     */
    renderTrainerDetailsChart(trainerDetails) {
        const entries = Object.entries(trainerDetails);
        if (entries.length === 0) {
            return `
                <div class="flex items-center justify-center text-gray-400" style="min-height: 120px;">
                    <div class="text-center">
                        <i class="fas fa-user-tie text-2xl mb-2 opacity-50"></i>
                        <p class="text-xs">لا توجد بيانات للعرض</p>
                    </div>
                </div>
            `;
        }

        // ترتيب حسب ساعات التدريب وأخذ أعلى 8
        const sortedEntries = entries.sort((a, b) => b[1].hours - a[1].hours).slice(0, 8);
        const maxCount = Math.max(...sortedEntries.map(e => e[1].count), 1);
        const maxTrainees = Math.max(...sortedEntries.map(e => e[1].trainees), 1);
        const maxHours = Math.max(...sortedEntries.map(e => e[1].hours), 1);

        const gradientColors = [
            'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
            'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
            'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)'
        ];

        return `
            <div class="space-y-2.5" style="padding: 4px 0; max-height: 400px; overflow-y: auto;">
                ${sortedEntries.map(([name, data], index) => {
                    const countPercent = (data.count / maxCount) * 100;
                    const traineesPercent = (data.trainees / maxTrainees) * 100;
                    const hoursPercent = (data.hours / maxHours) * 100;
                    const gradient = gradientColors[index % gradientColors.length];
                    const shortName = name.length > 20 ? name.substring(0, 18) + '...' : name;
                    const rank = index + 1;
                    
                    return `
                        <div class="group relative" style="padding: 8px 10px; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border-radius: 8px; border: 1px solid #E2E8F0; transition: all 0.2s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.04);" 
                             onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'; this.style.borderColor='#CBD5E1';"
                             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 2px rgba(0,0,0,0.04)'; this.style.borderColor='#E2E8F0';">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2 flex-1 min-w-0">
                                    <div class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-xs" style="background: ${gradient}; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
                                        ${rank}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <h4 class="text-xs font-semibold text-gray-800 truncate" title="${Utils.escapeHTML(name)}" style="font-size: 11px; line-height: 1.3;">
                                            <i class="fas fa-user-tie" style="color: #64748B; font-size: 9px; margin-left: 2px;"></i>${Utils.escapeHTML(shortName)}
                                        </h4>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1 flex-shrink-0">
                                    <span class="px-1.5 py-0.5 rounded text-white text-xs font-medium" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); font-size: 9px;">
                                        <i class="fas fa-clock" style="font-size: 8px; margin-left: 2px;"></i>${data.hours.toFixed(1)}س
                                    </span>
                                    <span class="px-1.5 py-0.5 rounded text-white text-xs font-medium" style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); font-size: 9px;">
                                        <i class="fas fa-book" style="font-size: 8px; margin-left: 2px;"></i>${data.count}
                                    </span>
                                    <span class="px-1.5 py-0.5 rounded text-white text-xs font-medium" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); font-size: 9px;">
                                        <i class="fas fa-users" style="font-size: 8px; margin-left: 2px;"></i>${data.trainees}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="space-y-1.5">
                                <div class="relative">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="text-xs text-gray-600 font-medium" style="font-size: 9px;">
                                            <i class="fas fa-clock" style="color: #F59E0B; font-size: 8px; margin-left: 2px;"></i>الساعات
                                        </span>
                                        <span class="text-xs font-bold text-gray-700" style="font-size: 9px;">${data.hours.toFixed(1)}</span>
                                    </div>
                                    <div class="h-2 rounded-full overflow-hidden bg-gray-100" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                                        <div class="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden" 
                                             style="width: ${hoursPercent}%; background: ${gradient}; box-shadow: 0 1px 3px rgba(245,158,11,0.25);"
                                             title="ساعات التدريب: ${data.hours.toFixed(2)}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="relative">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="text-xs text-gray-600 font-medium" style="font-size: 9px;">
                                            <i class="fas fa-book" style="color: #3B82F6; font-size: 8px; margin-left: 2px;"></i>التدريبات
                                        </span>
                                        <span class="text-xs font-bold text-gray-700" style="font-size: 9px;">${data.count}</span>
                                    </div>
                                    <div class="h-2 rounded-full overflow-hidden bg-gray-100" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                                        <div class="h-full rounded-full transition-all duration-500 ease-out" 
                                             style="width: ${countPercent}%; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); box-shadow: 0 1px 3px rgba(59,130,246,0.25);"
                                             title="عدد التدريبات: ${data.count}">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="relative">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="text-xs text-gray-600 font-medium" style="font-size: 9px;">
                                            <i class="fas fa-users" style="color: #10B981; font-size: 8px; margin-left: 2px;"></i>المتدربين
                                        </span>
                                        <span class="text-xs font-bold text-gray-700" style="font-size: 9px;">${data.trainees}</span>
                                    </div>
                                    <div class="h-2 rounded-full overflow-hidden bg-gray-100" style="box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                                        <div class="h-full rounded-full transition-all duration-500 ease-out" 
                                             style="width: ${traineesPercent}%; background: linear-gradient(135deg, #10B981 0%, #059669 100%); box-shadow: 0 1px 3px rgba(16,185,129,0.25);"
                                             title="عدد المتدربين: ${data.trainees}">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    getMonthOptions() {
        this.ensureData();
        const contractorTrainings = AppState.appData.contractorTrainings || [];
        const months = new Set();

        contractorTrainings.forEach(training => {
            if (training.date) {
                const date = new Date(training.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                months.add(monthKey);
            }
        });

        const monthsArray = Array.from(months).sort().reverse();
        return monthsArray.map(monthKey => {
            const [year, month] = monthKey.split('-');
            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                              'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            const monthName = monthNames[parseInt(month) - 1];
            return `<option value="${monthKey}">${monthName} ${year}</option>`;
        }).join('');
    },

    getEmployeeMonthOptions() {
        this.ensureData();
        const trainings = AppState.appData.training || [];
        const months = new Set();
        trainings.forEach(t => {
            const d = t?.startDate || t?.date || t?.createdAt;
            if (d) {
                const date = new Date(d);
                if (!Number.isNaN(date.getTime())) {
                    months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
                }
            }
        });
        const monthsArray = Array.from(months).sort().reverse();
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        return monthsArray.map(monthKey => {
            const [year, month] = monthKey.split('-');
            return `<option value="${monthKey}">${monthNames[parseInt(month) - 1]} ${year}</option>`;
        }).join('');
    },

    getAttendanceMonthOptions() {
        this.ensureData();
        const list = AppState.appData.trainingAttendance || [];
        const months = new Set();
        list.forEach(r => {
            const d = r?.date || r?.attendanceDate || r?.createdAt;
            if (d) {
                const date = new Date(d);
                if (!Number.isNaN(date.getTime())) {
                    months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
                }
            }
        });
        const monthsArray = Array.from(months).sort().reverse();
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        return monthsArray.map(monthKey => {
            const [year, month] = monthKey.split('-');
            return `<option value="${monthKey}">${monthNames[parseInt(month) - 1]} ${year}</option>`;
        }).join('');
    },

    /** محتوى تبويب «برامج التدريب» — متزامن لتجنب تأخير await عند أول عرض للموديول */
    buildProgramsTabMarkup() {
        const stats = this.getStats();
        return `
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="content-card h-full">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-graduation-cap text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">إجمالي البرامج</p>
                                <p class="text-2xl font-bold text-gray-900">${stats.totalTrainings}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-calendar-alt text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">برامج قادمة</p>
                                <p class="text-2xl font-bold text-gray-900">${stats.upcomingTrainings}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-check-circle text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">برامج مكتملة</p>
                                <p class="text-2xl font-bold text-gray-900">${stats.completedTrainings}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                                <i class="fas fa-users text-2xl"></i>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">إجمالي المشاركين</p>
                                <p class="text-2xl font-bold text-gray-900">${stats.totalParticipants}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title"><i class="fas fa-list ml-2"></i>قائمة برامج التدريب</h2>
                            <div class="flex items-center gap-4">
                                <button id="export-training-pdf-btn" class="btn-secondary">
                                    <i class="fas fa-file-pdf ml-2" style="font-size: 14px;"></i>تقرير PDF
                                </button>
                                <button id="export-training-excel-btn" class="btn-success">
                                    <i class="fas fa-file-excel ml-2" style="font-size: 14px;"></i>تصدير Excel
                                </button>
                                <input type="text" id="training-search" class="form-input" style="max-width: 300px;" placeholder="البحث...">
                                <select id="training-filter-status" class="form-input" style="max-width: 200px;">
                                    <option value="">جميع الحالات</option>
                                    <option value="مخطط">مخطط</option>
                                    <option value="قيد التنفيذ">قيد التنفيذ</option>
                                    <option value="مكتمل">مكتمل</option>
                                    <option value="ملغي">ملغي</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="training-table-container">
                            <div class="table-wrapper" style="overflow-x: auto;">
                                <table class="data-table table-header-purple">
                                    <thead>
                                        <tr>
                                            <th>اسم البرنامج</th>
                                            <th>نوع التدريب</th>
                                            <th>المدرب</th>
                                            <th>تاريخ البدء</th>
                                            <th>عدد المشاركين</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td colspan="7" class="text-center text-gray-500 py-10">
                                                <div class="flex flex-col items-center justify-center gap-3">
                                                    <div style="width:200px;height:4px;background:rgba(59,130,246,0.2);border-radius:3px;overflow:hidden">
                                                        <div style="height:100%;width:40%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:3px;animation:loadingProgress 1.2s ease-in-out infinite"></div>
                                                    </div>
                                                    <span>جاري تحديث القائمة…</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
    },

    async renderTabContent(tabName) {
        if (tabName === 'programs') {
            return this.buildProgramsTabMarkup();
        } else if (tabName === 'contractors') {
            const contractorStats = this.getContractorTrainingStats();
            const analyticsModel = this.getContractorTrainingAnalyticsModel('');
            const analyticsState = this.getContractorAnalyticsState();
            return `
                <!-- فلتر الشهر -->
                <div class="content-card mb-4">
                    <div class="card-body">
                        <div class="flex items-center gap-4">
                            <label class="text-sm font-medium text-gray-700">تصفية حسب الشهر:</label>
                            <select id="contractor-month-filter" class="form-input" style="max-width: 200px;">
                                <option value="">جميع الأشهر</option>
                                ${this.getMonthOptions()}
                            </select>
                            <button id="reset-contractor-filter" class="btn-secondary">
                                <i class="fas fa-redo ml-2"></i>إعادة تعيين
                            </button>
                        </div>
                    </div>
                </div>

                <!-- الكروت الإحصائية -->
                <div class="grid grid-cols-5 gap-4 mb-6">
                    <div class="content-card h-full">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-book text-xl"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-gray-500">الموضوعات التدريبية</p>
                                <p class="text-xl font-bold text-gray-900" id="contractor-topics-count">${contractorStats.uniqueTopics}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-building text-xl"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-gray-500">المقاولين/الشركات</p>
                                <p class="text-xl font-bold text-gray-900" id="contractor-companies-count">${contractorStats.uniqueContractors}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-users text-xl"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-gray-500">إجمالي المتدربين</p>
                                <p class="text-xl font-bold text-gray-900" id="contractor-trainees-count">${contractorStats.totalTrainees}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-chalkboard-teacher text-xl"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-gray-500">القائمون بالتدريب</p>
                                <p class="text-xl font-bold text-gray-900" id="contractor-trainers-count">${contractorStats.uniqueTrainers}</p>
                            </div>
                        </div>
                    </div>
                    <div class="content-card h-full">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-calendar-alt text-xl"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs text-gray-500">التدريبات (الشهر الحالي)</p>
                                <p class="text-xl font-bold text-gray-900" id="contractor-monthly-count">${contractorStats.currentMonthCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- تحليل تفاعلي (Power BI-like) -->
                <div class="content-card mb-4">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h3 class="card-title"><i class="fas fa-layer-group ml-2"></i>تحليل تفاعلي لتدريبات المقاولين (Slicers + Pivot + Drill-down)</h3>
                            <button id="contractor-analytics-reset-btn" class="btn-secondary btn-sm">
                                <i class="fas fa-redo ml-2"></i>إعادة تعيين التحليل
                            </button>
                        </div>
                    </div>
                    <div class="card-body" style="padding: 12px;">
                        <div id="contractor-analytics-dashboard">
                            ${this.renderContractorAnalyticsDashboard(analyticsModel, analyticsState)}
                        </div>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title"><i class="fas fa-list ml-2"></i>سجل تدريبات المقاولين والشركات الخارجية</h2>
                            <div class="flex items-center gap-3">
                                <button id="export-contractor-training-pdf-btn" class="btn-secondary">
                                    <i class="fas fa-file-pdf ml-2" style="font-size: 14px;"></i>تقرير PDF
                                </button>
                                <button id="export-contractor-training-excel-btn" class="btn-success">
                                    <i class="fas fa-file-excel ml-2" style="font-size: 14px;"></i>تصدير Excel
                                </button>
                                <input type="text" id="contractor-training-search" class="form-input" style="max-width: 260px;" placeholder="بحث سريع (مقاول، موضوع، موقع)">
                                <button id="add-contractor-training-btn" class="btn-primary">
                                    <i class="fas fa-plus ml-2"></i>
                                    تسجيل تدريب للمقاولين
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body" id="contractor-training-container">
                        <div class="contractor-training-loading text-center py-8 text-gray-500">جاري تحميل السجل…</div>
                    </div>
                </div>
            `;
        } else if (tabName === 'attendance') {
            return await this.renderAttendanceRegistry();
        } else if (tabName === 'analysis') {
            return await this.renderAnalysisTab();
        }
        return '';
    },

    async switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        const content = document.getElementById('training-tab-content');
        if (!content) return;

        this._currentActiveTab = tabName;

        const cached = this._tabCache[tabName];
        const isDirty = this._tabDirty[tabName] !== false;

        if (cached && !isDirty) {
            content.innerHTML = cached;
        } else {
            content.innerHTML = await this.renderTabContent(tabName);
            this._tabCache[tabName] = content.innerHTML;
            this._tabDirty[tabName] = false;
        }

        this._hydrateTab(tabName);

        // البيانات من الخادم في الخلفية: لا توقف الواجهة
        if (this._trainingBackendFetchOk !== true && (tabName === 'contractors' || tabName === 'attendance')) {
            this.loadTrainingDataAsync().catch(() => {});
        }

        this.setupEventListeners();
    },

    /** ربط الأحداث وتحميل البيانات الديناميكية لتبويب بعد لصق HTML من الكاش أو الرسم. */
    _hydrateTab(tabName) {
        if (tabName === 'programs') {
            this.loadTrainingList();
        } else if (tabName === 'contractors') {
            void this.refreshContractorTrainingList().catch(() => {});
        } else if (tabName === 'attendance') {
            this.loadAttendanceRegistry();
            const attendanceMonthFilter = document.getElementById('attendance-month-filter');
            const resetAttendanceFilter = document.getElementById('reset-attendance-filter');
            if (attendanceMonthFilter && !attendanceMonthFilter.dataset.bound) {
                attendanceMonthFilter.addEventListener('change', () => {
                    this.refreshAttendanceAnalytics(attendanceMonthFilter.value || '');
                });
                attendanceMonthFilter.dataset.bound = '1';
            }
            if (resetAttendanceFilter && !resetAttendanceFilter.dataset.bound) {
                resetAttendanceFilter.addEventListener('click', () => {
                    if (attendanceMonthFilter) attendanceMonthFilter.value = '';
                    this.refreshAttendanceAnalytics('');
                });
                resetAttendanceFilter.dataset.bound = '1';
            }
            this.bindAttendanceAnalyticsEvents((document.getElementById('attendance-month-filter') || {}).value || '');
        } else if (tabName === 'analysis') {
            this.loadTrainingAnalysisItemsUI();
            this.updateTrainingAnalysisResults();
            this.bindAnalysisFilterEvents();
            this.bindAnalysisPeriodReportsEvents();
            void this.refreshAnalysisPeriodReports();
        }
    },

    /** يضع علامات «بحاجة إعادة بناء» على جميع التبويبات (تستدعى بعد تغيّر البيانات). */
    _markAllTabsDirty() {
        this._tabDirty.programs = true;
        this._tabDirty.contractors = true;
        this._tabDirty.attendance = true;
        this._tabDirty.analysis = true;
        this._tabCache.programs = null;
        this._tabCache.contractors = null;
        this._tabCache.attendance = null;
        this._tabCache.analysis = null;
    },

    async renderList() {
        // This function is kept for backward compatibility but now uses renderTabContent
        return await this.renderTabContent('programs');
    },

    async loadTrainingList() {
        this.ensureData();
        const container = document.getElementById('training-table-container');
        if (!container) return;
        const items = AppState.appData.training || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-graduation-cap text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد برامج تدريبية</p>
                    <button id="add-training-empty-btn" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة برنامج تدريبي
                    </button>
                </div>
            `;
            this.applyModuleI18n(container);
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table table-header-purple">
                    <thead>
                        <tr>
                            <th>اسم البرنامج</th>
                            <th>نوع التدريب</th>
                            <th>المدرب</th>
                            <th>تاريخ البدء</th>
                            <th>عدد المشاركين</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => {
            const statusText = item.status || '';
            const participantsCount = this.getParticipantsCount(item);
            const isInProgress = /تنفي/.test(statusText);
            const badgeClass = statusText === 'مكتمل'
                ? 'success'
                : isInProgress
                    ? 'info'
                    : statusText === 'ملغي'
                        ? 'danger'
                        : 'warning';
            const startDateDisplay = item.startDate
                ? Utils.formatDate(item.startDate)
                : (item.date ? Utils.formatDate(item.date) : '-');
            const trainingTypeLabel = Utils.escapeHTML(item.trainingType || 'داخلي');
            const trainingTypeBadge = item.trainingType === 'خارجي' ? 'badge-warning' : 'badge-info';
            const displayStatus = statusText === 'قيد التنيذ' ? 'قيد التنفيذ' : (statusText || '-');
            
            // الحصول على اسم المكان بدلاً من المعرف
            let locationDisplay = '';
            if (item.location) {
                if (item.locationName) {
                    // إذا كان locationName موجوداً، استخدمه مباشرة
                    locationDisplay = item.locationName;
                } else {
                    // حاول الحصول على اسم المكان من المعرف
                    locationDisplay = this.getPlaceName(item.location, item.factory);
                }
            }

            return `
                                <tr>
                                    <td>
                                        <div class="font-semibold text-gray-900">${Utils.escapeHTML(item.name || '')}</div>
                                        ${locationDisplay ? `<div class="text-xs text-gray-500 mt-1"><i class="fas fa-map-marker-alt ml-1"></i>${Utils.escapeHTML(locationDisplay)}</div>` : ''}
                                    </td>
                                    <td><span class="badge ${trainingTypeBadge}">${trainingTypeLabel}</span></td>
                                    <td>${Utils.escapeHTML(item.trainer || '-')}</td>
                                    <td>${startDateDisplay}</td>
                                    <td><span class="badge badge-info">${participantsCount}</span></td>
                                    <td>
                                        <span class="badge badge-${badgeClass}">
                                            ${Utils.escapeHTML(displayStatus)}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button onclick="Training.viewTraining('${item.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                                <i class="fas fa-eye" style="font-size: 14px;"></i>
                                            </button>
                                            <button onclick="Training.editTraining('${item.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                                <i class="fas fa-edit" style="font-size: 14px;"></i>
                                            </button>
                                            <button onclick="Training.printTraining('${item.id}')" class="btn-icon btn-icon-secondary" title="طباعة">
                                                <i class="fas fa-print" style="font-size: 14px;"></i>
                                            </button>
                                            <button onclick="Training.exportTraining('${item.id}')" class="btn-icon btn-icon-success" title="تصدير">
                                                <i class="fas fa-file-export" style="font-size: 14px;"></i>
                                            </button>
                                            <button onclick="Training.deleteTraining('${item.id}')" class="btn-icon btn-icon-danger" title="حذف">
                                                <i class="fas fa-trash" style="font-size: 14px;"></i>
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

    setupEventListeners() {
        // ربط مرة واحدة لكل عنصر باستخدام علامة data-bound؛ يُستدعى بعد كل rebuild بدون تكرار الربط ولا setTimeout.
        const bindOnce = (el, type, handler) => {
            if (!el || el.dataset.bound === '1') return;
            el.addEventListener(type, handler);
            el.dataset.bound = '1';
        };

        bindOnce(document.getElementById('add-training-btn'), 'click', () => this.showForm());
        bindOnce(document.getElementById('add-training-empty-btn'), 'click', () => this.showForm());
        bindOnce(document.getElementById('training-form'), 'submit', (e) => this.handleSubmit(e));

        bindOnce(document.getElementById('export-training-excel-btn'), 'click', () => this.exportToExcel());
        bindOnce(document.getElementById('export-training-pdf-btn'), 'click', () => this.showTrainingReportDialog());

        bindOnce(document.getElementById('training-form-print-btn'), 'click', () => this.printAttendanceFormFromScreen());
        bindOnce(document.getElementById('training-form-back-btn'), 'click', () => this.showList());

        const searchInput = document.getElementById('training-search');
        const statusFilter = document.getElementById('training-filter-status');
        bindOnce(searchInput, 'input', (e) => this.filterItems(e.target.value, statusFilter?.value || ''));
        bindOnce(statusFilter, 'change', (e) => this.filterItems(searchInput?.value || '', e.target.value));

        bindOnce(document.getElementById('view-training-matrix-btn'), 'click', () => this.showTrainingMatrix());
        bindOnce(document.getElementById('view-annual-training-plan-btn'), 'click', () => this.showAnnualPlanModal());
        bindOnce(document.getElementById('training-refresh-btn'), 'click', () => this.refresh());

        bindOnce(document.getElementById('add-contractor-training-header-btn'), 'click', () => this.openContractorTrainingForm());
        bindOnce(document.getElementById('add-contractor-training-btn'), 'click', () => this.openContractorTrainingForm());

        bindOnce(document.getElementById('contractor-training-search'), 'input', (e) => this.filterContractorTraining(e.target.value));
        bindOnce(document.getElementById('export-contractor-training-excel-btn'), 'click', () => this.exportContractorTrainingExcel());
        bindOnce(document.getElementById('export-contractor-training-pdf-btn'), 'click', () => this.showContractorTrainingReportDialog());

        bindOnce(document.getElementById('contractor-month-filter'), 'change', (e) => this.updateContractorStatsWithFilter(e.target.value));
        bindOnce(document.getElementById('reset-contractor-filter'), 'click', () => {
            const filterSelect = document.getElementById('contractor-month-filter');
            if (filterSelect) {
                filterSelect.value = '';
                this.updateContractorStatsWithFilter('');
            }
        });

        bindOnce(document.getElementById('contractor-analytics-reset-btn'), 'click', () => {
            this.refreshContractorAnalytics(document.getElementById('contractor-month-filter')?.value || '');
        });

        // تهيئة التحليل التفاعلي للمقاولين عند توفر الحاوية فقط (يتجنب عمل ثقيل عندما تبويب المقاولين غير مرسوم).
        if (document.getElementById('contractor-analytics-dashboard')) {
            this.refreshContractorAnalytics(document.getElementById('contractor-month-filter')?.value || '');
        }
    },

    updateContractorStatsWithFilter(monthFilter) {
        const stats = this.getContractorTrainingStats(monthFilter);
        
        // تحديث الكروت
        const topicsCount = document.getElementById('contractor-topics-count');
        if (topicsCount) topicsCount.textContent = stats.uniqueTopics;
        
        const companiesCount = document.getElementById('contractor-companies-count');
        if (companiesCount) companiesCount.textContent = stats.uniqueContractors;
        
        const traineesCount = document.getElementById('contractor-trainees-count');
        if (traineesCount) traineesCount.textContent = stats.totalTrainees;
        
        const trainersCount = document.getElementById('contractor-trainers-count');
        if (trainersCount) trainersCount.textContent = stats.uniqueTrainers;
        
        const monthlyCount = document.getElementById('contractor-monthly-count');
        if (monthlyCount) monthlyCount.textContent = stats.currentMonthCount;

        // تحديث التحليل التفاعلي
        this.refreshContractorAnalytics(monthFilter);
    },

    /**
     * عرض مصوة التدريب لكل موظف بناءً على جدول قاعدة بيانات الموظفين
     */
    async showTrainingMatrix() {
        this.ensureData();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1400px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-table ml-2"></i>
                        مصفوفة التدريب لكل موظف
                    </h2>
                    <div class="flex items-center gap-2 mr-auto">
                        <button class="btn-secondary btn-sm" id="manage-training-topics-btn">
                            <i class="fas fa-layer-group ml-2"></i>
                            موضوعات الوظائف
                        </button>
                        <button class="btn-secondary btn-sm" id="matrix-annual-plan-btn">
                            <i class="fas fa-calendar-check ml-2"></i>
                            الخطة السنوية
                        </button>
                    </div>
                    <button class="modal-close" id="training-matrix-close-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="mb-4">
                        <div class="flex gap-2 items-center">
                            <input type="text" id="training-matrix-search" class="form-input" style="max-width: 400px;" 
                                placeholder="ابحث بالموظف (الكود أو الاسم أو الوظيفة)">
                        </div>
                    </div>
                    <div id="training-matrix-content">
                        ${await this.renderTrainingMatrix()}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="training-matrix-close-footer-btn">إغلاق</button>
                    <button class="btn-primary" onclick="Training.exportTrainingMatrix()">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // إغلاق سريع وموثوق
        const close = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (modal && modal.parentNode) {
                modal.remove();
            }
        };
        
        const closeBtn = modal.querySelector('#training-matrix-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }
        
        const closeFooterBtn = modal.querySelector('#training-matrix-close-footer-btn');
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', close);
        }

        // Setup search
        const searchInput = document.getElementById('training-matrix-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterTrainingMatrix(e.target.value.trim());
            });
        }
        modal.querySelector('#manage-training-topics-btn')?.addEventListener('click', () => this.openTrainingTopicsManager());
        modal.querySelector('#matrix-annual-plan-btn')?.addEventListener('click', () => this.showAnnualPlanModal());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                close(e);
            }
        });
    },

    /**
     * عرض مصفوفة التدريب لكل موظف بناءً على جدول قاعدة بيانات الموظفين
     */
    async renderTrainingMatrix() {
        this.ensureData();
        const employees = AppState.appData.employees || [];
        const trainingMatrix = AppState.appData.employeeTrainingMatrix || {};

        if (employees.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-table text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد بيانات موظفين</p>
                </div>
            `;
        }

        return `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الكود الوظيفي</th>
                            <th>اسم الموظف</th>
                            <th>الوظيفة</th>
                            <th>القسم/الإدارة</th>
                            <th>عدد برامج التدريب</th>
                            <th>إجمالي ساعات التدريب</th>
                            <th>الموضوعات المطلوبة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${employees.map(emp => {
            const code = emp.employeeNumber || emp.sapId || '';
            const trainings = trainingMatrix[code] || [];
            const totalHours = trainings.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
            const internalTrainings = trainings.filter(t => t.trainingType === 'داخلي').length;
            const externalTrainings = trainings.filter(t => t.trainingType === 'خارجي').length;
            const requiredTopics = this.getRequiredTopicsForPosition(emp.position);
            const completedTopicsSet = this.getCompletedTopicsSet(trainings);
            const completedRequiredTopics = requiredTopics.filter(topicEntry => {
                const topicName = typeof topicEntry === 'string' ? topicEntry : topicEntry.topic;
                return topicName && completedTopicsSet.has(topicName.toLowerCase());
            }).length;

            return `
                                <tr data-code="${code}" data-name="${emp.name || ''}" data-position="${emp.position || ''}">
                                    <td><strong>${Utils.escapeHTML(code)}</strong></td>
                                    <td>${Utils.escapeHTML(emp.name || '')}</td>
                                    <td>${Utils.escapeHTML(emp.position || '-')}</td>
                                    <td>${Utils.escapeHTML(emp.department || '-')}</td>
                                    <td>
                                        <span class="badge badge-info">${trainings.length}</span>
                                        <span class="text-xs text-gray-500 mr-2">(داخلي: ${internalTrainings}, خارجي: ${externalTrainings})</span>
                                    </td>
                                    <td><strong>${totalHours.toFixed(2)}</strong> ساعة</td>
                                    <td>
                                        ${requiredTopics.length ? `
                                            <span class="badge ${completedRequiredTopics === requiredTopics.length ? 'badge-success' : 'badge-warning'}">
                                                ${completedRequiredTopics}/${requiredTopics.length}
                                            </span>
                                            <span class="text-xs text-gray-500 mr-2">موضوعات مطلوبة</span>
                                        ` : '<span class="text-xs text-gray-500">لا توجد موضوعات محددة</span>'}
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <button onclick="Training.viewEmployeeTrainingMatrix('${Utils.escapeHTML(code)}')" class="btn-secondary btn-sm" title="عرض التفاصيل وجميع تدريبات الموظف" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.875rem;">
                                                <i class="fas fa-eye"></i>
                                                <span>عرض التفاصيل</span>
                                            </button>
                                            <button onclick="Training.openQuickTrainingRegistration('${Utils.escapeHTML(code)}')" class="btn-icon btn-icon-primary" title="تسجيل تدريب جديد">
                                                <i class="fas fa-plus"></i>
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

    async refreshTrainingMatrix() {
        const container = document.getElementById('training-matrix-content');
        if (!container) return;
        container.innerHTML = await this.renderTrainingMatrix();
    },

    /**
     * تصفية مصفوفة التدريب
     */
    filterTrainingMatrix(searchTerm) {
        const tbody = document.querySelector('#training-matrix-content tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr[data-code]');
        rows.forEach(row => {
            const code = row.getAttribute('data-code') || '';
            const name = row.getAttribute('data-name') || '';
            const position = row.getAttribute('data-position') || '';
            const searchLower = searchTerm.toLowerCase();

            if (!searchTerm ||
                code.includes(searchTerm) ||
                name.toLowerCase().includes(searchLower) ||
                position.toLowerCase().includes(searchLower)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    /**
     * عرض تفاصيل التدريب لموظف محدد
     */
    async viewEmployeeTrainingMatrix(employeeCode) {
        const employees = AppState.appData.employees || [];
        const emp = employees.find(e => (e.employeeNumber || e.sapId) === employeeCode);

        if (!emp) {
            Notification.error('لم يتم العثور على الموظف');
            return;
        }

        const trainingMatrix = AppState.appData.employeeTrainingMatrix || {};
        const trainings = trainingMatrix[employeeCode] || [];
        const requiredTopics = this.getRequiredTopicsForPosition(emp.position);
        const completedTopicsSet = this.getCompletedTopicsSet(trainings);
        const currentYear = new Date().getFullYear();
        const annualPlan = this.getAnnualPlan(currentYear, { createIfMissing: false });
        const relevantPlanItems = (annualPlan?.items || []).filter(item => {
            if (item.targetType === 'contractors') return false;
            if (Array.isArray(item.targetRoles) && item.targetRoles.length) {
                return item.targetRoles.includes(emp.position);
            }
            return true;
        }) || [];

        const requiredTopicsRows = requiredTopics.map(topicEntry => {
            const topicName = typeof topicEntry === 'string' ? topicEntry : (topicEntry.topic || '');
            const isRequired = typeof topicEntry === 'object' ? topicEntry.required !== false : true;
            const recommendedHours = typeof topicEntry === 'object' ? (topicEntry.recommendedHours || '') : '';
            const freq = typeof topicEntry === 'object' ? (topicEntry.frequency || 'سنوي') : 'سنوي';
            const isCompleted = completedTopicsSet.has(topicName.toLowerCase());
            const planItem = relevantPlanItems.find(item =>
                item.topic === topicName || (Array.isArray(item.requiredTopics) && item.requiredTopics.includes(topicName))
            );
            const statusText = planItem?.status || (isCompleted ? 'مكتمل' : 'مخطط');
            const statusClass = statusText === 'مكتمل' ? 'badge-success'
                : statusText === 'قيد التنفيذ' ? 'badge-info'
                    : statusText === 'مؤجل' ? 'badge-warning'
                        : isCompleted ? 'badge-success' : 'badge-secondary';

            return `
                <tr>
                    <td>${Utils.escapeHTML(topicName)}</td>
                    <td>${freq}</td>
                    <td>${recommendedHours ? `${recommendedHours} ساعة` : '—'}</td>
                    <td>
                        <span class="badge ${statusClass}">${Utils.escapeHTML(statusText)}</span>
                        ${planItem?.plannedDate ? `<div class="text-xs text-gray-500 mt-1">موعد مخطط: ${Utils.formatDate(planItem.plannedDate)}</div>` : ''}
                    </td>
                    <td>${isRequired ? 'إلزامي' : 'اختياري'}</td>
                </tr>
            `;
        }).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        const sortedTrainings = [...trainings].sort((a, b) => {
            const dateA = new Date(a.trainingDate || a.date || 0);
            const dateB = new Date(b.trainingDate || b.date || 0);
            return dateB - dateA;
        });
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1100px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-graduation-cap ml-2"></i>
                        تفاصيل التدريب: ${Utils.escapeHTML(emp.name || '')}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1;">
                    <div class="mb-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الكود الوظيفي:</label>
                                <p class="text-gray-800 font-mono">${Utils.escapeHTML(employeeCode)}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">الوظيفة:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(emp.position || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">القسم/الإدارة:</label>
                                <p class="text-gray-800">${Utils.escapeHTML(emp.department || '-')}</p>
                            </div>
                            <div>
                                <label class="text-sm font-semibold text-gray-600">إجمالي برامج التدريب:</label>
                                <p class="text-gray-800 font-bold">${trainings.length}</p>
                            </div>
                        </div>
                    </div>
                    ${requiredTopics.length ? `
                        <div class="mt-6">
                            <h3 class="text-lg font-semibold text-gray-800 mb-3">
                                <i class="fas fa-list-check ml-2 text-blue-600"></i>
                                الموضوعات المطلوبة حسب وظيفة الموظف (${requiredTopics.length})
                            </h3>
                            <div class="table-wrapper">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>الموضوع</th>
                                            <th>التكرار الموصى به</th>
                                            <th>الساعات الموصى بها</th>
                                            <th>حالة التنفيذ</th>
                                            <th>الإلزام</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${requiredTopicsRows}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : ''}
                    <div class="mt-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">
                            <i class="fas fa-list-alt ml-2 text-green-600"></i>
                            جميع تدريبات الموظف (${trainings.length})
                        </h3>
                        ${trainings.length > 0 ? `
                        <div class="table-wrapper" style="overflow: auto; max-height: 400px; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <table class="data-table" style="margin: 0;">
                                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1;">
                                    <tr>
                                        <th>اسم البرنامج</th>
                                        <th>نوع التدريب</th>
                                        <th>التاريخ</th>
                                        <th>المكان</th>
                                        <th>المدرب</th>
                                        <th>الساعات</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sortedTrainings.map(t => `
                                        <tr>
                                            <td>${Utils.escapeHTML(t.trainingName || t.name || '')}</td>
                                            <td>
                                                <span class="badge badge-${t.trainingType === 'داخلي' ? 'info' : 'warning'}">
                                                    ${Utils.escapeHTML(t.trainingType || 'داخلي')}
                                                </span>
                                            </td>
                                            <td>${(t.trainingDate || t.date) ? Utils.formatDate(t.trainingDate || t.date) : '-'}</td>
                                            <td>${Utils.escapeHTML(t.location || '-')}</td>
                                            <td>${Utils.escapeHTML(t.trainer || '-')}</td>
                                            <td>${(parseFloat(t.hours) || 0).toFixed(2)} ساعة</td>
                                            <td>
                                                <span class="badge badge-${t.completed ? 'success' : /تنفي/.test(t.status || '') ? 'info' : 'warning'}">
                                                    ${Utils.escapeHTML(t.status === 'قيد التنيذ' ? 'قيد التنفيذ' : (t.status || 'مخطط'))}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <div class="empty-state" style="padding: 2rem;">
                            <i class="fas fa-graduation-cap text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">لا توجد برامج تدريب مسجلة لهذا الموظف</p>
                        </div>
                        `}
                    </div>
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

    getRequiredTopicsForPosition(position) {
        if (!position) return [];
        this.ensureData();
        const topicsByRole = AppState.appData.trainingTopicsByRole || {};
        return Array.isArray(topicsByRole[position]) ? topicsByRole[position] : [];
    },

    getCompletedTopicsSet(trainings = []) {
        const completed = new Set();
        trainings.forEach(entry => {
            if (!entry) return;
            if (Array.isArray(entry.topics)) {
                entry.topics.forEach(topic => {
                    if (topic) completed.add(String(topic).toLowerCase());
                });
            }
            if (entry.trainingName) {
                completed.add(String(entry.trainingName).toLowerCase());
            }
        });
        return completed;
    },

    getSelectedOptionsFromElement(selectElement) {
        if (!selectElement) return [];
        return Array.from(selectElement.selectedOptions || []).map(option => option.value).filter(Boolean);
    },

    getUniquePositions() {
        this.ensureData();
        const employees = AppState.appData.employees || [];
        const positions = new Set();
        employees.forEach(emp => {
            if (emp.position) positions.add(emp.position);
        });
        return Array.from(positions).sort((a, b) => a.localeCompare(b));
    },

    openTrainingTopicsManager() {
        this.ensureData();
        const positions = this.getUniquePositions();
        if (!positions.length) {
            Notification.info('لا توجد وظائف مسجلة لربط الموضوعات التدريبية');
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-layer-group ml-2"></i>
                        إدارة الموضوعات التدريبية حسب الوظيفة
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">اختر الوظيفة</label>
                            <select id="topics-position-select" class="form-input">
                                ${positions.map(position => `<option value="${Utils.escapeHTML(position)}">${Utils.escapeHTML(position)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                            <i class="fas fa-info-circle ml-2"></i>
                            يمكن ربط كل وظيفة بقائمة من الموضوعات التدريبية المطلوبة لتسهيل متابعة التنفيذ.
                        </div>
                    </div>
                    
                    <div id="topics-manager-content"></div>
                    
                    <div class="border-t pt-4">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">إضافة موضوع تدريبي جديد</h3>
                        <form id="topics-add-form" class="space-y-4">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الموضوع *</label>
                                    <input type="text" id="topics-new-name" class="form-input" required placeholder="مثال: سلامة الغذاء">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">التكرار الموصى به</label>
                                    <select id="topics-new-frequency" class="form-input">
                                        <option value="سنوي">سنوي</option>
                                        <option value="نصف سنوي">نصف سنوي</option>
                                        <option value="ربع سنوي">ربع سنوي</option>
                                        <option value="عند الحاجة">عند الحاجة</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">الساعات المطلوبة</label>
                                    <input type="number" id="topics-new-hours" class="form-input" min="0" step="0.5" placeholder="عدد الساعات">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">إلزامي؟</label>
                                    <select id="topics-new-required" class="form-input">
                                        <option value="yes" selected>نعم</option>
                                        <option value="no">لا</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                                <textarea id="topics-new-notes" class="form-input" rows="3" placeholder="تفاصيل إضافية حول الموضوع أو أهدافه"></textarea>
                            </div>
                            
                            <div class="flex justify-end">
                                <button type="submit" class="btn-primary">
                                    <i class="fas fa-plus ml-2"></i>
                                    إضافة الموضوع
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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

        const positionSelect = modal.querySelector('#topics-position-select');
        const contentContainer = modal.querySelector('#topics-manager-content');
        const render = () => {
            const position = positionSelect?.value;
            contentContainer.innerHTML = this.renderTrainingTopicsManagerContent(position);
            contentContainer.querySelectorAll('[data-action="delete-topic"]').forEach(button => {
                button.addEventListener('click', () => {
                    const topic = button.getAttribute('data-topic');
                    this.removeTrainingTopic(position, topic);
                    render();
                    this.refreshTrainingMatrix();
                });
            });
        };

        positionSelect?.addEventListener('change', render);
        render();

        modal.querySelector('#topics-add-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const position = positionSelect?.value;
            if (!position) {
                Notification.warning('يرجى اختيار الوظيفة أولاً');
                return;
            }
            const name = modal.querySelector('#topics-new-name')?.value.trim();
            const frequency = modal.querySelector('#topics-new-frequency')?.value || 'سنوي';
            const hours = parseFloat(modal.querySelector('#topics-new-hours')?.value || '0');
            const required = modal.querySelector('#topics-new-required')?.value === 'yes';
            const notes = modal.querySelector('#topics-new-notes')?.value.trim();

            if (!name) {
                Notification.warning('يرجى إدخال اسم الموضوع التدريبي');
                return;
            }

            this.saveTrainingTopic(position, {
                topic: name,
                frequency,
                required,
                recommendedHours: hours > 0 ? hours : '',
                notes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            modal.querySelector('#topics-new-name').value = '';
            modal.querySelector('#topics-new-hours').value = '';
            modal.querySelector('#topics-new-notes').value = '';

            render();
            this.refreshTrainingMatrix();
        });
    },

    renderTrainingTopicsManagerContent(position) {
        if (!position) {
            return `<div class="text-center text-gray-500 py-6">يرجى اختيار وظيفة لاستعراض الموضوعات التدريبية المرتبطة بها.</div>`;
        }

        const topics = this.getRequiredTopicsForPosition(position);
        if (!topics.length) {
            return `
                <div class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
                    لا توجد موضوعات محددة مسبقاً لهذه الوظيفة. يمكنك إضافة موضوع جديد من النموذج أدناه.
                </div>
            `;
        }

        return `
            <div class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>الموضوع</th>
                            <th>التكرار</th>
                            <th>الساعات الموصى بها</th>
                            <th>إلزامي</th>
                            <th>ملاحظات</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topics.map(item => `
                            <tr>
                                <td>${Utils.escapeHTML(item.topic || '')}</td>
                                <td>${Utils.escapeHTML(item.frequency || 'سنوي')}</td>
                                <td>${item.recommendedHours ? `${item.recommendedHours} ساعة` : '—'}</td>
                                <td>
                                    <span class="badge ${item.required ? 'badge-success' : 'badge-secondary'}">
                                        ${item.required ? 'إلزامي' : 'اختياري'}
                                    </span>
                                </td>
                                <td>${Utils.escapeHTML(item.notes || '')}</td>
                                <td>
                                    <button class="btn-icon btn-icon-danger" data-action="delete-topic" data-topic="${Utils.escapeHTML(item.topic || '')}" title="حذف الموضوع">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    saveTrainingTopic(position, topicEntry) {
        this.ensureData();
        if (!position || !topicEntry?.topic) return;

        if (!AppState.appData.trainingTopicsByRole[position]) {
            AppState.appData.trainingTopicsByRole[position] = [];
        }

        const topics = AppState.appData.trainingTopicsByRole[position];
        const exists = topics.some(item => (item.topic || '').toLowerCase() === topicEntry.topic.toLowerCase());
        if (exists) {
            Notification.warning('الموضوع مسجل بالفعل لهذه الوظيفة');
            return;
        }

        topics.push(topicEntry);
        AppState.appData.trainingTopicsByRole[position] = topics;
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
        Notification.success('تم إضافة الموضوع التدريبي للوظيفة');
    },

    removeTrainingTopic(position, topicName) {
        this.ensureData();
        if (!position || !topicName) return;
        const topics = AppState.appData.trainingTopicsByRole[position] || [];
        AppState.appData.trainingTopicsByRole[position] = topics.filter(item => (item.topic || '').toLowerCase() !== topicName.toLowerCase());
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
        Notification.success('تم حذف الموضوع التدريبي');
    },

    /**
     * تحويل الوقت من أي صيغة إلى صيغة HH:MM
     * يدعم: ISO date string, Date object, time string (HH:MM), أو أي صيغة أخرى
     * @param {*} timeValue - قيمة الوقت بأي صيغة
     * @param {boolean} forInput - إذا كان true، يُرجع '' بدلاً من '—' للاستخدام في حقول الإدخال
     */
    formatTime(timeValue, forInput = false) {
        const fallback = forInput ? '' : '—';
        
        // ✅ معالجة القيم الفارغة أو غير الصحيحة
        if (!timeValue || timeValue === '—' || timeValue === '-' || timeValue === '' || 
            timeValue === 'null' || timeValue === 'undefined' || timeValue === 'Invalid Date') {
            return fallback;
        }

        const strValue = String(timeValue).trim();
        
        // ✅ معالجة القيمة الفارغة بعد التحويل إلى string
        if (!strValue || strValue === 'null' || strValue === 'undefined') {
            return fallback;
        }

        // ✅ إذا كان الوقت بصيغة HH:MM أو HH:MM:SS بالفعل
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(strValue)) {
            const parts = strValue.split(':');
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            
            // التحقق من صحة الوقت
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }

        // ✅ معالجة صيغة Excel Serial Date (مثل 0.375 = 09:00)
        // Excel يخزن الوقت كجزء عشري من اليوم
        const numValue = parseFloat(strValue);
        if (!isNaN(numValue) && numValue >= 0 && numValue < 1) {
            const totalMinutes = Math.round(numValue * 24 * 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        // ✅ تجاهل تواريخ Excel الأساسية (1899-12-30, 1899-12-31, 1900-01-01)
        if (/^1899-12-3[01]|^1900-01-0[01]/.test(strValue)) {
            return fallback;
        }

        // ✅ معالجة صيغ ISO time مثل "T09:30:00Z" أو "09:30:00Z"
        const isoTimeMatch = strValue.match(/T?(\d{1,2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/);
        if (isoTimeMatch) {
            const hours = parseInt(isoTimeMatch[1], 10);
            const minutes = parseInt(isoTimeMatch[2], 10);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }

        // محاولة تحويل من ISO date string أو Date object
        try {
            const date = new Date(timeValue);
            if (!isNaN(date.getTime())) {
                // التحقق من أن التاريخ ليس تاريخ Excel الأساسي
                const year = date.getFullYear();
                if (year >= 1900 && year <= 1901) {
                    return fallback;
                }
                // استخراج الساعة والدقيقة من التاريخ
                const hours = date.getHours();
                const minutes = date.getMinutes();
                
                // ✅ تحسين: السماح بعرض 00:00 إذا كان الوقت صحيحاً
                if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                }
            }
        } catch (error) {
            // تجاهل الأخطاء
        }

        // إذا فشل كل شيء
        return fallback;
    },

    async renderContractorTrainingSection() {
        this.ensureData();
        const records = AppState.appData.contractorTrainings || [];
        const contractorOptions = this.getContractorOptions();
        // ✅ إصلاح: بناء contractorMap بتحويل المفتاح إلى string لضمان التطابق
        const contractorMap = new Map(contractorOptions.map(contractor => [String(contractor?.id ?? '').trim(), contractor.name || '']));
        if (contractorMap.size === 0) {
            const legacyContractors = (AppState.appData.contractors || []).filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE');
            legacyContractors.forEach(contractor => {
                if (contractor?.id) {
                    // ✅ إصلاح: تطبيع المفتاح
                    contractorMap.set(String(contractor.id).trim(), contractor.name || contractor.company || contractor.contractorName || '');
                }
            });
        }

        const rowsHtml = records.length
            ? records
                .slice()
                .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
                .map(entry => {
                    // ✅ إصلاح: تطبيع contractorId قبل البحث في الـ map
                    const normalizedContractorId = String(entry.contractorId || '').trim();
                    // ✅ إصلاح جذري: لا نسمح للـ Map أن يستبدل الاسم المحفوظ في السجل
                    const storedContractorName = String(entry.contractorName || '').replace(/\s+/g, ' ').trim();
                    const hasStoredName = storedContractorName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedContractorName);
                    const contractorName = hasStoredName
                        ? storedContractorName
                        : (contractorMap.get(normalizedContractorId) || storedContractorName || '—');
                    const sessionDate = entry.date ? Utils.formatDate(entry.date) : '—';
                    const trainer = Utils.escapeHTML(entry.trainer || entry.conductedBy || '—');
                    const topic = Utils.escapeHTML(entry.topic || entry.subject || '—');
                    const location = Utils.escapeHTML(entry.location || '—');
                    const subLocation = Utils.escapeHTML(entry.subLocation || entry.subSite || '—');
                    const traineesCount = Number(entry.traineesCount || entry.attendees || 0);
                    const durationMinutes = Number(entry.durationMinutes || entry.trainingMinutes || 0);
                    const totalHours = parseFloat(entry.totalHours || entry.trainingHours || 0);
                    // ✅ تحويل الوقت إلى صيغة HH:MM مع معالجة محسنة
                    const startTime = this.cleanTime(entry.startTime || entry.fromTime || entry.timeFrom) || '—';
                    const endTime = this.cleanTime(entry.endTime || entry.toTime || entry.timeTo) || '—';
                    const notes = Utils.escapeHTML(entry.notes || '');
                    const searchTokens = [
                        contractorName,
                        entry.contractorId || '',
                        topic,
                        trainer,
                        location,
                        subLocation,
                        sessionDate,
                        startTime,
                        endTime,
                        notes
                    ].join(' ').toLowerCase();

                    return `
                        <tr data-training-id="${Utils.escapeHTML(entry.id || '')}" data-search="${Utils.escapeHTML(searchTokens)}">
                            <td>${sessionDate}</td>
                            <td>${topic}</td>
                            <td>${trainer}</td>
                            <td>${Utils.escapeHTML(contractorName)}</td>
                            <td class="text-center">
                                <span class="badge badge-info">${traineesCount}</span>
                            </td>
                            <td class="text-center">${startTime}</td>
                            <td class="text-center">${endTime}</td>
                            <td class="text-center">${durationMinutes > 0 ? durationMinutes : '—'}</td>
                            <td class="text-center">${totalHours > 0 ? totalHours.toFixed(2) : '—'}</td>
                            <td>${location}</td>
                            <td>${subLocation}</td>
                            <td>${notes || '<span class="text-gray-400 text-xs">—</span>'}</td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <button onclick="Training.viewContractorTraining('${entry.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="Training.editContractorTraining('${entry.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="Training.deleteContractorTraining('${entry.id}')" class="btn-icon btn-icon-danger" title="حذف">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')
            : `<tr><td colspan="13" class="text-center text-gray-500 py-6">لا توجد سجلات تدريب للمقاولين حتى الآن.</td></tr>`;

        return `
            <div id="contractor-training-list" class="table-wrapper" style="max-height: 600px; overflow: auto; position: relative; border: 1px solid #e5e7eb; border-radius: 8px;">
                <table class="data-table" style="border-collapse: separate; border-spacing: 0;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">التاريخ</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">الموضوع التدريبي</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">القائم بالتدريب</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">المقاول / الشركة</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">عدد المتدربين</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">من الساعة</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">إلى الساعة</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">المدة (دقائق)</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">ساعات التدريب</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">مكان التدريب</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">المكان الفرعي</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">ملاحظات</th>
                            <th style="position: sticky; top: 0; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; font-weight: 600; padding: 12px 8px; border-bottom: 2px solid #1e40af; white-space: nowrap;">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            <style>
                #contractor-training-list::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                #contractor-training-list::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                #contractor-training-list::-webkit-scrollbar-thumb {
                    background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%);
                    border-radius: 4px;
                }
                #contractor-training-list::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                }
                #contractor-training-list::-webkit-scrollbar-corner {
                    background: #f1f5f9;
                }
            </style>
        `;
    },

    async refreshContractorTrainingList() {
        const container = document.getElementById('contractor-training-container');
        if (!container) return;
        container.innerHTML = await this.renderContractorTrainingSection();
        this.filterContractorTraining(document.getElementById('contractor-training-search')?.value || '');
    },

    filterContractorTraining(searchTerm = '') {
        const normalized = searchTerm.trim().toLowerCase();
        const rows = document.querySelectorAll('#contractor-training-container tbody tr[data-training-id]');
        rows.forEach(row => {
            if (!normalized) {
                row.style.display = '';
                return;
            }
            const haystack = row.getAttribute('data-search') || '';
            row.style.display = haystack.includes(normalized) ? '' : 'none';
        });
    },

    getContractorOptions() {
        this.ensureData();

        // ✅ مصدر موحّد: جميع التدريب يعتمد على Contractors.getContractorOptionsForModules
        if (typeof Contractors !== 'undefined' && typeof Contractors.getContractorOptionsForModules === 'function') {
            return Contractors.getContractorOptionsForModules({ includeSuppliers: false });
        }

        // بديل أخير: في حال عدم تحميل Contractors، نرجع قائمة نظيفة من AppState
        const normalizeText = (v) => (v ?? '').toString().trim();
        const normalizeCode = (v) => normalizeText(v).toUpperCase();
        const normalizeLicense = (v) => normalizeText(v);
        const normalizeName = (v) => normalizeText(v).toLowerCase();
        const allContractors = [
            ...(AppState.appData.approvedContractors || []),
            ...(AppState.appData.contractors || [])
        ].filter((c) => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE');
        const map = new Map();
        const keyOf = (c) => {
            const code = normalizeCode(c.code || c.isoCode);
            if (/^CON-\d+$/i.test(code)) return `CODE:${code}`;
            const lic = normalizeLicense(c.licenseNumber || c.contractNumber);
            if (lic) return `LIC:${lic}`;
            const id = normalizeText(c.contractorId || c.id);
            if (id) return `ID:${id}`;
            const name = normalizeName(c.name || c.company || c.contractorName || c.companyName);
            if (name) return `NAME:${name}`;
            return '';
        };
        allContractors.forEach((c) => {
            if (!c) return;
            const key = keyOf(c);
            if (!key) return;
            if (!map.has(key)) map.set(key, c);
        });
        return Array.from(map.values())
            .map((c) => ({
                id: normalizeText(c.contractorId || c.id),
                name: normalizeText(c.name || c.company || c.contractorName || c.companyName || 'غير معروف'),
                serviceType: normalizeText(c.serviceType),
                licenseNumber: normalizeText(c.licenseNumber || c.contractNumber),
                code: normalizeText(c.code || c.isoCode),
                entityType: (c.entityType || 'contractor').toString(),
                approvedEntityId: c.approvedEntityId || null
            }))
            .filter((c) => c.name && (c.entityType || 'contractor') === 'contractor')
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' }));
    },

    // الحصول على قائمة المواقع من الإعدادات
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

    /** إعادة تعبئة قوائم المصنع/الموقع عند اكتمال تحميل إعدادات النماذج (استدعاء تلقائي من حدث formSettingsUpdated) */
    refreshSiteDropdowns() {
        try {
            const sites = this.getSiteOptions();
            const escape = (typeof Utils !== 'undefined' && Utils.escapeHTML) ? Utils.escapeHTML : (s) => String(s == null ? '' : s);
            const optionsHtml = (emptyLabel) => '<option value="">' + (emptyLabel || 'اختر المصنع') + '</option>' + (sites || []).map(s => '<option value="' + escape(s.id) + '">' + escape(s.name) + '</option>').join('');
            const ids = ['training-factory', 'attendance-registry-filter-factory', 'attendance-analytics-factory'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el && el.tagName === 'SELECT') {
                    const current = el.value;
                    el.innerHTML = optionsHtml(id === 'attendance-analytics-factory' ? '' : id === 'attendance-registry-filter-factory' ? 'جميع المصانع' : 'اختر المصنع');
                    if (current) el.value = current;
                }
            });
        } catch (e) { if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('⚠️ Training.refreshSiteDropdowns:', e); }
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

    // الحصول على اسم المكان من معرف المكان
    getPlaceName(placeId, siteId) {
        try {
            if (!placeId) return '';
            
            // إذا كان المعرف يحتوي على اسم المكان (ليس PLACE_ ID)، ارجعه كما هو
            if (typeof placeId === 'string' && !placeId.startsWith('PLACE_')) {
                return placeId;
            }

            // إذا كان siteId متوفراً، ابحث في أماكن ذلك الموقع
            if (siteId) {
                const places = this.getPlaceOptions(siteId);
                const place = places.find(p => p.id === placeId);
                if (place && place.name) {
                    return place.name;
                }
            }

            // البحث في جميع المواقع
            const sites = this.getSiteOptions();
            for (const site of sites) {
                const places = this.getPlaceOptions(site.id);
                const place = places.find(p => p.id === placeId);
                if (place && place.name) {
                    return place.name;
                }
            }

            return placeId; // إذا لم يتم العثور على الاسم، ارجع المعرف
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على اسم المكان:', error);
            return placeId;
        }
    },

    // الحصول على قائمة فريق السلامة من الإعدادات
    getSafetyTeamOptions() {
        try {
            // محاولة الحصول من Permissions.formSettingsState
            if (typeof Permissions !== 'undefined' && Permissions.formSettingsState && Permissions.formSettingsState.safetyTeam) {
                return Array.isArray(Permissions.formSettingsState.safetyTeam)
                    ? Permissions.formSettingsState.safetyTeam.filter(Boolean)
                    : [];
            }

            // محاولة الحصول من AppState.companySettings
            const settings = AppState.companySettings || {};
            if (Array.isArray(settings.safetyTeam)) {
                return settings.safetyTeam.filter(Boolean);
            }
            if (Array.isArray(settings.safetyTeamMembers)) {
                return settings.safetyTeamMembers.filter(Boolean);
            }
            if (typeof settings.safetyTeam === 'string') {
                return settings.safetyTeam.split(/\n|,/).map(item => item.trim()).filter(Boolean);
            }

            // محاولة الحصول من AppState.appData.safetyTeam
            if (Array.isArray(AppState.appData?.safetyTeam)) {
                return AppState.appData.safetyTeam.map(member =>
                    typeof member === 'string' ? member : (member.name || member.fullName || '')
                ).filter(Boolean);
            }

            return [];
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في الحصول على قائمة فريق السلامة:', error);
            return [];
        }
    },

    /**
     * اسم العرض للقائم بالتدريب / فريق السلامة من سجل مستخدم النظام:
     * يفضّل الاسم الكامل، ولا يعرض البريد ولا اسم الدخول كاسم ظاهر (مع محاولة الربط بسجل موظف).
     */
    resolveSafetyTrainerDisplayName(user) {
        if (!user) return '';
        const full = String(user.fullName || '').trim();
        const nm = String(user.name || '').trim();
        const un = String(user.username || '').trim().toLowerCase();
        const em = String(user.email || '').trim();
        const looksEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

        if (full) return full;
        if (nm && looksEmail(nm)) return '';
        if (nm && un && nm.toLowerCase() === un) {
            const emp = (AppState.appData?.employees || []).find((e) => String(e.email || '').toLowerCase() === em.toLowerCase());
            return emp ? String(emp.name || emp.fullName || '').trim() : '';
        }
        if (nm) return nm;
        if (em) {
            const emp = (AppState.appData?.employees || []).find((e) => String(e.email || '').toLowerCase() === em.toLowerCase());
            if (emp) return String(emp.name || emp.fullName || '').trim();
        }
        return '';
    },

    /**
     * أعضاء فريق السلامة للقوائم (تدريب، ملاحظات، إلخ).
     * @param {{ excludeSystemUsers?: boolean }} [options] إن كان true: لا تُضاف أسماء من مستخدمي النظام (appData.users) حتى لو دورهم سلامة — مفيد لمسؤولي المتابعة في التصريح اليدوي.
     */
    getSafetyTeamMembers(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const excludeSystemUsers = opts.excludeSystemUsers === true;
        const membersMap = new Map();
        const isResigned = (emp) => {
            if (typeof EmployeeHelper !== 'undefined' && typeof EmployeeHelper.isResignedEmployee === 'function') {
                return EmployeeHelper.isResignedEmployee(emp);
            }
            const statusText = String(
                emp?.status || emp?.employeeStatus || emp?.workStatus || emp?.employmentStatus || ''
            ).toLowerCase();
            return statusText.includes('مستقيل') || statusText.includes('استقال') || statusText.includes('resign') || statusText.includes('terminated');
        };

        const resolveSettingsMemberLabel = (raw) => {
            const s = String(raw || '').trim();
            if (!s) return '';
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
                const emp = (AppState.appData?.employees || []).find((e) => String(e.email || '').toLowerCase() === s.toLowerCase());
                if (emp && isResigned(emp)) return '';
                return emp ? String(emp.name || emp.fullName || '').trim() : '';
            }
            return s;
        };

        const settingsTeam = AppState.companySettings?.safetyTeam || AppState.companySettings?.safetyTeamMembers;
        if (Array.isArray(settingsTeam)) {
            settingsTeam.forEach((entry, index) => {
                const name = resolveSettingsMemberLabel(entry?.name || entry);
                if (name) {
                    membersMap.set(name, { id: `settings-${index}`, name });
                }
            });
        } else if (typeof settingsTeam === 'string') {
            settingsTeam.split(/\n|,/).forEach((entry, index) => {
                const name = resolveSettingsMemberLabel(entry);
                if (name) {
                    membersMap.set(name, { id: `settings-${index}`, name });
                }
            });
        }

        if (!excludeSystemUsers) {
            (AppState.appData.users || []).forEach((user) => {
                const role = (user.role || '').toLowerCase();
                const isSafety = role.includes('safety') || role.includes('hse') || role.includes('سلامة');
                if (!isSafety) return;
                const display = this.resolveSafetyTrainerDisplayName(user);
                if (display) {
                    membersMap.set(display, { id: user.id || user.email || display, name: display });
                }
            });
        }

        (AppState.appData.employees || []).forEach((employee) => {
            if (isResigned(employee)) return;
            const department = (employee.department || '').toLowerCase();
            const jobTitle = (employee.position || employee.jobTitle || '').toLowerCase();
            const isSafety = department.includes('سلامة') || department.includes('hse') || jobTitle.includes('سلامة') || jobTitle.includes('hse');
            if (isSafety) {
                const name = employee.name || employee.fullName || '';
                if (name) {
                    membersMap.set(name, { id: employee.id || employee.employeeNumber || name, name });
                }
            }
        });

        return Array.from(membersMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    },

    openContractorTrainingForm(trainingId = null) {
        this.ensureData();
        const contractors = this.getContractorOptions();
        // ✅ إصلاح: بناء contractorMap بتحويل المفتاح إلى string لضمان التطابق
        // ملاحظة مهمة: استخدام ?? بدل || لتفادي فقدان قيم مثل 0
        const contractorMap = new Map(contractors.map(contractor => [String(contractor?.id ?? '').trim(), contractor.name || '']));
        const records = AppState.appData.contractorTrainings || [];
        const existing = trainingId ? records.find(record => record.id === trainingId) : null;
        const hasContractors = contractors.length > 0;
        const defaultDate = existing?.date ? new Date(existing.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        
        // ✅ مطابقة تدريب الموظفين: استخدام cleanTime ونفس أسماء الحقول startTime/endTime
        const existingFromTime = existing 
            ? (this.cleanTime(existing.startTime || existing.fromTime || existing.timeFrom) || '') 
            : '';
        const existingToTime = existing 
            ? (this.cleanTime(existing.endTime || existing.toTime || existing.timeTo) || '') 
            : '';
        // ✅ إصلاح: تطبيع contractorId للمقارنة الصحيحة
        const existingContractorId = existing?.contractorId ? String(existing.contractorId).trim() : '';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2); display: flex; flex-direction: column;">
                <div class="modal-header modal-header-centered" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 25px; border-bottom: none; flex-shrink: 0; position: relative;">
                    <h2 class="modal-title" style="color: white; font-size: 1.35rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; margin: 0;">
                        <i class="fas fa-briefcase"></i>
                        ${existing ? 'تعديل تدريب مقاول' : 'تسجيل تدريب للمقاولين'}
                    </h2>
                    <button type="button" class="modal-close" title="إغلاق" style="color: white; font-size: 1.3rem; opacity: 0.9; transition: all 0.2s; border-radius: 8px; padding: 8px 12px; position: absolute; left: 15px; top: 50%; transform: translateY(-50%);" onmouseover="this.style.opacity='1'; this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.opacity='0.9'; this.style.background='transparent'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="contractor-training-form" style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
                    <div class="modal-body space-y-5" id="contractor-training-form-body" style="background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%); padding: 25px; flex: 1; overflow-y: auto; scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: #667eea #e0e7ff;">
                        <style>
                            #contractor-training-form-body::-webkit-scrollbar { width: 8px; }
                            #contractor-training-form-body::-webkit-scrollbar-track { background: #e0e7ff; border-radius: 10px; }
                            #contractor-training-form-body::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #667eea, #764ba2); border-radius: 10px; }
                            #contractor-training-form-body::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #5a6fd6, #6a4190); }
                        </style>
                        ${!hasContractors ? `
                            <div class="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 text-sm text-yellow-800" style="box-shadow: 0 4px 12px rgba(251, 191, 36, 0.15);">
                                <i class="fas fa-exclamation-triangle ml-2"></i>
                                لا توجد جهات معتمدة حالياً. يرجى إضافة أو اعتماد المقاولين من خلال موديول المقاولين ليظهروا في هذه القائمة.
                            </div>
                        ` : ''}
                        
                        <!-- قسم المعلومات الأساسية -->
                        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08); border: 1px solid #e0e7ff;">
                            <h3 style="color: #667eea; font-size: 0.95rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 2px solid #e0e7ff;">
                                <i class="fas fa-info-circle"></i> المعلومات الأساسية
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-calendar-alt" style="color: #667eea;"></i> التاريخ <span style="color: #ef4444;">*</span>
                                    </label>
                                    <input type="date" id="contractor-training-date" class="form-input" required value="${defaultDate}" style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-book" style="color: #667eea;"></i> الموضوع التدريبي <span style="color: #ef4444;">*</span>
                                    </label>
                                    <input type="text" id="contractor-training-topic" class="form-input" required placeholder="مثال: تدريب السلامة" value="${Utils.escapeHTML(existing?.topic || existing?.subject || '')}" style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-chalkboard-teacher" style="color: #667eea;"></i> القائم بالتدريب <span style="color: #ef4444;">*</span>
                                    </label>
                                    <select id="contractor-training-trainer" class="form-input" required style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                        <option value="">اختر القائم بالتدريب</option>
                                        ${this.getSafetyTeamMembers({ excludeSystemUsers: true }).map(member => `
                                            <option value="${Utils.escapeHTML(member.name)}" ${existing && (existing.trainer === member.name || existing.conductedBy === member.name) ? 'selected' : ''}>
                                                ${Utils.escapeHTML(member.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-building" style="color: #667eea;"></i> المقاول / الشركة <span style="color: #ef4444;">*</span>
                                    </label>
                                    <select id="contractor-training-contractor" class="form-input" required ${hasContractors ? '' : 'disabled'} style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                        <option value="">اختر المقاول</option>
                                        ${contractors.map(contractor => `
                                            <option value="${Utils.escapeHTML(String(contractor?.id ?? '').trim())}" ${existingContractorId && String(contractor?.id ?? '').trim() === existingContractorId ? 'selected' : ''}>
                                                ${Utils.escapeHTML(contractor.name || 'بدون اسم')}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم الوقت والمتدربين -->
                        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08); border: 1px solid #e0e7ff;">
                            <h3 style="color: #667eea; font-size: 0.95rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 2px solid #e0e7ff;">
                                <i class="fas fa-clock"></i> الوقت والمتدربين
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-users" style="color: #667eea;"></i> عدد المتدربين <span style="color: #ef4444;">*</span>
                                    </label>
                                    <input type="number" id="contractor-training-trainees" class="form-input" required min="1" value="${existing?.traineesCount || existing?.attendees || 10}" style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                </div>
                                <div style="display: flex; gap: 12px;">
                                    <div style="flex: 1;">
                                        <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                            <i class="fas fa-play" style="color: #10b981;"></i> من <span style="color: #ef4444;">*</span>
                                        </label>
                                        <input type="time" id="contractor-training-from-time" class="form-input" required value="${existingFromTime || '09:00'}" style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                    </div>
                                    <div style="flex: 1;">
                                        <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                            <i class="fas fa-stop" style="color: #ef4444;"></i> إلى <span style="color: #ef4444;">*</span>
                                        </label>
                                        <input type="time" id="contractor-training-to-time" class="form-input" required value="${existingToTime || '10:00'}" style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #9ca3af; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-hourglass-half" style="color: #9ca3af;"></i> وقت التدريب (دقائق)
                                    </label>
                                    <input type="number" id="contractor-training-duration" class="form-input" min="0" step="5" value="${existing?.durationMinutes || existing?.trainingMinutes || 60}" readonly style="border: 2px solid #e5e7eb; border-radius: 10px; background: linear-gradient(180deg, #f9fafb, #f3f4f6); cursor: not-allowed; padding: 10px 12px; color: #6b7280;">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #9ca3af; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-calculator" style="color: #9ca3af;"></i> ساعات التدريب الإجمالي
                                    </label>
                                    <input type="number" id="contractor-training-hours" class="form-input" min="0" step="0.25" value="${existing?.totalHours || existing?.trainingHours || ''}" readonly style="border: 2px solid #e5e7eb; border-radius: 10px; background: linear-gradient(180deg, #f9fafb, #f3f4f6); cursor: not-allowed; padding: 10px 12px; color: #6b7280;">
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم الموقع -->
                        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08); border: 1px solid #e0e7ff;">
                            <h3 style="color: #667eea; font-size: 0.95rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 2px solid #e0e7ff;">
                                <i class="fas fa-map-marker-alt"></i> الموقع
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-map-marker-alt" style="color: #667eea;"></i> مكان التدريب (الموقع) <span style="color: #ef4444;">*</span>
                                    </label>
                                    <select id="contractor-training-location" class="form-input" required style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                        <option value="">اختر الموقع</option>
                                        ${this.getSiteOptions().map(site => `
                                            <option value="${Utils.escapeHTML(site.id)}" ${existing && (existing.locationId === site.id || existing.locationId === String(site.id)) ? 'selected' : ''}>
                                                ${Utils.escapeHTML(site.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold mb-2" style="color: #4c5c96; display: flex; align-items: center; gap: 5px;">
                                        <i class="fas fa-map-pin" style="color: #667eea;"></i> المكان الفرعي <span style="color: #ef4444;">*</span>
                                    </label>
                                    <select id="contractor-training-sub-location" class="form-input" required style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 10px 12px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">
                                        <option value="">اختر المكان الفرعي</option>
                                        ${this.getPlaceOptions(existing?.locationId || existing?.location || '').map(place => `
                                            <option value="${Utils.escapeHTML(place.id)}" ${existing && (existing.subLocationId === place.id || existing.subLocationId === String(place.id)) ? 'selected' : ''}>
                                                ${Utils.escapeHTML(place.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- قسم الملاحظات -->
                        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.08); border: 1px solid #e0e7ff;">
                            <h3 style="color: #667eea; font-size: 0.95rem; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 2px solid #e0e7ff;">
                                <i class="fas fa-sticky-note"></i> ملاحظات إضافية
                            </h3>
                            <div>
                                <textarea id="contractor-training-notes" class="form-input" rows="3" placeholder="أضف أي ملاحظات إضافية هنا..." style="border: 2px solid #e0e7ff; border-radius: 10px; transition: all 0.3s; padding: 12px; resize: vertical; min-height: 80px;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.15)'" onblur="this.style.borderColor='#e0e7ff'; this.style.boxShadow='none'">${Utils.escapeHTML(existing?.notes || '')}</textarea>
                            </div>
                        </div>
                        
                        <!-- مؤشر التمرير -->
                        <div id="contractor-training-scroll-indicator" style="text-align: center; padding: 8px; color: #9ca3af; font-size: 0.8rem; display: none;">
                            <i class="fas fa-chevron-down animate-bounce"></i> مرر للأسفل لرؤية المزيد
                        </div>
                    </div>
                    <div class="modal-footer form-actions-centered" style="background: linear-gradient(180deg, #ffffff, #f8f9fa); padding: 18px 25px; border-top: 1px solid #e0e7ff; gap: 15px; flex-shrink: 0; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);">
                        <button type="button" class="btn-secondary" data-action="close" style="padding: 12px 28px; border-radius: 10px; font-weight: 600; transition: all 0.3s; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); border: 2px solid #e5e7eb;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.12)'; this.style.borderColor='#d1d5db'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0, 0, 0, 0.08)'; this.style.borderColor='#e5e7eb'">
                            <i class="fas fa-times ml-2"></i>إلغاء
                        </button>
                        <button type="submit" class="btn-primary" ${hasContractors ? '' : 'disabled'} style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.35); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.45)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.35)'">
                            <i class="fas fa-save ml-2"></i>
                            ${existing ? 'تحديث السجل' : 'حفظ التدريب'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        let isClosing = false;
        let handleEscKey = null;
        
        // دالة إغلاق فورية: إزالة النموذج من DOM أولاً ثم التنظيف (استجابة فورية من أول ضغطة)
        const close = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (isClosing) return;
            isClosing = true;

            // إزالة النموذج فوراً من الصفحة (أولوية للاستجابة البصرية)
            if (modal && modal.parentNode) {
                modal.remove();
            }
            // إزالة مستمع ESC
            if (handleEscKey) {
                document.removeEventListener('keydown', handleEscKey);
                handleEscKey = null;
            }
        };

        // منع انتشار الأحداث من محتوى النموذج إلى overlay
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        const doClose = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            close(e);
        };

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', doClose);
        }

        const closeFooterBtn = modal.querySelector('[data-action="close"]');
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', doClose);
        }

        // النقر خارج النموذج: إظهار رسالة ثم إغلاق عند النقر على overlay
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                event.preventDefault();
                event.stopPropagation();
                if (typeof Notification !== 'undefined' && Notification.warning) {
                    Notification.warning('تنبيه: لإغلاق النموذج يرجى استخدام زر الإغلاق (×) أو زر إلغاء أسفل النموذج.');
                } else {
                    alert('تنبيه: لإغلاق النموذج يرجى استخدام زر الإغلاق (×) أو زر إلغاء أسفل النموذج.');
                }
            }
        });

        // إغلاق عند الضغط على ESC من أول ضغطة
        handleEscKey = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();
                e.stopPropagation();
                close(e);
            }
        };
        document.addEventListener('keydown', handleEscKey);

        // دالة لحساب مدة التدريب من الوقتين
        const calculateDuration = () => {
            const fromTimeInput = modal.querySelector('#contractor-training-from-time');
            const toTimeInput = modal.querySelector('#contractor-training-to-time');
            const durationInput = modal.querySelector('#contractor-training-duration');
            const traineesInput = modal.querySelector('#contractor-training-trainees');
            const totalHoursInput = modal.querySelector('#contractor-training-hours');

            if (!fromTimeInput || !toTimeInput || !durationInput || !traineesInput || !totalHoursInput) return;

            const fromTime = fromTimeInput.value;
            const toTime = toTimeInput.value;

            if (!fromTime || !toTime) {
                durationInput.value = '';
                totalHoursInput.value = '';
                return;
            }

            // حساب الفرق بالدقائق
            const fromParts = fromTime.split(':');
            const toParts = toTime.split(':');
            const fromMinutes = parseInt(fromParts[0], 10) * 60 + parseInt(fromParts[1], 10);
            const toMinutes = parseInt(toParts[0], 10) * 60 + parseInt(toParts[1], 10);

            let durationMinutes = toMinutes - fromMinutes;

            // التعامل مع الحالة التي يكون فيها الوقت عبر منتصف الليل
            if (durationMinutes < 0) {
                durationMinutes = (24 * 60) + durationMinutes; // إضافة 24 ساعة
            }

            // تحديث حقل المدة بالدقائق
            durationInput.value = durationMinutes > 0 ? durationMinutes : '';

            // حساب ساعات التدريب الإجمالي = عدد المتدربين × المدة بالدقائق / 60
            const traineesCount = parseInt(traineesInput.value || '0', 10);
            if (Number.isFinite(traineesCount) && traineesCount > 0 && durationMinutes > 0) {
                const totalHours = Number(((traineesCount * durationMinutes) / 60).toFixed(2));
                totalHoursInput.value = totalHours > 0 ? totalHours.toFixed(2) : '';
            } else {
                totalHoursInput.value = '';
            }
        };

        // إضافة event listeners لحساب المدة تلقائياً
        const fromTimeInput = modal.querySelector('#contractor-training-from-time');
        const toTimeInput = modal.querySelector('#contractor-training-to-time');
        const traineesInput = modal.querySelector('#contractor-training-trainees');

        if (fromTimeInput) {
            fromTimeInput.addEventListener('change', calculateDuration);
            fromTimeInput.addEventListener('input', calculateDuration);
        }
        if (toTimeInput) {
            toTimeInput.addEventListener('change', calculateDuration);
            toTimeInput.addEventListener('input', calculateDuration);
        }
        if (traineesInput) {
            traineesInput.addEventListener('change', calculateDuration);
            traineesInput.addEventListener('input', calculateDuration);
        }

        // حساب المدة عند فتح النموذج
        setTimeout(calculateDuration, 100);

        // ✅ إضافة مؤشر التمرير للمحتوى الزائد
        const formBody = modal.querySelector('#contractor-training-form-body');
        const scrollIndicator = modal.querySelector('#contractor-training-scroll-indicator');
        
        if (formBody && scrollIndicator) {
            const checkScroll = () => {
                const hasOverflow = formBody.scrollHeight > formBody.clientHeight;
                const isNotAtBottom = formBody.scrollTop < (formBody.scrollHeight - formBody.clientHeight - 20);
                scrollIndicator.style.display = (hasOverflow && isNotAtBottom) ? 'block' : 'none';
            };
            
            // فحص التمرير عند الفتح وعند التمرير
            setTimeout(checkScroll, 200);
            formBody.addEventListener('scroll', checkScroll);
            window.addEventListener('resize', checkScroll);
        }

        // معالج تحديث الأماكن الفرعية عند تغيير الموقع
        const locationSelect = modal.querySelector('#contractor-training-location');
        const placeSelect = modal.querySelector('#contractor-training-sub-location');

        if (locationSelect && placeSelect) {
            const updatePlaces = () => {
                const selectedSiteId = locationSelect.value;
                if (!selectedSiteId) {
                    placeSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';
                    return;
                }

                const places = this.getPlaceOptions(selectedSiteId);

                // حفظ القيمة الحالية (استخدام subLocationId إذا كان متوفراً)
                const currentValue = placeSelect.value || (existing?.subLocationId ? String(existing.subLocationId) : '');

                // تحديث القائمة
                placeSelect.innerHTML = '<option value="">اختر المكان الفرعي</option>';
                places.forEach(place => {
                    const option = document.createElement('option');
                    option.value = place.id;
                    option.textContent = place.name;
                    // مقارنة مع القيمة الحالية أو subLocationId
                    if (place.id === currentValue || place.id === String(currentValue) || 
                        (existing?.subLocationId && (place.id === existing.subLocationId || place.id === String(existing.subLocationId)))) {
                        option.selected = true;
                    }
                    placeSelect.appendChild(option);
                });
            };

            locationSelect.addEventListener('change', updatePlaces);
            
            // تهيئة قائمة الأماكن الفرعية عند فتح النموذج - فورية بدون تأخير
            if (existing?.locationId || locationSelect.value) {
                // استخدام requestAnimationFrame لضمان تحديث DOM قبل التحديث
                requestAnimationFrame(() => {
                    updatePlaces();
                });
            } else if (locationSelect.value) {
                // إذا كان هناك موقع محدد في النموذج الجديد، تحديث الأماكن الفرعية
                requestAnimationFrame(() => {
                    updatePlaces();
                });
            }
        }

        modal.querySelector('#contractor-training-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // منع النقر المتكرر
            const submitBtn = modal.querySelector('button[type="submit"]');
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

            try {
                const dateValue = modal.querySelector('#contractor-training-date')?.value;
                const topicValue = modal.querySelector('#contractor-training-topic')?.value.trim();
                const trainerValue = modal.querySelector('#contractor-training-trainer')?.value.trim();
                const contractorId = modal.querySelector('#contractor-training-contractor')?.value;
                const traineesCount = parseInt(modal.querySelector('#contractor-training-trainees')?.value || '0', 10);
                const startTimeVal = modal.querySelector('#contractor-training-from-time')?.value || '';
                const endTimeVal = modal.querySelector('#contractor-training-to-time')?.value || '';
                const durationMinutes = parseInt(modal.querySelector('#contractor-training-duration')?.value || '0', 10);
                const totalHoursInput = modal.querySelector('#contractor-training-hours');
                const computedHours = totalHoursInput ? parseFloat(totalHoursInput.value || '0') : 0;
                const locationId = modal.querySelector('#contractor-training-location')?.value.trim();
                const placeId = modal.querySelector('#contractor-training-sub-location')?.value.trim();

                // الحصول على أسماء المواقع والأماكن
                const sites = this.getSiteOptions();
                const selectedSite = sites.find(s => s.id === locationId || String(s.id) === String(locationId));
                const places = this.getPlaceOptions(locationId);
                const selectedPlace = places.find(p => p.id === placeId || String(p.id) === String(placeId));

                const location = selectedSite ? selectedSite.name : '';
                const subLocation = selectedPlace ? selectedPlace.name : '';
                const notes = modal.querySelector('#contractor-training-notes')?.value.trim();

                const normalizedContractorId = String(contractorId ?? '').trim();
                if (!dateValue || !topicValue || !trainerValue || !normalizedContractorId || !Number.isFinite(traineesCount) || traineesCount <= 0 || !startTimeVal || !endTimeVal) {
                    Notification.warning('يرجى استكمال الحقول الإلزامية للتدريب');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                    return;
                }

                // ✅ الحصول على اسم المقاول مباشرة من القائمة المنسدلة المختارة
                const contractorSelect = modal.querySelector('#contractor-training-contractor');
                const selectedOption = contractorSelect?.options[contractorSelect?.selectedIndex];
                let contractorName = 'غير محدد';
                
                if (selectedOption && selectedOption.textContent) {
                    // ✅ استخدام النص المعروض في القائمة المنسدلة مباشرة
                    contractorName = selectedOption.textContent.trim();
                } else {
                    // ✅ بديل: البحث في contractorMap
                    contractorName = contractorMap.get(normalizedContractorId) || 'غير محدد';
                }
                
                // ✅ التحقق من صحة الاسم - إذا كان فارغاً أو 'بدون اسم'، البحث مرة أخرى
                if (!contractorName || contractorName === 'بدون اسم' || contractorName === 'غير محدد') {
                    // البحث في قائمة المقاولين مباشرة
                    const selectedContractor = contractors.find(c => String(c.id || '').trim() === normalizedContractorId);
                    if (selectedContractor && selectedContractor.name) {
                        contractorName = selectedContractor.name.trim();
                    } else {
                        // البحث في contractorMap كحل أخير
                        contractorName = contractorMap.get(normalizedContractorId) || 'غير محدد';
                    }
                }
                
                const recordId = existing?.id || Utils.generateSequentialId('CTR', AppState.appData?.contractorTrainings || []);
                const entry = {
                    id: recordId,
                    date: new Date(dateValue).toISOString(),
                    topic: topicValue,
                    trainer: trainerValue,
                    contractorId: normalizedContractorId,
                    contractorName,
                    traineesCount,
                    startTime: this.cleanTime(startTimeVal) || startTimeVal,
                    endTime: this.cleanTime(endTimeVal) || endTimeVal,
                    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : '',
                    totalHours: computedHours > 0 ? computedHours : '',
                    location,
                    locationId: locationId ? String(locationId).trim() : null,
                    subLocation,
                    subLocationId: placeId ? String(placeId).trim() : null,
                    notes,
                    createdAt: existing?.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // ✅ 1. حفظ البيانات فوراً في الذاكرة
                const collection = AppState.appData.contractorTrainings;
                if (existing) {
                    const index = collection.findIndex(item => item.id === existing.id);
                    if (index !== -1) {
                        collection[index] = entry;
                    }
                } else {
                    collection.push(entry);
                }

                // ✅ 2. إغلاق النموذج فوراً (قبل المزامنة) - الأولوية للاستجابة السريعة
                close();
                
                // ✅ 3. إظهار رسالة النجاح فوراً بعد الإغلاق
                Notification.success(existing ? 'تم تحديث سجل تدريب المقاول بنجاح' : 'تم تسجيل تدريب المقاول بنجاح');

                // ✅ 4. تنفيذ المهام الخلفية بشكل غير متزامن (لا تؤثر على تجربة المستخدم)
                // استخدام setTimeout لضمان عدم حجب الـ UI
                setTimeout(() => {
                    // حفظ البيانات في localStorage
                    try {
                        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                            window.DataManager.save();
                        }
                    } catch (saveError) {
                        Utils.safeWarn('⚠️ خطأ في حفظ البيانات محلياً:', saveError);
                    }

                    // تحديث القائمة
                    this.refreshContractorTrainingList().catch(refreshError => {
                        Utils.safeWarn('⚠️ خطأ في تحديث القائمة:', refreshError);
                    });

                    // المزامنة مع Google Sheets في الخلفية
                    (async () => {
                        try {
                            if (AppState.googleConfig?.appsScript?.enabled && typeof GoogleIntegration !== 'undefined') {
                                if (existing) {
                                    await GoogleIntegration.sendRequest({
                                        action: 'updateContractorTraining',
                                        data: { trainingId: entry.id, updateData: entry }
                                    });
                                } else {
                                    await GoogleIntegration.sendRequest({
                                        action: 'addContractorTraining',
                                        data: entry
                                    });
                                }
                            } else if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                                await GoogleIntegration.autoSave('ContractorTrainings', AppState.appData.contractorTrainings);
                            }
                        } catch (syncError) {
                            Utils.safeWarn('⚠️ فشل المزامنة مع Google Sheets (سيتم المحاولة لاحقاً):', syncError);
                        }
                    })();
                }, 0);
            } catch (error) {
                Utils.safeError('خطأ في حفظ تدريب المقاولين:', error);
                Notification.error('تعذر حفظ تدريب المقاول: ' + error.message);
                
                // استعادة حالة الزر في حالة الخطأ
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    },

    // دوال CRUD لتدريبات المقاولين
    viewContractorTraining(trainingId) {
        this.ensureData();
        const records = AppState.appData.contractorTrainings || [];
        const training = records.find(r => r.id === trainingId);
        if (!training) {
            Notification.error('السجل غير موجود');
            return;
        }

        // ✅ إصلاح: بناء contractorMap بتحويل المفتاح إلى string لضمان التطابق
        const contractorMap = new Map((this.getContractorOptions() || []).map(c => [String(c?.id ?? '').trim(), c.name || '']));
        const normalizedContractorId = String(training.contractorId || '').trim();
        const storedContractorName = String(training.contractorName || '').replace(/\s+/g, ' ').trim();
        const hasStoredName = storedContractorName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedContractorName);
        const contractorName = hasStoredName
            ? storedContractorName
            : (contractorMap.get(normalizedContractorId) || storedContractorName || 'غير محدد');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-eye ml-2"></i>
                        عرض تفاصيل تدريب المقاول
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">التاريخ</label>
                                <p class="text-gray-900">${training.date ? Utils.formatDate(training.date) : '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">الموضوع التدريبي</label>
                                <p class="text-gray-900">${Utils.escapeHTML(training.topic || '—')}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">القائم بالتدريب</label>
                                <p class="text-gray-900">${Utils.escapeHTML(training.trainer || '—')}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">المقاول / الشركة</label>
                                <p class="text-gray-900">${Utils.escapeHTML(contractorName)}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">عدد المتدربين</label>
                                <p class="text-gray-900">${training.traineesCount || '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">من الساعة</label>
                                <p class="text-gray-900">${this.cleanTime(training.startTime || training.fromTime || training.timeFrom) || '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">إلى الساعة</label>
                                <p class="text-gray-900">${this.cleanTime(training.endTime || training.toTime || training.timeTo) || '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">المدة (دقائق)</label>
                                <p class="text-gray-900">${training.durationMinutes || '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ساعات التدريب الإجمالي</label>
                                <p class="text-gray-900">${training.totalHours ? parseFloat(training.totalHours).toFixed(2) : '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">مكان التدريب</label>
                                <p class="text-gray-900">${Utils.escapeHTML(training.location || '—')}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">المكان الفرعي</label>
                                <p class="text-gray-900">${Utils.escapeHTML(training.subLocation || '—')}</p>
                            </div>
                        </div>
                        ${training.notes ? `
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ملاحظات</label>
                                <p class="text-gray-900 whitespace-pre-wrap">${Utils.escapeHTML(training.notes)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إغلاق</button>
                    <button type="button" class="btn-primary" onclick="Training.editContractorTraining('${trainingId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
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
    },

    editContractorTraining(trainingId) {
        this.openContractorTrainingForm(trainingId);
    },

    async deleteContractorTraining(trainingId) {
        this.ensureData();
        const records = AppState.appData.contractorTrainings || [];
        const training = records.find(r => r.id === trainingId);
        if (!training) {
            Notification.error('السجل غير موجود');
            return;
        }

        // ✅ إصلاح: بناء contractorMap بتحويل المفتاح إلى string لضمان التطابق
        const contractorMap = new Map((this.getContractorOptions() || []).map(c => [String(c?.id ?? '').trim(), c.name || '']));
        const normalizedContractorId = String(training.contractorId || '').trim();
        const storedContractorName = String(training.contractorName || '').replace(/\s+/g, ' ').trim();
        const hasStoredName = storedContractorName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedContractorName);
        const contractorName = hasStoredName
            ? storedContractorName
            : (contractorMap.get(normalizedContractorId) || storedContractorName || 'غير محدد');

        if (!confirm(`هل أنت متأكد من حذف تدريب "${training.topic || ''}" للمقاول "${contractorName}"؟\n\nهذه العملية لا يمكن التراجع عنها.`)) {
            return;
        }

        try {
            const index = records.findIndex(r => r.id === trainingId);
            if (index !== -1) {
                records.splice(index, 1);
                // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
        
        // حفظ في Google Sheets
        if (AppState.googleConfig?.appsScript?.enabled) {
            try {
                // استخدام saveToSheet لحذف السجل
                const filteredTrainings = AppState.appData.contractorTrainings.filter(t => t.id !== trainingId);
                await GoogleIntegration.sendRequest({
                    action: 'saveToSheet',
                    data: {
                        sheetName: 'ContractorTrainings',
                        data: filteredTrainings
                    }
                });
            } catch (error) {
                Utils.safeWarn('⚠️ فشل حذف تدريب المقاول من Google Sheets، سيتم المحاولة لاحقاً:', error);
                // استخدام autoSave كبديل فقط في حالة الفشل
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    await GoogleIntegration.autoSave?.('ContractorTrainings', AppState.appData.contractorTrainings).catch(() => {
                        // تجاهل الأخطاء في autoSave أيضاً
                    });
                }
            }
        } else if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
            // إذا لم يكن Google Apps Script مفعّل، نستخدم autoSave
            await GoogleIntegration.autoSave?.('ContractorTrainings', AppState.appData.contractorTrainings);
        }
        
        await this.refreshContractorTrainingList();
        Notification.success('تم حذف سجل التدريب بنجاح');
            }
        } catch (error) {
            Utils.safeError('خطأ في حذف تدريب المقاول:', error);
            Notification.error('فشل حذف السجل: ' + error.message);
        }
    },

    exportContractorTrainingExcel() {
        this.ensureData();
        try {
            Loading.show();
            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث الصفحة أو تحميل المكتبة.');
                return;
            }
            
            // ✅ إصلاح: استخدام نفس مصدر البيانات المستخدم في القائمة المنسدلة
            const contractorOptions = this.getContractorOptions();
            const contractorMap = new Map(contractorOptions.map(c => [String(c?.id ?? '').trim(), c.name || '']));
            
            const records = AppState.appData.contractorTrainings || [];

            const data = records.map(entry => {
                // ✅ إصلاح: تطبيع contractorId قبل البحث في الـ map
                const normalizedContractorId = String(entry.contractorId || '').trim();
                const storedContractorName = String(entry.contractorName || '').replace(/\s+/g, ' ').trim();
                const hasStoredName = storedContractorName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedContractorName);
                const contractorName = hasStoredName
                    ? storedContractorName
                    : (contractorMap.get(normalizedContractorId) || storedContractorName || '');
                // ✅ إصلاح: تحويل قيم الوقت إلى صيغة صحيحة
                const formattedFromTime = this.cleanTime(entry.startTime || entry.fromTime) || '';
                const formattedToTime = this.cleanTime(entry.endTime || entry.toTime) || '';
                const formattedDuration = entry.durationMinutes && !isNaN(Number(entry.durationMinutes)) ? Number(entry.durationMinutes) : '';
                const formattedHours = entry.totalHours && !isNaN(Number(entry.totalHours)) ? parseFloat(entry.totalHours).toFixed(2) : '';
                return {
                'التاريخ': entry.date ? Utils.formatDate(entry.date) : '',
                'الموضوع التدريبي': entry.topic || '',
                'القائم بالتدريب': entry.trainer || '',
                'المقاول / الشركة': contractorName,
                'عدد المتدربين': entry.traineesCount || '',
                'من الساعة': formattedFromTime,
                'إلى الساعة': formattedToTime,
                'وقت التدريب (دقائق)': formattedDuration,
                'ساعات التدريب الإجمالية': formattedHours,
                'مكان التدريب': entry.location || '',
                'المكان الفرعي': entry.subLocation || '',
                'ملاحظات': entry.notes || ''
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 14 },
                { wch: 28 },
                { wch: 22 },
                { wch: 24 },
                { wch: 12 },
                { wch: 10 }, // ✅ عمود من الساعة
                { wch: 10 }, // ✅ عمود إلى الساعة
                { wch: 14 },
                { wch: 20 },
                { wch: 24 },
                { wch: 20 },
                { wch: 40 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'تدريبات المقاولين');
            const fileName = `تدريبات المقاولين_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            Loading.hide();
            Notification.success('تم تصدير سجل تدريبات المقاولين بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير تدريبات المقاولين:', error);
            Notification.error('فشل تصدير تدريبات المقاولين: ' + error.message);
        }
    },

    showContractorTrainingReportDialog() {
        this.ensureData();
        const contractors = this.getContractorOptions();
        
        if (contractors.length === 0) {
            Notification.warning('لا توجد مقاولين متاحين');
            return;
        }

        // إنشاء قائمة الشهور
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
                        تصدير تقرير تدريبات المقاولين
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
                        <select id="contractor-report-select" class="form-input">
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
                                <input type="radio" id="date-range-all" name="date-range-type" value="all" class="ml-2" checked>
                                <label for="date-range-all" class="text-sm text-gray-700 cursor-pointer">
                                    جميع السجلات
                                </label>
                            </div>
                            
                            <div class="flex items-center">
                                <input type="radio" id="date-range-month" name="date-range-type" value="month" class="ml-2">
                                <label for="date-range-month" class="text-sm text-gray-700 cursor-pointer mr-2">
                                    شهر محدد
                                </label>
                                <select id="contractor-report-month" class="form-input flex-1" disabled style="max-width: 300px;">
                                    <option value="">اختر الشهر</option>
                                    ${months.map(month => `
                                        <option value="${Utils.escapeHTML(month.value)}">${Utils.escapeHTML(month.label)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            
                            <div class="flex items-center">
                                <input type="radio" id="date-range-custom" name="date-range-type" value="custom" class="ml-2">
                                <label for="date-range-custom" class="text-sm text-gray-700 cursor-pointer mr-2">
                                    فترة محددة
                                </label>
                                <div class="flex items-center gap-2 flex-1" style="max-width: 400px;">
                                    <input type="date" id="contractor-report-from-date" class="form-input flex-1" disabled>
                                    <span class="text-sm text-gray-600">إلى</span>
                                    <input type="date" id="contractor-report-to-date" class="form-input flex-1" disabled>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                    <button type="button" class="btn-primary" id="generate-contractor-report-btn">
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

        // إدارة تفعيل/تعطيل حقول التاريخ
        const dateRangeInputs = modal.querySelectorAll('input[name="date-range-type"]');
        const monthSelect = modal.querySelector('#contractor-report-month');
        const fromDateInput = modal.querySelector('#contractor-report-from-date');
        const toDateInput = modal.querySelector('#contractor-report-to-date');

        const updateDateFields = () => {
            const selectedType = modal.querySelector('input[name="date-range-type"]:checked')?.value || 'all';
            
            if (selectedType === 'month') {
                monthSelect.disabled = false;
                monthSelect.required = true;
                fromDateInput.disabled = true;
                fromDateInput.required = false;
                toDateInput.disabled = true;
                toDateInput.required = false;
            } else if (selectedType === 'custom') {
                monthSelect.disabled = true;
                monthSelect.required = false;
                fromDateInput.disabled = false;
                fromDateInput.required = true;
                toDateInput.disabled = false;
                toDateInput.required = true;
            } else {
                monthSelect.disabled = true;
                monthSelect.required = false;
                fromDateInput.disabled = true;
                fromDateInput.required = false;
                toDateInput.disabled = true;
                toDateInput.required = false;
            }
        };

        dateRangeInputs.forEach(input => {
            input.addEventListener('change', updateDateFields);
        });

        modal.querySelector('#generate-contractor-report-btn')?.addEventListener('click', async () => {
            const contractorSelect = modal.querySelector('#contractor-report-select');
            const selectedContractorId = contractorSelect?.value ? String(contractorSelect.value).trim() : '';
            const selectedContractorName = selectedContractorId
                ? String(contractorSelect?.options?.[contractorSelect.selectedIndex]?.textContent || '')
                    .replace(/\s+/g, ' ')
                    .trim()
                : '';
            const dateRangeType = modal.querySelector('input[name="date-range-type"]:checked')?.value || 'all';
            const selectedMonth = modal.querySelector('#contractor-report-month')?.value || '';
            const fromDate = modal.querySelector('#contractor-report-from-date')?.value || '';
            const toDate = modal.querySelector('#contractor-report-to-date')?.value || '';

            // ✅ التحقق من صحة المدخلات
            if (dateRangeType === 'month' && !selectedMonth) {
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

            // ✅ التحقق من أن المقاول المحدد موجود في القائمة
            if (selectedContractorId) {
                const selectedOption = contractorSelect?.options[contractorSelect?.selectedIndex];
                if (!selectedOption || !selectedOption.value) {
                    Notification.warning('يرجى اختيار مقاول صحيح من القائمة');
                    return;
                }
            }

            close();
            await this.generateContractorTrainingReport(selectedContractorId, {
                dateRangeType,
                month: selectedMonth,
                fromDate,
                toDate
            }, selectedContractorName);
        });
    },

    /** خيارات أشهر لقائمة نافذة تصدير تحليل التدريب (مثل تقرير المقاولين) */
    _buildTrainingAnalysisExportMonthOptionsHtml() {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const parts = [];
        for (let i = 0; i < 24; i++) {
            const date = new Date(currentYear, currentDate.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const monthLabel = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
            parts.push(`<option value="${Utils.escapeHTML(monthKey)}">${Utils.escapeHTML(monthLabel)}</option>`);
        }
        return parts.join('');
    },

    _readDateFilterFromTrainingExportModal(modal) {
        const type = modal.querySelector('input[name="ta-modal-date-range"]:checked')?.value || 'all';
        if (type === 'all') {
            return { type: 'all', month: '', start: '', end: '' };
        }
        if (type === 'month') {
            const m = modal.querySelector('#ta-modal-month')?.value?.trim() || '';
            return { type: 'month', month: m, start: '', end: '' };
        }
        const start = modal.querySelector('#ta-modal-from-date')?.value?.trim() || '';
        const end = modal.querySelector('#ta-modal-to-date')?.value?.trim() || '';
        return { type: 'range', month: '', start, end };
    },

    _refreshAnalysisExportModalLists(modal, kind) {
        this.ensureData();
        const dateFilter = this._readDateFilterFromTrainingExportModal(modal);
        if (kind === 'trainers') {
            const sel = modal.querySelector('#ta-modal-trainer-select');
            if (!sel) return;
            const prev = sel.value;
            let t = Array.isArray(AppState.appData.training) ? AppState.appData.training : [];
            t = this.filterRecordsByAnalysisDate(t, dateFilter, 'training');
            const trainers = new Set();
            t.forEach(r => trainers.add(this.getTrainingAnalysisValue('training', 'trainer', r)));
            const list = Array.from(trainers).filter(x => x && x !== 'غير محدد').sort((a, b) => String(a).localeCompare(String(b), 'ar'));
            sel.innerHTML = '<option value="">— كل المدربين —</option>' +
                list.map(x => `<option value="${Utils.escapeHTML(x)}">${Utils.escapeHTML(x)}</option>`).join('');
            if (prev && list.includes(prev)) sel.value = prev;
        } else {
            const deptSel = modal.querySelector('#ta-modal-department-select');
            const sel = modal.querySelector('#ta-modal-person-select');
            if (!sel) return;
            const prev = sel.value;
            const audience = modal.querySelector('#ta-modal-audience')?.value || 'all';
            let rec = Array.isArray(AppState.appData.trainingAttendance) ? AppState.appData.trainingAttendance : [];
            rec = this.filterRecordsByAnalysisDate(rec, dateFilter, 'trainingAttendance');
            if (audience === 'employee') rec = rec.filter(r => !this._isAttendanceContractorLike(r));
            else if (audience === 'contractor') rec = rec.filter(r => this._isAttendanceContractorLike(r));

            if (deptSel) {
                const prevDept = deptSel.value;
                const deptLabels = Array.from(new Set(rec.map(r => this._attendanceRecordDepartmentLabel(r))))
                    .sort((a, b) => String(a).localeCompare(String(b), 'ar', { sensitivity: 'base' }));
                deptSel.innerHTML = '<option value="">— كل الإدارات —</option>' +
                    deptLabels.map(l => `<option value="${Utils.escapeHTML(l)}">${Utils.escapeHTML(l)}</option>`).join('');
                if (prevDept && deptLabels.includes(prevDept)) deptSel.value = prevDept;
                const deptFilter = deptSel.value || '';
                if (deptFilter) {
                    rec = rec.filter(r => this._attendanceRecordDepartmentLabel(r) === deptFilter);
                }
            }

            const seen = new Map();
            rec.forEach(r => {
                const key = this._attendancePersonRowKey(r);
                if (seen.has(key)) return;
                const code = String(r.employeeCode || r.code || r.employeeNumber || '').trim();
                const name = String(r.employeeName || r.name || '').trim();
                const label = name ? (code ? `${name} (${code})` : name) : (code || 'غير محدد');
                seen.set(key, label);
            });
            const options = Array.from(seen.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ar'));
            sel.innerHTML = '<option value="">— كل الأشخاص —</option>' +
                options.map(([k, lab]) => `<option value="${Utils.escapeHTML(k)}">${Utils.escapeHTML(lab)}</option>`).join('');
            if (prev && seen.has(prev)) sel.value = prev;
        }
    },

    /**
     * نافذة تصدير تقرير تحليل التدريب (مدربين أو متدربين) — نمط مشابه لتقرير المقاولين
     * @param {'trainers'|'attendees'} kind
     */
    showTrainingAnalysisExportDialog(kind) {
        if (typeof this.isCurrentUserAdmin === 'function' && !this.isCurrentUserAdmin()) {
            Notification.error('ليس لديك صلاحية لتصدير تقارير التحليل');
            return;
        }
        this.ensureData();
        const isTrainers = kind === 'trainers';
        const title = isTrainers ? 'تصدير تقرير المدربين — تحليل التدريب' : 'تصدير تقرير المتدربين — تحليل التدريب';
        const monthOpts = this._buildTrainingAnalysisExportMonthOptionsHtml();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 720px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-file-export ml-2"></i>${Utils.escapeHTML(title)}</h2>
                    <button type="button" class="modal-close" title="إغلاق"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">صيغة التصدير</label>
                        <div class="flex flex-wrap gap-4">
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="ta-modal-format" value="excel" class="ml-1" checked><span>Excel</span></label>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="ta-modal-format" value="pdf" class="ml-1"><span>PDF (طباعة)</span></label>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px;">
                        <label class="block text-sm font-semibold text-gray-700 mb-3"><i class="fas fa-calendar-alt ml-2"></i>فترة التقرير</label>
                        <div class="space-y-3">
                            <div class="flex items-center">
                                <input type="radio" id="ta-modal-dr-all" name="ta-modal-date-range" value="all" class="ml-2" checked>
                                <label for="ta-modal-dr-all" class="text-sm text-gray-700 cursor-pointer">جميع السجلات (بدون تقييد بالتاريخ)</label>
                            </div>
                            <div class="flex items-center flex-wrap gap-2">
                                <input type="radio" id="ta-modal-dr-month" name="ta-modal-date-range" value="month" class="ml-2">
                                <label for="ta-modal-dr-month" class="text-sm text-gray-700 cursor-pointer">شهر محدد</label>
                                <select id="ta-modal-month" class="form-input flex-1" disabled style="max-width: 280px;">
                                    <option value="">اختر الشهر</option>
                                    ${monthOpts}
                                </select>
                            </div>
                            <div class="flex items-center flex-wrap gap-2">
                                <input type="radio" id="ta-modal-dr-custom" name="ta-modal-date-range" value="custom" class="ml-2">
                                <label for="ta-modal-dr-custom" class="text-sm text-gray-700 cursor-pointer">فترة محددة</label>
                                <input type="date" id="ta-modal-from-date" class="form-input" disabled style="max-width: 150px;">
                                <span class="text-sm text-gray-600">إلى</span>
                                <input type="date" id="ta-modal-to-date" class="form-input" disabled style="max-width: 150px;">
                            </div>
                        </div>
                    </div>
                    ${isTrainers ? `
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-chalkboard-teacher ml-2"></i>مدرب محدد (اختياري)</label>
                        <select id="ta-modal-trainer-select" class="form-input w-full"><option value="">— كل المدربين —</option></select>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">أقصى عدد مدربين في التقرير</label>
                        <input type="number" id="ta-modal-limit-trainers" class="form-input" style="max-width:120px;" min="1" max="500" value="30">
                    </div>` : `
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">فئة الأشخاص</label>
                        <select id="ta-modal-audience" class="form-input w-full">
                            <option value="all">الكل</option>
                            <option value="employee">موظفون</option>
                            <option value="contractor">مقاولون / خارجيون</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-building ml-2 text-gray-500"></i>الإدارة (اختياري)</label>
                        <select id="ta-modal-department-select" class="form-input w-full"><option value="">— كل الإدارات —</option></select>
                        <p class="text-xs text-gray-500 mt-1">تُستخرج الإدارات من سجل الحضور ضمن الفترة والفئة المختارة.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">شخص محدد (اختياري)</label>
                        <select id="ta-modal-person-select" class="form-input w-full"><option value="">— كل الأشخاص —</option></select>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">أقصى عدد أشخاص في التقرير</label>
                        <input type="number" id="ta-modal-limit-attendees" class="form-input" style="max-width:120px;" min="1" max="2000" value="50">
                    </div>`}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                    <button type="button" class="btn-primary" id="ta-modal-generate-btn"><i class="fas fa-file-export ml-2"></i>إنشاء التقرير</button>
                </div>
            </div>`;

        document.body.appendChild(modal);
        const close = () => {
            modal.remove();
        };
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        const monthSelect = modal.querySelector('#ta-modal-month');
        const fromDateInput = modal.querySelector('#ta-modal-from-date');
        const toDateInput = modal.querySelector('#ta-modal-to-date');

        const updateDateFields = () => {
            const selectedType = modal.querySelector('input[name="ta-modal-date-range"]:checked')?.value || 'all';
            if (selectedType === 'month') {
                monthSelect.disabled = false;
                if (fromDateInput) fromDateInput.disabled = true;
                if (toDateInput) toDateInput.disabled = true;
            } else if (selectedType === 'custom') {
                monthSelect.disabled = true;
                if (fromDateInput) fromDateInput.disabled = false;
                if (toDateInput) toDateInput.disabled = false;
            } else {
                monthSelect.disabled = true;
                if (fromDateInput) fromDateInput.disabled = true;
                if (toDateInput) toDateInput.disabled = true;
            }
        };

        modal.querySelectorAll('input[name="ta-modal-date-range"]').forEach(inp => {
            inp.addEventListener('change', () => {
                updateDateFields();
                this._refreshAnalysisExportModalLists(modal, isTrainers ? 'trainers' : 'attendees');
            });
        });
        if (monthSelect) monthSelect.addEventListener('change', () => this._refreshAnalysisExportModalLists(modal, isTrainers ? 'trainers' : 'attendees'));
        if (fromDateInput) fromDateInput.addEventListener('change', () => this._refreshAnalysisExportModalLists(modal, isTrainers ? 'trainers' : 'attendees'));
        if (toDateInput) toDateInput.addEventListener('change', () => this._refreshAnalysisExportModalLists(modal, isTrainers ? 'trainers' : 'attendees'));
        const audSel = modal.querySelector('#ta-modal-audience');
        if (audSel) audSel.addEventListener('change', () => this._refreshAnalysisExportModalLists(modal, 'attendees'));
        const deptSelModal = modal.querySelector('#ta-modal-department-select');
        if (deptSelModal) deptSelModal.addEventListener('change', () => this._refreshAnalysisExportModalLists(modal, 'attendees'));

        updateDateFields();
        this._refreshAnalysisExportModalLists(modal, isTrainers ? 'trainers' : 'attendees');

        modal.querySelector('#ta-modal-generate-btn')?.addEventListener('click', () => {
            const dateRangeType = modal.querySelector('input[name="ta-modal-date-range"]:checked')?.value || 'all';
            const selectedMonth = modal.querySelector('#ta-modal-month')?.value || '';
            const fromDate = modal.querySelector('#ta-modal-from-date')?.value || '';
            const toDate = modal.querySelector('#ta-modal-to-date')?.value || '';

            if (dateRangeType === 'month' && !selectedMonth) {
                Notification.warning('يرجى اختيار الشهر');
                return;
            }
            if (dateRangeType === 'custom') {
                if (!fromDate || !toDate) {
                    Notification.warning('يرجى اختيار تاريخ البداية والنهاية');
                    return;
                }
                if (new Date(fromDate) > new Date(toDate)) {
                    Notification.warning('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
                    return;
                }
            }

            const dateFilter = this._readDateFilterFromTrainingExportModal(modal);
            const format = modal.querySelector('input[name="ta-modal-format"]:checked')?.value || 'excel';

            const ctx = { dateFilter };
            if (isTrainers) {
                ctx.trainerKey = modal.querySelector('#ta-modal-trainer-select')?.value?.trim() || '';
                ctx.limitTrainers = Math.min(500, Math.max(1, parseInt(modal.querySelector('#ta-modal-limit-trainers')?.value || '30', 10) || 30));
            } else {
                ctx.audience = modal.querySelector('#ta-modal-audience')?.value || 'all';
                ctx.attendanceDepartment = modal.querySelector('#ta-modal-department-select')?.value?.trim() || '';
                ctx.personKey = modal.querySelector('#ta-modal-person-select')?.value?.trim() || '';
                ctx.limitAttendees = Math.min(2000, Math.max(1, parseInt(modal.querySelector('#ta-modal-limit-attendees')?.value || '50', 10) || 50));
            }

            close();
            this._analysisExportContext = ctx;
            try {
                if (isTrainers) {
                    if (format === 'pdf') this.exportAnalysisTrainersPDF();
                    else this.exportAnalysisTrainersExcel();
                } else {
                    if (format === 'pdf') this.exportAnalysisAttendeesPDF();
                    else this.exportAnalysisAttendeesExcel();
                }
            } finally {
                this._analysisExportContext = null;
            }
        });
    },

    async generateContractorTrainingReport(contractorId = null, dateFilter = {}, uiSelectedContractorName = '') {
        this.ensureData();
        try {
            Loading.show();
            
            // ✅ إصلاح: استخدام نفس مصدر البيانات المستخدم في القائمة المنسدلة
            const contractorOptions = this.getContractorOptions();
            const contractorMap = new Map(contractorOptions.map(c => [String(c?.id ?? '').trim(), c.name || '']));
            
            // ✅ إصلاح: تطبيع contractorId للمقارنة الصحيحة
            const normalizedContractorId = String(contractorId || '').trim();
            const normalizedUiSelectedName = String(uiSelectedContractorName || '')
                .replace(/\s+/g, ' ')
                .trim();
            const normalizedUiSelectedNameKey = normalizedUiSelectedName.toLowerCase();
            
            // ✅ الحصول على اسم المقاول المحدد من القائمة نفسها مع التحقق المتعدد
            let selectedContractorName = null;
            if (normalizedUiSelectedName) {
                // ✅ الأفضلية لاسم المقاول الذي اختاره المستخدم فعلياً من القائمة
                selectedContractorName = normalizedUiSelectedName;
            } else if (normalizedContractorId) {
                // 1. البحث مباشرة في contractorOptions أولاً (الأكثر دقة)
                const selectedContractor = contractorOptions.find(c => {
                    const contractorId = String(c.id || '').trim();
                    return contractorId === normalizedContractorId;
                });
                
                if (selectedContractor && selectedContractor.name) {
                    selectedContractorName = selectedContractor.name.trim();
                } else {
                    // 2. البحث في contractorMap
                    selectedContractorName = contractorMap.get(normalizedContractorId) || '';
                    
                    // 3. إذا لم يتم العثور عليه، البحث في السجلات المحفوظة
                    if (!selectedContractorName || selectedContractorName === '') {
                        const firstRecord = (AppState.appData.contractorTrainings || []).find(r => {
                            const recordContractorId = String(r.contractorId || '').trim();
                            return recordContractorId === normalizedContractorId;
                        });
                        if (firstRecord && firstRecord.contractorName) {
                            selectedContractorName = firstRecord.contractorName.trim();
                        }
                    }
                }
                
                // ✅ التحقق النهائي - إذا لم يتم العثور على الاسم، استخدام سلسلة فارغة
                if (!selectedContractorName || selectedContractorName === '' || selectedContractorName === 'بدون اسم') {
                    selectedContractorName = '';
                    Utils.safeWarn(`⚠️ لم يتم العثور على اسم المقاول للمعرف: ${normalizedContractorId}`);
                }
            }
            
            let records = (AppState.appData.contractorTrainings || []).slice().sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
            
            const getRecordContractorName = (record) => {
                const rid = String(record?.contractorId ?? '').trim();
                const storedName = (record?.contractorName || '').toString().replace(/\s+/g, ' ').trim();
                const mapName = (contractorMap.get(rid) || '').toString().trim();
                // ✅ الأفضلية للاسم المحفوظ بالسجل لتفادي تعارض الـ IDs
                return storedName || mapName || '';
            };

            // ✅ تصفية حسب المقاول: استخدام الاسم بشكل أساسي لتجنب مشاكل عدم تطابق IDs
            if (normalizedContractorId || normalizedUiSelectedNameKey) {
                const allRecords = records;
                const beforeFilter = allRecords.length;

                // ✅ الحل: التصفية تعتمد على الاسم بشكل أساسي (ما يراه المستخدم في الجدول)
                // نستخدم الاسم من واجهة المستخدم إذا كان متوفراً، وإلا نستخدم من contractorMap
                const targetName = normalizedUiSelectedNameKey || (contractorMap.get(normalizedContractorId) || '').toLowerCase();

                records = allRecords.filter(record => {
                    const recordName = getRecordContractorName(record).toLowerCase();
                    
                    // ✅ مطابقة مباشرة بالاسم
                    if (recordName === targetName) return true;
                    
                    // ✅ مطابقة جزئية بالاسم (في حالة وجود مسافات إضافية أو اختلافات بسيطة)
                    if (targetName && recordName.includes(targetName)) return true;
                    if (targetName && targetName.includes(recordName)) return true;
                    
                    // ✅ Fallback: مطابقة بالمعرف إذا كان الاسم غير متطابق
                    if (normalizedContractorId) {
                        const recordContractorId = String(record?.contractorId ?? '').trim();
                        if (recordContractorId === normalizedContractorId) return true;
                        if (recordContractorId && normalizedContractorId) {
                            const normalizedRecordId = recordContractorId.replace(/\s+/g, '');
                            const normalizedFilterId = normalizedContractorId.replace(/\s+/g, '');
                            if (normalizedRecordId === normalizedFilterId) return true;
                        }
                    }
                    
                    return false;
                });

                if (records.length === 0 && beforeFilter > 0) {
                    Utils.safeWarn(`⚠️ لم يتم العثور على سجلات للمقاول المحدد. إجمالي السجلات قبل التصفية: ${beforeFilter}`);
                }
            }
            
            // تصفية حسب التاريخ
            const { dateRangeType = 'all', month = '', fromDate = '', toDate = '' } = dateFilter || {};
            
            if (dateRangeType === 'month' && month) {
                // تصفية حسب الشهر المحدد (YYYY-MM)
                const [year, monthNum] = month.split('-');
                records = records.filter(record => {
                    if (!record.date) return false;
                    const recordDate = new Date(record.date);
                    const recordYear = recordDate.getFullYear();
                    const recordMonth = recordDate.getMonth() + 1;
                    return recordYear === parseInt(year, 10) && recordMonth === parseInt(monthNum, 10);
                });
            } else if (dateRangeType === 'custom' && fromDate && toDate) {
                // تصفية حسب الفترة المحددة
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                
                records = records.filter(record => {
                    if (!record.date) return false;
                    const recordDate = new Date(record.date);
                    return recordDate >= startDate && recordDate <= endDate;
                });
            }

            const totalPrograms = records.length;
            const totalTrainees = records.reduce((sum, entry) => sum + (parseInt(entry.traineesCount, 10) || 0), 0);
            const totalHours = records.reduce((sum, entry) => sum + (parseFloat(entry.totalHours) || 0), 0);

            const rowsHtml = records.map((entry, index) => {
                // ✅ إصلاح: تطبيع contractorId قبل البحث في الـ map
                const entryContractorId = String(entry.contractorId || '').trim();
                
                // ✅ الحصول على اسم المقاول مع التحقق المتعدد
                let entryContractorName = '-';
                const storedName = String(entry.contractorName || '').replace(/\s+/g, ' ').trim();
                const hasStoredName = storedName && !['غير محدد', 'بدون اسم', '—', '-'].includes(storedName);
                if (hasStoredName) {
                    entryContractorName = storedName;
                } else if (entryContractorId) {
                    // 1. البحث في contractorMap
                    entryContractorName = contractorMap.get(entryContractorId) || '';
                    
                    // 2. إذا لم يتم العثور عليه، البحث مباشرة في contractorOptions
                    if (!entryContractorName || entryContractorName === '') {
                        const foundContractor = contractorOptions.find(c => String(c?.id ?? '').trim() === entryContractorId);
                        if (foundContractor && foundContractor.name) {
                            entryContractorName = foundContractor.name.trim();
                        }
                    }
                    
                    // 3. إذا لم يتم العثور عليه، استخدام الاسم المحفوظ في السجل
                    if (!entryContractorName || entryContractorName === '') {
                        entryContractorName = storedName || '-';
                    }
                } else {
                    entryContractorName = storedName || '-';
                }
                
                // ✅ إصلاح: تحويل قيم الوقت إلى صيغة صحيحة لتجنب عرض تواريخ Excel الخاطئة
                const formattedDuration = entry.durationMinutes && !isNaN(Number(entry.durationMinutes)) ? Number(entry.durationMinutes) : '-';
                const formattedHours = entry.totalHours && !isNaN(Number(entry.totalHours)) ? parseFloat(entry.totalHours).toFixed(2) : '-';
                
                return `
                <tr style="${index % 2 === 0 ? 'background-color: #FFFFFF;' : 'background-color: #F9FAFB;'}">
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${index + 1}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${entry.date ? Utils.formatDate(entry.date) : '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(entry.topic || '-')}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(entry.trainer || '-')}</td>
                    ${!selectedContractorName ? `<td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(entryContractorName)}</td>` : ''}
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${entry.traineesCount || '-'}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${formattedDuration}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px;">${formattedHours}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(entry.location || '-')}</td>
                    <td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: right; font-size: 11px;">${Utils.escapeHTML(entry.subLocation || '-')}</td>
                </tr>
            `;
            }).join('');

            // إنشاء معلومات الفترة الزمنية
            let periodInfo = '';
            if (dateRangeType === 'month' && month) {
                const [year, monthNum] = month.split('-');
                const monthDate = new Date(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1);
                const monthLabel = monthDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
                periodInfo = ` - ${monthLabel}`;
            } else if (dateRangeType === 'custom' && fromDate && toDate) {
                const fromDateObj = new Date(fromDate);
                const toDateObj = new Date(toDate);
                const fromDateStr = fromDateObj.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
                const toDateStr = toDateObj.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
                periodInfo = ` - من ${fromDateStr} إلى ${toDateStr}`;
            }

            const reportTitle = selectedContractorName 
                ? `تقرير تدريبات المقاول: ${Utils.escapeHTML(selectedContractorName)}${periodInfo}`
                : `تقرير تدريبات المقاولين${periodInfo}`;
            
            const content = `
                <div style="margin-bottom: 24px;">
                    <h2 style="font-size: 20px; margin-bottom: 12px; color: #1E3A8A; font-weight: 700;">${selectedContractorName ? `ملخص تدريبات: ${Utils.escapeHTML(selectedContractorName)}` : 'ملخص تدريبات المقاولين'}</h2>
                    ${selectedContractorName ? `<div style="margin-bottom: 16px; padding: 12px; background: #F0F9FF; border-right: 4px solid #1E3A8A; border-radius: 8px;">
                        <strong style="color: #1E3A8A;">المقاول:</strong> <span style="color: #1F2937;">${Utils.escapeHTML(selectedContractorName)}</span>
                    </div>` : ''}
                    ${periodInfo ? `<div style="margin-bottom: 16px; padding: 12px; background: #FFF7ED; border-right: 4px solid #F59E0B; border-radius: 8px;">
                        <strong style="color: #D97706;">الفترة:</strong> <span style="color: #1F2937;">${periodInfo.replace(' - ', '')}</span>
                    </div>` : ''}
                    <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #EFF6FF; border: 1px solid #BFDBFE;">
                            <div style="font-size: 12px; color: #1D4ED8; margin-bottom: 6px; font-weight: 600;">عدد البرامج</div>
                            <div style="font-size: 26px; font-weight: 700; color: #1E3A8A;">${totalPrograms}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #ECFDF5; border: 1px solid #BBF7D0;">
                            <div style="font-size: 12px; color: #047857; margin-bottom: 6px; font-weight: 600;">إجمالي المتدربين</div>
                            <div style="font-size: 26px; font-weight: 700; color: #065F46;">${totalTrainees}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #FDF2F8; border: 1px solid #FBCFE8;">
                            <div style="font-size: 12px; color: #BE185D; margin-bottom: 6px; font-weight: 600;">إجمالي ساعات التدريب</div>
                            <div style="font-size: 26px; font-weight: 700; color: #9F1239;">${totalHours.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 18px; margin-bottom: 12px; color: #1E3A8A; font-weight: 700; border-bottom: 2px solid #1E3A8A; padding-bottom: 8px;">جدول التدريبات</h3>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; direction: rtl;">
                        <thead>
                            <tr style="background: #1E3A8A; color: #FFFFFF;">
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">#</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">التاريخ</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">الموضوع</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">المدرب</th>
                                ${!selectedContractorName ? '<th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">المقاول</th>' : ''}
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">عدد المتدربين</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">المدة (دقائق)</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">الساعات</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">المكان</th>
                                <th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap;">المكان الفرعي</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || `<tr><td colspan="${selectedContractorName ? '9' : '10'}" style="padding: 16px; text-align: center; border: 1px solid #E5E7EB; color: #6B7280;">لا توجد سجلات متاحة</td></tr>`}
                        </tbody>
                    </table>
                </div>
            `;

            const formCode = `CONTRACTOR-TRAINING-${contractorId ? contractorId.substring(0, 8) + '-' : ''}${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(formCode, reportTitle, content, false, true, { source: 'ContractorTraining', contractorId, contractorName: selectedContractorName }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${reportTitle}</title><style>body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 20px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 10px; border: 1px solid #E5E7EB; text-align: center; } thead th { background: #1E3A8A; color: #FFFFFF; }</style></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const reportWindow = window.open(url, '_blank');
            if (reportWindow) {
                reportWindow.onload = () => {
                    try {
                        reportWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (error) {
                        Utils.safeWarn('تعذر الطباعة التلقائية لتقرير المقاولين:', error);
                    }
                };
            } else {
                Notification.info('تم إنشاء التقرير. يرجى السماح بالنوافذ المنبثقة لعرضه.');
            }

            Loading.hide();
            Notification.success(selectedContractorName 
                ? `تم إنشاء تقرير تدريبات المقاول: ${selectedContractorName}`
                : 'تم إنشاء تقرير تدريبات المقاولين');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في إنشاء تقرير تدريبات المقاولين:', error);
            Notification.error('تعذر إنشاء تقرير تدريبات المقاولين: ' + error.message);
        }
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
        
        const modalContent = modal.querySelector('.modal-content');
        let isClosing = false;
        let handleEscKey = null;
        
        const close = (e) => {
            if (isClosing) return; // منع الإغلاق المتكرر
            isClosing = true;
            
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            // إزالة مستمع ESC
            if (handleEscKey) {
                document.removeEventListener('keydown', handleEscKey);
                handleEscKey = null;
            }
            
            if (modal && modal.parentNode) {
                modal.remove();
            }
        };
        
        // منع انتشار الأحداث من محتوى النموذج إلى overlay
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // إغلاق موثوق - مستمع واحد فقط لكل زر
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                close(e);
            });
        }
        
        const closeFooterBtn = modal.querySelector('[data-action="close"]');
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                close(e);
            });
        }
        
        // إغلاق عند النقر خارج النموذج (على overlay فقط)
        modal.addEventListener('click', (event) => {
            if (event.target === modal && !isClosing) {
                close(event);
            }
        });
        
        // إغلاق عند الضغط على ESC
        handleEscKey = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                close(e);
            }
        };
        document.addEventListener('keydown', handleEscKey);

        const yearInput = modal.querySelector('#annual-plan-year');
        const bodyContainer = modal.querySelector('#annual-plan-body');
        const render = () => {
            const year = parseInt(yearInput?.value, 10) || new Date().getFullYear();
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
                const annualPlanBody = modal.querySelector('#annual-plan-body');
                if (annualPlanBody) {
                    annualPlanBody.innerHTML = this.renderAnnualPlanContent(year);
                }
                this.bindAnnualPlanEvents(modal, year);
            });
            return;
        }

        if (this.isCurrentUserAdmin()) {
            const rerender = () => {
                const annualPlanBody = modal.querySelector('#annual-plan-body');
                if (annualPlanBody) {
                    annualPlanBody.innerHTML = this.renderAnnualPlanContent(year);
                }
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
                                            ${statusOptions.map(status => `<option value="${Utils.escapeHTML(status)}" ${item.status === status ? 'selected' : ''}>${Utils.escapeHTML(status)}</option>`).join('')}
                                        </select>
                                    ` : `
                                        <span class="badge ${item.status === 'مكتمل' ? 'badge-success' :
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
                                                <option value="${Utils.escapeHTML(option.id)}" ${option.id === item.linkedTrainingId ? 'selected' : ''}>
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
        const contractors = (AppState.appData.contractors || [])
            .filter(contractor => contractor && contractor.isActive !== 'inactive' && contractor.isActive !== false && contractor.isActive !== 'false' && contractor.isActive !== 'FALSE')
            .map(contractor => contractor.name || contractor.company)
            .filter(Boolean);
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
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الموضوع التدريبي *</label>
                                <input type="text" id="plan-item-topic" class="form-input" required value="${Utils.escapeHTML(item?.topic || '')}" placeholder="عنوان البرنامج التدريبي">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ المخطط *</label>
                                <input type="date" id="plan-item-date" class="form-input" required value="${item?.plannedDate ? new Date(item.plannedDate).toISOString().slice(0, 10) : ''}">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الفئة المستهدفة *</label>
                                <select id="plan-item-target-type" class="form-input" required>
                                    <option value="employees" ${item?.targetType === 'employees' ? 'selected' : ''}>الموظفون</option>
                                    <option value="contractors" ${item?.targetType === 'contractors' ? 'selected' : ''}>المقاولون</option>
                                    <option value="mixed" ${item?.targetType === 'mixed' ? 'selected' : ''}>الكل</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                                <select id="plan-item-status" class="form-input">
                                    <option value="مخطط" ${item?.status === 'مخطط' ? 'selected' : ''}>مخطط</option>
                                    <option value="قيد التنفيذ" ${item?.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
                                    <option value="مكتمل" ${item?.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                    <option value="مؤجل" ${item?.status === 'مؤجل' ? 'selected' : ''}>مؤجل</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">السنة</label>
                                <input type="text" class="form-input" value="${year}" disabled>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الوظائف المستهدفة</label>
                                <select id="plan-item-roles" class="form-input" multiple size="5">
                                    ${positions.map(position => `
                                        <option value="${Utils.escapeHTML(position)}" ${item?.targetRoles?.includes(position) ? 'selected' : ''}>${Utils.escapeHTML(position)}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">المقاولون المستهدفون</label>
                                <select id="plan-item-contractors" class="form-input" multiple size="5">
                                    ${contractors.map(name => `
                                        <option value="${Utils.escapeHTML(name)}" ${item?.targetContractors?.includes(name) ? 'selected' : ''}>${Utils.escapeHTML(name)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الموضوعات المرتبطة (اختياري)</label>
                            <select id="plan-item-topics" class="form-input" multiple size="5">
                                ${topics.map(topic => `
                                    <option value="${Utils.escapeHTML(topic)}" ${item?.requiredTopics?.includes(topic) ? 'selected' : ''}>${Utils.escapeHTML(topic)}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
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
        if (typeof Permissions?.isCurrentUserAdmin === 'function') {
            return Permissions.isCurrentUserAdmin();
        }
        return (AppState.currentUser?.role || '').toLowerCase() === 'admin';
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
            updatedAt: new Date().toISOString(),
            items: []
        };
        AppState.appData.annualTrainingPlans.push(plan);
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
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
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
    },

    getAnnualPlanStats(plan) {
        return {
            total: plan.items.length,
            completed: plan.items.filter(item => item.status === 'مكتمل').length,
            inProgress: plan.items.filter(item => item.status === 'قيد التنفيذ').length,
            delayed: plan.items.filter(item => item.status === 'مؤجل').length
        };
    },

    updateAnnualPlanItemStatus(year, itemId, status) {
        const plan = this.getAnnualPlan(year, { createIfMissing: false });
        if (!plan) return;
        const item = plan.items.find(i => i.id === itemId);
        if (!item) return;
        item.status = status;
        item.updatedAt = new Date().toISOString();
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
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
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
        Notification.success('تم ربط العنصر بسجل التدريب');
    },

    removeAnnualPlanItem(year, itemId) {
        const plan = this.getAnnualPlan(year, { createIfMissing: false });
        if (!plan) return;
        plan.items = plan.items.filter(item => item.id !== itemId);
        plan.updatedAt = new Date().toISOString();
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }
        Notification.success('تم حذف عنصر الخطة التدريبية');
    },

    openQuickTrainingRegistration(employeeCode) {
        this.ensureData();
        const employees = AppState.appData.employees || [];
        const employee = employees.find(emp => (emp.employeeNumber || emp.sapId) === employeeCode);
        if (!employee) {
            Notification.error('لم يتم العثور على الموظف المحدد');
            return;
        }

        const requiredTopics = this.getRequiredTopicsForPosition(employee.position);
        const topics = Array.from(new Set([
            ...requiredTopics.map(item => (typeof item === 'string' ? item : item.topic)),
            ...(this.getAllTrainingTopics() || [])
        ].filter(Boolean)));

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-plus-circle ml-2"></i>
                        تسجيل تدريب سريع للموظف: ${Utils.escapeHTML(employee.name || '')}
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="quick-training-form">
                    <div class="modal-body space-y-5">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الموضوع التدريبي *</label>
                                <input type="text" id="quick-training-subject" class="form-input" required placeholder="أدخل عنوان البرنامج">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">نوع التدريب *</label>
                                <select id="quick-training-type" class="form-input" required>
                                    <option value="داخلي">داخلي</option>
                                    <option value="خارجي">خارجي</option>
                                    <option value="إلكتروني">إلكتروني</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ *</label>
                                <input type="date" id="quick-training-date" class="form-input" required value="${new Date().toISOString().slice(0, 10)}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">المدرب / الجهة *</label>
                                <input type="text" id="quick-training-trainer" class="form-input" required placeholder="اسم المدرب أو الجهة">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الموقع</label>
                                <input type="text" id="quick-training-location" class="form-input" placeholder="موقع التدريب">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة *</label>
                                <select id="quick-training-status" class="form-input" required>
                                    <option value="مكتمل" selected>مكتمل</option>
                                    <option value="قيد التنفيذ">قيد التنفيذ</option>
                                    <option value="مخطط">مخطط</option>
                                    <option value="مؤجل">مؤجل</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">وقت البداية</label>
                                <input type="time" id="quick-training-start-time" class="form-input">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">وقت النهاية</label>
                                <input type="time" id="quick-training-end-time" class="form-input">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الساعات التدريبية</label>
                            <div class="flex gap-3 items-center">
                                <input type="number" id="quick-training-hours" class="form-input" min="0" step="0.5" placeholder="عدد الساعات" value="2">
                                <span class="text-sm text-gray-500">ساعة</span>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                الموضوعات المرتبطة
                                <span class="text-xs text-gray-500 block">يمكن اختيار أكثر من موضوع لتحديث مصفوفة التدريب</span>
                            </label>
                            <select id="quick-training-topics" class="form-input" multiple size="5">
                                ${topics.map(topic => `<option value="${Utils.escapeHTML(topic)}">${Utils.escapeHTML(topic)}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                            <i class="fas fa-info-circle ml-2"></i>
                            سيتم إنشاء سجل تدريب جديد وربطه تلقائياً بمصفوفة التدريب الخاصة بالموظف.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            حفظ التدريب
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

                // حفظ البيانات باستخدام window.DataManager
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                } else {
                    Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
                }
                
                // حفظ في Google Sheets
                if (AppState.googleConfig?.appsScript?.enabled) {
                    try {
                        // حفظ التدريب
                        await GoogleIntegration.sendRequest({
                            action: 'addTraining',
                            data: trainingRecord
                        });
                        
                        // حفظ مصفوفة التدريب للموظف (إذا كان هناك مشارك واحد)
                        if (participantEntry && participantEntry.employeeCode) {
                            const employeeMatrix = AppState.appData.employeeTrainingMatrix[participantEntry.employeeCode];
                            if (employeeMatrix && employeeMatrix.length > 0) {
                                await GoogleIntegration.sendRequest({
                                    action: 'updateEmployeeTrainingMatrix',
                                    data: {
                                        employeeId: participantEntry.employeeCode,
                                        updateData: {
                                            [participantEntry.employeeCode]: employeeMatrix
                                        }
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        Utils.safeWarn('⚠️ فشل حفظ التدريب في Google Sheets، سيتم المحاولة لاحقاً:', error);
                        // استخدام autoSave كبديل فقط في حالة الفشل
                        if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                            await Promise.allSettled([
                                GoogleIntegration.autoSave?.('Training', AppState.appData.training),
                                GoogleIntegration.autoSave?.('EmployeeTrainingMatrix', AppState.appData.employeeTrainingMatrix)
                            ]).catch(() => {
                                // تجاهل الأخطاء في autoSave أيضاً
                            });
                        }
                    }
                } else if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    // إذا لم يكن Google Apps Script مفعّل، نستخدم autoSave
                    await Promise.allSettled([
                        GoogleIntegration.autoSave?.('Training', AppState.appData.training),
                        GoogleIntegration.autoSave?.('EmployeeTrainingMatrix', AppState.appData.employeeTrainingMatrix)
                    ]);
                }

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

    /**
     * تصدير مصفوفة التدريب إلى Excel
     */
    async exportTrainingMatrix() {
        this.ensureData();
        try {
            Loading.show();

            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث البيانات');
                return;
            }

            const employees = AppState.appData.employees || [];
            const trainingMatrix = AppState.appData.employeeTrainingMatrix || {};

            const excelData = employees.map(emp => {
                const code = emp.employeeNumber || emp.sapId || '';
                const trainings = trainingMatrix[code] || [];
                const totalHours = trainings.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
                const internalCount = trainings.filter(t => t.trainingType === 'داخلي').length;
                const externalCount = trainings.filter(t => t.trainingType === 'خارجي').length;

                return {
                    'الكود الوظيفي': code,
                    'اسم الموظف': emp.name || '',
                    'الوظيفة': emp.position || '',
                    'القسم/الإدارة': emp.department || '',
                    'عدد برامج التدريب': trainings.length,
                    'تدريب داخلي': internalCount,
                    'تدريب خارجي': externalCount,
                    'إجمالي ساعات التدريب': totalHours.toFixed(2)
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            ws['!cols'] = [
                { wch: 15 }, // الكود الوظيفي
                { wch: 25 }, // اسم الموظف
                { wch: 20 }, // الوظيفة
                { wch: 20 }, // القسم/الإدارة
                { wch: 18 }, // عدد برامج التدريب
                { wch: 15 }, // تدريب داخلي
                { wch: 15 }, // تدريب خارجي
                { wch: 20 }  // إجمالي ساعات التدريب
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'مصفوفة التدريب');

            const date = new Date().toISOString().slice(0, 10);
            const filename = `مصفوفة التدريب_${date}.xlsx`;

            XLSX.writeFile(wb, filename);

            Loading.hide();
            Notification.success('تم تصدير مصفوفة التدريب بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير مصفوفة التدريب:', error);
            Notification.error('فشل تصدير مصفوفة التدريب: ' + error.message);
        }
    },

    filterItems(searchTerm = '', statusFilter = '') {
        this.ensureData();
        const items = AppState.appData.training || [];
        let filtered = items;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                (item.name && item.name.toLowerCase().includes(term)) ||
                (item.trainer && item.trainer.toLowerCase().includes(term)) ||
                (Array.isArray(item.participants) && item.participants.some(p =>
                    (p.name && p.name.toLowerCase().includes(term)) ||
                    (p.code && p.code.includes(term))
                ))
            );
        }

        if (statusFilter) {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        const tbody = document.querySelector('#training-table-container tbody');
        if (tbody && filtered.length > 0) {
            tbody.innerHTML = filtered.map(item => `
                <tr>
                    <td>${Utils.escapeHTML(item.name || '')}</td>
                    <td>${Utils.escapeHTML(item.trainer || '')}</td>
                    <td>${item.startDate ? Utils.formatDate(item.startDate) : '-'}</td>
                    <td>${this.getParticipantsCount(item)}</td>
                    <td>
                        <span class="badge badge-${item.status === 'مكتمل' ? 'success' : item.status === 'قيد التنيذ' ? 'info' : item.status === 'ملغي' ? 'danger' : 'warning'}">
                            ${item.status || '-'}
                        </span>
                    </td>
                    <td>
                        <div class="flex items-center gap-2">
                            <button onclick="Training.viewTraining('${item.id}')" class="btn-icon btn-icon-info">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="Training.editTraining('${item.id}')" class="btn-icon btn-icon-primary">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="Training.deleteTraining('${item.id}')" class="btn-icon btn-icon-danger">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    },

    async exportToExcel() {
        this.ensureData();
        try {
            Loading.show();

            // Check if SheetJS is available
            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث الصحة');
                return;
            }

            const trainings = AppState.appData.training || [];

            // Prepare data for Excel
            const excelData = trainings.map(training => {
                const participantsArr = this.getParticipantsArray(training);
                const participants = participantsArr.map(p => `${p.name || p.contractorName || ''} (${p.code || p.employeeNumber || p.employeeCode || ''})`).filter(Boolean).join('; ') || '';

                return {
                    'اسم البرنامج': training.name || '',
                    'المدرب': training.trainer || '',
                    'تاريخ البدء': training.startDate ? Utils.formatDate(training.startDate) : '',
                    'عدد المشاركين': this.getParticipantsCount(training),
                    'قائمة المشاركين': participants,
                    'الحالة': training.status || '',
                    'تاريخ الإنشاء': training.createdAt ? Utils.formatDate(training.createdAt) : ''
                };
            });

            // Create workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(excelData);

            // Set column widths
            ws['!cols'] = [
                { wch: 30 }, // اسم البرنامج
                { wch: 20 }, // المدرب
                { wch: 15 }, // تاريخ البدء
                { wch: 15 }, // عدد المشاركين
                { wch: 50 }, // قائمة المشاركين
                { wch: 15 }, // الحالة
                { wch: 15 }  // تاريخ الإنشاء
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'التدريبات');

            // Generate filename with date
            const date = new Date().toISOString().slice(0, 10);
            const filename = `سجل_التدريبات_${date}.xlsx`;

            // Export
            XLSX.writeFile(wb, filename);

            Loading.hide();
            Notification.success('تم تصدير سجل التدريبات بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ ي تصدير Excel:', error);
            Notification.error('شل تصدير Excel: ' + error.message);
        }
    },

    showTrainingReportDialog() {
        this.ensureData();
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const employees = (AppState.appData.employees || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const contractors = (AppState.appData.contractors || [])
            .filter(c => c && c.isActive !== 'inactive' && c.isActive !== false && c.isActive !== 'false' && c.isActive !== 'FALSE')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const topics = this.getAllTrainingTopics();

        const renderOptions = (items, getValue, getLabel) => {
            return items.map(item => `<option value="${Utils.escapeHTML(getValue(item))}">${Utils.escapeHTML(getLabel(item))}</option>`).join('');
        };

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-file-pdf ml-2"></i>
                        تقرير التدريب (PDF)
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar-alt ml-2"></i>
                                من تاريخ
                            </label>
                            <input type="date" id="training-report-start-date" class="form-input">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-calendar-alt ml-2"></i>
                                إلى تاريخ
                            </label>
                            <input type="date" id="training-report-end-date" class="form-input">
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-users ml-2"></i>
                                الموظفون
                                <span class="text-xs text-gray-500 block">يمكن اختيار أكثر من موظف</span>
                            </label>
                            <select id="training-report-employees" class="form-input" multiple size="6">
                                ${renderOptions(employees, emp => emp.employeeNumber || emp.sapId || '', emp => `${emp.name || 'بدون اسم'}${emp.employeeNumber ? ' - ' + emp.employeeNumber : ''}`)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">
                                <i class="fas fa-people-arrows ml-2"></i>
                                المقاولون / الشركات الخارجية
                                <span class="text-xs text-gray-500 block">اختياري</span>
                            </label>
                            <select id="training-report-contractors" class="form-input" multiple size="6">
                                ${renderOptions(contractors, contractor => contractor.id || contractor.code || contractor.name || '', contractor => contractor.name || contractor.company || '—')}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-book-open ml-2"></i>
                            الموضوعات التدريبية
                            <span class="text-xs text-gray-500 block">حدد الموضوعات المطلوب تضمينها (اختياري)</span>
                        </label>
                        <select id="training-report-topics" class="form-input" multiple size="6">
                            ${topics.map(topic => `<option value="${Utils.escapeHTML(topic)}">${Utils.escapeHTML(topic)}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                        <i class="fas fa-info-circle ml-2"></i>
                        في حال ترك أي حقل فارغ، سيتم تضمين جميع القيم الخاصة به في التقرير (جميع الموظفين، جميع الموضوعات، …إلخ).
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                    <button type="button" class="btn-primary" id="generate-training-report-btn">
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

        modal.querySelector('#generate-training-report-btn')?.addEventListener('click', async () => {
            const filters = {
                startDate: modal.querySelector('#training-report-start-date')?.value || '',
                endDate: modal.querySelector('#training-report-end-date')?.value || '',
                employees: this.getSelectedOptions('training-report-employees'),
                contractors: this.getSelectedOptions('training-report-contractors'),
                topics: this.getSelectedOptions('training-report-topics')
            };

            if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
                Notification.warning('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
                return;
            }

            close();
            await this.generateTrainingPDFReport(filters);
        });
    },

    getSelectedOptions(selectId) {
        const select = document.getElementById(selectId);
        if (!select) return [];
        return Array.from(select.selectedOptions || []).map(option => option.value).filter(Boolean);
    },

    getAllTrainingTopics() {
        this.ensureData();
        const topics = new Set();
        const trainings = AppState.appData.training || [];
        trainings.forEach(training => {
            if (Array.isArray(training.topics)) {
                training.topics.forEach(topic => topic && topics.add(topic));
            }
            if (training.name) {
                topics.add(training.name);
            }
            if (training.subject) {
                topics.add(training.subject);
            }
        });
        const topicsByRole = AppState.appData.trainingTopicsByRole || {};
        Object.values(topicsByRole).forEach(topicList => {
            (topicList || []).forEach(item => item.topic && topics.add(item.topic));
        });
        return Array.from(topics).sort((a, b) => a.localeCompare(b));
    },

    async generateTrainingPDFReport(filters = {}) {
        this.ensureData();
        try {
            Loading.show();
            // ✅ تعريف isAdmin في بداية الدالة
            const isAdmin = this.isCurrentUserAdmin();
            const trainings = AppState.appData.training || [];
            const filteredTrainings = this.filterTrainingsForReport(trainings, filters);

            const totalPrograms = filteredTrainings.length;
            const totalParticipants = filteredTrainings.reduce((acc, training) => acc + this.getParticipantsCount(training), 0);
            const uniqueParticipants = new Set();
            filteredTrainings.forEach(training => {
                const participants = Array.isArray(training.participants) ? training.participants : [];
                participants.forEach(participant => {
                    if (participant?.code) uniqueParticipants.add(participant.code);
                    else if (participant?.name) uniqueParticipants.add(`${participant.name}-${participant.company || ''}`);
                });
            });

            const filtersSummary = this.renderTrainingReportFiltersSummary(filters);
            const rowsHtml = filteredTrainings.map((training, index) => this.renderTrainingReportRow(training, index + 1)).join('');
            const participantsBlocks = filteredTrainings.map(training => this.renderTrainingReportParticipantsBlock(training)).join('');

            const content = `
                <div style="margin-bottom: 24px;">
                    <h2 style="font-size: 20px; margin-bottom: 12px;">ملخص التقرير</h2>
                    ${filtersSummary}
                    <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px;">
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #EFF6FF; border: 1px solid #BFDBFE;">
                            <div style="font-size: 12px; color: #1D4ED8; margin-bottom: 6px;">عدد البرامج</div>
                            <div style="font-size: 24px; font-weight: 700; color: #1E3A8A;">${totalPrograms}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #ECFDF5; border: 1px solid #BBF7D0;">
                            <div style="font-size: 12px; color: #047857; margin-bottom: 6px;">إجمالي المشاركين</div>
                            <div style="font-size: 24px; font-weight: 700; color: #065F46;">${totalParticipants}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #FEF3C7; border: 1px solid #FCD34D;">
                            <div style="font-size: 12px; color: #B45309; margin-bottom: 6px;">المشاركون المميزون</div>
                            <div style="font-size: 24px; font-weight: 700; color: #92400E;">${uniqueParticipants.size}</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 24px;">
                    <h2 style="font-size: 20px; margin-bottom: 12px;">جدول البرامج التدريبية</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #1E3A8A; color: #FFFFFF;">
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: center;">#</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: right;">اسم البرنامج</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: right;">التاريخ</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: right;">المدرب</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: right;">النوع</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: right;">المكان</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: center;">عدد المشاركين</th>
                                <th style="padding: 10px; border: 1px solid #E5E7EB; text-align: right;">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || `<tr><td colspan="8" style="padding: 16px; border: 1px solid #E5E7EB; text-align: center; color: #6B7280;">لا توجد برامج مطابقة للمعايير المحددة</td></tr>`}
                        </tbody>
                    </table>
                </div>
                
                ${participantsBlocks}
            `;

            const formCode = `TRAINING-REPORT-${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(formCode, 'تقرير التدريب', content, false, true, { filters }, filters.startDate || '', filters.endDate || '')
                : `<html><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const reportWindow = window.open(url, '_blank');

            if (reportWindow) {
                reportWindow.onload = () => {
                    try {
                        reportWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (error) {
                        Utils.safeError('تعذر طباعة التقرير تلقائياً:', error);
                    }
                };
            } else {
                Notification.info('تم إنشاء التقرير. يرجى السماح للنوافذ المنبثقة لعرضه.');
            }

            Loading.hide();
            Notification.success('تم إنشاء تقرير التدريب بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في إنشاء تقرير التدريب:', error);
            Notification.error('تعذر إنشاء تقرير التدريب: ' + error.message);
        }
    },

    filterTrainingsForReport(trainings, filters) {
        const startDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00') : null;
        const endDate = filters.endDate ? new Date(filters.endDate + 'T23:59:59') : null;
        const selectedEmployees = new Set(filters.employees || []);
        const selectedContractors = new Set(filters.contractors || []);
        const selectedTopics = new Set((filters.topics || []).map(topic => topic.toLowerCase()));

        return trainings.filter(training => {
            const trainingDate = training.startDate || training.date || training.createdAt;
            const dateObj = trainingDate ? new Date(trainingDate) : null;
            if (startDate && dateObj && dateObj < startDate) return false;
            if (endDate && dateObj && dateObj > endDate) return false;

            if (selectedTopics.size) {
                const trainingTopics = new Set();
                if (Array.isArray(training.topics)) {
                    training.topics.forEach(topic => topic && trainingTopics.add(topic.toLowerCase()));
                }
                if (training.name) trainingTopics.add(training.name.toLowerCase());
                if (training.subject) trainingTopics.add(training.subject.toLowerCase());

                const hasTopic = Array.from(selectedTopics).some(topic => trainingTopics.has(topic));
                if (!hasTopic) return false;
            }

            const participants = Array.isArray(training.participants) ? training.participants : [];
            if (selectedEmployees.size) {
                const hasEmployee = participants.some(participant => {
                    const codes = [
                        participant.code,
                        participant.employeeNumber,
                        participant.employeeCode,
                        participant.sapId
                    ].filter(Boolean);
                    return codes.some(code => selectedEmployees.has(String(code)));
                });
                if (!hasEmployee) return false;
            }

            if (selectedContractors.size) {
                const hasContractor = participants.some(participant => {
                    if ((participant.type || participant.personType) === 'contractor') {
                        const identifiers = [
                            participant.company,
                            participant.contractorCompany,
                            participant.contractorName,
                            participant.contractorId,
                            participant.id
                        ].filter(Boolean);
                        return identifiers.some(identifier => selectedContractors.has(String(identifier)));
                    }
                    return false;
                });
                if (!hasContractor) return false;
            }

            return true;
        });
    },

    renderTrainingReportFiltersSummary(filters) {
        const summaryItems = [];
        if (filters.startDate || filters.endDate) {
            summaryItems.push(`<div>الفترة: ${filters.startDate ? Utils.formatDate(filters.startDate) : '—'} إلى ${filters.endDate ? Utils.formatDate(filters.endDate) : '—'}</div>`);
        }
        if ((filters.employees || []).length) {
            summaryItems.push(`<div>عدد الموظفين المحددين: ${(filters.employees || []).length}</div>`);
        }
        if ((filters.contractors || []).length) {
            summaryItems.push(`<div>عدد الجهات المتعاقدة المحددة: ${(filters.contractors || []).length}</div>`);
        }
        if ((filters.topics || []).length) {
            summaryItems.push(`<div>الموضوعات: ${(filters.topics || []).map(topic => Utils.escapeHTML(topic)).join('، ')}</div>`);
        }

        if (!summaryItems.length) {
            return `<div style="padding: 12px 16px; border-radius: 8px; background: #F9FAFB; border: 1px solid #E5E7EB; color: #374151; font-size: 14px;">
                تم تضمين جميع البيانات دون تصفية محددة.
            </div>`;
        }

        return `<div style="padding: 12px 16px; border-radius: 8px; background: #F9FAFB; border: 1px solid #E5E7EB; color: #374151; font-size: 14px;">
            ${summaryItems.join('')}
        </div>`;
    },

    renderTrainingReportRow(training, index) {
        const participantsCount = this.getParticipantsCount(training);
        const statusText = training.status === 'قيد التنيذ' ? 'قيد التنفيذ' : (training.status || '-');
        let locationDisplay = training.locationName || training.location || '—';
        if (!training.locationName && training.location && training.factory) {
            locationDisplay = this.getPlaceName(training.location, training.factory) || training.location || '—';
        }
        return `
            <tr style="${index % 2 === 0 ? 'background: #F9FAFB;' : ''}">
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB; text-align: center;">${index}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB;">${Utils.escapeHTML(training.name || training.subject || '—')}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB;">${training.startDate ? Utils.formatDate(training.startDate) : (training.date ? Utils.formatDate(training.date) : '—')}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB;">${Utils.escapeHTML(training.trainer || '—')}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB;">${Utils.escapeHTML(training.trainingType || 'داخلي')}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB;">${Utils.escapeHTML(locationDisplay)}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB; text-align: center;">${participantsCount}</td>
                <td style="padding: 8px 10px; border: 1px solid #E5E7EB;">${Utils.escapeHTML(statusText)}</td>
            </tr>
        `;
    },

    renderTrainingReportParticipantsBlock(training) {
        const participants = this.getParticipantsArray(training);
        const programName = training.name || training.subject || '—';
        const count = this.getParticipantsCount(training);

        if (participants.length === 0) {
            if (count > 0) {
                return `
                    <div style="page-break-inside: avoid; margin-bottom: 24px;">
                        <h3 style="font-size: 18px; margin-bottom: 8px; color:#1E3A8A;">كشف المتدربين — ${Utils.escapeHTML(programName)}</h3>
                        <p style="padding: 12px; color: #6B7280; margin: 0;">عدد المسجلين: ${count} — قائمة الأسماء غير متوفرة في هذه النسخة.</p>
                    </div>
                `;
            }
            return '';
        }

        const participantsList = participants.map(participant => {
            const participantType = participant.type === 'contractor' || participant.personType === 'contractor'
                ? '<span style="color:#B45309;">مقاول</span>'
                : '<span style="color:#1D4ED8;">موظف</span>';
            const companyLabel = participant.company || participant.contractorCompany || '';
            const topicTags = (participant.topics || []).map(topic => `<span style="display:inline-block; background:#DBEAFE; color:#1D4ED8; padding:2px 8px; border-radius:12px; font-size:11px; margin-left:4px;">${Utils.escapeHTML(topic)}</span>`).join('');
            const name = participant.name || participant.contractorName || '—';
            const code = participant.code || participant.employeeNumber || participant.employeeCode || '';

            return `
                <li style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB;">
                    <strong>${Utils.escapeHTML(name)}</strong>
                    <span style="color:#6B7280;">${code ? ' • ' + Utils.escapeHTML(code) : ''}</span>
                    <span style="margin-right: 8px;">${participantType}</span>
                    ${companyLabel ? `<span style="margin-right: 8px; color:#0F766E;">${Utils.escapeHTML(companyLabel)}</span>` : ''}
                    ${participant.position ? `<span style="margin-right: 8px; color:#2563EB;">${Utils.escapeHTML(participant.position)}</span>` : ''}
                    ${topicTags}
                </li>
            `;
        }).join('');

        return `
            <div style="page-break-inside: avoid; margin-bottom: 24px;">
                <h3 style="font-size: 18px; margin-bottom: 8px; color:#1E3A8A;">كشف المتدربين — ${Utils.escapeHTML(programName)}</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${participantsList}
                </ul>
            </div>
        `;
    },

    async viewTraining(id) {
        this.ensureData();
        const training = AppState.appData.training.find(t => t.id === id);
        if (!training) {
            Notification.error('البرنامج غير موجود');
            return;
        }

        // الحصول على اسم المصنع
        let factoryName = training.factoryName || '';
        if (!factoryName && training.factory) {
            const sites = this.getSiteOptions();
            const site = sites.find(s => s.id === training.factory);
            factoryName = site ? site.name : training.factory;
        }

        // الحصول على اسم المكان
        let locationName = training.locationName || '';
        if (!locationName && training.location) {
            locationName = this.getPlaceName(training.location, training.factory);
        }

        // الحصول على نوع التدريب
        const trainingType = training.trainingType || 'داخلي';
        const trainingTypeLabel = trainingType === 'خارجي' ? 'خارجي' : 'داخلي';

        // تنسيق الأوقات — تطابق كامل مع البيانات المعزولة
        const startTimeRaw = training.startTime != null && String(training.startTime).trim() !== '';
        const endTimeRaw = training.endTime != null && String(training.endTime).trim() !== '';
        const startTime = startTimeRaw ? (this.cleanTime(training.startTime) || String(training.startTime).trim()) : '-';
        const endTime = endTimeRaw ? (this.cleanTime(training.endTime) || String(training.endTime).trim()) : '-';
        const hours = training.hours != null && String(training.hours).trim() !== '' ? training.hours : '-';

        // الحالة
        const status = training.status || '';
        const statusBadge = status === 'مكتمل' ? 'success' : /تنفي/.test(status) ? 'info' : status === 'ملغي' ? 'danger' : 'warning';
        const statusDisplay = status === 'قيد التنيذ' ? 'قيد التنفيذ' : status;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-graduation-cap ml-2"></i>
                        تفاصيل البرنامج: ${Utils.escapeHTML(training.name || '')}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="p-3 rounded-lg" style="background: #EFF6FF; border-right: 4px solid #3B82F6;">
                            <label class="text-sm font-semibold block mb-1" style="color: #1D4ED8;">المدرب:</label>
                            <p class="text-gray-800">${Utils.escapeHTML(training.trainer || '-')}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #EFF6FF; border-right: 4px solid #3B82F6;">
                            <label class="text-sm font-semibold block mb-1" style="color: #1D4ED8;">نوع التدريب:</label>
                            <span class="badge badge-${trainingType === 'خارجي' ? 'warning' : 'info'}">${Utils.escapeHTML(trainingTypeLabel)}</span>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #ECFDF5; border-right: 4px solid #10B981;">
                            <label class="text-sm font-semibold block mb-1" style="color: #047857;">تاريخ البدء:</label>
                            <p class="text-gray-800">${training.startDate ? Utils.formatDate(training.startDate) : '-'}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #ECFDF5; border-right: 4px solid #10B981;">
                            <label class="text-sm font-semibold block mb-1" style="color: #047857;">الحالة:</label>
                            <span class="badge badge-${statusBadge}">${Utils.escapeHTML(statusDisplay || '-')}</span>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #FFFBEB; border-right: 4px solid #F59E0B;">
                            <label class="text-sm font-semibold block mb-1" style="color: #B45309;">المصنع:</label>
                            <p class="text-gray-800">${Utils.escapeHTML(factoryName || '-')}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #FFFBEB; border-right: 4px solid #F59E0B;">
                            <label class="text-sm font-semibold block mb-1" style="color: #B45309;">مكان التدريب:</label>
                            <p class="text-gray-800"><i class="fas fa-map-marker-alt ml-1 text-gray-400"></i> ${Utils.escapeHTML(locationName || '-')}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #F5F3FF; border-right: 4px solid #8B5CF6;">
                            <label class="text-sm font-semibold block mb-1" style="color: #6D28D9;">وقت البدء:</label>
                            <p class="text-gray-800 font-medium">${Utils.escapeHTML(startTime)}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #F5F3FF; border-right: 4px solid #8B5CF6;">
                            <label class="text-sm font-semibold block mb-1" style="color: #6D28D9;">وقت الانتهاء:</label>
                            <p class="text-gray-800 font-medium">${Utils.escapeHTML(endTime)}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #FFF1F2; border-right: 4px solid #E11D48;">
                            <label class="text-sm font-semibold block mb-1" style="color: #BE123C;">عدد المشاركين:</label>
                            <p class="text-gray-800">${this.getParticipantsCount(training)}</p>
                        </div>
                        <div class="p-3 rounded-lg" style="background: #FFF1F2; border-right: 4px solid #E11D48;">
                            <label class="text-sm font-semibold block mb-1" style="color: #BE123C;">ساعات التدريب:</label>
                            <p class="text-gray-800">${Utils.escapeHTML(hours)} ${hours !== '-' ? 'ساعة' : ''}</p>
                        </div>
                    </div>
                    ${Array.isArray(training.participants) && training.participants.length > 0 ? (() => {
                        const participants = training.participants;
                        const hasCompany = participants.some(p => p.company || p.contractorCompany);
                        const hasType = participants.some(p => p.type === 'contractor' || p.personType === 'contractor');
                        return `
                        <div class="mt-4">
                            <label class="text-sm font-semibold text-gray-600 mb-2 block">قائمة المشاركين:</label>
                            <div class="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b border-gray-300">
                                            <th class="text-right p-2 font-semibold text-gray-700">#</th>
                                            <th class="text-right p-2 font-semibold text-gray-700">الاسم</th>
                                            <th class="text-right p-2 font-semibold text-gray-700">الكود</th>
                                            <th class="text-right p-2 font-semibold text-gray-700">الوظيفة</th>
                                            <th class="text-right p-2 font-semibold text-gray-700">القسم</th>
                                            ${hasCompany ? '<th class="text-right p-2 font-semibold text-gray-700">الشركة</th>' : ''}
                                            ${hasType ? '<th class="text-right p-2 font-semibold text-gray-700">النوع</th>' : ''}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${participants.map((p, idx) => {
                                            const isContractor = p.type === 'contractor' || p.personType === 'contractor';
                                            return `
                                            <tr class="border-b border-gray-200 hover:bg-gray-100">
                                                <td class="p-2 text-center">${idx + 1}</td>
                                                <td class="p-2">${Utils.escapeHTML(p.name || p.contractorName || '')}</td>
                                                <td class="p-2">${Utils.escapeHTML(p.code || p.employeeNumber || p.employeeCode || '-')}</td>
                                                <td class="p-2">${Utils.escapeHTML(p.position || '-')}</td>
                                                <td class="p-2">${Utils.escapeHTML(p.department || '-')}</td>
                                                ${hasCompany ? `<td class="p-2">${Utils.escapeHTML(p.company || p.contractorCompany || '-')}</td>` : ''}
                                                ${hasType ? `<td class="p-2"><span class="badge badge-${isContractor ? 'warning' : 'info'}">${isContractor ? 'مقاول' : 'موظف'}</span></td>` : ''}
                                            </tr>
                                        `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                    })() : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button type="button" class="btn-secondary" onclick="Training.printTraining('${training.id}'); this.closest('.modal-overlay').remove();" style="display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fas fa-print"></i>
                        الطباعة
                    </button>
                    <button class="btn-primary" onclick="Training.editTraining('${training.id}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تعديل
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    async showForm(data = null) {
        this.ensureData();
        if (typeof Permissions !== 'undefined' && Permissions.ensureFormSettingsState) {
            try { await Permissions.ensureFormSettingsState(); } catch (e) { /* ignore */ }
        }
        this.currentEditId = data?.id || null;
        const content = document.getElementById('training-content');
        if (!content) {
            Utils.safeError(' عنصر training-content غير موجود');
            Notification.error('حدث خطأ ي تحميل النموذج');
            return;
        }
        Utils.safeLog('✅ تم العثور على training-content، عرض النموذج');
        content.innerHTML = await this.renderForm(data);
        this.initializeFormInteractions();
        this.setupEventListeners();
        const participants = Array.isArray(data?.participants) ? data.participants : [];
        this.loadExistingParticipants(participants);
    },

    async showList() {
        this.ensureData();
        this.currentEditId = null;
        const content = document.getElementById('training-content');
        if (content) {
            content.innerHTML = await this.renderList();
            this.setupEventListeners();
            this.loadTrainingList();
        }
    },

    async renderForm(data = null) {
        const safetyTeamTrainers = this.getSafetyTeamMembers({ excludeSystemUsers: true });
        const selectedTrainerName = String(data?.trainer || '').trim();
        const selectedTrainerExists = safetyTeamTrainers.some(member => member.name === selectedTrainerName);
        const selectedTrainerLegacyOption = selectedTrainerName && !selectedTrainerExists
            ? `<option value="${Utils.escapeHTML(selectedTrainerName)}" selected>${Utils.escapeHTML(selectedTrainerName)}</option>`
            : '';
        return `
            <div class="content-card" style="box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <div class="card-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                    <h2 class="card-title" style="color: white; margin: 0; flex: 1; min-width: 220px;">
                        <i class="fas fa-${data ? 'edit' : 'clipboard-check'} ml-2"></i>
                        ${data ? 'تعديل نموذج حضور تدريب' : 'نموذج حضور تدريب'}
                    </h2>
                    <button type="button" id="training-form-back-btn" class="btn-secondary" title="العودة إلى قائمة البرامج" style="background: rgba(255,255,255,0.18); color:#fff; border:1px solid rgba(255,255,255,0.4); padding: 0.55rem 1.1rem; border-radius:8px; font-weight:600; display:inline-flex; align-items:center; gap:8px; cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.28)'" onmouseout="this.style.background='rgba(255,255,255,0.18)'">
                        <i class="fas fa-arrow-right"></i>
                        العودة
                    </button>
                </div>
                <div class="card-body" style="padding: 2rem;">
                    <form id="training-form" class="space-y-6">
                        <!-- بيانات التدريب الأساسية -->
                        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 mb-6 shadow-sm">
                            <div class="flex items-center gap-3 mb-5">
                                <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-clipboard-list text-white text-lg"></i>
                                </div>
                                <h3 class="text-xl font-bold text-gray-800" style="margin: 0;">
                                    بيانات التدريب الأساسية
                                </h3>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-tag ml-2 text-blue-600"></i>
                                        نوع التدريب *
                                    </label>
                                    <select id="training-type" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                        <option value="">اختر نوع التدريب</option>
                                        <option value="داخلي" ${data?.trainingType === 'داخلي' || (!data?.trainingType && !data) ? 'selected' : ''}>داخلي</option>
                                        <option value="خارجي" ${data?.trainingType === 'خارجي' ? 'selected' : ''}>خارجي</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-calendar ml-2 text-blue-600"></i>
                                        التاريخ *
                                    </label>
                                    <input type="date" id="training-startDate" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        value="${data?.startDate ? new Date(data.startDate).toISOString().slice(0, 10) : ''}"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-industry ml-2 text-blue-600"></i>
                                        المصنع *
                                    </label>
                                    <select id="training-factory" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                        <option value="">اختر المصنع</option>
                                        ${this.getSiteOptions().map(site => `
                                            <option value="${Utils.escapeHTML(site.id)}" ${data?.factory === site.id || data?.factory === site.name ? 'selected' : ''}>${Utils.escapeHTML(site.name)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-map-marker-alt ml-2 text-blue-600"></i>
                                        مكان التدريب *
                                    </label>
                                    <select id="training-location" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                        <option value="">اختر مكان التدريب</option>
                                        ${this.getPlaceOptions(data?.factory || '').map(place => `
                                            <option value="${Utils.escapeHTML(place.id)}" ${data?.location === place.id || data?.location === place.name ? 'selected' : ''}>${Utils.escapeHTML(place.name)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-book-open ml-2 text-blue-600"></i>
                                        موضوع المحاضرة *
                                    </label>
                                    <input type="text" id="training-name" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        value="${data?.name || ''}" placeholder="أدخل موضوع المحاضرة"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-chalkboard-teacher ml-2 text-blue-600"></i>
                                        اسم المحاضر *
                                    </label>
                                    <select id="training-trainer" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                        <option value="">اختر اسم المحاضر</option>
                                        ${selectedTrainerLegacyOption}
                                        ${safetyTeamTrainers.map(member => `
                                            <option value="${Utils.escapeHTML(member.name)}" ${member.name === selectedTrainerName ? 'selected' : ''}>
                                                ${Utils.escapeHTML(member.name)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-clock ml-2 text-blue-600"></i>
                                        وقت البدء *
                                    </label>
                                    <input type="time" id="training-startTime" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        value="${data?.startTime ? this.cleanTime(data.startTime) : ''}"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-clock ml-2 text-blue-600"></i>
                                        وقت الانتهاء *
                                    </label>
                                    <input type="time" id="training-endTime" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        value="${data?.endTime ? this.cleanTime(data.endTime) : ''}"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                                        <i class="fas fa-check-circle ml-2 text-blue-600"></i>
                                        حالة البرنامج *
                                    </label>
                                    <select id="training-status" required class="form-input" style="border: 2px solid #e5e7eb; transition: all 0.3s;"
                                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                                        <option value="مخطط" ${data?.status === 'مخطط' || !data?.status ? 'selected' : ''}>مخطط</option>
                                        <option value="قيد التنفيذ" ${data?.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
                                        <option value="مكتمل" ${data?.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                        <option value="ملغي" ${data?.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- جدول المشاركين -->
                        <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-sm">
                            <div class="flex items-center gap-3 mb-5">
                                <div class="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-users text-white text-lg"></i>
                                </div>
                                <h3 class="text-xl font-bold text-gray-800" style="margin: 0;">
                                    إدارة المشاركين
                                </h3>
                            </div>
                            <div class="space-y-4">
                                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">نوع المشارك *</label>
                                        <select id="training-participant-type" class="form-input">
                                            <option value="employee" selected>موظف</option>
                                            <option value="contractor">مقاول / عمالة خارجية</option>
                                        </select>
                                    </div>
                                    <div id="training-participant-code-wrapper" class="md:col-span-2">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الكود الوظيفي</label>
                                        <div class="relative">
                                            <input type="text" id="training-participant-code" class="form-input pr-10" placeholder="أدخل الكود أو امسح الباركود" autocomplete="off">
                                            <button type="button" id="training-participant-search-btn" class="absolute inset-y-0 left-0 flex items-center justify-center w-10 text-gray-500 hover:text-gray-700" title="بحث">
                                                <i class="fas fa-search"></i>
                                            </button>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-1" id="training-participant-code-hint">
                                            سيتم تعبئة بيانات الموظف تلقائياً في حال وجوده بقاعدة البيانات.
                                        </p>
                                    </div>
                                    <div id="training-participant-company-container" style="display: none;">
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الشركة / الجهة *</label>
                                        <input type="text" id="training-participant-company" class="form-input" placeholder="أدخل اسم الشركة أو المقاول">
                                    </div>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">اسم المشارك *</label>
                                        <input type="text" id="training-participant-name" class="form-input" placeholder="أدخل الاسم بالكامل" autocomplete="off">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                                        <input type="text" id="training-participant-position" class="form-input" placeholder="يتم تعبئتها تلقائياً عند اختيار الموظف">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-2">القسم/الإدارة</label>
                                        <input type="text" id="training-participant-department" class="form-input" placeholder="يتم تعبئتها تلقائياً عند اختيار الموظف">
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 mb-4">
                                    <button type="button" id="clear-participant-btn" class="btn-secondary">
                                        <i class="fas fa-eraser ml-2"></i>مسح الحقول
                                    </button>
                                    <span class="text-xs text-gray-500">
                                        يمكن تعديل البيانات قبل الإضافة. لن يتم تكرار نفس المشارك أكثر من مرة.
                                    </span>
                                </div>

                                <div class="overflow-x-auto mb-4">
                                    <table class="data-table w-full">
                                        <thead>
                                            <tr>
                                                <th>الكود الوظيفي</th>
                                                <th>اسم المشارك</th>
                                                <th>النوع</th>
                                                <th>الشركة / الجهة</th>
                                                <th>الوظيفة</th>
                                                <th>القسم/الإدارة</th>
                                                <th>الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody id="training-participants-table-body">
                                            <tr class="participants-empty-row">
                                                <td colspan="7" class="text-center text-gray-500 py-4">لا يوجد مشاركين</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                
                                <div class="flex flex-wrap items-center gap-2 pt-4 border-t border-green-200">
                                    <button type="button" id="add-participant-btn" class="btn-primary" style="padding: 0.75rem 1.5rem; font-weight: 600; border-radius: 8px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
                                        <i class="fas fa-user-plus ml-2"></i>إضافة للمشاركين
                                    </button>
                                    <span class="text-sm text-gray-600 font-medium" id="participants-count-display">
                                        عدد المشاركين: <span id="participants-count-number">0</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- أزرار الإجراءات -->
                        <div class="flex items-center justify-end gap-4 pt-6 mt-6 border-t-2 border-gray-200 flex-wrap">
                            <button type="button" id="training-form-print-btn" class="btn-secondary" style="padding: 0.875rem 2rem; font-weight: 600; border-radius: 8px; border: 2px solid #6366f1; color: #4338ca;">
                                <i class="fas fa-print ml-2"></i>
                                طباعة / PDF
                            </button>
                            <button type="button" onclick="Training.showList()" class="btn-secondary" style="padding: 0.875rem 2rem; font-weight: 600; border-radius: 8px;">
                                <i class="fas fa-times ml-2"></i>
                                إلغاء
                            </button>
                            <button type="submit" class="btn-primary" style="padding: 0.875rem 2rem; font-weight: 600; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); box-shadow: 0 4px 6px -1px rgba(102, 126, 234, 0.3);">
                                <i class="fas fa-save ml-2"></i>
                                ${data ? 'حفظ التعديلات' : 'إضافة البرنامج'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    initializeFormInteractions() {
        const module = this;
        const codeInput = document.getElementById('training-participant-code');
        const nameInput = document.getElementById('training-participant-name');
        const positionInput = document.getElementById('training-participant-position');
        const departmentInput = document.getElementById('training-participant-department');
        const typeSelect = document.getElementById('training-participant-type');
        const companyContainer = document.getElementById('training-participant-company-container');
        const companyInput = document.getElementById('training-participant-company');
        const codeHint = document.getElementById('training-participant-code-hint');
        const addBtn = document.getElementById('add-participant-btn');
        const clearBtn = document.getElementById('clear-participant-btn');
        const searchBtn = document.getElementById('training-participant-search-btn');
        
        // ربط المصنع بمكان التدريب
        const factorySelect = document.getElementById('training-factory');
        const locationSelect = document.getElementById('training-location');
        
        if (factorySelect && locationSelect) {
            factorySelect.addEventListener('change', function() {
                const factoryId = this.value;
                const places = module.getPlaceOptions(factoryId);
                
                // مسح الخيارات الحالية
                locationSelect.innerHTML = '<option value="">اختر مكان التدريب</option>';
                
                // إضافة الأماكن الجديدة
                places.forEach(place => {
                    const option = document.createElement('option');
                    option.value = place.id;
                    option.textContent = place.name;
                    locationSelect.appendChild(option);
                });
            });
        }

        const updateTypeUI = (focusCompany = false) => {
            const typeValue = typeSelect?.value || 'employee';
            const isEmployee = typeValue === 'employee';

            if (codeInput) {
                codeInput.disabled = false;
                codeInput.readOnly = false;
                codeInput.placeholder = isEmployee
                    ? 'أدخل الكود أو امسح الباركود'
                    : 'رقم / معرف (اختياري)';
            }

            if (searchBtn) {
                searchBtn.style.display = isEmployee ? 'flex' : 'none';
            }

            if (companyContainer) {
                companyContainer.style.display = isEmployee ? 'none' : 'block';
            }

            if (companyInput) {
                companyInput.required = !isEmployee;
                if (!isEmployee && focusCompany) {
                    companyInput.focus();
                }
            }

            if (codeHint) {
                codeHint.textContent = isEmployee
                    ? 'سيتم تعبئة بيانات الموظف تلقائياً في حال وجوده بقاعدة البيانات.'
                    : 'يمكن إدخال بيانات المشاركين من المقاولين أو العمالة الخارجية يدوياً.';
            }
        };

        module.updateParticipantTypeUI = (focusCompany = false) => updateTypeUI(focusCompany);

        if (typeSelect) {
            typeSelect.addEventListener('change', () => updateTypeUI(true));
            updateTypeUI(false);
        } else {
            updateTypeUI(false);
        }

        const handleEmployeeSelection = (employee) => {
            if (!employee) return;
            if (typeSelect && typeSelect.value !== 'employee') return;
            module.handleParticipantEmployee(employee);
        };

        if (typeof EmployeeHelper !== 'undefined') {
            if (typeof EmployeeHelper.setupEmployeeCodeSearch === 'function') {
                EmployeeHelper.setupEmployeeCodeSearch(
                    'training-participant-code',
                    'training-participant-name',
                    handleEmployeeSelection
                );
            }
            if (typeof EmployeeHelper.setupAutocomplete === 'function') {
                EmployeeHelper.setupAutocomplete('training-participant-name', handleEmployeeSelection);
            }
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const typeValue = typeSelect?.value || 'employee';
                const codeValue = codeInput?.value.trim();
                if (typeValue !== 'employee') {
                    Notification.info('البحث متاح للموظفين فقط. يرجى إدخال بيانات المقاول يدوياً.');
                    return;
                }
                if (codeValue) {
                    module.lookupEmployeeByCode(codeValue);
                } else {
                    Notification.info('يرجى إدخال الكود الوظيفي للبحث');
                }
            });
        }

        if (addBtn) {
            addBtn.addEventListener('click', () => module.addParticipantFromInputs());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => module.clearParticipantInputs());
        }

        [codeInput, nameInput, positionInput, departmentInput, companyInput].forEach(input => {
            if (input) {
                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        module.addParticipantFromInputs();
                    }
                });
            }
        });

        module.updateParticipantsCount();
    },

    loadExistingParticipants(participants = []) {
        const tableBody = document.getElementById('training-participants-table-body');
        if (!tableBody) return;

        if (!Array.isArray(participants) || participants.length === 0) {
            tableBody.innerHTML = `
                <tr class="participants-empty-row">
                    <td colspan="7" class="text-center text-gray-500 py-4">لا يوجد مشاركين</td>
                </tr>
            `;
            this.updateParticipantsCount();
            return;
        }

        tableBody.innerHTML = '';
        participants.forEach(participant => {
            const rawCode = participant.code || participant.employeeNumber || '';
            const code = rawCode || this.generateParticipantCode(participant.name || participant.company || '');
            const employees = AppState.appData.employees || [];
            const employeeRecord = employees.find(e => (e.employeeNumber || e.sapId) === code);
            const participantType = participant.type === 'contractor' || participant.personType === 'contractor'
                ? 'contractor'
                : 'employee';
            const companyValue = participant.company || participant.contractorCompany || participant.contractorName || '';
            this.appendParticipantRow({
                code,
                name: participant.name || employeeRecord?.name || '',
                position: participant.position || employeeRecord?.position || '',
                department: participant.department || employeeRecord?.department || '',
                type: participantType,
                company: participantType === 'contractor' ? companyValue : ''
            }, { updateCount: false, silent: true });
        });
        this.updateParticipantsCount();
    },

    getParticipantInputValues() {
        const codeInput = document.getElementById('training-participant-code');
        const nameInput = document.getElementById('training-participant-name');
        const positionInput = document.getElementById('training-participant-position');
        const departmentInput = document.getElementById('training-participant-department');
        const typeSelect = document.getElementById('training-participant-type');
        const companyInput = document.getElementById('training-participant-company');

        return {
            code: codeInput?.value.trim() || '',
            name: nameInput?.value.trim() || '',
            position: positionInput?.value.trim() || '',
            department: departmentInput?.value.trim() || '',
            type: typeSelect?.value === 'contractor' ? 'contractor' : 'employee',
            company: companyInput?.value.trim() || ''
        };
    },

    clearParticipantInputs() {
        const fields = [
            'training-participant-code',
            'training-participant-name',
            'training-participant-position',
            'training-participant-department',
            'training-participant-company'
        ];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        const typeSelect = document.getElementById('training-participant-type');
        if (typeSelect) {
            typeSelect.value = 'employee';
        }
        this.updateParticipantTypeUI?.();
        const codeInput = document.getElementById('training-participant-code');
        if (codeInput) codeInput.focus();
    },

    handleParticipantEmployee(employee, autoAdd = false) {
        if (!employee) return;
        const codeInput = document.getElementById('training-participant-code');
        const nameInput = document.getElementById('training-participant-name');
        const positionInput = document.getElementById('training-participant-position');
        const departmentInput = document.getElementById('training-participant-department');
        const typeSelect = document.getElementById('training-participant-type');
        const companyInput = document.getElementById('training-participant-company');

        if (typeSelect) {
            typeSelect.value = 'employee';
            this.updateParticipantTypeUI?.();
        }

        if (codeInput) codeInput.value = employee.employeeNumber || employee.sapId || '';
        if (nameInput) nameInput.value = employee.name || '';
        if (positionInput) positionInput.value = employee.position || employee.jobTitle || '';
        if (departmentInput) departmentInput.value = employee.department || employee.unit || '';
        if (companyInput) companyInput.value = '';

        if (autoAdd) {
            this.addParticipantFromInputs();
        }
    },

    generateParticipantCode(seed = '') {
        const normalized = seed ? seed.replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-]/g, '').toUpperCase().slice(0, 8) : 'MANUAL';
        const uniquePart = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${normalized || 'MANUAL'}-${uniquePart}`;
    },

    lookupEmployeeByCode(code) {
        const searchTerm = String(code || '').trim();
        if (!searchTerm) {
            Notification.info('يرجى إدخال الكود الوظيفي للبحث');
            return;
        }
        let employee = null;
        if (typeof EmployeeHelper !== 'undefined' && typeof EmployeeHelper.findByTerm === 'function') {
            employee = EmployeeHelper.findByTerm(searchTerm);
        } else {
            const employees = AppState.appData.employees || [];
            const normalized = searchTerm.toLowerCase();
            employee = employees.find(emp => (emp.employeeNumber || emp.sapId || '').toLowerCase() === normalized) || null;
        }
        if (employee) {
            this.handleParticipantEmployee(employee);
            Notification.success('تم جلب بيانات المشارك من قاعدة الموظفين');
        } else {
            Notification.warning('لم يتم العثور على موظف بهذا الكود. يمكنك إدخال البيانات يدوياً.');
        }
    },

    lookupEmployeeByName(name) {
        const normalized = String(name || '').trim().toLowerCase();
        if (!normalized) {
            Notification.info('يرجى إدخال اسم المشارك للبحث');
            return;
        }
        let matches = [];
        if (typeof EmployeeHelper !== 'undefined' && typeof EmployeeHelper.findMatches === 'function') {
            matches = EmployeeHelper.findMatches(normalized, 5);
        } else {
            const employees = AppState.appData.employees || [];
            matches = employees.filter(emp => (emp.name || '').toLowerCase().includes(normalized));
        }

        if (matches.length === 1) {
            this.handleParticipantEmployee(matches[0]);
            Notification.success('تم جلب بيانات المشارك من قاعدة الموظفين');
        } else if (matches.length > 1) {
            Notification.info('تم العثور على أكثر من نتيجة. يرجى تحديد الكود بدقة.');
        } else {
            Notification.warning('لا توجد نتائج مطابقة. يمكنك إدخال البيانات يدوياً.');
        }
    },

    addParticipantFromInputs() {
        const participant = this.getParticipantInputValues();
        const isContractor = participant.type === 'contractor';

        if (!participant.name) {
            Notification.warning('يرجى إدخال اسم المشارك');
            const nameInput = document.getElementById('training-participant-name');
            nameInput?.focus();
            return;
        }

        if (isContractor && !participant.company) {
            Notification.warning('يرجى إدخال اسم الشركة أو الجهة للمشارك');
            const companyInput = document.getElementById('training-participant-company');
            companyInput?.focus();
            return;
        }

        if (!participant.code) {
            participant.code = this.generateParticipantCode(participant.name || participant.company || '');
            Notification.info(`تم إنشاء رقم مؤقت للمشارك: ${participant.code}`);
        }

        if (!isContractor) {
            participant.company = '';
        }

        const added = this.appendParticipantRow(participant);
        if (added) {
            this.clearParticipantInputs();
            Notification.success('تم إضافة المشارك إلى البرنامج التدريبي');
        }
    },

    appendParticipantRow(participant, options = {}) {
        const tableBody = document.getElementById('training-participants-table-body');
        if (!tableBody) {
            Notification.error('عنصر جدول المشاركين غير موجود');
            return false;
        }

        const updateCount = options.updateCount !== false;
        const silent = options.silent === true;

        const code = String(participant.code || '').trim();
        const name = String(participant.name || '').trim();
        const position = String(participant.position || '').trim();
        const department = String(participant.department || '').trim();
        const type = participant.type === 'contractor' ? 'contractor' : 'employee';
        const company = type === 'contractor' ? String(participant.company || '').trim() : '';
        const typeLabel = type === 'contractor' ? 'مقاول / عمالة خارجية' : 'موظف';
        const typeBadge = type === 'contractor' ? 'badge-warning' : 'badge-info';

        const exists = Array.from(tableBody.querySelectorAll('tr[data-code]'))
            .some(row => row.dataset.code === code);
        if (exists) {
            if (!silent) {
                Notification.warning('تمت إضافة هذا المشارك مسبقاً');
            }
            return false;
        }

        const row = document.createElement('tr');
        row.dataset.code = code;
        row.dataset.name = name;
        row.dataset.position = position;
        row.dataset.department = department;
        row.dataset.type = type;
        row.dataset.company = company;
        row.innerHTML = `
            <td>${Utils.escapeHTML(code)}</td>
            <td>${Utils.escapeHTML(name || '-')}</td>
            <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
            <td>${Utils.escapeHTML(type === 'contractor' ? (company || '-') : '-')}</td>
            <td>${Utils.escapeHTML(position || '-')}</td>
            <td>${Utils.escapeHTML(department || '-')}</td>
            <td>
                <div class="flex items-center gap-2 justify-center">
                    <button type="button" onclick="Training.editParticipantFromRow(this)" class="btn-icon btn-icon-warning" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="Training.removeParticipantRow(this)" class="btn-icon btn-icon-danger" title="حذف">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;

        const emptyRow = tableBody.querySelector('.participants-empty-row');
        if (emptyRow) emptyRow.remove();

        tableBody.appendChild(row);

        if (updateCount) {
            this.updateParticipantsCount();
        }

        return true;
    },

    editParticipantFromRow(button) {
        const row = button.closest('tr');
        if (!row) return;

        const codeInput = document.getElementById('training-participant-code');
        const nameInput = document.getElementById('training-participant-name');
        const positionInput = document.getElementById('training-participant-position');
        const departmentInput = document.getElementById('training-participant-department');
        const typeSelect = document.getElementById('training-participant-type');
        const companyInput = document.getElementById('training-participant-company');

        if (codeInput) codeInput.value = row.dataset.code || '';
        if (nameInput) nameInput.value = row.dataset.name || '';
        if (positionInput) positionInput.value = row.dataset.position || '';
        if (departmentInput) departmentInput.value = row.dataset.department || '';
        if (typeSelect) {
            typeSelect.value = row.dataset.type === 'contractor' ? 'contractor' : 'employee';
            this.updateParticipantTypeUI?.(typeSelect.value === 'contractor');
        }
        if (companyInput) {
            companyInput.value = row.dataset.type === 'contractor' ? (row.dataset.company || '') : '';
        }

        row.remove();
        this.updateParticipantsCount();

        codeInput?.focus();
    },

    selectEmployee(code) {
        if (!code) {
            Notification.warning('يرجى إدخال الكود الوظيفي الصحيح');
            return;
        }
        this.lookupEmployeeByCode(code);
    },

    updateParticipantsCount() {
        const tableBody = document.getElementById('training-participants-table-body');
        const countInput = document.getElementById('training-participants');
        const countDisplay = document.getElementById('participants-count-number');
        
        if (!tableBody) return;

        const rows = tableBody.querySelectorAll('tr[data-code]');
        const count = rows.length;
        
        if (countInput) {
            countInput.value = count;
        }
        
        if (countDisplay) {
            countDisplay.textContent = count;
        }

        let emptyRow = tableBody.querySelector('.participants-empty-row');
        if (count === 0) {
            if (!emptyRow) {
                emptyRow = document.createElement('tr');
                emptyRow.className = 'participants-empty-row';
                emptyRow.innerHTML = `<td colspan="7" class="text-center text-gray-500 py-4">لا يوجد مشاركين</td>`;
                tableBody.appendChild(emptyRow);
            }
        } else if (emptyRow) {
            emptyRow.remove();
        }
    },

    removeParticipantRow(button) {
        const row = button.closest('tr');
        if (row) {
            row.remove();
            this.updateParticipantsCount();
        }
    },

    syncEmployeeTrainingMatrix(training) {
        this.ensureData();
        if (!AppState.appData.employeeTrainingMatrix || typeof AppState.appData.employeeTrainingMatrix !== 'object') {
            AppState.appData.employeeTrainingMatrix = {};
        }
        const matrix = AppState.appData.employeeTrainingMatrix;

        Object.keys(matrix).forEach(code => {
            matrix[code] = (matrix[code] || []).filter(entry => entry.trainingId !== training.id);
            if (matrix[code].length === 0) {
                delete matrix[code];
            }
        });

        const participants = Array.isArray(training.participants) ? training.participants : [];
        participants.forEach(participant => {
            const code = participant.code || participant.employeeNumber || '';
            if (!code) return;
            if (!matrix[code]) {
                matrix[code] = [];
            }
            matrix[code].push({
                trainingId: training.id,
                trainingName: training.name,
                trainingDate: training.startDate,
                trainingType: training.trainingType,
                status: training.status,
                completed: training.status === 'مكتمل',
                hours: parseFloat(training.hours) || 0,
                trainer: training.trainer || '',
                location: training.location || '',
                topics: Array.isArray(training.topics) ? training.topics : (training.name ? [training.name] : [])
            });
        });
    },

    async handleSubmit(e) {
        this.ensureData();
        e.preventDefault();

        // منع النقر المتكرر
        const submitBtn = e.target?.querySelector('button[type="submit"]') || 
                         document.querySelector('#training-form button[type="submit"]') ||
                         e.target?.closest('form')?.querySelector('button[type="submit"]');
        
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

        // جمع قائمة المشاركين من الجدول مع جميع البيانات
        const participants = [];
        const tableBody = document.getElementById('training-participants-table-body');
        if (tableBody) {
            tableBody.querySelectorAll('tr[data-code]').forEach(row => {
                const code = row.getAttribute('data-code');
                const name = row.getAttribute('data-name');
                const position = row.getAttribute('data-position') || '';
                const department = row.getAttribute('data-department') || '';
                const type = row.getAttribute('data-type') || 'employee';
                const company = row.getAttribute('data-company') || '';
                const emp = (AppState.appData.employees || []).find(e => (e.employeeNumber || e.sapId) === code);

                participants.push({
                    name: name,
                    code: code,
                    employeeNumber: code,
                    employeeCode: code,
                    position: position || emp?.position || '',
                    department: department || emp?.department || '',
                    workLocation: emp?.workLocation || emp?.location || '',
                    type: type,
                    personType: type,
                    company: company || emp?.company || '',
                    contractorCompany: type === 'contractor' ? (company || '') : undefined,
                    contractorName: type === 'contractor' ? (name || '') : undefined
                });
            });
        }

        if (participants.length === 0) {
            Notification.error('يرجى إضافة مشارك واحد على الأقل');
            // استعادة الزر عند فشل التحقق
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            return;
        }

        // حساب ساعات التدريب من الوقت
        let trainingHours = 0;
        const startTime = document.getElementById('training-startTime')?.value;
        const endTime = document.getElementById('training-endTime')?.value;
        if (startTime && endTime) {
            try {
                const start = new Date(`2000-01-01T${startTime}:00`);
                const end = new Date(`2000-01-01T${endTime}:00`);
                if (end <= start) {
                    Notification.error('وقت نهاية التدريب يجب أن يكون بعد وقت البداية');
                    // استعادة الزر عند فشل التحقق
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                    return;
                }
                trainingHours = (end - start) / (1000 * 60 * 60); // تحويل إلى ساعات
            } catch (e) {
                Notification.error('تعذر حساب مدة التدريب. يرجى التحقق من الأوقات المدخلة');
                // استعادة الزر عند فشل التحقق
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
                return;
            }
        }

        const trainingId = this.currentEditId || Utils.generateId('TRAINING');
        const nameEl = document.getElementById('training-name');
        const trainerEl = document.getElementById('training-trainer');
        const typeEl = document.getElementById('training-type');
        const statusEl = document.getElementById('training-status');
        const startDateEl = document.getElementById('training-startDate');
        const locationEl = document.getElementById('training-location');
        const factoryEl = document.getElementById('training-factory');
        
        if (!nameEl || !trainerEl || !typeEl || !statusEl || !startDateEl || !locationEl || !factoryEl) {
            Notification.error('بعض الحقول المطلوبة غير موجودة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
            return;
        }
        
        // الحصول على أسماء المصنع ومكان التدريب
        const sites = this.getSiteOptions();
        const selectedFactory = sites.find(s => s.id === factoryEl.value);
        const places = this.getPlaceOptions(factoryEl.value);
        const selectedPlace = places.find(p => p.id === locationEl.value);
        
        const formData = {
            id: trainingId,
            name: nameEl.value.trim(),
            trainer: trainerEl.value.trim(),
            trainingType: typeEl.value || 'داخلي', // نوع التدريب (داخلي/خارجي)
            date: document.getElementById('training-date')?.value || startDateEl.value,
            factory: factoryEl.value,
            factoryName: selectedFactory ? selectedFactory.name : '',
            location: locationEl.value,
            locationName: selectedPlace ? selectedPlace.name : '',
            startTime: this.cleanTime(startTime) || '',
            endTime: this.cleanTime(endTime) || '',
            hours: trainingHours > 0 ? trainingHours.toFixed(2) : '',
            startDate: new Date(startDateEl.value).toISOString(),
            participants: participants,
            participantsCount: participants.length || parseInt(document.getElementById('training-participants')?.value) || 0,
            status: statusEl.value || 'مخطط',
            createdAt: this.currentEditId ? AppState.appData.training.find(t => t.id === this.currentEditId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            // 1. حفظ البيانات فوراً في الذاكرة
            if (this.currentEditId) {
                const index = AppState.appData.training.findIndex(t => t.id === this.currentEditId);
                if (index !== -1) {
                    AppState.appData.training[index] = formData;
                    Notification.success('تم تحديث البرنامج التدريبي بنجاح');
                }
            } else {
                AppState.appData.training.push(formData);
                Notification.success('تم إضافة البرنامج التدريبي بنجاح');
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }

            // 2. إغلاق النموذج فوراً بعد الحفظ في الذاكرة
            this.showList();
            
            // 3. استعادة الزر بعد النجاح
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
            
            // 4. معالجة المهام الخلفية في الخلفية
            Promise.allSettled([
                // مزامنة مصفوفة التدريب
                Promise.resolve().then(() => this.syncEmployeeTrainingMatrix(formData)),
                // مزامنة سجل التدريب للموظفين
                Promise.resolve().then(() => this.syncAttendanceRegistry(formData)),
                // حفظ في Google Sheets
                GoogleIntegration.autoSave('Training', AppState.appData.training),
                GoogleIntegration.autoSave('EmployeeTrainingMatrix', AppState.appData.employeeTrainingMatrix),
                // حفظ سجل الحضور الناتج عن البرنامج التدريبي
                (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave)
                    ? GoogleIntegration.autoSave('TrainingAttendance', AppState.appData.trainingAttendance)
                    : Promise.resolve()
            ]).catch(error => {
                Utils.safeError('خطأ في معالجة المهام الخلفية:', error);
            });
        } catch (error) {
            Notification.error('حدث خطأ: ' + error.message);
            
            // استعادة الزر في حالة الخطأ
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    },

    async editTraining(id) {
        this.currentEditId = id;
        const item = AppState.appData.training.find(i => i.id === id);
        if (item) await this.showForm(item);
    },

    async deleteTraining(id) {
        if (!confirm('هل أنت متأكد من حذف هذا البرنامج؟\n\nهذه العملية لا يمكن التراجع عنها.')) return;
        Loading.show();
        try {
            // حذف من البيانات المحلية أولاً
            AppState.appData.training = AppState.appData.training.filter(i => i.id !== id);
            
            // حفظ البيانات المحلية باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                await window.DataManager.save();
            } else {
                Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
            }
            
            // حذف من Google Sheets إذا كان مفعلاً
            if (AppState.googleConfig?.appsScript?.enabled) {
                try {
                    const result = await GoogleIntegration.sendToAppsScript('deleteTraining', { 
                        trainingId: id,
                        id: id 
                    });
                    
                    if (result && result.success === false) {
                        throw new Error(result.message || 'فشل حذف البرنامج من قاعدة البيانات');
                    }
                    
                    // مسح الـ cache بعد الحذف الناجح
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.clearCache) {
                        GoogleIntegration.clearCache('Training');
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ فشل حذف البرنامج من Google Sheets، سيتم المحاولة لاحقاً:', error);
                    // محاولة الحفظ التلقائي كبديل
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                        await GoogleIntegration.autoSave('Training', AppState.appData.training).catch(err => {
                            Utils.safeWarn('⚠️ فشل حفظ التعديلات في Google Sheets:', err);
                        });
                    }
                }
            } else {
                // إذا لم يكن Google Sheets مفعلاً، استخدم autoSave فقط
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    await GoogleIntegration.autoSave('Training', AppState.appData.training).catch(err => {
                        Utils.safeWarn('⚠️ فشل حفظ التعديلات في Google Sheets:', err);
                    });
                }
            }
            
            Loading.hide();
            Notification.success('تم حذف البرنامج بنجاح');
            this.loadTrainingList();
        } catch (error) {
            Loading.hide();
            Notification.error('حدث خطأ: ' + error.message);
            Utils.safeError('خطأ في حذف البرنامج:', error);
            // إعادة تحميل القائمة لعرض الحالة الصحيحة
            this.loadTrainingList();
        }
    },

    /**
     * طباعة/حفظ PDF مع هيدر وفوتر النظام (FormHeader / PDFTemplates).
     */
    _openTrainingAttendancePrint(innerHtml, options = {}) {
        const {
            formCode = 'TRN-ATT',
            docTitle = 'نموذج حضور تدريب',
            createdAt = new Date().toISOString(),
            updatedAt = null,
            meta = {},
            successMessage = 'تم تجهيز نموذج الحضور للطباعة'
        } = options;

        const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
            ? FormHeader.generatePDFHTML(
                formCode,
                docTitle,
                innerHtml,
                false,
                true,
                Object.assign({ version: '1.0' }, meta),
                createdAt,
                updatedAt || createdAt
            )
            : `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${Utils.escapeHTML(docTitle)}</title></head><body>${innerHtml}</body></html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                try {
                    if (typeof requestAnimationFrame === 'function') {
                        requestAnimationFrame(() => printWindow.print());
                    } else {
                        printWindow.print();
                    }
                    const cleanup = () => {
                        try { URL.revokeObjectURL(url); } catch (e) {}
                        try { printWindow.removeEventListener('afterprint', cleanup); } catch (e) {}
                        Loading.hide();
                        Notification.success(successMessage);
                    };
                    printWindow.addEventListener('afterprint', cleanup);
                    setTimeout(cleanup, 1400);
                } catch (e) {
                    setTimeout(() => {
                        try { URL.revokeObjectURL(url); } catch (err) {}
                        Loading.hide();
                    }, 1400);
                }
            };
        } else {
            Loading.hide();
            Notification.error('يرجى السماح للنافذة المنبثقة لعرض التقرير');
        }
    },

    /**
     * تحويل سجل تدريب محفوظ إلى هيكل عرض نموذج الحضور للطباعة.
     */
    trainingRecordToAttendancePrintPayload(training) {
        let locationName = training.locationName || '';
        if (!locationName && training.location) {
            locationName = this.getPlaceName(training.location, training.factory);
        }
        let factoryName = training.factoryName || '';
        if (!factoryName && training.factory) {
            const sites = this.getSiteOptions();
            const site = sites.find(s => s.id === training.factory);
            factoryName = site ? site.name : training.factory;
        }
        const trainingDate = training.startDate ? Utils.formatDate(training.startDate) : (training.date ? Utils.formatDate(training.date) : '');
        const scientificSubject = (training.topics && Array.isArray(training.topics) ? training.topics.join('، ') : '') || '';
        const participants = this.getParticipantsArray(training).map((p) => {
            const isContractor = p.type === 'contractor' || p.personType === 'contractor';
            return {
                code: p.code || p.employeeNumber || p.employeeCode || '—',
                name: p.name || p.contractorName || '',
                typeLabel: isContractor ? 'مقاول / عمالة خارجية' : 'موظف',
                company: isContractor ? (p.company || p.contractorCompany || '—') : '—',
                position: p.position || p.jobTitle || '',
                department: p.department || ''
            };
        });
        return {
            isEdit: false,
            trainingType: training.trainingType || 'داخلي',
            trainingTypeDisplay: training.trainingType || 'داخلي',
            dateDisplay: trainingDate,
            factoryName: factoryName || '',
            locationName: locationName || '',
            topic: training.name || training.subject || '',
            trainer: training.trainer || '',
            startTime: this.cleanTime(training.startTime) || '',
            endTime: this.cleanTime(training.endTime) || '',
            status: training.status || 'مخطط',
            statusDisplay: training.status || 'مخطط',
            topicsScientific: scientificSubject,
            participants
        };
    },

    /**
     * قراءة نموذج الحضور الحالي من الواجهة (مسودة أو قبل الحفظ).
     */
    collectAttendanceFormDraftFromDOM() {
        const typeEl = document.getElementById('training-type');
        const trainingType = typeEl?.value || 'داخلي';
        const trainingTypeDisplay = typeEl?.selectedOptions?.[0]?.textContent?.trim() || trainingType;

        const startDateEl = document.getElementById('training-startDate');
        const dateRaw = startDateEl?.value;
        const dateDisplay = dateRaw ? Utils.formatDate(new Date(dateRaw).toISOString()) : '';

        const factoryName = document.getElementById('training-factory')?.selectedOptions?.[0]?.textContent?.trim() || '';
        const locationName = document.getElementById('training-location')?.selectedOptions?.[0]?.textContent?.trim() || '';

        const topic = document.getElementById('training-name')?.value?.trim() || '';
        const trainerEl = document.getElementById('training-trainer');
        const trainer = (trainerEl?.value || trainerEl?.selectedOptions?.[0]?.textContent || '').trim();

        const startTime = this.cleanTime(document.getElementById('training-startTime')?.value || '') || '';
        const endTime = this.cleanTime(document.getElementById('training-endTime')?.value || '') || '';

        const statusEl = document.getElementById('training-status');
        const status = statusEl?.value || '';
        const statusDisplay = statusEl?.selectedOptions?.[0]?.textContent?.trim() || status;

        const participants = [];
        const tableBody = document.getElementById('training-participants-table-body');
        if (tableBody) {
            tableBody.querySelectorAll('tr[data-code]').forEach((row) => {
                const code = row.getAttribute('data-code') || '';
                const name = row.getAttribute('data-name') || '';
                const type = row.getAttribute('data-type') || 'employee';
                const company = row.getAttribute('data-company') || '';
                const position = row.getAttribute('data-position') || '';
                const department = row.getAttribute('data-department') || '';
                const isContractor = type === 'contractor';
                participants.push({
                    code: code || '—',
                    name,
                    typeLabel: isContractor ? 'مقاول / عمالة خارجية' : 'موظف',
                    company: isContractor ? (company || '—') : '—',
                    position,
                    department
                });
            });
        }

        return {
            isEdit: !!this.currentEditId,
            trainingType,
            trainingTypeDisplay,
            dateDisplay,
            factoryName,
            locationName,
            topic,
            trainer,
            startTime,
            endTime,
            status,
            statusDisplay,
            topicsScientific: '',
            participants
        };
    },

    /**
     * HTML نموذج حضور التدريب بنفس أقسام الواجهة (أنماط مضمّنة للطباعة).
     */
    buildTrainingAttendanceFormPrintHTML(payload) {
        const esc = (s) => Utils.escapeHTML(String(s ?? ''));
        const title = payload.isEdit ? 'تعديل نموذج حضور تدريب' : 'نموذج حضور تدريب';
        const sectionTitleStyle = 'margin:0;font-size:1.05rem;font-weight:700;color:#1f2937;display:flex;align-items:center;gap:10px';
        const iconBox = (bg) => `width:40px;height:40px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0`;
        const fieldLabel = 'font-size:0.8rem;font-weight:600;color:#4b5563;margin:0 0 6px 0';
        const fieldBox = 'background:#f9fafb;border:2px solid #e5e7eb;border-radius:10px;padding:10px 12px;font-size:0.95rem;color:#111827;min-height:22px';

        const participantsRows = (payload.participants && payload.participants.length)
            ? payload.participants.map((p, i) => `
                <tr>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:center;font-size:0.85rem">${i + 1}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:center;font-size:0.85rem">${esc(p.code)}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:right;font-size:0.85rem">${esc(p.name)}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:right;font-size:0.85rem">${esc(p.typeLabel)}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:right;font-size:0.85rem">${esc(p.company)}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:right;font-size:0.85rem">${esc(p.position)}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;text-align:right;font-size:0.85rem">${esc(p.department)}</td>
                    <td style="border:1px solid #d1d5db;padding:10px 8px;min-width:72px">&nbsp;</td>
                </tr>`).join('')
            : '<tr><td colspan="8" style="border:1px solid #d1d5db;padding:16px;text-align:center;color:#6b7280">لا يوجد مشاركين في القائمة</td></tr>';

        const scientificBlock = payload.topicsScientific
            ? `<div style="grid-column:1/-1;margin-top:4px"><p style="${fieldLabel}">المادة العلمية / الموضوعات</p><div style="${fieldBox}">${esc(payload.topicsScientific)}</div></div>`
            : '';

        return `
<div class="training-attendance-print-root" style="font-family:'Cairo','Segoe UI',Tahoma,sans-serif;direction:rtl;text-align:right;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact">
  <div style="border-radius:14px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.08);border:1px solid #e5e7eb">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:1.35rem 1.5rem">
      <h1 style="margin:0;font-size:1.35rem;font-weight:700;color:#fff;display:flex;align-items:center;gap:12px">
        <span style="${iconBox('rgba(255,255,255,0.25)')}"><span style="display:block;width:10px;height:10px;background:#fff;border-radius:2px;opacity:0.95"></span></span>
        ${esc(title)}
      </h1>
    </div>
    <div style="padding:1.5rem 1.5rem 1.75rem;background:#fff">
      <div style="background:linear-gradient(135deg,#eff6ff 0%,#eef2ff 100%);border:2px solid #bfdbfe;border-radius:14px;padding:1.35rem 1.25rem;margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.1rem;padding-bottom:0.65rem;border-bottom:2px solid rgba(191,219,254,0.7)">
          <div style="${iconBox('#2563eb')}"><span style="display:block;width:10px;height:10px;background:#fff;border-radius:2px;opacity:0.95"></span></div>
          <h2 style="${sectionTitleStyle}">بيانات التدريب الأساسية</h2>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px">
          <div><p style="${fieldLabel}">نوع التدريب</p><div style="${fieldBox}">${esc(payload.trainingTypeDisplay || payload.trainingType)}</div></div>
          <div><p style="${fieldLabel}">التاريخ</p><div style="${fieldBox}">${esc(payload.dateDisplay)}</div></div>
          <div><p style="${fieldLabel}">المصنع</p><div style="${fieldBox}">${esc(payload.factoryName)}</div></div>
          <div><p style="${fieldLabel}">مكان التدريب</p><div style="${fieldBox}">${esc(payload.locationName)}</div></div>
          <div style="grid-column:1/-1"><p style="${fieldLabel}">موضوع المحاضرة</p><div style="${fieldBox}">${esc(payload.topic)}</div></div>
          <div><p style="${fieldLabel}">اسم المحاضر</p><div style="${fieldBox}">${esc(payload.trainer)}</div></div>
          <div><p style="${fieldLabel}">وقت البدء</p><div style="${fieldBox}">${esc(payload.startTime)}</div></div>
          <div><p style="${fieldLabel}">وقت الانتهاء</p><div style="${fieldBox}">${esc(payload.endTime)}</div></div>
          <div><p style="${fieldLabel}">حالة البرنامج</p><div style="${fieldBox}">${esc(payload.statusDisplay || payload.status)}</div></div>
          ${scientificBlock}
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:2px solid #a7f3d0;border-radius:14px;padding:1.35rem 1.25rem">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;padding-bottom:0.65rem;border-bottom:2px solid rgba(167,243,208,0.8)">
          <div style="${iconBox('#059669')}"><span style="display:block;width:10px;height:10px;background:#fff;border-radius:2px;opacity:0.95"></span></div>
          <h2 style="${sectionTitleStyle}">قائمة المشاركين (${esc(String((payload.participants || []).length))})</h2>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
          <thead>
            <tr style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:#fff">
              <th style="border:1px solid #047857;padding:10px 6px;text-align:center;font-weight:600;width:40px">م</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:center;font-weight:600">الكود الوظيفي</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:right;font-weight:600">اسم المشارك</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:right;font-weight:600">النوع</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:right;font-weight:600">الشركة / الجهة</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:right;font-weight:600">الوظيفة</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:right;font-weight:600">القسم/الإدارة</th>
              <th style="border:1px solid #047857;padding:10px 6px;text-align:center;font-weight:600;width:80px">التوقيع</th>
            </tr>
          </thead>
          <tbody>${participantsRows}</tbody>
        </table>
        <p style="margin:1.25rem 0 0;font-size:0.95rem;color:#374151">توقيع المحاضر: ________________________________ ${esc(payload.trainer)}</p>
      </div>
    </div>
  </div>
</div>`;
    },

    /**
     * طباعة نموذج الحضور من الشاشة الحالية (قبل أو بعد الحفظ) مع هيدر/فوتر النظام.
     */
    printAttendanceFormFromScreen() {
        try {
            if (!document.getElementById('training-form')) {
                Notification.warning('افتح نموذج حضور التدريب أولاً');
                return;
            }
            Loading.show();
            const payload = this.collectAttendanceFormDraftFromDOM();
            const body = this.buildTrainingAttendanceFormPrintHTML(payload);
            const formCode = this.currentEditId
                ? `TRN-ATT-${String(this.currentEditId).substring(0, 8)}`
                : `TRN-ATT-DRAFT-${Date.now()}`;
            const docTitle = payload.topic ? `نموذج حضور تدريب — ${payload.topic}` : 'نموذج حضور تدريب';
            this._openTrainingAttendancePrint(body, {
                formCode,
                docTitle,
                meta: {
                    version: '1.0',
                    source: 'TrainingAttendanceForm',
                    releaseDate: new Date().toISOString(),
                    revisionDate: new Date().toISOString(),
                    qrData: {
                        type: 'TrainingAttendanceForm',
                        editId: this.currentEditId || null,
                        topic: payload.topic
                    }
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                successMessage: 'تم تجهيز نموذج الحضور للطباعة'
            });
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في طباعة نموذج الحضور:', error);
            Notification.error('حدث خطأ أثناء الطباعة: ' + (error?.message || ''));
        }
    },

    async printTraining(id) {
        this.ensureData();
        let training = AppState.appData.training.find(t => t.id === id);
        if (!training) {
            Notification.error('البرنامج غير موجود');
            return;
        }

        try {
            Loading.show();
            if (typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.sendRequest === 'function') {
                try {
                    const res = await GoogleIntegration.sendRequest({ action: 'getTraining', data: { trainingId: id } });
                    if (res && res.success && res.data) training = res.data;
                } catch (e) {
                    Utils.safeWarn('جلب تفاصيل البرنامج للطباعة:', e);
                }
            }

            const payload = this.trainingRecordToAttendancePrintPayload(training);
            const content = this.buildTrainingAttendanceFormPrintHTML(payload);

            const formCode = training.isoCode || `TRN-ATT-${training.id?.substring(0, 8) || 'UNKNOWN'}`;
            const docTitle = training.name ? `نموذج حضور تدريب — ${training.name}` : 'نموذج حضور تدريب';

            this._openTrainingAttendancePrint(content, {
                formCode,
                docTitle,
                meta: {
                    version: training.version || '1.0',
                    releaseDate: training.startDate || training.createdAt,
                    revisionDate: training.updatedAt || training.endDate || training.startDate,
                    qrData: {
                        type: 'Training',
                        id: training.id,
                        code: formCode,
                        name: training.name
                    }
                },
                createdAt: training.createdAt || training.startDate,
                updatedAt: training.updatedAt || training.endDate || training.createdAt,
                successMessage: 'تم تجهيز نموذج الحضور للطباعة'
            });
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في الطباعة:', error);
            Notification.error('حدث خطأ أثناء الطباعة: ' + error.message);
        }
    },

    async exportTraining(id) {
        this.ensureData();
        let training = AppState.appData.training.find(t => t.id === id);
        if (!training) {
            Notification.error('البرنامج غير موجود');
            return;
        }

        try {
            Loading.show();
            if (typeof GoogleIntegration !== 'undefined' && typeof GoogleIntegration.sendRequest === 'function') {
                try {
                    const res = await GoogleIntegration.sendRequest({ action: 'getTraining', data: { trainingId: id } });
                    if (res && res.success && res.data) training = res.data;
                } catch (e) {
                    Utils.safeWarn('جلب تفاصيل البرنامج للتصدير:', e);
                }
            }

            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث الصفحة');
                return;
            }

            // الحصول على اسم المكان
            let locationName = training.locationName || '';
            if (!locationName && training.location) {
                locationName = this.getPlaceName(training.location, training.factory);
            }
            
            // الحصول على اسم المصنع
            let factoryName = training.factoryName || '';
            if (!factoryName && training.factory) {
                const sites = this.getSiteOptions();
                const site = sites.find(s => s.id === training.factory);
                factoryName = site ? site.name : training.factory;
            }
            
            const participants = this.getParticipantsArray(training).map(p => {
                    const participantData = {
                        'اسم المشارك': p.name || p.contractorName || '',
                        'الكود': p.code || p.employeeNumber || p.employeeCode || '',
                        'الوظيفة': p.position || '',
                        'القسم': p.department || ''
                    };
                    if (p.company || p.contractorCompany) {
                        participantData['الشركة'] = p.company || p.contractorCompany || '';
                    }
                    if (p.type === 'contractor' || p.personType === 'contractor') {
                        participantData['النوع'] = 'مقاول';
                    } else {
                        participantData['النوع'] = 'موظف';
                    }
                    return participantData;
                });

            const excelData = [{
                'اسم البرنامج': training.name || '',
                'المدرب': training.trainer || '',
                'تاريخ البدء': training.startDate ? Utils.formatDate(training.startDate) : '',
                'نوع التدريب': training.trainingType || 'داخلي',
                'عدد المشاركين': this.getParticipantsCount(training),
                'الحالة': training.status || '',
                'المصنع': factoryName || '',
                'المكان': locationName || '',
                'وقت البدء': training.startTime || '',
                'وقت الانتهاء': training.endTime || '',
                'ساعات التدريب': training.hours || '',
                'تاريخ الإنشاء': training.createdAt ? Utils.formatDate(training.createdAt) : ''
            }];

            const wb = XLSX.utils.book_new();
            const ws1 = XLSX.utils.json_to_sheet(excelData);
            ws1['!cols'] = [
                { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
                { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }
            ];
            XLSX.utils.book_append_sheet(wb, ws1, 'بيانات البرنامج');

            if (participants.length > 0) {
                const ws2 = XLSX.utils.json_to_sheet(participants);
                ws2['!cols'] = [{ wch: 30 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(wb, ws2, 'المشاركون');
            }

            const date = new Date().toISOString().slice(0, 10);
            const filename = `برنامج_تدريبي_${Utils.escapeHTML(training.name || 'تدريب').replace(/[^\w\s]/g, '_')}_${date}.xlsx`;
            XLSX.writeFile(wb, filename);

            Loading.hide();
            Notification.success('تم تصدير البرنامج التدريبي بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في التصدير:', error);
            Notification.error('فشل التصدير: ' + error.message);
        }
    },

    async renderAnalysisTab() {
        // التحقق من صلاحيات المدير
        if (!this.isCurrentUserAdmin()) {
            return '<div class="content-card"><p class="text-center text-red-600 py-8">ليس لديك صلاحية للوصول إلى تحليل البيانات</p></div>';
        }
        
        this.ensureData();
        
        // تحميل الكروت المخصصة
        const cards = this.loadTrainingInfoCards();
        let metrics = this.calculateTrainingMetrics();
        
        // عرض الكروت المفعلة فقط
        const enabledCards = cards.filter(c => c.enabled !== false);
        
        // التأكد من أن metrics موجودة وصالحة
        if (!metrics || typeof metrics !== 'object') {
            Utils.safeWarn('⚠️ مقاييس التدريب غير صالحة، استخدام القيم الافتراضية');
            metrics = this.calculateTrainingMetrics();
        }
        
        const cardsHtml = enabledCards.map(card => {
            // الحصول على القيمة من metrics مع معالجة الأخطاء
            let value = metrics[card.metric];
            
            // معالجة القيم غير المعرفة أو الفارغة
            if (value === undefined || value === null) {
                value = 0;
            }
            
            // إذا كانت القيمة string فارغة، استبدالها بـ 0
            if (typeof value === 'string' && value.trim() === '') {
                value = 0;
            }
            
            // ✅ تنسيق القيم الرقمية للعرض بالأرقام الإنجليزية
            if (typeof value === 'number') {
                // للقيم الكبيرة، إضافة فاصلة للآلاف
                if (value >= 1000) {
                    value = value.toLocaleString('en-US');
                }
            }
            
            const colorClasses = {
                blue: 'bg-blue-100 text-blue-600',
                green: 'bg-green-100 text-green-600',
                purple: 'bg-purple-100 text-purple-600',
                amber: 'bg-amber-100 text-amber-600',
                red: 'bg-red-100 text-red-600',
                indigo: 'bg-indigo-100 text-indigo-600',
                teal: 'bg-teal-100 text-teal-600',
                orange: 'bg-orange-100 text-orange-600',
                pink: 'bg-pink-100 text-pink-600'
            };
            const colorClass = colorClasses[card.color] || 'bg-gray-100 text-gray-600';
            
            return `
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center shadow-sm">
                            <i class="${card.icon} text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-sm text-gray-500 mb-1">${Utils.escapeHTML(card.title)}</p>
                            <p class="text-2xl font-bold text-gray-900" dir="ltr">${Utils.escapeHTML(String(value))}</p>
                            ${card.description ? `<p class="text-xs text-gray-400 mt-1">${Utils.escapeHTML(card.description)}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <!-- فلتر فترة التحليل: الشهر أو من-إلى -->
            <div class="content-card mb-6">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-calendar-alt ml-2"></i>فترة التحليل</h3>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">نوع الفلتر</label>
                            <select id="training-analysis-filter-type" class="form-input w-full">
                                <option value="all">جميع البيانات</option>
                                <option value="month">شهر محدد</option>
                                <option value="range">فترة (من - إلى)</option>
                            </select>
                        </div>
                        <div id="training-analysis-month-wrap" style="display:none;">
                            <label class="block text-sm font-medium text-gray-700 mb-1">الشهر</label>
                            <select id="training-analysis-month" class="form-input w-full">
                                <option value="">اختر الشهر</option>
                                ${this.getAnalysisMonthOptions()}
                            </select>
                        </div>
                        <div id="training-analysis-date-from-wrap" style="display:none;">
                            <label class="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
                            <input type="date" id="training-analysis-date-from" class="form-input w-full">
                        </div>
                        <div id="training-analysis-date-to-wrap" style="display:none;">
                            <label class="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
                            <input type="date" id="training-analysis-date-to" class="form-input w-full">
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-2"><i class="fas fa-info-circle ml-1"></i>الكروت والرسوم البيانية أدناه تعتمد على الفترة المحددة.</p>
                </div>
            </div>

            <!-- تقارير المدربين والمتدربين + خيارات التصدير -->
            <div id="training-analysis-period-reports" class="content-card mb-6" style="border:1px solid #e0e7ff; box-shadow:0 8px 30px rgba(79,70,229,0.07);">
                <div class="card-header" style="background:linear-gradient(135deg,#eef2ff 0%,#f8fafc 55%,#ecfdf5 100%); border-bottom:1px solid #e0e7ff;">
                    <h3 class="card-title"><i class="fas fa-file-export ml-2 text-indigo-600"></i>تقارير التحليل والتصدير</h3>
                    <p class="text-sm text-gray-600 mt-1 max-w-4xl">حدّد فترة التصدير (أو اتبع فترة التحليل)، وفئة الأشخاص (موظف / مقاول / الكل)، واختر شخصاً أو مدرباً للتركيز. المعاينة والتصدير (Excel / PDF) يستخدمان نفس الخيارات. PDF يتضمن رسوماً بيانية إضافية عند اختيار شخص أو مدرب محدد.</p>
                </div>
                <div class="card-body">
                    <div id="training-export-options-panel" class="mb-8 p-5 rounded-2xl border border-indigo-100/80 bg-white shadow-sm" style="background:linear-gradient(180deg,#ffffff 0%,#fafbff 100%);">
                        <h4 class="text-base font-bold text-gray-800 mb-4 flex items-center gap-2"><i class="fas fa-sliders-h text-indigo-600"></i> خيارات الفلترة والتصدير</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-1">فترة التصدير</label>
                                <select id="training-export-period-mode" class="form-input w-full">
                                    <option value="follow">مطابقة فترة التحليل أعلاه</option>
                                    <option value="custom">فترة مخصصة (من — إلى)</option>
                                </select>
                            </div>
                            <div class="md:col-span-2 flex flex-wrap gap-3 items-end" id="training-export-custom-dates" style="display:none;">
                                <div class="flex-1 min-w-[140px]">
                                    <label class="block text-xs font-semibold text-gray-600 mb-1">من تاريخ</label>
                                    <input type="date" id="training-export-from" class="form-input w-full">
                                </div>
                                <div class="flex-1 min-w-[140px]">
                                    <label class="block text-xs font-semibold text-gray-600 mb-1">إلى تاريخ</label>
                                    <input type="date" id="training-export-to" class="form-input w-full">
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-1">سجل الحضور: الفئة</label>
                                <select id="training-export-audience" class="form-input w-full" title="تمييز المقاول/الخارجي عبر personType أو نوع التدريب">
                                    <option value="all">الكل</option>
                                    <option value="employee">موظفون</option>
                                    <option value="contractor">مقاولون / خارجيون</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-1">شخص محدد (سجل الحضور)</label>
                                <select id="training-export-person-key" class="form-input w-full">
                                    <option value="">— كل الأشخاص —</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 mb-1">مدرب محدد (البرامج)</label>
                                <select id="training-export-trainer-key" class="form-input w-full">
                                    <option value="">— كل المدربين —</option>
                                </select>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-3"><i class="fas fa-info-circle ml-1"></i> تُحدَّث القوائم عند تغيير الفترة أو الفئة. التغييرات تنعكس على الجداول أدناه تلقائياً.</p>
                    </div>
                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div class="rounded-2xl p-5 border border-indigo-100 bg-indigo-50/30 shadow-sm">
                            <h4 class="text-base font-bold text-gray-900 mb-3 flex items-center gap-2"><i class="fas fa-chalkboard-teacher text-indigo-600"></i> المدربون — عدد البرامج</h4>
                            <div class="flex flex-wrap items-end gap-3 mb-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">أقصى عدد في العرض والتصدير</label>
                                    <input type="number" id="training-analysis-trainer-limit" class="form-input" style="width:110px;" min="1" max="500" value="30">
                                </div>
                                <button type="button" id="training-analysis-export-trainers-open" class="btn-primary">
                                    <i class="fas fa-file-export ml-2"></i>تصدير تقرير المدربين
                                </button>
                            </div>
                            <div class="table-wrapper mb-4 rounded-xl border border-indigo-100/60 overflow-hidden" style="max-height:280px;">
                                <table class="data-table text-sm">
                                    <thead>
                                        <tr>
                                            <th>اسم المدرب</th>
                                            <th class="text-center">عدد البرامج</th>
                                            <th class="text-center">مجموع المشاركين</th>
                                            <th class="text-center">إجمالي ساعات التدريب</th>
                                        </tr>
                                    </thead>
                                    <tbody id="training-analysis-trainers-tbody">
                                        <tr><td colspan="4" class="text-center text-gray-500 py-6">—</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div id="training-analysis-trainers-chart-wrap" class="rounded-xl border border-indigo-100/50 bg-white p-2" style="position:relative;height:300px;">
                                <canvas id="training-analysis-trainers-chart"></canvas>
                            </div>
                        </div>
                        <div class="rounded-2xl p-5 border border-teal-100 bg-teal-50/30 shadow-sm">
                            <h4 class="text-base font-bold text-gray-900 mb-3 flex items-center gap-2"><i class="fas fa-user-friends text-teal-600"></i> الأشخاص — سجل الحضور</h4>
                            <div class="flex flex-wrap items-end gap-3 mb-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">أقصى عدد في العرض والتصدير</label>
                                    <input type="number" id="training-analysis-attendees-limit" class="form-input" style="width:110px;" min="1" max="2000" value="50">
                                </div>
                                <button type="button" id="training-analysis-export-attendees-open" class="btn-primary">
                                    <i class="fas fa-file-export ml-2"></i>تصدير تقرير المتدربين
                                </button>
                            </div>
                            <div class="table-wrapper mb-4 rounded-xl border border-teal-100/60 overflow-hidden" style="max-height:280px;">
                                <table class="data-table text-sm">
                                    <thead>
                                        <tr>
                                            <th>الشخص</th>
                                            <th class="text-center">الجلسات</th>
                                            <th class="text-center">الساعات</th>
                                        </tr>
                                    </thead>
                                    <tbody id="training-analysis-attendees-tbody">
                                        <tr><td colspan="3" class="text-center text-gray-500 py-6">—</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div id="training-analysis-attendees-chart-wrap" class="rounded-xl border border-teal-100/50 bg-white p-2" style="position:relative;height:300px;">
                                <canvas id="training-analysis-attendees-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- الكروت الإحصائية القابلة للتخصيص -->
            <div class="content-card mb-6">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h3 class="card-title"><i class="fas fa-chart-bar ml-2"></i>تحليل البيانات (قابل للتخصيص)</h3>
                        <button class="btn-primary" onclick="Training.showManageTrainingCardsModal()">
                            <i class="fas fa-cog ml-2"></i>إدارة الكروت
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="training-analysis-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${cardsHtml || '<p class="text-center text-gray-500 col-span-full">لا توجد كروت مفعلة</p>'}
                    </div>
                </div>
            </div>
            
            <!-- إعدادات التحليل -->
            <div class="content-card mb-6">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-cog ml-2"></i>
                        إعدادات التحليل
                    </h3>
                    <p class="text-sm text-gray-500 mt-2">أضف وعدل بنود التحليل والرسوم البيانية (مدير النظام فقط)</p>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium mb-2">اختر البنود للتحليل</label>
                            <div id="training-analysis-items-list" class="space-y-2 max-h-64 overflow-y-auto border rounded p-3">
                                <!-- سيتم ملؤها ديناميكياً -->
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">إضافة بند جديد</label>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <select id="training-new-analysis-dataset" class="form-input">
                                    <option value="training">برامج التدريب</option>
                                    <option value="contractorTrainings">تدريبات المقاولين</option>
                                    <option value="trainingAttendance">سجل الحضور</option>
                                </select>
                                <select id="training-new-analysis-field" class="form-input">
                                    <!-- سيتم ملؤها ديناميكياً -->
                                </select>
                                <div id="training-custom-field-wrap" class="md:col-span-2" style="display:none;">
                                    <input type="text" id="training-new-analysis-custom-field" class="form-input" placeholder="اسم الحقل (مثال: status / trainingType)">
                                </div>
                                <input type="text" id="training-new-analysis-label" class="form-input md:col-span-2" placeholder="اسم البند (مثال: البرامج حسب الحالة)">
                                <select id="training-new-analysis-charttype" class="form-input">
                                    <option value="auto">تلقائي</option>
                                    <option value="bar">Bar</option>
                                    <option value="doughnut">Doughnut</option>
                                    <option value="pie">Pie</option>
                                    <option value="line">Line</option>
                                </select>
                                <button id="training-add-analysis-item-btn" class="btn-primary">
                                    <i class="fas fa-plus ml-2"></i>
                                    إضافة
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle ml-1"></i>
                                اختر المجموعة والحقل، أو استخدم "حقل مخصص" لتحليل أي بيانات موجودة داخل سجلات التدريب.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- نتائج التحليل والرسوم البيانية -->
            <div id="training-analysis-results" class="content-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-chart-bar ml-2"></i>
                        نتائج التحليل والرسوم البيانية
                    </h3>
                </div>
                <div class="card-body">
                    <div class="empty-state">
                        <p class="text-gray-500">قم بتفعيل/إضافة بنود للتحليل لعرض النتائج.</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    loadTrainingInfoCards() {
        const keys = this.getTrainingAnalysisStorageKeys();
        const raw = localStorage.getItem(keys.cards) || '[]';
        let cards = [];
        
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                cards = parsed;
            } else {
                throw new Error('بيانات الكروت غير صالحة');
            }
        } catch (e) {
            Utils.safeWarn('⚠️ خطأ في تحميل كروت التدريب من localStorage، استخدام القيم الافتراضية:', e);
            cards = [];
        }
        
        // إذا كانت القائمة فارغة أو غير صالحة، استخدام القيم الافتراضية
        if (!Array.isArray(cards) || cards.length === 0) {
            cards = this.getTrainingDefaultAnalysisCards();
            try {
                localStorage.setItem(keys.cards, JSON.stringify(cards));
            } catch (e) {
                Utils.safeWarn('⚠️ فشل حفظ كروت التدريب الافتراضية في localStorage:', e);
            }
        }
        
        // التأكد من أن جميع الكروت لديها الخصائص المطلوبة
        cards = cards.map(card => {
            // إذا كان الكارت يفتقد خاصية enabled، افتراض true
            if (card.enabled === undefined) {
                card.enabled = true;
            }
            // التأكد من وجود جميع الخصائص المطلوبة
            return {
                id: card.id || `card_${Date.now()}_${Math.random()}`,
                title: card.title || 'بدون عنوان',
                icon: card.icon || 'fas fa-info-circle',
                color: card.color || 'blue',
                description: card.description || '',
                enabled: card.enabled !== false,
                mode: card.mode || 'metric',
                metric: card.metric || ''
            };
        });
        
        return cards;
    },
    
    calculateTrainingMetrics() {
        this.ensureData();
        const filter = this.getAnalysisDateFilter();
        let trainings = Array.isArray(AppState.appData.training) ? AppState.appData.training : [];
        let contractorTrainings = Array.isArray(AppState.appData.contractorTrainings) ? AppState.appData.contractorTrainings : [];
        let trainingAttendance = Array.isArray(AppState.appData.trainingAttendance) ? AppState.appData.trainingAttendance : [];
        if (filter && filter.type !== 'all') {
            trainings = this.filterRecordsByAnalysisDate(trainings, filter, 'training');
            contractorTrainings = this.filterRecordsByAnalysisDate(contractorTrainings, filter, 'contractorTrainings');
            trainingAttendance = this.filterRecordsByAnalysisDate(trainingAttendance, filter, 'trainingAttendance');
        }
        try {
            const stats = this.getStatsFromTrainingsArray(trainings);
            const contractorStats = {
                total: contractorTrainings.length,
                totalParticipants: contractorTrainings.reduce((sum, t) => {
                    const count = Number(t.traineesCount || t.attendees || 0);
                    return sum + (Number.isFinite(count) ? count : 0);
                }, 0),
                totalHours: contractorTrainings.reduce((sum, t) => {
                    const hours = parseFloat(t.totalHours || t.trainingHours || 0);
                    return sum + (Number.isFinite(hours) ? hours : 0);
                }, 0)
            };
            
            const uniqueEmployees = new Set();
            trainingAttendance.forEach(record => {
                if (record.employeeCode) {
                    uniqueEmployees.add(record.employeeCode);
                }
            });
            
            const attendanceHours = trainingAttendance.reduce((sum, r) => {
                const hours = parseFloat(r.totalHours) || 0;
                return sum + (Number.isFinite(hours) ? hours : 0);
            }, 0);
            
            const totalTrainingHours = attendanceHours + contractorStats.totalHours;
            
            return {
                totalTrainings: stats.totalTrainings || 0,
                completedTrainings: stats.completedTrainings || 0,
                totalParticipants: stats.totalParticipants || 0,
                contractorTrainings: contractorStats.total || 0,
                totalTrainingHours: Number.isFinite(totalTrainingHours) ? totalTrainingHours.toFixed(2) : '0.00',
                uniqueEmployees: uniqueEmployees.size || 0
            };
        } catch (error) {
            Utils.safeError('خطأ في حساب مقاييس التدريب:', error);
            // إرجاع قيم افتراضية في حالة الخطأ
            return {
                totalTrainings: 0,
                completedTrainings: 0,
                totalParticipants: 0,
                contractorTrainings: 0,
                totalTrainingHours: '0.00',
                uniqueEmployees: 0
            };
        }
    },
    
    showManageTrainingCardsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-cog ml-2"></i>إدارة الكروت والرسوم البيانية</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- إدارة الكروت -->
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold mb-3"><i class="fas fa-id-card ml-2"></i>الكروت الإحصائية</h3>
                        <div id="training-cards-list" class="space-y-2"></div>
                        <button class="btn-secondary mt-3" onclick="Training.resetTrainingCardsToDefault()">
                            <i class="fas fa-undo ml-2"></i>إعادة تعيين للافتراضي
                        </button>
                    </div>
                    
                    <!-- إدارة الرسوم البيانية -->
                    <div class="border-t pt-6">
                        <h3 class="text-lg font-semibold mb-3"><i class="fas fa-chart-bar ml-2"></i>الرسوم البيانية</h3>
                        <div id="training-analysis-items-list" class="space-y-2"></div>
                        <button class="btn-secondary mt-3" onclick="Training.resetTrainingAnalysisItemsToDefault()">
                            <i class="fas fa-undo ml-2"></i>إعادة تعيين للافتراضي
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
                    <button class="btn-primary" onclick="Training.saveTrainingAnalysisSettings()">
                        <i class="fas fa-save ml-2"></i>حفظ وتحديث
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        this.loadTrainingCardsUI();
        this.loadTrainingAnalysisItemsUI();
    },
    
    loadTrainingCardsUI() {
        const cards = this.loadTrainingInfoCards();
        const container = document.getElementById('training-cards-list');
        if (!container) return;
        
        container.innerHTML = cards.map(card => `
            <div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                <label class="flex items-center cursor-pointer flex-1">
                    <input type="checkbox" class="training-card-checkbox mr-2" data-card-id="${card.id}" ${card.enabled ? 'checked' : ''}>
                    <i class="${card.icon} ml-2 text-${card.color}-600"></i>
                    <span>${Utils.escapeHTML(card.title)}</span>
                </label>
            </div>
        `).join('');
    },
    
    loadTrainingAnalysisItemsUI() {
        const keys = this.getTrainingAnalysisStorageKeys();
        const raw = localStorage.getItem(keys.items) || '[]';
        let items = [];
        try { 
            const parsed = JSON.parse(raw);
            items = Array.isArray(parsed) ? parsed : [];
        } catch (e) { 
            Utils.safeWarn('خطأ في تحميل بنود التحليل:', e);
            items = []; 
        }
        
        if (!Array.isArray(items) || items.length === 0) {
            items = this.getTrainingDefaultAnalysisItems();
            try {
                localStorage.setItem(keys.items, JSON.stringify(items));
            } catch (e) {
                Utils.safeWarn('فشل حفظ بنود التحليل الافتراضية:', e);
            }
        } else {
            let migrated = false;
            items = items.map(item => {
                if (!item || typeof item !== 'object') return item;
                const isMonthPreset =
                    item.id === 'trainings_by_month' ||
                    String(item.label || '').trim() === 'البرامج حسب الشهر';
                if (
                    item.dataset === 'training' &&
                    item.field === 'startDate' &&
                    isMonthPreset
                ) {
                    migrated = true;
                    return { ...item, field: 'byMonth' };
                }
                return item;
            });
            if (migrated) {
                try {
                    localStorage.setItem(keys.items, JSON.stringify(items));
                    this.updateTrainingAnalysisResults();
                } catch (e) {
                    Utils.safeWarn('فشل حفظ ترحيل بنود التحليل:', e);
                }
            }
        }
        
        const container = document.getElementById('training-analysis-items-list');
        if (!container) return;
        
        if (items.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-4">لا توجد بنود تحليل. قم بإضافة بند جديد.</p>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                <label class="flex items-center cursor-pointer flex-1">
                    <input type="checkbox" class="training-analysis-item-checkbox mr-2" data-item-id="${item.id}" ${item.enabled ? 'checked' : ''}>
                    <span>${Utils.escapeHTML(item.label)}</span>
                    ${item.dataset ? `<span class="text-xs text-gray-400 mr-2">(${item.dataset})</span>` : ''}
                </label>
                <button class="btn-icon btn-icon-danger ml-2" onclick="Training.removeTrainingAnalysisItem('${item.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        // ربط الأحداث
        container.querySelectorAll('.training-analysis-item-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-item-id');
                this.toggleTrainingAnalysisItem(id, e.target.checked);
            });
        });
        
        // إعداد واجهة إضافة بند جديد
        this.setupTrainingAnalysisItemForm();
    },
    
    setupTrainingAnalysisItemForm() {
        const datasetSelect = document.getElementById('training-new-analysis-dataset');
        const fieldSelect = document.getElementById('training-new-analysis-field');
        const customFieldWrap = document.getElementById('training-custom-field-wrap');
        const addBtn = document.getElementById('training-add-analysis-item-btn');
        
        if (!datasetSelect || !fieldSelect) return;
        
        // تحديث الحقول عند تغيير مجموعة البيانات
        const updateFields = () => {
            const dataset = datasetSelect.value;
            const fieldsMap = this.getTrainingAnalysisFieldsMap();
            const fields = fieldsMap[dataset] || [];
            
            const optionsHtml = `
                <option value="">اختر الحقل</option>
                ${fields.map(f => `<option value="${Utils.escapeHTML(f.value)}">${Utils.escapeHTML(f.label)}</option>`).join('')}
                <option value="__custom__">حقل مخصص...</option>
            `;
            Utils.setSafeHTML(fieldSelect, optionsHtml);
        };
        
        datasetSelect.addEventListener('change', updateFields);
        updateFields(); // تحديث الحقول عند التحميل
        
        // عرض/إخفاء حقل الإدخال المخصص
        fieldSelect.addEventListener('change', () => {
            if (fieldSelect.value === '__custom__') {
                customFieldWrap.style.display = 'block';
            } else {
                customFieldWrap.style.display = 'none';
            }
        });
        
        // ربط زر الإضافة
        if (addBtn) {
            addBtn.onclick = () => this.addTrainingAnalysisItemFromUI();
        }
    },
    
    /** قائمة أشهر متاحة للتحليل (من برامج التدريب + سجل الحضور + تدريبات المقاولين) */
    getAnalysisMonthOptions() {
        this.ensureData();
        const months = new Set();
        const addFrom = (list, getDate) => {
            (list || []).forEach(r => {
                const d = getDate(r);
                if (d && !Number.isNaN(d.getTime())) months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
            });
        };
        addFrom(AppState.appData.training, r => new Date(r.startDate || r.date || r.createdAt));
        addFrom(AppState.appData.trainingAttendance, r => new Date(r.date || r.attendanceDate || r.createdAt));
        addFrom(AppState.appData.contractorTrainings, r => new Date(r.date || r.trainingDate || r.createdAt));
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        return Array.from(months).sort().reverse().map(monthKey => {
            const [y, m] = monthKey.split('-');
            return `<option value="${monthKey}">${monthNames[parseInt(m, 10) - 1]} ${y}</option>`;
        }).join('');
    },

    getTrainingAnalysisFieldsMap() {
        return {
            training: [
                { value: 'status', label: 'الحالة' },
                { value: 'trainingType', label: 'نوع التدريب' },
                { value: 'trainer', label: 'اسم المدرب' },
                { value: 'location', label: 'الموقع' },
                { value: 'department', label: 'الإدارة' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ],
            contractorTrainings: [
                { value: 'contractorName', label: 'اسم المقاول' },
                { value: 'topic', label: 'الموضوع' },
                { value: 'location', label: 'الموقع' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ],
            trainingAttendance: [
                { value: 'trainingType', label: 'نوع التدريب' },
                { value: 'factoryName', label: 'المصنع' },
                { value: 'department', label: 'الإدارة' },
                { value: 'employeeCode', label: 'كود الموظف' },
                { value: 'byMonth', label: 'حسب الشهر' }
            ]
        };
    },
    
    addTrainingAnalysisItemFromUI() {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('ليس لديك صلاحية لإضافة بنود التحليل');
            return;
        }

        const datasetEl = document.getElementById('training-new-analysis-dataset');
        const fieldEl = document.getElementById('training-new-analysis-field');
        const customFieldEl = document.getElementById('training-new-analysis-custom-field');
        const labelEl = document.getElementById('training-new-analysis-label');
        const chartTypeEl = document.getElementById('training-new-analysis-charttype');

        const dataset = datasetEl?.value || 'training';
        let field = fieldEl?.value || '';
        if (field === '__custom__') {
            field = (customFieldEl?.value || '').trim();
        }
        const label = (labelEl?.value || '').trim();
        const chartType = chartTypeEl?.value || 'auto';

        if (!field) {
            Notification?.warning?.('يرجى اختيار/إدخال الحقل');
            return;
        }
        if (!label) {
            Notification?.warning?.('يرجى إدخال اسم البند');
            return;
        }

        const keys = this.getTrainingAnalysisStorageKeys();
        let items = [];
        try { 
            items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; 
        } catch (e) { 
            items = []; 
        }
        if (!Array.isArray(items)) items = [];

        // التحقق من عدم وجود بند بنفس الاسم
        if (items.some(item => item.label.toLowerCase() === label.toLowerCase())) {
            Notification?.warning?.('يوجد بند بنفس الاسم مسبقاً');
            return;
        }

        const newItem = {
            id: `custom_${Date.now()}`,
            label,
            enabled: true,
            dataset,
            field,
            chartType
        };
        items.push(newItem);
        
        try {
            localStorage.setItem(keys.items, JSON.stringify(items));
            Notification?.success?.('تم إضافة البند بنجاح');
        } catch (e) {
            Utils.safeError('خطأ في حفظ البند:', e);
            Notification?.error?.('فشل حفظ البند: ' + (e.message || 'خطأ غير معروف'));
            return;
        }

        if (labelEl) labelEl.value = '';
        if (customFieldEl) customFieldEl.value = '';
        if (fieldEl) fieldEl.value = '';
        const customFieldWrap = document.getElementById('training-custom-field-wrap');
        if (customFieldWrap) customFieldWrap.style.display = 'none';
        
        this.loadTrainingAnalysisItemsUI();
        this.updateTrainingAnalysisResults();
    },

    toggleTrainingAnalysisItem(itemId, enabled) {
        if (!this.isCurrentUserAdmin()) return;
        const keys = this.getTrainingAnalysisStorageKeys();
        let items = [];
        try { 
            items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; 
        } catch (e) { 
            items = []; 
        }
        const item = (Array.isArray(items) ? items : []).find(i => i.id === itemId);
        if (item) {
            item.enabled = enabled;
            try {
                localStorage.setItem(keys.items, JSON.stringify(items));
                this.updateTrainingAnalysisResults();
            } catch (e) {
                Utils.safeError('خطأ في حفظ تغييرات البند:', e);
            }
        }
    },

    removeTrainingAnalysisItem(itemId) {
        if (!this.isCurrentUserAdmin()) {
            Notification?.error?.('ليس لديك صلاحية لحذف بنود التحليل');
            return;
        }
        if (!confirm('هل أنت متأكد من حذف هذا البند؟')) return;
        
        const keys = this.getTrainingAnalysisStorageKeys();
        let items = [];
        try { 
            items = JSON.parse(localStorage.getItem(keys.items) || '[]') || []; 
        } catch (e) { 
            items = []; 
        }
        const filtered = (Array.isArray(items) ? items : []).filter(i => i.id !== itemId);
        
        try {
            localStorage.setItem(keys.items, JSON.stringify(filtered));
            Notification?.success?.('تم حذف البند بنجاح');
        } catch (e) {
            Utils.safeError('خطأ في حذف البند:', e);
            Notification?.error?.('فشل حذف البند: ' + (e.message || 'خطأ غير معروف'));
            return;
        }
        
        this.loadTrainingAnalysisItemsUI();
        this.updateTrainingAnalysisResults();
    },

    /**
     * قراءة فلتر فترة التحليل من واجهة تبويب تحليل البيانات (الشهر أو من-إلى)
     */
    getAnalysisDateFilter() {
        const typeEl = document.getElementById('training-analysis-filter-type');
        const monthEl = document.getElementById('training-analysis-month');
        const fromEl = document.getElementById('training-analysis-date-from');
        const toEl = document.getElementById('training-analysis-date-to');
        const type = (typeEl && typeEl.value) ? typeEl.value : 'all';
        const month = (monthEl && monthEl.value) ? String(monthEl.value).trim() : '';
        const start = (fromEl && fromEl.value) ? String(fromEl.value).trim() : '';
        const end = (toEl && toEl.value) ? String(toEl.value).trim() : '';
        return { type: type || 'all', month, start, end };
    },

    /**
     * استخراج تاريخ السجل حسب مجموعة البيانات
     */
    getRecordDateForFilter(record, dataset) {
        if (!record || typeof record !== 'object') return null;
        const dateStr =
            dataset === 'training' ? (record.startDate || record.date || record.createdAt) :
            dataset === 'contractorTrainings' ? (record.date || record.trainingDate || record.createdAt) :
            dataset === 'trainingAttendance' ? (record.date || record.attendanceDate || record.createdAt) :
            (record.date || record.createdAt);
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return Number.isNaN(d.getTime()) ? null : d;
    },

    /**
     * تصفية سجلات حسب فلتر الفترة (الكل / شهر / من-إلى)
     */
    filterRecordsByAnalysisDate(records, filter, dataset) {
        if (!Array.isArray(records) || !filter || filter.type === 'all') return records;
        const arr = records.filter(rec => {
            const d = this.getRecordDateForFilter(rec, dataset);
            if (!d) return false;
            if (filter.type === 'month' && filter.month) {
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === filter.month;
            }
            if (filter.type === 'range' && (filter.start || filter.end)) {
                const t = d.getTime();
                if (filter.start) {
                    const startD = new Date(filter.start);
                    if (!Number.isNaN(startD.getTime()) && t < startD.getTime()) return false;
                }
                if (filter.end) {
                    const endD = new Date(filter.end);
                    if (!Number.isNaN(endD.getTime()) && t > endD.getTime()) return false;
                }
                return true;
            }
            return true;
        });
        return arr;
    },

    getTrainingDatasetForAnalysis(dataset) {
        this.ensureData();
        let records = [];
        switch (dataset) {
            case 'training':
                records = Array.isArray(AppState.appData.training) ? AppState.appData.training : [];
                break;
            case 'contractorTrainings':
                records = Array.isArray(AppState.appData.contractorTrainings) ? AppState.appData.contractorTrainings : [];
                break;
            case 'trainingAttendance':
                records = Array.isArray(AppState.appData.trainingAttendance) ? AppState.appData.trainingAttendance : [];
                break;
            default:
                return [];
        }
        const filter = this.getAnalysisDateFilter();
        return this.filterRecordsByAnalysisDate(records, filter, dataset);
    },

    /** حقول تاريخ تُجمَّع في التحليل على مستوى الشهر (YYYY-MM) بدل النص الخام */
    _trainingAnalysisFieldBucketsByMonth(dataset, field) {
        const map = {
            training: ['startDate', 'endDate', 'date', 'createdAt'],
            contractorTrainings: ['date', 'createdAt', 'trainingDate'],
            trainingAttendance: ['date', 'createdAt', 'attendanceDate']
        };
        const list = map[dataset];
        return Array.isArray(list) && list.includes(field);
    },

    getTrainingAnalysisValue(dataset, field, record) {
        if (!record || typeof record !== 'object') return 'غير محدد';

        if (field === 'byMonth') {
            const dateStr = 
                dataset === 'training' ? (record.startDate || record.createdAt || record.date) :
                dataset === 'contractorTrainings' ? (record.date || record.createdAt || record.trainingDate) :
                dataset === 'trainingAttendance' ? (record.date || record.createdAt || record.attendanceDate) :
                (record.createdAt || record.date || '');
            
            if (!dateStr) return 'غير محدد';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'غير محدد';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        if (this._trainingAnalysisFieldBucketsByMonth(dataset, field)) {
            const raw = record[field];
            if (raw == null || raw === '') return 'غير محدد';
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return 'غير محدد';
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        // دعم اسم المدرب في برامج التدريب (الحقل قد يكون trainer أو trainerName)
        if (dataset === 'training' && (field === 'trainerName' || field === 'trainer')) {
            const v = record.trainer || record.trainerName || record.conductedBy;
            const value = (v === null || v === undefined || v === '') ? 'غير محدد' : String(v).trim();
            return value && value !== 'null' && value !== 'undefined' ? value : 'غير محدد';
        }
        // direct read (supports custom fields too)
        const v = record[field];
        const value = (v === null || v === undefined || v === '') ? 'غير محدد' : String(v).trim();
        return value && value !== 'null' && value !== 'undefined' ? value : 'غير محدد';
    },

    analyzeTrainingByItem(item) {
        const dataset = item.dataset;
        const field = item.field;
        const records = this.getTrainingDatasetForAnalysis(dataset);
        const counts = {};
        let total = 0;

        records.forEach(rec => {
            const value = this.getTrainingAnalysisValue(dataset, field, rec);
            counts[value] = (counts[value] || 0) + 1;
            total++;
        });

        return Object.entries(counts)
            .map(([label, count]) => ({
                label,
                count,
                percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
            }))
            .sort((a, b) => b.count - a.count);
    },

    async updateTrainingAnalysisResults() {
        const resultsContainer = document.getElementById('training-analysis-results');
        if (!resultsContainer) return;

        const keys = this.getTrainingAnalysisStorageKeys();
        let items = [];
        try {
            items = JSON.parse(localStorage.getItem(keys.items) || '[]') || [];
        } catch (e) {
            items = [];
        }

        const enabledItems = items.filter(i => i.enabled);

        if (enabledItems.length === 0) {
            const cardBody = resultsContainer.querySelector('.card-body');
            if (cardBody) {
                cardBody.innerHTML = `
                    <div class="empty-state">
                        <p class="text-gray-500">قم بتفعيل/إضافة بنود للتحليل لعرض النتائج.</p>
                    </div>
                `;
            }
            return;
        }

        // إنشاء HTML للنتائج
        let resultsHTML = '';
        
        for (let index = 0; index < enabledItems.length; index++) {
            const item = enabledItems[index];
            const analysisData = this.analyzeTrainingByItem(item);
            
            if (!analysisData || analysisData.length === 0) {
                resultsHTML += `
                    <div class="content-card mb-6" style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
                        <div class="card-header" style="background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e2e8f0;">
                            <h3 class="card-title"><i class="fas fa-chart-bar ml-2 text-slate-600"></i>${Utils.escapeHTML(item.label)}</h3>
                        </div>
                        <div class="card-body">
                            <p class="text-center text-gray-500 py-4">لا توجد بيانات متاحة</p>
                        </div>
                    </div>
                `;
                continue;
            }

            const rows = analysisData.map(({ label, count, percentage }) => `
                <tr>
                    <td class="font-semibold">${Utils.escapeHTML(label)}</td>
                    <td class="text-center font-bold text-indigo-600">${count}</td>
                    <td class="text-center text-gray-600">${percentage}%</td>
                </tr>
            `).join('');

            const chartId = `training-chart-${item.id}-${index}`;
            const chartContainerId = `training-chart-container-${item.id}-${index}`;

            resultsHTML += `
                <div class="content-card mb-6" style="border:1px solid #e0e7ff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(79,70,229,0.08);">
                    <div class="card-header" style="background:linear-gradient(135deg,#eef2ff 0%,#faf5ff 100%);border-bottom:1px solid #e0e7ff;">
                        <h3 class="card-title"><i class="fas fa-chart-pie ml-2 text-indigo-600"></i>${Utils.escapeHTML(item.label)}</h3>
                    </div>
                    <div class="card-body" style="background:#fafbff;">
                        <div class="table-wrapper mb-4 rounded-xl border border-slate-200/80 overflow-hidden shadow-sm" style="overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr style="background:linear-gradient(180deg,#3730a3,#4f46e5);color:#fff;">
                                        <th style="border:none;">القيمة</th>
                                        <th class="text-center" style="border:none;">العدد</th>
                                        <th class="text-center" style="border:none;">النسبة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        <div id="${chartContainerId}" class="rounded-xl border border-indigo-100 bg-white p-2 shadow-sm" style="position: relative; height: 350px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                </div>
            `;
        }

        const resultsCardBody = resultsContainer.querySelector('.card-body');
        if (resultsCardBody) {
            resultsCardBody.innerHTML = resultsHTML;
        }

        // رسم الرسوم البيانية
        setTimeout(async () => {
            await this.ensureChartJSLoaded();
            this.renderTrainingAnalysisCharts(enabledItems);
        }, 300);
    },

    /** بناء HTML كروت التحليل من مقاييس معينة */
    renderAnalysisCardsHtml(metrics) {
        const cards = this.loadTrainingInfoCards().filter(c => c.enabled !== false);
        const colorClasses = {
            blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', purple: 'bg-purple-100 text-purple-600',
            amber: 'bg-amber-100 text-amber-600', red: 'bg-red-100 text-red-600', indigo: 'bg-indigo-100 text-indigo-600',
            teal: 'bg-teal-100 text-teal-600', orange: 'bg-orange-100 text-orange-600', pink: 'bg-pink-100 text-pink-600'
        };
        if (!metrics || typeof metrics !== 'object') metrics = this.calculateTrainingMetrics();
        return cards.map(card => {
            let value = metrics[card.metric];
            if (value === undefined || value === null) value = 0;
            if (typeof value === 'string' && value.trim() === '') value = 0;
            if (typeof value === 'number' && value >= 1000) value = value.toLocaleString('en-US');
            const colorClass = colorClasses[card.color] || 'bg-gray-100 text-gray-600';
            return `<div class="content-card"><div class="flex items-center gap-4"><div class="w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center shadow-sm"><i class="${card.icon} text-2xl"></i></div><div class="flex-1"><p class="text-sm text-gray-500 mb-1">${Utils.escapeHTML(card.title)}</p><p class="text-2xl font-bold text-gray-900" dir="ltr">${Utils.escapeHTML(String(value))}</p>${card.description ? `<p class="text-xs text-gray-400 mt-1">${Utils.escapeHTML(card.description)}</p>` : ''}</div></div></div>`;
        }).join('') || '<p class="text-center text-gray-500 col-span-full">لا توجد كروت مفعلة</p>';
    },

    /** تحديث كروت التحليل والنتائج عند تغيير فلتر الفترة */
    refreshAnalysisTabContent() {
        this.refreshAnalysisCards();
        this.updateTrainingAnalysisResults();
        this.refreshAnalysisPeriodReports();
    },

    /** تحديث كروت التحليل فقط (تقرأ الفلتر من DOM) */
    refreshAnalysisCards() {
        const container = document.getElementById('training-analysis-cards-container');
        if (!container) return;
        const metrics = this.calculateTrainingMetrics();
        container.innerHTML = this.renderAnalysisCardsHtml(metrics);
    },

    /** ربط أحداث فلتر فترة التحليل (الشهر / من-إلى) */
    bindAnalysisFilterEvents() {
        const typeEl = document.getElementById('training-analysis-filter-type');
        const monthWrap = document.getElementById('training-analysis-month-wrap');
        const fromWrap = document.getElementById('training-analysis-date-from-wrap');
        const toWrap = document.getElementById('training-analysis-date-to-wrap');
        const monthEl = document.getElementById('training-analysis-month');
        const fromEl = document.getElementById('training-analysis-date-from');
        const toEl = document.getElementById('training-analysis-date-to');

        const updateVisibility = () => {
            const type = (typeEl && typeEl.value) ? typeEl.value : 'all';
            if (monthWrap) monthWrap.style.display = type === 'month' ? 'block' : 'none';
            if (fromWrap) fromWrap.style.display = type === 'range' ? 'block' : 'none';
            if (toWrap) toWrap.style.display = type === 'range' ? 'block' : 'none';
        };
        const refresh = () => this.refreshAnalysisTabContent();

        if (typeEl && !typeEl.dataset.trainingAnalysisFilterBound) {
            typeEl.addEventListener('change', () => { updateVisibility(); refresh(); });
            typeEl.dataset.trainingAnalysisFilterBound = '1';
        }
        if (monthEl && !monthEl.dataset.trainingAnalysisFilterBound) {
            monthEl.addEventListener('change', refresh);
            monthEl.dataset.trainingAnalysisFilterBound = '1';
        }
        if (fromEl && !fromEl.dataset.trainingAnalysisFilterBound) {
            fromEl.addEventListener('change', refresh);
            fromEl.dataset.trainingAnalysisFilterBound = '1';
        }
        if (toEl && !toEl.dataset.trainingAnalysisFilterBound) {
            toEl.addEventListener('change', refresh);
            toEl.dataset.trainingAnalysisFilterBound = '1';
        }
        updateVisibility();
    },

    /** مقطع نصي آمن لأسماء ملفات التصدير */
    getAnalysisPeriodExportSlug() {
        const f = this.getAnalysisDateFilter();
        if (!f || f.type === 'all') return 'all';
        if (f.type === 'month' && f.month) return `month_${String(f.month).replace(/[^\d-]/g, '')}`;
        if (f.type === 'range') {
            const a = String(f.start || '').replace(/[^\d-]/g, '');
            const b = String(f.end || '').replace(/[^\d-]/g, '');
            if (a || b) return `range_${a || 'x'}_${b || 'x'}`;
        }
        return 'filtered';
    },

    /** وصف فترة التحليل للعرض في التقارير (PDF وغيرها) */
    getAnalysisPeriodLabelAr() {
        const f = this.getAnalysisDateFilter();
        if (!f || f.type === 'all') return 'جميع البيانات';
        if (f.type === 'month' && f.month) {
            const parts = String(f.month).split('-');
            const y = parts[0];
            const m = parseInt(parts[1], 10);
            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            if (y && m >= 1 && m <= 12) return `${monthNames[m - 1]} ${y}`;
            return String(f.month);
        }
        if (f.type === 'range') {
            const a = f.start ? (typeof Utils !== 'undefined' && Utils.formatDate ? Utils.formatDate(f.start) : f.start) : '—';
            const b = f.end ? (typeof Utils !== 'undefined' && Utils.formatDate ? Utils.formatDate(f.end) : f.end) : '—';
            return `من ${a} إلى ${b}`;
        }
        return 'فترة محددة';
    },

    /** فلتر التاريخ من حقول تبويب التحليل (بدون النافذة المنبثقة) */
    _getExportDateFilterFromAnalysisDom() {
        const modeEl = document.getElementById('training-export-period-mode');
        const mode = modeEl ? modeEl.value : 'follow';
        if (mode !== 'custom') {
            return this.getAnalysisDateFilter();
        }
        const start = document.getElementById('training-export-from')?.value?.trim() || '';
        const end = document.getElementById('training-export-to')?.value?.trim() || '';
        if (!start && !end) {
            return this.getAnalysisDateFilter();
        }
        return { type: 'range', month: '', start, end };
    },

    /** فلتر التاريخ المستخدم في تقارير التصدير/المعاينة */
    getExportDateFilterForReports() {
        if (this._analysisExportContext && this._analysisExportContext.dateFilter) {
            return this._analysisExportContext.dateFilter;
        }
        return this._getExportDateFilterFromAnalysisDom();
    },

    _toggleTrainingExportCustomDates() {
        const mode = document.getElementById('training-export-period-mode')?.value || 'follow';
        const wrap = document.getElementById('training-export-custom-dates');
        if (wrap) wrap.style.display = mode === 'custom' ? 'flex' : 'none';
    },

    /** تمييز سجل حضور كـ مقاول/خارجي */
    _isAttendanceContractorLike(rec) {
        if (!rec || typeof rec !== 'object') return false;
        const pt = String(rec.personType || rec.participantType || rec.type || '').toLowerCase();
        if (pt === 'contractor' || pt === 'external') return true;
        const tt = String(rec.trainingType || '').trim();
        if (tt === 'خارجي') {
            const code = String(rec.employeeCode || rec.code || rec.employeeNumber || '').trim();
            if (!code) return true;
        }
        return false;
    },

    _attendancePersonRowKey(rec) {
        if (!rec || typeof rec !== 'object') return 'n:غير محدد';
        const code = String(rec.employeeCode || rec.code || rec.employeeNumber || '').trim();
        const name = String(rec.employeeName || rec.name || '').trim();
        if (code) return `c:${code}`;
        if (name) return `n:${name}`;
        return 'n:غير محدد';
    },

    /** تسمية الإدارة لسجل حضور (للفلترة والقوائم؛ الفارغ يُعرض كـ «غير محدد») */
    _attendanceRecordDepartmentLabel(rec) {
        if (!rec || typeof rec !== 'object') return 'غير محدد';
        const d = String(rec.department ?? '').replace(/\s+/g, ' ').trim();
        return d || 'غير محدد';
    },

    getTrainingRecordsForReportsFiltered() {
        this.ensureData();
        let records = Array.isArray(AppState.appData.training) ? AppState.appData.training : [];
        const filter = this.getExportDateFilterForReports();
        records = this.filterRecordsByAnalysisDate(records, filter, 'training');
        const ctx = this._analysisExportContext;
        const trainerKey = ctx
            ? String(ctx.trainerKey || '').trim()
            : (document.getElementById('training-export-trainer-key')?.value?.trim() || '');
        if (trainerKey) {
            records = records.filter(rec => this.getTrainingAnalysisValue('training', 'trainer', rec) === trainerKey);
        }
        return records;
    },

    getAttendanceRecordsForReportsFiltered() {
        this.ensureData();
        let records = Array.isArray(AppState.appData.trainingAttendance) ? AppState.appData.trainingAttendance : [];
        const filter = this.getExportDateFilterForReports();
        records = this.filterRecordsByAnalysisDate(records, filter, 'trainingAttendance');
        const ctx = this._analysisExportContext;
        const audience = ctx
            ? (ctx.audience || 'all')
            : (document.getElementById('training-export-audience')?.value || 'all');
        if (audience === 'employee') {
            records = records.filter(r => !this._isAttendanceContractorLike(r));
        } else if (audience === 'contractor') {
            records = records.filter(r => this._isAttendanceContractorLike(r));
        }
        const personKey = ctx
            ? String(ctx.personKey || '').trim()
            : (document.getElementById('training-export-person-key')?.value?.trim() || '');
        if (personKey) {
            records = records.filter(rec => this._attendancePersonRowKey(rec) === personKey);
        }
        const deptFilter = ctx && ctx.attendanceDepartment
            ? String(ctx.attendanceDepartment).trim()
            : '';
        if (deptFilter) {
            records = records.filter(rec => this._attendanceRecordDepartmentLabel(rec) === deptFilter);
        }
        return records;
    },

    /** وصف فترة التصدير الحالية للعناوين */
    getExportPeriodLabelAr() {
        const f = this.getExportDateFilterForReports();
        if (!f || f.type === 'all') return 'جميع البيانات';
        if (f.type === 'month' && f.month) {
            const parts = String(f.month).split('-');
            const y = parts[0];
            const m = parseInt(parts[1], 10);
            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            if (y && m >= 1 && m <= 12) return `${monthNames[m - 1]} ${y}`;
            return String(f.month);
        }
        if (f.type === 'range') {
            const a = f.start ? (typeof Utils !== 'undefined' && Utils.formatDate ? Utils.formatDate(f.start) : f.start) : '—';
            const b = f.end ? (typeof Utils !== 'undefined' && Utils.formatDate ? Utils.formatDate(f.end) : f.end) : '—';
            return `من ${a} إلى ${b}`;
        }
        return 'فترة محددة';
    },

    getAnalysisPeriodExportSlugFromFilter(f) {
        if (!f || f.type === 'all') return 'all';
        if (f.type === 'month' && f.month) return `month_${String(f.month).replace(/[^\d-]/g, '')}`;
        if (f.type === 'range') {
            const a = String(f.start || '').replace(/[^\d-]/g, '');
            const b = String(f.end || '').replace(/[^\d-]/g, '');
            if (a || b) return `range_${a || 'x'}_${b || 'x'}`;
        }
        return 'filtered';
    },

    getExportPeriodExportSlug() {
        return this.getAnalysisPeriodExportSlugFromFilter(this.getExportDateFilterForReports());
    },

    populateTrainingExportFilterSelects() {
        const personSel = document.getElementById('training-export-person-key');
        const trainerSel = document.getElementById('training-export-trainer-key');
        if (personSel) {
            const prev = personSel.value;
            let records = Array.isArray(AppState.appData.trainingAttendance) ? AppState.appData.trainingAttendance : [];
            const filter = this.getExportDateFilterForReports();
            records = this.filterRecordsByAnalysisDate(records, filter, 'trainingAttendance');
            const audience = document.getElementById('training-export-audience')?.value || 'all';
            if (audience === 'employee') records = records.filter(r => !this._isAttendanceContractorLike(r));
            else if (audience === 'contractor') records = records.filter(r => this._isAttendanceContractorLike(r));
            const seen = new Map();
            records.forEach(rec => {
                const key = this._attendancePersonRowKey(rec);
                if (seen.has(key)) return;
                const code = String(rec.employeeCode || rec.code || rec.employeeNumber || '').trim();
                const name = String(rec.employeeName || rec.name || '').trim();
                const label = name ? (code ? `${name} (${code})` : name) : (code || 'غير محدد');
                seen.set(key, label);
            });
            const options = Array.from(seen.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ar'));
            personSel.innerHTML = '<option value="">— كل الأشخاص —</option>' +
                options.map(([k, lab]) => `<option value="${Utils.escapeHTML(k)}">${Utils.escapeHTML(lab)}</option>`).join('');
            if (prev && seen.has(prev)) personSel.value = prev;
        }
        if (trainerSel) {
            const prevT = trainerSel.value;
            let trec = Array.isArray(AppState.appData.training) ? AppState.appData.training : [];
            const filter = this.getExportDateFilterForReports();
            trec = this.filterRecordsByAnalysisDate(trec, filter, 'training');
            const trainers = new Set();
            trec.forEach(rec => trainers.add(this.getTrainingAnalysisValue('training', 'trainer', rec)));
            const list = Array.from(trainers).filter(t => t && t !== 'غير محدد').sort((a, b) => String(a).localeCompare(String(b), 'ar'));
            trainerSel.innerHTML = '<option value="">— كل المدربين —</option>' +
                list.map(t => `<option value="${Utils.escapeHTML(t)}">${Utils.escapeHTML(t)}</option>`).join('');
            if (prevT && list.includes(prevT)) trainerSel.value = prevT;
        }
    },

    /** رسم أعمدة أفقية يعمل في نافذة الطباعة/PDF */
    _buildPrintableBarChartHtml(title, items, barColor) {
        if (!items || !items.length) return '';
        const max = Math.max(...items.map(x => Number(x.value) || 0), 1);
        const rows = items.map(it => {
            const v = Number(it.value) || 0;
            const pct = Math.round((v / max) * 100);
            return `
                <div style="display:flex;align-items:center;margin-bottom:8px;gap:10px;direction:rtl;">
                    <div style="min-width:100px;max-width:140px;font-size:10px;text-align:right;word-break:break-word;">${Utils.escapeHTML(String(it.label))}</div>
                    <div style="flex:1;background:#f1f5f9;height:20px;border-radius:6px;overflow:hidden;">
                        <div style="width:${pct}%;background:${barColor};height:100%;min-width:${v > 0 ? '4px' : '0'};"></div>
                    </div>
                    <div style="width:36px;font-size:11px;font-weight:700;text-align:left;">${v}</div>
                </div>`;
        }).join('');
        return `
            <div style="margin:20px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fafafa;">
                <div style="font-size:14px;font-weight:800;margin-bottom:12px;color:#0f172a;">${Utils.escapeHTML(title)}</div>
                ${rows}
            </div>`;
    },

    _buildTrainerMonthlyChartItems(records) {
        const byMonth = {};
        records.forEach(rec => {
            const d = this.getRecordDateForFilter(rec, 'training');
            if (!d) return;
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            byMonth[mk] = (byMonth[mk] || 0) + 1;
        });
        return Object.keys(byMonth).sort().map(k => ({ label: k, value: byMonth[k] }));
    },

    _buildAttendanceMonthlyChartItems(records) {
        const byMonth = {};
        records.forEach(rec => {
            const d = this.getRecordDateForFilter(rec, 'trainingAttendance');
            if (!d) return;
            const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            byMonth[mk] = (byMonth[mk] || 0) + 1;
        });
        return Object.keys(byMonth).sort().map(k => ({ label: k, value: byMonth[k] }));
    },

    _buildAttendanceTopicChartItems(records) {
        const byTopic = {};
        records.forEach(rec => {
            const t = String(rec.topic || rec.trainingTopic || '—').trim() || '—';
            byTopic[t] = (byTopic[t] || 0) + 1;
        });
        return Object.entries(byTopic)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 12);
    },

    buildTrainerProgramsReportRows() {
        const records = this.getTrainingRecordsForReportsFiltered();
        const map = {};
        records.forEach(rec => {
            const label = this.getTrainingAnalysisValue('training', 'trainer', rec);
            if (!map[label]) {
                map[label] = { trainer: label, programs: 0, participants: 0, hoursTotal: 0 };
            }
            map[label].programs += 1;
            map[label].participants += this.getParticipantsCount(rec);
            map[label].hoursTotal += this.getTrainingProgramHours(rec);
        });
        return Object.values(map).sort((a, b) =>
            b.programs - a.programs ||
            b.hoursTotal - a.hoursTotal ||
            b.participants - a.participants ||
            String(a.trainer).localeCompare(String(b.trainer), 'ar')
        );
    },

    buildAttendancePersonsReportRows() {
        const records = this.getAttendanceRecordsForReportsFiltered();
        const map = {};
        records.forEach(rec => {
            if (!rec || typeof rec !== 'object') return;
            const key = this._attendancePersonRowKey(rec);
            const code = String(rec.employeeCode || rec.code || rec.employeeNumber || '').trim();
            const name = String(rec.employeeName || rec.name || '').trim();
            const display = name
                ? (code ? `${name} (${code})` : name)
                : (code || 'غير محدد');
            if (!map[key]) {
                map[key] = { person: display, sessions: 0, totalHours: 0 };
            }
            map[key].sessions += 1;
            const h = parseFloat(rec.totalHours);
            map[key].totalHours += Number.isFinite(h) ? h : 0;
        });
        return Object.values(map).sort((a, b) =>
            b.sessions - a.sessions || b.totalHours - a.totalHours || String(a.person).localeCompare(String(b.person), 'ar')
        );
    },

    _destroyAnalysisPeriodCharts() {
        if (this._analysisPeriodCharts) {
            Object.values(this._analysisPeriodCharts).forEach(ch => {
                if (ch && typeof ch.destroy === 'function') ch.destroy();
            });
        }
        this._analysisPeriodCharts = {};
    },

    async refreshAnalysisPeriodReports() {
        const trainerTbody = document.getElementById('training-analysis-trainers-tbody');
        const attendeeTbody = document.getElementById('training-analysis-attendees-tbody');
        const trainerCanvas = document.getElementById('training-analysis-trainers-chart');
        const attendeeCanvas = document.getElementById('training-analysis-attendees-chart');
        if (!trainerTbody || !attendeeTbody) return;

        this._toggleTrainingExportCustomDates();
        this.populateTrainingExportFilterSelects();

        const limitTr = Math.min(500, Math.max(1, parseInt(document.getElementById('training-analysis-trainer-limit')?.value || '30', 10) || 30));
        const limitAtt = Math.min(2000, Math.max(1, parseInt(document.getElementById('training-analysis-attendees-limit')?.value || '50', 10) || 50));

        const trainerRows = this.buildTrainerProgramsReportRows();
        const attRows = this.buildAttendancePersonsReportRows();
        const trainerSlice = trainerRows.slice(0, limitTr);
        const attSlice = attRows.slice(0, limitAtt);

        if (trainerSlice.length === 0) {
            trainerTbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-6">لا توجد برامج في هذه الفترة</td></tr>';
        } else {
            trainerTbody.innerHTML = trainerSlice.map(r => `
                <tr>
                    <td class="font-medium">${Utils.escapeHTML(r.trainer)}</td>
                    <td class="text-center font-bold text-indigo-600">${r.programs}</td>
                    <td class="text-center text-gray-700">${r.participants}</td>
                    <td class="text-center text-gray-800 font-semibold" dir="ltr">${Number.isFinite(r.hoursTotal) ? r.hoursTotal.toFixed(2) : '0.00'}</td>
                </tr>
            `).join('');
        }

        if (attSlice.length === 0) {
            attendeeTbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-6">لا توجد سجلات حضور في هذه الفترة</td></tr>';
        } else {
            attendeeTbody.innerHTML = attSlice.map(r => `
                <tr>
                    <td class="font-medium">${Utils.escapeHTML(r.person)}</td>
                    <td class="text-center font-bold text-teal-600">${r.sessions}</td>
                    <td class="text-center text-gray-700">${Number.isFinite(r.totalHours) ? r.totalHours.toFixed(2) : '0.00'}</td>
                </tr>
            `).join('');
        }

        await this.ensureChartJSLoaded();
        if (typeof Chart === 'undefined') return;

        this._destroyAnalysisPeriodCharts();

        const mkBar = (canvas, labels, data, label, colors) => {
            if (!canvas || !labels.length) return;
            const wrap = canvas.parentElement;
            if (wrap) {
                wrap.style.display = labels.length ? 'block' : 'none';
            }
            try {
                this._analysisPeriodCharts[canvas.id] = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label,
                            data,
                            backgroundColor: colors.slice(0, labels.length)
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { precision: 0 } },
                            x: { ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 16 } }
                        }
                    }
                });
            } catch (e) {
                Utils.safeError('خطأ رسم تقرير الفترة:', e);
            }
        };

        const pal = this.getChartColors(Math.max(trainerSlice.length, attSlice.length, 10)).map(c => c.replace('0.6', '0.75'));

        if (trainerCanvas) {
            if (trainerSlice.length === 0) {
                trainerCanvas.parentElement.style.display = 'none';
            } else {
                trainerCanvas.parentElement.style.display = 'block';
                mkBar(
                    trainerCanvas,
                    trainerSlice.map(r => r.trainer),
                    trainerSlice.map(r => r.programs),
                    'عدد البرامج',
                    pal
                );
            }
        }
        if (attendeeCanvas) {
            if (attSlice.length === 0) {
                attendeeCanvas.parentElement.style.display = 'none';
            } else {
                attendeeCanvas.parentElement.style.display = 'block';
                mkBar(
                    attendeeCanvas,
                    attSlice.map(r => r.person),
                    attSlice.map(r => r.sessions),
                    'عدد الجلسات',
                    pal
                );
            }
        }
    },

    bindAnalysisPeriodReportsEvents() {
        const root = document.getElementById('training-analysis-period-reports');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        const limTr = document.getElementById('training-analysis-trainer-limit');
        const limAtt = document.getElementById('training-analysis-attendees-limit');
        const exTrOpen = document.getElementById('training-analysis-export-trainers-open');
        const exAttOpen = document.getElementById('training-analysis-export-attendees-open');

        const debounce = (fn, ms) => {
            let t;
            return () => {
                clearTimeout(t);
                t = setTimeout(fn, ms);
            };
        };
        const refreshDebounced = debounce(() => this.refreshAnalysisPeriodReports(), 350);

        if (limTr) limTr.addEventListener('change', () => this.refreshAnalysisPeriodReports());
        if (limAtt) limAtt.addEventListener('change', () => this.refreshAnalysisPeriodReports());
        if (limTr) limTr.addEventListener('input', refreshDebounced);
        if (limAtt) limAtt.addEventListener('input', refreshDebounced);

        if (exTrOpen) {
            exTrOpen.addEventListener('click', () => this.showTrainingAnalysisExportDialog('trainers'));
        }
        if (exAttOpen) {
            exAttOpen.addEventListener('click', () => this.showTrainingAnalysisExportDialog('attendees'));
        }

        const periodMode = document.getElementById('training-export-period-mode');
        const exFrom = document.getElementById('training-export-from');
        const exTo = document.getElementById('training-export-to');
        const audience = document.getElementById('training-export-audience');
        const personKey = document.getElementById('training-export-person-key');
        const trainerKey = document.getElementById('training-export-trainer-key');

        const exportRefresh = debounce(() => this.refreshAnalysisPeriodReports(), 320);
        if (periodMode && !periodMode.dataset.exportBound) {
            periodMode.addEventListener('change', () => {
                this._toggleTrainingExportCustomDates();
                exportRefresh();
            });
            periodMode.dataset.exportBound = '1';
        }
        [exFrom, exTo, audience].forEach(el => {
            if (el && !el.dataset.exportBound) {
                el.addEventListener('change', exportRefresh);
                el.dataset.exportBound = '1';
            }
        });
        if (personKey && !personKey.dataset.exportBound) {
            personKey.addEventListener('change', exportRefresh);
            personKey.dataset.exportBound = '1';
        }
        if (trainerKey && !trainerKey.dataset.exportBound) {
            trainerKey.addEventListener('change', exportRefresh);
            trainerKey.dataset.exportBound = '1';
        }
    },

    exportAnalysisTrainersExcel() {
        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متاحة');
            return;
        }
        const xctx = this._analysisExportContext;
        const limit = xctx && typeof xctx.limitTrainers === 'number'
            ? Math.min(500, Math.max(1, xctx.limitTrainers))
            : Math.min(500, Math.max(1, parseInt(document.getElementById('training-analysis-trainer-limit')?.value || '30', 10) || 30));
        const rows = this.buildTrainerProgramsReportRows().slice(0, limit);
        if (!rows.length) {
            Notification.warning('لا توجد بيانات للتصدير في هذه الفترة');
            return;
        }
        const slug = this.getExportPeriodExportSlug();
        const data = rows.map(r => ({
            'اسم المدرب': r.trainer,
            'عدد البرامج التدريبية': r.programs,
            'مجموع المشاركين': r.participants,
            'إجمالي ساعات التدريب': Number.isFinite(r.hoursTotal) ? Number(r.hoursTotal.toFixed(2)) : 0
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'المدربون');
        const trainerFocus = xctx
            ? String(xctx.trainerKey || '').trim()
            : (document.getElementById('training-export-trainer-key')?.value?.trim() || '');
        if (trainerFocus) {
            const prog = this.getTrainingRecordsForReportsFiltered().map((t, i) => ({
                'م': i + 1,
                'البرنامج': t.name || t.subject || t.topic || '—',
                'تاريخ البدء': t.startDate ? (Utils.formatDate ? Utils.formatDate(t.startDate) : t.startDate) : '—',
                'المشاركون': this.getParticipantsCount(t),
                'إجمالي ساعات التدريب': this.getTrainingProgramHours(t),
                'الحالة': t.status || '—'
            }));
            if (prog.length) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prog), 'برامج_المدرب');
            }
        }
        XLSX.writeFile(wb, `تقرير_المدربين_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        Notification.success('تم تصدير تقرير المدربين');
    },

    exportAnalysisAttendeesExcel() {
        if (typeof XLSX === 'undefined') {
            Notification.error('مكتبة Excel غير متاحة');
            return;
        }
        const xctx = this._analysisExportContext;
        const limit = xctx && typeof xctx.limitAttendees === 'number'
            ? Math.min(2000, Math.max(1, xctx.limitAttendees))
            : Math.min(2000, Math.max(1, parseInt(document.getElementById('training-analysis-attendees-limit')?.value || '50', 10) || 50));
        const rows = this.buildAttendancePersonsReportRows().slice(0, limit);
        if (!rows.length) {
            Notification.warning('لا توجد بيانات للتصدير في هذه الفترة');
            return;
        }
        const slug = this.getExportPeriodExportSlug();
        const data = rows.map(r => ({
            'الشخص': r.person,
            'عدد جلسات التدريب': r.sessions,
            'مجموع الساعات': Number.isFinite(r.totalHours) ? r.totalHours.toFixed(2) : '0.00'
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'المتدربون');
        const personFocus = xctx
            ? String(xctx.personKey || '').trim()
            : (document.getElementById('training-export-person-key')?.value?.trim() || '');
        if (personFocus) {
            const det = this.getAttendanceRecordsForReportsFiltered().map((r, i) => ({
                'م': i + 1,
                'التاريخ': r.date ? (Utils.formatDate ? Utils.formatDate(r.date) : r.date) : '',
                'الموضوع': r.topic || '—',
                'نوع التدريب': r.trainingType || '—',
                'الإدارة': this._attendanceRecordDepartmentLabel(r),
                'المصنع': r.factoryName || r.factory || '',
                'المحاضر': r.trainerName || r.trainer || '',
                'الساعات': Number.isFinite(parseFloat(r.totalHours)) ? parseFloat(r.totalHours).toFixed(2) : '0.00'
            }));
            if (det.length) {
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det), 'تفصيل_الجلسات');
            }
        }
        XLSX.writeFile(wb, `تقرير_المتدربين_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        Notification.success('تم تصدير تقرير المتدربين');
    },

    /** صفوف جدول HTML للطباعة/PDF (نمط مشابه لسجل الحضور) */
    _analysisPeriodPdfTableRows(matrixRows) {
        return matrixRows.map((row, idx) => `
                <tr style="${idx % 2 === 0 ? 'background-color: #FFFFFF;' : 'background-color: #F9FAFB;'}">
                    ${row.map(cell => `<td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px; line-height: 1.5;">${Utils.escapeHTML(String(cell))}</td>`).join('')}
                </tr>
            `).join('');
    },

    exportAnalysisTrainersPDF() {
        const xctx = this._analysisExportContext;
        const limit = xctx && typeof xctx.limitTrainers === 'number'
            ? Math.min(500, Math.max(1, xctx.limitTrainers))
            : Math.min(500, Math.max(1, parseInt(document.getElementById('training-analysis-trainer-limit')?.value || '30', 10) || 30));
        const rows = this.buildTrainerProgramsReportRows().slice(0, limit);
        if (!rows.length) {
            Notification.warning('لا توجد بيانات للتصدير في هذه الفترة');
            return;
        }
        Loading.show('جاري تجهيز PDF...');
        const periodAr = this.getExportPeriodLabelAr();
        const slug = this.getExportPeriodExportSlug();
        const trainerFocus = xctx
            ? String(xctx.trainerKey || '').trim()
            : (document.getElementById('training-export-trainer-key')?.value?.trim() || '');
        const headers = ['م', 'اسم المدرب', 'عدد البرامج التدريبية', 'مجموع المشاركين', 'إجمالي ساعات التدريب'];
        const matrix = rows.map((r, i) => [
            i + 1,
            r.trainer,
            r.programs,
            r.participants,
            Number.isFinite(r.hoursTotal) ? r.hoursTotal.toFixed(2) : '0.00'
        ]);
        const tableRows = this._analysisPeriodPdfTableRows(matrix);
        let extraCharts = '';
        if (trainerFocus) {
            const trec = this.getTrainingRecordsForReportsFiltered();
            const months = this._buildTrainerMonthlyChartItems(trec);
            if (months.length) {
                extraCharts += this._buildPrintableBarChartHtml(`توزيع البرامج حسب الشهر — ${trainerFocus}`, months, '#4f46e5');
            }
        }
        const content = `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #EEF2FF; border: 1px solid #C7D2FE;">
                            <div style="font-size: 12px; color: #4338CA; font-weight: 600;">فترة التقرير</div>
                            <div style="font-size: 15px; font-weight: 700; color: #312E81;">${Utils.escapeHTML(periodAr)}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #ECFDF5; border: 1px solid #BBF7D0;">
                            <div style="font-size: 12px; color: #047857; font-weight: 600;">عدد المدربين في التقرير</div>
                            <div style="font-size: 22px; font-weight: 800; color: #065F46;">${rows.length}</div>
                        </div>
                        ${trainerFocus ? `<div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #FEF3C7; border: 1px solid #FCD34D;">
                            <div style="font-size: 12px; color: #B45309; font-weight: 600;">مدرب محدد</div>
                            <div style="font-size: 15px; font-weight: 700; color: #92400E;">${Utils.escapeHTML(trainerFocus)}</div>
                        </div>` : ''}
                    </div>
                </div>
                <div style="margin-bottom: 16px;">
                    <h2 style="font-size: 18px; margin-bottom: 12px; color: #312E81; font-weight: 700; border-bottom: 3px solid #4F46E5; padding-bottom: 8px;">جدول المدربين وعدد البرامج</h2>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; direction: rtl;">
                            <thead>
                                <tr style="background: #312E81; color: #FFFFFF;">
                                    ${headers.map(h => `<th style="padding: 12px 8px; border: 1px solid #1E1B4B; font-weight: 700;">${Utils.escapeHTML(h)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
                ${extraCharts}
                <p style="font-size: 11px; color: #6B7280;">يُحسب عدد البرامج من برامج التدريب ضمن فترة التقرير. «مجموع المشاركين» هو مجموع أعداد المشاركين في تلك البرامج.</p>
            `;
        this._openTrainingAttendancePrint(content, {
            formCode: `TRN-ANL-TRAINERS-${slug}-${new Date().toISOString().slice(0, 10)}`,
            docTitle: 'تقرير المدربين — تحليل التدريب',
            meta: { period: periodAr, rowCount: rows.length, reportType: 'training_analysis_trainers' },
            successMessage: `تم تجهيز تقرير ${rows.length} مدرب للطباعة / PDF`
        });
    },

    exportAnalysisAttendeesPDF() {
        const xctx = this._analysisExportContext;
        const limit = xctx && typeof xctx.limitAttendees === 'number'
            ? Math.min(2000, Math.max(1, xctx.limitAttendees))
            : Math.min(2000, Math.max(1, parseInt(document.getElementById('training-analysis-attendees-limit')?.value || '50', 10) || 50));
        const rows = this.buildAttendancePersonsReportRows().slice(0, limit);
        if (!rows.length) {
            Notification.warning('لا توجد بيانات للتصدير في هذه الفترة');
            return;
        }
        Loading.show('جاري تجهيز PDF...');
        const periodAr = this.getExportPeriodLabelAr();
        const slug = this.getExportPeriodExportSlug();
        const aud = xctx && xctx.audience
            ? xctx.audience
            : (document.getElementById('training-export-audience')?.value || 'all');
        const audienceLabel = { all: 'الكل', employee: 'موظفون فقط', contractor: 'مقاولون/خارجيون' }[aud] || aud;
        const personFocus = xctx
            ? String(xctx.personKey || '').trim()
            : (document.getElementById('training-export-person-key')?.value?.trim() || '');
        const departmentFocus = xctx && xctx.attendanceDepartment
            ? String(xctx.attendanceDepartment).trim()
            : '';
        const attDetail = this.getAttendanceRecordsForReportsFiltered();
        const headers = ['م', 'الشخص', 'عدد الجلسات', 'مجموع الساعات'];
        const matrix = rows.map((r, i) => [
            i + 1,
            r.person,
            r.sessions,
            Number.isFinite(r.totalHours) ? r.totalHours.toFixed(2) : '0.00'
        ]);
        const tableRows = this._analysisPeriodPdfTableRows(matrix);
        let extraBlock = '';
        if (personFocus && attDetail.length) {
            const months = this._buildAttendanceMonthlyChartItems(attDetail);
            const topics = this._buildAttendanceTopicChartItems(attDetail);
            if (months.length) {
                extraBlock += this._buildPrintableBarChartHtml('جلسات هذا الشخص حسب الشهر', months, '#0d9488');
            }
            if (topics.length) {
                extraBlock += this._buildPrintableBarChartHtml('حسب موضوع المحاضرة', topics, '#14b8a6');
            }
            const dh = ['م', 'التاريخ', 'الموضوع', 'نوع التدريب', 'الإدارة', 'المحاضر', 'الساعات'];
            const sorted = [...attDetail].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
            const dmatrix = sorted.map((r, i) => [
                i + 1,
                r.date ? (Utils.formatDate ? Utils.formatDate(r.date) : r.date) : '',
                String(r.topic || '—'),
                String(r.trainingType || '—'),
                this._attendanceRecordDepartmentLabel(r),
                String(r.trainerName || r.trainer || '—'),
                Number.isFinite(parseFloat(r.totalHours)) ? parseFloat(r.totalHours).toFixed(2) : '0.00'
            ]);
            extraBlock += `
                <h2 style="font-size:17px;margin:24px 0 12px;color:#134E4A;font-weight:700;border-bottom:2px solid #0d9488;padding-bottom:6px;">تفصيل الجلسات للشخص المحدد</h2>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:10px;direction:rtl;">
                        <thead><tr style="background:#115e59;color:#fff;">
                            ${dh.map(h => `<th style="padding:8px;border:1px solid #0f766e;">${Utils.escapeHTML(h)}</th>`).join('')}
                        </tr></thead>
                        <tbody>${this._analysisPeriodPdfTableRows(dmatrix)}</tbody>
                    </table>
                </div>`;
        }
        const content = `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #F0FDFA; border: 1px solid #99F6E4;">
                            <div style="font-size: 12px; color: #0F766E; font-weight: 600;">فترة التقرير</div>
                            <div style="font-size: 15px; font-weight: 700; color: #134E4A;">${Utils.escapeHTML(periodAr)}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #ECFEFF; border: 1px solid #A5F3FC;">
                            <div style="font-size: 12px; color: #0E7490; font-weight: 600;">عدد الأشخاص في التقرير</div>
                            <div style="font-size: 22px; font-weight: 800; color: #155E75;">${rows.length}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;">
                            <div style="font-size: 12px; color: #475569; font-weight: 600;">الفئة</div>
                            <div style="font-size: 15px; font-weight: 700; color: #1e293b;">${Utils.escapeHTML(audienceLabel)}</div>
                        </div>
                        ${departmentFocus ? `<div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a;">
                            <div style="font-size: 12px; color: #92400e; font-weight: 600;">الإدارة</div>
                            <div style="font-size: 15px; font-weight: 700; color: #78350f;">${Utils.escapeHTML(departmentFocus)}</div>
                        </div>` : ''}
                    </div>
                </div>
                <div style="margin-bottom: 16px;">
                    <h2 style="font-size: 18px; margin-bottom: 12px; color: #134E4A; font-weight: 700; border-bottom: 3px solid #0D9488; padding-bottom: 8px;">جدول المتدربين — سجل الحضور</h2>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; direction: rtl;">
                            <thead>
                                <tr style="background: #0F766E; color: #FFFFFF;">
                                    ${headers.map(h => `<th style="padding: 12px 8px; border: 1px solid #115E59; font-weight: 700;">${Utils.escapeHTML(h)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                </div>
                ${extraBlock}
                <p style="font-size: 11px; color: #6B7280;">البيانات من سجل الحضور وفق خيارات الفترة والفئة${departmentFocus ? ' والإدارة' : ''} أعلاه.</p>
            `;
        this._openTrainingAttendancePrint(content, {
            formCode: `TRN-ANL-ATTENDEES-${slug}-${new Date().toISOString().slice(0, 10)}`,
            docTitle: 'تقرير المتدربين — تحليل التدريب',
            meta: { period: periodAr, rowCount: rows.length, reportType: 'training_analysis_attendees', department: departmentFocus || undefined },
            successMessage: `تم تجهيز تقرير ${rows.length} شخص للطباعة / PDF`
        });
    },

    renderTrainingAnalysisCharts(enabledItems) {
        if (typeof Chart === 'undefined') {
            Utils.safeWarn('Chart.js غير متاح - لن يتم رسم الرسوم البيانية');
            return;
        }

        // تدمير الرسوم البيانية السابقة إن وجدت
        if (this.trainingAnalysisCharts) {
            Object.values(this.trainingAnalysisCharts).forEach(ch => {
                if (ch && typeof ch.destroy === 'function') {
                    ch.destroy();
                }
            });
        }
        this.trainingAnalysisCharts = {};

        enabledItems.forEach((item, index) => {
            const chartId = `training-chart-${item.id}-${index}`;
            const canvas = document.getElementById(chartId);
            if (!canvas) return;

            const analysisData = this.analyzeTrainingByItem(item);
            if (!analysisData || analysisData.length === 0) {
                canvas.parentElement.innerHTML = '<p class="text-center text-gray-500">لا توجد بيانات كافية</p>';
                return;
            }

            const labels = analysisData.map(d => d.label);
            const values = analysisData.map(d => d.count);
            
            const chartType = item.chartType === 'auto' ? (labels.length > 5 ? 'bar' : 'doughnut') : item.chartType;

            try {
                const chart = new Chart(canvas, {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            label: item.label,
                            data: values,
                            backgroundColor: this.getChartColors(labels.length),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: chartType === 'doughnut' || chartType === 'pie',
                                position: 'bottom'
                            }
                        }
                    }
                });
                
                this.trainingAnalysisCharts[chartId] = chart;
            } catch (error) {
                Utils.safeError('خطأ في رسم الرسم البياني:', error);
            }
        });
    },

    getChartColors(count) {
        const colors = [
            'rgba(59, 130, 246, 0.6)',  // blue
            'rgba(16, 185, 129, 0.6)',  // green
            'rgba(245, 158, 11, 0.6)',  // amber
            'rgba(239, 68, 68, 0.6)',   // red
            'rgba(139, 92, 246, 0.6)',  // purple
            'rgba(236, 72, 153, 0.6)',  // pink
            'rgba(20, 184, 166, 0.6)',  // teal
            'rgba(251, 146, 60, 0.6)',  // orange
            'rgba(99, 102, 241, 0.6)',  // indigo
            'rgba(34, 197, 94, 0.6)'    // emerald
        ];
        
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    },

    resetTrainingCardsToDefault() {
        const keys = this.getTrainingAnalysisStorageKeys();
        const defaultCards = this.getTrainingDefaultAnalysisCards();
        localStorage.setItem(keys.cards, JSON.stringify(defaultCards));
        this.loadTrainingCardsUI();
        Notification.success('تم إعادة تعيين الكروت للافتراضي');
    },
    
    resetTrainingAnalysisItemsToDefault() {
        const keys = this.getTrainingAnalysisStorageKeys();
        const defaultItems = this.getTrainingDefaultAnalysisItems();
        localStorage.setItem(keys.items, JSON.stringify(defaultItems));
        this.loadTrainingAnalysisItemsUI();
        Notification.success('تم إعادة تعيين الرسوم البيانية للافتراضي');
    },
    
    saveTrainingAnalysisSettings() {
        try {
            const keys = this.getTrainingAnalysisStorageKeys();
            
            // حفظ الكروت
            const cards = this.loadTrainingInfoCards();
            let hasChanges = false;
            
            document.querySelectorAll('.training-card-checkbox').forEach(cb => {
                const cardId = cb.getAttribute('data-card-id');
                const card = cards.find(c => c.id === cardId);
                if (card && card.enabled !== cb.checked) {
                    card.enabled = cb.checked;
                    hasChanges = true;
                }
            });
            
            if (hasChanges || cards.length > 0) {
                try {
                    localStorage.setItem(keys.cards, JSON.stringify(cards));
                } catch (e) {
                    Utils.safeError('خطأ في حفظ كروت التدريب:', e);
                    Notification.error('فشل حفظ إعدادات الكروت: ' + (e.message || 'خطأ غير معروف'));
                    return;
                }
            }
            
            // حفظ الرسوم البيانية
            const raw = localStorage.getItem(keys.items) || '[]';
            let items = [];
            try {
                const parsed = JSON.parse(raw);
                items = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                Utils.safeWarn('خطأ في تحميل عناصر التحليل:', e);
                items = [];
            }
            
            document.querySelectorAll('.training-analysis-item-checkbox').forEach(cb => {
                const itemId = cb.getAttribute('data-item-id');
                const item = items.find(i => i.id === itemId);
                if (item) {
                    item.enabled = cb.checked;
                    hasChanges = true;
                }
            });
            
            if (hasChanges || items.length > 0) {
                try {
                    localStorage.setItem(keys.items, JSON.stringify(items));
                } catch (e) {
                    Utils.safeError('خطأ في حفظ عناصر التحليل:', e);
                    Notification.error('فشل حفظ إعدادات الرسوم البيانية: ' + (e.message || 'خطأ غير معروف'));
                    return;
                }
            }
            
            Notification.success('تم حفظ الإعدادات بنجاح');
            
            // إغلاق النافذة وتحديث التبويب
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                modal.remove();
            }
            
            // تحديث التبويب بعد فترة قصيرة لضمان إزالة الـ modal
            setTimeout(() => {
                this.switchTab('analysis');
            }, 100);
        } catch (error) {
            Utils.safeError('خطأ في حفظ إعدادات تحليل التدريب:', error);
            Notification.error('فشل حفظ الإعدادات: ' + (error.message || 'خطأ غير معروف'));
        }
    },
    
    // تم استبدال renderAnalysisCharts() بالدالة updateTrainingAnalysisResults() الأحدث والأكثر شمولية
    
    // دالة مساعدة لعرض الرسوم البيانية القديمة (للتوافق)
    renderAnalysisCharts_OLD() {
        // تم استبدالها بـ renderAnalysisCharts() الجديدة - تم حذف الكود القديم
    },
    
    // دالة قديمة - لا تستخدم
    oldEnsureChartJSLoaded() {
        // تم استبدالها بـ ensureChartJSLoaded() الجديدة
        return;
    },

    // دالة قديمة - لا تستخدم
    oldRenderAnalysisChartsLegacy() {
        // تم حذف الكود القديم
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-graduation-cap text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">إجمالي البرامج</p>
                            <p class="text-2xl font-bold text-gray-900">${stats.totalTrainings}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-check-circle text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">برامج مكتملة</p>
                            <p class="text-2xl font-bold text-gray-900">${stats.completedTrainings}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-users text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">إجمالي المشاركين</p>
                            <p class="text-2xl font-bold text-gray-900">${stats.totalParticipants}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-briefcase text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">تدريبات المقاولين</p>
                            <p class="text-2xl font-bold text-gray-900">${contractorStats.total}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-chart-pie ml-2"></i>التوزيع حسب الحالة</h3>
                    </div>
                    <div class="card-body">
                        <div id="status-chart-container" style="height: 300px;">
                            <canvas id="status-chart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-chart-bar ml-2"></i>التوزيع حسب النوع</h3>
                    </div>
                    <div class="card-body">
                        <div id="type-chart-container" style="height: 300px;">
                            <canvas id="type-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div class="content-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-chart-line ml-2"></i>التوزيع الشهري</h3>
                </div>
                <div class="card-body">
                    <div id="monthly-chart-container" style="height: 400px;">
                        <canvas id="monthly-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="content-card mt-6">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h3 class="card-title"><i class="fas fa-table ml-2"></i>ملخص الإحصائيات</h3>
                        <button class="btn-primary" onclick="Training.showAnalysisDataModal()">
                            <i class="fas fa-edit ml-2"></i>تعديل بيانات التحليل
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div class="p-4 bg-blue-50 rounded-lg">
                            <p class="text-sm text-gray-600 mb-2">إجمالي ساعات تدريب المقاولين</p>
                            <p class="text-2xl font-bold text-blue-600">${contractorStats.totalHours.toFixed(2)}</p>
                        </div>
                        <div class="p-4 bg-green-50 rounded-lg">
                            <p class="text-sm text-gray-600 mb-2">إجمالي متدربي المقاولين</p>
                            <p class="text-2xl font-bold text-green-600">${contractorStats.totalParticipants}</p>
                        </div>
                        <div class="p-4 bg-purple-50 rounded-lg">
                            <p class="text-sm text-gray-600 mb-2">متوسط المشاركين لكل برنامج</p>
                            <p class="text-2xl font-bold text-purple-600">${stats.totalTrainings > 0 ? (stats.totalParticipants / stats.totalTrainings).toFixed(1) : 0}</p>
                        </div>
                    </div>
                    
                    <!-- إحصائيات سجل التدريب للموظفين -->
                    <div class="border-t border-gray-200 pt-6 mt-6">
                        <h4 class="text-lg font-semibold text-gray-900 mb-4">
                            <i class="fas fa-clipboard-check ml-2"></i>إحصائيات سجل التدريب للموظفين والمقاولين
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div class="p-4 bg-indigo-50 rounded-lg">
                                <p class="text-sm text-gray-600 mb-2">إجمالي سجلات الحضور</p>
                                <p class="text-2xl font-bold text-indigo-600">${attendanceStats.totalRecords}</p>
                            </div>
                            <div class="p-4 bg-teal-50 rounded-lg">
                                <p class="text-sm text-gray-600 mb-2">إجمالي ساعات التدريب</p>
                                <p class="text-2xl font-bold text-teal-600">${attendanceStats.totalHours.toFixed(2)}</p>
                            </div>
                            <div class="p-4 bg-pink-50 rounded-lg">
                                <p class="text-sm text-gray-600 mb-2">عدد الموظفين المدربين</p>
                                <p class="text-2xl font-bold text-pink-600">${attendanceStats.uniqueEmployees.size}</p>
                            </div>
                            <div class="p-4 bg-orange-50 rounded-lg">
                                <p class="text-sm text-gray-600 mb-2">عدد برامج التدريب</p>
                                <p class="text-2xl font-bold text-orange-600">${attendanceStats.uniqueTrainings.size}</p>
                            </div>
                        </div>
                        
                        <!-- التوزيع حسب النوع والمصنع -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <h5 class="font-semibold text-gray-700 mb-3">التوزيع حسب نوع التدريب</h5>
                                <div class="space-y-2">
                                    ${Object.entries(attendanceStats.byType).map(([type, count]) => `
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm text-gray-600">${Utils.escapeHTML(type)}</span>
                                            <span class="font-bold text-gray-900">${count}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <h5 class="font-semibold text-gray-700 mb-3">التوزيع حسب المصنع</h5>
                                <div class="space-y-2 max-h-40 overflow-y-auto">
                                    ${Object.entries(attendanceStats.byFactory).slice(0, 10).map(([factory, count]) => `
                                        <div class="flex items-center justify-between">
                                            <span class="text-sm text-gray-600">${Utils.escapeHTML(factory)}</span>
                                            <span class="font-bold text-gray-900">${count}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- عرض بيانات التحليل المحفوظة -->
                    ${analysisData.notes || analysisData.goals || analysisData.recommendations ? `
                    <div class="border-t border-gray-200 pt-6 mt-6">
                        <h4 class="text-lg font-semibold text-gray-900 mb-4">
                            <i class="fas fa-file-alt ml-2"></i>بيانات التحليل المحفوظة
                        </h4>
                        <div class="space-y-4">
                            ${analysisData.notes ? `
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <h5 class="font-semibold text-gray-700 mb-2">ملاحظات التحليل</h5>
                                <p class="text-sm text-gray-600 whitespace-pre-wrap">${Utils.escapeHTML(analysisData.notes)}</p>
                            </div>
                            ` : ''}
                            ${analysisData.goals ? `
                            <div class="p-4 bg-blue-50 rounded-lg">
                                <h5 class="font-semibold text-blue-700 mb-2">الأهداف</h5>
                                <p class="text-sm text-blue-600 whitespace-pre-wrap">${Utils.escapeHTML(analysisData.goals)}</p>
                            </div>
                            ` : ''}
                            ${analysisData.recommendations ? `
                            <div class="p-4 bg-green-50 rounded-lg">
                                <h5 class="font-semibold text-green-700 mb-2">التوصيات</h5>
                                <p class="text-sm text-green-600 whitespace-pre-wrap">${Utils.escapeHTML(analysisData.recommendations)}</p>
                            </div>
                            ` : ''}
                            ${analysisData.targets ? `
                            <div class="p-4 bg-purple-50 rounded-lg">
                                <h5 class="font-semibold text-purple-700 mb-2">الأهداف المستهدفة</h5>
                                <div class="grid grid-cols-2 gap-4 mt-2">
                                    ${analysisData.targets.totalHours ? `
                                    <div>
                                        <span class="text-sm text-gray-600">عدد ساعات التدريب المستهدفة:</span>
                                        <span class="font-bold text-purple-600 ml-2">${analysisData.targets.totalHours}</span>
                                    </div>
                                    ` : ''}
                                    ${analysisData.targets.totalEmployees ? `
                                    <div>
                                        <span class="text-sm text-gray-600">عدد الموظفين المستهدف:</span>
                                        <span class="font-bold text-purple-600 ml-2">${analysisData.targets.totalEmployees}</span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                            ` : ''}
                            ${analysisData.updatedAt ? `
                            <div class="text-xs text-gray-500 mt-2">
                                آخر تحديث: ${Utils.formatDate(analysisData.updatedAt)} 
                                ${analysisData.updatedBy?.name ? `بواسطة: ${Utils.escapeHTML(analysisData.updatedBy.name)}` : ''}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    async ensureChartJSLoaded() {
        // التحقق من أن Chart.js موجود بالفعل
        if (typeof Chart !== 'undefined') {
            return true;
        }

        // التحقق من وجود script Chart.js في الصفحة
        const existingScript = document.querySelector('script[src*="chart.js"], script[src*="chartjs"]');
        if (existingScript) {
            // انتظار تحميل السكربت الموجود مع زيادة وقت الانتظار
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 60; // 6 ثوانٍ (60 * 100ms)
                
                const checkInterval = setInterval(() => {
                    attempts++;
                    if (typeof Chart !== 'undefined') {
                        clearInterval(checkInterval);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                        resolve(false);
                    }
                }, 100);
            });
        }

        // محاولة تحميل Chart.js من CDN مع fallback options
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            
            // محاولة من jsdelivr أولاً
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
            script.crossOrigin = 'anonymous';
            
            let loaded = false;
            
            const onLoad = () => {
                if (!loaded && typeof Chart !== 'undefined') {
                    loaded = true;
                    resolve(true);
                }
            };
            
            const onError = () => {
                if (loaded) return;
                
                // محاولة fallback من cdnjs
                const fallbackScript = document.createElement('script');
                fallbackScript.type = 'text/javascript';
                fallbackScript.async = true;
                fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
                fallbackScript.crossOrigin = 'anonymous';
                
                let fallbackLoaded = false;
                
                fallbackScript.onload = () => {
                    if (!fallbackLoaded && typeof Chart !== 'undefined') {
                        fallbackLoaded = true;
                        loaded = true;
                        resolve(true);
                    }
                };
                
                fallbackScript.onerror = () => {
                    if (!loaded) {
                        loaded = true;
                        if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                            Utils.safeWarn('فشل تحميل Chart.js من جميع المصادر - سيتم عرض البيانات بدون رسوم بيانية');
                        }
                        resolve(false);
                    }
                };
                
                document.head.appendChild(fallbackScript);
            };
            
            script.onload = () => {
                // إعطاء وقت إضافي للتهيئة مع محاولات متعددة
                let checkAttempts = 0;
                const maxCheckAttempts = 10; // 5 ثوانٍ (10 * 500ms)
                
                const checkChart = setInterval(() => {
                    checkAttempts++;
                    if (!loaded && typeof Chart !== 'undefined') {
                        clearInterval(checkChart);
                        loaded = true;
                        resolve(true);
                    } else if (checkAttempts >= maxCheckAttempts && !loaded) {
                        clearInterval(checkChart);
                        onError();
                    }
                }, 500);
            };
            
            script.onerror = onError;
            
            // timeout عام
            setTimeout(() => {
                if (!loaded) {
                    loaded = true;
                    if (typeof Chart !== 'undefined') {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            }, 8000);
            
            try {
                if (document && document.head) {
                    document.head.appendChild(script);
                } else {
                    resolve(false);
                }
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeError) {
                    Utils.safeError('خطأ في إضافة script Chart.js:', error);
                }
                resolve(false);
            }
        });
    },

    async renderAnalysisCharts() {
        // Wait a bit for DOM to be ready
        setTimeout(async () => {
            this.ensureData();
            const trainings = AppState.appData.training || [];

            // عرض مؤشر تحميل في الحاويات (بدون حذف عناصر canvas)
            const containers = ['status-chart-container', 'type-chart-container', 'monthly-chart-container'];
            const loadingOverlays = [];
            containers.forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    // إنشاء overlay للتحميل بدون حذف canvas
                    const overlay = document.createElement('div');
                    overlay.className = 'absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10';
                    overlay.innerHTML = '<div class="text-center text-gray-500"><div style="width: 300px; margin: 0 auto 16px;"><div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;"><div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div></div></div><p class="text-sm">جاري تحميل الرسوم البيانية...</p></div>';
                    overlay.style.position = 'absolute';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.right = '0';
                    overlay.style.bottom = '0';
                    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                    overlay.style.display = 'flex';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';
                    overlay.style.zIndex = '10';
                    
                    // التأكد من أن الحاوية relative
                    if (container.style.position !== 'relative' && container.style.position !== 'absolute') {
                        container.style.position = 'relative';
                    }
                    
                    container.appendChild(overlay);
                    loadingOverlays.push({ container, overlay });
                }
            });

            // محاولة تحميل Chart.js مع إعادة محاولة
            let chartLoaded = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!chartLoaded && attempts < maxAttempts) {
                attempts++;
                chartLoaded = await this.ensureChartJSLoaded();
                
                if (!chartLoaded && typeof Chart === 'undefined') {
                    // انتظار قليل قبل إعادة المحاولة
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } else {
                    break;
                }
            }

            // إزالة مؤشرات التحميل
            loadingOverlays.forEach(({ overlay }) => {
                if (overlay && overlay.parentNode) {
                    overlay.remove();
                }
            });

            // التحقق النهائي من Chart.js
            if (!chartLoaded || typeof Chart === 'undefined') {
                // إذا فشل التحميل بعد جميع المحاولات، عرض رسالة واضحة
                containers.forEach(containerId => {
                    const container = document.getElementById(containerId);
                    if (container) {
                        // حذف canvas إذا كان موجوداً
                        const canvas = container.querySelector('canvas');
                        if (canvas) {
                            canvas.remove();
                        }
                        container.innerHTML = '<div class="text-center text-gray-500 py-8"><i class="fas fa-exclamation-triangle text-4xl mb-4 text-yellow-500"></i><p class="text-sm">تعذر تحميل مكتبة الرسوم البيانية</p><p class="text-xs mt-2 text-gray-400">يرجى تحديث الصفحة أو التحقق من الاتصال بالإنترنت</p></div>';
                    }
                });
                return;
            }

            // Status chart
            const statusData = {};
            trainings.forEach(t => {
                const status = t.status || 'غير محدد';
                statusData[status] = (statusData[status] || 0) + 1;
            });

            const statusCtx = document.getElementById('status-chart');
            if (statusCtx && Object.keys(statusData).length > 0) {
                new Chart(statusCtx, {
                    type: 'pie',
                    data: {
                        labels: Object.keys(statusData),
                        datasets: [{
                            data: Object.values(statusData),
                            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            } else if (statusCtx) {
                statusCtx.parentElement.innerHTML = '<div class="text-center text-gray-500 py-8"><p>لا توجد بيانات للعرض</p></div>';
            }

            // Type chart
            const typeData = {};
            trainings.forEach(t => {
                const type = t.trainingType || 'داخلي';
                typeData[type] = (typeData[type] || 0) + 1;
            });

            const typeCtx = document.getElementById('type-chart');
            if (typeCtx && Object.keys(typeData).length > 0) {
                new Chart(typeCtx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(typeData),
                        datasets: [{
                            label: 'عدد البرامج',
                            data: Object.values(typeData),
                            backgroundColor: '#3b82f6'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            } else if (typeCtx) {
                typeCtx.parentElement.innerHTML = '<div class="text-center text-gray-500 py-8"><p>لا توجد بيانات للعرض</p></div>';
            }

            // Monthly chart
            const monthlyData = {};
            trainings.forEach(t => {
                if (t.startDate) {
                    const date = new Date(t.startDate);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
                }
            });

            const sortedMonths = Object.keys(monthlyData).sort();
            const monthlyCtx = document.getElementById('monthly-chart');
            if (monthlyCtx && sortedMonths.length > 0) {
                new Chart(monthlyCtx, {
                    type: 'line',
                    data: {
                        labels: sortedMonths,
                        datasets: [{
                            label: 'عدد البرامج',
                            data: sortedMonths.map(m => monthlyData[m]),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            } else if (monthlyCtx) {
                monthlyCtx.parentElement.innerHTML = '<div class="text-center text-gray-500 py-8"><p>لا توجد بيانات للعرض</p></div>';
            }
        }, 300);
    },
    
    async renderAttendanceRegistry() {
        const attendanceAnalyticsModel = this.getAttendanceAnalyticsModel('');
        const attendanceAnalyticsState = this.getAttendanceAnalyticsState();
        return `
            <!-- فلتر الشهر لتحليل سجل التدريب -->
            <div class="content-card mb-4">
                <div class="card-body">
                    <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700">تصفية حسب الشهر (للتحليل التفاعلي):</label>
                        <select id="attendance-month-filter" class="form-input" style="max-width: 200px;">
                            <option value="">جميع الأشهر</option>
                            ${this.getAttendanceMonthOptions()}
                        </select>
                        <button id="reset-attendance-filter" class="btn-secondary"><i class="fas fa-redo ml-2"></i>إعادة تعيين</button>
                    </div>
                </div>
            </div>

            <!-- تحليل تفاعلي لسجل التدريب للموظفين (Slicers + Pivot + Drill-down) -->
            <div class="content-card mb-4">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-layer-group ml-2"></i>تحليل تفاعلي لسجل التدريب للموظفين (Slicers + Pivot + Drill-down)</h3>
                </div>
                <div class="card-body" style="padding: 12px;">
                    <div id="attendance-analytics-dashboard">
                        ${this.renderAttendanceAnalyticsDashboard(attendanceAnalyticsModel, attendanceAnalyticsState)}
                    </div>
                </div>
            </div>

            <div class="content-card">
                <div class="card-header">
                    <div class="flex items-center justify-between">
                        <h2 class="card-title"><i class="fas fa-clipboard-check ml-2"></i>سجل التدريب للموظفين</h2>
                        <div class="flex items-center gap-2">
                            <button id="attendance-registry-add-record" class="btn-primary">
                                <i class="fas fa-plus ml-2"></i>
                                إضافة سجل
                            </button>
                            <button id="attendance-registry-import-excel" class="btn-secondary">
                                <i class="fas fa-file-import ml-2"></i>
                                استيراد Excel
                            </button>
                            <button id="attendance-registry-export-excel" class="btn-secondary">
                                <i class="fas fa-file-excel ml-2"></i>
                                تصدير Excel
                            </button>
                            <button id="attendance-registry-export-pdf" class="btn-primary">
                                <i class="fas fa-file-pdf ml-2"></i>
                                تصدير PDF
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="mb-4 flex items-center gap-4">
                        <input type="text" id="attendance-registry-search" class="form-input" style="max-width: 300px;" placeholder="البحث...">
                        <select id="attendance-registry-filter-factory" class="form-input" style="max-width: 200px;">
                            <option value="">جميع المصانع</option>
                            ${this.getSiteOptions().map(site => `
                                <option value="${Utils.escapeHTML(site.id)}">${Utils.escapeHTML(site.name)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table" id="attendance-registry-table">
                            <thead>
                                <tr>
                                    <th>م</th>
                                    <th>التاريخ</th>
                                    <th>نوع التدريب</th>
                                    <th>المصنع</th>
                                    <th>الكود</th>
                                    <th>الاسم</th>
                                    <th>الوظيفة</th>
                                    <th>الإدارة</th>
                                    <th>موضوع المحاضرة</th>
                                    <th>اسم المحاضر</th>
                                    <th>وقت البدء</th>
                                    <th>وقت الانتهاء</th>
                                    <th>إجمالي ساعات التدريب</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="attendance-registry-table-body">
                                <tr>
                                    <td colspan="14" class="text-center text-gray-500 py-4">جاري التحميل...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * تحميل سجل التدريب للموظفين
     */
    loadAttendanceRegistry() {
        this.ensureData();
        const container = document.getElementById('attendance-registry-table-body');
        if (!container) return;

        const registry = AppState.appData.trainingAttendance || [];
        
        if (registry.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="14" class="text-center text-gray-500 py-6">لا توجد سجلات تدريب حتى الآن</td>
                </tr>
            `;
            return;
        }
        
        // تطبيق الفلاتر
        const searchTerm = (document.getElementById('attendance-registry-search')?.value || '').toLowerCase();
        const filterFactory = document.getElementById('attendance-registry-filter-factory')?.value || '';
        
        const filtered = registry.filter(record => {
            const matchesSearch = !searchTerm || 
                (record.employeeName || '').toLowerCase().includes(searchTerm) ||
                (record.employeeCode || '').toLowerCase().includes(searchTerm) ||
                (record.topic || '').toLowerCase().includes(searchTerm) ||
                (record.trainer || '').toLowerCase().includes(searchTerm);
            
            const matchesFactory = !filterFactory || record.factory === filterFactory || record.factoryName === filterFactory;
            
            return matchesSearch && matchesFactory;
        });
        
        container.innerHTML = filtered.map((record, index) => {
            const date = record.date ? Utils.formatDate(record.date) : '-';
            let startTime = this.cleanTime(record.startTime) || '-';
            let endTime = this.cleanTime(record.endTime) || '-';
            
            // التأكد من عدم ظهور NaN
            if (startTime === 'NaN:NaN' || startTime.includes('NaN')) {
                startTime = '-';
            }
            if (endTime === 'NaN:NaN' || endTime.includes('NaN')) {
                endTime = '-';
            }
            
            const totalHours = record.totalHours || record.hours || '0';
            
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${date}</td>
                    <td>${Utils.escapeHTML(record.trainingType || 'داخلي')}</td>
                    <td>${Utils.escapeHTML(record.factoryName || record.factory || '-')}</td>
                    <td>${Utils.escapeHTML(record.employeeCode || '-')}</td>
                    <td>${Utils.escapeHTML(record.employeeName || '-')}</td>
                    <td>${Utils.escapeHTML(record.position || '-')}</td>
                    <td>${Utils.escapeHTML(record.department || '-')}</td>
                    <td>${Utils.escapeHTML(record.topic || '-')}</td>
                    <td>${Utils.escapeHTML(record.trainer || '-')}</td>
                    <td>${startTime}</td>
                    <td>${endTime}</td>
                    <td>${totalHours} ساعة</td>
                    <td>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button class="btn-secondary btn-sm" onclick="Training.viewAttendanceRecordDetails('${Utils.escapeHTML(String(record.id || ''))}')" title="عرض التفاصيل وجميع تدريبات الموظف" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.875rem;">
                                <i class="fas fa-eye"></i>
                                <span>عرض التفاصيل</span>
                            </button>
                            <button class="btn-icon btn-icon-primary" onclick="Training.editAttendanceRecord('${Utils.escapeHTML(String(record.id || ''))}')" title="تعديل">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-icon-danger" onclick="Training.deleteAttendanceRecord('${Utils.escapeHTML(String(record.id || ''))}')" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // إعداد المستمعين
        this.setupAttendanceRegistryListeners();
    },
    
    /**
     * إعداد مستمعي أحداث سجل التدريب
     */
    setupAttendanceRegistryListeners() {
        // البحث
        const searchInput = document.getElementById('attendance-registry-search');
        if (searchInput) {
            searchInput.oninput = () => this.loadAttendanceRegistry();
        }
        
        // فلتر المصنع
        const filterFactory = document.getElementById('attendance-registry-filter-factory');
        if (filterFactory) {
            filterFactory.onchange = () => this.loadAttendanceRegistry();
        }
        
        // إضافة سجل جديد
        const addRecordBtn = document.getElementById('attendance-registry-add-record');
        if (addRecordBtn) {
            addRecordBtn.onclick = () => this.showAddAttendanceRecordModal();
        }
        
        // استيراد Excel
        const importBtn = document.getElementById('attendance-registry-import-excel');
        if (importBtn) {
            importBtn.onclick = () => this.showImportAttendanceExcelModal();
        }
        
        // تصدير Excel
        const exportExcelBtn = document.getElementById('attendance-registry-export-excel');
        if (exportExcelBtn) {
            exportExcelBtn.onclick = () => this.exportAttendanceRegistryToExcel();
        }
        
        // تصدير PDF
        const exportPdfBtn = document.getElementById('attendance-registry-export-pdf');
        if (exportPdfBtn) {
            exportPdfBtn.onclick = () => this.exportAttendanceRegistryToPDF();
        }
    },
    
    /**
     * مزامنة سجل التدريب مع برنامج تدريبي
     */
    syncAttendanceRegistry(training) {
        if (!training || !training.participants || !Array.isArray(training.participants)) return;
        
        this.ensureData();
        if (!Array.isArray(AppState.appData.trainingAttendance)) {
            AppState.appData.trainingAttendance = [];
        }
        
        training.participants.forEach(participant => {
            // التحقق من عدم وجود سجل مكرر
            const existing = AppState.appData.trainingAttendance.find(r => 
                r.trainingId === training.id && 
                r.employeeCode === (participant.code || participant.employeeCode)
            );
            
            const cleanedStartTime = this.cleanTime(training.startTime);
            const cleanedEndTime = this.cleanTime(training.endTime);
            
            if (existing) {
                // تحديث السجل الموجود
                existing.date = training.startDate || training.date;
                existing.trainingType = training.trainingType || 'داخلي';
                existing.factory = training.factory;
                existing.factoryName = training.factoryName;
                existing.employeeCode = participant.code || participant.employeeCode || participant.employeeNumber;
                existing.employeeName = participant.name;
                existing.position = participant.position;
                existing.department = participant.department;
                existing.topic = training.name;
                existing.trainer = training.trainer;
                existing.startTime = cleanedStartTime;
                existing.endTime = cleanedEndTime;
                existing.totalHours = training.hours || this.calculateTrainingHours(cleanedStartTime, cleanedEndTime);
                existing.updatedAt = new Date().toISOString();
            } else {
                // إضافة سجل جديد
                const record = {
                    id: Utils.generateId('ATT'),
                    trainingId: training.id,
                    date: training.startDate || training.date,
                    trainingType: training.trainingType || 'داخلي',
                    factory: training.factory,
                    factoryName: training.factoryName,
                    employeeCode: participant.code || participant.employeeCode || participant.employeeNumber,
                    employeeName: participant.name,
                    position: participant.position,
                    department: participant.department,
                    topic: training.name,
                    trainer: training.trainer,
                    startTime: cleanedStartTime,
                    endTime: cleanedEndTime,
                    totalHours: training.hours || this.calculateTrainingHours(cleanedStartTime, cleanedEndTime),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                AppState.appData.trainingAttendance.push(record);
            }
        });
    },
    
    /**
     * مزامنة جميع سجلات التدريب
     */
    syncAllAttendanceRegistry() {
        const trainings = AppState.appData.training || [];
        trainings.forEach(training => {
            this.syncAttendanceRegistry(training);
        });
    },
    
    /**
     * تنظيف الوقت من تنسيق ISO إلى HH:MM
     */
    cleanTime(timeValue) {
        if (!timeValue) return '';
        
        // تحويل إلى سلسلة نصية إذا لم تكن كذلك
        const timeStr = String(timeValue).trim();
        if (!timeStr) return '';
        
        // إذا كان ISO date كامل (مثل "1899-12-30T14:24:51.000Z" أو "2024-01-01T14:30:00")
        if (timeStr.includes('T')) {
            try {
                // محاولة استخراج الوقت مباشرة من السلسلة أولاً (أكثر موثوقية)
                const timeMatch = timeStr.match(/T(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z)?/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    }
                }
                
                // محاولة استخدام Date object كحل بديل
                const date = new Date(timeStr);
                // التحقق من أن التاريخ صحيح
                if (!isNaN(date.getTime())) {
                    const hours = date.getUTCHours();
                    const minutes = date.getUTCMinutes();
                    // التحقق من أن القيم صحيحة وليست NaN
                    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    }
                }
            } catch (e) {
                // محاولة استخراج الوقت مباشرة من السلسلة في حالة الخطأ
                const timeMatch = timeStr.match(/T(\d{1,2}):(\d{2})/);
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1], 10);
                    const minutes = parseInt(timeMatch[2], 10);
                    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                    }
                }
            }
        }
        
        // إذا كان بالفعل بتنسيق HH:MM أو H:MM
        const timeFormatMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (timeFormatMatch) {
            const hours = parseInt(timeFormatMatch[1], 10);
            const minutes = parseInt(timeFormatMatch[2], 10);
            if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        }
        
        // محاولة استخراج الوقت من أي تنسيق آخر (مثل "14:30:00" أو "14.30")
        const alternativeMatch = timeStr.match(/(\d{1,2})[:.](\d{2})/);
        if (alternativeMatch) {
            const hours = parseInt(alternativeMatch[1], 10);
            const minutes = parseInt(alternativeMatch[2], 10);
            if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        }
        
        return '';
    },
    
    /**
     * حساب ساعات التدريب
     */
    calculateTrainingHours(startTime, endTime) {
        if (!startTime || !endTime) return '0';
        try {
            // تنظيف الأوقات أولاً
            const cleanedStart = this.cleanTime(startTime);
            const cleanedEnd = this.cleanTime(endTime);
            
            if (!cleanedStart || !cleanedEnd) return '0';
            
            const start = new Date(`2000-01-01T${cleanedStart}:00`);
            const end = new Date(`2000-01-01T${cleanedEnd}:00`);
            if (end <= start) return '0';
            const hours = (end - start) / (1000 * 60 * 60);
            return hours.toFixed(2);
        } catch (e) {
            return '0';
        }
    },
    
    /**
     * تصدير سجل التدريب إلى Excel
     */
    async exportAttendanceRegistryToExcel() {
        try {
            this.ensureData();
            const registry = AppState.appData.trainingAttendance || [];
            
            if (registry.length === 0) {
                Notification.warning('لا توجد بيانات للتصدير');
                return;
            }
            
            if (typeof XLSX === 'undefined') {
                Notification.error('مكتبة Excel غير متوفرة. يرجى التأكد من تحميل المكتبة.');
                return;
            }
            
            Loading.show('جاري تصدير البيانات...');
            
            const data = registry.map((record, index) => ({
                'م': index + 1,
                'التاريخ': record.date ? Utils.formatDate(record.date) : '',
                'نوع التدريب': record.trainingType || 'داخلي',
                'المصنع': record.factoryName || record.factory || '',
                'الكود': record.employeeCode || '',
                'الاسم': record.employeeName || '',
                'الوظيفة': record.position || '',
                'الإدارة': record.department || '',
                'موضوع المحاضرة': record.topic || '',
                'اسم المحاضر': record.trainer || '',
                'وقت البدء': this.cleanTime(record.startTime) || '',
                'وقت الانتهاء': this.cleanTime(record.endTime) || '',
                'إجمالي ساعات التدريب': record.totalHours || '0'
            }));
            
            const ws = XLSX.utils.json_to_sheet(data);
            
            // تعيين عرض الأعمدة
            ws['!cols'] = [
                { wch: 5 },   // م
                { wch: 12 },  // التاريخ
                { wch: 12 },  // نوع التدريب
                { wch: 15 },  // المصنع
                { wch: 12 },  // الكود
                { wch: 20 },  // الاسم
                { wch: 15 },  // الوظيفة
                { wch: 15 },  // الإدارة
                { wch: 25 },  // موضوع المحاضرة
                { wch: 15 },  // اسم المحاضر
                { wch: 10 },  // وقت البدء
                { wch: 10 },  // وقت الانتهاء
                { wch: 15 }   // إجمالي ساعات التدريب
            ];
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'سجل التدريب');
            
            const fileName = `سجل_التدريب_للموظفين_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            Loading.hide();
            Notification.success(`تم تصدير ${registry.length} سجل إلى Excel بنجاح`);
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification.error('فشل تصدير Excel: ' + (error.message || 'خطأ غير معروف'));
        }
    },
    
    /**
     * تصدير سجل التدريب إلى PDF
     */
    async exportAttendanceRegistryToPDF() {
        try {
            this.ensureData();
            const registry = AppState.appData.trainingAttendance || [];
            
            if (registry.length === 0) {
                Notification.warning('لا توجد بيانات للتصدير');
                return;
            }
            
            Loading.show('جاري تصدير PDF...');
            
            // إعداد البيانات
            const headers = ['م', 'التاريخ', 'نوع التدريب', 'المصنع', 'الكود', 'الاسم', 'الوظيفة', 'الإدارة', 'موضوع المحاضرة', 'اسم المحاضر', 'وقت البدء', 'وقت الانتهاء', 'إجمالي الساعات'];
            const rows = registry.map((record, index) => [
                index + 1,
                record.date ? Utils.formatDate(record.date) : '',
                record.trainingType || 'داخلي',
                record.factoryName || record.factory || '',
                record.employeeCode || '',
                record.employeeName || '',
                record.position || '',
                record.department || '',
                record.topic || '',
                record.trainer || '',
                this.cleanTime(record.startTime) || '',
                this.cleanTime(record.endTime) || '',
                (record.totalHours || '0') + ' ساعة'
            ]);
            
            // بناء محتوى HTML للطباعة
            const tableRows = rows.map((row, idx) => `
                <tr style="${idx % 2 === 0 ? 'background-color: #FFFFFF;' : 'background-color: #F9FAFB;'}">
                    ${row.map(cell => `<td style="padding: 10px 8px; border: 1px solid #E5E7EB; text-align: center; font-size: 11px; line-height: 1.5;">${Utils.escapeHTML(String(cell))}</td>`).join('')}
                </tr>
            `).join('');
            
            const content = `
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #EFF6FF; border: 1px solid #BFDBFE;">
                            <div style="font-size: 12px; color: #1D4ED8; margin-bottom: 6px; font-weight: 600;">عدد السجلات</div>
                            <div style="font-size: 24px; font-weight: 700; color: #1E3A8A;">${registry.length}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 12px 16px; border-radius: 8px; background: #ECFDF5; border: 1px solid #BBF7D0;">
                            <div style="font-size: 12px; color: #047857; margin-bottom: 6px; font-weight: 600;">تاريخ الإصدار</div>
                            <div style="font-size: 16px; font-weight: 600; color: #065F46;">${Utils.formatDate(new Date().toISOString())}</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 24px;">
                    <h2 style="font-size: 20px; margin-bottom: 16px; color: #1E3A8A; font-weight: 700; border-bottom: 3px solid #1E3A8A; padding-bottom: 8px;">جدول سجل التدريب للموظفين</h2>
                    <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px; direction: rtl; min-width: 100%;">
                            <thead>
                                <tr style="background: #1E3A8A; color: #FFFFFF;">
                                    ${headers.map(header => `<th style="padding: 12px 8px; border: 1px solid #1E40AF; text-align: center; font-weight: 700; white-space: nowrap; font-size: 11px;">${Utils.escapeHTML(header)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            const formCode = `TRAINING-ATTENDANCE-${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(
                    formCode,
                    'سجل التدريب للموظفين',
                    content,
                    false,
                    true,
                    { 
                        version: '1.0',
                        recordCount: registry.length
                    },
                    new Date().toISOString(),
                    new Date().toISOString()
                )
                : `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>سجل التدريب للموظفين</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        @media print {
                            @page { 
                                margin: 1.5cm 1cm; 
                                size: A4 landscape; 
                            }
                            body { 
                                margin: 0; 
                                padding: 15px; 
                            }
                            .no-print { 
                                display: none !important; 
                            }
                        }
                        * {
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                            direction: rtl;
                            text-align: right;
                            padding: 20px;
                            color: #1f2937;
                            line-height: 1.6;
                            margin: 0;
                            background: #ffffff;
                        }
                        h1, h2 {
                            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                            font-weight: 700;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                            font-size: 11px;
                            direction: rtl;
                            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                        }
                        th, td {
                            padding: 10px 8px;
                            border: 1px solid #E5E7EB;
                            text-align: center;
                            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
                        }
                        thead th {
                            background-color: #1E3A8A;
                            color: #FFFFFF;
                            font-weight: 700;
                            font-size: 11px;
                            white-space: nowrap;
                        }
                        tbody tr:nth-child(even) {
                            background-color: #F9FAFB;
                        }
                        tbody tr:hover {
                            background-color: #F3F4F6;
                        }
                        tbody td {
                            font-size: 11px;
                            line-height: 1.5;
                        }
                    </style>
                </head>
                <body>
                    <h1 style="text-align: center; color: #1E3A8A; margin-bottom: 20px; font-size: 24px;">سجل التدريب للموظفين</h1>
                    ${content}
                </body>
                </html>
            `;
            
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
                            Notification.success(`تم تجهيز ${registry.length} سجل للطباعة`);
                        }, 1000);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + (error.message || 'خطأ غير معروف'));
        }
    },
    
    /**
     * عرض نافذة استيراد Excel
     */
    showImportAttendanceExcelModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-file-import ml-2"></i>استيراد سجل التدريب من ملف Excel</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <p class="text-sm text-blue-800 mb-2"><strong>تعليمات الاستيراد:</strong></p>
                        <p class="text-sm text-blue-700">يجب أن يحتوي ملف Excel على الأعمدة التالية:</p>
                        <ul class="text-sm text-blue-700 list-disc mr-6 mt-2 space-y-1">
                            <li>التاريخ / Date</li>
                            <li>نوع التدريب / Training Type</li>
                            <li>المصنع / Factory</li>
                            <li>الكود / Employee Code</li>
                            <li>الاسم / Employee Name</li>
                            <li>الوظيفة / Position</li>
                            <li>الإدارة / Department</li>
                            <li>موضوع المحاضرة / Topic</li>
                            <li>اسم المحاضر / Trainer</li>
                            <li>وقت البدء / Start Time</li>
                            <li>وقت الانتهاء / End Time</li>
                            <li>إجمالي ساعات التدريب / Total Hours</li>
                        </ul>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            <i class="fas fa-file-excel ml-2"></i>
                            اختر ملف Excel (.xlsx, .xls)
                        </label>
                        <input type="file" id="attendance-excel-file-input" accept=".xlsx,.xls" class="form-input">
                    </div>
                    <div id="attendance-import-preview" class="hidden">
                        <h3 class="text-sm font-semibold mb-2">معاينة البيانات (أول 5 صفوف):</h3>
                        <div class="max-h-60 overflow-auto border rounded">
                            <table class="data-table text-xs">
                                <thead id="attendance-preview-head"></thead>
                                <tbody id="attendance-preview-body"></tbody>
                            </table>
                        </div>
                        <p id="attendance-preview-count" class="text-sm text-gray-600 mt-2"></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button id="attendance-import-confirm-btn" class="btn-primary" disabled>
                        <i class="fas fa-upload ml-2"></i>استيراد البيانات
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const fileInput = modal.querySelector('#attendance-excel-file-input');
        const confirmBtn = modal.querySelector('#attendance-import-confirm-btn');
        const previewContainer = modal.querySelector('#attendance-import-preview');
        const previewHead = modal.querySelector('#attendance-preview-head');
        const previewBody = modal.querySelector('#attendance-preview-body');
        const previewCount = modal.querySelector('#attendance-preview-count');

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
                modal.remove();
            }
        });

        const handleFileChange = async (event) => {
            const file = event.target.files?.[0];
            resetPreview();
            if (!file) return;

            if (typeof XLSX === 'undefined') {
                Notification.error('مكتبة Excel غير متوفرة. يرجى التأكد من تحميل المكتبة.');
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
                    Notification.error('الملف فارغ أو لا يحتوي على بيانات');
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
                Notification.error('فشل قراءة الملف: ' + (error.message || 'خطأ غير معروف'));
            }
        };

        if (fileInput) {
            fileInput.addEventListener('change', handleFileChange);
        }

        confirmBtn?.addEventListener('click', async () => {
            if (importedRows.length === 0) {
                Notification.warning('يرجى اختيار ملف يحتوي على بيانات قبل الاستيراد.');
                return;
            }
            await this.importAttendanceRegistryFromExcel(importedRows, modal);
        });
    },
    
    /**
     * استيراد البيانات من Excel إلى سجل التدريب
     */
    async importAttendanceRegistryFromExcel(rows, modal) {
        if (!rows || rows.length === 0) {
            Notification.error('لا توجد بيانات للاستيراد');
            return;
        }

        try {
            Loading.show('جاري استيراد البيانات...');
            this.ensureData();
            
            if (!Array.isArray(AppState.appData.trainingAttendance)) {
                AppState.appData.trainingAttendance = [];
            }
            
            let imported = 0;
            let updated = 0;
            let errors = 0;

            const columnMap = {
                date: ['التاريخ', 'Date', 'date', 'تاريخ'],
                trainingType: ['نوع التدريب', 'Training Type', 'trainingType', 'نوع'],
                factory: ['المصنع', 'Factory', 'factory', 'المصنع'],
                employeeCode: ['الكود', 'Employee Code', 'employeeCode', 'الكود', 'كود'],
                employeeName: ['الاسم', 'Employee Name', 'employeeName', 'الاسم', 'اسم'],
                position: ['الوظيفة', 'Position', 'position', 'الوظيفة'],
                department: ['الإدارة', 'Department', 'department', 'الإدارة'],
                topic: ['موضوع المحاضرة', 'Topic', 'topic', 'الموضوع'],
                trainer: ['اسم المحاضر', 'Trainer', 'trainer', 'المحاضر'],
                startTime: ['وقت البدء', 'Start Time', 'startTime', 'بدء'],
                endTime: ['وقت الانتهاء', 'End Time', 'endTime', 'انتهاء'],
                totalHours: ['إجمالي ساعات التدريب', 'Total Hours', 'totalHours', 'الساعات', 'ساعات']
            };

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

            const parseDate = (dateValue) => {
                if (!dateValue) return null;
                if (dateValue instanceof Date) return dateValue.toISOString();
                if (typeof dateValue === 'string') {
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
                    const date = parseDate(findColumn(row, columnMap.date));
                    const trainingType = findColumn(row, columnMap.trainingType) || 'داخلي';
                    const factory = findColumn(row, columnMap.factory) || '';
                    const employeeCode = findColumn(row, columnMap.employeeCode) || '';
                    const employeeName = findColumn(row, columnMap.employeeName) || '';
                    
                    if (!employeeCode || !employeeName) {
                        errors++;
                        continue;
                    }
                    
                    // البحث عن سجل موجود
                    const existingIndex = AppState.appData.trainingAttendance.findIndex(r => 
                        r.employeeCode === employeeCode &&
                        r.date === date &&
                        r.topic === findColumn(row, columnMap.topic)
                    );
                    
                    const record = {
                        id: existingIndex >= 0 ? AppState.appData.trainingAttendance[existingIndex].id : Utils.generateId('ATT'),
                        trainingId: null,
                        date: date || new Date().toISOString(),
                        trainingType: trainingType,
                        factory: factory,
                        factoryName: factory,
                        employeeCode: employeeCode,
                        employeeName: employeeName,
                        position: findColumn(row, columnMap.position) || '',
                        department: findColumn(row, columnMap.department) || '',
                        topic: findColumn(row, columnMap.topic) || '',
                        trainer: findColumn(row, columnMap.trainer) || '',
                        startTime: this.cleanTime(findColumn(row, columnMap.startTime) || ''),
                        endTime: this.cleanTime(findColumn(row, columnMap.endTime) || ''),
                        totalHours: findColumn(row, columnMap.totalHours) || this.calculateTrainingHours(
                            findColumn(row, columnMap.startTime),
                            findColumn(row, columnMap.endTime)
                        ),
                        createdAt: existingIndex >= 0 ? AppState.appData.trainingAttendance[existingIndex].createdAt : new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    if (existingIndex >= 0) {
                        AppState.appData.trainingAttendance[existingIndex] = record;
                        updated++;
                    } else {
                        AppState.appData.trainingAttendance.push(record);
                        imported++;
                    }
                } catch (error) {
                    errors++;
                    Utils.safeError('خطأ في معالجة صف:', error);
                }
            }

            // حفظ البيانات
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                await window.DataManager.save();
            }

            // حفظ تلقائي في Google Sheets
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                await GoogleIntegration.autoSave('TrainingAttendance', AppState.appData.trainingAttendance).catch(err => {
                    Utils.safeWarn('⚠️ فشل حفظ سجل التدريب في Google Sheets:', err);
                    Notification.error('فشل حفظ سجل التدريب في Google Sheets. سيتم الاحتفاظ بالتغييرات محلياً فقط حتى يتم الحفظ بنجاح.');
                });
            }

            // تحديث الواجهة
            this.loadAttendanceRegistry();

            Loading.hide();
            if (modal && modal.parentNode) {
                modal.remove();
            }

            // رسالة النجاح
            const successMessage = `تم الاستيراد بنجاح!\n` +
                `- تم إضافة: ${imported} سجل\n` +
                `- تم تحديث: ${updated} سجل` +
                (errors > 0 ? `\n- تم تخطي: ${errors} صف بسبب أخطاء` : '');
            
            Notification.success(successMessage);
            
            // تحذير إذا كان هناك أخطاء كثيرة
            if (errors > 0 && errors > rows.length * 0.5) {
                Notification.warning('تم تخطي أكثر من 50% من الصفوف. يرجى التحقق من صحة البيانات في ملف Excel.');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في استيراد البيانات:', error);
            Notification.error('حدث خطأ أثناء الاستيراد: ' + (error.message || 'خطأ غير معروف'));
            if (modal && modal.parentNode) {
                modal.remove();
            }
        }
    },
    
    /**
     * عرض نافذة تعديل بيانات التحليل
     */
    showAnalysisDataModal() {
        if (!this.isCurrentUserAdmin()) {
            Notification.warning('ليس لديك صلاحية لتعديل بيانات التحليل');
            return;
        }
        
        this.ensureData();
        const trainingAttendance = AppState.appData.trainingAttendance || [];
        const analysisData = AppState.appData.trainingAnalysisData || {
            notes: '',
            goals: '',
            recommendations: '',
            targets: {},
            customMetrics: {}
        };
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-edit ml-2"></i>تعديل بيانات التحليل</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات التحليل</label>
                        <textarea id="analysis-notes" class="form-input" rows="4" placeholder="أدخل ملاحظات حول تحليل بيانات التدريب...">${Utils.escapeHTML(analysisData.notes || '')}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">الأهداف</label>
                        <textarea id="analysis-goals" class="form-input" rows="3" placeholder="أدخل الأهداف المرجوة من التدريب...">${Utils.escapeHTML(analysisData.goals || '')}</textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">التوصيات</label>
                        <textarea id="analysis-recommendations" class="form-input" rows="3" placeholder="أدخل التوصيات بناءً على التحليل...">${Utils.escapeHTML(analysisData.recommendations || '')}</textarea>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">هدف عدد ساعات التدريب</label>
                            <input type="number" id="target-hours" class="form-input" value="${analysisData.targets?.totalHours || ''}" placeholder="عدد الساعات المستهدفة">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">هدف عدد الموظفين المدربين</label>
                            <input type="number" id="target-employees" class="form-input" value="${analysisData.targets?.totalEmployees || ''}" placeholder="عدد الموظفين المستهدف">
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <p class="text-sm text-blue-800 mb-2"><strong>معلومات:</strong></p>
                        <p class="text-sm text-blue-700">
                            إجمالي سجلات الحضور: <strong>${trainingAttendance.length}</strong><br>
                            إجمالي ساعات التدريب: <strong>${trainingAttendance.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0).toFixed(2)}</strong>
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button id="save-analysis-data-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>حفظ بيانات التحليل
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        modal.querySelector('#save-analysis-data-btn')?.addEventListener('click', async () => {
            try {
                Loading.show('جاري حفظ بيانات التحليل...');
                
                const analysisData = {
                    notes: modal.querySelector('#analysis-notes')?.value || '',
                    goals: modal.querySelector('#analysis-goals')?.value || '',
                    recommendations: modal.querySelector('#analysis-recommendations')?.value || '',
                    targets: {
                        totalHours: parseFloat(modal.querySelector('#target-hours')?.value || '0') || 0,
                        totalEmployees: parseInt(modal.querySelector('#target-employees')?.value || '0') || 0
                    },
                    updatedAt: new Date().toISOString(),
                    updatedBy: {
                        id: AppState.currentUser?.id || '',
                        name: AppState.currentUser?.name || AppState.currentUser?.email || ''
                    }
                };
                
                if (!AppState.appData.trainingAnalysisData) {
                    AppState.appData.trainingAnalysisData = {};
                }
                AppState.appData.trainingAnalysisData = {
                    ...AppState.appData.trainingAnalysisData,
                    ...analysisData,
                    createdAt: AppState.appData.trainingAnalysisData.createdAt || new Date().toISOString()
                };
                
                // حفظ البيانات
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    await window.DataManager.save();
                }
                
                // حفظ في Google Sheets
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    await GoogleIntegration.autoSave('TrainingAnalysisData', AppState.appData.trainingAnalysisData).catch(err => {
                        Utils.safeWarn('⚠️ فشل حفظ بيانات التحليل في Google Sheets:', err);
                    });
                }
                
                Loading.hide();
                modal.remove();
                Notification.success('تم حفظ بيانات التحليل بنجاح');
                
                // تحديث صفحة التحليل
                if (document.querySelector('.tab-btn[data-tab="analysis"]')?.classList.contains('active')) {
                    const content = document.getElementById('training-tab-content');
                    if (content) {
                        content.innerHTML = await this.renderAnalysisTab();
                        this._hydrateTab('analysis');
                        this.renderAnalysisCharts();
                    }
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ في حفظ بيانات التحليل:', error);
                Notification.error('فشل حفظ بيانات التحليل: ' + (error.message || 'خطأ غير معروف'));
            }
        });
    },
    
    /**
     * عرض نافذة إضافة سجل تدريب جديد (سجل الحضور)
     */
    showAddAttendanceRecordModal() {
        this.ensureData();
        if (!Array.isArray(AppState.appData.trainingAttendance)) {
            AppState.appData.trainingAttendance = [];
        }
        const today = new Date().toISOString().split('T')[0];
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-plus ml-2"></i>إضافة سجل تدريب</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ *</label>
                            <input type="date" id="add-attendance-date" class="form-input" required value="${today}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">نوع التدريب *</label>
                            <select id="add-attendance-type" class="form-input" required>
                                <option value="داخلي" selected>داخلي</option>
                                <option value="خارجي">خارجي</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">المصنع</label>
                            <input type="text" id="add-attendance-factory" class="form-input" placeholder="المصنع">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">كود الموظف *</label>
                            <input type="text" id="add-attendance-code" class="form-input" required placeholder="كود الموظف">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الموظف *</label>
                            <input type="text" id="add-attendance-name" class="form-input" required placeholder="اسم الموظف">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                            <input type="text" id="add-attendance-position" class="form-input" placeholder="الوظيفة">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الإدارة</label>
                            <input type="text" id="add-attendance-department" class="form-input" placeholder="الإدارة">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">موضوع المحاضرة *</label>
                            <input type="text" id="add-attendance-topic" class="form-input" required placeholder="موضوع المحاضرة">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">اسم المحاضر</label>
                            <select id="add-attendance-trainer" class="form-input">
                                <option value="">اختر اسم المحاضر</option>
                                ${this.getSafetyTeamMembers({ excludeSystemUsers: true }).map(member => `
                                    <option value="${Utils.escapeHTML(member.name)}">${Utils.escapeHTML(member.name)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">وقت البدء</label>
                            <input type="time" id="add-attendance-start-time" class="form-input" value="09:00">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">وقت الانتهاء</label>
                            <input type="time" id="add-attendance-end-time" class="form-input" value="10:00">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">إجمالي ساعات التدريب</label>
                            <input type="number" id="add-attendance-hours" class="form-input" step="0.01" value="1">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button id="save-add-attendance-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>حفظ السجل
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.remove();
        });
        
        const startTimeInput = modal.querySelector('#add-attendance-start-time');
        const endTimeInput = modal.querySelector('#add-attendance-end-time');
        const hoursInput = modal.querySelector('#add-attendance-hours');
        const calculateHours = () => {
            if (startTimeInput?.value && endTimeInput?.value) {
                const hours = this.calculateTrainingHours(startTimeInput.value, endTimeInput.value);
                if (hours && parseFloat(hours) > 0) hoursInput.value = hours;
            }
        };
        startTimeInput?.addEventListener('change', calculateHours);
        endTimeInput?.addEventListener('change', calculateHours);
        
        modal.querySelector('#save-add-attendance-btn')?.addEventListener('click', async () => {
            try {
                const dateValue = modal.querySelector('#add-attendance-date')?.value;
                const code = modal.querySelector('#add-attendance-code')?.value?.trim();
                const name = modal.querySelector('#add-attendance-name')?.value?.trim();
                const topic = modal.querySelector('#add-attendance-topic')?.value?.trim();
                if (!dateValue || !code || !name || !topic) {
                    Notification.warning('يرجى إدخال جميع الحقول المطلوبة (التاريخ، كود الموظف، اسم الموظف، موضوع المحاضرة)');
                    return;
                }
                Loading.show('جاري حفظ السجل...');
                const factoryVal = modal.querySelector('#add-attendance-factory')?.value?.trim() || '';
                const startTime = this.cleanTime(modal.querySelector('#add-attendance-start-time')?.value || '');
                const endTime = this.cleanTime(modal.querySelector('#add-attendance-end-time')?.value || '');
                const totalHours = modal.querySelector('#add-attendance-hours')?.value ||
                    this.calculateTrainingHours(startTime, endTime) || '0';
                const record = {
                    id: Utils.generateId('ATT'),
                    trainingId: null,
                    date: new Date(dateValue).toISOString(),
                    trainingType: modal.querySelector('#add-attendance-type')?.value || 'داخلي',
                    factory: factoryVal,
                    factoryName: factoryVal,
                    employeeCode: code,
                    employeeName: name,
                    position: modal.querySelector('#add-attendance-position')?.value?.trim() || '',
                    department: modal.querySelector('#add-attendance-department')?.value?.trim() || '',
                    topic: topic,
                    trainer: modal.querySelector('#add-attendance-trainer')?.value?.trim() || '',
                    startTime: startTime,
                    endTime: endTime,
                    totalHours: totalHours,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                AppState.appData.trainingAttendance.push(record);
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    await window.DataManager.save();
                }
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    await GoogleIntegration.autoSave('TrainingAttendance', AppState.appData.trainingAttendance).catch(err => {
                        Utils.safeWarn('⚠️ فشل حفظ سجل التدريب في Google Sheets:', err);
                        Notification.error('فشل حفظ سجل التدريب في Google Sheets. سيتم الاحتفاظ بالتغييرات محلياً فقط حتى يتم الحفظ بنجاح.');
                    });
                }
                Loading.hide();
                modal.remove();
                Notification.success('تم إضافة السجل بنجاح');
                this.loadAttendanceRegistry();
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ في إضافة السجل:', error);
                Notification.error('فشل إضافة السجل: ' + (error?.message || 'خطأ غير معروف'));
            }
        });
    },
    
    /**
     * عرض تفاصيل سجل تدريب وجميع تدريبات الموظف في نفس النموذج
     */
    viewAttendanceRecordDetails(recordId) {
        this.ensureData();
        const registry = AppState.appData.trainingAttendance || [];
        const record = registry.find(r => r.id === recordId);

        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }

        const employeeCode = record.employeeCode || '';
        const employeeName = record.employeeName || '-';
        const allForEmployee = registry
            .filter(r => (r.employeeCode || '') === employeeCode)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        const formatTime = (t) => {
            const cleaned = this.cleanTime(t);
            if (!cleaned || cleaned === 'NaN:NaN' || String(cleaned).includes('NaN')) return '-';
            return cleaned;
        };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1100px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-eye ml-2"></i>
                        تفاصيل السجل — ${Utils.escapeHTML(employeeName)}
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1;">
                    <div class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">
                            <i class="fas fa-file-alt ml-2 text-blue-600"></i>
                            تفاصيل هذا السجل
                        </h3>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div><span class="font-semibold text-gray-600">التاريخ:</span> ${record.date ? Utils.formatDate(record.date) : '-'}</div>
                            <div><span class="font-semibold text-gray-600">نوع التدريب:</span> ${Utils.escapeHTML(record.trainingType || 'داخلي')}</div>
                            <div><span class="font-semibold text-gray-600">المصنع:</span> ${Utils.escapeHTML(record.factoryName || record.factory || '-')}</div>
                            <div><span class="font-semibold text-gray-600">الكود:</span> ${Utils.escapeHTML(record.employeeCode || '-')}</div>
                            <div><span class="font-semibold text-gray-600">الاسم:</span> ${Utils.escapeHTML(record.employeeName || '-')}</div>
                            <div><span class="font-semibold text-gray-600">الوظيفة:</span> ${Utils.escapeHTML(record.position || '-')}</div>
                            <div><span class="font-semibold text-gray-600">الإدارة:</span> ${Utils.escapeHTML(record.department || '-')}</div>
                            <div><span class="font-semibold text-gray-600">موضوع المحاضرة:</span> ${Utils.escapeHTML(record.topic || '-')}</div>
                            <div><span class="font-semibold text-gray-600">اسم المحاضر:</span> ${Utils.escapeHTML(record.trainer || '-')}</div>
                            <div><span class="font-semibold text-gray-600">وقت البدء:</span> ${formatTime(record.startTime)}</div>
                            <div><span class="font-semibold text-gray-600">وقت الانتهاء:</span> ${formatTime(record.endTime)}</div>
                            <div><span class="font-semibold text-gray-600">إجمالي ساعات التدريب:</span> ${record.totalHours || record.hours || '0'} ساعة</div>
                        </div>
                    </div>
                    <div class="mt-4">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">
                            <i class="fas fa-list-alt ml-2 text-green-600"></i>
                            جميع تدريبات الموظف (${allForEmployee.length})
                        </h3>
                        ${allForEmployee.length > 0 ? `
                        <div class="table-wrapper" style="overflow: auto; max-height: 400px; border: 1px solid #e5e7eb; border-radius: 8px;">
                            <table class="data-table" style="margin: 0;">
                                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1;">
                                    <tr>
                                        <th>م</th>
                                        <th>التاريخ</th>
                                        <th>نوع التدريب</th>
                                        <th>المصنع</th>
                                        <th>موضوع المحاضرة</th>
                                        <th>اسم المحاضر</th>
                                        <th>وقت البدء</th>
                                        <th>وقت الانتهاء</th>
                                        <th>إجمالي الساعات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${allForEmployee.map((r, i) => {
                                        const isCurrent = r.id === recordId;
                                        const startT = formatTime(r.startTime);
                                        const endT = formatTime(r.endTime);
                                        const hours = r.totalHours || r.hours || '0';
                                        return `
                                        <tr class="${isCurrent ? 'bg-blue-50' : ''}">
                                            <td>${i + 1}</td>
                                            <td>${r.date ? Utils.formatDate(r.date) : '-'}</td>
                                            <td>${Utils.escapeHTML(r.trainingType || 'داخلي')}</td>
                                            <td>${Utils.escapeHTML(r.factoryName || r.factory || '-')}</td>
                                            <td>${Utils.escapeHTML(r.topic || '-')}</td>
                                            <td>${Utils.escapeHTML(r.trainer || '-')}</td>
                                            <td>${startT}</td>
                                            <td>${endT}</td>
                                            <td>${hours} ساعة</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : `
                        <p class="text-gray-500 py-4">لا توجد سجلات أخرى لهذا الموظف.</p>
                        `}
                    </div>
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

    /**
     * تعديل سجل تدريب
     */
    editAttendanceRecord(recordId) {
        this.ensureData();
        const registry = AppState.appData.trainingAttendance || [];
        const record = registry.find(r => r.id === recordId);
        
        if (!record) {
            Notification.error('السجل غير موجود');
            return;
        }
        const safetyTeamTrainers = this.getSafetyTeamMembers({ excludeSystemUsers: true });
        const selectedTrainerName = String(record?.trainer || '').trim();
        const selectedTrainerExists = safetyTeamTrainers.some(member => member.name === selectedTrainerName);
        const selectedTrainerLegacyOption = selectedTrainerName && !selectedTrainerExists
            ? `<option value="${Utils.escapeHTML(selectedTrainerName)}" selected>${Utils.escapeHTML(selectedTrainerName)}</option>`
            : '';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title"><i class="fas fa-edit ml-2"></i>تعديل سجل التدريب</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">التاريخ *</label>
                            <input type="date" id="edit-attendance-date" class="form-input" required 
                                value="${record.date ? new Date(record.date).toISOString().split('T')[0] : ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">نوع التدريب *</label>
                            <select id="edit-attendance-type" class="form-input" required>
                                <option value="داخلي" ${record.trainingType === 'داخلي' ? 'selected' : ''}>داخلي</option>
                                <option value="خارجي" ${record.trainingType === 'خارجي' ? 'selected' : ''}>خارجي</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">المصنع</label>
                            <input type="text" id="edit-attendance-factory" class="form-input" 
                                value="${Utils.escapeHTML(record.factoryName || record.factory || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">كود الموظف *</label>
                            <input type="text" id="edit-attendance-code" class="form-input" required 
                                value="${Utils.escapeHTML(record.employeeCode || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">اسم الموظف *</label>
                            <input type="text" id="edit-attendance-name" class="form-input" required 
                                value="${Utils.escapeHTML(record.employeeName || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الوظيفة</label>
                            <input type="text" id="edit-attendance-position" class="form-input" 
                                value="${Utils.escapeHTML(record.position || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">الإدارة</label>
                            <input type="text" id="edit-attendance-department" class="form-input" 
                                value="${Utils.escapeHTML(record.department || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">موضوع المحاضرة *</label>
                            <input type="text" id="edit-attendance-topic" class="form-input" required 
                                value="${Utils.escapeHTML(record.topic || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">اسم المحاضر</label>
                            <select id="edit-attendance-trainer" class="form-input">
                                <option value="">اختر اسم المحاضر</option>
                                ${selectedTrainerLegacyOption}
                                ${safetyTeamTrainers.map(member => `
                                    <option value="${Utils.escapeHTML(member.name)}" ${member.name === selectedTrainerName ? 'selected' : ''}>
                                        ${Utils.escapeHTML(member.name)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">وقت البدء</label>
                            <input type="time" id="edit-attendance-start-time" class="form-input" 
                                value="${this.cleanTime(record.startTime) || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">وقت الانتهاء</label>
                            <input type="time" id="edit-attendance-end-time" class="form-input" 
                                value="${this.cleanTime(record.endTime) || ''}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">إجمالي ساعات التدريب</label>
                            <input type="number" id="edit-attendance-hours" class="form-input" step="0.01" 
                                value="${record.totalHours || '0'}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button id="save-edit-attendance-btn" class="btn-primary">
                        <i class="fas fa-save ml-2"></i>حفظ التعديلات
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        // حساب الساعات تلقائياً عند تغيير الأوقات
        const startTimeInput = modal.querySelector('#edit-attendance-start-time');
        const endTimeInput = modal.querySelector('#edit-attendance-end-time');
        const hoursInput = modal.querySelector('#edit-attendance-hours');
        
        const calculateHours = () => {
            if (startTimeInput.value && endTimeInput.value) {
                const hours = this.calculateTrainingHours(startTimeInput.value, endTimeInput.value);
                if (hours && parseFloat(hours) > 0) {
                    hoursInput.value = hours;
                }
            }
        };
        
        startTimeInput?.addEventListener('change', calculateHours);
        endTimeInput?.addEventListener('change', calculateHours);
        
        modal.querySelector('#save-edit-attendance-btn')?.addEventListener('click', async () => {
            try {
                const dateValue = modal.querySelector('#edit-attendance-date')?.value;
                const code = modal.querySelector('#edit-attendance-code')?.value.trim();
                const name = modal.querySelector('#edit-attendance-name')?.value.trim();
                const topic = modal.querySelector('#edit-attendance-topic')?.value.trim();
                
                if (!dateValue || !code || !name || !topic) {
                    Notification.warning('يرجى إدخال جميع الحقول المطلوبة');
                    return;
                }
                
                Loading.show('جاري حفظ التعديلات...');
                
                // تحديث السجل
                const index = registry.findIndex(r => r.id === recordId);
                if (index >= 0) {
                    registry[index] = {
                        ...registry[index],
                        date: new Date(dateValue).toISOString(),
                        trainingType: modal.querySelector('#edit-attendance-type')?.value || 'داخلي',
                        factory: modal.querySelector('#edit-attendance-factory')?.value.trim() || '',
                        factoryName: modal.querySelector('#edit-attendance-factory')?.value.trim() || '',
                        employeeCode: code,
                        employeeName: name,
                        position: modal.querySelector('#edit-attendance-position')?.value.trim() || '',
                        department: modal.querySelector('#edit-attendance-department')?.value.trim() || '',
                        topic: topic,
                        trainer: modal.querySelector('#edit-attendance-trainer')?.value.trim() || '',
                        startTime: this.cleanTime(modal.querySelector('#edit-attendance-start-time')?.value || ''),
                        endTime: this.cleanTime(modal.querySelector('#edit-attendance-end-time')?.value || ''),
                        totalHours: modal.querySelector('#edit-attendance-hours')?.value || 
                            this.calculateTrainingHours(
                                modal.querySelector('#edit-attendance-start-time')?.value,
                                modal.querySelector('#edit-attendance-end-time')?.value
                            ),
                        updatedAt: new Date().toISOString()
                    };
                    
                    // حفظ البيانات
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        await window.DataManager.save();
                    }
                    
                    // حفظ في Google Sheets
                    if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                        await GoogleIntegration.autoSave('TrainingAttendance', registry).catch(err => {
                            Utils.safeWarn('⚠️ فشل حفظ التعديلات في Google Sheets:', err);
                            Notification.error('فشل حفظ تعديلات سجل التدريب في Google Sheets. سيتم الاحتفاظ بالتغييرات محلياً فقط حتى يتم الحفظ بنجاح.');
                        });
                    }
                    
                    Loading.hide();
                    modal.remove();
                    Notification.success('تم تحديث السجل بنجاح');
                    this.loadAttendanceRegistry();
                } else {
                    Loading.hide();
                    Notification.error('السجل غير موجود');
                }
            } catch (error) {
                Loading.hide();
                Utils.safeError('خطأ في تحديث السجل:', error);
                Notification.error('فشل تحديث السجل: ' + (error.message || 'خطأ غير معروف'));
            }
        });
    },
    
    /**
     * حذف سجل تدريب
     */
    async deleteAttendanceRecord(recordId) {
        if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) {
            return;
        }
        
        try {
            Loading.show('جاري حذف السجل...');
            this.ensureData();
            
            const registry = AppState.appData.trainingAttendance || [];
            const index = registry.findIndex(r => r.id === recordId);
            
            if (index >= 0) {
                registry.splice(index, 1);
                
                // حفظ البيانات
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    await window.DataManager.save();
                }
                
                // حفظ في Google Sheets
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.autoSave) {
                    await GoogleIntegration.autoSave('TrainingAttendance', registry).catch(err => {
                        Utils.safeWarn('⚠️ فشل حفظ التعديلات في Google Sheets:', err);
                        Notification.error('فشل حفظ تعديلات سجل التدريب في Google Sheets. سيتم الاحتفاظ بالتغييرات محلياً فقط حتى يتم الحفظ بنجاح.');
                    });
                }
                
                Loading.hide();
                Notification.success('تم حذف السجل بنجاح');
                this.loadAttendanceRegistry();
            } else {
                Loading.hide();
                Notification.error('السجل غير موجود');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في حذف السجل:', error);
            Notification.error('فشل حذف السجل: ' + (error.message || 'خطأ غير معروف'));
        }
    }
};
// يتاح على window فور اكتمال تعريف الكائن (قبل app-ui وقبل أي refreshCurrentSection)
if (typeof window !== 'undefined') {
    try {
        window.Training = Training;
        document.dispatchEvent(new CustomEvent('hse-training-module-ready', { detail: { source: 'training.js' } }));
    } catch (e) { /* ignore */ }
}
// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Training !== 'undefined') {
            window.Training = Training;
            
            // إعادة تحميل قوائم المصنع/الموقع تلقائياً عند اكتمال تحميل إعدادات النماذج
            if (typeof window !== 'undefined') {
                window.addEventListener('formSettingsUpdated', function () {
                    try { if (typeof Training !== 'undefined' && Training.refreshSiteDropdowns) Training.refreshSiteDropdowns(); } catch (e) {}
                });
            }

            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Training module loaded and available on window.Training');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Training:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Training !== 'undefined') {
            try {
                window.Training = Training;
            } catch (e) {
                console.error('❌ فشل تصدير Training:', e);
            }
        }
    }
})();