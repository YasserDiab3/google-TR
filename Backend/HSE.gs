/**
 * Google Apps Script for HSE System - HSE Module
 * 
 * موديول HSE
 */

/**
 * إضافة تدقيق HSE
 */
function addHSEAuditToSheet(auditData) {
    try {
        const sheetName = 'HSEAudits';
        const result = appendToSheet(sheetName, auditData);
        
        // إنشاء إجراء تلقائي في Action Tracking إذا كان هناك توصيات
        if (result.success && auditData.description) {
            try {
                createActionFromModule('ManagementReviews', auditData.id || '', {
                    date: auditData.date || '',
                    description: auditData.description || '',
                    correctiveAction: auditData.recommendations || auditData.description || '',
                    auditor: auditData.auditor || '',
                    createdBy: auditData.createdBy || 'System',
                    ...auditData
                });
            } catch (error) {
                Logger.log('Error creating auto action from HSE audit: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addHSEAuditToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التدقيق: ' + error.toString() };
    }
}

/**
 * إضافة عدم مطابقة HSE
 */
function addHSENonConformityToSheet(nonConformityData) {
    try {
        const sheetName = 'HSENonConformities';
        const result = appendToSheet(sheetName, nonConformityData);
        
        // إنشاء إجراء تلقائي في Action Tracking
        if (result.success && nonConformityData.description) {
            try {
                createActionFromModule('ManagementReviews', nonConformityData.id || '', {
                    date: nonConformityData.date || '',
                    description: nonConformityData.description || '',
                    correctiveAction: nonConformityData.correctiveAction || '',
                    createdBy: nonConformityData.createdBy || 'System',
                    ...nonConformityData
                });
            } catch (error) {
                Logger.log('Error creating auto action from HSE non-conformity: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addHSENonConformityToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة عدم المطابقة: ' + error.toString() };
    }
}

/**
 * تحديث تدقيق HSE
 */
function updateHSEAudit(auditId, updateData) {
    try {
        if (!auditId) {
            return { success: false, message: 'معرف التدقيق غير محدد' };
        }
        
        const sheetName = 'HSEAudits';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const auditIndex = data.findIndex(a => a.id === auditId);
        
        if (auditIndex === -1) {
            return { success: false, message: 'التدقيق غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[auditIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating HSE audit: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التدقيق: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تدقيقات HSE
 */
function getAllHSEAudits(filters = {}) {
    try {
        const sheetName = 'HSEAudits';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.type) {
            data = data.filter(a => a.type === filters.type);
        }
        if (filters.auditor) {
            data = data.filter(a => a.auditor === filters.auditor);
        }
        if (filters.status) {
            data = data.filter(a => a.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(a => {
                if (!a.date) return false;
                return new Date(a.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(a => {
                if (!a.date) return false;
                return new Date(a.date) <= new Date(filters.endDate);
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
        Logger.log('Error getting all HSE audits: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التدقيقات: ' + error.toString(), data: [] };
    }
}

/**
 * تحديث عدم مطابقة HSE
 */
function updateHSENonConformity(nonConformityId, updateData) {
    try {
        if (!nonConformityId) {
            return { success: false, message: 'معرف عدم المطابقة غير محدد' };
        }
        
        const sheetName = 'HSENonConformities';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const ncIndex = data.findIndex(nc => nc.id === nonConformityId);
        
        if (ncIndex === -1) {
            return { success: false, message: 'عدم المطابقة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[ncIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating HSE non-conformity: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث عدم المطابقة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع عدم المطابقات HSE
 */
function getAllHSENonConformities(filters = {}) {
    try {
        const sheetName = 'HSENonConformities';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(nc => nc.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(nc => {
                if (!nc.date) return false;
                return new Date(nc.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(nc => {
                if (!nc.date) return false;
                return new Date(nc.date) <= new Date(filters.endDate);
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
        Logger.log('Error getting all HSE non-conformities: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة عدم المطابقات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة إجراء تصحيحي HSE
 */
function addHSECorrectiveActionToSheet(actionData) {
    try {
        if (!actionData) {
            return { success: false, message: 'بيانات الإجراء غير موجودة' };
        }
        
        const sheetName = 'HSECorrectiveActions';
        
        // إضافة حقول تلقائية
        if (!actionData.id) {
            actionData.id = generateSequentialId('HSC', sheetName);
        }
        if (!actionData.createdAt) {
            actionData.createdAt = new Date();
        }
        if (!actionData.updatedAt) {
            actionData.updatedAt = new Date();
        }
        if (!actionData.status) {
            actionData.status = 'قيد التنفيذ';
        }
        
        return appendToSheet(sheetName, actionData);
    } catch (error) {
        Logger.log('Error in addHSECorrectiveActionToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإجراء: ' + error.toString() };
    }
}

/**
 * تحديث إجراء تصحيحي HSE
 */
function updateHSECorrectiveAction(actionId, updateData) {
    try {
        if (!actionId) {
            return { success: false, message: 'معرف الإجراء غير محدد' };
        }
        
        const sheetName = 'HSECorrectiveActions';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const actionIndex = data.findIndex(a => a.id === actionId);
        
        if (actionIndex === -1) {
            return { success: false, message: 'الإجراء غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[actionIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating HSE corrective action: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الإجراء: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الإجراءات التصحيحية HSE
 */
function getAllHSECorrectiveActions(filters = {}) {
    try {
        const sheetName = 'HSECorrectiveActions';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.responsible) {
            data = data.filter(a => a.responsible === filters.responsible);
        }
        if (filters.status) {
            data = data.filter(a => a.status === filters.status);
        }
        if (filters.overdue) {
            const now = new Date();
            data = data.filter(a => {
                if (!a.dueDate) return false;
                return new Date(a.dueDate) < now && a.status !== 'مكتمل' && a.status !== 'مغلق';
            });
        }
        
        // ترتيب حسب تاريخ الاستحقاق
        data.sort((a, b) => {
            const dateA = new Date(a.dueDate || '9999-12-31');
            const dateB = new Date(b.dueDate || '9999-12-31');
            return dateA - dateB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all HSE corrective actions: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإجراءات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة هدف HSE
 */
function addHSEObjectiveToSheet(objectiveData) {
    try {
        if (!objectiveData) {
            return { success: false, message: 'بيانات الهدف غير موجودة' };
        }
        
        const sheetName = 'HSEObjectives';
        
        // إضافة حقول تلقائية
        if (!objectiveData.id) {
            objectiveData.id = generateSequentialId('HSO', sheetName);
        }
        if (!objectiveData.createdAt) {
            objectiveData.createdAt = new Date();
        }
        if (!objectiveData.updatedAt) {
            objectiveData.updatedAt = new Date();
        }
        if (!objectiveData.status) {
            objectiveData.status = 'قيد التنفيذ';
        }
        
        return appendToSheet(sheetName, objectiveData);
    } catch (error) {
        Logger.log('Error in addHSEObjectiveToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الهدف: ' + error.toString() };
    }
}

/**
 * تحديث هدف HSE
 */
function updateHSEObjective(objectiveId, updateData) {
    try {
        if (!objectiveId) {
            return { success: false, message: 'معرف الهدف غير محدد' };
        }
        
        const sheetName = 'HSEObjectives';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const objectiveIndex = data.findIndex(o => o.id === objectiveId);
        
        if (objectiveIndex === -1) {
            return { success: false, message: 'الهدف غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[objectiveIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating HSE objective: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الهدف: ' + error.toString() };
    }
}

/**
 * الحصول على جميع أهداف HSE
 */
function getAllHSEObjectives(filters = {}) {
    try {
        const sheetName = 'HSEObjectives';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.responsible) {
            data = data.filter(o => o.responsible === filters.responsible);
        }
        if (filters.status) {
            data = data.filter(o => o.status === filters.status);
        }
        if (filters.overdue) {
            const now = new Date();
            data = data.filter(o => {
                if (!o.dueDate) return false;
                return new Date(o.dueDate) < now && o.status !== 'مكتمل' && o.status !== 'مغلق';
            });
        }
        
        // ترتيب حسب تاريخ الاستحقاق
        data.sort((a, b) => {
            const dateA = new Date(a.dueDate || '9999-12-31');
            const dateB = new Date(b.dueDate || '9999-12-31');
            return dateA - dateB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all HSE objectives: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الأهداف: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة تقييم مخاطر HSE
 */
function addHSERiskAssessmentToSheet(riskData) {
    try {
        if (!riskData) {
            return { success: false, message: 'بيانات التقييم غير موجودة' };
        }
        
        const sheetName = 'HSERiskAssessments';
        
        // إضافة حقول تلقائية
        if (!riskData.id) {
            riskData.id = generateSequentialId('HSR', sheetName);
        }
        if (!riskData.createdAt) {
            riskData.createdAt = new Date();
        }
        if (!riskData.updatedAt) {
            riskData.updatedAt = new Date();
        }
        if (!riskData.status) {
            riskData.status = 'قيد المراجعة';
        }
        
        return appendToSheet(sheetName, riskData);
    } catch (error) {
        Logger.log('Error in addHSERiskAssessmentToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التقييم: ' + error.toString() };
    }
}

/**
 * تحديث تقييم مخاطر HSE
 */
function updateHSERiskAssessment(riskId, updateData) {
    try {
        if (!riskId) {
            return { success: false, message: 'معرف التقييم غير محدد' };
        }
        
        const sheetName = 'HSERiskAssessments';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const riskIndex = data.findIndex(r => r.id === riskId);
        
        if (riskIndex === -1) {
            return { success: false, message: 'التقييم غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[riskIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating HSE risk assessment: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التقييم: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تقييمات مخاطر HSE
 */
function getAllHSERiskAssessments(filters = {}) {
    try {
        const sheetName = 'HSERiskAssessments';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.activity) {
            data = data.filter(r => r.activity === filters.activity);
        }
        if (filters.location) {
            data = data.filter(r => r.location === filters.location);
        }
        if (filters.riskLevel) {
            data = data.filter(r => r.riskLevel === filters.riskLevel);
        }
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        
        // ترتيب حسب التاريخ
        data.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all HSE risk assessments: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التقييمات: ' + error.toString(), data: [] };
    }
}

