/* ========================================
   نظام المزامنة اللحظية للبيانات
   Real-Time Data Synchronization Manager
   ======================================== */

/**
 * نظام إدارة المزامنة اللحظية للبيانات بين المستخدمين
 * يقوم بجلب التحديثات من Google Sheets بشكل دوري
 * ويعرضها للمستخدمين الآخرين بدون الحاجة لإعادة تحميل الصفحة
 */
const realtimeSyncLog = (...args) => {
    try {
        if (typeof Utils !== 'undefined' && typeof Utils.safeLog === 'function') {
            Utils.safeLog(...args);
        }
    } catch (e) { /* ignore */ }
};

const RealtimeSyncManager = {
    // إعدادات النظام
    config: {
        // فحص التحديثات كل 20 ثانية (20000 ms) - تحسين من 30 ثانية لتسريع المزامنة
        syncInterval: 20000,

        // موديولات أساسية تبقى تحت المتابعة حتى عند التنقل بين الأقسام
        alwaysSyncModules: ['users'],

        // الموديولات التي يتم مزامنتها تلقائياً
        // ملاحظة: الأسماء يجب أن تطابق مفاتيح AppState.appData
        autoSyncModules: [
            // ✅ مهم للصلاحيات: تحديث قائمة المستخدمين وصلاحياتهم بشكل دوري
            // هذا يسمح للمستخدم برؤية الصلاحيات الجديدة دون Logout/Reload
            'users',

            // موديولات العيادة الطبية
            'medications',           // الأدوية
            'clinicVisits',         // زيارات العيادة
            'sickLeave',            // الإجازات المرضية
            'injuries',             // الإصابات
            'clinicInventory',      // مخزون العيادة
            
            // موديولات السلامة الأساسية
            'incidents',            // الحوادث
            'nearmiss',             // الحوادث الوشيكة (يجب أن يكون nearmiss وليس nearMiss)
            'ptw',                  // تصاريح العمل
            'training',             // التدريب
            // fireEquipment يُحمّل داخل الموديول عبر getAllFireEquipmentAssets (شيت FireEquipmentAssets)
            'ppe',                  // معدات الوقاية
            'ppeStock',             // ✅ إضافة: مخزون مهمات الوقاية
            'violations',           // المخالفات
            'approvedContractors',  // المقاولون/الموردون المعتمدون
            'contractors',          // المقاولون
            'employees',            // الموظفون
            'externalWorkforceMonthly', // العمالة الخارجية الشهرية
            
            // موديولات السلامة المتقدمة
            'behaviorMonitoring',   // مراقبة السلوك
            'chemicalSafety',       // السلامة الكيميائية
            'dailyObservations',    // الملاحظات اليومية
            
            // موديولات الجودة والبيئة
            'isoDocuments',         // ISO Documents (يجب أن يكون isoDocuments وليس iso)
            'sustainability',       // الاستدامة
            'riskAssessments',      // تقييم المخاطر (يجب أن يكون riskAssessments وليس riskAssessment)
            
            // موديولات الإدارة
            'emergencyAlerts',      // تنبيهات الطوارئ (يجب أن يكون emergencyAlerts وليس emergency)
            'emergencyPlans',       // خطط الطوارئ
            'emergencyPlansUpdates',// تحديثات خطط الطوارئ
            'safetyBudgets',        // ميزانية السلامة (يجب أن يكون safetyBudgets وليس safetyBudget)
            'actionTrackingRegister', // متابعة الإجراءات (يجب أن يكون actionTrackingRegister وليس actionTracking)
            'hseNonConformities',   // عدم المطابقة HSE (يجب أن يكون hseNonConformities وليس hse)
            'safetyPerformanceKPIs', // مؤشرات أداء السلامة
            'legalDocuments',       // المستندات القانونية
            'safetyTeamMembers',    // أعضاء فريق السلامة (يجب أن يكون safetyTeamMembers وليس safetyHealthManagement)
            'sopJHA',               // SOP/JHA
            'periodicInspectionCategories' // فئات الفحوصات الدورية (يجب أن يكون periodicInspectionCategories وليس periodicInspections)
        ],

        // تفعيل المزامنة التلقائية
        enableAutoSync: true,

        // تفعيل إشعارات التحديثات
        enableNotifications: true,

        // عرض إشعار بصوت
        enableSoundNotification: false,

        // الحد الأدنى للوقت بين مزامنتين للموديول نفسه (5 ثوانٍ) - تحسين من 10 ثوانٍ لتسريع المزامنة
        minSyncInterval: 5000,

        // ✅ “فوري” بين الأجهزة: فحص مؤشر تحديثات Users كل 3 ثوانٍ (طلب خفيف جداً)
        usersMetaPollInterval: 3000
    },

    // حالة النظام
    state: {
        isSyncing: false,
        lastSyncTime: {},
        syncHistory: [],
        intervalId: null,
        isActive: true,
        currentSection: null,
        broadcastChannel: null,
        pendingUpdates: {},
        lastDataHash: {},
        usersMetaPollId: null,
        usersMetaLastSeen: 0,
        moduleSyncPromises: {}
    },

    // عدادات الإحصائيات
    stats: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        updatesReceived: 0,
        lastError: null
    },

    /**
     * تهيئة نظام المزامنة اللحظية
     */
    async init() {
        try {
            realtimeSyncLog('🔄 تهيئة نظام المزامنة اللحظية للبيانات...');

            // تحميل الإعدادات المحفوظة
            this.loadSettings();

            // تهيئة Broadcast Channel للتواصل بين التبويبات
            this.setupBroadcastChannel();

            // الاستماع لأحداث تغيير القسم الحالي
            this.setupSectionChangeListener();

            // بدء المزامنة التلقائية إذا كانت مفعلة
            if (this.config.enableAutoSync) {
                this.startAutoSync();
            }

            // الاستماع لأحداث الإضافة/التحديث
            this.setupDataChangeListeners();

            // ✅ فحص خفيف لتحديثات الصلاحيات بين الأجهزة (بدون تحميل Users كامل إلا عند وجود تغيير)
            this.setupUsersMetaPolling();

            realtimeSyncLog('✅ تم تهيئة نظام المزامنة اللحظية بنجاح');
            return true;
        } catch (error) {
            console.error('❌ خطأ في تهيئة نظام المزامنة اللحظية:', error);
            this.stats.lastError = error.message;
            return false;
        }
    },

    /**
     * ✅ فحص “مؤشر” تحديثات Users كل عدة ثوانٍ (Cross-device شبه فوري)
     */
    setupUsersMetaPolling() {
        try {
            if (this.state.usersMetaPollId) return;

            const isEnabled = AppState?.googleConfig?.appsScript?.enabled && AppState?.googleConfig?.appsScript?.scriptUrl;
            if (!isEnabled || typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendRequest) {
                return;
            }

            const pollEvery = Math.max(1500, Number(this.config.usersMetaPollInterval) || 3000);
            const poll = async () => {
                try {
                    if (!AppState?.currentUser?.email) return;
                    if (!this.config.enableAutoSync) return;

                    const res = await GoogleIntegration.sendRequest({
                        action: 'getUsersMeta',
                        data: { __timeoutMs: 4500 }
                    });
                    const updatedAtMs = Number(res?.data?.updatedAtMs || 0) || 0;
                    if (!updatedAtMs) return;

                    if (!this.state.usersMetaLastSeen) {
                        this.state.usersMetaLastSeen = updatedAtMs;
                        return;
                    }

                    if (updatedAtMs > this.state.usersMetaLastSeen) {
                        this.state.usersMetaLastSeen = updatedAtMs;
                        // طلب سحب Users فوراً
                        this.syncModule('users', true);
                    }
                } catch (e) {
                    // تجاهل أخطاء الشبكة/timeout
                }
            };

            this.state.usersMetaPollId = setInterval(poll, pollEvery);
            // فحص سريع أولي
            setTimeout(poll, 500);
        } catch (error) {
            console.warn('⚠️ setupUsersMetaPolling failed:', error);
        }
    },

    /**
     * تحميل الإعدادات من LocalStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('realtimeSyncSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                Object.assign(this.config, settings);
            }
        } catch (error) {
            console.warn('⚠️ خطأ في تحميل إعدادات المزامنة:', error);
        }
    },

    /**
     * حفظ الإعدادات في LocalStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('realtimeSyncSettings', JSON.stringify(this.config));
        } catch (error) {
            console.warn('⚠️ خطأ في حفظ إعدادات المزامنة:', error);
        }
    },

    /**
     * تهيئة Broadcast Channel للتواصل بين التبويبات
     */
    setupBroadcastChannel() {
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                this.state.broadcastChannel = new BroadcastChannel('hse-data-sync');

                this.state.broadcastChannel.onmessage = (event) => {
                    const { type, module, data, timestamp } = event.data;

                    switch (type) {
                        case 'data-updated':
                            // تم تحديث بيانات في تبويب آخر
                            this.handleExternalDataUpdate(module, data, timestamp);
                            break;
                        case 'sync-request':
                            // طلب مزامنة من تبويب آخر
                            this.syncModule(module, true);
                            break;
                        case 'sync-completed':
                            // اكتملت مزامنة في تبويب آخر
                            this.handleExternalSyncCompleted(module, timestamp);
                            break;
                        case 'user-permissions-updated':
                            // ✅ تحديث فوري لصلاحيات المستخدم (داخل نفس المتصفح / التبويبات)
                            this.handleExternalUserPermissionsUpdate(data, timestamp);
                            break;
                    }
                };

                realtimeSyncLog('✅ تم تهيئة Broadcast Channel للمزامنة بين التبويبات');
            }
        } catch (error) {
            console.warn('⚠️ Broadcast Channel غير مدعوم في هذا المتصفح');
        }
    },

    /**
     * إرسال رسالة عبر Broadcast Channel
     */
    broadcast(type, module, data = null) {
        if (this.state.broadcastChannel) {
            try {
                this.state.broadcastChannel.postMessage({
                    type,
                    module,
                    data,
                    timestamp: Date.now(),
                    user: AppState.currentUser?.email || 'Unknown'
                });
            } catch (error) {
                console.warn('⚠️ خطأ في إرسال رسالة Broadcast:', error);
            }
        }
    },

    /**
     * معالجة تحديث بيانات من تبويب خارجي
     */
    handleExternalDataUpdate(module, data, timestamp) {
        realtimeSyncLog(`📨 استلام تحديث خارجي للموديول: ${module}`);

        // تحديث البيانات محلياً
        if (AppState.appData[module]) {
            // دمج البيانات الجديدة
            this.mergeData(module, data);

            // تحديث الواجهة إذا كان المستخدم يشاهد هذا القسم
            this.refreshModuleUI(module);

            // عرض إشعار
            if (this.config.enableNotifications) {
                this.showUpdateNotification(module, data);
            }
        }
    },

    /**
     * معالجة اكتمال مزامنة خارجية
     */
    handleExternalSyncCompleted(module, timestamp) {
        // تحديث وقت آخر مزامنة
        this.state.lastSyncTime[module] = timestamp;
    },

    /**
     * ✅ تحديث صلاحيات مستخدم فوراً عند استلام Broadcast من تبويب آخر
     */
    handleExternalUserPermissionsUpdate(payload, timestamp) {
        try {
            const email = (payload?.email || '').toString().toLowerCase().trim();
            const id = (payload?.id || '').toString().trim();
            if (!email && !id) return;

            if (!AppState.appData) AppState.appData = {};
            if (!Array.isArray(AppState.appData.users)) AppState.appData.users = [];

            const idx = AppState.appData.users.findIndex(u =>
                (email && u?.email && u.email.toString().toLowerCase().trim() === email) ||
                (id && u?.id && u.id.toString().trim() === id)
            );

            if (idx !== -1) {
                AppState.appData.users[idx] = { ...AppState.appData.users[idx], ...payload };
            } else {
                AppState.appData.users.push({ ...payload });
            }

            // حفظ محلياً لتفادي فقد البيانات عند Reload
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                try { DataManager.save(); } catch (e) { /* ignore */ }
            }

            // إذا كان هذا هو المستخدم الحالي، حدّث جلسته + القائمة فوراً
            const currentEmail = AppState.currentUser?.email?.toLowerCase?.() || '';
            if (currentEmail && email && currentEmail === email) {
                if (typeof window.Auth !== 'undefined' && typeof window.Auth.updateUserSession === 'function') {
                    try { window.Auth.updateUserSession(); } catch (e) { /* ignore */ }
                }
                if (typeof Permissions !== 'undefined' && typeof Permissions.updateNavigation === 'function') {
                    try { Permissions.updateNavigation(); } catch (e) { /* ignore */ }
                }
            }

            // تحديث واجهة المستخدمين إذا كانت مفتوحة
            this.refreshModuleUI('users');
            this.state.lastSyncTime['users'] = timestamp || Date.now();
        } catch (error) {
            console.warn('⚠️ خطأ في معالجة تحديث صلاحيات المستخدم:', error);
        }
    },

    /**
     * الاستماع لأحداث تغيير القسم الحالي
     */
    setupSectionChangeListener() {
        // الاستماع لتغيير القسم النشط
        document.addEventListener('section-changed', (event) => {
            const newSection = event.detail?.section;
            if (newSection && newSection !== this.state.currentSection) {
                realtimeSyncLog(`📍 تغيير القسم النشط إلى: ${newSection}`);
                this.state.currentSection = newSection;

                // مزامنة فورية للقسم الجديد
                this.syncCurrentSection();
            }
        });
    },

    /**
     * الاستماع لأحداث الإضافة/التحديث
     */
    setupDataChangeListeners() {
        // الاستماع لأحداث تغيير البيانات
        document.addEventListener('data-saved', (event) => {
            const { module, action, data } = event.detail || {};

            if (module && data) {
                realtimeSyncLog(`💾 تم حفظ بيانات في ${module} - الإجراء: ${action}`);

                // إرسال إشعار للتبويبات الأخرى
                this.broadcast('data-updated', module, {
                    action,
                    record: data,
                    user: AppState.currentUser?.email
                });

                // مزامنة الموديول بعد ثانيتين للتأكد من حفظ البيانات في Google Sheets
                setTimeout(() => {
                    this.syncModule(module, false);
                }, 2000);
            }
        });

        // ✅ الاستماع لأحداث إعادة رسم DOM لإعادة ربط Event Listeners
        document.addEventListener('dom-rerendered', (event) => {
            const { module, container } = event.detail || {};
            if (module) {
                realtimeSyncLog(`🔄 إعادة ربط Event Listeners بعد إعادة رسم ${module}`);
                this.rebindModuleEventListeners(module, container);
            }
        });
    },

    /**
     * ✅ إعادة ربط Event Listeners لموديول معين بعد إعادة رسم DOM
     * @param {string} module - اسم الموديول
     * @param {HTMLElement} container - الحاوي (اختياري)
     */
    rebindModuleEventListeners(module, container = null) {
        try {
            // التحقق من أن الموديول مفتوح حالياً
            const sectionId = this.getModuleSectionId(module);
            const section = container || (sectionId ? document.getElementById(sectionId) : null);
            
            if (!section || !document.contains(section)) {
                return; // الموديول غير مفتوح
            }

            // استدعاء دالة إعادة ربط الـ listeners الخاصة بالموديول إذا وجدت
            const moduleBindersMap = {
                'contractors': () => {
                    if (typeof Contractors !== 'undefined' && Contractors.setupEventListeners) {
                        Contractors.setupEventListeners();
                    }
                },
                'violations': () => {
                    if (typeof Violations !== 'undefined' && Violations.bindEvents) {
                        Violations.bindEvents();
                    }
                },
                'training': () => {
                    if (typeof Training !== 'undefined' && Training.bindEvents) {
                        Training.bindEvents();
                    }
                },
                'incidents': () => {
                    if (typeof Incidents !== 'undefined' && Incidents.bindEvents) {
                        Incidents.bindEvents();
                    }
                },
                'ppe': () => {
                    if (typeof PPE !== 'undefined' && PPE.setupTabEventListeners) {
                        PPE.setupTabEventListeners();
                    }
                },
                'fireEquipment': () => {
                    if (typeof FireEquipment !== 'undefined' && FireEquipment.bindEvents) {
                        FireEquipment.bindEvents();
                    }
                },
                'dailyObservations': () => {
                    if (typeof DailyObservations !== 'undefined' && DailyObservations.bindEvents) {
                        DailyObservations.bindEvents();
                    }
                }
            };

            const binder = moduleBindersMap[module];
            if (binder) {
                // تأخير قصير لضمان اكتمال DOM
                setTimeout(binder, 50);
            }
        } catch (error) {
            console.warn(`⚠️ خطأ في إعادة ربط Event Listeners لـ ${module}:`, error);
        }
    },

    /**
     * ✅ الحصول على معرف القسم للموديول
     * @param {string} module - اسم الموديول
     * @returns {string|null}
     */
    getModuleSectionId(module) {
        const sectionMap = {
            'contractors': 'contractors-section',
            'violations': 'violations-section',
            'training': 'training-section',
            'incidents': 'incidents-section',
            'nearmiss': 'near-miss-section',
            'ppe': 'ppe-section',
            'fireEquipment': 'fire-equipment-section',
            'dailyObservations': 'daily-observations-section',
            'clinicVisits': 'clinic-section',
            'medications': 'clinic-section',
            'injuries': 'clinic-section',
            'sickLeave': 'clinic-section',
            'ptw': 'ptw-section',
            'employees': 'employees-section'
        };
        return sectionMap[module] || null;
    },

    /**
     * بدء المزامنة التلقائية
     */
    startAutoSync() {
        if (this.state.intervalId) {
            console.warn('⚠️ المزامنة التلقائية قيد التشغيل بالفعل');
            return;
        }

        realtimeSyncLog(`🔄 بدء المزامنة التلقائية كل ${this.config.syncInterval / 1000} ثانية`);

        // مزامنة فورية أولى - تقليل التأخير من 500ms إلى 200ms لتسريع التحميل الأولي
        setTimeout(() => this.syncAll(true), 200);

        // مزامنة دورية
        this.state.intervalId = setInterval(() => {
            if (this.config.enableAutoSync && !this.state.isSyncing) {
                this.syncAll(true);
            }
        }, this.config.syncInterval);

        this.state.isActive = true;
    },

    /**
     * إيقاف المزامنة التلقائية
     */
    stopAutoSync() {
        if (this.state.intervalId) {
            clearInterval(this.state.intervalId);
            this.state.intervalId = null;
            this.state.isActive = false;
            realtimeSyncLog('⏸️ تم إيقاف المزامنة التلقائية');
        }
    },

    getActiveSyncModules() {
        const currentSection = this.state.currentSection || AppState.currentSection || null;
        const alwaysModules = Array.isArray(this.config.alwaysSyncModules)
            ? this.config.alwaysSyncModules
            : ['users'];
        const sectionModules = currentSection ? this.getModulesForSection(currentSection) : [];

        const modules = [...alwaysModules, ...sectionModules].filter((module, index, array) => {
            return module &&
                this.config.autoSyncModules.includes(module) &&
                array.indexOf(module) === index;
        });

        if (modules.length > 0) {
            return modules;
        }

        return alwaysModules.filter((module, index, array) => {
            return module &&
                this.config.autoSyncModules.includes(module) &&
                array.indexOf(module) === index;
        });
    },

    /**
     * مزامنة جميع الموديولات
     */
    async syncAll(silent = true) {
        if (!AppState.googleConfig?.appsScript?.enabled) {
            return false;
        }

        if (this.state.isSyncing) {
            realtimeSyncLog('⏳ مزامنة جارية بالفعل...');
            return false;
        }

        this.state.isSyncing = true;
        this.stats.totalSyncs++;

        try {
            if (!silent) {
                realtimeSyncLog('🔄 بدء مزامنة جميع البيانات...');
            }

            const results = [];
            const modulesToSync = this.getActiveSyncModules();

            // ✅ تحسين: مزامنة الموديولات بشكل متوازي لتسريع العملية (بدلاً من المتسلسل)
            // تقسيم الموديولات إلى مجموعات صغيرة لتجنب إرهاق الخادم
            const moduleGroups = [];
            const groupSize = 3; // 3 موديولات في كل مجموعة
            
            for (let i = 0; i < modulesToSync.length; i += groupSize) {
                moduleGroups.push(modulesToSync.slice(i, i + groupSize));
            }

            // مزامنة كل مجموعة بشكل متوازي
            for (const group of moduleGroups) {
                const groupResults = await Promise.allSettled(
                    group.map(module => this.syncModule(module, silent))
                );
                
                groupResults.forEach((result, index) => {
                    const module = group[index];
                    if (result.status === 'fulfilled') {
                        results.push({ module, success: result.value });
                    } else {
                        console.warn(`⚠️ خطأ في مزامنة ${module}:`, result.reason);
                        results.push({ module, success: false, error: result.reason?.message || 'خطأ غير معروف' });
                    }
                });
            }

            const successCount = results.filter(r => r.success).length;

            this.stats.successfulSyncs++;

            // ✅ تحسين: التحقق من الموديولات الفارغة بعد المزامنة
            const emptyCheck = this.checkEmptyModules();
            if (emptyCheck.hasEmptyModules && !silent) {
                realtimeSyncLog(`⚠️ تحذير: ${emptyCheck.emptyCount} موديول فارغ بعد المزامنة: ${emptyCheck.emptyModules.join(', ')}`);
            }

            if (!silent) {
                realtimeSyncLog(`✅ اكتملت المزامنة: ${successCount}/${results.length} موديول`);
            }

            // حفظ سجل المزامنة
            this.addSyncLog({
                type: 'full-sync',
                timestamp: new Date().toISOString(),
                results,
                success: successCount > 0,
                emptyModules: emptyCheck.emptyModules,
                emptyCount: emptyCheck.emptyCount
            });

            return true;
        } catch (error) {
            console.error('❌ خطأ في المزامنة الكاملة:', error);
            this.stats.failedSyncs++;
            this.stats.lastError = error.message;
            return false;
        } finally {
            this.state.isSyncing = false;
        }
    },

    /**
     * مزامنة موديول واحد
     */
    async syncModule(module, silent = true) {
        if (this.state.moduleSyncPromises[module]) {
            return this.state.moduleSyncPromises[module];
        }

        const syncPromise = (async () => {
        // التحقق من الوقت الأدنى بين المزامنات
        const lastSync = this.state.lastSyncTime[module] || 0;
        const now = Date.now();

        if (now - lastSync < this.config.minSyncInterval) {
            if (!silent) {
                realtimeSyncLog(`⏳ تم مزامنة ${module} مؤخراً، انتظار...`);
            }
            return false;
        }

        try {
            if (!silent) {
                realtimeSyncLog(`🔄 مزامنة ${module}...`);
            }

            // ✅ حالة خاصة: إصابات العيادة تُخزَّن في ورقتَين (Injuries + ClinicContractorInjuries)
            // يجب استخدام getAllInjuries للحصول على البيانات المدمجة من كلتيهما
            if (module === 'injuries') {
                const result = await GoogleIntegration.sendRequest({
                    action: 'getAllInjuries',
                    data: {}
                });

                if (result && result.success) {
                    const newData = result.data || [];
                    const oldData = AppState.appData[module] || [];

                    if (!Array.isArray(newData)) {
                        if (!silent) realtimeSyncLog(`⚠️ injuries: البيانات المستلمة ليست مصفوفة`);
                        return false;
                    }

                    if (newData.length === 0 && oldData.length > 0) {
                        if (!silent) realtimeSyncLog(`⚠️ injuries: البيانات الجديدة فارغة - الاحتفاظ بالبيانات الحالية`);
                        this.state.lastSyncTime[module] = now;
                        return true;
                    }

                    const newHash = this.calculateDataHash(newData);
                    const oldHash = this.state.lastDataHash[module];

                    if (newHash !== oldHash) {
                        AppState.appData[module] = newData;
                        this.state.lastDataHash[module] = newHash;

                        if (typeof DataManager !== 'undefined' && DataManager.save) {
                            DataManager.save();
                        }

                        if (this.shouldRefreshModule(module)) {
                            this.refreshModuleUI(module);
                        }

                        this.broadcast('sync-completed', module);
                        this.stats.updatesReceived++;

                        if (!silent) {
                            realtimeSyncLog(`✅ injuries (مدمج): ${newData.length} سجل (موظفين + مقاولين)`);
                        }
                    } else if (!silent) {
                        realtimeSyncLog(`ℹ️ injuries: لا توجد تحديثات جديدة`);
                    }

                    this.state.lastSyncTime[module] = now;
                    return true;
                }

                return false;
            }

            // تحديد اسم الـ Sheet المقابل للموديول
            const sheetName = this.getSheetNameForModule(module);

            if (!sheetName) {
                console.warn(`⚠️ لم يتم العثور على Sheet للموديول: ${module}`);
                return false;
            }

            // جلب البيانات من Google Sheets
            const result = await GoogleIntegration.sendRequest({
                action: 'readFromSheet',
                data: {
                    sheetName,
                    spreadsheetId: AppState.googleConfig.sheets.spreadsheetId
                }
            });

            if (result && result.success) {
                const newData = result.data || [];
                const oldData = AppState.appData[module] || [];

                // ✅ تحسين: التحقق من أن البيانات الجديدة صالحة قبل الاستبدال
                if (!Array.isArray(newData)) {
                    if (!silent) {
                        realtimeSyncLog(`⚠️ ${module}: البيانات المستلمة ليست مصفوفة - الاحتفاظ بالبيانات الحالية`);
                    }
                    return false;
                }

                // ✅ تحسين: إذا كانت البيانات الجديدة فارغة والبيانات القديمة تحتوي على بيانات، نستخدم القديمة
                if (newData.length === 0 && oldData.length > 0) {
                    if (!silent) {
                        realtimeSyncLog(`⚠️ ${module}: البيانات الجديدة فارغة - الاحتفاظ بالبيانات الحالية (${oldData.length} سجل)`);
                    }
                    // تحديث وقت المزامنة ولكن لا نستبدل البيانات
                    this.state.lastSyncTime[module] = now;
                    return true;
                }

                // حساب hash للبيانات للكشف عن التغييرات
                const newHash = this.calculateDataHash(newData);
                const oldHash = this.state.lastDataHash[module];

                // تحديث البيانات فقط إذا كانت مختلفة
                if (newHash !== oldHash) {
                    // ✅ تحسين: الاحتفاظ بالبيانات القديمة كنسخة احتياطية قبل الاستبدال
                    const backupData = Array.isArray(oldData) ? [...oldData] : [];
                    
                    AppState.appData[module] = newData;
                    this.state.lastDataHash[module] = newHash;

                    // حفظ البيانات محلياً
                    if (typeof DataManager !== 'undefined' && DataManager.save) {
                        DataManager.save();
                    }

                    // ✅ إصلاح: تحديث الجلسة والقائمة بعد مزامنة بيانات المستخدمين
                    // فقط إذا كانت هناك تغييرات فعلية في البيانات
                    if (module === 'users' && AppState.currentUser) {
                        // ✅ إصلاح: التحقق من وجود تغييرات فعلية قبل التحديث
                        const currentUserEmail = AppState.currentUser.email?.toLowerCase();
                        const updatedUser = newData.find(u => u.email && u.email.toLowerCase() === currentUserEmail);
                        
                        if (updatedUser) {
                            // ✅ إصلاح: التحقق من وجود تغييرات في الصلاحيات أو البيانات المهمة
                            // تطبيع الصلاحيات قبل المقارنة لضمان المقارنة الصحيحة
                            const oldUser = oldData.find(u => u.email && u.email.toLowerCase() === currentUserEmail);
                            
                            // تطبيع الصلاحيات القديمة والجديدة
                            const normalizePerms = (perms) => {
                                if (!perms) return {};
                                if (typeof perms === 'string') {
                                    try {
                                        return JSON.parse(perms);
                                    } catch (e) {
                                        return {};
                                    }
                                }
                                return typeof perms === 'object' && !Array.isArray(perms) ? perms : {};
                            };
                            
                            const oldPerms = normalizePerms(oldUser?.permissions);
                            const newPerms = normalizePerms(updatedUser.permissions);
                            
                            const permissionsChanged = !oldUser || 
                                JSON.stringify(oldPerms) !== JSON.stringify(newPerms);
                            const roleChanged = !oldUser || oldUser.role !== updatedUser.role;
                            const activeChanged = !oldUser || oldUser.active !== updatedUser.active;
                            
                            if (permissionsChanged || roleChanged || activeChanged) {
                                setTimeout(() => {
                                    // تحديث جلسة المستخدم الحالي بالصلاحيات الجديدة من قاعدة البيانات
                                    if (typeof window.Auth !== 'undefined' && typeof window.Auth.updateUserSession === 'function') {
                                        window.Auth.updateUserSession();
                                        if (AppState.debugMode) {
                                            console.log('✅ تم تحديث الجلسة بعد مزامنة بيانات المستخدمين (تغييرات موجودة)');
                                        }
                                    }
                                    
                                    // تحديث القائمة حسب الصلاحيات الجديدة
                                    if (typeof Permissions !== 'undefined' && typeof Permissions.updateNavigation === 'function') {
                                        Permissions.updateNavigation();
                                        if (AppState.debugMode) {
                                            console.log('✅ تم تحديث القائمة بعد مزامنة بيانات المستخدمين');
                                        }
                                    }
                                }, 100);
                            } else if (AppState.debugMode) {
                                console.log('ℹ️ لا توجد تغييرات في بيانات المستخدم الحالي - تخطي تحديث الجلسة');
                            }
                        }
                    }

                    // تحديث الواجهة إذا كان المستخدم يشاهد هذا القسم
                    if (this.shouldRefreshModule(module)) {
                        this.refreshModuleUI(module);
                    }

                    // إشعار التبويبات الأخرى
                    this.broadcast('sync-completed', module);

                    // إحصائيات
                    this.stats.updatesReceived++;

                    if (!silent) {
                        realtimeSyncLog(`✅ تم تحديث ${module}: ${newData.length} سجل`);

                        // عرض إشعار بالتحديثات الجديدة
                        const addedCount = newData.length - oldData.length;
                        if (addedCount > 0 && this.config.enableNotifications) {
                            this.showNewDataNotification(module, addedCount);
                        }
                    }
                } else {
                    if (!silent) {
                        realtimeSyncLog(`ℹ️ ${module}: لا توجد تحديثات جديدة`);
                    }
                }

                // تحديث وقت آخر مزامنة
                this.state.lastSyncTime[module] = now;

                return true;
            }

            return false;
        } catch (error) {
            console.error(`❌ خطأ في مزامنة ${module}:`, error);
            return false;
        } finally {
            delete this.state.moduleSyncPromises[module];
        }
        })();

        this.state.moduleSyncPromises[module] = syncPromise;
        return syncPromise;
    },

    /**
     * مزامنة القسم الحالي
     */
    async syncCurrentSection() {
        const section = this.state.currentSection;

        if (!section) {
            return false;
        }

        // تحديد الموديولات المرتبطة بالقسم
        const sectionModules = this.getActiveSyncModules().filter(module => module !== 'users');

        realtimeSyncLog(`🔄 مزامنة موديولات القسم ${section}:`, sectionModules);

        for (const module of sectionModules) {
            await this.syncModule(module, false);
        }
    },

    /**
     * الحصول على الموديولات المرتبطة بقسم معين
     */
    getModulesForSection(section) {
        const sectionModulesMap = {
            'users': ['users'],
            'clinic': ['medications', 'clinicVisits', 'sickLeave', 'injuries', 'clinicInventory'],
            'incidents': ['incidents'],
            'near-miss': ['nearmiss'],  // تصحيح: nearmiss في AppState
            'ptw': ['ptw'],
            'training': ['training'],
            'fire-equipment': ['fireEquipment'],
            'ppe': ['ppe', 'ppeStock'],
            'violations': ['violations'],
            'contractors': ['contractors', 'approvedContractors'],
            'employees': ['employees', 'externalWorkforceMonthly'],
            'behavior-monitoring': ['behaviorMonitoring'],
            'chemical-safety': ['chemicalSafety'],
            'daily-observations': ['dailyObservations'],
            'iso': ['isoDocuments'],  // تصحيح: isoDocuments في AppState
            'sustainability': ['sustainability'],
            'risk-assessment': ['riskAssessments'],  // تصحيح: riskAssessments في AppState
            'emergency': ['emergencyAlerts', 'emergencyPlans', 'emergencyPlansUpdates'],  // تصحيح: emergencyAlerts في AppState
            'safety-budget': ['safetyBudgets'],  // تصحيح: safetyBudgets في AppState
            'action-tracking': ['actionTrackingRegister'],  // تصحيح: actionTrackingRegister في AppState
            'hse': ['hseNonConformities'],  // تصحيح: hseNonConformities في AppState
            'safety-performance-kpis': ['safetyPerformanceKPIs'],
            'kpi-annual-plan': ['kpiAnnualPlans'],
            'hse-monitoring-plan': ['hseMonitoringPlans'],
            'legal-documents': ['legalDocuments'],
            'safety-health-management': ['safetyTeamMembers'],  // تصحيح: safetyTeamMembers في AppState
            'sop-jha': ['sopJHA'],
            'periodic-inspections': ['periodicInspectionCategories']  // تصحيح: periodicInspectionCategories في AppState
        };

        return sectionModulesMap[section] || [];
    },

    getModuleForSheetName(sheetName) {
        const normalized = String(sheetName || '').trim().toLowerCase();
        const moduleToSheetMap = {
            users: 'Users',
            medications: 'Medications',
            clinicVisits: 'ClinicVisits',
            sickLeave: 'SickLeave',
            injuries: 'Injuries',
            clinicInventory: 'ClinicInventory',
            incidents: 'Incidents',
            nearmiss: 'NearMiss',
            ptw: 'PTW',
            training: 'Training',
            fireEquipment: 'FireEquipment',
            ppe: 'PPE',
            ppeStock: 'PPEStock',
            violations: 'Violations',
            approvedContractors: 'ApprovedContractors',
            contractors: 'Contractors',
            employees: 'Employees',
            externalWorkforceMonthly: 'ExternalWorkforceMonthly',
            behaviorMonitoring: 'BehaviorMonitoring',
            chemicalSafety: 'ChemicalSafety',
            dailyObservations: 'DailyObservations',
            isoDocuments: 'ISODocuments',
            sustainability: 'Sustainability',
            riskAssessments: 'RiskAssessments',
            emergencyAlerts: 'EmergencyAlerts',
            emergencyPlans: 'EmergencyPlans',
            emergencyPlansUpdates: 'EmergencyPlansUpdates',
            safetyBudgets: 'SafetyBudgets',
            actionTrackingRegister: 'ActionTrackingRegister',
            hseNonConformities: 'HSENonConformities',
            safetyPerformanceKPIs: 'SafetyPerformanceKPIs',
            legalDocuments: 'LegalDocuments',
            safetyTeamMembers: 'SafetyTeamMembers',
            sopJHA: 'SOPJHA',
            periodicInspectionCategories: 'PeriodicInspectionCategories'
        };

        return Object.keys(moduleToSheetMap).find(module => {
            return String(moduleToSheetMap[module]).toLowerCase() === normalized;
        }) || null;
    },

    getModulesForSheets(sheets = []) {
        if (!Array.isArray(sheets)) {
            return [];
        }

        return sheets
            .map(sheetName => this.getModuleForSheetName(sheetName))
            .filter((module, index, array) => module && array.indexOf(module) === index);
    },

    /**
     * الحصول على اسم الـ Sheet للموديول
     * ملاحظة: بعض الموديولات لها أكثر من sheet، نرجع الـ sheet الرئيسي
     */
    getSheetNameForModule(module) {
        const moduleToSheetMap = {
            'users': 'Users',
            // موديولات العيادة الطبية
            'medications': 'Medications',
            'clinicVisits': 'ClinicVisits',
            'sickLeave': 'SickLeave',
            'injuries': 'Injuries',
            'clinicInventory': 'ClinicInventory',
            
            // موديولات السلامة الأساسية
            'incidents': 'Incidents',
            'nearmiss': 'NearMiss',  // تصحيح: nearmiss في AppState
            'ptw': 'PTW',
            'training': 'Training',
            'fireEquipment': 'FireEquipment',
            'ppe': 'PPE',
            'ppeStock': 'PPEStock',  // ✅ إضافة: مخزون مهمات الوقاية
            'violations': 'Violations',
            'approvedContractors': 'ApprovedContractors',
            'contractors': 'Contractors',
            'employees': 'Employees',
            'externalWorkforceMonthly': 'ExternalWorkforceMonthly',
            
            // موديولات السلامة المتقدمة
            'behaviorMonitoring': 'BehaviorMonitoring',
            'chemicalSafety': 'ChemicalSafety',
            'dailyObservations': 'DailyObservations',
            
            // موديولات الجودة والبيئة
            'isoDocuments': 'ISODocuments',  // تصحيح: isoDocuments في AppState
            'sustainability': 'Sustainability',
            'riskAssessments': 'RiskAssessments',  // تصحيح: riskAssessments في AppState
            
            // موديولات الإدارة
            'emergencyAlerts': 'EmergencyAlerts',  // تصحيح: emergencyAlerts في AppState
            'emergencyPlans': 'EmergencyPlans',
            'emergencyPlansUpdates': 'EmergencyPlansUpdates',
            'safetyBudgets': 'SafetyBudgets',  // تصحيح: safetyBudgets في AppState
            'actionTrackingRegister': 'ActionTrackingRegister',  // تصحيح: actionTrackingRegister في AppState
            'hseNonConformities': 'HSENonConformities',  // تصحيح: hseNonConformities في AppState
            'safetyPerformanceKPIs': 'SafetyPerformanceKPIs',
            'legalDocuments': 'LegalDocuments',
            'safetyTeamMembers': 'SafetyTeamMembers',  // تصحيح: safetyTeamMembers في AppState
            'sopJHA': 'SOPJHA',
            'periodicInspectionCategories': 'PeriodicInspectionCategories'  // تصحيح: periodicInspectionCategories في AppState
        };

        return moduleToSheetMap[module] || null;
    },

    shouldRefreshModule(module) {
        if (module === 'users') {
            return true;
        }

        const currentSection = this.state.currentSection || AppState.currentSection || null;
        if (!currentSection) {
            return false;
        }

        const sectionModules = this.getModulesForSection(currentSection);
        return Array.isArray(sectionModules) && sectionModules.includes(module);
    },

    /**
     * حساب hash للبيانات للكشف عن التغييرات
     */
    calculateDataHash(data) {
        if (!data || !Array.isArray(data)) {
            return '0';
        }

        // حساب hash بسيط بناءً على الطول وآخر تحديث
        const length = data.length;
        const lastUpdated = data.length > 0 ?
            (data[data.length - 1]?.updatedAt || data[data.length - 1]?.createdAt || '') : '';

        return `${length}-${lastUpdated}`;
    },

    /**
     * دمج البيانات الجديدة
     */
    mergeData(module, newRecords) {
        // ✅ تحسين: التأكد من وجود الموديول قبل الدمج
        if (!AppState.appData) {
            AppState.appData = {};
        }
        
        if (!AppState.appData[module]) {
            AppState.appData[module] = [];
        }

        const existingData = AppState.appData[module];

        // ✅ تحسين: التحقق من أن existingData هي مصفوفة
        if (!Array.isArray(existingData)) {
            AppState.appData[module] = [];
            realtimeSyncLog(`⚠️ ${module}: البيانات الحالية ليست مصفوفة - تم إعادة تهيئتها`);
        }

        // دمج السجلات الجديدة
        if (Array.isArray(newRecords)) {
            // ✅ تحسين: التحقق من أن newRecords ليست فارغة قبل الدمج
            if (newRecords.length === 0) {
                realtimeSyncLog(`ℹ️ ${module}: لا توجد سجلات جديدة للدمج`);
                return;
            }
            
            newRecords.forEach(newRecord => {
                if (!newRecord || typeof newRecord !== 'object') {
                    return; // تخطي السجلات غير الصالحة
                }
                
                const index = existingData.findIndex(r => r && r.id === newRecord.id);
                if (index !== -1) {
                    // تحديث سجل موجود
                    existingData[index] = newRecord;
                } else {
                    // إضافة سجل جديد
                    existingData.push(newRecord);
                }
            });
        } else if (newRecords && typeof newRecords === 'object') {
            // سجل واحد
            if (newRecords.id) {
                const index = existingData.findIndex(r => r && r.id === newRecords.id);
                if (index !== -1) {
                    existingData[index] = newRecords;
                } else {
                    existingData.push(newRecords);
                }
            }
        }

        // حفظ محلياً
        if (typeof DataManager !== 'undefined' && DataManager.save) {
            DataManager.save();
        }
    },

    /**
     * حفظ حالة الواجهة قبل إعادة الرسم
     */
    saveModuleUIState(module) {
        const stateMap = {
            'dailyObservations': () => {
                if (typeof DailyObservations !== 'undefined' && DailyObservations.saveUIState) {
                    DailyObservations.saveUIState();
                }
            },
            'ppe': () => {
                if (typeof PPE !== 'undefined' && PPE.state) {
                    // ✅ إصلاح: استخدام selector صحيح (data-tab فقط)
                    const activeTabBtn = document.querySelector('.ppe-tab-btn.active');
                    if (activeTabBtn) {
                        const tabName = activeTabBtn.getAttribute('data-tab');
                        if (tabName) {
                            PPE.state.activeTab = tabName;
                        }
                    }
                }
            },
            'clinic': () => {
                if (typeof Clinic !== 'undefined' && Clinic.state) {
                    const activeTabBtn = document.querySelector('.clinic-tab-btn.active, .tab-btn.active[data-clinic-tab]');
                    if (activeTabBtn) {
                        const tabName = activeTabBtn.getAttribute('data-clinic-tab') || activeTabBtn.getAttribute('data-tab');
                        if (tabName) {
                            Clinic.state.activeTab = tabName;
                        }
                    }
                }
            }
        };

        const saveFn = stateMap[module];
        if (saveFn) {
            try {
                saveFn();
            } catch (error) {
                console.warn(`⚠️ خطأ في حفظ حالة واجهة ${module}:`, error);
            }
        }
    },

    /**
     * استعادة حالة الواجهة بعد إعادة الرسم
     */
    restoreModuleUIState(module) {
        const restoreMap = {
            'dailyObservations': () => {
                if (typeof DailyObservations !== 'undefined' && DailyObservations.restoreUIState) {
                    DailyObservations.restoreUIState();
                }
            },
            'ppe': () => {
                if (typeof PPE !== 'undefined' && PPE.state && PPE.state.activeTab) {
                    setTimeout(() => {
                        // ✅ إصلاح: استخدام selector صحيح (data-tab فقط)
                        const tabBtn = document.querySelector(`.ppe-tab-btn[data-tab="${PPE.state.activeTab}"]`);
                        if (tabBtn && !tabBtn.classList.contains('active')) {
                            tabBtn.click();
                        }
                    }, 150);
                }
            },
            'clinic': () => {
                if (typeof Clinic !== 'undefined' && Clinic.state && Clinic.state.activeTab) {
                    setTimeout(() => {
                        const tabBtn = document.querySelector(`.clinic-tab-btn[data-clinic-tab="${Clinic.state.activeTab}"], .tab-btn[data-tab="${Clinic.state.activeTab}"]`);
                        if (tabBtn) {
                            tabBtn.click();
                        } else if (typeof Clinic.switchTab === 'function') {
                            Clinic.switchTab(Clinic.state.activeTab);
                        }
                    }, 150);
                }
            }
        };

        const restoreFn = restoreMap[module];
        if (restoreFn) {
            try {
                restoreFn();
            } catch (error) {
                console.warn(`⚠️ خطأ في استعادة حالة واجهة ${module}:`, error);
            }
        }
    },

    /**
     * تحديث واجهة الموديول
     */
    refreshModuleUI(module) {
        // حفظ حالة الواجهة قبل التحديث
        this.saveModuleUIState(module);

        // تحديث الواجهة بناءً على الموديول
        const refreshMap = {
            'users': () => {
                if (typeof Users !== 'undefined') {
                    // تحديث القائمة فقط إذا كان القسم مفتوحاً
                    const section = document.getElementById('users-section');
                    if (section && Users.load) {
                        Users.load();
                    } else if (section && Users.showList) {
                        Users.showList();
                    }
                }
            },
            'medications': () => {
                if (typeof Clinic !== 'undefined' && Clinic.renderMedicationsTab) {
                    Clinic.renderMedicationsTab();
                }
            },
            'clinicVisits': () => {
                if (typeof Clinic !== 'undefined') {
                    // حفظ حالة التبويبات قبل إعادة الرسم
                    const activeVisitType = Clinic.state?.activeVisitType || 'employees';
                    const activeTab = Clinic.state?.activeTab;
                    
                    // إذا كان التبويب النشط هو visits، نحافظ على visitType
                    if (activeTab === 'visits' && Clinic.renderVisitsTab) {
                        Clinic.renderVisitsTab();
                        // التأكد من الحفاظ على styles للتبويبات
                        setTimeout(() => {
                            const visitTabs = document.querySelectorAll('.visit-type-tab');
                            const tabContainer = document.querySelector('.flex.border-b.border-gray-200');
                            if (tabContainer && !tabContainer.style.flexWrap) {
                                tabContainer.style.setProperty('flex-wrap', 'nowrap', 'important');
                                tabContainer.style.setProperty('overflow-x', 'auto', 'important');
                                tabContainer.style.setProperty('overflow-y', 'visible', 'important');
                            }
                            visitTabs.forEach(tab => {
                                if (!tab.style.flexShrink) {
                                    tab.style.setProperty('flex-shrink', '0', 'important');
                                    tab.style.setProperty('min-width', 'fit-content', 'important');
                                    tab.style.setProperty('white-space', 'nowrap', 'important');
                                    tab.style.setProperty('width', 'auto', 'important');
                                    tab.style.setProperty('max-width', 'none', 'important');
                                }
                            });
                        }, 100);
                    } else if (Clinic.renderVisitsList) {
                        Clinic.renderVisitsList();
                    }
                }
            },
            'sickLeave': () => {
                if (typeof Clinic !== 'undefined' && Clinic.renderSickLeaveTab) {
                    Clinic.renderSickLeaveTab();
                }
            },
            'injuries': () => {
                if (typeof Clinic !== 'undefined' && Clinic.renderInjuriesTab) {
                    Clinic.renderInjuriesTab();
                }
            },
            'incidents': () => {
                if (typeof Incidents !== 'undefined' && Incidents.load) {
                    // حفظ حالة التبويبات قبل إعادة الرسم
                    if (Incidents.state && typeof Incidents.state.activeTab !== 'undefined') {
                        const activeTabBtn = document.querySelector('.incidents-tab-btn.active, .tab-btn.active[data-incidents-tab]');
                        if (activeTabBtn) {
                            const tabName = activeTabBtn.getAttribute('data-incidents-tab') || activeTabBtn.getAttribute('data-tab');
                            if (tabName) {
                                Incidents.state.activeTab = tabName;
                            }
                        }
                    }
                    Incidents.load();
                    // استعادة حالة التبويبات بعد إعادة الرسم
                    if (Incidents.state && Incidents.state.activeTab) {
                        setTimeout(() => {
                            const tabBtn = document.querySelector(`.incidents-tab-btn[data-incidents-tab="${Incidents.state.activeTab}"], .tab-btn[data-tab="${Incidents.state.activeTab}"]`);
                            if (tabBtn) tabBtn.click();
                        }, 200);
                    }
                }
            },
            'nearmiss': () => {  // تصحيح: nearmiss في AppState
                if (typeof NearMiss !== 'undefined' && NearMiss.load) {
                    // حفظ حالة التبويبات قبل إعادة الرسم
                    if (NearMiss.state && typeof NearMiss.state.activeTab !== 'undefined') {
                        const activeTabBtn = document.querySelector('.nearmiss-tab-btn.active, .tab-btn.active[data-nearmiss-tab]');
                        if (activeTabBtn) {
                            const tabName = activeTabBtn.getAttribute('data-nearmiss-tab') || activeTabBtn.getAttribute('data-tab');
                            if (tabName) {
                                NearMiss.state.activeTab = tabName;
                            }
                        }
                    }
                    NearMiss.load();
                    // استعادة حالة التبويبات بعد إعادة الرسم
                    if (NearMiss.state && NearMiss.state.activeTab) {
                        setTimeout(() => {
                            const tabBtn = document.querySelector(`.nearmiss-tab-btn[data-nearmiss-tab="${NearMiss.state.activeTab}"], .tab-btn[data-tab="${NearMiss.state.activeTab}"]`);
                            if (tabBtn) tabBtn.click();
                        }, 200);
                    }
                }
            },
            'fireEquipment': () => {
                if (typeof FireEquipment !== 'undefined') {
                    // أولاً: تحويل البيانات من fireEquipment إلى fireEquipmentAssets و fireEquipmentInspections
                    if (FireEquipment.ensureData) {
                        FireEquipment.ensureData();
                    }

                    // ثم: تحديث التبويب الحالي
                    if (FireEquipment.state && FireEquipment.state.currentTab === 'register') {
                        // استخدام الدالة الموحدة لتحديث جدول السجل
                        if (FireEquipment.refreshRegisterTable) {
                            FireEquipment.refreshRegisterTable();
                        } else if (FireEquipment.refreshCurrentTab) {
                            FireEquipment.refreshCurrentTab();
                        }
                    } else if (FireEquipment.refreshCurrentTab) {
                        FireEquipment.refreshCurrentTab();
                    } else if (FireEquipment.renderAssets) {
                        // إذا كان التبويب هو قاعدة البيانات
                        if (FireEquipment.state && FireEquipment.state.currentTab === 'database') {
                            FireEquipment.renderAssets();
                        } else if (FireEquipment.state && FireEquipment.state.currentTab === 'inspections') {
                            // تحديث تبويب الفحوصات
                            if (FireEquipment.getMonthlyInspections) {
                                const inspections = FireEquipment.getMonthlyInspections();
                                const completedEl = document.getElementById('inspections-completed');
                                const needsRepairEl = document.getElementById('inspections-needs-repair');
                                const outOfServiceEl = document.getElementById('inspections-out-of-service');
                                const totalEl = document.getElementById('inspections-total');

                                if (completedEl) completedEl.textContent = inspections.completed;
                                if (needsRepairEl) needsRepairEl.textContent = inspections.needsRepair;
                                if (outOfServiceEl) outOfServiceEl.textContent = inspections.outOfService;
                                if (totalEl) totalEl.textContent = inspections.total;

                                const tableContainer = document.getElementById('monthly-inspections-table');
                                if (tableContainer && FireEquipment.renderMonthlyInspectionsTable) {
                                    tableContainer.innerHTML = FireEquipment.renderMonthlyInspectionsTable(inspections.list);
                                }
                            }
                        } else if (FireEquipment.state && FireEquipment.state.currentTab === 'analytics') {
                            // تحديث تبويب التحليل
                            if (FireEquipment.renderAnalyticsData) {
                                FireEquipment.renderAnalyticsData();
                            }
                        }
                    }
                }
            },
            'training': () => {
                if (typeof Training !== 'undefined' && Training.load) {
                    // حفظ حالة التبويبات قبل إعادة الرسم
                    if (Training.state && typeof Training.state.activeTab !== 'undefined') {
                        const activeTabBtn = document.querySelector('.training-tab-btn.active, .tab-btn.active[data-training-tab]');
                        if (activeTabBtn) {
                            const tabName = activeTabBtn.getAttribute('data-training-tab') || activeTabBtn.getAttribute('data-tab');
                            if (tabName) {
                                Training.state.activeTab = tabName;
                            }
                        }
                    }
                    Training.load();
                    // استعادة حالة التبويبات بعد إعادة الرسم
                    if (Training.state && Training.state.activeTab) {
                        setTimeout(() => {
                            const tabBtn = document.querySelector(`.training-tab-btn[data-training-tab="${Training.state.activeTab}"], .tab-btn[data-tab="${Training.state.activeTab}"]`);
                            if (tabBtn) tabBtn.click();
                        }, 200);
                    }
                }
            },
            'ppe': () => {
                if (typeof PPE !== 'undefined') {
                    // ✅ إصلاح: استخدام refreshActiveTab بدلاً من إعادة تحميل كامل
                    // هذا يضمن تحديث البيانات مع الحفاظ على حالة التبويب النشط
                    
                    // حفظ حالة التبويب النشط
                    const activeTabBtn = document.querySelector('.ppe-tab-btn.active');
                    if (activeTabBtn) {
                        const tabName = activeTabBtn.getAttribute('data-tab');
                        if (tabName && PPE.state) {
                            PPE.state.activeTab = tabName;
                        }
                    }
                    
                    // ✅ مسح Cache لضمان تحميل البيانات الجديدة
                    if (PPE.clearCache) {
                        PPE.clearCache();
                    }
                    
                    // ✅ استخدام refreshActiveTab إذا كان الموديول محمّل
                    const section = document.getElementById('ppe-section');
                    if (section && PPE.refreshActiveTab) {
                        // تحديث التبويب النشط فقط دون إعادة تحميل كامل
                        PPE.refreshActiveTab();
                    } else if (PPE.load) {
                        // إذا لم يكن الموديول محمّل، تحميله كاملاً
                        PPE.load();
                    }
                }
            },
            'ppeStock': () => {
                // ✅ تحديث بيانات مخزون مهمات الوقاية
                if (typeof PPE !== 'undefined') {
                    // مسح Cache لضمان تحميل البيانات الجديدة
                    if (PPE.clearCache) {
                        PPE.clearCache();
                    }
                    
                    // تحديث التبويب النشط فقط إذا كان المخزون
                    const section = document.getElementById('ppe-section');
                    if (section && PPE.state && PPE.state.activeTab === 'stock-control' && PPE.refreshActiveTab) {
                        PPE.refreshActiveTab();
                    }
                }
            },
            'violations': () => {
                if (typeof Violations !== 'undefined' && Violations.load) {
                    // حفظ حالة التبويبات قبل إعادة الرسم
                    if (Violations.state && typeof Violations.state.activeTab !== 'undefined') {
                        const activeTabBtn = document.querySelector('.violations-tab-btn.active, .tab-btn.active[data-violations-tab]');
                        if (activeTabBtn) {
                            const tabName = activeTabBtn.getAttribute('data-violations-tab') || activeTabBtn.getAttribute('data-tab');
                            if (tabName) {
                                Violations.state.activeTab = tabName;
                            }
                        }
                    }
                    Violations.load();
                    // استعادة حالة التبويبات بعد إعادة الرسم
                    if (Violations.state && Violations.state.activeTab) {
                        setTimeout(() => {
                            const tabBtn = document.querySelector(`.violations-tab-btn[data-violations-tab="${Violations.state.activeTab}"], .tab-btn[data-tab="${Violations.state.activeTab}"]`);
                            if (tabBtn) tabBtn.click();
                        }, 200);
                    }
                }
            },
            'contractors': () => {
                if (typeof Contractors !== 'undefined' && Contractors.load) {
                    // ✅ إصلاح: التحقق من وجود الموديول محمّل بالفعل لتجنب إعادة الرسم المزدوج
                    const section = document.getElementById('contractors-section');
                    if (!section) {
                        // إذا لم يكن الموديول محمّل، تحميله كاملاً
                        Contractors.load();
                        return;
                    }
                    
                    // ✅ إصلاح: حفظ حالة التبويبات قبل أي تحديث
                    const activeTabBtn = document.querySelector('.contractors-tab-btn.active');
                    let savedTab = null;
                    if (activeTabBtn) {
                        const tabId = activeTabBtn.id;
                        if (tabId) {
                            // استخراج اسم التبويب من ID (مثل: contractors-tab-approval-request -> approval-request)
                            savedTab = tabId.replace('contractors-tab-', '');
                        }
                    }
                    // إذا لم نجد من ID، نستخدم currentTab
                    if (!savedTab && Contractors.currentTab) {
                        savedTab = Contractors.currentTab;
                    }
                    
                    // ✅ إصلاح شامل: تجنب إعادة تحميل كامل إذا كان الموديول محمّل بالفعل
                    // فقط تحديث البيانات بدون إعادة رسم كامل لتجنب الاهتزاز
                    const currentTabContent = document.getElementById(`contractors-${savedTab || 'approval-request'}-content`);
                    if (currentTabContent && currentTabContent.innerHTML.trim() !== '') {
                        // المحتوى موجود - فقط تحديث البيانات بدون إعادة رسم
                        // ✅ إصلاح: إضافة حماية من التحديثات المتكررة
                        const lastRefresh = Contractors._lastRealtimeRefresh || 0;
                        const now = Date.now();
                        
                        // ✅ منع التحديث إذا تم استدعاؤه خلال آخر ثانية
                        if ((now - lastRefresh) < 1000) {
                            realtimeSyncLog('⚠️ refreshApprovalRequestsSection تم استدعاؤها مؤخراً من RealtimeSyncManager - تم تجاهل الاستدعاء المكرر');
                            return;
                        }
                        
                        Contractors._lastRealtimeRefresh = now;
                        
                        // ✅ CRITICAL: إزالة requestAnimationFrame لمنع الاهتزاز - تنفيذ مباشر
                        // ✅ التحقق من أن التبويب نشط
                        if (Contractors.currentTab !== (savedTab || 'approval-request')) {
                            return;
                        }
                        
                        if (savedTab === 'approval-request' && typeof Contractors.refreshApprovalRequestsSection === 'function') {
                            Contractors.refreshApprovalRequestsSection();
                        } else if (savedTab && typeof Contractors.switchTab === 'function') {
                            // فقط تبديل التبويب بدون إعادة تحميل كامل
                            Contractors.switchTab(savedTab);
                        }
                    } else {
                        // المحتوى غير موجود - تحميل كامل
                        // ✅ CRITICAL: منع استدعاء load إذا كان قيد التنفيذ
                        if (!Contractors._isLoading) {
                            Contractors.load().then(() => {
                                // استعادة حالة التبويبات بعد التحميل
                                if (savedTab && typeof Contractors.switchTab === 'function') {
                                    // ✅ CRITICAL: إزالة requestAnimationFrame - تنفيذ مباشر
                                    Contractors.switchTab(savedTab);
                                }
                            }).catch(err => {
                                realtimeSyncLog('❌ خطأ في تحميل Contractors:', err);
                            });
                        } else {
                            realtimeSyncLog('⚠️ Contractors.load() قيد التنفيذ بالفعل - تم تجاهل الاستدعاء');
                        }
                    }
                }
            },
            'dailyObservations': () => {
                if (typeof DailyObservations !== 'undefined' && DailyObservations.load) {
                    DailyObservations.load();
                }
            },
            'ptw': () => {
                if (typeof PTW !== 'undefined') {
                    if (PTW.loadPTWList) {
                        PTW.loadPTWList();
                    }
                    if (PTW.updateKPIs) {
                        PTW.updateKPIs();
                    }
                    if (PTW.currentTab === 'map' && PTW.updateMapMarkers) {
                        PTW.updateMapMarkers();
                    }
                    if (PTW.currentTab === 'registry' && PTW.renderRegistryContent) {
                        const registryContent = document.getElementById('ptw-registry-content');
                        if (registryContent) {
                            registryContent.innerHTML = PTW.renderRegistryContent();
                            if (PTW.setupRegistryEventListeners) PTW.setupRegistryEventListeners();
                        }
                    }
                }
            }
        };

        const refreshFn = refreshMap[module];
        if (refreshFn) {
            try {
                refreshFn();
                realtimeSyncLog(`🔄 تم تحديث واجهة ${module}`);

                // استعادة حالة الواجهة بعد التحديث
                setTimeout(() => {
                    this.restoreModuleUIState(module);
                }, 200);
            } catch (error) {
                console.warn(`⚠️ خطأ في تحديث واجهة ${module}:`, error);
            }
        } else {
            console.warn(`⚠️ لا يوجد معالج تحديث للموديول: ${module}`);
        }
    },

    /**
     * عرض إشعار بالتحديثات
     */
    showUpdateNotification(module, data) {
        const moduleNames = {
            'medications': 'الأدوية',
            'clinicVisits': 'زيارات العيادة',
            'sickLeave': 'الإجازات المرضية',
            'injuries': 'الإصابات',
            'incidents': 'الحوادث',
            'nearmiss': 'الحوادث الوشيكة',  // تصحيح: nearmiss في AppState
            'ptw': 'تصاريح العمل'
        };

        const moduleName = moduleNames[module] || module;
        const action = data?.action || 'تحديث';

        if (typeof Notification !== 'undefined' && Notification.info) {
            Notification.info(`تم ${action} سجل في ${moduleName}`);
        }
    },

    /**
     * عرض إشعار ببيانات جديدة
     */
    showNewDataNotification(module, count) {
        const moduleNames = {
            'medications': 'أدوية',
            'clinicVisits': 'زيارات',
            'sickLeave': 'إجازات مرضية',
            'injuries': 'إصابات',
            'incidents': 'حوادث',
            'nearmiss': 'حوادث وشيكة',  // تصحيح: nearmiss في AppState
            'ptw': 'تصاريح عمل'
        };

        const moduleName = moduleNames[module] || module;

        if (typeof Notification !== 'undefined' && Notification.info) {
            Notification.info(`${count} ${moduleName} جديدة تم إضافتها`);
        }
    },

    /**
     * إضافة سجل مزامنة
     */
    addSyncLog(log) {
        this.state.syncHistory.unshift({
            ...log,
            id: Date.now().toString()
        });

        // الاحتفاظ بآخر 50 سجل فقط
        if (this.state.syncHistory.length > 50) {
            this.state.syncHistory = this.state.syncHistory.slice(0, 50);
        }
    },

    /**
     * الحصول على معلومات المزامنة
     */
    getSyncInfo() {
        return {
            isActive: this.state.isActive,
            isSyncing: this.state.isSyncing,
            lastSyncTime: this.state.lastSyncTime,
            stats: this.stats,
            config: this.config,
            history: this.state.syncHistory.slice(0, 10)
        };
    },

    /**
     * تفعيل/تعطيل المزامنة التلقائية
     */
    toggleAutoSync(enable = null) {
        if (enable === null) {
            enable = !this.config.enableAutoSync;
        }

        this.config.enableAutoSync = enable;
        this.saveSettings();

        if (enable) {
            this.startAutoSync();
            realtimeSyncLog('✅ تم تفعيل المزامنة التلقائية');
        } else {
            this.stopAutoSync();
            realtimeSyncLog('⏸️ تم تعطيل المزامنة التلقائية');
        }

        return enable;
    },

    /**
     * تحديث فترة المزامنة
     */
    updateSyncInterval(intervalMs) {
        if (intervalMs < 30000) {
            console.warn('⚠️ الحد الأدنى لفترة المزامنة هو 30 ثانية');
            intervalMs = 30000;
        }

        this.config.syncInterval = intervalMs;
        this.saveSettings();

        // إعادة تشغيل المزامنة بالفترة الجديدة
        if (this.state.isActive) {
            this.stopAutoSync();
            this.startAutoSync();
        }

        realtimeSyncLog(`✅ تم تحديث فترة المزامنة إلى ${intervalMs / 1000} ثانية`);
    },

    /**
     * التحقق من الموديولات الفارغة وإرجاع تقرير
     */
    checkEmptyModules() {
        const emptyModules = [];
        const moduleStats = {};

        this.config.autoSyncModules.forEach(module => {
            const data = AppState.appData[module];
            const isEmpty = !data || !Array.isArray(data) || data.length === 0;
            
            moduleStats[module] = {
                isEmpty,
                count: Array.isArray(data) ? data.length : 0,
                hasData: Array.isArray(data) && data.length > 0
            };

            if (isEmpty) {
                emptyModules.push(module);
            }
        });

        return {
            emptyModules,
            moduleStats,
            totalModules: this.config.autoSyncModules.length,
            emptyCount: emptyModules.length,
            hasEmptyModules: emptyModules.length > 0
        };
    },

    /**
     * التحقق من حالة التحميل لجميع الموديولات
     */
    verifyDataIntegrity() {
        const report = {
            timestamp: new Date().toISOString(),
            modules: {},
            issues: [],
            summary: {
                total: 0,
                loaded: 0,
                empty: 0,
                errors: 0
            }
        };

        this.config.autoSyncModules.forEach(module => {
            const data = AppState.appData[module];
            const isEmpty = !data || !Array.isArray(data) || data.length === 0;
            const isInvalid = data !== undefined && !Array.isArray(data);

            report.modules[module] = {
                exists: data !== undefined,
                isArray: Array.isArray(data),
                isEmpty,
                isInvalid,
                count: Array.isArray(data) ? data.length : 0,
                lastSync: this.state.lastSyncTime[module] || null
            };

            report.summary.total++;

            if (isInvalid) {
                report.issues.push({
                    module,
                    type: 'invalid',
                    message: `الموديول ${module} يحتوي على بيانات غير صالحة (ليست مصفوفة)`
                });
                report.summary.errors++;
            } else if (isEmpty) {
                report.summary.empty++;
            } else {
                report.summary.loaded++;
            }
        });

        return report;
    },

    /**
     * تنظيف الموارد
     */
    cleanup() {
        this.stopAutoSync();

        if (this.state.broadcastChannel) {
            this.state.broadcastChannel.close();
            this.state.broadcastChannel = null;
        }

        if (this.state.usersMetaPollId) {
            clearInterval(this.state.usersMetaPollId);
            this.state.usersMetaPollId = null;
        }

        realtimeSyncLog('🧹 تم تنظيف موارد نظام المزامنة');
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.RealtimeSyncManager = RealtimeSyncManager;
}

// تهيئة تلقائية عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (typeof AppState !== 'undefined' && AppState.isLoggedIn) {
                RealtimeSyncManager.init().catch(err => {
                    console.warn('⚠️ خطأ في تهيئة نظام المزامنة التلقائية:', err);
                });
            }
        }, 2000);
    });
} else {
    setTimeout(() => {
        if (typeof AppState !== 'undefined' && AppState.isLoggedIn) {
            RealtimeSyncManager.init().catch(err => {
                console.warn('⚠️ خطأ في تهيئة نظام المزامنة التلقائية:', err);
            });
        }
    }, 2000);
}
