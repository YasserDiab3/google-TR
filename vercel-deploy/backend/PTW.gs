/**
 * Google Apps Script for HSE System - PTW Module
 * 
 * موديول تصاريح العمل - النسخة المحسنة
 */

/**
 * إضافة تصريح عمل
 */
function addPTWToSheet(ptwData) {
    try {
        if (!ptwData) {
            return { success: false, message: 'بيانات التصريح غير موجودة' };
        }
        
        const sheetName = 'PTW';
        
        // إضافة حقول تلقائية
        if (!ptwData.id) {
            ptwData.id = generateSequentialId('PTW', sheetName);
        }
        if (!ptwData.createdAt) {
            ptwData.createdAt = new Date();
        }
        if (!ptwData.updatedAt) {
            ptwData.updatedAt = new Date();
        }
        if (!ptwData.status) {
            ptwData.status = 'قيد المراجعة';
        }
        
        return appendToSheet(sheetName, ptwData);
    } catch (error) {
        Logger.log('Error in addPTWToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التصريح: ' + error.toString() };
    }
}

/**
 * تحديث تصريح عمل
 */
function updatePTW(ptwId, updateData) {
    try {
        if (!ptwId) {
            return { success: false, message: 'معرف التصريح غير محدد' };
        }
        
        const sheetName = 'PTW';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const ptwIndex = data.findIndex(ptw => ptw.id === ptwId);
        
        if (ptwIndex === -1) {
            return { success: false, message: 'التصريح غير موجود' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[ptwIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating PTW: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التصريح: ' + error.toString() };
    }
}

/**
 * الحصول على تصريح عمل محدد
 */
function getPTW(ptwId) {
    try {
        if (!ptwId) {
            return { success: false, message: 'معرف التصريح غير محدد' };
        }
        
        const sheetName = 'PTW';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const ptw = data.find(p => p.id === ptwId);
        
        if (!ptw) {
            return { success: false, message: 'التصريح غير موجود' };
        }
        
        return { success: true, data: ptw };
    } catch (error) {
        Logger.log('Error getting PTW: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التصريح: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تصاريح العمل
 */
function getAllPTWs(filters = {}) {
    try {
        const sheetName = 'PTW';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.department) {
            data = data.filter(ptw => ptw.department === filters.department);
        }
        if (filters.location) {
            data = data.filter(ptw => ptw.location === filters.location);
        }
        if (filters.workType) {
            data = data.filter(ptw => ptw.workType === filters.workType);
        }
        if (filters.status) {
            data = data.filter(ptw => ptw.status === filters.status);
        }
        if (filters.responsible) {
            data = data.filter(ptw => ptw.responsible === filters.responsible);
        }
        if (filters.startDate) {
            data = data.filter(ptw => {
                if (!ptw.startDate) return false;
                return new Date(ptw.startDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(ptw => {
                if (!ptw.endDate) return false;
                return new Date(ptw.endDate) <= new Date(filters.endDate);
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
        Logger.log('Error getting all PTWs: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التصاريح: ' + error.toString(), data: [] };
    }
}

/**
 * حذف تصريح عمل
 */
function deletePTW(ptwId) {
    try {
        if (!ptwId) {
            return { success: false, message: 'معرف التصريح غير محدد' };
        }
        
        const sheetName = 'PTW';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
            };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(ptw => ptw.id !== ptwId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'التصريح غير موجود' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting PTW: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف التصريح: ' + error.toString() };
    }
}

/**
 * الحصول على التصاريح المنتهية أو المستحقة
 */
function getPTWAlerts() {
    try {
        const sheetName = 'PTW';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const now = new Date();
        
        const alerts = {
            expired: [],
            expiringSoon: [],
            pendingApproval: []
        };
        
        data.forEach(ptw => {
            // التصاريح المنتهية
            if (ptw.endDate) {
                const endDate = new Date(ptw.endDate);
                if (endDate < now && ptw.status !== 'منتهي' && ptw.status !== 'مكتمل') {
                    alerts.expired.push(ptw);
                } else if (endDate >= now && endDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
                    // تنتهي خلال 24 ساعة
                    alerts.expiringSoon.push(ptw);
                }
            }
            
            // التصاريح قيد المراجعة
            if (ptw.status === 'قيد المراجعة' || ptw.status === 'Pending') {
                alerts.pendingApproval.push(ptw);
            }
        });
        
        return { success: true, data: alerts };
    } catch (error) {
        Logger.log('Error getting PTW alerts: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على التنبيهات: ' + error.toString() };
    }
}

