/**
 * Google Apps Script for HSE System - Company Settings Module
 * 
 * موديول إعدادات الشركة
 * 
 * هذا الموديول يدير إعدادات الشركة في Google Sheets
 * البيانات تُحفظ في جدول واحد (Company_Settings)
 * فقط مدير النظام يمكنه إضافة أو تعديل الإعدادات
 * 
 * الجدول:
 * - Company_Settings: إعدادات الشركة (اسم الشركة، الشعار، إلخ)
 */

// اسم الجدول
const COMPANY_SETTINGS_SHEET = 'Company_Settings';

/**
 * التحقق من صلاحيات المستخدم (مدير النظام فقط)
 */
function checkCompanySettingsPermission(userData) {
    try {
        // إذا لم يتم تمرير بيانات المستخدم، رفض الوصول
        if (!userData) {
            return { hasPermission: false, message: 'يجب تسجيل الدخول أولاً' };
        }
        
        // التحقق من الدور (Role) - فقط مدير النظام
        const userRole = userData.role || '';
        
        // فقط admin مسموح له
        if (userRole.toLowerCase() === 'admin') {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        // التحقق من الصلاحيات المخصصة (Permissions)
        let userPermissions = userData.permissions || {};
        if (typeof userPermissions === 'string') {
            try {
                userPermissions = JSON.parse(userPermissions);
            } catch (e) {
                userPermissions = {};
            }
        }
        
        // التحقق من صلاحية manage_company_settings
        if (userPermissions.manage_company_settings === true) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        return { hasPermission: false, message: 'ليس لديك صلاحية لتعديل إعدادات الشركة. فقط مدير النظام يمكنه ذلك.' };
    } catch (error) {
        Logger.log('Error in checkCompanySettingsPermission: ' + error.toString());
        return { hasPermission: false, message: 'حدث خطأ أثناء التحقق من الصلاحيات' };
    }
}

/**
 * تهيئة جدول إعدادات الشركة
 */
function initCompanySettingsTable(spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        let sheet;
        
        // التحقق من وجود الورقة
        try {
            sheet = spreadsheet.getSheetByName(COMPANY_SETTINGS_SHEET);
            if (!sheet) {
                sheet = spreadsheet.insertSheet(COMPANY_SETTINGS_SHEET);
            }
        } catch (error) {
            sheet = spreadsheet.insertSheet(COMPANY_SETTINGS_SHEET);
        }
        
        // التحقق من وجود الرؤوس
        const headers = sheet.getRange(1, 1, 1, 1).getValues()[0];
        if (!headers || headers.length === 0 || !headers[0] || headers[0] === '') {
            // إضافة الرؤوس
            const headerRow = [
                'id',
                'name',
                'secondaryName',
                'nameFontSize',
                'secondaryNameFontSize',
                'secondaryNameColor',
                'formVersion',
                'address',
                'phone',
                'email',
                'logo',
                'postLoginItems',
                'clinicMonthlyVisitsAlertThreshold',
                'clinicVisitTypes',
                'profileTeamsUrl',
                'profileWhatsAppUrl',
                'createdAt',
                'updatedAt',
                'createdBy',
                'updatedBy'
            ];
            sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
            
            // تنسيق الرؤوس
            const headerRange = sheet.getRange(1, 1, 1, headerRow.length);
            headerRange.setFontWeight('bold');
            headerRange.setBackground('#4285F4');
            headerRange.setFontColor('#FFFFFF');
        }
        
        return { success: true, message: 'تم تهيئة جدول إعدادات الشركة بنجاح' };
    } catch (error) {
        Logger.log('Error in initCompanySettingsTable: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تهيئة جدول إعدادات الشركة: ' + error.toString() };
    }
}

/**
 * حفظ إعدادات الشركة في Google Sheets
 */
function saveCompanySettingsToSheet(settingsData) {
    try {
        // التحقق من الصلاحيات
        const userData = settingsData.userData || settingsData.user || {};
        const permissionCheck = checkCompanySettingsPermission(userData);
        
        if (!permissionCheck.hasPermission) {
            return { 
                success: false, 
                message: permissionCheck.message || 'ليس لديك صلاحية لحفظ إعدادات الشركة',
                errorCode: 'PERMISSION_DENIED'
            };
        }
        
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        // تهيئة الجدول
        initCompanySettingsTable(spreadsheetId);
        
        // قراءة البيانات الحالية
        const existingSettings = readFromSheet(COMPANY_SETTINGS_SHEET, spreadsheetId);
        
        // إعداد البيانات للحفظ
        const now = new Date().toISOString();
        const userName = userData.name || userData.email || 'System';
        
        // postLoginItems: مصفوفة أو JSON string (سياسات/تعليمات ما بعد الدخول)
        let postLoginItemsValue = '';
        if (settingsData.postLoginItems !== undefined && settingsData.postLoginItems !== null) {
            if (typeof settingsData.postLoginItems === 'string') {
                postLoginItemsValue = settingsData.postLoginItems;
            } else if (Array.isArray(settingsData.postLoginItems)) {
                try {
                    postLoginItemsValue = JSON.stringify(settingsData.postLoginItems);
                } catch (e) {
                    postLoginItemsValue = '';
                }
            }
        }

        // clinicVisitTypes: مصفوفة أو JSON string (أنواع زيارة العيادة المشتركة لكل المستخدمين)
        let clinicVisitTypesValue = '';
        if (settingsData.clinicVisitTypes !== undefined && settingsData.clinicVisitTypes !== null) {
            if (typeof settingsData.clinicVisitTypes === 'string') {
                clinicVisitTypesValue = settingsData.clinicVisitTypes;
            } else if (Array.isArray(settingsData.clinicVisitTypes)) {
                try {
                    clinicVisitTypesValue = JSON.stringify(settingsData.clinicVisitTypes);
                } catch (e) {
                    clinicVisitTypesValue = '';
                }
            }
        }

        const clinicThreshold = settingsData.clinicMonthlyVisitsAlertThreshold;
        const clinicThresholdNum = (clinicThreshold !== undefined && clinicThreshold !== null && clinicThreshold !== '') ? parseInt(clinicThreshold, 10) : 10;
        const clinicMonthlyVisitsAlertThreshold = (isNaN(clinicThresholdNum) || clinicThresholdNum < 1) ? 10 : Math.min(1000, clinicThresholdNum);

        let settingsToSave = {
            id: 'COMPANY-SETTINGS-1',
            name: settingsData.name || '',
            secondaryName: settingsData.secondaryName || '',
            nameFontSize: settingsData.nameFontSize || 16,
            secondaryNameFontSize: settingsData.secondaryNameFontSize || 14,
            secondaryNameColor: settingsData.secondaryNameColor || '#6B7280',
            formVersion: settingsData.formVersion || '1.0',
            address: settingsData.address || '',
            phone: settingsData.phone || '',
            email: settingsData.email || '',
            logo: settingsData.logo || '',
            postLoginItems: postLoginItemsValue,
            clinicMonthlyVisitsAlertThreshold: clinicMonthlyVisitsAlertThreshold,
            clinicVisitTypes: clinicVisitTypesValue,
            profileTeamsUrl: settingsData.profileTeamsUrl != null ? String(settingsData.profileTeamsUrl) : '',
            profileWhatsAppUrl: settingsData.profileWhatsAppUrl != null ? String(settingsData.profileWhatsAppUrl) : '',
            updatedAt: now,
            updatedBy: userName
        };
        
        // إذا كانت هناك إعدادات موجودة، نحتفظ ببعض البيانات
        if (existingSettings && existingSettings.length > 0) {
            const existing = existingSettings[0];
            settingsToSave.createdAt = existing.createdAt || now;
            settingsToSave.createdBy = existing.createdBy || userName;
            // عدم مسح روابط Teams/واتساب عند حفظ من واجهات لا ترسل الحقلين
            if (settingsData.profileTeamsUrl === undefined && existing.profileTeamsUrl != null && String(existing.profileTeamsUrl).trim() !== '') {
                settingsToSave.profileTeamsUrl = String(existing.profileTeamsUrl);
            }
            if (settingsData.profileWhatsAppUrl === undefined && existing.profileWhatsAppUrl != null && String(existing.profileWhatsAppUrl).trim() !== '') {
                settingsToSave.profileWhatsAppUrl = String(existing.profileWhatsAppUrl);
            }
            // لا نمسح أنواع الزيارة إذا لم تُرسل من الواجهة الحالية
            if (settingsData.clinicVisitTypes === undefined && existing.clinicVisitTypes != null && String(existing.clinicVisitTypes).trim() !== '') {
                settingsToSave.clinicVisitTypes = String(existing.clinicVisitTypes);
            }
        } else {
            settingsToSave.createdAt = now;
            settingsToSave.createdBy = userName;
        }
        
        // ✅ التحقق من وجود الشعار قبل الحفظ
        const hasLogo = settingsData.logo && settingsData.logo.trim() !== '';
        if (hasLogo) {
            Logger.log('Saving company settings with logo (logo length: ' + settingsData.logo.length + ' characters)');
            // ✅ ملاحظة: الشعار يُحفظ كـ base64 string مباشرة (لا يُرفع إلى Drive)
            // ✅ Google Sheets له حد أقصى 50,000 حرف للخلية
            // ✅ إذا كان الشعار أكبر من 50,000 حرف، قد يتم قطعه
            if (settingsData.logo.length > 50000) {
                Logger.log('⚠️ Warning: Logo is very large (' + settingsData.logo.length + ' chars). Google Sheets cell limit is 50,000 chars. Logo may be truncated.');
            } else if (settingsData.logo.length > 45000) {
                Logger.log('⚠️ Warning: Logo is large (' + settingsData.logo.length + ' chars). Close to Google Sheets cell limit (50,000 chars).');
            }
        } else {
            Logger.log('Saving company settings without logo');
        }
        
        // حفظ البيانات (استبدال كامل - سيكون هناك سجل واحد فقط)
        const result = saveToSheet(COMPANY_SETTINGS_SHEET, [settingsToSave], spreadsheetId);
        
        if (result.success) {
            Logger.log('Company settings saved successfully');
            // ✅ إصلاح: التحقق من أن الشعار تم حفظه بشكل صحيح
            if (hasLogo && settingsToSave.logo) {
                Logger.log('Logo was included in saved settings (length: ' + settingsToSave.logo.length + ' characters)');
            }
            return { success: true, message: 'تم حفظ إعدادات الشركة بنجاح', data: settingsToSave };
        } else {
            Logger.log('Failed to save company settings: ' + (result.message || 'Unknown error'));
            return { success: false, message: result.message || 'فشل حفظ إعدادات الشركة' };
        }
    } catch (error) {
        Logger.log('Error in saveCompanySettingsToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ إعدادات الشركة: ' + error.toString() };
    }
}

/**
 * الحصول على إعدادات الشركة من Google Sheets
 */
function getCompanySettingsFromSheet() {
    try {
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد',
                data: getDefaultCompanySettings()
            };
        }
        
        // تهيئة الجدول
        initCompanySettingsTable(spreadsheetId);
        
        // قراءة البيانات من الجدول
        const settings = readFromSheet(COMPANY_SETTINGS_SHEET, spreadsheetId);
        
        if (settings && settings.length > 0) {
            // إرجاع أول سجل (يجب أن يكون هناك سجل واحد فقط) مع دمج القيم الافتراضية للحقول الجديدة
            const raw = settings[0];
            const defaults = getDefaultCompanySettings();
            const settingsData = Object.assign({}, defaults, raw);
            // ✅ إصلاح: التحقق من وجود الشعار في البيانات المحملة
            if (settingsData.logo && settingsData.logo.trim() !== '') {
                Logger.log('Company settings loaded with logo (length: ' + settingsData.logo.length + ' characters)');
            } else {
                Logger.log('Company settings loaded without logo');
            }
            return { success: true, data: settingsData };
        } else {
            // إرجاع الإعدادات الافتراضية
            Logger.log('No company settings found, returning default settings');
            return { success: true, data: getDefaultCompanySettings() };
        }
    } catch (error) {
        Logger.log('Error in getCompanySettingsFromSheet: ' + error.toString());
        return { 
            success: false, 
            message: 'حدث خطأ أثناء قراءة إعدادات الشركة: ' + error.toString(),
            data: getDefaultCompanySettings()
        };
    }
}

/**
 * الحصول على الإعدادات الافتراضية للشركة
 */
function getDefaultCompanySettings() {
    return {
        id: 'COMPANY-SETTINGS-1',
        name: 'الشركة العالمية للانتاج والتصنيع الزراعي',
        secondaryName: '',
        nameFontSize: 16,
        secondaryNameFontSize: 14,
        secondaryNameColor: '#6B7280',
        formVersion: '1.0',
        address: '',
        phone: '',
        email: '',
        logo: '',
        postLoginItems: '',
        clinicMonthlyVisitsAlertThreshold: 10,
        clinicVisitTypes: '',
        profileTeamsUrl: '',
        profileWhatsAppUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'System',
        updatedBy: 'System'
    };
}
