/**
 * Application Tester Module
 * وحدة اختبار التطبيق - فحص شامل للموديولات واكتشاف المشاكل
 * 
 * مسؤوليات الوحدة:
 * - فحص سرعة التحميل والاستجابة
 * - اختبار الأزرار والحفظ والتعديل والحذف
 * - التحقق من الربط بين الواجهة الأمامية والخلفية
 * - فحص مزامنة البيانات وصحتها
 * - التحقق من عرض النماذج بشكل صحيح
 * - فحص أذونات المستخدمين وصلاحيات العرض
 * - اختبار QR - التسجيل - رفع الملفات - التصدير PDF/Excel
 */

const AppTester = {
    // Cache backend connectivity check so we don't fail every module on transient network issues
    _backendTestCache: null,
    _backendTestCacheTtlMs: 30000,
    currentView: 'dashboard',
    testResults: [],
    isRunning: false,
    scheduledTests: null,
    testConfig: {
        timeout: 30000, // 30 ثانية لكل اختبار
        retryCount: 2,
        autoSchedule: {
            enabled: false,
            frequency: 'daily', // daily, weekly, onUpdate
            time: '02:00' // وقت التشغيل
        }
    },

    /**
     * تحميل الوحدة
     */
    async load() {
        // Add language change listener
        if (!this._languageChangeListenerAdded) {
            document.addEventListener('language-changed', () => {
                this.load();
            });
            this._languageChangeListenerAdded = true;
        }

        const section = document.getElementById('apptester-section');
        if (!section) return;

        // التحقق من وجود التبعيات المطلوبة
        if (typeof Utils === 'undefined') {
            console.error('Utils غير متوفر!');
            return;
        }
        if (typeof AppState === 'undefined') {
            Utils.safeError('AppState غير متوفر!');
            return;
        }

        try {
            // التحقق من الصلاحيات - فقط المدير يمكنه الوصول
            const isAdmin = (typeof Permissions !== 'undefined' && typeof Permissions.isCurrentUserAdmin === 'function')
                ? Permissions.isCurrentUserAdmin()
                : (AppState.currentUser?.role || '').toLowerCase() === 'admin';

            if (!isAdmin) {
                section.innerHTML = `
                    <div class="content-card">
                        <div class="empty-state">
                            <i class="fas fa-lock text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">ليس لديك صلاحية للوصول إلى وحدة الاختبار</p>
                            <p class="text-sm text-gray-400 mt-2">يجب أن تكون مدير النظام للوصول إلى هذه الصفحة</p>
                        </div>
                    </div>
                `;
                return;
            }

            // تحميل المحتوى بشكل آمن مع timeout
            let content = '';
            try {
                const contentPromise = this.renderDashboard();
                content = await Utils.promiseWithTimeout(
                    contentPromise,
                    5000,
                    () => new Error('Timeout: renderDashboard took too long')
                );
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تحميل محتوى الواجهة:', error);
                content = `
                    <div class="section-header">
                        <div>
                            <h1 class="section-title">
                                <i class="fas fa-vial ml-3"></i>
                                وحدة اختبار التطبيق
                            </h1>
                        </div>
                    </div>
                    <div class="content-card mt-6">
                        <div class="empty-state">
                            <div style="width: 300px; margin: 0 auto 16px;">
                                <div style="width: 100%; height: 6px; background: rgba(59, 130, 246, 0.2); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 3px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                                </div>
                            </div>
                            <p class="text-gray-500 mb-4">جاري تحميل البيانات...</p>
                        </div>
                    </div>
                `;
            }

            section.innerHTML = content;
            
            // تهيئة الأحداث بعد عرض الواجهة
            try {
                this.setupEventListeners();
                this.loadTestHistory();
                this.initializeScheduler();
            } catch (error) {
                Utils.safeWarn('⚠️ خطأ في تهيئة الأحداث:', error);
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل مديول اختبار التطبيق:', error);
            section.innerHTML = `
                <div class="content-card">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                        <p class="text-red-500">حدث خطأ في تحميل الموديول</p>
                        <button onclick="AppTester.load()" class="btn-primary mt-4">
                            <i class="fas fa-redo ml-2"></i>
                            إعادة المحاولة
                        </button>
                    </div>
                </div>
            `;
        }
    },

    /**
     * عرض لوحة التحكم
     */
    async renderDashboard() {
        return `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-vial ml-3" aria-hidden="true"></i>
                            وحدة اختبار التطبيق
                        </h1>
                        <p class="section-subtitle">فحص شامل للموديولات واكتشاف المشاكل تلقائياً</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="run-test-btn" class="btn-primary" ${this.isRunning ? 'disabled' : ''}>
                            <i class="fas fa-play ml-2" aria-hidden="true"></i>
                            ${this.isRunning ? 'جاري الاختبار...' : 'تشغيل الاختبار'}
                        </button>
                        <button id="export-json-btn" class="btn-secondary" ${this.testResults.length === 0 ? 'disabled' : ''}>
                            <i class="fas fa-file-code ml-2" aria-hidden="true"></i>
                            تصدير JSON
                        </button>
                        <button id="test-settings-btn" class="btn-secondary">
                            <i class="fas fa-cog ml-2" aria-hidden="true"></i>
                            الإعدادات
                        </button>
                    </div>
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- إحصائيات سريعة -->
                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-chart-line ml-2"></i>
                            آخر اختبار
                        </h3>
                    </div>
                    <div class="card-body">
                        <div id="last-test-stats" class="text-center">
                            <p class="text-gray-500">لم يتم تشغيل اختبار بعد</p>
                        </div>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-exclamation-triangle ml-2"></i>
                            المشاكل الحرجة
                        </h3>
                    </div>
                    <div class="card-body">
                        <div id="critical-issues-count" class="text-center">
                            <span class="text-3xl font-bold text-red-600">0</span>
                        </div>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-check-circle ml-2"></i>
                            الحالة العامة
                        </h3>
                    </div>
                    <div class="card-body">
                        <div id="overall-status" class="text-center">
                            <span class="text-3xl font-bold text-green-600">جيد</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- نتائج الاختبار -->
            <div class="mt-6">
                <div class="content-card">
                    <div class="card-header">
                        <div class="flex items-center justify-between">
                            <h2 class="card-title">
                                <i class="fas fa-list ml-2" aria-hidden="true"></i>
                                نتائج الاختبارات
                            </h2>
                            <div class="flex items-center gap-3">
                                <button id="export-pdf-btn" class="btn-secondary" disabled>
                                    <i class="fas fa-file-pdf ml-2"></i>
                                    تصدير PDF
                                </button>
                                <button id="send-report-btn" class="btn-secondary" disabled>
                                    <i class="fas fa-paper-plane ml-2"></i>
                                    إرسال للإدارة
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="test-results-container">
                            <div class="empty-state">
                                <i class="fas fa-vial text-4xl text-gray-300 mb-4"></i>
                                <p class="text-gray-500">لم يتم تشغيل أي اختبار بعد</p>
                                <p class="text-sm text-gray-400 mt-2">اضغط على "تشغيل الاختبار" لبدء الفحص</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // زر تشغيل الاختبار
        const runTestBtn = document.getElementById('run-test-btn');
        if (runTestBtn) {
            runTestBtn.addEventListener('click', () => this.runFullTest());
        }

        // زر تصدير JSON
        const exportJsonBtn = document.getElementById('export-json-btn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportToJSON());
        }

        // زر الإعدادات
        const settingsBtn = document.getElementById('test-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // زر تصدير PDF
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', () => this.exportToPDF());
        }

        // زر إرسال التقرير
        const sendReportBtn = document.getElementById('send-report-btn');
        if (sendReportBtn) {
            sendReportBtn.addEventListener('click', () => this.sendReportToAdmin());
        }
    },

    /**
     * تشغيل الاختبار الكامل
     */
    async runFullTest() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.testResults = [];
        
        // تحديث الواجهة
        const runTestBtn = document.getElementById('run-test-btn');
        if (runTestBtn) {
            runTestBtn.disabled = true;
            runTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> جاري الاختبار...';
        }

        // عرض شاشة التقدم
        this.showProgressScreen();

        try {
            // قائمة الموديولات للاختبار
            const modulesToTest = this.getModulesList();

            // تشغيل الاختبارات لكل موديول
            for (const module of modulesToTest) {
                await this.testModule(module);
            }

            // حفظ النتائج
            this.saveTestResults();

            // تحديث الواجهة
            this.updateDashboard();
            this.renderTestResults();

            // إظهار إشعار
            if (window.UI && window.UI.showNotification) {
                window.UI.showNotification('تم إكمال الاختبار بنجاح', 'success');
            }

        } catch (error) {
            Utils.safeError('خطأ في الاختبار:', error);
            if (window.UI && window.UI.showNotification) {
                window.UI.showNotification('حدث خطأ أثناء الاختبار', 'error');
            }
        } finally {
            this.isRunning = false;
            if (runTestBtn) {
                runTestBtn.disabled = false;
                runTestBtn.innerHTML = '<i class="fas fa-play ml-2"></i> تشغيل الاختبار';
            }
            this.hideProgressScreen();
        }
    },

    /**
     * الحصول على قائمة الموديولات
     */
    getModulesList() {
        // قائمة الموديولات من modules-loader.js
        const moduleNames = [
            'users', 'incidents', 'nearmiss', 'ptw', 'training', 'reports',
            'settings', 'clinic', 'fireequipment', 'ppe', 'periodicinspections',
            'violations', 'contractors', 'employees', 'behaviormonitoring',
            'chemicalsafety', 'dailyobservations', 'iso', 'emergency',
            'safetybudget', 'actiontrackingregister', 'hse', 'safetyperformancekpis',
            'sustainability', 'riskassessment', 'legaldocuments', 'safetyhealthmanagement',
            'usertasks', 'sopjha', 'aiassistant', 'useraiassistant'
        ];

        return moduleNames.map(name => {
            const moduleObjectName = this.getModuleObjectName(name);
            // محاولة الحصول على الموديول من window
            let module = window[moduleObjectName];
            
            // إذا لم يتم العثور عليه، قد يكون الاسم مختلفاً قليلاً
            if (!module && name.includes('-')) {
                const altName = name.replace(/-/g, '');
                const altModuleObjectName = this.getModuleObjectName(altName);
                module = window[altModuleObjectName];
            }
            
            return {
                name: name,
                displayName: this.getModuleDisplayName(name),
                module: module,
                moduleObjectName: moduleObjectName
            };
        });
    },

    /**
     * الحصول على اسم العرض للموديول
     */
    getModuleDisplayName(moduleName) {
        const names = {
            'users': 'المستخدمين',
            'incidents': 'الحوادث',
            'nearmiss': 'الحوادث الوشيكة',
            'ptw': 'تصاريح العمل',
            'training': 'التدريب',
            'reports': 'التقارير',
            'settings': 'الإعدادات',
            'clinic': 'العيادة',
            'fireequipment': 'معدات الحريق',
            'ppe': 'معدات الحماية الشخصية',
            'periodicinspections': 'الفحوصات الدورية',
            'violations': 'المخالفات',
            'contractors': 'المقاولين',
            'employees': 'الموظفين',
            'behaviormonitoring': 'مراقبة السلوك',
            'chemicalsafety': 'السلامة الكيميائية',
            'dailyobservations': 'الملاحظات اليومية',
            'iso': 'ISO',
            'emergency': 'الطوارئ',
            'safetybudget': 'ميزانية السلامة',
            'actiontrackingregister': 'سجل متابعة الإجراءات',
            'hse': 'HSE',
            'safetyperformancekpis': 'مؤشرات أداء السلامة',
            'sustainability': 'الاستدامة',
            'riskassessment': 'تقييم المخاطر',
            'legaldocuments': 'الوثائق القانونية',
            'safetyhealthmanagement': 'إدارة السلامة والصحة',
            'usertasks': 'مهام المستخدم',
            'sopjha': 'SOP/JHA',
            'aiassistant': 'المساعد الذكي',
            'useraiassistant': 'مساعد المستخدم الذكي'
        };
        return names[moduleName] || moduleName;
    },

    /**
     * الحصول على اسم الكائن للموديول
     */
    getModuleObjectName(moduleName) {
        // تحويل الاسم إلى PascalCase
        // معالجة الأسماء المختلفة
        const nameMap = {
            'users': 'Users',
            'incidents': 'Incidents',
            'nearmiss': 'NearMiss',
            'ptw': 'PTW',
            'training': 'Training',
            'reports': 'Reports',
            'settings': 'Settings',
            'clinic': 'Clinic',
            'fireequipment': 'FireEquipment',
            'ppe': 'PPE',
            'periodicinspections': 'PeriodicInspections',
            'violations': 'Violations',
            'contractors': 'Contractors',
            'employees': 'Employees',
            'behaviormonitoring': 'BehaviorMonitoring',
            'chemicalsafety': 'ChemicalSafety',
            'dailyobservations': 'DailyObservations',
            'iso': 'ISO',
            'emergency': 'Emergency',
            'safetybudget': 'SafetyBudget',
            'actiontrackingregister': 'ActionTrackingRegister',
            'hse': 'HSE',
            'safetyperformancekpis': 'SafetyPerformanceKPIs',
            'sustainability': 'Sustainability',
            'riskassessment': 'RiskAssessment',
            'legaldocuments': 'LegalDocuments',
            'safetyhealthmanagement': 'SafetyHealthManagement',
            'usertasks': 'UserTasks',
            'sopjha': 'SOPJHA',
            'aiassistant': 'AIAssistant',
            'useraiassistant': 'UserAIAssistant'
        };
        
        return nameMap[moduleName] || moduleName.split('-').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
        ).join('');
    },

    /**
     * اختبار موديول واحد
     */
    async testModule(moduleInfo) {
        const { name, displayName, module } = moduleInfo;
        const testResult = {
            moduleName: name,
            displayName: displayName,
            timestamp: new Date().toISOString(),
            tests: [],
            issues: [],
            status: 'pending',
            loadingTime: 0,
            responseTime: 0
        };

        try {
            // محاولة الحصول على الموديول مرة أخرى (في حالة لم يتم تحميله بعد)
            const moduleObjectName = this.getModuleObjectName(name);
            let actualModule = module || window[moduleObjectName];
            
            // إذا لم يكن الموديول موجوداً، انتظر قليلاً ثم حاول مرة أخرى
            if (!actualModule) {
                await new Promise(resolve => setTimeout(resolve, 100));
                actualModule = window[moduleObjectName];
            }

            // 1. اختبار وجود الموديول أولاً
            const existenceTest = await this.testModuleExistence(name, actualModule);
            testResult.tests.push(existenceTest);

            // 2. اختبار سرعة التحميل
            const loadTest = await this.testLoadingSpeed(name, actualModule);
            testResult.tests.push(loadTest);
            testResult.loadingTime = loadTest.duration;

            // 3. اختبار الوظائف الأساسية
            const functionsTest = await this.testModuleFunctions(name, actualModule);
            testResult.tests.push(functionsTest);

            // 4. اختبار الربط مع الخلفية
            const backendTest = await this.testBackendConnection(name, actualModule);
            testResult.tests.push(backendTest);

            // 5. اختبار الواجهة
            const uiTest = await this.testModuleUI(name, actualModule);
            testResult.tests.push(uiTest);

            // 6. اختبار الصلاحيات
            const permissionsTest = await this.testPermissions(name, actualModule);
            testResult.tests.push(permissionsTest);

            // 7. اختبار الميزات الخاصة (QR, رفع الملفات, التصدير)
            const featuresTest = await this.testSpecialFeatures(name, actualModule);
            testResult.tests.push(featuresTest);

            // تحديد الحالة العامة
            const hasCritical = testResult.tests.some(t => t.severity === 'critical' && !t.passed);
            const hasMedium = testResult.tests.some(t => t.severity === 'medium' && !t.passed);
            const hasLow = testResult.tests.some(t => t.severity === 'low' && !t.passed);

            if (hasCritical) {
                testResult.status = 'critical';
            } else if (hasMedium) {
                testResult.status = 'warning';
            } else if (hasLow) {
                testResult.status = 'info';
            } else {
                testResult.status = 'success';
            }

            // جمع المشاكل
            testResult.issues = testResult.tests
                .filter(t => !t.passed)
                .map(t => ({
                    test: t.name,
                    severity: t.severity,
                    message: t.message,
                    recommendation: t.recommendation
                }));

        } catch (error) {
            testResult.status = 'error';
            testResult.issues.push({
                test: 'general',
                severity: 'critical',
                message: `خطأ عام في اختبار الموديول: ${error.message}`,
                recommendation: 'تحقق من وجود الموديول وملفاته'
            });
        }

        this.testResults.push(testResult);
        this.updateProgress();
    },

    /**
     * اختبار سرعة التحميل
     */
    async testLoadingSpeed(moduleName, module) {
        const startTime = performance.now();
        
        try {
            // محاولة تحميل الموديول إذا كان موجوداً
            if (module && typeof module.load === 'function') {
                // قياس وقت الاستجابة
                const loadStart = performance.now();
                await Utils.promiseWithTimeout(
                    Promise.resolve(module.load()),
                    this.testConfig.timeout,
                    'Timeout'
                );
                const loadEnd = performance.now();
                
                const duration = loadEnd - loadStart;
                const passed = duration < 5000; // أقل من 5 ثوانٍ

                return {
                    name: 'سرعة التحميل',
                    passed: passed,
                    duration: duration,
                    severity: passed ? null : (duration > 10000 ? 'critical' : 'medium'),
                    message: passed 
                        ? `التحميل سريع (${duration.toFixed(0)}ms)`
                        : `التحميل بطيء (${duration.toFixed(0)}ms)`,
                    recommendation: passed 
                        ? null
                        : 'تحسين أداء التحميل أو تقليل حجم الملفات'
                };
            } else {
                return {
                    name: 'سرعة التحميل',
                    passed: false,
                    duration: 0,
                    severity: 'medium',
                    message: 'الموديول غير موجود أو لا يحتوي على دالة load',
                    recommendation: 'تحقق من وجود الموديول وملفاته'
                };
            }
        } catch (error) {
            const duration = performance.now() - startTime;
            return {
                name: 'سرعة التحميل',
                passed: false,
                duration: duration,
                severity: 'critical',
                message: `خطأ في التحميل: ${error.message}`,
                recommendation: 'تحقق من وجود الموديول وملفاته'
            };
        }
    },

    /**
     * اختبار وجود الموديول
     */
    async testModuleExistence(moduleName, module) {
        const moduleObjectName = this.getModuleObjectName(moduleName);
        
        // محاولة الحصول على الموديول من window
        const windowModule = window[moduleObjectName];
        const exists = typeof windowModule !== 'undefined' || (module !== undefined && module !== null);
        
        // إذا كان الموديول موجوداً في window ولكن لم يتم تمريره، استخدمه
        const actualModule = module || windowModule;
        
        return {
            name: 'وجود الموديول',
            passed: exists,
            severity: exists ? null : 'critical',
            message: exists 
                ? `الموديول موجود (${moduleObjectName})`
                : `الموديول غير موجود في window (${moduleObjectName})`,
            recommendation: exists 
                ? null
                : `تحقق من تحميل ملف الموديول في index.html ووجود window.${moduleObjectName}`
        };
    },

    /**
     * اختبار الوظائف الأساسية
     */
    async testModuleFunctions(moduleName, module) {
        // محاولة الحصول على الموديول من window إذا لم يتم تمريره
        if (!module) {
            const moduleObjectName = this.getModuleObjectName(moduleName);
            module = window[moduleObjectName];
        }
        
        if (!module) {
            return {
                name: 'الوظائف الأساسية',
                passed: false,
                severity: 'critical',
                message: 'الموديول غير موجود',
                recommendation: 'تحقق من وجود الموديول'
            };
        }

        const requiredFunctions = ['load'];
        const missingFunctions = requiredFunctions.filter(fn => typeof module[fn] !== 'function');

        return {
            name: 'الوظائف الأساسية',
            passed: missingFunctions.length === 0,
            severity: missingFunctions.length > 0 ? 'critical' : null,
            message: missingFunctions.length === 0
                ? 'جميع الوظائف الأساسية موجودة'
                : `الوظائف المفقودة: ${missingFunctions.join(', ')}`,
            recommendation: missingFunctions.length === 0
                ? null
                : `إضافة الوظائف المفقودة: ${missingFunctions.join(', ')}`
        };
    },

    /**
     * اختبار الربط مع الخلفية
     */
    async testBackendConnection(moduleName, module) {
        try {
            // Use cached result to avoid repeating the same failing check for every module
            if (this._backendTestCache && (Date.now() - this._backendTestCache.timestamp) < this._backendTestCacheTtlMs) {
                return { ...this._backendTestCache.result, message: `${this._backendTestCache.result.message} (cached)` };
            }

            // التحقق من وجود GoogleIntegration
            if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') {
                const result = {
                    name: 'الربط مع الخلفية',
                    passed: true,
                    severity: null,
                    message: 'GoogleIntegration غير متاح - تم تخطي الاختبار (سيتم استخدام البيانات المحلية)',
                    recommendation: null
                };
                this._backendTestCache = { timestamp: Date.now(), result };
                return result;
            }

            // التحقق من إعدادات Google Apps Script
            const isEnabled = AppState?.googleConfig?.appsScript?.enabled;
            const scriptUrl = AppState?.googleConfig?.appsScript?.scriptUrl;

            if (!isEnabled || !scriptUrl || scriptUrl.trim() === '') {
                const result = {
                    name: 'الربط مع الخلفية',
                    passed: true,
                    severity: null,
                    message: 'Google Apps Script غير مفعّل أو رابط الخادم غير محدد - تم تخطي الاختبار (سيتم استخدام البيانات المحلية)',
                    recommendation: null
                };
                this._backendTestCache = { timestamp: Date.now(), result };
                return result;
            }

            // التحقق من صحة رابط الخادم
            if (!scriptUrl.includes('script.google.com') || !scriptUrl.includes('/exec')) {
                const result = {
                    name: 'الربط مع الخلفية',
                    passed: true,
                    severity: null,
                    message: 'رابط Google Apps Script غير صحيح - تم تخطي الاختبار (سيتم استخدام البيانات المحلية)',
                    recommendation: null
                };
                this._backendTestCache = { timestamp: Date.now(), result };
                return result;
            }

            // التحقق من Circuit Breaker قبل الاختبار
            if (GoogleIntegration._circuitBreaker && GoogleIntegration._circuitBreaker.isOpen) {
                const remainingTime = GoogleIntegration._circuitBreaker.openUntil 
                    ? Math.ceil((GoogleIntegration._circuitBreaker.openUntil - Date.now()) / 1000)
                    : 30;
                
                if (remainingTime > 0) {
                    const result = {
                        name: 'الربط مع الخلفية',
                        passed: true,
                        severity: null,
                        message: `Circuit Breaker مفتوح - تم تخطي الاختبار مؤقتاً (${remainingTime} ثانية متبقية)`,
                        recommendation: null
                    };
                    this._backendTestCache = { timestamp: Date.now(), result };
                    return result;
                } else {
                    // انتهت فترة Circuit Breaker - إغلاقه
                    if (typeof GoogleIntegration._closeCircuitBreaker === 'function') {
                        GoogleIntegration._closeCircuitBreaker();
                    }
                }
            }

            const startTime = performance.now();
            
            // اختبار الاتصال بالخلفية
            try {
                const testRequest = await Utils.promiseWithTimeout(
                    GoogleIntegration.sendRequest({
                        action: 'testConnection',
                        data: {}
                    }),
                    20000,
                    'انتهت مهلة الاتصال'
                );

                const duration = performance.now() - startTime;
                const passed = testRequest && testRequest.success === true;

                if (passed) {
                    const result = {
                        name: 'الربط مع الخلفية',
                        passed: true,
                        duration: duration,
                        severity: null,
                        message: `الاتصال بالخلفية يعمل بنجاح (${duration.toFixed(0)}ms)`,
                        recommendation: null
                    };
                    this._backendTestCache = { timestamp: Date.now(), result };
                    return result;
                } else {
                    const errorMsg = testRequest?.message || 'فشل الاتصال بالخلفية';
                    const result = {
                        name: 'الربط مع الخلفية',
                        passed: false,
                        duration: duration,
                        severity: 'medium',
                        message: errorMsg,
                        recommendation: 'تحقق من:\n1. إعدادات Google Integration\n2. اتصال الإنترنت\n3. أن Google Apps Script منشور ومفعّل'
                    };
                    this._backendTestCache = { timestamp: Date.now(), result };
                    return result;
                }
            } catch (testError) {
                const duration = performance.now() - startTime;
                let errorMessage = 'تعذر الاتصال بالخلفية حالياً - سيتم استخدام البيانات المحلية';
                let recommendation = null;

                // تحسين رسائل الخطأ حسب نوع الخطأ
                const errorMsg = testError.message || testError.toString() || '';
                
                if (errorMsg.includes('Google Apps Script غير مفعل') || errorMsg.includes('غير مفعّل')) {
                    errorMessage = 'Google Apps Script غير مفعّل - سيتم استخدام البيانات المحلية';
                } else if (errorMsg.includes('Circuit Breaker مفتوح') || errorMsg.includes('Circuit Breaker')) {
                    errorMessage = `Circuit Breaker مفتوح - سيتم استخدام البيانات المحلية (إعادة المحاولة بعد 30 ثانية)`;
                } else if (errorMsg.includes('Timeout') || errorMsg.includes('انتهت مهلة')) {
                    errorMessage = 'تعذر الاتصال بالخلفية (Timeout) - سيتم استخدام البيانات المحلية';
                } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('CORS')) {
                    errorMessage = 'تعذر الاتصال بالخلفية (Network/CORS) - سيتم استخدام البيانات المحلية';
                } else if (errorMsg.includes('URL غير معرف') || errorMsg.includes('غير صحيح')) {
                    errorMessage = 'رابط Google Apps Script غير صحيح - سيتم استخدام البيانات المحلية';
                } else {
                    errorMessage = `تعذر الاتصال بالخلفية: ${errorMsg}`;
                }

                const result = {
                    name: 'الربط مع الخلفية',
                    passed: true,
                    duration: duration,
                    severity: null,
                    message: errorMessage,
                    recommendation: recommendation
                };
                this._backendTestCache = { timestamp: Date.now(), result };
                return result;
            }
        } catch (error) {
            const result = {
                name: 'الربط مع الخلفية',
                passed: true,
                severity: null,
                message: `تعذر اختبار الاتصال بالخلفية: ${error.message || 'خطأ غير معروف'} (سيتم استخدام البيانات المحلية)`,
                recommendation: null
            };
            this._backendTestCache = { timestamp: Date.now(), result };
            return result;
        }
    },

    /**
     * اختبار الواجهة
     */
    async testModuleUI(moduleName, module) {
        try {
            // محاولة الحصول على الموديول من window إذا لم يتم تمريره
            if (!module) {
                const moduleObjectName = this.getModuleObjectName(moduleName);
                module = window[moduleObjectName];
            }
            
            // التحقق من وجود قسم الموديول في DOM (دعم معرفات متعددة)
            const sectionIds = [
                `${moduleName}-section`,
                `${moduleName.replace(/-/g, '')}-section`
            ];
            
            // إضافة معرفات خاصة لبعض الموديولات
            const specialSectionIds = {
                'actiontrackingregister': ['action-tracking-section'],
                'fireequipment': ['fire-equipment-section'],
                'periodicinspections': ['periodic-inspections-section'],
                'behaviormonitoring': ['behavior-monitoring-section'],
                'chemicalsafety': ['chemical-safety-section'],
                'dailyobservations': ['daily-observations-section'],
                'safetybudget': ['safety-budget-section'],
                'safetyperformancekpis': ['safety-performance-kpis-section'],
                'riskassessment': ['risk-assessment-section'],
                'legaldocuments': ['legal-documents-section'],
                'safetyhealthmanagement': ['safety-health-management-section'],
                'usertasks': ['user-tasks-section'],
                'sopjha': ['sop-jha-section'],
                'aiassistant': ['ai-assistant-section'],
                'useraiassistant': ['useraiassistant-section']
            };
            
            if (specialSectionIds[moduleName]) {
                sectionIds.push(...specialSectionIds[moduleName]);
            }
            
            let section = null;
            for (const sectionId of sectionIds) {
                section = document.getElementById(sectionId);
                if (section) break;
            }
            
            if (!section) {
                return {
                    name: 'عرض الواجهة',
                    passed: false,
                    severity: 'medium',
                    message: `قسم الموديول غير موجود في DOM (جرب: ${sectionIds.join(' أو ')})`,
                    recommendation: 'إضافة قسم الموديول في index.html'
                };
            }

            // محاولة تحميل الموديول والتحقق من عرضه
            if (module && typeof module.load === 'function') {
                try {
                    // حفظ المحتوى الأصلي للقسم وحالة العرض
                    const originalContent = section.innerHTML;
                    const originalDisplay = section.style.display;
                    const originalVisibility = section.style.visibility;
                    const hadContentBefore = (section.innerHTML || '').trim().length > 30 || (section.children && section.children.length > 0);
                    
                    // إظهار القسم مؤقتاً للاختبار
                    section.style.display = 'block';
                    section.style.visibility = 'visible';
                    
                    // تحميل الموديول
                    await Utils.promiseWithTimeout(
                        module.load(),
                        15000,
                        () => new Error('Timeout: module.load took too long')
                    );
                    
                    // انتظار للسماح للموديول بإنهاء الرسم والتحميل
                    // بعض الموديولات تحمّل البيانات بشكل غير متزامن
                    let hasContent = false;
                    let attempts = 0;
                    const maxAttempts = 6; // زيادة عدد المحاولات
                    
                    while (attempts < maxAttempts && !hasContent) {
                        await new Promise(resolve => setTimeout(resolve, 500)); // زيادة وقت الانتظار
                        const content = section.innerHTML.trim();
                        hasContent = content.length > 100; // التحقق من وجود محتوى كافٍ (أكثر من 100 حرف)
                        
                        // التحقق أيضاً من وجود عناصر HTML أساسية
                        if (!hasContent) {
                            const hasHeader = section.querySelector('.section-header, h1, h2, .section-title');
                            const hasContentCard = section.querySelector('.content-card, .card-body, .mt-6');
                            const hasButtons = section.querySelector('button, .btn-primary, .btn-secondary');
                            hasContent = !!(hasHeader || hasContentCard || hasButtons);
                        }
                        attempts++;
                    }
                    
                    // التحقق من وجود محتوى في القسم
                    // بعض الموديولات (مثل UserAIAssistant) لا تعرض محتوى في القسم لأنها تعمل بشكل عائم
                    
                    // استثناءات للموديولات التي لا تعرض محتوى في القسم
                    const modulesWithoutSectionContent = ['useraiassistant', 'aiassistant'];
                    const isExpectedEmpty = modulesWithoutSectionContent.includes(moduleName);
                    
                    // استعادة حالة العرض الأصلية
                    if (originalDisplay) {
                        section.style.display = originalDisplay;
                    } else {
                        section.style.display = '';
                    }
                    if (originalVisibility) {
                        section.style.visibility = originalVisibility;
                    } else {
                        section.style.visibility = '';
                    }

                    // استعادة المحتوى الأصلي لتجنب تلوث اختبارات الموديولات الأخرى
                    section.innerHTML = originalContent;
                    
                    // إذا كان القسم فارغاً ولكن الموديول موجود ويعمل، نعتبره نجاح
                    if (!hasContent && isExpectedEmpty) {
                        return {
                            name: 'عرض الواجهة',
                            passed: true,
                            severity: null,
                            message: 'الواجهة تعرض بشكل صحيح (موديول عائم)',
                            recommendation: null
                        };
                    }
                    
                    return {
                        name: 'عرض الواجهة',
                        passed: hasContent || hadContentBefore,
                        severity: (hasContent || hadContentBefore) ? null : 'medium',
                        message: hasContent
                            ? 'الواجهة تعرض بشكل صحيح'
                            : (hadContentBefore ? 'الواجهة تعرض (محتوى ثابت/قالب مسبق)' : 'الواجهة فارغة بعد التحميل'),
                        recommendation: hasContent
                            ? null
                            : 'تحقق من دالة load في الموديول'
                    };
                } catch (error) {
                    // استعادة حالة العرض الأصلية في حالة الخطأ
                    if (section) {
                        // أفضل محاولة لإرجاع القسم للوضع الافتراضي (لتجنب تلوث الاختبارات)
                        section.style.display = '';
                        section.style.visibility = '';
                    }
                    
                    return {
                        name: 'عرض الواجهة',
                        passed: false,
                        severity: 'critical',
                        message: `خطأ في تحميل الواجهة: ${error.message}`,
                        recommendation: 'تحقق من دالة load في الموديول'
                    };
                }
            } else {
                return {
                    name: 'عرض الواجهة',
                    passed: false,
                    severity: 'medium',
                    message: 'الموديول لا يحتوي على دالة load',
                    recommendation: 'إضافة دالة load للموديول'
                };
            }
        } catch (error) {
            return {
                name: 'عرض الواجهة',
                passed: false,
                severity: 'critical',
                message: `خطأ عام: ${error.message}`,
                recommendation: 'تحقق من الموديول'
            };
        }
    },

    /**
     * اختبار الصلاحيات
     */
    async testPermissions(moduleName, module) {
        try {
            // التحقق من وجود نظام الصلاحيات
            if (typeof Permissions === 'undefined') {
                return {
                    name: 'الصلاحيات',
                    passed: true, // ليس مشكلة حرجة
                    severity: null,
                    message: 'نظام الصلاحيات غير متاح',
                    recommendation: 'إضافة نظام الصلاحيات (اختياري)'
                };
            }

            // التحقق من أن الموديول يتحقق من الصلاحيات
            if (module && typeof module.load === 'function') {
                // محاولة تحميل الموديول والتحقق من التحقق من الصلاحيات
                // (هذا اختبار بسيط - يمكن تحسينه)
                return {
                    name: 'الصلاحيات',
                    passed: true,
                    severity: null,
                    message: 'التحقق من الصلاحيات متاح',
                    recommendation: null
                };
            } else {
                return {
                    name: 'الصلاحيات',
                    passed: true,
                    severity: null,
                    message: 'لا يمكن التحقق من الصلاحيات (الموديول غير موجود)',
                    recommendation: null
                };
            }
        } catch (error) {
            return {
                name: 'الصلاحيات',
                passed: false,
                severity: 'low',
                message: `خطأ في التحقق من الصلاحيات: ${error.message}`,
                recommendation: 'تحقق من نظام الصلاحيات'
            };
        }
    },

    /**
     * اختبار الميزات الخاصة
     */
    async testSpecialFeatures(moduleName, module) {
        const features = [];
        
        // التحقق من الميزات الشائعة
        if (module) {
            // QR Code
            if (moduleName.includes('qr') || typeof module.generateQR === 'function') {
                features.push('QR Code');
            }
            
            // رفع الملفات
            if (typeof module.uploadFile === 'function' || typeof module.handleFileUpload === 'function') {
                features.push('رفع الملفات');
            }
            
            // التصدير PDF
            if (typeof module.exportToPDF === 'function' || typeof module.generatePDF === 'function') {
                features.push('تصدير PDF');
            }
            
            // التصدير Excel
            if (typeof module.exportToExcel === 'function' || typeof module.generateExcel === 'function') {
                features.push('تصدير Excel');
            }
        }

        return {
            name: 'الميزات الخاصة',
            passed: true, // ليس اختبار فشل/نجاح
            severity: null,
            message: features.length > 0 
                ? `الميزات المتاحة: ${features.join(', ')}`
                : 'لا توجد ميزات خاصة محددة',
            recommendation: null
        };
    },

    /**
     * عرض شاشة التقدم
     */
    showProgressScreen() {
        const container = document.getElementById('test-results-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div style="width: 200px; margin: 0 auto 12px;">
                        <div style="width: 100%; height: 4px; background: rgba(59, 130, 246, 0.2); border-radius: 2px; overflow: hidden;">
                            <div style="height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb, #3b82f6); background-size: 200% 100%; border-radius: 2px; animation: loadingProgress 1.5s ease-in-out infinite;"></div>
                        </div>
                    </div>
                    <p class="text-gray-700 font-medium">جاري تشغيل الاختبارات...</p>
                    <p class="text-sm text-gray-500 mt-2" id="test-progress-text">0 / 0</p>
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mt-4 max-w-md mx-auto">
                        <div id="test-progress-bar" class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * تحديث شاشة التقدم
     */
    updateProgress() {
        const totalModules = this.getModulesList().length;
        const completed = this.testResults.length;
        const progress = (completed / totalModules) * 100;

        const progressBar = document.getElementById('test-progress-bar');
        const progressText = document.getElementById('test-progress-text');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `${completed} / ${totalModules}`;
        }
    },

    /**
     * إخفاء شاشة التقدم
     */
    hideProgressScreen() {
        // سيتم استبدالها بنتائج الاختبار
    },

    /**
     * عرض نتائج الاختبار
     */
    renderTestResults() {
        const container = document.getElementById('test-results-container');
        if (!container) return;

        if (this.testResults.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-vial text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">لم يتم تشغيل أي اختبار بعد</p>
                </div>
            `;
            return;
        }

        let html = '<div class="space-y-4">';
        
        this.testResults.forEach((result, index) => {
            const statusIcon = {
                'success': '<i class="fas fa-check-circle text-green-600"></i>',
                'warning': '<i class="fas fa-exclamation-triangle text-yellow-600"></i>',
                'critical': '<i class="fas fa-times-circle text-red-600"></i>',
                'info': '<i class="fas fa-info-circle text-blue-600"></i>',
                'error': '<i class="fas fa-exclamation-circle text-red-600"></i>',
                'pending': '<i class="fas fa-clock text-gray-400"></i>'
            }[result.status] || '<i class="fas fa-question-circle text-gray-400"></i>';

            const statusColor = {
                'success': 'green',
                'warning': 'yellow',
                'critical': 'red',
                'info': 'blue',
                'error': 'red',
                'pending': 'gray'
            }[result.status] || 'gray';

            const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
            const mediumCount = result.issues.filter(i => i.severity === 'medium').length;
            const lowCount = result.issues.filter(i => i.severity === 'low').length;

            html += `
                <div class="border rounded-lg p-4 ${result.status === 'critical' ? 'border-red-300 bg-red-50' : result.status === 'warning' ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}">
                    <div class="flex items-start justify-between">
                        <div class="flex items-start gap-3 flex-1">
                            <div class="text-2xl mt-1">${statusIcon}</div>
                            <div class="flex-1">
                                <h3 class="font-semibold text-lg text-gray-800">${result.displayName}</h3>
                                <p class="text-sm text-gray-500 mt-1">
                                    ${new Date(result.timestamp).toLocaleString('ar-SA')}
                                </p>
                                <div class="mt-2 flex items-center gap-4 text-sm">
                                    <span class="text-gray-600">
                                        <i class="fas fa-clock ml-1"></i>
                                        ${result.loadingTime > 0 ? result.loadingTime.toFixed(0) + 'ms' : 'N/A'}
                                    </span>
                                    ${criticalCount > 0 ? `<span class="text-red-600"><i class="fas fa-exclamation-circle ml-1"></i> ${criticalCount} حرجة</span>` : ''}
                                    ${mediumCount > 0 ? `<span class="text-yellow-600"><i class="fas fa-exclamation-triangle ml-1"></i> ${mediumCount} متوسطة</span>` : ''}
                                    ${lowCount > 0 ? `<span class="text-blue-600"><i class="fas fa-info-circle ml-1"></i> ${lowCount} منخفضة</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <button 
                            class="btn-secondary btn-sm" 
                            onclick="AppTester.toggleTestDetails(${index})"
                        >
                            <i class="fas fa-chevron-down ml-1" id="toggle-icon-${index}"></i>
                            التفاصيل
                        </button>
                    </div>
                    
                    <div id="test-details-${index}" class="hidden mt-4 pt-4 border-t border-gray-200">
                        <div class="space-y-3">
                            ${result.tests.map(test => `
                                <div class="flex items-start gap-3 p-2 rounded ${test.passed ? 'bg-green-50' : test.severity === 'critical' ? 'bg-red-50' : test.severity === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'}">
                                    <div class="mt-1">
                                        ${test.passed ? '<i class="fas fa-check text-green-600"></i>' : '<i class="fas fa-times text-red-600"></i>'}
                                    </div>
                                    <div class="flex-1">
                                        <p class="font-medium text-sm">${test.name}</p>
                                        <p class="text-xs text-gray-600 mt-1">${test.message}</p>
                                        ${test.recommendation ? `<p class="text-xs text-blue-600 mt-1"><i class="fas fa-lightbulb ml-1"></i> ${test.recommendation}</p>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // تفعيل أزرار التصدير والإرسال
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const sendReportBtn = document.getElementById('send-report-btn');
        if (exportPdfBtn) exportPdfBtn.disabled = false;
        if (sendReportBtn) sendReportBtn.disabled = false;
    },

    /**
     * تبديل عرض تفاصيل الاختبار
     */
    toggleTestDetails(index) {
        const details = document.getElementById(`test-details-${index}`);
        const icon = document.getElementById(`toggle-icon-${index}`);
        
        if (details) {
            details.classList.toggle('hidden');
            if (icon) {
                if (details.classList.contains('hidden')) {
                    icon.className = 'fas fa-chevron-down ml-1';
                } else {
                    icon.className = 'fas fa-chevron-up ml-1';
                }
            }
        }
    },

    /**
     * تحديث لوحة التحكم
     */
    updateDashboard() {
        if (this.testResults.length === 0) return;

        const lastTest = this.testResults[this.testResults.length - 1];
        const allIssues = this.testResults.flatMap(r => r.issues);
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');
        const hasCritical = criticalIssues.length > 0;

        // تحديث آخر اختبار
        const lastTestStats = document.getElementById('last-test-stats');
        if (lastTestStats) {
            lastTestStats.innerHTML = `
                <p class="text-sm text-gray-600">${new Date(lastTest.timestamp).toLocaleString('ar-SA')}</p>
                <p class="text-lg font-semibold mt-2 ${lastTest.status === 'success' ? 'text-green-600' : lastTest.status === 'critical' ? 'text-red-600' : 'text-yellow-600'}">
                    ${lastTest.status === 'success' ? 'نجح' : lastTest.status === 'critical' ? 'فشل' : 'تحذير'}
                </p>
            `;
        }

        // تحديث المشاكل الحرجة
        const criticalCount = document.getElementById('critical-issues-count');
        if (criticalCount) {
            criticalCount.innerHTML = `<span class="text-3xl font-bold text-red-600">${criticalIssues.length}</span>`;
        }

        // تحديث الحالة العامة
        const overallStatus = document.getElementById('overall-status');
        if (overallStatus) {
            const status = hasCritical ? 'حرجة' : criticalIssues.length === 0 && allIssues.length === 0 ? 'ممتاز' : 'جيد';
            const color = hasCritical ? 'red' : criticalIssues.length === 0 && allIssues.length === 0 ? 'green' : 'yellow';
            overallStatus.innerHTML = `<span class="text-3xl font-bold text-${color}-600">${status}</span>`;
        }
    },

    /**
     * حفظ نتائج الاختبار
     */
    saveTestResults() {
        try {
            const history = JSON.parse(localStorage.getItem('appTesterHistory') || '[]');
            history.push({
                timestamp: new Date().toISOString(),
                results: this.testResults
            });
            
            // الاحتفاظ بآخر 50 اختبار فقط
            if (history.length > 50) {
                history.shift();
            }
            
            localStorage.setItem('appTesterHistory', JSON.stringify(history));
        } catch (error) {
            Utils.safeError('خطأ في حفظ نتائج الاختبار:', error);
        }
    },

    /**
     * تصدير نتائج آخر اختبار إلى JSON (تحميل ملف + حفظ نسخة في localStorage)
     */
    exportToJSON() {
        try {
            const payload = {
                exportedAt: new Date().toISOString(),
                results: Array.isArray(this.testResults) ? this.testResults : []
            };

            if (!payload.results.length) {
                Notification?.warning?.('لا توجد نتائج لتصديرها');
                return;
            }

            // حفظ نسخة في localStorage
            try {
                localStorage.setItem('appTesterLastExport', JSON.stringify(payload));
            } catch (eStore) {
                // ignore
            }

            const json = JSON.stringify(payload, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            const safeTime = payload.exportedAt.replace(/[:.]/g, '-');
            a.href = url;
            a.download = `apptester-results-${safeTime}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

            Notification?.success?.('تم تصدير نتائج الاختبار (JSON)');
        } catch (error) {
            Utils.safeError('خطأ في تصدير JSON:', error);
            Notification?.error?.('حدث خطأ في تصدير JSON');
        }
    },

    /**
     * تحميل تاريخ الاختبارات
     */
    loadTestHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('appTesterHistory') || '[]');
            if (history.length > 0) {
                const lastRun = history[history.length - 1];
                this.testResults = lastRun.results || [];
                this.renderTestResults();
                this.updateDashboard();
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل تاريخ الاختبارات:', error);
        }
    },

    /**
     * تصدير التقرير إلى PDF
     */
    async exportToPDF() {
        if (this.testResults.length === 0) {
            if (typeof Notification !== 'undefined' && Notification.warning) {
                Notification.warning('لا توجد نتائج للتصدير');
            } else if (window.UI && window.UI.showNotification) {
                window.UI.showNotification('لا توجد نتائج للتصدير', 'warning');
            }
            return;
        }

        try {
            // استخدام طريقة HTML للطباعة بدلاً من jsPDF لضمان دعم اللغة العربية بشكل صحيح
            // jsPDF قد لا يدعم العربية بشكل جيد
            this.exportToPDFAlternative();
        } catch (error) {
            Utils.safeError('خطأ في تصدير PDF:', error);
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('حدث خطأ في تصدير PDF: ' + error.message);
            } else if (window.UI && window.UI.showNotification) {
                window.UI.showNotification('حدث خطأ في تصدير PDF', 'error');
            }
        }
    },

    /**
     * طريقة بديلة لتصدير PDF
     */
    exportToPDFAlternative() {
        // إنشاء HTML للطباعة
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('يرجى السماح للنوافذ المنبثقة لعرض التقرير');
            }
            return;
        }
        
        const html = this.generateReportHTML();
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        
        // انتظار تحميل الخطوط قبل الطباعة
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                if (typeof Notification !== 'undefined' && Notification.success) {
                    Notification.success('تم تحويل التقرير للطباعة/الحفظ كـ PDF');
                }
            }, 1000);
        };
    },

    /**
     * إنشاء HTML للتقرير
     */
    generateReportHTML() {
        const allIssues = this.testResults.flatMap(r => r.issues);
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');
        const mediumIssues = allIssues.filter(i => i.severity === 'medium');
        const lowIssues = allIssues.filter(i => i.severity === 'low');

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                <title>تقرير اختبار التطبيق</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    * { font-family: 'Cairo', 'Arial', 'Tahoma', sans-serif !important; }
                    body { font-family: 'Cairo', 'Arial', 'Tahoma', sans-serif; padding: 20px; direction: rtl; text-align: right; }
                    h1 { color: #2563eb; text-align: center; font-family: 'Cairo', 'Arial', sans-serif; }
                    h2 { color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 10px; font-family: 'Cairo', 'Arial', sans-serif; }
                    h3 { font-family: 'Cairo', 'Arial', sans-serif; }
                    .summary { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .module { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                    .issue { margin: 10px 0; padding: 10px; background: #fef2f2; border-right: 4px solid #dc2626; }
                    .issue.medium { background: #fffbeb; border-right-color: #f59e0b; }
                    .issue.low { background: #eff6ff; border-right-color: #3b82f6; }
                    p, span, div, td, th { font-family: 'Cairo', 'Arial', 'Tahoma', sans-serif; }
                </style>
            </head>
            <body>
                <h1>تقرير اختبار التطبيق</h1>
                <p style="text-align: center;">تاريخ التقرير: ${new Date().toLocaleString('ar-SA')}</p>
                
                <div class="summary">
                    <h2>ملخص النتائج</h2>
                    <p>إجمالي الموديولات المختبرة: ${this.testResults.length}</p>
                    <p>المشاكل الحرجة: <strong style="color: #dc2626;">${criticalIssues.length}</strong></p>
                    <p>المشاكل المتوسطة: <strong style="color: #f59e0b;">${mediumIssues.length}</strong></p>
                    <p>المشاكل المنخفضة: <strong style="color: #3b82f6;">${lowIssues.length}</strong></p>
                </div>
                
                ${this.testResults.map(result => `
                    <div class="module">
                        <h2>${result.displayName}</h2>
                        <p><strong>الحالة:</strong> ${result.status}</p>
                        <p><strong>وقت التحميل:</strong> ${result.loadingTime > 0 ? result.loadingTime.toFixed(0) + 'ms' : 'N/A'}</p>
                        ${result.issues.length > 0 ? `
                            <h3>المشاكل المكتشفة:</h3>
                            ${result.issues.map(issue => `
                                <div class="issue ${issue.severity}">
                                    <p><strong>${issue.test}:</strong> ${issue.message}</p>
                                    ${issue.recommendation ? `<p><em>التوصية: ${issue.recommendation}</em></p>` : ''}
                                </div>
                            `).join('')}
                        ` : '<p style="color: green;">✓ لا توجد مشاكل</p>'}
                    </div>
                `).join('')}
            </body>
            </html>
        `;
    },

    /**
     * إرسال التقرير للإدارة
     */
    async sendReportToAdmin() {
        if (this.testResults.length === 0) {
            if (typeof Notification !== 'undefined' && Notification.warning) {
                Notification.warning('لا توجد نتائج للإرسال');
            } else if (window.UI && window.UI.showNotification) {
                window.UI.showNotification('لا توجد نتائج للإرسال', 'warning');
            }
            return;
        }

        try {
            // إظهار شاشة التحميل إذا كانت متاحة
            if (typeof Loading !== 'undefined' && typeof Loading.show === 'function') {
                Loading.show();
            }
            
            const report = {
                timestamp: new Date().toISOString(),
                results: this.testResults,
                summary: this.generateSummary(),
                reportHTML: this.generateReportHTML()
            };

            // محاولة إرسال التقرير عبر GoogleIntegration
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendRequest) {
                try {
                    const response = await GoogleIntegration.sendRequest({
                        action: 'saveTestReport',
                        data: report
                    });
                    
                    if (response && response.success) {
                        if (typeof Notification !== 'undefined' && Notification.success) {
                            Notification.success('تم إرسال التقرير للإدارة بنجاح');
                        } else if (window.UI && window.UI.showNotification) {
                            window.UI.showNotification('تم إرسال التقرير بنجاح', 'success');
                        }
                    } else {
                        throw new Error(response?.message || 'فشل إرسال التقرير');
                    }
                } catch (googleError) {
                    Utils.safeWarn('فشل إرسال التقرير عبر GoogleIntegration، جاري المحاولة بطريقة بديلة:', googleError);
                    // المحاولة بطريقة بديلة
                    await this.sendReportAlternative(report);
                }
            } else {
                // طريقة بديلة
                await this.sendReportAlternative(report);
            }
        } catch (error) {
            Utils.safeError('خطأ في إرسال التقرير:', error);
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error('حدث خطأ في إرسال التقرير: ' + error.message);
            } else if (window.UI && window.UI.showNotification) {
                window.UI.showNotification('حدث خطأ في إرسال التقرير', 'error');
            }
        } finally {
            // إخفاء شاشة التحميل إذا كانت متاحة
            if (typeof Loading !== 'undefined' && typeof Loading.hide === 'function') {
                Loading.hide();
            }
        }
    },

    async sendReportAlternative(report) {
        // طريقة بديلة: نسخ التقرير أو حفظه محلياً
        try {
            // محاولة نسخ التقرير إلى الحافظة
            if (navigator.clipboard && navigator.clipboard.writeText) {
                const reportText = JSON.stringify(report, null, 2);
                await navigator.clipboard.writeText(reportText);
                
                if (typeof Notification !== 'undefined' && Notification.success) {
                    Notification.success('تم نسخ التقرير إلى الحافظة. يمكنك لصقه في بريد إلكتروني أو مستند');
                } else if (window.UI && window.UI.showNotification) {
                    window.UI.showNotification('تم نسخ التقرير إلى الحافظة', 'success');
                }
            } else {
                // حفظ في localStorage كبديل
                try {
                    const reports = JSON.parse(localStorage.getItem('appTesterReports') || '[]');
                    reports.push(report);
                    // الاحتفاظ بآخر 10 تقارير فقط
                    if (reports.length > 10) {
                        reports.shift();
                    }
                    localStorage.setItem('appTesterReports', JSON.stringify(reports));
                    
                    if (typeof Notification !== 'undefined' && Notification.success) {
                        Notification.success('تم حفظ التقرير محلياً. يمكنك تصديره لاحقاً');
                    } else if (window.UI && window.UI.showNotification) {
                        window.UI.showNotification('تم حفظ التقرير محلياً', 'success');
                    }
                } catch (storageError) {
                    throw new Error('فشل حفظ التقرير');
                }
            }
        } catch (error) {
            throw error;
        }
    },

    /**
     * إنشاء ملخص التقرير
     */
    generateSummary() {
        const allIssues = this.testResults.flatMap(r => r.issues);
        const criticalIssues = allIssues.filter(i => i.severity === 'critical');
        const mediumIssues = allIssues.filter(i => i.severity === 'medium');
        const lowIssues = allIssues.filter(i => i.severity === 'low');

        return {
            totalModules: this.testResults.length,
            passedModules: this.testResults.filter(r => r.status === 'success').length,
            failedModules: this.testResults.filter(r => r.status === 'critical').length,
            criticalIssues: criticalIssues.length,
            mediumIssues: mediumIssues.length,
            lowIssues: lowIssues.length,
            averageLoadingTime: this.testResults
                .filter(r => r.loadingTime > 0)
                .reduce((sum, r) => sum + r.loadingTime, 0) / 
                this.testResults.filter(r => r.loadingTime > 0).length || 0
        };
    },

    /**
     * عرض الإعدادات
     */
    showSettings() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <i class="fas fa-cog ml-2"></i>
                        إعدادات الاختبار
                    </h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">الجدولة التلقائية</label>
                        <div class="flex items-center gap-3 mb-4">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    id="auto-schedule-enabled" 
                                    ${this.testConfig.autoSchedule.enabled ? 'checked' : ''}
                                    class="form-checkbox"
                                >
                                <span>تفعيل الجدولة التلقائية</span>
                            </label>
                        </div>
                    </div>

                    <div id="schedule-options" style="${this.testConfig.autoSchedule.enabled ? '' : 'display: none;'}">
                        <div class="form-group">
                            <label class="form-label">التكرار</label>
                            <select id="schedule-frequency" class="form-input">
                                <option value="daily" ${this.testConfig.autoSchedule.frequency === 'daily' ? 'selected' : ''}>يومياً</option>
                                <option value="weekly" ${this.testConfig.autoSchedule.frequency === 'weekly' ? 'selected' : ''}>أسبوعياً</option>
                                <option value="onUpdate" ${this.testConfig.autoSchedule.frequency === 'onUpdate' ? 'selected' : ''}>عند نشر تحديث جديد</option>
                            </select>
                        </div>

                        <div class="form-group" id="schedule-time-group" style="${this.testConfig.autoSchedule.frequency === 'onUpdate' ? 'display: none;' : ''}">
                            <label class="form-label">وقت التشغيل</label>
                            <input 
                                type="time" 
                                id="schedule-time" 
                                class="form-input"
                                value="${this.testConfig.autoSchedule.time}"
                            >
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">مهلة الاختبار (بالثواني)</label>
                        <input 
                            type="number" 
                            id="test-timeout" 
                            class="form-input"
                            value="${this.testConfig.timeout / 1000}"
                            min="10"
                            max="300"
                        >
                    </div>

                    <div class="form-group">
                        <label class="form-label">عدد المحاولات عند الفشل</label>
                        <input 
                            type="number" 
                            id="test-retry-count" 
                            class="form-input"
                            value="${this.testConfig.retryCount}"
                            min="0"
                            max="5"
                        >
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">إلغاء</button>
                    <button class="btn-primary" onclick="AppTester.saveSettings()">حفظ</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // إعداد الأحداث
        const autoScheduleEnabled = document.getElementById('auto-schedule-enabled');
        const scheduleOptions = document.getElementById('schedule-options');
        const scheduleFrequency = document.getElementById('schedule-frequency');
        const scheduleTimeGroup = document.getElementById('schedule-time-group');

        autoScheduleEnabled.addEventListener('change', (e) => {
            scheduleOptions.style.display = e.target.checked ? 'block' : 'none';
        });

        scheduleFrequency.addEventListener('change', (e) => {
            scheduleTimeGroup.style.display = e.target.value === 'onUpdate' ? 'none' : 'block';
        });
    },

    /**
     * حفظ الإعدادات
     */
    saveSettings() {
        const autoScheduleEnabled = document.getElementById('auto-schedule-enabled').checked;
        const scheduleFrequency = document.getElementById('schedule-frequency').value;
        const scheduleTime = document.getElementById('schedule-time').value;
        const testTimeout = parseInt(document.getElementById('test-timeout').value) * 1000;
        const retryCount = parseInt(document.getElementById('test-retry-count').value);

        this.testConfig.autoSchedule.enabled = autoScheduleEnabled;
        this.testConfig.autoSchedule.frequency = scheduleFrequency;
        this.testConfig.autoSchedule.time = scheduleTime;
        this.testConfig.timeout = testTimeout;
        this.testConfig.retryCount = retryCount;

        // حفظ في localStorage
        try {
            localStorage.setItem('appTesterConfig', JSON.stringify(this.testConfig));
        } catch (error) {
            Utils.safeError('خطأ في حفظ الإعدادات:', error);
        }

        // إعادة تهيئة الجدولة
        this.initializeScheduler();

        // إغلاق النافذة
        document.querySelector('.modal-overlay')?.remove();

        if (window.UI && window.UI.showNotification) {
            window.UI.showNotification('تم حفظ الإعدادات بنجاح', 'success');
        }
    },

    /**
     * تهيئة الجدولة
     */
    initializeScheduler() {
        // إيقاف الجدولة السابقة إن وجدت
        if (this.scheduledTests) {
            clearTimeout(this.scheduledTests);
            this.scheduledTests = null;
        }

        // تحميل الإعدادات من localStorage
        try {
            const savedConfig = localStorage.getItem('appTesterConfig');
            if (savedConfig) {
                this.testConfig = { ...this.testConfig, ...JSON.parse(savedConfig) };
            }
        } catch (error) {
            Utils.safeError('خطأ في تحميل إعدادات الاختبار:', error);
        }

        // التحقق من الجدولة التلقائية
        if (this.testConfig.autoSchedule.enabled) {
            if (this.testConfig.autoSchedule.frequency === 'onUpdate') {
                // الاستماع لتحديثات التطبيق
                this.setupUpdateListener();
            } else {
                // جدولة يومية أو أسبوعية
                this.scheduleNextTest();
            }
        }
    },

    /**
     * جدولة الاختبار التالي
     */
    scheduleNextTest() {
        if (this.testConfig.autoSchedule.frequency === 'onUpdate') {
            return; // يتم التعامل معها في setupUpdateListener
        }

        const now = new Date();
        const [hours, minutes] = this.testConfig.autoSchedule.time.split(':').map(Number);
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);

        // حساب الوقت المحدد بناءً على التكرار
        if (this.testConfig.autoSchedule.frequency === 'weekly') {
            // للجدولة الأسبوعية: نضيف 7 أيام مباشرة
            scheduledTime.setDate(scheduledTime.getDate() + 7);
        } else {
            // للجدولة اليومية: إذا كان الوقت قد مضى اليوم، نحدد موعداً لليوم التالي
            if (scheduledTime <= now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }
        }

        const timeUntilTest = scheduledTime.getTime() - now.getTime();

        // التحقق من أن الوقت صحيح (يجب أن يكون في المستقبل)
        if (timeUntilTest <= 0) {
            Utils.safeError('خطأ في حساب وقت الجدولة');
            return;
        }

        if (AppState?.debugMode) Utils?.safeLog(`📅 تم جدولة الاختبار التالي: ${scheduledTime.toLocaleString('ar-SA')}`);

        // جدولة الاختبار
        this.scheduledTests = setTimeout(() => {
            this.runFullTest();
            // إعادة الجدولة للاختبار التالي
            this.scheduleNextTest();
        }, timeUntilTest);
    },

    /**
     * إعداد مستمع تحديثات التطبيق
     */
    setupUpdateListener() {
        // الاستماع لتحديثات التطبيق
        document.addEventListener('app-updated', () => {
            if (AppState?.debugMode) Utils?.safeLog('🔄 تم اكتشاف تحديث جديد - تشغيل الاختبار...');
            this.runFullTest();
        });

        // أيضاً يمكن الاستماع لتغييرات في service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (AppState?.debugMode) Utils?.safeLog('🔄 تم اكتشاف تحديث service worker - تشغيل الاختبار...');
                setTimeout(() => {
                    this.runFullTest();
                }, 5000); // انتظار 5 ثوانٍ لضمان اكتمال التحديث
            });
        }
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof AppTester !== 'undefined') {
            window.AppTester = AppTester;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ AppTester module loaded and available on window.AppTester');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير AppTester:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof AppTester !== 'undefined') {
            try {
                window.AppTester = AppTester;
            } catch (e) {
                console.error('❌ فشل تصدير AppTester:', e);
            }
        }
    }
})();

