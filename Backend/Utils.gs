/**
 * Google Apps Script for HSE System - Utility Functions
 * 
 * الدوال المساعدة المشتركة
 */

/**
 * ============================================
 * Error Codes للتحسين
 * ============================================
 */
const ERROR_CODES = {
    INVALID_SPREADSHEET_ID: 'E001',
    INVALID_SHEET_NAME: 'E002',
    INVALID_DATA: 'E003',
    SHEET_NOT_FOUND: 'E004',
    HEADERS_MISSING: 'E005',
    DATA_READ_ERROR: 'E006',
    DATA_WRITE_ERROR: 'E007',
    PERMISSION_DENIED: 'E008',
    UNKNOWN_ERROR: 'E999'
};

/**
 * ============================================
 * نظام Cache بسيط لتحسين الأداء
 * ============================================
 */

// متغير global لحفظ الـ cache خلال نفس الجلسة
var _sessionCache = {};

/**
 * الحصول على بيانات من الـ cache
 * @param {string} key - مفتاح البيانات
 * @param {number} maxAge - العمر الأقصى بالثواني (افتراضي: 60 ثانية)
 * @return {*} - البيانات المحفوظة أو null إذا لم توجد أو انتهت صلاحيتها
 */
function getCachedData(key, maxAge) {
    maxAge = maxAge || 60; // 60 ثانية افتراضياً
    
    try {
        if (_sessionCache[key]) {
            const cached = _sessionCache[key];
            const age = (new Date().getTime() - cached.timestamp) / 1000;
            
            if (age <= maxAge) {
                return cached.data;
            } else {
                // حذف البيانات المنتهية الصلاحية
                delete _sessionCache[key];
            }
        }
    } catch (error) {
        Logger.log('Error getting cached data: ' + error.toString());
    }
    
    return null;
}

/**
 * حفظ بيانات في الـ cache
 * @param {string} key - مفتاح البيانات
 * @param {*} data - البيانات المراد حفظها
 */
function setCachedData(key, data) {
    try {
        _sessionCache[key] = {
            data: data,
            timestamp: new Date().getTime()
        };
    } catch (error) {
        Logger.log('Error setting cached data: ' + error.toString());
    }
}

/**
 * حذف بيانات من الـ cache
 * @param {string} key - مفتاح البيانات
 */
function clearCachedData(key) {
    try {
        if (key) {
            delete _sessionCache[key];
        } else {
            // حذف كل الـ cache
            _sessionCache = {};
        }
    } catch (error) {
        Logger.log('Error clearing cached data: ' + error.toString());
    }
}

/**
 * إعداد CORS headers
 * ملاحظة: Google Apps Script يدعم CORS تلقائياً عند النشر مع "Who has access: Anyone"
 * لكن يمكننا إضافة headers إضافية للتحسين
 * 
 * ⚠️ مهم: للتأكد من عمل CORS بشكل صحيح:
 * 1. افتح Google Apps Script Editor
 * 2. اضغط Deploy > Manage Deployments
 * 3. اضغط Edit (أيقونة القلم) على Deployment الحالي
 * 4. تأكد من:
 *    - Execute as: Me
 *    - Who has access: Anyone (مهم جداً!)
 * 5. اضغط Deploy
 * 6. انسخ الرابط الجديد (يجب أن ينتهي بـ /exec)
 */
function setCorsHeaders(output) {
    if (!output) {
        output = ContentService.createTextOutput('');
    }
    
    try {
        // تعيين MIME type
        output = output.setMimeType(ContentService.MimeType.JSON);
        
        // ملاحظة: Google Apps Script لا يدعم setHeader() مباشرة
        // CORS يتم التعامل معه تلقائياً عند النشر بشكل صحيح
        // لكن يمكننا استخدام HtmlService في بعض الحالات الخاصة
        
        // التأكد من أن output هو ContentService.TextOutput
        // هذا يساعد Google Apps Script على إضافة CORS headers تلقائياً
        
        return output;
    } catch (e) {
        Logger.log('Error in setCorsHeaders: ' + e.toString());
        // حتى في حالة الخطأ، نعيد output مع MIME type صحيح
        try {
            return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.JSON);
        } catch (e2) {
            return output;
        }
    }
}

/**
 * ============================================
 * Public IP (Server-side) - to avoid browser CORS/ETP blocks
 * ============================================
 */
function getPublicIP() {
    try {
        // Cache for a short period to reduce external calls
        const cache = CacheService.getScriptCache();
        const cacheKey = 'hse_public_ip_ipify_v1';
        const cached = cache.get(cacheKey);
        if (cached) {
            return { success: true, data: { ip: cached, source: 'cache' } };
        }

        const url = 'https://api.ipify.org?format=json';
        const resp = UrlFetchApp.fetch(url, {
            method: 'get',
            muteHttpExceptions: true,
            followRedirects: true
        });

        const status = resp.getResponseCode();
        const text = resp.getContentText();
        if (status < 200 || status >= 300) {
            return {
                success: false,
                message: 'Failed to fetch public IP from ipify',
                status: status,
                response: text ? text.substring(0, 200) : ''
            };
        }

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            return { success: false, message: 'Invalid JSON from ipify', response: text ? text.substring(0, 200) : '' };
        }

        const ip = parsed && parsed.ip ? String(parsed.ip) : '';
        if (!ip) {
            return { success: false, message: 'ipify response missing ip field', response: text ? text.substring(0, 200) : '' };
        }

        // 5 minutes cache
        cache.put(cacheKey, ip, 300);
        return { success: true, data: { ip: ip, source: 'ipify' } };
    } catch (error) {
        Logger.log('Error in getPublicIP: ' + error.toString());
        return { success: false, message: 'Server error while getting public IP', error: error.toString() };
    }
}

/**
 * ============================================
 * نظام Logging محسّن
 * ============================================
 */

/**
 * مستويات Logging
 */
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARNING: 'WARNING',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

/**
 * تسجيل رسالة مع مستوى محدد
 * @param {string} level - مستوى السجل (ERROR, WARNING, INFO, DEBUG)
 * @param {string} message - الرسالة
 * @param {Error} error - كائن الخطأ (اختياري)
 */
function logMessage(level, message, error) {
    try {
        const timestamp = new Date().toISOString();
        let logMessage = '[' + timestamp + '] [' + level + '] ' + message;
        
        if (error) {
            logMessage += '\nError: ' + error.toString();
            if (error.stack) {
                logMessage += '\nStack: ' + error.stack;
            }
        }
        
        Logger.log(logMessage);
        
        // في حالة ERROR، يمكن إضافة إشعارات إضافية هنا
        if (level === LOG_LEVELS.ERROR) {
            // يمكن إضافة إشعارات إضافية للخطأ
        }
    } catch (e) {
        // إذا فشل Logging، نستخدم Logger.log العادي
        Logger.log('Error in logMessage: ' + e.toString());
        Logger.log(message);
    }
}

/**
 * التحقق من CSRF Token (للتحسين الأمني)
 * ملاحظة: بسبب مشكلة CORS مع custom headers في Google Apps Script،
 * نتحقق من CSRF token في payload فقط
 */
function validateCSRFToken(requestToken, options) {
    // دعم التوافق مع الاستدعاء القديم: validateCSRFToken(token)
    options = options || {};

    // إذا لم يتم إرسال token، نرفض الطلب
    if (!requestToken || requestToken.length < 32) {
        return false;
    }

    // التحقق من أن token هو hexadecimal string (SHA-256 hash)
    const hexPattern = /^[0-9a-f]{32,}$/i;
    if (!hexPattern.test(requestToken)) {
        return false;
    }

    // في حال عدم تمرير sessionKey نكتفي بالتوافق القديم
    const sessionKey = String(options.sessionKey || '').trim();
    if (!sessionKey) return true;

    // ربط token بالجلسة مع TTL في CacheService
    const ttlSec = Math.max(300, Math.min(86400, Number(options.ttlSec || 7200)));
    const cacheKey = 'csrf_binding_v2:' + requestToken;
    const cache = CacheService.getScriptCache();

    try {
        const cached = cache.get(cacheKey);
        if (!cached) {
            const payload = {
                sessionKey: sessionKey,
                createdAt: new Date().toISOString()
            };
            cache.put(cacheKey, JSON.stringify(payload), ttlSec);
            return true;
        }

        const parsed = JSON.parse(String(cached));
        if (!parsed || !parsed.sessionKey) return false;
        return String(parsed.sessionKey) === sessionKey;
    } catch (error) {
        Logger.log('validateCSRFToken session-bind error: ' + error.toString());
        return false;
    }
}

/**
 * تنظيف آمن لكائنات الطلب لمنع prototype pollution
 */
function sanitizeRequestObject(input, depth) {
    const maxDepth = 8;
    const currentDepth = Number(depth || 0);
    if (currentDepth > maxDepth) return null;

    if (input === null || input === undefined) return input;

    if (typeof input === 'string') {
        return input.replace(/\u0000/g, '');
    }

    if (typeof input !== 'object') return input;

    if (Array.isArray(input)) {
        return input.map(function(item) {
            return sanitizeRequestObject(item, currentDepth + 1);
        });
    }

    const out = {};
    const blockedKeys = { '__proto__': true, 'constructor': true, 'prototype': true };
    Object.keys(input).forEach(function(key) {
        if (blockedKeys[key]) return;
        out[key] = sanitizeRequestObject(input[key], currentDepth + 1);
    });
    return out;
}

/**
 * تحديد هوية سياقية للطلب (لـ rate-limit و CSRF session binding)
 */
function buildRequestSessionKey(action, token, sessionId, userHint) {
    const actionPart = String(action || '').trim().substring(0, 80);
    const tokenPart = String(token || '').trim().substring(0, 64);
    const sessionPart = String(sessionId || '').trim().substring(0, 120);
    const userPart = String(userHint || '').trim().toLowerCase().substring(0, 120);
    return [actionPart, tokenPart, sessionPart, userPart].join('|');
}

/**
 * Rate limit بسيط باستخدام CacheService
 */
function checkRateLimit(limitKey, limit, windowSec) {
    const maxHits = Math.max(5, Number(limit || 60));
    const windowSeconds = Math.max(10, Number(windowSec || 60));
    const cacheKey = 'rl_v1:' + String(limitKey || 'anon');
    const cache = CacheService.getScriptCache();

    try {
        const raw = cache.get(cacheKey);
        const current = raw ? Number(raw) : 0;
        const next = current + 1;
        cache.put(cacheKey, String(next), windowSeconds);
        return {
            allowed: next <= maxHits,
            current: next,
            limit: maxHits,
            windowSec: windowSeconds
        };
    } catch (error) {
        Logger.log('checkRateLimit error: ' + error.toString());
        return { allowed: true, current: 0, limit: maxHits, windowSec: windowSeconds };
    }
}

/**
 * فحص عام سريع للبيانات الواردة قبل الكتابة
 */
function validatePayloadForSheetWrite(sheetName, data) {
    const result = { valid: true, message: '' };
    const safeSheetName = String(sheetName || '').trim();
    if (!safeSheetName) {
        return { valid: false, message: 'sheetName مطلوب' };
    }

    const headers = getDefaultHeaders(safeSheetName) || [];
    if (!headers.length) return result; // لا نكسر الوحدات القديمة

    const records = Array.isArray(data) ? data : [data];
    const allowed = {};
    headers.forEach(function(h) { allowed[String(h)] = true; });

    for (var i = 0; i < records.length; i++) {
        const row = records[i];
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        const keys = Object.keys(row);
        for (var k = 0; k < keys.length; k++) {
            const key = keys[k];
            if (!allowed[key]) {
                return {
                    valid: false,
                    message: 'حقل غير مسموح في البيانات: ' + key + ' (sheet=' + safeSheetName + ')'
                };
            }
        }
    }

    return result;
}

/**
 * سجل أمني مركزي لمحاولات الرفض/الهجوم
 */
function logSecurityEvent(eventName, details) {
    try {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return;
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const sheetName = 'SecurityAuditLog';
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
            sheet.getRange(1, 1, 1, 5).setValues([['timestamp', 'event', 'details', 'source', 'severity']]);
        }

        const payload = details && typeof details === 'object' ? details : { value: String(details || '') };
        sheet.appendRow([
            new Date().toISOString(),
            String(eventName || 'unknown'),
            JSON.stringify(payload).substring(0, 45000),
            'Code.gs',
            String(payload.severity || 'medium')
        ]);
    } catch (error) {
        Logger.log('logSecurityEvent error: ' + error.toString());
    }
}

/**
 * إنشاء ورقة جديدة مع الرؤوس الديناميكية
 * @param {Spreadsheet} spreadsheet - جدول البيانات
 * @param {string} sheetName - اسم الورقة
 * @param {object|array} data - البيانات (اختياري - لاستخراج الرؤوس)
 */
function createSheetWithHeaders(spreadsheet, sheetName, data = null) {
    try {
        let sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            sheet = spreadsheet.insertSheet(sheetName);
            
            // إضافة الرؤوس الديناميكية أو الافتراضية
            const headers = data ? getHeaders(sheetName, data) : getDefaultHeaders(sheetName);
            if (headers && headers.length > 0) {
                sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
                // تنسيق الرؤوس
                const headerRange = sheet.getRange(1, 1, 1, headers.length);
                headerRange.setFontWeight('bold');
                headerRange.setBackground('#f0f0f0');
                headerRange.setFontSize(11);
            }
        }
        
        return sheet;
    } catch (error) {
        Logger.log('Error creating sheet: ' + error.toString());
        throw error;
    }
}

/**
 * تحديث رؤوس الورقة إذا لزم الأمر (ديناميكي)
 */
function ensureSheetHeaders(sheet, sheetName, data) {
    try {
        // الحصول على الرؤوس المطلوبة من البيانات الفعلية
        let requiredHeaders = getHeaders(sheetName, data);
        if (!requiredHeaders || requiredHeaders.length === 0) {
            // إذا لم تكن هناك رؤوس، نستخدم الافتراضية
            requiredHeaders = getDefaultHeaders(sheetName);
        }
        
        // لورقة Users، نتأكد من وجود passwordHash دائماً
        if (sheetName === 'Users') {
            const defaultHeaders = getDefaultHeaders('Users');
            if (!requiredHeaders.includes('passwordHash') && defaultHeaders.includes('passwordHash')) {
                // إضافة passwordHash بعد email إذا كان موجوداً
                const emailIndex = requiredHeaders.indexOf('email');
                if (emailIndex >= 0) {
                    requiredHeaders.splice(emailIndex + 1, 0, 'passwordHash');
                } else {
                    // إذا لم يكن email موجوداً، نضيف passwordHash بعد name
                    const nameIndex = requiredHeaders.indexOf('name');
                    if (nameIndex >= 0) {
                        requiredHeaders.splice(nameIndex + 1, 0, 'passwordHash');
                    } else {
                        // إذا لم يكن name موجوداً، نضيف passwordHash في البداية
                        requiredHeaders.unshift('passwordHash');
                    }
                }
            }
        }
        
        // قراءة الرؤوس الحالية
        let existingHeaders = [];
        try {
            const lastColumn = sheet.getLastColumn();
            if (lastColumn > 0) {
                const headerRange = sheet.getRange(1, 1, 1, lastColumn);
                existingHeaders = headerRange.getValues()[0];
            }
        } catch (e) {
            existingHeaders = [];
        }
        
        // لورقة Users، نتأكد من وجود passwordHash في الرؤوس الحالية
        if (sheetName === 'Users' && existingHeaders.length > 0) {
            if (!existingHeaders.includes('passwordHash')) {
                // إضافة passwordHash إلى الرؤوس الحالية
                const emailIndex = existingHeaders.indexOf('email');
                if (emailIndex >= 0) {
                    existingHeaders.splice(emailIndex + 1, 0, 'passwordHash');
                } else {
                    const nameIndex = existingHeaders.indexOf('name');
                    if (nameIndex >= 0) {
                        existingHeaders.splice(nameIndex + 1, 0, 'passwordHash');
                    } else {
                        existingHeaders.unshift('passwordHash');
                    }
                }
                // تحديث الرؤوس في الورقة
                sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
                const headerRange = sheet.getRange(1, 1, 1, existingHeaders.length);
                headerRange.setFontWeight('bold');
                headerRange.setBackground('#f0f0f0');
                headerRange.setFontSize(11);
                Logger.log('Added passwordHash to existing Users sheet headers');
            }
        }
        
        // ✅ التحقق من الحاجة للتحديث
        // مهم جداً: لا نغيّر ترتيب الرؤوس الموجودة لورقة Employees تلقائياً
        // لأن تغيير ترتيب الهيدر فقط بدون إعادة ترتيب الأعمدة/البيانات يسبب "تزحلق" القيم (خصوصاً التواريخ)
        // لذلك: نضيف الأعمدة الناقصة فقط، ونحافظ على ترتيب الهيدر الحالي.
        let mergedHeaders = existingHeaders.slice(); // دمج على الموجود
        let headersUpdated = false;

        // ✅ إضافة الحقول الجديدة من requiredHeaders إلى existingHeaders (بدون إعادة ترتيب)
        requiredHeaders.forEach(header => {
            if (!mergedHeaders.includes(header)) {
                mergedHeaders.push(header);
                headersUpdated = true;
                Logger.log('Adding new header to ' + sheetName + ': ' + header);
            }
        });
        
        // ✅ إذا كانت الرؤوس فارغة أو كانت هناك حاجة للتحديث
        const needUpdate = existingHeaders.length === 0 || 
                          existingHeaders[0] === '' || 
                          headersUpdated ||
                          JSON.stringify(existingHeaders) !== JSON.stringify(requiredHeaders);
        
        if (needUpdate) {
            // ✅ استخدام mergedHeaders بدلاً من requiredHeaders فقط
            const finalHeaders = mergedHeaders.length > 0 ? mergedHeaders : requiredHeaders;
            
            // تحديث الرؤوس
            sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
            
            // تنسيق الرؤوس
            const headerRange = sheet.getRange(1, 1, 1, finalHeaders.length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f0f0f0');
            headerRange.setFontSize(11);
            
            Logger.log('Updated sheet headers for ' + sheetName + ': ' + finalHeaders.join(', '));
            return true; // تم التحديث
        }
        
        return false; // لا حاجة للتحديث
    } catch (error) {
        Logger.log('Error ensuring headers: ' + error.toString());
        return false;
    }
}

/**
 * استخراج الرؤوس من البيانات الفعلية (ديناميكي)
 */
function extractHeadersFromData(data) {
    try {
        if (!data) return [];
        
        // إذا كانت البيانات مصفوفة، نأخذ أول عنصر
        let sampleItem = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
        
        if (!sampleItem || typeof sampleItem !== 'object') return [];
        
        // استخراج جميع المفاتيح من الكائن
        const allKeys = Object.keys(sampleItem);
        const priorityKeys = ['id', 'isoCode', 'title', 'name', 'type', 'code', 'number'];
        const timestampKeys = ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
        
        // فصل المفاتيح حسب الأولوية
        const priority = [];
        const standard = [];
        const timestamps = [];
        
        allKeys.forEach(key => {
            if (priorityKeys.some(pk => key.toLowerCase().includes(pk.toLowerCase()))) {
                priority.push(key);
            } else if (timestampKeys.some(tk => key.toLowerCase().includes(tk.toLowerCase()))) {
                timestamps.push(key);
            } else if (key.startsWith('_') || key === 'password') {
                // تجاهل الحقول الخاصة (password النصية فقط، passwordHash يجب أن يُحفظ)
                return;
            } else {
                standard.push(key);
            }
        });
        
        // ترتيب نهائي: المفاتيح ذات الأولوية، ثم العادية، ثم الطوابع الزمنية
        return [...priority, ...standard, ...timestamps];
    } catch (error) {
        Logger.log('Error extracting headers: ' + error.toString());
        return [];
    }
}

/**
 * ============================================
 * Validation للبيانات
 * ============================================
 */

/**
 * التحقق من صحة البيانات قبل الحفظ
 * @param {object|array} data - البيانات المراد التحقق منها
 * @param {string} sheetName - اسم الورقة
 * @return {object} - كائن يحتوي على نتائج التحقق { valid: boolean, errors: array }
 */
function validateSheetData(data, sheetName) {
    const errors = [];
    
    try {
        // التحقق من وجود البيانات
        if (!data) {
            errors.push('البيانات فارغة أو غير موجودة');
            return { valid: false, errors: errors, errorCode: ERROR_CODES.INVALID_DATA };
        }
        
        // التحقق من نوع البيانات
        if (!Array.isArray(data) && typeof data !== 'object') {
            errors.push('نوع البيانات غير صحيح - يجب أن يكون كائن أو مصفوفة');
            return { valid: false, errors: errors, errorCode: ERROR_CODES.INVALID_DATA };
        }
        
        // إذا كانت مصفوفة، التحقق من كل عنصر
        if (Array.isArray(data)) {
            if (data.length === 0) {
                // مصفوفة فارغة مقبولة
                return { valid: true, errors: [], errorCode: null };
            }
            
            // التحقق من أن جميع العناصر هي كائنات
            data.forEach((item, index) => {
                if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                    errors.push('العنصر في الموضع ' + index + ' ليس كائناً صحيحاً');
                }
            });
        } else {
            // إذا كان كائن واحد، التحقق من أنه ليس null
            if (data === null) {
                errors.push('الكائن فارغ (null)');
            }
        }
        
        // التحقق من وجود الرؤوس للورقة
        if (sheetName) {
            const headers = getDefaultHeaders(sheetName);
            if (!headers || headers.length === 0) {
                // لا نعتبر هذا خطأ - قد تكون ورقة جديدة
                logMessage(LOG_LEVELS.INFO, 'No default headers found for sheet: ' + sheetName);
            }
        }
        
        // إذا كانت هناك أخطاء، نرجعها
        if (errors.length > 0) {
            return { valid: false, errors: errors, errorCode: ERROR_CODES.INVALID_DATA };
        }
        
        return { valid: true, errors: [], errorCode: null };
        
    } catch (error) {
        logMessage(LOG_LEVELS.ERROR, 'Error in validateSheetData: ' + error.toString(), error);
        errors.push('خطأ أثناء التحقق من البيانات: ' + error.toString());
        return { valid: false, errors: errors, errorCode: ERROR_CODES.UNKNOWN_ERROR };
    }
}

/**
 * الحصول على الرؤوس النهائية (الديناميكية أو الافتراضية)
 */
function getHeaders(sheetName, data) {
    // لورقة Users، نستخدم الرؤوس الافتراضية دائماً لضمان وجود password و passwordHash
    if (sheetName === 'Users') {
        const defaultHeaders = getDefaultHeaders('Users');
        // التأكد من وجود password و passwordHash في الرؤوس
        const emailIndex = defaultHeaders.indexOf('email');
        if (emailIndex >= 0) {
            // التأكد من وجود password بعد email
            if (!defaultHeaders.includes('password')) {
                defaultHeaders.splice(emailIndex + 1, 0, 'password');
            }
            // التأكد من وجود passwordHash بعد password
            if (!defaultHeaders.includes('passwordHash')) {
                const passwordIndex = defaultHeaders.indexOf('password');
                if (passwordIndex >= 0) {
                    defaultHeaders.splice(passwordIndex + 1, 0, 'passwordHash');
                } else {
                    defaultHeaders.splice(emailIndex + 2, 0, 'passwordHash');
                }
            }
        } else {
            // إذا لم يكن email موجوداً
            if (!defaultHeaders.includes('password')) {
                defaultHeaders.splice(1, 0, 'password');
            }
            if (!defaultHeaders.includes('passwordHash')) {
                defaultHeaders.splice(2, 0, 'passwordHash');
            }
        }
        return defaultHeaders;
    }

    // ✅ لورقة Employees، نستخدم الرؤوس الافتراضية دائماً لضمان ثبات ترتيب الأعمدة
    // هذا يمنع أي لخبطة/اختلاف في الأعمدة عند الاستيراد أو الحفظ التلقائي
    if (sheetName === 'Employees') {
        return getDefaultHeaders('Employees');
    }

    // ✅ أوراق المقاولين: نستخدم الرؤوس الافتراضية دائماً لتثبيت ترتيب الأعمدة
    // هذا يمنع انزلاق الأعمدة خصوصاً عند التحديث/الاعتماد (updateSingleRowInSheet).
    if (sheetName === 'ContractorApprovalRequests' ||
        sheetName === 'ContractorDeletionRequests' ||
        sheetName === 'ApprovedContractors' ||
        sheetName === 'ContractorEvaluations' ||
        sheetName === 'ContractorTrainings') {
        return getDefaultHeaders(sheetName);
    }

    // ✅ Clinic visits sheets: enforce default headers to avoid storing JSON blobs (e.g., medications array)
    // and to keep columns stable across sync.
    if (sheetName === 'ClinicVisits' || sheetName === 'ClinicContractorVisits') {
        return getDefaultHeaders(sheetName);
    }

    // ✅ Medications: enforce default headers to keep column order stable across sync
    if (sheetName === 'Medications') {
        return getDefaultHeaders('Medications');
    }

    // ✅ PTWRegistry: نستخدم الرؤوس الافتراضية دائماً لضمان تخزين نص/رقم فقط وتوافق الخلايا
    if (sheetName === 'PTWRegistry') {
        return getDefaultHeaders('PTWRegistry');
    }
    
    // ✅ سجل حضور التدريب للموظفين: ترتيب أعمدة ثابت
    if (sheetName === 'TrainingAttendance') {
        return getDefaultHeaders('TrainingAttendance');
    }

    // ✅ سجل نشاط المستخدم: رؤوس ثابتة؛ ensureSheetHeaders يضيف الأعمدة الجديدة للأوراق القديمة دون إعادة ترتيب الصفوف
    if (sheetName === 'UserActivityLog') {
        return getDefaultHeaders('UserActivityLog');
    }

    // ✅ PTW: دمج الرؤوس الافتراضية مع مفاتيح أول صف في البيانات — يضمن ظهور أعمدة جديدة (مثل مسار الاعتماد) حتى لو أقدم صف لا يحتويها
    if (sheetName === 'PTW') {
        const dynamicHeaders = extractHeadersFromData(data);
        const defaults = getDefaultHeaders('PTW');
        if (!dynamicHeaders || dynamicHeaders.length === 0) {
            return defaults;
        }
        const seen = {};
        const merged = [];
        dynamicHeaders.forEach((h) => {
            if (h && !seen[h]) {
                seen[h] = true;
                merged.push(h);
            }
        });
        defaults.forEach((h) => {
            if (h && !seen[h]) {
                seen[h] = true;
                merged.push(h);
            }
        });
        return merged;
    }
    
    // للأوراق الأخرى، نستخدم الرؤوس الديناميكية أو الافتراضية
    const dynamicHeaders = extractHeadersFromData(data);
    if (dynamicHeaders && dynamicHeaders.length > 0) {
        return dynamicHeaders;
    }
    
    // إذا لم تنجح، استخدام الافتراضيات
    return getDefaultHeaders(sheetName);
}

/**
 * ============================================
 * Sheet value helpers (especially Dates)
 * ============================================
 */
function unwrapQuotedString_(s) {
    if (s === null || s === undefined) return '';
    let v = String(s).trim();
    if (!v) return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        try {
            const parsed = JSON.parse(v);
            if (typeof parsed === 'string') return parsed.trim();
        } catch (e) {
            // ignore
        }
        return v.substring(1, v.length - 1).trim();
    }
    return v;
}

function isDateObject_(value) {
    try {
        return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime());
    } catch (e) {
        return false;
    }
}

function isDateLikeField_(header) {
    const h = String(header || '').trim();
    if (!h) return false;
    // Common timestamp/date fields across the system
    const known = [
        'approvalDate', 'expiryDate',
        'createdAt', 'updatedAt',
        'approvedAt', 'rejectedAt',
        'inspectionDate', 'evaluationDate',
        'lastReview', 'nextReview',
        'date'
    ];
    if (known.includes(h)) return true;
    // heuristic: ends with Date/At
    return /(?:Date|At)$/i.test(h);
}

function shouldPreserveSheetDateTimeAsText_(sheetName, header) {
    const sheet = String(sheetName || '').trim();
    const h = String(header || '').trim();
    if (!sheet || !h) return false;

    const textDateTimeFieldsBySheet = {
        'PTW': ['startDate', 'endDate', 'closureTime'],
        'PTWRegistry': ['openDate', 'timeFrom', 'timeTo', 'closureDate']
    };

    return Array.isArray(textDateTimeFieldsBySheet[sheet]) && textDateTimeFieldsBySheet[sheet].includes(h);
}

function normalizeSheetDateTimeText_(value, timeZone) {
    if (value === null || value === undefined || value === '') return '';

    const tz = String(timeZone || Session.getScriptTimeZone() || 'UTC').trim() || 'UTC';
    const formatDateTimeText = function(dateValue) {
        return Utilities.formatDate(dateValue, tz, "yyyy-MM-dd'T'HH:mm:ss");
    };

    if (isDateObject_(value)) {
        return formatDateTimeText(value);
    }

    const textValue = unwrapQuotedString_(value);
    if (!textValue) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(textValue)) {
        return textValue;
    }

    const parsedDate = new Date(textValue);
    if (!isNaN(parsedDate.getTime())) {
        return formatDateTimeText(parsedDate);
    }

    return textValue;
}

/**
 * ============================================
 * Safe cell formatting (NO JSON in Sheets)
 * ============================================
 */
function safeJoin_(arr, sep) {
    try {
        return (arr || []).filter(v => v !== null && v !== undefined && String(v).trim() !== '').join(sep || ' | ');
    } catch (e) {
        return '';
    }
}

function formatUserSummary_(obj) {
    try {
        if (!obj) return '';
        if (typeof obj === 'string') return obj.trim();
        const name = (obj.name || obj.displayName || '').toString().trim();
        const email = (obj.email || '').toString().trim();
        const id = (obj.id || '').toString().trim();
        const parts = [];
        if (name) parts.push(name);
        if (email) parts.push(email);
        if (!name && id) parts.push(id);
        return safeJoin_(parts, ' - ');
    } catch (e) {
        return '';
    }
}

function formatInvestigationSummary_(inv) {
    try {
        if (!inv) return '';
        // If stored as JSON string from older versions, try parsing
        if (typeof inv === 'string') {
            const s = inv.trim();
            if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
                try { inv = JSON.parse(s); } catch (e) { return s; }
            } else {
                return s;
            }
        }
        if (Array.isArray(inv)) {
            return safeJoin_(inv.map(v => formatInvestigationSummary_(v)).filter(Boolean), '\n');
        }
        if (typeof inv !== 'object') return String(inv);

        const lines = [];
        const pushLine = (label, val) => {
            const v = (val === null || val === undefined) ? '' : String(val).trim();
            if (v) lines.push(label + ': ' + v);
        };

        pushLine('رقم التحقيق', inv.investigationNumber);
        pushLine('تاريخ التحقيق', inv.investigationDateTime);
        pushLine('تاريخ الحادث', inv.incidentDateTime);
        pushLine('المصنع', inv.factoryName);
        pushLine('الموقع', inv.locationName);
        pushLine('التبعية', inv.affectedAffiliation);
        pushLine('اسم المصاب', inv.affectedName);
        pushLine('الوظيفة', inv.affectedJob);
        pushLine('الإدارة', inv.affectedDepartment);
        pushLine('مستوى الخطورة', inv.riskLevel);
        pushLine('نتيجة التقييم', inv.riskResult);

        // Keep description as plain text (trim, but don't JSON)
        if (inv.description) {
            const desc = String(inv.description).trim();
            if (desc) lines.push('الوصف: ' + desc);
        }

        // Action plan: just count to avoid long data
        if (Array.isArray(inv.actionPlan) && inv.actionPlan.length > 0) {
            lines.push('خطة العمل: ' + inv.actionPlan.length + ' بند');
        }

        return lines.join('\n');
    } catch (e) {
        return '';
    }
}

function formatAttachmentsText_(attachments) {
    try {
        if (!attachments) return '';

        // If old JSON string, parse it
        if (typeof attachments === 'string') {
            const s = attachments.trim();
            if (!s) return '';
            if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
                try { attachments = JSON.parse(s); } catch (e) { return s; }
            } else {
                return s;
            }
        }

        // If object -> wrap
        if (!Array.isArray(attachments) && typeof attachments === 'object') {
            attachments = [attachments];
        }

        if (!Array.isArray(attachments) || attachments.length === 0) return '';

        const lines = attachments.map((att) => {
            if (!att) return '';
            if (typeof att === 'string') return att.trim();
            const name = (att.name || att.fileName || 'attachment').toString().trim();
            const link = (att.directLink || att.shareableLink || (att.cloudLink && att.cloudLink.url) || att.url || att.data || '').toString().trim();
            if (!link) return '';
            return name ? (name + ' - ' + link) : link;
        }).filter(s => s && s.trim() !== '');

        return lines.join('\n');
    } catch (e) {
        return '';
    }
}

function formatObjectKeyValues_(obj, maxKeys) {
    try {
        if (!obj || typeof obj !== 'object') return '';
        const keys = Object.keys(obj);
        const limited = keys.slice(0, maxKeys || 8);
        const parts = limited.map((k) => {
            const v = obj[k];
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') {
                // avoid JSON; summarize nested objects minimally
                if (Array.isArray(v)) return k + ': ' + (v.length + ' items');
                return k + ': ' + formatUserSummary_(v) || '[object]';
            }
            const s = String(v).trim();
            if (!s) return '';
            return k + ': ' + s;
        }).filter(Boolean);
        return parts.join('\n');
    } catch (e) {
        return '';
    }
}

function toSheetCellValue_(header, value, sheetName) {
    if (value === null || value === undefined) return '';
    if (value === '') return '';
    const h = String(header || '').trim();

    if (shouldPreserveSheetDateTimeAsText_(sheetName, h)) {
        return normalizeSheetDateTimeText_(value);
    }

    // ✅ Preserve Dates as real Date objects so Sheets stores them as dates (not ISO strings)
    if (isDateObject_(value)) {
        return value;
    }

    // ✅ Convert ISO-like strings for date fields to Date objects when possible
    if (isDateLikeField_(header) && typeof value === 'string') {
        const s = unwrapQuotedString_(value);
        if (s) {
            const d = new Date(s);
            if (!isNaN(d.getTime())) {
                return d;
            }
        }
        return s;
    }

    // حقل isActive: يُخزَّن دائماً كنص "active" أو "inactive" للوضوح في قاعدة البيانات
    if (h === 'isActive') {
        if (value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1' || value === 'active') return 'active';
        if (value === false || value === 'false' || value === 'FALSE' || value === 0 || value === '0' || value === 'inactive') return 'inactive';
        return 'active'; // القيمة الافتراضية
    }

    // Numbers/booleans should stay numeric/boolean in Sheets when possible
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value;

    // Attachments: store as human-readable lines (NO JSON)
    if (h === 'attachments') {
        return formatAttachmentsText_(value);
    }

    // Investigation: store as readable text (NO JSON)
    if (h === 'investigation') {
        return formatInvestigationSummary_(value);
    }

    // ✅ إصلاح: Logo - حفظ الشعار كـ string مباشرة (base64 أو رابط)
    if (h === 'logo') {
        if (value && typeof value === 'string' && value.trim() !== '') {
            // إذا كان base64 string كبير جداً (>500KB)، يجب أن يكون قد تم رفعه إلى Drive
            // نحفظه كما هو (سواء كان base64 أو رابط Drive)
            return value.trim();
        }
        return '';
    }

    // Common user objects: store as "Name - Email" (NO JSON)
    if (/(?:^|_)(?:createdBy|updatedBy|approvedBy|rejectedBy)$/i.test(h) || /By$/i.test(h)) {
        if (typeof value === 'object') return formatUserSummary_(value);
    }

    // ✅ Keep full permissions payload in Users sheet (no truncation/summarization)
    if (h === 'permissions') {
        if (typeof value === 'string') return value.trim();
        try {
            return JSON.stringify(value || {});
        } catch (e) {
            return '{}';
        }
    }

    // Arrays: join to readable text (NO JSON)
    if (Array.isArray(value)) {
        // If it's an array of objects, summarize
        const textItems = value.map((v) => {
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') {
                // Special: attachments-like objects
                const maybeLink = v.directLink || v.shareableLink || (v.cloudLink && v.cloudLink.url) || v.url;
                if (maybeLink) return String(maybeLink).trim();
                return formatObjectKeyValues_(v, 6);
            }
            return String(v).trim();
        }).filter(Boolean);
        return textItems.join('\n');
    }

    // Plain objects: summarize key/value pairs (NO JSON)
    if (typeof value === 'object') {
        // Try specific formats first
        const summary = formatUserSummary_(value);
        if (summary) return summary;
        return formatObjectKeyValues_(value, 10);
    }

    return String(value);
}

/**
 * ============================================
 * One-time repair helpers (for sheets affected by older column-order update bug)
 * ============================================
 */
function repairContractorSheets_(sheetName, spreadsheetId = null) {
    try {
        const finalSpreadsheetId = spreadsheetId || getSpreadsheetId();
        const ss = SpreadsheetApp.openById(finalSpreadsheetId);
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return { success: false, message: 'Sheet not found: ' + sheetName };

        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow <= 1 || lastCol <= 0) return { success: true, message: 'No data to repair in ' + sheetName };

        const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
        const hasAnyHeader = headerRow.some(h => h);
        if (!hasAnyHeader) return { success: false, message: 'No valid headers in ' + sheetName };

        // Build the "old buggy dynamic order" based on the same heuristic previously used (extractHeadersFromData)
        const dummy = {};
        headerRow.forEach(h => {
            if (h) dummy[h] = 1;
        });
        const oldDynamicHeaders = extractHeadersFromData(dummy) || [];
        const dynLen = oldDynamicHeaders.length;

        // If we cannot compute a reasonable mapping, abort
        if (dynLen <= 0) return { success: false, message: 'Could not compute dynamic headers for repair: ' + sheetName };

        const statusValues = ['pending', 'under_review', 'approved', 'rejected'];
        const statusIdx = headerRow.indexOf('status');
        const approvedByIdx = headerRow.indexOf('approvedBy');

        const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
        const values = dataRange.getValues();
        let repairedCount = 0;

        for (let r = 0; r < values.length; r++) {
            const row = values[r];

            // Safety check: only repair rows that look "shifted"
            let shouldRepair = false;
            if (statusIdx >= 0) {
                const statusVal = String(row[statusIdx] || '').trim().toLowerCase();
                if (!statusValues.includes(statusVal)) {
                    // if status is empty/invalid but approvedBy contains a status-like value => likely shifted
                    if (approvedByIdx >= 0) {
                        const approvedByVal = String(row[approvedByIdx] || '').trim().toLowerCase();
                        if (statusValues.includes(approvedByVal)) shouldRepair = true;
                    }
                }
            }

            if (!shouldRepair) continue;

            const corrected = row.slice();

            // Only the first dynLen columns were affected by the old update logic (it wrote headers.length columns)
            for (let i = 0; i < Math.min(dynLen, headerRow.length); i++) {
                const desiredHeader = headerRow[i];
                if (!desiredHeader) continue;
                const j = oldDynamicHeaders.indexOf(desiredHeader);
                if (j >= 0 && j < row.length) {
                    corrected[i] = row[j];
                }
            }

            // Normalize date fields to Date objects for better sheet formatting
            for (let c = 0; c < corrected.length; c++) {
                const h = headerRow[c];
                if (!h) continue;
                corrected[c] = toSheetCellValue_(h, corrected[c], sheetName);
            }

            values[r] = corrected;
            repairedCount++;
        }

        if (repairedCount > 0) {
            dataRange.setValues(values);
            SpreadsheetApp.flush();
        }

        return { success: true, message: 'Repaired ' + repairedCount + ' rows in ' + sheetName, repairedCount: repairedCount };
    } catch (e) {
        return { success: false, message: 'Repair failed for ' + sheetName + ': ' + e.toString() };
    }
}

function repairContractorApprovalRequestsSheet(spreadsheetId = null) {
    return repairContractorSheets_('ContractorApprovalRequests', spreadsheetId);
}

function repairApprovedContractorsSheet(spreadsheetId = null) {
    return repairContractorSheets_('ApprovedContractors', spreadsheetId);
}

/**
 * ============================================
 * Normalizers (Text / Date) - Used before writing to Sheets
 * ============================================
 */

/**
 * تطبيع نص آمن (يحافظ على الأصفار البادئة ويمنع null/undefined)
 */
function normalizeTextValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

/**
 * تطبيع قيمة النوع (ذكر/أنثى) لضمان التطابق الصحيح
 * يحول القيم المختلفة إلى القيم القياسية: 'ذكر' أو 'أنثى'
 */
function normalizeGenderValue(value) {
    if (value === null || value === undefined) return '';
    
    // تحويل إلى نص وإزالة المسافات الزائدة
    let normalized = String(value).trim().replace(/\s+/g, ' ').trim();
    // إزالة أي أحرف غير مرئية أو خاصة
    normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    if (!normalized) return '';
    
    // تحويل لحروف صغيرة للنصوص الإنجليزية
    const genderLower = normalized.toLowerCase();
    // الحصول على أول حرف كبير (للقيم المكونة من حرف واحد فقط)
    const genderFirstChar = normalized.length === 1 ? normalized.toUpperCase() : '';
    
    // التحقق من الذكر
    if (normalized === 'ذكر' || 
        genderLower === 'male' || 
        genderFirstChar === 'M') {
        return 'ذكر';
    }
    
    // التحقق من الأنثى
    if (normalized === 'أنثى' || 
        genderLower === 'female' || 
        genderFirstChar === 'F') {
        return 'أنثى';
    }
    
    // إذا لم يتطابق مع أي قيمة معروفة، نعيد القيمة المطابقة كما هي
    // (قد تكون قيماً أخرى أو فارغة)
    return normalized;
}

/**
 * تحويل التاريخ إلى YYYY-MM-DD بدون مشاكل timezone
 * يدعم: Date / ISO String / YYYY-MM-DD / dd/mm/yyyy / yyyy/mm/dd
 */
function normalizeDateOnlyValue(value) {
    if (value === null || value === undefined || value === '') return '';

    // Date object
    try {
        if (Object.prototype.toString.call(value) === '[object Date]') {
            if (!isNaN(value.getTime())) {
                return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            }
        }
    } catch (e) {
        // ignore
    }

    let s = String(value).trim();
    if (!s) return '';

    // Unwrap JSON-quoted strings (e.g. "\"2020-01-01T00:00:00.000Z\"")
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        try {
            const parsed = JSON.parse(s);
            if (typeof parsed === 'string') {
                s = parsed.trim();
            } else {
                // fallback: strip quotes
                s = s.substring(1, s.length - 1).trim();
            }
        } catch (e0) {
            s = s.substring(1, s.length - 1).trim();
        }
        if (!s) return '';
    }

    // Already YYYY-MM-DD (or ISO starting with it)
    const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (ymd) return ymd[1];

    // dd/mm/yyyy or dd-mm-yyyy (we assume day-first)
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dmy) {
        const day = ('0' + dmy[1]).slice(-2);
        const month = ('0' + dmy[2]).slice(-2);
        const yearRaw = String(dmy[3]);
        const year = yearRaw.length === 2 ? ('20' + yearRaw) : ('0000' + yearRaw).slice(-4);
        return year + '-' + month + '-' + day;
    }

    // yyyy/mm/dd or yyyy-m-d
    const ymd2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd2) {
        const year = ('0000' + ymd2[1]).slice(-4);
        const month = ('0' + ymd2[2]).slice(-2);
        const day = ('0' + ymd2[3]).slice(-2);
        return year + '-' + month + '-' + day;
    }

    // Fallback parse
    try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
            return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
    } catch (e2) {
        // ignore
    }

    return '';
}

/**
 * حساب العمر بالسنوات من تاريخ ميلاد بصيغة YYYY-MM-DD (أو أي صيغة يمكن تطبيعها)
 */
function calculateAgeYears(birthDateValue) {
    const birth = normalizeDateOnlyValue(birthDateValue);
    if (!birth) return '';

    const m = birth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';

    const by = parseInt(m[1], 10);
    const bm = parseInt(m[2], 10) - 1;
    const bd = parseInt(m[3], 10);

    const birthDate = new Date(by, bm, bd);
    if (isNaN(birthDate.getTime())) return '';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= 0 ? String(age) : '';
}

/**
 * حفظ بيانات في ورقة معينة (استبدال كامل)
 */
function saveToSheet(sheetName, data, spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        // التحقق من صحة spreadsheetId
        if (!spreadsheetId || (typeof spreadsheetId === 'string' && spreadsheetId.trim() === '')) {
            return { success: false, message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات.' };
        }
        
        if (!sheetName || (typeof sheetName === 'string' && sheetName.trim() === '')) {
            return { success: false, message: 'اسم الورقة غير محدد.' };
        }
        
        // فتح الجدول
        let spreadsheet;
        try {
            spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        } catch (error) {
            return { success: false, message: 'فشل فتح الجدول. يرجى التحقق من معرف الجدول: ' + error.toString() };
        }
        
        // إنشاء الورقة مع الرؤوس إذا لم تكن موجودة
        let sheet;
        try {
            sheet = createSheetWithHeaders(spreadsheet, sheetName, data);
        } catch (error) {
            return { success: false, message: 'فشل إنشاء/فتح الورقة: ' + error.toString() };
        }
        
        // إذا كانت البيانات مصفوفة فارغة أو غير موجودة
        if (!data || (Array.isArray(data) && data.length === 0)) {
            ensureSheetHeaders(sheet, sheetName, [{}]);
            return { success: true, message: 'تم حفظ البيانات بنجاح (لا توجد بيانات للحفظ)' };
        }

        // الحصول على الرؤوس من البيانات الفعلية
        const headers = getHeaders(sheetName, data);
        if (!headers || headers.length === 0) {
            return { success: false, message: 'لا يمكن استخراج الرؤوس من البيانات المرسلة.' };
        }
        
        // التأكد من تحديث الرؤوس إذا لزم الأمر
        ensureSheetHeaders(sheet, sheetName, data);

        var _ptwRegistryScriptLock = null;
        if (sheetName === 'PTWRegistry') {
            _ptwRegistryScriptLock = LockService.getScriptLock();
            try {
                _ptwRegistryScriptLock.waitLock(45000);
            } catch (lockEx) {
                Logger.log('PTWRegistry saveToSheet lock timeout: ' + lockEx.toString());
                return { success: false, message: 'ازدحام على توليد رقم التصريح. أعد المحاولة بعد لحظات.' };
            }
        }
        var resolvedPTWRegistryForResponse = null;
        try {

        // معالجة attachments و image/photo قبل الحفظ
        const processDataItem = function(item) {
            if (!item || typeof item !== 'object') return item;
            
            let processed = {};
            for (var key in item) {
                if (item.hasOwnProperty(key)) {
                    processed[key] = item[key];
                }
            }

            // ✅ تطبيع خاص بورقة Employees لضمان ترتيب وصحة البيانات
            if (sheetName === 'Employees') {
                processed.employeeNumber = normalizeTextValue(processed.employeeNumber);
                processed.sapId = normalizeTextValue(processed.sapId);
                processed.nationalId = normalizeTextValue(processed.nationalId);
                processed.birthDate = normalizeDateOnlyValue(processed.birthDate);
                processed.hireDate = normalizeDateOnlyValue(processed.hireDate);
                processed.job = normalizeTextValue(processed.job || processed.position);
                processed.position = normalizeTextValue(processed.position || processed.job);
                
                // ✅ تطبيع حقل النوع (gender) لضمان التطابق الصحيح
                processed.gender = normalizeGenderValue(processed.gender);

                // ✅ السن (age) محسوب مثل الواجهة الأمامية
                processed.age = calculateAgeYears(processed.birthDate);

                // ✅ تطبيع حقل status (active/inactive) - افتراضي: active
                if (!processed.status || (processed.status !== 'active' && processed.status !== 'inactive')) {
                    processed.status = 'active'; // قيمة افتراضية آمنة
                }
                
                // ✅ تطبيع تاريخ الاستقالة
                processed.resignationDate = normalizeDateOnlyValue(processed.resignationDate || '');

                // مطلوب: id = employeeNumber
                const normalizedEmpNo = normalizeTextValue(processed.employeeNumber);
                processed.id = normalizedEmpNo || normalizeTextValue(processed.id);
            }
            
            // ✅ تطبيع خاص بورقة PTWRegistry لضمان تخزين نص أو رقم فقط (لا JSON ولا objects)
            if (sheetName === 'PTWRegistry') {
                processed = resolvePTWRegistryIdsForWrite_(processed, spreadsheetId);
                processed = resolvePTWRegistryByPaperPermitNumber_(processed, spreadsheetId);
                // permitType: string فقط
                if (processed.permitType !== undefined) {
                    if (Array.isArray(processed.permitType)) {
                        processed.permitType = processed.permitType.join('، ');
                    } else if (typeof processed.permitType === 'object' && processed.permitType !== null) {
                        processed.permitType = String(processed.permitType);
                    } else {
                        processed.permitType = normalizeTextValue(processed.permitType);
                    }
                }
                if (processed.permitTypeDisplay !== undefined) {
                    processed.permitTypeDisplay = normalizeTextValue(processed.permitTypeDisplay);
                }
                // حقول نصية بسيطة
                const textFields = ['requestingParty', 'location', 'sublocation', 'authorizedParty', 'workDescription', 'supervisor1', 'supervisor2', 'status', 'closureReason', 'paperPermitNumber', 'equipment', 'tools', 'toolsList', 'hotWorkOther', 'confinedSpaceOther', 'heightWorkOther', 'electricalWorkType', 'coldWorkType', 'otherWorkType', 'excavationLength', 'excavationWidth', 'excavationDepth', 'soilType', 'ppeNotes', 'riskLikelihood', 'riskConsequence', 'riskLevel', 'riskNotes', 'manualApprovalsText', 'manualClosureApprovalsText', 'approvalCircuitOwnerId', 'approvalCircuitName', 'skipApprovalFlow'];
                textFields.forEach(field => {
                    if (processed[field] !== undefined && processed[field] !== null) {
                        if (typeof processed[field] === 'object') {
                            processed[field] = processed[field].name || processed[field].email || processed[field].id || String(processed[field]);
                        } else {
                            processed[field] = normalizeTextValue(processed[field]);
                        }
                    }
                });
                // locationId, sublocationId: string أو فارغ
                if (processed.locationId !== undefined && processed.locationId !== null) {
                    processed.locationId = String(processed.locationId).trim() || '';
                }
                if (processed.sublocationId !== undefined && processed.sublocationId !== null) {
                    processed.sublocationId = String(processed.sublocationId).trim() || '';
                }
                // totalTime: نص
                if (processed.totalTime !== undefined && processed.totalTime !== null) {
                    processed.totalTime = typeof processed.totalTime === 'object' ? String(processed.totalTime) : String(processed.totalTime).trim();
                }
                // teamMembers (array) -> teamMembersText فقط (لا نخزن المصفوفة)
                if (Array.isArray(processed.teamMembers) && processed.teamMembers.length > 0) {
                    processed.teamMembersText = processed.teamMembers.map(function(m) {
                        if (m && typeof m === 'object') {
                            var name = m.name || m.employeeName || '';
                            var sig = m.signature || m.id || '';
                            return sig ? name + ' (' + sig + ')' : name;
                        }
                        return String(m || '').trim();
                    }).filter(Boolean).join('، ');
                }
                if (processed.teamMembersText !== undefined && processed.teamMembersText !== null && typeof processed.teamMembersText !== 'string') {
                    processed.teamMembersText = String(processed.teamMembersText);
                }
                // مصفوفات طبيعة الأعمال -> نص
                if (Array.isArray(processed.hotWorkDetails)) {
                    processed.hotWorkDetails = processed.hotWorkDetails.join('، ');
                } else if (processed.hotWorkDetails !== undefined && typeof processed.hotWorkDetails !== 'string') {
                    processed.hotWorkDetails = normalizeTextValue(processed.hotWorkDetails);
                }
                if (Array.isArray(processed.confinedSpaceDetails)) {
                    processed.confinedSpaceDetails = processed.confinedSpaceDetails.join('، ');
                } else if (processed.confinedSpaceDetails !== undefined && typeof processed.confinedSpaceDetails !== 'string') {
                    processed.confinedSpaceDetails = normalizeTextValue(processed.confinedSpaceDetails);
                }
                if (Array.isArray(processed.heightWorkDetails)) {
                    processed.heightWorkDetails = processed.heightWorkDetails.join('، ');
                } else if (processed.heightWorkDetails !== undefined && typeof processed.heightWorkDetails !== 'string') {
                    processed.heightWorkDetails = normalizeTextValue(processed.heightWorkDetails);
                }
                if (Array.isArray(processed.requiredPPE)) {
                    processed.requiredPPE = processed.requiredPPE.join('، ');
                } else if (processed.requiredPPE !== undefined && typeof processed.requiredPPE !== 'string') {
                    processed.requiredPPE = normalizeTextValue(processed.requiredPPE);
                }
                // riskScore: رقم
                if (processed.riskScore !== undefined && processed.riskScore !== null && processed.riskScore !== '') {
                    var rs = processed.riskScore;
                    processed.riskScore = (typeof rs === 'number' && !isNaN(rs)) ? rs : (parseFloat(String(rs).trim()) || '');
                }
                // قيم منطقية: نبقيه boolean (Sheets يقبلها)
                ['preStartChecklist', 'lotoApplied', 'governmentPermits', 'riskAssessmentAttached', 'gasTesting', 'mocRequest', 'isManualEntry'].forEach(function(f) {
                    if (processed[f] !== undefined) {
                        processed[f] = processed[f] === true || processed[f] === 'true' || processed[f] === 1;
                    }
                });
                resolvedPTWRegistryForResponse = processed;
            }
            
            // ✅ Attachments: store as plain text (NO JSON)
            if (processed.attachments !== undefined) {
                processed.attachments = formatAttachmentsText_(processed.attachments);
            }
            
            // معالجة image - إذا كانت Base64، نرفعها إلى Google Drive
            if (processed.image && typeof processed.image === 'string' && processed.image.startsWith('data:')) {
                try {
                    const moduleName = sheetName === 'Incidents' ? 'Incidents' : 
                                     sheetName === 'NearMiss' ? 'NearMiss' :
                                     sheetName === 'Violations' ? 'Violations' :
                                     sheetName === 'DailyObservations' ? 'DailyObservations' : sheetName;
                    const uploadResult = uploadFileToDrive(
                        processed.image,
                        (moduleName.toLowerCase() + '_' + (processed.id || Utilities.getUuid()) + '_' + Date.now() + '.jpg'),
                        'image/jpeg',
                        moduleName
                    );
                    if (uploadResult && uploadResult.success) {
                        processed.image = uploadResult.directLink || uploadResult.shareableLink || processed.image;
                    }
                } catch (imageError) {
                    Logger.log('خطأ في رفع صورة في saveToSheet: ' + imageError.toString());
                }
            }
            
            // معالجة photo - إذا كانت Base64، نرفعها إلى Google Drive
            if (processed.photo && typeof processed.photo === 'string' && processed.photo.startsWith('data:')) {
                try {
                    const moduleName = sheetName === 'Violations' ? 'Violations' : 
                                     sheetName === 'Blacklist_Register' ? 'Blacklist_Register' : sheetName;
                    const uploadResult = uploadFileToDrive(
                        processed.photo,
                        (moduleName.toLowerCase() + '_' + (processed.id || Utilities.getUuid()) + '_' + Date.now() + '.jpg'),
                        'image/jpeg',
                        moduleName
                    );
                    if (uploadResult && uploadResult.success) {
                        processed.photo = uploadResult.directLink || uploadResult.shareableLink || processed.photo;
                    }
                } catch (photoError) {
                    Logger.log('خطأ في رفع صورة photo في saveToSheet: ' + photoError.toString());
                }
            }
            
            // معالجة images - إذا كانت Array من Base64
            if (processed.images && Array.isArray(processed.images)) {
                const processedImages = [];
                for (let i = 0; i < processed.images.length; i++) {
                    const image = processed.images[i];
                    if (typeof image === 'string' && image.startsWith('data:')) {
                        try {
                            const moduleName = sheetName === 'DailyObservations' ? 'DailyObservations' : sheetName;
                            const uploadResult = uploadFileToDrive(
                                image,
                                (moduleName.toLowerCase() + '_' + (processed.id || Utilities.getUuid()) + '_' + Date.now() + '_' + i + '.jpg'),
                                'image/jpeg',
                                moduleName
                            );
                            if (uploadResult && uploadResult.success) {
                                processedImages.push(uploadResult.directLink || uploadResult.shareableLink);
                            } else {
                                processedImages.push(image);
                            }
                        } catch (imageError) {
                            Logger.log('خطأ في رفع صورة images في saveToSheet: ' + imageError.toString());
                            processedImages.push(image);
                        }
                    } else {
                        processedImages.push(image);
                    }
                }
                // ✅ Store images as plain text (NO JSON)
                processed.images = processedImages.filter(Boolean).map(v => String(v)).join('\n');
            }
            
            // ✅ معالجة logo - نحفظه دائماً كـ base64 string (لا نرفعه إلى Drive)
            // Google Sheets له حد أقصى 50,000 حرف للخلية الواحدة
            // للشعار، نحفظه مباشرة كـ base64 string دائماً
            // ملاحظة: إذا كان الشعار أكبر من 50,000 حرف، قد يتم قطعه بواسطة Google Sheets
            if (processed.logo && typeof processed.logo === 'string' && processed.logo.trim() !== '') {
                try {
                    const logoLength = processed.logo.length;
                    // ✅ تم تعطيل الرفع التلقائي إلى Drive - نحفظ الشعار كـ base64 دائماً
                    // إذا كان الشعار أكبر من 50,000 حرف، قد يتم قطعه بواسطة Google Sheets
                    if (logoLength > 50000) {
                        Logger.log('⚠️ Warning: Logo is very large (' + logoLength + ' chars). Google Sheets cell limit is 50,000 chars. Logo may be truncated.');
                    } else if (logoLength > 45000) {
                        Logger.log('⚠️ Warning: Logo is large (' + logoLength + ' chars). Close to Google Sheets cell limit (50,000 chars).');
                    } else {
                        Logger.log('✅ Logo saved as base64 string (length: ' + logoLength + ' chars, within Google Sheets limit)');
                    }
                    // نحفظ الشعار كـ base64 string مباشرة (لا نرفعه إلى Drive)
                } catch (logoError) {
                    Logger.log('❌ خطأ في معالجة الشعار في saveToSheet: ' + logoError.toString());
                }
            }

            if (sheetName === 'PTW') {
                processed = normalizePTWRowForSheet_(processed);
            }
            
            return processed;
        };
        
        // ✅ IMPORTANT: Do NOT clear rows here.
        // We preserve existing sheet data and only upsert/update what we receive.

        // تحضير البيانات للكتابة (UPSERT: update existing rows by id, append new ones)
        if (Array.isArray(data) && data.length > 0) {
            const lastCol = sheet.getLastColumn();
            const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
            const idCol = headerRow.indexOf('id');
            const dataRange = sheet.getDataRange();
            const values = dataRange ? dataRange.getValues() : [];
            const idToRow = {};
            if (idCol >= 0 && values.length > 1) {
                for (let r = 1; r < values.length; r++) {
                    const rid = values[r][idCol];
                    if (rid !== null && rid !== undefined && String(rid).trim() !== '') {
                        idToRow[String(rid).trim()] = r + 1; // sheet row
                    }
                }
            }

            data.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const processedItem = processDataItem(item);
                const recordId = processedItem.id ? String(processedItem.id).trim() : '';
                const existingRow = recordId && idToRow[recordId] ? idToRow[recordId] : null;

                if (existingRow) {
                    // Partial update: only keys present in processedItem
                    const rowVals = sheet.getRange(existingRow, 1, 1, headerRow.length).getValues()[0];
                    headerRow.forEach((h, idx) => {
                        if (!h) return;
                        if (processedItem.hasOwnProperty(h)) {
                            rowVals[idx] = toSheetCellValue_(h, processedItem[h], sheetName);
                        }
                    });
                    sheet.getRange(existingRow, 1, 1, headerRow.length).setValues([rowVals]);
                } else {
                    // Append new row
                    const rowValues = headerRow.map(h => {
                        if (!h) return '';
                        return toSheetCellValue_(h, processedItem[h], sheetName);
                    });
                    sheet.appendRow(rowValues);
                }
            });

            SpreadsheetApp.flush();
        } else if (typeof data === 'object' && data !== null) {
            const processedData = processDataItem(data);
            const recordId = processedData.id ? String(processedData.id).trim() : '';
            if (recordId) {
                // Upsert single record by id
                const upd = updateSingleRowInSheet(sheetName, recordId, processedData, spreadsheetId);
                if (!upd || !upd.success) {
                    // If not found, append
                    const lastCol = sheet.getLastColumn();
                    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
                    const rowValues = headerRow.map(h => (h ? toSheetCellValue_(h, processedData[h], sheetName) : ''));
                    sheet.appendRow(rowValues);
                }
            } else {
                // No id => append as new row
                const lastCol = sheet.getLastColumn();
                const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
                const rowValues = headerRow.map(h => (h ? toSheetCellValue_(h, processedData[h], sheetName) : ''));
                sheet.appendRow(rowValues);
            }
        }

        // ✅ مسح الcache بعد الحفظ لضمان قراءة البيانات المحدثة
        const cache = CacheService.getScriptCache();
        const cacheKey = 'hse_read_' + sheetName + '_v1';
        cache.remove(cacheKey);

        const saveResult = { success: true, message: 'تم حفظ البيانات بنجاح' };
        if (sheetName === 'PTWRegistry' && resolvedPTWRegistryForResponse) {
            saveResult.resolvedPTWRegistry = resolvedPTWRegistryForResponse;
        }
        return saveResult;
        } finally {
            if (_ptwRegistryScriptLock) {
                try {
                    _ptwRegistryScriptLock.releaseLock();
                } catch (relEx) {
                    Logger.log('saveToSheet releaseLock: ' + relEx.toString());
                }
            }
        }
    } catch (error) {
        Logger.log('Error in saveToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ البيانات: ' + error.toString() };
    }
}

/**
 * إضافة بيانات جديدة إلى نهاية الورقة (بدون استبدال)
 */
function appendToSheet(sheetName, data, spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        // التحقق من صحة spreadsheetId
        if (!spreadsheetId || (typeof spreadsheetId === 'string' && spreadsheetId.trim() === '')) {
            return { success: false, message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات.' };
        }
        
        if (!sheetName || (typeof sheetName === 'string' && sheetName.trim() === '')) {
            return { success: false, message: 'اسم الورقة غير محدد.' };
        }
        
        if (!data) {
            return { success: false, message: 'لا توجد بيانات للإضافة.' };
        }
        
        // فتح الجدول
        let spreadsheet;
        try {
            spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        } catch (error) {
            return { success: false, message: 'فشل فتح الجدول. يرجى التحقق من معرف الجدول: ' + error.toString() };
        }
        
        // إنشاء الورقة مع الرؤوس إذا لم تكن موجودة
        let sheet;
        try {
            sheet = createSheetWithHeaders(spreadsheet, sheetName, data);
        } catch (error) {
            return { success: false, message: 'فشل إنشاء/فتح الورقة: ' + error.toString() };
        }

        // الحصول على الرؤوس من البيانات الفعلية
        const headers = getHeaders(sheetName, data);
        if (!headers || headers.length === 0) {
            return { success: false, message: 'لا يمكن استخراج الرؤوس من البيانات المرسلة.' };
        }
        
        // التأكد من تحديث الرؤوس إذا لزم الأمر
        ensureSheetHeaders(sheet, sheetName, data);
        
        // لورقة Users، نتأكد من وجود passwordHash في الرؤوس قبل الإضافة
        if (sheetName === 'Users') {
            const lastColumn = sheet.getLastColumn();
            let currentHeaders = [];
            if (lastColumn > 0) {
                currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
            }
            if (!currentHeaders.includes('passwordHash')) {
                // إضافة passwordHash إلى الرؤوس
                const emailIndex = currentHeaders.indexOf('email');
                if (emailIndex >= 0) {
                    currentHeaders.splice(emailIndex + 1, 0, 'passwordHash');
                } else {
                    currentHeaders.splice(1, 0, 'passwordHash');
                }
                sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
                const headerRange = sheet.getRange(1, 1, 1, currentHeaders.length);
                headerRange.setFontWeight('bold');
                headerRange.setBackground('#f0f0f0');
                headerRange.setFontSize(11);
                Logger.log('Added passwordHash column to Users sheet before appending data');
                // تحديث headers للمتابعة - التأكد من وجود email أولاً
                const emailIndexInHeaders = headers.indexOf('email');
                if (emailIndexInHeaders >= 0) {
                    headers.splice(emailIndexInHeaders + 1, 0, 'passwordHash');
                } else if (!headers.includes('passwordHash')) {
                    // إذا لم يكن email موجوداً، نضيف passwordHash في البداية
                    headers.unshift('passwordHash');
                }
            }
        }

        var _ptwRegistryAppendLock = null;
        if (sheetName === 'PTWRegistry') {
            _ptwRegistryAppendLock = LockService.getScriptLock();
            try {
                _ptwRegistryAppendLock.waitLock(45000);
            } catch (lockEx) {
                Logger.log('PTWRegistry appendToSheet lock timeout: ' + lockEx.toString());
                return { success: false, message: 'ازدحام على توليد رقم التصريح. أعد المحاولة بعد لحظات.' };
            }
        }
        var resolvedPTWRegistryForAppend = null;
        try {

        // معالجة attachments و image/photo قبل الحفظ
        const processDataItemForAppend = function(item) {
            if (!item || typeof item !== 'object') return item;
            
            let processed = {};
            for (var key in item) {
                if (item.hasOwnProperty(key)) {
                    processed[key] = item[key];
                }
            }

            // ✅ تطبيع خاص بورقة Employees لضمان ترتيب وصحة البيانات
            if (sheetName === 'Employees') {
                processed.employeeNumber = normalizeTextValue(processed.employeeNumber);
                processed.sapId = normalizeTextValue(processed.sapId);
                processed.nationalId = normalizeTextValue(processed.nationalId);
                processed.birthDate = normalizeDateOnlyValue(processed.birthDate);
                processed.hireDate = normalizeDateOnlyValue(processed.hireDate);
                processed.job = normalizeTextValue(processed.job || processed.position);
                processed.position = normalizeTextValue(processed.position || processed.job);
                
                // ✅ تطبيع حقل النوع (gender) لضمان التطابق الصحيح
                processed.gender = normalizeGenderValue(processed.gender);

                // ✅ السن (age) محسوب مثل الواجهة الأمامية
                processed.age = calculateAgeYears(processed.birthDate);

                // ✅ تطبيع حقل status (active/inactive) - افتراضي: active
                if (!processed.status || (processed.status !== 'active' && processed.status !== 'inactive')) {
                    processed.status = 'active'; // قيمة افتراضية آمنة
                }
                
                // ✅ تطبيع تاريخ الاستقالة
                processed.resignationDate = normalizeDateOnlyValue(processed.resignationDate || '');

                // مطلوب: id = employeeNumber
                const normalizedEmpNo = normalizeTextValue(processed.employeeNumber);
                processed.id = normalizedEmpNo || normalizeTextValue(processed.id);
            }
            
            // ✅ تطبيع خاص بورقة PTWRegistry لضمان تخزين نص أو رقم فقط (لا JSON ولا objects)
            if (sheetName === 'PTWRegistry') {
                processed = resolvePTWRegistryIdsForWrite_(processed, spreadsheetId);
                processed = resolvePTWRegistryByPaperPermitNumber_(processed, spreadsheetId);
                // permitType: string فقط
                if (processed.permitType !== undefined) {
                    if (Array.isArray(processed.permitType)) {
                        processed.permitType = processed.permitType.join('، ');
                    } else if (typeof processed.permitType === 'object' && processed.permitType !== null) {
                        processed.permitType = String(processed.permitType);
                    } else {
                        processed.permitType = normalizeTextValue(processed.permitType);
                    }
                }
                if (processed.permitTypeDisplay !== undefined) {
                    processed.permitTypeDisplay = normalizeTextValue(processed.permitTypeDisplay);
                }
                // حقول نصية بسيطة
                const textFields = ['requestingParty', 'location', 'sublocation', 'authorizedParty', 'workDescription', 'supervisor1', 'supervisor2', 'status', 'closureReason', 'paperPermitNumber', 'equipment', 'tools', 'toolsList', 'hotWorkOther', 'confinedSpaceOther', 'heightWorkOther', 'electricalWorkType', 'coldWorkType', 'otherWorkType', 'excavationLength', 'excavationWidth', 'excavationDepth', 'soilType', 'ppeNotes', 'riskLikelihood', 'riskConsequence', 'riskLevel', 'riskNotes', 'manualApprovalsText', 'manualClosureApprovalsText', 'approvalCircuitOwnerId', 'approvalCircuitName', 'skipApprovalFlow'];
                textFields.forEach(field => {
                    if (processed[field] !== undefined && processed[field] !== null) {
                        if (typeof processed[field] === 'object') {
                            processed[field] = processed[field].name || processed[field].email || processed[field].id || String(processed[field]);
                        } else {
                            processed[field] = normalizeTextValue(processed[field]);
                        }
                    }
                });
                // locationId, sublocationId: string أو فارغ
                if (processed.locationId !== undefined && processed.locationId !== null) {
                    processed.locationId = String(processed.locationId).trim() || '';
                }
                if (processed.sublocationId !== undefined && processed.sublocationId !== null) {
                    processed.sublocationId = String(processed.sublocationId).trim() || '';
                }
                // totalTime: نص
                if (processed.totalTime !== undefined && processed.totalTime !== null) {
                    processed.totalTime = typeof processed.totalTime === 'object' ? String(processed.totalTime) : String(processed.totalTime).trim();
                }
                // teamMembers (array) -> teamMembersText فقط (لا نخزن المصفوفة)
                if (Array.isArray(processed.teamMembers) && processed.teamMembers.length > 0) {
                    processed.teamMembersText = processed.teamMembers.map(function(m) {
                        if (m && typeof m === 'object') {
                            var name = m.name || m.employeeName || '';
                            var sig = m.signature || m.id || '';
                            return sig ? name + ' (' + sig + ')' : name;
                        }
                        return String(m || '').trim();
                    }).filter(Boolean).join('، ');
                }
                if (processed.teamMembersText !== undefined && processed.teamMembersText !== null && typeof processed.teamMembersText !== 'string') {
                    processed.teamMembersText = String(processed.teamMembersText);
                }
                // مصفوفات طبيعة الأعمال -> نص
                if (Array.isArray(processed.hotWorkDetails)) {
                    processed.hotWorkDetails = processed.hotWorkDetails.join('، ');
                } else if (processed.hotWorkDetails !== undefined && typeof processed.hotWorkDetails !== 'string') {
                    processed.hotWorkDetails = normalizeTextValue(processed.hotWorkDetails);
                }
                if (Array.isArray(processed.confinedSpaceDetails)) {
                    processed.confinedSpaceDetails = processed.confinedSpaceDetails.join('، ');
                } else if (processed.confinedSpaceDetails !== undefined && typeof processed.confinedSpaceDetails !== 'string') {
                    processed.confinedSpaceDetails = normalizeTextValue(processed.confinedSpaceDetails);
                }
                if (Array.isArray(processed.heightWorkDetails)) {
                    processed.heightWorkDetails = processed.heightWorkDetails.join('، ');
                } else if (processed.heightWorkDetails !== undefined && typeof processed.heightWorkDetails !== 'string') {
                    processed.heightWorkDetails = normalizeTextValue(processed.heightWorkDetails);
                }
                if (Array.isArray(processed.requiredPPE)) {
                    processed.requiredPPE = processed.requiredPPE.join('، ');
                } else if (processed.requiredPPE !== undefined && typeof processed.requiredPPE !== 'string') {
                    processed.requiredPPE = normalizeTextValue(processed.requiredPPE);
                }
                // riskScore: رقم
                if (processed.riskScore !== undefined && processed.riskScore !== null && processed.riskScore !== '') {
                    var rs = processed.riskScore;
                    processed.riskScore = (typeof rs === 'number' && !isNaN(rs)) ? rs : (parseFloat(String(rs).trim()) || '');
                }
                // قيم منطقية: نبقيه boolean (Sheets يقبلها)
                ['preStartChecklist', 'lotoApplied', 'governmentPermits', 'riskAssessmentAttached', 'gasTesting', 'mocRequest', 'isManualEntry'].forEach(function(f) {
                    if (processed[f] !== undefined) {
                        processed[f] = processed[f] === true || processed[f] === 'true' || processed[f] === 1;
                    }
                });
                resolvedPTWRegistryForAppend = processed;
            }
            
            // ✅ Attachments: store as plain text (NO JSON)
            if (processed.attachments !== undefined) {
                processed.attachments = formatAttachmentsText_(processed.attachments);
            }
            
            // معالجة image - إذا كانت Base64، نرفعها إلى Google Drive
            if (processed.image && typeof processed.image === 'string' && processed.image.startsWith('data:')) {
                try {
                    const moduleName = sheetName === 'Incidents' ? 'Incidents' : 
                                     sheetName === 'NearMiss' ? 'NearMiss' :
                                     sheetName === 'Violations' ? 'Violations' :
                                     sheetName === 'DailyObservations' ? 'DailyObservations' : sheetName;
                    const uploadResult = uploadFileToDrive(
                        processed.image,
                        (moduleName.toLowerCase() + '_' + (processed.id || Utilities.getUuid()) + '_' + Date.now() + '.jpg'),
                        'image/jpeg',
                        moduleName
                    );
                    if (uploadResult && uploadResult.success) {
                        processed.image = uploadResult.directLink || uploadResult.shareableLink || processed.image;
                    }
                } catch (imageError) {
                    Logger.log('خطأ في رفع صورة في appendToSheet: ' + imageError.toString());
                }
            }
            
            // معالجة photo - إذا كانت Base64، نرفعها إلى Google Drive
            if (processed.photo && typeof processed.photo === 'string' && processed.photo.startsWith('data:')) {
                try {
                    const moduleName = sheetName === 'Violations' ? 'Violations' : 
                                     sheetName === 'Blacklist_Register' ? 'Blacklist_Register' : sheetName;
                    const uploadResult = uploadFileToDrive(
                        processed.photo,
                        (moduleName.toLowerCase() + '_' + (processed.id || Utilities.getUuid()) + '_' + Date.now() + '.jpg'),
                        'image/jpeg',
                        moduleName
                    );
                    if (uploadResult && uploadResult.success) {
                        processed.photo = uploadResult.directLink || uploadResult.shareableLink || processed.photo;
                    }
                } catch (photoError) {
                    Logger.log('خطأ في رفع صورة photo في appendToSheet: ' + photoError.toString());
                }
            }
            
            // معالجة images - إذا كانت Array من Base64
            if (processed.images && Array.isArray(processed.images)) {
                const processedImages = [];
                for (let i = 0; i < processed.images.length; i++) {
                    const image = processed.images[i];
                    if (typeof image === 'string' && image.startsWith('data:')) {
                        try {
                            const moduleName = sheetName === 'DailyObservations' ? 'DailyObservations' : sheetName;
                            const uploadResult = uploadFileToDrive(
                                image,
                                (moduleName.toLowerCase() + '_' + (processed.id || Utilities.getUuid()) + '_' + Date.now() + '_' + i + '.jpg'),
                                'image/jpeg',
                                moduleName
                            );
                            if (uploadResult && uploadResult.success) {
                                processedImages.push(uploadResult.directLink || uploadResult.shareableLink);
                            } else {
                                processedImages.push(image);
                            }
                        } catch (imageError) {
                            Logger.log('خطأ في رفع صورة images في appendToSheet: ' + imageError.toString());
                            processedImages.push(image);
                        }
                    } else {
                        processedImages.push(image);
                    }
                }
                // ✅ Store images as plain text (NO JSON)
                processed.images = processedImages.filter(Boolean).map(v => String(v)).join('\n');
            }

            if (sheetName === 'PTW') {
                processed = normalizePTWRowForSheet_(processed);
            }
            
            return processed;
        };
        
        // ✅ الحصول على آخر صف - استخدام طريقة موثوقة 100%
        // ✅ نستخدم getDataRange() للحصول على نطاق البيانات الفعلي
        let lastRow = 1; // افتراضياً: الرؤوس فقط
        
        try {
            // ✅ استخدام getDataRange() للحصول على نطاق البيانات الفعلي
            const dataRange = sheet.getDataRange();
            if (dataRange && dataRange.getNumRows() > 0) {
                // ✅ getDataRange() يعيد نطاق يبدأ من الصف 1 (الرؤوس)
                // ✅ getNumRows() يعيد عدد الصفوف (بما في ذلك الرؤوس)
                // ✅ لذلك آخر صف = getNumRows()
                lastRow = dataRange.getNumRows();
                
                // ✅ التحقق: إذا كان lastRow = 1، يعني فقط الرؤوس
                // ✅ إذا كان lastRow > 1، يعني هناك بيانات بعد الرؤوس
                if (lastRow < 1) {
                    lastRow = 1;
                }
            } else {
                // ✅ لا توجد بيانات - فقط الرؤوس
                lastRow = 1;
            }
        } catch (e) {
            // ✅ في حالة الخطأ، نستخدم getLastRow() كبديل
            Logger.log('Warning: Could not use getDataRange(), using getLastRow(): ' + e.toString());
            try {
                lastRow = sheet.getLastRow();
                if (lastRow < 1) {
                    lastRow = 1;
                }
            } catch (e2) {
                Logger.log('Error: Could not get last row: ' + e2.toString());
                lastRow = 1; // افتراضياً: الرؤوس فقط
            }
        }
        
        // ✅ حساب startRow: إذا كانت الورقة فارغة (فقط الرؤوس)، نبدأ من الصف 2
        // ✅ إذا كانت هناك بيانات، نضيف بعد آخر صف
        const startRow = lastRow === 1 ? 2 : lastRow + 1;
        
        // ✅ تسجيل للمراقبة
        Logger.log('appendToSheet: lastRow=' + lastRow + ', startRow=' + startRow + ', sheetName=' + sheetName + ', numRows=' + (sheet.getDataRange() ? sheet.getDataRange().getNumRows() : 'N/A'));

        if (Array.isArray(data)) {
            // إذا كانت مصفوفة من الكائنات
            if (data.length > 0) {
                // ✅ إصلاح: التحقق من التكرار قبل الإضافة لمنع تكرار البيانات
                let existingData = [];
                try {
                    existingData = readFromSheet(sheetName, spreadsheetId);
                } catch (readError) {
                    Logger.log('⚠️ Could not read existing data for duplicate check: ' + readError.toString());
                }
                
                // إنشاء خريطة للـ IDs الموجودة لتسريع البحث
                const existingIds = new Set();
                if (Array.isArray(existingData) && existingData.length > 0) {
                    existingData.forEach(item => {
                        if (item && item.id) {
                            existingIds.add(String(item.id).trim());
                        }
                    });
                }
                
                // تصفية البيانات المكررة
                const uniqueData = [];
                const duplicates = [];
                data.forEach(item => {
                    const processedItem = processDataItemForAppend(item);
                    const recordId = processedItem.id ? String(processedItem.id).trim() : '';
                    
                    if (recordId && existingIds.has(recordId)) {
                        duplicates.push(processedItem);
                        Logger.log('⚠️ Duplicate record skipped in appendToSheet: id=' + recordId + ', sheetName=' + sheetName);
                    } else {
                        uniqueData.push(processedItem);
                        if (recordId) {
                            existingIds.add(recordId); // إضافة إلى المجموعة لتجنب التكرار داخل نفس الدفعة
                        }
                    }
                });
                
                // تحديث السجلات المكررة
                if (duplicates.length > 0) {
                    Logger.log('⚠️ Found ' + duplicates.length + ' duplicate records, updating them instead of adding');
                    duplicates.forEach(duplicate => {
                        const recordId = duplicate.id ? String(duplicate.id).trim() : '';
                        if (recordId) {
                            try {
                                updateSingleRowInSheet(sheetName, recordId, duplicate, spreadsheetId);
                            } catch (updateError) {
                                Logger.log('⚠️ Failed to update duplicate record: id=' + recordId + ', error=' + updateError.toString());
                            }
                        }
                    });
                }
                
                if (uniqueData.length === 0) {
                    return withResolvedPTWRegistry_(sheetName, { 
                        success: true, 
                        message: 'جميع السجلات موجودة بالفعل، تم تحديثها',
                        duplicatesCount: duplicates.length,
                        updatedCount: duplicates.length
                    }, resolvedPTWRegistryForAppend);
                }
                
                // معالجة البيانات الفريدة بكميات كبيرة - تحسين الأداء
                const batchSize = 1000; // كتابة 1000 صف في كل دفعة
                
                for (let i = 0; i < uniqueData.length; i += batchSize) {
                    const batch = uniqueData.slice(i, i + batchSize);
                    const batchValues = batch.map(item => {
                        return headers.map(header => toSheetCellValue_(header, item[header], sheetName));
                    });
                    
                    try {
                        // ✅ التحقق من آخر صف قبل كل دفعة - استخدام getDataRange()
                        let currentLastRow = 1;
                        try {
                            const dataRange = sheet.getDataRange();
                            if (dataRange && dataRange.getNumRows() > 0) {
                                currentLastRow = dataRange.getNumRows();
                                if (currentLastRow < 1) {
                                    currentLastRow = 1;
                                }
                            } else {
                                currentLastRow = 1;
                            }
                        } catch (e) {
                            Logger.log('Warning: Could not use getDataRange() for batch, using getLastRow(): ' + e.toString());
                            currentLastRow = sheet.getLastRow();
                            if (currentLastRow < 1) {
                                currentLastRow = 1;
                            }
                        }
                        
                        // ✅ للدفعة الأولى، نستخدم startRow المحسوب مسبقاً
                        // ✅ للدفعات التالية، نضيف بعد آخر صف مكتوب
                        let batchStartRow;
                        if (i === 0) {
                            // ✅ الدفعة الأولى: نستخدم startRow المحسوب مسبقاً
                            batchStartRow = startRow;
                        } else {
                            // ✅ الدفعات التالية: نتحقق من آخر صف مكتوب
                            try {
                                const dataRange = sheet.getDataRange();
                                if (dataRange && dataRange.getNumRows() > 0) {
                                    currentLastRow = dataRange.getNumRows();
                                    if (currentLastRow < 1) {
                                        currentLastRow = 1;
                                    }
                                } else {
                                    currentLastRow = 1;
                                }
                            } catch (e) {
                                currentLastRow = sheet.getLastRow();
                                if (currentLastRow < 1) {
                                    currentLastRow = 1;
                                }
                            }
                            batchStartRow = currentLastRow + 1;
                        }
                        
                        Logger.log('appendToSheet: Writing batch ' + i + ' to row ' + batchStartRow + ' (currentLastRow=' + currentLastRow + ')');
                        
                        // ✅ التأكد من أن batchStartRow > 1 (بعد الرؤوس)
                        if (batchStartRow <= 1) {
                            throw new Error('Invalid batchStartRow: ' + batchStartRow + '. Must be > 1');
                        }
                        
                        sheet.getRange(batchStartRow, 1, batchValues.length, headers.length).setValues(batchValues);
                        
                        // ✅ حفظ البيانات مباشرة بعد كل دفعة لضمان التحديث
                        if (i + batchSize >= data.length) {
                            // ✅ حفظ فقط بعد آخر دفعة
                            SpreadsheetApp.flush();
                        }
                    } catch (error) {
                        Logger.log('Error appending batch ' + i + ': ' + error.toString());
                        throw error;
                    }
                }
            }
        } else if (typeof data === 'object' && data !== null) {
            // إذا كان كائن واحد
            const processedData = processDataItemForAppend(data);
            
            // ✅ إصلاح: التحقق من التكرار قبل الإضافة لمنع تكرار البيانات
            const recordId = processedData.id ? String(processedData.id).trim() : '';
            if (recordId) {
                // قراءة البيانات الموجودة للتحقق من التكرار
                try {
                    const existingData = readFromSheet(sheetName, spreadsheetId);
                    if (Array.isArray(existingData) && existingData.length > 0) {
                        const duplicate = existingData.find(item => {
                            if (!item || !item.id) return false;
                            return String(item.id).trim() === recordId;
                        });
                        
                        if (duplicate) {
                            Logger.log('⚠️ Duplicate record found in appendToSheet: id=' + recordId + ', sheetName=' + sheetName);
                            Logger.log('⚠️ Updating existing record instead of adding duplicate');
                            
                            // تحديث السجل الموجود بدلاً من إضافة مكرر
                            const updateResult = updateSingleRowInSheet(sheetName, recordId, processedData, spreadsheetId);
                            if (updateResult && updateResult.success) {
                                return withResolvedPTWRegistry_(sheetName, { 
                                    success: true, 
                                    message: 'تم تحديث السجل الموجود بدلاً من إضافة مكرر',
                                    isDuplicate: true,
                                    rowNumber: updateResult.rowNumber || null
                                }, resolvedPTWRegistryForAppend);
                            } else {
                                // إذا فشل التحديث، نتابع الإضافة (قد يكون هناك خطأ في updateSingleRowInSheet)
                                Logger.log('⚠️ Failed to update existing record, proceeding with append');
                            }
                        }
                    }
                } catch (duplicateCheckError) {
                    Logger.log('⚠️ Error checking for duplicates in appendToSheet: ' + duplicateCheckError.toString());
                    // نتابع الإضافة في حالة فشل التحقق من التكرار
                }
            }
            
            // ✅ التأكد من أن الرؤوس في الورقة تطابق headers المحسوبة
            // ✅ إعادة قراءة الرؤوس الفعلية من الورقة بعد ensureSheetHeaders للتأكد من التحديثات
            let actualHeaders = [];
            try {
                const lastColumn = sheet.getLastColumn();
                if (lastColumn > 0) {
                    const headerRange = sheet.getRange(1, 1, 1, lastColumn);
                    actualHeaders = headerRange.getValues()[0];
                }
            } catch (e) {
                Logger.log('Warning: Could not read actual headers from sheet: ' + e.toString());
            }
            
            // ✅ إعادة قراءة الرؤوس الفعلية من الورقة بعد ensureSheetHeaders للتأكد من التحديثات
            // ✅ ensureSheetHeaders قد تضيف حقول جديدة، لذلك نقرأ الرؤوس مرة أخرى
            let updatedHeaders = [];
            try {
                const updatedLastColumn = sheet.getLastColumn();
                if (updatedLastColumn > 0) {
                    const updatedHeaderRange = sheet.getRange(1, 1, 1, updatedLastColumn);
                    updatedHeaders = updatedHeaderRange.getValues()[0];
                }
            } catch (e) {
                Logger.log('Warning: Could not read updated headers from sheet: ' + e.toString());
                updatedHeaders = headers; // استخدام headers المحسوبة كبديل
            }
            
            // ✅ استخدام الرؤوس المحدثة من الورقة (بعد ensureSheetHeaders)
            // ✅ إذا كانت الرؤوس المحدثة تحتوي على جميع الحقول المطلوبة، نستخدمها
            // ✅ وإلا نستخدم headers المحسوبة من البيانات
            const finalHeaders = (updatedHeaders && updatedHeaders.length > 0 && 
                                 headers.every(h => updatedHeaders.includes(h))) 
                                 ? updatedHeaders 
                                 : headers;
            
            // ✅ التحقق من أن الرؤوس المحدثة تحتوي على جميع الحقول المطلوبة
            if (updatedHeaders && updatedHeaders.length > 0) {
                const missingHeaders = headers.filter(h => !updatedHeaders.includes(h));
                if (missingHeaders.length > 0) {
                    Logger.log('⚠️ Warning: Missing headers in sheet after ensureSheetHeaders: ' + missingHeaders.join(', ') + '. Using computed headers instead.');
                }
            }
            
            // ✅ إعداد rowValues حسب ترتيب finalHeaders
            // ✅ Fix: write Dates as real Date objects (not ISO JSON strings)
            const rowValues = finalHeaders.map(h => toSheetCellValue_(h, processedData[h], sheetName));
            
            // ✅ التحقق من تطابق عدد الأعمدة قبل appendRow()
            const actualColumnCount = sheet.getLastColumn();
            if (actualColumnCount > 0 && rowValues.length !== actualColumnCount) {
                Logger.log('⚠️ Warning: rowValues.length (' + rowValues.length + ') != actualColumnCount (' + actualColumnCount + ')');
                Logger.log('⚠️ Adjusting rowValues to match actual column count');
                
                // ✅ تعديل rowValues لتطابق عدد الأعمدة الفعلية
                if (rowValues.length < actualColumnCount) {
                    // ✅ إضافة قيم فارغة إذا كان rowValues أقصر
                    while (rowValues.length < actualColumnCount) {
                        rowValues.push('');
                    }
                } else if (rowValues.length > actualColumnCount) {
                    // ✅ تقصير rowValues إذا كان أطول
                    rowValues.splice(actualColumnCount);
                }
                Logger.log('✅ Adjusted rowValues.length to ' + rowValues.length + ' to match actualColumnCount');
            }
            
            try {
                // ✅ التحقق من آخر صف قبل الإضافة - استخدام طريقة موثوقة 100%
                // ✅ قراءة البيانات الفعلية من الورقة للحصول على عدد الصفوف الصحيح
                let lastRowBefore = 1;
                try {
                    const existingData = readFromSheet(sheetName, spreadsheetId);
                    if (Array.isArray(existingData) && existingData.length > 0) {
                        // ✅ عدد الصفوف = عدد البيانات + 1 (للرؤوس)
                        lastRowBefore = existingData.length + 1;
                        Logger.log('✅ Using readFromSheet(): found ' + existingData.length + ' rows, lastRow=' + lastRowBefore);
                    } else {
                        // ✅ لا توجد بيانات - فقط الرؤوس
                        lastRowBefore = 1;
                        Logger.log('✅ Using readFromSheet(): no data found, lastRow=1 (headers only)');
                    }
                } catch (readError) {
                    // ✅ في حالة فشل قراءة البيانات، نستخدم getLastRow()
                    Logger.log('⚠️ Could not read from sheet, using getLastRow(): ' + readError.toString());
                    lastRowBefore = sheet.getLastRow() || 1;
                }
                
                Logger.log('appendToSheet: Last row before appendRow() = ' + lastRowBefore + ', sheetName=' + sheetName);
                Logger.log('appendToSheet: finalHeaders.length=' + finalHeaders.length + ', rowValues.length=' + rowValues.length + ', actualColumnCount=' + actualColumnCount);
                
                // ✅ التحقق من أن rowValues.length يطابق actualColumnCount قبل appendRow()
                if (actualColumnCount > 0 && rowValues.length !== actualColumnCount) {
                    const errorMsg = 'rowValues.length (' + rowValues.length + ') != actualColumnCount (' + actualColumnCount + ') - Cannot use appendRow()';
                    Logger.log('❌ ' + errorMsg);
                    throw new Error(errorMsg);
                }
                
                // ✅ إضافة الصف في آخر موضع تلقائياً
                // ✅ appendRow() تضيف دائماً في آخر صف تلقائياً - لا تحتاج لحساب
                sheet.appendRow(rowValues);
                
                // ✅ حفظ البيانات مباشرة لضمان أن readFromSheet() يقرأ البيانات المحدثة
                SpreadsheetApp.flush();
                
                // ✅ التحقق من الصف المضاف - استخدام طريقة موثوقة
                let verifyLastRow = lastRowBefore;
                try {
                    const dataAfterAppend = readFromSheet(sheetName, spreadsheetId);
                    if (Array.isArray(dataAfterAppend) && dataAfterAppend.length > 0) {
                        verifyLastRow = dataAfterAppend.length + 1;
                        Logger.log('✅ Using readFromSheet() after append: found ' + dataAfterAppend.length + ' rows, lastRow=' + verifyLastRow);
                    } else {
                        verifyLastRow = 1;
                    }
                } catch (readError) {
                    Logger.log('⚠️ Could not read from sheet after append, using getLastRow(): ' + readError.toString());
                    verifyLastRow = sheet.getLastRow() || lastRowBefore;
                }
                
                // ✅ التحقق من أن الصف تم إضافته في النهاية وليس في البداية
                if (verifyLastRow <= lastRowBefore) {
                    Logger.log('⚠️ Warning: Row number did not increase. Last row before: ' + lastRowBefore + ', after: ' + verifyLastRow);
                    Logger.log('⚠️ This might indicate an issue with appendRow() or the sheet structure');
                    // ✅ في هذه الحالة، نرمي خطأ لإجبار استخدام fallback
                    throw new Error('appendRow() did not increase row number. Before: ' + lastRowBefore + ', After: ' + verifyLastRow);
                } else {
                    Logger.log('✅ appendToSheet: Row number increased from ' + lastRowBefore + ' to ' + verifyLastRow);
                    Logger.log('✅ appendToSheet: Row successfully added at the END of the sheet (row ' + verifyLastRow + ')');
                }
                
                Logger.log('✅ appendToSheet: Successfully appended row to ' + sheetName + ' at row ' + verifyLastRow + ' using appendRow() (was ' + lastRowBefore + ')');
                
                return withResolvedPTWRegistry_(sheetName, { success: true, message: 'تم إضافة البيانات بنجاح', rowNumber: verifyLastRow }, resolvedPTWRegistryForAppend);
            } catch (error) {
                Logger.log('Error appending single row with appendRow(): ' + error.toString());
                Logger.log('Error details: ' + JSON.stringify(error));
                
                // ✅ في حالة فشل appendRow()، نستخدم الطريقة القديمة كبديل
                try {
                    Logger.log('⚠️ Falling back to getRange().setValues() method...');
                    Logger.log('⚠️ appendRow() failed, using manual row calculation method');
                    
                    // ✅ التحقق من آخر صف قبل الكتابة - استخدام طريقة موثوقة 100%
                    // ✅ قراءة البيانات الفعلية من الورقة للحصول على عدد الصفوف الصحيح
                    let verifyLastRow = 1;
                    let lastRowMethod = 'unknown';
                    
                    try {
                        // ✅ الطريقة الأولى: قراءة البيانات الفعلية من الورقة - الأكثر موثوقية
                        const existingData = readFromSheet(sheetName, spreadsheetId);
                        if (Array.isArray(existingData) && existingData.length > 0) {
                            // ✅ عدد الصفوف = عدد البيانات + 1 (للرؤوس)
                            verifyLastRow = existingData.length + 1;
                            lastRowMethod = 'readFromSheet';
                            Logger.log('✅ Using readFromSheet(): found ' + existingData.length + ' rows, lastRow=' + verifyLastRow);
                        } else {
                            // ✅ لا توجد بيانات - فقط الرؤوس
                            verifyLastRow = 1;
                            lastRowMethod = 'readFromSheet (empty)';
                            Logger.log('✅ Using readFromSheet(): no data found, lastRow=1 (headers only)');
                        }
                    } catch (readError) {
                        Logger.log('⚠️ Warning: Could not read from sheet, trying getDataRange(): ' + readError.toString());
                        try {
                            // ✅ الطريقة الثانية: استخدام getDataRange()
                            const dataRange = sheet.getDataRange();
                            if (dataRange && dataRange.getNumRows() > 0) {
                                verifyLastRow = dataRange.getNumRows();
                                lastRowMethod = 'getDataRange';
                                Logger.log('✅ Using getDataRange(): lastRow=' + verifyLastRow);
                                
                                // ✅ التحقق: إذا كان verifyLastRow = 1، يعني فقط الرؤوس
                                if (verifyLastRow < 1) {
                                    verifyLastRow = 1;
                                }
                            } else {
                                verifyLastRow = 1;
                                lastRowMethod = 'getDataRange (empty)';
                            }
                        } catch (e) {
                            Logger.log('⚠️ Warning: Could not use getDataRange(), trying getLastRow(): ' + e.toString());
                            try {
                                // ✅ الطريقة الثالثة: استخدام getLastRow()
                                const lastRowValue = sheet.getLastRow();
                                if (lastRowValue && lastRowValue > 0) {
                                    verifyLastRow = lastRowValue;
                                    lastRowMethod = 'getLastRow';
                                    Logger.log('✅ Using getLastRow(): lastRow=' + verifyLastRow);
                                } else {
                                    verifyLastRow = 1;
                                    lastRowMethod = 'getLastRow (empty)';
                                }
                            } catch (e2) {
                                Logger.log('❌ Error: Could not get last row using any method: ' + e2.toString());
                                verifyLastRow = 1; // افتراضياً: الرؤوس فقط
                                lastRowMethod = 'default (1)';
                            }
                        }
                    }
                    
                    // ✅ حساب finalStartRow: بعد آخر صف يحتوي على بيانات
                    // ✅ إذا كان verifyLastRow = 1، يعني فقط الرؤوس، نبدأ من الصف 2
                    // ✅ إذا كان verifyLastRow > 1، نضيف بعد آخر صف
                    const finalStartRow = verifyLastRow === 1 ? 2 : verifyLastRow + 1;
                    
                    Logger.log('📝 appendToSheet (fallback): lastRow=' + verifyLastRow + ' (method=' + lastRowMethod + '), finalStartRow=' + finalStartRow);
                    Logger.log('📝 appendToSheet (fallback): sheetName=' + sheetName + ', finalHeadersCount=' + finalHeaders.length + ', rowValuesCount=' + rowValues.length);
                    
                    // ✅ التحقق من أن finalStartRow > 1 (بعد الرؤوس)
                    if (finalStartRow <= 1) {
                        const errorMsg = 'Invalid startRow: ' + finalStartRow + '. Must be > 1. lastRow=' + verifyLastRow + ', method=' + lastRowMethod;
                        Logger.log('❌ ' + errorMsg);
                        throw new Error(errorMsg);
                    }
                    
                    // ✅ التحقق من أن finalStartRow ليس 2 إذا كان هناك بيانات (قد يشير إلى خطأ)
                    if (finalStartRow === 2 && verifyLastRow > 1) {
                        Logger.log('⚠️ Warning: finalStartRow=2 but verifyLastRow=' + verifyLastRow + '. This might indicate an issue.');
                    }
                    
                    // ✅ استخدام actualColumnCount بدلاً من finalHeaders.length للاتساق
                    const actualColumnCount = sheet.getLastColumn();
                    let columnsToWrite = actualColumnCount > 0 ? actualColumnCount : finalHeaders.length;
                    
                    // ✅ تعديل rowValues لتطابق عدد الأعمدة الفعلية
                    if (rowValues.length !== columnsToWrite) {
                        Logger.log('⚠️ Warning: rowValues.length (' + rowValues.length + ') != columnsToWrite (' + columnsToWrite + ')');
                        
                        if (rowValues.length < columnsToWrite) {
                            // ✅ إضافة قيم فارغة إذا كان rowValues أقصر
                            while (rowValues.length < columnsToWrite) {
                                rowValues.push('');
                            }
                            Logger.log('✅ Adjusted rowValues: added ' + (columnsToWrite - rowValues.length + rowValues.length - rowValues.length) + ' empty values');
                        } else if (rowValues.length > columnsToWrite) {
                            // ✅ تقصير rowValues إذا كان أطول
                            rowValues.splice(columnsToWrite);
                            Logger.log('✅ Adjusted rowValues: trimmed to ' + columnsToWrite + ' values');
                        }
                    }
                    
                    // ✅ التأكد من أن columnsToWrite > 0
                    if (columnsToWrite <= 0) {
                        columnsToWrite = finalHeaders.length;
                        Logger.log('⚠️ Warning: columnsToWrite was 0, using finalHeaders.length=' + columnsToWrite);
                    }
                    
                    // ✅ كتابة البيانات في الصف الصحيح
                    Logger.log('📝 Writing to row ' + finalStartRow + ' with ' + columnsToWrite + ' columns (rowValues.length=' + rowValues.length + ')');
                    sheet.getRange(finalStartRow, 1, 1, columnsToWrite).setValues([rowValues]);
                    
                    // ✅ حفظ البيانات مباشرة لضمان أن readFromSheet() يقرأ البيانات المحدثة
                    SpreadsheetApp.flush();
                    
                    // ✅ التحقق من أن الصف تم إضافته بشكل صحيح
                    // ملاحظة: readFromSheet() قد يُرجع عدداً أقل عند وجود صفوف شبه فارغة/منسقة،
                    // لذلك نعتبر getLastRow() هو المرجع الأساسي لموضع آخر صف فعلي.
                    let verifyAfterWrite = finalStartRow;
                    try {
                        const dataAfterWrite = readFromSheet(sheetName, spreadsheetId);
                        const sheetLastRowAfterWrite = sheet.getLastRow() || finalStartRow;
                        if (Array.isArray(dataAfterWrite) && dataAfterWrite.length > 0) {
                            const readBasedLastRow = dataAfterWrite.length + 1;
                            verifyAfterWrite = Math.max(readBasedLastRow, sheetLastRowAfterWrite);
                            Logger.log('✅ Verify after write: readBasedLastRow=' + readBasedLastRow + ', sheetLastRow=' + sheetLastRowAfterWrite + ', selected=' + verifyAfterWrite);
                        } else {
                            verifyAfterWrite = sheetLastRowAfterWrite;
                            Logger.log('✅ Verify after write: readFromSheet empty, using sheetLastRow=' + verifyAfterWrite);
                        }
                    } catch (readError) {
                        Logger.log('⚠️ Could not read from sheet after write, using getLastRow(): ' + readError.toString());
                        verifyAfterWrite = sheet.getLastRow() || finalStartRow;
                    }
                    
                    Logger.log('✅ appendToSheet (fallback): After write, lastRow=' + verifyAfterWrite + ' (was ' + verifyLastRow + ', written at ' + finalStartRow + ')');
                    
                    if (verifyAfterWrite < finalStartRow) {
                        Logger.log('⚠️ Warning: After write, lastRow (' + verifyAfterWrite + ') < finalStartRow (' + finalStartRow + ')');
                        Logger.log('⚠️ This might indicate that the row was not added correctly');
                    } else if (verifyAfterWrite === finalStartRow) {
                        Logger.log('✅ appendToSheet (fallback): Row successfully written at row ' + finalStartRow);
                    } else {
                        Logger.log('✅ appendToSheet (fallback): Row written at row ' + finalStartRow + ', new lastRow=' + verifyAfterWrite);
                    }
                    
                    // ✅ التحقق النهائي: التأكد من أن الصف في المكان الصحيح
                    if (verifyAfterWrite < finalStartRow) {
                        Logger.log('❌ Error: Row was not added at the expected position. Expected: ' + finalStartRow + ', Actual: ' + verifyAfterWrite);
                        return { success: false, message: 'فشل إضافة الصف في المكان الصحيح. المتوقع: ' + finalStartRow + ', الفعلي: ' + verifyAfterWrite };
                    }
                    
                    Logger.log('✅ appendToSheet: Successfully appended row to ' + sheetName + ' at row ' + finalStartRow + ' using fallback method');
                    return withResolvedPTWRegistry_(sheetName, { success: true, message: 'تم إضافة البيانات بنجاح', rowNumber: finalStartRow }, resolvedPTWRegistryForAppend);
                } catch (fallbackError) {
                    Logger.log('❌ Error in fallback method: ' + fallbackError.toString());
                    Logger.log('❌ Fallback error details: ' + JSON.stringify(fallbackError));
                    throw error; // رمي الخطأ الأصلي
                }
            }
        }

        return withResolvedPTWRegistry_(sheetName, { success: true, message: 'تم إضافة البيانات بنجاح' }, resolvedPTWRegistryForAppend);
        } finally {
            // ✅ إبطال CacheService لقراءة الورقة — وإلا تبقى readFromSheet تعيد JSON قديماً دون الصف المضاف (مثل PTWIssuingAuthorities)
            try {
                const _readCache = CacheService.getScriptCache();
                _readCache.remove('hse_read_' + sheetName + '_v1');
            } catch (_cacheInvEx) {
                Logger.log('appendToSheet cache invalidate: ' + _cacheInvEx.toString());
            }
            if (_ptwRegistryAppendLock) {
                try {
                    _ptwRegistryAppendLock.releaseLock();
                } catch (relEx) {
                    Logger.log('appendToSheet releaseLock: ' + relEx.toString());
                }
            }
        }
    } catch (error) {
        Logger.log('Error in appendToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة البيانات: ' + error.toString() };
    }
}

/**
 * يزامن حقول السجل مع أسماء رؤوس الأعمدة الفعلية في الشيت (مثل Status مقابل status).
 * بدون ذلك يبقى عمود الحالة القديم pending رغم تعيين request.status في الكود.
 */
function syncContractorRequestRowForSheetHeaders_(record, headers, sheetName) {
    if (sheetName !== 'ContractorApprovalRequests' && sheetName !== 'ContractorDeletionRequests') return;
    if (!record || !headers || !headers.length) return;
    var fields = ['status', 'approvedAt', 'approvedBy', 'approvedByName', 'rejectedAt', 'rejectedBy', 'rejectedByName', 'rejectionReason', 'updatedAt'];
    fields.forEach(function (fl) {
        var val = record[fl];
        if (val === undefined || val === null || val === '') {
            for (var k in record) {
                if (!record.hasOwnProperty(k)) continue;
                if (String(k).toLowerCase() !== fl) continue;
                var v = record[k];
                if (v !== undefined && v !== null && v !== '') {
                    val = v;
                    break;
                }
            }
        }
        if (val === undefined || val === null) return;
        for (var i = 0; i < headers.length; i++) {
            var h = headers[i];
            if (!h) continue;
            if (String(h).trim().toLowerCase() === fl) {
                record[h] = val;
            }
        }
    });
}

/**
 * تحديث صف واحد فقط في الورقة (بدون حذف الصفوف الأخرى)
 * @param {string} sheetName - اسم الورقة
 * @param {string} recordId - معرف السجل (id)
 * @param {object} updateData - البيانات المراد تحديثها
 * @param {string} spreadsheetId - معرف الجدول (اختياري)
 * @returns {object} - نتيجة العملية { success: boolean, message: string }
 */
function updateSingleRowInSheet(sheetName, recordId, updateData, spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        // التحقق من صحة spreadsheetId
        if (!spreadsheetId || (typeof spreadsheetId === 'string' && spreadsheetId.trim() === '')) {
            return { success: false, message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات.' };
        }
        
        if (!sheetName || (typeof sheetName === 'string' && sheetName.trim() === '')) {
            return { success: false, message: 'اسم الورقة غير محدد.' };
        }
        
        if (!recordId) {
            return { success: false, message: 'معرف السجل غير محدد.' };
        }
        
        // فتح الجدول
        let spreadsheet;
        try {
            spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        } catch (error) {
            return { success: false, message: 'فشل فتح الجدول. يرجى التحقق من معرف الجدول: ' + error.toString() };
        }
        
        // فتح الورقة
        let sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة: ' + sheetName };
        }
        
        // قراءة جميع البيانات للعثور على السجل
        const allData = readFromSheet(sheetName, spreadsheetId);
        const recordIndex = allData.findIndex(r => r && r.id === recordId);
        
        if (recordIndex === -1) {
            return { success: false, message: 'السجل غير موجود في الورقة.' };
        }
        
        // تحديث البيانات في الذاكرة
        const record = allData[recordIndex];
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                record[key] = updateData[key];
            }
        }
        
        // ✅ Fix: استخدم رؤوس الورقة الفعلية (ترتيب الأعمدة الحقيقي) لتجنب انزلاق الأعمدة عند التحديث
        // الحصول على الرؤوس من الورقة (مع الحفاظ على الأعمدة الفارغة لضمان تطابق الفهارس)
        let headers = [];
        try {
            const lastCol = sheet.getLastColumn();
            if (lastCol > 0) {
                headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => {
                    if (h === undefined || h === null) return '';
                    return String(h).trim();
                });
            }
        } catch (eHeaders) {
            headers = [];
        }

        // التأكد من تحديث الرؤوس إذا لزم الأمر (إضافة أي أعمدة ناقصة)
        ensureSheetHeaders(sheet, sheetName, record);

        // إعادة قراءة الرؤوس بعد ensureSheetHeaders
        try {
            const lastCol2 = sheet.getLastColumn();
            if (lastCol2 > 0) {
                headers = sheet.getRange(1, 1, 1, lastCol2).getValues()[0].map(h => {
                    if (h === undefined || h === null) return '';
                    return String(h).trim();
                });
            }
        } catch (eHeaders2) {
            // keep whatever we had
        }

        const hasAnyValidHeader = headers.some(h => String(h || '').trim() !== '');
        if (!hasAnyValidHeader) {
            return { success: false, message: 'لا توجد رؤوس صالحة في الورقة.' };
        }

        syncContractorRequestRowForSheetHeaders_(record, headers, sheetName);
        
        // معالجة البيانات قبل الكتابة
        const processDataItem = function(item) {
            if (!item || typeof item !== 'object') return item;
            
            const processed = {};
            for (var key in item) {
                if (item.hasOwnProperty(key)) {
                    processed[key] = item[key];
                }
            }
            
            // ✅ Attachments: store as plain text (NO JSON)
            if (processed.attachments !== undefined) {
                processed.attachments = formatAttachmentsText_(processed.attachments);
            }
            
            return processed;
        };
        
        const processedRecord = processDataItem(record);
        
        // إعداد قيم الصف حسب ترتيب الأعمدة الحقيقي
        const rowValues = headers.map(h => {
            if (!h) return '';
            return toSheetCellValue_(h, processedRecord[h], sheetName);
        });
        
        // ✅ العثور على رقم الصف في الورقة (recordIndex + 2 لأن الصف الأول هو الرؤوس)
        // نقرأ جميع الصفوف للعثور على الصف الصحيح
        const dataRange = sheet.getDataRange();
        if (!dataRange) {
            return { success: false, message: 'لا توجد بيانات في الورقة.' };
        }
        
        const allRows = dataRange.getValues();
        if (allRows.length <= 1) {
            return { success: false, message: 'لا توجد بيانات في الورقة.' };
        }
        
        // البحث عن الصف الذي يحتوي على recordId
        let targetRowIndex = -1;
        const idColumnIndex = headers.indexOf('id');
        
        if (idColumnIndex >= 0) {
            for (let i = 1; i < allRows.length; i++) {
                const rowId = allRows[i][idColumnIndex];
                if (rowId && String(rowId).trim() === String(recordId).trim()) {
                    targetRowIndex = i + 1; // +1 لأن getRange() يستخدم 1-based indexing
                    break;
                }
            }
        }
        
        if (targetRowIndex === -1) {
            // إذا لم نجد الصف، نستخدم recordIndex + 2 كبديل
            targetRowIndex = recordIndex + 2;
        }
        
        // ✅ تحديث الصف المحدد فقط (بدون حذف أي شيء)
        try {
            sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([rowValues]);
            
            // ✅ مسح الcache بعد التحديث لضمان قراءة البيانات المحدثة
            const cache = CacheService.getScriptCache();
            const cacheKey = 'hse_read_' + sheetName + '_v1';
            cache.remove(cacheKey);
            
            Logger.log('✅ Successfully updated single row at row ' + targetRowIndex + ' in sheet ' + sheetName + ' and cleared cache');
            return { success: true, message: 'تم تحديث السجل بنجاح' };
        } catch (error) {
            Logger.log('Error updating single row: ' + error.toString());
            return { success: false, message: 'حدث خطأ أثناء تحديث السجل: ' + error.toString() };
        }
        
    } catch (error) {
        Logger.log('Error in updateSingleRowInSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث السجل: ' + error.toString() };
    }
}

/**
 * قراءة بيانات من ورقة
 */
function readFromSheet(sheetName, spreadsheetId = null) {
    try {
        // ✅ CacheService: Check cache first for frequently-read sheets
        const cache = CacheService.getScriptCache();
        const cacheKey = 'hse_read_' + sheetName + '_v1';
        const cached = cache.get(cacheKey);
        
        if (cached) {
            try {
                Logger.log('Cache HIT for readFromSheet: ' + sheetName);
                return JSON.parse(cached);
            } catch (parseError) {
                Logger.log('Cache parse error for ' + sheetName + ': ' + parseError.toString());
                // Continue to read from sheet if cache is corrupted
            }
        }
        
        // استخدام getSpreadsheetId() إذا لم يكن spreadsheetId محدداً
        const finalSpreadsheetId = spreadsheetId || getSpreadsheetId();
        
        // التحقق من صحة المعاملات
        if (!finalSpreadsheetId || (typeof finalSpreadsheetId === 'string' && finalSpreadsheetId.trim() === '')) {
            Logger.log('Warning: Spreadsheet ID not provided');
            return [];
        }
        
        if (!sheetName || (typeof sheetName === 'string' && sheetName.trim() === '')) {
            Logger.log('Warning: Sheet name not provided');
            return [];
        }
        
        // فتح الجدول
        let spreadsheet;
        try {
            spreadsheet = SpreadsheetApp.openById(finalSpreadsheetId);
        } catch (error) {
            Logger.log('Error opening spreadsheet: ' + error.toString());
            return [];
        }
        
        // فتح الورقة
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
            Logger.log('Sheet not found: ' + sheetName);
            return [];
        }

        // قراءة البيانات - استخدام getDataRange للتحسين
        let data;
        try {
            const dataRange = sheet.getDataRange();
            if (!dataRange) {
                return [];
            }
            data = dataRange.getValues();
        } catch (error) {
            Logger.log('Error reading data range: ' + error.toString());
            return [];
        }
        
        if (!data || data.length === 0) {
            Logger.log('Sheet ' + sheetName + ' is empty (no data)');
            return []; // لا توجد بيانات على الإطلاق
        }
        
        if (data.length === 1) {
            Logger.log('Sheet ' + sheetName + ' contains only headers, no data rows');
            return []; // فقط رؤوس بدون بيانات
        }

        // تنظيف الرؤوس (إزالة المسافات الزائدة) - مهم: لا نحذف الرؤوس الفارغة حتى لا تختل فهارس الأعمدة
        // ✅ Fix: سابقاً كنا نعمل filter للرؤوس الفارغة، وهذا يسبب انزياح الأعمدة عند وجود أي رأس فارغ داخل الصف الأول.
        const headers = data[0].map(h => {
            if (h === undefined || h === null) return '';
            return String(h).trim();
        });
        
        const hasAnyValidHeader = headers.some(h => String(h || '').trim() !== '');
        if (!hasAnyValidHeader) {
            Logger.log('Sheet ' + sheetName + ' has no valid headers');
            return [];
        }
        
        const rows = data.slice(1);

        // ✅ إصلاح: إزالة التكرار عند القراءة (في حالة وجود تكرار في الورقة نفسها)
        // تحويل الصفوف إلى كائنات
        const allObjects = rows.map((row, rowIndex) => {
            const obj = {};
            headers.forEach((header, index) => {
                // تنظيف اسم الرأس (إزالة المسافات الزائدة)
                const cleanHeader = header ? String(header).trim() : '';
                if (!cleanHeader) {
                    return; // تجاهل الرؤوس الفارغة
                }
                
                const value = row[index];
                
                // معالجة القيم الفارغة بشكل أفضل
                if (value === undefined || value === null) {
                    obj[cleanHeader] = '';
                } else if (value === '') {
                    obj[cleanHeader] = '';
                } else {
                    // تحويل القيمة إلى النوع المناسب
                    let processedValue = value;
                    
                    // معالجة Object - تحويله إلى النوع المناسب
                    if (typeof processedValue === 'object' && processedValue !== null) {
                        // ✅ Dates from Sheets come as Date objects => format as ISO string with time
                        // ✅ إصلاح: تحويل Date objects إلى ISO strings كاملة مع الوقت للحقول التي تحتاج وقت
                        try {
                            if (Object.prototype.toString.call(processedValue) === '[object Date]' && !isNaN(processedValue.getTime())) {
                                // للحقول التي تحتاج وقت (visitDate, exitDate, checkIn, checkOut, etc.)
                                const timeFields = ['visitDate', 'exitDate', 'checkIn', 'checkOut', 'injuryDate', 'startDate', 'endDate', 'timeFrom', 'timeTo', 'closureTime', 'investigationDateTime', 'incidentDateTime', 'date'];
                                const timeOnlyFields = ['fromTime', 'toTime', 'startTime', 'endTime'];
                                if (timeOnlyFields.includes(cleanHeader)) {
                                    // من الساعة / إلى الساعة (تدريب الموظفين والمقاولين): تخزين بصيغة HH:mm فقط
                                    processedValue = Utilities.formatDate(processedValue, Session.getScriptTimeZone(), 'HH:mm');
                                } else if (shouldPreserveSheetDateTimeAsText_(sheetName, cleanHeader)) {
                                    processedValue = normalizeSheetDateTimeText_(processedValue, Session.getScriptTimeZone());
                                } else if (timeFields.includes(cleanHeader)) {
                                    // تحويل إلى ISO string كامل مع الوقت
                                    processedValue = processedValue.toISOString();
                                } else {
                                    // للحقول الأخرى (تاريخ فقط بدون وقت)، نستخدم yyyy-MM-dd
                                    processedValue = Utilities.formatDate(processedValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
                                }
                            }
                        } catch (eDate) {
                            // ignore
                        }

                        // إذا كان Object، نحاول استخراج القيمة منه
                        if (typeof processedValue === 'object' && processedValue !== null) {
                            if (processedValue.value !== undefined && processedValue.value !== null) {
                                // إذا كان يحتوي على خاصية value، نستخدمها
                                processedValue = String(processedValue.value);
                            } else if (Array.isArray(processedValue)) {
                                // إذا كان Array، نحوله إلى JSON
                                processedValue = JSON.stringify(processedValue);
                            } else {
                                // Object عادي - نحوله إلى JSON
                                // لكن لـ passwordHash، نحاول استخراج القيمة الأولى
                                if (cleanHeader === 'passwordHash') {
                                    const values = Object.values(processedValue);
                                    if (values.length > 0 && typeof values[0] === 'string') {
                                        processedValue = String(values[0]);
                                    } else {
                                        processedValue = JSON.stringify(processedValue);
                                    }
                                } else {
                                    processedValue = JSON.stringify(processedValue);
                                }
                            }
                        }
                    }
                    // إذا كانت القيمة نصية، نحاول تحليل JSON
                    else if (typeof processedValue === 'string' && processedValue.trim() !== '') {
                        let trimmedValue = processedValue.trim();

                        // ✅ Unwrap JSON-quoted strings (common for dates when JSON.stringify(Date) happened previously)
                        if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
                            (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
                            try {
                                const parsed = JSON.parse(trimmedValue);
                                if (typeof parsed === 'string') {
                                    trimmedValue = parsed.trim();
                                } else {
                                    trimmedValue = trimmedValue.substring(1, trimmedValue.length - 1).trim();
                                }
                            } catch (eQ) {
                                trimmedValue = trimmedValue.substring(1, trimmedValue.length - 1).trim();
                            }
                        }
                        
                        // محاولة تحليل JSON إذا كانت القيمة تبدو كـ JSON
                        if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
                            try {
                                processedValue = JSON.parse(trimmedValue);
                            } catch (e) {
                                // إذا فشل التحليل، نترك القيمة كما هي
                                processedValue = trimmedValue;
                            }
                        } else {
                            processedValue = trimmedValue;
                        }
                    }
                    // الأنواع المنطقية (boolean) تُحفظ كما هي بدون تحويل إلى نص
                    else if (typeof processedValue === 'boolean') {
                        // keep boolean as-is (false stays false, true stays true)
                    }
                    // أي نوع آخر، نحوله إلى String
                    else if (typeof processedValue !== 'string') {
                        processedValue = String(processedValue);
                    }
                    
                    obj[cleanHeader] = processedValue;
                }
            });
            
            // التحقق من أن الكائن يحتوي على بيانات فعلية (ليس فارغاً تماماً)
            const hasData = Object.keys(obj).some(key => {
                const val = obj[key];
                return val !== '' && val !== null && val !== undefined;
            });
            
            // إذا كان الكائن فارغاً تماماً، نرجعه مع id فارغ على الأقل
            if (!hasData && Object.keys(obj).length === 0) {
                obj.id = '';
            }
            
            // ✅ تطبيع حقل النوع (gender) لورقة Employees عند القراءة
            if (sheetName === 'Employees' && obj.gender !== undefined) {
                obj.gender = normalizeGenderValue(obj.gender);
            }

            // ✅ تطبيع حقل isActive: يُحوَّل دائماً إلى 'active' أو 'inactive'
            if (obj.isActive !== undefined) {
                const v = obj.isActive;
                if (v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1' || v === 'active') {
                    obj.isActive = 'active';
                } else if (v === false || v === 'false' || v === 'FALSE' || v === 0 || v === '0' || v === 'inactive') {
                    obj.isActive = 'inactive';
                } else if (v === '' || v === null || v === undefined) {
                    obj.isActive = 'active'; // القيمة الافتراضية للسجلات القديمة
                }
                // إذا كانت القيمة بالفعل 'active' أو 'inactive' فلا تغيير
            }
            
            return obj;
        }).filter(obj => {
            // تصفية الكائنات الفارغة تماماً (لكن نبقى على الكائنات التي تحتوي على id فقط)
            const keys = Object.keys(obj);
            if (keys.length === 0) return false;
            if (keys.length === 1 && keys[0] === 'id' && !obj.id) return false;
            return true;
        });
        
        // ✅ إصلاح: إزالة التكرار بناءً على id (الاحتفاظ بأحدث سجل في حالة التكرار)
        const uniqueObjects = [];
        const seenIds = new Map(); // Map<id, index> للاحتفاظ بآخر موضع لكل id
        
        allObjects.forEach((obj, index) => {
            if (!obj || !obj.id) {
                // إذا لم يكن هناك id، نضيفه كما هو (قد يكون سجل جديد بدون id بعد)
                uniqueObjects.push(obj);
                return;
            }
            
            const recordId = String(obj.id).trim();
            if (recordId === '') {
                // إذا كان id فارغاً، نضيفه كما هو
                uniqueObjects.push(obj);
                return;
            }
            
            if (seenIds.has(recordId)) {
                // ✅ تكرار موجود - نستبدل السجل القديم بالسجل الجديد (الأحدث)
                const oldIndex = seenIds.get(recordId);
                uniqueObjects[oldIndex] = obj; // استبدال السجل القديم
                Logger.log('⚠️ Duplicate record found in readFromSheet: id=' + recordId + ', sheetName=' + sheetName + ', keeping latest record');
            } else {
                // ✅ سجل جديد - نضيفه
                seenIds.set(recordId, uniqueObjects.length);
                uniqueObjects.push(obj);
            }
        });
        
        if (allObjects.length !== uniqueObjects.length) {
            Logger.log('⚠️ Removed ' + (allObjects.length - uniqueObjects.length) + ' duplicate records from ' + sheetName);
        }

        // ✅ CacheService: Save to cache before returning (2 minutes TTL)
        // Only cache sheets with reasonable size (< 500KB)
        try {
            const dataSize = JSON.stringify(uniqueObjects).length;
            if (dataSize < 500000) { // 500KB limit for individual sheet cache
                cache.put(cacheKey, JSON.stringify(uniqueObjects), 120); // 2 minutes
                Logger.log('Cached readFromSheet: ' + sheetName + ' (' + dataSize + ' bytes, ' + uniqueObjects.length + ' records)');
            } else {
                Logger.log('Sheet ' + sheetName + ' too large for caching (' + dataSize + ' bytes)');
            }
        } catch (cacheError) {
            Logger.log('Cache write failed for ' + sheetName + ': ' + cacheError.toString());
        }

        return uniqueObjects;
    } catch (error) {
        Logger.log('Error reading from sheet: ' + error.toString());
        return [];
    }
}

/**
 * حذف صف من ورقة بالـ id (بدون إعادة كتابة الشيت بالكامل)
 */
function deleteRowById(sheetName, recordId, spreadsheetId = null) {
    try {
        const finalSpreadsheetId = spreadsheetId || getSpreadsheetId();
        if (!finalSpreadsheetId || !sheetName || !recordId) {
            return { success: false, message: 'بيانات غير كاملة لحذف الصف' };
        }

        const ss = SpreadsheetApp.openById(finalSpreadsheetId);
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return { success: false, message: 'الورقة غير موجودة: ' + sheetName };

        const lastCol = sheet.getLastColumn();
        if (lastCol <= 0) return { success: false, message: 'لا توجد أعمدة في الورقة' };

        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
        const idCol = headers.indexOf('id');
        if (idCol < 0) return { success: false, message: 'عمود id غير موجود في الورقة' };

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return { success: false, message: 'لا توجد بيانات للحذف' };

        const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        const target = String(recordId).trim();
        let targetRow = -1;
        for (let i = 0; i < data.length; i++) {
            const rowId = data[i][idCol];
            if (rowId && String(rowId).trim() === target) {
                targetRow = i + 2; // header is row 1
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, message: 'السجل غير موجود للحذف' };
        }

        sheet.deleteRow(targetRow);
        SpreadsheetApp.flush();
        
        // ✅ مسح الcache بعد الحذف لضمان قراءة البيانات المحدثة
        const cache = CacheService.getScriptCache();
        const cacheKey = 'hse_read_' + sheetName + '_v1';
        cache.remove(cacheKey);
        
        return { success: true, message: 'تم حذف السجل بنجاح', rowNumber: targetRow };
    } catch (e) {
        Logger.log('Error in deleteRowById: ' + e.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف السجل: ' + e.toString() };
    }
}

/**
 * حذف صف من ورقة حسب عمود محدد (مثل id / email / code ...)
 */
function deleteRowByField(sheetName, fieldName, fieldValue, spreadsheetId = null) {
    try {
        const finalSpreadsheetId = spreadsheetId || getSpreadsheetId();
        if (!finalSpreadsheetId || !sheetName || !fieldName) {
            return { success: false, message: 'بيانات غير كاملة لحذف الصف' };
        }
        const targetVal = (fieldValue === null || fieldValue === undefined) ? '' : String(fieldValue).trim();
        if (!targetVal) {
            return { success: false, message: 'قيمة البحث للحذف غير موجودة' };
        }

        const ss = SpreadsheetApp.openById(finalSpreadsheetId);
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) return { success: false, message: 'الورقة غير موجودة: ' + sheetName };

        const lastCol = sheet.getLastColumn();
        if (lastCol <= 0) return { success: false, message: 'لا توجد أعمدة في الورقة' };

        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => (h === null || h === undefined) ? '' : String(h).trim());
        const colIndex = headers.indexOf(String(fieldName).trim());
        if (colIndex < 0) return { success: false, message: 'العمود غير موجود: ' + fieldName };

        const lastRow = sheet.getLastRow();
        if (lastRow <= 1) return { success: false, message: 'لا توجد بيانات للحذف' };

        const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        let targetRow = -1;
        for (let i = 0; i < data.length; i++) {
            const cellVal = data[i][colIndex];
            if (cellVal !== null && cellVal !== undefined && String(cellVal).trim() === targetVal) {
                targetRow = i + 2;
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, message: 'السجل غير موجود للحذف' };
        }

        sheet.deleteRow(targetRow);
        SpreadsheetApp.flush();
        
        // ✅ مسح الcache بعد الحذف لضمان قراءة البيانات المحدثة
        const cache = CacheService.getScriptCache();
        const cacheKey = 'hse_read_' + sheetName + '_v1';
        cache.remove(cacheKey);
        
        return { success: true, message: 'تم حذف السجل بنجاح', rowNumber: targetRow };
    } catch (e) {
        Logger.log('Error in deleteRowByField: ' + e.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف السجل: ' + e.toString() };
    }
}

/**
 * إنشاء جميع الأوراق المطلوبة تلقائياً
 */
function initializeSheets(spreadsheetId = null) {
    try {
        // استخدام getSpreadsheetId() للحصول على القيمة الصحيحة
        const finalSpreadsheetId = spreadsheetId || getSpreadsheetId();
        
        if (!finalSpreadsheetId || (typeof finalSpreadsheetId === 'string' && finalSpreadsheetId.trim() === '')) {
            return { success: false, message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات.' };
        }
        
        let spreadsheet;
        try {
            spreadsheet = SpreadsheetApp.openById(finalSpreadsheetId);
        } catch (error) {
            return { success: false, message: 'فشل فتح الجدول. يرجى التحقق من معرف الجدول: ' + error.toString() };
        }
        
        let createdSheets = [];
        let existingSheets = [];
        let errorSheets = [];
        
        const requiredSheets = getRequiredSheets();
        requiredSheets.forEach(sheetName => {
            try {
                let sheet = spreadsheet.getSheetByName(sheetName);
                if (!sheet) {
                    // إنشاء الورقة مع الرؤوس الافتراضية
                    sheet = createSheetWithHeaders(spreadsheet, sheetName);
                    createdSheets.push(sheetName);
                } else {
                    // إذا كانت الورقة موجودة، نتأكد من وجود الرؤوس
                    try {
                        const lastColumn = sheet.getLastColumn();
                        let existingHeaders = [];
                        if (lastColumn > 0) {
                            const headerRange = sheet.getRange(1, 1, 1, lastColumn);
                            existingHeaders = headerRange.getValues()[0];
                        }
                        
                        if (existingHeaders.length === 0 || existingHeaders[0] === '' || !existingHeaders[0]) {
                            // إضافة الرؤوس الافتراضية إذا لم تكن موجودة
                            const headers = getDefaultHeaders(sheetName);
                            if (headers && headers.length > 0) {
                                sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
                                const headerRange = sheet.getRange(1, 1, 1, headers.length);
                                headerRange.setFontWeight('bold');
                                headerRange.setBackground('#f0f0f0');
                                headerRange.setFontSize(11);
                            }
                            createdSheets.push(sheetName + ' (تم إضافة الرؤوس)');
                        } else {
                            existingSheets.push(sheetName);
                        }
                    } catch (error) {
                        Logger.log('Error checking headers for ' + sheetName + ': ' + error.toString());
                        errorSheets.push(sheetName + ' (خطأ: ' + error.toString() + ')');
                    }
                }
            } catch (error) {
                Logger.log('Error initializing sheet ' + sheetName + ': ' + error.toString());
                errorSheets.push(sheetName + ' (خطأ: ' + error.toString() + ')');
            }
        });
        
        let message = 'تم إنشاء جميع الأوراق بنجاح';
        if (createdSheets.length > 0) {
            message += '\n\nالأوراق المنشأة: ' + createdSheets.join(', ');
        }
        if (existingSheets.length > 0) {
            message += '\n\nالأوراق الموجودة: ' + existingSheets.join(', ');
        }
        if (errorSheets.length > 0) {
            message += '\n\nالأوراق التي حدث بها خطأ: ' + errorSheets.join(', ');
        }
        
        // بعد التهيئة، نتأكد من إصلاح رؤوس الأوراق
        try {
            fixUsersSheetHeaders(finalSpreadsheetId);
        } catch (fixError) {
            Logger.log('Warning: Could not fix Users sheet headers: ' + fixError.toString());
        }
        
        // إصلاح رؤوس الأوراق المفقودة
        try {
            fixMissingSheetHeaders(finalSpreadsheetId);
        } catch (fixError) {
            Logger.log('Warning: Could not fix missing sheet headers: ' + fixError.toString());
        }
        
        return { 
            success: true, 
            message: message, 
            created: createdSheets, 
            existing: existingSheets,
            errors: errorSheets 
        };
    } catch (error) {
        Logger.log('Error in initializeSheets: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تهيئة الأوراق: ' + error.toString() };
    }
}

/**
 * إصلاح رؤوس الأوراق المفقودة (UserTasks, UserInstructions, ModuleManagement, Notifications)
 */
function fixMissingSheetHeaders(spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId || (typeof spreadsheetId === 'string' && spreadsheetId.trim() === '')) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheetsToFix = ['UserTasks', 'UserInstructions', 'ModuleManagement', 'Notifications'];
        const fixedSheets = [];
        const errors = [];
        
        sheetsToFix.forEach(sheetName => {
            try {
                let sheet = spreadsheet.getSheetByName(sheetName);
                
                if (!sheet) {
                    // إنشاء الورقة إذا لم تكن موجودة
                    sheet = spreadsheet.insertSheet(sheetName);
                    Logger.log('Created sheet: ' + sheetName);
                }
                
                // الحصول على الرؤوس الافتراضية
                const defaultHeaders = getDefaultHeaders(sheetName);
                if (!defaultHeaders || defaultHeaders.length === 0) {
                    Logger.log('No default headers for: ' + sheetName);
                    return;
                }
                
                // قراءة الرؤوس الحالية
                const lastColumn = sheet.getLastColumn();
                let existingHeaders = [];
                if (lastColumn > 0) {
                    const headerRange = sheet.getRange(1, 1, 1, lastColumn);
                    existingHeaders = headerRange.getValues()[0];
                }
                
                // التحقق من وجود الرؤوس
                if (existingHeaders.length === 0 || existingHeaders[0] === '' || !existingHeaders[0]) {
                    // إضافة الرؤوس الافتراضية
                    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
                    
                    // تنسيق الرؤوس
                    const headerRange = sheet.getRange(1, 1, 1, defaultHeaders.length);
                    headerRange.setFontWeight('bold');
                    headerRange.setBackground('#f0f0f0');
                    headerRange.setFontSize(11);
                    
                    fixedSheets.push(sheetName);
                    Logger.log('Fixed headers for: ' + sheetName);
                } else {
                    // التحقق من أن جميع الرؤوس الافتراضية موجودة
                    let needsUpdate = false;
                    const missingHeaders = [];
                    
                    defaultHeaders.forEach(header => {
                        if (!existingHeaders.includes(header)) {
                            missingHeaders.push(header);
                            needsUpdate = true;
                        }
                    });
                    
                    if (needsUpdate) {
                        // إضافة الرؤوس المفقودة
                        const newHeaders = [...existingHeaders];
                        missingHeaders.forEach(header => {
                            // إضافة الرأس في الموضع المناسب
                            const defaultIndex = defaultHeaders.indexOf(header);
                            if (defaultIndex > 0) {
                                const prevHeader = defaultHeaders[defaultIndex - 1];
                                const prevIndex = newHeaders.indexOf(prevHeader);
                                if (prevIndex >= 0) {
                                    newHeaders.splice(prevIndex + 1, 0, header);
                                } else {
                                    newHeaders.push(header);
                                }
                            } else {
                                newHeaders.unshift(header);
                            }
                        });
                        
                        // تحديث الرؤوس
                        sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
                        
                        // تنسيق الرؤوس
                        const headerRange = sheet.getRange(1, 1, 1, newHeaders.length);
                        headerRange.setFontWeight('bold');
                        headerRange.setBackground('#f0f0f0');
                        headerRange.setFontSize(11);
                        
                        fixedSheets.push(sheetName + ' (تم إضافة رؤوس مفقودة)');
                        Logger.log('Added missing headers for: ' + sheetName);
                    } else {
                        Logger.log('Headers already correct for: ' + sheetName);
                    }
                }
            } catch (error) {
                Logger.log('Error fixing headers for ' + sheetName + ': ' + error.toString());
                errors.push(sheetName + ' (خطأ: ' + error.toString() + ')');
            }
        });
        
        let message = 'تم إصلاح رؤوس الأوراق بنجاح';
        if (fixedSheets.length > 0) {
            message += '\n\nالأوراق التي تم إصلاحها: ' + fixedSheets.join(', ');
        }
        if (errors.length > 0) {
            message += '\n\nالأوراق التي حدث بها خطأ: ' + errors.join(', ');
        }
        
        return { 
            success: true, 
            message: message,
            fixed: fixedSheets,
            errors: errors
        };
    } catch (error) {
        Logger.log('Error in fixMissingSheetHeaders: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إصلاح الرؤوس: ' + error.toString() };
    }
}

/**
 * إصلاح رأس ورقة Users لإضافة password و passwordHash إذا لم يكونا موجودين
 */
function fixUsersSheetHeaders(spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId || (typeof spreadsheetId === 'string' && spreadsheetId.trim() === '')) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName('Users');
        
        if (!sheet) {
            return { success: false, message: 'ورقة Users غير موجودة' };
        }
        
        // قراءة الرؤوس الحالية
        const lastColumn = sheet.getLastColumn();
        let existingHeaders = [];
        if (lastColumn > 0) {
            const headerRange = sheet.getRange(1, 1, 1, lastColumn);
            existingHeaders = headerRange.getValues()[0];
        }
        
        let headersUpdated = false;
        const emailIndex = existingHeaders.indexOf('email');
        
        // التحقق من وجود password
        if (!existingHeaders.includes('password')) {
            if (emailIndex >= 0) {
                existingHeaders.splice(emailIndex + 1, 0, 'password');
            } else {
                const nameIndex = existingHeaders.indexOf('name');
                if (nameIndex >= 0) {
                    existingHeaders.splice(nameIndex + 1, 0, 'password');
                } else {
                    existingHeaders.splice(1, 0, 'password');
                }
            }
            headersUpdated = true;
        }
        
        // التحقق من وجود passwordHash
        if (!existingHeaders.includes('passwordHash')) {
            const passwordIndex = existingHeaders.indexOf('password');
            if (passwordIndex >= 0) {
                existingHeaders.splice(passwordIndex + 1, 0, 'passwordHash');
            } else if (emailIndex >= 0) {
                existingHeaders.splice(emailIndex + 2, 0, 'passwordHash');
            } else {
                const nameIndex = existingHeaders.indexOf('name');
                if (nameIndex >= 0) {
                    existingHeaders.splice(nameIndex + 2, 0, 'passwordHash');
                } else {
                    existingHeaders.splice(2, 0, 'passwordHash');
                }
            }
            headersUpdated = true;
        }
        
        if (headersUpdated) {
            // تحديث الرؤوس
            sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
            
            // تنسيق الرؤوس
            const headerRange = sheet.getRange(1, 1, 1, existingHeaders.length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#f0f0f0');
            headerRange.setFontSize(11);
            
            Logger.log('Fixed Users sheet headers: Added password and passwordHash columns');
            return { success: true, message: 'تم إصلاح رأس ورقة Users بنجاح - تم إضافة أعمدة password و passwordHash' };
        }
        
        return { success: true, message: 'رأس ورقة Users صحيح بالفعل - password و passwordHash موجودان' };
    } catch (error) {
        Logger.log('Error fixing Users sheet headers: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إصلاح رأس ورقة Users: ' + error.toString() };
    }
}

/**
 * أكبر رقم تسلسلي موحّد من ورقة PTWRegistry: id (REG)، permitId (PTW)، sequentialNumber.
 * يمنع اختلاف الرقم التالي بين عمود id و permitId عند التوليد السابق المنفصل.
 */
function getMaxUnifiedPTWRegistryNumeric_(existingData) {
    var maxN = 0;
    if (!existingData || !Array.isArray(existingData)) return maxN;
    var regRe = /^REG_(\d+)$/i;
    var ptwRe = /^PTW_(\d+)$/i;
    for (var i = 0; i < existingData.length; i++) {
        var record = existingData[i];
        if (!record) continue;
        var idStr = record.id != null ? String(record.id).trim() : '';
        var pidStr = record.permitId != null ? String(record.permitId).trim() : '';
        var m;
        var n;
        if (idStr && (m = idStr.match(regRe))) {
            n = parseInt(m[1], 10);
            if (!isNaN(n) && n > maxN) maxN = n;
        }
        if (pidStr && (m = pidStr.match(ptwRe))) {
            n = parseInt(m[1], 10);
            if (!isNaN(n) && n > maxN) maxN = n;
        }
        if (record.sequentialNumber != null && record.sequentialNumber !== '') {
            n = parseInt(String(record.sequentialNumber).trim(), 10);
            if (!isNaN(n) && n > maxN) maxN = n;
        }
    }
    return maxN;
}

/** استخراج الرقم من معرف بتنسيق PREFIX_123 */
function extractNumericFromPrefixedId_(value, prefix) {
    var pfx = String(prefix || '').toUpperCase();
    var str = String(value || '').trim();
    var m = str.match(new RegExp('^' + pfx + '_(\\d+)$', 'i'));
    if (!m) return null;
    var n = parseInt(m[1], 10);
    return (isNaN(n) || n < 1) ? null : n;
}

/**
 * ============================================
 * نظام توليد المعرفات الموحد
 * ============================================
 * 
 * توليد معرفات بتنسيق [PREFIX]_[NUMBER] مثل PTW_01, INC_01, إلخ
 * 
 * @param {string} prefix - البادئة (3 أحرف) مثل PTW, INC, NRM
 * @param {string} sheetName - اسم الورقة في Google Sheets
 * @param {string} spreadsheetId - معرف الجدول (اختياري، يستخدم الافتراضي إذا لم يُحدد)
 * @param {string} idField - الحقل الذي يحتوي المعرف (id أو permitId)
 * @returns {string} معرف جديد بالتنسيق PREFIX_NUMBER
 */
function generateSequentialId(prefix, sheetName, spreadsheetId, idField) {
    try {
        if (!prefix || prefix.length !== 3) {
            Logger.log('Invalid prefix: ' + prefix + ' - must be exactly 3 characters');
            // Fallback to UUID if prefix is invalid
            return Utilities.getUuid();
        }
        
        if (!sheetName) {
            Logger.log('Sheet name is required for generateSequentialId');
            return Utilities.getUuid();
        }
        
        // تحويل البادئة إلى أحرف كبيرة
        prefix = prefix.toUpperCase();
        var idKey = (idField && typeof idField === 'string') ? idField : 'id';
        
        // استخدام معرف الجدول المحدد أو الافتراضي
        var targetSpreadsheetId = spreadsheetId || getSpreadsheetId();
        if (!targetSpreadsheetId) {
            Logger.log('Spreadsheet ID not available');
            return Utilities.getUuid();
        }
        
        // قراءة البيانات الموجودة من الورقة
        var existingData = [];
        try {
            existingData = readFromSheet(sheetName, targetSpreadsheetId);
        } catch (readError) {
            Logger.log('Error reading sheet ' + sheetName + ': ' + readError.toString());
            // إذا فشلت القراءة، نبدأ من 1
            existingData = [];
        }
        
        // استخراج جميع الأرقام الموجودة بتنسيق PREFIX_NUMBER
        var existingNumbers = [];
        if (existingData && Array.isArray(existingData)) {
            if (sheetName === 'PTWRegistry') {
                var unifiedMax = getMaxUnifiedPTWRegistryNumeric_(existingData);
                if (unifiedMax > 0) {
                    existingNumbers.push(unifiedMax);
                }
            } else {
                for (var i = 0; i < existingData.length; i++) {
                    var record = existingData[i];
                    if (record && record[idKey]) {
                        var id = record[idKey].toString();
                        // التحقق من التنسيق: PREFIX_NUMBER (مثل PTW_01, PTW_100, إلخ)
                        var match = id.match(new RegExp('^' + prefix + '_(\\d+)$'));
                        if (match) {
                            // استخراج الرقم
                            var numberPart = match[1];
                            var number = parseInt(numberPart, 10);
                            if (!isNaN(number) && number > 0) {
                                existingNumbers.push(number);
                            }
                        }
                    }
                }
            }
        }
        
        // حساب الرقم التالي
        var nextNumber = 1;
        if (existingNumbers.length > 0) {
            nextNumber = Math.max.apply(null, existingNumbers) + 1;
        }
        
        // التأكد من عدم تجاوز الحد الأقصى (1000000)
        if (nextNumber > 1000000) {
            Logger.log('Warning: Sequential number exceeded maximum (1000000), using UUID fallback');
            return Utilities.getUuid();
        }
        
        // إرجاع المعرف الجديد بصيغة موحدة: PREFIX_0001
        return prefix + '_' + nextNumber.toString().padStart(4, '0');
        
    } catch (error) {
        Logger.log('Error in generateSequentialId: ' + error.toString());
        // في حالة الخطأ، نستخدم UUID كبديل
        return Utilities.getUuid();
    }
}

/**
 * اقتصار صف PTW على رؤوس PTW الافتراضية وتبسيط القيم لصيغة آمنة للورقة.
 */
function normalizePTWRowForSheet_(processed) {
    if (!processed || typeof processed !== 'object') return processed;
    var allowed = getDefaultHeaders('PTW');
    if (!allowed || !allowed.length) return processed;
    var out = {};
    for (var i = 0; i < allowed.length; i++) {
        var h = allowed[i];
        if (!processed.hasOwnProperty(h)) continue;
        var v = processed[h];
        if (v === undefined) continue;
        if (v === null) {
            out[h] = v;
            continue;
        }
        if (typeof v === 'object') {
            if (Object.prototype.toString.call(v) === '[object Date]') {
                out[h] = v;
            } else if (Array.isArray(v)) {
                out[h] = v.map(function(x) {
                    if (x === null || x === undefined) return '';
                    if (typeof x === 'object') {
                        return normalizeTextValue(x.name || x.label || x.title || String(x));
                    }
                    return normalizeTextValue(String(x));
                }).filter(Boolean).join('، ');
            } else {
                out[h] = normalizeTextValue(v.name || v.label || v.title || String(v));
            }
        } else {
            out[h] = v;
        }
    }
    return out;
}

/**
 * إرفاق السجل المُعرَّف بعد الكتابة لورقة PTWRegistry في ردّ append/save (للواجهة).
 */
function withResolvedPTWRegistry_(sheetName, result, resolved) {
    if (result && result.success === true && sheetName === 'PTWRegistry' && resolved && typeof resolved === 'object') {
        result.resolvedPTWRegistry = resolved;
    }
    return result;
}

/**
 * Resolve PTWRegistry id/permitId using hybrid mapping (old -> new).
 * Keeps legacy compatibility while forcing new writes to sequential IDs.
 */
function resolvePTWRegistryIdsForWrite_(record, spreadsheetId) {
    if (!record || typeof record !== 'object') return record;

    var resolved = {};
    for (var key in record) {
        if (record.hasOwnProperty(key)) resolved[key] = record[key];
    }

    resolved.id = resolveHybridId_(resolved.id, 'REG', 'PTWRegistry', 'id', spreadsheetId, true);
    var regNum = extractNumericFromPrefixedId_(resolved.id, 'REG');
    if (regNum !== null) {
        resolved.permitId = 'PTW_' + String(regNum).padStart(4, '0');
        resolved.sequentialNumber = regNum;
    } else {
        resolved.permitId = resolveHybridId_(resolved.permitId, 'PTW', 'PTWRegistry', 'permitId', spreadsheetId, true);
        var ptwNum = extractNumericFromPrefixedId_(resolved.permitId, 'PTW');
        if (ptwNum !== null) {
            resolved.sequentialNumber = ptwNum;
        }
    }
    return resolved;
}

/**
 * منع تكرار رقم التصريح الورقي في PTWRegistry.
 * إذا وُجد سجل بنفس paperPermitNumber نعيد استخدام id/permitId/sequentialNumber الخاصة به.
 */
function resolvePTWRegistryByPaperPermitNumber_(record, spreadsheetId) {
    if (!record || typeof record !== 'object') return record;
    var paper = String(record.paperPermitNumber || '').trim();
    if (!paper) return record;

    try {
        var targetSpreadsheetId = spreadsheetId || getSpreadsheetId();
        var existingData = readFromSheet('PTWRegistry', targetSpreadsheetId);
        if (!Array.isArray(existingData) || existingData.length === 0) return record;

        for (var i = 0; i < existingData.length; i++) {
            var row = existingData[i];
            if (!row) continue;
            if (String(row.paperPermitNumber || '').trim() !== paper) continue;

            var existingId = String(row.id || '').trim();
            var existingPermitId = String(row.permitId || '').trim();
            if (existingId) record.id = existingId;
            if (existingPermitId) record.permitId = existingPermitId;

            var n = parseInt(String(row.sequentialNumber || '').trim(), 10);
            if (!isNaN(n) && n > 0) {
                record.sequentialNumber = n;
            } else {
                var fromReg = extractNumericFromPrefixedId_(existingId, 'REG');
                var fromPtw = extractNumericFromPrefixedId_(existingPermitId, 'PTW');
                var fallbackN = fromReg || fromPtw;
                if (fallbackN) record.sequentialNumber = fallbackN;
            }
            return record;
        }
    } catch (e) {
        Logger.log('resolvePTWRegistryByPaperPermitNumber_ failed: ' + e.toString());
    }
    return record;
}

function resolveHybridId_(rawValue, prefix, sheetName, idField, spreadsheetId, mapUnknownFormats) {
    var value = (rawValue === null || rawValue === undefined) ? '' : String(rawValue).trim();
    var normalizedPrefix = String(prefix || '').toUpperCase();

    if (value && isSequentialIdForPrefix_(value, normalizedPrefix)) {
        return normalizeSequentialId_(value, normalizedPrefix);
    }

    if (value && isLegacyTimestampIdForPrefix_(value, normalizedPrefix)) {
        var mappedId = findMappedId_(sheetName, idField, normalizedPrefix, value, spreadsheetId);
        if (mappedId) return mappedId;
        var generatedFromLegacy = generateSequentialId(normalizedPrefix, sheetName, spreadsheetId, idField);
        upsertIdMapping_(sheetName, idField, normalizedPrefix, value, generatedFromLegacy, spreadsheetId);
        return generatedFromLegacy;
    }

    if (value && !isSequentialIdForPrefix_(value, normalizedPrefix)) {
        if (mapUnknownFormats !== true) {
            return value;
        }
        // Unknown format: preserve compatibility by mapping it once.
        var mappedUnknown = findMappedId_(sheetName, idField, normalizedPrefix, value, spreadsheetId);
        if (mappedUnknown) return mappedUnknown;
        var generatedFromUnknown = generateSequentialId(normalizedPrefix, sheetName, spreadsheetId, idField);
        upsertIdMapping_(sheetName, idField, normalizedPrefix, value, generatedFromUnknown, spreadsheetId);
        return generatedFromUnknown;
    }

    return generateSequentialId(normalizedPrefix, sheetName, spreadsheetId, idField);
}

function isSequentialIdForPrefix_(value, prefix) {
    var str = String(value || '').trim();
    var pfx = String(prefix || '').toUpperCase();
    return new RegExp('^' + pfx + '_\\d+$').test(str);
}

function isLegacyTimestampIdForPrefix_(value, prefix) {
    var str = String(value || '').trim();
    var pfx = String(prefix || '').toUpperCase();
    return new RegExp('^' + pfx + '_\\d{10,}_[a-z0-9]+$', 'i').test(str);
}

function normalizeSequentialId_(value, prefix) {
    var str = String(value || '').trim();
    var pfx = String(prefix || '').toUpperCase();
    var match = str.match(new RegExp('^' + pfx + '_(\\d+)$'));
    if (!match) return str;
    var n = parseInt(match[1], 10);
    if (isNaN(n) || n <= 0) return str;
    return pfx + '_' + String(n).padStart(4, '0');
}

function getIdMappingEntityType_(sheetName, idField, prefix) {
    return String(sheetName || '').trim() + ':' + String(idField || '').trim() + ':' + String(prefix || '').toUpperCase();
}

function findMappedId_(sheetName, idField, prefix, oldId, spreadsheetId) {
    try {
        var targetSpreadsheetId = spreadsheetId || getSpreadsheetId();
        var mapData = readFromSheet('PTWIdMapping', targetSpreadsheetId);
        if (!Array.isArray(mapData) || mapData.length === 0) return '';

        var expectedEntity = getIdMappingEntityType_(sheetName, idField, prefix);
        var oldValue = String(oldId || '').trim();

        for (var i = 0; i < mapData.length; i++) {
            var row = mapData[i];
            if (!row) continue;
            var rowEntity = String(row.entityType || '').trim();
            var rowOld = String(row.oldId || '').trim();
            var rowNew = String(row.newId || '').trim();
            if (rowEntity === expectedEntity && rowOld === oldValue && rowNew) {
                return rowNew;
            }
        }
        return '';
    } catch (e) {
        return '';
    }
}

function upsertIdMapping_(sheetName, idField, prefix, oldId, newId, spreadsheetId) {
    try {
        if (!oldId || !newId) return;
        var targetSpreadsheetId = spreadsheetId || getSpreadsheetId();
        var nowIso = new Date().toISOString();
        var entityType = getIdMappingEntityType_(sheetName, idField, prefix);
        var oldValue = String(oldId).trim();
        var newValue = String(newId).trim();

        // Make sure the map sheet exists with headers
        createSheetWithHeaders(SpreadsheetApp.openById(targetSpreadsheetId), 'PTWIdMapping', [{}]);
        ensureSheetHeaders(SpreadsheetApp.openById(targetSpreadsheetId).getSheetByName('PTWIdMapping'), 'PTWIdMapping', [{}]);

        var existing = readFromSheet('PTWIdMapping', targetSpreadsheetId);
        var recordId = '';
        if (Array.isArray(existing)) {
            for (var i = 0; i < existing.length; i++) {
                var row = existing[i];
                if (!row) continue;
                if (String(row.entityType || '').trim() === entityType && String(row.oldId || '').trim() === oldValue) {
                    recordId = row.id ? String(row.id).trim() : '';
                    break;
                }
            }
        }

        var payload = {
            id: recordId || Utilities.getUuid(),
            entityType: entityType,
            oldId: oldValue,
            newId: newValue,
            createdAt: recordId ? undefined : nowIso,
            updatedAt: nowIso
        };
        saveToSheet('PTWIdMapping', payload, targetSpreadsheetId);
    } catch (e) {
        Logger.log('Failed to upsert PTW ID mapping: ' + e.toString());
    }
}

/**
 * توليد معرف ملاحظة يومية بالتنسيق DOB-NNNN.
 * يأخذ أكبر رقم مستخدم من أي id (DOB_N أو OBS-YYYYMM-NNNN أو أي ذيل رقمي) لتفادي التكرار.
 * التسلسل مستمر ولا يعاد تعيينه كل شهر.
 * @param {string} sheetName - اسم الورقة (مثل DailyObservations)
 * @param {string} spreadsheetId - معرف الجدول (اختياري)
 * @returns {string} معرف جديد مثل DOB-2999
 */
function generateDailyObservationId(sheetName, spreadsheetId) {
    try {
        var targetSpreadsheetId = spreadsheetId || getSpreadsheetId();
        if (!targetSpreadsheetId || !sheetName) return Utilities.getUuid();
        var existingData = [];
        try {
            existingData = readFromSheet(sheetName, targetSpreadsheetId);
        } catch (e) {
            existingData = [];
        }
        var patternDob = /^DOB-(\d+)$/i;
        var patternObs = /^OBS-\d{6}-(\d+)$/i;
        var patternTrailingNum = /(\d+)$/;
        var maxNum = 0;
        
        for (var i = 0; i < (existingData || []).length; i++) {
            var rec = existingData[i];
            if (!rec || !rec.id) continue;
            var id = String(rec.id).trim();
            var num = 0;
            
            // التحقق من DOB-NNNN أولاً
            var mDob = id.match(patternDob);
            if (mDob) {
                num = parseInt(mDob[1], 10);
            } else {
                // التحقق من OBS-YYYYMM-NNNN
                var mObs = id.match(patternObs);
                if (mObs) {
                    num = parseInt(mObs[1], 10);
                } else {
                    // أي رقم في النهاية
                    var mTrail = id.match(patternTrailingNum);
                    if (mTrail) num = parseInt(mTrail[1], 10);
                }
            }
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
        var nextNum = maxNum + 1;
        var numStr = nextNum.toString();
        while (numStr.length < 4) numStr = '0' + numStr;
        return 'DOB-' + numStr;
    } catch (err) {
        Logger.log('generateDailyObservationId: ' + err.toString());
        return Utilities.getUuid();
    }
}

/**
 * استخراج رقم الملاحظة (isoCode) للتسجيل في جدول قاعدة البيانات.
 * القيمة المسجلة في عمود isoCode = OBS-YYYYMM- + آخر 4 أرقام من id (DOB-NNNN).
 * مثال: id = DOB-2988 → isoCode = OBS-202602-2988
 * @param {string} id - معرف الملاحظة (مثل DOB-NNNN)
 * @returns {string} رقم الملاحظة OBS-YYYYMM-NNNN للتسجيل في الخلية
 */
function getObservationIsoCodeFromId(id) {
    if (!id || typeof id !== 'string') {
        var now = new Date();
        var yyyy = now.getFullYear();
        var mm = String(now.getMonth() + 1);
        if (mm.length === 1) mm = '0' + mm;
        return 'OBS-' + yyyy + mm + '-0000';
    }
    var str = id.toString().trim();
    
    // لـ DOB-NNNN نحوله إلى OBS-YYYYMM-NNNN
    var dobMatch = str.match(/^DOB-(\d+)$/i);
    if (dobMatch) {
        var now = new Date();
        var yyyy = now.getFullYear();
        var mm = String(now.getMonth() + 1);
        if (mm.length === 1) mm = '0' + mm;
        var num = dobMatch[1];
        return 'OBS-' + yyyy + mm + '-' + num;
    }
    
    // إذا كان OBS-YYYYMM-NNNN بالفعل
    var obsMatch = str.match(/^OBS-\d{6}-(\d+)$/i);
    if (obsMatch) {
        return str;
    }
    
    // أي رقم في النهاية
    var matchAny = str.match(/(\d+)$/);
    if (matchAny) {
        var now = new Date();
        var yyyy = now.getFullYear();
        var mm = String(now.getMonth() + 1);
        if (mm.length === 1) mm = '0' + mm;
        return 'OBS-' + yyyy + mm + '-' + matchAny[1];
    }
    
    return 'OBS-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-0000';
}

/**
 * ============================================
 * خريطة البادئات للموديولات
 * ============================================
 */
function getModulePrefix(moduleName) {
    var prefixMap = {
        // الحوادث والسلامة
        'incidents': 'INC',
        'Incidents': 'INC',
        'nearmiss': 'NRM',
        'NearMiss': 'NRM',
        'ptw': 'PTW',
        'PTW': 'PTW',
        'violations': 'VIO',
        'Violations': 'VIO',
        
        // التدريب والموظفين
        'training': 'TRN',
        'Training': 'TRN',
        'employees': 'EMP',
        'Employees': 'EMP',
        
        // المعدات والسلامة
        'fireequipment': 'FEA',
        'FireEquipment': 'FEA',
        'fireequipmentassets': 'EFA',
        'FireEquipmentAssets': 'EFA',
        'fireequipmentinspections': 'FEI',
        'FireEquipmentInspections': 'FEI',
        'ppe': 'PPE',
        'PPE': 'PPE',
        'periodicinspections': 'PIN',
        'PeriodicInspections': 'PIN',
        'periodicinspectioncategories': 'PIC',
        'PeriodicInspectionCategories': 'PIC',
        'periodicinspectionchecklists': 'PIC',
        'PeriodicInspectionChecklists': 'PIC',
        'periodicinspectionschedules': 'PIS',
        'PeriodicInspectionSchedules': 'PIS',
        'periodicinspectionrecords': 'PIR',
        'PeriodicInspectionRecords': 'PIR',
        
        // المقاولين والعيادة
        // ✅ تم إزالة 'contractors' و 'Contractors' - نعتمد فقط على ApprovedContractors
        'approvedcontractors': 'ACN',
        'ApprovedContractors': 'ACN',
        'contractorevaluations': 'CEV',
        'ContractorEvaluations': 'CEV',
        'clinic': 'CLN',
        'ClinicVisits': 'CLV',
        'clinicvisits': 'CLV',
        'medications': 'MED',
        'Medications': 'MED',
        'sickleave': 'SKL',
        'SickLeave': 'SKL',
        'injuries': 'INJ',
        'Injuries': 'INJ',
        'cliniccontractorinjuries': 'CIN',
        'ClinicContractorInjuries': 'CIN',
        'clinicinventory': 'CLI',
        'ClinicInventory': 'CLI',
        
        // ISO و HSE
        'iso': 'ISO',
        'isodocuments': 'ISD',
        'ISODocuments': 'ISD',
        'isoprocedures': 'ISP',
        'ISOProcedures': 'ISP',
        'isoforms': 'ISF',
        'ISOForms': 'ISF',
        'hse': 'HSE',
        'hseaudits': 'HSA',
        'HSEAudits': 'HSA',
        'hsenonconformities': 'HSN',
        'HSENonConformities': 'HSN',
        'hsecorrectiveactions': 'HSC',
        'HSECorrectiveActions': 'HSC',
        'hseobjectives': 'HSO',
        'HSEObjectives': 'HSO',
        'hseriskassessments': 'HSR',
        'HSERiskAssessments': 'HSR',
        
        // تقييم المخاطر والمستندات
        'riskassessments': 'RSA',
        'RiskAssessments': 'RSA',
        'legaldocuments': 'LGD',
        'LegalDocuments': 'LGD',
        'sopjha': 'SOP',
        'SOPJHA': 'SOP',
        
        // المراقبة والملاحظات
        'behaviormonitoring': 'BHM',
        'BehaviorMonitoring': 'BHM',
        'chemicalsafety': 'CHS',
        'ChemicalSafety': 'CHS',
        'dailyobservations': 'DOB',
        'DailyObservations': 'DOB',
        'dailysafetychecklist': 'DSC',
        'DailySafetyCheckList': 'DSC',
        'observationsites': 'OBS',
        'ObservationSites': 'OBS',
        
        // الاستدامة والبيئة
        'sustainability': 'SUS',
        'Sustainability': 'SUS',
        'environmentalaspects': 'ENA',
        'EnvironmentalAspects': 'ENA',
        'environmentalmonitoring': 'ENM',
        'EnvironmentalMonitoring': 'ENM',
        'carbonfootprint': 'CFP',
        'CarbonFootprint': 'CFP',
        'wastemanagement': 'WAM',
        'WasteManagement': 'WAM',
        'energyefficiency': 'ENE',
        'EnergyEfficiency': 'ENE',
        'watermanagement': 'WAM',
        'WaterManagement': 'WAM',
        'recyclingprograms': 'RCP',
        'RecyclingPrograms': 'RCP',
        
        // الطوارئ والميزانية
        'emergency': 'EMG',
        'emergencyalerts': 'EMA',
        'EmergencyAlerts': 'EMA',
        'emergencyplans': 'EMP',
        'EmergencyPlans': 'EMP',
        'emergencyplansupdates': 'EPU',
        'EmergencyPlansUpdates': 'EPU',
        'safetybudget': 'SAB',
        'SafetyBudgets': 'SAB',
        'safetybudgettransactions': 'SBT',
        'SafetyBudgetTransactions': 'SBT',
        'safetybudgetpurchaseorders': 'SPO',
        'SafetyBudgetPurchaseOrders': 'SPO',
        
        // مؤشرات الأداء والمهام
        'safetyperformancekpis': 'SPK',
        'SafetyPerformanceKPIs': 'SPK',
        'safetyteamkpis': 'STK',
        'SafetyTeamKPIs': 'STK',
        'actiontrackingregister': 'ATR',
        'ActionTrackingRegister': 'ATR',
        'usertasks': 'UTK',
        'UserTasks': 'UTK',
        'userinstructions': 'UIN',
        'UserInstructions': 'UIN',
        
        // إدارة السلامة والصحة المهنية
        'safetyhealthmanagement': 'SHM',
        'SafetyHealthManagement': 'SHM',
        'safetyteammembers': 'STM',
        'SafetyTeamMembers': 'STM',
        'safetyorganizationalstructure': 'SOS',
        'SafetyOrganizationalStructure': 'SOS',
        'safetyjobdescriptions': 'SJD',
        'SafetyJobDescriptions': 'SJD',
        'safetyteamattendance': 'STA',
        'SafetyTeamAttendance': 'STA',
        'safetyteamleaves': 'STL',
        'SafetyTeamLeaves': 'STL',
        'safetyteamtasks': 'STT',
        'SafetyTeamTasks': 'STT',
        
        // أنواع المخالفات
        'violationtypes': 'VTY',
        'ViolationTypes': 'VTY',
        'violation_types_db': 'VTY',
        'Violation_Types_DB': 'VTY',
        'blacklist_register': 'BLR',
        'Blacklist_Register': 'BLR',
        
        // مصفوفات ومخزون
        'ppematrix': 'PPM',
        'PPEMatrix': 'PPM',
        'ppe_stock': 'PPS',
        'PPE_Stock': 'PPS',
        'ppe_transactions': 'PPT',
        'PPE_Transactions': 'PPT',
        
        // التدريب المتقدم
        'employeetrainingmatrix': 'ETM',
        'EmployeeTrainingMatrix': 'ETM',
        'contractortrainings': 'CTR',
        'ContractorTrainings': 'CTR',
        'annualtrainingplans': 'ATP',
        'AnnualTrainingPlans': 'ATP',
        
        // السجلات والإشعارات
        'auditlog': 'AUD',
        'AuditLog': 'AUD',
        'useractivitylog': 'UAL',
        'UserActivityLog': 'UAL',
        'notifications': 'NOT',
        'Notifications': 'NOT',
        'incidentnotifications': 'INO',
        'IncidentNotifications': 'INO',
        
        // إعدادات
        'form_settings_db': 'FSD',
        'Form_Settings_DB': 'FSD',
        'aiassistantsettings': 'AIA',
        'AIAssistantSettings': 'AIA',
        'userailog': 'UAI',
        'UserAILog': 'UAI',
        'safetyhealthmanagementsettings': 'SHS',
        'SafetyHealthManagementSettings': 'SHS',
        'actiontrackingsettings': 'ATS',
        'ActionTrackingSettings': 'ATS'
    };
    
    return prefixMap[moduleName] || 'ID';
}

