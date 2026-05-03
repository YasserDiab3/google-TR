/**
 * Auth Module - موديول المصادقة
 * تم استخراجه من app-modules.js لتحسين الأداء
 */

// تعريف Auth كمتغير عام (global) ليكون متاحاً لجميع الملفات
window.Auth = {
    // ملاحظة: المستخدمون يجب أن يكونوا من قاعدة البيانات فقط
    // لا يتم تخزين كلمات المرور في الكود لأسباب أمنية
    validUsers: {
        // تم إزالة كلمات المرور من الكود لأسباب أمنية
        // المستخدمون الآن يحملون من قاعدة البيانات فقط
    },

    // ===== Bootstrap Admin (First-time setup only) =====
    // يسمح بالدخول لأول مرة فقط لتجهيز المزامنة/إضافة المستخدمين، ثم يتم تعطيله تلقائياً بعد نجاح مزامنة Users.
    // ⚠️ لا يتم تخزين كلمة المرور نصياً هنا. يتم استخدام SHA-256 hash فقط.
    bootstrap: {
        email: 'admin@hse.local',
        // SHA-256("admin123") - لا يوجد تخزين لكلمة المرور النصية داخل الكود
        passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        disabledKey: 'hse_bootstrap_disabled',
        disabledAtKey: 'hse_bootstrap_disabled_at'
    },

    isBootstrapEmail(email) {
        try {
            return String(email || '').toLowerCase().trim() === this.bootstrap.email;
        } catch (e) {
            return false;
        }
    },

    isBootstrapDisabled() {
        try {
            return localStorage.getItem(this.bootstrap.disabledKey) === 'true';
        } catch (e) {
            return false;
        }
    },

    disableBootstrap(reason = '') {
        try {
            localStorage.setItem(this.bootstrap.disabledKey, 'true');
            localStorage.setItem(this.bootstrap.disabledAtKey, new Date().toISOString());
            if (reason) {
                localStorage.setItem('hse_bootstrap_disabled_reason', String(reason).slice(0, 200));
            }
        } catch (e) { /* ignore */ }
    },

    /**
     * رسالة خطأ تسجيل الدخول: إن كان الخادم غير متاح (503 / بدون اتصال) نعرض رسالة اتصال، وإلا رسالة بيانات خاطئة.
     */
    _getLoginErrorMessage() {
        try {
            if (typeof AppState !== 'undefined' && AppState.runningWithoutBackend === true) {
                return 'تعذر الاتصال بالخادم (الخادم غير متاح أو خطأ 503). يرجى التحقق من الاتصال بالإنترنت ونشر التطبيق، ثم المحاولة لاحقاً.';
            }
        } catch (e) { /* ignore */ }
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    },

    /**
     * يتم استدعاؤها بعد نجاح مزامنة Users.
     * إذا تم جلب مستخدمين حقيقيين (غير @hse.local)، نعطّل حساب الـ bootstrap نهائياً.
     */
    handleUsersSyncSuccess() {
        try {
            if (this.isBootstrapDisabled()) return false;
            const users = AppState?.appData?.users;
            if (!Array.isArray(users) || users.length === 0) return false;

            const nonLegacyUsers = users.filter(u => {
                const em = String(u?.email || '').toLowerCase().trim();
                return em && !em.endsWith('@hse.local');
            });
            if (nonLegacyUsers.length === 0) return false;

            // تعطيل نهائي
            this.disableBootstrap('Users sync completed with real users');

            // إذا كان المستخدم الحالي هو bootstrap → تسجيل خروج إجباري
            if (AppState?.currentUser?.isBootstrap === true) {
                try {
                    if (typeof Notification !== 'undefined' && Notification.success) {
                        Notification.success('✅ تم تعطيل حساب مدير النظام الافتراضي بعد نجاح المزامنة. يرجى تسجيل الدخول بحسابك من قاعدة البيانات.');
                    }
                } catch (e) { /* ignore */ }

                try {
                    this.logout();
                } catch (e) { /* ignore */ }

                try {
                    if (typeof UI !== 'undefined' && typeof UI.showLoginScreen === 'function') {
                        UI.showLoginScreen();
                    }
                } catch (e) { /* ignore */ }
            }

            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * تسجيل الدخول
     */
    async login(email, password, remember = false) {
        // التحقق من وجود DataManager قبل البدء
        if (typeof window.DataManager === 'undefined') {
            Utils.safeError('❌ خطأ فادح: DataManager غير محمل');
            const errorMessage = 'نظام إدارة البيانات غير جاهز. يرجى تحديث الصفحة والمحاولة مرة أخرى.';
            if (typeof window.Notification !== 'undefined') {
                window.Notification.error(errorMessage);
            }
            return { success: false, message: errorMessage };
        }
        
        // إزالة تسجيل المعلومات الحساسة في الإنتاج
        const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
        if (!isProduction) {
            Utils.safeLog(' بدء تسجيل الدخول:', { email, passwordLength: password?.length, remember });
        }

        if (!email || !password) {
            if (!isProduction) {
                Utils.safeWarn('⚠️ بيانات ناقصة:', { email: !!email, password: !!password });
            }
            const errorMessage = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
            Notification.error(errorMessage);
            return { success: false, message: errorMessage };
        }

        email = email.trim().toLowerCase();

        // التحقق من Rate Limiting
        try {
            await Utils.RateLimiter.checkLockout(email);
        } catch (error) {
            Notification.error(error.message);
            return { success: false, message: error.message };
        }

        if (!isProduction) {
            Utils.safeLog('✅ البريد بعد التنظيف:', email);
        }

        if (!Utils.isValidEmail(email)) {
            Utils.safeWarn('⚠️ بريد إلكتروني غير صحيح:', email);
            const errorMessage = 'يرجى إدخال بريد إلكتروني صحيح';
            Notification.error(errorMessage);
            return { success: false, message: errorMessage };
        }

        // استخدام البيانات المحلية أولاً لتسريع تسجيل الدخول
        // ⚠️ مهم: في أول تشغيل (users=0) يجب أن ننتظر مزامنة Users قبل محاولة التحقق من الحساب
        let localUsersCount = Array.isArray(AppState.appData.users) ? AppState.appData.users.length : 0;
        const canSyncUsers = !!(typeof Utils !== 'undefined' && typeof Utils.hasCloudBackendSync === 'function' && Utils.hasCloudBackendSync() &&
            typeof GoogleIntegration !== 'undefined' &&
            typeof GoogleIntegration.syncUsers === 'function');

        if (localUsersCount > 0) {
            Utils.safeLog(`📊 استخدام ${localUsersCount} مستخدم محلي - تسجيل دخول سريع`);
        } else if (canSyncUsers) {
            Utils.safeLog('🔄 لا توجد بيانات محلية - مزامنة Users من Google Sheets قبل تسجيل الدخول...');
            try {
                const timeoutMs = 1200; // مهلة قصيرة جداً لتسجيل دخول أسرع
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), timeoutMs));
                const syncOk = await Promise.race([GoogleIntegration.syncUsers(true), timeoutPromise]);
                if (syncOk) {
                    Utils.safeLog('✅ تم تحديث قائمة المستخدمين من Google Sheets');
                } else {
                    Utils.safeWarn('⚠️ تعذر مزامنة Users في الوقت المحدد - سيتم المتابعة بالبيانات المحلية');
                    // ✅ إصلاح: محاولة تحميل البيانات المحلية إذا فشلت المزامنة
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.load) {
                        try {
                            await Promise.race([
                                window.DataManager.load(),
                                new Promise(resolve => setTimeout(resolve, 500))
                            ]);
                            localUsersCount = Array.isArray(AppState.appData.users) ? AppState.appData.users.length : 0;
                            if (localUsersCount > 0) {
                                Utils.safeLog(`✅ تم تحميل ${localUsersCount} مستخدم من البيانات المحلية`);
                            }
                        } catch (loadError) {
                            Utils.safeWarn('⚠️ فشل تحميل البيانات المحلية:', loadError);
                        }
                    }
                }
            } catch (error) {
                const errorMsg = error?.message || '';
                const errorStr = errorMsg.toLowerCase();
                const isNormalError = errorMsg.includes('معرف Google Sheets غير محدد') ||
                    errorMsg.includes('غير متاح') ||
                    errorMsg.includes('not available') ||
                    errorStr.includes('google apps script غير مفعل');
                
                if (!isNormalError) {
                    Utils.safeWarn('⚠️ فشل مزامنة Users من Google Sheets:', error);
                    // ✅ إصلاح: محاولة تحميل البيانات المحلية عند الفشل
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.load) {
                        try {
                            await Promise.race([
                                window.DataManager.load(),
                                new Promise(resolve => setTimeout(resolve, 500))
                            ]);
                            localUsersCount = Array.isArray(AppState.appData.users) ? AppState.appData.users.length : 0;
                            if (localUsersCount > 0) {
                                Utils.safeLog(`✅ تم تحميل ${localUsersCount} مستخدم من البيانات المحلية بعد فشل المزامنة`);
                            }
                        } catch (loadError) {
                            Utils.safeWarn('⚠️ فشل تحميل البيانات المحلية:', loadError);
                        }
                    }
                }
            }
            // تحديث العداد بعد محاولة المزامنة
            localUsersCount = Array.isArray(AppState.appData.users) ? AppState.appData.users.length : 0;
        } else {
            Utils.safeLog(`📊 الخادم الخلفي غير جاهز للمزامنة - استخدام ${localUsersCount} مستخدم محلي`);
            // ✅ إصلاح: محاولة تحميل البيانات المحلية إذا كانت متاحة
            if (localUsersCount === 0 && typeof window.DataManager !== 'undefined' && window.DataManager.load) {
                try {
                    await Promise.race([
                        window.DataManager.load(),
                        new Promise(resolve => setTimeout(resolve, 500))
                    ]);
                    localUsersCount = Array.isArray(AppState.appData.users) ? AppState.appData.users.length : 0;
                    if (localUsersCount > 0) {
                        Utils.safeLog(`✅ تم تحميل ${localUsersCount} مستخدم من البيانات المحلية`);
                    }
                } catch (loadError) {
                    Utils.safeWarn('⚠️ فشل تحميل البيانات المحلية:', loadError);
                }
            }
        }

        // ملاحظة: تم إزالة المستخدمين الثابتين لأسباب أمنية
        // جميع المستخدمين يجب أن يكونوا من قاعدة البيانات قط
        let user = null; // تم إزالة validUsers لأسباب أمنية

        // البحث ي قاعدة بيانات المستخدمين من Google Sheets
        let foundUser = null;
        let users = AppState.appData.users || [];

        // ✅ Bootstrap: إذا لم يوجد أي مستخدمين بعد، نسمح بحساب bootstrap (مرة واحدة فقط حتى نجاح المزامنة)
        if (Array.isArray(users) && users.length === 0 && !this.isBootstrapDisabled() && this.isBootstrapEmail(email)) {
            const bootstrapUser = {
                id: 'BOOTSTRAP_ADMIN',
                name: 'مدير النظام (تهيئة أول مرة)',
                email: this.bootstrap.email,
                role: 'admin',
                department: 'إدارة النظام',
                active: true,
                password: '***',
                passwordHash: this.bootstrap.passwordHash,
                permissions: {},
                createdAt: new Date().toISOString()
            };
            users = [bootstrapUser]; // لا نحفظه في AppState.appData.users (جلسة مؤقتة فقط)
            foundUser = bootstrapUser;
        }

        // معالجة البيانات إذا كانت تحتوي على JSON strings (من Google Sheets)
        if (users.length > 0) {
            users = users.map(u => {
                // ✅ لا تُسقط الصلاحيات إلى {} عند فشل JSON.parse
                // بعض البيانات قد تصل بصيغ غير JSON قياسية من Google Sheets
                if (typeof u.permissions === 'string' && u.permissions.trim() !== '') {
                    const normalizedPermissions = (typeof Permissions !== 'undefined' && typeof Permissions.normalizePermissions === 'function')
                        ? Permissions.normalizePermissions(u.permissions)
                        : null;
                    if (normalizedPermissions && typeof normalizedPermissions === 'object' && !Array.isArray(normalizedPermissions)) {
                        u.permissions = normalizedPermissions;
                    } else {
                        Utils.safeWarn('⚠ تعذر تطبيع permissions بصيغة صالحة، سيتم الاحتفاظ بالقيمة الأصلية');
                    }
                }
                // إذا كانت loginHistory عبارة عن string JSON، نحولها إلى مصفوفة
                if (typeof u.loginHistory === 'string' && u.loginHistory.trim() !== '') {
                    try {
                        u.loginHistory = JSON.parse(u.loginHistory);
                    } catch (e) {
                        Utils.safeWarn('⚠ شل تحليل loginHistory:', e);
                        u.loginHistory = [];
                    }
                }
                return u;
            });
        }

        Utils.safeLog('🔍 البحث في قاعدة البيانات، عدد المستخدمين:', users.length);

        if (users.length > 0) {
            // البحث باستخدام عدة طرق لضمان العثور على المستخدم
            foundUser = users.find(u => {
                if (!u || !u.email) return false;
                const userEmail = typeof u.email === 'string' ? u.email.toLowerCase().trim() : '';
                return userEmail === email;
            });
            
            if (foundUser) {
                Utils.safeLog('✅ نتيجة البحث: المستخدم موجود في قاعدة البيانات');
            } else {
                Utils.safeWarn('❌ نتيجة البحث: المستخدم غير موجود في قاعدة البيانات', {
                    searchedEmail: email,
                    availableEmails: users.map(u => u?.email).filter(Boolean).slice(0, 5)
                });
            }

            if (foundUser) {
                Utils.safeLog('📋 بيانات المستخدم الموجود:', {
                    email: foundUser.email,
                    name: foundUser.name,
                    role: foundUser.role,
                    active: foundUser.active,
                    hasPassword: !!foundUser.password
                });
            }
        }

        // إذا لم يتم العثور عليه في المستخدمين الثابتين، نستخدم المستخدم من قاعدة البيانات
        if (!user && foundUser) {
            Utils.safeLog('✅ تم العثور على المستخدم في قاعدة البيانات');
            // التحقق من حالة الحساب (إذا كانت active غير محددة أو true، نعتبرها معّلة)
            if (foundUser.active === false || foundUser.active === 'false') {
                Utils.safeWarn('⚠️ الحساب غير معّل');
                const errorMessage = 'هذا الحساب غير مفعّل. يرجى الاتصال بالمدير';
                Notification.error(errorMessage);
                return { success: false, message: errorMessage };
            }

            // التحقق من وجود passwordHash
            if (!foundUser.passwordHash || foundUser.passwordHash.trim() === '' || foundUser.passwordHash === '***') {
                Utils.safeWarn('⚠️ المستخدم موجود لكن لا يملك passwordHash صحيح');
                const errorMessage = 'يجب تحديث كلمة المرور. يرجى الاتصال بالمدير لإعادة تعيين كلمة المرور.';
                Notification.error(errorMessage);
                return { success: false, message: errorMessage };
            }

            // ===== التحقق من تسجيل الدخول المتزامن =====
            // منع تسجيل الدخول من جهاز آخر إذا كان المستخدم متصل بالفعل
            // توليد معرف جلسة فريد لهذا المتصفح/الجهاز
            const generateSessionId = () => {
                // إنشاء معرف فريد يجمع بين timestamp و random string و user agent hash
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 15);
                const userAgent = navigator.userAgent.substring(0, 50);
                const userAgentHash = userAgent.split('').reduce((acc, char) => {
                    return ((acc << 5) - acc) + char.charCodeAt(0);
                }, 0).toString(36);
                return `SESS_${timestamp}_${random}_${userAgentHash}`;
            };

            // الحصول على معرف الجلسة الحالي من sessionStorage أو إنشاء واحد جديد
            let currentSessionId = sessionStorage.getItem('hse_session_id');
            if (!currentSessionId) {
                currentSessionId = generateSessionId();
                sessionStorage.setItem('hse_session_id', currentSessionId);
            }

            // لا ننتظر مزامنة الشبكة هنا: كانت تسبب 3–10 ثوانٍ قبل التحقق من كلمة المرور.
            // التحقق من الجلسة يعتمد على البيانات المحلية؛ بعد نجاح كلمة المرور يمكن مزامنة الخلفية (انظر بعد التحقق).

            // التحقق من وجود جلسة نشطة في المتصفح الحالي
            let hasActiveSession = false;
            let currentSessionData = null;
            try {
                const currentSession = sessionStorage.getItem('hse_current_session');
                if (currentSession) {
                    currentSessionData = JSON.parse(currentSession);
                    // إذا كانت الجلسة الحالية لنفس المستخدم، نتحقق من صحة الجلسة
                    if (currentSessionData && currentSessionData.email && currentSessionData.email.toLowerCase() === email) {
                        // التحقق من أن الجلسة غير منتهية (إذا كان هناك loginTime)
                        if (currentSessionData.loginTime) {
                            const loginTime = new Date(currentSessionData.loginTime);
                            const now = new Date();
                            const sessionAge = now - loginTime;
                            const maxSessionAge = 24 * 60 * 60 * 1000; // 24 ساعة
                            
                            if (sessionAge < maxSessionAge) {
                                // التحقق من أن معرف الجلسة يطابق
                                if (currentSessionData.sessionId === currentSessionId) {
                                    hasActiveSession = true;
                                    Utils.safeLog('✅ المستخدم متصل بالفعل من نفس المتصفح - السماح بتسجيل الدخول');
                                } else {
                                    Utils.safeLog('⚠️ معرف الجلسة غير متطابق - سيتم إنشاء جلسة جديدة');
                                }
                            } else {
                                Utils.safeLog('⚠️ الجلسة منتهية الصلاحية - سيتم السماح بتسجيل الدخول');
                                // الجلسة منتهية، نسمح بتسجيل الدخول ولكن نحدث isOnline
                            }
                        } else {
                            // لا يوجد loginTime، نعتبرها جلسة نشطة إذا كان sessionId يطابق
                            if (currentSessionData.sessionId === currentSessionId) {
                                hasActiveSession = true;
                                Utils.safeLog('✅ المستخدم متصل بالفعل من نفس المتصفح - السماح بتسجيل الدخول');
                            }
                        }
                    }
                }
            } catch (e) {
                Utils.safeWarn('⚠️ خطأ في التحقق من الجلسة الحالية:', e);
            }

            // التحقق من وجود جلسة نشطة من جهاز آخر
            if (foundUser.isOnline === true && foundUser.activeSessionId) {
                // إذا كان هناك معرف جلسة نشط ولا يطابق الجلسة الحالية
                if (foundUser.activeSessionId !== currentSessionId && !hasActiveSession) {
                    Utils.safeWarn('⚠️ المستخدم متصل بالفعل من جهاز آخر', {
                        activeSessionId: foundUser.activeSessionId,
                        currentSessionId: currentSessionId
                    });
                    const errorMessage = '⚠️ هذا الحساب متصل بالفعل من جهاز آخر.\n\nيرجى تسجيل الخروج من الجهاز الآخر أولاً، أو انتظار انتهاء الجلسة (24 ساعة).\n\nلا يمكن تسجيل الدخول من أكثر من جهاز في نفس الوقت.';
                    Notification.error(errorMessage);
                    return { success: false, message: errorMessage };
                }
            }

            // ✅ تشخيص: عرض قيمة name الأصلية من foundUser
            console.log('🔍 [AUTH] foundUser.name الأصلي:', {
                value: foundUser.name,
                type: typeof foundUser.name,
                isObject: typeof foundUser.name === 'object',
                stringified: JSON.stringify(foundUser.name)
            });

            // ✅ تطبيع name إذا كان object
            let extractedName = foundUser.name;
            if (typeof foundUser.name === 'object' && foundUser.name !== null) {
                if (foundUser.name.value) {
                    extractedName = String(foundUser.name.value).trim();
                } else {
                    const values = Object.values(foundUser.name);
                    if (values.length === 1 && typeof values[0] === 'string') {
                        extractedName = String(values[0]).trim();
                    } else {
                        extractedName = String(foundUser.name).trim();
                    }
                }
                console.log('✅ [AUTH] تم استخراج name من object:', extractedName);
            } else if (typeof foundUser.name === 'string') {
                extractedName = foundUser.name.trim();
            }

            user = {
                name: extractedName || 'مستخدم',
                password: foundUser.password || '***',
                passwordHash: foundUser.passwordHash || '',
                role: foundUser.role || 'user',
                department: foundUser.department || '',
                // ✅ حقول المصنع/الموقع الفرعي (اختيارية) لدعم الظهور بعد التحميل
                // نلتقط أكبر قدر من المسميات المحتملة من Sheet Users بدون فرض سكيمة واحدة
                factory: foundUser.factory || foundUser.factoryId || foundUser.plant || foundUser.siteId || foundUser.site || foundUser.location || '',
                factoryId: foundUser.factoryId || foundUser.factory || foundUser.plantId || foundUser.siteId || '',
                factoryName: foundUser.factoryName || foundUser.plantName || foundUser.siteName || foundUser.locationName || '',
                subLocation: foundUser.subLocation || foundUser.subLocationId || foundUser.subSite || foundUser.subsite || foundUser.placeId || foundUser.place || foundUser.branch || '',
                subLocationId: foundUser.subLocationId || foundUser.placeId || foundUser.subLocation || '',
                subLocationName: foundUser.subLocationName || foundUser.placeName || foundUser.subSiteName || foundUser.subsiteName || '',
                branch: foundUser.branch || foundUser.branchName || '',
                permissions: foundUser.permissions || {},
                id: foundUser.id,
                email: foundUser.email,
                photo: foundUser.photo || ''
            };

            console.log('✅ [AUTH] user.name النهائي:', user.name);

            Utils.safeLog('📋 بيانات المستخدم المحضرة:', {
                email: user.email,
                name: user.name,
                role: user.role,
                hasPasswordHash: !!user.passwordHash && user.passwordHash !== '***',
                passwordHashLength: user.passwordHash?.length || 0
            });
        } else if (!user && !foundUser) {
            // ⚠️ إنتاج: لا ننشئ حسابات افتراضية أو كلمات مرور داخل الكود.
            // إذا كانت قاعدة البيانات فارغة، نطلب إعداد المستخدمين عبر Google Sheets/المدير.
            if (users.length === 0) {
                // ✅ إصلاح: محاولة مزامنة مرة أخرى قبل إرجاع الخطأ
                if (canSyncUsers) {
                    Utils.safeLog('🔄 محاولة مزامنة Users مرة أخرى...');
                    try {
                        const syncResult = await GoogleIntegration.syncUsers(true);
                        if (syncResult) {
                            users = AppState.appData.users || [];
                            localUsersCount = users.length;
                            if (localUsersCount > 0) {
                                // إعادة البحث عن المستخدم بعد المزامنة
                                foundUser = users.find(u => {
                                    if (!u || !u.email) return false;
                                    const userEmail = typeof u.email === 'string' ? u.email.toLowerCase().trim() : '';
                                    return userEmail === email;
                                });
                                if (foundUser) {
                                    Utils.safeLog('✅ تم العثور على المستخدم بعد إعادة المزامنة');
                                    // المتابعة في الكود الطبيعي بدلاً من إرجاع خطأ
                                }
                            }
                        }
                    } catch (syncError) {
                        Utils.safeWarn('⚠️ فشلت إعادة مزامنة Users:', syncError);
                    }
                }
                
                // إذا لم يتم العثور على المستخدم بعد إعادة المحاولة
                if (!foundUser && users.length === 0) {
                    const useSupabase = !!(typeof AppState !== 'undefined' && AppState.useSupabaseBackend === true);
                    let msg = 'لا يوجد مستخدمون مسجلون بعد.';
                    if (useSupabase) {
                        msg += ' انقر "إنشاء أول مستخدم" أدناه أو أضفه من Supabase (جدول users).';
                        Notification.error(msg);
                        if (typeof this.showCreateFirstUserBox === 'function') this.showCreateFirstUserBox();
                    } else if (canSyncUsers) {
                        msg += ' يرجى التحقق من إعدادات Google Apps Script وورقة Users.';
                        Notification.error(msg);
                    } else {
                        msg += ' يرجى تفعيل Google Apps Script أو إضافة مستخدمين من الإعدادات.';
                        Notification.error(msg);
                    }
                    return { success: false, message: msg };
                }
            }
            
            // إذا لم يتم العثور على المستخدم بعد كل المحاولات
            if (!foundUser && !user && users.length > 0) {
                // قاعدة البيانات ليست فارغة لكن المستخدم غير موجود
                Utils.safeWarn('❌ المستخدم غير موجود في قاعدة البيانات', {
                    email: email,
                    totalUsers: users.length,
                    userEmails: users.map(u => u.email).filter(Boolean).slice(0, 5)
                });
                const errorMessage = this._getLoginErrorMessage();
                Notification.error(errorMessage);
                return { success: false, message: errorMessage };
            }
        }

        // التحقق من وجود المستخدم
        if (!user) {
            Utils.safeError('❌ المستخدم غير موجود بعد البحث في قاعدة البيانات');
            const errorMessage = this._getLoginErrorMessage();
            Notification.error(errorMessage);
            return { success: false, message: errorMessage };
        }

        const inputPasswordRaw = (password || '').trim();
        let hashedStored = (user.passwordHash || '').trim();

        // إضافة سجلات تفصيلية لمعرفة ما تم استرجاعه
        Utils.safeLog('🔍 فحص كلمة المرور المستخدم:', {
            email: email,
            hasPasswordHash: !!user.passwordHash,
            passwordHashLength: user.passwordHash?.length || 0,
            passwordHashValue: user.passwordHash ? (user.passwordHash.substring(0, 10) + '...') : 'غير موجود',
            isPasswordHashValid: user.passwordHash ? Utils.isSha256Hex(user.passwordHash) : false,
            userDataKeys: Object.keys(user)
        });

        // ===== نظام تسجيل الدخول الأول التلقائي =====
        // دعم تسجيل الدخول بكلمة مرور نصية (أول مرة) ثم تحويلها تلقائياً إلى Hash
        
        let isFirstTimeLogin = false;
        let needsHashUpdate = false;
        let passwordMatch = false;
        
        // معالجة passwordHash كـ Object (من Google Sheets)
        if (typeof hashedStored === 'object' && hashedStored !== null) {
            if (hashedStored.value) {
                hashedStored = String(hashedStored.value).trim();
                Utils.safeLog('✅ تم استخراج passwordHash من object');
            } else {
                const values = Object.values(hashedStored);
                if (values.length === 1 && typeof values[0] === 'string') {
                    hashedStored = String(values[0]).trim();
                    Utils.safeLog('✅ تم استخراج passwordHash من object (أول قيمة)');
                } else {
                    hashedStored = String(hashedStored).trim();
                }
            }
        }
        
        // التحقق من نوع passwordHash
        if (!hashedStored || hashedStored === '***' || hashedStored === '') {
            Utils.safeWarn('⚠️ المستخدم ليس لديه passwordHash');
            const errorMessage = 'حسابك غير مكتمل. يرجى التواصل مع مدير النظام لإعداد كلمة المرور.';
            Notification.error(errorMessage);
            return { success: false, message: errorMessage };
        }
        
        if (Utils.isSha256Hex(hashedStored)) {
            // ✅ Hash صحيح - استخدام التحقق المشفر العادي
            Utils.safeLog('✅ passwordHash صحيح (SHA-256) - استخدام التحقق المشفر');
            
            const normalizedInputPassword = await Utils.normalizePasswordForComparison(inputPasswordRaw, hashedStored);
            const storedPassword = hashedStored.toLowerCase().trim();
            const comparableInput = normalizedInputPassword.toLowerCase().trim();
            
            passwordMatch = (storedPassword === comparableInput);
            
            Utils.safeLog('🔑 التحقق من كلمة المرور المشفرة:', {
                storedPasswordLength: storedPassword?.length || 0,
                comparableInputLength: comparableInput?.length || 0,
                passwordsMatch: passwordMatch
            });
            
        } else {
            // ⚠️ ليس Hash - قد يكون كلمة مرور نصية (تسجيل دخول أول مرة)
            Utils.safeLog('⚠️ passwordHash ليس SHA-256 - قد يكون كلمة مرور نصية');
            Utils.safeLog('الطول:', hashedStored?.length);
            Utils.safeLog('القيمة (أول 10 أحرف):', hashedStored?.substring(0, 10));
            
            // التحقق المباشر من كلمة المرور النصية
            if (hashedStored === inputPasswordRaw) {
                Utils.safeLog('✅ تطابق مباشر مع كلمة المرور النصية!');
                Utils.safeLog('🔄 سيتم تحويل كلمة المرور إلى Hash وتحديث Google Sheets');
                
                passwordMatch = true;
                isFirstTimeLogin = true;
                needsHashUpdate = true;
                
                // تشفير كلمة المرور
                const newHash = await Utils.hashPassword(inputPasswordRaw);
                Utils.safeLog('🔐 Hash الجديد:', newHash);
                
                // تحديث foundUser مؤقتاً
                foundUser.passwordHash = newHash;
                foundUser.requiresPasswordChange = false;
                foundUser.isFirstLogin = false;
                
                // تحديث hashedStored للاستخدام في باقي الكود
                hashedStored = newHash;
                
            } else {
                Utils.safeWarn('⚠️ passwordHash غير صالح وليس كلمة مرور صحيحة');
                const errorMessage = 'بيانات الحساب غير صحيحة. يرجى التواصل مع مدير النظام.';
                Notification.error(errorMessage);
                return { success: false, message: errorMessage };
            }
        }
        
        // التحقق من نتيجة المطابقة
        if (!passwordMatch) {
            if (typeof Utils !== 'undefined' && typeof Utils.hasCloudBackendSync === 'function' && Utils.hasCloudBackendSync()) {
                Utils.safeLog('🔄 كلمة المرور غير صحيحة - محاولة مزامنة قسرية (مهلة قصيرة)...');
                try {
                    const syncDone = await Promise.race([
                        GoogleIntegration.syncUsers(true).then(() => true),
                        new Promise((resolve) => setTimeout(() => resolve(false), 900))
                    ]);
                    if (!syncDone) {
                        Utils.safeLog('⚠️ انتهت مهلة المزامنة القسرية — إرجاع خطأ كلمة المرور بسرعة');
                    } else {
                        // إعادة تحميل المستخدم بعد مزامنة ناجحة
                        const refreshedUsers = AppState.appData.users || [];
                        const refreshedUser = refreshedUsers.find(u => {
                            if (!u || !u.email) return false;
                            const userEmail = typeof u.email === 'string' ? u.email.toLowerCase().trim() : '';
                            return userEmail === email;
                        });

                        if (refreshedUser && refreshedUser.passwordHash) {
                            const newStoredHash = refreshedUser.passwordHash.trim().toLowerCase();
                            const newComparableInput = (await Utils.normalizePasswordForComparison(inputPasswordRaw, newStoredHash)).toLowerCase().trim();

                            if (newStoredHash === newComparableInput) {
                                Utils.safeLog('✅ نجح تسجيل الدخول بعد المزامنة القسرية');
                                passwordMatch = true;
                                foundUser = refreshedUser;
                                hashedStored = newStoredHash;
                            }
                        }
                    }
                } catch (syncError) {
                    Utils.safeWarn('⚠ فشل المزامنة القسرية:', syncError);
                }
            }

            // إعادة التحقق
            if (!passwordMatch) {
                // تسجيل محاولة فاشلة
                try {
                    await Utils.RateLimiter.recordFailedAttempt(email);
                } catch (rateLimitError) {
                    Notification.error(rateLimitError.message);
                    return { success: false, message: rateLimitError.message };
                }

                Utils.safeError('❌ كلمة المرور غير صحيحة');
                const errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                Notification.error(errorMessage);
                return { success: false, message: errorMessage };
            }
        }

        // إذا نجح تسجيل الدخول، مسح محاولات Rate Limiting
        await Utils.RateLimiter.clearAttempts(email);

        // مزامنة خلفية (بدون await) لتحديث حالة المستخدمين على الخادم دون تأخير الانتقال للواجهة
        if (canSyncUsers && typeof GoogleIntegration !== 'undefined' && GoogleIntegration.syncUsers) {
            Promise.resolve(GoogleIntegration.syncUsers(true)).catch(() => {});
        }

        const loginTime = new Date().toISOString();

        // استخدام بيانات المستخدم الكاملة من قاعدة البيانات إن وجدت
        const fullUserData = foundUser || (users.find(u => {
            if (!u || !u.email) return false;
            const userEmail = typeof u.email === 'string' ? u.email.toLowerCase().trim() : '';
            return userEmail === email;
        }));

        let userPermissions = user.permissions || {};
        if (fullUserData && fullUserData.permissions != null) {
            const normalizedPermissions = (typeof Permissions !== 'undefined' && typeof Permissions.normalizePermissions === 'function')
                ? Permissions.normalizePermissions(fullUserData.permissions)
                : (typeof fullUserData.permissions === 'string'
                    ? (() => { try { return JSON.parse(fullUserData.permissions); } catch (e) { return null; } })()
                    : fullUserData.permissions);

            // ✅ حماية من فقد الصلاحيات: لا نستبدل صلاحيات صالحة بقيمة غير قابلة للتطبيع
            if (normalizedPermissions && typeof normalizedPermissions === 'object' && !Array.isArray(normalizedPermissions)) {
                userPermissions = normalizedPermissions;
            } else if (fullUserData.permissions && typeof fullUserData.permissions === 'object' && !Array.isArray(fullUserData.permissions)) {
                userPermissions = fullUserData.permissions;
            } else if (user.permissions && typeof user.permissions === 'object' && !Array.isArray(user.permissions)) {
                userPermissions = user.permissions;
            } else {
                userPermissions = {};
            }
        }

        const isBootstrap = this.isBootstrapEmail(email) && !this.isBootstrapDisabled();

        // ✅ الحل الجذري: التأكد من وجود name صحيح
        // إذا كان user.name فارغًا، نستخدم email كبديل
        // ✅ إصلاح جذري: التأكد من أن userName ليس "النظام" أو فارغ
        let userName = (user.name || user.displayName || '').trim();
        
        // ✅ إذا كان userName فارغ أو "النظام"، نستخدم email
        if (!userName || userName === 'النظام' || userName === '') {
            userName = email;
            console.log('⚠️ [AUTH] user.name كان فارغ أو "النظام"، استخدام email:', userName);
        }
        
        // ✅ التحقق النهائي: إذا كان userName لا يزال فارغ، نستخدم id كبديل
        if (!userName || userName === 'النظام' || userName === '') {
            userName = (fullUserData?.id || user.id || '').toString().trim();
            if (userName) {
                console.log('⚠️ [AUTH] user.name و email كانا فارغين، استخدام id:', userName);
            }
        }
        
        // ✅ التحقق النهائي: إذا كان userName لا يزال فارغ، نستخدم "مستخدم" كبديل
        if (!userName || userName === 'النظام' || userName === '') {
            userName = 'مستخدم';
            console.log('⚠️ [AUTH] لا يمكن الحصول على اسم المستخدم، استخدام "مستخدم" كبديل');
        }
        
        console.log('🔍 [AUTH] تعيين AppState.currentUser:', {
            originalName: user.name,
            displayName: user.displayName,
            email: email,
            finalName: userName
        });
        
        const resolvedRole = (typeof Utils !== 'undefined' && typeof Utils.canonicalizeUserRole === 'function')
            ? Utils.canonicalizeUserRole(user.role || 'user')
            : (user.role || 'user');

        AppState.currentUser = {
            email,
            name: userName, // ✅ استخدام userName بدلاً من user.name مباشرة
            role: resolvedRole,
            department: user.department || '',
            permissions: userPermissions,
            id: fullUserData?.id || user.id,
            passwordHash: hashedStored,
            passwordChanged: fullUserData?.passwordChanged ?? false,
            forcePasswordChange: fullUserData?.forcePasswordChange === true,
            isBootstrap: isBootstrap,
            loginTime: loginTime,
            photo: fullUserData?.photo || user?.photo || '' // ✅ إظهار صورة المستخدم بعد الدخول مباشرة
        };

        console.log('✅ [AUTH] AppState.currentUser.name النهائي:', AppState.currentUser.name);
        Utils.safeLog('✅ تسجيل الدخول ناجح:', AppState.currentUser);
        Utils.safeLog('📋 الصلاحيات:', AppState.currentUser.permissions);

        // إذا كان تسجيل دخول أول مرة، حدّث Google Sheets بالـ Hash الجديد
        if (needsHashUpdate) {
            Utils.safeLog('🔄 ===== تحديث Hash في Google Sheets =====');
            try {
                // إعداد البيانات المحدثة
                const updatedUserData = {
                    ...foundUser,
                    password: '***', // إخفاء كلمة المرور النصية
                    passwordHash: hashedStored, // Hash الجديد
                    requiresPasswordChange: false,
                    isFirstLogin: false,
                    updatedAt: new Date().toISOString()
                };
                
                Utils.safeLog('📤 إرسال Hash الجديد إلى Google Sheets...');
                
                // تحديث في Google Sheets
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.updateUser) {
                    GoogleIntegration.updateUser(updatedUserData).then(updateResult => {
                        if (updateResult && updateResult.success) {
                            Utils.safeLog('✅ تم تحديث passwordHash في Google Sheets بنجاح!');
                        } else {
                            Utils.safeWarn('⚠️ فشل تحديث Google Sheets:', updateResult);
                        }
                    }).catch(updateError => {
                        Utils.safeError('❌ خطأ في تحديث Hash:', updateError);
                    });
                }
                
                // تحديث في البيانات المحلية
                const userIndex = AppState.appData.users.findIndex(u => u.email === email);
                if (userIndex !== -1) {
                    AppState.appData.users[userIndex].passwordHash = hashedStored;
                    AppState.appData.users[userIndex].password = '***';
                    AppState.appData.users[userIndex].updatedAt = new Date().toISOString();
                    if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                        window.DataManager.save();
                    }
                    Utils.safeLog('✅ تم تحديث البيانات المحلية');
                }
                
                Utils.safeLog('================================================');
            } catch (updateError) {
                Utils.safeError('❌ خطأ في تحديث Hash:', updateError);
                // نستمر في تسجيل الدخول حتى لو فشل التحديث
            }
        }

        // معرف الجلسة قبل تسجيل «login» في السجل لربط كل الأحداث بنفس الجلسة
        let currentSessionId = sessionStorage.getItem('hse_session_id');
        if (!currentSessionId) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 15);
            const userAgent = navigator.userAgent.substring(0, 50);
            const userAgentHash = userAgent.split('').reduce((acc, char) => {
                return ((acc << 5) - acc) + char.charCodeAt(0);
            }, 0).toString(36);
            currentSessionId = `SESS_${timestamp}_${random}_${userAgentHash}`;
            sessionStorage.setItem('hse_session_id', currentSessionId);
        }
        AppState.currentUser.sessionId = currentSessionId;

        if (typeof UserActivityLog !== 'undefined') {
            UserActivityLog.log('login', 'Authentication', null, {
                description: `تسجيل دخول المستخدم ${AppState.currentUser.name || AppState.currentUser.email}`
            }).catch(() => { });
        }

        // تحديث بيانات تسجيل الدخول للمستخدم في قاعدة البيانات
        const usersList = AppState.appData.users || [];
        const userIndex = usersList.findIndex(u => u.email && u.email.toLowerCase() === email);
        if (userIndex !== -1) {
            usersList[userIndex].lastLogin = loginTime;
            usersList[userIndex].isOnline = true;
            usersList[userIndex].activeSessionId = currentSessionId; // حفظ معرف الجلسة
            usersList[userIndex].loginHistory = usersList[userIndex].loginHistory || [];
            usersList[userIndex].loginHistory.push({
                time: loginTime,
                ip: 'N/A',
                userAgent: navigator.userAgent.substring(0, 100),
                sessionId: currentSessionId
            });
            // الاحتفاظ بآخر 10 عمليات تسجيل دخول فقط
            if (usersList[userIndex].loginHistory.length > 10) {
                usersList[userIndex].loginHistory = usersList[userIndex].loginHistory.slice(-10);
            }
            AppState.appData.users = usersList;
            
            // تحديث عدد تسجيلات الدخول الإجمالي للنظام
            if (!AppState.appData.systemStatistics) {
                AppState.appData.systemStatistics = {};
            }
            if (typeof AppState.appData.systemStatistics.totalLogins !== 'number') {
                AppState.appData.systemStatistics.totalLogins = 0;
            }
            AppState.appData.systemStatistics.totalLogins += 1;
            
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
            
            if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript &&
                typeof Utils !== 'undefined' && typeof Utils.hasCloudBackendSync === 'function' && Utils.hasCloudBackendSync()) {
                const userId = usersList[userIndex].id;
                const updateData = {
                    lastLogin: loginTime,
                    isOnline: true,
                    activeSessionId: currentSessionId, // إرسال معرف الجلسة إلى Google Sheets
                    loginHistory: usersList[userIndex].loginHistory
                };
                
                GoogleIntegration.sendToAppsScript('updateUser', {
                    userId: userId,
                    updateData: updateData
                }).then(updateResult => {
                    if (updateResult && updateResult.success) {
                        Utils.safeLog('✅ تم مزامنة lastLogin و activeSessionId مع الخادم بنجاح');
                    } else {
                        Utils.safeWarn('⚠️ فشل مزامنة lastLogin مع الخادم:', updateResult?.message);
                    }
                }).catch(updateError => {
                    Utils.safeWarn('⚠️ خطأ في مزامنة lastLogin مع الخادم:', updateError);
                    // لا نوقف تسجيل الدخول حتى لو فشلت المزامنة
                });
            }
            
            // تحديث جدول المستخدمين فوراً إذا كان مفتوحاً
            if (typeof Users !== 'undefined' && typeof Users.updateUserStatus === 'function') {
                setTimeout(() => {
                    Users.updateUserStatus(usersList[userIndex].id);
                }, 100);
            }
            
            // تحديث زر حالة الاتصال في الشريط الجانبي
            if (typeof UI !== 'undefined' && typeof UI.updateUserConnectionStatus === 'function') {
                setTimeout(() => {
                    UI.updateUserConnectionStatus();
                    // بدء التحديث التلقائي لحالة الاتصال
                    if (typeof UI.startAutoRefreshConnectionStatus === 'function') {
                        UI.startAutoRefreshConnectionStatus();
                    }
                }, 200);
            }
        } else if (!foundUser && user) {
            // إضافة المستخدم إلى قاعدة البيانات (إذا كان جديداً)
            const newUser = {
                id: Utils.generateId('USER'),
                email: email,
                name: user.name,
                password: user.password,
                role: user.role || 'user',
                department: user.department || '',
                active: true,
                permissions: user.permissions || {},
                lastLogin: loginTime,
                isOnline: true,
                activeSessionId: currentSessionId,
                loginHistory: [{
                    time: loginTime,
                    ip: 'N/A',
                    userAgent: navigator.userAgent.substring(0, 100),
                    sessionId: currentSessionId
                }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            AppState.appData.users.push(newUser);
            
            // تحديث عدد تسجيلات الدخول الإجمالي للنظام
            if (!AppState.appData.systemStatistics) {
                AppState.appData.systemStatistics = {};
            }
            if (typeof AppState.appData.systemStatistics.totalLogins !== 'number') {
                AppState.appData.systemStatistics.totalLogins = 0;
            }
            AppState.appData.systemStatistics.totalLogins += 1;
            
            if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                window.DataManager.save();
            }
            // لا يتم تحديث Google Sheets تلقائياً بعد تسجيل الدخول للحفاظ على السجلات الأصلية
        }

        // حفظ الجلسة بشكل آمن (بدون passwordHash)
        const safeUserData = {
            email: AppState.currentUser.email,
            name: AppState.currentUser.name,
            role: AppState.currentUser.role,
            department: AppState.currentUser.department,
            permissions: AppState.currentUser.permissions,
            id: AppState.currentUser.id,
            loginTime: AppState.currentUser.loginTime,
            sessionId: currentSessionId, // حفظ معرف الجلسة في الجلسة
            photo: AppState.currentUser.photo || '' // ✅ حفظ الصورة لاستعادتها عند فتح الصفحة
            // تم إزالة passwordHash لأسباب أمنية
        };

        sessionStorage.setItem('hse_current_session', JSON.stringify(safeUserData));
        Utils.safeLog('💾 تم حفظ الجلسة في sessionStorage');

        // إذا اختار "تذكرني"، نحفظ في localStorage أيضاً
        if (remember) {
            localStorage.setItem('hse_remember_user', JSON.stringify(safeUserData));
            Utils.safeLog('💾 تم حفظ الجلسة في localStorage (تذكرني)');
        } else {
            // إذا لم يختر "تذكرني"، نحذف من localStorage
            localStorage.removeItem('hse_remember_user');
            Utils.safeLog('🗑 تم حذف localStorage (لم يختر تذكرني)');
        }

        // التحقق من التسجيل الأول أو عدم تغيير كلمة المرور
        const requiresPasswordChange = fullUserData?.forcePasswordChange === true;
        const isFirstLogin = !fullUserData?.passwordChanged;

        if (!requiresPasswordChange) {
            Notification.success(`مرحباً ${user.name}`);
        }

        // تحميل إعدادات Google بشكل دائم بعد تسجيل الدخول (يجب أن تكون متاحة لجميع المستخدمين)
        if (typeof window.DataManager !== 'undefined' && window.DataManager.loadGoogleConfig) {
            try {
                window.DataManager.loadGoogleConfig();
                Utils.safeLog('✅ تم تحميل إعدادات Google بعد تسجيل الدخول');
            } catch (configError) {
                Utils.safeWarn('⚠️ خطأ في تحميل إعدادات Google بعد تسجيل الدخول:', configError);
            }
        }

        // بدء نظام مراقبة الاتصال بعد تسجيل الدخول
        if (typeof ConnectionMonitor !== 'undefined' && ConnectionMonitor.start) {
            setTimeout(() => {
                try {
                    ConnectionMonitor.start();
                    Utils.safeLog('✅ تم بدء نظام مراقبة الاتصال بعد تسجيل الدخول');
                } catch (monitorError) {
                    Utils.safeWarn('⚠️ فشل بدء نظام مراقبة الاتصال:', monitorError);
                }
            }, 500);
        }

        // ✅ إصلاح: تحميل البيانات الأساسية أولاً بشكل مباشر ومتسلسل بدون تأخير
        // بدء تحميل البيانات مباشرة بعد تسجيل الدخول (بدون requestAnimationFrame)
        // ⚠️ مهم: لا نستخدم await هنا حتى لا نبطئ عملية تسجيل الدخول
        // لكن نبدأ التحميل فوراً في الخلفية
        AppState._initialDataLoadOwner = 'auth';
        AppState._initialDataLoadInProgress = true;
        AppState._initialDataLoadCompleted = false;
        AppState._initialDataLoadStartedAt = Date.now();
        (async () => {
            try {
                Utils.safeLog('🚀 بدء تحميل البيانات بعد تسجيل الدخول...');
                
                // ✅ الخطوة 1: تحميل البيانات المحلية أولاً كـ fallback فوري
                if (typeof DataManager !== 'undefined' && DataManager.load) {
                    try {
                        await DataManager.load();
                        Utils.safeLog('✅ تم تحميل البيانات المحلية');
                    } catch (loadError) {
                        Utils.safeWarn('⚠️ فشل تحميل البيانات المحلية:', loadError);
                    }
                }

                // ✅ الخطوة 2: تحميل البيانات الأساسية بشكل متسلسل (مهم جداً)
                if (typeof Utils !== 'undefined' && typeof Utils.hasCloudBackendSync === 'function' && Utils.hasCloudBackendSync() && typeof GoogleIntegration !== 'undefined') {
                    const prioritySheets = ['Users', 'Employees', 'ExternalWorkforceMonthly', 'Contractors', 'ApprovedContractors'];
                    const sheetMapping = {
                        'Users': 'users',
                        'Employees': 'employees',
                        'ExternalWorkforceMonthly': 'externalWorkforceMonthly',
                        'Contractors': 'contractors',
                        'ApprovedContractors': 'approvedContractors'
                    };

                    // تحميل شبه متوازي للبيانات الأساسية (عاملان) لتقليل زمن الانتظار بدون ضغط زائد
                    const workerCount = 2;
                    let cursor = 0;
                    const loadPrioritySheet = async (sheetName) => {
                        try {
                            const data = await GoogleIntegration.readFromSheets(sheetName, 8000);
                            const key = sheetMapping[sheetName];

                            if (key && Array.isArray(data) && data.length > 0) {
                                AppState.appData[key] = data;
                                Utils.safeLog(`✅ تم تحميل ${sheetName}: ${data.length} سجل`);
                            } else if (key && Array.isArray(AppState.appData[key]) && AppState.appData[key].length > 0) {
                                Utils.safeLog(`⚠️ ${sheetName}: فشل التحميل من Google Sheets - استخدام ${AppState.appData[key].length} سجل محلي`);
                            }
                        } catch (error) {
                            const key = sheetMapping[sheetName];
                            const errorMsg = error?.message || String(error);

                            if (key && Array.isArray(AppState.appData[key]) && AppState.appData[key].length > 0) {
                                Utils.safeLog(`⚠️ ${sheetName}: فشل التحميل (${errorMsg}) - استخدام ${AppState.appData[key].length} سجل محلي`);
                            } else {
                                Utils.safeWarn(`⚠️ ${sheetName}: فشل التحميل ولا توجد بيانات محلية احتياطية`);
                                if (sheetName === 'Users' && typeof Notification !== 'undefined') {
                                    Notification.warning('تعذر تحميل بيانات المستخدمين. قد تحتاج إلى تحديث الصفحة.', 5000);
                                }
                            }
                        }
                    };
                    const workers = Array.from({ length: Math.min(workerCount, prioritySheets.length) }, async () => {
                        while (cursor < prioritySheets.length) {
                            const index = cursor++;
                            const sheetName = prioritySheets[index];
                            await loadPrioritySheet(sheetName);
                        }
                    });
                    await Promise.allSettled(workers);

                    // ✅ تحميل إعدادات الشركة (بما فيها سياسة ما بعد الدخول) مع نفس تدفق بيانات المستخدمين لظهورها مباشرة بعد التسجيل
                    if (typeof DataManager !== 'undefined' && DataManager.loadCompanySettings) {
                        try {
                            await DataManager.loadCompanySettings(true);
                            if (AppState.debugMode) Utils.safeLog('✅ تم تحميل إعدادات الشركة مع بيانات المستخدم');
                        } catch (settingsErr) {
                            Utils.safeWarn('⚠️ فشل تحميل إعدادات الشركة مع بيانات المستخدم:', settingsErr);
                        }
                    }

                    // ✅ الخطوة 3: تحديث الجلسة والقائمة بعد تحميل بيانات المستخدمين
                    // هذا مهم جداً لضمان تحديث الصلاحيات والقائمة الجانبية
                    try {
                        if (typeof window.Auth !== 'undefined' && typeof window.Auth.updateUserSession === 'function') {
                            window.Auth.updateUserSession();
                        }

                        if (typeof Permissions !== 'undefined' && typeof Permissions.updateNavigation === 'function') {
                            Permissions.updateNavigation();
                        }
                    } catch (updateError) {
                        Utils.safeWarn('⚠️ فشل تحديث الجلسة أو القائمة:', updateError);
                    }

                    Utils.safeLog('✅ اكتمل تحميل البيانات الأساسية');
                    AppState._initialDataLoadCompleted = true;
                    AppState._initialDataLoadCompletedAt = Date.now();

                    // ✅ إضافة: تحميل فوري لإعدادات النماذج (المواقع) بعد تحميل البيانات الأساسية
                    // هذا يضمن توفر المواقع فوراً عند فتح أي موديول يحتاجها
                    if (typeof Permissions !== 'undefined' && typeof Permissions.initFormSettingsState === 'function') {
                        try {
                            Permissions.initFormSettingsState().then(async () => {
                                if (AppState.debugMode) {
                                    Utils.safeLog('✅ تم تحميل إعدادات النماذج (المواقع) بعد تسجيل الدخول');
                                }
                                
                                // ✅ إصلاح: تحميل إعدادات الشركة (بما في ذلك الشعار) مباشرة بعد initFormSettingsState
                                // هذا يضمن تحميل الشعار بشكل تلقائي بعد تسجيل الدخول
                                // forceReload = true في أول مرة بعد تسجيل الدخول لضمان التحديث
                                if (typeof DataManager !== 'undefined' && DataManager.loadCompanySettings) {
                                    try {
                                        // في أول مرة بعد تسجيل الدخول، نحمل من قاعدة البيانات
                                        // في المرات القادمة، سيتم استخدام localStorage
                                        await DataManager.loadCompanySettings(true); // forceReload = true
                                        if (AppState.debugMode) {
                                            Utils.safeLog('✅ تم تحميل إعدادات الشركة والشعار بعد تسجيل الدخول');
                                        }
                                    } catch (settingsError) {
                                        Utils.safeWarn('⚠️ فشل تحميل إعدادات الشركة بعد تسجيل الدخول:', settingsError);
                                    }
                                }
                            }).catch((error) => {
                                Utils.safeWarn('⚠️ فشل تحميل إعدادات النماذج بعد تسجيل الدخول:', error);
                            });
                        } catch (error) {
                            Utils.safeWarn('⚠️ خطأ في تحميل إعدادات النماذج:', error);
                        }
                    } else {
                        // ✅ إصلاح: إذا لم يكن initFormSettingsState متاحاً، نحمّل إعدادات الشركة مباشرة
                        // forceReload = true في أول مرة بعد تسجيل الدخول
                        if (typeof DataManager !== 'undefined' && DataManager.loadCompanySettings) {
                            try {
                                await DataManager.loadCompanySettings(true); // forceReload = true
                                if (AppState.debugMode) {
                                    Utils.safeLog('✅ تم تحميل إعدادات الشركة والشعار بعد تسجيل الدخول');
                                }
                            } catch (settingsError) {
                                Utils.safeWarn('⚠️ فشل تحميل إعدادات الشركة بعد تسجيل الدخول:', settingsError);
                            }
                        }
                    }

                    // ✅ الخطوة 4: تحميل بيانات الموديولات الأخرى بشكل متسلسل حسب الصلاحيات
                    // هذا يتم في الخلفية بدون تأخير لعملية تسجيل الدخول
                    this.loadModulesDataSequentially().catch(err => {
                        Utils.safeWarn('⚠️ فشل تحميل بيانات الموديولات:', err);
                    });
                } else {
                    Utils.safeLog('ℹ️ الخادم الخلفي غير مُهيأ للمزامنة - استخدام البيانات المحلية فقط');
                }
            } catch (err) {
                Utils.safeError('❌ خطأ عام في تحميل البيانات:', err);
                AppState._initialDataLoadCompleted = true;
                AppState._initialDataLoadCompletedAt = Date.now();
                
                // ✅ معالجة الأخطاء الشاملة: التأكد من استخدام البيانات المحلية عند الفشل الكامل
                if (typeof DataManager !== 'undefined' && DataManager.load) {
                    try {
                        await DataManager.load();
                        Utils.safeLog('✅ تم تحميل البيانات المحلية كـ fallback بعد الخطأ');
                    } catch (loadError) {
                        Utils.safeError('❌ فشل تحميل البيانات المحلية أيضاً:', loadError);
                        
                        // إظهار رسالة للمستخدم في حالة الفشل الكامل
                        if (typeof Notification !== 'undefined') {
                            Notification.error('تعذر تحميل البيانات. يرجى تحديث الصفحة والمحاولة مرة أخرى.', 8000);
                        }
                    }
                }
            } finally {
                AppState._initialDataLoadInProgress = false;
            }
        })();

        // إرسال حدث نجاح تسجيل الدخول لتحديث عدد تسجيلات الدخول في الفوتر
        try {
            const loginSuccessEvent = new CustomEvent('loginSuccess', {
                detail: {
                    user: AppState.currentUser,
                    loginTime: loginTime
                }
            });
            document.dispatchEvent(loginSuccessEvent);
        } catch (e) {
            // تجاهل الأخطاء في حالة عدم دعم CustomEvent
        }

        // إرجاع معلومات عن حالة تغيير كلمة المرور
        return {
            success: true,
            requiresPasswordChange: requiresPasswordChange,
            isFirstLogin: isFirstLogin
        };
    },
    logout() {
        // ✅ إيقاف المزامنة التلقائية الدورية عند تسجيل الخروج
        if (typeof window.UI !== 'undefined' && typeof window.UI.stopBackgroundSync === 'function') {
            window.UI.stopBackgroundSync();
        }

        // إيقاف نظام عدم النشاط
        if (typeof InactivityManager !== 'undefined') {
            InactivityManager.stop();
        }

        // إيقاف نظام مراقبة الاتصال
        if (typeof ConnectionMonitor !== 'undefined' && ConnectionMonitor.stop) {
            try {
                ConnectionMonitor.stop();
                Utils.safeLog('✅ تم إيقاف نظام مراقبة الاتصال');
            } catch (monitorError) {
                Utils.safeWarn('⚠️ فشل إيقاف نظام مراقبة الاتصال:', monitorError);
            }
        }

        // تسجيل حركة تسجيل الخروج قبل حذف بيانات المستخدم
        if (AppState.currentUser && typeof UserActivityLog !== 'undefined') {
            const userName = AppState.currentUser.name || AppState.currentUser.email || 'مستخدم غير معروف';
            UserActivityLog.log('logout', 'Authentication', null, {
                description: `تسجيل خروج المستخدم ${userName}`
            }).catch(() => { }); // لا ننتظر حتى لا نبطئ عملية تسجيل الخروج
        }

        // تحديث حالة المستخدم إلى غير متصل
        if (AppState.currentUser && AppState.currentUser.email) {
            const users = AppState.appData.users || [];
            const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === AppState.currentUser.email.toLowerCase());
            if (userIndex !== -1) {
                users[userIndex].isOnline = false;
                users[userIndex].lastLogout = new Date().toISOString();
                users[userIndex].activeSessionId = null; // مسح معرف الجلسة عند تسجيل الخروج
                AppState.appData.users = users;
                
                if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
                    window.DataManager.save();
                }
                
                if (typeof GoogleIntegration !== 'undefined' && GoogleIntegration.sendToAppsScript &&
                    typeof Utils !== 'undefined' && typeof Utils.hasCloudBackendSync === 'function' && Utils.hasCloudBackendSync()) {
                    const userId = users[userIndex].id;
                    const updateData = {
                        lastLogout: users[userIndex].lastLogout,
                        isOnline: false,
                        activeSessionId: null // مسح معرف الجلسة في Google Sheets
                    };
                    
                    GoogleIntegration.sendToAppsScript('updateUser', {
                        userId: userId,
                        updateData: updateData
                    }).then(updateResult => {
                        if (updateResult && updateResult.success) {
                            Utils.safeLog('✅ تم مزامنة lastLogout و activeSessionId مع الخادم بنجاح');
                        } else {
                            Utils.safeWarn('⚠️ فشل مزامنة lastLogout مع الخادم:', updateResult?.message);
                        }
                    }).catch(updateError => {
                        Utils.safeWarn('⚠️ خطأ في مزامنة lastLogout مع الخادم:', updateError);
                        // لا نوقف تسجيل الخروج حتى لو فشلت المزامنة
                    });
                }
            
            // تحديث جدول المستخدمين فوراً إذا كان مفتوحاً
                if (typeof Users !== 'undefined' && typeof Users.updateUserStatus === 'function') {
                    setTimeout(() => {
                        Users.updateUserStatus(users[userIndex].id);
                    }, 100);
                }
                
                // تحديث زر حالة الاتصال في الشريط الجانبي
                if (typeof UI !== 'undefined' && typeof UI.updateUserConnectionStatus === 'function') {
                    UI.updateUserConnectionStatus();
                }
                
                // إيقاف التحديث التلقائي لحالة الاتصال
                if (typeof UI !== 'undefined' && typeof UI.stopAutoRefreshConnectionStatus === 'function') {
                    UI.stopAutoRefreshConnectionStatus();
                }
            }
        }

        AppState.currentUser = null;

        // إعادة تعيين حالة جلب سجل التردد الكامل في العيادة (جلسة جديدة = جلب من الخادم مرة أخرى عند الحاجة)
        if (typeof window !== 'undefined' && window.Clinic && typeof window.Clinic === 'object') {
            try { window.Clinic._visitsBackendFetchOk = false; } catch (e) {}
        }
        if (typeof window !== 'undefined' && window.Training && typeof window.Training === 'object') {
            try {
                window.Training._trainingBackendFetchOk = false;
                window.Training._trainingDataLoadPromise = null;
            } catch (e) {}
        }
        if (typeof window !== 'undefined' && window.ChemicalSafety && typeof window.ChemicalSafety === 'object') {
            try {
                window.ChemicalSafety._chemicalBackendFetchOk = false;
                window.ChemicalSafety._chemicalDataLoadPromise = null;
            } catch (e) {}
        }
        if (typeof window !== 'undefined' && window.DailyObservations && typeof window.DailyObservations === 'object') {
            try {
                window.DailyObservations._dailyObsBackendFetchOk = false;
                window.DailyObservations._dailyObsLoadPromise = null;
            } catch (e) {}
        }
        
        // مسح جميع بيانات الجلسة
        try {
            localStorage.removeItem('hse_remember_user');
            sessionStorage.removeItem('hse_current_session');
            sessionStorage.removeItem('hse_current_section');
            sessionStorage.removeItem('hse_session_id'); // مسح معرف الجلسة
            Utils.safeLog('✅ تم مسح جميع بيانات الجلسة بما في ذلك معرف الجلسة');
        } catch (e) {
            Utils.safeWarn('⚠️ فشل مسح بعض بيانات الجلسة:', e);
        }
        
        if (typeof Notification !== 'undefined') {
            Notification.info('تم تسجيل الخروج بنجاح');
        }
        
        if (typeof UI !== 'undefined') {
            UI.toggleSidebar(false);
            UI.updateUserProfile();
            UI.showLoginScreen();
        }
    },

    /**
     * التحقق من المستخدم المحوظ
     */
    checkRememberedUser() {
        try {
            // أولاً: التحقق من sessionStorage (للمتصح الحالي)
            let sessionData = sessionStorage.getItem('hse_current_session');
            if (sessionData) {
                try {
                    const user = JSON.parse(sessionData);
                    // التحقق من أن البيانات صحيحة وأن المستخدم ما زال موجوداً
                    if (user && user.email) {
                        // استعادة hse_session_id من بيانات الجلسة إن فُقد (بعد إعادة تحميل في نفس التبويب)
                        let currentSessionId = sessionStorage.getItem('hse_session_id');
                        if (!currentSessionId && user.sessionId) {
                            try {
                                sessionStorage.setItem('hse_session_id', user.sessionId);
                                currentSessionId = user.sessionId;
                            } catch (e) { /* ignore */ }
                        }

                        // التحقق من وجود المستخدم ي قاعدة البيانات
                        const email = user.email.toLowerCase();
                        const users = AppState.appData.users || [];
                        let foundUser = users.find(u => u.email && u.email.toLowerCase() === email);

                        // فقط إذا وُجد المستخدم وكان غير مفعّل، نمسح الجلسة
                        if (foundUser && foundUser.active === false) {
                            // المستخدم غير معّل
                            sessionStorage.removeItem('hse_current_session');
                            localStorage.removeItem('hse_remember_user');
                            sessionStorage.removeItem('hse_session_id');
                            AppState.isPageRefresh = false;
                            return false;
                        }

                        // التحقق من معرف الجلسة: عند إعادة التحميل (نفس التبويب) لا نرفض الجلسة بسبب كاش قديم
                        if (!currentSessionId) currentSessionId = sessionStorage.getItem('hse_session_id');
                        if (foundUser && foundUser.isOnline === true && foundUser.activeSessionId && !AppState.isPageRefresh) {
                            if (foundUser.activeSessionId !== currentSessionId) {
                                Utils.safeWarn('⚠️ المستخدم متصل من جهاز آخر - لا يمكن استعادة الجلسة');
                                sessionStorage.removeItem('hse_current_session');
                                localStorage.removeItem('hse_remember_user');
                                sessionStorage.removeItem('hse_session_id');
                                AppState.isPageRefresh = false;
                                return false;
                            }
                        }

                        // التحقق من أن معرف الجلسة في بيانات الجلسة يطابق المعرف الحالي
                        if (user.sessionId && currentSessionId && user.sessionId !== currentSessionId) {
                            Utils.safeWarn('⚠️ معرف الجلسة غير متطابق - مسح الجلسة القديمة');
                            sessionStorage.removeItem('hse_current_session');
                            localStorage.removeItem('hse_remember_user');
                            AppState.isPageRefresh = false;
                            return false;
                        }

                        // نقبل المستخدم حتى لو لم نجده في قاعدة البيانات
                        // لأنه قد يكون هناك تأخير في تحميل البيانات من Google Sheets
                        if (foundUser) {
                            // استخدام بيانات المستخدم الكاملة من قاعدة البيانات
                            // ✅ ضمان name صحيح حتى في الاستعادة
                            const mergedName = (foundUser.name || foundUser.displayName || '').trim() || user.email || user.name || '';
                            
                            AppState.currentUser = {
                                ...user,
                                ...foundUser,
                                name: mergedName,
                                passwordHash: foundUser.passwordHash || user.passwordHash,
                                password: '***', // إخفاء كلمة المرور
                                loginTime: user.loginTime || AppState.currentUser?.loginTime // الحفاظ على وقت تسجيل الدخول
                            };
                            
                            console.log('✅ [AUTH] AppState.currentUser.name بعد الاستعادة (sessionStorage):', AppState.currentUser.name);
                            
                            // ✅ إصلاح: تحديث الجلسة بالبيانات الجديدة من قاعدة البيانات
                            this.updateUserSession();
                        } else {
                            // استخدام بيانات المستخدم من الجلسة المحفوظة
                            AppState.currentUser = {
                                ...user,
                                name: (user.name || user.displayName || '').trim() || user.email || user.id || ''
                            };
                            Utils.safeLog('⚠️ استخدام بيانات المستخدم من الجلسة (لم يُعثر عليه في قاعدة البيانات بعد)');
                            
                            // ✅ إصلاح: محاولة تحديث الجلسة بعد تحميل البيانات (إذا لم تكن محملة بعد)
                            // نضيف مستمع لتحديث الجلسة عندما يتم تحميل بيانات المستخدمين
                            if (!AppState._sessionUpdateScheduled) {
                                AppState._sessionUpdateScheduled = true;
                                let retryCount = 0;
                                const maxRetries = 5; // الحد الأقصى للمحاولات
                                
                                const checkAndUpdateSession = () => {
                                    retryCount++;
                                    
                                    // ✅ إصلاح: التحقق من عدم تجاوز الحد الأقصى للمحاولات
                                    if (retryCount > maxRetries) {
                                        AppState._sessionUpdateScheduled = false;
                                        Utils.safeWarn('⚠️ تم تجاوز الحد الأقصى لمحاولات تحديث الجلسة');
                                        return;
                                    }
                                    
                                    const users = AppState.appData.users || [];
                                    const dbUser = users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
                                    
                                    if (dbUser) {
                                        // تم العثور على المستخدم - تحديث الجلسة
                                        // ✅ إصلاح: الحفاظ على جميع البيانات المهمة من الجلسة الحالية
                                        const mergedName = (dbUser.name || dbUser.displayName || '').trim() || user.email || user.name || '';
                                        
                                        AppState.currentUser = {
                                            ...user, // الحفاظ على بيانات الجلسة الأصلية
                                            ...dbUser, // دمج بيانات قاعدة البيانات
                                            name: mergedName,
                                            passwordHash: dbUser.passwordHash || user.passwordHash,
                                            password: '***',
                                            loginTime: user.loginTime || AppState.currentUser?.loginTime, // الحفاظ على وقت تسجيل الدخول
                                            id: dbUser.id || user.id || AppState.currentUser?.id // الحفاظ على ID
                                        };
                                        
                                        console.log('✅ [AUTH] AppState.currentUser.name بعد التحديث التلقائي (sessionStorage):', AppState.currentUser.name);
                                        
                                        // تحديث الجلسة فقط إذا كانت هناك تغييرات فعلية
                                        this.updateUserSession();
                                        AppState._sessionUpdateScheduled = false;
                                        Utils.safeLog(`✅ تم تحديث الجلسة بعد تحميل بيانات المستخدمين (محاولة ${retryCount})`);
                                    } else {
                                        // لم يتم العثور بعد - إعادة المحاولة بعد قليل
                                        if (retryCount < maxRetries) {
                                            const delay = Math.min(500 * retryCount, 1500); // تقليل التأخير التدريجي
                                            setTimeout(checkAndUpdateSession, delay);
                                        } else {
                                            AppState._sessionUpdateScheduled = false;
                                            Utils.safeWarn('⚠️ لم يتم العثور على المستخدم في قاعدة البيانات بعد عدة محاولات');
                                        }
                                    }
                                };
                                
                                // محاولة فورية أولاً
                                setTimeout(checkAndUpdateSession, 250);
                            }
                        }
                        
                        // حفظ الجلسة مرة أخرى للتأكد من استمراريتها
                        const safeUserData = {
                            email: AppState.currentUser.email,
                            name: AppState.currentUser.name,
                            role: AppState.currentUser.role,
                            department: AppState.currentUser.department,
                            factory: AppState.currentUser.factory || AppState.currentUser.factoryId || '',
                            factoryId: AppState.currentUser.factoryId || AppState.currentUser.factory || '',
                            factoryName: AppState.currentUser.factoryName || '',
                            subLocation: AppState.currentUser.subLocation || AppState.currentUser.subLocationId || '',
                            subLocationId: AppState.currentUser.subLocationId || AppState.currentUser.subLocation || '',
                            subLocationName: AppState.currentUser.subLocationName || '',
                            branch: AppState.currentUser.branch || '',
                            permissions: AppState.currentUser.permissions,
                            id: AppState.currentUser.id,
                            loginTime: AppState.currentUser.loginTime,
                            photo: AppState.currentUser.photo || ''
                        };
                        sessionStorage.setItem('hse_current_session', JSON.stringify(safeUserData));
                        Utils.safeLog('✅ تم استعادة الجلسة من sessionStorage - المستخدم مسجل دخول');
                        return true;
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ في تحليل بيانات sessionStorage:', e);
                    // في حالة الخطأ، نحاول مسح الجلسة التالفة
                    try {
                        sessionStorage.removeItem('hse_current_session');
                        sessionStorage.removeItem('hse_session_id');
                    } catch (clearError) {
                        Utils.safeWarn('⚠️ فشل مسح الجلسة التالفة:', clearError);
                    }
                }
            }

            // ثانياً: التحقق من localStorage (إذا كان اختار "تذكرني")
            const remembered = localStorage.getItem('hse_remember_user');
            if (remembered) {
                try {
                    const user = JSON.parse(remembered);
                    // التحقق من صحة البيانات وأن المستخدم ما زال موجوداً
                    if (user && user.email) {
                        let currentSessionId = sessionStorage.getItem('hse_session_id');
                        if (!currentSessionId && user.sessionId) {
                            try {
                                sessionStorage.setItem('hse_session_id', user.sessionId);
                                currentSessionId = user.sessionId;
                            } catch (e) { /* ignore */ }
                        }

                        const email = user.email.toLowerCase();
                        const users = AppState.appData.users || [];
                        let foundUser = users.find(u => u.email && u.email.toLowerCase() === email);

                        if (foundUser && foundUser.active === false) {
                            localStorage.removeItem('hse_remember_user');
                            sessionStorage.removeItem('hse_session_id');
                            AppState.isPageRefresh = false;
                            return false;
                        }

                        if (foundUser && foundUser.isOnline === true && foundUser.activeSessionId && !AppState.isPageRefresh) {
                            if (foundUser.activeSessionId !== currentSessionId) {
                                Utils.safeWarn('⚠️ المستخدم متصل من جهاز آخر - لا يمكن استعادة الجلسة من localStorage');
                                localStorage.removeItem('hse_remember_user');
                                sessionStorage.removeItem('hse_session_id');
                                AppState.isPageRefresh = false;
                                return false;
                            }
                        }

                        if (user.sessionId && currentSessionId && user.sessionId !== currentSessionId) {
                            Utils.safeWarn('⚠️ معرف الجلسة في localStorage غير متطابق - مسح الجلسة القديمة');
                            localStorage.removeItem('hse_remember_user');
                            AppState.isPageRefresh = false;
                            return false;
                        }

                        // نقبل المستخدم حتى لو لم نجده في قاعدة البيانات
                        if (foundUser) {
                            // استخدام بيانات المستخدم الكاملة من قاعدة البيانات
                            // ✅ الحل الجذري: التأكد من وجود name صحيح
                            // ✅ إصلاح: استخدام الاسم فقط (وليس email)
                            let mergedName = (foundUser.name || foundUser.displayName || '').trim();
                            
                            // ✅ إذا كان mergedName فارغ أو "النظام"، نستخدم "مستخدم" كبديل
                            if (!mergedName || mergedName === 'النظام' || mergedName === '') {
                                mergedName = 'مستخدم';
                            }
                            
                            AppState.currentUser = {
                                ...user,
                                ...foundUser,
                                name: mergedName, // ✅ استخدام mergedName
                                passwordHash: foundUser.passwordHash || user.passwordHash,
                                password: '***', // إخفاء كلمة المرور
                                loginTime: user.loginTime || AppState.currentUser?.loginTime // الحفاظ على وقت تسجيل الدخول
                            };
                            
                            console.log('✅ [AUTH] AppState.currentUser.name بعد الاستعادة (localStorage):', AppState.currentUser.name);
                            
                            // ✅ إصلاح: تحديث الجلسة بالبيانات الجديدة من قاعدة البيانات
                            this.updateUserSession();
                        } else {
                            // استخدام بيانات المستخدم من localStorage
                            AppState.currentUser = {
                                ...user,
                                name: (user.name || user.displayName || '').trim() || user.email || user.id || ''
                            };
                            Utils.safeLog('⚠️ استخدام بيانات المستخدم من localStorage (لم يُعثر عليه في قاعدة البيانات بعد)');
                            
                            // ✅ إصلاح: محاولة تحديث الجلسة بعد تحميل البيانات (إذا لم تكن محملة بعد)
                            // استخدام نفس آلية retry المحسّنة
                            if (!AppState._sessionUpdateScheduled) {
                                AppState._sessionUpdateScheduled = true;
                                let retryCount = 0;
                                const maxRetries = 5; // الحد الأقصى للمحاولات
                                
                                const checkAndUpdateSession = () => {
                                    retryCount++;
                                    
                                    // ✅ إصلاح: التحقق من عدم تجاوز الحد الأقصى للمحاولات
                                    if (retryCount > maxRetries) {
                                        AppState._sessionUpdateScheduled = false;
                                        Utils.safeWarn('⚠️ تم تجاوز الحد الأقصى لمحاولات تحديث الجلسة');
                                        return;
                                    }
                                    
                                    const users = AppState.appData.users || [];
                                    const dbUser = users.find(u => u.email && u.email.toLowerCase() === user.email.toLowerCase());
                                    
                                    if (dbUser) {
                                        // تم العثور على المستخدم - تحديث الجلسة
                                        // ✅ إصلاح: الحفاظ على جميع البيانات المهمة من الجلسة الحالية
                                        const mergedName = (dbUser.name || dbUser.displayName || '').trim() || user.email || user.name || '';
                                        
                                        AppState.currentUser = {
                                            ...user, // الحفاظ على بيانات الجلسة الأصلية
                                            ...dbUser, // دمج بيانات قاعدة البيانات
                                            name: mergedName,
                                            passwordHash: dbUser.passwordHash || user.passwordHash,
                                            password: '***',
                                            loginTime: user.loginTime || AppState.currentUser?.loginTime, // الحفاظ على وقت تسجيل الدخول
                                            id: dbUser.id || user.id || AppState.currentUser?.id // الحفاظ على ID
                                        };
                                        
                                        console.log('✅ [AUTH] AppState.currentUser.name بعد التحديث التلقائي (localStorage):', AppState.currentUser.name);
                                        
                                        // تحديث الجلسة فقط إذا كانت هناك تغييرات فعلية
                                        this.updateUserSession();
                                        AppState._sessionUpdateScheduled = false;
                                        Utils.safeLog(`✅ تم تحديث الجلسة بعد تحميل بيانات المستخدمين (محاولة ${retryCount})`);
                                    } else {
                                        // لم يتم العثور بعد - إعادة المحاولة بعد قليل
                                        if (retryCount < maxRetries) {
                                            const delay = Math.min(500 * retryCount, 1500); // تقليل التأخير التدريجي
                                            setTimeout(checkAndUpdateSession, delay);
                                        } else {
                                            AppState._sessionUpdateScheduled = false;
                                            Utils.safeWarn('⚠️ لم يتم العثور على المستخدم في قاعدة البيانات بعد عدة محاولات');
                                        }
                                    }
                                };
                                
                                // محاولة فورية أولاً
                                setTimeout(checkAndUpdateSession, 250);
                            }
                        }
                        
                        // حفظ في sessionStorage أيضاً
                        const safeUserData = {
                            email: AppState.currentUser.email,
                            name: AppState.currentUser.name,
                            role: AppState.currentUser.role,
                            department: AppState.currentUser.department,
                            permissions: AppState.currentUser.permissions,
                            id: AppState.currentUser.id,
                            loginTime: AppState.currentUser.loginTime,
                            photo: AppState.currentUser.photo || ''
                        };
                        sessionStorage.setItem('hse_current_session', JSON.stringify(safeUserData));
                        Utils.safeLog('✅ تم استعادة الجلسة من localStorage - المستخدم مسجل دخول');
                        return true;
                    }
                } catch (e) {
                    Utils.safeWarn('⚠️ خطأ في تحليل بيانات localStorage:', e);
                    // لا نمسح الجلسة هنا - قد تكون مشكلة مؤقتة
                }
            }
        } catch (error) {
            Utils.safeError('خطأ في التحقق من المستخدم:', error);
        }
        AppState.isPageRefresh = false;
        return false;
    },

    /**
     * تحديث جلسة المستخدم الحالي (مفيد عند تحديث الصلاحيات)
     * يقوم بتحديث sessionStorage و localStorage بالبيانات الجديدة من قاعدة البيانات
     * ✅ إصلاح: منع الاستدعاءات المتكررة غير الضرورية
     */
    updateUserSession() {
        if (!AppState.currentUser || !AppState.currentUser.email) {
            Utils.safeWarn('⚠️ لا يوجد مستخدم حالي لتحديث الجلسة');
            return false;
        }

        // ✅ إصلاح: منع الاستدعاءات المتكررة غير الضرورية
        const now = Date.now();
        const lastUpdate = AppState._lastSessionUpdate || 0;
        const UPDATE_THROTTLE = 500; // 500ms - الحد الأدنى بين التحديثات
        
        if (now - lastUpdate < UPDATE_THROTTLE) {
            if (AppState.debugMode) {
                Utils.safeLog('ℹ️ تم تخطي تحديث الجلسة (throttle)');
            }
            return false;
        }
        
        // إذا كان هناك تحديث قيد التنفيذ، ننتظر
        if (AppState._sessionUpdateInProgress) {
            if (AppState.debugMode) {
                Utils.safeLog('ℹ️ تحديث الجلسة قيد التنفيذ - انتظار...');
            }
            return false;
        }
        
        AppState._sessionUpdateInProgress = true;
        AppState._lastSessionUpdate = now;

        try {
            // البحث عن المستخدم في قاعدة البيانات للحصول على أحدث البيانات
            const email = AppState.currentUser.email.toLowerCase();
            const users = AppState.appData.users || [];
            const dbUser = users.find(u => u.email && u.email.toLowerCase() === email);

            if (!dbUser) {
                Utils.safeWarn('⚠️ المستخدم غير موجود في قاعدة البيانات');
                return false;
            }

            // ✅ إصلاح: تطبيع الصلاحيات قبل التحديث
            // ✅ حماية من فقد الصلاحيات: إذا كانت permissions غير موجودة/فارغة في قاعدة البيانات نحتفظ بصلاحيات الجلسة الحالية
            const rawDbPerms = dbUser.permissions;
            const dbPermsIsMissing =
                rawDbPerms == null ||
                (typeof rawDbPerms === 'string' && rawDbPerms.trim() === '');

            const normalizedPermissions = !dbPermsIsMissing
                ? (typeof Permissions !== 'undefined' && typeof Permissions.normalizePermissions === 'function'
                    ? Permissions.normalizePermissions(rawDbPerms)
                    : (rawDbPerms || {}))
                : (AppState.currentUser.permissions || {});
            
            // ✅ إصلاح: التأكد من أن الصلاحيات المطبعة هي كائن صالح
            const finalPermissions = (normalizedPermissions && typeof normalizedPermissions === 'object' && !Array.isArray(normalizedPermissions))
                ? normalizedPermissions
                : (!dbPermsIsMissing && rawDbPerms && typeof rawDbPerms === 'object' && !Array.isArray(rawDbPerms))
                    ? rawDbPerms
                    : (AppState.currentUser.permissions && typeof AppState.currentUser.permissions === 'object' && !Array.isArray(AppState.currentUser.permissions))
                        ? AppState.currentUser.permissions
                        : {};
            
            // تحديث AppState.currentUser بالبيانات الجديدة من قاعدة البيانات
            // ✅ الحل الجذري: التأكد من وجود name صحيح عند التحديث
            // ✅ إصلاح: استخدام الاسم فقط من قاعدة البيانات (وليس email)
            let updatedName = (dbUser.name || dbUser.displayName || '').trim();
            
            // ✅ إذا كان updatedName فارغ أو "النظام"، نستخدم AppState.currentUser.name
            if (!updatedName || updatedName === 'النظام' || updatedName === '') {
                updatedName = (AppState.currentUser.name || '').toString().trim();
            }
            
            // ✅ إذا كان updatedName لا يزال فارغ، نستخدم "مستخدم" كبديل
            if (!updatedName || updatedName === 'النظام' || updatedName === '') {
                updatedName = 'مستخدم';
            }
            
            AppState.currentUser = {
                ...AppState.currentUser,
                name: updatedName, // ✅ استخدام updatedName بدلاً من dbUser.name مباشرة
                role: dbUser.role || AppState.currentUser.role,
                department: dbUser.department || AppState.currentUser.department,
                // ✅ الحفاظ/تحديث حقول المصنع/الموقع الفرعي من قاعدة البيانات إن وُجدت
                factory: dbUser.factory || dbUser.factoryId || dbUser.plant || dbUser.siteId || dbUser.site || dbUser.location || AppState.currentUser.factory || '',
                factoryId: dbUser.factoryId || dbUser.factory || dbUser.plantId || dbUser.siteId || AppState.currentUser.factoryId || '',
                factoryName: dbUser.factoryName || dbUser.plantName || dbUser.siteName || dbUser.locationName || AppState.currentUser.factoryName || '',
                subLocation: dbUser.subLocation || dbUser.subLocationId || dbUser.subSite || dbUser.subsite || dbUser.placeId || dbUser.place || dbUser.branch || AppState.currentUser.subLocation || '',
                subLocationId: dbUser.subLocationId || dbUser.placeId || dbUser.subLocation || AppState.currentUser.subLocationId || '',
                subLocationName: dbUser.subLocationName || dbUser.placeName || dbUser.subSiteName || dbUser.subsiteName || AppState.currentUser.subLocationName || '',
                branch: dbUser.branch || dbUser.branchName || AppState.currentUser.branch || '',
                permissions: finalPermissions, // استخدام الصلاحيات المطبعة والمدققة
                active: dbUser.active !== undefined ? dbUser.active : AppState.currentUser.active,
                photo: dbUser.photo || AppState.currentUser.photo,
                id: dbUser.id || AppState.currentUser.id, // الحفاظ على ID
                loginTime: AppState.currentUser.loginTime // الحفاظ على وقت تسجيل الدخول
            };
            
            console.log('✅ [AUTH] AppState.currentUser.name بعد التحديث:', AppState.currentUser.name);

            // ✅ إصلاح: حفظ الجلسة بشكل آمن (بدون passwordHash)
            // التأكد من أن الصلاحيات هي كائن صالح قبل الحفظ
            const permissionsToSave = (AppState.currentUser.permissions && 
                                       typeof AppState.currentUser.permissions === 'object' && 
                                       !Array.isArray(AppState.currentUser.permissions))
                ? AppState.currentUser.permissions
                : {};
            
            const safeUserData = {
                email: AppState.currentUser.email,
                name: AppState.currentUser.name,
                role: AppState.currentUser.role,
                department: AppState.currentUser.department,
                factory: AppState.currentUser.factory || AppState.currentUser.factoryId || '',
                factoryId: AppState.currentUser.factoryId || AppState.currentUser.factory || '',
                factoryName: AppState.currentUser.factoryName || '',
                subLocation: AppState.currentUser.subLocation || AppState.currentUser.subLocationId || '',
                subLocationId: AppState.currentUser.subLocationId || AppState.currentUser.subLocation || '',
                subLocationName: AppState.currentUser.subLocationName || '',
                branch: AppState.currentUser.branch || '',
                permissions: permissionsToSave, // استخدام الصلاحيات المدققة
                id: AppState.currentUser.id,
                loginTime: AppState.currentUser.loginTime,
                photo: AppState.currentUser.photo || '' // ✅ حفظ الصورة لاستعادتها عند فتح الصفحة
            };

            // تحديث sessionStorage
            sessionStorage.setItem('hse_current_session', JSON.stringify(safeUserData));
            Utils.safeLog('✅ تم تحديث الجلسة في sessionStorage');

            // تحديث localStorage إذا كان موجوداً (تذكرني)
            const remembered = localStorage.getItem('hse_remember_user');
            if (remembered) {
                localStorage.setItem('hse_remember_user', JSON.stringify(safeUserData));
                Utils.safeLog('✅ تم تحديث الجلسة في localStorage');
            }

            // تحديث صورة المستخدم في الواجهة
            if (typeof UI !== 'undefined' && typeof UI.updateUserProfilePhoto === 'function') {
                UI.updateUserProfilePhoto();
            }

            // تحديث القائمة الجانبية حسب الصلاحيات الجديدة
            if (typeof Permissions !== 'undefined' && typeof Permissions.updateNavigation === 'function') {
                Permissions.updateNavigation();
                Utils.safeLog('✅ تم تحديث القائمة الجانبية حسب الصلاحيات الجديدة');
            }

            AppState._sessionUpdateInProgress = false;
            return true;
        } catch (error) {
            Utils.safeError('❌ خطأ في تحديث الجلسة:', error);
            AppState._sessionUpdateInProgress = false;
            return false;
        }
    },

    /**
     * تغيير كلمة المرور
     */
    async changePassword(email, currentPassword, newPassword) {
        Utils.safeLog('🔑 بدء تغيير كلمة المرور:', { email, currentPasswordLength: currentPassword?.length, newPasswordLength: newPassword?.length });

        if (!email || !currentPassword || !newPassword) {
            Utils.safeWarn(' بيانات ناقصة');
            return false;
        }

        email = email.trim().toLowerCase();

        // البحث عن المستخدم في قاعدة البيانات
        const user = AppState.appData.users.find(u => {
            if (!u || !u.email) return false;
            return u.email.toLowerCase().trim() === email;
        });

        if (!user) {
            Utils.safeWarn(' المستخدم غير موجود:', email);
            return false;
        }

        // إزالة دعم كلمات المرور النصية - الأمان يتطلب التشفير فقط
        const storedHash = (user.passwordHash || '').trim();

        if (!storedHash || storedHash === '***' || !Utils.isSha256Hex(storedHash)) {
            Utils.safeWarn('⚠️ المستخدم لديه كلمة مرور غير مشفرة - يجب إعادة تعيينها');
            Notification.error('يجب إعادة تعيين كلمة المرور. يرجى الاتصال بالمدير.');
            return false;
        }

        // التحقق من كلمة المرور المشفرة فقط
        const currentHash = await Utils.hashPassword(currentPassword);
        const isValidPassword = currentHash.toLowerCase() === storedHash.toLowerCase();

        if (!isValidPassword) {
            Utils.safeWarn(' كلمة المرور الحالية غير صحيحة');
            return false;
        }

        // تحديث كلمة المرور
        const newHash = await Utils.hashPassword(newPassword);
        user.password = '***';
        user.passwordHash = newHash;
        user.passwordChanged = true;
        user.forcePasswordChange = false;
        user.updatedAt = new Date().toISOString();

        if (AppState.currentUser && AppState.currentUser.email === email) {
            AppState.currentUser.passwordHash = newHash;
            AppState.currentUser.passwordChanged = true;
            AppState.currentUser.forcePasswordChange = false;
        }

        // حظ ي قاعدة البيانات
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            await window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }

        // حفظ في Google Sheets إذا كان معّلاً
        if (AppState.googleConfig && AppState.googleConfig.appsScript && AppState.googleConfig.appsScript.enabled && AppState.googleConfig.sheets && AppState.googleConfig.sheets.spreadsheetId) {
            try {
                await GoogleIntegration.autoSave('Users', AppState.appData.users);
                Utils.safeLog('✅ تم حفظ كلمة المرور الجديدة في Google Sheets');
            } catch (error) {
                Utils.safeWarn('⚠ فشل حظ كلمة المرور ي Google Sheets:', error);
            }
        }

        Utils.safeLog('✅ تم تغيير كلمة المرور بنجاح');
        return true;
    },

    /**
     * تحميل بيانات الموديولات بشكل متسلسل حسب الصلاحيات
     * يتم تحميل البيانات بشكل متتالي لضمان عدم فقدان أي بيانات
     */
    async loadModulesDataSequentially() {
        if (!AppState.googleConfig?.appsScript?.enabled || typeof GoogleIntegration === 'undefined') {
            return;
        }

        try {
            Utils.safeLog('🔄 بدء تحميل بيانات الموديولات حسب الصلاحيات...');

            // الحصول على الموديولات المسموح بها للمستخدم
            const accessibleModules = typeof Permissions !== 'undefined' && typeof Permissions.getAccessibleModules === 'function'
                ? Permissions.getAccessibleModules(true)
                : [];

            // إذا كان المستخدم admin، نحمّل جميع الموديولات
            const isAdmin = AppState.currentUser?.role === 'admin';
            const modulesToLoad = isAdmin ? [
                'incidents', 'nearmiss', 'ptw', 'training', 'clinic', 'fire-equipment',
                'ppe', 'violations', 'behavior-monitoring', 'chemical-safety',
                'daily-observations', 'iso', 'emergency', 'safety-budget',
                'action-tracking', 'change-management', 'hse', 'safety-performance-kpis', 'sustainability',
                'risk-assessment', 'legal-documents', 'safety-health-management',
                'sop-jha', 'periodic-inspections'
            ] : accessibleModules;

            if (modulesToLoad.length === 0) {
                Utils.safeLog('ℹ️ لا توجد موديولات مسموح بها للمستخدم');
                return;
            }

            // خريطة الموديولات وأوراق Google Sheets الخاصة بها
            const moduleSheetsMap = {
                'incidents': ['Incidents'],
                'nearmiss': ['NearMiss'],
                'ptw': ['PTW', 'PTWRegistry'],
                'training': ['Training'],
                'clinic': ['ClinicVisits', 'Medications', 'SickLeave', 'Injuries', 'ClinicInventory'],
                'fire-equipment': ['FireEquipment', 'FireEquipmentAssets', 'FireEquipmentInspections'],
                'ppe': ['PPE'],
                'violations': ['Violations', 'ViolationTypes', 'Blacklist_Register'],
                'behavior-monitoring': ['BehaviorMonitoring'],
                'chemical-safety': ['ChemicalSafety', 'Chemical_Register'],
                'daily-observations': ['DailyObservations'],
                'iso': ['ISODocuments', 'ISOProcedures', 'ISOForms', 'HSEAudits'],
                'emergency': ['EmergencyAlerts', 'EmergencyPlans', 'EmergencyPlansUpdates'],
                'safety-budget': ['SafetyBudgets', 'SafetyBudgetTransactions'],
                'action-tracking': ['ActionTrackingRegister', 'HSECorrectiveActions', 'HSENonConformities', 'HSEObjectives'],
                'change-management': ['ChangeRequests'],
                'hse': ['HSENonConformities', 'HSECorrectiveActions'],
                'safety-performance-kpis': ['SafetyPerformanceKPIs', 'SafetyTeamKPIs'],
                'sustainability': ['Sustainability', 'EnvironmentalAspects', 'EnvironmentalMonitoring', 'CarbonFootprint', 'WasteManagement', 'EnergyEfficiency', 'WaterManagement', 'RecyclingPrograms'],
                'risk-assessment': ['RiskAssessments', 'HSERiskAssessments'],
                'legal-documents': ['LegalDocuments'],
                'safety-health-management': ['SafetyTeamMembers', 'SafetyOrganizationalStructure', 'SafetyJobDescriptions', 'SafetyTeamKPIs', 'SafetyTeamAttendance', 'SafetyTeamLeaves', 'SafetyTeamTasks'],
                'sop-jha': ['SOPJHA'],
                'periodic-inspections': ['PeriodicInspectionCategories', 'PeriodicInspectionRecords', 'PeriodicInspectionSchedules', 'PeriodicInspectionChecklists']
            };

            // خريطة مفاتيح المزامنة في localStorage لكل موديول (لمنع إعادة التحميل عند فتح الموديول)
            const moduleSyncKeyMap = {
                'clinic': 'clinic_last_sync',
                'violations': 'violations_last_sync',
                'periodic-inspections': 'periodic_inspections_last_sync',
                'training': 'training_last_sync',
                'chemical-safety': 'chemical_safety_last_sync',
                'daily-observations': 'daily_observations_last_sync',
            };

            // خريطة أوراق Google Sheets إلى مفاتيح AppState
            const sheetToKeyMap = {
                'Incidents': 'incidents',
                // key in AppState is `nearmiss` (not `nearMiss`)
                'NearMiss': 'nearmiss',
                'PTW': 'ptw',
                'PTWRegistry': 'ptwRegistry',
                'Training': 'training',
                'ClinicVisits': 'clinicVisits',
                'Medications': 'medications',
                'SickLeave': 'sickLeave',
                'Injuries': 'injuries',
                'ClinicInventory': 'clinicInventory',
                'FireEquipment': 'fireEquipment',
                'FireEquipmentAssets': 'fireEquipmentAssets',
                'FireEquipmentInspections': 'fireEquipmentInspections',
                'PPE': 'ppe',
                'Violations': 'violations',
                'ViolationTypes': 'violationTypes',
                'Blacklist_Register': 'blacklistRegister',
                'BehaviorMonitoring': 'behaviorMonitoring',
                'ChemicalSafety': 'chemicalSafety',
                'Chemical_Register': 'chemicalRegister',
                'DailyObservations': 'dailyObservations',
                'ISODocuments': 'isoDocuments',
                'ISOProcedures': 'isoProcedures',
                'ISOForms': 'isoForms',
                'HSEAudits': 'hseAudits',
                'EmergencyAlerts': 'emergencyAlerts',
                'EmergencyPlans': 'emergencyPlans',
                'EmergencyPlansUpdates': 'emergencyPlansUpdates',
                'SafetyBudgets': 'safetyBudgets',
                'SafetyBudgetTransactions': 'safetyBudgetTransactions',
                'ActionTrackingRegister': 'actionTrackingRegister',
                'ChangeRequests': 'changeRequests',
                'HSECorrectiveActions': 'hseCorrectiveActions',
                'HSENonConformities': 'hseNonConformities',
                'HSEObjectives': 'hseObjectives',
                'SafetyPerformanceKPIs': 'safetyPerformanceKPIs',
                'SafetyTeamKPIs': 'safetyTeamKPIs',
                'Sustainability': 'sustainability',
                'EnvironmentalAspects': 'environmentalAspects',
                'EnvironmentalMonitoring': 'environmentalMonitoring',
                'CarbonFootprint': 'carbonFootprint',
                'WasteManagement': 'wasteManagement',
                'EnergyEfficiency': 'energyEfficiency',
                'WaterManagement': 'waterManagement',
                'RecyclingPrograms': 'recyclingPrograms',
                'RiskAssessments': 'riskAssessments',
                'HSERiskAssessments': 'hseRiskAssessments',
                'LegalDocuments': 'legalDocuments',
                'SafetyTeamMembers': 'safetyTeamMembers',
                'SafetyOrganizationalStructure': 'safetyOrganizationalStructure',
                'SafetyJobDescriptions': 'safetyJobDescriptions',
                'SafetyTeamAttendance': 'safetyTeamAttendance',
                'SafetyTeamLeaves': 'safetyTeamLeaves',
                'SafetyTeamTasks': 'safetyTeamTasks',
                'SOPJHA': 'sopjha',
                'PeriodicInspectionCategories': 'periodicInspectionCategories',
                'PeriodicInspectionRecords': 'periodicInspectionRecords',
                'PeriodicInspectionSchedules': 'periodicInspectionSchedules',
                'PeriodicInspectionChecklists': 'periodicInspectionChecklists'
            };

            const PRELOAD_CACHE_TTL_MS = 10 * 60 * 1000;
            const PER_SHEET_TIMEOUT_MS = 7000;
            const GLOBAL_PRELOAD_BUDGET_MS = 55000;
            const preloadStartedAt = Date.now();

            const isModuleFreshInCache = (moduleName, sheets) => {
                const syncKey = moduleSyncKeyMap[moduleName];
                if (!syncKey || !Array.isArray(sheets) || sheets.length === 0) return false;
                const lastSyncRaw = localStorage.getItem(syncKey);
                const lastSync = Number(lastSyncRaw || 0);
                if (!lastSync || (Date.now() - lastSync) > PRELOAD_CACHE_TTL_MS) return false;

                // نتجاوز التحميل فقط لو عندنا بيانات محلية حقيقية لجميع الأوراق
                return sheets.every((sheetName) => {
                    const key = sheetToKeyMap[sheetName];
                    const arr = key ? AppState.appData[key] : null;
                    return Array.isArray(arr) && arr.length > 0;
                });
            };

            const processModule = async (moduleName) => {
                try {
                    const sheets = moduleSheetsMap[moduleName] || [];

                    if (sheets.length === 0) {
                        Utils.safeLog(`⚠️ لا توجد أوراق Google Sheets للموديول: ${moduleName}`);
                        return;
                    }
                    if (isModuleFreshInCache(moduleName, sheets)) {
                        if (AppState.debugMode) {
                            Utils.safeLog(`⚡ تخطي تحميل ${moduleName}: البيانات محلية ومحدثة`);
                        }
                        return;
                    }

                    // ✅ تحسين: تحميل جميع أوراق الموديول بشكل متوازي لتسريع العملية
                    const sheetPromises = sheets.map(async (sheetName) => {
                        try {
                            const data = await GoogleIntegration.readFromSheets(sheetName, PER_SHEET_TIMEOUT_MS);
                            const key = sheetToKeyMap[sheetName];
                            
                            if (key && Array.isArray(data)) {
                                // ✅ تحسين: التحقق من أن البيانات الجديدة صالحة قبل الاستبدال
                                const oldData = AppState.appData[key] || [];
                                
                                // إذا كانت البيانات الجديدة فارغة والبيانات القديمة تحتوي على بيانات، نستخدم القديمة
                                if (data.length === 0 && oldData.length > 0) {
                                    Utils.safeLog(`⚠️ ${sheetName} (${moduleName}): البيانات الجديدة فارغة - الاحتفاظ بالبيانات الحالية (${oldData.length} سجل)`);
                                    return { sheetName, key, success: true, data: oldData, kept: true };
                                }
                                
                                AppState.appData[key] = data;
                                Utils.safeLog(`✅ تم تحميل ${sheetName} (${moduleName}): ${data.length} سجل`);
                                return { sheetName, key, success: true, data, kept: false };
                            } else if (key) {
                                // ✅ تحسين: إذا لم تكن البيانات مصفوفة، نستخدم البيانات القديمة
                                const oldData = AppState.appData[key] || [];
                                if (oldData.length > 0) {
                                    Utils.safeWarn(`⚠️ ${sheetName} (${moduleName}): البيانات المستلمة ليست مصفوفة - الاحتفاظ بالبيانات الحالية (${oldData.length} سجل)`);
                                    return { sheetName, key, success: false, error: 'البيانات ليست مصفوفة', kept: true };
                                } else {
                                    AppState.appData[key] = [];
                                    Utils.safeWarn(`⚠️ ${sheetName} (${moduleName}): البيانات ليست مصفوفة ولا توجد بيانات قديمة`);
                                    return { sheetName, key, success: false, error: 'البيانات ليست مصفوفة', kept: false };
                                }
                            }
                            return { sheetName, key, success: false, error: 'لا يوجد key للورقة' };
                        } catch (error) {
                            const key = sheetToKeyMap[sheetName];
                            const errorMsg = error?.message || String(error);
                            
                            // استخدام البيانات المحلية إذا فشل التحميل
                            if (key && Array.isArray(AppState.appData[key]) && AppState.appData[key].length > 0) {
                                Utils.safeLog(`⚠️ ${sheetName} (${moduleName}): فشل التحميل (${errorMsg}) - استخدام ${AppState.appData[key].length} سجل محلي`);
                                return { sheetName, key, success: false, error: errorMsg, kept: true };
                            } else {
                                Utils.safeWarn(`⚠️ ${sheetName} (${moduleName}): فشل التحميل ولا توجد بيانات محلية`);
                                return { sheetName, key, success: false, error: errorMsg, kept: false };
                            }
                        }
                    });
                    
                    // انتظار اكتمال تحميل جميع الأوراق
                    const sheetResults = await Promise.allSettled(sheetPromises);
                    
                    // ✅ تحسين: تسجيل النتائج والتحقق من الموديولات الفارغة
                    let emptySheets = [];
                    sheetResults.forEach((result, index) => {
                        if (result.status === 'fulfilled') {
                            const res = result.value;
                            if (res && res.key) {
                                const data = AppState.appData[res.key] || [];
                                if (data.length === 0 && !res.kept) {
                                    emptySheets.push(res.sheetName);
                                }
                            }
                        }
                    });
                    
                    // ✅ إصلاح: إزالة المرجع للمتغير غير المعرّف silent - تسجيل التحذير دائماً إذا كانت هناك أوراق فارغة
                    if (emptySheets.length > 0) {
                        Utils.safeWarn(`⚠️ الموديول ${moduleName} يحتوي على ${emptySheets.length} ورقة فارغة: ${emptySheets.join(', ')}`);
                    }

                    // ✅ تعيين وقت آخر مزامنة للموديول في localStorage لمنع إعادة التحميل عند فتح الموديول
                    const syncKey = moduleSyncKeyMap[moduleName];
                    if (syncKey) {
                        try { localStorage.setItem(syncKey, String(Date.now())); } catch (lsErr) {}
                    }
                } catch (error) {
                    Utils.safeWarn(`⚠️ فشل تحميل بيانات الموديول ${moduleName}:`, error);
                }
            };

            // تحميل الموديولات على دفعات متوازية لتقليل زمن التحميل الكلي
            const moduleConcurrency = 8;
            for (let i = 0; i < modulesToLoad.length; i += moduleConcurrency) {
                if ((Date.now() - preloadStartedAt) >= GLOBAL_PRELOAD_BUDGET_MS) {
                    Utils.safeWarn('⏱️ تم الوصول للحد الزمني للتحميل الخلفي (55s) - استكمال التحميل عند فتح الموديول');
                    break;
                }
                const chunk = modulesToLoad.slice(i, i + moduleConcurrency);
                await Promise.allSettled(chunk.map(processModule));
            }

            // حفظ جميع البيانات بعد اكتمال التحميل
            if (typeof DataManager !== 'undefined' && DataManager.save) {
                DataManager.save();
            }

            Utils.safeLog('✅ اكتمل تحميل بيانات جميع الموديولات المسموح بها');
            
            // تحديث الواجهة مباشرة بعد اكتمال تحميل بيانات الموديولات
            // لضمان ظهور البيانات في الموديولات بدون انتظار الضغط اليدوي على زر التحميل.
            try {
                if (typeof window !== 'undefined' &&
                    window.UI &&
                    typeof window.UI.refreshCurrentSection === 'function') {
                    window.UI.refreshCurrentSection(true); // silent = true
                }
            } catch (uiError) {
                Utils.safeWarn('⚠️ فشل تحديث الواجهة بعد تحميل الموديولات:', uiError);
            }
        } catch (error) {
            Utils.safeError('❌ خطأ في تحميل بيانات الموديولات:', error);
        }
    },

    async resetPassword(email, newPassword = null) {
        if (!email || !Utils.isValidEmail(email)) {
            Notification.error('يرجى إدخال بريد إلكتروني صحيح');
            return { success: false, message: 'يرجى إدخال بريد إلكتروني صحيح' };
        }

        email = email.trim().toLowerCase();

        // البحث في قاعدة بيانات المستخدمين
        const user = AppState.appData.users.find(u => {
            if (!u || !u.email) return false;
            return u.email.toLowerCase().trim() === email;
        });

        if (!user) {
            Notification.error('البريد الإلكتروني غير مسجل في النظام');
            return { success: false, message: 'البريد الإلكتروني غير مسجل في النظام' };
        }

        // إنشاء كلمة مرور مؤقتة إذا لم يتم تحديد واحدة
        let tempPassword = newPassword;
        if (!tempPassword) {
            // إنشاء كلمة مرور مؤقتة قوية
            const randomPart = Math.random().toString(36).substring(2, 10);
            const timestamp = Date.now().toString(36).substring(5, 9);
            tempPassword = 'Temp' + randomPart + timestamp + '!';
        }

        // تحديث كلمة المرور
        const hashedTemp = await Utils.hashPassword(tempPassword);
        user.password = '***';
        user.passwordHash = hashedTemp;
        user.passwordChanged = false;
        user.forcePasswordChange = true;
        user.updatedAt = new Date().toISOString();

        // حفظ التغييرات محلياً
        // حفظ البيانات باستخدام window.DataManager
        if (typeof window.DataManager !== 'undefined' && window.DataManager.save) {
            await window.DataManager.save();
        } else {
            Utils.safeWarn('⚠️ DataManager غير متاح - لم يتم حفظ البيانات');
        }

        // تحديث المستخدم الحالي إذا كان هو نفسه
        if (AppState.currentUser && AppState.currentUser.email && AppState.currentUser.email.toLowerCase().trim() === email) {
            AppState.currentUser.passwordHash = hashedTemp;
            AppState.currentUser.passwordChanged = false;
            AppState.currentUser.forcePasswordChange = true;
        }

        // حفظ تلقائياً في Google Sheets
        try {
            if (AppState.googleConfig.appsScript.enabled && AppState.googleConfig.appsScript.scriptUrl) {
                // استخدام resetUserPassword في Backend أولاً
                let result = await GoogleIntegration.sendToAppsScript('resetUserPassword', {
                    userId: user.id,
                    email: user.email,
                    newPassword: tempPassword
                });

                if (result && result.success) {
                    Utils.safeLog('✅ تم تحديث كلمة المرور في Google Sheets بنجاح');
                    // استخدام كلمة المرور المؤقتة من Backend إذا كانت متاحة
                    if (result.tempPassword) {
                        tempPassword = result.tempPassword;
                    }
                } else {
                    // إذا فشل، نحاول updateUser
                    result = await GoogleIntegration.sendToAppsScript('updateUser', {
                        userId: user.id,
                        updateData: {
                            passwordHash: hashedTemp,
                            passwordChanged: false,
                            forcePasswordChange: true,
                            updatedAt: user.updatedAt
                        }
                    });

                    if (result && result.success) {
                        Utils.safeLog('✅ تم تحديث كلمة المرور في Google Sheets بنجاح (عبر updateUser)');
                    } else {
                        // إذا فشل، نحاول autoSave
                        await GoogleIntegration.autoSave('Users', AppState.appData.users);
                    }
                }
            }
        } catch (error) {
            Utils.safeWarn('⚠ فشل تحديث كلمة المرور في Google Sheets:', error);
            // نحاول autoSave كبديل
            try {
                await GoogleIntegration.autoSave('Users', AppState.appData.users);
            } catch (autoSaveError) {
                Utils.safeWarn('⚠ فشل autoSave أيضاً:', autoSaveError);
            }
        }

        Utils.safeLog(`✅ تم إعادة تعيين كلمة المرور للمستخدم: ${email}`);
        return {
            success: true,
            message: 'تم إعادة تعيين كلمة المرور بنجاح',
            tempPassword: tempPassword // إرجاع كلمة المرور المؤقتة للمدير
        };
    }
};

// تصدير Auth للتوافق مع الكود القديم
if (typeof window !== 'undefined') {
    window.Auth = window.Auth || Auth;
}
