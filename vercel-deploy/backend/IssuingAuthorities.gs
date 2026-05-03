/**
 * Google Apps Script for HSE System - Issuing Authorities Module
 *
 * موديول إدارة الأشخاص المصرح لهم بالتوقيع على تصاريح العمل
 *
 * قيم الصلاحية لكل نوع تصريح:
 *   G = مصرح بالتوقيع في كل الحالات
 *   Y = مصرح بالتوقيع بعد التنسيق مع مدير السلامة والصحة المهنية
 *   X = غير مصرح له بالتوقيع على هذا النوع
 */

const ISSUING_AUTHORITIES_SHEET = 'PTWIssuingAuthorities';
const CONTRACTOR_ISSUING_AUTHORITIES_SHEET = 'PTWContractorIssuingAuthorities';

// أنواع التصاريح المدعومة وحقولها
const PERMIT_TYPE_FIELDS = {
    coldWork:      'الأعمال الباردة',
    loto:          'عزل مصادر الطاقة',
    hotWork:       'الأعمال الساخنة',
    workAtHeight:  'العمل على ارتفاعات',
    confinedSpace: 'دخول الأماكن المغلقة',
    excavation:    'الحفر',
    contractorPTW: 'تصريح دخول مقاول',
    liftingPlan:   'خطة الرفع'
};

/**
 * التحقق من صلاحيات إدارة Issuing Authorities (مدير النظام فقط)
 */
function checkIssuingAuthoritiesPermission(userData) {
    try {
        if (!userData) {
            return { hasPermission: false, message: 'يجب تسجيل الدخول أولاً' };
        }
        const userRole = (userData.role || '').toLowerCase();
        if (userRole === 'admin') {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        let permissions = userData.permissions || {};
        if (typeof permissions === 'string') {
            try { permissions = JSON.parse(permissions); } catch (e) { permissions = {}; }
        }
        if (permissions['admin'] === true || permissions['manage-ptw-authorities'] === true) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        return { hasPermission: false, message: 'ليس لديك صلاحية إدارة قائمة المصرح لهم بالتوقيع. هذه العملية للمدير فقط.' };
    } catch (error) {
        Logger.log('Error checking issuing authorities permission: ' + error.toString());
        return { hasPermission: false, message: 'حدث خطأ أثناء التحقق من الصلاحيات' };
    }
}

/**
 * إنشاء جدول PTWIssuingAuthorities إذا لم يكن موجوداً
 */
function initIssuingAuthoritiesTable(spreadsheetId) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return { success: false, message: 'معرف Google Sheets غير محدد' };
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        if (!spreadsheet.getSheetByName(ISSUING_AUTHORITIES_SHEET)) {
            const sheet = spreadsheet.insertSheet(ISSUING_AUTHORITIES_SHEET);
            const headers = getDefaultHeaders(ISSUING_AUTHORITIES_SHEET);
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#c8d8e8');
            Logger.log('تم إنشاء جدول PTWIssuingAuthorities');
        }
        return { success: true, message: 'تم التحقق من الجدول' };
    } catch (error) {
        Logger.log('Error in initIssuingAuthoritiesTable: ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

/**
 * إنشاء جدول مقاولي Issuing Authorities إذا لم يكن موجوداً
 */
function initContractorIssuingAuthoritiesTable(spreadsheetId) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return { success: false, message: 'معرف Google Sheets غير محدد' };
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        if (!spreadsheet.getSheetByName(CONTRACTOR_ISSUING_AUTHORITIES_SHEET)) {
            const sheet = spreadsheet.insertSheet(CONTRACTOR_ISSUING_AUTHORITIES_SHEET);
            const headers = getDefaultHeaders(CONTRACTOR_ISSUING_AUTHORITIES_SHEET);
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#c8d8e8');
            Logger.log('تم إنشاء جدول PTWContractorIssuingAuthorities');
        }
        return { success: true, message: 'تم التحقق من جدول المقاولين' };
    } catch (error) {
        Logger.log('Error in initContractorIssuingAuthoritiesTable: ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

function _normalizePersonType(personType, fallbackType) {
    const v = String(personType || fallbackType || '').toLowerCase().trim();
    return (v === 'contractor') ? 'contractor' : 'employee';
}

function _buildIssuingAuthorityRecordData(data, fallbackPersonType, targetSheet) {
    const userRef = (data.userData || data.user || {});
    const personType = _normalizePersonType(data.personType, fallbackPersonType);
    const by = String(userRef.name || userRef.email || '').trim();
    return {
        id:            generateSequentialId(personType === 'contractor' ? 'IAC' : 'IA', targetSheet),
        personType:    personType,
        employeeCode:  String(data.employeeCode || '').trim(),
        contractorCompanyName: String(data.contractorCompanyName || '').trim(),
        name:          String(data.name || '').trim(),
        departmentId:  String(data.departmentId || '').trim(),
        departmentName:String(data.departmentName || '').trim(),
        jobTitle:      String(data.jobTitle || '').trim(),
        factory:       String(data.factory || '').trim(),
        location:      String(data.location || '').trim(),
        sublocation:   String(data.sublocation || '').trim(),
        email:         String(data.email || '').trim(),
        phone:         String(data.phone || '').trim(),
        isActive:      data.isActive !== false,
        contractorFlag: personType === 'contractor',
        coldWork:      validatePermitValue(data.coldWork),
        loto:          validatePermitValue(data.loto),
        hotWork:       validatePermitValue(data.hotWork),
        workAtHeight:  validatePermitValue(data.workAtHeight),
        confinedSpace: validatePermitValue(data.confinedSpace),
        excavation:    validatePermitValue(data.excavation),
        contractorPTW: validatePermitValue(data.contractorPTW),
        liftingPlan:   validatePermitValue(data.liftingPlan),
        sortOrder:     data.sortOrder || 0,
        notes:         String(data.notes || '').trim(),
        createdAt:     new Date(),
        updatedAt:     new Date(),
        createdBy:     by,
        updatedBy:     by
    };
}

function _getAllIssuingAuthoritiesBySheet(sheetName) {
    try {
        if (sheetName === CONTRACTOR_ISSUING_AUTHORITIES_SHEET) initContractorIssuingAuthoritiesTable();
        else initIssuingAuthoritiesTable();
        const spreadsheetId = getSpreadsheetId();
        const records = readFromSheet(sheetName, spreadsheetId);
        return { success: true, data: records || [], count: (records || []).length };
    } catch (error) {
        Logger.log('Error in _getAllIssuingAuthoritiesBySheet(' + sheetName + '): ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString(), data: [] };
    }
}

function _addIssuingAuthorityBySheet(data, sheetName, fallbackPersonType) {
    try {
        if (!data) return { success: false, message: 'البيانات غير موجودة' };
        const permCheck = checkIssuingAuthoritiesPermission(data.userData || data.user);
        if (!permCheck.hasPermission) return { success: false, message: permCheck.message };

        if (sheetName === CONTRACTOR_ISSUING_AUTHORITIES_SHEET) initContractorIssuingAuthoritiesTable();
        else initIssuingAuthoritiesTable();

        const recordData = _buildIssuingAuthorityRecordData(data, fallbackPersonType, sheetName);
        if (!recordData.name) return { success: false, message: 'اسم الشخص مطلوب' };
        if (recordData.personType === 'contractor' && !recordData.contractorCompanyName) {
            return { success: false, message: 'اسم المقاول / الشركة (المورد) مطلوب' };
        }

        const result = appendToSheet(sheetName, recordData);
        if (result && result.success) return { success: true, message: 'تم إضافة السجل بنجاح', data: recordData };
        return { success: false, message: result.message || 'فشل الحفظ' };
    } catch (error) {
        Logger.log('Error in _addIssuingAuthorityBySheet(' + sheetName + '): ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

function _updateIssuingAuthorityBySheet(recordId, data, sheetName, fallbackPersonType) {
    try {
        if (!recordId) return { success: false, message: 'معرف السجل غير محدد' };
        if (!data) return { success: false, message: 'البيانات غير موجودة' };
        const permCheck = checkIssuingAuthoritiesPermission(data.userData || data.user);
        if (!permCheck.hasPermission) return { success: false, message: permCheck.message };

        const spreadsheetId = getSpreadsheetId();
        const records = readFromSheet(sheetName, spreadsheetId);
        const idx = records.findIndex(r => r.id === recordId);
        if (idx === -1) return { success: false, message: 'السجل غير موجود' };

        const existing = records[idx];
        const userRef = (data.userData || data.user || {});
        records[idx] = Object.assign({}, existing, {
            personType:    data.personType    !== undefined ? _normalizePersonType(data.personType, fallbackPersonType) : _normalizePersonType(existing.personType, fallbackPersonType),
            employeeCode:  data.employeeCode  !== undefined ? String(data.employeeCode).trim()  : existing.employeeCode,
            contractorCompanyName: data.contractorCompanyName !== undefined ? String(data.contractorCompanyName).trim() : existing.contractorCompanyName,
            name:          data.name          !== undefined ? String(data.name).trim()          : existing.name,
            departmentId:  data.departmentId  !== undefined ? String(data.departmentId).trim()  : existing.departmentId,
            departmentName:data.departmentName!== undefined ? String(data.departmentName).trim(): existing.departmentName,
            jobTitle:      data.jobTitle      !== undefined ? String(data.jobTitle).trim()      : existing.jobTitle,
            factory:       data.factory       !== undefined ? String(data.factory).trim()       : existing.factory,
            location:      data.location      !== undefined ? String(data.location).trim()      : existing.location,
            sublocation:   data.sublocation   !== undefined ? String(data.sublocation).trim()   : existing.sublocation,
            email:         data.email         !== undefined ? String(data.email).trim()         : existing.email,
            phone:         data.phone         !== undefined ? String(data.phone).trim()         : existing.phone,
            isActive:      data.isActive      !== undefined ? data.isActive                     : existing.isActive,
            contractorFlag: data.personType   !== undefined ? (_normalizePersonType(data.personType, fallbackPersonType) === 'contractor') : existing.contractorFlag,
            coldWork:      data.coldWork      !== undefined ? validatePermitValue(data.coldWork)      : existing.coldWork,
            loto:          data.loto          !== undefined ? validatePermitValue(data.loto)          : existing.loto,
            hotWork:       data.hotWork       !== undefined ? validatePermitValue(data.hotWork)       : existing.hotWork,
            workAtHeight:  data.workAtHeight  !== undefined ? validatePermitValue(data.workAtHeight)  : existing.workAtHeight,
            confinedSpace: data.confinedSpace !== undefined ? validatePermitValue(data.confinedSpace) : existing.confinedSpace,
            excavation:    data.excavation    !== undefined ? validatePermitValue(data.excavation)    : existing.excavation,
            contractorPTW: data.contractorPTW !== undefined ? validatePermitValue(data.contractorPTW) : existing.contractorPTW,
            liftingPlan:   data.liftingPlan   !== undefined ? validatePermitValue(data.liftingPlan)   : existing.liftingPlan,
            sortOrder:     data.sortOrder     !== undefined ? data.sortOrder : existing.sortOrder,
            notes:         data.notes         !== undefined ? String(data.notes).trim() : existing.notes,
            updatedAt:     new Date(),
            updatedBy:     String(userRef.name || userRef.email || '').trim()
        });

        const result = saveToSheet(sheetName, records, spreadsheetId);
        if (result && result.success) return { success: true, message: 'تم التحديث بنجاح', data: records[idx] };
        return { success: false, message: result.message || 'فشل التحديث' };
    } catch (error) {
        Logger.log('Error in _updateIssuingAuthorityBySheet(' + sheetName + '): ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

function _deleteIssuingAuthorityBySheet(recordId, userData, sheetName) {
    try {
        if (!recordId) return { success: false, message: 'معرف السجل غير محدد' };
        const permCheck = checkIssuingAuthoritiesPermission(userData);
        if (!permCheck.hasPermission) return { success: false, message: permCheck.message };
        return deleteRowById(sheetName, recordId);
    } catch (error) {
        Logger.log('Error in _deleteIssuingAuthorityBySheet(' + sheetName + '): ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

function _getIssuingAuthoritiesForPermitTypeBySheet(permitType, sheetName) {
    try {
        if (!permitType || !PERMIT_TYPE_FIELDS[permitType]) {
            return { success: false, message: 'نوع التصريح غير معروف: ' + permitType, authorities: [] };
        }
        const allResult = _getAllIssuingAuthoritiesBySheet(sheetName);
        if (!allResult.success) return { success: false, message: allResult.message, authorities: [] };
        const active = allResult.data.filter(r => r.isActive !== false && r.isActive !== 'false');
        const qualified = active
            .filter(r => {
                const val = String(r[permitType] || 'X').toUpperCase().trim();
                return val === 'G' || val === 'Y';
            })
            .map(r => {
                const val = String(r[permitType] || 'X').toUpperCase().trim();
                return {
                    id:                    r.id,
                    personType:            _normalizePersonType(r.personType, sheetName === CONTRACTOR_ISSUING_AUTHORITIES_SHEET ? 'contractor' : 'employee'),
                    employeeCode:          r.employeeCode || '',
                    name:                  r.name,
                    departmentId:          r.departmentId,
                    departmentName:        r.departmentName,
                    jobTitle:              r.jobTitle || '',
                    factory:               r.factory || '',
                    location:              r.location || '',
                    sublocation:           r.sublocation || '',
                    email:                 r.email,
                    phone:                 r.phone,
                    permitLevel:           val,
                    requiresHseCoApproval: val === 'Y'
                };
            })
            .sort((a, b) => {
                if (a.permitLevel === 'G' && b.permitLevel !== 'G') return -1;
                if (b.permitLevel === 'G' && a.permitLevel !== 'G') return 1;
                return 0;
            });
        return { success: true, authorities: qualified, permitType, count: qualified.length };
    } catch (error) {
        Logger.log('Error in _getIssuingAuthoritiesForPermitTypeBySheet(' + sheetName + '): ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString(), authorities: [] };
    }
}

/**
 * الحصول على جميع السجلات
 */
function getAllIssuingAuthorities() {
    return _getAllIssuingAuthoritiesBySheet(ISSUING_AUTHORITIES_SHEET);
}

/**
 * إضافة سجل جديد
 */
function addIssuingAuthority(data) {
    return _addIssuingAuthorityBySheet(data, ISSUING_AUTHORITIES_SHEET, 'employee');
}

/**
 * تحديث سجل موجود
 */
function updateIssuingAuthority(recordId, data) {
    return _updateIssuingAuthorityBySheet(recordId, data, ISSUING_AUTHORITIES_SHEET, 'employee');
}

/**
 * حذف سجل
 */
function deleteIssuingAuthority(recordId, userData) {
    return _deleteIssuingAuthorityBySheet(recordId, userData, ISSUING_AUTHORITIES_SHEET);
}

/**
 * الحصول على قائمة المرشحين المؤهلين لاعتماد تصريح حسب نوعه
 * يُستخدم من PTW عند توليد workflow
 *
 * @param {string} permitType - نوع التصريح (coldWork | loto | hotWork | workAtHeight | confinedSpace | excavation | contractorPTW | liftingPlan)
 * @returns {{ success: boolean, authorities: Array }}
 *   كل عنصر: { id, name, email, phone, permitLevel: 'G'|'Y', requiresHseCoApproval: boolean }
 */
function getIssuingAuthoritiesForPermitType(permitType) {
    return _getIssuingAuthoritiesForPermitTypeBySheet(permitType, ISSUING_AUTHORITIES_SHEET);
}

// =========================
// Contractors IA (separate DB)
// =========================
function getAllContractorIssuingAuthorities() {
    return _getAllIssuingAuthoritiesBySheet(CONTRACTOR_ISSUING_AUTHORITIES_SHEET);
}

function addContractorIssuingAuthority(data) {
    return _addIssuingAuthorityBySheet(data, CONTRACTOR_ISSUING_AUTHORITIES_SHEET, 'contractor');
}

function updateContractorIssuingAuthority(recordId, data) {
    return _updateIssuingAuthorityBySheet(recordId, data, CONTRACTOR_ISSUING_AUTHORITIES_SHEET, 'contractor');
}

function deleteContractorIssuingAuthority(recordId, userData) {
    return _deleteIssuingAuthorityBySheet(recordId, userData, CONTRACTOR_ISSUING_AUTHORITIES_SHEET);
}

function getContractorIssuingAuthoritiesForPermitType(permitType) {
    return _getIssuingAuthoritiesForPermitTypeBySheet(permitType, CONTRACTOR_ISSUING_AUTHORITIES_SHEET);
}

/**
 * جلب بيانات موظف بالكود الوظيفي لاستخدامها في تعبئة نموذج المصرح لهم تلقائياً
 */
function getEmployeeByCode(employeeCode) {
    try {
        const query = String(employeeCode || '').trim();
        if (!query) return { success: false, message: 'الكود الوظيفي أو الاسم مطلوب' };

        const spreadsheetId = getSpreadsheetId();
        const employees = readFromSheet('Employees', spreadsheetId) || [];
        const normalizeText = function (v) { return String(v || '').trim().toLowerCase(); };
        const normalizeCode = function (v) {
            let s = String(v || '').trim().toLowerCase();
            if (!s) return '';
            // Convert Arabic digits to English digits for robust matching
            s = s
                .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
                .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
            // Handle Google Sheets numeric formatting like 12345.0
            s = s.replace(/\.0+$/g, '');
            // Remove spaces and common separators
            s = s.replace(/[\s\-_\/\\]+/g, '');
            return s;
        };
        const target = normalizeCode(query);
        const targetText = normalizeText(query);

        // Try strict match by code/id first
        let emp = employees.find(function (e) {
            return normalizeCode(e.employeeNumber) === target ||
                normalizeCode(e.sapId) === target ||
                normalizeCode(e.id) === target ||
                normalizeCode(e.employeeCode) === target;
        });

        // Fallback: contains match by code fields (helps with prefixed/suffixed values)
        if (!emp && target) {
            emp = employees.find(function (e) {
                const codeCandidates = [
                    normalizeCode(e.employeeNumber),
                    normalizeCode(e.sapId),
                    normalizeCode(e.id),
                    normalizeCode(e.employeeCode)
                ].filter(Boolean);
                return codeCandidates.some(function (c) { return c.indexOf(target) !== -1 || target.indexOf(c) !== -1; });
            });
        }

        // Fallback: match by name (exact then includes)
        if (!emp) {
            emp = employees.find(function (e) {
                return normalizeText(e.name) === targetText;
            });
        }
        if (!emp) {
            emp = employees.find(function (e) {
                return normalizeText(e.name).indexOf(targetText) !== -1;
            });
        }

        if (!emp) return { success: false, message: 'لم يتم العثور على موظف بهذا الكود/الاسم' };
        return {
            success: true,
            data: {
                employeeCode: String(emp.employeeNumber || emp.sapId || emp.id || '').trim(),
                name: String(emp.name || '').trim(),
                departmentName: String(emp.department || '').trim(),
                jobTitle: String(emp.job || emp.position || '').trim(),
                factory: String(emp.branch || '').trim(),
                location: String(emp.location || '').trim(),
                sublocation: String(emp.sublocation || emp.subLocation || emp.subLocationName || emp.locationName || '').trim()
            }
        };
    } catch (error) {
        Logger.log('Error in getEmployeeByCode: ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

/**
 * التحقق من صحة قيمة الصلاحية (G/Y/X)
 */
function validatePermitValue(val) {
    if (!val) return 'X';
    const v = String(val).toUpperCase().trim();
    if (v === 'G' || v === 'Y' || v === 'X') return v;
    return 'X';
}
