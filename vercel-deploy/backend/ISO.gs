/**
 * Google Apps Script for HSE System - ISO Module
 * 
 * موديول ISO - النسخة المحسنة
 */

/**
 * ============================================
 * وثائق ISO (ISO Documents)
 * ============================================
 */

/**
 * إضافة وثيقة ISO
 */
function addISODocumentToSheet(documentData) {
    try {
        if (!documentData) {
            return { success: false, message: 'بيانات الوثيقة غير موجودة' };
        }
        
        const sheetName = 'ISODocuments';
        
        // إضافة حقول تلقائية
        if (!documentData.id) {
            documentData.id = Utilities.getUuid();
        }
        if (!documentData.createdAt) {
            documentData.createdAt = new Date();
        }
        if (!documentData.updatedAt) {
            documentData.updatedAt = new Date();
        }
        if (!documentData.version) {
            documentData.version = '1.0';
        }
        
        return appendToSheet(sheetName, documentData);
    } catch (error) {
        Logger.log('Error in addISODocumentToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الوثيقة: ' + error.toString() };
    }
}

/**
 * تحديث وثيقة ISO
 */
function updateISODocument(documentId, updateData) {
    try {
        if (!documentId) {
            return { success: false, message: 'معرف الوثيقة غير محدد' };
        }
        
        const sheetName = 'ISODocuments';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const documentIndex = data.findIndex(d => d.id === documentId);
        
        if (documentIndex === -1) {
            return { success: false, message: 'الوثيقة غير موجودة' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[documentIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating ISO document: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الوثيقة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع وثائق ISO
 */
function getAllISODocuments(filters = {}) {
    try {
        const sheetName = 'ISODocuments';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.type) {
            data = data.filter(d => d.type === filters.type);
        }
        if (filters.department) {
            data = data.filter(d => d.department === filters.department);
        }
        if (filters.version) {
            data = data.filter(d => d.version === filters.version);
        }
        
        // ترتيب حسب الاسم
        data.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all ISO documents: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الوثائق: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * إجراءات ISO (ISO Procedures)
 * ============================================
 */

/**
 * إضافة إجراء ISO
 */
function addISOProcedureToSheet(procedureData) {
    try {
        if (!procedureData) {
            return { success: false, message: 'بيانات الإجراء غير موجودة' };
        }
        
        const sheetName = 'ISOProcedures';
        
        // إضافة حقول تلقائية
        if (!procedureData.id) {
            procedureData.id = generateSequentialId('ISP', sheetName);
        }
        if (!procedureData.createdAt) {
            procedureData.createdAt = new Date();
        }
        if (!procedureData.updatedAt) {
            procedureData.updatedAt = new Date();
        }
        if (!procedureData.version) {
            procedureData.version = '1.0';
        }
        
        return appendToSheet(sheetName, procedureData);
    } catch (error) {
        Logger.log('Error in addISOProcedureToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإجراء: ' + error.toString() };
    }
}

/**
 * تحديث إجراء ISO
 */
function updateISOProcedure(procedureId, updateData) {
    try {
        if (!procedureId) {
            return { success: false, message: 'معرف الإجراء غير محدد' };
        }
        
        const sheetName = 'ISOProcedures';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const procedureIndex = data.findIndex(p => p.id === procedureId);
        
        if (procedureIndex === -1) {
            return { success: false, message: 'الإجراء غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[procedureIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating ISO procedure: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الإجراء: ' + error.toString() };
    }
}

/**
 * الحصول على جميع إجراءات ISO
 */
function getAllISOProcedures(filters = {}) {
    try {
        const sheetName = 'ISOProcedures';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.department) {
            data = data.filter(p => p.department === filters.department);
        }
        if (filters.version) {
            data = data.filter(p => p.version === filters.version);
        }
        
        // ترتيب حسب الاسم
        data.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all ISO procedures: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإجراءات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * نماذج ISO (ISO Forms)
 * ============================================
 */

/**
 * إضافة نموذج ISO
 */
function addISOFormToSheet(formData) {
    try {
        if (!formData) {
            return { success: false, message: 'بيانات النموذج غير موجودة' };
        }
        
        const sheetName = 'ISOForms';
        
        // إضافة حقول تلقائية
        if (!formData.id) {
            formData.id = generateSequentialId('ISF', sheetName);
        }
        if (!formData.createdAt) {
            formData.createdAt = new Date();
        }
        if (!formData.updatedAt) {
            formData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, formData);
    } catch (error) {
        Logger.log('Error in addISOFormToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة النموذج: ' + error.toString() };
    }
}

/**
 * تحديث نموذج ISO
 */
function updateISOForm(formId, updateData) {
    try {
        if (!formId) {
            return { success: false, message: 'معرف النموذج غير محدد' };
        }
        
        const sheetName = 'ISOForms';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const formIndex = data.findIndex(f => f.id === formId);
        
        if (formIndex === -1) {
            return { success: false, message: 'النموذج غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[formIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating ISO form: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث النموذج: ' + error.toString() };
    }
}

/**
 * الحصول على جميع نماذج ISO
 */
function getAllISOForms(filters = {}) {
    try {
        const sheetName = 'ISOForms';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.type) {
            data = data.filter(f => f.type === filters.type);
        }
        
        // ترتيب حسب الاسم
        data.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all ISO forms: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة النماذج: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * SOP/JHA
 * ============================================
 */

/**
 * إضافة SOP/JHA
 */
function addSOPJHAToSheet(sopData) {
    try {
        if (!sopData) {
            return { success: false, message: 'بيانات SOP/JHA غير موجودة' };
        }
        
        const sheetName = 'SOPJHA';
        
        // إضافة حقول تلقائية
        if (!sopData.id) {
            sopData.id = generateSequentialId('SOP', sheetName);
        }
        if (!sopData.createdAt) {
            sopData.createdAt = new Date();
        }
        if (!sopData.updatedAt) {
            sopData.updatedAt = new Date();
        }
        if (!sopData.status) {
            sopData.status = 'نشط';
        }
        if (!sopData.version) {
            sopData.version = '1.0';
        }
        
        return appendToSheet(sheetName, sopData);
    } catch (error) {
        Logger.log('Error in addSOPJHAToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة SOP/JHA: ' + error.toString() };
    }
}

/**
 * تحديث SOP/JHA
 */
function updateSOPJHA(sopId, updateData) {
    try {
        if (!sopId) {
            return { success: false, message: 'معرف SOP/JHA غير محدد' };
        }
        
        const sheetName = 'SOPJHA';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const sopIndex = data.findIndex(s => s.id === sopId);
        
        if (sopIndex === -1) {
            return { success: false, message: 'SOP/JHA غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[sopIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating SOP/JHA: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث SOP/JHA: ' + error.toString() };
    }
}

/**
 * الحصول على SOP/JHA محدد
 */
function getSOPJHA(sopId) {
    try {
        if (!sopId) {
            return { success: false, message: 'معرف SOP/JHA غير محدد' };
        }
        
        const sheetName = 'SOPJHA';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const sop = data.find(s => s.id === sopId);
        
        if (!sop) {
            return { success: false, message: 'SOP/JHA غير موجود' };
        }
        
        return { success: true, data: sop };
    } catch (error) {
        Logger.log('Error getting SOP/JHA: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة SOP/JHA: ' + error.toString() };
    }
}

/**
 * الحصول على جميع SOP/JHA
 */
function getAllSOPJHAs(filters = {}) {
    try {
        const sheetName = 'SOPJHA';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.type) {
            data = data.filter(s => s.type === filters.type);
        }
        if (filters.department) {
            data = data.filter(s => s.department === filters.department);
        }
        if (filters.status) {
            data = data.filter(s => s.status === filters.status);
        }
        if (filters.version) {
            data = data.filter(s => s.version === filters.version);
        }
        
        // ترتيب حسب العنوان
        data.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all SOP/JHAs: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة SOP/JHA: ' + error.toString(), data: [] };
    }
}

/**
 * حذف SOP/JHA
 */
function deleteSOPJHA(sopId) {
    try {
        if (!sopId) {
            return { success: false, message: 'معرف SOP/JHA غير محدد' };
        }
        
        const sheetName = 'SOPJHA';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(s => s.id !== sopId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'SOP/JHA غير موجود' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting SOP/JHA: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف SOP/JHA: ' + error.toString() };
    }
}

/**
 * ============================================
 * أكواد المستندات وإصداراتها (Document Codes & Versions)
 * ============================================
 */

/**
 * الحصول على جميع أكواد المستندات
 */
function getDocumentCodes(filters) {
    try {
        const sheetName = 'DocumentCodes';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        if (!data || !Array.isArray(data)) {
            data = [];
        }
        if (filters && filters.documentType) {
            data = data.filter(function(c) { return c.documentType === filters.documentType; });
        }
        if (filters && filters.status) {
            data = data.filter(function(c) { return c.status === filters.status; });
        }
        data.sort(function(a, b) {
            const codeA = (a.code || '').toLowerCase();
            const codeB = (b.code || '').toLowerCase();
            return codeA.localeCompare(codeB);
        });
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error in getDocumentCodes: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة أكواد المستندات: ' + error.toString(), data: [] };
    }
}

/** حقول كود المستند المسموح بها فقط (لتجنب كتابة action/csrfToken وغيرها في الورقة) */
var DOCUMENT_CODE_FIELDS = ['id', 'code', 'documentName', 'documentType', 'department', 'status', 'description', 'createdAt', 'updatedAt', 'createdBy'];

/**
 * إضافة كود مستند جديد (مع التحقق من عدم تكرار الكود)
 */
function addDocumentCodeToSheet(documentData) {
    try {
        if (!documentData || typeof documentData !== 'object') {
            return { success: false, message: 'بيانات الكود غير موجودة' };
        }
        var codeStr = (documentData.code || '').toString().trim();
        if (!codeStr) {
            return { success: false, message: 'حقل الكود مطلوب ولا يمكن تركه فارغاً.' };
        }
        var existing = readFromSheet('DocumentCodes', getSpreadsheetId());
        if (existing && Array.isArray(existing)) {
            var duplicate = existing.some(function(c) {
                return (c.code || '').toString().trim().toLowerCase() === codeStr.toLowerCase();
            });
            if (duplicate) {
                return { success: false, message: 'كود المستند موجود مسبقاً. يرجى استخدام كود فريد (مثل: DOC-001, FORM-002).', errorCode: 'DUPLICATE_CODE' };
            }
        }
        var row = {};
        for (var i = 0; i < DOCUMENT_CODE_FIELDS.length; i++) {
            var key = DOCUMENT_CODE_FIELDS[i];
            if (documentData[key] !== undefined && documentData[key] !== null) {
                row[key] = documentData[key];
            }
        }
        if (!row.id) row.id = Utilities.getUuid();
        if (!row.createdAt) row.createdAt = new Date();
        if (!row.updatedAt) row.updatedAt = new Date();
        return appendToSheet('DocumentCodes', row, getSpreadsheetId());
    } catch (error) {
        Logger.log('Error in addDocumentCodeToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة كود المستند: ' + error.toString() };
    }
}

/**
 * اسم بديل للتوافق مع المشاريع التي تستخدم addDocumentCode
 */
function addDocumentCode(documentData) {
    return addDocumentCodeToSheet(documentData);
}

/**
 * تحديث كود مستند (يُحدَّث فقط الحقول المسموح بها)
 */
function updateDocumentCode(codeId, updateData) {
    try {
        if (!codeId) {
            return { success: false, message: 'معرف الكود غير محدد' };
        }
        var sheetName = 'DocumentCodes';
        var spreadsheetId = getSpreadsheetId();
        var data = readFromSheet(sheetName, spreadsheetId);
        var index = data.findIndex(function(c) { return c.id === codeId; });
        if (index === -1) {
            return { success: false, message: 'كود المستند غير موجود' };
        }
        var filtered = {};
        for (var i = 0; i < DOCUMENT_CODE_FIELDS.length; i++) {
            var key = DOCUMENT_CODE_FIELDS[i];
            if (updateData[key] !== undefined && updateData[key] !== null) {
                filtered[key] = updateData[key];
            }
        }
        if (filtered.code !== undefined) {
            var newCodeStr = (filtered.code || '').toString().trim();
            if (newCodeStr) {
                var duplicate = data.some(function(c, idx) {
                    return idx !== index && (c.code || '').toString().trim().toLowerCase() === newCodeStr.toLowerCase();
                });
                if (duplicate) {
                    return { success: false, message: 'كود المستند موجود مسبقاً. يرجى استخدام كود فريد.', errorCode: 'DUPLICATE_CODE' };
                }
            }
        }
        filtered.updatedAt = new Date();
        for (var k in filtered) {
            if (filtered.hasOwnProperty(k)) {
                data[index][k] = filtered[k];
            }
        }
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating document code: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث كود المستند: ' + error.toString() };
    }
}

/**
 * حذف كود مستند
 */
function deleteDocumentCode(codeId) {
    try {
        if (!codeId) {
            return { success: false, message: 'معرف الكود غير محدد' };
        }
        const sheetName = 'DocumentCodes';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(function(c) { return c.id !== codeId; });
        if (filteredData.length === data.length) {
            return { success: false, message: 'كود المستند غير موجود' };
        }
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting document code: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف كود المستند: ' + error.toString() };
    }
}

/**
 * الحصول على إصدارات المستندات (اختياري: حسب documentCodeId)
 */
function getDocumentVersions(filters) {
    try {
        const sheetName = 'DocumentVersions';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        if (!data || !Array.isArray(data)) {
            data = [];
        }
        if (filters && filters.documentCodeId) {
            data = data.filter(function(v) { return v.documentCodeId === filters.documentCodeId; });
        }
        data.sort(function(a, b) {
            const dA = new Date(a.issueDate || 0).getTime();
            const dB = new Date(b.issueDate || 0).getTime();
            return dB - dA;
        });
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error in getDocumentVersions: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة إصدارات المستندات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة إصدار مستند
 */
function addDocumentVersionToSheet(versionData) {
    try {
        if (!versionData) {
            return { success: false, message: 'بيانات الإصدار غير موجودة' };
        }
        const sheetName = 'DocumentVersions';
        if (!versionData.id) {
            versionData.id = Utilities.getUuid();
        }
        if (!versionData.createdAt) {
            versionData.createdAt = new Date();
        }
        if (!versionData.updatedAt) {
            versionData.updatedAt = new Date();
        }
        return appendToSheet(sheetName, versionData, getSpreadsheetId());
    } catch (error) {
        Logger.log('Error in addDocumentVersionToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة إصدار المستند: ' + error.toString() };
    }
}

/**
 * تحديث إصدار مستند
 */
function updateDocumentVersion(versionId, updateData) {
    try {
        if (!versionId) {
            return { success: false, message: 'معرف الإصدار غير محدد' };
        }
        const sheetName = 'DocumentVersions';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const index = data.findIndex(function(v) { return v.id === versionId; });
        if (index === -1) {
            return { success: false, message: 'إصدار المستند غير موجود' };
        }
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[index][key] = updateData[key];
            }
        }
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating document version: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث إصدار المستند: ' + error.toString() };
    }
}

/**
 * الحصول على كود مستند والإصدار النشط له (للمركز الموحد)
 */
function getDocumentCodeAndVersion(params) {
    try {
        var documentCode = params && params.documentCode ? String(params.documentCode).trim() : '';
        if (!documentCode) {
            return { success: true, code: null, version: null };
        }
        var codes = readFromSheet('DocumentCodes', getSpreadsheetId());
        if (!codes || !Array.isArray(codes)) {
            codes = [];
        }
        var codeRow = codes.find(function(c) { return (c.code || '').trim() === documentCode; });
        if (!codeRow) {
            return { success: true, code: null, version: null };
        }
        var versions = readFromSheet('DocumentVersions', getSpreadsheetId());
        if (!versions || !Array.isArray(versions)) {
            versions = [];
        }
        versions = versions.filter(function(v) { return v.documentCodeId === codeRow.id; });
        var activeVersion = versions.find(function(v) {
            return v.isActive === true || v.isActive === 'true' || v.status === 'نشط';
        });
        if (!activeVersion) {
            activeVersion = versions.length > 0 ? versions[0] : null;
        }
        return { success: true, code: codeRow, version: activeVersion };
    } catch (error) {
        Logger.log('Error in getDocumentCodeAndVersion: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء جلب كود المستند والإصدار: ' + error.toString() };
    }
}

