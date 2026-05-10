/**
 * إتمام تسجيل الدخول بعد التحقق من كلمة المرور أو Supabase Auth.
 * يُحمَّل قبل auth.js — يعرّف window.__hseRunCompleteLoginFlow
 */
(function () {
    window.__hseRunCompleteLoginFlow = async function (authApi, args) {
        const email = args.email;
        const password = args.password;
        const remember = args.remember;
        let user = args.user;
        let foundUser = args.foundUser;
        const hashedStored = args.hashedStored;
        const users = args.users;
        const canSyncUsers = args.canSyncUsers;
        const needsHashUpdate = args.needsHashUpdate;
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

        const isBootstrap = authApi.isBootstrapEmail(email) && !authApi.isBootstrapDisabled();

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
                    authApi.loadModulesDataSequentially().catch(err => {
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
            isFirstLogin: isFirstLogin,
        };
    };
})();

