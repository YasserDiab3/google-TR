/**
 * Google Apps Script for HSE System - Clinic Module
 * 
 * موديول العيادة - النسخة المحسنة
 */

/**
 * ============================================
 * زيارات العيادة (Clinic Visits)
 * ============================================
 */

/**
 * تحويل قائمة الأدوية (array أو JSON string) إلى نص قابل للتخزين (بدون JSON) + إجمالي كمية
 */
function flattenDispensedMedications_(medications) {
    let medsArr = [];
    try {
        if (!medications) {
            medsArr = [];
        } else if (Array.isArray(medications)) {
            medsArr = medications;
        } else if (typeof medications === 'string') {
            const s = medications.trim();
            if (!s) medsArr = [];
            else {
                const parsed = JSON.parse(s);
                medsArr = Array.isArray(parsed) ? parsed : [];
            }
        } else {
            medsArr = [];
        }
    } catch (e) {
        medsArr = [];
    }

    const parts = [];
    let totalQty = 0;
    medsArr.forEach(m => {
        if (!m || typeof m !== 'object') return;
        
        // ✅ إصلاح: التأكد من أن name هو string وليس object
        let name = m.medicationName || m.name || '';
        
        // ✅ Debug: تسجيل نوع name قبل المعالجة
        if (typeof name === 'object' && name !== null) {
            Logger.log('⚠️ [BACKEND] اكتشاف name كـ object: ' + JSON.stringify(name));
            name = name.medicationName || name.name || '';
            Logger.log('✅ [BACKEND] بعد الاستخراج: ' + name);
        }
        
        name = (name || '').toString().trim();
        const qty = parseInt(m.quantity, 10) || 0;
        
        if (name) {
            parts.push(name + (qty ? ` (${qty})` : ''));
        }
        totalQty += qty;
    });

    return {
        medicationsDispensed: parts.length ? parts.join('، ') : '',
        medicationsDispensedQty: totalQty
    };
}

/**
 * إعادة بناء قائمة أدوية منصرفة من نص (بدون JSON في الشيت)
 * صيغة النص: "Paracetamol (2)، Ibuprofen (1)" أو "Paracetamol، Ibuprofen"
 */
function parseDispensedMedicationsText_(text) {
    const s = (text || '').toString().trim();
    if (!s) return [];

    // split by Arabic comma or normal comma
    const parts = s.split(/،|,/).map(p => p.trim()).filter(Boolean);
    const result = [];

    parts.forEach(p => {
        // match "name (qty)"
        const m = p.match(/^(.*?)(?:\(\s*(\d+)\s*\))?$/);
        if (!m) return;
        const name = (m[1] || '').trim();
        const qty = m[2] ? parseInt(m[2], 10) : 1;
        if (!name) return;
        result.push({ medicationName: name, quantity: isNaN(qty) ? 1 : qty });
    });

    return result;
}

/**
 * تجهيز سجل الزيارة للكتابة في الشيت بدون أي حقول JSON
 */
function normalizeClinicVisitForSheet_(visitData) {
    const v = visitData && typeof visitData === 'object' ? visitData : {};
    const flattened = flattenDispensedMedications_(v.medications);

    // نحذف/نمنع أي حقول قد تُخزن كـ JSON
    const clean = {};
    for (var k in v) {
        if (!v.hasOwnProperty(k)) continue;
        if (k === 'medications') continue; // منع JSON array
        // ✅ نحتفظ بـ createdBy و updatedBy لأنها ستُعالج لاحقاً
        clean[k] = v[k];
    }

    // حقول مسطحة للأدوية
    clean.medicationsDispensed = flattened.medicationsDispensed;
    clean.medicationsDispensedQty = flattened.medicationsDispensedQty;

    return clean;
}

/**
 * تطبيع نوع الشخص لضمان الكتابة في الشيت الصحيح
 * يقبل: employee/contractor/external أو قيم عربية مثل (موظف/مقاول/خارجي/عمالة خارجية)
 * @return {string} 'employee' | 'contractor'
 */
function normalizeClinicPersonType_(personType, visitData) {
    const raw = (personType || '').toString().trim().toLowerCase();
    if (!raw) {
        // ✅ Hard safety: infer from payload fields when personType is missing
        const hasExternalName = !!(visitData && String(visitData.externalName || '').trim());
        const hasContractorHint = !!(visitData && (
            String(visitData.contractorName || '').trim() ||
            String(visitData.contractorWorkerName || '').trim() ||
            String(visitData.contractorPosition || '').trim() ||
            String(visitData.workArea || '').trim()
        ));
        if (hasExternalName) return 'contractor';
        if (hasContractorHint) return 'contractor';
        return 'employee';
    }

    // English canonical
    if (raw === 'employee') return 'employee';
    if (raw === 'contractor') return 'contractor';
    if (raw === 'external') return 'contractor';

    // Arabic / mixed
    if (raw.includes('مقاول')) return 'contractor';
    if (raw.includes('خار')) return 'contractor'; // خارجي / عمالة خارجية => مقاول
    if (raw.includes('موظ')) return 'employee';

    // Fallback: treat unknown as employee
    return 'employee';
}

/**
 * تحديد اسم الشيت الصحيح حسب نوع الشخص
 * - employee/undefined -> ClinicVisits
 * - contractor -> ClinicContractorVisits
 */
function getClinicVisitSheetName_(visitData) {
    // يجب تمرير visitData كاملاً لـ normalizeClinicPersonType_ عندما personType فارغ
    // لاستنتاج المقاول/الخارجي من الحقول (contractorName، إلخ) وإلا يُسجّل دائماً في ClinicVisits
    const type = normalizeClinicPersonType_(
        visitData && visitData.personType,
        visitData || {}
    );
    if (type === 'contractor') return 'ClinicContractorVisits';
    return 'ClinicVisits';
}

/**
 * تحديد اسم شيت الإصابات حسب نوع الشخص
 * - employee -> Injuries (الجدول الحالي)
 * - contractor -> ClinicContractorInjuries (جدول جديد)
 */
function getClinicInjurySheetName_(injuryData) {
    const type = normalizeClinicPersonType_(
        injuryData && injuryData.personType,
        injuryData || {}
    );
    if (type === 'contractor') return 'ClinicContractorInjuries';
    return 'Injuries';
}

/**
 * الحصول على اسم المستخدم من قاعدة البيانات بناءً على email أو id
 * @param {string} email - البريد الإلكتروني للمستخدم
 * @param {string} userId - معرف المستخدم
 * @return {string} اسم المستخدم أو null
 */
function getUserNameFromDatabase_(email, userId) {
    try {
        Logger.log('🔍 [BACKEND] getUserNameFromDatabase_ - البحث عن: email=' + email + ', userId=' + userId);
        
        if (!email && !userId) {
            Logger.log('⚠️ [BACKEND] لم يتم تمرير email أو userId');
            return null;
        }
        
        const users = readFromSheet('Users', getSpreadsheetId());
        if (!users || !Array.isArray(users) || users.length === 0) {
            Logger.log('⚠️ [BACKEND] لا توجد بيانات مستخدمين في قاعدة البيانات');
            return null;
        }
        
        Logger.log('📊 [BACKEND] عدد المستخدمين في قاعدة البيانات: ' + users.length);
        
        // البحث عن المستخدم بناءً على email أو id (البحث في كلا الحالتين)
        const user = users.find(u => {
            const userEmail = (u.email || '').toString().toLowerCase().trim();
            const searchEmail = email ? email.toLowerCase().trim() : '';
            const userIdFromDb = (u.id || '').toString().trim();
            const searchUserId = userId ? userId.toString().trim() : '';
            
            // البحث بمطابقة email أو id (أو كليهما)
            const emailMatch = email && userEmail && userEmail === searchEmail;
            const idMatch = userId && userIdFromDb && userIdFromDb === searchUserId;
            
            return emailMatch || idMatch;
        });
        
        if (user) {
            // ✅ تسجيل جميع الحقول المتاحة للمستخدم للتشخيص
            Logger.log('✅ [BACKEND] تم العثور على المستخدم:');
            Logger.log('   - email: ' + (user.email || 'غير موجود'));
            Logger.log('   - name: ' + (user.name || 'غير موجود'));
            Logger.log('   - displayName: ' + (user.displayName || 'غير موجود'));
            Logger.log('   - userName: ' + (user.userName || 'غير موجود'));
            Logger.log('   - fullName: ' + (user.fullName || 'غير موجود'));
            Logger.log('   - حقول المستخدم: ' + Object.keys(user).join(', '));
            
            // ✅ البحث في عدة حقول محتملة للاسم
            const userName = (user.name || user.displayName || user.userName || user.fullName || '').toString().trim();
            if (userName && userName !== 'النظام' && userName !== '') {
                Logger.log('✅ [BACKEND] تم العثور على اسم المستخدم: ' + userName);
                return userName;
            } else {
                Logger.log('⚠️ [BACKEND] المستخدم موجود لكن حقل الاسم فارغ!');
                Logger.log('⚠️ [BACKEND] القيم: name="' + user.name + '", displayName="' + user.displayName + '"');
            }
        } else {
            Logger.log('⚠️ [BACKEND] لم يتم العثور على المستخدم بـ email=' + email + ' أو userId=' + userId);
            // عرض بعض الأمثلة من المستخدمين المتاحين
            if (users.length > 0) {
                Logger.log('📋 [BACKEND] أمثلة من المستخدمين المتاحين:');
                users.slice(0, 3).forEach((u, i) => {
                    Logger.log('   [' + i + '] email=' + (u.email || 'N/A') + ', name=' + (u.name || 'N/A'));
                });
            }
        }
        
        return null;
    } catch (error) {
        Logger.log('❌ [BACKEND] خطأ في getUserNameFromDatabase_: ' + error.toString());
        return null;
    }
}

/**
 * إضافة زيارة عيادة
 */
function addClinicVisitToSheet(visitData) {
    // ✅ Logger.log في بداية الدالة للتشخيص
    Logger.log('🚀 [BACKEND] addClinicVisitToSheet - عدد المعاملات: ' + arguments.length);
    
    // ✅ إصلاح جذري: إذا كان visitData undefined، نحاول استخدام arguments[0]
    if ((visitData === undefined || visitData === null) && arguments.length > 0 && arguments[0]) {
        Logger.log('⚠️ [BACKEND] visitData undefined، محاولة استخدام arguments[0]');
        visitData = arguments[0];
    }
    
    // ✅ إصلاح جذري: إذا لم يكن هناك معاملات على الإطلاق، نعيد خطأ واضح
    // هذا يحدث غالباً عند تشغيل الدالة يدوياً من المحرر (Editor) وليس من Web App (doPost)
    if (arguments.length === 0 && (visitData === undefined || visitData === null)) {
        Logger.log('❌ [BACKEND] ===== خطأ جذري: addClinicVisitToSheet تم استدعاؤها بدون معاملات =====');
        Logger.log('❌ [BACKEND] الوقت: ' + new Date().toISOString());
        Logger.log('❌ [BACKEND] عدد المعاملات: ' + arguments.length);
        Logger.log('❌ [BACKEND] visitData: ' + visitData);
        Logger.log('❌ [BACKEND] ============================================');
        Logger.log('❌ [BACKEND] السبب الشائع:');
        Logger.log('❌ [BACKEND] 1. تم تشغيل الدالة من المحرر (Editor) مباشرة باستخدام Run/Debug');
        Logger.log('❌ [BACKEND] 2. الطلب لم يصل إلى doPost في Code.gs (URL خاطئ أو Web App غير منشور)');
        Logger.log('❌ [BACKEND] 3. Web App منشور بنسخة قديمة من الكود');
        Logger.log('❌ [BACKEND] ============================================');
        Logger.log('❌ [BACKEND] الحلول:');
        Logger.log('❌ [BACKEND] 1. لا تشغل addClinicVisitToSheet من Run/Debug في المحرر');
        Logger.log('❌ [BACKEND] 2. استخدم testAddClinicVisitToSheet() للاختبار من المحرر');
        Logger.log('❌ [BACKEND] 3. سجل زيارة من التطبيق (Web App) ليتم استدعاء doPost ثم addClinicVisitToSheet(visitData)');
        Logger.log('❌ [BACKEND] 4. تأكد من نشر Web App كـ "New version" بعد تحديث الكود');
        Logger.log('❌ [BACKEND] 5. تحقق من أن URL التطبيق ينتهي بـ /exec وليس /dev');
        Logger.log('❌ [BACKEND] ============================================');
        return { 
            success: false, 
            message: 'خطأ: تم استدعاء addClinicVisitToSheet بدون بيانات.\n\n' +
                     'لا تشغلها من المحرر مباشرة.\n\n' +
                     'للاختبار من المحرر: استخدم testAddClinicVisitToSheet()\n\n' +
                     'للاختبار الصحيح: سجل زيارة من التطبيق (Web App) بعد نشر New version.',
            errorCode: 'NO_PARAMETERS',
            troubleshooting: {
                step1: 'لا تشغل addClinicVisitToSheet من Run/Debug',
                step2: 'استخدم testAddClinicVisitToSheet() للاختبار من المحرر',
                step3: 'سجل زيارة من التطبيق (Web App URL)',
                step4: 'تأكد من نشر Web App كـ "New version"',
                step5: 'تحقق من URL - يجب أن ينتهي بـ /exec'
            }
        };
    }
    
    try {
        if (!visitData || typeof visitData !== 'object') {
            Logger.log('❌ [BACKEND] visitData غير موجود أو غير صحيح');
            Logger.log('❌ [BACKEND] visitData value: ' + JSON.stringify(visitData));
            Logger.log('❌ [BACKEND] arguments كاملة: ' + JSON.stringify(Array.from(arguments)));
            return { success: false, message: 'بيانات الزيارة غير موجودة أو غير صحيحة' };
        }
        
        Logger.log('✅ [BACKEND] visitData موجود، عدد الحقول: ' + Object.keys(visitData).length);

        // ✅ تثبيت نوع الشخص بشكل موحّد لمنع التسجيل في الجدول الخطأ
        try {
            visitData.personType = normalizeClinicPersonType_(visitData.personType, visitData);
        } catch (e) {}
        
        const sheetName = getClinicVisitSheetName_(visitData);
        const normalized = normalizeClinicVisitForSheet_(visitData);

        // ✅ تأكيد تطبيع personType في البيانات المكتوبة
        try {
            normalized.personType = normalizeClinicPersonType_(normalized.personType || visitData.personType, normalized);
        } catch (e) {}
        
        // إضافة حقول تلقائية
        if (!normalized.id) {
            normalized.id = generateSequentialId('CLV', sheetName);
        }
        if (!normalized.createdAt) {
            normalized.createdAt = new Date();
        }
        if (!normalized.updatedAt) {
            normalized.updatedAt = new Date();
        }
        
        // ✅ إضافة createdBy و updatedBy (تخزين كنص فقط)
        // معالجة createdBy
        if (normalized.createdBy) {
            if (typeof normalized.createdBy === 'object') {
                // إذا كان object، نحاول استخراج name أو email أو id
                const name = (normalized.createdBy.name || '').toString().trim();
                const email = (normalized.createdBy.email || '').toString().trim();
                const id = (normalized.createdBy.id || '').toString().trim();
                
                // ✅ إصلاح: نستخدم name فقط إذا كان موجوداً وصحيحاً
                if (name && name !== 'النظام' && name !== '') {
                    normalized.createdBy = name;
                } else {
                    // ✅ إصلاح: إذا لم يكن name موجوداً، نبحث عن اسم المستخدم من قاعدة البيانات
                    const userNameFromDb = getUserNameFromDatabase_(email, id);
                    if (userNameFromDb && userNameFromDb !== 'النظام' && userNameFromDb !== '') {
                        normalized.createdBy = userNameFromDb;
                    } else {
                        Logger.log('⚠️ [BACKEND] لا توجد قيمة صحيحة لـ createdBy - استخدام "مستخدم"');
                        normalized.createdBy = 'مستخدم';
                    }
                }
            } else if (typeof normalized.createdBy === 'string') {
                // إذا كان string، نتأكد من أنه ليس فارغاً
                const trimmed = normalized.createdBy.trim();
                // ✅ إصلاح جذري: إذا كان "النظام" أو فارغ، نبحث عن اسم المستخدم من قاعدة البيانات
                if (trimmed && trimmed !== '' && trimmed !== 'النظام') {
                    normalized.createdBy = trimmed;
            } else {
                // ✅ إصلاح جذري: البحث عن اسم المستخدم من قاعدة البيانات بناءً على email أو userId
                const emailFromData = (visitData.email || '').toString().trim();
                const userIdFromData = (visitData.userId || visitData.id || '').toString().trim();
                const userNameFromDb = getUserNameFromDatabase_(emailFromData, userIdFromData);
                
                if (userNameFromDb && userNameFromDb !== 'النظام' && userNameFromDb !== '') {
                    normalized.createdBy = userNameFromDb;
                    Logger.log('✅ [BACKEND] تم استعادة اسم المستخدم من قاعدة البيانات: ' + userNameFromDb);
                } else {
                    // ✅ إذا لم نجد الاسم، نستخدم "مستخدم" كبديل بدلاً من "النظام" أو email
                    normalized.createdBy = 'مستخدم';
                    Logger.log('⚠️ [BACKEND] الاسم غير موجود في قاعدة البيانات - استخدام "مستخدم" كبديل');
                }
            }
            }
        } else {
            // ✅ إصلاح جذري: إذا لم يتم تمرير createdBy، نبحث عن اسم المستخدم من قاعدة البيانات
            const emailFromData = (visitData.email || '').toString().trim();
            const userIdFromData = (visitData.userId || visitData.id || '').toString().trim();
            const userNameFromDb = getUserNameFromDatabase_(emailFromData, userIdFromData);
            
            if (userNameFromDb && userNameFromDb !== 'النظام' && userNameFromDb !== '') {
                normalized.createdBy = userNameFromDb;
                Logger.log('✅ [BACKEND] تم استعادة اسم المستخدم من قاعدة البيانات (createdBy غير موجود): ' + userNameFromDb);
            } else {
                // ✅ إذا لم نجد الاسم، نستخدم "مستخدم" كبديل بدلاً من "النظام" أو email
                normalized.createdBy = 'مستخدم';
                Logger.log('⚠️ [BACKEND] createdBy غير موجود والاسم غير موجود في قاعدة البيانات - استخدام "مستخدم" كبديل');
            }
        }
        
        // ✅ تسجيل القيمة النهائية (مهم للتشخيص)
        Logger.log('✅ [BACKEND] createdBy النهائي: ' + normalized.createdBy);
        
        // ✅ معالجة updatedBy (تخزين كنص فقط - اسم فقط)
        if (normalized.updatedBy) {
            if (typeof normalized.updatedBy === 'object') {
                const name = (normalized.updatedBy.name || '').toString().trim();
                const email = (normalized.updatedBy.email || '').toString().trim();
                const id = (normalized.updatedBy.id || '').toString().trim();
                
                // ✅ نستخدم name فقط، وإلا نحاول جلب الاسم من قاعدة البيانات
                if (name && name !== 'النظام' && name !== '') {
                    normalized.updatedBy = name;
                } else {
                    const userNameFromDb = getUserNameFromDatabase_(email, id);
                    if (userNameFromDb && userNameFromDb !== 'النظام' && userNameFromDb !== '') {
                        normalized.updatedBy = userNameFromDb;
                    } else {
                        normalized.updatedBy = normalized.createdBy || 'مستخدم';
                        Logger.log('⚠️ [BACKEND] لا توجد قيمة صحيحة لـ updatedBy - استخدام createdBy أو "مستخدم"');
                    }
                }
            } else if (typeof normalized.updatedBy === 'string') {
                const trimmed = normalized.updatedBy.trim();
                if (trimmed && trimmed !== '' && trimmed !== 'النظام') {
                    normalized.updatedBy = trimmed;
                } else {
                    // ✅ إذا كان updatedBy فارغاً أو "النظام"، نبحث عن الاسم من قاعدة البيانات
                    const emailFromData = (visitData.email || '').toString().trim();
                    const userIdFromData = (visitData.userId || visitData.id || '').toString().trim();
                    const userNameFromDb = getUserNameFromDatabase_(emailFromData, userIdFromData);
                    
                    if (userNameFromDb && userNameFromDb !== 'النظام' && userNameFromDb !== '') {
                        normalized.updatedBy = userNameFromDb;
                        Logger.log('✅ [BACKEND] تم استعادة اسم المستخدم لـ updatedBy من قاعدة البيانات: ' + userNameFromDb);
                    } else {
                        normalized.updatedBy = normalized.createdBy || 'مستخدم';
                        Logger.log('⚠️ [BACKEND] updatedBy string فارغ ولم يتم العثور على اسم المستخدم - استخدام createdBy أو "مستخدم"');
                    }
                }
            }
        } else {
            // إذا لم يتم تمرير updatedBy، نستخدم createdBy أو القيمة الافتراضية
            normalized.updatedBy = normalized.createdBy || 'مستخدم';
        }
        
        // ✅ تسجيل القيمة النهائية (مهم للتشخيص)
        Logger.log('✅ [BACKEND] updatedBy النهائي: ' + normalized.updatedBy);
        
        // ✅ منع التكرار بين جدولين:
        // إذا كان نفس id موجوداً في أي جدول، نقوم بتحديثه بدلاً من إضافة صف جديد
        Logger.log('🚀 [BACKEND] حفظ الزيارة في: ' + sheetName + ' | id: ' + normalized.id);
        const result = upsertClinicVisit_(sheetName, normalized);
        Logger.log('✅ [BACKEND] تم الحفظ بنجاح - Row: ' + (result.rowNumber || 'N/A'));

        if (result && result.success === false) {
            return result;
        }
        
        // ✅ ملاحظة: خصم الأدوية تم تعطيله من عملية الحفظ لتجنب timeout
        // يتم الخصم بشكل منفصل عبر دالة processPendingMedicationDeductions()
        // أو يمكن تشغيله يدوياً من لوحة التحكم
        
        var merged = (result && typeof result === 'object') ? result : { success: true };
        merged.success = true;
        merged.visitId = String(normalized.id);
        merged.sheetName = sheetName;
        if (!merged.message) {
            merged.message = 'تم تسجيل الزيارة';
        }
        // إضافة معلومات الأدوية
        if (visitData.medications && Array.isArray(visitData.medications) && visitData.medications.length > 0) {
            merged.medicationsCount = visitData.medications.length;
            merged.message += ' - تنبيه: يرجى خصم الأدوية يدوياً من المخزون';
            merged.pendingDeduction = true;
        }
        return merged;
    } catch (error) {
        Logger.log('❌ [BACKEND] ===== خطأ في addClinicVisitToSheet =====');
        Logger.log('❌ [BACKEND] الخطأ: ' + error.toString());
        Logger.log('❌ [BACKEND] Stack: ' + error.stack);
        Logger.log('❌ [BACKEND] visitData: ' + JSON.stringify(visitData));
        return { success: false, message: 'حدث خطأ أثناء إضافة الزيارة: ' + error.toString() };
    }
}

/**
 * Upsert لزيارة العيادة لمنع التكرار بين ClinicVisits و ClinicContractorVisits
 * - إذا كان id موجوداً في أي شيت: تحديث الصف هناك
 * - إذا لم يكن موجوداً: إضافة صف جديد في الشيت الهدف
 */
function upsertClinicVisit_(targetSheetName, normalizedVisit) {
    try {
        const spreadsheetId = getSpreadsheetId();
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const id = (normalizedVisit && normalizedVisit.id) ? String(normalizedVisit.id) : '';
        
        if (!id) {
            // fallback: append بدون id (نادر جداً)
            Logger.log('⚠️ [BACKEND] upsertClinicVisit_: لا يوجد id - append مباشرة');
            return appendToSheet(targetSheetName, normalizedVisit);
        }

        const candidates = ['ClinicVisits', 'ClinicContractorVisits'];
        
        // 1) ابحث عن الزيارة في أي شيت باستخدام بحث سريع
        for (var i = 0; i < candidates.length; i++) {
            const sheetName = candidates[i];
            const sheet = ss.getSheetByName(sheetName);
            if (!sheet) continue;
            
            // بحث سريع في العمود id فقط
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) continue;
            
            // قراءة عمود id فقط (أسرع بكثير)
            const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            
            for (var r = 0; r < idColumn.length; r++) {
                if (idColumn[r][0] && String(idColumn[r][0]) === id) {
                    const rowIndex = r + 2; // +2 لأن الصفوف تبدأ من 1 وهناك header
                    Logger.log('✅ [BACKEND] upsertClinicVisit_: تم العثور على id موجود في: ' + sheetName + ' (row=' + rowIndex + ') - سيتم التحديث');
                    
                    // ✅ تحديث الصف مباشرة - قراءة الرؤوس مرة واحدة فقط
                    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
                    const rowData = [];
                    
                    // تحويل normalizedVisit إلى array بناءً على الرؤوس
                    for (var h = 0; h < headers.length; h++) {
                        const headerName = headers[h] ? String(headers[h]).trim() : '';
                        if (headerName && normalizedVisit.hasOwnProperty(headerName)) {
                            rowData.push(normalizedVisit[headerName]);
                        } else {
                            rowData.push('');
                        }
                    }
                    
                    // تحديث الصف مباشرة
                    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
                    
                    return {
                        success: true,
                        message: 'تم تحديث الزيارة',
                        rowNumber: rowIndex,
                        sheetName: sheetName,
                        updated: true
                    };
                }
            }
        }

        // 2) غير موجود: إضافة جديدة في الشيت الهدف فقط
        Logger.log('✅ [BACKEND] upsertClinicVisit_: id غير موجود في أي شيت - سيتم الإضافة في: ' + targetSheetName);
        const appendResult = appendToSheet(targetSheetName, normalizedVisit);
        appendResult.inserted = true;
        return appendResult;
        
    } catch (error) {
        Logger.log('❌ [BACKEND] upsertClinicVisit_ error: ' + error.toString());
        return {
            success: false,
            message: 'خطأ في upsertClinicVisit_: ' + error.toString(),
            error: error.toString()
        };
    }
}

/**
 * تحديث زيارة عيادة
 */
function updateClinicVisit(visitId, updateData) {
    try {
        if (!visitId) {
            return { success: false, message: 'معرف الزيارة غير محدد' };
        }

        const spreadsheetId = getSpreadsheetId();
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const normalizedUpdate = normalizeClinicVisitForSheet_(updateData || {});
        normalizedUpdate.updatedAt = new Date();

        // ✅ تثبيت نوع الشخص (لو تم تمريره)
        try {
            if (normalizedUpdate.personType) {
                normalizedUpdate.personType = normalizeClinicPersonType_(normalizedUpdate.personType, normalizedUpdate);
            }
        } catch (e) {}

        // ✅ معالجة updatedBy و createdBy (نص فقط)
        if (normalizedUpdate.updatedBy) {
            if (typeof normalizedUpdate.updatedBy === 'object') {
                const name = (normalizedUpdate.updatedBy.name || '').toString().trim();
                normalizedUpdate.updatedBy = (name && name !== 'النظام' && name !== '') ? name : 'النظام';
            } else {
                normalizedUpdate.updatedBy = String(normalizedUpdate.updatedBy).trim() || 'النظام';
            }
        } else {
            normalizedUpdate.updatedBy = 'النظام';
        }

        if (normalizedUpdate.createdBy) {
            if (typeof normalizedUpdate.createdBy === 'object') {
                const name = (normalizedUpdate.createdBy.name || '').toString().trim();
                normalizedUpdate.createdBy = (name && name !== 'النظام' && name !== '') ? name : 'النظام';
            } else {
                normalizedUpdate.createdBy = String(normalizedUpdate.createdBy).trim() || 'النظام';
            }
        }

        // ✅ بحث سريع وتحديث مباشر بدون قراءة البيانات
        const sheetCandidates = ['ClinicVisits', 'ClinicContractorVisits'];
        for (var s = 0; s < sheetCandidates.length; s++) {
            const sheetName = sheetCandidates[s];
            const sheet = ss.getSheetByName(sheetName);
            if (!sheet) continue;

            // بحث سريع في عمود id فقط
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) continue;

            const idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            let visitIndex = -1;

            for (var r = 0; r < idColumn.length; r++) {
                if (idColumn[r][0] && String(idColumn[r][0]) === visitId) {
                    visitIndex = r;
                    break;
                }
            }

            if (visitIndex === -1) continue;

            // ✅ تحديث مباشر بدون قراءة البيانات
            const rowIndex = visitIndex + 2; // +2 لأن الصفوف تبدأ من 1 وهناك header
            const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
            const rowData = [];

            // قراءة البيانات الحالية من الصف
            const currentRowData = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];

            // بناء الصف الجديد
            for (var h = 0; h < headers.length; h++) {
                const headerName = headers[h] ? String(headers[h]).trim() : '';
                if (headerName && normalizedUpdate.hasOwnProperty(headerName)) {
                    rowData.push(normalizedUpdate[headerName]);
                } else {
                    rowData.push(currentRowData[h] || '');
                }
            }

            // تحديث الصف مباشرة
            sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);

            Logger.log('✅ [BACKEND] updateClinicVisit: تم تحديث الزيارة ' + visitId + ' في ' + sheetName + ' (row=' + rowIndex + ')');

            return {
                success: true,
                message: 'تم تحديث الزيارة',
                visitId: visitId,
                sheetName: sheetName,
                rowNumber: rowIndex
            };
        }

        return { success: false, message: 'الزيارة غير موجودة' };
    } catch (error) {
        Logger.log('❌ [BACKEND] Error updating clinic visit: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الزيارة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع زيارات العيادة
 */
function getAllClinicVisits(filters = {}) {
    try {
        const spreadsheetId = getSpreadsheetId();

        // ✅ تأكد من وجود الشيتات وتحديث رؤوسها (بدون تغيير البيانات)
        try {
            const ss = SpreadsheetApp.openById(spreadsheetId);
            const empSheet = createSheetWithHeaders(ss, 'ClinicVisits', {});
            ensureSheetHeaders(empSheet, 'ClinicVisits', {});

            const conSheet = createSheetWithHeaders(ss, 'ClinicContractorVisits', {});
            ensureSheetHeaders(conSheet, 'ClinicContractorVisits', {});
        } catch (e) {
            // لا نفشل القراءة إذا لم نقدر نهيئ الرؤوس لأي سبب
            Logger.log('Warning ensuring clinic sheets headers: ' + e.toString());
        }

        const employeeData = readFromSheet('ClinicVisits', spreadsheetId) || [];
        const contractorData = readFromSheet('ClinicContractorVisits', spreadsheetId) || [];
        let data = employeeData.concat(contractorData);

        // ✅ إعادة بناء medications في الـ API response فقط (بدون تخزين JSON في الشيت)
        data = data.map(v => {
            if (!v || typeof v !== 'object') return v;
            
            // التحقق من medications بشكل شامل
            let medsArray = [];
            
            // إذا كانت medications موجودة وليست فارغة
            if (v.medications) {
                if (Array.isArray(v.medications) && v.medications.length > 0) {
                    medsArray = v.medications;
                } else if (typeof v.medications === 'string' && v.medications.trim()) {
                    // محاولة parse JSON
                    try {
                        const parsed = JSON.parse(v.medications);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            medsArray = parsed;
                        }
                    } catch (e) {
                        // ليس JSON، سنستخدم medicationsDispensed بدلاً منه
                    }
                }
            }
            
            // إذا كانت medications فارغة أو غير صالحة، نحاول من medicationsDispensed
            if (medsArray.length === 0 && v.medicationsDispensed) {
                medsArray = parseDispensedMedicationsText_(v.medicationsDispensed);
            }
            
            // تعيين medications النهائي
            v.medications = medsArray;
            
            // ✅ التأكد من وجود createdBy و updatedBy (للبيانات القديمة)
            if (!v.createdBy) {
                v.createdBy = null;
            }
            if (!v.updatedBy) {
                v.updatedBy = null;
            }
            
            return v;
        });
        
        // تطبيق الفلاتر
        if (filters.employeeCode) {
            data = data.filter(v => v.employeeCode === filters.employeeCode);
        }
        if (filters.personType) {
            data = data.filter(v => v.personType === filters.personType);
        }
        if (filters.reason) {
            data = data.filter(v => v.reason === filters.reason);
        }
        if (filters.startDate) {
            data = data.filter(v => {
                if (!v.visitDate) return false;
                return new Date(v.visitDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(v => {
                if (!v.visitDate) return false;
                return new Date(v.visitDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب التاريخ
        data.sort((a, b) => {
            const dateA = new Date(a.visitDate || a.createdAt || 0);
            const dateB = new Date(b.visitDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all clinic visits: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الزيارات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * الأدوية (Medications)
 * ============================================
 */

/**
 * إضافة دواء
 */
function addMedicationToSheet(medicationData) {
    try {
        if (!medicationData) {
            return { success: false, message: 'بيانات الدواء غير موجودة' };
        }
        
        const sheetName = 'Medications';

        // ✅ تأكيد أن الحقول الرقمية تُحفظ كأرقام
        if (medicationData.quantityAdded !== undefined && medicationData.quantityAdded !== null) {
            medicationData.quantityAdded = parseFloat(medicationData.quantityAdded) || 0;
        }
        if (medicationData.remainingQuantity !== undefined && medicationData.remainingQuantity !== null) {
            medicationData.remainingQuantity = parseFloat(medicationData.remainingQuantity) || 0;
        }
        if (medicationData.quantity !== undefined && medicationData.quantity !== null) {
            medicationData.quantity = parseFloat(medicationData.quantity) || 0;
        }

        // ✅ تطبيع الكمية/الرصيد لضمان التوافق مع الواجهة
        // - quantityAdded = الكمية (المدخلة/المضافة)
        // - remainingQuantity = الرصيد (بعد الصرف)
        if (medicationData.quantityAdded === undefined || medicationData.quantityAdded === null) {
            if (medicationData.quantity !== undefined && medicationData.quantity !== null) {
                medicationData.quantityAdded = medicationData.quantity;
            }
        }
        if (medicationData.remainingQuantity === undefined || medicationData.remainingQuantity === null) {
            if (medicationData.quantityAdded !== undefined && medicationData.quantityAdded !== null) {
                medicationData.remainingQuantity = medicationData.quantityAdded;
            } else if (medicationData.quantity !== undefined && medicationData.quantity !== null) {
                medicationData.remainingQuantity = medicationData.quantity;
            }
        }
        
        // إضافة حقول تلقائية
        if (!medicationData.id) {
            medicationData.id = generateSequentialId('MED', sheetName);
        }
        if (!medicationData.createdAt) {
            medicationData.createdAt = new Date();
        }
        if (!medicationData.updatedAt) {
            medicationData.updatedAt = new Date();
        }
        if (!medicationData.status) {
            medicationData.status = 'ساري';
        }
        
        // ✅ منع تخزين JSON في أي خلية: createdBy يتم تخزينه كنص فقط (اسم/بريد)
        if (medicationData.createdBy && typeof medicationData.createdBy === 'object') {
            medicationData.createdBy = (medicationData.createdBy.name || medicationData.createdBy.email || '').toString();
        }
        // ✅ إضافة updatedBy (تخزين كنص فقط)
        if (medicationData.updatedBy && typeof medicationData.updatedBy === 'object') {
            medicationData.updatedBy = (medicationData.updatedBy.name || medicationData.updatedBy.email || '').toString();
        }
        if (!medicationData.updatedBy && medicationData.createdBy) {
            medicationData.updatedBy = medicationData.createdBy;
        }
        
        // حساب الأيام المتبقية للانتهاء (فقط إذا لم يكن محسوباً مسبقاً)
        if (medicationData.expiryDate && (medicationData.daysRemaining === undefined || medicationData.daysRemaining === null)) {
            const expiryDate = new Date(medicationData.expiryDate);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            medicationData.daysRemaining = daysRemaining;

            // حساب الرصيد المتبقي
            const remainingQuantity = parseFloat(medicationData.remainingQuantity ?? medicationData.quantityAdded ?? medicationData.quantity ?? 0);
            const hasStock = remainingQuantity > 0;

            // تحديث الحالة بناءً على الأيام المتبقية (فقط إذا لم تكن محددة)
            if (!medicationData.status || medicationData.status === 'ساري') {
                if (daysRemaining < 0) {
                    medicationData.status = 'منتهي';
                } else if (daysRemaining <= 30) {
                    // ✅ مهم: عرض "قريب الانتهاء" فقط إذا كان هناك رصيد متبقي
                    medicationData.status = hasStock ? 'قريب الانتهاء' : 'ساري';
                } else {
                    medicationData.status = 'ساري';
                }
            }
        }
        
        Logger.log('Adding medication to sheet: ' + JSON.stringify({
            id: medicationData.id,
            name: medicationData.name,
            type: medicationData.type,
            hasExpiryDate: !!medicationData.expiryDate,
            daysRemaining: medicationData.daysRemaining,
            status: medicationData.status
        }));
        
        return appendToSheet(sheetName, medicationData);
    } catch (error) {
        Logger.log('Error in addMedicationToSheet: ' + error.toString());
        Logger.log('Medication data: ' + JSON.stringify(medicationData));
        return { success: false, message: 'حدث خطأ أثناء إضافة الدواء: ' + error.toString() };
    }
}

/**
 * ============================================
 * خصم الأدوية من المخزون عند صرفها في الزيارة
 * ============================================
 */

/**
 * ============================================
 * معالجة الخصم المؤجل للأدوية
 * ============================================
 * تُستخدَم كدالة منفصلة لتجنب مشكلة timeout
 * يمكن تشغيلها:
 * 1. يدوياً من لوحة التحكم
 * 2. عبر time-driven trigger كل ساعة
 * 3. من خلال زر "خصم الأدوية" في العيادة
 */

/**
 * خصم الأدوية من الزيارات التي لم يتم خصم أدويتها بعد
 * @returns {Object} نتيجة العملية
 */
function processPendingMedicationDeductions() {
    try {
        Logger.log('🔄 [PENDING-DEDUCT] بدء معالجة الخصم المؤجل للأدوية...');
        
        const visitSheetName = 'ClinicVisits';
        const medicationSheetName = 'Medications';
        const logSheetName = 'MedicationDispenseLog';
        const spreadsheetId = getSpreadsheetId();
        
        // قراءة الزيارات
        const visits = readFromSheet(visitSheetName, spreadsheetId);
        if (!visits || visits.length === 0) {
            Logger.log('ℹ️ [PENDING-DEDUCT] لا توجد زيارات');
            return { success: true, message: 'لا توجد زيارات', processed: 0 };
        }
        
        // قراءة المخزون
        const medications = readFromSheet(medicationSheetName, spreadsheetId);
        if (!medications || medications.length === 0) {
            Logger.log('⚠️ [PENDING-DEDUCT] المخزون فارغ');
            return { success: false, message: 'المخزون فارغ', processed: 0 };
        }
        
        Logger.log('📊 [PENDING-DEDUCT] عدد الزيارات: ' + visits.length);
        Logger.log('📊 [PENDING-DEDUCT] عدد الأدوية في المخزون: ' + medications.length);
        
        let processedCount = 0;
        let deductedCount = 0;
        let failCount = 0;
        
        // البحث عن الزيارات التي تحتوي على أدوية
        for (let i = 0; i < visits.length; i++) {
            const visit = visits[i];
            if (!visit) continue;
            
            // التحقق من وجود medicationsDispensed
            const medsDispensed = visit.medicationsDispensed || '';
            const medsQty = visit.medicationsDispensedQty || 0;
            
            if (!medsDispensed || medsQty <= 0) {
                continue; // لا توجد أدوية في هذه الزيارة
            }
            
            // التحقق مما إذا تم الخصم بالفعل (من خلال السجل)
            const visitId = visit.id || '';
            if (!visitId) continue;
            
            // قراءة السجل للتحقق
            const logData = readFromSheet(logSheetName, spreadsheetId);
            const alreadyDeducted = logData && logData.some(log => log.visitId === visitId);
            
            if (alreadyDeducted) {
                Logger.log('ℹ️ [PENDING-DEDUCT] الزيارة ' + visitId + ' تم خصم أدويتها بالفعل');
                processedCount++;
                continue;
            }
            
            // تحليل الأدوية المنصرفة
            const medsArray = parseDispensedMedicationsText_(medsDispensed);
            if (!medsArray || medsArray.length === 0) {
                Logger.log('⚠️ [PENDING-DEDUCT] لا يمكن تحليل الأدوية في الزيارة ' + visitId);
                failCount++;
                processedCount++;
                continue;
            }
            
            Logger.log('💊 [PENDING-DEDUCT] معالجة الزيارة ' + visitId + ' - عدد الأدوية: ' + medsArray.length);
            
            // خصم كل دواء
            for (let j = 0; j < medsArray.length; j++) {
                const med = medsArray[j];
                const medName = med.medicationName || '';
                const quantityToDeduct = med.quantity || 1;
                
                if (!medName) continue;
                
                // البحث عن الدواء في المخزون
                const medIndex = medications.findIndex(row => {
                    if (!row) return false;
                    const rowName = (row.medicationName || row.name || '').toString().trim();
                    return rowName === medName;
                });
                
                if (medIndex === -1) {
                    Logger.log('⚠️ [PENDING-DEDUCT] الدواء غير موجود: ' + medName);
                    continue;
                }
                
                const existingMed = medications[medIndex];
                const currentQty = parseInt(existingMed.remainingQuantity || existingMed.quantity || 0, 10);
                const newQty = currentQty - quantityToDeduct;
                
                if (newQty < 0) {
                    Logger.log('⚠️ [PENDING-DEDUCT] الكمية غير كافية: ' + medName);
                    continue;
                }
                
                // تحديث الكمية
                medications[medIndex].remainingQuantity = newQty;
                medications[medIndex].updatedAt = new Date().toISOString();
                medications[medIndex].updatedBy = visit.createdBy || 'System';
                
                if (newQty === 0) {
                    medications[medIndex].status = 'منتهي';
                } else if (newQty <= 10) {
                    medications[medIndex].status = 'منخفض';
                }
                
                deductedCount++;
                Logger.log('✅ [PENDING-DEDUCT] تم خصم ' + quantityToDeduct + ' من ' + medName);
            }
            
            processedCount++;
        }
        
        // حفظ التحديثات في المخزون
        if (deductedCount > 0) {
            Logger.log('💾 [PENDING-DEDUCT] حفظ ' + deductedCount + ' تحديثات في المخزون...');
            const saveResult = saveToSheet(medicationSheetName, medications, spreadsheetId);
            
            if (saveResult && saveResult.success) {
                Logger.log('✅ [PENDING-DEDUCT] تم حفظ التحديثات بنجاح');
            } else {
                Logger.log('❌ [PENDING-DEDUCT] فشل الحفظ: ' + (saveResult ? saveResult.message : 'خطأ غير معروف'));
                return { success: false, message: 'فشل حفظ التحديثات', processed: processedCount };
            }
            
            // تسجيل في السجل
            try {
                for (let i = 0; i < visits.length; i++) {
                    const visit = visits[i];
                    if (!visit) continue;
                    
                    const medsDispensed = visit.medicationsDispensed || '';
                    if (!medsDispensed) continue;
                    
                    const visitId = visit.id || '';
                    if (!visitId) continue;
                    
                    // التحقق من عدم وجود سجل مسبق
                    const logData = readFromSheet(logSheetName, spreadsheetId);
                    const alreadyLogged = logData && logData.some(log => log.visitId === visitId);
                    
                    if (alreadyLogged) continue;
                    
                    const medsArray = parseDispensedMedicationsText_(medsDispensed);
                    for (let j = 0; j < medsArray.length; j++) {
                        const med = medsArray[j];
                        const logEntry = {
                            id: generateSequentialId('MDL', logSheetName),
                            visitId: visitId,
                            medicationName: med.medicationName || '',
                            deductedQuantity: med.quantity || 1,
                            dispensedBy: visit.createdBy || 'System',
                            dispensedAt: visit.createdAt || new Date(),
                            notes: 'خصم مؤجل - زيارة #' + visitId,
                            processedAt: new Date().toISOString()
                        };
                        appendToSheet(logSheetName, logEntry);
                    }
                }
                Logger.log('✅ [PENDING-DEDUCT] تم تسجيل العمليات في السجل');
            } catch (logError) {
                Logger.log('⚠️ [PENDING-DEDUCT] خطأ في تسجيل السجل: ' + logError.toString());
            }
        }
        
        Logger.log('✅ [PENDING-DEDUCT] اكتملت المعالجة - تمت: ' + processedCount + ', خصم: ' + deductedCount + ', فشل: ' + failCount);
        
        return {
            success: true,
            message: 'تمت معالجة ' + processedCount + ' زيارة، خصم ' + deductedCount + ' دواء',
            processed: processedCount,
            deducted: deductedCount,
            failed: failCount
        };
        
    } catch (error) {
        Logger.log('❌ [PENDING-DEDUCT] خطأ في processPendingMedicationDeductions: ' + error.toString());
        return {
            success: false,
            message: 'خطأ: ' + error.toString(),
            error: error.toString()
        };
    }
}

/**
 * خصم الأدوية من المخزون - نسخة غير متزامنة (في الخلفية)
 * @param {Array} medications - قائمة الأدوية المنصرفة
 * @param {string} visitId - معرف الزيارة
 * @param {string} dispensedBy - اسم الشخص الذي صرف
 */
function deductMedicationsFromInventoryAsync_(medications, visitId, dispensedBy) {
    try {
        const sheetName = 'Medications';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const logSheetName = 'MedicationDispenseLog';
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            Logger.log('⚠️ [ASYNC-DEDUCT] المخزون فارغ أو غير موجود');
            return;
        }
        
        Logger.log('📊 [ASYNC-DEDUCT] عدد الأدوية في المخزون: ' + data.length);
        Logger.log('💊 [ASYNC-DEDUCT] بدء معالجة ' + medications.length + ' أدوية...');
        
        let successCount = 0;
        let failCount = 0;
        
        // معالجة كل دواء
        for (let i = 0; i < medications.length; i++) {
            const med = medications[i];
            if (!med) continue;
            
            const medName = (med.medicationName || med.name || '').toString().trim();
            const medId = (med.medicationId || med.id || '').toString().trim();
            const quantityToDeduct = parseInt(med.quantity, 10) || 1;
            
            if (!medName) continue;
            
            // البحث عن الدواء
            let medIndex = -1;
            if (medId) {
                medIndex = data.findIndex(row => row && row.id && row.id.toString().trim() === medId);
            }
            if (medIndex === -1 && medName) {
                medIndex = data.findIndex(row => {
                    if (!row) return false;
                    const rowName = (row.medicationName || row.name || '').toString().trim();
                    return rowName === medName;
                });
            }
            
            if (medIndex === -1) {
                Logger.log('⚠️ [ASYNC-DEDUCT] الدواء غير موجود: ' + medName);
                failCount++;
                continue;
            }
            
            const existingMed = data[medIndex];
            const currentQty = parseInt(existingMed.remainingQuantity || existingMed.quantity || 0, 10);
            const newQty = currentQty - quantityToDeduct;
            
            if (newQty < 0) {
                Logger.log('⚠️ [ASYNC-DEDUCT] الكمية غير كافية: ' + medName);
                failCount++;
                continue;
            }
            
            // تحديث البيانات
            data[medIndex].remainingQuantity = newQty;
            data[medIndex].updatedAt = new Date().toISOString();
            data[medIndex].updatedBy = dispensedBy || 'System';
            
            if (newQty === 0) {
                data[medIndex].status = 'منتهي';
            } else if (newQty <= 10) {
                data[medIndex].status = 'منخفض';
            }
            
            Logger.log('✅ [ASYNC-DEDUCT] تم تحضير خصم ' + quantityToDeduct + ' من ' + medName + ' (الصف: ' + (medIndex + 2) + ')');
            successCount++;
        }
        
        // حفظ التحديثات - صف بصف
        if (successCount > 0) {
            Logger.log('💾 [ASYNC-DEDUCT] بدء حفظ ' + successCount + ' تحديثات...');
            
            for (let i = 0; i < medications.length; i++) {
                const med = medications[i];
                const medName = (med.medicationName || med.name || '').toString().trim();
                const medIndex = data.findIndex(row => row && ((row.id && row.id.toString().trim() === (med.medicationId || med.id || '').toString().trim()) || ((row.medicationName || row.name || '').toString().trim() === medName)));
                
                if (medIndex === -1) continue;
                
                const medData = data[medIndex];
                const rowIndex = medIndex + 2;
                
                try {
                    const updateResult = updateSingleRowInSheet(sheetName, medData, rowIndex, spreadsheetId);
                    if (updateResult && updateResult.success) {
                        Logger.log('✅ [ASYNC-DEDUCT] تم حفظ ' + medName + ' في الصف ' + rowIndex);
                    }
                } catch (saveError) {
                    Logger.log('❌ [ASYNC-DEDUCT] فشل حفظ ' + medName + ': ' + saveError.toString());
                }
            }
            
            // تسجيل في السجل
            try {
                for (let i = 0; i < medications.length; i++) {
                    const med = medications[i];
                    const medName = (med.medicationName || med.name || '').toString().trim();
                    const medIndex = data.findIndex(row => row && ((row.id && row.id.toString().trim() === (med.medicationId || med.id || '').toString().trim()) || ((row.medicationName || row.name || '').toString().trim() === medName)));
                    
                    if (medIndex === -1) continue;
                    
                    const currentQty = parseInt(data[medIndex].remainingQuantity || data[medIndex].quantity || 0, 10);
                    const quantityToDeduct = parseInt(med.quantity, 10) || 1;
                    
                    const logEntry = {
                        id: generateSequentialId('MDL', logSheetName),
                        visitId: visitId,
                        medicationId: med.medicationId || med.id || '',
                        medicationName: medName,
                        previousQuantity: currentQty + quantityToDeduct,
                        deductedQuantity: quantityToDeduct,
                        newQuantity: currentQty,
                        dispensedBy: dispensedBy || 'System',
                        dispensedAt: new Date().toISOString(),
                        notes: 'صرف عيادة - زيارة #' + visitId
                    };
                    appendToSheet(logSheetName, logEntry);
                }
                Logger.log('✅ [ASYNC-DEDUCT] تم تسجيل العمليات في السجل');
            } catch (logError) {
                Logger.log('⚠️ [ASYNC-DEDUCT] خطأ في تسجيل السجل: ' + logError.toString());
            }
        }
        
        Logger.log('✅ [ASYNC-DEDUCT] اكتمل الخصم - نجح: ' + successCount + ', فشل: ' + failCount);
        
    } catch (error) {
        Logger.log('❌ [ASYNC-DEDUCT] خطأ في deductMedicationsFromInventoryAsync_: ' + error.toString());
    }
}

/**
 * خصم الأدوية من المخزون - النسخة المتزامنة (للاختبار فقط)
 * @param {Array} medications - قائمة الأدوية المنصرفة [{medicationName, quantity, medicationId}]
 * @param {string} visitId - معرف الزيارة للتسجيل في السجل
 * @param {string} dispensedBy - اسم الشخص الذي صرف الدواء
 * @returns {Object} نتيجة العملية
 */
function deductMedicationsFromInventory_(medications, visitId, dispensedBy) {
    try {
        const sheetName = 'Medications';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const logSheetName = 'MedicationDispenseLog';
        
        const results = {
            success: true,
            deducted: [],
            failed: [],
            message: '',
            updatesApplied: []
        };
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            Logger.log('⚠️ [DEDUCT] المخزون فارغ أو غير موجود');
            results.success = false;
            results.message = 'المخزون فارغ أو غير موجود';
            return results;
        }
        
        Logger.log('📊 [DEDUCT] عدد الأدوية في المخزون: ' + data.length);
        
        // معالجة كل دواء
        for (let i = 0; i < medications.length; i++) {
            const med = medications[i];
            if (!med) continue;
            
            const medName = (med.medicationName || med.name || '').toString().trim();
            const medId = (med.medicationId || med.id || '').toString().trim();
            const quantityToDeduct = parseInt(med.quantity, 10) || 1;
            
            Logger.log('💊 [DEDUCT] معالجة الدواء #' + (i+1) + ': ' + medName + ' (الكمية: ' + quantityToDeduct + ')');
            
            if (!medName) {
                results.failed.push({
                    index: i,
                    reason: 'اسم الدواء فارغ',
                    medication: med
                });
                Logger.log('⚠️ [DEDUCT] اسم الدواء فارغ في العنصر #' + (i+1));
                continue;
            }
            
            // البحث عن الدواء في المخزون
            let medIndex = -1;
            
            // أولاً البحث بالمعرف إذا موجود
            if (medId) {
                medIndex = data.findIndex(row => row && row.id && row.id.toString().trim() === medId);
                if (medIndex !== -1) {
                    Logger.log('✅ [DEDUCT] تم العثور على الدواء بالمعرف: ' + medId);
                }
            }
            
            // إذا لم نجد بالمعرف، نبحث بالاسم
            if (medIndex === -1 && medName) {
                medIndex = data.findIndex(row => {
                    if (!row) return false;
                    const rowName = (row.medicationName || row.name || '').toString().trim();
                    return rowName === medName;
                });
                if (medIndex !== -1) {
                    Logger.log('✅ [DEDUCT] تم العثور على الدواء بالاسم: ' + medName);
                }
            }
            
            if (medIndex === -1) {
                results.failed.push({
                    index: i,
                    reason: 'الدواء غير موجود في المخزون',
                    medicationName: medName,
                    medication: med
                });
                Logger.log('⚠️ [DEDUCT] الدواء غير موجود في المخزون: ' + medName);
                continue;
            }
            
            const existingMed = data[medIndex];
            const currentQty = parseInt(existingMed.remainingQuantity || existingMed.quantity || 0, 10);
            const newQty = currentQty - quantityToDeduct;
            
            Logger.log('📊 [DEDUCT] الكمية الحالية: ' + currentQty + ', الكمية بعد الخصم: ' + newQty);
            
            // التحقق من توفر الكمية
            if (newQty < 0) {
                results.failed.push({
                    index: i,
                    reason: 'الكمية غير كافية - المتبقي: ' + currentQty + ', المطلوب: ' + quantityToDeduct,
                    medicationName: medName,
                    currentQuantity: currentQty,
                    requestedQuantity: quantityToDeduct,
                    medication: med
                });
                Logger.log('⚠️ [DEDUCT] الكمية غير كافية: ' + medName + ' (المتبقي: ' + currentQty + ', المطلوب: ' + quantityToDeduct + ')');
                continue;
            }
            
            // ✅ تحديث الكمية في البيانات
            data[medIndex].remainingQuantity = newQty;
            data[medIndex].updatedAt = new Date().toISOString();
            data[medIndex].updatedBy = dispensedBy || 'System';
            
            // تحديث الحالة إذا انتهت الكمية
            if (newQty === 0) {
                data[medIndex].status = 'منتهي';
                Logger.log('🔴 [DEDUCT] الحالة: منتهي (الكمية = 0)');
            } else if (newQty <= 10) {
                data[medIndex].status = 'منخفض';
                Logger.log('🟡 [DEDUCT] الحالة: منخفض (الكمية <= 10)');
            }
            
            results.deducted.push({
                medicationName: medName,
                medicationId: medId || data[medIndex].id,
                previousQuantity: currentQty,
                deductedQuantity: quantityToDeduct,
                newQuantity: newQty,
                visitId: visitId,
                rowIndex: medIndex + 2 // +2 لأن الصفوف تبدأ من 1 وهناك header
            });
            
            Logger.log('✅ [DEDUCT] تم تحضير خصم ' + quantityToDeduct + ' من ' + medName + ' (الصف: ' + (medIndex + 2) + ')');
        }
        
        // ✅ حفظ التحديثات في المخزون - تحديث صف بصف
        if (results.deducted.length > 0) {
            Logger.log('💾 [DEDUCT] بدء حفظ ' + results.deducted.length + ' تحديثات في المخزون...');
            
            let saveSuccessCount = 0;
            let saveFailCount = 0;
            
            for (let i = 0; i < results.deducted.length; i++) {
                const deduct = results.deducted[i];
                const rowIndex = deduct.rowIndex;
                const medData = data[rowIndex - 2]; // -2 لأن الصفوف تبدأ من 1
                
                try {
                    // ✅ استخدام updateSingleRowInSheet لتحديث صف محدد
                    const updateResult = updateSingleRowInSheet(sheetName, medData, rowIndex, spreadsheetId);
                    
                    if (updateResult && updateResult.success) {
                        saveSuccessCount++;
                        results.updatesApplied.push({
                            medicationName: deduct.medicationName,
                            rowIndex: rowIndex,
                            newQuantity: deduct.newQuantity,
                            saved: true
                        });
                        Logger.log('✅ [DEDUCT] تم حفظ تحديث ' + deduct.medicationName + ' في الصف ' + rowIndex);
                    } else {
                        saveFailCount++;
                        results.updatesApplied.push({
                            medicationName: deduct.medicationName,
                            rowIndex: rowIndex,
                            saved: false,
                            error: updateResult ? updateResult.message : 'خطأ غير معروف'
                        });
                        Logger.log('❌ [DEDUCT] فشل حفظ تحديث ' + deduct.medicationName + ' في الصف ' + rowIndex);
                    }
                } catch (saveError) {
                    saveFailCount++;
                    results.updatesApplied.push({
                        medicationName: deduct.medicationName,
                        rowIndex: rowIndex,
                        saved: false,
                        error: saveError.toString()
                    });
                    Logger.log('❌ [DEDUCT] خطأ في حفظ تحديث ' + deduct.medicationName + ': ' + saveError.toString());
                }
            }
            
            Logger.log('💾 [DEDUCT] نتيجة الحفظ: نجح ' + saveSuccessCount + ', فشل ' + saveFailCount);
            
            if (saveFailCount > 0 && saveSuccessCount === 0) {
                results.success = false;
                results.message = 'فشل حفظ جميع التحديثات في المخزون';
                return results;
            } else if (saveFailCount > 0) {
                results.message = 'تم خصم ' + saveSuccessCount + ' أدوية، فشل حفظ ' + saveFailCount;
                results.success = true; // نجاح جزئي
            } else {
                results.message = 'تم خصم وحفظ ' + results.deducted.length + ' أدوية بنجاح';
            }
            
            // ✅ تسجيل في سجل الصرف
            try {
                for (let i = 0; i < saveSuccessCount && i < results.deducted.length; i++) {
                    const deduct = results.deducted[i];
                    const logEntry = {
                        id: generateSequentialId('MDL', logSheetName),
                        visitId: visitId,
                        medicationId: deduct.medicationId,
                        medicationName: deduct.medicationName,
                        previousQuantity: deduct.previousQuantity,
                        deductedQuantity: deduct.deductedQuantity,
                        newQuantity: deduct.newQuantity,
                        dispensedBy: dispensedBy || 'System',
                        dispensedAt: new Date().toISOString(),
                        notes: 'صرف عيادة - زيارة #' + visitId
                    };
                    const appendResult = appendToSheet(logSheetName, logEntry);
                    if (appendResult && appendResult.success) {
                        Logger.log('✅ [DEDUCT] تم تسجيل عملية الصرف في السجل');
                    }
                }
            } catch (logError) {
                Logger.log('⚠️ [DEDUCT] خطأ في تسجيل السجل: ' + logError.toString());
            }
        } else {
            results.message = 'لم يتم خصم أي أدوية';
            results.success = results.failed.length === 0;
        }
        
        // إعداد الرسالة النهائية
        if (results.failed.length > 0 && results.deducted.length === 0) {
            results.message = 'فشل خصم جميع الأدوية: ' + results.failed.map(f => f.reason).join(', ');
            results.success = false;
        }
        
        Logger.log('✅ [DEDUCT] النتيجة النهائية: ' + JSON.stringify({
            success: results.success,
            deducted: results.deducted.length,
            failed: results.failed.length,
            saved: results.updatesApplied.filter(u => u.saved).length
        }));
        
        return results;
        
    } catch (error) {
        Logger.log('❌ [DEDUCT] خطأ في deductMedicationsFromInventory_: ' + error.toString());
        Logger.log('❌ [DEDUCT] Stack: ' + (error.stack || 'No stack'));
        return {
            success: false,
            message: 'خطأ في خصم الأدوية: ' + error.toString(),
            error: error.toString(),
            stack: error.stack
        };
    }
}

/**
 * تحديث دواء
 */
function updateMedication(medicationId, updateData) {
    try {
        if (!medicationId) {
            return { success: false, message: 'معرف الدواء غير محدد' };
        }
        
        const sheetName = 'Medications';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const medicationIndex = data.findIndex(m => m.id === medicationId);
        
        if (medicationIndex === -1) {
            return { success: false, message: 'الدواء غير موجود' };
        }
        
        updateData.updatedAt = new Date();

        // ✅ تأكيد أن الحقول الرقمية تُحفظ كأرقام
        if (updateData.quantityAdded !== undefined && updateData.quantityAdded !== null) {
            updateData.quantityAdded = parseFloat(updateData.quantityAdded) || 0;
        }
        if (updateData.remainingQuantity !== undefined && updateData.remainingQuantity !== null) {
            updateData.remainingQuantity = parseFloat(updateData.remainingQuantity) || 0;
        }
        if (updateData.quantity !== undefined && updateData.quantity !== null) {
            updateData.quantity = parseFloat(updateData.quantity) || 0;
        }

        // ✅ تطبيع الكمية/الرصيد عند التحديث أيضاً
        if (updateData.quantityAdded === undefined || updateData.quantityAdded === null) {
            if (updateData.quantity !== undefined && updateData.quantity !== null) {
                updateData.quantityAdded = updateData.quantity;
            }
        }
        if (updateData.remainingQuantity === undefined || updateData.remainingQuantity === null) {
            if (updateData.quantityAdded !== undefined && updateData.quantityAdded !== null) {
                updateData.remainingQuantity = updateData.quantityAdded;
            } else if (updateData.quantity !== undefined && updateData.quantity !== null) {
                updateData.remainingQuantity = updateData.quantity;
            }
        }

        // ✅ منع تخزين JSON في أي خلية: createdBy يتم تخزينه كنص فقط (اسم/بريد)
        if (updateData.createdBy && typeof updateData.createdBy === 'object') {
            updateData.createdBy = (updateData.createdBy.name || updateData.createdBy.email || '').toString();
        }
        // ✅ إضافة updatedBy (تخزين كنص فقط)
        if (updateData.updatedBy && typeof updateData.updatedBy === 'object') {
            updateData.updatedBy = (updateData.updatedBy.name || updateData.updatedBy.email || '').toString();
        }
        if (!updateData.updatedBy) {
            // إذا لم يتم تمرير updatedBy، نستخدم createdBy من السجل الحالي أو القيمة الافتراضية
            const existing = data[medicationIndex];
            updateData.updatedBy = existing?.createdBy || existing?.updatedBy || 'النظام';
        }
        
        // إعادة حساب الأيام المتبقية إذا تم تحديث تاريخ الانتهاء
        if (updateData.expiryDate) {
            const expiryDate = new Date(updateData.expiryDate);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            updateData.daysRemaining = daysRemaining;

            // حساب الرصيد المتبقي
            const remainingQuantity = parseFloat(updateData.remainingQuantity ?? updateData.quantityAdded ?? updateData.quantity ?? data[medicationIndex].remainingQuantity ?? data[medicationIndex].quantity ?? 0);
            const hasStock = remainingQuantity > 0;

            if (daysRemaining < 0) {
                updateData.status = 'منتهي';
            } else if (daysRemaining <= 30) {
                // ✅ مهم: عرض "قريب الانتهاء" فقط إذا كان هناك رصيد متبقي
                updateData.status = hasStock ? 'قريب الانتهاء' : 'ساري';
            } else {
                updateData.status = updateData.status || 'ساري';
            }
        }
        
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[medicationIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating medication: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الدواء: ' + error.toString() };
    }
}

/**
 * حذف دواء
 */
function deleteMedication(medicationId) {
    try {
        if (!medicationId) {
            return { success: false, message: 'معرف الدواء غير محدد' };
        }
        
        const sheetName = 'Medications';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(m => m.id !== medicationId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'الدواء غير موجود' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting medication: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الدواء: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الأدوية
 */
function getAllMedications(filters = {}) {
    try {
        const sheetName = 'Medications';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        const now = new Date();

        // ✅ إعادة حساب الحالة ديناميكياً لكل دواء بدلاً من الاعتماد على القيمة المخزنة
        // هذا يضمن تطبيق المنطق الجديد (قريب الانتهاء فقط عند وجود رصيد > 0)
        data = (data || []).map(m => {
            if (!m || typeof m !== 'object') return m;
            
            if (m.createdBy && typeof m.createdBy === 'string' && m.createdBy.trim() !== '') {
                m.createdBy = { name: m.createdBy, id: m.createdById || '' };
            }
            
            // إعادة حساب الحالة والأيام المتبقية ديناميكياً
            if (m.expiryDate) {
                const expiryDate = new Date(m.expiryDate);
                if (!isNaN(expiryDate.getTime())) {
                    const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                    m.daysRemaining = daysRemaining;
                    
                    // حساب الرصيد المتبقي
                    const remainingQuantity = parseFloat(m.remainingQuantity ?? m.quantityAdded ?? m.quantity ?? 0);
                    const hasStock = remainingQuantity > 0;
                    
                    // تطبيق المنطق الجديد
                    if (daysRemaining < 0) {
                        m.status = 'منتهي';
                    } else if (daysRemaining <= 30) {
                        m.status = hasStock ? 'قريب الانتهاء' : 'ساري';
                    } else {
                        m.status = 'ساري';
                    }
                }
            }
            
            return m;
        });
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(m => m.status === filters.status);
        }
        if (filters.type) {
            data = data.filter(m => m.type === filters.type);
        }
        if (filters.expiringSoon) {
            const now = new Date();
            data = data.filter(m => {
                if (!m.expiryDate) return false;
                const expiryDate = new Date(m.expiryDate);
                const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                
                // ✅ مهم: عرض "قريب الانتهاء" فقط إذا كان هناك رصيد متبقي
                const remainingQuantity = parseFloat(m.remainingQuantity ?? m.quantityAdded ?? m.quantity ?? 0);
                const hasStock = remainingQuantity > 0;
                
                return daysRemaining >= 0 && daysRemaining <= 30 && hasStock;
            });
        }
        
        // ترتيب حسب تاريخ الانتهاء
        data.sort((a, b) => {
            const dateA = new Date(a.expiryDate || '9999-12-31');
            const dateB = new Date(b.expiryDate || '9999-12-31');
            return dateA - dateB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all medications: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الأدوية: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على الأدوية المنتهية أو التي تنتهي قريباً
 */
function getMedicationAlerts() {
    try {
        const sheetName = 'Medications';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const now = new Date();
        
        const alerts = {
            expired: [],
            expiringSoon: [],
            lowStock: []
        };
        
        data.forEach(medication => {
            // الأدوية المنتهية
            if (medication.expiryDate) {
                const expiryDate = new Date(medication.expiryDate);
                if (expiryDate < now) {
                    alerts.expired.push(medication);
                } else {
                    const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                    if (daysRemaining <= 30) {
                        // ✅ مهم: عرض "قريب الانتهاء" فقط إذا كان هناك رصيد متبقي
                        const remaining = parseFloat(medication.remainingQuantity ?? medication.quantityAdded ?? medication.quantity ?? 0);
                        if (remaining > 0) {
                            alerts.expiringSoon.push(medication);
                        }
                    }
                }
            }

            // المخزون المنخفض
            const remaining = parseFloat(medication.remainingQuantity ?? medication.quantityAdded ?? medication.quantity ?? 0);
            if (remaining > 0 && remaining <= 10) {
                alerts.lowStock.push(medication);
            }
        });
        
        return { success: true, data: alerts };
    } catch (error) {
        Logger.log('Error getting medication alerts: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على التنبيهات: ' + error.toString() };
    }
}

/**
 * ============================================
 * الإجازات المرضية (Sick Leave)
 * ============================================
 */

/**
 * إضافة إجازة مرضية
 */
function addSickLeaveToSheet(sickLeaveData) {
    try {
        if (!sickLeaveData) {
            return { success: false, message: 'بيانات الإجازة غير موجودة' };
        }
        
        const sheetName = 'SickLeave';
        
        // ✅ حذف userData لمنع تخزينها في Google Sheets
        if (sickLeaveData && sickLeaveData.userData) {
            try { delete sickLeaveData.userData; } catch (e) {}
        }
        
        // إضافة حقول تلقائية
        if (!sickLeaveData.id) {
            sickLeaveData.id = generateSequentialId('SKL', sheetName);
        }
        if (!sickLeaveData.createdAt) {
            sickLeaveData.createdAt = new Date();
        }
        if (!sickLeaveData.updatedAt) {
            sickLeaveData.updatedAt = new Date();
        }
        if (!sickLeaveData.status) {
            sickLeaveData.status = 'قيد المراجعة';
        }
        
        // ✅ إضافة createdBy و updatedBy (تخزين كنص فقط)
        if (sickLeaveData.createdBy && typeof sickLeaveData.createdBy === 'object') {
            sickLeaveData.createdBy = (sickLeaveData.createdBy.name || sickLeaveData.createdBy.email || '').toString();
        }
        if (sickLeaveData.updatedBy && typeof sickLeaveData.updatedBy === 'object') {
            sickLeaveData.updatedBy = (sickLeaveData.updatedBy.name || sickLeaveData.updatedBy.email || '').toString();
        }
        if (!sickLeaveData.updatedBy && sickLeaveData.createdBy) {
            sickLeaveData.updatedBy = sickLeaveData.createdBy;
        }
        
        // حساب عدد الأيام
        if (sickLeaveData.startDate && sickLeaveData.endDate) {
            const start = new Date(sickLeaveData.startDate);
            const end = new Date(sickLeaveData.endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            sickLeaveData.daysCount = days;
        }
        
        return appendToSheet(sheetName, sickLeaveData);
    } catch (error) {
        Logger.log('Error in addSickLeaveToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإجازة: ' + error.toString() };
    }
}

/**
 * تحديث إجازة مرضية
 */
function updateSickLeave(leaveId, updateData) {
    try {
        if (!leaveId) {
            return { success: false, message: 'معرف الإجازة غير محدد' };
        }
        
        const sheetName = 'SickLeave';
        const spreadsheetId = getSpreadsheetId();

        // لا نحفظ userData في الشيت (إن وُجدت)
        if (updateData && updateData.userData) {
            try { delete updateData.userData; } catch (e) {}
        }

        updateData.updatedAt = new Date();
        
        // ✅ إضافة updatedBy (تخزين كنص فقط)
        if (updateData.updatedBy && typeof updateData.updatedBy === 'object') {
            updateData.updatedBy = (updateData.updatedBy.name || updateData.updatedBy.email || '').toString();
        }
        if (!updateData.updatedBy) {
            // إذا لم يتم تمرير updatedBy، نستخدم createdBy من السجل الحالي أو القيمة الافتراضية
            const existing = readFromSheet(sheetName, spreadsheetId).find(l => l && l.id === leaveId) || {};
            updateData.updatedBy = existing?.createdBy || existing?.updatedBy || 'النظام';
        }
        
        // إعادة حساب عدد الأيام إذا تم تحديث التواريخ
        if (updateData.startDate || updateData.endDate) {
            // نستخدم القيم الجديدة إن وُجدت، وإلا نستخدم القيم الحالية في الشيت
            const existing = readFromSheet(sheetName, spreadsheetId).find(l => l && l.id === leaveId) || {};
            const start = new Date(updateData.startDate || existing.startDate || new Date());
            const end = new Date(updateData.endDate || existing.endDate || updateData.startDate || existing.startDate || new Date());
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            updateData.daysCount = days;
        }

        // ✅ تحديث صف واحد فقط (بدون استبدال/مسح بيانات أخرى)
        return updateSingleRowInSheet(sheetName, leaveId, updateData, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating sick leave: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الإجازة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الإجازات المرضية
 */
function getAllSickLeaves(filters = {}) {
    try {
        const sheetName = 'SickLeave';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.employeeCode) {
            data = data.filter(l => l.employeeCode === filters.employeeCode);
        }
        if (filters.status) {
            data = data.filter(l => l.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(l => {
                if (!l.startDate) return false;
                return new Date(l.startDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(l => {
                if (!l.endDate) return false;
                return new Date(l.endDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب تاريخ البدء
        data.sort((a, b) => {
            const dateA = new Date(a.startDate || a.createdAt || 0);
            const dateB = new Date(b.startDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all sick leaves: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإجازات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * الإصابات (Injuries)
 * ============================================
 */

/**
 * إضافة إصابة
 */
function addInjuryToSheet(injuryData) {
    try {
        if (!injuryData) {
            return { success: false, message: 'بيانات الإصابة غير موجودة' };
        }

        // ✅ فصل الإصابات حسب النوع: موظفين/مقاولين
        if (!injuryData.personType) {
            injuryData.personType = normalizeClinicPersonType_(injuryData.personType, injuryData);
        } else {
            injuryData.personType = normalizeClinicPersonType_(injuryData.personType, injuryData);
        }
        const sheetName = getClinicInjurySheetName_(injuryData);
        
        // إضافة حقول تلقائية
        if (!injuryData.id) {
            injuryData.id = generateSequentialId('INJ', sheetName);
        }
        if (!injuryData.createdAt) {
            injuryData.createdAt = new Date();
        }
        if (!injuryData.updatedAt) {
            injuryData.updatedAt = new Date();
        }
        
        // ✅ إضافة createdBy و updatedBy (تخزين كنص فقط)
        if (injuryData.createdBy && typeof injuryData.createdBy === 'object') {
            injuryData.createdBy = (injuryData.createdBy.name || injuryData.createdBy.email || '').toString();
        }
        if (injuryData.updatedBy && typeof injuryData.updatedBy === 'object') {
            injuryData.updatedBy = (injuryData.updatedBy.name || injuryData.updatedBy.email || '').toString();
        }
        if (!injuryData.createdBy && !injuryData.updatedBy) {
            injuryData.createdBy = injuryData.createdBy || 'النظام';
            injuryData.updatedBy = injuryData.updatedBy || 'النظام';
        }
        if (!injuryData.updatedBy && injuryData.createdBy) {
            injuryData.updatedBy = injuryData.createdBy;
        }
        
        return appendToSheet(sheetName, injuryData);
    } catch (error) {
        Logger.log('Error in addInjuryToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإصابة: ' + error.toString() };
    }
}

/**
 * تحديث إصابة
 */
function updateInjury(injuryId, updateData) {
    try {
        if (!injuryId) {
            return { success: false, message: 'معرف الإصابة غير محدد' };
        }

        const spreadsheetId = getSpreadsheetId();
        const sheetCandidates = ['Injuries', 'ClinicContractorInjuries'];
        let foundSheetName = null;
        let foundData = null;
        let injuryIndex = -1;

        for (var si = 0; si < sheetCandidates.length; si++) {
            const sn = sheetCandidates[si];
            const d = readFromSheet(sn, spreadsheetId) || [];
            const idx = d.findIndex(i => String(i.id || '').trim() === String(injuryId).trim());
            if (idx !== -1) {
                foundSheetName = sn;
                foundData = d;
                injuryIndex = idx;
                break;
            }
        }

        if (!foundSheetName || !foundData || injuryIndex === -1) {
            return { success: false, message: 'الإصابة غير موجودة' };
        }

        updateData.updatedAt = new Date();

        // ✅ تطبيع personType عند التحديث إن وُجد
        if (updateData.personType) {
            updateData.personType = normalizeClinicPersonType_(updateData.personType, updateData);
        }

        // ✅ إضافة updatedBy (تخزين كنص فقط)
        if (updateData.updatedBy && typeof updateData.updatedBy === 'object') {
            updateData.updatedBy = (updateData.updatedBy.name || updateData.updatedBy.email || '').toString();
        }
        if (!updateData.updatedBy) {
            const existing = foundData[injuryIndex];
            updateData.updatedBy = existing?.createdBy || existing?.updatedBy || 'النظام';
        }

        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                foundData[injuryIndex][key] = updateData[key];
            }
        }

        return saveToSheet(foundSheetName, foundData, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating injury: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الإصابة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الإصابات
 */
function getAllInjuries(filters = {}) {
    try {
        const spreadsheetId = getSpreadsheetId();

        // ✅ تأكد من وجود شيتات الإصابات وتحديث رؤوسها
        try {
            const ss = SpreadsheetApp.openById(spreadsheetId);
            const empSheet = createSheetWithHeaders(ss, 'Injuries', {});
            ensureSheetHeaders(empSheet, 'Injuries', {});
            const conSheet = createSheetWithHeaders(ss, 'ClinicContractorInjuries', {});
            ensureSheetHeaders(conSheet, 'ClinicContractorInjuries', {});
        } catch (e) {
            Logger.log('Warning ensuring injuries sheets headers: ' + e.toString());
        }

        const employeeData = readFromSheet('Injuries', spreadsheetId) || [];
        const contractorData = readFromSheet('ClinicContractorInjuries', spreadsheetId) || [];
        let data = employeeData.concat(contractorData);
        
        // تطبيق الفلاتر
        if (filters.employeeCode) {
            data = data.filter(i => i.employeeCode === filters.employeeCode);
        }
        if (filters.personType) {
            data = data.filter(i => String(i.personType || '').toLowerCase() === String(filters.personType || '').toLowerCase());
        }
        if (filters.injuryType) {
            data = data.filter(i => i.injuryType === filters.injuryType);
        }
        if (filters.startDate) {
            data = data.filter(i => {
                if (!i.injuryDate) return false;
                return new Date(i.injuryDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(i => {
                if (!i.injuryDate) return false;
                return new Date(i.injuryDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب تاريخ الإصابة
        data.sort((a, b) => {
            const dateA = new Date(a.injuryDate || a.createdAt || 0);
            const dateB = new Date(b.injuryDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all injuries: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإصابات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * مخزون العيادة (Clinic Inventory)
 * ============================================
 */

/**
 * إضافة مخزون العيادة
 */
function addClinicInventoryToSheet(inventoryData) {
    try {
        if (!inventoryData) {
            return { success: false, message: 'بيانات المخزون غير موجودة' };
        }
        
        const sheetName = 'ClinicInventory';
        
        // إضافة حقول تلقائية
        if (!inventoryData.id) {
            inventoryData.id = generateSequentialId('CLI', sheetName);
        }
        if (!inventoryData.createdAt) {
            inventoryData.createdAt = new Date();
        }
        if (!inventoryData.updatedAt) {
            inventoryData.updatedAt = new Date();
        }
        
        // ✅ إضافة createdBy و updatedBy (تخزين كنص فقط)
        if (inventoryData.createdBy && typeof inventoryData.createdBy === 'object') {
            inventoryData.createdBy = (inventoryData.createdBy.name || inventoryData.createdBy.email || '').toString();
        }
        if (inventoryData.updatedBy && typeof inventoryData.updatedBy === 'object') {
            inventoryData.updatedBy = (inventoryData.updatedBy.name || inventoryData.updatedBy.email || '').toString();
        }
        if (!inventoryData.createdBy && !inventoryData.updatedBy) {
            inventoryData.createdBy = inventoryData.createdBy || 'النظام';
            inventoryData.updatedBy = inventoryData.updatedBy || 'النظام';
        }
        if (!inventoryData.updatedBy && inventoryData.createdBy) {
            inventoryData.updatedBy = inventoryData.createdBy;
        }
        
        return appendToSheet(sheetName, inventoryData);
    } catch (error) {
        Logger.log('Error in addClinicInventoryToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المخزون: ' + error.toString() };
    }
}

/**
 * تحديث مخزون العيادة
 */
function updateClinicInventory(inventoryId, updateData) {
    try {
        if (!inventoryId) {
            return { success: false, message: 'معرف المخزون غير محدد' };
        }
        
        const sheetName = 'ClinicInventory';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const inventoryIndex = data.findIndex(inv => inv.id === inventoryId);
        
        if (inventoryIndex === -1) {
            return { success: false, message: 'المخزون غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        
        // ✅ إضافة updatedBy (تخزين كنص فقط)
        if (updateData.updatedBy && typeof updateData.updatedBy === 'object') {
            updateData.updatedBy = (updateData.updatedBy.name || updateData.updatedBy.email || '').toString();
        }
        if (!updateData.updatedBy) {
            // إذا لم يتم تمرير updatedBy، نستخدم createdBy من السجل الحالي أو القيمة الافتراضية
            const existing = data[inventoryIndex];
            updateData.updatedBy = existing?.createdBy || existing?.updatedBy || 'النظام';
        }
        
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[inventoryIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating clinic inventory: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المخزون: ' + error.toString() };
    }
}

/**
 * الحصول على جميع مخزون العيادة
 */
function getAllClinicInventory(filters = {}) {
    try {
        const sheetName = 'ClinicInventory';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.location) {
            data = data.filter(inv => inv.location === filters.location);
        }
        if (filters.lowStock) {
            data = data.filter(inv => {
                const quantity = parseFloat(inv.quantity || 0);
                return quantity > 0 && quantity <= 10;
            });
        }
        if (filters.expiringSoon) {
            const now = new Date();
            data = data.filter(inv => {
                if (!inv.expiryDate) return false;
                const expiryDate = new Date(inv.expiryDate);
                const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                return daysRemaining >= 0 && daysRemaining <= 30;
            });
        }
        
        // ترتيب حسب تاريخ الانتهاء
        data.sort((a, b) => {
            const dateA = new Date(a.expiryDate || '9999-12-31');
            const dateB = new Date(b.expiryDate || '9999-12-31');
            return dateA - dateB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all clinic inventory: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المخزون: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * نظام الموافقات على حذف الأدوية (Medication Deletion Approvals)
 * ============================================
 */

/**
 * إضافة طلب موافقة على حذف دواء
 */
function addMedicationDeletionRequest(requestData) {
    try {
        if (!requestData) {
            return { success: false, message: 'بيانات الطلب غير موجودة' };
        }
        
        const sheetName = 'MedicationDeletionRequests';
        
        // إضافة حقول تلقائية
        if (!requestData.id) {
            requestData.id = generateSequentialId('MDR', sheetName);
        }
        if (!requestData.createdAt) {
            requestData.createdAt = new Date();
        }
        if (!requestData.status) {
            requestData.status = 'pending'; // pending, approved, rejected
        }
        
        // حفظ معلومات الدواء كاملة
        if (requestData.medicationData && typeof requestData.medicationData === 'object') {
            requestData.medicationDataJSON = JSON.stringify(requestData.medicationData);
        }
        
        // حفظ معلومات مقدم الطلب
        if (requestData.requestedBy && typeof requestData.requestedBy === 'object') {
            requestData.requestedByJSON = JSON.stringify(requestData.requestedBy);
        }
        
        return appendToSheet(sheetName, requestData);
    } catch (error) {
        Logger.log('Error in addMedicationDeletionRequest: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة طلب الموافقة: ' + error.toString() };
    }
}

/**
 * تحديث حالة طلب موافقة على حذف دواء
 */
function updateMedicationDeletionRequest(requestId, updateData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        const sheetName = 'MedicationDeletionRequests';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const requestIndex = data.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            return { success: false, message: 'الطلب غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        
        // إذا كانت هناك بيانات approvedBy/rejectedBy، تحويلها إلى JSON
        if (updateData.approvedBy && typeof updateData.approvedBy === 'object') {
            updateData.approvedByJSON = JSON.stringify(updateData.approvedBy);
        }
        if (updateData.rejectedBy && typeof updateData.rejectedBy === 'object') {
            updateData.rejectedByJSON = JSON.stringify(updateData.rejectedBy);
        }
        
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[requestIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating medication deletion request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الطلب: ' + error.toString() };
    }
}

/**
 * الحصول على جميع طلبات موافقة حذف الأدوية
 */
function getAllMedicationDeletionRequests(filters = {}) {
    try {
        const sheetName = 'MedicationDeletionRequests';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        if (filters.requestedById) {
            data = data.filter(r => r.requestedById === filters.requestedById);
        }
        
        // ترتيب حسب تاريخ الطلب (الأحدث أولاً)
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        // تحويل JSON strings إلى objects
        data = data.map(request => {
            if (request.medicationDataJSON) {
                try {
                    request.medicationData = JSON.parse(request.medicationDataJSON);
                } catch (e) {
                    Logger.log('Error parsing medicationDataJSON: ' + e.toString());
                }
            }
            if (request.requestedByJSON) {
                try {
                    request.requestedBy = JSON.parse(request.requestedByJSON);
                } catch (e) {
                    Logger.log('Error parsing requestedByJSON: ' + e.toString());
                }
            }
            if (request.approvedByJSON) {
                try {
                    request.approvedBy = JSON.parse(request.approvedByJSON);
                } catch (e) {
                    Logger.log('Error parsing approvedByJSON: ' + e.toString());
                }
            }
            if (request.rejectedByJSON) {
                try {
                    request.rejectedBy = JSON.parse(request.rejectedByJSON);
                } catch (e) {
                    Logger.log('Error parsing rejectedByJSON: ' + e.toString());
                }
            }
            return request;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting medication deletion requests: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة طلبات الموافقة: ' + error.toString(), data: [] };
    }
}

/**
 * الموافقة على طلب حذف دواء
 */
function approveMedicationDeletion(requestId, approverData) {
    try {
        // تحديث حالة الطلب
        const updateResult = updateMedicationDeletionRequest(requestId, {
            status: 'approved',
            approvedBy: approverData,
            approvedById: approverData.id || approverData.userId,
            approvedAt: new Date()
        });
        
        if (!updateResult.success) {
            return updateResult;
        }
        
        // الحصول على بيانات الطلب
        const requestsResult = getAllMedicationDeletionRequests();
        if (!requestsResult.success) {
            return requestsResult;
        }
        
        const request = requestsResult.data.find(r => r.id === requestId);
        if (!request) {
            return { success: false, message: 'الطلب غير موجود' };
        }
        
        // حذف الدواء فعلياً
        const medicationId = request.medicationId;
        if (medicationId) {
            const deleteResult = deleteMedication(medicationId);
            if (!deleteResult.success) {
                // إذا فشل الحذف، نعيد حالة الطلب
                updateMedicationDeletionRequest(requestId, {
                    status: 'pending',
                    approvedBy: null,
                    approvedById: null,
                    approvedAt: null,
                    notes: 'فشل حذف الدواء: ' + deleteResult.message
                });
                return deleteResult;
            }
        }
        
        return { success: true, message: 'تمت الموافقة وحذف الدواء بنجاح' };
    } catch (error) {
        Logger.log('Error approving medication deletion: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الموافقة على الحذف: ' + error.toString() };
    }
}

/**
 * رفض طلب حذف دواء
 */
function rejectMedicationDeletion(requestId, rejectorData, reason) {
    try {
        const updateResult = updateMedicationDeletionRequest(requestId, {
            status: 'rejected',
            rejectedBy: rejectorData,
            rejectedById: rejectorData.id || rejectorData.userId,
            rejectedAt: new Date(),
            rejectionReason: reason || ''
        });
        
        return updateResult;
    } catch (error) {
        Logger.log('Error rejecting medication deletion: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء رفض الطلب: ' + error.toString() };
    }
}

/**
 * ============================================
 * نظام الموافقات على حذف الزيارات (Clinic Visit Deletion Approvals)
 * ============================================
 */

function addClinicVisitDeletionRequest(requestData) {
    try {
        if (!requestData) {
            return { success: false, message: 'بيانات الطلب غير موجودة' };
        }
        
        const sheetName = 'ClinicVisitDeletionRequests';
        
        if (!requestData.id) {
            requestData.id = generateSequentialId('CVDR', sheetName);
        }
        if (!requestData.createdAt) {
            requestData.createdAt = new Date();
        }
        if (!requestData.status) {
            requestData.status = 'pending'; // pending, approved, rejected
        }
        
        // حفظ بيانات الزيارة كاملة
        if (requestData.visitData && typeof requestData.visitData === 'object') {
            requestData.visitDataJSON = JSON.stringify(requestData.visitData);
        }
        
        // حفظ بيانات مقدم الطلب
        if (requestData.requestedBy && typeof requestData.requestedBy === 'object') {
            requestData.requestedByJSON = JSON.stringify(requestData.requestedBy);
            requestData.requestedById = requestData.requestedBy.id || requestData.requestedBy.userId || '';
            requestData.requestedByName = requestData.requestedBy.name || '';
        }
        
        return appendToSheet(sheetName, requestData);
    } catch (error) {
        Logger.log('Error in addClinicVisitDeletionRequest: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة طلب حذف الزيارة: ' + error.toString() };
    }
}

function updateClinicVisitDeletionRequest(requestId, updateData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        const sheetName = 'ClinicVisitDeletionRequests';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const requestIndex = data.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            return { success: false, message: 'الطلب غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        
        if (updateData.approvedBy && typeof updateData.approvedBy === 'object') {
            updateData.approvedByJSON = JSON.stringify(updateData.approvedBy);
        }
        if (updateData.rejectedBy && typeof updateData.rejectedBy === 'object') {
            updateData.rejectedByJSON = JSON.stringify(updateData.rejectedBy);
        }
        
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[requestIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating clinic visit deletion request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الطلب: ' + error.toString() };
    }
}

function getAllClinicVisitDeletionRequests(filters = {}) {
    try {
        const sheetName = 'ClinicVisitDeletionRequests';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        if (filters.requestedById) {
            data = data.filter(r => r.requestedById === filters.requestedById);
        }
        
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        data = data.map(request => {
            if (request.visitDataJSON) {
                try {
                    request.visitData = JSON.parse(request.visitDataJSON);
                } catch (e) {
                    Logger.log('Error parsing visitDataJSON: ' + e.toString());
                }
            }
            if (request.requestedByJSON) {
                try {
                    request.requestedBy = JSON.parse(request.requestedByJSON);
                } catch (e) {
                    Logger.log('Error parsing requestedByJSON: ' + e.toString());
                }
            }
            if (request.approvedByJSON) {
                try {
                    request.approvedBy = JSON.parse(request.approvedByJSON);
                } catch (e) {
                    Logger.log('Error parsing approvedByJSON: ' + e.toString());
                }
            }
            if (request.rejectedByJSON) {
                try {
                    request.rejectedBy = JSON.parse(request.rejectedByJSON);
                } catch (e) {
                    Logger.log('Error parsing rejectedByJSON: ' + e.toString());
                }
            }
            return request;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting clinic visit deletion requests: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة طلبات حذف الزيارات: ' + error.toString(), data: [] };
    }
}

function approveClinicVisitDeletion(requestId, approverData) {
    try {
        const updateResult = updateClinicVisitDeletionRequest(requestId, {
            status: 'approved',
            approvedBy: approverData,
            approvedById: approverData.id || approverData.userId,
            approvedAt: new Date()
        });
        if (!updateResult.success) return updateResult;
        
        const requestsResult = getAllClinicVisitDeletionRequests();
        if (!requestsResult.success) return requestsResult;
        
        const request = requestsResult.data.find(r => r.id === requestId);
        if (!request) return { success: false, message: 'الطلب غير موجود' };
        
        const visitId = request.visitId || (request.visitData && request.visitData.id);
        if (!visitId) {
            return { success: false, message: 'معرف الزيارة غير موجود في الطلب' };
        }
        
        // حذف الزيارة فعلياً
        const saveResult = deleteClinicVisit(visitId);
        if (!saveResult.success) {
            // rollback
            updateClinicVisitDeletionRequest(requestId, {
                status: 'pending',
                approvedBy: null,
                approvedById: null,
                approvedAt: null,
                notes: 'فشل حذف الزيارة: ' + (saveResult.message || '')
            });
            return saveResult;
        }
        
        return { success: true, message: 'تمت الموافقة وحذف الزيارة بنجاح' };
    } catch (error) {
        Logger.log('Error approving clinic visit deletion: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الموافقة على حذف الزيارة: ' + error.toString() };
    }
}

function deleteClinicVisit(visitId) {
    try {
        if (!visitId) {
            return { success: false, message: 'معرف الزيارة غير محدد' };
        }
        const sheetName = 'ClinicVisits';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ تحسين الأداء: حذف الصف مباشرة بدلاً من قراءة وإعادة كتابة كل البيانات
        const visits = readFromSheet(sheetName, spreadsheetId);
        let rowIndex = -1;
        
        for (let i = 0; i < visits.length; i++) {
            if (visits[i].id === visitId) {
                rowIndex = i + 2; // +2 لأن الصف 1 هو الهيدر والـ array يبدأ من 0
                break;
            }
        }
        
        if (rowIndex === -1) {
            return { success: false, message: 'الزيارة غير موجودة' };
        }
        
        // حذف الصف مباشرة من الشيت
        var ss = SpreadsheetApp.openById(spreadsheetId);
        var sheet = ss.getSheetByName(sheetName);
        sheet.deleteRow(rowIndex);
        
        Logger.log('تم حذف الزيارة ' + visitId + ' من الصف ' + rowIndex);
        return { success: true, message: 'تم حذف الزيارة بنجاح' };
    } catch (error) {
        Logger.log('Error deleting clinic visit: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الزيارة: ' + error.toString() };
    }
}

function rejectClinicVisitDeletion(requestId, rejectorData, reason) {
    try {
        return updateClinicVisitDeletionRequest(requestId, {
            status: 'rejected',
            rejectedBy: rejectorData,
            rejectedById: rejectorData.id || rejectorData.userId,
            rejectedAt: new Date(),
            rejectionReason: reason || ''
        });
    } catch (error) {
        Logger.log('Error rejecting clinic visit deletion: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء رفض طلب حذف الزيارة: ' + error.toString() };
    }
}

/**
 * ============================================
 * طلبات الاحتياج (Supply Requests)
 * ============================================
 */

/**
 * إضافة طلب احتياج
 */
function addSupplyRequest(requestData) {
    try {
        if (!requestData) {
            return { success: false, message: 'بيانات الطلب غير موجودة' };
        }
        
        const sheetName = 'ClinicSupplyRequests';
        
        // إضافة حقول تلقائية
        if (!requestData.id) {
            requestData.id = generateSequentialId('CSR', sheetName);
        }
        if (!requestData.createdAt) {
            requestData.createdAt = new Date();
        }
        if (!requestData.requestDate) {
            requestData.requestDate = new Date();
        }
        if (!requestData.status) {
            requestData.status = 'pending'; // pending, approved, rejected, fulfilled
        }
        if (!requestData.priority) {
            requestData.priority = 'normal'; // normal, high, urgent
        }
        
        // حفظ معلومات مقدم الطلب
        if (requestData.requestedBy && typeof requestData.requestedBy === 'object') {
            requestData.requestedByJSON = JSON.stringify(requestData.requestedBy);
            requestData.requestedById = requestData.requestedBy.id || requestData.requestedBy.userId || '';
            requestData.requestedByName = requestData.requestedBy.name || '';
        }
        
        return appendToSheet(sheetName, requestData);
    } catch (error) {
        Logger.log('Error in addSupplyRequest: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة طلب الاحتياج: ' + error.toString() };
    }
}

/**
 * تحديث طلب احتياج
 */
function updateSupplyRequest(requestId, updateData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        const sheetName = 'ClinicSupplyRequests';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const requestIndex = data.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            return { success: false, message: 'الطلب غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        
        // إذا كانت هناك بيانات updatedBy/approvedBy/rejectedBy، تحويلها إلى JSON
        if (updateData.updatedBy && typeof updateData.updatedBy === 'object') {
            updateData.updatedByJSON = JSON.stringify(updateData.updatedBy);
        }
        if (updateData.approvedBy && typeof updateData.approvedBy === 'object') {
            updateData.approvedByJSON = JSON.stringify(updateData.approvedBy);
        }
        if (updateData.rejectedBy && typeof updateData.rejectedBy === 'object') {
            updateData.rejectedByJSON = JSON.stringify(updateData.rejectedBy);
        }
        
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[requestIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating supply request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الطلب: ' + error.toString() };
    }
}

/**
 * الحصول على جميع طلبات الاحتياج
 */
function getAllSupplyRequests(filters = {}) {
    try {
        const sheetName = 'ClinicSupplyRequests';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        if (filters.requestedById) {
            data = data.filter(r => r.requestedById === filters.requestedById);
        }
        if (filters.type) {
            data = data.filter(r => r.type === filters.type);
        }
        if (filters.priority) {
            data = data.filter(r => r.priority === filters.priority);
        }
        
        // ترتيب حسب تاريخ الطلب (الأحدث أولاً)
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.requestDate || 0);
            const dateB = new Date(b.createdAt || b.requestDate || 0);
            return dateB - dateA;
        });
        
        // تحويل JSON strings إلى objects
        data = data.map(request => {
            if (request.requestedByJSON) {
                try {
                    request.requestedBy = JSON.parse(request.requestedByJSON);
                } catch (e) {
                    Logger.log('Error parsing requestedByJSON: ' + e.toString());
                }
            }
            if (request.updatedByJSON) {
                try {
                    request.updatedBy = JSON.parse(request.updatedByJSON);
                } catch (e) {
                    Logger.log('Error parsing updatedByJSON: ' + e.toString());
                }
            }
            if (request.approvedByJSON) {
                try {
                    request.approvedBy = JSON.parse(request.approvedByJSON);
                } catch (e) {
                    Logger.log('Error parsing approvedByJSON: ' + e.toString());
                }
            }
            if (request.rejectedByJSON) {
                try {
                    request.rejectedBy = JSON.parse(request.rejectedByJSON);
                } catch (e) {
                    Logger.log('Error parsing rejectedByJSON: ' + e.toString());
                }
            }
            return request;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting supply requests: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة طلبات الاحتياج: ' + error.toString(), data: [] };
    }
}

/**
 * الموافقة على طلب احتياج
 */
function approveSupplyRequest(requestId, approverData) {
    try {
        const updateResult = updateSupplyRequest(requestId, {
            status: 'approved',
            approvedBy: approverData,
            approvedById: approverData.id || approverData.userId,
            approvedAt: new Date()
        });
        
        return updateResult;
    } catch (error) {
        Logger.log('Error approving supply request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الموافقة على الطلب: ' + error.toString() };
    }
}

/**
 * رفض طلب احتياج
 */
function rejectSupplyRequest(requestId, rejectorData, reason) {
    try {
        const updateResult = updateSupplyRequest(requestId, {
            status: 'rejected',
            rejectedBy: rejectorData,
            rejectedById: rejectorData.id || rejectorData.userId,
            rejectedAt: new Date(),
            rejectionReason: reason || ''
        });
        
        return updateResult;
    } catch (error) {
        Logger.log('Error rejecting supply request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء رفض الطلب: ' + error.toString() };
    }
}

/**
 * ✅ دالة اختبار لـ addClinicVisitToSheet
 * هذه الدالة يمكن استدعاؤها من المحرر لاختبار addClinicVisitToSheet بشكل صحيح
 * 
 * الاستخدام:
 * 1. شغّل testAddClinicVisitToSheet من المحرر
 * 2. ستقوم بإنشاء بيانات اختبار وإرسالها إلى addClinicVisitToSheet
 * 3. افحص السجل (Execution log) للتأكد من أن كل شيء يعمل بشكل صحيح
 */
function testAddClinicVisitToSheet() {
    Logger.log('🧪 [TEST] ===== بدء اختبار addClinicVisitToSheet =====');
    Logger.log('🧪 [TEST] الوقت: ' + new Date().toISOString());
    
    try {
        // إنشاء بيانات اختبار مشابهة لما يرسله التطبيق
        // ✅ اختبار الحالات المختلفة لـ createdBy
        const testVisitData = {
            id: 'TEST-' + new Date().getTime(),
            employeeName: 'مستخدم اختبار',
            employeeCode: 'TEST001',
            jobTitle: 'موظف اختبار',
            factory: 'مصنع اختبار',
            workplace: 'مكان اختبار',
            personType: 'employee', // أو 'contractor' للاختبار
            reason: 'اختبار النظام',
            diagnosis: 'اختبار',
            entryTime: new Date().toISOString(),
            exitTime: new Date().toISOString(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'مستخدم اختبار', // ✅ يجب أن يكون اسم صحيح وليس "النظام"
            updatedBy: 'مستخدم اختبار',
            email: 'test@example.com', // ✅ مهم للبحث عن الاسم في قاعدة البيانات
            userId: 'test-user-id' // ✅ مهم للبحث عن الاسم في قاعدة البيانات
        };
        
        Logger.log('🧪 [TEST] بيانات الاختبار:');
        Logger.log('🧪 [TEST] - عدد الحقول: ' + Object.keys(testVisitData).length);
        Logger.log('🧪 [TEST] - createdBy: ' + testVisitData.createdBy);
        Logger.log('🧪 [TEST] - email: ' + testVisitData.email);
        Logger.log('🧪 [TEST] - userId: ' + testVisitData.userId);
        Logger.log('🧪 [TEST] - personType: ' + testVisitData.personType);
        Logger.log('🧪 [TEST] - id: ' + testVisitData.id);
        
        // استدعاء الدالة الفعلية
        Logger.log('🧪 [TEST] استدعاء addClinicVisitToSheet...');
        const result = addClinicVisitToSheet(testVisitData);
        
        Logger.log('🧪 [TEST] ===== نتيجة الاختبار =====');
        Logger.log('🧪 [TEST] success: ' + result.success);
        Logger.log('🧪 [TEST] message: ' + (result.message || 'N/A'));
        Logger.log('🧪 [TEST] النتيجة الكاملة: ' + JSON.stringify(result));
        
        // ✅ التحقق من أن createdBy تم حفظه بشكل صحيح
        if (result.success && result.rowNumber) {
            try {
                const spreadsheetId = getSpreadsheetId();
                const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('ClinicVisits');
                if (sheet) {
                    const lastRow = sheet.getLastRow();
                    const createdByValue = sheet.getRange(lastRow, sheet.getFrozenColumns() + 1).getValue(); // createdBy column
                    Logger.log('🧪 [TEST] createdBy المحفوظ في قاعدة البيانات: ' + createdByValue);
                    
                    if (createdByValue && createdByValue !== 'النظام' && createdByValue.trim() !== '') {
                        Logger.log('✅ [TEST] createdBy تم حفظه بشكل صحيح: ' + createdByValue);
                    } else {
                        Logger.log('⚠️ [TEST] تحذير: createdBy في قاعدة البيانات هو "النظام" أو فارغ');
                    }
                }
            } catch (e) {
                Logger.log('⚠️ [TEST] لا يمكن التحقق من createdBy في قاعدة البيانات: ' + e.toString());
            }
        }
        
        if (result.success) {
            Logger.log('✅ [TEST] الاختبار نجح! addClinicVisitToSheet تعمل بشكل صحيح.');
        } else {
            Logger.log('❌ [TEST] الاختبار فشل: ' + result.message);
        }
        
        Logger.log('🧪 [TEST] ===== انتهى الاختبار =====');
        return result;
        
    } catch (error) {
        Logger.log('❌ [TEST] خطأ في الاختبار: ' + error.toString());
        Logger.log('❌ [TEST] Stack: ' + error.stack);
        return { success: false, message: 'خطأ في الاختبار: ' + error.toString() };
    }
}

