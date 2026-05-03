/**
 * دالة مساعدة مركزية لمعالجة أخطاء timeout والاتصال
 * يمكن استخدامها في جميع الموديولات لضمان معالجة موحدة
 */

/**
 * فحص ما إذا كان الخطأ هو خطأ timeout أو خطأ اتصال
 * @param {Error|string} error - كائن الخطأ أو رسالة الخطأ
 * @returns {boolean}
 */
function isTimeoutOrConnectionError(error) {
    if (!error) return false;

    const errorMsg = (error?.message || error?.toString() || String(error)).toLowerCase();

    return errorMsg.includes('انتهت مهلة الاتصال') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('failed to fetch') ||
        errorMsg.includes('networkerror') ||
        errorMsg.includes('network error') ||
        errorMsg.includes('لا يوجد اتصال') ||
        errorMsg.includes('no connection') ||
        errorMsg.includes('circuit breaker');
}

/**
 * الحصول على رسالة خطأ موحدة للمستخدم
 * @param {Error|string} error - كائن الخطأ
 * @param {string} context - السياق (اسم العملية)
 * @returns {object} - كائن يحتوي على الرسالة والنوع
 */
function getStandardizedErrorMessage(error, context = '') {
    if (!error) {
        return {
            type: 'unknown',
            message: 'خطأ غير معروف',
            userMessage: 'حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.'
        };
    }

    const errorMsg = (error?.message || error?.toString() || String(error)).toLowerCase();

    // فحص أخطاء timeout والاتصال
    if (isTimeoutOrConnectionError(error)) {
        return {
            type: 'timeout',
            message: error?.message || String(error),
            userMessage: `انتهت مهلة الاتصال بالخادم${context ? ' أثناء ' + context : ''}\n\nتحقق من:\n1. اتصال الإنترنت\n2. أن Google Apps Script منشور ومفعّل\n3. عدم وجود قيود على الشبكة\n\nسيتم استخدام البيانات المحلية.`,
            showRetry: true
        };
    }

    // فحص أخطاء Google Apps Script غير المفعل
    if (errorMsg.includes('google apps script غير مفعل') ||
        errorMsg.includes('غير مفعل') ||
        errorMsg.includes('not enabled')) {
        return {
            type: 'disabled',
            message: error?.message || String(error),
            userMessage: 'Google Apps Script غير مفعل.\nسيتم استخدام البيانات المحلية.',
            showRetry: false
        };
    }

    // فحص أخطاء التكوين
    if (errorMsg.includes('scripturl') ||
        errorMsg.includes('غير مُكوَّن') ||
        errorMsg.includes('not configured')) {
        return {
            type: 'config',
            message: error?.message || String(error),
            userMessage: 'إعدادات Google Apps Script غير مكتملة.\nيرجى التحقق من الإعدادات.',
            showRetry: false
        };
    }

    // أخطاء عامة
    return {
        type: 'general',
        message: error?.message || String(error),
        userMessage: `حدث خطأ${context ? ' في ' + context : ''}: ${error?.message || 'خطأ غير معروف'}`,
        showRetry: true
    };
}

/**
 * معالجة أخطاء تحميل البيانات في دالة load للموديول
 * @param {Error} error - كائن الخطأ
 * @param {string} moduleName - اسم الموديول
 * @param {Function} fallbackFn - دالة احتياطية (اختياري)
 * @returns {boolean} - true إذا تم تجاهل الخطأ، false إذا كان يجب إظهاره
 */
function handleModuleLoadError(error, moduleName = 'الموديول', fallbackFn = null) {
    if (!error) return false;

    const errorInfo = getStandardizedErrorMessage(error, `تحميل ${moduleName}`);

    // أخطاء timeout والاتصال - نتجاهلها ونستخدم البيانات المحلية
    if (errorInfo.type === 'timeout' || errorInfo.type === 'disabled' || errorInfo.type === 'config') {
        Utils.safeWarn(`⚠️ ${errorInfo.userMessage}`);

        // تنفيذ الدالة الاحتياطية إذا كانت موجودة
        if (typeof fallbackFn === 'function') {
            try {
                fallbackFn();
            } catch (fallbackError) {
                Utils.safeError('خطأ في تنفيذ الدالة الاحتياطية:', fallbackError);
            }
        }

        // تم التعامل مع الخطأ - لا حاجة لإظهاره للمستخدم
        return true;
    }

    // أخطاء أخرى - يجب تسجيلها
    Utils.safeError(`❌ خطأ في تحميل ${moduleName}:`, errorInfo.message);
    return false;
}

/**
 * إنشاء Promise مع timeout
 * @param {Promise} promise - الـ Promise الأصلي
 * @param {number} timeout - المهلة بالميلي ثانية (افتراضي: 10000)
 * @param {string} operation - اسم العملية للرسالة
 * @returns {Promise}
 */
function promiseWithTimeout(promise, timeout = 10000, operation = 'العملية') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`انتهت مهلة الاتصال بالخادم أثناء ${operation}\n\nتحقق من:\n1. اتصال الإنترنت\n2. أن Google Apps Script منشور ومفعّل\n3. عدم وجود قيود على الشبكة`));
        }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
}

/**
 * wrapper آمن لطلبات GoogleIntegration
 * @param {object} requestData - بيانات الطلب
 * @param {number} timeout - المهلة بالميلي ثانية
 * @param {string} operation - اسم العملية
 * @returns {Promise}
 */
async function safeGoogleRequest(requestData, timeout = 10000, operation = 'الطلب') {
    try {
        // التحقق من تكوين Google Apps Script
        if (typeof AppState === 'undefined' || !AppState.googleConfig?.appsScript?.enabled) {
            throw new Error('Google Apps Script غير مفعل');
        }

        if (!AppState.googleConfig.appsScript.scriptUrl ||
            AppState.googleConfig.appsScript.scriptUrl.trim() === '') {
            throw new Error('Google Apps Script غير مُكوَّن بشكل صحيح');
        }

        // التحقق من توفر GoogleIntegration
        if (typeof GoogleIntegration === 'undefined' ||
            typeof GoogleIntegration.sendRequest !== 'function') {
            throw new Error('GoogleIntegration غير متاح');
        }

        // إرسال الطلب مع timeout
        return await promiseWithTimeout(
            GoogleIntegration.sendRequest(requestData),
            timeout,
            operation
        );
    } catch (error) {
        // معالجة الأخطاء بشكل موحد
        const errorInfo = getStandardizedErrorMessage(error, operation);

        // تجاهل أخطاء timeout والتكوين (الأخطاء المتوقعة)
        if (errorInfo.type === 'timeout' ||
            errorInfo.type === 'disabled' ||
            errorInfo.type === 'config') {
            Utils.safeLog(`ℹ️ ${errorInfo.userMessage}`);
            return { success: false, data: [], error: errorInfo };
        }

        // إعادة رمي الأخطاء الأخرى
        throw error;
    }
}

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.ConnectionErrorHandler = {
        isTimeoutOrConnectionError,
        getStandardizedErrorMessage,
        handleModuleLoadError,
        promiseWithTimeout,
        safeGoogleRequest
    };
}
