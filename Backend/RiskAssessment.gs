/**
 * Google Apps Script for HSE System - Risk Assessment Module
 * 
 * موديول تقييم المخاطر - النسخة المحسنة
 */

/**
 * ============================================
 * تقييم المخاطر (Risk Assessments)
 * ============================================
 */

/**
 * إضافة تقييم مخاطر
 */
function addRiskAssessmentToSheet(riskData) {
    try {
        if (!riskData) {
            return { success: false, message: 'بيانات التقييم غير موجودة' };
        }
        
        const sheetName = 'RiskAssessments';
        
        // إضافة حقول تلقائية
        if (!riskData.id) {
            riskData.id = generateSequentialId('RSA', sheetName);
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
        Logger.log('Error in addRiskAssessmentToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التقييم: ' + error.toString() };
    }
}

/**
 * تحديث تقييم مخاطر
 */
function updateRiskAssessment(riskId, updateData) {
    try {
        if (!riskId) {
            return { success: false, message: 'معرف التقييم غير محدد' };
        }
        
        const sheetName = 'RiskAssessments';
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
        Logger.log('Error updating risk assessment: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التقييم: ' + error.toString() };
    }
}

/**
 * الحصول على تقييم مخاطر محدد
 */
function getRiskAssessment(riskId) {
    try {
        if (!riskId) {
            return { success: false, message: 'معرف التقييم غير محدد' };
        }
        
        const sheetName = 'RiskAssessments';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const risk = data.find(r => r.id === riskId);
        
        if (!risk) {
            return { success: false, message: 'التقييم غير موجود' };
        }
        
        return { success: true, data: risk };
    } catch (error) {
        Logger.log('Error getting risk assessment: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التقييم: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تقييمات المخاطر
 */
function getAllRiskAssessments(filters = {}) {
    try {
        const sheetName = 'RiskAssessments';
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
        if (filters.startDate) {
            data = data.filter(r => {
                if (!r.date) return false;
                return new Date(r.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(r => {
                if (!r.date) return false;
                return new Date(r.date) <= new Date(filters.endDate);
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
        Logger.log('Error getting all risk assessments: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التقييمات: ' + error.toString(), data: [] };
    }
}

/**
 * حذف تقييم مخاطر
 */
function deleteRiskAssessment(riskId) {
    try {
        if (!riskId) {
            return { success: false, message: 'معرف التقييم غير محدد' };
        }
        
        const sheetName = 'RiskAssessments';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(r => r.id !== riskId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'التقييم غير موجود' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting risk assessment: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف التقييم: ' + error.toString() };
    }
}

/**
 * ============================================
 * الوثائق القانونية (Legal Documents)
 * ============================================
 */

/**
 * إضافة وثيقة قانونية
 */
function addLegalDocumentToSheet(documentData) {
    try {
        if (!documentData) {
            return { success: false, message: 'بيانات الوثيقة غير موجودة' };
        }
        
        const sheetName = 'LegalDocuments';
        
        // إضافة حقول تلقائية
        if (!documentData.id) {
            documentData.id = generateSequentialId('LGD', sheetName);
        }
        if (!documentData.createdAt) {
            documentData.createdAt = new Date();
        }
        if (!documentData.updatedAt) {
            documentData.updatedAt = new Date();
        }
        if (!documentData.status) {
            documentData.status = 'نشط';
        }
        
        // حساب حالة الوثيقة بناءً على تاريخ الانتهاء
        if (documentData.expiryDate) {
            const expiryDate = new Date(documentData.expiryDate);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysRemaining < 0) {
                documentData.status = 'منتهي';
            } else if (daysRemaining <= (documentData.alertDays || 30)) {
                documentData.status = 'ينتهي قريباً';
            }
        }
        
        return appendToSheet(sheetName, documentData);
    } catch (error) {
        Logger.log('Error in addLegalDocumentToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الوثيقة: ' + error.toString() };
    }
}

/**
 * تحديث وثيقة قانونية
 */
function updateLegalDocument(documentId, updateData) {
    try {
        if (!documentId) {
            return { success: false, message: 'معرف الوثيقة غير محدد' };
        }
        
        const sheetName = 'LegalDocuments';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const documentIndex = data.findIndex(d => d.id === documentId);
        
        if (documentIndex === -1) {
            return { success: false, message: 'الوثيقة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        
        // إعادة حساب الحالة إذا تم تحديث تاريخ الانتهاء
        if (updateData.expiryDate) {
            const expiryDate = new Date(updateData.expiryDate);
            const now = new Date();
            const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysRemaining < 0) {
                updateData.status = 'منتهي';
            } else if (daysRemaining <= (updateData.alertDays || 30)) {
                updateData.status = 'ينتهي قريباً';
            }
        }
        
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[documentIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating legal document: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الوثيقة: ' + error.toString() };
    }
}

/**
 * الحصول على وثيقة قانونية محددة
 */
function getLegalDocument(documentId) {
    try {
        if (!documentId) {
            return { success: false, message: 'معرف الوثيقة غير محدد' };
        }
        
        const sheetName = 'LegalDocuments';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const document = data.find(d => d.id === documentId);
        
        if (!document) {
            return { success: false, message: 'الوثيقة غير موجودة' };
        }
        
        return { success: true, data: document };
    } catch (error) {
        Logger.log('Error getting legal document: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الوثيقة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الوثائق القانونية
 */
function getAllLegalDocuments(filters = {}) {
    try {
        const sheetName = 'LegalDocuments';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.documentType) {
            data = data.filter(d => d.documentType === filters.documentType);
        }
        if (filters.status) {
            data = data.filter(d => d.status === filters.status);
        }
        if (filters.issuedBy) {
            data = data.filter(d => d.issuedBy === filters.issuedBy);
        }
        if (filters.expiringSoon) {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            data = data.filter(d => {
                if (!d.expiryDate) return false;
                const expiryDate = new Date(d.expiryDate);
                return expiryDate >= now && expiryDate <= thirtyDaysFromNow;
            });
        }
        
        // ترتيب حسب تاريخ الانتهاء
        data.sort((a, b) => {
            const dateA = new Date(a.expiryDate || '9999-12-31');
            const dateB = new Date(b.expiryDate || '9999-12-31');
            return dateA - dateB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all legal documents: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الوثائق: ' + error.toString(), data: [] };
    }
}

/**
 * حذف وثيقة قانونية
 */
function deleteLegalDocument(documentId) {
    try {
        if (!documentId) {
            return { success: false, message: 'معرف الوثيقة غير محدد' };
        }
        
        const sheetName = 'LegalDocuments';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(d => d.id !== documentId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'الوثيقة غير موجودة' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting legal document: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الوثيقة: ' + error.toString() };
    }
}

/**
 * الحصول على الوثائق المنتهية أو التي تنتهي قريباً
 */
function getLegalDocumentAlerts() {
    try {
        const sheetName = 'LegalDocuments';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const now = new Date();
        
        const alerts = {
            expired: [],
            expiringSoon: []
        };
        
        data.forEach(document => {
            if (document.expiryDate) {
                const expiryDate = new Date(document.expiryDate);
                const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                const alertDays = document.alertDays || 30;
                
                if (daysRemaining < 0) {
                    alerts.expired.push(document);
                } else if (daysRemaining <= alertDays) {
                    alerts.expiringSoon.push(document);
                }
            }
        });
        
        return { success: true, data: alerts };
    } catch (error) {
        Logger.log('Error getting legal document alerts: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على التنبيهات: ' + error.toString() };
    }
}

