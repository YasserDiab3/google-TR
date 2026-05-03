/**
 * Connection Monitor Service
 * نظام مراقبة الاتصال بين الواجهة الأمامية والخلفية
 * يرسل إشعارات لمدير النظام عند فقدان الاتصال
 */

const ConnectionMonitor = {
    // إعدادات النظام
    config: {
        // فحص الاتصال كل 2 دقيقة (120000 ms)
        checkInterval: 120000,
        
        // عدد المحاولات المتتالية للفشل قبل إرسال إشعار
        failureThreshold: 2,
        
        // تفعيل المراقبة
        enabled: true,
        
        // تفعيل الإشعارات
        enableNotifications: true
    },

    // حالة النظام
    state: {
        isMonitoring: false,
        checkIntervalId: null,
        consecutiveFailures: 0,
        lastCheckTime: null,
        lastSuccessTime: null,
        lastFailureTime: null,
        isConnected: true,
        adminNotified: false
    },

    /**
     * بدء مراقبة الاتصال
     */
    start() {
        if (this.state.isMonitoring) {
            Utils.safeLog('ℹ️ نظام مراقبة الاتصال يعمل بالفعل');
            return;
        }

        if (!this.config.enabled) {
            Utils.safeLog('ℹ️ نظام مراقبة الاتصال معطل');
            return;
        }

        // التحقق من تفعيل Google Apps Script
        if (!AppState.googleConfig || !AppState.googleConfig.appsScript || !AppState.googleConfig.appsScript.enabled) {
            Utils.safeLog('ℹ️ Google Apps Script غير مفعل - تخطي مراقبة الاتصال');
            return;
        }

        this.state.isMonitoring = true;
        this.state.consecutiveFailures = 0;
        this.state.adminNotified = false;

        // فحص فوري عند البدء
        this.checkConnection();

        // فحص دوري
        this.state.checkIntervalId = setInterval(() => {
            this.checkConnection();
        }, this.config.checkInterval);

        Utils.safeLog('✅ تم بدء نظام مراقبة الاتصال');
    },

    /**
     * إيقاف مراقبة الاتصال
     */
    stop() {
        if (this.state.checkIntervalId) {
            clearInterval(this.state.checkIntervalId);
            this.state.checkIntervalId = null;
        }
        this.state.isMonitoring = false;
        Utils.safeLog('⏹️ تم إيقاف نظام مراقبة الاتصال');
    },

    /**
     * فحص الاتصال
     */
    async checkConnection() {
        if (!this.config.enabled) {
            return;
        }

        // التحقق من تفعيل Google Apps Script
        if (!AppState.googleConfig || !AppState.googleConfig.appsScript || !AppState.googleConfig.appsScript.enabled || !AppState.googleConfig.appsScript.scriptUrl) {
            return;
        }

        this.state.lastCheckTime = new Date().toISOString();

        try {
            // محاولة قراءة بيانات بسيطة من Google Sheets
            // استخدام timeout أطول (60 ثانية) لتجنب أخطاء timeout غير ضرورية
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.readFromSheets) {
                const result = await Utils.promiseWithTimeout(
                    GoogleIntegration.readFromSheets('Users'),
                    60000, // 60 ثانية بدلاً من 15 ثانية
                    'انتهت مهلة الاتصال'
                );

                // نجح الاتصال
                this.state.consecutiveFailures = 0;
                this.state.lastSuccessTime = new Date().toISOString();
                this.state.isConnected = true;

                // إذا كان الاتصال قد انقطع سابقاً وأعيد الآن، نرسل إشعار نجاح
                if (this.state.adminNotified && this.state.isConnected) {
                    this.notifyAdminConnectionRestored();
                    this.state.adminNotified = false;
                }

                Utils.safeLog('✅ فحص الاتصال: نجح');
            } else {
                throw new Error('GoogleIntegration غير متاح');
            }
        } catch (error) {
            // فشل الاتصال
            const errorMsg = error?.message || error?.toString() || 'خطأ غير معروف';
            
            // تجاهل أخطاء timeout المؤقتة - قد تكون بسبب بطء الاتصال المؤقت
            // نتعامل معها فقط إذا استمرت لعدة محاولات متتالية
            const isTimeoutError = errorMsg.includes('انتهت مهلة الاتصال') || 
                                   errorMsg.includes('timeout') || 
                                   errorMsg.includes('Timeout') ||
                                   errorMsg.includes('فقدان الاتصال مع Google Sheets');
            
            // إذا كان خطأ timeout، نزيد العتبة قليلاً قبل الإشعار
            if (isTimeoutError && this.state.consecutiveFailures < this.config.failureThreshold) {
                // نزيد العتبة لخطأ timeout إلى 3 محاولات بدلاً من 2
                const timeoutThreshold = Math.max(this.config.failureThreshold, 3);
                if (this.state.consecutiveFailures + 1 < timeoutThreshold) {
                    Utils.safeLog(`⏱️ انتهت مهلة فحص الاتصال (محاولة ${this.state.consecutiveFailures + 1}/${timeoutThreshold}) - سيتم إعادة المحاولة`);
                    this.state.consecutiveFailures++;
                    this.state.lastFailureTime = new Date().toISOString();
                    return; // لا نعتبره فشلاً كاملاً بعد
                }
            }
            
            this.state.consecutiveFailures++;
            this.state.lastFailureTime = new Date().toISOString();
            this.state.isConnected = false;

            // تسجيل تحذير فقط إذا لم يكن خطأ timeout مؤقت
            if (!isTimeoutError || this.state.consecutiveFailures >= this.config.failureThreshold) {
                Utils.safeWarn(`⚠️ فشل فحص الاتصال (${this.state.consecutiveFailures}/${this.config.failureThreshold}):`, errorMsg);
            }

            // إرسال إشعار لمدير النظام إذا تجاوزنا العتبة
            if (this.state.consecutiveFailures >= this.config.failureThreshold && !this.state.adminNotified) {
                this.notifyAdminConnectionLost(error);
                this.state.adminNotified = true;
            }
        }
    },

    /**
     * إرسال إشعار لمدير النظام عند فقدان الاتصال
     */
    notifyAdminConnectionLost(error) {
        if (!this.config.enableNotifications) {
            return;
        }

        // البحث عن مدير النظام
        const users = AppState.appData.users || [];
        const adminUsers = users.filter(u => 
            u && u.active !== false && (
                u.role === 'admin' || 
                (u.permissions && (u.permissions.isAdmin === true || u.permissions.admin === true))
            )
        );

        // إذا كان المستخدم الحالي هو مدير النظام، نعرض إشعار مباشر
        if (AppState.currentUser && (
            AppState.currentUser.role === 'admin' ||
            (AppState.currentUser.permissions && (AppState.currentUser.permissions.isAdmin === true || AppState.currentUser.permissions.admin === true))
        )) {
            const errorMessage = error?.message || 'خطأ غير معروف';
            const isTimeoutError = errorMessage.includes('انتهت مهلة الاتصال') || 
                                   errorMessage.includes('timeout') || 
                                   errorMessage.includes('فقدان الاتصال مع Google Sheets');
            
            // رسالة مبسطة لخطأ timeout
            let message;
            if (isTimeoutError) {
                message = `⚠️ فقدان الاتصال مع Google Sheets!\n\n` +
                         `الخطأ: انتهت مهلة الاتصال\n` +
                         `الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
                         `يرجى التحقق من:\n` +
                         `1. إعدادات Google Apps Script\n` +
                         `2. معرف Google Sheets\n` +
                         `3. الاتصال بالإنترنت\n\n` +
                         `💡 سيتم استخدام البيانات المحلية حتى يتم استعادة الاتصال.`;
            } else {
                message = `⚠️ فقدان الاتصال مع Google Sheets!\n\n` +
                         `الخطأ: ${errorMessage}\n` +
                         `الوقت: ${new Date().toLocaleString('ar-SA')}\n\n` +
                         `يرجى التحقق من:\n` +
                         `1. إعدادات Google Apps Script\n` +
                         `2. معرف Google Sheets\n` +
                         `3. الاتصال بالإنترنت`;
            }

            if (typeof Notification !== 'undefined') {
                Notification.error(message, {
                    duration: isTimeoutError ? 10000 : 0, // timeout errors تختفي بعد 10 ثوانٍ
                    persistent: !isTimeoutError // فقط الأخطاء غير timeout تكون دائمة
                });
            }

            // تسجيل في سجل النشاط
            if (typeof UserActivityLog !== 'undefined') {
                UserActivityLog.log('connection_lost', 'System', null, {
                    description: `فقدان الاتصال مع Google Sheets: ${errorMessage}`,
                    error: errorMessage,
                    timestamp: new Date().toISOString()
                }).catch(() => {});
            }
        }

        // إرسال إشعار لجميع المديرين الآخرين (إذا كان هناك نظام إشعارات)
        if (adminUsers.length > 0 && typeof Notification !== 'undefined') {
            adminUsers.forEach(admin => {
                if (admin.email && admin.email !== AppState.currentUser?.email) {
                    // يمكن إضافة نظام إشعارات للمديرين الآخرين هنا
                    Utils.safeLog(`📧 يجب إرسال إشعار لمدير النظام: ${admin.email}`);
                }
            });
        }

        Utils.safeError('❌ فقدان الاتصال مع Google Sheets - تم إشعار مدير النظام');
    },

    /**
     * إرسال إشعار لمدير النظام عند استعادة الاتصال
     */
    notifyAdminConnectionRestored() {
        if (!this.config.enableNotifications) {
            return;
        }

        // إذا كان المستخدم الحالي هو مدير النظام، نعرض إشعار مباشر
        if (AppState.currentUser && (
            AppState.currentUser.role === 'admin' ||
            (AppState.currentUser.permissions && (AppState.currentUser.permissions.isAdmin === true || AppState.currentUser.permissions.admin === true))
        )) {
            const message = `✅ تم استعادة الاتصال مع Google Sheets بنجاح!\n\n` +
                          `الوقت: ${new Date().toLocaleString('ar-SA')}`;

            if (typeof Notification !== 'undefined') {
                Notification.success(message, {
                    duration: 5000
                });
            }

            // تسجيل في سجل النشاط
            if (typeof UserActivityLog !== 'undefined') {
                UserActivityLog.log('connection_restored', 'System', null, {
                    description: 'تم استعادة الاتصال مع Google Sheets',
                    timestamp: new Date().toISOString()
                }).catch(() => {});
            }
        }

        Utils.safeLog('✅ تم استعادة الاتصال مع Google Sheets');
    },

    /**
     * الحصول على حالة الاتصال
     */
    getStatus() {
        return {
            isMonitoring: this.state.isMonitoring,
            isConnected: this.state.isConnected,
            consecutiveFailures: this.state.consecutiveFailures,
            lastCheckTime: this.state.lastCheckTime,
            lastSuccessTime: this.state.lastSuccessTime,
            lastFailureTime: this.state.lastFailureTime,
            adminNotified: this.state.adminNotified
        };
    },

    /**
     * إعادة تعيين حالة المراقبة
     */
    reset() {
        this.state.consecutiveFailures = 0;
        this.state.adminNotified = false;
        this.state.isConnected = true;
        Utils.safeLog('🔄 تم إعادة تعيين حالة مراقبة الاتصال');
    }
};

// تصدير للاستخدام العام
if (typeof window !== 'undefined') {
    window.ConnectionMonitor = ConnectionMonitor;
}

