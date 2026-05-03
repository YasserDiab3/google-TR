/**
 * Google Apps Script for HSE System - Periodic Inspection Module
 * 
 * موديول الفحوصات الدورية
 */

/**
 * إضافة فحص دوري
 */
function addPeriodicInspectionToSheet(inspectionData) {
    try {
        const sheetName = 'PeriodicInspections';
        const result = appendToSheet(sheetName, inspectionData);
        
        // إنشاء إجراء تلقائي في Action Tracking إذا كان هناك توصيات أو نتائج
        if (result.success && (inspectionData.recommendations || inspectionData.findings)) {
            try {
                createActionFromModule('Inspections', inspectionData.id || '', {
                    date: inspectionData.date || '',
                    description: inspectionData.findings || inspectionData.description || '',
                    correctiveAction: inspectionData.recommendations || '',
                    location: inspectionData.location || '',
                    inspector: inspectionData.inspector || '',
                    createdBy: inspectionData.createdBy || 'System',
                    ...inspectionData
                });
            } catch (error) {
                Logger.log('Error creating auto action from inspection: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addPeriodicInspectionToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الفحص: ' + error.toString() };
    }
}

/**
 * تحديث فحص دوري
 */
function updatePeriodicInspection(inspectionId, updateData) {
    try {
        if (!inspectionId) {
            return { success: false, message: 'معرف الفحص غير محدد' };
        }
        
        const sheetName = 'PeriodicInspections';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const inspectionIndex = data.findIndex(i => i.id === inspectionId);
        
        if (inspectionIndex === -1) {
            return { success: false, message: 'الفحص غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[inspectionIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating periodic inspection: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الفحص: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الفحوصات الدورية
 */
function getAllPeriodicInspections(filters = {}) {
    try {
        const sheetName = 'PeriodicInspections';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.inspectionType) {
            data = data.filter(i => i.inspectionType === filters.inspectionType);
        }
        if (filters.location) {
            data = data.filter(i => i.location === filters.location);
        }
        if (filters.inspector) {
            data = data.filter(i => i.inspector === filters.inspector);
        }
        if (filters.status) {
            data = data.filter(i => i.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(i => {
                if (!i.date) return false;
                return new Date(i.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(i => {
                if (!i.date) return false;
                return new Date(i.date) <= new Date(filters.endDate);
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
        Logger.log('Error getting all periodic inspections: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الفحوصات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة فئة فحص دوري
 */
function addPeriodicInspectionCategoryToSheet(categoryData) {
    try {
        if (!categoryData) {
            return { success: false, message: 'بيانات الفئة غير موجودة' };
        }
        
        const sheetName = 'PeriodicInspectionCategories';
        
        // إضافة حقول تلقائية
        if (!categoryData.id) {
            categoryData.id = generateSequentialId('PIC', sheetName);
        }
        if (!categoryData.createdAt) {
            categoryData.createdAt = new Date();
        }
        if (!categoryData.updatedAt) {
            categoryData.updatedAt = new Date();
        }
        if (categoryData.isDefault === undefined) {
            categoryData.isDefault = false;
        }
        
        return appendToSheet(sheetName, categoryData);
    } catch (error) {
        Logger.log('Error in addPeriodicInspectionCategoryToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الفئة: ' + error.toString() };
    }
}

/**
 * تحديث فئة فحص دوري
 */
function updatePeriodicInspectionCategory(categoryId, updateData) {
    try {
        if (!categoryId) {
            return { success: false, message: 'معرف الفئة غير محدد' };
        }
        
        const sheetName = 'PeriodicInspectionCategories';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const categoryIndex = data.findIndex(c => c.id === categoryId);
        
        if (categoryIndex === -1) {
            return { success: false, message: 'الفئة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[categoryIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating category: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الفئة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع فئات الفحص الدوري
 */
function getAllPeriodicInspectionCategories() {
    try {
        const sheetName = 'PeriodicInspectionCategories';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        
        // ترتيب حسب الاسم
        data.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all categories: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الفئات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة قائمة فحص دوري
 */
function addPeriodicInspectionChecklistToSheet(checklistData) {
    try {
        if (!checklistData) {
            return { success: false, message: 'بيانات القائمة غير موجودة' };
        }
        
        const sheetName = 'PeriodicInspectionChecklists';
        
        // إضافة حقول تلقائية
        if (!checklistData.id) {
            checklistData.id = generateSequentialId('PIC', sheetName);
        }
        if (!checklistData.createdAt) {
            checklistData.createdAt = new Date();
        }
        if (!checklistData.updatedAt) {
            checklistData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, checklistData);
    } catch (error) {
        Logger.log('Error in addPeriodicInspectionChecklistToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة القائمة: ' + error.toString() };
    }
}

/**
 * تحديث قائمة فحص دوري
 */
function updatePeriodicInspectionChecklist(checklistId, updateData) {
    try {
        if (!checklistId) {
            return { success: false, message: 'معرف القائمة غير محدد' };
        }
        
        const sheetName = 'PeriodicInspectionChecklists';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const checklistIndex = data.findIndex(c => c.id === checklistId);
        
        if (checklistIndex === -1) {
            return { success: false, message: 'القائمة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[checklistIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating checklist: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث القائمة: ' + error.toString() };
    }
}

/**
 * الحصول على قائمة فحص دوري
 */
function getPeriodicInspectionChecklist(checklistId) {
    try {
        if (!checklistId) {
            return { success: false, message: 'معرف القائمة غير محدد' };
        }
        
        const sheetName = 'PeriodicInspectionChecklists';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const checklist = data.find(c => c.id === checklistId);
        
        if (!checklist) {
            return { success: false, message: 'القائمة غير موجودة' };
        }
        
        return { success: true, data: checklist };
    } catch (error) {
        Logger.log('Error getting checklist: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة القائمة: ' + error.toString() };
    }
}

/**
 * الحصول على قوائم فحص لفئة محددة
 */
function getChecklistsByCategory(categoryId) {
    try {
        const sheetName = 'PeriodicInspectionChecklists';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const checklists = data.filter(c => c.categoryId === categoryId);
        
        return { success: true, data: checklists, count: checklists.length };
    } catch (error) {
        Logger.log('Error getting checklists by category: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة القوائم: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة جدول فحص دوري
 */
function addPeriodicInspectionScheduleToSheet(scheduleData) {
    try {
        if (!scheduleData) {
            return { success: false, message: 'بيانات الجدول غير موجودة' };
        }
        
        const sheetName = 'PeriodicInspectionSchedules';
        
        // إضافة حقول تلقائية
        if (!scheduleData.id) {
            scheduleData.id = generateSequentialId('PIS', sheetName);
        }
        if (!scheduleData.createdAt) {
            scheduleData.createdAt = new Date();
        }
        if (!scheduleData.updatedAt) {
            scheduleData.updatedAt = new Date();
        }
        if (!scheduleData.status) {
            scheduleData.status = 'مجدول';
        }
        
        return appendToSheet(sheetName, scheduleData);
    } catch (error) {
        Logger.log('Error in addPeriodicInspectionScheduleToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الجدول: ' + error.toString() };
    }
}

/**
 * تحديث جدول فحص دوري
 */
function updatePeriodicInspectionSchedule(scheduleId, updateData) {
    try {
        if (!scheduleId) {
            return { success: false, message: 'معرف الجدول غير محدد' };
        }
        
        const sheetName = 'PeriodicInspectionSchedules';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const scheduleIndex = data.findIndex(s => s.id === scheduleId);
        
        if (scheduleIndex === -1) {
            return { success: false, message: 'الجدول غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[scheduleIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating schedule: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الجدول: ' + error.toString() };
    }
}

/**
 * الحصول على جميع جداول الفحص الدوري
 */
function getAllPeriodicInspectionSchedules(filters = {}) {
    try {
        const sheetName = 'PeriodicInspectionSchedules';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.categoryId) {
            data = data.filter(s => s.categoryId === filters.categoryId);
        }
        if (filters.location) {
            data = data.filter(s => s.location === filters.location);
        }
        if (filters.assignedTo) {
            data = data.filter(s => s.assignedTo === filters.assignedTo);
        }
        if (filters.status) {
            data = data.filter(s => s.status === filters.status);
        }
        if (filters.dueSoon) {
            const now = new Date();
            const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            data = data.filter(s => {
                if (!s.scheduledDate) return false;
                const scheduledDate = new Date(s.scheduledDate);
                return scheduledDate >= now && scheduledDate <= sevenDaysFromNow;
            });
        }
        
        // ترتيب حسب التاريخ المجدول
        data.sort((a, b) => {
            const dateA = new Date(a.scheduledDate || '9999-12-31');
            const dateB = new Date(b.scheduledDate || '9999-12-31');
            return dateA - dateB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all schedules: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الجداول: ' + error.toString(), data: [] };
    }
}

/**
 * تحديث سجل فحص دوري
 */
function updatePeriodicInspectionRecord(recordId, updateData) {
    try {
        if (!recordId) {
            return { success: false, message: 'معرف السجل غير محدد' };
        }
        
        const sheetName = 'PeriodicInspectionRecords';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const recordIndex = data.findIndex(r => r.id === recordId);
        
        if (recordIndex === -1) {
            return { success: false, message: 'السجل غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[recordIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating inspection record: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث السجل: ' + error.toString() };
    }
}

/**
 * الحصول على جميع سجلات الفحص الدوري
 */
function getAllPeriodicInspectionRecords(filters = {}) {
    try {
        const sheetName = 'PeriodicInspectionRecords';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.categoryId) {
            data = data.filter(r => r.categoryId === filters.categoryId);
        }
        if (filters.location) {
            data = data.filter(r => r.location === filters.location);
        }
        if (filters.inspector) {
            data = data.filter(r => r.inspector === filters.inspector);
        }
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        if (filters.scheduleId) {
            data = data.filter(r => r.scheduleId === filters.scheduleId);
        }
        if (filters.startDate) {
            data = data.filter(r => {
                if (!r.inspectionDate) return false;
                return new Date(r.inspectionDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(r => {
                if (!r.inspectionDate) return false;
                return new Date(r.inspectionDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب تاريخ الفحص
        data.sort((a, b) => {
            const dateA = new Date(a.inspectionDate || a.createdAt || 0);
            const dateB = new Date(b.inspectionDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all inspection records: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة السجلات: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على الفحوصات المستحقة
 */
function getPeriodicInspectionAlerts() {
    try {
        const schedules = readFromSheet('PeriodicInspectionSchedules', getSpreadsheetId());
        const now = new Date();
        
        const alerts = {
            overdue: [],
            dueSoon: []
        };
        
        schedules.forEach(schedule => {
            if (schedule.scheduledDate && schedule.status !== 'مكتمل' && schedule.status !== 'Completed') {
                const scheduledDate = new Date(schedule.scheduledDate);
                const daysUntil = Math.ceil((scheduledDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysUntil < 0) {
                    alerts.overdue.push(schedule);
                } else if (daysUntil <= 7) {
                    alerts.dueSoon.push(schedule);
                }
            }
        });
        
        return { success: true, data: alerts };
    } catch (error) {
        Logger.log('Error getting inspection alerts: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على التنبيهات: ' + error.toString() };
    }
}

/**
 * إضافة سجل فحص دوري
 */
function addPeriodicInspectionRecordToSheet(recordData) {
    try {
        const sheetName = 'PeriodicInspectionRecords';
        const result = appendToSheet(sheetName, recordData);
        
        // إنشاء إجراء تلقائي في Action Tracking إذا كان هناك توصيات
        if (result.success && recordData.recommendations) {
            try {
                createActionFromModule('Inspections', recordData.id || '', {
                    date: recordData.inspectionDate || recordData.date || '',
                    description: recordData.findings || recordData.description || '',
                    correctiveAction: recordData.recommendations || '',
                    location: recordData.location || '',
                    inspector: recordData.inspector || '',
                    createdBy: recordData.createdBy || 'System',
                    ...recordData
                });
            } catch (error) {
                Logger.log('Error creating auto action from inspection record: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addPeriodicInspectionRecordToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة سجل الفحص: ' + error.toString() };
    }
}

