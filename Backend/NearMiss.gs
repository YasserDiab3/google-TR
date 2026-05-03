/**
 * Google Apps Script for HSE System - NearMiss Module
 * 
 * موديول الحوادث الوشيكة - النسخة المحسنة
 */

/**
 * إضافة حادث وشيك
 */
function addNearMissToSheet(nearMissData) {
    try {
        if (!nearMissData) {
            return { success: false, message: 'بيانات الحادث الوشيك غير موجودة' };
        }
        
        const sheetName = 'NearMiss';
        
        // إضافة حقول تلقائية
        if (!nearMissData.id) {
            nearMissData.id = generateSequentialId('NRM', sheetName);
        }
        if (!nearMissData.createdAt) {
            nearMissData.createdAt = new Date();
        }
        if (!nearMissData.updatedAt) {
            nearMissData.updatedAt = new Date();
        }
        if (!nearMissData.status) {
            nearMissData.status = 'جديد';
        }
        
        // معالجة attachments - التأكد من تحويلها إلى JSON string مع الروابط
        if (nearMissData.attachments && Array.isArray(nearMissData.attachments)) {
            nearMissData.attachments = stringifyAttachments(nearMissData.attachments);
        } else if (nearMissData.attachments && typeof nearMissData.attachments === 'object') {
            nearMissData.attachments = stringifyAttachments([nearMissData.attachments]);
        } else if (!nearMissData.attachments) {
            nearMissData.attachments = '[]';
        }
        
        const result = appendToSheet(sheetName, nearMissData);
        
        // إنشاء إجراء تلقائي في Action Tracking إذا كان هناك إجراء تصحيحي
        if (result.success && (nearMissData.correctiveProposed || nearMissData.correctiveDescription)) {
            try {
                createActionFromModule('NearMiss', nearMissData.id || '', {
                    date: nearMissData.date || '',
                    description: nearMissData.description || '',
                    correctiveAction: nearMissData.correctiveProposed || nearMissData.correctiveDescription || '',
                    department: nearMissData.department || '',
                    location: nearMissData.location || '',
                    observerName: nearMissData.observerName || '',
                    createdBy: nearMissData.createdBy || 'System',
                    ...nearMissData
                });
            } catch (error) {
                Logger.log('Error creating auto action from near miss: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addNearMissToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الحادث الوشيك: ' + error.toString() };
    }
}

/**
 * تحديث حادث وشيك موجود
 */
function updateNearMiss(nearMissId, updateData) {
    try {
        if (!nearMissId) {
            return { success: false, message: 'معرف الحادث الوشيك غير محدد' };
        }
        
        const sheetName = 'NearMiss';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const nearMissIndex = data.findIndex(nm => nm.id === nearMissId);
        
        if (nearMissIndex === -1) {
            return { success: false, message: 'الحادث الوشيك غير موجود' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[nearMissIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating near miss: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الحادث الوشيك: ' + error.toString() };
    }
}

/**
 * الحصول على حادث وشيك محدد
 */
function getNearMiss(nearMissId) {
    try {
        if (!nearMissId) {
            return { success: false, message: 'معرف الحادث الوشيك غير محدد' };
        }
        
        const sheetName = 'NearMiss';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const nearMiss = data.find(nm => nm.id === nearMissId);
        
        if (!nearMiss) {
            return { success: false, message: 'الحادث الوشيك غير موجود' };
        }
        
        return { success: true, data: nearMiss };
    } catch (error) {
        Logger.log('Error getting near miss: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الحادث الوشيك: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الحوادث الوشيكة
 */
function getAllNearMisses(filters = {}) {
    try {
        const sheetName = 'NearMiss';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.department) {
            data = data.filter(nm => nm.department === filters.department);
        }
        if (filters.location) {
            data = data.filter(nm => nm.location === filters.location);
        }
        if (filters.type) {
            data = data.filter(nm => nm.type === filters.type);
        }
        if (filters.status) {
            data = data.filter(nm => nm.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(nm => {
                if (!nm.date) return false;
                return new Date(nm.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(nm => {
                if (!nm.date) return false;
                return new Date(nm.date) <= new Date(filters.endDate);
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
        Logger.log('Error getting all near misses: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الحوادث الوشيكة: ' + error.toString(), data: [] };
    }
}

/**
 * حذف حادث وشيك
 */
function deleteNearMiss(nearMissId) {
    try {
        if (!nearMissId) {
            return { success: false, message: 'معرف الحادث الوشيك غير محدد' };
        }
        
        const sheetName = 'NearMiss';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
            };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(nm => nm.id !== nearMissId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'الحادث الوشيك غير موجود' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting near miss: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الحادث الوشيك: ' + error.toString() };
    }
}

