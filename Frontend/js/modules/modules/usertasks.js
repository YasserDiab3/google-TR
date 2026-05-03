/**
 * UserTasks Module
 * ØªÙ… Ø§Ø³ØªØ®Ø±Ø§Ø¬Ù‡ Ù…Ù† app-modules.js
 */
// ===== User Tasks Module =====
const UserTasks = {
    // Cache للبيانات
    cache: {
        members: null,
        tasks: new Map(),
        lastLoad: null
    },

    // إعدادات الأداء
    config: {
        cacheTimeout: 5 * 60 * 1000, // 5 دقائق
        debounceDelay: 300, // تأخير البحث
        batchSize: 50, // حجم الدفعة للتحميل
        syncInterval: 30 * 1000 // تحديث تلقائي كل 30 ثانية
    },

    // متغير لحفظ معرف التحديث التلقائي
    autoSyncTimer: null,
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
        const target = root || document.getElementById('user-tasks-section') || document;
        if (typeof i18nCore.applyI18n === 'function') i18nCore.applyI18n(target);
        if (typeof i18nCore.applyLiteralTranslations === 'function') i18nCore.applyLiteralTranslations(target);
    },

    /**
     * تهيئة البيانات
     */
    ensureData() {
        if (!AppState.appData.userTasks) {
            AppState.appData.userTasks = [];
        }
    },

    /**
     * تحميل الموديول
     */
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('user-tasks-section');
        if (!section) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('قسم user-tasks-section غير موجود!');
            } else {
                console.error('قسم user-tasks-section غير موجود!');
            }
            return;
        }

        // التحقق من توفر AppState (لا تترك الواجهة فارغة)
        if (typeof AppState === 'undefined') {
            section.innerHTML = `
                <div class="content-card">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-2">تعذر تحميل مهام المستخدمين</p>
                            <p class="text-sm text-gray-400">AppState غير متوفر حالياً. جرّب تحديث الصفحة.</p>
                            <button onclick="location.reload()" class="btn-primary mt-4">
                                <i class="fas fa-redo ml-2"></i>
                                تحديث الصفحة
                            </button>
                        </div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(section);
            return;
        }

        this.ensureData();

        if (typeof Utils !== 'undefined' && Utils.safeLog) {
            Utils.safeLog('✅ تحميل مديول مهام المستخدمين');
        }

        try {
            // Skeleton فوري قبل أي render قد يكون بطيئاً
            section.innerHTML = `
                <div class="section-header">
                    <h1 class="section-title">
                        <i class="fas fa-tasks ml-3"></i>
                        ${this.t('module.userTasks.title', 'مهام المستخدمين')}
                    </h1>
                    <p class="section-subtitle">${this.t('module.userTasks.loading', 'جاري التحميل...')}</p>
                </div>
                <div class="content-card mt-6">
                    <div class="card-body">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">${this.t('module.userTasks.preparingUi', 'جاري تجهيز الواجهة...')}</p>
                        </div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(section);

            // عرض واجهة مناسبة بناءً على دور المستخدم
            const isAdmin = AppState.currentUser?.role === 'admin' || AppState.currentUser?.role === 'safety_officer';

            let content = '';
            try {
                if (isAdmin) {
                    // عرض لوحة المدير
                    const contentPromise = this.render();
                    content = await Utils.promiseWithTimeout(
                        contentPromise,
                        10000,
                        () => new Error('Timeout: render took too long')
                    );
                } else {
                    // عرض لوحة المستخدم الفرعية
                    const contentPromise = this.renderUserDashboard();
                    content = await Utils.promiseWithTimeout(
                        contentPromise,
                        10000,
                        () => new Error('Timeout: renderUserDashboard took too long')
                    );
                }
            } catch (error) {
                if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                    Utils.safeWarn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                } else {
                    console.warn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                }
                // عرض محتوى افتراضي مع إمكانية إعادة المحاولة
                content = `
                    <div class="section-header">
                        <h1 class="section-title">
                            <i class="fas fa-tasks ml-3"></i>
                            ${this.t('module.userTasks.title', 'مهام المستخدمين')}
                        </h1>
                    </div>
                    <div class="content-card mt-6">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-4">${this.t('module.common.loadDataError', 'حدث خطأ في تحميل البيانات')}</p>
                            <button onclick="UserTasks.load()" class="btn-primary">
                                <i class="fas fa-redo ml-2"></i>
                                ${this.t('module.common.retry', 'إعادة المحاولة')}
                            </button>
                        </div>
                    </div>
                `;
            }

            section.innerHTML = content;
            this.applyModuleI18n(section);

            // تهيئة الأحداث بعد عرض الواجهة
            try {
                if (isAdmin) {
                    this.setupEventListeners();
                    
                    // تحميل البيانات فوراً بعد عرض الواجهة (حتى لو كانت البيانات فارغة)
                    // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
                    try {
                        setTimeout(() => {
                            this.loadMembers().catch(() => {});
                        }, 0);
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في تحميل الأعضاء الأولي:', error);
                    }
                    
                    // تحميل البيانات بشكل غير متزامن بعد عرض الواجهة (للتحديث)
                    setTimeout(() => {
                        this.loadMembers().then(() => {
                            // تحديث الواجهة بعد تحميل البيانات لضمان عرض البيانات المحدثة
                            // الواجهة يتم تحديثها تلقائياً في loadMembers
                        }).catch(error => {
                            Utils.safeWarn('⚠️ خطأ في تحميل الأعضاء:', error);
                        });
                    }, 100);
                } else {
                    this.setupUserDashboardListeners();
                    
                    // تحميل البيانات فوراً بعد عرض الواجهة (حتى لو كانت البيانات فارغة)
                    // هذا يضمن عدم بقاء الواجهة فارغة بعد التحميل
                    try {
                        setTimeout(() => {
                            this.loadUserTasks().catch(() => {});
                        }, 0);
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في تحميل مهام المستخدم الأولي:', error);
                    }
                    
                    // تحميل البيانات بشكل غير متزامن بعد عرض الواجهة (للتحديث)
                    setTimeout(() => {
                        this.loadUserTasks().then(() => {
                            // تحديث الواجهة بعد تحميل البيانات لضمان عرض البيانات المحدثة
                            // الواجهة يتم تحديثها تلقائياً في loadUserTasks
                        }).catch(error => {
                            Utils.safeWarn('⚠️ خطأ في تحميل مهام المستخدم:', error);
                        });
                    }, 100);
                }
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تهيئة الأحداث:', error);
            }

            // تفعيل المزامنة التلقائية
            try {
                this.startAutoSync();
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تفعيل المزامنة التلقائية:', error);
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل موديول مهام المستخدمين:', error);
            section.innerHTML = `
                <div class="section-header">
                    <h1 class="section-title">
                        <i class="fas fa-tasks ml-3"></i>
                        ${this.t('module.userTasks.title', 'مهام المستخدمين')}
                    </h1>
                </div>
                <div class="content-card mt-6">
                    <div class="card-body">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                            <p class="text-gray-500 mb-2">${this.t('module.common.loadDataRuntimeError', 'حدث خطأ أثناء تحميل البيانات')}</p>
                            <p class="text-sm text-gray-400 mb-4">${error && error.message ? Utils.escapeHTML(error.message) : 'خطأ غير معروف'}</p>
                            <button onclick="UserTasks.load()" class="btn-primary">
                                <i class="fas fa-redo ml-2"></i>
                                ${this.t('module.common.retry', 'إعادة المحاولة')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            this.applyModuleI18n(section);
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('حدث خطأ أثناء تحميل مهام المستخدمين. يُرجى المحاولة مرة أخرى.', { duration: 5000 });
            }
        }
    },

    /**
     * تفعيل المزامنة التلقائية
     */
    startAutoSync() {
        // التحقق من تكوين Google Apps Script قبل بدء المزامنة
        if (typeof AppState !== 'undefined') {
            const isGoogleConfigured = AppState.googleConfig?.appsScript?.enabled &&
                AppState.googleConfig?.appsScript?.scriptUrl &&
                AppState.googleConfig.appsScript.scriptUrl.trim() !== '';

            if (!isGoogleConfigured) {
                Utils.safeLog('ℹ️ لن يتم تفعيل المزامنة التلقائية: Google Apps Script غير مفعل أو غير مُكوَّن');
                return;
            }
        }

        // إيقاف أي مزامنة سابقة
        this.stopAutoSync();

        Utils.safeLog('🔄 تفعيل المزامنة التلقائية للمهام...');

        // تفعيل المزامنة التلقائية
        this.autoSyncTimer = setInterval(async () => {
            try {
                await this.syncTasks();
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في المزامنة التلقائية:', error);
            }
        }, this.config.syncInterval);
    },

    /**
     * إيقاف المزامنة التلقائية
     */
    stopAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
            Utils.safeLog('🛑 إيقاف المزامنة التلقائية للمهام');
        }
    },

    /**
     * مزامنة المهام من Google Sheets
     */
    async syncTasks() {
        try {
            // التحقق الشامل من توفر Google Apps Script
            if (typeof AppState === 'undefined') {
                return;
            }

            // فحص شامل لإعدادات Google Apps Script
            const isGoogleConfigured = AppState.googleConfig?.appsScript?.enabled &&
                AppState.googleConfig?.appsScript?.scriptUrl &&
                AppState.googleConfig.appsScript.scriptUrl.trim() !== '';

            if (!isGoogleConfigured) {
                // Google Apps Script غير مفعل أو غير مُكوَّن بشكل صحيح
                // إيقاف المزامنة التلقائية لتجنب الأخطاء المتكررة
                if (this.autoSyncTimer) {
                    this.stopAutoSync();
                    Utils.safeLog('⚠️ تم إيقاف المزامنة التلقائية: Google Apps Script غير مفعل أو غير مُكوَّن');
                }
                return;
            }

            if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') {
                Utils.safeWarn('⚠️ GoogleIntegration غير متاح');
                // إيقاف المزامنة التلقائية
                if (this.autoSyncTimer) {
                    this.stopAutoSync();
                }
                return;
            }

            // تحديد دور المستخدم
            const isAdmin = AppState.currentUser?.role === 'admin' || AppState.currentUser?.role === 'safety_officer';
            const userId = AppState.currentUser?.id || AppState.currentUser?.email;

            let response;

            try {
                if (isAdmin) {
                    // المدير: جلب جميع المهام
                    response = await GoogleIntegration.sendRequest({
                        action: 'getAllUserTasks',
                        data: {}
                    });
                } else {
                    // المستخدم: جلب مهامه فقط
                    response = await GoogleIntegration.sendRequest({
                        action: 'getUserTasksByUserId',
                        data: { userId: userId }
                    });
                }
            } catch (requestError) {
                // تجاهل أخطاء Circuit Breaker و Google Apps Script غير المفعل
                const errorMsg = String(requestError?.message || '').toLowerCase();

                // فحص أخطاء الاتصال والتكوين
                if (errorMsg.includes('circuit breaker') ||
                    errorMsg.includes('google apps script غير مفعل') ||
                    errorMsg.includes('غير مفعل') ||
                    errorMsg.includes('انتهت مهلة الاتصال') ||
                    errorMsg.includes('timeout') ||
                    errorMsg.includes('failed to fetch') ||
                    errorMsg.includes('networkerror')) {

                    // إيقاف المزامنة التلقائية لتجنب الأخطاء المتكررة
                    if (this.autoSyncTimer) {
                        this.stopAutoSync();
                        Utils.safeLog('⚠️ تم إيقاف المزامنة التلقائية بسبب مشاكل في الاتصال');
                    }
                    // هذه أخطاء متوقعة - لا حاجة لتسجيلها
                    return;
                }
                // إعادة رمي الأخطاء الأخرى
                throw requestError;
            }

            if (response.success && Array.isArray(response.data)) {
                const oldTasksCount = AppState.appData.userTasks?.length || 0;
                AppState.appData.userTasks = response.data;
                const newTasksCount = response.data.length;

                // حساب عدد المهام الخاصة بالمستخدم الحالي فقط (للإشعارات)
                let userTasksCount = newTasksCount;
                let oldUserTasksCount = oldTasksCount;

                if (!isAdmin && userId) {
                    // للمستخدم العادي، عد المهام الخاصة به فقط
                    const oldUserTasks = (AppState.appData.userTasks || []).filter(t =>
                        (t.userId || t.assignedTo) === userId
                    );
                    oldUserTasksCount = oldUserTasks.length;
                    userTasksCount = response.data.length;
                }

                // تحديث الواجهة إذا كانت هناك تغييرات
                if (oldTasksCount !== newTasksCount) {
                    Utils.safeLog(`✅ تمت المزامنة: ${newTasksCount} مهمة`);

                    // تحديث الواجهة بناءً على دور المستخدم
                    if (isAdmin) {
                        await this.loadTasks();
                    } else {
                        await this.loadUserTasks();
                    }

                    // عرض إشعار إذا كانت هناك مهام جديدة للمستخدم
                    if (userTasksCount > oldUserTasksCount && !isAdmin) {
                        const diff = userTasksCount - oldUserTasksCount;
                        Notification.info(`لديك ${diff} مهمة جديدة`);
                    }
                }
            }
        } catch (error) {
            Utils.safeWarn('⚠️ خطأ في مزامنة المهام:', error);
        }
    },

    /**
     * عرض الواجهة
     */
    async render() {
        const stats = this.getStats();

        return `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-tasks ml-3"></i>
                            مهام المستخدمين
                        </h1>
                        <p class="section-subtitle">${this.t('module.userTasks.adminSubtitle', 'إدارة ومتابعة مهام المستخدمين')}</p>
                    </div>
                    <div class="flex gap-2">
                        <button id="export-tasks-pdf-btn" class="btn-secondary">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تقرير PDF
                        </button>
                        <button id="export-tasks-excel-btn" class="btn-success">
                            <i class="fas fa-file-excel ml-2"></i>
                            تصدير Excel
                        </button>
                        <button id="add-task-btn" class="btn-primary">
                            <i class="fas fa-plus ml-2"></i>
                            إضافة مهمة جديدة
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- إحصائيات -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-tasks text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">${this.t('module.userTasks.totalTasks', 'إجمالي المهام')}</p>
                            <p class="text-2xl font-bold text-gray-900" id="total-tasks-count">${stats.total}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-check-circle text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">${this.t('module.userTasks.completedTasks', 'مهام مكتملة')}</p>
                            <p class="text-2xl font-bold text-gray-900" id="completed-tasks-count">${stats.completed}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-clock text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">${this.t('module.userTasks.inProgress', 'قيد التنفيذ')}</p>
                            <p class="text-2xl font-bold text-gray-900" id="in-progress-tasks-count">${stats.inProgress}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">${this.t('module.userTasks.overdueTasks', 'مهام متأخرة')}</p>
                            <p class="text-2xl font-bold text-gray-900" id="overdue-tasks-count">${stats.overdue}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- الفلترة والبحث -->
            <div class="content-card mt-6">
                <div class="card-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            قائمة المهام
                        </h2>
                        <div class="flex items-center gap-3 flex-wrap">
                            <select id="task-user-filter" class="form-input" style="min-width: 200px;">
                                <option value="">${this.t('module.userTasks.allUsers', 'جميع المستخدمين')}</option>
                            </select>
                            <select id="task-status-filter" class="form-input" style="min-width: 150px;">
                                <option value="">${this.t('module.userTasks.allStatuses', 'جميع الحالات')}</option>
                                <option value="قيد التنفيذ">${this.t('module.userTasks.inProgress', 'قيد التنفيذ')}</option>
                                <option value="مكتمل">${this.t('module.userTasks.completed', 'مكتمل')}</option>
                                <option value="ملغي">${this.t('module.userTasks.cancelled', 'ملغي')}</option>
                            </select>
                            <select id="task-priority-filter" class="form-input" style="min-width: 150px;">
                                <option value="">${this.t('module.userTasks.allPriorities', 'جميع الأولويات')}</option>
                                <option value="عالي">${this.t('module.userTasks.priorityHigh', 'عالي')}</option>
                                <option value="متوسط">${this.t('module.userTasks.priorityMedium', 'متوسط')}</option>
                                <option value="منخفض">${this.t('module.userTasks.priorityLow', 'منخفض')}</option>
                            </select>
                            <input type="text" id="task-search-input" class="form-input" style="min-width: 250px;" placeholder="${this.t('module.userTasks.searchTasksPlaceholder', 'بحث في المهام...')}">
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="tasks-list-container">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500">${this.t('module.userTasks.loading', 'جاري التحميل...')}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * عرض لوحة تحكم المستخدم الفرعية (User Sub-Dashboard)
     */
    async renderUserDashboard() {
        const userId = AppState.currentUser?.id || AppState.currentUser?.email;
        const userTasks = (AppState.appData.userTasks || []).filter(t =>
            (t.userId || t.assignedTo) === userId
        );
        const now = new Date();

        // إحصائيات المستخدم
        const stats = {
            total: userTasks.length,
            new: userTasks.filter(t => t.status === 'جديدة' || !t.status).length,
            inProgress: userTasks.filter(t => t.status === 'قيد التنفيذ' || t.status === 'in-progress').length,
            completed: userTasks.filter(t => t.status === 'مكتمل' || t.status === 'completed').length,
            overdue: userTasks.filter(t => {
                if (t.status === 'مكتمل' || t.status === 'completed') return false;
                if (!t.dueDate) return false;
                const dueDate = new Date(t.dueDate);
                return dueDate < now;
            }).length
        };

        return `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-tasks ml-3"></i>
                            مهامي
                        </h1>
                        <p class="section-subtitle">${this.t('module.userTasks.userSubtitle', 'عرض وإدارة مهامك الشخصية')}</p>
                    </div>
                    <div class="flex gap-2">
                        <button id="user-refresh-tasks-btn" class="btn-secondary">
                            <i class="fas fa-sync-alt ml-2"></i>
                            تحديث
                        </button>
                        <button id="user-export-tasks-pdf-btn" class="btn-info">
                            <i class="fas fa-file-pdf ml-2"></i>
                            تصدير PDF
                        </button>
                    </div>
                </div>
            </div>

            <!-- إحصائيات المهام -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-tasks text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">${this.t('module.userTasks.totalTasks', 'إجمالي المهام')}</p>
                            <p class="text-2xl font-bold text-gray-900" id="user-total-tasks">${stats.total}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-star text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">${this.t('module.userTasks.newTasks', 'مهام جديدة')}</p>
                            <p class="text-2xl font-bold text-gray-900" id="user-new-tasks">${stats.new}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-clock text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">قيد التنفيذ</p>
                            <p class="text-2xl font-bold text-gray-900" id="user-in-progress-tasks">${stats.inProgress}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-check-circle text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">مكتملة</p>
                            <p class="text-2xl font-bold text-gray-900" id="user-completed-tasks">${stats.completed}</p>
                        </div>
                    </div>
                </div>
                <div class="content-card">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-sm">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">متأخرة</p>
                            <p class="text-2xl font-bold text-gray-900" id="user-overdue-tasks">${stats.overdue}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- رسالة المزامنة التلقائية -->
            <div class="content-card mt-6 bg-blue-50 border-blue-200">
                <div class="flex items-center gap-3">
                    <i class="fas fa-info-circle text-blue-600 text-xl"></i>
                    <div>
                        <p class="text-sm font-semibold text-blue-800">تحديث تلقائي</p>
                        <p class="text-xs text-blue-600">سيتم تحديث قائمة المهام تلقائياً كل 30 ثانية</p>
                    </div>
                    <div class="mr-auto">
                        <span class="text-xs text-blue-600" id="last-sync-time">آخر تحديث: الآن</span>
                    </div>
                </div>
            </div>

            <!-- الفلترة والبحث -->
            <div class="content-card mt-6">
                <div class="card-header">
                    <div class="flex items-center justify-between flex-wrap gap-4">
                        <h2 class="card-title">
                            <i class="fas fa-list ml-2"></i>
                            قائمة المهام
                        </h2>
                        <div class="flex items-center gap-3 flex-wrap">
                            <select id="user-task-status-filter" class="form-input" style="min-width: 150px;">
                                <option value="">جميع الحالات</option>
                                <option value="جديدة">جديدة</option>
                                <option value="قيد التنفيذ">قيد التنفيذ</option>
                                <option value="مكتمل">مكتملة</option>
                            </select>
                            <select id="user-task-priority-filter" class="form-input" style="min-width: 150px;">
                                <option value="">جميع الأولويات</option>
                                <option value="عالي">عالي</option>
                                <option value="متوسط">متوسط</option>
                                <option value="منخفض">منخفض</option>
                            </select>
                            <input type="text" id="user-task-search-input" class="form-input" style="min-width: 250px;" placeholder="بحث في المهام...">
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <div id="user-tasks-list-container">
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
    },

    /**
     * إعداد مستمعي أحداث لوحة المستخدم
     */
    setupUserDashboardListeners() {
        setTimeout(() => {
            // زر التحديث
            const refreshBtn = document.getElementById('user-refresh-tasks-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async () => {
                    Notification.info('جاري التحديث...');
                    await this.syncTasks();
                });
            }

            // زر التصدير
            const exportPdfBtn = document.getElementById('user-export-tasks-pdf-btn');
            if (exportPdfBtn) {
                exportPdfBtn.addEventListener('click', () => this.exportUserTasksToPDF());
            }

            // الفلاتر
            const statusFilter = document.getElementById('user-task-status-filter');
            const priorityFilter = document.getElementById('user-task-priority-filter');
            const searchInput = document.getElementById('user-task-search-input');

            if (statusFilter) {
                statusFilter.addEventListener('change', () => this.loadUserTasks());
            }
            if (priorityFilter) {
                priorityFilter.addEventListener('change', () => this.loadUserTasks());
            }
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.filterUserTasks(e.target.value);
                    }, this.config.debounceDelay);
                });
            }
        }, 100);
    },

    /**
     * تحميل مهام المستخدم الحالي
     * @param {number} page - رقم الصفحة (افتراضي: 1)
     */
    async loadUserTasks(page = 1) {
        const container = document.getElementById('user-tasks-list-container');
        if (!container) return;

        try {
            // التحقق من توفر AppState
            if (typeof AppState === 'undefined' || !AppState.appData) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
                        <p class="text-yellow-600">جاري تحميل البيانات...</p>
                    </div>
                `;
                return;
            }

            const userId = AppState.currentUser?.id || AppState.currentUser?.email;
            if (!userId) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-slash text-4xl text-gray-300 mb-4"></i>
                        <p class="text-gray-500">لم يتم تحديد المستخدم</p>
                    </div>
                `;
                return;
            }

            let tasks = (AppState.appData.userTasks || []).filter(t =>
                (t.userId || t.assignedTo) === userId
            );

            // تطبيق الفلاتر
            const status = document.getElementById('user-task-status-filter')?.value;
            const priority = document.getElementById('user-task-priority-filter')?.value;

            if (status) {
                tasks = tasks.filter(t => (t.status || '') === status);
            }
            if (priority) {
                tasks = tasks.filter(t => (t.priority || '') === priority);
            }

            // ترتيب حسب التاريخ
            tasks.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });

            // عرض المهام مع pagination - تمرير رقم الصفحة
            this.renderUserTasks(tasks, page);

            // تحديث الإحصائيات - استخدام جميع المهام بدون فلترة
            const allUserTasks = (AppState.appData.userTasks || []).filter(t =>
                (t.userId || t.assignedTo) === userId
            );
            this.updateUserStats(allUserTasks);

            // تحديث وقت آخر تحديث
            const lastSyncEl = document.getElementById('last-sync-time');
            if (lastSyncEl) {
                const now = new Date();
                lastSyncEl.textContent = `آخر تحديث: ${now.toLocaleTimeString('ar-EG')}`;
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل المهام:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-red-500">حدث خطأ في تحميل المهام</p>
                    <button onclick="UserTasks.loadUserTasks()" class="btn-primary mt-4">
                        <i class="fas fa-redo ml-2"></i>
                        إعادة المحاولة
                    </button>
                </div>
            `;
        }
    },

    /**
     * عرض مهام المستخدم
     * @param {Array} tasks - المهام المراد عرضها
     * @param {number} page - رقم الصفحة (افتراضي: 1)
     * @param {number} itemsPerPage - عدد العناصر في الصفحة (افتراضي: 50)
     */
    renderUserTasks(tasks, page = 1, itemsPerPage = 50) {
        const container = document.getElementById('user-tasks-list-container');
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد مهام</p>
                </div>
            `;
            this.applyModuleI18n(container);
            return;
        }

        // Pagination - عرض جزء من المهام فقط لتحسين الأداء
        const totalPages = Math.ceil(tasks.length / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, tasks.length);
        const paginatedTasks = tasks.slice(startIndex, endIndex);

        const now = new Date();

        container.innerHTML = `
            ${tasks.length > itemsPerPage ? `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <span class="text-sm text-blue-800">
                        <i class="fas fa-info-circle ml-2"></i>
                        عرض ${startIndex + 1} - ${endIndex} من ${tasks.length} مهمة
                    </span>
                    <div class="flex gap-2">
                        ${page > 1 ? `
                            <button onclick="UserTasks.loadUserTasks(${page - 1})" class="btn-icon btn-icon-secondary text-xs">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        ` : ''}
                        <span class="text-sm text-gray-600 px-2 py-1">صفحة ${page} من ${totalPages}</span>
                        ${page < totalPages ? `
                            <button onclick="UserTasks.loadUserTasks(${page + 1})" class="btn-icon btn-icon-secondary text-xs">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
            <div class="space-y-3">
                ${paginatedTasks.map(task => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < now &&
                task.status !== 'مكتمل' && task.status !== 'completed';
            const priorityClass = task.priority === 'عالي' ? 'badge-danger' :
                task.priority === 'منخفض' ? 'badge-success' : 'badge-warning';
            const statusClass = task.status === 'مكتمل' || task.status === 'completed' ? 'badge-success' :
                task.status === 'قيد التنفيذ' || task.status === 'in-progress' ? 'badge-info' :
                    'badge-secondary';

            return `
                        <div class="content-card ${isOverdue ? 'border-red-300 bg-red-50' : ''}" data-task-id="${task.id}" data-search="${(task.title || task.taskTitle || '').toLowerCase()} ${(task.description || task.taskDescription || '').toLowerCase()}">
                            <div class="flex items-start justify-between gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        <h3 class="font-semibold text-gray-900">${Utils.escapeHTML(task.title || task.taskTitle || '')}</h3>
                                        <span class="badge ${priorityClass}">${Utils.escapeHTML(task.priority || 'متوسط')}</span>
                                        <span class="badge ${statusClass}">${Utils.escapeHTML(task.status || 'جديدة')}</span>
                                        ${isOverdue ? '<span class="badge badge-danger">متأخرة</span>' : ''}
                                    </div>
                                    ${task.description || task.taskDescription ? `
                                        <p class="text-sm text-gray-600 mb-2">${Utils.escapeHTML((task.description || task.taskDescription).substring(0, 150))}${(task.description || task.taskDescription).length > 150 ? '...' : ''}</p>
                                    ` : ''}
                                    <div class="flex items-center gap-4 text-xs text-gray-500">
                                        ${task.dueDate ? `<span><i class="fas fa-calendar ml-1"></i>تاريخ الاستحقاق: ${Utils.formatDate(task.dueDate)}</span>` : ''}
                                        ${task.taskType ? `<span><i class="fas fa-tag ml-1"></i>${Utils.escapeHTML(task.taskType)}</span>` : ''}
                                        ${task.createdAt ? `<span><i class="fas fa-clock ml-1"></i>تاريخ الإضافة: ${Utils.formatDate(task.createdAt)}</span>` : ''}
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="UserTasks.viewUserTask('${task.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button onclick="UserTasks.updateTaskStatus('${task.id}')" class="btn-icon btn-icon-primary" title="تحديث الحالة">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
        this.applyModuleI18n(container);

        // تحديث الإحصائيات - لا حاجة لاستدعائها لأن loadUserTasks تستدعيها بالفعل
        // this.updateUserStats();
    },

    /**
     * تحديث إحصائيات المستخدم
     * @param {Array} tasks - اختياري: المهام المراد حساب الإحصائيات لها (لتجنب الفلترة المتكررة)
     */
    updateUserStats(tasks = null) {
        const userId = AppState.currentUser?.id || AppState.currentUser?.email;

        // إذا لم يتم تمرير المهام، قم بفلترتها
        if (!tasks) {
            tasks = (AppState.appData.userTasks || []).filter(t =>
                (t.userId || t.assignedTo) === userId
            );
        }

        const now = new Date();

        const stats = {
            total: tasks.length,
            new: tasks.filter(t => t.status === 'جديدة' || !t.status).length,
            inProgress: tasks.filter(t => t.status === 'قيد التنفيذ' || t.status === 'in-progress').length,
            completed: tasks.filter(t => t.status === 'مكتمل' || t.status === 'completed').length,
            overdue: tasks.filter(t => {
                if (t.status === 'مكتمل' || t.status === 'completed') return false;
                if (!t.dueDate) return false;
                const dueDate = new Date(t.dueDate);
                return dueDate < now;
            }).length
        };

        document.getElementById('user-total-tasks').textContent = stats.total;
        document.getElementById('user-new-tasks').textContent = stats.new;
        document.getElementById('user-in-progress-tasks').textContent = stats.inProgress;
        document.getElementById('user-completed-tasks').textContent = stats.completed;
        document.getElementById('user-overdue-tasks').textContent = stats.overdue;
    },

    /**
     * فلترة مهام المستخدم
     */
    filterUserTasks(searchTerm) {
        searchTerm = searchTerm.toLowerCase().trim();
        const rows = document.querySelectorAll('#user-tasks-list-container [data-task-id]');

        rows.forEach(row => {
            const searchData = row.getAttribute('data-search');
            if (!searchTerm || searchData.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    /**
     * عرض تفاصيل مهمة المستخدم
     */
    async viewUserTask(taskId) {
        const task = AppState.appData.userTasks.find(t => t.id === taskId);
        if (!task) {
            Notification.error('المهمة غير موجودة');
            return;
        }

        const priorityClass = task.priority === 'عالي' ? 'badge-danger' :
            task.priority === 'منخفض' ? 'badge-success' : 'badge-warning';
        const statusClass = task.status === 'مكتمل' || task.status === 'completed' ? 'badge-success' :
            task.status === 'قيد التنفيذ' || task.status === 'in-progress' ? 'badge-info' :
                'badge-secondary';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-tasks ml-2"></i>
                        تفاصيل المهمة
                    </h2>
                    <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1">عنوان المهمة</label>
                            <p class="text-gray-900 font-semibold">${Utils.escapeHTML(task.title || task.taskTitle || '')}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">الأولوية</label>
                                <p><span class="badge ${priorityClass}">${Utils.escapeHTML(task.priority || 'متوسط')}</span></p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">الحالة</label>
                                <p><span class="badge ${statusClass}">${Utils.escapeHTML(task.status || 'جديدة')}</span></p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">تاريخ الاستحقاق</label>
                                <p class="text-gray-900">${task.dueDate ? Utils.formatDate(task.dueDate) : '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">نوع المهمة</label>
                                <p class="text-gray-900">${Utils.escapeHTML(task.taskType || task.type || '—')}</p>
                            </div>
                        </div>
                        ${task.description || task.taskDescription ? `
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">الوصف</label>
                                <p class="text-gray-900 whitespace-pre-wrap">${Utils.escapeHTML(task.description || task.taskDescription)}</p>
                            </div>
                        ` : ''}
                        ${task.notes ? `
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">ملاحظات</label>
                                <p class="text-gray-900 whitespace-pre-wrap">${Utils.escapeHTML(task.notes)}</p>
                            </div>
                        ` : ''}
                        <div class="grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">تاريخ الإضافة</label>
                                <p class="text-gray-900">${task.createdAt ? Utils.formatDate(task.createdAt) : '—'}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">آخر تحديث</label>
                                <p class="text-gray-900">${task.updatedAt ? Utils.formatDate(task.updatedAt) : '—'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" onclick="UserTasks.updateTaskStatus('${taskId}'); this.closest('.modal-overlay').remove();">
                        <i class="fas fa-edit ml-2"></i>
                        تحديث الحالة
                    </button>
                    <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times ml-2"></i>
                        إغلاق
                    </button>
                </div>
            </div>
        `;
        this.applyModuleI18n(modal);
        document.body.appendChild(modal);
    },

    /**
     * تحديث حالة المهمة
     */
    async updateTaskStatus(taskId) {
        const task = AppState.appData.userTasks.find(t => t.id === taskId);
        if (!task) {
            Notification.error('المهمة غير موجودة');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container" style="max-width: 500px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-edit ml-2"></i>
                        تحديث حالة المهمة
                    </h2>
                    <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="update-task-status-form">
                    <div class="modal-body">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">عنوان المهمة</label>
                                <p class="text-gray-900">${Utils.escapeHTML(task.title || task.taskTitle || '')}</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة *</label>
                                <select id="update-task-status" class="form-input" required>
                                    <option value="جديدة" ${(task.status === 'جديدة' || !task.status) ? 'selected' : ''}>جديدة</option>
                                    <option value="قيد التنفيذ" ${task.status === 'قيد التنفيذ' || task.status === 'in-progress' ? 'selected' : ''}>قيد التنفيذ</option>
                                    <option value="مكتمل" ${task.status === 'مكتمل' || task.status === 'completed' ? 'selected' : ''}>مكتملة</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات (اختياري)</label>
                                <textarea id="update-task-notes" class="form-input" rows="3" placeholder="أضف ملاحظات حول التقدم...">${Utils.escapeHTML(task.notes || '')}</textarea>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            حفظ التحديث
                        </button>
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times ml-2"></i>
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        const form = document.getElementById('update-task-status-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newStatus = document.getElementById('update-task-status').value;
            const notes = document.getElementById('update-task-notes').value.trim();

            try {
                const index = AppState.appData.userTasks.findIndex(t => t.id === taskId);
                if (index !== -1) {
                    AppState.appData.userTasks[index] = {
                        ...AppState.appData.userTasks[index],
                        status: newStatus,
                        notes: notes,
                        updatedAt: new Date().toISOString()
                    };

                    // حفظ البيانات باستخدام window.DataManager
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    } else {
                        Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
                    }

                    // محاولة الحفظ في Google Sheets
                    try {
                        await GoogleIntegration.autoSave?.('UserTasks', AppState.appData.userTasks);
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في حفظ التحديث في Google Sheets:', error);
                    }

                    Notification.success('تم تحديث حالة المهمة بنجاح');
                    modal.remove();
                    await this.loadUserTasks();
                }
            } catch (error) {
                Utils.safeError('خطأ في تحديث المهمة:', error);
                Notification.error('فشل تحديث المهمة');
            }
        });
    },

    /**
     * تصدير مهام المستخدم إلى PDF
     */
    async exportUserTasksToPDF() {
        try {
            Loading.show();
            const userId = AppState.currentUser?.id || AppState.currentUser?.email;
            const tasks = (AppState.appData.userTasks || []).filter(t =>
                (t.userId || t.assignedTo) === userId
            );

            if (tasks.length === 0) {
                Loading.hide();
                Notification.warning('لا توجد مهام للتصدير');
                return;
            }

            const userName = AppState.currentUser?.name || AppState.currentUser?.displayName || 'المستخدم';

            const rowsHtml = tasks.map((task, index) => {
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${Utils.escapeHTML(task.title || task.taskTitle || '')}</td>
                        <td>${Utils.escapeHTML(task.priority || 'متوسط')}</td>
                        <td>${Utils.escapeHTML(task.status || 'جديدة')}</td>
                        <td>${task.dueDate ? Utils.formatDate(task.dueDate) : '—'}</td>
                    </tr>
                `;
            }).join('');

            const content = `
                <div class="summary-grid">
                    <div class="summary-card">
                        <span class="summary-label">المستخدم</span>
                        <span class="summary-value">${Utils.escapeHTML(userName)}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">عدد المهام</span>
                        <span class="summary-value">${tasks.length}</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-label">تاريخ التقرير</span>
                        <span class="summary-value">${Utils.formatDate(new Date())}</span>
                    </div>
                </div>
                <div class="section-title">قائمة المهام</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">#</th>
                            <th>عنوان المهمة</th>
                            <th style="width: 100px;">الأولوية</th>
                            <th style="width: 100px;">الحالة</th>
                            <th style="width: 120px;">تاريخ الاستحقاق</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;

            const formCode = `USER-TASKS-${userId?.substring(0, 8) || 'UNKNOWN'}-${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(
                    formCode,
                    'تقرير مهامي الشخصية',
                    content,
                    false,
                    true,
                    {
                        version: '1.0',
                        source: 'UserTasks',
                        user: userName,
                        qrData: {
                            type: 'UserTasks',
                            userId: userId,
                            userName: userName,
                            count: tasks.length
                        }
                    },
                    new Date().toISOString(),
                    new Date().toISOString()
                )
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>مهامي الشخصية</title></head><body>${content}</body></html>`;

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
                            Notification.success('تم تجهيز التقرير للطباعة');
                        }, 1000);
                    }, 500);
                };
            } else {
                Loading.hide();
                Notification.error('يرجى السماح للنافذة المنبثقة لعرض التقرير');
            }
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير التقرير');
        }
    },

    /**
     * الحصول على الإحصائيات
     */
    getStats() {
        this.ensureData();
        const tasks = AppState.appData.userTasks || [];
        const now = new Date();

        return {
            total: tasks.length,
            completed: tasks.filter(t => t.status === 'مكتمل' || t.status === 'completed').length,
            inProgress: tasks.filter(t => t.status === 'قيد التنفيذ' || t.status === 'in-progress').length,
            overdue: tasks.filter(t => {
                if (t.status === 'مكتمل' || t.status === 'completed') return false;
                if (!t.dueDate) return false;
                const dueDate = new Date(t.dueDate);
                return dueDate < now;
            }).length
        };
    },

    /**
     * ربط الأحداث
     */
    setupEventListeners() {
        setTimeout(() => {
            // زر إضافة مهمة
            const addBtn = document.getElementById('add-task-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.showTaskForm());
            }

            // الفلاتر
            const userFilter = document.getElementById('task-user-filter');
            const statusFilter = document.getElementById('task-status-filter');
            const priorityFilter = document.getElementById('task-priority-filter');
            const searchInput = document.getElementById('task-search-input');

            if (userFilter) {
                userFilter.addEventListener('change', () => this.loadTasks());
            }
            if (statusFilter) {
                statusFilter.addEventListener('change', () => this.loadTasks());
            }
            if (priorityFilter) {
                priorityFilter.addEventListener('change', () => this.loadTasks());
            }
            if (searchInput) {
                // Debounce للبحث
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.filterTasks(e.target.value);
                    }, this.config.debounceDelay);
                });
            }

            // أزرار التصدير
            const exportPdfBtn = document.getElementById('export-tasks-pdf-btn');
            const exportExcelBtn = document.getElementById('export-tasks-excel-btn');

            if (exportPdfBtn) {
                exportPdfBtn.addEventListener('click', () => this.exportToPDF());
            }
            if (exportExcelBtn) {
                exportExcelBtn.addEventListener('click', () => this.exportToExcel());
            }
        }, 100);
    },

    /**
     * تحميل قائمة المستخدمين
     */
    async loadMembers() {
        try {
            // استخدام Cache إذا كان متاحاً
            if (this.cache.members && this.cache.lastLoad &&
                (Date.now() - this.cache.lastLoad) < this.config.cacheTimeout) {
                this.populateMemberFilter(this.cache.members);
                return;
            }

            // محاولة الحصول من Google Sheets
            if (AppState.googleConfig.appsScript.enabled) {
                try {
                    // استخدام readFromSheets بدلاً من getUsers
                    const users = await GoogleIntegration.readFromSheets('Users');

                    if (users && Array.isArray(users)) {
                        this.cache.members = users;
                        this.cache.lastLoad = Date.now();
                        this.populateMemberFilter(users);

                        // تحميل المهام بعد تحميل المستخدمين
                        await this.loadTasks();
                        return;
                    }
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في تحميل المستخدمين من Google Sheets:', error);
                }
            }

            // استخدام البيانات المحلية
            const users = AppState.appData.users || [];
            this.cache.members = users;
            this.cache.lastLoad = Date.now();
            this.populateMemberFilter(users);

            // تحميل المهام
            await this.loadTasks();
        } catch (error) {
            Utils.safeError('خطأ في تحميل المستخدمين:', error);
            Notification.error('فشل تحميل قائمة المستخدمين');
        }
    },

    /**
     * ملء قائمة المستخدمين في الفلتر
     */
    populateMemberFilter(users) {
        const userFilter = document.getElementById('task-user-filter');
        if (!userFilter) return;

        userFilter.innerHTML = '<option value="">جميع المستخدمين</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id || user.email;
            option.textContent = user.name || user.email || user.fullName || 'مستخدم غير معروف';
            userFilter.appendChild(option);
        });
    },

    /**
     * تحميل المهام
     */
    async loadTasks() {
        const container = document.getElementById('tasks-list-container');
        if (!container) return;

        try {
            this.ensureData();
            let tasks = AppState.appData.userTasks || [];

            // تطبيق الفلاتر
            const userId = document.getElementById('task-user-filter')?.value;
            const status = document.getElementById('task-status-filter')?.value;
            const priority = document.getElementById('task-priority-filter')?.value;

            if (userId) {
                tasks = tasks.filter(t => (t.userId || t.assignedTo) === userId);
            }
            if (status) {
                tasks = tasks.filter(t => (t.status || '') === status);
            }
            if (priority) {
                tasks = tasks.filter(t => (t.priority || '') === priority);
            }

            // ترتيب حسب التاريخ
            tasks.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.dueDate || 0);
                const dateB = new Date(b.createdAt || b.dueDate || 0);
                return dateB - dateA;
            });

            // عرض المهام
            this.renderTasks(tasks);

            // تحديث الإحصائيات
            this.updateStats();
        } catch (error) {
            Utils.safeError('خطأ في تحميل المهام:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                    <p class="text-red-500">حدث خطأ في تحميل المهام</p>
                    <button onclick="UserTasks.loadTasks()" class="btn-primary mt-4">
                        <i class="fas fa-redo ml-2"></i>
                        إعادة المحاولة
                    </button>
                </div>
            `;
        }
    },

    /**
     * عرض المهام
     */
    renderTasks(tasks) {
        const container = document.getElementById('tasks-list-container');
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tasks text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لا توجد مهام</p>
                    <button onclick="UserTasks.showTaskForm()" class="btn-primary mt-4">
                        <i class="fas fa-plus ml-2"></i>
                        إضافة مهمة جديدة
                    </button>
                </div>
            `;
            this.applyModuleI18n(container);
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper" style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>عنوان المهمة</th>
                            <th>المستخدم</th>
                            <th>نوع المهمة</th>
                            <th>الأولوية</th>
                            <th>الحالة</th>
                            <th>تاريخ الاستحقاق</th>
                            <th>تاريخ الإنشاء</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.map(task => {
            const userName = this.getUserName(task.userId || task.assignedTo);
            const priorityClass = task.priority === 'عالي' ? 'badge-danger' :
                task.priority === 'منخفض' ? 'badge-success' : 'badge-warning';
            const statusClass = task.status === 'مكتمل' ? 'badge-success' :
                task.status === 'ملغي' ? 'badge-danger' : 'badge-info';
            const dueDate = task.dueDate ? Utils.formatDate(task.dueDate) : '—';
            const createdAt = task.createdAt ? Utils.formatDate(task.createdAt) : '—';
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'مكتمل';

            return `
                                <tr class="${isOverdue ? 'bg-red-50' : ''}" data-task-id="${task.id}" data-search="${(task.title || task.taskTitle || '').toLowerCase()} ${(task.description || task.taskDescription || '').toLowerCase()}">
                                    <td>
                                        <div class="font-semibold text-gray-900">${Utils.escapeHTML(task.title || task.taskTitle || '')}</div>
                                        ${task.description || task.taskDescription ? `<div class="text-xs text-gray-500 mt-1">${Utils.escapeHTML((task.description || task.taskDescription).substring(0, 50))}${(task.description || task.taskDescription).length > 50 ? '...' : ''}</div>` : ''}
                                    </td>
                                    <td>${Utils.escapeHTML(userName)}</td>
                                    <td>${Utils.escapeHTML(task.taskType || task.type || '—')}</td>
                                    <td><span class="badge ${priorityClass}">${Utils.escapeHTML(task.priority || 'متوسط')}</span></td>
                                    <td><span class="badge ${statusClass}">${Utils.escapeHTML(task.status || 'قيد التنفيذ')}</span></td>
                                    <td class="${isOverdue ? 'text-red-600 font-semibold' : ''}">${dueDate}</td>
                                    <td>${createdAt}</td>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <button onclick="UserTasks.viewTask('${task.id}')" class="btn-icon btn-icon-info" title="عرض التفاصيل">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                            <button onclick="UserTasks.editTask('${task.id}')" class="btn-icon btn-icon-primary" title="تعديل">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button onclick="UserTasks.deleteTask('${task.id}')" class="btn-icon btn-icon-danger" title="حذف">
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
        this.applyModuleI18n(container);
    },

    /**
     * الحصول على اسم المستخدم
     */
    getUserName(userId) {
        if (!userId) return 'غير محدد';

        const users = this.cache.members || AppState.appData.users || [];
        const user = users.find(u => (u.id || u.email) === userId);
        return user ? (user.name || user.fullName || user.email || 'مستخدم') : 'غير محدد';
    },

    /**
     * فلترة المهام
     */
    filterTasks(searchTerm) {
        const normalized = searchTerm.trim().toLowerCase();
        const rows = document.querySelectorAll('#tasks-list-container tbody tr[data-task-id]');

        rows.forEach(row => {
            if (!normalized) {
                row.style.display = '';
                return;
            }
            const searchData = row.getAttribute('data-search') || '';
            row.style.display = searchData.includes(normalized) ? '' : 'none';
        });
    },

    /**
     * تحديث الإحصائيات
     */
    updateStats() {
        const stats = this.getStats();
        const totalEl = document.getElementById('total-tasks-count');
        const completedEl = document.getElementById('completed-tasks-count');
        const inProgressEl = document.getElementById('in-progress-tasks-count');
        const overdueEl = document.getElementById('overdue-tasks-count');

        if (totalEl) totalEl.textContent = stats.total;
        if (completedEl) completedEl.textContent = stats.completed;
        if (inProgressEl) inProgressEl.textContent = stats.inProgress;
        if (overdueEl) overdueEl.textContent = stats.overdue;
    },

    /**
     * عرض نموذج إضافة/تعديل مهمة
     */
    showTaskForm(task = null) {
        const users = this.cache.members || AppState.appData.users || [];
        const defaultUserId = task ? (task.userId || task.assignedTo) : (AppState.currentUser?.id || AppState.currentUser?.email || '');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-tasks ml-2"></i>
                        ${task ? 'تعديل مهمة' : 'إضافة مهمة جديدة'}
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="task-form">
                    <div class="modal-body space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">المستخدم *</label>
                            <select id="task-user-id" class="form-input" required>
                                <option value="">اختر المستخدم</option>
                                ${users.map(user => `
                                    <option value="${user.id || user.email}" ${(user.id || user.email) === defaultUserId ? 'selected' : ''}>
                                        ${Utils.escapeHTML(user.name || user.fullName || user.email || 'مستخدم')}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="task-title" class="block text-sm font-semibold text-gray-700 mb-2">عنوان المهمة *</label>
                            <input type="text" id="task-title" class="form-input" required 
                                placeholder="أدخل عنوان المهمة" 
                                value="${task ? Utils.escapeHTML(task.title || task.taskTitle || '') : ''}">
                        </div>
                        <div>
                            <label for="task-description" class="block text-sm font-semibold text-gray-700 mb-2">وصف المهمة</label>
                            <textarea id="task-description" class="form-input" rows="4" 
                                placeholder="أدخل وصف المهمة">${task ? Utils.escapeHTML(task.description || task.taskDescription || '') : ''}</textarea>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="task-type" class="block text-sm font-semibold text-gray-700 mb-2">نوع المهمة</label>
                                <select id="task-type" class="form-input">
                                    <option value="تفتيش" ${task && (task.taskType || task.type) === 'تفتيش' ? 'selected' : ''}>تفتيش</option>
                                    <option value="تدريب" ${task && (task.taskType || task.type) === 'تدريب' ? 'selected' : ''}>تدريب</option>
                                    <option value="إجراء تصحيحي" ${task && (task.taskType || task.type) === 'إجراء تصحيحي' ? 'selected' : ''}>إجراء تصحيحي</option>
                                    <option value="مراجعة" ${task && (task.taskType || task.type) === 'مراجعة' ? 'selected' : ''}>مراجعة</option>
                                    <option value="أخرى" ${task && (task.taskType || task.type) === 'أخرى' ? 'selected' : ''}>أخرى</option>
                                </select>
                            </div>
                            <div>
                                <label for="task-priority" class="block text-sm font-semibold text-gray-700 mb-2">الأولوية</label>
                                <select id="task-priority" class="form-input">
                                    <option value="منخفض" ${task && task.priority === 'منخفض' ? 'selected' : ''}>منخفض</option>
                                    <option value="متوسط" ${!task || task.priority === 'متوسط' ? 'selected' : ''}>متوسط</option>
                                    <option value="عالي" ${task && task.priority === 'عالي' ? 'selected' : ''}>عالي</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">تاريخ الاستحقاق</label>
                                <input type="date" id="task-due-date" class="form-input" 
                                    value="${task && task.dueDate ? Utils.formatDateForInput(task.dueDate) : ''}">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
                                <select id="task-status" class="form-input">
                                    <option value="قيد التنفيذ" ${!task || task.status === 'قيد التنفيذ' ? 'selected' : ''}>قيد التنفيذ</option>
                                    <option value="مكتمل" ${task && task.status === 'مكتمل' ? 'selected' : ''}>مكتمل</option>
                                    <option value="ملغي" ${task && task.status === 'ملغي' ? 'selected' : ''}>ملغي</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">ملاحظات</label>
                            <textarea id="task-notes" class="form-input" rows="3" 
                                placeholder="ملاحظات إضافية">${task ? Utils.escapeHTML(task.notes || '') : ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" data-action="close">إلغاء</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save ml-2"></i>
                            ${task ? 'تحديث المهمة' : 'حفظ المهمة'}
                        </button>
                    </div>
                </form>
            </div>
        `;
        this.applyModuleI18n(modal);

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.querySelector('[data-action="close"]')?.addEventListener('click', close);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });

        // معالج الحفظ
        modal.querySelector('#task-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveTask(task, modal);
        });
    },

    /**
     * حفظ المهمة
     */
    async saveTask(existingTask, modal) {
        try {
            const taskData = {
                userId: document.getElementById('task-user-id').value,
                title: document.getElementById('task-title').value.trim(),
                description: document.getElementById('task-description').value.trim(),
                taskType: document.getElementById('task-type').value,
                priority: document.getElementById('task-priority').value,
                dueDate: document.getElementById('task-due-date').value || null,
                status: document.getElementById('task-status').value,
                notes: document.getElementById('task-notes').value.trim(),
                assignedBy: AppState.currentUser?.id || AppState.currentUser?.email || AppState.currentUser?.name || '',
                createdAt: existingTask?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (!taskData.userId || !taskData.title) {
                Notification.warning('يرجى استكمال الحقول الإلزامية');
                return;
            }

            Loading.show();
            this.ensureData();

            if (existingTask) {
                // تحديث
                const index = AppState.appData.userTasks.findIndex(t => t.id === existingTask.id);
                if (index !== -1) {
                    AppState.appData.userTasks[index] = {
                        ...existingTask,
                        ...taskData,
                        id: existingTask.id
                    };
                }
            } else {
                // إضافة جديدة
                const newTask = {
                    id: Utils.generateId('TASK'),
                    ...taskData
                };
                AppState.appData.userTasks.push(newTask);
            }

            // حفظ البيانات باستخدام window.DataManager
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            } else {
                Utils.safeError('❌ DataManager غير متاح - فشل حفظ المهمة');
                throw new Error('نظام إدارة البيانات غير جاهز');
            }

            // حفظ في Google Sheets إذا كان مفعلاً
            if (AppState.googleConfig && AppState.googleConfig.appsScript && AppState.googleConfig.appsScript.enabled) {
                try {
                    await GoogleIntegration.autoSave?.('UserTasks', AppState.appData.userTasks);
                } catch (error) {
                    Utils.safeWarn('⚠️ خطأ في حفظ المهام في Google Sheets:', error);
                }
            }

            Notification.success(existingTask ? 'تم تحديث المهمة بنجاح' : 'تم إضافة المهمة بنجاح');
            modal.remove();

            // تحديث القائمة والإحصائيات
            await this.loadTasks();
            this.updateStats();

        } catch (error) {
            Utils.safeError('خطأ في حفظ المهمة:', error);
            Notification.error('فشل حفظ المهمة: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    /**
     * عرض تفاصيل المهمة
     */
    viewTask(taskId) {
        this.ensureData();
        const task = AppState.appData.userTasks.find(t => t.id === taskId);
        if (!task) {
            Notification.error('المهمة غير موجودة');
            return;
        }

        const userName = this.getUserName(task.userId || task.assignedTo);
        const priorityClass = task.priority === 'عالي' ? 'badge-danger' :
            task.priority === 'منخفض' ? 'badge-success' : 'badge-warning';
        const statusClass = task.status === 'مكتمل' ? 'badge-success' :
            task.status === 'ملغي' ? 'badge-danger' : 'badge-info';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-eye ml-2"></i>
                        تفاصيل المهمة
                    </h2>
                    <button class="modal-close" title="إغلاق">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    <!-- معلومات أساسية -->
                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
                            <i class="fas fa-info-circle ml-2"></i>
                            المعلومات الأساسية
                        </h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">المستخدم</label>
                                <p class="text-gray-900" style="color: var(--text-primary); font-size: 0.9375rem; margin: 0;">${Utils.escapeHTML(userName)}</p>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">عنوان المهمة</label>
                                <p class="text-gray-900 font-semibold" style="color: var(--text-primary); font-size: 0.9375rem; margin: 0;">${Utils.escapeHTML(task.title || task.taskTitle || '—')}</p>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">نوع المهمة</label>
                                <p class="text-gray-900" style="color: var(--text-primary); font-size: 0.9375rem; margin: 0;">${Utils.escapeHTML(task.taskType || task.type || '—')}</p>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">الأولوية</label>
                                <p style="margin: 0;"><span class="badge ${priorityClass}">${Utils.escapeHTML(task.priority || 'متوسط')}</span></p>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">الحالة</label>
                                <p style="margin: 0;"><span class="badge ${statusClass}">${Utils.escapeHTML(task.status || 'قيد التنفيذ')}</span></p>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">تاريخ الاستحقاق</label>
                                <p class="text-gray-900" style="color: var(--text-primary); font-size: 0.9375rem; margin: 0;">${task.dueDate ? Utils.formatDate(task.dueDate) : '—'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- معلومات التاريخ -->
                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
                            <i class="fas fa-calendar-alt ml-2"></i>
                            معلومات التاريخ
                        </h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">تاريخ الإنشاء</label>
                                <p class="text-gray-900" style="color: var(--text-primary); font-size: 0.9375rem; margin: 0;">${task.createdAt ? Utils.formatDate(task.createdAt) : '—'}</p>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color);">
                                <label class="block text-sm font-semibold text-gray-700 mb-2" style="color: var(--text-secondary);">آخر تحديث</label>
                                <p class="text-gray-900" style="color: var(--text-primary); font-size: 0.9375rem; margin: 0;">${task.updatedAt ? Utils.formatDate(task.updatedAt) : '—'}</p>
                            </div>
                        </div>
                    </div>

                    ${task.description || task.taskDescription ? `
                        <!-- وصف المهمة -->
                        <div style="margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
                                <i class="fas fa-align-right ml-2"></i>
                                وصف المهمة
                            </h3>
                            <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); min-height: 60px;">
                                <p class="text-gray-900 whitespace-pre-wrap" style="color: var(--text-primary); font-size: 0.9375rem; line-height: 1.6; margin: 0;">${Utils.escapeHTML(task.description || task.taskDescription)}</p>
                            </div>
                        </div>
                    ` : ''}
                    ${task.notes ? `
                        <!-- ملاحظات -->
                        <div style="margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color);">
                                <i class="fas fa-sticky-note ml-2"></i>
                                ملاحظات
                            </h3>
                            <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border-color); min-height: 60px;">
                                <p class="text-gray-900 whitespace-pre-wrap" style="color: var(--text-primary); font-size: 0.9375rem; line-height: 1.6; margin: 0;">${Utils.escapeHTML(task.notes)}</p>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-action="close">إغلاق</button>
                    <button type="button" class="btn-primary" onclick="UserTasks.editTask('${taskId}'); this.closest('.modal-overlay').remove();">
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

    /**
     * تعديل المهمة
     */
    editTask(taskId) {
        this.ensureData();
        const task = AppState.appData.userTasks.find(t => t.id === taskId);
        if (!task) {
            Notification.error('المهمة غير موجودة');
            return;
        }
        this.showTaskForm(task);
    },

    /**
     * حذف المهمة
     */
    async deleteTask(taskId) {
        if (!confirm('هل أنت متأكد من حذف هذه المهمة؟\n\nهذه العملية لا يمكن التراجع عنها.')) {
            return;
        }

        try {
            Loading.show();
            this.ensureData();

            const index = AppState.appData.userTasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                AppState.appData.userTasks.splice(index, 1);
                // حفظ البيانات باستخدام window.DataManager
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                } else {
                    Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
                }

                // حذف من Google Sheets إذا كان مفعلاً
                if (AppState.googleConfig.appsScript.enabled) {
                    try {
                        await GoogleIntegration.autoSave?.('UserTasks', AppState.appData.userTasks);
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في حذف المهمة من Google Sheets:', error);
                    }
                }

                Notification.success('تم حذف المهمة بنجاح');
                await this.loadTasks();
                this.updateStats();
            } else {
                Notification.error('المهمة غير موجودة');
            }
        } catch (error) {
            Utils.safeError('خطأ في حذف المهمة:', error);
            Notification.error('فشل حذف المهمة: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    /**
     * تصدير إلى PDF
     */
    async exportToPDF() {
        try {
            Loading.show();
            this.ensureData();
            const tasks = AppState.appData.userTasks || [];

            if (tasks.length === 0) {
                Notification.warning('لا توجد مهام للتصدير');
                Loading.hide();
                return;
            }

            const stats = this.getStats();
            const rowsHtml = tasks.map((task, index) => {
                const userName = this.getUserName(task.userId || task.assignedTo);
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${Utils.escapeHTML(task.title || task.taskTitle || '')}</td>
                        <td>${Utils.escapeHTML(userName)}</td>
                        <td>${Utils.escapeHTML(task.taskType || task.type || '—')}</td>
                        <td>${Utils.escapeHTML(task.priority || 'متوسط')}</td>
                        <td>${Utils.escapeHTML(task.status || 'قيد التنفيذ')}</td>
                        <td>${task.dueDate ? Utils.formatDate(task.dueDate) : '—'}</td>
                        <td>${task.createdAt ? Utils.formatDate(task.createdAt) : '—'}</td>
                    </tr>
                `;
            }).join('');

            const content = `
                <div style="margin-bottom: 24px;">
                    <h2 style="font-size: 20px; margin-bottom: 12px;">تقرير مهام المستخدمين</h2>
                    <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #EFF6FF; border: 1px solid #BFDBFE;">
                            <div style="font-size: 12px; color: #1D4ED8;">إجمالي المهام</div>
                            <div style="font-size: 26px; font-weight: 700;">${stats.total}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #ECFDF5; border: 1px solid #BBF7D0;">
                            <div style="font-size: 12px; color: #047857;">مهام مكتملة</div>
                            <div style="font-size: 26px; font-weight: 700;">${stats.completed}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #FEF3C7; border: 1px solid #FDE68A;">
                            <div style="font-size: 12px; color: #92400E;">قيد التنفيذ</div>
                            <div style="font-size: 26px; font-weight: 700;">${stats.inProgress}</div>
                        </div>
                        <div style="flex: 1 1 200px; padding: 14px; border-radius: 10px; background: #FEE2E2; border: 1px solid #FECACA;">
                            <div style="font-size: 12px; color: #991B1B;">مهام متأخرة</div>
                            <div style="font-size: 26px; font-weight: 700;">${stats.overdue}</div>
                        </div>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #1E3A8A; color: #fff;">
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">#</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">عنوان المهمة</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">المستخدم</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">النوع</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">الأولوية</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">الحالة</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">تاريخ الاستحقاق</th>
                            <th style="padding: 10px; border: 1px solid #E5E7EB;">تاريخ الإنشاء</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            `;

            const formCode = `USER-TASKS-${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && typeof FormHeader.generatePDFHTML === 'function'
                ? FormHeader.generatePDFHTML(formCode, 'تقرير مهام المستخدمين', content, false, true, { source: 'UserTasks' }, new Date().toISOString(), new Date().toISOString())
                : `<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>@page { size: A4 portrait; margin: 1cm; } @media print { @page { size: A4 portrait; margin: 1cm; } body { padding: 0; } }</style><title>تقرير مهام المستخدمين</title></head><body>${content}</body></html>`;

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const reportWindow = window.open(url, '_blank');
            if (reportWindow) {
                reportWindow.onload = () => {
                    try {
                        reportWindow.print();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (error) {
                        Utils.safeWarn('⚠️ خطأ في طباعة التقرير:', error);
                    }
                };
            }
            Loading.hide();
            Notification.success('تم إنشاء تقرير PDF بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير PDF:', error);
            Notification.error('فشل تصدير PDF: ' + error.message);
        }
    },

    /**
     * تصدير إلى Excel
     */
    exportToExcel() {
        try {
            Loading.show();
            if (typeof XLSX === 'undefined') {
                Loading.hide();
                Notification.error('مكتبة SheetJS غير محمّلة. يرجى تحديث الصفحة.');
                return;
            }

            this.ensureData();
            const tasks = AppState.appData.userTasks || [];

            if (tasks.length === 0) {
                Notification.warning('لا توجد مهام للتصدير');
                Loading.hide();
                return;
            }

            const data = tasks.map((task, index) => {
                const userName = this.getUserName(task.userId || task.assignedTo);
                return {
                    '#': index + 1,
                    'عنوان المهمة': task.title || task.taskTitle || '',
                    'المستخدم': userName,
                    'نوع المهمة': task.taskType || task.type || '',
                    'الأولوية': task.priority || 'متوسط',
                    'الحالة': task.status || 'قيد التنفيذ',
                    'تاريخ الاستحقاق': task.dueDate ? Utils.formatDate(task.dueDate) : '',
                    'تاريخ الإنشاء': task.createdAt ? Utils.formatDate(task.createdAt) : '',
                    'آخر تحديث': task.updatedAt ? Utils.formatDate(task.updatedAt) : '',
                    'الوصف': task.description || task.taskDescription || '',
                    'ملاحظات': task.notes || ''
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
                { wch: 5 },
                { wch: 30 },
                { wch: 20 },
                { wch: 15 },
                { wch: 12 },
                { wch: 15 },
                { wch: 15 },
                { wch: 15 },
                { wch: 15 },
                { wch: 40 },
                { wch: 40 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, 'مهام المستخدمين');
            const fileName = `مهام_المستخدمين_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            Loading.hide();
            Notification.success('تم تصدير المهام بنجاح');
        } catch (error) {
            Loading.hide();
            Utils.safeError('خطأ في تصدير Excel:', error);
            Notification.error('فشل تصدير Excel: ' + error.message);
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof UserTasks !== 'undefined') {
            window.UserTasks = UserTasks;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ UserTasks module loaded and available on window.UserTasks');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير UserTasks:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof UserTasks !== 'undefined') {
            try {
                window.UserTasks = UserTasks;
            } catch (e) {
                console.error('❌ فشل تصدير UserTasks:', e);
            }
        }
    }
})();