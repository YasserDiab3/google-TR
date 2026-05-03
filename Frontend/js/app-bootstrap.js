/**
 * Application Bootstrap
 * نظام بدء التطبيق المحسن
 * 
 * يدير عملية تحميل التطبيق بشكل ذكي ومتدرج
 */

(function() {
    'use strict';

    // Logger صامت في الإنتاج (يعتمد على Utils.safeLog)
    const log = (...args) => {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.safeLog === 'function') {
                Utils.safeLog(...args);
            }
        } catch (e) { /* ignore */ }
    };
    const time = (label) => {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.isProduction === 'function' && !Utils.isProduction()) {
                console.time(label);
            }
        } catch (e) { /* ignore */ }
    };
    const timeEnd = (label) => {
        try {
            if (typeof Utils !== 'undefined' && typeof Utils.isProduction === 'function' && !Utils.isProduction()) {
                console.timeEnd(label);
            }
        } catch (e) { /* ignore */ }
    };

    const AppBootstrap = {
        // المراحل
        phases: {
            INIT: 'init',
            CORE: 'core',
            SERVICES: 'services',
            UI: 'ui',
            MODULES: 'modules',
            READY: 'ready'
        },

        // الحالة الحالية
        currentPhase: null,

        // أوقات التحميل
        timings: {},

        // منع تكرار تحميل البيانات المقيد بالصلاحيات
        _permissionLoadPromise: null,
        _permissionLoadKey: null,
        _sharedFallbackPromise: null,

        // ✅ مدة صلاحية البيانات المحلية لكل نوع (بالميلي ثانية) قبل إعادة الجلب من الخادم
        _BOOTSTRAP_CACHE_TTL: {
            'users':                  5  * 60 * 1000,  // 5 دقائق  (حساسة أمنياً)
            'incidents':              10 * 60 * 1000,  // 10 دقائق
            'nearmiss':               10 * 60 * 1000,  // 10 دقائق
            'employees':              15 * 60 * 1000,  // 15 دقيقة
            'training':               15 * 60 * 1000,  // 15 دقيقة
            'approvedContractors':    15 * 60 * 1000,  // 15 دقيقة
            'contractors':            15 * 60 * 1000,  // 15 دقيقة
            'clinicVisits':           15 * 60 * 1000,  // 15 دقيقة
            'clinicContractorVisits': 15 * 60 * 1000   // 15 دقيقة
        },

        /**
         * بدء التطبيق
         */
        _sessionRestored: false,

        async start() {
            log('🚀 بدء تحميل التطبيق...');
            time('⏱️ Total Load Time');
            
            try {
                // المرحلة 1: التهيئة
                await this.phaseInit();
                
                // المرحلة 2: الموديولات الأساسية
                await this.phaseCore();
                
                // المرحلة 3: الخدمات
                await this.phaseServices();
                
                // المرحلة 4: واجهة المستخدم
                await this.phaseUI();

                // استعادة فورية للجلسة عند إعادة التحميل (Auth محمل عبر defer قبل bootstrap)
                // هذا يعرض التطبيق فوراً بدلاً من انتظار 34 موديول في phaseModules
                this._tryFastSessionRestore();
                
                // المرحلة 5: الموديولات (تستمر في الخلفية حتى لو الجلسة استُعيدت)
                await this.phaseModules();
                
                // المرحلة 6: جاهز
                await this.phaseReady();
                
                timeEnd('⏱️ Total Load Time');
                this.printStats();
                
            } catch (error) {
                console.error('❌ فشل تحميل التطبيق:', error);
                if (window.EnhancedLoader) {
                    window.EnhancedLoader.fail('فشل تحميل التطبيق!');
                    window.EnhancedLoader.addError(error.message || 'خطأ غير معروف');
                }
                // إزالة شاشة استعادة الجلسة وعرض شاشة الدخول لتجنب بقاء المستخدم على شاشة تحميل أو بيضاء
                try {
                    const restoreOverlay = document.getElementById('hse-session-restore-overlay');
                    if (restoreOverlay && restoreOverlay.parentNode) restoreOverlay.remove();
                    if (typeof window.UI !== 'undefined' && typeof window.UI.showLoginScreen === 'function') {
                        window.UI.showLoginScreen();
                    }
                } catch (e) { /* ignore */ }
            }
        },

        /**
         * التحقق من تحميل CSS
         */
        async waitForCSSLoad() {
            return new Promise((resolve) => {
                // التحقق من أن جميع ملفات CSS تم تحميلها
                const stylesheets = Array.from(document.styleSheets);
                let loadedCount = 0;
                const totalSheets = stylesheets.length;
                
                if (totalSheets === 0) {
                    resolve();
                    return;
                }
                
                const checkStylesheets = () => {
                    let allLoaded = true;
                    for (let i = 0; i < stylesheets.length; i++) {
                        try {
                            // محاولة الوصول إلى CSS rules - إذا فشل، الملف لم يتم تحميله بعد
                            const rules = stylesheets[i].cssRules || stylesheets[i].rules;
                            if (rules) {
                                loadedCount++;
                            }
                        } catch (e) {
                            // إذا كان هناك خطأ CORS أو الملف لم يتم تحميله بعد
                            allLoaded = false;
                        }
                    }
                    
                    if (allLoaded || loadedCount === totalSheets) {
                        resolve();
                    } else {
                        // إعادة المحاولة بعد تأخير قصير
                        requestAnimationFrame(checkStylesheets);
                    }
                };
                
                requestAnimationFrame(() => setTimeout(checkStylesheets, 10));
            });
        },

        /**
         * المرحلة 1: التهيئة
         */
        async phaseInit() {
            this.startPhase(this.phases.INIT);
            this.updateLoader(5, 'تهيئة النظام...');
            
            // الانتظار حتى يتم تحميل CSS لتجنب FOUC warning
            await this.waitForCSSLoad();
            
            // تهيئة شاشة التحميل المحسنة (بدون عرض - التحميل في الخلفية)
            if (window.EnhancedLoader) {
                // استخدام requestAnimationFrame لتأخير التنفيذ حتى يتم render CSS
                requestAnimationFrame(() => {
                    window.EnhancedLoader.init();
                    // لا نعرض شاشة التحميل - التحميل في الخلفية
                    // window.EnhancedLoader.show(100);
                });
            }
            
            // التحقق من دعم المتصفح
            this.checkBrowserSupport();
            
            this.updateLoader(10, 'تم التهيئة');
            this.endPhase(this.phases.INIT);
        },

        /**
         * المرحلة 2: الموديولات الأساسية
         */
        async phaseCore() {
            this.startPhase(this.phases.CORE);
            this.updateLoader(15, 'تحميل الموديولات الأساسية...');
            
            // تحميل متوازي للموديولات الأساسية (تحسين الأداء)
            const [utilsLoaded, appStateLoaded] = await Promise.all([
                this.waitForModule('Utils', 3000),
                this.waitForModule('AppState', 3000)
            ]);
            
            if (utilsLoaded) {
                this.updateLoader(25, 'تم تحميل Utils');
            }
            if (appStateLoaded) {
                this.updateLoader(30, 'تم تحميل AppState');
            }
            
            this.endPhase(this.phases.CORE);
        },

        /**
         * المرحلة 3: الخدمات
         */
        async phaseServices() {
            this.startPhase(this.phases.SERVICES);
            this.updateLoader(35, 'تحميل الخدمات...');
            
            // انتظار تحميل DataManager (تقليل الوقت إلى 10 ثوانٍ - تحسين الأداء)
            const dataManager = await this.waitForModule('DataManager', 10000);
            
            // التحقق من أن DataManager محمل بالكامل وبه الدوال المطلوبة
            if (!dataManager || !dataManager.load || !dataManager.save) {
                const errorMsg = '⚠️ DataManager لم يتم تحميله بالكامل - بعض الدوال مفقودة';
                console.error(errorMsg);
                if (window.EnhancedLoader) {
                    window.EnhancedLoader.addError('فشل تحميل DataManager - يرجى تحديث الصفحة');
                }
                // محاولة إعادة تحميل الصفحة بعد 3 ثوانٍ
                setTimeout(() => {
                    if (!window.DataManager || !window.DataManager.load) {
                        console.error('❌ DataManager لا يزال غير محمل - إعادة تحميل الصفحة...');
                        window.location.reload();
                    }
                }, 3000);
            } else {
                this.updateLoader(45, 'تم تحميل DataManager');
            }
            
            // تهيئة LazyLoader إذا كان متاحاً
            if (window.LazyLoader) {
                await window.LazyLoader.init();
                this.updateLoader(50, 'تم تهيئة LazyLoader');
            }
            
            // تهيئة Issue Tracking Service (Cross-Module System)
            if (typeof IssueTrackingService !== 'undefined' && IssueTrackingService.init) {
                try {
                    IssueTrackingService.init();
                    if (AppState?.debugMode) {
                        log('✅ تم تهيئة Issue Tracking Service');
                    }
                } catch (error) {
                    Utils?.safeWarn('⚠️ خطأ في تهيئة Issue Tracking Service:', error);
                }
            }
            
            // تحميل البيانات من localStorage
            if (window.DataManager && window.DataManager.load) {
                try {
                    // ✅ مهم عند Reload: ننتظر تحميل البيانات المحلية لتجنّب صفحة بيضاء/جداول فارغة ثم ظهور البيانات لاحقاً
                    await window.DataManager.load();
                    this.updateLoader(55, 'تم تحميل البيانات المحلية');

                    // 🧹 تنظيف أمني: إزالة أي حسابات افتراضية legacy من البيانات المحلية (إن وُجدت)
                    try {
                        if (typeof window.removeDefaultUsersIfNeeded === 'function') {
                            const cleanup = window.removeDefaultUsersIfNeeded({ persistRemote: false });
                            if (cleanup && cleanup.removed > 0) {
                                log(`🧹 تم إزالة ${cleanup.removed} حساب/حسابات افتراضية legacy من البيانات المحلية`);
                            }
                        }
                    } catch (cleanupError) {
                        // لا نكسر التحميل بسبب فشل cleanup
                        log('⚠️ تعذر تنفيذ تنظيف الحسابات الافتراضية legacy:', cleanupError);
                    }
                    
                    if (window.DataManager && window.DataManager.loadGoogleConfig) {
                        try {
                            window.DataManager.loadGoogleConfig();
                            log('✅ تم تحميل إعدادات الاتصال بالخادم بنجاح');
                        } catch (configError) {
                            console.warn('⚠️ خطأ في تحميل إعدادات الاتصال بالخادم:', configError);
                        }
                    }

                    // ✅ تحسين: تحميل ذكي للبيانات حسب الصلاحيات (بدلاً من تحميل كل شيء)
                    // هذا يقلل من وقت التحميل الأولي ويحسن الأداء
                    if (typeof Permissions !== 'undefined' && typeof Permissions.getCurrentUserPermissions === 'function') {
                        try {
                            const userPermissions = Permissions.getCurrentUserPermissions();
                            await this.loadDataBasedOnPermissions(userPermissions);
                        } catch (error) {
                            log('⚠️ فشل تحميل البيانات الذكية، سيتم استخدام التحميل التقليدي:', error);
                            // Fallback للتحميل التقليدي
                            await this.loadSharedDataFallback();
                        }
                    } else {
                        // Fallback للتحميل التقليدي إذا لم تكن الصلاحيات متوفرة
                        await this.loadSharedDataFallback();
                    }

                    // ✅ إضافة: تحميل فوري لإعدادات النماذج (المواقع) بعد تحميل البيانات المحلية
                    // هذا يضمن توفر المواقع فوراً عند فتح أي موديول يحتاجها
                    if (typeof Permissions !== 'undefined' && typeof Permissions.initFormSettingsState === 'function') {
                        try {
                            // تحميل إعدادات النماذج بشكل غير متزامن (لا ننتظرها)
                            Permissions.initFormSettingsState().then(() => {
                                if (AppState.debugMode) {
                                    log('✅ تم تحميل إعدادات النماذج (المواقع) مسبقاً');
                                }
                            }).catch((error) => {
                                if (AppState.debugMode) {
                                    console.warn('⚠️ فشل تحميل إعدادات النماذج مسبقاً:', error);
                                }
                            });
                        } catch (error) {
                            if (AppState.debugMode) {
                                console.warn('⚠️ خطأ في تحميل إعدادات النماذج:', error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ خطأ في تحميل البيانات المحلية:', error);
                    if (window.EnhancedLoader) {
                        window.EnhancedLoader.addError('خطأ في تحميل البيانات المحلية');
                    }
                }
            }
            
            this.endPhase(this.phases.SERVICES);
        },

        /**
         * المرحلة 4: واجهة المستخدم
         */
        async phaseUI() {
            this.startPhase(this.phases.UI);
            this.updateLoader(60, 'تحميل واجهة المستخدم...');
            
            // تحميل متوازي لواجهة المستخدم (تحسين الأداء)
            const [uiLoaded, notificationLoaded] = await Promise.all([
                this.waitForModule('UI', 3000),
                this.waitForModule('Notification', 2000)
            ]);
            
            if (uiLoaded) {
                this.updateLoader(65, 'تم تحميل UI');
            }
            if (notificationLoaded) {
                this.updateLoader(70, 'تم تحميل Notification');
            }

            // إظهار الهيدر مبكراً عند وجود جلسة (بدون انتظار phaseModules/phaseReady)
            // يقلل تأخر ظهور هيدر لوحة التحكم (شعار الشركة + الاسم)
            try {
                const mainApp = document.getElementById('main-app');
                if (mainApp && mainApp.style.display !== 'none' && typeof window.UI !== 'undefined' && window.UI.updateCompanyLogoHeader) {
                    window.UI.updateCompanyLogoHeader();
                    if (window.UI.updateCompanyBranding) window.UI.updateCompanyBranding();
                    log('✅ تم إظهار الهيدر مبكراً');
                }
            } catch (e) {
                if (AppState?.debugMode) console.warn('⚠️ إظهار الهيدر مبكراً:', e);
            }
            
            this.endPhase(this.phases.UI);
        },

        /**
         * المرحلة 5: الموديولات
         */
        async phaseModules() {
            this.startPhase(this.phases.MODULES);
            this.updateLoader(75, 'تحميل الموديولات...');
            
            // التحقق من أن ملفات auth.js و dashboard.js قد بدأت التحميل
            // ننتظر قليلاً للتأكد من أن الملفات قد بدأت التحميل
            const authScript = Array.from(document.scripts).find(
                script => script.src && script.src.includes('auth.js')
            );
            const dashboardScript = Array.from(document.scripts).find(
                script => script.src && script.src.includes('dashboard.js')
            );
            
            if (authScript || dashboardScript) {
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            // تحميل متوازي لـ Auth و Dashboard (تحسين الأداء - تقليل وقت الانتظار)
            const [authModule, dashboardModule] = await Promise.all([
                this.waitForModule('Auth', 10000, {
                    required: true,
                    checkComplete: (module) => {
                        // التحقق من أن Auth مكتمل وبه الدوال الأساسية
                        return module && 
                               typeof module.login === 'function' &&
                               typeof module.logout === 'function';
                    }
                }),
                this.waitForModule('Dashboard', 10000, {
                    required: false,
                    checkComplete: (module) => {
                        // التحقق من أن Dashboard مكتمل وبه الدوال الأساسية
                        return module && typeof module.load === 'function';
                    }
                })
            ]);
            
            if (authModule) {
                this.updateLoader(85, 'تم تحميل Auth');
            } else {
                console.error('❌ فشل تحميل Auth - الموديول ضروري للتطبيق');
                if (window.EnhancedLoader) {
                    window.EnhancedLoader.addError('فشل تحميل Auth - يرجى تحديث الصفحة');
                }
            }
            
            if (dashboardModule) {
                this.updateLoader(90, 'تم تحميل Dashboard');
            } else {
                console.warn('⚠️ تأخر تحميل Dashboard - سيتم تحميله لاحقاً');
            }
            
            // انتظار تحميل modules-loader.js (يحتوي على جميع الموديولات الأخرى)
            // نتحقق من وجود أحد الموديولات الرئيسية كدليل على تحميل modules-loader.js
            const modulesLoaderScript = Array.from(document.scripts).find(
                script => script.src && script.src.includes('modules-loader.js')
            );
            
            if (modulesLoaderScript) {
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            // تحميل متوازي للموديولات الرئيسية (تحسين الأداء - تقليل وقت الانتظار)
            // الموديولات غير مطلوبة لتسجيل الدخول، لذا ننتظرها بوقت أقل
            // ✅ إصلاح: زيادة timeout لأن الموديولات تُحمّل بالتسلسل (async=false, defer=true)
            // Employees هو الموديول #23 من 33، لذا يحتاج وقت أطول
            const [usersModule, incidentsModule, employeesModule] = await Promise.all([
                this.waitForModule('Users', 8000, {
                    required: false,
                    checkComplete: (module) => {
                        return module && typeof module.load === 'function';
                    }
                }),
                this.waitForModule('Incidents', 8000, {
                    required: false,
                    checkComplete: (module) => {
                        return module && typeof module.load === 'function';
                    }
                }),
                this.waitForModule('Employees', 10000, {
                    required: false,
                    checkComplete: (module) => {
                        return module && typeof module.load === 'function';
                    }
                })
            ]);
            
            const loadedModules = [usersModule, incidentsModule, employeesModule].filter(Boolean).length;
            if (loadedModules > 0) {
                this.updateLoader(95, `تم تحميل ${loadedModules} موديول`);
            } else {
                this.updateLoader(95, 'جاهز للاستخدام');
            }
            
            this.endPhase(this.phases.MODULES);
        },

        /**
         * المرحلة 6: جاهز
         */
        async phaseReady() {
            this.startPhase(this.phases.READY);
            this.updateLoader(95, 'إنهاء التحميل...');
            
            // تهيئة نظام الأحداث
            if (window.EventManager && window.EventManager.init) {
                window.EventManager.init();
            }
            
            // التحقق من المستخدم المحفوظ واستعادة الجلسة عند إعادة تحميل الصفحة
            this.checkAndRestoreSession();
            
            this.updateLoader(100, 'تم التحميل بنجاح!');
            
            // لا نعرض شاشة التحميل - التحميل في الخلفية
            // if (window.EnhancedLoader) {
            //     window.EnhancedLoader.complete('تم تحميل النظام بنجاح!');
            // }
            
            // إطلاق حدث جاهزية التطبيق
            this.dispatchEvent('app:ready');

            // ✅ إعادة تحميل الحقول المبتورة من الخادم في الخلفية (إذا كانت البيانات المحلية مبتورة)
            if (AppState && AppState._localDataIsTruncated && window.DataManager && window.DataManager.refreshTruncatedDataFromServer) {
                // إظهار مؤشر خفيف للمستخدم
                setTimeout(() => {
                    try {
                        if (typeof Notification !== 'undefined' && Notification.info) {
                            Notification.info('جاري تحميل البيانات الكاملة من الخادم...', { duration: 8000 });
                        }
                    } catch (e) { /* ignore */ }
                }, 1500);

                setTimeout(() => {
                    window.DataManager.refreshTruncatedDataFromServer().catch(e => {
                        Utils?.safeWarn('⚠️ فشل تحديث البيانات المبتورة:', e);
                    });
                }, 2000);
            }
            
            // ✅ إضافة: حفظ تلقائي للبيانات عند إغلاق الصفحة
            this.setupAutoSaveOnUnload();
            
            this.endPhase(this.phases.READY);
            log('✅ التطبيق جاهز للاستخدام!');
        },

        /**
         * إعداد حفظ تلقائي للبيانات عند إغلاق الصفحة
         */
        setupAutoSaveOnUnload() {
            // ✅ حماية: حفظ البيانات تلقائياً عند إغلاق الصفحة
            window.addEventListener('beforeunload', (e) => {
                try {
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        // محاولة حفظ البيانات بشكل متزامن (قبل إغلاق الصفحة)
                        window.DataManager.save();
                    }
                } catch (error) {
                    // لا نعرض أخطاء عند إغلاق الصفحة
                    console.error('خطأ في حفظ البيانات عند الإغلاق:', error);
                }
            });
        },

        /**
         * انتظار تحميل موديول
         * @param {string} moduleName - اسم الموديول
         * @param {number} timeout - مهلة الانتظار بالميلي ثانية
         * @param {object} options - خيارات إضافية
         * @param {boolean} options.required - هل الموديول ضروري؟
         * @param {function} options.checkComplete - دالة للتحقق من اكتمال الموديول
         */
        async waitForModule(moduleName, timeout = 5000, options = {}) {
            const { required = false, checkComplete = null } = options;
            const startTime = Date.now();
            
            // التحقق الفوري أولاً
            const initialModule = window[moduleName];
            if (initialModule && typeof initialModule === 'object') {
                // إذا كان هناك دالة للتحقق من الاكتمال، نستخدمها
                if (checkComplete) {
                    if (checkComplete(initialModule)) {
                        log(`✓ ${moduleName} محمل ومكتمل (فوري)`);
                        return initialModule;
                    } else {
                        log(`⏳ ${moduleName} موجود لكن غير مكتمل بعد - ننتظر...`);
                    }
                } else {
                    log(`✓ ${moduleName} محمل (فوري)`);
                    return initialModule;
                }
            }
            
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const checkInterval = 50; // فحص كل 50ms للاستجابة الأسرع
                const maxAttempts = Math.ceil(timeout / checkInterval);
                
                const checkModule = () => {
                    attempts++;
                    
                    // التحقق من تحميل الموديول بشكل كامل
                    const module = window[moduleName];
                    if (module && typeof module === 'object') {
                        // للـ DataManager، نتحقق من وجود الدوال الأساسية
                        if (moduleName === 'DataManager') {
                            if (module.load && module.save && typeof module.load === 'function' && typeof module.save === 'function') {
                                log(`✓ ${moduleName} محمل بالكامل (بعد ${attempts * checkInterval}ms)`);
                                resolve(module);
                                return;
                            } else {
                                // DataManager موجود لكن غير مكتمل - نستمر في الانتظار
                                if (attempts % 20 === 0) { // طباعة كل ثانية تقريباً
                                    log(`⏳ ${moduleName} موجود لكن غير مكتمل... (محاولة ${attempts})`);
                                }
                            }
                        } else if (checkComplete) {
                            // استخدام دالة التحقق المخصصة
                            if (checkComplete(module)) {
                                log(`✓ ${moduleName} محمل ومكتمل (بعد ${attempts * checkInterval}ms)`);
                                resolve(module);
                                return;
                            } else {
                                // الموديول موجود لكن غير مكتمل - نستمر في الانتظار
                                if (attempts % 20 === 0) { // طباعة كل ثانية تقريباً
                                    log(`⏳ ${moduleName} موجود لكن غير مكتمل... (محاولة ${attempts})`);
                                }
                            }
                        } else {
                            // للموديولات الأخرى، نكتفي بوجودها
                            log(`✓ ${moduleName} محمل (بعد ${attempts * checkInterval}ms)`);
                            resolve(module);
                            return;
                        }
                    }
                    
                    // التحقق من انتهاء الوقت
                    const elapsed = Date.now() - startTime;
                    if (elapsed > timeout || attempts >= maxAttempts) {
                        // ✅ إصلاح: تقليل مستوى التحذير للموديولات غير الضرورية
                        // الموديولات ستُحمّل لاحقاً عند الحاجة، لذا هذا ليس خطأ حرج
                        if (required) {
                            const errorMsg = `⚠️ timeout: ${moduleName} لم يتم تحميله بعد ${timeout}ms`;
                            console.warn(errorMsg);
                            console.warn(`محاولات: ${attempts}, الوقت المستغرق: ${elapsed}ms`);
                            
                            // إظهار معلومات إضافية للتصحيح
                            console.warn(`تفاصيل ${moduleName}:`, {
                                exists: typeof window[moduleName] !== 'undefined',
                                isObject: typeof window[moduleName] === 'object',
                                value: window[moduleName] ? Object.keys(window[moduleName]).slice(0, 10) : 'غير موجود',
                                scripts: Array.from(document.scripts).map(s => s.src).filter(s => s.includes('modules-loader'))
                            });
                            
                            if (window.EnhancedLoader) {
                                window.EnhancedLoader.addError(`تأخر تحميل ${moduleName}`);
                            }
                            
                            // إذا كان الموديول ضرورياً، نحاول إعادة تحميل الصفحة
                            console.error(`❌ ${moduleName} ضروري للتطبيق - سيتم إعادة تحميل الصفحة...`);
                            setTimeout(() => {
                                if (!window[moduleName] || (checkComplete && !checkComplete(window[moduleName]))) {
                                    console.error(`❌ ${moduleName} لا يزال غير محمل - إعادة تحميل الصفحة...`);
                                    window.location.reload();
                                }
                            }, 2000);
                        } else {
                            // ✅ للموديولات غير الضرورية: رسالة debug فقط (لا تظهر في console العادي)
                            if (typeof log === 'function') {
                                log(`ℹ️ ${moduleName} لم يُحمّل في الوقت المحدد (${timeout}ms) - سيُحمّل عند الحاجة`);
                            }
                        }
                        
                        // لا نرفض الـ Promise لتجنب إيقاف التطبيق
                        resolve(null);
                        return;
                    }
                    
                    // محاولة أخرى بعد فترة قصيرة
                    setTimeout(checkModule, checkInterval);
                };
                
                // البدء فوراً
                checkModule();
            });
        },

        /**
         * التحقق من دعم المتصفح
         */
        checkBrowserSupport() {
            const required = [
                'localStorage',
                'Promise',
                'fetch',
                'addEventListener'
            ];
            
            const unsupported = required.filter(feature => !(feature in window));
            
            if (unsupported.length > 0) {
                console.error('❌ المتصفح لا يدعم:', unsupported);
                alert('متصفحك لا يدعم بعض الميزات المطلوبة. يُرجى استخدام متصفح حديث.');
            }
        },

        /**
         * بدء مرحلة
         */
        startPhase(phase) {
            this.currentPhase = phase;
            this.timings[phase] = { start: Date.now() };
            log(`📦 بدء المرحلة: ${phase}`);
        },

        /**
         * إنهاء مرحلة
         */
        endPhase(phase) {
            if (this.timings[phase]) {
                this.timings[phase].end = Date.now();
                this.timings[phase].duration = this.timings[phase].end - this.timings[phase].start;
                log(`✓ إنهاء المرحلة: ${phase} (${this.timings[phase].duration}ms)`);
            }
        },

        /**
         * تحديث شاشة التحميل
         */
        updateLoader(progress, message) {
            if (window.EnhancedLoader) {
                window.EnhancedLoader.updateProgress(progress, message);
            }
        },

        /**
         * إطلاق حدث
         */
        dispatchEvent(eventName, detail = null) {
            const event = new CustomEvent(eventName, { detail });
            window.dispatchEvent(event);
        },

        /**
         * استعادة فورية للجلسة (تُستدعى بعد phaseUI مباشرة - قبل phaseModules)
         * Auth و DataManager و UI محملة عبر defer قبل bootstrap، لذا يجب أن تكون متاحة فوراً
         */
        _tryFastSessionRestore() {
            if (this._sessionRestored) return;

            const sessionData = sessionStorage.getItem('hse_current_session');
            const rememberData = localStorage.getItem('hse_remember_user');
            if (!sessionData && !rememberData) return;

            if (window.Auth && typeof window.Auth.checkRememberedUser === 'function' &&
                typeof AppState !== 'undefined' && AppState.appData &&
                window.UI && typeof window.UI.showMainApp === 'function') {
                try {
                    AppState.isPageRefresh = true;
                    const isLoggedIn = window.Auth.checkRememberedUser();
                    if (isLoggedIn) {
                        this._sessionRestored = true;
                        log('⚡ استعادة فورية للجلسة (fast-track)');
                        window.UI.showMainApp();
                    }
                } catch (e) {
                    log('⚠️ فشل الاستعادة الفورية، سيتم المحاولة لاحقاً:', e);
                }
            }
        },

        /**
         * التحقق من الجلسة واستعادتها (دالة مساعدة)
         */
        checkAndRestoreSession() {
            if (this._sessionRestored) {
                log('✅ الجلسة مستعادة مسبقاً (fast-track) - تخطي');
                return;
            }

            const sessionData = sessionStorage.getItem('hse_current_session');
            const rememberData = localStorage.getItem('hse_remember_user');
            
            if (!sessionData && !rememberData) {
                log('ℹ️ لا توجد جلسة محفوظة - عرض شاشة تسجيل الدخول');
                if (typeof window.UI !== 'undefined' && typeof window.UI.showLoginScreen === 'function') {
                    window.UI.showLoginScreen();
                }
                return;
            }
            
            if (typeof window.Auth !== 'undefined' && typeof window.Auth.checkRememberedUser === 'function') {
                try {
                    if (typeof AppState === 'undefined' || !AppState.appData) {
                        const retries = this._sessionRestoreRetries = (this._sessionRestoreRetries || 0) + 1;
                        const maxRetries = 6; // 3 ثوانٍ كحد أقصى (6 × 500ms)
                        if (retries > maxRetries) {
                            log('ℹ️ انتهت محاولات انتظار appData - عرض شاشة الدخول');
                            this._sessionRestoreRetries = 0;
                            if (typeof window.UI !== 'undefined' && typeof window.UI.showLoginScreen === 'function') {
                                window.UI.showLoginScreen();
                            }
                            return;
                        }
                        log('⚠️ AppState أو AppState.appData غير محمل - إعادة المحاولة ' + retries + '/' + maxRetries + '...');
                        setTimeout(() => {
                            this.checkAndRestoreSession();
                        }, 500);
                        return;
                    }
                    this._sessionRestoreRetries = 0;
                    
                    // تعيين علامة إعادة التحميل قبل التحقق
                    AppState.isPageRefresh = true;
                    
                    const isLoggedIn = window.Auth.checkRememberedUser();
                    
                    if (isLoggedIn) {
                        log('✅ تم استعادة الجلسة - المستخدم مسجل دخول');
                        // عرض التطبيق الرئيسي إذا كان المستخدم مسجل دخول
                        if (typeof window.UI !== 'undefined' && typeof window.UI.showMainApp === 'function') {
                            window.UI.showMainApp();
                        }
                    } else {
                        log('ℹ️ فشل استعادة الجلسة - عرض شاشة تسجيل الدخول');
                        // عرض شاشة تسجيل الدخول إذا فشلت استعادة الجلسة
                        // لكن showLoginScreen() سيتحقق مرة أخرى من وجود الجلسة قبل العرض
                        if (typeof window.UI !== 'undefined' && typeof window.UI.showLoginScreen === 'function') {
                            window.UI.showLoginScreen();
                        }
                    }
                } catch (error) {
                    console.error('❌ خطأ في التحقق من المستخدم المحفوظ:', error);
                    // في حالة الخطأ، نتحقق من وجود جلسة قبل عرض شاشة الدخول
                    // إذا كانت هناك بيانات جلسة، نحاول مرة أخرى بعد قليل
                    if (sessionData || rememberData) {
                        log('⚠️ حدث خطأ لكن هناك بيانات جلسة - إعادة المحاولة...');
                        setTimeout(() => {
                            this.checkAndRestoreSession();
                        }, 500);
                    } else {
                        // لا توجد جلسة - نعرض شاشة الدخول
                        if (typeof window.UI !== 'undefined' && typeof window.UI.showLoginScreen === 'function') {
                            window.UI.showLoginScreen();
                        }
                    }
                }
            } else {
                // إذا لم يكن Auth متاحاً، نتحقق من وجود جلسة
                if (sessionData || rememberData) {
                    log('⚠️ Auth غير متاح لكن هناك بيانات جلسة - انتظار تحميل Auth...');
                    // ننتظر قليلاً ثم نحاول مرة أخرى
                    setTimeout(() => {
                        this.checkAndRestoreSession();
                    }, 500);
                } else {
                    console.warn('⚠️ Auth.checkRememberedUser غير متاح - عرض شاشة تسجيل الدخول');
                    // إذا لم يكن Auth متاحاً ولا توجد جلسة، نعرض شاشة تسجيل الدخول
                    if (typeof window.UI !== 'undefined' && typeof window.UI.showLoginScreen === 'function') {
                        window.UI.showLoginScreen();
                    }
                }
            }
        },

        /**
         * طباعة الإحصائيات
         */
        printStats() {
            log('\n📊 إحصائيات التحميل:');
            log('═'.repeat(50));
            
            let totalTime = 0;
            Object.entries(this.timings).forEach(([phase, timing]) => {
                const duration = timing.duration || 0;
                totalTime += duration;
                log(`  ${phase.padEnd(15)} : ${duration}ms`);
            });
            
            log('─'.repeat(50));
            log(`  ${'الإجمالي'.padEnd(15)} : ${totalTime}ms`);
            log('═'.repeat(50));
            
            // إحصائيات الذاكرة (إذا كانت متاحة)
            if (performance.memory) {
                const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
                const totalMB = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
                log(`  استخدام الذاكرة: ${usedMB}MB / ${totalMB}MB`);
            }
            
            log('\n');
        },

        /**
         * تحميل البيانات حسب صلاحيات المستخدم
         */
        async loadDataBasedOnPermissions(userPermissions) {
            const permissionsKey = JSON.stringify(userPermissions || {});
            if (this._permissionLoadPromise && this._permissionLoadKey === permissionsKey) {
                return this._permissionLoadPromise;
            }

            this._permissionLoadKey = permissionsKey;

            const currentPromise = (async () => {
                if (!userPermissions || typeof GoogleIntegration === 'undefined') {
                    return this.loadSharedDataFallback();
                }

                const requiredDataTypes = this.getRequiredDataForPermissions(userPermissions);
                if (requiredDataTypes.length === 0) {
                    return this.loadSharedDataFallback();
                }

                // ✅ تصفية: فصل البيانات الحديثة (لا تحتاج جلب) عن البيانات القديمة (تحتاج جلب)
                const staleTypes = requiredDataTypes.filter(dt => !this._isBootstrapDataFresh(dt));
                const freshTypes = requiredDataTypes.filter(dt =>  this._isBootstrapDataFresh(dt));

                if (freshTypes.length > 0) {
                    log(`⚡ ${freshTypes.length} نوع بيانات حديثة (من cache) — تخطي الخادم: [${freshTypes.join(', ')}]`);
                }

                if (staleTypes.length === 0) {
                    log('✅ جميع البيانات المحلية حديثة — لا حاجة لأي طلب من الخادم');
                    return;
                }

                log(`🎯 جلب ${staleTypes.length} نوع بيانات قديمة من الخادم: [${staleTypes.join(', ')}]`);

                // تحميل البيانات القديمة فقط بشكل متوازي
                const dataPromises = staleTypes.map(dataType => {
                    const action = this.getActionForDataType(dataType);
                    const sheetName = this.getSheetNameForDataType(dataType);
                    // readFromSheet يتطلب sheetName إجبارياً في الـ payload
                    const requestData = sheetName ? { sheetName } : {};
                    return GoogleIntegration.sendRequest({
                        action,
                        data: requestData
                    }).then(result => ({
                        type: dataType,
                        result
                    })).catch(error => ({
                        type: dataType,
                        error
                    }));
                });

                const results = await Promise.all(dataPromises);

                // حفظ النتائج في AppState وتحديث syncMeta
                let fetchedCount = 0;
                results.forEach(({ type, result, error }) => {
                    if (result && result.success && Array.isArray(result.data)) {
                        AppState.appData[type] = result.data;
                        fetchedCount++;
                        log(`✅ تم جلب ${result.data.length} سجل لـ ${type}`);

                        // ✅ تحديث syncMeta.sheets بوقت الجلب الفعلي من الخادم
                        const sheetKey = this._getSyncMetaSheetKey(type);
                        if (sheetKey) {
                            if (!AppState.syncMeta) AppState.syncMeta = { sheets: {} };
                            if (!AppState.syncMeta.sheets) AppState.syncMeta.sheets = {};
                            AppState.syncMeta.sheets[sheetKey] = Date.now();
                            AppState.syncMeta.lastSyncTime = Date.now();
                        }
                    } else if (error) {
                        log(`⚠️ فشل جلب ${type}:`, error.message);
                    }
                });

                // حفظ syncMeta المحدَّث في localStorage فوراً + تسجيل timestamps الجلب
                if (fetchedCount > 0) {
                    if (window.DataManager && window.DataManager._saveSyncMeta) {
                        try { window.DataManager._saveSyncMeta(); } catch (e) {}
                    }
                    // ✅ تسجيل timestamps الجلب الفعلي من الخادم (للـ TTL check في الـ reload القادم)
                    const fetchedKeys = results
                        .filter(r => r.result && r.result.success && Array.isArray(r.result.data))
                        .map(r => r.type);
                    if (fetchedKeys.length > 0 && window.DataManager && window.DataManager.recordServerFetch) {
                        try { window.DataManager.recordServerFetch(fetchedKeys); } catch (e) {}
                    }
                    // حفظ البيانات محلياً بعد تأخير بسيط
                    if (window.DataManager && window.DataManager.save) {
                        setTimeout(() => {
                            try { window.DataManager.save(); } catch (e) {}
                        }, 1000);
                    }
                }
            })();

            const trackedPromise = currentPromise.finally(() => {
                if (this._permissionLoadPromise === trackedPromise) {
                    this._permissionLoadPromise = null;
                }
            });

            this._permissionLoadPromise = trackedPromise;
            return trackedPromise;
        },

        /**
         * تحديد البيانات المطلوبة حسب الصلاحيات
         */
        getRequiredDataForPermissions(permissions) {
            const requiredData = [];

            // بيانات أساسية لجميع المستخدمين
            requiredData.push('users');

            // بيانات حسب الصلاحيات
            if (permissions.canViewIncidents) {
                requiredData.push('incidents', 'nearmiss');
            }

            if (permissions.canViewContractors) {
                requiredData.push('approvedContractors', 'contractors');
            }

            if (permissions.canViewEmployees) {
                requiredData.push('employees');
            }

            if (permissions.canViewTraining) {
                requiredData.push('training');
            }

            if (permissions.canViewClinic) {
                requiredData.push('clinicVisits', 'clinicContractorVisits');
            }

            // إلخ... يمكن توسيع هذا حسب الحاجة

            return requiredData;
        },

        /**
         * تحديد action لنوع البيانات
         */
        getActionForDataType(dataType) {
            const actionMap = {
                'users': 'readFromSheet',
                'incidents': 'readFromSheet',
                'nearmiss': 'readFromSheet',
                'approvedContractors': 'getAllApprovedContractors',
                'contractors': 'getAllContractors',
                'employees': 'getAllEmployees',
                'training': 'readFromSheet',
                'clinicVisits': 'readFromSheet',
                'clinicContractorVisits': 'readFromSheet'
            };

            return actionMap[dataType] || 'readFromSheet';
        },

        /**
         * تحديد sheetName لنوع البيانات (مطلوب عند استخدام action=readFromSheet)
         */
        getSheetNameForDataType(dataType) {
            const sheetMap = {
                'users': 'Users',
                'incidents': 'Incidents',
                'nearmiss': 'NearMiss',
                'training': 'Training',
                'clinicVisits': 'ClinicVisits',
                'clinicContractorVisits': 'ClinicContractorVisits'
            };
            return sheetMap[dataType] || null;
        },

        /**
         * تحديد مفتاح syncMeta.sheets لنوع البيانات
         * syncMeta.sheets تستخدم أسماء الأوراق (مثل 'Users') لا مفاتيح AppState (مثل 'users')
         */
        _getSyncMetaSheetKey(dataType) {
            const map = {
                'users':                  'Users',
                'incidents':              'Incidents',
                'nearmiss':               'NearMiss',
                'employees':              'Employees',
                'training':               'Training',
                'approvedContractors':    'ApprovedContractors',
                'contractors':            'ApprovedContractors',
                'clinicVisits':           'ClinicVisits',
                'clinicContractorVisits': 'ClinicContractorVisits'
            };
            return map[dataType] || null;
        },

        /**
         * التحقق من أن بيانات نوع معين حديثة بما يكفي لتخطي الجلب من الخادم
         * يعتمد على syncMeta.sheets المحفوظ في hse_sync_meta
         */
        _isBootstrapDataFresh(dataType) {
            // يجب وجود بيانات محلية غير فارغة
            const localData = AppState.appData[dataType];
            if (!localData || !Array.isArray(localData) || localData.length === 0) {
                return false;
            }

            const ttl = this._BOOTSTRAP_CACHE_TTL[dataType] || (10 * 60 * 1000);
            const sheetKey = this._getSyncMetaSheetKey(dataType);

            // 1. التحقق من syncMeta.sheets (المصدر الأساسي — يُحدَّث فقط بعد جلب ناجح من الخادم)
            if (sheetKey && AppState.syncMeta && AppState.syncMeta.sheets) {
                const lastSync = AppState.syncMeta.sheets[sheetKey];
                if (lastSync && (Date.now() - lastSync) < ttl) {
                    return true;
                }
            }

            // 2. الاحتياط: التحقق من hse_cache_timestamps
            if (window.DataManager && window.DataManager.isCacheValid) {
                try {
                    if (window.DataManager.isCacheValid(dataType, ttl)) {
                        return true;
                    }
                } catch (e) { /* ignore */ }
            }

            return false;
        },

        /**
         * تحميل البيانات المشتركة كـ fallback
         */
        async loadSharedDataFallback() {
            if (this._sharedFallbackPromise) {
                return this._sharedFallbackPromise;
            }

            const currentPromise = (async () => {
                if (typeof GoogleIntegration === 'undefined' || !GoogleIntegration.sendRequest ||
                    typeof Utils === 'undefined' || !Utils.hasCloudBackendSync || !Utils.hasCloudBackendSync()) {
                    return;
                }

                // ✅ تحقق من الـ cache قبل الجلب في الـ fallback أيضاً
                const contractorsFresh = this._isBootstrapDataFresh('approvedContractors');
                const employeesFresh   = this._isBootstrapDataFresh('employees');

                if (contractorsFresh && employeesFresh) {
                    log('⚡ بيانات المقاولين والموظفين حديثة (cache) — تخطي fallback');
                    return;
                }

                log('🔄 تحميل البيانات المشتركة (fallback)');

                // تحميل البيانات الأساسية فقط (القديمة منها)
                const basicDataPromises = [
                    contractorsFresh ? Promise.resolve(null) : GoogleIntegration.sendRequest({ action: 'getAllApprovedContractors', data: {} }).catch(() => null),
                    employeesFresh   ? Promise.resolve(null) : GoogleIntegration.sendRequest({ action: 'getAllEmployees', data: {} }).catch(() => null)
                ];

                const results = await Promise.all(basicDataPromises);
                const fetchedFallbackKeys = [];

                if (results[0]?.success && Array.isArray(results[0].data)) {
                    AppState.appData.approvedContractors = results[0].data;
                    AppState.appData.contractors = results[0].data;
                    fetchedFallbackKeys.push('approvedContractors', 'contractors');
                    // تحديث syncMeta
                    if (!AppState.syncMeta) AppState.syncMeta = { sheets: {} };
                    if (!AppState.syncMeta.sheets) AppState.syncMeta.sheets = {};
                    AppState.syncMeta.sheets['ApprovedContractors'] = Date.now();
                    log(`✅ تم تحميل ${results[0].data.length} مقاول`);
                }

                if (results[1]?.success && Array.isArray(results[1].data)) {
                    AppState.appData.employees = results[1].data;
                    fetchedFallbackKeys.push('employees');
                    // تحديث syncMeta
                    if (!AppState.syncMeta) AppState.syncMeta = { sheets: {} };
                    if (!AppState.syncMeta.sheets) AppState.syncMeta.sheets = {};
                    AppState.syncMeta.sheets['Employees'] = Date.now();
                    log(`✅ تم تحميل ${results[1].data.length} موظف`);
                }

                // حفظ syncMeta وتسجيل timestamps الجلب
                if (fetchedFallbackKeys.length > 0) {
                    AppState.syncMeta.lastSyncTime = Date.now();
                    if (window.DataManager) {
                        try { window.DataManager._saveSyncMeta(); } catch (e) {}
                        try { window.DataManager.recordServerFetch(fetchedFallbackKeys); } catch (e) {}
                    }
                }
            })();

            const trackedPromise = currentPromise.finally(() => {
                if (this._sharedFallbackPromise === trackedPromise) {
                    this._sharedFallbackPromise = null;
                }
            });

            this._sharedFallbackPromise = trackedPromise;
            return trackedPromise;
        }
    };

    // تصدير للاستخدام العام
    window.AppBootstrap = AppBootstrap;

    // بدء التطبيق عند تحميل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            AppBootstrap.start();
        });
    } else {
        // DOM محمل بالفعل
        AppBootstrap.start();
    }

})();
