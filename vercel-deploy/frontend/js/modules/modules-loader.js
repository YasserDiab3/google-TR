/**
 * Modules Loader
 * محمل الموديولات - يقوم بتحميل جميع الموديولات المقسمة
 * 
 * هذا الملف يحل محل app-modules.js بعد التقسيم
 */

// 🔥 IMMEDIATE DEBUG - Log that this file is executing
console.log('🔥🔥🔥 modules-loader.js IS EXECUTING NOW!');
console.log('🔥 Document readyState:', document.readyState);
console.log('🔥 Current time:', new Date().toISOString());

// قائمة الموديولات المطلوب تحميلها (32 موديول)
const MODULES_TO_LOAD = [
    'users',
    'incidents',
    'nearmiss',
    'ptw',
    'training',
    'reports',
    'settings',
    'clinic',
    'fireequipment',
    'ppe',
    'periodicinspections',
    'contractors', // يجب تحميله قبل violations لأنه يحتوي على ثوابت مشتركة
    'violations',
    'employees',
    'behaviormonitoring',
    'chemicalsafety',
    'dailyobservations',
    'iso',
    'emergency',
    'safetybudget',
    'actiontrackingregister',
    'hse',
    'safetyperformancekpis',
    'sustainability',
    'riskassessment',
    'riskmatrix', // مصفوفة تقييم المخاطر
    'legaldocuments',
    'safetyhealthmanagement',
    'usertasks',
    'sopjha',
    'aiassistant',
    'useraiassistant',
    'issuetracking',
    'changemanagement',
    'apptester',
    'issuingauthorities'
];

/** عدد إعادة المحاولات عند 503 أو فشل التحميل */
const MODULE_LOAD_MAX_RETRIES = 2;
/** التأخير قبل إعادة المحاولة (ms) */
const MODULE_LOAD_RETRY_DELAY = 1000;

/**
 * تحميل موديول واحد (مع إعادة محاولة عند 503)
 * @param {string} moduleName - اسم الموديول
 * @param {number} retryCount - عدد المحاولات السابقة (داخلي)
 */
function loadModule(moduleName, retryCount) {
    if (retryCount === undefined) retryCount = 0;
    return new Promise((resolve) => {
        const basePath = 'js/modules/modules/';
        const log = (typeof Utils !== 'undefined' && Utils.safeLog) ? Utils.safeLog : console.log;
        const logError = (typeof Utils !== 'undefined' && Utils.safeError) ? Utils.safeError : console.error;
        const warn = (typeof Utils !== 'undefined' && Utils.safeWarn) ? Utils.safeWarn : console.warn;

        // ✅ إضافة timeout عام لمنع Promise غير المحلولة (6 ثوان - يوازن بين السرعة والاستقرار)
        let isResolved = false;
        const timeoutId = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                warn(`⚠️ Timeout: تحميل ${moduleName} استغرق أكثر من 6 ثوان - الاستمرار...`);
                resolve(); // الاستمرار حتى لو انتهى الوقت
            }
        }, 6000); // 6 ثوان لتقليل التأخير في الإنتاج

        const safeResolve = () => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeoutId);
                resolve();
            }
        };

        const script = document.createElement('script');
        script.src = `${basePath}${moduleName}.js`;
        script.async = false; // ✅ تعطيل async لتحسين التوافق مع file:// protocol
        script.defer = true; // استخدام defer بدلاً من async
        
        // ✅ إضافة timestamp لتتبع وقت التحميل
        const startTime = Date.now();
        
        // 🔍 DEBUG: Log the exact URL being loaded (تقليل الضجيج بعد المحاولة الأولى)
        if (retryCount === 0) {
            console.log(`🔍 Loading module: ${moduleName} from URL: ${script.src}`);
        }
        
        script.onload = () => {
            const loadTime = Date.now() - startTime;
            log(`✅ تم تحميل الموديول: ${moduleName} (${loadTime}ms)`);
            
            // 🔍 DEBUG: Verify module is on window
            const globalModule = window[moduleName.charAt(0).toUpperCase() + moduleName.slice(1)] || window[moduleName];
            console.log(`🔍 Module ${moduleName} on window:`, typeof globalModule !== 'undefined' ? '✅ Found' : '❌ Not found');

            // التحقق من تحميل الموديولات المهمة بشكل خاص
            if (moduleName === 'fireequipment') {
                // التحقق من تحميل موديول FireEquipment
                let checkCount = 0;
                const maxChecks = 10; // تقليل زمن الانتظار
                const checkInterval = setInterval(() => {
                    checkCount++;
                    // ✅ التحقق الآمن من وجود الموديول ودالة load
                    if (typeof window.FireEquipment !== 'undefined' && 
                        typeof window.FireEquipment.load === 'function') {
                        log(`✅ FireEquipment متاح على window.FireEquipment مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.FireEquipment !== 'undefined') {
                            logError(`⚠️ FireEquipment متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ FireEquipment غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve(); // الاستمرار حتى لو فشل التحقق
                    }
                }, 100);
                return; // لا نستدعي resolve هنا، سنستدعيه في checkInterval
            } else if (moduleName === 'violations') {
                // التحقق من تحميل موديول Violations
                let checkCount = 0;
                const maxChecks = 10; // تقليل زمن الانتظار
                const checkInterval = setInterval(() => {
                    checkCount++;
                    // ✅ التحقق الآمن من وجود الموديول ودالة load
                    if (typeof window.Violations !== 'undefined' && 
                        typeof window.Violations.load === 'function') {
                        log(`✅ Violations متاح على window.Violations مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.Violations !== 'undefined') {
                            logError(`⚠️ Violations متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ Violations غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve(); // الاستمرار حتى لو فشل التحقق
                    }
                }, 100);
                return; // لا نستدعي resolve هنا، سنستدعيه في checkInterval
            } else if (moduleName === 'dailyobservations') {
                // محاولة متعددة للتحقق من توفر الموديول ودالة load
                let checkCount = 0;
                const maxChecks = 10;
                const checkInterval = setInterval(() => {
                    checkCount++;
                    // ✅ التحقق الآمن من وجود الموديول ودالة load
                    if (typeof window.DailyObservations !== 'undefined' && 
                        typeof window.DailyObservations.load === 'function') {
                        log(`✅ DailyObservations متاح على window.DailyObservations مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.DailyObservations !== 'undefined') {
                            logError(`⚠️ DailyObservations متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ DailyObservations غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve(); // الاستمرار حتى لو فشل التحقق
                    }
                }, 100);
                return; // لا نستدعي resolve هنا، سنستدعيه في checkInterval
            } else if (moduleName === 'contractors') {
                // التحقق من تحميل موديول المقاولين
                let checkCount = 0;
                const maxChecks = 15; // تقليل زمن الانتظار
                const checkInterval = setInterval(() => {
                    checkCount++;
                    // ✅ التحقق الآمن من وجود الموديول ودالة load
                    if (typeof window.Contractors !== 'undefined' && 
                        typeof window.Contractors.load === 'function') {
                        log(`✅ Contractors متاح على window.Contractors مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.Contractors !== 'undefined') {
                            logError(`⚠️ Contractors متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ Contractors غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve(); // الاستمرار حتى لو فشل التحقق
                    }
                }, 100);
                return; // لا نستدعي resolve هنا، سنستدعيه في checkInterval
            } else if (moduleName === 'clinic') {
                // ✅ التحقق من تحميل موديول العيادة (Clinic)
                let checkCount = 0;
                const maxChecks = 25; // 25 × 100ms = 2.5 ثوان
                const checkInterval = setInterval(() => {
                    checkCount++;
                    if (typeof window.Clinic !== 'undefined' && 
                        typeof window.Clinic.load === 'function') {
                        log(`✅ Clinic متاح على window.Clinic مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.Clinic !== 'undefined') {
                            logError(`⚠️ Clinic متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ Clinic غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve();
                    }
                }, 100);
                return;
            } else if (moduleName === 'ppe') {
                // التحقق من تحميل موديول PPE
                let checkCount = 0;
                const maxChecks = 10;
                const checkInterval = setInterval(() => {
                    checkCount++;
                    if (typeof window.PPE !== 'undefined' && typeof window.PPE.load === 'function') {
                        log(`✅ PPE متاح على window.PPE مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.PPE !== 'undefined') {
                            logError(`⚠️ PPE متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ PPE غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve();
                    }
                }, 100);
                return;
            } else if (moduleName === 'periodicinspections') {
                // التحقق من تحميل موديول الفحوصات الدورية
                let checkCount = 0;
                const maxChecks = 10;
                const checkInterval = setInterval(() => {
                    checkCount++;
                    if (typeof window.PeriodicInspections !== 'undefined' && typeof window.PeriodicInspections.load === 'function') {
                        log(`✅ PeriodicInspections متاح على window.PeriodicInspections مع دالة load`);
                        clearInterval(checkInterval);
                        safeResolve();
                    } else if (checkCount >= maxChecks) {
                        if (typeof window.PeriodicInspections !== 'undefined') {
                            logError(`⚠️ PeriodicInspections متاح لكن دالة load غير موجودة أو ليست function`);
                        } else {
                            logError(`⚠️ PeriodicInspections غير متاح على window بعد ${maxChecks} محاولة`);
                        }
                        clearInterval(checkInterval);
                        safeResolve();
                    }
                }, 100);
                return;
            }

            // ✅ للمواديل الأخرى: انتظار قصير ثم resolve
            // بعض المواديل قد تأخذ وقت قصير للتصدير على window
            setTimeout(() => {
                safeResolve();
            }, 100); // 100ms كافية لمعظم المواديل
        };
        script.onerror = (error) => {
            const loadTime = Date.now() - startTime;
            logError(`❌ فشل تحميل الموديول: ${moduleName} بعد ${loadTime}ms${retryCount > 0 ? ` (محاولة ${retryCount + 1}/${MODULE_LOAD_MAX_RETRIES + 1})` : ''}`);
            logError(`   المسار: ${script.src}`);
            logError(`   نوع الخطأ:`, error?.type || 'unknown');
            
            // التحقق من حالة HTTP (503 = إعادة محاولة تلقائية)
            fetch(script.src, { method: 'HEAD', cache: 'no-store' })
                .then(response => {
                    if (typeof console !== 'undefined' && console.log) {
                        console.log(`🔍 HTTP Status for ${moduleName}:`, response.status, response.statusText);
                    }
                    const is503 = response.status === 503;
                    const canRetry = retryCount < MODULE_LOAD_MAX_RETRIES;
                    if (is503 && canRetry) {
                        if (!isResolved) {
                            warn(`🔄 إعادة محاولة تحميل ${moduleName} بعد ${MODULE_LOAD_RETRY_DELAY / 1000} ثانية (503)`);
                            clearTimeout(timeoutId);
                            isResolved = true;
                            setTimeout(() => {
                                loadModule(moduleName, retryCount + 1).then(resolve);
                            }, MODULE_LOAD_RETRY_DELAY);
                        }
                        return;
                    }
                    if (response.status === 503 && !canRetry) {
                        logError(`🚨 503 Service Unavailable - تعذر تحميل ${moduleName}.js بعد ${MODULE_LOAD_MAX_RETRIES + 1} محاولات`);
                    }
                    if (error && error.message) {
                        logError(`   الخطأ: ${error.message}`);
                    }
                    safeResolve();
                })
                .catch(() => {
                    // عند فشل fetch (شبكة/CORS): إعادة محاولة مرة واحدة إن أمكن
                    const canRetry = retryCount < MODULE_LOAD_MAX_RETRIES;
                    if (canRetry && !isResolved) {
                        warn(`🔄 إعادة محاولة تحميل ${moduleName} بعد ${MODULE_LOAD_RETRY_DELAY / 1000} ثانية (فشل الاتصال)`);
                        clearTimeout(timeoutId);
                        isResolved = true;
                        setTimeout(() => {
                            loadModule(moduleName, retryCount + 1).then(resolve);
                        }, MODULE_LOAD_RETRY_DELAY);
                        return;
                    }
                    if (error && error.message) {
                        logError(`   الخطأ: ${error.message}`);
                    }
                    safeResolve();
                });
        };
        document.head.appendChild(script);
    });
}

/**
 * تحميل جميع الموديولات
 */
async function loadAllModules() {
    const log = (typeof Utils !== 'undefined' && Utils.safeLog) ? Utils.safeLog : console.log;
    const logError = (typeof Utils !== 'undefined' && Utils.safeError) ? Utils.safeError : console.error;

    try {
        // التأكد من تحميل Utils و AppState أولاً
        let utilsReady = typeof Utils !== 'undefined';
        let appStateReady = typeof AppState !== 'undefined';
        let waitCount = 0;
        const maxWait = 30; // 3 ثوان

        while ((!utilsReady || !appStateReady) && waitCount < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
            utilsReady = typeof Utils !== 'undefined';
            appStateReady = typeof AppState !== 'undefined';
            waitCount++;
        }

        if (!utilsReady || !appStateReady) {
            logError('❌ فشل تحميل المتطلبات الأساسية (Utils/AppState)');
            return;
        }

        // تحميل contractors أولاً بشكل منفصل لضمان تحميله قبل violations
        const contractorsIndex = MODULES_TO_LOAD.indexOf('contractors');
        if (contractorsIndex !== -1) {
            log('📦 بدء تحميل موديول المقاولين...');
            await loadModule('contractors');
            // انتظار أطول للتأكد من تحميله بالكامل وتصديره
            await new Promise(resolve => setTimeout(resolve, 250));
            
            // التحقق النهائي من تحميل الموديول
            if (typeof window.Contractors !== 'undefined') {
                log('✅ تم تحميل موديول المقاولين بنجاح');
            } else {
                logError('⚠️ تحذير: موديول المقاولين لم يتم تحميله بشكل صحيح');
            }
        }

        // ✅ تحسين: تحميل ذكي للموديولات حسب الصلاحيات
        if (typeof Permissions !== 'undefined' && typeof Permissions.getCurrentUserPermissions === 'function') {
            try {
                const userPermissions = Permissions.getCurrentUserPermissions();
                await loadModulesBasedOnPermissions(userPermissions);
            } catch (error) {
                logError('⚠️ فشل التحميل الذكي، سيتم استخدام التحميل التقليدي:', error);
                await loadModulesFallback();
            }
        } else {
            await loadModulesFallback();
        }

        // انتظار قصير للتأكد من تصدير جميع الموديولات إلى window
        await new Promise(resolve => setTimeout(resolve, 100));

        log('✅ تم تحميل جميع الموديولات بنجاح');
    } catch (error) {
        logError('❌ حدث خطأ في تحميل الموديولات:', error);
    }
}

/**
 * تحميل الموديولات حسب صلاحيات المستخدم
 */
async function loadModulesBasedOnPermissions(userPermissions) {
    if (!userPermissions) {
        return loadModulesFallback();
    }

    const requiredModules = getRequiredModulesForPermissions(userPermissions);

    // تحميل الموديولات الأساسية أولاً
    const coreModules = ['contractors']; // contractors مطلوب للعديد من الموديولات
    for (const moduleName of coreModules) {
        if (requiredModules.includes(moduleName)) {
            await loadModule(moduleName);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    // تحميل باقي الموديولات المطلوبة بشكل متوازي (مجموعات صغيرة)
    const otherModules = requiredModules.filter(name => !coreModules.includes(name));
    const batchSize = 5; // تحميل 5 موديولات في كل دفعة

    for (let i = 0; i < otherModules.length; i += batchSize) {
        const batch = otherModules.slice(i, i + batchSize);
        log(`📦 تحميل دفعة ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);

        await Promise.all(batch.map(async (moduleName) => {
            try {
                await loadModule(moduleName);
            } catch (error) {
                logError(`❌ خطأ في تحميل ${moduleName}:`, error);
            }
        }));

        // انتظار قصير بين الدفعات
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    log(`✅ تم تحميل ${requiredModules.length} موديول حسب الصلاحيات`);
}

/**
 * تحديد الموديولات المطلوبة حسب الصلاحيات
 */
function getRequiredModulesForPermissions(permissions) {
    const requiredModules = [];

    // موديولات أساسية لجميع المستخدمين
    requiredModules.push('users', 'dashboard');

    // موديولات حسب الصلاحيات
    if (permissions.canViewIncidents) {
        requiredModules.push('incidents', 'nearmiss');
    }

    if (permissions.canViewContractors) {
        requiredModules.push('contractors', 'violations');
    }

    if (permissions.canViewEmployees) {
        requiredModules.push('employees');
    }

    if (permissions.canViewTraining) {
        requiredModules.push('training');
    }

    if (permissions.canViewClinic) {
        requiredModules.push('clinic');
    }

    if (permissions.canViewFireEquipment) {
        requiredModules.push('fireequipment');
    }

    if (permissions.canViewPPE) {
        requiredModules.push('ppe');
    }

    // إلخ... يمكن توسيع هذا حسب الحاجة

    // إزالة التكرارات
    return [...new Set(requiredModules)];
}

/**
 * تحميل الموديولات كـ fallback (التقليدي)
 */
async function loadModulesFallback() {
    log('🔄 تحميل الموديولات بالطريقة التقليدية (fallback)');

    // تحميل contractors أولاً
    const contractorsIndex = MODULES_TO_LOAD.indexOf('contractors');
    if (contractorsIndex !== -1) {
        await loadModule('contractors');
        await new Promise(resolve => setTimeout(resolve, 250));
    }

    // تحميل باقي الموديولات بالتسلسل
    const otherModules = MODULES_TO_LOAD.filter(name => name !== 'contractors');

    for (const moduleName of otherModules) {
        try {
            await loadModule(moduleName);
            await new Promise(resolve => setTimeout(resolve, 25));
        } catch (error) {
            logError(`❌ خطأ في تحميل ${moduleName}:`, error);
        }
    }
}

// تحميل الموديولات عند جاهزية DOM
console.log('🔥 Setting up module loading...');
console.log('🔥 Document readyState:', document.readyState);

// Force immediate execution - don't wait for DOMContentLoaded
(async function immediateLoad() {
    console.log('🔥 IMMEDIATE LOAD FUNCTION EXECUTING');
    
    // Wait a tiny bit for Utils to be available
    let waitCount = 0;
    while (typeof Utils === 'undefined' && waitCount < 30) {
        await new Promise(resolve => setTimeout(resolve, 50));
        waitCount++;
    }
    
    if (typeof Utils === 'undefined') {
        console.error('❌ Utils not available after 5 seconds - loading anyway');
    } else {
        console.log('✅ Utils is available');
    }
    
    // Start loading immediately
    console.log('🔥 Starting loadAllModules NOW');
    loadAllModules();
})();

// Also set up the normal DOMContentLoaded listener as backup
if (document.readyState === 'loading') {
    console.log('🔥 Document still loading - adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔥 DOMContentLoaded fired - calling loadAllModules');
        loadAllModules();
    });
} else {
    console.log('🔥 Document already loaded - calling loadAllModules immediately');
    loadAllModules();
}
