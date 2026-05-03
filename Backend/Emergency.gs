/**
 * Google Apps Script for HSE System - Emergency Module
 * 
 * موديول الطوارئ - النسخة المحسنة
 */

/**
 * ============================================
 * تنبيهات الطوارئ (Emergency Alerts)
 * ============================================
 */

/**
 * إضافة تنبيه طوارئ
 */
function addEmergencyAlertToSheet(alertData) {
    try {
        if (!alertData) {
            return { success: false, message: 'بيانات التنبيه غير موجودة' };
        }
        
        const sheetName = 'EmergencyAlerts';
        
        // إضافة حقول تلقائية
        if (!alertData.id) {
            alertData.id = generateSequentialId('EMA', sheetName);
        }
        if (!alertData.createdAt) {
            alertData.createdAt = new Date();
        }
        if (!alertData.updatedAt) {
            alertData.updatedAt = new Date();
        }
        if (!alertData.status) {
            alertData.status = 'نشط';
        }
        if (!alertData.priority) {
            alertData.priority = 'medium';
        }
        
        return appendToSheet(sheetName, alertData);
    } catch (error) {
        Logger.log('Error in addEmergencyAlertToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التنبيه: ' + error.toString() };
    }
}

/**
 * تحديث تنبيه طوارئ
 */
function updateEmergencyAlert(alertId, updateData) {
    try {
        if (!alertId) {
            return { success: false, message: 'معرف التنبيه غير محدد' };
        }
        
        const sheetName = 'EmergencyAlerts';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const alertIndex = data.findIndex(a => a.id === alertId);
        
        if (alertIndex === -1) {
            return { success: false, message: 'التنبيه غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[alertIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating emergency alert: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التنبيه: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تنبيهات الطوارئ
 */
function getAllEmergencyAlerts(filters = {}) {
    try {
        const sheetName = 'EmergencyAlerts';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.type) {
            data = data.filter(a => a.type === filters.type);
        }
        if (filters.priority) {
            data = data.filter(a => a.priority === filters.priority);
        }
        if (filters.status) {
            data = data.filter(a => a.status === filters.status);
        }
        if (filters.active) {
            data = data.filter(a => a.status === 'نشط' || a.status === 'active');
        }
        
        // ترتيب حسب الأولوية والتاريخ
        data.sort((a, b) => {
            const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all emergency alerts: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التنبيهات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * خطط الطوارئ (Emergency Plans)
 * ============================================
 */

/**
 * إضافة خطة طوارئ
 */
function addEmergencyPlanToSheet(planData) {
    try {
        if (!planData) {
            return { success: false, message: 'بيانات الخطة غير موجودة' };
        }
        
        const sheetName = 'EmergencyPlans';
        
        // إضافة حقول تلقائية
        if (!planData.id) {
            planData.id = generateSequentialId('EMP', sheetName);
        }
        if (!planData.createdAt) {
            planData.createdAt = new Date();
        }
        if (!planData.updatedAt) {
            planData.updatedAt = new Date();
        }
        if (!planData.status) {
            planData.status = 'نشط';
        }
        
        return appendToSheet(sheetName, planData);
    } catch (error) {
        Logger.log('Error in addEmergencyPlanToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الخطة: ' + error.toString() };
    }
}

/**
 * تحديث خطة طوارئ
 */
function updateEmergencyPlan(planId, updateData) {
    try {
        if (!planId) {
            return { success: false, message: 'معرف الخطة غير محدد' };
        }
        
        const sheetName = 'EmergencyPlans';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const planIndex = data.findIndex(p => p.id === planId);
        
        if (planIndex === -1) {
            return { success: false, message: 'الخطة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[planIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating emergency plan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الخطة: ' + error.toString() };
    }
}

/**
 * الحصول على خطة طوارئ محددة
 */
function getEmergencyPlan(planId) {
    try {
        if (!planId) {
            return { success: false, message: 'معرف الخطة غير محدد' };
        }
        
        const sheetName = 'EmergencyPlans';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const plan = data.find(p => p.id === planId);
        
        if (!plan) {
            return { success: false, message: 'الخطة غير موجودة' };
        }
        
        return { success: true, data: plan };
    } catch (error) {
        Logger.log('Error getting emergency plan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الخطة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع خطط الطوارئ
 */
function getAllEmergencyPlans(filters = {}) {
    try {
        const sheetName = 'EmergencyPlans';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.type) {
            data = data.filter(p => p.type === filters.type);
        }
        if (filters.status) {
            data = data.filter(p => p.status === filters.status);
        }
        if (filters.needsReview) {
            const now = new Date();
            data = data.filter(p => {
                if (!p.nextReview) return false;
                const nextReview = new Date(p.nextReview);
                return nextReview <= now;
            });
        }
        
        // ترتيب حسب الاسم
        data.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all emergency plans: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الخطط: ' + error.toString(), data: [] };
    }
}

/**
 * حذف خطة طوارئ
 */
function deleteEmergencyPlan(planId) {
    try {
        if (!planId) {
            return { success: false, message: 'معرف الخطة غير محدد' };
        }

        const sheetName = 'EmergencyPlans';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(p => p.id !== planId);

        if (filteredData.length === data.length) {
            return { success: false, message: 'الخطة غير موجودة' };
        }

        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting emergency plan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الخطة: ' + error.toString() };
    }
}

/**
 * ============================================
 * تحديثات خطط الطوارئ (Emergency Plans Updates)
 * ============================================
 */

/**
 * إضافة أو تحديث سجل تحديثات خطط الطوارئ
 */
function upsertEmergencyPlanUpdate(sectionKey, updateData) {
    try {
        if (!sectionKey) {
            return { success: false, message: 'مفتاح القسم غير محدد' };
        }

        const sheetName = 'EmergencyPlansUpdates';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const existingIndex = data.findIndex(p => p.sectionKey === sectionKey);

        if (existingIndex !== -1) {
            // تحديث السجل الموجود
            updateData.updatedAt = new Date();
            if (!updateData.id) {
                updateData.id = data[existingIndex].id;
            }
            for (var key in updateData) {
                if (updateData.hasOwnProperty(key)) {
                    data[existingIndex][key] = updateData[key];
                }
            }
            return saveToSheet(sheetName, data, spreadsheetId);
        } else {
            // إضافة سجل جديد
            if (!updateData.id) {
                updateData.id = generateSequentialId('EPU', sheetName);
            }
            updateData.createdAt = new Date();
            updateData.updatedAt = new Date();
            if (!updateData.isActive) {
                updateData.isActive = true;
            }
            return appendToSheet(sheetName, updateData);
        }
    } catch (error) {
        Logger.log('Error in upsertEmergencyPlanUpdate: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ تحديثات خطة الطوارئ: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تحديثات خطط الطوارئ
 */
function getAllEmergencyPlanUpdates(filters = {}) {
    try {
        const sheetName = 'EmergencyPlansUpdates';
        let data = readFromSheet(sheetName, getSpreadsheetId());

        // تطبيق الفلاتر
        if (filters.sectionKey) {
            data = data.filter(p => p.sectionKey === filters.sectionKey);
        }
        if (filters.isActive !== undefined) {
            data = data.filter(p => String(p.isActive) === String(filters.isActive));
        }
        if (filters.siteId) {
            data = data.filter(p => p.siteId === filters.siteId);
        }

        // ترتيب حسب order ثم createdAt
        data.sort((a, b) => {
            const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
            if (orderDiff !== 0) return orderDiff;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all emergency plan updates: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة تحديثات خطط الطوارئ: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على تحديث خطة طوارئ محدد
 */
function getEmergencyPlanUpdate(sectionKey) {
    try {
        if (!sectionKey) {
            return { success: false, message: 'مفتاح القسم غير محدد' };
        }

        const sheetName = 'EmergencyPlansUpdates';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const record = data.find(p => p.sectionKey === sectionKey);

        if (!record) {
            return { success: false, message: 'السجل غير موجود' };
        }

        return { success: true, data: record };
    } catch (error) {
        Logger.log('Error getting emergency plan update: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة تحديث خطة الطوارئ: ' + error.toString() };
    }
}

/**
 * حذف تحديث خطة طوارئ
 */
function deleteEmergencyPlanUpdate(sectionKey) {
    try {
        if (!sectionKey) {
            return { success: false, message: 'مفتاح القسم غير محدد' };
        }

        const sheetName = 'EmergencyPlansUpdates';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(p => p.sectionKey !== sectionKey);

        if (filteredData.length === data.length) {
            return { success: false, message: 'السجل غير موجود' };
        }

        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting emergency plan update: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف تحديث خطة الطوارئ: ' + error.toString() };
    }
}

