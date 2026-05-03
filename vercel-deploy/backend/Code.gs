/**
 * Google Apps Script for HSE System - Main Entry Point
 * 
 * هذا هو الملف الرئيسي الذي يتعامل مع جميع الطلبات
 * 
 * تعليمات الاستخدام:
 * 1. افتح https://script.google.com
 * 2. أنشئ مشروع جديد
 * 3. انسخ جميع الملفات .gs إلى المشروع
 * 4. أنشئ جدول Google Sheets جديد
 * 5. انسخ معرف الجدول من الرابط وأضفه في Config.gs
 * 6. انشر التطبيق: Deploy → New Deployment → Web App
 * 7. اختر "Execute as: Me" و "Who has access: Anyone"
 * 8. انسخ رابط الويب والصقه في إعدادات التطبيق
 * 
 * الملفات المطلوبة:
 * - Config.gs (يحتوي على getSpreadsheetId())
 * - Utils.gs (يحتوي على setCorsHeaders(), saveToSheet(), appendToSheet(), readFromSheet(), initializeSheets())
 * - Users.gs (يحتوي على addUserToSheet(), updateUserInSheet())
 * - SafetyHealthManagement.gs (يحتوي على دوال إدارة السلامة والصحة المهنية)
 * - جميع ملفات الموديولات الأخرى
 */

/**
 * ============================================
 * معالجة طلبات POST
 * ============================================
 */
function doPost(e) {
    // بصمة نسخة واضحة لتأكيد أن الطلب وصل للنسخة الصحيحة
    var BUILD_TAG = 'HSE_WEBAPP_BUILD_2026-01-29_v115';
    Logger.log('🚀 [DOPOST] ===== doPost تم استدعاؤها =====');
    Logger.log('🏷️ [DOPOST] BUILD_TAG: ' + BUILD_TAG);
    Logger.log('🚀 [DOPOST] الوقت: ' + new Date().toISOString());
    
    try {
        // ============================================
        // 1. التحقق من وجود الطلب
        // ============================================
        let postData;
        
        if (!e) {
            Logger.log('Warning: doPost() called but e is null. This may be a CORS preflight or malformed request.');
            const errorResponse = ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'No request data received. Request object is null.',
                errorCode: 'NULL_REQUEST_OBJECT',
                hint: 'الطلب وصل إلى doPost() ولكن بدون بيانات. قد يكون هذا طلب CORS preflight.',
                troubleshooting: {
                    step1: 'إذا كان هذا طلب CORS preflight، فهو متوقع وسيتم إرسال الطلب الفعلي بعد ذلك',
                    step2: 'تحقق من أن الطلب يستخدم POST method بشكل صحيح',
                    step3: 'تأكد من إرسال JSON في body الطلب (ليس فارغاً)',
                    step4: 'تحقق من Content-Type header (يجب أن يكون text/plain;charset=utf-8)',
                    step5: 'تحقق من URL - يجب أن ينتهي بـ /exec وليس /dev',
                    step6: 'أعد نشر Web App إذا استمرت المشكلة',
                    step7: 'افحص Console في المتصفح (F12) لرؤية تفاصيل الطلب المرسل'
                }
            }));
            return setCorsHeaders(errorResponse);
        }
        
        // ============================================
        // 2. التحقق من وجود البيانات في الطلب
        // ============================================
        Logger.log('doPost() called. e keys: ' + Object.keys(e).join(', '));
        if (e.postData) {
            Logger.log('postData type: ' + e.postData.type);
            Logger.log('postData length: ' + (e.postData.contents ? e.postData.contents.length : 0));
        } else {
            Logger.log('postData is missing. e has keys: ' + Object.keys(e).join(', '));
        }
        
        if (!e.postData || !e.postData.contents) {
            Logger.log('Warning: No postData received. e keys: ' + Object.keys(e).join(', '));
            const errorResponse = ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'No data received in request body',
                errorCode: 'NO_DATA',
                hint: 'تأكد من إرسال البيانات في body الطلب بتنسيق JSON. قد يكون هذا طلب CORS preflight.',
                received: {
                    hasPostData: !!e.postData,
                    hasContents: !!(e.postData && e.postData.contents),
                    eKeys: Object.keys(e),
                    parameterKeys: e.parameter ? Object.keys(e.parameter) : []
                },
                troubleshooting: {
                    step1: 'إذا كان هذا طلب CORS preflight، فهو متوقع وسيتم إرسال الطلب الفعلي بعد ذلك',
                    step2: 'تحقق من أن الطلب يستخدم POST method',
                    step3: 'تأكد من إرسال JSON في body الطلب (ليس فارغاً)',
                    step4: 'تحقق من Content-Type header (يجب أن يكون text/plain;charset=utf-8)',
                    step5: 'افحص Console في المتصفح (F12) → Network tab → افحص الطلب المرسل',
                    step6: 'تأكد من أن body يحتوي على JSON صحيح: {"action": "...", "data": {...}}'
                }
            }));
            return setCorsHeaders(errorResponse);
        }
        
        // ============================================
        // 3. تحليل JSON
        // ============================================
        try {
            postData = JSON.parse(e.postData.contents);
        } catch (parseError) {
            Logger.log('Error parsing JSON: ' + parseError.toString());
            Logger.log('Received data (first 200 chars): ' + e.postData.contents.substring(0, 200));
            const errorOutput = ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'Invalid JSON format in request body',
                errorCode: 'JSON_PARSE_ERROR',
                error: parseError.toString(),
                receivedDataPreview: e.postData.contents.substring(0, 200),
                hint: 'تأكد من أن البيانات المرسلة بتنسيق JSON صحيح',
                troubleshooting: {
                    step1: 'تحقق من تنسيق JSON (يجب أن يكون صحيحاً)',
                    step2: 'تأكد من استخدام JSON.stringify() قبل الإرسال',
                    step3: 'تحقق من عدم وجود أحرف خاصة غير صحيحة'
                }
            }));
            return setCorsHeaders(errorOutput);
        }

        // حماية إضافية: حد أقصى لحجم الطلب لتقليل إساءة الاستخدام
        const maxRequestBytes = 1024 * 1024; // 1MB
        if (e.postData.contents.length > maxRequestBytes) {
            Logger.log('Security: Request body too large: ' + e.postData.contents.length + ' bytes');
            return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'حجم الطلب كبير جداً',
                errorCode: 'REQUEST_TOO_LARGE'
            })));
        }

        if (!postData || typeof postData !== 'object' || Array.isArray(postData)) {
            Logger.log('Security: Invalid request envelope type');
            return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'صيغة الطلب غير صحيحة',
                errorCode: 'INVALID_REQUEST_ENVELOPE'
            })));
        }
        
        // ============================================
        // 4. استخراج action و payload
        // ============================================
        let action = postData.action;
        const rawPayload = postData.data || postData;
        const payload = (typeof sanitizeRequestObject === 'function')
            ? sanitizeRequestObject(rawPayload, 0)
            : rawPayload;
        
        // ✅ Debug logging لمعرفة ما يتم استخراجه
        Logger.log('🔍 [CODE.GS] postData.action: ' + JSON.stringify(action));
        Logger.log('🏷️ [CODE.GS] BUILD_TAG: ' + BUILD_TAG);
        Logger.log('🔍 [CODE.GS] postData.data exists: ' + !!postData.data);
        Logger.log('🔍 [CODE.GS] postData.data type: ' + typeof postData.data);
        Logger.log('🔍 [CODE.GS] postData.keys: ' + Object.keys(postData || {}).join(', '));
        Logger.log('🔍 [CODE.GS] payload type: ' + typeof payload);
        Logger.log('🔍 [CODE.GS] payload is null: ' + (payload === null));
        Logger.log('🔍 [CODE.GS] payload is undefined: ' + (payload === undefined));
        Logger.log('🔍 [CODE.GS] payload keys: ' + (payload ? Object.keys(payload).join(', ') : 'N/A'));
        
        // تنظيف action (إزالة المسافات والحروف غير المرئية)
        if (action && typeof action === 'string') {
            action = action.trim();
        }

        // حماية إضافية: تقييد شكل action لمنع القيم غير المتوقعة
        const actionPattern = /^[a-zA-Z][a-zA-Z0-9_]{1,79}$/;
        if (typeof action === 'string' && !actionPattern.test(action)) {
            Logger.log('Security: Invalid action format: ' + action);
            return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'صيغة action غير صالحة',
                errorCode: 'INVALID_ACTION_FORMAT'
            })));
        }
        
        // التحقق من وجود action
        if (!action || typeof action !== 'string' || action === '') {
            Logger.log('Error: No action provided in request. postData keys: ' + Object.keys(postData).join(', '));
            Logger.log('postData content: ' + JSON.stringify(postData).substring(0, 500));
            const errorOutput = ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'يجب تحديد action في الطلب',
                errorCode: 'ACTION_MISSING',
                received: { 
                    action: action, 
                    hasAction: !!action,
                    actionType: typeof action,
                    postDataKeys: Object.keys(postData),
                    postDataPreview: JSON.stringify(postData).substring(0, 200)
                },
                hint: 'تأكد من إرسال action في payload. مثال: {"action": "saveToSheet", "data": {...}}',
                troubleshooting: {
                    step1: 'تحقق من أن payload يحتوي على حقل "action"',
                    step2: 'تأكد من أن action هو string وليس null أو undefined',
                    step3: 'تحقق من تنسيق JSON المرسل',
                    step4: 'راجع Execution Logs في Google Apps Script لمزيد من التفاصيل'
                }
            }));
            return setCorsHeaders(errorOutput);
        }
        
        Logger.log('Processing action: "' + action + '" (length: ' + action.length + ')');
        Logger.log('postData keys: ' + Object.keys(postData).join(', '));
        if (postData.spreadsheetId) {
            Logger.log('spreadsheetId found in postData: ' + postData.spreadsheetId.substring(0, 10) + '...');
        }
        if (payload && payload.spreadsheetId) {
            Logger.log('spreadsheetId found in payload: ' + payload.spreadsheetId.substring(0, 10) + '...');
        }
        
        // ============================================
        // 5. التحقق من CSRF Token (محسن للأمان)
        // ============================================
        const requestToken = postData.csrfToken || '';
        const clientSessionId = String(postData.clientSessionId || (postData.data && postData.data.clientSessionId) || '').trim();
        const userHint = String(
            (postData.userData && (postData.userData.email || postData.userData.id || postData.userData.name)) ||
            (postData.data && postData.data.email) ||
            ''
        ).trim();
        const requestSessionKey = (typeof buildRequestSessionKey === 'function')
            ? buildRequestSessionKey(action, requestToken, clientSessionId, userHint)
            : [action, requestToken, clientSessionId, userHint].join('|');
        const clientRequestedSkipCSRF = postData.skipCSRFCheck === true || postData.skipCSRF === true;
        
        // لا نسمح للعميل بتجاوز CSRF نهائياً
        if (clientRequestedSkipCSRF) {
            Logger.log('Security: Client attempted to bypass CSRF check. action=' + action);
            return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'طلب غير آمن: لا يمكن تجاوز التحقق الأمني',
                errorCode: 'CSRF_BYPASS_REJECTED',
                action: action
            })));
        }
        
        // قائمة بالـ actions التي لا تتطلب CSRF token (عمليات قراءة فقط)
        const readOnlyActions = [
            'readFromSheet', 'getData',
            'batchReadSheets', // ✅ Batch read - read only
            'getSafetyTeamMembers', 'getSafetyTeamMember', 'getOrganizationalStructure',
            'getJobDescription', 'getSafetyTeamKPIs', 'getSafetyHealthManagementSettings',
            'getActionTrackingSettings', 'getAllActionTracking', 'getActionTracking',
            'testConnection',
            'getDocumentCodes', 'getDocumentVersions', 'getDocumentCodeAndVersion',
            // Read-only utility actions
            'getPublicIP',
            // ✅ مؤشر تحديثات المستخدمين (للـ sync الفوري بين الأجهزة)
            'getUsersMeta',
            // ✅ طلبات موافقة - عيادة
            'getAllMedicationDeletionRequests',
            'getAllSupplyRequests',
            'getAllClinicVisitDeletionRequests',
            'getContractorDetailedAnalytics',
            'getAllAppEmergencyNumbers',
            'getAllIssuingAuthorities',
            'getIssuingAuthoritiesForPermitType',
            'getAllContractorIssuingAuthorities',
            'getContractorIssuingAuthoritiesForPermitType',
            'getEmployeeByCode',
            // تقرير الجلسات اليومي (قراءة فقط)
            'getDailyUserSessionActivityReport',
            'getAllUserActivityLogs',
            'getUserActivityLogs',
            'getLogStatistics',
            'getAllAuditLogs'
        ];
        
        // قائمة بالـ actions الحساسة التي تتطلب CSRF token إلزامي
        const sensitiveActions = [
            'saveToSheet', 'appendToSheet', 'deleteFromSheet', 'updateUserInSheet',
            'addUserToSheet', 'deleteUser', 'updateUser', 'changePassword',
            'saveToSheet', 'deleteFromSheet', 'updateSheetData'
        ];
        const strictAdminActions = [
            'deleteUser', 'resetUserPassword', 'fixUsersSheetHeaders',
            'fixMissingSheetHeaders', 'initializeSheets'
        ];
        
        const isReadOnlyAction = readOnlyActions.includes(action);
        const isSensitiveAction = sensitiveActions.includes(action);
        
        // التحقق من CSRF Token - إلزامي للعمليات الحساسة
        if (isSensitiveAction || (!isReadOnlyAction && action !== 'addUser' && action !== 'initializeSheets')) {
            if (!requestToken || requestToken.length < 32) {
                Logger.log('Security: CSRF token missing or too short for action: ' + action);
                const errorOutput = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'طلب غير آمن: CSRF token مفقود أو غير صحيح',
                    errorCode: 'CSRF_TOKEN_MISSING',
                    action: action
                }));
                return setCorsHeaders(errorOutput);
            }
            
            // التحقق من تنسيق CSRF Token
            const hexPattern = /^[0-9a-f]{32,}$/i;
            if (!hexPattern.test(requestToken)) {
                Logger.log('Security: CSRF token format invalid for action: ' + action);
                const errorOutput = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'طلب غير آمن: تنسيق CSRF token غير صحيح',
                    errorCode: 'CSRF_TOKEN_INVALID',
                    action: action
                }));
                return setCorsHeaders(errorOutput);
            }
            
            // التحقق من CSRF Token باستخدام validateCSRFToken
            if (typeof validateCSRFToken === 'function' && !validateCSRFToken(requestToken, { sessionKey: requestSessionKey, ttlSec: 7200 })) {
                Logger.log('Security: CSRF token validation failed for action: ' + action);
                if (typeof logSecurityEvent === 'function') {
                    logSecurityEvent('csrf_validation_failed', { action: action, session: requestSessionKey, severity: 'high' });
                }
                const errorOutput = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'طلب غير آمن: فشل التحقق من CSRF token',
                    errorCode: 'CSRF_TOKEN_VALIDATION_FAILED',
                    action: action
                }));
                return setCorsHeaders(errorOutput);
            }
        }

        // حماية أساسية ضد flood/abuse
        if (typeof checkRateLimit === 'function') {
            const rl = checkRateLimit(requestSessionKey, 180, 60);
            if (!rl.allowed) {
                if (typeof logSecurityEvent === 'function') {
                    logSecurityEvent('rate_limit_blocked', { action: action, current: rl.current, limit: rl.limit, severity: 'medium' });
                }
                return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقاً',
                    errorCode: 'RATE_LIMIT_EXCEEDED'
                })));
            }
        }

        // ربط العمليات الإدارية الحرجة بهوية مستخدم واضحة (متوافق مع الإنتاج: لا يطبق إلا على قائمة حرجة)
        if (strictAdminActions.includes(action)) {
            const actor = postData.userData || payload.userData || payload.user || null;
            const hasActorIdentity = !!(actor && (actor.email || actor.id || actor.name));
            if (!hasActorIdentity) {
                if (typeof logSecurityEvent === 'function') {
                    logSecurityEvent('missing_actor_identity', { action: action, severity: 'high' });
                }
                return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'رفض أمني: بيانات المستخدم المنفذ مطلوبة لهذه العملية',
                    errorCode: 'ACTOR_IDENTITY_REQUIRED',
                    action: action
                })));
            }
        }
        
        // ============================================
        // 6. معالجة الطلب حسب action
        // ============================================
        let result = { success: false, message: '' };
        
        try {
            switch (action) {
                // ============================================
                // العمليات الأساسية (Google Sheets)
                // ============================================
                case 'saveToSheet':
                    if (typeof validatePayloadForSheetWrite === 'function') {
                        const vr = validatePayloadForSheetWrite(payload.sheetName, payload.data);
                        if (!vr.valid) {
                            if (typeof logSecurityEvent === 'function') {
                                logSecurityEvent('payload_validation_failed', { action: action, reason: vr.message, severity: 'high' });
                            }
                            result = { success: false, message: vr.message, errorCode: 'PAYLOAD_VALIDATION_FAILED' };
                            break;
                        }
                    }
                    // البحث عن spreadsheetId في عدة أماكن
                    let spreadsheetId = payload.spreadsheetId || 
                                      postData.spreadsheetId || 
                                      getSpreadsheetId();
                    
                    // تنظيف spreadsheetId
                    if (spreadsheetId && typeof spreadsheetId === 'string') {
                        spreadsheetId = spreadsheetId.trim();
                    }
                    
                    Logger.log('saveToSheet called with spreadsheetId: ' + (spreadsheetId ? spreadsheetId.substring(0, 10) + '...' : 'NOT PROVIDED'));
                    
                    // إذا لم يكن spreadsheetId محدد، نستخدم getSpreadsheetId() كـ fallback
                    if (!spreadsheetId || spreadsheetId === '') {
                        spreadsheetId = getSpreadsheetId();
                        Logger.log('Using default spreadsheetId from Config.gs: ' + (spreadsheetId ? spreadsheetId.substring(0, 10) + '...' : 'NOT FOUND'));
                    }
                    
                    if (!spreadsheetId || spreadsheetId.trim() === '') {
                        result = { 
                            success: false, 
                            message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
                        };
                    } else {
                        result = saveToSheet(payload.sheetName, payload.data, spreadsheetId);
                    }
                    break;
                    
                case 'appendToSheet':
                    if (typeof validatePayloadForSheetWrite === 'function') {
                        const vr = validatePayloadForSheetWrite(payload.sheetName, payload.data);
                        if (!vr.valid) {
                            if (typeof logSecurityEvent === 'function') {
                                logSecurityEvent('payload_validation_failed', { action: action, reason: vr.message, severity: 'high' });
                            }
                            result = { success: false, message: vr.message, errorCode: 'PAYLOAD_VALIDATION_FAILED' };
                            break;
                        }
                    }
                    // البحث عن spreadsheetId في عدة أماكن
                    let appendSpreadsheetId = payload.spreadsheetId || 
                                             postData.spreadsheetId || 
                                             getSpreadsheetId();
                    
                    // تنظيف spreadsheetId
                    if (appendSpreadsheetId && typeof appendSpreadsheetId === 'string') {
                        appendSpreadsheetId = appendSpreadsheetId.trim();
                    }
                    
                    Logger.log('appendToSheet called with spreadsheetId: ' + (appendSpreadsheetId ? appendSpreadsheetId.substring(0, 10) + '...' : 'NOT PROVIDED'));
                    
                    // إذا لم يكن spreadsheetId محدد، نستخدم getSpreadsheetId() كـ fallback
                    if (!appendSpreadsheetId || appendSpreadsheetId === '') {
                        appendSpreadsheetId = getSpreadsheetId();
                        Logger.log('Using default spreadsheetId from Config.gs: ' + (appendSpreadsheetId ? appendSpreadsheetId.substring(0, 10) + '...' : 'NOT FOUND'));
                    }
                    
                    if (!appendSpreadsheetId || appendSpreadsheetId.trim() === '') {
                        result = { 
                            success: false, 
                            message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
                        };
                    } else {
                        result = appendToSheet(payload.sheetName, payload.data, appendSpreadsheetId);
                    }
                    break;
                    
                case 'initializeSheets':
                    const initSpreadsheetId = payload.spreadsheetId || 
                                             payload.data?.spreadsheetId || 
                                             postData.spreadsheetId || 
                                             getSpreadsheetId();
                    Logger.log('initializeSheets called with spreadsheetId: ' + (initSpreadsheetId ? 'provided' : 'using default'));
                    result = initializeSheets(initSpreadsheetId);
                    // بعد التهيئة، نتأكد من إصلاح رأس ورقة Users
                    if (result && result.success) {
                        try {
                            fixUsersSheetHeaders(initSpreadsheetId || getSpreadsheetId());
                        } catch (fixError) {
                            Logger.log('Warning: Could not fix Users sheet headers: ' + fixError.toString());
                        }
                    }
                    break;
                    
                case 'readFromSheet':
                    const readSheetName = payload.sheetName || (typeof payload === 'string' ? payload : null);
                    const readSpreadsheetId = payload.spreadsheetId ||
                                             postData.spreadsheetId ||
                                             getSpreadsheetId();
                    Logger.log('readFromSheet called with spreadsheetId: ' + (readSpreadsheetId ? readSpreadsheetId.substring(0, 10) + '...' : 'NOT PROVIDED'));
                    if (!readSheetName) {
                        result = { success: false, message: 'Sheet name is required for readFromSheet action' };
                    } else {
                        Logger.log('readFromSheet called with sheetName: ' + readSheetName);
                        var readRaw = readFromSheet(readSheetName, readSpreadsheetId);
                        if (readSheetName === 'DailyObservations' && payload.observationsRequestContext) {
                            readRaw = filterDailyObservationsForRequestContext(readRaw, payload.observationsRequestContext);
                        }
                        result = { success: true, data: readRaw };
                    }
                    break;

                // ✅ NEW: Batch read multiple sheets in ONE request
                case 'batchReadSheets':
                    try {
                        const sheetNames = payload.sheetNames || [];
                        const batchSpreadsheetId = payload.spreadsheetId ||
                                                   postData.spreadsheetId ||
                                                   getSpreadsheetId();
                        
                        Logger.log('batchReadSheets called with ' + sheetNames.length + ' sheets');
                        
                        if (!Array.isArray(sheetNames) || sheetNames.length === 0) {
                            result = { success: false, message: 'sheetNames array is required for batchReadSheets' };
                        } else {
                            // Limit batch size to prevent timeout
                            const maxBatchSize = 15;
                            if (sheetNames.length > maxBatchSize) {
                                result = { 
                                    success: false, 
                                    message: 'Batch size too large. Maximum ' + maxBatchSize + ' sheets per request.',
                                    maxBatchSize: maxBatchSize
                                };
                            } else {
                                const batchResults = {};
                                const failedSheets = [];
                                
                                for (let i = 0; i < sheetNames.length; i++) {
                                    const sheetName = sheetNames[i];
                                    try {
                                        // ✅ Use CacheService for frequently-read sheets
                                        const cache = CacheService.getScriptCache();
                                        const cacheKey = 'batch_' + sheetName + '_v1';
                                        const cached = cache.get(cacheKey);
                                        
                                        if (cached) {
                                            // Return cached data
                                            batchResults[sheetName] = JSON.parse(cached);
                                            Logger.log('Cache HIT for batch sheet: ' + sheetName);
                                        } else {
                                            // Read from sheet
                                            var sheetData = readFromSheet(sheetName, batchSpreadsheetId);
                                            
                                            // Special filtering
                                            if (sheetName === 'DailyObservations' && payload.observationsRequestContext) {
                                                sheetData = filterDailyObservationsForRequestContext(sheetData, payload.observationsRequestContext);
                                            }
                                            
                                            batchResults[sheetName] = sheetData;
                                            
                                            // ✅ Cache for 3 minutes (180 seconds)
                                            // Only cache if data is not too large (< 100KB)
                                            try {
                                                const dataSize = JSON.stringify(sheetData).length;
                                                if (dataSize < 100000) { // 100KB limit
                                                    cache.put(cacheKey, JSON.stringify(sheetData), 180);
                                                    Logger.log('Cached batch sheet: ' + sheetName + ' (' + dataSize + ' bytes)');
                                                }
                                            } catch (cacheError) {
                                                Logger.log('Cache write failed for ' + sheetName + ': ' + cacheError.toString());
                                            }
                                        }
                                    } catch (sheetError) {
                                        Logger.log('Error reading sheet ' + sheetName + ': ' + sheetError.toString());
                                        failedSheets.push({ sheetName: sheetName, error: sheetError.toString() });
                                        batchResults[sheetName] = null;
                                    }
                                }
                                
                                result = { 
                                    success: true, 
                                    data: batchResults,
                                    failedSheets: failedSheets,
                                    totalSheets: sheetNames.length,
                                    successfulSheets: sheetNames.length - failedSheets.length
                                };
                            }
                        }
                    } catch (batchError) {
                        Logger.log('batchReadSheets error: ' + batchError.toString());
                        result = { success: false, message: 'Batch read failed: ' + batchError.toString() };
                    }
                    break;
                
                case 'testConnection':
                    // اختبار الاتصال - إجراء بسيط للتحقق من أن الخلفية تعمل
                    Logger.log('testConnection called - testing backend connectivity');
                    result = { 
                        success: true, 
                        message: 'الاتصال بالخلفية يعمل بنجاح',
                        timestamp: new Date().toISOString(),
                        serverTime: new Date().toISOString()
                    };
                    break;

                case 'getPublicIP':
                    // جلب الـ Public IP عبر الخادم (تجنب CORS/ETP في المتصفح)
                    Logger.log('getPublicIP called');
                    if (typeof getPublicIP === 'function') {
                        result = getPublicIP();
                    } else {
                        result = { success: false, message: 'getPublicIP function is not available on the backend' };
                    }
                    break;
                
                // ============================================
                // إحداثيات المواقع (Map Coordinates)
                // ============================================
                case 'PTW_MAP_COORDINATES':
                case 'saveMapCoordinates':
                    Logger.log('saveMapCoordinates called');
                    result = saveMapCoordinates(payload);
                    break;
                
                case 'getMapCoordinates':
                    Logger.log('getMapCoordinates called');
                    result = getMapCoordinates();
                    break;
                
                case 'PTW_DEFAULT_COORDINATES':
                case 'saveDefaultCoordinates':
                    Logger.log('saveDefaultCoordinates called');
                    result = saveDefaultCoordinates(payload);
                    break;
                
                case 'getDefaultCoordinates':
                    Logger.log('getDefaultCoordinates called');
                    result = getDefaultCoordinates();
                    break;
                
                case 'initMapCoordinatesTable':
                    Logger.log('initMapCoordinatesTable called');
                    result = initMapCoordinatesTable(payload.spreadsheetId || getSpreadsheetId());
                    break;
                
                // ============================================
                // إدارة المستخدمين (Users)
                // ============================================
                case 'addUser':
                    result = addUserToSheet(payload);
                    break;
                case 'updateUser':
                    result = updateUserInSheet(payload.userId || payload.id, payload.updateData || payload);
                    break;
                case 'getUsersMeta':
                    result = getUsersMeta();
                    break;
                case 'resetUserPassword':
                    result = resetUserPassword(payload.userId || payload.id || payload.email, payload.newPassword);
                    break;
                case 'deleteUser':
                    result = deleteUserFromSheet(payload.userId || payload.id);
                    break;
                case 'fixUsersSheetHeaders':
                    result = fixUsersSheetHeaders(payload.spreadsheetId || postData.spreadsheetId || getSpreadsheetId());
                    break;
                case 'fixMissingSheetHeaders':
                    result = fixMissingSheetHeaders(payload.spreadsheetId || postData.spreadsheetId || getSpreadsheetId());
                    break;
                
                // ============================================
                // الحوادث والسلامة (Incidents & Safety)
                // ============================================
                case 'addIncident':
                    result = addIncidentToSheet(payload);
                    break;
                case 'updateIncident':
                    result = updateIncident(payload.incidentId || payload.id, payload.updateData || payload);
                    break;
                case 'getIncident':
                    result = getIncident(payload.incidentId || payload.id);
                    break;
                case 'getAllIncidents':
                    result = getAllIncidents(payload.filters || {});
                    break;
                case 'deleteIncident':
                    result = deleteIncident(payload.incidentId || payload.id, payload.userData || {});
                    break;
                case 'getIncidentStatistics':
                    result = getIncidentStatistics(payload.filters || {});
                    break;
                case 'getIncidentAnalysisSettings':
                    result = getIncidentAnalysisSettings();
                    break;
                case 'saveIncidentAnalysisSettings':
                    result = saveIncidentAnalysisSettings(payload);
                    break;
                case 'addIncidentNotification':
                    result = addIncidentNotificationToSheet(payload);
                    break;
                case 'getAllIncidentNotifications':
                    result = getAllIncidentNotifications(payload.filters || {});
                    break;
                case 'addSafetyAlert':
                    result = addSafetyAlertToSheet(payload);
                    break;
                case 'updateSafetyAlert':
                    result = updateSafetyAlert(payload.alertId || payload.id, payload.updateData || payload);
                    break;
                case 'getSafetyAlert':
                    result = getSafetyAlert(payload.alertId || payload.id);
                    break;
                case 'getAllSafetyAlerts':
                    result = getAllSafetyAlerts(payload.filters || {});
                    break;
                case 'deleteSafetyAlert':
                    result = deleteSafetyAlert(payload.alertId || payload.id);
                    break;
                case 'addNearMiss':
                    result = addNearMissToSheet(payload);
                    break;
                case 'updateNearMiss':
                    result = updateNearMiss(payload.nearMissId || payload.id, payload.updateData || payload);
                    break;
                case 'getNearMiss':
                    result = getNearMiss(payload.nearMissId || payload.id);
                    break;
                case 'getAllNearMisses':
                    result = getAllNearMisses(payload.filters || {});
                    break;
                case 'deleteNearMiss':
                    result = deleteNearMiss(payload.nearMissId || payload.id);
                    break;
                case 'addPTW':
                    result = addPTWToSheet(payload);
                    break;
                case 'updatePTW':
                    result = updatePTW(payload.ptwId || payload.id, payload.updateData || payload);
                    break;
                case 'getPTW':
                    result = getPTW(payload.ptwId || payload.id);
                    break;
                case 'getAllPTWs':
                    result = getAllPTWs(payload.filters || {});
                    break;
                case 'deletePTW':
                    result = deletePTW(payload.ptwId || payload.id);
                    break;
                case 'getPTWAlerts':
                    result = getPTWAlerts();
                    break;
                // ============================================
                // Issuing Authorities - المصرح لهم بالتوقيع على تصاريح العمل
                // ============================================
                case 'getAllIssuingAuthorities':
                    result = getAllIssuingAuthorities();
                    break;
                case 'addIssuingAuthority':
                    result = addIssuingAuthority(payload);
                    break;
                case 'updateIssuingAuthority':
                    result = updateIssuingAuthority(payload.id || payload.recordId, payload);
                    break;
                case 'deleteIssuingAuthority':
                    result = deleteIssuingAuthority(payload.id || payload.recordId, payload.userData || payload.user);
                    break;
                case 'getIssuingAuthoritiesForPermitType':
                    result = getIssuingAuthoritiesForPermitType(payload.permitType);
                    break;
                case 'getAllContractorIssuingAuthorities':
                    result = getAllContractorIssuingAuthorities();
                    break;
                case 'addContractorIssuingAuthority':
                    result = addContractorIssuingAuthority(payload);
                    break;
                case 'updateContractorIssuingAuthority':
                    result = updateContractorIssuingAuthority(payload.id || payload.recordId, payload);
                    break;
                case 'deleteContractorIssuingAuthority':
                    result = deleteContractorIssuingAuthority(payload.id || payload.recordId, payload.userData || payload.user);
                    break;
                case 'getContractorIssuingAuthoritiesForPermitType':
                    result = getContractorIssuingAuthoritiesForPermitType(payload.permitType);
                    break;
                case 'getEmployeeByCode':
                    result = getEmployeeByCode(payload.employeeCode || payload.code);
                    break;
                case 'initIssuingAuthoritiesTable':
                    result = initIssuingAuthoritiesTable();
                    break;
                case 'addViolation':
                    result = addViolationToSheet(payload);
                    break;
                case 'deleteViolationFromSheet':
                    result = deleteViolationFromSheet(payload.id);
                    break;
                
                // ============================================
                // التدريب (Training)
                // ============================================
                case 'addTraining':
                    result = addTrainingToSheet(payload);
                    break;
                case 'updateTraining':
                    result = updateTraining(payload.trainingId || payload.id, payload.updateData || payload);
                    break;
                case 'getTraining':
                    result = getTraining(payload.trainingId || payload.id);
                    break;
                case 'getAllTrainings':
                    result = getAllTrainings(payload.filters || {});
                    break;
                case 'deleteTraining':
                    result = deleteTraining(payload.trainingId || payload.id);
                    break;
                case 'getTrainingStatistics':
                    result = getTrainingStatistics(payload.filters || {});
                    break;
                case 'addEmployeeTrainingMatrix':
                    result = addEmployeeTrainingMatrixToSheet(payload);
                    break;
                case 'updateEmployeeTrainingMatrix':
                    result = updateEmployeeTrainingMatrix(payload.employeeId || payload.id, payload.updateData || payload);
                    break;
                case 'getEmployeeTrainingMatrix':
                    result = getEmployeeTrainingMatrix(payload.employeeId || payload.id);
                    break;
                case 'addContractorTraining':
                    result = addContractorTrainingToSheet(payload);
                    break;
                case 'addAnnualTrainingPlan':
                    result = addAnnualTrainingPlanToSheet(payload);
                    break;
                case 'getAllTrainingSessions':
                    result = getAllTrainingSessions(payload.filters || {});
                    break;
                case 'getAllTrainingCertificates':
                    result = getAllTrainingCertificates(payload.filters || {});
                    break;
                case 'getAllTrainingAttendance':
                    result = getAllTrainingAttendance(payload.filters || {});
                    break;
                case 'getAllContractorTrainings':
                    result = getAllContractorTrainings(payload.filters || {});
                    break;
                case 'getTrainingModuleBundle':
                    result = getTrainingModuleBundle(payload || {});
                    break;
                
                // ============================================
                // العيادة الطبية (Clinic)
                // ============================================
                case 'addClinicVisit':
                    Logger.log('🚀 [CODE.GS] ===== addClinicVisit action تم استدعاؤها =====');
                    Logger.log('🚀 [CODE.GS] الوقت: ' + new Date().toISOString());
                    Logger.log('🏷️ [CODE.GS] BUILD_TAG: ' + BUILD_TAG);
                    Logger.log('🚀 [CODE.GS] postData keys: ' + Object.keys(postData || {}).join(', '));
                    Logger.log('🚀 [CODE.GS] postData.data exists: ' + !!postData.data);
                    Logger.log('🚀 [CODE.GS] postData.data type: ' + typeof postData.data);
                    Logger.log('🚀 [CODE.GS] payload type: ' + typeof payload);
                    Logger.log('🚀 [CODE.GS] payload is null: ' + (payload === null));
                    Logger.log('🚀 [CODE.GS] payload is undefined: ' + (payload === undefined));
                    Logger.log('🚀 [CODE.GS] payload keys: ' + (payload ? Object.keys(payload).join(', ') : 'N/A'));
                    Logger.log('🚀 [CODE.GS] payload.createdBy: ' + JSON.stringify(payload?.createdBy));
                    Logger.log('🚀 [CODE.GS] payload.email: ' + JSON.stringify(payload?.email));
                    Logger.log('🚀 [CODE.GS] payload.id: ' + JSON.stringify(payload?.id));
                    Logger.log('🚀 [CODE.GS] payload.employeeName: ' + JSON.stringify(payload?.employeeName));
                    
                    // ✅ إصلاح جذري: محاولة استخدام postData.data مباشرة إذا كان payload فارغاً
                    let visitDataToUse = payload;
                    if (!visitDataToUse || typeof visitDataToUse !== 'object' || Object.keys(visitDataToUse).length === 0) {
                        Logger.log('⚠️ [CODE.GS] payload فارغ، محاولة استخدام postData.data مباشرة');
                        visitDataToUse = postData.data;
                    }
                    
                    // ✅ محاولة أخرى: إذا كان postData يحتوي على البيانات مباشرة (بدون data)
                    if (!visitDataToUse || typeof visitDataToUse !== 'object' || Object.keys(visitDataToUse).length === 0) {
                        Logger.log('⚠️ [CODE.GS] postData.data فارغ، محاولة استخدام postData مباشرة (بدون action)');
                        const postDataCopy = {};
                        for (var key in postData) {
                            if (postData.hasOwnProperty(key) && key !== 'action' && key !== 'csrfToken' && key !== 'skipCSRFCheck' && key !== 'skipCSRF') {
                                postDataCopy[key] = postData[key];
                            }
                        }
                        if (Object.keys(postDataCopy).length > 0) {
                            visitDataToUse = postDataCopy;
                            Logger.log('✅ [CODE.GS] تم استخدام postData مباشرة، عدد الحقول: ' + Object.keys(visitDataToUse).length);
                        }
                    }
                    
                    // ✅ التحقق النهائي
                    if (!visitDataToUse || typeof visitDataToUse !== 'object' || Object.keys(visitDataToUse).length === 0) {
                        Logger.log('❌ [CODE.GS] لا يمكن العثور على بيانات الزيارة!');
                        Logger.log('❌ [CODE.GS] postData كامل: ' + JSON.stringify(postData).substring(0, 500));
                        result = { success: false, message: 'بيانات الزيارة غير موجودة أو غير صحيحة' };
                    } else {
                        Logger.log('✅ [CODE.GS] تم العثور على بيانات الزيارة، عدد الحقول: ' + Object.keys(visitDataToUse).length);
                        result = addClinicVisitToSheet(visitDataToUse);
                        // إضافة بصمة نسخة في النتيجة لتسهيل التتبع من الواجهة
                        try {
                            if (result && typeof result === 'object') {
                                result._buildTag = BUILD_TAG;
                            }
                        } catch (e) {}
                        Logger.log('✅ [CODE.GS] addClinicVisitToSheet اكتملت. النتيجة: ' + JSON.stringify(result));
                    }
                    Logger.log('🚀 [CODE.GS] ===== addClinicVisit action اكتملت =====');
                    break;
                case 'updateClinicVisit':
                    result = updateClinicVisit(payload.visitId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllClinicVisits':
                    result = getAllClinicVisits(payload.filters || {});
                    break;
                case 'addMedication':
                    result = addMedicationToSheet(payload);
                    break;
                case 'updateMedication':
                    result = updateMedication(payload.medicationId || payload.id, payload.updateData || payload);
                    break;
                case 'deleteMedication':
                    result = deleteMedication(payload.medicationId || payload.id);
                    break;
                case 'getAllMedications':
                    result = getAllMedications(payload.filters || {});
                    break;
                case 'getMedicationAlerts':
                    result = getMedicationAlerts();
                    break;
                case 'addSickLeave':
                    result = addSickLeaveToSheet(payload);
                    break;
                case 'updateSickLeave':
                    result = updateSickLeave(payload.leaveId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllSickLeaves':
                    result = getAllSickLeaves(payload.filters || {});
                    break;
                case 'addInjury':
                    result = addInjuryToSheet(payload);
                    break;
                case 'updateInjury':
                    result = updateInjury(payload.injuryId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllInjuries':
                    result = getAllInjuries(payload.filters || {});
                    break;
                case 'addClinicInventory':
                    result = addClinicInventoryToSheet(payload);
                    break;
                case 'updateClinicInventory':
                    result = updateClinicInventory(payload.inventoryId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllClinicInventory':
                    result = getAllClinicInventory(payload.filters || {});
                    break;
                case 'addMedicationDeletionRequest':
                    result = addMedicationDeletionRequest(payload);
                    break;
                case 'updateMedicationDeletionRequest':
                    result = updateMedicationDeletionRequest(payload.requestId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllMedicationDeletionRequests':
                    result = getAllMedicationDeletionRequests(payload.filters || {});
                    break;
                case 'approveMedicationDeletion':
                    result = approveMedicationDeletion(payload.requestId || payload.id, payload.approverData || payload.approver);
                    break;
                case 'rejectMedicationDeletion':
                    result = rejectMedicationDeletion(payload.requestId || payload.id, payload.rejectorData || payload.rejector, payload.reason);
                    break;
                case 'addSupplyRequest':
                    result = addSupplyRequest(payload);
                    break;
                case 'updateSupplyRequest':
                    result = updateSupplyRequest(payload.requestId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllSupplyRequests':
                    result = getAllSupplyRequests(payload.filters || {});
                    break;
                case 'approveSupplyRequest':
                    result = approveSupplyRequest(payload.requestId || payload.id, payload.approverData || payload.approver);
                    break;
                case 'rejectSupplyRequest':
                    result = rejectSupplyRequest(payload.requestId || payload.id, payload.rejectorData || payload.rejector, payload.reason);
                    break;
                case 'addClinicVisitDeletionRequest':
                    result = addClinicVisitDeletionRequest(payload);
                    break;
                case 'updateClinicVisitDeletionRequest':
                    result = updateClinicVisitDeletionRequest(payload.requestId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllClinicVisitDeletionRequests':
                    result = getAllClinicVisitDeletionRequests(payload.filters || {});
                    break;
                case 'approveClinicVisitDeletion':
                    result = approveClinicVisitDeletion(payload.requestId || payload.id, payload.approverData || payload.approver);
                    break;
                case 'rejectClinicVisitDeletion':
                    result = rejectClinicVisitDeletion(payload.requestId || payload.id, payload.rejectorData || payload.rejector, payload.reason);
                    break;
                case 'deleteClinicVisit':
                    result = deleteClinicVisit(payload.visitId || payload.id);
                    break;
                
                // ============================================
                // المقاولين والموظفين (Contractors & Employees)
                // ============================================
                // ✅ تم إزالة case 'addContractor' - نعتمد الآن فقط على ApprovedContractors
                // ✅ تم إزالة حالات Contractors - نعتمد الآن فقط على ApprovedContractors
                // case 'updateContractor': - تم الإزالة
                // case 'getContractor': - تم الإزالة
                // case 'getAllContractors': - تم الإزالة
                // case 'deleteContractor': - تم الإزالة
                case 'addEmployee':
                    result = addEmployeeToSheet(payload);
                    break;
                case 'updateEmployee':
                    result = updateEmployee(payload.employeeId || payload.id, payload.updateData || payload);
                    break;
                case 'getEmployee':
                    result = getEmployee(payload.employeeId || payload.id);
                    break;
                case 'getAllEmployees':
                    result = getAllEmployees(payload.filters || {});
                    break;
                case 'deactivateEmployee':
                    result = deactivateEmployee(payload.employeeId || payload.id);
                    break;
                case 'deleteEmployee':
                    result = deleteEmployee(payload.employeeId || payload.id);
                    break;
                case 'deleteAllEmployees':
                    result = deleteAllEmployees(payload);
                    break;
                case 'getEmployeeStatistics':
                    result = getEmployeeStatistics(payload.filters || {});
                    break;
                case 'getOrCreatePublicProfileToken':
                    result = getOrCreatePublicProfileToken(payload || {});
                    break;
                case 'getAllAppEmergencyNumbers':
                    result = getAllAppEmergencyNumbers();
                    break;
                case 'upsertAppEmergencyNumber':
                    result = upsertAppEmergencyNumber(payload || {});
                    break;
                case 'deleteAppEmergencyNumber':
                    result = deleteAppEmergencyNumber(payload || {});
                    break;
                case 'addApprovedContractor':
                    result = addApprovedContractorToSheet(payload);
                    break;
                case 'updateApprovedContractor':
                    result = updateApprovedContractor(payload.approvedContractorId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllApprovedContractors':
                    result = getAllApprovedContractors(payload.filters || {});
                    break;
                case 'deleteApprovedContractor':
                    result = deleteApprovedContractor(payload.approvedContractorId || payload.id);
                    break;
                case 'addContractorEvaluation':
                    result = addContractorEvaluationToSheet(payload);
                    break;
                case 'updateContractorEvaluation':
                    result = updateContractorEvaluation(payload.evaluationId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllContractorEvaluations':
                    result = getAllContractorEvaluations(payload.filters || {});
                    break;
                case 'getContractorEvaluations':
                    result = getContractorEvaluations(payload.contractorId || payload.id);
                    break;
                case 'getContractorDetailedAnalytics':
                    result = getContractorDetailedAnalytics(payload);
                    break;
                
                // طلبات اعتماد المقاولين
                case 'addContractorApprovalRequest':
                    result = addContractorApprovalRequest(payload);
                    break;
                case 'updateContractorApprovalRequest':
                    result = updateContractorApprovalRequest(payload.requestId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllContractorApprovalRequests':
                    result = getAllContractorApprovalRequests(payload.filters || {});
                    break;
                case 'approveContractorApprovalRequest':
                    result = approveContractorApprovalRequest(payload.requestId || payload.id, payload.userData || payload);
                    break;
                case 'rejectContractorApprovalRequest':
                    result = rejectContractorApprovalRequest(payload.requestId || payload.id, payload.rejectionReason || '', payload.userData || payload);
                    break;
                
                // طلبات حذف المقاولين
                case 'addContractorDeletionRequest':
                    result = addContractorDeletionRequest(payload);
                    break;
                case 'updateContractorDeletionRequest':
                    result = updateContractorDeletionRequest(payload.requestId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllContractorDeletionRequests':
                    result = getAllContractorDeletionRequests(payload.filters || {});
                    break;
                case 'approveContractorDeletionRequest':
                    result = approveContractorDeletionRequest(payload.requestId || payload.id, payload.userData || payload);
                    break;
                case 'rejectContractorDeletionRequest':
                    result = rejectContractorDeletionRequest(payload.requestId || payload.id, payload.rejectionReason || '', payload.userData || payload);
                    break;
                
                // ============================================
                // السلامة العامة (Safety)
                // ============================================
                case 'addBehavior':
                    result = addBehaviorToSheet(payload);
                    break;
                case 'updateBehavior':
                    result = updateBehavior(payload.behaviorId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllBehaviors':
                    result = getAllBehaviors(payload.filters || {});
                    break;
                case 'getBehavior':
                    result = getBehavior(payload.behaviorId || payload.id);
                    break;
                case 'deleteBehavior':
                    result = deleteBehavior(payload.behaviorId || payload.id);
                    break;
                case 'addChemicalSafety':
                    result = addChemicalSafetyToSheet(payload);
                    break;
                case 'updateChemicalSafety':
                    result = updateChemicalSafety(payload.chemicalId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllChemicalSafety':
                    result = getAllChemicalSafety(payload.filters || {});
                    break;
                case 'getChemicalSafety':
                    result = getChemicalSafety(payload.chemicalId || payload.id);
                    break;
                case 'deleteChemicalSafety':
                    result = deleteChemicalSafety(payload.chemicalId || payload.id);
                    break;
                case 'addObservation':
                    result = addObservationToSheet(payload);
                    break;
                case 'updateObservation':
                    result = updateObservation(payload.observationId || payload.id, payload.updateData || payload);
                    break;
                case 'getObservation':
                    result = getObservation(payload.observationId || payload.id);
                    if (result && result.success && result.data && payload.observationsRequestContext) {
                        var _gof = filterDailyObservationsForRequestContext([result.data], payload.observationsRequestContext);
                        if (_gof.length === 0) {
                            result = { success: false, message: 'غير مصرح بعرض هذه الملاحظة' };
                        }
                    }
                    break;
                case 'transitionObservationWorkflow':
                    result = transitionObservationWorkflow(payload);
                    break;
                case 'notifyObservationWorkflowEvent':
                    result = notifyObservationWorkflowEvent(payload);
                    break;
                case 'getAllObservations':
                    result = getAllObservations(payload.filters || {});
                    break;
                case 'deleteObservation':
                    result = deleteObservation(payload.observationId || payload.id);
                    break;
                case 'deleteAllObservations':
                    result = deleteAllObservations();
                    break;
                case 'getObservationStatistics':
                    result = getObservationStatistics(payload.filters || {});
                    break;
                case 'addObservationComment':
                    result = addObservationComment(
                        payload.observationId || payload.id || payload.data?.observationId,
                        payload.commentData || payload.data?.commentData || payload.data || payload
                    );
                    break;
                case 'addObservationUpdate':
                    result = addObservationUpdate(
                        payload.observationId || payload.id || payload.data?.observationId,
                        payload.updateData || payload.data?.updateData || payload.data || payload
                    );
                    break;
                case 'updateObservationStatus':
                    result = updateObservationStatus(
                        payload.observationId || payload.id || payload.data?.observationId,
                        payload.statusData || payload.data?.statusData || payload.data || payload
                    );
                    break;
                case 'exportDailyObservationsPptReport':
                    result = exportDailyObservationsPptReport(payload);
                    break;
                case 'setDailyObservationsPptTemplateId':
                    result = setDailyObservationsPptTemplateId(payload.templateId || payload.templateID || payload);
                    break;
                case 'getDailyObservationsPptTemplateId':
                    result = getDailyObservationsPptTemplateId();
                    break;
                case 'addObservationSite':
                    result = addObservationSiteToSheet(payload);
                    break;
                
                // ============================================
                // ISO والجودة (ISO & Quality)
                // ============================================
                case 'addISODocument':
                    result = addISODocumentToSheet(payload);
                    break;
                case 'updateISODocument':
                    result = updateISODocument(payload.documentId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllISODocuments':
                    result = getAllISODocuments(payload.filters || {});
                    break;
                case 'addISOProcedure':
                    result = addISOProcedureToSheet(payload);
                    break;
                case 'updateISOProcedure':
                    result = updateISOProcedure(payload.procedureId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllISOProcedures':
                    result = getAllISOProcedures(payload.filters || {});
                    break;
                case 'addISOForm':
                    result = addISOFormToSheet(payload);
                    break;
                case 'updateISOForm':
                    result = updateISOForm(payload.formId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllISOForms':
                    result = getAllISOForms(payload.filters || {});
                    break;
                case 'addSOPJHA':
                    result = addSOPJHAToSheet(payload);
                    break;
                case 'updateSOPJHA':
                    result = updateSOPJHA(payload.sopId || payload.id, payload.updateData || payload);
                    break;
                case 'getSOPJHA':
                    result = getSOPJHA(payload.sopId || payload.id);
                    break;
                case 'getAllSOPJHAs':
                    result = getAllSOPJHAs(payload.filters || {});
                    break;
                case 'deleteSOPJHA':
                    result = deleteSOPJHA(payload.sopId || payload.id);
                    break;
                case 'getDocumentCodes':
                    result = getDocumentCodes(payload || {});
                    break;
                case 'addDocumentCode':
                    result = (typeof addDocumentCode === 'function' ? addDocumentCode : addDocumentCodeToSheet)(postData.data || payload);
                    break;
                case 'updateDocumentCode':
                    result = updateDocumentCode((postData.data || payload).id, (postData.data || payload));
                    break;
                case 'deleteDocumentCode':
                    result = deleteDocumentCode((postData.data || payload).id);
                    break;
                case 'getDocumentVersions':
                    result = getDocumentVersions(payload || {});
                    break;
                case 'addDocumentVersion':
                    result = addDocumentVersionToSheet(postData.data || payload);
                    break;
                case 'updateDocumentVersion':
                    result = updateDocumentVersion((postData.data || payload).id, (postData.data || payload));
                    break;
                case 'getDocumentCodeAndVersion':
                    result = getDocumentCodeAndVersion(payload || {});
                    break;
                case 'addRiskAssessment':
                    result = addRiskAssessmentToSheet(payload);
                    break;
                case 'updateRiskAssessment':
                    result = updateRiskAssessment(payload.riskId || payload.id, payload.updateData || payload);
                    break;
                case 'getRiskAssessment':
                    result = getRiskAssessment(payload.riskId || payload.id);
                    break;
                case 'getAllRiskAssessments':
                    result = getAllRiskAssessments(payload.filters || {});
                    break;
                case 'deleteRiskAssessment':
                    result = deleteRiskAssessment(payload.riskId || payload.id);
                    break;
                case 'addLegalDocument':
                    result = addLegalDocumentToSheet(payload);
                    break;
                case 'updateLegalDocument':
                    result = updateLegalDocument(payload.documentId || payload.id, payload.updateData || payload);
                    break;
                case 'getLegalDocument':
                    result = getLegalDocument(payload.documentId || payload.id);
                    break;
                case 'getAllLegalDocuments':
                    result = getAllLegalDocuments(payload.filters || {});
                    break;
                case 'deleteLegalDocument':
                    result = deleteLegalDocument(payload.documentId || payload.id);
                    break;
                case 'getLegalDocumentAlerts':
                    result = getLegalDocumentAlerts();
                    break;
                
                // ============================================
                // HSE الشامل (HSE Modules)
                // ============================================
                case 'addHSEAudit':
                    result = addHSEAuditToSheet(payload);
                    break;
                case 'updateHSEAudit':
                    result = updateHSEAudit(payload.auditId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllHSEAudits':
                    result = getAllHSEAudits(payload.filters || {});
                    break;
                case 'addHSENonConformity':
                    result = addHSENonConformityToSheet(payload);
                    break;
                case 'updateHSENonConformity':
                    result = updateHSENonConformity(payload.nonConformityId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllHSENonConformities':
                    result = getAllHSENonConformities(payload.filters || {});
                    break;
                case 'addHSECorrectiveAction':
                    result = addHSECorrectiveActionToSheet(payload);
                    break;
                case 'updateHSECorrectiveAction':
                    result = updateHSECorrectiveAction(payload.actionId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllHSECorrectiveActions':
                    result = getAllHSECorrectiveActions(payload.filters || {});
                    break;
                case 'addHSEObjective':
                    result = addHSEObjectiveToSheet(payload);
                    break;
                case 'updateHSEObjective':
                    result = updateHSEObjective(payload.objectiveId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllHSEObjectives':
                    result = getAllHSEObjectives(payload.filters || {});
                    break;
                case 'addHSERiskAssessment':
                    result = addHSERiskAssessmentToSheet(payload);
                    break;
                case 'updateHSERiskAssessment':
                    result = updateHSERiskAssessment(payload.riskId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllHSERiskAssessments':
                    result = getAllHSERiskAssessments(payload.filters || {});
                    break;
                
                // ============================================
                // البيئة (Environmental)
                // ============================================
                case 'addEnvironmentalAspect':
                    result = addEnvironmentalAspectToSheet(payload);
                    break;
                case 'addEnvironmentalMonitoring':
                    result = addEnvironmentalMonitoringToSheet(payload);
                    break;
                case 'addSustainability':
                    result = addSustainabilityToSheet(payload);
                    break;
                case 'addCarbonFootprint':
                    result = addCarbonFootprintToSheet(payload);
                    break;
                case 'addWasteManagement':
                    result = addWasteManagementToSheet(payload);
                    break;
                case 'addEnergyEfficiency':
                    result = addEnergyEfficiencyToSheet(payload);
                    break;
                case 'addWaterManagement':
                    result = addWaterManagementToSheet(payload);
                    break;
                case 'addRecyclingProgram':
                    result = addRecyclingProgramToSheet(payload);
                    break;
                
                // ============================================
                // المعدات والفحوصات (Equipment & Inspections)
                // ============================================
                case 'addFireEquipment':
                    result = addFireEquipmentToSheet(payload);
                    break;
                case 'updateFireEquipment':
                    result = updateFireEquipment(payload.equipmentId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllFireEquipment':
                    result = getAllFireEquipment(payload.filters || {});
                    break;
                case 'addFireEquipmentAsset':
                    result = addFireEquipmentAssetToSheet(payload);
                    break;
                case 'updateFireEquipmentAsset':
                    result = updateFireEquipmentAsset(payload.assetId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllFireEquipmentAssets':
                    result = getAllFireEquipmentAssets(payload.filters || {});
                    break;
                case 'deleteFireEquipment':
                    result = deleteFireEquipmentAsset(payload.assetId || payload.id);
                    break;
                case 'addFireEquipmentInspection':
                    result = addFireEquipmentInspectionToSheet(payload);
                    break;
                case 'updateFireEquipmentInspection':
                    result = updateFireEquipmentInspection(payload.inspectionId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllFireEquipmentInspections':
                    result = getAllFireEquipmentInspections(payload.filters || {});
                    break;
                case 'getFireEquipmentInspectionAlerts':
                    result = getFireEquipmentInspectionAlerts();
                    break;
                case 'saveOrUpdateFireEquipmentAsset':
                    result = saveOrUpdateFireEquipmentAsset(payload);
                    break;
                case 'addFireEquipmentApprovalRequest':
                    result = addFireEquipmentApprovalRequest(payload);
                    break;
                case 'updateFireEquipmentApprovalRequest':
                    result = updateFireEquipmentApprovalRequest(payload.requestId || payload.id, payload.updateData || payload);
                    break;
                case 'getFireEquipmentApprovalRequests':
                    result = getFireEquipmentApprovalRequests(payload.filters || {});
                    break;
                case 'deleteFireEquipmentApprovalRequest':
                    result = deleteFireEquipmentApprovalRequest(payload.requestId || payload.id);
                    break;
                case 'addPPE':
                    result = addPPEToSheet(payload);
                    break;
                case 'updatePPE':
                    result = updatePPE(payload.ppeId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllPPE':
                    result = getAllPPE(payload.filters || {});
                    break;
                case 'deletePPE':
                    result = deletePPE(payload.ppeId || payload.id || payload);
                    break;
                case 'addPPEMatrix':
                    result = addPPEMatrixToSheet(payload);
                    break;
                case 'updatePPEMatrix':
                    result = updatePPEMatrix(payload.employeeId || payload.id, payload.updateData || payload);
                    break;
                case 'getPPEMatrix':
                    result = getPPEMatrix(payload.employeeId || payload.id);
                    break;
                case 'getAllPPEMatrices':
                    result = getAllPPEMatrices(payload.filters || {});
                    break;
                case 'getAllPPEStockItems':
                    result = getAllPPEStockItems(payload.filters || {});
                    break;
                case 'addOrUpdatePPEStockItem':
                    result = addOrUpdatePPEStockItem(payload);
                    break;
                case 'addPPETransaction':
                    result = addPPETransaction(payload);
                    break;
                case 'getAllPPETransactions':
                    result = getAllPPETransactions(payload.filters || {});
                    break;
                case 'getPPEItemsList':
                    result = getPPEItemsList();
                    break;
                case 'deletePPEStockItem':
                    result = deletePPEStockItem(payload.itemId || payload);
                    break;
                case 'getLowStockItems':
                    result = getLowStockItems();
                    break;
                case 'addPeriodicInspection':
                    result = addPeriodicInspectionToSheet(payload);
                    break;
                case 'updatePeriodicInspection':
                    result = updatePeriodicInspection(payload.inspectionId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllPeriodicInspections':
                    result = getAllPeriodicInspections(payload.filters || {});
                    break;
                case 'addPeriodicInspectionCategory':
                    result = addPeriodicInspectionCategoryToSheet(payload);
                    break;
                case 'updatePeriodicInspectionCategory':
                    result = updatePeriodicInspectionCategory(payload.categoryId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllPeriodicInspectionCategories':
                    result = getAllPeriodicInspectionCategories();
                    break;
                case 'addPeriodicInspectionChecklist':
                    result = addPeriodicInspectionChecklistToSheet(payload);
                    break;
                case 'updatePeriodicInspectionChecklist':
                    result = updatePeriodicInspectionChecklist(payload.checklistId || payload.id, payload.updateData || payload);
                    break;
                case 'getPeriodicInspectionChecklist':
                    result = getPeriodicInspectionChecklist(payload.checklistId || payload.id);
                    break;
                case 'getChecklistsByCategory':
                    result = getChecklistsByCategory(payload.categoryId || payload.id);
                    break;
                case 'addPeriodicInspectionSchedule':
                    result = addPeriodicInspectionScheduleToSheet(payload);
                    break;
                case 'updatePeriodicInspectionSchedule':
                    result = updatePeriodicInspectionSchedule(payload.scheduleId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllPeriodicInspectionSchedules':
                    result = getAllPeriodicInspectionSchedules(payload.filters || {});
                    break;
                case 'addPeriodicInspectionRecord':
                    result = addPeriodicInspectionRecordToSheet(payload);
                    break;
                case 'updatePeriodicInspectionRecord':
                    result = updatePeriodicInspectionRecord(payload.recordId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllPeriodicInspectionRecords':
                    result = getAllPeriodicInspectionRecords(payload.filters || {});
                    break;
                case 'getPeriodicInspectionAlerts':
                    result = getPeriodicInspectionAlerts();
                    break;
                case 'addViolationType':
                    result = addViolationTypeToSheet(payload);
                    break;
                
                // ============================================
                // الميزانية ومؤشرات الأداء (Budget & KPIs)
                // ============================================
                case 'addBudget':
                case 'addSafetyBudget':
                    result = addBudgetToSheet(payload);
                    break;
                case 'updateBudget':
                    result = updateBudget(payload.budgetId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllBudgets':
                    result = getAllBudgets(payload.filters || {});
                    break;
                case 'addSafetyBudgets':
                    result = addSafetyBudgetsToSheet(payload);
                    break;
                case 'updateSafetyBudget':
                    result = updateSafetyBudget(payload.budgetId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllSafetyBudgets':
                    result = getAllSafetyBudgets(payload.filters || {});
                    break;
                case 'addSafetyBudgetTransaction':
                    result = addSafetyBudgetTransactionToSheet(payload);
                    break;
                case 'updateSafetyBudgetTransaction':
                    result = updateSafetyBudgetTransaction(payload.transactionId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllSafetyBudgetTransactions':
                    result = getAllSafetyBudgetTransactions(payload.filters || {});
                    break;
                case 'getBudgetStatistics':
                    result = getBudgetStatistics(payload.filters || {});
                    break;
                case 'addKPI':
                case 'addSafetyPerformanceKPI':
                    result = addKPIToSheet(payload);
                    break;
                case 'updateKPI':
                    result = updateKPI(payload.kpiId || payload.id, payload.updateData || payload);
                    break;
                case 'getKPI':
                    result = getKPI(payload.kpiId || payload.id);
                    break;
                case 'getAllKPIs':
                    result = getAllKPIs(payload.filters || {});
                    break;
                case 'deleteKPI':
                    result = deleteKPI(payload.kpiId || payload.id);
                    break;

                // ============================================
                // KPI Annual Plans (الخطط السنوية لمؤشرات الأداء)
                // ============================================
                case 'getKPIAnnualPlans':
                    result = getKPIAnnualPlans(payload.filters || {});
                    break;
                case 'saveKPIAnnualPlan':
                    result = saveKPIAnnualPlan(payload);
                    break;
                case 'deleteKPIAnnualPlan':
                    result = deleteKPIAnnualPlan(payload.planId || payload.id);
                    break;

                // ============================================
                // HSE Monitoring Plans (خطط متابعة HSE)
                // ============================================
                case 'getHSEMonitoringPlans':
                    result = getHSEMonitoringPlans(payload.filters || {});
                    break;
                case 'saveHSEMonitoringPlan':
                    result = saveHSEMonitoringPlan(payload);
                    break;
                case 'deleteHSEMonitoringPlan':
                    result = deleteHSEMonitoringPlan(payload.planId || payload.id);
                    break;
                case 'updateHSEMonitoringMonthlyExecution':
                    result = updateHSEMonitoringMonthlyExecution(payload.planId || payload.id, payload.monthData || payload);
                    break;

                // ============================================
                // متابعة الإجراءات (Action Tracking)
                // ============================================
                case 'addActionTracking':
                    result = addActionTrackingToSheet(payload);
                    break;
                case 'updateActionTracking':
                    result = updateActionTracking(payload.actionId || payload.id, payload.updateData || payload);
                    break;
                case 'deleteActionTracking':
                    result = deleteActionTracking(payload.actionId || payload.id);
                    break;
                case 'getActionTracking':
                    result = getActionTracking(payload.actionId || payload.id);
                    break;
                case 'getAllActionTracking':
                    result = getAllActionTracking();
                    break;
                case 'addActionComment':
                    result = addActionComment(payload.actionId || payload.id, payload);
                    break;
                case 'addActionUpdate':
                    result = addActionUpdate(payload.actionId || payload.id, payload);
                    break;
                case 'createActionFromModule':
                    result = createActionFromModule(payload.sourceModule, payload.sourceId, payload.sourceData || payload);
                    break;
                case 'getActionTrackingSettings':
                    result = getActionTrackingSettings();
                    break;
                case 'saveActionTrackingSettings':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {}
                        };
                    }
                    result = saveActionTrackingSettings(payload);
                    break;
                case 'getActionTrackingKPIs':
                    result = getActionTrackingKPIs();
                    break;
                
                // ============================================
                // تتبع المشاكل وحلولها (Issue Tracking)
                // ============================================
                case 'addIssue':
                    result = addIssueToSheet(payload.data || payload);
                    break;
                case 'updateIssue':
                    result = updateIssue(
                        payload.issueId || payload.id || payload.data?.issueId, 
                        payload.data || payload.updateData || payload
                    );
                    break;
                case 'deleteIssue':
                    result = deleteIssue(payload.issueId || payload.id || payload.data?.issueId);
                    break;
                case 'getIssue':
                    result = getIssue(payload.issueId || payload.id || payload.data?.issueId);
                    break;
                case 'getAllIssues':
                    result = getAllIssues(payload.filters || payload.data?.filters || {});
                    break;
                case 'addSolutionToIssue':
                    result = addSolutionToIssue(
                        payload.issueId || payload.id || payload.data?.issueId, 
                        payload.solutionData || payload.data?.solutionData || payload.data || payload
                    );
                    break;
                case 'addCommentToIssue':
                    result = addCommentToIssue(
                        payload.issueId || payload.id || payload.data?.issueId, 
                        payload.commentData || payload.data?.commentData || payload.data || payload
                    );
                    break;
                case 'getIssueStatistics':
                    result = getIssueStatistics(payload.filters || payload.data?.filters || {});
                    break;
                
                // ============================================
                // إدارة التغيرات (Change Management - مشابه SAP MoC)
                // ============================================
                case 'getAllChangeRequests':
                    result = getAllChangeRequests(payload.filters || payload.data?.filters || {});
                    break;
                case 'getChangeRequest':
                    result = getChangeRequest(payload.requestId || payload.id || payload.data?.requestId);
                    break;
                case 'addChangeRequest':
                    result = addChangeRequestToSheet(payload.data || payload);
                    break;
                case 'updateChangeRequest':
                    result = updateChangeRequest(
                        payload.requestId || payload.id || payload.data?.requestId,
                        payload.updateData || payload.data || payload
                    );
                    break;
                case 'getChangeRequestStatistics':
                    result = getChangeRequestStatistics(payload.filters || payload.data?.filters || {});
                    break;
                case 'getNextChangeRequestNumber':
                    result = getNextChangeRequestNumber();
                    break;
                
                // ============================================
                // إعدادات النماذج (Form Settings) - النسخة المحسنة
                // ============================================
                case 'saveFormSettings':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = saveFormSettingsToSheet(payload);
                    break;
                case 'getFormSettings':
                    result = getFormSettingsFromSheet();
                    break;
                case 'initFormSettingsTables':
                    result = initFormSettingsTables();
                    break;
                
                // إعدادات الشركة (Company Settings)
                // ============================================
                case 'saveCompanySettings':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = saveCompanySettingsToSheet(payload);
                    break;
                case 'getCompanySettings':
                    result = getCompanySettingsFromSheet();
                    break;
                case 'initCompanySettingsTable':
                    result = initCompanySettingsTable();
                    break;
                
                // المواقع (Sites)
                case 'addSite':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = addSiteToSheet(payload);
                    break;
                case 'updateSite':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = updateSiteInSheet(payload.siteId || payload.id, payload);
                    break;
                case 'deleteSite':
                    result = deleteSiteFromSheet(payload.siteId || payload.id, payload.userData || payload.user);
                    break;
                case 'getAllSites':
                    result = getAllSitesFromSheet();
                    break;
                
                // الأماكن الفرعية (Places)
                case 'addPlace':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = addPlaceToSheet(payload);
                    break;
                case 'updatePlace':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = updatePlaceInSheet(payload.placeId || payload.id, payload);
                    break;
                case 'deletePlace':
                    result = deletePlaceFromSheet(payload.placeId || payload.id, payload.userData || payload.user);
                    break;
                case 'getAllPlaces':
                    result = getAllPlacesFromSheet(payload.siteId);
                    break;
                
                // الإدارات (Departments)
                case 'addDepartment':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = addDepartmentToSheet(payload);
                    break;
                case 'updateDepartment':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = updateDepartmentInSheet(payload.deptId || payload.id, payload);
                    break;
                case 'deleteDepartment':
                    result = deleteDepartmentFromSheet(payload.deptId || payload.id, payload.userData || payload.user);
                    break;
                case 'getAllDepartments':
                    result = getAllDepartmentsFromSheet();
                    break;
                
                // فريق السلامة (Safety Team)
                case 'addSafetyMember':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = addSafetyMemberToSheet(payload);
                    break;
                case 'updateSafetyMember':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = updateSafetyMemberInSheet(payload.memberId || payload.id, payload);
                    break;
                case 'deleteSafetyMember':
                    result = deleteSafetyMemberFromSheet(payload.memberId || payload.id, payload.userData || payload.user);
                    break;
                case 'getAllSafetyMembers':
                    result = getAllSafetyMembersFromSheet();
                    break;
                
                // ============================================
                // إدارة أنواع المخالفات (Violation Types Management)
                // ============================================
                case 'saveViolationTypes':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = saveViolationTypesToSheet(payload);
                    break;
                case 'getViolationTypes':
                    result = getViolationTypesFromSheet();
                    break;
                case 'updateViolationType':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = updateViolationTypeInSheet(payload.typeId || payload.id, payload.updateData || payload);
                    break;
                case 'deleteViolationType':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || ''
                        };
                    }
                    result = deleteViolationTypeFromSheet(payload.typeId || payload.id, payload.userData || payload.user);
                    break;
                
                // ============================================
                // الطوارئ (Emergency)
                // ============================================
                case 'addEmergencyAlert':
                    result = addEmergencyAlertToSheet(payload);
                    break;
                case 'updateEmergencyAlert':
                    result = updateEmergencyAlert(payload.alertId || payload.id, payload.updateData || payload);
                    break;
                case 'getAllEmergencyAlerts':
                    result = getAllEmergencyAlerts(payload.filters || {});
                    break;
                case 'addEmergencyPlan':
                    result = addEmergencyPlanToSheet(payload);
                    break;
                case 'updateEmergencyPlan':
                    result = updateEmergencyPlan(payload.planId || payload.id, payload.updateData || payload);
                    break;
                case 'getEmergencyPlan':
                    result = getEmergencyPlan(payload.planId || payload.id);
                    break;
                case 'getAllEmergencyPlans':
                    result = getAllEmergencyPlans(payload.filters || {});
                    break;
                case 'deleteEmergencyPlan':
                    result = deleteEmergencyPlan(payload.planId || payload.id);
                    break;

                // ✅ تحديثات خطط الطوارئ (Emergency Plans Updates)
                case 'upsertEmergencyPlanUpdate':
                    result = upsertEmergencyPlanUpdate(payload.sectionKey, payload);
                    break;
                case 'getAllEmergencyPlanUpdates':
                    result = getAllEmergencyPlanUpdates(payload.filters || {});
                    break;
                case 'getEmergencyPlanUpdate':
                    result = getEmergencyPlanUpdate(payload.sectionKey);
                    break;
                case 'deleteEmergencyPlanUpdate':
                    result = deleteEmergencyPlanUpdate(payload.sectionKey);
                    break;
                
                // ============================================
                // السجلات والذكاء الاصطناعي (Logs & AI)
                // ============================================
                case 'addAuditLog':
                    result = addAuditLogToSheet(payload);
                    break;
                case 'getAllAuditLogs':
                    result = getAllAuditLogs(payload.filters || {});
                    break;
                case 'addUserActivityLog':
                    result = addUserActivityLogToSheet(payload);
                    break;
                case 'getAllUserActivityLogs':
                    result = getAllUserActivityLogs(payload.filters || {});
                    break;
                case 'getUserActivityLogs':
                    result = getUserActivityLogs(payload.userId || payload.id, payload.filters || {});
                    break;
                case 'getLogStatistics':
                    result = getLogStatistics(payload.filters || {});
                    break;
                case 'getDailyUserSessionActivityReport':
                    result = getDailyUserSessionActivityReport(payload.filters || payload || {});
                    break;
                case 'addAIAssistantSettings':
                    result = addAIAssistantSettingsToSheet(payload);
                    break;
                case 'addUserAILog':
                    result = addUserAILogToSheet(payload);
                    break;
                
                // ============================================
                // إدارة السلامة والصحة المهنية (Safety & Health Management)
                // ============================================
                case 'addSafetyTeamMember':
                    result = addSafetyTeamMemberToSheet(payload);
                    break;
                case 'updateSafetyTeamMember':
                    result = updateSafetyTeamMember(payload.memberId, payload.updateData || payload);
                    break;
                case 'getSafetyTeamMembers':
                    try {
                        result = getSafetyTeamMembers();
                    } catch (error) {
                        Logger.log('Error calling getSafetyTeamMembers: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء getSafetyTeamMembers: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR'
                        };
                    }
                    break;
                case 'getSafetyTeamMember':
                    result = getSafetyTeamMember(payload.memberId || payload.id);
                    break;
                case 'deleteSafetyTeamMember':
                    result = deleteSafetyTeamMember(payload.memberId || payload.id);
                    break;
                case 'saveOrganizationalStructure':
                    result = saveOrganizationalStructureToSheet(payload);
                    break;
                case 'getOrganizationalStructure':
                    try {
                        result = getOrganizationalStructure();
                    } catch (error) {
                        Logger.log('Error calling getOrganizationalStructure: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء getOrganizationalStructure: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR'
                        };
                    }
                    break;
                case 'updateOrganizationalStructureOrder':
                    result = updateOrganizationalStructureOrder(payload);
                    break;
                case 'saveJobDescription':
                    result = saveJobDescriptionToSheet(payload);
                    break;
                case 'getJobDescription':
                    result = getJobDescription(payload.memberId || payload.employeeId);
                    break;
                case 'updateJobDescription':
                    result = updateJobDescription(payload.jobDescriptionId || payload.id, payload.updateData || payload);
                    break;
                case 'addSafetyTeamKPI':
                    result = addSafetyTeamKPIToSheet(payload);
                    break;
                case 'calculateSafetyTeamKPIs':
                    result = calculateSafetyTeamKPIs(payload.memberId, payload.period);
                    break;
                case 'getSafetyTeamKPIs':
                    result = getSafetyTeamKPIs(payload.memberId, payload.period);
                    break;
                case 'generateSafetyTeamPerformanceReport':
                    result = generateSafetyTeamPerformanceReport(payload.memberId, payload.startDate, payload.endDate);
                    break;
                case 'savePerformanceReport':
                    result = savePerformanceReportToSheet(payload);
                    break;
                case 'addSafetyTeamAttendance':
                    result = addSafetyTeamAttendanceToSheet(payload);
                    break;
                case 'addSafetyTeamLeave':
                    result = addSafetyTeamLeaveToSheet(payload);
                    break;
                case 'getSafetyTeamAttendance':
                    result = getSafetyTeamAttendance(payload.memberId, payload.startDate, payload.endDate);
                    break;
                case 'getSafetyTeamLeaves':
                    result = getSafetyTeamLeaves(payload.memberId, payload.startDate, payload.endDate);
                    break;
                case 'deleteSafetyTeamAttendance':
                    result = deleteSafetyTeamAttendance(payload.attendanceId || payload.id);
                    break;
                case 'updateSafetyTeamAttendance':
                    result = updateSafetyTeamAttendance(payload.attendanceId || payload.id, payload.updateData || payload);
                    break;
                case 'deleteSafetyTeamLeave':
                    result = deleteSafetyTeamLeave(payload.leaveId || payload.id);
                    break;
                case 'updateSafetyTeamLeave':
                    result = updateSafetyTeamLeave(payload.leaveId || payload.id, payload.updateData || payload);
                    break;
                case 'generateAttendanceReport':
                    result = generateAttendanceReport(payload.memberId, payload.period, payload.year, payload.month);
                    break;
                case 'getSafetyHealthManagementSettings':
                    try {
                        result = getSafetyHealthManagementSettings();
                    } catch (error) {
                        Logger.log('Error calling getSafetyHealthManagementSettings: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء getSafetyHealthManagementSettings: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR'
                        };
                    }
                    break;
                case 'saveSafetyHealthManagementSettings':
                    result = saveSafetyHealthManagementSettings(payload);
                    break;
                case 'updateLeaveTypes':
                    result = updateLeaveTypes(payload.leaveTypes);
                    break;
                case 'updateAttendanceStatuses':
                    result = updateAttendanceStatuses(payload.statuses);
                    break;
                case 'updateKPITargets':
                    result = updateKPITargets(payload.targets);
                    break;
                case 'addCustomKPI':
                    try {
                        result = addCustomKPI(payload);
                    } catch (error) {
                        Logger.log('Error calling addCustomKPI: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء addCustomKPI: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR',
                            hint: 'تأكد من أن ملف SafetyHealthManagement.gs موجود وأن الدالة addCustomKPI معرّفة بشكل صحيح'
                        };
                    }
                    break;
                case 'updateCustomKPI':
                    try {
                        result = updateCustomKPI(payload.kpiId, payload.updateData);
                    } catch (error) {
                        Logger.log('Error calling updateCustomKPI: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء updateCustomKPI: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR'
                        };
                    }
                    break;
                case 'deleteCustomKPI':
                    try {
                        result = deleteCustomKPI(payload.kpiId);
                    } catch (error) {
                        Logger.log('Error calling deleteCustomKPI: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء deleteCustomKPI: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR'
                        };
                    }
                    break;
                case 'calculateAllCustomKPIs':
                    try {
                        result = calculateAllCustomKPIs(payload.memberId, payload.period);
                    } catch (error) {
                        Logger.log('Error calling calculateAllCustomKPIs: ' + error.toString());
                        result = { 
                            success: false, 
                            message: 'خطأ في استدعاء calculateAllCustomKPIs: ' + error.toString(),
                            errorCode: 'FUNCTION_ERROR'
                        };
                    }
                    break;
                case 'updateSafetyTeamKPI':
                    result = updateSafetyTeamKPI(payload.kpiId || payload.id, payload.updateData || payload);
                    break;
                case 'addSafetyTeamTask':
                    result = addSafetyTeamTask(payload);
                    break;
                case 'updateSafetyTeamTask':
                    result = updateSafetyTeamTask(payload.taskId || payload.id, payload.updateData || payload);
                    break;
                case 'getSafetyTeamTasks':
                    result = getSafetyTeamTasks(payload.memberId, payload.status);
                    break;
                case 'deleteSafetyTeamTask':
                    result = deleteSafetyTeamTask(payload.taskId || payload.id);
                    break;
                
                // ============================================
                // User Tasks Management (مهام المستخدمين)
                // ============================================
                case 'addUserTask':
                    result = addUserTask(payload);
                    break;
                case 'updateUserTask':
                    result = updateUserTask(payload.taskId || payload.id, payload.updateData || payload);
                    break;
                case 'deleteUserTask':
                    result = deleteUserTask(payload.taskId || payload.id);
                    break;
                case 'getAllUserTasks':
                    result = getAllUserTasks();
                    break;
                case 'getUserTasksByUserId':
                    result = getUserTasksByUserId(payload.userId || payload.user_id);
                    break;
                case 'updateTaskCompletionRate':
                    result = updateTaskCompletionRate(
                        payload.taskId || payload.task_id,
                        payload.completionRate || payload.completion_rate,
                        payload.userId || payload.user_id
                    );
                    break;
                case 'addUserInstruction':
                    result = addUserInstruction(payload);
                    break;
                case 'getUserInstructionsByUserId':
                    result = getUserInstructionsByUserId(payload.userId || payload.user_id);
                    break;
                
                // ============================================
                // الذكاء الاصطناعي (AI)
                // ============================================
                case 'analyzeHSEData':
                    result = analyzeHSEData(payload.options || payload);
                    break;
                case 'detectPatterns':
                    result = detectPatterns(payload.moduleName, payload.options || {});
                    break;
                case 'getSmartRecommendations':
                    result = getSmartRecommendations(payload.userId, payload.context || {});
                    break;
                case 'processAIQuestion':
                    result = processAIQuestion(payload.question || payload.query, payload.context || {});
                    break;
                
                // ============================================
                // الإشعارات (Notifications)
                // ============================================
                case 'addNotification':
                    result = addNotification(payload);
                    break;
                case 'getUserNotifications':
                    result = getUserNotifications(payload.userId || payload.user_id);
                    break;
                case 'getUnreadNotificationsCount':
                    result = getUnreadNotificationsCount(payload.userId || payload.user_id);
                    break;
                case 'markNotificationAsRead':
                    result = markNotificationAsRead(payload.userId || payload.user_id, payload.notificationId || payload.id);
                    break;
                case 'deleteNotification':
                    result = deleteNotification(payload.userId || payload.user_id, payload.notificationId || payload.id);
                    break;
                
                // ============================================
                // إدارة الموديولات (Module Management - Admin Only)
                // ============================================
                case 'getAllModules':
                    result = getAllModules();
                    break;
                case 'getModuleInfo':
                    result = getModuleInfo(payload.moduleId || payload.id);
                    break;
                case 'updateModule':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    result = updateModule(payload.moduleId || payload.id, payload.updateData || payload, payload.userData || payload.user);
                    break;
                case 'deleteModule':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    result = deleteModule(payload.moduleId || payload.id, payload.userData || payload.user);
                    break;
                
                // ============================================
                // رفع الملفات إلى Google Drive
                // ============================================
                case 'uploadFileToDrive':
                    try {
                        if (payload.base64Data && payload.fileName && payload.mimeType) {
                            // رفع ملف واحد
                            result = uploadFileToDrive(
                                payload.base64Data,
                                payload.fileName,
                                payload.mimeType,
                                payload.moduleName || null
                            );
                        } else if (payload.files && Array.isArray(payload.files)) {
                            // رفع عدة ملفات دفعة واحدة
                            result = uploadMultipleFilesToDrive(
                                payload.files,
                                payload.moduleName || null
                            );
                        } else {
                            result = {
                                success: false,
                                message: 'يجب إرسال base64Data و fileName و mimeType، أو مصفوفة files'
                            };
                        }
                    } catch (error) {
                        Logger.log('Error in uploadFileToDrive: ' + error.toString());
                        result = {
                            success: false,
                            message: 'حدث خطأ أثناء رفع الملف: ' + error.toString()
                        };
                    }
                    break;
                
                case 'deleteFileFromDrive':
                    result = deleteFileFromDrive(payload.fileId);
                    break;
                
                case 'processAttachmentsForSave':
                    try {
                        const processedAttachments = processAttachmentsForSave(
                            payload.attachments || [],
                            payload.moduleName || null
                        );
                        result = {
                            success: true,
                            attachments: processedAttachments
                        };
                    } catch (error) {
                        Logger.log('Error in processAttachmentsForSave: ' + error.toString());
                        result = {
                            success: false,
                            message: 'حدث خطأ أثناء معالجة المرفقات: ' + error.toString()
                        };
                    }
                    break;
                
                // ============================================
                // النسخ الاحتياطي (Backup System)
                // ============================================
                case 'createManualBackup':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    result = createManualBackup(payload.userData || payload.user, payload.spreadsheetId || postData.spreadsheetId);
                    break;
                case 'createAutomaticBackup':
                    result = createAutomaticBackup();
                    break;
                case 'getAllBackups':
                    result = getAllBackups(payload.filters || {});
                    break;
                case 'getBackup':
                    result = getBackup(payload.backupId || payload.id);
                    break;
                case 'deleteBackup':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    result = deleteBackup(payload.backupId || payload.id, payload.userData || payload.user);
                    break;
                case 'restoreFromBackup':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    result = restoreFromBackup(payload.backupId || payload.id, payload.userData || payload.user, payload.options || {});
                    break;
                case 'setupAutomaticBackup':
                    result = setupAutomaticBackup();
                    break;
                case 'disableAutomaticBackup':
                    result = disableAutomaticBackup();
                    break;
                case 'getAutomaticBackupStatus':
                    result = getAutomaticBackupStatus();
                    break;
                case 'getBackupSettings':
                    result = getBackupSettings();
                    break;
                case 'saveBackupSettings':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    result = saveBackupSettings(payload, payload.userData || payload.user);
                    break;
                case 'getBackupStatistics':
                    result = getBackupStatistics();
                    break;
                case 'downloadBackup':
                    result = downloadBackup(payload.backupId || payload.id);
                    break;
                case 'importBackup':
                case 'importBackupFromFile':
                    if (payload && !payload.userData && !payload.user) {
                        payload.userData = payload.userData || payload.user || {
                            role: payload.role || '',
                            permissions: payload.permissions || {},
                            name: payload.name || '',
                            email: payload.email || '',
                            id: payload.userId || payload.id
                        };
                    }
                    // يقبل fileId أو fileUrl أو أي نص يحتوي ID
                    result = importBackupFromFile(
                        payload.fileId || payload.fileUrl || payload.file || payload.driveFileId,
                        payload.userData || payload.user,
                        payload.options || {}
                    );
                    break;
                case 'testBackupSystem':
                    result = testBackupSystem();
                    break;
                
                // ============================================
                // Action غير معترف به
                // ============================================
                default:
                    Logger.log('Action not recognized: "' + action + '" (type: ' + typeof action + ', length: ' + (action ? action.length : 0) + ')');
                    
                    const safetyHealthActions = [
                        'getSafetyTeamMembers', 'getSafetyTeamMember', 'addSafetyTeamMember', 'updateSafetyTeamMember',
                        'getOrganizationalStructure', 'saveOrganizationalStructure',
                        'getJobDescription', 'saveJobDescription',
                        'getSafetyTeamKPIs', 'getSafetyHealthManagementSettings', 'saveSafetyHealthManagementSettings',
                        'updateLeaveTypes', 'updateAttendanceStatuses', 'updateKPITargets',
                        'addCustomKPI', 'updateCustomKPI', 'deleteCustomKPI', 'calculateAllCustomKPIs',
                        'calculateSafetyTeamKPIs', 'generateSafetyTeamPerformanceReport', 'updateSafetyTeamKPI'
                    ];
                    
                    const isSafetyHealthAction = safetyHealthActions.includes(action);
                    
                    result = { 
                        success: false, 
                        message: 'الـ action "' + action + '" غير معترف به. يرجى التأكد من إضافة جميع الملفات المطلوبة إلى مشروع Google Apps Script وإعادة نشر Web App.',
                        errorCode: 'ACTION_NOT_RECOGNIZED',
                        action: action,
                        actionType: typeof action,
                        actionLength: action ? action.length : 0,
                        hint: isSafetyHealthAction 
                            ? 'هذا الـ action يتطلب ملف SafetyHealthManagement.gs. تأكد من إضافة الملف وإعادة نشر Web App.'
                            : 'تأكد من أن جميع الملفات المطلوبة موجودة في المشروع وأن جميع الدوال معرّفة بشكل صحيح',
                        recognizedActions: isSafetyHealthAction ? safetyHealthActions : undefined
                    };
            }
        } catch (switchError) {
            // معالجة الأخطاء في switch statement
            Logger.log('❌ [CODE.GS] Error in switch statement for action "' + action + '": ' + switchError.toString());
            Logger.log('❌ [CODE.GS] Error stack: ' + (switchError.stack || 'No stack trace'));
            Logger.log('❌ [CODE.GS] payload at error: ' + JSON.stringify(payload).substring(0, 500));
            
            result = {
                success: false,
                message: 'خطأ في معالجة الطلب: ' + switchError.toString(),
                errorCode: 'SWITCH_ERROR',
                action: action,
                errorType: switchError.name || 'Unknown',
                hint: 'تحقق من Execution Logs في Google Apps Script لمزيد من التفاصيل'
            };
        }
        
        // ============================================
        // 7. إرجاع النتيجة مع CORS headers
        // ============================================
        const output = ContentService.createTextOutput(JSON.stringify(result));
        return setCorsHeaders(output);
        
    } catch (error) {
        // معالجة الأخطاء العامة
        Logger.log('Error in doPost: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        
        let errorMessage = error.toString();
        let actionHint = '';
        
        try {
            if (error.toString().includes('JSON') || error.toString().includes('parse')) {
                errorMessage = 'خطأ في تحليل البيانات المرسلة. يرجى التحقق من تنسيق الطلب.';
                actionHint = 'تحقق من أن الطلب يتم إرساله بتنسيق JSON صحيح';
            }
        } catch (e) {
            // تجاهل الأخطاء في معالجة الخطأ
        }
        
        const errorOutput = ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: errorMessage,
            errorCode: 'INTERNAL_ERROR',
            errorType: error.name || 'Unknown',
            hint: actionHint || 'تحقق من Execution Logs في Google Apps Script لمزيد من التفاصيل'
        }));
        return setCorsHeaders(errorOutput);
    }
}

/**
 * ============================================
 * معالجة طلبات GET
 * ============================================
 * ملاحظة: يُفضل استخدام POST لجميع العمليات، GET مخصص فقط للقراءة البسيطة
 */
function doGet(e) {
    try {
        // التحقق من وجود postData (قد يحدث إذا كان URL خاطئ)
        if (e && e.postData && e.postData.contents) {
            Logger.log('Warning: POST data received in doGet(). This usually means URL is wrong (ends with /dev instead of /exec)');
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'Invalid request. POST data received in doGet(). URL may be incorrect.',
                errorCode: 'WRONG_URL_ENDPOINT',
                hint: 'URL يجب أن ينتهي بـ /exec وليس /dev. أعد نشر Web App واستخدم رابط /exec',
                troubleshooting: {
                    step1: 'تحقق من URL في الإعدادات - يجب أن ينتهي بـ /exec',
                    step2: 'إذا كان URL ينتهي بـ /dev، استبدله برابط /exec',
                    step3: 'أعد نشر Web App: Deploy → Manage deployments → Edit → New version → Deploy',
                    step4: 'انسخ رابط /exec الجديد والصقه في الإعدادات'
                },
                note: 'ملاحظة: ملف google-apps-script.gs غير مطلوب. الملف الرئيسي هو Code.gs'
            })).setMimeType(ContentService.MimeType.JSON);
        }
        
        // إذا تم الوصول للرابط مباشرة بدون parameters
        if (!e) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'Google Apps Script is running. Please use POST method with action parameter for data operations.',
                info: 'This Web App handles HSE System data operations. Use POST requests with JSON payload.',
                status: 'active'
            })).setMimeType(ContentService.MimeType.JSON);
        }
        
        // التحقق من وجود parameters
        if (!e.parameter || Object.keys(e.parameter).length === 0) {
            return ContentService.createTextOutput(JSON.stringify({
                success: true,
                status: 'active',
                message: 'Google Apps Script Web App is running successfully.',
                info: 'This Web App handles HSE System data operations.',
                usage: {
                    method: 'POST (recommended)',
                    description: 'Use POST method with JSON payload for all data operations',
                    example: {
                        action: 'initializeSheets',
                        data: {
                            spreadsheetId: 'YOUR_SPREADSHEET_ID'
                        }
                    }
                },
                getRequest: {
                    method: 'GET',
                    description: 'For simple data reading only',
                    example: '?action=getData&sheetName=Users&spreadsheetId=YOUR_SPREADSHEET_ID',
                    note: 'GET requests are limited. Use POST for better reliability.'
                },
                currentSpreadsheetId: getSpreadsheetId() || 'Not configured',
                hint: 'To test, add parameters: ?action=getData&sheetName=Users'
            })).setMimeType(ContentService.MimeType.JSON);
        }
        
        const action = e.parameter.action;
        const sheetName = e.parameter.sheetName;
        const spreadsheetId = e.parameter.spreadsheetId || getSpreadsheetId();
        const getActionPattern = /^[a-zA-Z][a-zA-Z0-9_]{1,79}$/;
        if (action && !getActionPattern.test(String(action))) {
            if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('invalid_get_action_format', { action: String(action), severity: 'medium' });
            }
            return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'صيغة action غير صالحة في GET',
                errorCode: 'INVALID_GET_ACTION_FORMAT'
            })));
        }

        const allowedGetActions = {
            getData: true,
            getProfileImage: true,
            publicProfileCard: true,
            getPublicProfileData: true
        };
        if (action && !allowedGetActions[action]) {
            if (typeof logSecurityEvent === 'function') {
                logSecurityEvent('blocked_get_action', { action: String(action), severity: 'low' });
            }
            return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'هذا الإجراء غير مسموح عبر GET. استخدم POST.',
                errorCode: 'GET_ACTION_NOT_ALLOWED',
                action: action
            })));
        }
        
        // معالجة طلب getProfileImage: إرجاع صورة الملف الشخصي من Drive كـ data URI (يعمل بعد النشر)
        if (action === 'getProfileImage') {
            const fileId = (e.parameter.id || '').trim();
            if (!fileId) {
                const errOut = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'معرف الملف (id) مطلوب لـ getProfileImage'
                })).setMimeType(ContentService.MimeType.JSON);
                return setCorsHeaders(errOut);
            }
            try {
                const file = DriveApp.getFileById(fileId);
                const blob = file.getBlob();
                const mimeType = blob.getContentType() || 'image/jpeg';
                const base64 = Utilities.base64Encode(blob.getBytes());
                const dataUri = 'data:' + mimeType + ';base64,' + base64;
                const output = ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    dataUri: dataUri
                })).setMimeType(ContentService.MimeType.JSON);
                return setCorsHeaders(output);
            } catch (err) {
                Logger.log('getProfileImage error for id ' + fileId + ': ' + err.toString());
                const errOut = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'الملف غير موجود أو لا يمكن الوصول إليه'
                })).setMimeType(ContentService.MimeType.JSON);
                return setCorsHeaders(errOut);
            }
        }

        // بطاقة الملف العام (HTML) عبر token
        if (action === 'publicProfileCard') {
            const token = String(e.parameter.token || '').trim();
            const profileResult = getPublicProfileByToken(token);
            if (!profileResult || profileResult.success === false || !profileResult.data) {
                const message = (profileResult && profileResult.message) ? profileResult.message : 'الرابط غير صالح أو منتهي الصلاحية';
                const htmlError = HtmlService.createHtmlOutput(
                    '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public Profile</title></head><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;"><div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;"><h2 style="margin:0 0 8px;color:#0f172a;">تعذر عرض البطاقة</h2><p style="margin:0;color:#475569;">' + message + '</p></div></body></html>'
                );
                return htmlError;
            }

            const p = profileResult.data || {};
            const esc = function(v) {
                return String(v || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            };

            const pubPhoto = p.photoPublic || '';
            const photoIsData = pubPhoto && String(pubPhoto).indexOf('data:') === 0;
            const photoIsHttp = pubPhoto && /^https?:\/\//i.test(String(pubPhoto));
            let photoBlock = '';
            if (photoIsData || photoIsHttp) {
                photoBlock = '<img src="' + esc(pubPhoto) + '" alt="photo" style="width:92px;height:92px;border-radius:999px;object-fit:cover;border:3px solid rgba(255,255,255,.35);box-shadow:0 4px 12px rgba(0,0,0,.2);">';
            } else {
                photoBlock = '<div style="width:92px;height:92px;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>';
            }

            const ecList = p.emergencyContacts || [];
            let emRows = '';
            for (var ei = 0; ei < ecList.length; ei++) {
                const ec = ecList[ei] || {};
                const lab = String(ec.label || 'طوارئ').trim();
                const ph = String(ec.phone || '').trim();
                const tel = ph.replace(/[^\d+]/g, '');
                emRows += '<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;">' + esc(lab) + '</td>'
                    + '<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;direction:ltr;">'
                    + (ph ? '<a href="tel:' + esc(tel) + '" style="color:#0d9488;font-weight:700;text-decoration:none;">' + esc(ph) + '</a>' : '—')
                    + '</td></tr>';
            }
            const emSection = (emRows)
                ? ('<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">أرقام طوارئ المؤسسة</h3>'
                    + '<table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>' + emRows + '</tbody></table>')
                : '<p style="margin:0;color:#94a3b8;font-size:13px;">لا توجد أرقام طوارئ مسجّلة حالياً</p>';

            const hireBlock = (p.hireDateDisplay) ? (
                '<div style="grid-column:1/-1;border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#f8fafc;">'
                    + '<div style="color:#64748b;font-size:12px;">تاريخ التعيين</div>'
                    + '<div style="color:#0f172a;font-weight:700;">' + esc(p.hireDateDisplay) + '</div>'
                    + (p.tenureText ? '<div style="color:#475569;font-size:12px;margin-top:4px;">مدة الخدمة: ' + esc(p.tenureText) + '</div>' : '')
                    + '</div>'
            ) : (
                '<div style="grid-column:1/-1;border:1px solid #e2e8f0;border-radius:10px;padding:10px;"><div style="color:#64748b;font-size:12px;">تاريخ التعيين</div><div style="color:#0f172a;font-weight:700;">—</div></div>'
            );

            const html = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>بطاقة الموظف</title><style>body{-webkit-text-size-adjust:100%;}</style></head><body style="margin:0;font-family:system-ui,-apple-system,\'Segoe UI\',Arial,sans-serif;background:linear-gradient(180deg,#e0f2f1 0%,#f1f5f9 40%);min-height:100vh;padding:16px;box-sizing:border-box;">'
                + '<div style="max-width:800px;margin:0 auto;">'
                + '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.08);">'
                + '<div style="padding:20px 22px;background:linear-gradient(125deg,#0f766e 0%,#115e59 50%,#134e4a 100%);color:#fff;">'
                + '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">'
                + '<div style="flex:1;min-width:200px;">'
                + '<div style="font-size:12px;letter-spacing:.04em;opacity:.85;">بطاقة موظف معتمدة</div>'
                + '<h1 style="margin:6px 0 0;font-size:22px;font-weight:800;">' + esc(p.fullName || '—') + '</h1>'
                + '<p style="margin:6px 0 0;font-size:14px;opacity:.95;">' + esc(p.position || '—') + '</p>'
                + '<p style="margin:4px 0 0;font-size:12px;opacity:.85;">' + esc(p.department || '—') + '</p></div>'
                + photoBlock
                + '</div><p style="margin:12px 0 0;font-size:12px;opacity:.8;">' + esc(p.companyName || 'HSE') + '</p></div>'
                + '<div style="padding:18px 20px 22px;">'
                + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px;">'
                + '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;"><div style="color:#64748b;font-size:12px;">الرقم الوظيفي</div><div style="color:#0f172a;font-weight:700;">' + esc(p.employeeNumber || '—') + '</div></div>'
                + '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;"><div style="color:#64748b;font-size:12px;">الهاتف</div><div style="color:#0f172a;font-weight:700;direction:ltr;text-align:right;">' + esc(p.phone || '—') + '</div></div>'
                + '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;grid-column:1/-1;word-break:break-all;"><div style="color:#64748b;font-size:12px;">البريد الإلكتروني</div><div style="color:#0f172a;font-weight:600;">' + esc(p.email || '—') + '</div></div>'
                + (p.branch ? ('<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;"><div style="color:#64748b;font-size:12px;">الفرع</div><div style="color:#0f172a;font-weight:700;">' + esc(p.branch) + '</div></div>') : '')
                + (p.location ? ('<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;"><div style="color:#64748b;font-size:12px;">الموقع</div><div style="color:#0f172a;font-weight:700;">' + esc(p.location) + '</div></div>') : '')
                + hireBlock
                + '</div>'
                + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:16px;">'
                + '<div style="border:1px solid #ccfbf1;border-radius:10px;padding:10px;background:#f0fdfa;"><div style="color:#0f766e;font-size:11px;">دورات تدريبية</div><div style="color:#0f172a;font-weight:800;font-size:18px;">' + esc(p.trainingSessions || 0) + '</div></div>'
                + '<div style="border:1px solid #fee2e2;border-radius:10px;padding:10px;background:#fffbeb;"><div style="color:#b45309;font-size:11px;">مخالفات مسجّلة</div><div style="color:#0f172a;font-weight:800;font-size:18px;">' + esc(p.violationsCount || 0) + '</div></div>'
                + '<div style="border:1px solid #e0e7ff;border-radius:10px;padding:10px;background:#f5f3ff;"><div style="color:#4f46e5;font-size:11px;">مهمات وقاية</div><div style="color:#0f172a;font-weight:800;font-size:18px;">' + esc(p.ppeCount || 0) + '</div></div>'
                + '</div>'
                + '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;background:#fafafa;">' + emSection + '</div>'
                + '<p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">بطاقة عامة محدودة — لعرض معلومات التعريف الأساسية فقط. لا تُبنى لها صلاحيات دخول للنظام.</p>'
                + '</div></div></div></body></html>';
            return HtmlService.createHtmlOutput(html);
        }

        // API عام (JSON) عبر token - بيانات محدودة
        if (action === 'getPublicProfileData') {
            const token = String(e.parameter.token || '').trim();
            const profileResult = getPublicProfileByToken(token);
            const output = ContentService.createTextOutput(JSON.stringify(profileResult || { success: false, message: 'فشل جلب بيانات الملف العام' }))
                .setMimeType(ContentService.MimeType.JSON);
            return setCorsHeaders(output);
        }

        // معالجة طلب getData
        if (action === 'getData') {
            if (!sheetName || sheetName.trim() === '') {
                const errorOutput = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'Sheet name is required for getData action',
                    received: {
                        action: action || 'none',
                        sheetName: sheetName || 'none',
                        spreadsheetId: spreadsheetId ? 'provided' : 'using default'
                    }
                }));
                return setCorsHeaders(errorOutput);
            }
            
            try {
                const data = readFromSheet(sheetName, spreadsheetId);
                const output = ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    data: data,
                    count: Array.isArray(data) ? data.length : 0
                }));
                return setCorsHeaders(output);
            } catch (readError) {
                Logger.log('Error in readFromSheet: ' + readError.toString());
                const errorOutput = ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'Error reading sheet: ' + readError.toString(),
                    sheetName: sheetName
                }));
                return setCorsHeaders(errorOutput);
            }
        }
        
        // إذا لم يكن action معروفاً
        const receivedParams = {
            action: action || 'none',
            sheetName: sheetName || 'none',
            spreadsheetId: spreadsheetId ? 'provided' : 'none',
            allParameters: e.parameter
        };
        
        const output = ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Invalid request. This request reached doGet() instead of doPost().',
            errorCode: 'WRONG_HTTP_METHOD',
            received: receivedParams,
            hint: 'Use POST method with action in JSON payload. Make sure URL ends with /exec (not /dev)',
            troubleshooting: {
                step1: 'تحقق من أن URL ينتهي بـ /exec وليس /dev',
                step2: 'تأكد من استخدام POST method وليس GET',
                step3: 'تأكد من إرسال JSON payload مع action و data',
                step4: 'أعد نشر Web App إذا استمرت المشكلة',
                step5: 'تحقق من Execution Logs في Google Apps Script لمزيد من التفاصيل'
            },
            note: 'ملاحظة: ملف google-apps-script.gs غير مطلوب. الملف الرئيسي هو Code.gs',
            supportedGetActions: ['getData', 'getProfileImage', 'publicProfileCard', 'getPublicProfileData'],
            recommendedMethod: 'POST',
            commonIssues: {
                issue1: 'URL ينتهي بـ /dev بدلاً من /exec → استخدم رابط /exec',
                issue2: 'الطلب يتم إرساله كـ GET → استخدم POST method',
                issue3: 'البيانات غير موجودة في body → أرسل JSON في body الطلب',
                issue4: 'Web App غير منشور بشكل صحيح → أعد نشر Web App'
            }
        }));
        return setCorsHeaders(output);
        
    } catch (error) {
        Logger.log('Error in doGet: ' + error.toString());
        const errorOutput = ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Error in doGet: ' + error.toString()
        }));
        return setCorsHeaders(errorOutput);
    }
}

/**
 * ============================================
 * معالجة طلبات OPTIONS (لـ CORS Preflight)
 * ============================================
 * هذه الدالة مهمة لدعم CORS بشكل صحيح
 * ملاحظة: في بعض الحالات، قد يتم توجيه طلبات OPTIONS إلى doPost() بدلاً من doOptions()
 * لذلك نحتاج للتعامل معها في كلا الدالتين
 */
function doOptions(e) {
    try {
        Logger.log('doOptions() called for CORS preflight request');
        
        if (e) {
            Logger.log('doOptions() e keys: ' + Object.keys(e).join(', '));
        } else {
            Logger.log('doOptions() called with null e (this is normal for CORS preflight)');
        }
        
        // Google Apps Script يدعم CORS تلقائياً عند النشر مع "Who has access: Anyone"
        // نرجع استجابة فارغة بنجاح للسماح بـ CORS preflight requests
        // استخدام JSON فارغ بدلاً من string فارغ لضمان MIME type صحيح
        const output = ContentService.createTextOutput('{}');
        output.setMimeType(ContentService.MimeType.JSON);
        
        // ملاحظة: Google Apps Script يضيف CORS headers تلقائياً عند:
        // 1. نشر Web App مع "Who has access: Anyone"
        // 2. استخدام ContentService.createTextOutput()
        // 3. تعيين MIME type بشكل صحيح
        
        return output;
        
    } catch (error) {
        Logger.log('Error in doOptions: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        
        // حتى في حالة الخطأ، نعيد استجابة مع CORS headers
        const errorOutput = ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Error in doOptions: ' + error.toString(),
            errorCode: 'OPTIONS_ERROR',
            hint: 'حدث خطأ في معالجة طلب CORS preflight'
        }));
        errorOutput.setMimeType(ContentService.MimeType.JSON);
        return errorOutput;
    }
}
