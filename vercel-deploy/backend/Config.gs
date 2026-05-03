/**
 * Google Apps Script for HSE System - Configuration
 * 
 * ملف الإعدادات والثوابت
 */

// معرف جدول Google Sheets (سيتم تحديثه من الإعدادات)
// يمكن تركها فارغة والتمرير من التطبيق، أو إدخال المعرف هنا
// ملاحظة: تم نقل القيمة إلى دالة getSpreadsheetId() لتجنب مشاكل التكرار
// قم بتحديث المعرف في دالة getSpreadsheetId() أدناه

// الأوراق المطلوبة (سيتم إنشاؤها تلقائياً)
// ملاحظة: النظام الآن ديناميكي - سيتم إنشاء أي ورقة تلقائياً عند إرسال بيانات إليها
// ملاحظة: تم نقل القيمة إلى دالة getRequiredSheets() لتجنب مشاكل التكرار

/**
 * الحصول على معرف جدول البيانات
 * 
 * لتحديث المعرف: قم بتغيير القيمة في return أدناه
 */
function getSpreadsheetId() {
    // قم بتحديث هذا المعرف بمعرف جدول Google Sheets الخاص بك
    // يمكنك الحصول على المعرف من رابط الجدول: 
    // https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit
    const spreadsheetId = '1EanavJ2OodOmq8b1GagSj8baa-KF-o4mVme_Jlwmgxc';
    
    // التحقق من صحة المعرف (اختياري - للتحسين)
    if (typeof spreadsheetId !== 'string' || spreadsheetId.trim() === '') {
        Logger.log('Error: Invalid Spreadsheet ID - empty or not a string');
        // نرجع المعرف الفارغ بدلاً من throw error لتجنب كسر الكود الموجود
        return '';
    }
    
    // التحقق من التنسيق (معرف Google Sheets عادة يكون 44 حرفاً)
    if (spreadsheetId.length < 20) {
        Logger.log('Warning: Spreadsheet ID seems too short (' + spreadsheetId.length + ' characters)');
    }
    
    return spreadsheetId;
}

// Cache للقائمة (لتحسين الأداء)
var _cachedRequiredSheets = null;

/**
 * الحصول على قائمة الأوراق المطلوبة
 * 
 * لتحديث القائمة: قم بتعديل المصفوفة في return أدناه
 */
function getRequiredSheets() {
    // استخدام Cache إذا كان موجوداً
    if (_cachedRequiredSheets) {
        return _cachedRequiredSheets;
    }
    
    const sheets = [
        'Users', 'Incidents', 'NearMiss', 'PTW', 'Training', 'ClinicVisits', 'Medications', 'SickLeave', 'Injuries', 'ClinicContractorInjuries',
        'ClinicInventory', 'FireEquipment', 'PPE', 'Violations', 'Employees', 'BehaviorMonitoring', // ✅ تم إزالة 'Contractors' 
        'ChemicalSafety', 'Chemical_Register', 'DailyObservations', 'DailySafetyCheckList', 'ISODocuments', 'ISOProcedures', 'ISOForms', 'DocumentCodes', 'DocumentVersions', 'SOPJHA', 'RiskAssessments', 
        'LegalDocuments', 'HSEAudits', 'HSENonConformities', 'HSECorrectiveActions', 'HSEObjectives', 'HSERiskAssessments', 
        'EnvironmentalAspects', 'EnvironmentalMonitoring', 'Sustainability', 'CarbonFootprint', 'WasteManagement', 
        'WasteManagement_RegularWasteTypes', 'WasteManagement_RegularWasteRecords', 'WasteManagement_RegularWasteSales', 'WasteManagement_HazardousWasteRecords',
        'WaterManagement_Records', 'GasManagement_Records', 'ElectricityManagement_Records',
        'EnergyEfficiency', 'WaterManagement', 'RecyclingPrograms', 'PeriodicInspections', 'PeriodicInspectionCategories', 
        'PeriodicInspectionChecklists', 'PeriodicInspectionSchedules', 'PeriodicInspectionRecords', 'SafetyBudget', 
        'SafetyBudgets', 'SafetyBudgetTransactions', 'SafetyBudgetPurchaseOrders', 'SafetyPerformanceKPIs', 'ActionTrackingRegister', 'Budget', 'KPIs', 
        'EmergencyAlerts', 'EmergencyPlans', 'EmergencyPlansUpdates', 'AppEmergencyNumbers', 'EmployeeTrainingMatrix', 'ContractorTrainings', 'ExternalWorkforceMonthly', 'FireEquipmentAssets', 
        'FireEquipmentInspections', 'ViolationTypes', 'PPEMatrix', 'PPE_Stock', 'PPE_Transactions', 'ApprovedContractors', 'ContractorEvaluations', 'ContractorApprovalRequests', 'ContractorDeletionRequests', 
        'AuditLog', 'UserActivityLog', 'AIAssistantSettings', 'UserAILog', 'ObservationSites', 'AnnualTrainingPlans',
        'SafetyTeamMembers', 'SafetyOrganizationalStructure', 'SafetyJobDescriptions', 'SafetyTeamKPIs', 
        'SafetyTeamPerformanceReports', 'SafetyTeamAttendance', 'SafetyTeamLeaves', 'SafetyHealthManagementSettings',
        'SafetyTeamTasks', 'ActionTrackingSettings',         'Form_Settings_DB', 'Violation_Types_DB',
        'ModuleManagement', 'UserTasks', 'UserInstructions', 'Notifications', 'IncidentNotifications',
        'Blacklist_Register',
        // جداول إعدادات النماذج الجديدة (بصيغة عادية - كل صف = سجل واحد)
        'Form_Sites', 'Form_Places', 'Form_Departments', 'Form_SafetyTeam',
        // جداول إحداثيات المواقع للخريطة
        'PTW_MAP_COORDINATES', 'PTW_DEFAULT_COORDINATES',
        // نظام النسخ الاحتياطي
        'BackupLog', 'BackupSettings'
    ];
    
    // التحقق من عدم وجود تكرار (للتحسين)
    const uniqueSheets = [...new Set(sheets)];
    if (uniqueSheets.length !== sheets.length) {
        Logger.log('Warning: Duplicate sheet names found in getRequiredSheets()');
        // نستخدم القائمة الفريدة
        _cachedRequiredSheets = uniqueSheets;
        return _cachedRequiredSheets;
    }
    
    // حفظ في Cache
    _cachedRequiredSheets = sheets;
    return _cachedRequiredSheets;
}

/**
 * التحقق من تطابق الأوراق المطلوبة مع الرؤوس المعرفة
 * 
 * هذه الدالة تساعد في التحقق من أن جميع الأوراق في getRequiredSheets()
 * لها رؤوس معرّفة في Headers.gs
 * 
 * @return {object} - كائن يحتوي على نتائج التحقق
 */
function validateSheetsConfiguration() {
    try {
        const requiredSheets = getRequiredSheets();
        const missingHeaders = [];
        const validSheets = [];
        
        requiredSheets.forEach(sheetName => {
            try {
                const headers = getDefaultHeaders(sheetName);
                if (!headers || headers.length === 0) {
                    missingHeaders.push(sheetName);
                } else {
                    validSheets.push(sheetName);
                }
            } catch (error) {
                Logger.log('Error checking headers for ' + sheetName + ': ' + error.toString());
                missingHeaders.push(sheetName);
            }
        });
        
        if (missingHeaders.length > 0) {
            Logger.log('Warning: Sheets without headers: ' + missingHeaders.join(', '));
        }
        
        return {
            valid: missingHeaders.length === 0,
            missingHeaders: missingHeaders,
            validSheets: validSheets,
            totalSheets: requiredSheets.length,
            validCount: validSheets.length,
            missingCount: missingHeaders.length
        };
    } catch (error) {
        Logger.log('Error in validateSheetsConfiguration: ' + error.toString());
        return {
            valid: false,
            error: error.toString(),
            missingHeaders: [],
            validSheets: [],
            totalSheets: 0,
            validCount: 0,
            missingCount: 0
        };
    }
}

/**
 * ============================================
 * Security: Employees destructive actions
 * ============================================
 * يتم تخزين PIN في Script Properties باسم: EMPLOYEES_DELETE_PIN
 * مثال: من Apps Script > Project Settings > Script properties
 */
function getEmployeesDeletePin() {
    try {
        const pin = PropertiesService.getScriptProperties().getProperty('EMPLOYEES_DELETE_PIN');
        return pin ? String(pin).trim() : '';
    } catch (e) {
        Logger.log('Error reading EMPLOYEES_DELETE_PIN: ' + e.toString());
        return '';
    }
}

function verifyEmployeesDeletePin(pin) {
    const expected = getEmployeesDeletePin();
    if (!expected) {
        return { ok: false, message: 'لم يتم ضبط رقم سري للحذف (EMPLOYEES_DELETE_PIN). يرجى ضبطه في Script Properties.' };
    }
    const actual = pin === null || pin === undefined ? '' : String(pin).trim();
    if (!actual) {
        return { ok: false, message: 'الرجاء إدخال الرقم السري للحذف.' };
    }
    if (actual !== expected) {
        return { ok: false, message: 'الرقم السري غير صحيح.' };
    }
    return { ok: true, message: 'OK' };
}
