/**
 * Google Apps Script for HSE System - Chemical Safety Module
 * 
 * موديول السلامة الكيميائية - النسخة المنفصلة والمحسنة
 * 
 * هذا الموديول يتعامل مع:
 * - إضافة سجلات السلامة الكيميائية
 * - تحديث السجلات
 * - الحصول على السجلات مع فلاتر متقدمة
 */

/**
 * ============================================
 * إضافة سجل سلامة كيميائية
 * ============================================
 * 
 * @param {Object} chemicalData - بيانات السجل
 * @returns {Object} نتيجة العملية
 */
function addChemicalSafetyToSheet(chemicalData) {
    try {
        if (!chemicalData) {
            return { success: false, message: 'بيانات السجل غير موجودة' };
        }
        
        const sheetName = 'ChemicalSafety';
        
        // إضافة حقول تلقائية
        if (!chemicalData.id) {
            chemicalData.id = generateSequentialId('CHS', sheetName);
        }
        if (!chemicalData.createdAt) {
            chemicalData.createdAt = new Date();
        }
        if (!chemicalData.updatedAt) {
            chemicalData.updatedAt = new Date();
        }
        if (!chemicalData.status) {
            chemicalData.status = 'نشط';
        }
        
        return appendToSheet(sheetName, chemicalData);
    } catch (error) {
        Logger.log('Error in addChemicalSafetyToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة السجل: ' + error.toString() };
    }
}

/**
 * ============================================
 * تحديث سجل سلامة كيميائية
 * ============================================
 * 
 * @param {String} chemicalId - معرف السجل
 * @param {Object} updateData - البيانات المحدثة
 * @returns {Object} نتيجة العملية
 */
function updateChemicalSafety(chemicalId, updateData) {
    try {
        if (!chemicalId) {
            return { success: false, message: 'معرف السجل غير محدد' };
        }
        
        const sheetName = 'ChemicalSafety';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const chemicalIndex = data.findIndex(c => c.id === chemicalId);
        
        if (chemicalIndex === -1) {
            return { success: false, message: 'السجل غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[chemicalIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating chemical safety: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث السجل: ' + error.toString() };
    }
}

/**
 * ============================================
 * الحصول على جميع سجلات السلامة الكيميائية
 * ============================================
 * 
 * @param {Object} filters - فلاتر البحث (اختياري)
 * @param {String} filters.status - الحالة
 * @param {String} filters.trainer - المدرب
 * @param {Date} filters.startDate - تاريخ البداية
 * @param {Date} filters.endDate - تاريخ النهاية
 * @returns {Object} نتيجة العملية مع قائمة السجلات
 */
function getAllChemicalSafety(filters = {}) {
    try {
        const sheetName = 'ChemicalSafety';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(c => c.status === filters.status);
        }
        if (filters.trainer) {
            data = data.filter(c => c.trainer === filters.trainer);
        }
        if (filters.startDate) {
            data = data.filter(c => {
                if (!c.date) return false;
                return new Date(c.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(c => {
                if (!c.date) return false;
                return new Date(c.date) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب التاريخ
        data.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all chemical safety: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة السجلات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * الحصول على سجل سلامة كيميائية محدد
 * ============================================
 * 
 * @param {String} chemicalId - معرف السجل
 * @returns {Object} نتيجة العملية مع بيانات السجل
 */
function getChemicalSafety(chemicalId) {
    try {
        if (!chemicalId) {
            return { success: false, message: 'معرف السجل غير محدد' };
        }
        
        const sheetName = 'ChemicalSafety';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const chemical = data.find(c => c.id === chemicalId);
        
        if (!chemical) {
            return { success: false, message: 'السجل غير موجود' };
        }
        
        return { success: true, data: chemical };
    } catch (error) {
        Logger.log('Error getting chemical safety: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة السجل: ' + error.toString() };
    }
}

/**
 * ============================================
 * حذف سجل سلامة كيميائية
 * ============================================
 * 
 * @param {String} chemicalId - معرف السجل
 * @returns {Object} نتيجة العملية
 */
function deleteChemicalSafety(chemicalId) {
    try {
        if (!chemicalId) {
            return { success: false, message: 'معرف السجل غير محدد' };
        }
        
        const sheetName = 'ChemicalSafety';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(c => c.id !== chemicalId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'السجل غير موجود' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting chemical safety: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف السجل: ' + error.toString() };
    }
}

