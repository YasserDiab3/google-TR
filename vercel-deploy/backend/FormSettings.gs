/**
 * Google Apps Script for HSE System - Form Settings Module
 * 
 * موديول إعدادات النماذج - النسخة المحسنة
 * 
 * هذا الموديول يدير إعدادات النماذج في Google Sheets
 * البيانات تُحفظ بصيغة عادية (كل صف = سجل واحد) مثل المقاولين
 * فقط مدير النظام يمكنه إضافة أو تعديل الإعدادات
 * 
 * الجداول:
 * - Form_Sites: المواقع
 * - Form_Places: الأماكن الفرعية (مرتبطة بالموقع)
 * - Form_Departments: الإدارات المسؤولة
 * - Form_SafetyTeam: فريق السلامة
 */

// أسماء الجداول
const FORM_SETTINGS_SHEETS = {
    SITES: 'Form_Sites',
    PLACES: 'Form_Places',
    DEPARTMENTS: 'Form_Departments',
    SAFETY_TEAM: 'Form_SafetyTeam',
    LEGACY: 'Form_Settings_DB' // الجدول القديم للتوافق
};

/**
 * التحقق من صلاحيات المستخدم (مدير النظام فقط)
 */
function checkFormSettingsPermission(userData) {
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
        
        // التحقق من صلاحية 'admin' أو 'manage-settings'
        if (userPermissions['admin'] === true || 
            userPermissions['manage-settings'] === true ||
            userPermissions['form-settings'] === true) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        return { 
            hasPermission: false, 
            message: 'ليس لديك صلاحية للوصول إلى إعدادات النماذج. يجب أن تكون مدير النظام فقط.' 
        };
    } catch (error) {
        Logger.log('Error checking form settings permissions: ' + error.toString());
        return { hasPermission: false, message: 'حدث خطأ أثناء التحقق من الصلاحيات' };
    }
}

/**
 * إنشاء جداول إعدادات النماذج إذا لم تكن موجودة
 */
function initFormSettingsTables(spreadsheetId) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) return { success: false, message: 'معرف Google Sheets غير محدد' };
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const createdSheets = [];
        
        // جدول المواقع
        if (!spreadsheet.getSheetByName(FORM_SETTINGS_SHEETS.SITES)) {
            const sitesSheet = spreadsheet.insertSheet(FORM_SETTINGS_SHEETS.SITES);
            const sitesHeaders = ['id', 'name', 'description', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
            sitesSheet.getRange(1, 1, 1, sitesHeaders.length).setValues([sitesHeaders]);
            sitesSheet.getRange(1, 1, 1, sitesHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');
            createdSheets.push(FORM_SETTINGS_SHEETS.SITES);
        }
        
        // جدول الأماكن الفرعية
        if (!spreadsheet.getSheetByName(FORM_SETTINGS_SHEETS.PLACES)) {
            const placesSheet = spreadsheet.insertSheet(FORM_SETTINGS_SHEETS.PLACES);
            const placesHeaders = ['id', 'siteId', 'siteName', 'name', 'description', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
            placesSheet.getRange(1, 1, 1, placesHeaders.length).setValues([placesHeaders]);
            placesSheet.getRange(1, 1, 1, placesHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');
            createdSheets.push(FORM_SETTINGS_SHEETS.PLACES);
        }
        
        // جدول الإدارات
        if (!spreadsheet.getSheetByName(FORM_SETTINGS_SHEETS.DEPARTMENTS)) {
            const deptsSheet = spreadsheet.insertSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS);
            const deptsHeaders = ['id', 'name', 'description', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
            deptsSheet.getRange(1, 1, 1, deptsHeaders.length).setValues([deptsHeaders]);
            deptsSheet.getRange(1, 1, 1, deptsHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');
            createdSheets.push(FORM_SETTINGS_SHEETS.DEPARTMENTS);
        }
        
        // جدول فريق السلامة
        if (!spreadsheet.getSheetByName(FORM_SETTINGS_SHEETS.SAFETY_TEAM)) {
            const safetySheet = spreadsheet.insertSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM);
            const safetyHeaders = ['id', 'name', 'position', 'phone', 'email', 'isActive', 'sortOrder', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
            safetySheet.getRange(1, 1, 1, safetyHeaders.length).setValues([safetyHeaders]);
            safetySheet.getRange(1, 1, 1, safetyHeaders.length).setFontWeight('bold').setBackground('#f0f0f0');
            createdSheets.push(FORM_SETTINGS_SHEETS.SAFETY_TEAM);
        }
        
        return { 
            success: true, 
            message: createdSheets.length > 0 ? 'تم إنشاء الجداول: ' + createdSheets.join(', ') : 'جميع الجداول موجودة',
            createdSheets: createdSheets
        };
    } catch (error) {
        Logger.log('Error initializing form settings tables: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إنشاء الجداول: ' + error.toString() };
    }
}

// ============================================
// دوال المواقع (Sites)
// ============================================

/**
 * إضافة موقع جديد
 */
function addSiteToSheet(siteData) {
    try {
        if (!siteData || !siteData.name) {
            return { success: false, message: 'يجب إدخال اسم الموقع' };
        }
        
        // التحقق من الصلاحيات
        const userData = siteData.userData || siteData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        // إنشاء سجل الموقع
        const site = {
            id: siteData.id || Utilities.getUuid(),
            name: siteData.name,
            description: siteData.description || '',
            isActive: siteData.isActive !== false ? 'نشط' : 'غير نشط',
            sortOrder: siteData.sortOrder || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userData.name || userData.email || 'System',
            updatedBy: userData.name || userData.email || 'System'
        };
        
        return appendToSheet(FORM_SETTINGS_SHEETS.SITES, site, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addSiteToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الموقع: ' + error.toString() };
    }
}

/**
 * تحديث موقع
 */
function updateSiteInSheet(siteId, updateData) {
    try {
        if (!siteId) {
            return { success: false, message: 'معرف الموقع غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const userData = updateData.userData || updateData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.SITES, spreadsheetId);
        const index = data.findIndex(s => s.id === siteId);
        
        if (index === -1) {
            return { success: false, message: 'الموقع غير موجود' };
        }
        
        // تحديث البيانات
        if (updateData.name !== undefined) data[index].name = updateData.name;
        if (updateData.description !== undefined) data[index].description = updateData.description;
        if (updateData.isActive !== undefined) data[index].isActive = updateData.isActive ? 'نشط' : 'غير نشط';
        if (updateData.sortOrder !== undefined) data[index].sortOrder = updateData.sortOrder;
        data[index].updatedAt = new Date().toISOString();
        data[index].updatedBy = userData.name || userData.email || 'System';
        
        return saveToSheet(FORM_SETTINGS_SHEETS.SITES, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateSiteInSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الموقع: ' + error.toString() };
    }
}

/**
 * حذف موقع
 */
function deleteSiteFromSheet(siteId, userData) {
    try {
        if (!siteId) {
            return { success: false, message: 'معرف الموقع غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        
        // حذف الموقع
        const sites = readFromSheet(FORM_SETTINGS_SHEETS.SITES, spreadsheetId);
        const filteredSites = sites.filter(s => s.id !== siteId);
        
        if (filteredSites.length === sites.length) {
            return { success: false, message: 'الموقع غير موجود' };
        }
        
        // حذف الأماكن المرتبطة بالموقع
        const places = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
        const filteredPlaces = places.filter(p => p.siteId !== siteId);
        
        // حفظ البيانات
        saveToSheet(FORM_SETTINGS_SHEETS.SITES, filteredSites, spreadsheetId);
        saveToSheet(FORM_SETTINGS_SHEETS.PLACES, filteredPlaces, spreadsheetId);
        
        return { success: true, message: 'تم حذف الموقع وجميع الأماكن المرتبطة به بنجاح' };
    } catch (error) {
        Logger.log('Error in deleteSiteFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الموقع: ' + error.toString() };
    }
}

/**
 * الحصول على جميع المواقع
 */
function getAllSitesFromSheet() {
    try {
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        const sites = readFromSheet(FORM_SETTINGS_SHEETS.SITES, spreadsheetId);
        
        // ترتيب حسب sortOrder ثم الاسم
        sites.sort((a, b) => {
            const orderDiff = (parseInt(a.sortOrder) || 0) - (parseInt(b.sortOrder) || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });
        
        return { success: true, data: sites, count: sites.length };
    } catch (error) {
        Logger.log('Error in getAllSitesFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المواقع: ' + error.toString(), data: [] };
    }
}

// ============================================
// دوال الأماكن الفرعية (Places)
// ============================================

/**
 * إضافة مكان جديد
 */
function addPlaceToSheet(placeData) {
    try {
        if (!placeData || !placeData.name || !placeData.siteId) {
            return { success: false, message: 'يجب إدخال اسم المكان ومعرف الموقع' };
        }
        
        // التحقق من الصلاحيات
        const userData = placeData.userData || placeData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        // الحصول على اسم الموقع
        const sites = readFromSheet(FORM_SETTINGS_SHEETS.SITES, spreadsheetId);
        const site = sites.find(s => s.id === placeData.siteId);
        
        // إنشاء سجل المكان
        const existingPlaces = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
        const place = {
            id: placeData.id || generateSequentialId('PLA', FORM_SETTINGS_SHEETS.PLACES, spreadsheetId),
            siteId: placeData.siteId,
            siteName: site ? site.name : placeData.siteName || '',
            name: placeData.name,
            description: placeData.description || '',
            isActive: placeData.isActive !== false ? 'نشط' : 'غير نشط',
            sortOrder: placeData.sortOrder || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userData.name || userData.email || 'System',
            updatedBy: userData.name || userData.email || 'System'
        };
        
        return appendToSheet(FORM_SETTINGS_SHEETS.PLACES, place, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addPlaceToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المكان: ' + error.toString() };
    }
}

/**
 * تحديث مكان
 */
function updatePlaceInSheet(placeId, updateData) {
    try {
        if (!placeId) {
            return { success: false, message: 'معرف المكان غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const userData = updateData.userData || updateData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
        const index = data.findIndex(p => p.id === placeId);
        
        if (index === -1) {
            return { success: false, message: 'المكان غير موجود' };
        }
        
        // تحديث البيانات
        if (updateData.name !== undefined) data[index].name = updateData.name;
        if (updateData.description !== undefined) data[index].description = updateData.description;
        if (updateData.isActive !== undefined) data[index].isActive = updateData.isActive ? 'نشط' : 'غير نشط';
        if (updateData.sortOrder !== undefined) data[index].sortOrder = updateData.sortOrder;
        data[index].updatedAt = new Date().toISOString();
        data[index].updatedBy = userData.name || userData.email || 'System';
        
        return saveToSheet(FORM_SETTINGS_SHEETS.PLACES, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updatePlaceInSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المكان: ' + error.toString() };
    }
}

/**
 * حذف مكان
 */
function deletePlaceFromSheet(placeId, userData) {
    try {
        if (!placeId) {
            return { success: false, message: 'معرف المكان غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
        const filteredData = data.filter(p => p.id !== placeId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'المكان غير موجود' };
        }
        
        return saveToSheet(FORM_SETTINGS_SHEETS.PLACES, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deletePlaceFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف المكان: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الأماكن
 */
function getAllPlacesFromSheet(siteId) {
    try {
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        let places = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
        
        // فلترة حسب الموقع إذا تم تحديده
        if (siteId) {
            places = places.filter(p => p.siteId === siteId);
        }
        
        // ترتيب حسب sortOrder ثم الاسم
        places.sort((a, b) => {
            const orderDiff = (parseInt(a.sortOrder) || 0) - (parseInt(b.sortOrder) || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });
        
        return { success: true, data: places, count: places.length };
    } catch (error) {
        Logger.log('Error in getAllPlacesFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الأماكن: ' + error.toString(), data: [] };
    }
}

// ============================================
// دوال الإدارات (Departments)
// ============================================

/**
 * إضافة إدارة جديدة
 */
function addDepartmentToSheet(deptData) {
    try {
        if (!deptData || !deptData.name) {
            return { success: false, message: 'يجب إدخال اسم الإدارة' };
        }
        
        // التحقق من الصلاحيات
        const userData = deptData.userData || deptData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        // إنشاء سجل الإدارة
        const dept = {
            id: deptData.id || Utilities.getUuid(),
            name: deptData.name,
            description: deptData.description || '',
            isActive: deptData.isActive !== false ? 'نشط' : 'غير نشط',
            sortOrder: deptData.sortOrder || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userData.name || userData.email || 'System',
            updatedBy: userData.name || userData.email || 'System'
        };
        
        return appendToSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, dept, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addDepartmentToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإدارة: ' + error.toString() };
    }
}

/**
 * تحديث إدارة
 */
function updateDepartmentInSheet(deptId, updateData) {
    try {
        if (!deptId) {
            return { success: false, message: 'معرف الإدارة غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const userData = updateData.userData || updateData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, spreadsheetId);
        const index = data.findIndex(d => d.id === deptId);
        
        if (index === -1) {
            return { success: false, message: 'الإدارة غير موجودة' };
        }
        
        // تحديث البيانات
        if (updateData.name !== undefined) data[index].name = updateData.name;
        if (updateData.description !== undefined) data[index].description = updateData.description;
        if (updateData.isActive !== undefined) data[index].isActive = updateData.isActive ? 'نشط' : 'غير نشط';
        if (updateData.sortOrder !== undefined) data[index].sortOrder = updateData.sortOrder;
        data[index].updatedAt = new Date().toISOString();
        data[index].updatedBy = userData.name || userData.email || 'System';
        
        return saveToSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateDepartmentInSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الإدارة: ' + error.toString() };
    }
}

/**
 * حذف إدارة
 */
function deleteDepartmentFromSheet(deptId, userData) {
    try {
        if (!deptId) {
            return { success: false, message: 'معرف الإدارة غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, spreadsheetId);
        const filteredData = data.filter(d => d.id !== deptId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'الإدارة غير موجودة' };
        }
        
        return saveToSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteDepartmentFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الإدارة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الإدارات
 */
function getAllDepartmentsFromSheet() {
    try {
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        const departments = readFromSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, spreadsheetId);
        
        // ترتيب حسب sortOrder ثم الاسم
        departments.sort((a, b) => {
            const orderDiff = (parseInt(a.sortOrder) || 0) - (parseInt(b.sortOrder) || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });
        
        return { success: true, data: departments, count: departments.length };
    } catch (error) {
        Logger.log('Error in getAllDepartmentsFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإدارات: ' + error.toString(), data: [] };
    }
}

// ============================================
// دوال فريق السلامة (Safety Team)
// ============================================

/**
 * إضافة عضو فريق سلامة جديد
 */
function addSafetyMemberToSheet(memberData) {
    try {
        if (!memberData || !memberData.name) {
            return { success: false, message: 'يجب إدخال اسم العضو' };
        }
        
        // التحقق من الصلاحيات
        const userData = memberData.userData || memberData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        // إنشاء سجل العضو
        const member = {
            id: memberData.id || Utilities.getUuid(),
            name: memberData.name,
            position: memberData.position || '',
            phone: memberData.phone || '',
            email: memberData.email || '',
            isActive: memberData.isActive !== false ? 'نشط' : 'غير نشط',
            sortOrder: memberData.sortOrder || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userData.name || userData.email || 'System',
            updatedBy: userData.name || userData.email || 'System'
        };
        
        return appendToSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, member, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addSafetyMemberToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة العضو: ' + error.toString() };
    }
}

/**
 * تحديث عضو فريق سلامة
 */
function updateSafetyMemberInSheet(memberId, updateData) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const userData = updateData.userData || updateData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, spreadsheetId);
        const index = data.findIndex(m => m.id === memberId);
        
        if (index === -1) {
            return { success: false, message: 'العضو غير موجود' };
        }
        
        // تحديث البيانات
        if (updateData.name !== undefined) data[index].name = updateData.name;
        if (updateData.position !== undefined) data[index].position = updateData.position;
        if (updateData.phone !== undefined) data[index].phone = updateData.phone;
        if (updateData.email !== undefined) data[index].email = updateData.email;
        if (updateData.isActive !== undefined) data[index].isActive = updateData.isActive ? 'نشط' : 'غير نشط';
        if (updateData.sortOrder !== undefined) data[index].sortOrder = updateData.sortOrder;
        data[index].updatedAt = new Date().toISOString();
        data[index].updatedBy = userData.name || userData.email || 'System';
        
        return saveToSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateSafetyMemberInSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث العضو: ' + error.toString() };
    }
}

/**
 * حذف عضو فريق سلامة
 */
function deleteSafetyMemberFromSheet(memberId, userData) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const permissionCheck = checkFormSettingsPermission(userData);
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message, errorCode: 'PERMISSION_DENIED' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, spreadsheetId);
        const filteredData = data.filter(m => m.id !== memberId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'العضو غير موجود' };
        }
        
        return saveToSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteSafetyMemberFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف العضو: ' + error.toString() };
    }
}

/**
 * الحصول على جميع أعضاء فريق السلامة
 */
function getAllSafetyMembersFromSheet() {
    try {
        const spreadsheetId = getSpreadsheetId();
        initFormSettingsTables(spreadsheetId);
        
        const members = readFromSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, spreadsheetId);
        
        // ترتيب حسب sortOrder ثم الاسم
        members.sort((a, b) => {
            const orderDiff = (parseInt(a.sortOrder) || 0) - (parseInt(b.sortOrder) || 0);
            if (orderDiff !== 0) return orderDiff;
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });
        
        return { success: true, data: members, count: members.length };
    } catch (error) {
        Logger.log('Error in getAllSafetyMembersFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة أعضاء فريق السلامة: ' + error.toString(), data: [] };
    }
}

// ============================================
// دوال التوافق مع النظام القديم
// ============================================

/**
 * حفظ إعدادات النماذج (للتوافق مع النظام القديم)
 * هذه الدالة تحول البيانات القديمة إلى الجداول الجديدة
 */
function saveFormSettingsToSheet(settingsData) {
    try {
        // التحقق من الصلاحيات
        const userData = settingsData.userData || settingsData.user || {};
        const permissionCheck = checkFormSettingsPermission(userData);
        
        if (!permissionCheck.hasPermission) {
            return { 
                success: false, 
                message: permissionCheck.message || 'ليس لديك صلاحية لحفظ إعدادات النماذج',
                errorCode: 'PERMISSION_DENIED'
            };
        }
        
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        // تهيئة الجداول
        initFormSettingsTables(spreadsheetId);
        
        // تحليل البيانات إذا كانت بصيغة JSON
        let sites = settingsData.sites || [];
        let departments = settingsData.departments || [];
        let safetyTeam = settingsData.safetyTeam || [];
        
        if (typeof sites === 'string') {
            try { sites = JSON.parse(sites); } catch (e) { sites = []; }
        }
        if (typeof departments === 'string') {
            try { departments = JSON.parse(departments); } catch (e) { departments = []; }
        }
        if (typeof safetyTeam === 'string') {
            try { safetyTeam = JSON.parse(safetyTeam); } catch (e) { safetyTeam = []; }
        }
        
        // قراءة البيانات الحالية للدمج
        const existingSites = readFromSheet(FORM_SETTINGS_SHEETS.SITES, spreadsheetId);
        const existingPlaces = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
        const existingDepartments = readFromSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, spreadsheetId);
        const existingSafetyTeam = readFromSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, spreadsheetId);
        
        // معالجة المواقع والأماكن
        const sitesToSave = [];
        const placesToSave = [];
        
        sites.forEach((site, siteIndex) => {
            const siteId = site.id || Utilities.getUuid();
            const existingSite = existingSites.find(s => s.id === siteId || s.name === site.name);
            
            sitesToSave.push({
                id: existingSite?.id || siteId,
                name: site.name || '',
                description: site.description || '',
                isActive: 'نشط',
                sortOrder: siteIndex,
                createdAt: existingSite?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: existingSite?.createdBy || userData.name || userData.email || 'System',
                updatedBy: userData.name || userData.email || 'System'
            });
            
            // معالجة الأماكن الفرعية
            if (Array.isArray(site.places)) {
                site.places.forEach((place, placeIndex) => {
                    const placeId = place.id || generateSequentialId('PLA', FORM_SETTINGS_SHEETS.PLACES, spreadsheetId);
                    const existingPlace = existingPlaces.find(p => p.id === placeId || (p.siteId === siteId && p.name === place.name));
                    
                    placesToSave.push({
                        id: existingPlace?.id || placeId,
                        siteId: existingSite?.id || siteId,
                        siteName: site.name || '',
                        name: place.name || '',
                        description: place.description || '',
                        isActive: 'نشط',
                        sortOrder: placeIndex,
                        createdAt: existingPlace?.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: existingPlace?.createdBy || userData.name || userData.email || 'System',
                        updatedBy: userData.name || userData.email || 'System'
                    });
                });
            }
        });
        
        // معالجة الإدارات
        const departmentsToSave = [];
        departments.forEach((dept, index) => {
            const deptName = typeof dept === 'string' ? dept : dept.name;
            if (!deptName) return;
            
            const existingDept = existingDepartments.find(d => d.name === deptName);
            
            departmentsToSave.push({
                id: existingDept?.id || Utilities.getUuid(),
                name: deptName,
                description: typeof dept === 'object' ? (dept.description || '') : '',
                isActive: 'نشط',
                sortOrder: index,
                createdAt: existingDept?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: existingDept?.createdBy || userData.name || userData.email || 'System',
                updatedBy: userData.name || userData.email || 'System'
            });
        });
        
        // معالجة فريق السلامة
        const safetyToSave = [];
        safetyTeam.forEach((member, index) => {
            const memberName = typeof member === 'string' ? member : member.name;
            if (!memberName) return;
            
            const existingMember = existingSafetyTeam.find(m => m.name === memberName);
            
            safetyToSave.push({
                id: existingMember?.id || Utilities.getUuid(),
                name: memberName,
                position: typeof member === 'object' ? (member.position || '') : '',
                phone: typeof member === 'object' ? (member.phone || '') : '',
                email: typeof member === 'object' ? (member.email || '') : '',
                isActive: 'نشط',
                sortOrder: index,
                createdAt: existingMember?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: existingMember?.createdBy || userData.name || userData.email || 'System',
                updatedBy: userData.name || userData.email || 'System'
            });
        });
        
        // حفظ البيانات في الجداول الجديدة
        if (sitesToSave.length > 0) {
            saveToSheet(FORM_SETTINGS_SHEETS.SITES, sitesToSave, spreadsheetId);
        }
        if (placesToSave.length > 0) {
            saveToSheet(FORM_SETTINGS_SHEETS.PLACES, placesToSave, spreadsheetId);
        }
        if (departmentsToSave.length > 0) {
            saveToSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, departmentsToSave, spreadsheetId);
        }
        if (safetyToSave.length > 0) {
            saveToSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, safetyToSave, spreadsheetId);
        }
        
        Logger.log('Form settings saved successfully to new tables');
        return { success: true, message: 'تم حفظ إعدادات النماذج بنجاح' };
    } catch (error) {
        Logger.log('Error in saveFormSettingsToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ إعدادات النماذج: ' + error.toString() };
    }
}

/**
 * الحصول على إعدادات النماذج (للتوافق مع النظام القديم)
 * هذه الدالة تجمع البيانات من الجداول الجديدة وتعيدها بالصيغة القديمة
 */
function getFormSettingsFromSheet() {
    try {
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد',
                data: getDefaultFormSettings()
            };
        }
        
        // تهيئة الجداول
        initFormSettingsTables(spreadsheetId);
        
        // قراءة البيانات من الجداول الجديدة
        const sitesResult = getAllSitesFromSheet();
        const placesResult = getAllPlacesFromSheet();
        const departmentsResult = getAllDepartmentsFromSheet();
        const safetyResult = getAllSafetyMembersFromSheet();
        
        const sites = sitesResult.success ? sitesResult.data : [];
        const places = placesResult.success ? placesResult.data : [];
        const departments = departmentsResult.success ? departmentsResult.data : [];
        const safetyTeam = safetyResult.success ? safetyResult.data : [];
        
        // ✅ إصلاح: تحويل البيانات إلى الصيغة القديمة للتوافق مع ربط صحيح للأماكن بالمواقع
        // ✅ إصلاح: استخدام String() لضمان المقارنة الصحيحة بين siteId و site.id
        const formattedSites = sites.map(site => {
            const siteId = String(site.id || '').trim();
            // ✅ إصلاح: فلترة الأماكن باستخدام String() لضمان المطابقة الصحيحة
            const sitePlaces = places.filter(p => {
                const placeSiteId = String(p.siteId || '').trim();
                return placeSiteId === siteId && placeSiteId !== '';
            }).map(p => ({
                id: p.id || '',
                name: p.name || ''
            }));
            
            return {
                id: site.id,
                name: site.name,
                description: site.description || '',
                places: sitePlaces // ✅ إصلاح: جميع الأماكن المرتبطة بالموقع
            };
        });
        
        const formattedDepartments = departments.map(d => d.name);
        const formattedSafetyTeam = safetyTeam.map(m => m.name);
        
        const result = {
            id: 'FORM-SETTINGS-1',
            sites: formattedSites,
            departments: formattedDepartments,
            safetyTeam: formattedSafetyTeam,
            updatedAt: new Date().toISOString(),
            updatedBy: 'System'
        };
        
        return { success: true, data: result };
    } catch (error) {
        Logger.log('Error in getFormSettingsFromSheet: ' + error.toString());
        return { 
            success: false, 
            message: 'حدث خطأ أثناء قراءة إعدادات النماذج: ' + error.toString(),
            data: getDefaultFormSettings()
        };
    }
}

/**
 * الحصول على الإعدادات الافتراضية
 */
function getDefaultFormSettings() {
    return {
        id: 'FORM-SETTINGS-1',
        sites: [],
        departments: [],
        safetyTeam: [],
        updatedAt: new Date().toISOString(),
        updatedBy: 'System'
    };
}

// ============================================
// دوال مساعدة للتحقق من وجود البيانات
// ============================================

/**
 * التحقق من وجود موقع بنفس الاسم
 */
function isSiteExists(siteName) {
    try {
        const sites = readFromSheet(FORM_SETTINGS_SHEETS.SITES, getSpreadsheetId());
        return sites.some(s => s.name.toLowerCase() === siteName.toLowerCase());
    } catch (error) {
        return false;
    }
}

/**
 * التحقق من وجود مكان بنفس الاسم في موقع معين
 */
function isPlaceExists(siteId, placeName) {
    try {
        const places = readFromSheet(FORM_SETTINGS_SHEETS.PLACES, getSpreadsheetId());
        return places.some(p => p.siteId === siteId && p.name.toLowerCase() === placeName.toLowerCase());
    } catch (error) {
        return false;
    }
}

/**
 * التحقق من وجود إدارة بنفس الاسم
 */
function isDepartmentExists(deptName) {
    try {
        const departments = readFromSheet(FORM_SETTINGS_SHEETS.DEPARTMENTS, getSpreadsheetId());
        return departments.some(d => d.name.toLowerCase() === deptName.toLowerCase());
    } catch (error) {
        return false;
    }
}

/**
 * التحقق من وجود عضو فريق سلامة بنفس الاسم
 */
function isSafetyMemberExists(memberName) {
    try {
        const members = readFromSheet(FORM_SETTINGS_SHEETS.SAFETY_TEAM, getSpreadsheetId());
        return members.some(m => m.name.toLowerCase() === memberName.toLowerCase());
    } catch (error) {
        return false;
    }
}
