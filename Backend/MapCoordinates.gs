/**
 * Google Apps Script for HSE System - Map Coordinates Module
 * 
 * موديول إحداثيات المواقع للخريطة
 * يدير حفظ واسترجاع إحداثيات المواقع والإحداثيات الافتراضية
 */

// اسم الجدول لإحداثيات المواقع
const MAP_COORDINATES_SHEET = 'PTW_MAP_COORDINATES';
// اسم الجدول للإحداثيات الافتراضية
const DEFAULT_COORDINATES_SHEET = 'PTW_DEFAULT_COORDINATES';

/**
 * تهيئة جدول إحداثيات المواقع
 */
function initMapCoordinatesTable(spreadsheetId = null) {
    try {
        if (!spreadsheetId) spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        
        // إنشاء جدول إحداثيات المواقع
        let mapSheet;
        try {
            mapSheet = spreadsheet.getSheetByName(MAP_COORDINATES_SHEET);
            if (!mapSheet) {
                mapSheet = spreadsheet.insertSheet(MAP_COORDINATES_SHEET);
            }
        } catch (error) {
            mapSheet = spreadsheet.insertSheet(MAP_COORDINATES_SHEET);
        }
        
        // التحقق من وجود الرؤوس
        const mapHeaders = mapSheet.getRange(1, 1, 1, 1).getValues()[0];
        if (!mapHeaders || mapHeaders.length === 0 || !mapHeaders[0] || mapHeaders[0] === '') {
            // استخدام getDefaultHeaders من Headers.gs
            const headerRow = getDefaultHeaders(MAP_COORDINATES_SHEET);
            if (headerRow && headerRow.length > 0) {
                mapSheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
                mapSheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
                mapSheet.setFrozenRows(1);
            } else {
                // نسخة احتياطية في حالة عدم وجود الرؤوس في Headers.gs
                const fallbackHeaders = ['id', 'name', 'latitude', 'longitude', 'zoom', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
                mapSheet.getRange(1, 1, 1, fallbackHeaders.length).setValues([fallbackHeaders]);
                mapSheet.getRange(1, 1, 1, fallbackHeaders.length).setFontWeight('bold');
                mapSheet.setFrozenRows(1);
            }
        }
        
        // إنشاء جدول الإحداثيات الافتراضية
        let defaultSheet;
        try {
            defaultSheet = spreadsheet.getSheetByName(DEFAULT_COORDINATES_SHEET);
            if (!defaultSheet) {
                defaultSheet = spreadsheet.insertSheet(DEFAULT_COORDINATES_SHEET);
            }
        } catch (error) {
            defaultSheet = spreadsheet.insertSheet(DEFAULT_COORDINATES_SHEET);
        }
        
        // التحقق من وجود الرؤوس
        const defaultHeaders = defaultSheet.getRange(1, 1, 1, 1).getValues()[0];
        if (!defaultHeaders || defaultHeaders.length === 0 || !defaultHeaders[0] || defaultHeaders[0] === '') {
            // استخدام getDefaultHeaders من Headers.gs
            const headerRow = getDefaultHeaders(DEFAULT_COORDINATES_SHEET);
            if (headerRow && headerRow.length > 0) {
                defaultSheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
                defaultSheet.getRange(1, 1, 1, headerRow.length).setFontWeight('bold');
                defaultSheet.setFrozenRows(1);
            } else {
                // نسخة احتياطية في حالة عدم وجود الرؤوس في Headers.gs
                const fallbackHeaders = ['latitude', 'longitude', 'zoom', 'updatedAt', 'updatedBy'];
                defaultSheet.getRange(1, 1, 1, fallbackHeaders.length).setValues([fallbackHeaders]);
                defaultSheet.getRange(1, 1, 1, fallbackHeaders.length).setFontWeight('bold');
                defaultSheet.setFrozenRows(1);
            }
        }
        
        return { 
            success: true, 
            message: 'تم تهيئة جداول إحداثيات المواقع بنجاح',
            sheets: {
                mapCoordinates: MAP_COORDINATES_SHEET,
                defaultCoordinates: DEFAULT_COORDINATES_SHEET
            }
        };
    } catch (error) {
        Logger.log('Error in initMapCoordinatesTable: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تهيئة جداول إحداثيات المواقع: ' + error.toString() };
    }
}

/**
 * حفظ إحداثيات المواقع
 */
function saveMapCoordinates(data) {
    try {
        if (!data || !Array.isArray(data)) {
            return { success: false, message: 'البيانات غير صحيحة - يجب أن تكون مصفوفة' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        // تهيئة الجدول إذا لم يكن موجوداً
        const initResult = initMapCoordinatesTable(spreadsheetId);
        if (!initResult.success) {
            return initResult;
        }
        
        // حفظ البيانات
        return saveToSheet(MAP_COORDINATES_SHEET, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in saveMapCoordinates: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ إحداثيات المواقع: ' + error.toString() };
    }
}

/**
 * الحصول على إحداثيات المواقع
 */
function getMapCoordinates() {
    try {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد', data: [] };
        }
        
        const data = readFromSheet(MAP_COORDINATES_SHEET, spreadsheetId);
        return { success: true, data: data || [] };
    } catch (error) {
        Logger.log('Error in getMapCoordinates: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة إحداثيات المواقع: ' + error.toString(), data: [] };
    }
}

/**
 * حفظ الإحداثيات الافتراضية
 */
function saveDefaultCoordinates(data) {
    try {
        if (!data || typeof data !== 'object') {
            return { success: false, message: 'البيانات غير صحيحة - يجب أن يكون كائن' };
        }
        
        if (!data.latitude || !data.longitude) {
            return { success: false, message: 'يجب تحديد latitude و longitude' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        // تهيئة الجدول إذا لم يكن موجوداً
        const initResult = initMapCoordinatesTable(spreadsheetId);
        if (!initResult.success) {
            return initResult;
        }
        
        // إضافة معلومات التحديث
        const updateData = {
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            zoom: parseInt(data.zoom) || 15,
            updatedAt: new Date(),
            updatedBy: data.updatedBy || 'system'
        };
        
        // حفظ البيانات (استبدال كامل - يجب أن يكون صف واحد فقط)
        return saveToSheet(DEFAULT_COORDINATES_SHEET, [updateData], spreadsheetId);
    } catch (error) {
        Logger.log('Error in saveDefaultCoordinates: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ الإحداثيات الافتراضية: ' + error.toString() };
    }
}

/**
 * الحصول على الإحداثيات الافتراضية
 */
function getDefaultCoordinates() {
    try {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد',
                data: { latitude: 24.7136, longitude: 46.6753, zoom: 15 }
            };
        }
        
        const data = readFromSheet(DEFAULT_COORDINATES_SHEET, spreadsheetId);
        
        // إذا كانت هناك بيانات، نرجع أول صف
        if (data && Array.isArray(data) && data.length > 0) {
            const firstRow = data[0];
            return { 
                success: true, 
                data: {
                    latitude: parseFloat(firstRow.latitude) || 24.7136,
                    longitude: parseFloat(firstRow.longitude) || 46.6753,
                    zoom: parseInt(firstRow.zoom) || 15
                }
            };
        }
        
        // إرجاع القيم الافتراضية
        return { 
            success: true, 
            data: { latitude: 24.7136, longitude: 46.6753, zoom: 15 }
        };
    } catch (error) {
        Logger.log('Error in getDefaultCoordinates: ' + error.toString());
        return { 
            success: false, 
            message: 'حدث خطأ أثناء قراءة الإحداثيات الافتراضية: ' + error.toString(),
            data: { latitude: 24.7136, longitude: 46.6753, zoom: 15 }
        };
    }
}

