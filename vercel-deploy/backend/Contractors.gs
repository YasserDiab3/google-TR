/**
 * Google Apps Script for HSE System - Contractors Module
 * 
 * موديول المقاولين - النسخة المحسنة
 */

/**
 * ============================================
 * ✅ تم إزالة دوال جدول Contractors
 * ✅ الآن نعتمد فقط على ApprovedContractors
 * ============================================
 * 
 * ملاحظة: تم نقل جميع وظائف المقاولين إلى ApprovedContractors
 * جميع المقاولين يجب أن يكونوا معتمدين في ApprovedContractors
 */

/**
 * ✅ دالة نقل البيانات من Contractors إلى ApprovedContractors
 * هذه الدالة تُستخدم لمرة واحدة لنقل البيانات القديمة
 * 
 * @returns {object} - نتيجة عملية النقل
 */
function migrateContractorsToApproved() {
    try {
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد' 
            };
        }
        
        // قراءة البيانات من كلا الجدولين
        const contractors = readFromSheet('Contractors', spreadsheetId);
        const approvedContractors = readFromSheet('ApprovedContractors', spreadsheetId);
        
        if (!Array.isArray(contractors) || contractors.length === 0) {
            return { 
                success: true, 
                message: 'لا توجد بيانات في جدول Contractors للنقل',
                migrated: 0
            };
        }
        
        let migratedCount = 0;
        let skippedCount = 0;
        const errors = [];
        
        contractors.forEach(contractor => {
            try {
                if (!contractor || !contractor.id) {
                    skippedCount++;
                    return;
                }
                
                // التحقق من عدم وجود المقاول في ApprovedContractors
                const exists = approvedContractors.find(ac => 
                    ac.contractorId === contractor.id || 
                    (ac.companyName && contractor.name && ac.companyName.trim().toLowerCase() === contractor.name.trim().toLowerCase()) ||
                    (ac.code && contractor.code && ac.code === contractor.code)
                );
                
                if (exists) {
                    skippedCount++;
                    return;
                }
                
                // إنشاء سجل معتمد جديد من بيانات المقاول
                const contractorCode = contractor.code || generateContractorCode(spreadsheetId);
                const approvedEntity = {
                    id: contractor.approvedEntityId || generateSequentialId('ACN', 'ApprovedContractors', spreadsheetId),
                    contractorId: contractor.id, // الحفاظ على ID الأصلي للربط
                    companyName: contractor.name || contractor.company || 'غير محدد',
                    entityType: contractor.entityType || 'contractor',
                    serviceType: contractor.serviceType || '',
                    licenseNumber: contractor.contractNumber || contractor.licenseNumber || '',
                    code: contractorCode,
                    isoCode: contractorCode,
                    approvalDate: contractor.createdAt || new Date(),
                    expiryDate: contractor.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    status: (contractor.status === 'نشط' || contractor.status === 'active') ? 'approved' : 'pending',
                    notes: contractor.notes || 'تم النقل تلقائياً من جدول Contractors',
                    safetyReviewer: contractor.contactPerson || '',
                    createdAt: contractor.createdAt || new Date(),
                    updatedAt: contractor.updatedAt || new Date()
                };
                
                approvedContractors.push(approvedEntity);
                migratedCount++;
                
            } catch (error) {
                errors.push({
                    contractorId: contractor.id,
                    error: error.toString()
                });
            }
        });
        
        // حفظ البيانات المحدثة
        if (migratedCount > 0) {
            const saveResult = saveToSheet('ApprovedContractors', approvedContractors, spreadsheetId);
            if (!saveResult.success) {
            return { 
                success: false, 
                    message: 'فشل حفظ البيانات: ' + saveResult.message,
                    migrated: migratedCount,
                    errors: errors
                };
            }
        }
        
        return { 
            success: true, 
            message: `تم نقل ${migratedCount} مقاول بنجاح`,
            migrated: migratedCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : null
        };
        
    } catch (error) {
        Logger.log('Error in migrateContractorsToApproved: ' + error.toString());
        return { 
            success: false, 
            message: 'حدث خطأ أثناء نقل البيانات: ' + error.toString() 
        };
    }
}

/**
 * حذف مقاول معتمد مباشرة
 * ✅ جديد: يدعم الحذف المتتالية
 */
function deleteApprovedContractor(approvedContractorId) {
    try {
        if (!approvedContractorId) {
            return { success: false, message: 'معرف المقاول المعتمد غير محدد' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        
        // 1. حذف من ApprovedContractors
        const sheetName = 'ApprovedContractors';
        const data = readFromSheet(sheetName, spreadsheetId);
        const recordToDelete = data.find(c => c.id === approvedContractorId);
        const filteredData = data.filter(c => c.id !== approvedContractorId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'المقاول المعتمد غير موجود' };
        }
        
        const saveResult = saveToSheet(sheetName, filteredData, spreadsheetId);
        if (!saveResult.success) {
            return saveResult;
        }
        
        // ✅ تم إزالة حذف من Contractors - نعتمد فقط على ApprovedContractors
        
        return { success: true, message: 'تم حذف المقاول المعتمد بنجاح' };
    } catch (error) {
        Logger.log('Error deleting approved contractor: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف المقاول المعتمد: ' + error.toString() };
    }
}

/**
 * ============================================
 * المقاولين المعتمدين (Approved Contractors)
 * ============================================
 */

/**
 * إضافة مقاول معتمد
 */
function addApprovedContractorToSheet(contractorData) {
    try {
        if (!contractorData) {
            return { success: false, message: 'بيانات المقاول غير موجودة' };
        }
        
        const sheetName = 'ApprovedContractors';
        const spreadsheetId = getSpreadsheetId();
        
        // توحيد حقل الكود قبل أي فحص/حفظ (الكود يولد مرة واحدة ويظل ثابتاً)
        var stableContractorCode = String(contractorData.code || contractorData.isoCode || '').trim();
        if (!stableContractorCode) {
            stableContractorCode = generateContractorCode(spreadsheetId);
        }
        contractorData.code = stableContractorCode;
        contractorData.isoCode = stableContractorCode;
        
        // قراءة البيانات الحالية للتأكد من عدم وجود مكرر
        const existingData = readFromSheet(sheetName, spreadsheetId);
        // ✅ تحسين التحقق من التكرار - فحص متعدد المعايير بدقة أكبر
        // ✅ التحقق من التكرار بناءً على ID أولاً (الأكثر دقة)
        let duplicate = null;
        if (contractorData.id) {
            duplicate = existingData.find(c => c && c.id === contractorData.id);
        }
        
        // ✅ إذا لم يوجد تكرار بالID، التحقق من الكود (يجب أن يكون فريداً)
        if (!duplicate && contractorData.code) {
            duplicate = existingData.find(c => {
                if (!c) return false;
                const existingCode = c.code || c.isoCode;
                return existingCode && existingCode === contractorData.code;
            });
        }
        
        // ✅ إذا لم يوجد تكرار بالكود، التحقق من السجل التجاري (يجب أن يكون فريداً أيضاً)
        if (!duplicate && contractorData.licenseNumber && contractorData.licenseNumber.trim() !== '') {
            duplicate = existingData.find(c => {
                if (!c || !c.licenseNumber) return false;
                return c.licenseNumber.trim() === contractorData.licenseNumber.trim();
            });
        }
        
        // ✅ ملاحظة: تم إزالة التحقق من اسم الشركة + نوع الجهة
        // ✅ لأنه قد يسبب مشاكل مع مقاولين مختلفين بنفس الاسم
        // ✅ نعتمد فقط على ID، الكود، ورقم الترخيص للتحقق من التكرار
        
        if (duplicate) {
            Logger.log('⚠️ Duplicate contractor found: id=' + (duplicate.id || 'N/A') + ', companyName=' + (duplicate.companyName || 'N/A') + ', code=' + (duplicate.code || duplicate.isoCode || 'N/A'));
            Logger.log('⚠️ مقاول/مورد مسجل بالفعل في قائمة المعتمدين - سيتم رفض الإضافة بدلاً من تحديث البيانات الموجودة');

            // ✅ إصلاح مهم: عدم تحديث بيانات المقاول القديم ببيانات الطلب الجديد
            // ✅ لأن هذا يسبب مسح بيانات المقاولين الموجودين في الجدول
            // ✅ بدلاً من ذلك، نرجع رسالة تفيد بأن المقاول موجود مسبقاً
            return {
                success: false,
                isDuplicate: true,
                message: 'المقاول/المورد مسجل بالفعل في قائمة المعتمدين (رقم الترخيص: ' + (contractorData.licenseNumber || contractorData.code || 'غير محدد') + '). لا يمكن إضافة مقاول مكرر. إذا كنت تريد تحديث بيانات المقاول الموجود، يرجى التعديل عليه مباشرة من قائمة المعتمدين.',
                duplicateInfo: {
                    id: duplicate.id,
                    companyName: duplicate.companyName,
                    code: duplicate.code || duplicate.isoCode,
                    licenseNumber: duplicate.licenseNumber
                }
            };

            /* تم تعطيل هذا الكود لأنه كان يسبب مسح بيانات المقاولين الموجودين
            // ✅ تحديث جميع الحقول المهمة بما فيها companyName و entityType
            const updateData = {};
            const fieldsToUpdate = [
                'companyName',      // ← كان يتم استبدال اسم الشركة القديمة بالاسم الجديد
                'entityType',       // ← كان يتم استبدال نوع الجهة القديمة بالجديدة
                'code',
                'isoCode',
                'serviceType',
                'licenseNumber',
                'approvalDate',
                'expiryDate',
                'status',
                'notes',
                'contractorId',
                'safetyReviewer',
                'contactPerson',
                'phone',
                'email'
            ];

            fieldsToUpdate.forEach(field => {
                if (contractorData.hasOwnProperty(field) && contractorData[field] !== undefined) {
                    updateData[field] = contractorData[field];
                }
            });

            // تحديث updatedAt دائماً
            updateData.updatedAt = new Date();

            const updateResult = updateApprovedContractor(duplicate.id, updateData);
            // ✅ إرجاع id المحدث في النتيجة مع رسالة توضيحية
            if (updateResult.success) {
                updateResult.id = duplicate.id;
                updateResult.isDuplicate = true;
                updateResult.message = 'المقاول/المورد مسجل بالفعل في قائمة المعتمدين. تم تحديث البيانات الموجودة بدلاً من إضافة سجل جديد.';
                updateResult.duplicateInfo = {
                    id: duplicate.id,
                    companyName: contractorData.companyName || duplicate.companyName,
                    code: duplicate.code || duplicate.isoCode,
                    licenseNumber: duplicate.licenseNumber
                };
            }
            return updateResult;
            */
        }
        
        Logger.log('✅ No duplicate found - adding new contractor: id=' + (contractorData.id || 'N/A') + ', companyName=' + (contractorData.companyName || 'N/A') + ', code=' + (contractorData.code || 'N/A'));
        
        // إضافة حقول تلقائية
        if (!contractorData.id) {
            contractorData.id = generateSequentialId('ACN', sheetName, spreadsheetId);
        }
        if (!contractorData.createdAt) {
            contractorData.createdAt = new Date();
        }
        if (!contractorData.updatedAt) {
            contractorData.updatedAt = new Date();
        }
        if (!contractorData.status) {
            contractorData.status = 'approved';
        }
        
        // ✅ تسجيل قبل الإضافة للتأكد
        Logger.log('📝 addApprovedContractorToSheet: About to append new contractor to ApprovedContractors');
        Logger.log('📝 Contractor data: id=' + contractorData.id + ', companyName=' + (contractorData.companyName || 'N/A') + ', code=' + (contractorData.code || 'N/A'));
        
        // ✅ قراءة البيانات الحالية قبل الإضافة لتسجيل عدد الصفوف
        const dataBeforeAppend = readFromSheet(sheetName, spreadsheetId);
        const rowCountBefore = Array.isArray(dataBeforeAppend) ? dataBeforeAppend.length : 0;
        Logger.log('📝 Current row count in ApprovedContractors: ' + rowCountBefore + ' (excluding headers)');
        
        // ✅ استدعاء appendToSheet() لإضافة المقاول في آخر صف
        const result = appendToSheet(sheetName, contractorData, spreadsheetId);
        
        // ✅ حفظ البيانات مباشرة بعد appendToSheet لضمان التحديث
        // ✅ (appendToSheet تستدعي flush() بالفعل، لكن نضيفه هنا للتأكد)
        SpreadsheetApp.flush();
        
        // ✅ التحقق من النتيجة
        if (result.success) {
            Logger.log('✅ addApprovedContractorToSheet: Successfully added contractor. Row number: ' + (result.rowNumber || 'N/A'));
            
            // ✅ تحقق معلوماتي فقط (لا نُفشل العملية إذا اختلف عدّ readFromSheet عن getLastRow)
            try {
                const dataAfterAppend = readFromSheet(sheetName, spreadsheetId);
                const rowCountAfter = Array.isArray(dataAfterAppend) ? dataAfterAppend.length : 0;
                const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
                const sheetLastRow = sheet ? sheet.getLastRow() : 0;
                Logger.log('📝 Row count after append (readFromSheet): ' + rowCountAfter + ' (was ' + rowCountBefore + '), sheetLastRow=' + sheetLastRow);
            } catch (verifyError) {
                Logger.log('⚠️ Warning: Could not verify row count after append: ' + verifyError.toString());
                // لا نعيد خطأ هنا لأن نجاح appendToSheet هو المرجع الأساسي
            }
        } else {
            Logger.log('❌ addApprovedContractorToSheet: Failed to add contractor: ' + (result.message || 'Unknown error'));
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addApprovedContractorToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المقاول المعتمد: ' + error.toString() };
    }
}

/**
 * تحديث مقاول معتمد
 * ✅ تم التعديل: استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
 */
function updateApprovedContractor(approvedContractorId, updateData) {
    try {
        if (!approvedContractorId) {
            return { success: false, message: 'معرف المقاول المعتمد غير محدد' };
        }
        
        const sheetName = 'ApprovedContractors';
        const spreadsheetId = getSpreadsheetId();
        
        // منع تعديل كود المقاول بعد توليده (قاعدة عدم التغيير)
        const safeUpdateData = Object.assign({}, updateData || {});
        const immutableCodeFields = ['code', 'isoCode', 'contractorCode', 'codeNumber'];
        const attemptedImmutableEdits = immutableCodeFields.filter(function(field) {
            return Object.prototype.hasOwnProperty.call(safeUpdateData, field);
        });
        
        attemptedImmutableEdits.forEach(function(field) {
            delete safeUpdateData[field];
        });
        
        if (attemptedImmutableEdits.length > 0) {
            Logger.log('⚠️ Blocked immutable contractor code update for ' + approvedContractorId + ' fields=' + attemptedImmutableEdits.join(','));
        }
        
        if (Object.keys(safeUpdateData).length === 0) {
            return { success: false, message: 'لا يمكن تعديل كود المقاول بعد توليده' };
        }
        
        safeUpdateData.updatedAt = new Date();
        
        // ✅ استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
        const result = updateSingleRowInSheet(sheetName, approvedContractorId, safeUpdateData, spreadsheetId);
        
        if (result.success) {
            Logger.log('✅ Successfully updated approved contractor: ' + approvedContractorId);
        } else {
            Logger.log('⚠️ Failed to update approved contractor: ' + result.message);
        }
        
        return result;
    } catch (error) {
        Logger.log('Error updating approved contractor: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المقاول المعتمد: ' + error.toString() };
    }
}

/**
 * الحصول على جميع المقاولين المعتمدين
 */
function getAllApprovedContractors(filters = {}) {
    try {
        const sheetName = 'ApprovedContractors';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(c => c.status === filters.status);
        }
        if (filters.expiringSoon) {
            const now = new Date();
            const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            data = data.filter(c => {
                if (!c.expiryDate) return false;
                const expiryDate = new Date(c.expiryDate);
                return expiryDate >= now && expiryDate <= thirtyDaysFromNow;
            });
        }
        
        // ترتيب حسب تاريخ الموافقة
        data.sort((a, b) => {
            const dateA = new Date(a.approvalDate || a.createdAt || 0);
            const dateB = new Date(b.approvalDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all approved contractors: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المقاولين المعتمدين: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * تقييمات المقاولين (Contractor Evaluations)
 * ============================================
 */

/**
 * إضافة تقييم مقاول
 */
function addContractorEvaluationToSheet(evaluationData) {
    try {
        if (!evaluationData) {
            return { success: false, message: 'بيانات التقييم غير موجودة' };
        }
        
        const sheetName = 'ContractorEvaluations';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ إصلاح: حفظ كل بند كسجل منفصل في الجدول
        const evaluationId = evaluationData.id || generateSequentialId('CEV', sheetName, spreadsheetId);
        const now = new Date();
        const userId = evaluationData.createdBy || evaluationData.updatedBy || '';
        
        // البيانات الأساسية للتقييم
        const baseData = {
            id: evaluationId,
            evaluationId: evaluationId,
            contractorId: evaluationData.contractorId || '',
            contractorName: evaluationData.contractorName || '',
            evaluationDate: evaluationData.evaluationDate || now,
            evaluatorName: evaluationData.evaluatorName || '',
            projectName: evaluationData.projectName || '',
            location: evaluationData.location || '',
            generalNotes: evaluationData.generalNotes || '',
            compliantCount: evaluationData.compliantCount || 0,
            totalItems: evaluationData.totalItems || 0,
            finalScore: evaluationData.finalScore || null,
            finalRating: evaluationData.finalRating || '',
            isoCode: evaluationData.isoCode || ''
        };
        
        // ✅ حفظ كل بند كسجل منفصل
        const items = evaluationData.items || [];
        const results = [];
        
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var record = {
                ...baseData,
                // معلومات البند
                criteriaId: item.criteriaId || '',
                title: item.title || item.label || '',
                status: item.status || '',
                notes: item.notes || '',
                itemIndex: i + 1,
                // الحقول المطلوبة
                createdAt: item.createdAt || evaluationData.createdAt || now,
                updatedAt: item.updatedAt || evaluationData.updatedAt || now,
                createdBy: item.createdBy || evaluationData.createdBy || userId,
                updatedBy: item.updatedBy || evaluationData.updatedBy || userId,
                rowId: item.rowId || generateSequentialId('CEVROW', sheetName, spreadsheetId)
            };
            
            var result = appendToSheet(sheetName, record, spreadsheetId);
            results.push(result);
        }
        
        // إرجاع النتيجة (نجاح إذا تم حفظ جميع البنود)
        var allSuccess = results.every(function(r) { return r && r.success !== false; });
        return {
            success: allSuccess,
            message: allSuccess ? 'تم حفظ التقييم بنجاح' : 'حدث خطأ أثناء حفظ بعض البنود',
            evaluationId: evaluationId,
            savedItems: results.length
        };
    } catch (error) {
        Logger.log('Error in addContractorEvaluationToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التقييم: ' + error.toString() };
    }
}

/**
 * تحديث تقييم مقاول
 */
function updateContractorEvaluation(evaluationId, updateData) {
    try {
        if (!evaluationId) {
            return { success: false, message: 'معرف التقييم غير محدد' };
        }
        
        const sheetName = 'ContractorEvaluations';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const evaluationIndex = data.findIndex(e => e.id === evaluationId);
        
        if (evaluationIndex === -1) {
            return { success: false, message: 'التقييم غير موجود' };
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[evaluationIndex][key] = updateData[key];
            }
        }
        
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating contractor evaluation: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التقييم: ' + error.toString() };
    }
}

/**
 * الحصول على جميع تقييمات المقاولين
 */
function getAllContractorEvaluations(filters = {}) {
    try {
        const sheetName = 'ContractorEvaluations';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.contractorId) {
            data = data.filter(e => e.contractorId === filters.contractorId);
        }
        if (filters.status) {
            data = data.filter(e => e.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(e => {
                if (!e.evaluationDate) return false;
                return new Date(e.evaluationDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(e => {
                if (!e.evaluationDate) return false;
                return new Date(e.evaluationDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب تاريخ التقييم
        data.sort((a, b) => {
            const dateA = new Date(a.evaluationDate || a.createdAt || 0);
            const dateB = new Date(b.evaluationDate || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all contractor evaluations: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التقييمات: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على تقييمات مقاول محدد
 */
function getContractorEvaluations(contractorId) {
    try {
        return getAllContractorEvaluations({ contractorId: contractorId });
    } catch (error) {
        Logger.log('Error getting contractor evaluations: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة التقييمات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * طلبات اعتماد المقاولين (Contractor Approval Requests)
 * ============================================
 */

/**
 * إضافة طلب اعتماد مقاول
 */
function addContractorApprovalRequest(requestData) {
    try {
        if (!requestData) {
            return { success: false, message: 'بيانات الطلب غير موجودة' };
        }
        
        const sheetName = 'ContractorApprovalRequests';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ إصلاح: التحقق من أن ID غير موجود أو مؤقت (TEMP_) قبل توليد ID جديد
        // ✅ إذا كان ID غير موجود أو يبدأ بـ TEMP_ أو لا يبدأ بـ CAR_، نولد ID جديد
        const hasValidId = requestData.id && 
                           typeof requestData.id === 'string' && 
                           requestData.id.startsWith('CAR_') && 
                           !requestData.id.startsWith('TEMP_');
        
        if (!hasValidId) {
            // ✅ حذف ID القديم (المؤقت) قبل توليد ID جديد
            if (requestData.id && typeof requestData.id === 'string' && requestData.id.startsWith('TEMP_')) {
                Logger.log('⚠️ Warning: Removing temporary ID before generating new one. tempId=' + requestData.id);
            } else if (requestData.id && typeof requestData.id === 'string' && !requestData.id.startsWith('CAR_')) {
                Logger.log('⚠️ Warning: Removing invalid ID (does not start with CAR_) before generating new one. invalidId=' + requestData.id);
            } else if (!requestData.id) {
                Logger.log('ℹ️ No ID provided - generating new sequential ID');
            }
            requestData.id = generateSequentialId('CAR', sheetName, spreadsheetId);
            Logger.log('✅ Generated new ID for approval request: ' + requestData.id);
        } else {
            Logger.log('ℹ️ Using existing valid ID: ' + requestData.id);
        }
        if (!requestData.createdAt) {
            requestData.createdAt = new Date();
        }
        if (!requestData.status) {
            requestData.status = 'pending';
        }
        
        // ✅ استخدام appendToSheet مع spreadsheetId للاتساق
        const appendResult = appendToSheet(sheetName, requestData, spreadsheetId);
        
        // ✅ إرجاع البيانات مع ID للاستخدام في Frontend
        if (appendResult.success) {
            return {
                success: true,
                message: appendResult.message || 'تم إضافة طلب الاعتماد بنجاح',
                data: requestData, // ✅ إرجاع requestData مع ID المولد
                rowNumber: appendResult.rowNumber
            };
        } else {
            return appendResult;
        }
    } catch (error) {
        Logger.log('Error in addContractorApprovalRequest: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة طلب الاعتماد: ' + error.toString() };
    }
}

/**
 * تحديث طلب اعتماد مقاول
 * ✅ تم التعديل: استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
 */
function updateContractorApprovalRequest(requestId, updateData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        const sheetName = 'ContractorApprovalRequests';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
        const result = updateSingleRowInSheet(sheetName, requestId, updateData, spreadsheetId);
        
        if (result.success) {
            Logger.log('✅ Successfully updated contractor approval request: ' + requestId);
        } else {
            Logger.log('⚠️ Failed to update contractor approval request: ' + result.message);
        }
        
        return result;
    } catch (error) {
        Logger.log('Error updating contractor approval request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث طلب الاعتماد: ' + error.toString() };
    }
}

/**
 * الحصول على جميع طلبات الاعتماد
 */
function getAllContractorApprovalRequests(filters = {}) {
    try {
        const sheetName = 'ContractorApprovalRequests';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // ✅ معالجة evaluationData للتأكد من تحليلها بشكل صحيح
        data = data.map(function(record) {
            if (record) {
                if ((!record.status || String(record.status).trim() === '') && record.Status) {
                    record.status = String(record.Status).trim();
                }
            }
            if (record && record.evaluationData) {
                // محاولة تحليل evaluationData إذا كانت نصاً
                var evalData = record.evaluationData;
                var parseAttempts = 0;
                while (evalData && typeof evalData === 'string' && parseAttempts < 3) {
                    try {
                        evalData = JSON.parse(evalData);
                        parseAttempts++;
                    } catch (e) {
                        Logger.log('Warning: Could not parse evaluationData for request ' + record.id + ': ' + e.toString());
                        break;
                    }
                }
                record.evaluationData = evalData;
                
                // ✅ تحليل items داخل evaluationData
                if (record.evaluationData && record.evaluationData.items && typeof record.evaluationData.items === 'string') {
                    try {
                        record.evaluationData.items = JSON.parse(record.evaluationData.items);
                    } catch (e) {
                        Logger.log('Warning: Could not parse evaluationData.items for request ' + record.id);
                    }
                }
            }
            return record;
        });
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        if (filters.requestType) {
            data = data.filter(r => r.requestType === filters.requestType);
        }
        if (filters.createdBy) {
            data = data.filter(r => r.createdBy === filters.createdBy);
        }
        if (filters.pendingOnly) {
            data = data.filter(r => r.status === 'pending' || r.status === 'under_review');
        }
        
        // ترتيب حسب تاريخ الإنشاء
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all contractor approval requests: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة طلبات الاعتماد: ' + error.toString(), data: [] };
    }
}

/**
 * توليد كود CON-xxx للمقاول
 * @param {string} spreadsheetId - معرف جدول البيانات
 * @returns {string} - كود المقاول بصيغة CON-xxx
 */
/**
 * توليد كود CON-xxx للمقاول
 * ✅ تم التحديث: البحث فقط في ApprovedContractors
 * @param {string} spreadsheetId - معرف جدول البيانات
 * @returns {string} - كود المقاول بصيغة CON-xxx
 */
function getMaxExistingContractorCodeNumber_(spreadsheetId) {
    // ✅ البحث فقط في ApprovedContractors
    const approvedData = readFromSheet('ApprovedContractors', spreadsheetId);
    let maxNumber = 0;
    
    if (Array.isArray(approvedData)) {
        approvedData.forEach(function(approved) {
            if (!approved) return;
            const code = approved.code || approved.isoCode;
            if (!code) return;
            const match = String(code).match(/CON-(\d+)/);
            if (!match) return;
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        });
    }
    
    return maxNumber;
}

function getNextContractorCodeNumber_(spreadsheetId, options) {
    const useLock = !(options && options.skipLock === true);
    const lock = useLock ? LockService.getScriptLock() : null;
    
    if (lock) {
        lock.waitLock(30000);
    }
    
    try {
        const props = PropertiesService.getScriptProperties();
        const seqKey = 'CONTRACTOR_CODE_SEQUENCE';
        const storedValue = props.getProperty(seqKey);
        let current = parseInt(storedValue || '0', 10);
        
        if (isNaN(current) || current < 0) {
            current = 0;
        }
        
        // مزامنة أولية مع أكبر كود موجود (لحماية البيانات القديمة)
        if (current === 0) {
            current = getMaxExistingContractorCodeNumber_(spreadsheetId);
        }
        
        const next = current + 1;
        props.setProperty(seqKey, String(next));
        return next;
    } finally {
        if (lock) {
            lock.releaseLock();
        }
    }
}

function generateContractorCode(spreadsheetId, options) {
    try {
        const newNumber = getNextContractorCodeNumber_(spreadsheetId, options);
        const paddedNumber = ('000' + newNumber).slice(-3); // تنسيق الرقم بـ 3 خانات
        return 'CON-' + paddedNumber;
    } catch (error) {
        Logger.log('Error in generateContractorCode: ' + error.toString());
        // في حالة الخطأ، نعيد كود افتراضي
        return 'CON-001';
    }
}

/**
 * اعتماد طلب اعتماد مقاول
 */

function approveContractorApprovalRequest(requestId, userData) {
    const approvalLock = LockService.getScriptLock();
    try {
        approvalLock.waitLock(30000);
        
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        // التحقق من صلاحيات المستخدم
        if (!checkAdminPermissions(userData)) {
            return { success: false, message: 'ليس لديك صلاحية لاعتماد الطلبات' };
        }
        
        const sheetName = 'ContractorApprovalRequests';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const requestIndex = data.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            return { success: false, message: 'طلب الاعتماد غير موجود' };
        }
        
        const request = data[requestIndex];
        
        // تحديث حالة الطلب
        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = userData.id || '';
        request.approvedByName = userData.name || '';
        request.updatedAt = new Date();
        
        let approvedEntity = null;
        let finalContractor = null;
        
        // إضافة المقاول/المورد إلى قائمة المعتمدين
        if (request.requestType === 'contractor' || request.requestType === 'supplier') {
            // ✅ توليد كود CON-xxx موحد
            const contractorCode = generateContractorCode(spreadsheetId, { skipLock: true });
            
            approvedEntity = {
                id: generateSequentialId('ACN', 'ApprovedContractors', spreadsheetId),
                code: contractorCode,          // ✅ إضافة كود CON-xxx
                isoCode: contractorCode,       // ✅ إضافة isoCode أيضاً للتوافق
                companyName: request.companyName,
                entityType: request.requestType === 'contractor' ? 'contractor' : 'supplier',
                serviceType: request.serviceType,
                licenseNumber: request.licenseNumber || '',
                contactPerson: request.contactPerson || '',  // ✅ إضافة شخص الاتصال
                phone: request.phone || '',                   // ✅ إضافة الهاتف
                email: request.email || '',                   // ✅ إضافة البريد
                approvalDate: new Date(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // سنة من الآن
                status: 'approved',
                notes: request.notes || '',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            Logger.log('✅ Approving contractor with code: ' + contractorCode);
            Logger.log('📝 Adding approved contractor to ApprovedContractors sheet (separate from ContractorApprovalRequests)');
            
            const addResult = addApprovedContractorToSheet(approvedEntity);
            
            // التكرار هنا ليس خطأ تشغيلياً: نكمل اعتماد الطلب بدون إنشاء سجل جديد
            if (addResult && addResult.isDuplicate) {
                Logger.log('⚠️ Duplicate contractor detected during approval; request will be approved without creating a new approved-contractor record');
                approvedEntity.id = (addResult.duplicateInfo && addResult.duplicateInfo.id) || approvedEntity.id;
                approvedEntity.code = (addResult.duplicateInfo && addResult.duplicateInfo.code) || approvedEntity.code;
                approvedEntity.isoCode = approvedEntity.code;
                approvedEntity._isDuplicate = true;
                approvedEntity._duplicateMessage = addResult.message;
                finalContractor = approvedEntity;
            } else if (!addResult.success) {
                Logger.log('❌ Error: Failed to add approved contractor: ' + addResult.message);
                // ✅ إرجاع خطأ فوري - لا نكمل العملية إذا فشل إضافة المعتمد
                return { success: false, message: 'فشل إضافة المقاول إلى قائمة المعتمدين: ' + addResult.message };
            }
            
            // ✅ التحقق من نجاح الإضافة أو التحديث
            if (addResult && addResult.isDuplicate) {
                Logger.log('⚠️ Contractor already exists - updated existing record instead of adding new one');
                Logger.log('⚠️ Duplicate info: id=' + (addResult.duplicateInfo?.id || 'N/A') + ', companyName=' + (addResult.duplicateInfo?.companyName || 'N/A'));
            } else if (addResult) {
                Logger.log('✅ Successfully added approved contractor to ApprovedContractors. Row number: ' + (addResult.rowNumber || 'N/A'));
            }
            
            // ✅ في حالة التحديث (duplicate)، نستخدم id من addResult
            // في حالة الإضافة الجديدة، approvedEntity.id موجود بالفعل
            if (addResult && addResult.id) {
                approvedEntity.id = addResult.id;
                Logger.log('✅ Using approved contractor ID: ' + approvedEntity.id);
            }
            
            // ✅ إضافة معلومات التكرار إلى النتيجة النهائية
            if (addResult && addResult.isDuplicate) {
                approvedEntity._isDuplicate = true;
                approvedEntity._duplicateMessage = addResult.message;
            }
            
            // ✅ تم إزالة إضافة المقاول إلى جدول Contractors
            // ✅ الآن نعتمد فقط على ApprovedContractors
            // ✅ approvedEntity يحتوي على جميع البيانات المطلوبة
            finalContractor = approvedEntity;
        }
        
        // إذا كان الطلب لتقييم، إضافة التقييم إلى القائمة
        if (request.requestType === 'evaluation' && request.evaluationData) {
            const evaluationData = request.evaluationData;
            evaluationData.status = 'approved';
            evaluationData.approvedAt = new Date();
            evaluationData.approvedBy = userData.id || '';
            
            const addEvaluationResult = addContractorEvaluationToSheet(evaluationData);
            if (!addEvaluationResult.success) {
                Logger.log('Warning: Failed to add evaluation: ' + addEvaluationResult.message);
            }
        }
        
        // ✅ حفظ تحديث الطلب في ContractorApprovalRequests فقط
        // ✅ هذا يؤثر فقط على ContractorApprovalRequests، لا يؤثر على ApprovedContractors
        // ✅ استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
        Logger.log('📝 Updating approval request in ContractorApprovalRequests (sheetName=' + sheetName + ')');
        const updateData = {
            status: request.status,
            approvedAt: request.approvedAt,
            approvedBy: request.approvedBy,
            approvedByName: request.approvedByName
        };
        const updateResult = updateSingleRowInSheet(sheetName, requestId, updateData, spreadsheetId);
        
        if (updateResult.success) {
            Logger.log('✅ Successfully approved contractor approval request: ' + requestId);
            Logger.log('✅ Approval request updated in ContractorApprovalRequests');
            
            // ✅ التحقق من أن approvedEntity تم إنشاؤه بشكل صحيح
            if (approvedEntity) {
                Logger.log('✅ ApprovedEntity details: id=' + (approvedEntity.id || 'N/A') + ', companyName=' + (approvedEntity.companyName || 'N/A') + ', code=' + (approvedEntity.code || approvedEntity.isoCode || 'N/A') + ', entityType=' + (approvedEntity.entityType || 'N/A'));
            } else {
                Logger.log('⚠️ Warning: approvedEntity is null - this may be normal if requestType is not contractor/supplier');
            }
            
            // Return extended success object
            const result = {
                success: true,
                message: 'تم اعتماد الطلب بنجاح',
                approvedEntity: approvedEntity,
                contractor: finalContractor
            };
            
            // ✅ إضافة معلومات التكرار إذا كانت موجودة
            if (approvedEntity && approvedEntity._isDuplicate) {
                result.isDuplicate = true;
                result.duplicateMessage = approvedEntity._duplicateMessage || 'المقاول/المورد مسجل بالفعل في قائمة المعتمدين. تم تحديث البيانات الموجودة.';
                result.duplicateInfo = {
                    id: approvedEntity.id,
                    companyName: approvedEntity.companyName,
                    code: approvedEntity.code || approvedEntity.isoCode
                };
            }
            
            // ✅ التحقق النهائي: التأكد من أن approvedEntity يحتوي على جميع البيانات المطلوبة
            if (approvedEntity) {
                const requiredFields = ['id', 'code', 'companyName', 'entityType', 'status'];
                const missingFields = requiredFields.filter(field => !approvedEntity[field]);
                if (missingFields.length > 0) {
                    Logger.log('⚠️ Warning: ApprovedEntity is missing required fields: ' + missingFields.join(', '));
                } else {
                    Logger.log('✅ Verified: ApprovedEntity contains all required fields');
                }
            }
            
            return result;
        } else {
            Logger.log('⚠️ Failed to update approval request: ' + updateResult.message);
            return updateResult;
        }
        
        // ✅ تنظيف الطلبات المعتمدة القديمة تلقائياً
        cleanupApprovedRequests();
        
    } catch (error) {
        Logger.log('❌ Error approving contractor approval request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء اعتماد الطلب: ' + error.toString() };
    } finally {
        try {
            approvalLock.releaseLock();
        } catch (releaseError) {
            Logger.log('⚠️ Could not release approval lock: ' + releaseError.toString());
        }
    }
}

/**
 * تنظيف الطلبات المعتمدة القديمة (يُستدعى تلقائياً بعد الاعتماد)
 */
function cleanupApprovedRequests() {
    try {
        // تشغيل التنظيف في الخلفية (لا ننتظر النتيجة)
        const cleanupResult = cleanOldApprovedRequests();
        if (cleanupResult.success) {
            Logger.log('✅ تم تنظيف الطلبات المعتمدة القديمة: ' + cleanupResult.message);
        } else {
            Logger.log('⚠️ فشل تنظيف الطلبات المعتمدة القديمة: ' + cleanupResult.message);
        }
    } catch (error) {
        Logger.log('Error in cleanupApprovedRequests: ' + error.toString());
    }
}

/**
 * تنظيف الطلبات المعتمدة القديمة من ContractorApprovalRequests
 * يتم حذف الطلبات المعتمدة التي مضى عليها أكثر من 30 يوماً
 */
function cleanOldApprovedRequests() {
    try {
        const sheetName = 'ContractorApprovalRequests';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        
        if (!Array.isArray(data) || data.length === 0) {
            return { success: true, message: 'لا توجد طلبات للتنظيف' };
        }
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const requestsToKeep = data.filter(request => {
            if (!request || request.status !== 'approved' || !request.approvedAt) {
                return true; // الاحتفاظ بالطلبات غير المعتمدة أو بدون تاريخ اعتماد
            }
            
            const approvedDate = new Date(request.approvedAt);
            return approvedDate >= thirtyDaysAgo; // الاحتفاظ بالطلبات المعتمدة في آخر 30 يوماً
        });
        
        const deletedCount = data.length - requestsToKeep.length;
        
        if (deletedCount > 0) {
            const saveResult = saveToSheet(sheetName, requestsToKeep, spreadsheetId);
            if (!saveResult.success) {
                return { success: false, message: 'فشل حفظ البيانات بعد التنظيف: ' + saveResult.message };
            }
            
            Logger.log('✅ تم تنظيف ' + deletedCount + ' طلب معتمد قديم من ContractorApprovalRequests');
            return { success: true, message: 'تم تنظيف ' + deletedCount + ' طلب معتمد قديم' };
        } else {
            return { success: true, message: 'لا توجد طلبات معتمدة قديمة للتنظيف' };
        }
        
    } catch (error) {
        Logger.log('Error in cleanOldApprovedRequests: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تنظيف الطلبات: ' + error.toString() };
    }
}
function rejectContractorApprovalRequest(requestId, rejectionReason, userData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        // التحقق من صلاحيات المستخدم
        if (!checkAdminPermissions(userData)) {
            return { success: false, message: 'ليس لديك صلاحية لرفض الطلبات' };
        }
        
        const sheetName = 'ContractorApprovalRequests';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
        const updateData = {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: userData.id || '',
            rejectedByName: userData.name || '',
            rejectionReason: rejectionReason || ''
        };
        
        const result = updateSingleRowInSheet(sheetName, requestId, updateData, spreadsheetId);
        
        if (result.success) {
            Logger.log('✅ Successfully rejected contractor approval request: ' + requestId);
        } else {
            Logger.log('⚠️ Failed to reject contractor approval request: ' + result.message);
        }
        
        return result;
    } catch (error) {
        Logger.log('Error rejecting contractor approval request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء رفض الطلب: ' + error.toString() };
    }
}

/**
 * ============================================
 * طلبات حذف المقاولين (Contractor Deletion Requests)
 * ============================================
 */

/**
 * إضافة طلب حذف مقاول
 */
function addContractorDeletionRequest(requestData) {
    try {
        if (!requestData) {
            return { success: false, message: 'بيانات الطلب غير موجودة' };
        }
        
        const sheetName = 'ContractorDeletionRequests';
        const spreadsheetId = getSpreadsheetId();
        
        // إضافة حقول تلقائية
        if (!requestData.id) {
            requestData.id = generateSequentialId('CDR', sheetName, spreadsheetId);
        }
        if (!requestData.createdAt) {
            requestData.createdAt = new Date();
        }
        if (!requestData.status) {
            requestData.status = 'pending';
        }
        
        // ✅ استخدام appendToSheet مع spreadsheetId للاتساق
        return appendToSheet(sheetName, requestData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addContractorDeletionRequest: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة طلب الحذف: ' + error.toString() };
    }
}

/**
 * تحديث طلب حذف مقاول
 * ✅ تم التعديل: استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
 */
function updateContractorDeletionRequest(requestId, updateData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        const sheetName = 'ContractorDeletionRequests';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
        const result = updateSingleRowInSheet(sheetName, requestId, updateData, spreadsheetId);
        
        if (result.success) {
            Logger.log('✅ Successfully updated contractor deletion request: ' + requestId);
        } else {
            Logger.log('⚠️ Failed to update contractor deletion request: ' + result.message);
        }
        
        return result;
    } catch (error) {
        Logger.log('Error updating contractor deletion request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث طلب الحذف: ' + error.toString() };
    }
}

/**
 * الحصول على جميع طلبات الحذف
 */
function getAllContractorDeletionRequests(filters = {}) {
    try {
        const sheetName = 'ContractorDeletionRequests';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(r => r.status === filters.status);
        }
        if (filters.requestType) {
            data = data.filter(r => r.requestType === filters.requestType);
        }
        if (filters.createdBy) {
            data = data.filter(r => r.createdBy === filters.createdBy);
        }
        if (filters.pendingOnly) {
            data = data.filter(r => r.status === 'pending' || r.status === 'under_review');
        }
        
        // ترتيب حسب تاريخ الإنشاء
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all contractor deletion requests: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة طلبات الحذف: ' + error.toString(), data: [] };
    }
}

/**
 * الموافقة على طلب حذف مقاول
 */
function approveContractorDeletionRequest(requestId, userData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        // التحقق من صلاحيات المستخدم
        if (!checkAdminPermissions(userData)) {
            return { success: false, message: 'ليس لديك صلاحية لاعتماد طلبات الحذف' };
        }
        
        const sheetName = 'ContractorDeletionRequests';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const requestIndex = data.findIndex(r => r.id === requestId);
        
        if (requestIndex === -1) {
            return { success: false, message: 'طلب الحذف غير موجود' };
        }
        
        const request = data[requestIndex];
        
        // تحديث حالة الطلب
        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = userData.id || '';
        request.approvedByName = userData.name || '';
        request.updatedAt = new Date();
        
        // ✅ حذف المقاول/التقييم/المعتمد فعلياً
        // ✅ تم التحديث: الاعتماد فقط على ApprovedContractors
        if (request.requestType === 'contractor' || request.requestType === 'approved_entity') {
            // حذف من قائمة المعتمدين فقط
            const approvedSheet = 'ApprovedContractors';
            const approvedData = readFromSheet(approvedSheet, spreadsheetId);
            const approvedIndex = approvedData.findIndex(ac => 
                ac.id === request.entityId || 
                ac.contractorId === request.entityId
            );
            
            if (approvedIndex !== -1) {
                approvedData.splice(approvedIndex, 1);
                const saveResult = saveToSheet(approvedSheet, approvedData, spreadsheetId);
                if (!saveResult.success) {
                    return { success: false, message: 'فشل حذف الجهة المعتمدة: ' + saveResult.message };
                }
            } else {
                Logger.log('⚠️ Warning: Approved entity not found for deletion: ' + request.entityId);
            }
        } else if (request.requestType === 'evaluation') {
            // حذف التقييم
            const evaluationsSheet = 'ContractorEvaluations';
            const evaluationsData = readFromSheet(evaluationsSheet, spreadsheetId);
            const evaluationIndex = evaluationsData.findIndex(e => e.id === request.entityId);
            if (evaluationIndex !== -1) {
                evaluationsData.splice(evaluationIndex, 1);
                const saveResult = saveToSheet(evaluationsSheet, evaluationsData, spreadsheetId);
                if (!saveResult.success) {
                    return { success: false, message: 'فشل حذف التقييم: ' + saveResult.message };
                }
            }
        }
        
        // ✅ حفظ تحديث حالة الطلب باستخدام updateSingleRowInSheet() لتحديث صف واحد فقط
        const updateData = {
            status: request.status,
            approvedAt: request.approvedAt,
            approvedBy: request.approvedBy,
            approvedByName: request.approvedByName
        };
        return updateSingleRowInSheet(sheetName, requestId, updateData, spreadsheetId);
    } catch (error) {
        Logger.log('Error approving contractor deletion request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الموافقة على الحذف: ' + error.toString() };
    }
}

/**
 * رفض طلب حذف مقاول
 * ✅ تم التعديل: استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
 */
function rejectContractorDeletionRequest(requestId, rejectionReason, userData) {
    try {
        if (!requestId) {
            return { success: false, message: 'معرف الطلب غير محدد' };
        }
        
        // التحقق من صلاحيات المستخدم
        if (!checkAdminPermissions(userData)) {
            return { success: false, message: 'ليس لديك صلاحية لرفض طلبات الحذف' };
        }
        
        const sheetName = 'ContractorDeletionRequests';
        const spreadsheetId = getSpreadsheetId();
        
        // ✅ استخدام updateSingleRowInSheet() لتحديث صف واحد فقط بدون حذف الصفوف الأخرى
        const updateData = {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: userData.id || '',
            rejectedByName: userData.name || '',
            rejectionReason: rejectionReason || ''
        };
        
        const result = updateSingleRowInSheet(sheetName, requestId, updateData, spreadsheetId);
        
        if (result.success) {
            Logger.log('✅ Successfully rejected contractor deletion request: ' + requestId);
        } else {
            Logger.log('⚠️ Failed to reject contractor deletion request: ' + result.message);
        }
        
        return result;
    } catch (error) {
        Logger.log('Error rejecting contractor deletion request: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء رفض الطلب: ' + error.toString() };
    }
}

// ========== تحليل المقاول — مصدر حقيقة من الجداول (Violations + ContractorEvaluations) ==========

function _cabNormStr_(v) {
    return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
}

function _cabCanonicalName_(v) {
    var normalized = _cabNormStr_(v);
    if (!normalized) return '';
    return normalized
        .replace(/["'`.,،؛:(){}\[\]<>_\-\/\\|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function _cabBuildIdSet_(contractor, contractorIdParam) {
    var set = {};
    function add(x) {
        var k = _cabNormStr_(x);
        if (k) set[k] = true;
    }
    function addMany(values) {
        if (Object.prototype.toString.call(values) !== '[object Array]') return;
        var i;
        for (i = 0; i < values.length; i++) add(values[i]);
    }
    if (!contractor) contractor = {};
    add(contractorIdParam);
    add(contractor.id);
    add(contractor.contractorId);
    add(contractor.code);
    add(contractor.isoCode);
    add(contractor.licenseNumber);
    add(contractor.contractNumber);
    add(contractor.approvedEntityId);
    add(contractor.entityCode);
    addMany(contractor.aliasIds);
    addMany(contractor.identityIds);
    addMany(contractor.legacyIds);
    addMany(contractor.altIds);
    return set;
}

function _cabIdInSet_(val, idSet) {
    var k = _cabNormStr_(val);
    return k && idSet[k] === true;
}

function _cabBuildNameSets_(contractor) {
    var exact = {};
    var canonical = {};
    function addName(value) {
        var exactName = _cabNormStr_(value);
        if (exactName) exact[exactName] = true;
        var canonicalName = _cabCanonicalName_(value);
        if (canonicalName) canonical[canonicalName] = true;
    }
    contractor = contractor || {};
    addName(contractor.name);
    addName(contractor.companyName);
    addName(contractor.contractorName);
    return {
        exact: exact,
        canonical: canonical
    };
}

function _cabCollectRecordIds_(record) {
    if (!record) return [];
    var fields = ['contractorId', 'contractorCode', 'code', 'isoCode', 'licenseNumber', 'contractNumber', 'approvedEntityId', 'entityCode'];
    var ids = [];
    var i;
    for (i = 0; i < fields.length; i++) {
        var normalized = _cabNormStr_(record[fields[i]]);
        if (normalized) ids.push(normalized);
    }
    return ids;
}

function _cabHasExplicitContractorIds_(record) {
    return _cabCollectRecordIds_(record).length > 0;
}

function _cabCollectRecordNames_(record) {
    if (!record) return [];
    var fields = ['contractorName', 'companyName', 'company', 'contractorCompany', 'name', 'externalName', 'contractorWorkerName', 'contractorWorker'];
    var names = [];
    var i;
    for (i = 0; i < fields.length; i++) {
        var value = record[fields[i]];
        if (value == null) continue;
        var normalized = String(value).replace(/\s+/g, ' ').trim();
        if (normalized) names.push(normalized);
    }
    return names;
}

function _cabCollectContractorEntityNames_(record) {
    if (!record) return [];
    var fields = ['contractorName', 'companyName', 'company', 'contractorCompany', 'name', 'externalName'];
    var names = [];
    var i;
    for (i = 0; i < fields.length; i++) {
        var value = record[fields[i]];
        if (value == null) continue;
        var normalized = String(value).replace(/\s+/g, ' ').trim();
        if (normalized) names.push(normalized);
    }
    return names;
}

function _cabNameInSets_(value, nameSets) {
    var exact = _cabNormStr_(value);
    if (exact && nameSets.exact[exact] === true) return true;
    var canonical = _cabCanonicalName_(value);
    return canonical && nameSets.canonical[canonical] === true;
}

function _cabRecordMatchesContractor_(record, idSet, nameSets) {
    if (!record) return false;
    var recordIds = _cabCollectRecordIds_(record);
    var i;
    for (i = 0; i < recordIds.length; i++) {
        if (idSet[recordIds[i]] === true) return true;
    }
    if (recordIds.length > 0) return false;
    var recordNames = _cabCollectRecordNames_(record);
    for (i = 0; i < recordNames.length; i++) {
        if (_cabNameInSets_(recordNames[i], nameSets)) return true;
    }
    return false;
}

function _cabViolationBelongs_(v, idSet, nameSets) {
    if (!v) return false;
    var pt = String(v.personType || '').trim().toLowerCase();
    if ((pt === 'employee' || pt === 'موظف') &&
        !(v.contractorName && String(v.contractorName).trim()) &&
        (v.contractorId == null || String(v.contractorId).trim() === '') &&
        (v.contractorCode == null || String(v.contractorCode).trim() === '') &&
        (v.code == null || String(v.code).trim() === '') &&
        (v.isoCode == null || String(v.isoCode).trim() === '')) {
        return false;
    }
    var recordIds = _cabCollectRecordIds_(v);
    var hasRecordIds = recordIds.length > 0;
    var idsMatch = false;
    var i;
    for (i = 0; i < recordIds.length; i++) {
        if (idSet[recordIds[i]] === true) {
            idsMatch = true;
            break;
        }
    }
    if (hasRecordIds && !idsMatch) return false;
    var entityNames = _cabCollectContractorEntityNames_(v);
    var hasEntityNames = entityNames.length > 0;
    var namesMatch = false;
    for (i = 0; i < entityNames.length; i++) {
        if (_cabNameInSets_(entityNames[i], nameSets)) {
            namesMatch = true;
            break;
        }
    }
    if (hasEntityNames && !namesMatch) return false;
    // عند وجود معرفات صريحة للمقاول نعتمدها كمصدر الحقيقة
    // ولا نفرض تطابق الاسم (قد يختلف شكل الكتابة بين الموديولات/الجداول).
    if (hasRecordIds) return idsMatch;
    // بدون معرفات، نرجع لمطابقة الاسم فقط.
    if (hasEntityNames) return namesMatch;
    return _cabRecordMatchesContractor_(v, idSet, nameSets);
}

function _cabEvalBelongs_(e, idSet, nameSets) {
    if (!e) return false;
    return _cabRecordMatchesContractor_(e, idSet, nameSets);
}

function _cabSafeReadSheet_(sheetName, spreadsheetId) {
    try {
        var data = readFromSheet(sheetName, spreadsheetId);
        return Object.prototype.toString.call(data) === '[object Array]' ? data : [];
    } catch (error) {
        Logger.log('_cabSafeReadSheet_ [' + sheetName + ']: ' + error.toString());
        return [];
    }
}

function _cabParseArrayField_(value) {
    if (Object.prototype.toString.call(value) === '[object Array]') return value;
    if (value == null) return [];
    var text = String(value).trim();
    if (!text) return [];
    try {
        var parsed = JSON.parse(text);
        return Object.prototype.toString.call(parsed) === '[object Array]' ? parsed : [];
    } catch (error) {
        return [];
    }
}

function _cabMatchRecordFieldsByName_(record, fields, nameSets) {
    if (!record || !fields || !fields.length) return false;
    var i;
    for (i = 0; i < fields.length; i++) {
        if (_cabNameInSets_(record[fields[i]], nameSets)) return true;
    }
    return false;
}

function _cabHasContractorMarkers_(record) {
    if (!record) return false;
    var idFields = ['contractorId', 'contractorCode', 'code', 'isoCode', 'approvedEntityId', 'entityCode'];
    var nameFields = ['contractorName', 'companyName', 'company', 'contractorCompany', 'externalName'];
    var i;
    for (i = 0; i < idFields.length; i++) {
        if (_cabNormStr_(record[idFields[i]])) return true;
    }
    for (i = 0; i < nameFields.length; i++) {
        if (_cabNormStr_(record[nameFields[i]])) return true;
    }
    return false;
}

function _cabHasContractorAffinity_(record) {
    if (!record) return false;
    var personType = _cabNormStr_(record.personType || record.affiliation || record.type);
    if (personType === 'contractor' || personType === 'مقاول' || personType === 'external' || personType === 'خارجي') {
        return true;
    }
    return _cabHasContractorMarkers_(record);
}

function _cabIncidentBelongs_(record, idSet, nameSets) {
    if (!record || !_cabHasContractorAffinity_(record)) return false;
    if (_cabRecordMatchesContractor_(record, idSet, nameSets)) return true;
    if (_cabHasExplicitContractorIds_(record)) return false;
    return _cabMatchRecordFieldsByName_(record, ['contractorName', 'companyName', 'company', 'contractorCompany', 'externalName', 'personName', 'employeeName'], nameSets);
}

function _cabSickLeaveBelongs_(record, idSet, nameSets) {
    if (!record || !_cabHasContractorAffinity_(record)) return false;
    if (_cabRecordMatchesContractor_(record, idSet, nameSets)) return true;
    if (_cabHasExplicitContractorIds_(record)) return false;
    return _cabMatchRecordFieldsByName_(record, ['contractorName', 'companyName', 'company', 'contractorCompany', 'externalName', 'personName', 'employeeName'], nameSets);
}

function _cabClinicBelongs_(record, idSet, nameSets) {
    if (!record || !_cabHasContractorAffinity_(record)) return false;
    if (_cabRecordMatchesContractor_(record, idSet, nameSets)) return true;
    if (_cabHasExplicitContractorIds_(record)) return false;
    return _cabMatchRecordFieldsByName_(record, ['contractorName', 'companyName', 'company', 'contractorCompany', 'externalName', 'contractorWorkerName', 'contractorWorker', 'personName'], nameSets);
}

function _cabInjuryBelongs_(record, idSet, nameSets) {
    if (!record) return false;
    var personType = _cabNormStr_(record.personType);
    if (personType && personType !== 'contractor' && personType !== 'مقاول') return false;
    if (_cabRecordMatchesContractor_(record, idSet, nameSets)) return true;
    if (_cabHasExplicitContractorIds_(record)) return false;
    return _cabMatchRecordFieldsByName_(record, ['personName', 'contractorName'], nameSets);
}

function _cabTrainingBelongs_(record, idSet, nameSets) {
    if (!record) return false;
    if (_cabRecordMatchesContractor_(record, idSet, nameSets)) return true;

    var participants = _cabParseArrayField_(record.participants);
    var i;
    for (i = 0; i < participants.length; i++) {
        var participant = participants[i];
        if (participant == null) continue;

        if (typeof participant !== 'object') {
            if (_cabNameInSets_(participant, nameSets)) return true;
            continue;
        }

        var personType = _cabNormStr_(participant.personType || participant.type || participant.affiliation);
        var hasContractorHint = personType === 'contractor' || personType === 'مقاول' ||
            _cabNormStr_(participant.contractorName) || _cabNormStr_(participant.companyName) ||
            _cabNormStr_(participant.company) || _cabNormStr_(participant.contractorCompany) ||
            _cabNormStr_(participant.externalName);

        if (!hasContractorHint) continue;
        if (_cabRecordMatchesContractor_(participant, idSet, nameSets)) return true;
        if (_cabHasExplicitContractorIds_(participant)) continue;
        if (_cabMatchRecordFieldsByName_(participant, ['contractorName', 'companyName', 'company', 'contractorCompany', 'externalName'], nameSets)) {
            return true;
        }
    }

    return false;
}

function _cabPTWBelongs_(record, idSet, nameSets) {
    if (!record) return false;
    if (_cabRecordMatchesContractor_(record, idSet, nameSets)) return true;
    if (_cabHasExplicitContractorIds_(record)) return false;
    return _cabMatchRecordFieldsByName_(record, ['requestingParty', 'authorizedParty', 'responsible'], nameSets);
}

function _cabBuildRecordKey_(record, idFields, fallbackFields) {
    if (!record) return '';
    var i;
    for (i = 0; i < idFields.length; i++) {
        var idValue = _cabNormStr_(record[idFields[i]]);
        if (idValue) return 'id:' + idValue;
    }
    var parts = [];
    for (i = 0; i < fallbackFields.length; i++) {
        var value = _cabNormStr_(record[fallbackFields[i]]);
        if (value) parts.push(value);
    }
    return parts.length ? 'fallback:' + parts.join('|') : '';
}

function _cabDeduplicateRecords_(records, idFields, fallbackFields) {
    var list = Object.prototype.toString.call(records) === '[object Array]' ? records : [];
    var deduped = [];
    var seen = {};
    var i;
    for (i = 0; i < list.length; i++) {
        var record = list[i];
        if (!record) continue;
        var key = _cabBuildRecordKey_(record, idFields || [], fallbackFields || []);
        if (!key) {
            deduped.push(record);
            continue;
        }
        if (seen[key] === true) continue;
        seen[key] = true;
        deduped.push(record);
    }
    return deduped;
}

function _cabNormalizeTrainingRecord_(record) {
    if (!record) return null;
    return {
        id: record.id || '',
        sourceId: record.id || '',
        sourceSheet: record.sourceSheet || '',
        name: record.topic || record.trainingName || record.name || '',
        trainer: record.trainer || record.conductedBy || '',
        startDate: record.date || record.startDate || record.createdAt || '',
        status: record.status || ''
    };
}

function _cabIsPtwOpenStatus_(status) {
    var normalized = _cabNormStr_(status);
    return normalized === 'مفتوح' ||
        normalized === 'قيد المراجعة' ||
        normalized === 'قيد الانتظار' ||
        normalized === 'open' ||
        normalized === 'pending' ||
        normalized === 'under review';
}

function _cabIsPtwClosedStatus_(status) {
    var normalized = _cabNormStr_(status);
    return normalized === 'مغلق' ||
        normalized === 'مكتمل' ||
        normalized === 'منتهي' ||
        normalized === 'closed' ||
        normalized === 'completed' ||
        normalized === 'finished' ||
        normalized === 'اكتمل العمل بشكل آمن' ||
        normalized === 'إغلاق جبري';
}

/**
 * إحصائيات مفصّلة للمقاول من ورقتي Violations و ContractorEvaluations (قراءة مباشرة من الجدول)
 * payload: { contractor: { id, contractorId, code, isoCode, companyName, name, licenseNumber, ... }, contractorId?: string }
 */
function getContractorDetailedAnalytics(payload) {
    try {
        payload = payload || {};
        var raw = payload.contractor;
        if (!raw || typeof raw !== 'object') {
            raw = {};
        }
        // دمج حقول الجذر مع كائن المقاول (تفادي فشل الطلب عند {} أو حقول ناقصة بعد JSON)، مع الإبقاء على بقية الحقول
        var contractor = Object.assign({}, raw, {
            id: raw.id || payload.id,
            contractorId: raw.contractorId || payload.contractorId || payload.contractorIdParam,
            companyName: raw.companyName || payload.companyName,
            name: raw.name || payload.name,
            code: raw.code || payload.code,
            isoCode: raw.isoCode || payload.isoCode,
            licenseNumber: raw.licenseNumber || payload.licenseNumber,
            contractNumber: raw.contractNumber || payload.contractNumber,
            approvedEntityId: raw.approvedEntityId || payload.approvedEntityId,
            entityCode: raw.entityCode || payload.entityCode
        });
        var contractorIdParam = payload.contractorId || payload.contractorIdParam || contractor.code || contractor.isoCode || contractor.contractorId || contractor.id;
        if (String(contractor.id || '').trim() === '' && String(contractor.contractorId || '').trim() === '' &&
            String(contractor.companyName || contractor.name || '').trim() === '') {
            return { success: false, message: 'بيانات المقاول غير كافية' };
        }
        var spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId || String(spreadsheetId).trim() === '') {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        var violations = _cabSafeReadSheet_('Violations', spreadsheetId);
        var evaluations = _cabSafeReadSheet_('ContractorEvaluations', spreadsheetId);
        var incidents = _cabSafeReadSheet_('Incidents', spreadsheetId);
        var sickLeave = _cabSafeReadSheet_('SickLeave', spreadsheetId);
        var clinicVisits = _cabSafeReadSheet_('ClinicVisits', spreadsheetId);
        var clinicContractorVisits = _cabSafeReadSheet_('ClinicContractorVisits', spreadsheetId);
        var injuries = _cabSafeReadSheet_('Injuries', spreadsheetId);
        var contractorInjuries = _cabSafeReadSheet_('ClinicContractorInjuries', spreadsheetId);
        var training = _cabSafeReadSheet_('Training', spreadsheetId);
        var contractorTrainings = _cabSafeReadSheet_('ContractorTrainings', spreadsheetId);
        var ptw = _cabSafeReadSheet_('PTW', spreadsheetId);
        var ptwRegistry = _cabSafeReadSheet_('PTWRegistry', spreadsheetId);
        var idSet = _cabBuildIdSet_(contractor, contractorIdParam);
        var nameSets = _cabBuildNameSets_(contractor);
        var vList = [];
        var i;
        for (i = 0; i < violations.length; i++) {
            if (_cabViolationBelongs_(violations[i], idSet, nameSets)) {
                vList.push(violations[i]);
            }
        }
        vList = _cabDeduplicateRecords_(vList, ['isoCode', 'id'], ['contractorId', 'contractorName', 'violationType', 'violationDate', 'violationTime']);
        var eList = [];
        var j;
        for (j = 0; j < evaluations.length; j++) {
            if (_cabEvalBelongs_(evaluations[j], idSet, nameSets)) {
                eList.push(evaluations[j]);
            }
        }
        eList = _cabDeduplicateRecords_(eList, ['evaluationId', 'id', 'isoCode'], ['contractorId', 'contractorName', 'evaluationDate', 'projectName', 'finalScore']);

        var incidentList = [];
        var k;
        for (k = 0; k < incidents.length; k++) {
            if (_cabIncidentBelongs_(incidents[k], idSet, nameSets)) {
                incidentList.push(incidents[k]);
            }
        }
        incidentList = _cabDeduplicateRecords_(incidentList, ['isoCode', 'id'], ['contractorName', 'date', 'incidentType', 'title', 'description']);

        var sickLeaveList = [];
        var m;
        for (m = 0; m < sickLeave.length; m++) {
            if (_cabSickLeaveBelongs_(sickLeave[m], idSet, nameSets)) {
                sickLeaveList.push(sickLeave[m]);
            }
        }
        sickLeaveList = _cabDeduplicateRecords_(sickLeaveList, ['id', 'linkedRegistryId'], ['contractorName', 'externalName', 'startDate', 'endDate', 'reason']);

        var clinicList = [];
        var clinicSources = clinicVisits.concat(clinicContractorVisits);
        var n;
        for (n = 0; n < clinicSources.length; n++) {
            if (_cabClinicBelongs_(clinicSources[n], idSet, nameSets)) {
                clinicList.push(clinicSources[n]);
            }
        }
        clinicList = _cabDeduplicateRecords_(clinicList, ['id'], ['contractorName', 'externalName', 'contractorWorkerName', 'visitDate', 'reason']);

        var injuryList = [];
        var p;
        var injurySources = injuries.concat(contractorInjuries);
        for (p = 0; p < injurySources.length; p++) {
            if (_cabInjuryBelongs_(injurySources[p], idSet, nameSets)) {
                injuryList.push(injurySources[p]);
            }
        }
        injuryList = _cabDeduplicateRecords_(injuryList, ['id'], ['personName', 'injuryDate', 'injuryType', 'injuryLocation']);

        var trainingFromMain = [];
        var q;
        for (q = 0; q < training.length; q++) {
            if (_cabTrainingBelongs_(training[q], idSet, nameSets)) {
                var normalizedMainTraining = _cabNormalizeTrainingRecord_(training[q]);
                if (normalizedMainTraining) {
                    normalizedMainTraining.sourceSheet = 'Training';
                    trainingFromMain.push(normalizedMainTraining);
                }
            }
        }

        var trainingFromContractor = [];
        var r;
        for (r = 0; r < contractorTrainings.length; r++) {
            if (_cabRecordMatchesContractor_(contractorTrainings[r], idSet, nameSets) ||
                (!_cabHasExplicitContractorIds_(contractorTrainings[r]) &&
                    _cabMatchRecordFieldsByName_(contractorTrainings[r], ['contractorName', 'companyName'], nameSets))) {
                var normalizedContractorTraining = _cabNormalizeTrainingRecord_(contractorTrainings[r]);
                if (normalizedContractorTraining) {
                    normalizedContractorTraining.sourceSheet = 'ContractorTrainings';
                    trainingFromContractor.push(normalizedContractorTraining);
                }
            }
        }

        var trainingList = _cabDeduplicateRecords_(
            trainingFromMain.concat(trainingFromContractor),
            ['id', 'sourceId'],
            ['name', 'trainer', 'startDate', 'sourceSheet']
        );

        var ptwList = [];
        var ptwSources = ptw.concat(ptwRegistry);
        var t;
        for (t = 0; t < ptwSources.length; t++) {
            if (_cabPTWBelongs_(ptwSources[t], idSet, nameSets)) {
                ptwList.push(ptwSources[t]);
            }
        }
        ptwList = _cabDeduplicateRecords_(ptwList, ['permitId', 'id', 'paperPermitNumber'], ['requestingParty', 'authorizedParty', 'responsible', 'openDate', 'startDate', 'workDescription']);

        var scores = [];
        var u;
        for (u = 0; u < eList.length; u++) {
            var sc = parseFloat(eList[u].finalScore);
            if (isNaN(sc)) sc = parseFloat(eList[u].score);
            if (!isNaN(sc) && sc >= 0 && sc <= 100) scores.push(sc);
        }
        var avgScore = 0;
        if (scores.length > 0) {
            var sum = 0;
            var s;
            for (s = 0; s < scores.length; s++) sum += scores[s];
            avgScore = Math.round((sum / scores.length) * 100) / 100;
        }
        var highV = 0;
        var resolvedV = 0;
        var x;
        for (x = 0; x < vList.length; x++) {
            var sev = String(vList[x].severity || '').trim();
            if (sev === 'عالية' || sev === 'high' || sev === 'حرجة') highV++;
            var st = String(vList[x].status || '').trim();
            if (st === 'محلول' || st === 'resolved' || st === 'تم الحل') resolvedV++;
        }
        var resRate = vList.length > 0 ? Math.round((resolvedV / vList.length) * 100) : 100;
        var ptwOpenCount = 0;
        var ptwClosedCount = 0;
        var y;
        for (y = 0; y < ptwList.length; y++) {
            if (_cabIsPtwOpenStatus_(ptwList[y].status)) ptwOpenCount++;
            if (_cabIsPtwClosedStatus_(ptwList[y].status)) ptwClosedCount++;
        }
        return {
            success: true,
            data: {
                violations: vList,
                evaluations: eList,
                incidents: incidentList,
                sickLeave: sickLeaveList,
                clinicVisits: clinicList,
                injuries: injuryList,
                trainings: trainingList,
                ptw: ptwList,
                violationsCount: vList.length,
                evaluationsCount: eList.length,
                incidentsCount: incidentList.length,
                sickLeaveCount: sickLeaveList.length,
                clinicVisitsCount: clinicList.length,
                injuriesCount: injuryList.length,
                trainingsCount: trainingList.length,
                ptwCount: ptwList.length,
                ptwOpenCount: ptwOpenCount,
                ptwClosedCount: ptwClosedCount,
                avgScore: avgScore,
                highViolations: highV,
                resolvedViolations: resolvedV,
                resolutionRate: resRate
            }
        };
    } catch (error) {
        Logger.log('getContractorDetailedAnalytics: ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}
