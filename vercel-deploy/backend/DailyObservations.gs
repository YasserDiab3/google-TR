/**
 * Google Apps Script for HSE System - Daily Observations Module
 * 
 * موديول الملاحظات اليومية - النسخة المنفصلة والمحسنة
 * 
 * هذا الموديول يتعامل مع:
 * - إضافة ملاحظات يومية
 * - تحديث الملاحظات
 * - الحصول على الملاحظات مع فلاتر متقدمة
 * - حذف الملاحظات
 * - إحصائيات الملاحظات
 * - ربط تلقائي مع Action Tracking
 */

/**
 * ============================================
 * إضافة ملاحظة يومية
 * ============================================
 * 
 * @param {Object} observationData - بيانات الملاحظة
 * @returns {Object} نتيجة العملية
 */
function addObservationToSheet(observationData) {
    try {
        if (!observationData) {
            return { success: false, message: 'بيانات الملاحظة غير موجودة' };
        }

        const sheetName = 'DailyObservations';

        // لا نغيّر id أبداً إذا كان موجوداً. الجديد فقط: id بتنسيق DOB-NNNN (تسلسل مستمر)
        if (!observationData.id) {
            observationData.id = generateDailyObservationId(sheetName);
        }
        // تسجيل isoCode في الجدول = OBS-YYYYMM- + الرقم من id (مثال: DOB-2988 → OBS-202602-2988)
        observationData.isoCode = getObservationIsoCodeFromId(observationData.id);
        if (!observationData.createdAt) {
            observationData.createdAt = new Date();
        }
        if (!observationData.updatedAt) {
            observationData.updatedAt = new Date();
        } 
        if (!observationData.status) {
            observationData.status = 'مفتوح';
        }
        // سير اعتماد الملاحظات (قيم workflowStage بالإنجليزية للتخزين)
        if (!observationData.workflowStage) {
            observationData.workflowStage = 'pending_specialist';
        }
        if (!observationData.submittedAt) {
            observationData.submittedAt = new Date().toISOString();
        }
        
        // معالجة attachments - التأكد من تحويلها إلى JSON string مع الروابط
        if (observationData.attachments && Array.isArray(observationData.attachments)) {
            observationData.attachments = stringifyAttachments(observationData.attachments);
        } else if (observationData.attachments && typeof observationData.attachments === 'object') {
            observationData.attachments = stringifyAttachments([observationData.attachments]);
        } else if (!observationData.attachments) {
            observationData.attachments = '[]';
        }
        
        // معالجة images - إذا كانت موجودة كـ array
        if (observationData.images && Array.isArray(observationData.images)) {
            const processedImages = [];
            for (let i = 0; i < observationData.images.length; i++) {
                const image = observationData.images[i];
                if (typeof image === 'string' && image.startsWith('data:')) {
                    try {
                        const uploadResult = uploadFileToDrive(
                            image,
                            'observation_' + (observationData.id || Utilities.getUuid()) + '_' + Date.now() + '_' + i + '.jpg',
                            'image/jpeg',
                            'DailyObservations'
                        );
                        if (uploadResult && uploadResult.success) {
                            processedImages.push(uploadResult.directLink || uploadResult.shareableLink);
                        } else {
                            processedImages.push(image);
                        }
                    } catch (imageError) {
                        Logger.log('خطأ في رفع صورة الملاحظة: ' + imageError.toString());
                        processedImages.push(image);
                    }
                } else {
                    processedImages.push(image);
                }
            }
            // ✅ لا تستخدم JSON - دع toSheetCellValue_() تتعامل معها
            observationData.images = processedImages;
        }
        
        const result = appendToSheet(sheetName, observationData);

        if (result.success && String(observationData.workflowStage || '') === 'pending_specialist') {
            try {
                notifyObservationWorkflowEmails('new_pending_specialist', observationData, []);
            } catch (notifyErr) {
                Logger.log('notifyObservationWorkflowEmails new: ' + notifyErr.toString());
            }
        }
        
        // إنشاء إجراء تلقائي في Action Tracking إذا كان هناك إجراء تصحيحي
        if (result.success && observationData.correctiveAction) {
            try {
                createActionFromModule('Observations', observationData.id || '', {
                    date: observationData.date || '',
                    description: observationData.description || observationData.observation || '',
                    correctiveAction: observationData.correctiveAction,
                    department: observationData.department || '',
                    location: observationData.location || '',
                    supervisor: observationData.supervisor || '',
                    createdBy: observationData.createdBy || 'System',
                    ...observationData
                });
            } catch (error) {
                Logger.log('Error creating auto action from observation: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addObservationToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الملاحظة: ' + error.toString() };
    }
}

/**
 * ============================================
 * تحديث ملاحظة يومية
 * ============================================
 *
 * @param {String} observationId - معرف الملاحظة
 * @param {Object} updateData - البيانات المحدثة
 * @returns {Object} نتيجة العملية
 */
function updateObservation(observationId, updateData) {
    try {
        if (!observationId) {
            return { success: false, message: 'معرف الملاحظة غير محدد' };
        }

        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const observationIndex = data.findIndex(o => o.id === observationId);

        if (observationIndex === -1) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }

        // عدم تغيير id أبداً — الاحتفاظ بالمعرف المسجل كما هو
        if (updateData.hasOwnProperty('id')) delete updateData.id;
        
        // معالجة الصور المرفعة بعد التنفيذ
        if (updateData.afterExecutionImages && Array.isArray(updateData.afterExecutionImages)) {
            const processedImages = [];
            for (let i = 0; i < updateData.afterExecutionImages.length; i++) {
                const image = updateData.afterExecutionImages[i];
                if (typeof image === 'string' && image.startsWith('data:')) {
                    try {
                        const uploadResult = uploadFileToDrive(
                            image,
                            'after_execution_' + observationId + '_' + Date.now() + '_' + i + '.jpg',
                            'image/jpeg',
                            'DailyObservations/AfterExecution'
                        );
                        if (uploadResult && uploadResult.success) {
                            processedImages.push({
                                url: uploadResult.shareableLink || uploadResult.directLink,
                                uploadedAt: new Date().toISOString(),
                                uploadedBy: updateData.updatedBy || 'System'
                            });
                        } else {
                            processedImages.push(image);
                        }
                    } catch (imageError) {
                        Logger.log('خطأ في رفع صورة بعد التنفيذ: ' + imageError.toString());
                        processedImages.push(image);
                    }
                } else if (typeof image === 'object') {
                    // صورة موجودة مسبقاً
                    processedImages.push(image);
                }
            }
            updateData.afterExecutionImages = processedImages;
        }
        
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[observationIndex][key] = updateData[key];
            }
        }

        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating observation: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الملاحظة: ' + error.toString() };
    }
}

/**
 * ============================================
 * الحصول على ملاحظة محددة
 * ============================================
 * 
 * @param {String} observationId - معرف الملاحظة
 * @returns {Object} نتيجة العملية مع بيانات الملاحظة
 */
function getObservation(observationId) {
    try {
        if (!observationId) {
            return { success: false, message: 'معرف الملاحظة غير محدد' };
        }
        
        const sheetName = 'DailyObservations';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const observation = data.find(o => o.id === observationId);
        
        if (!observation) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }
        
        return { success: true, data: observation };
    } catch (error) {
        Logger.log('Error getting observation: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الملاحظة: ' + error.toString() };
    }
}

/**
 * ============================================
 * الحصول على جميع الملاحظات
 * ============================================
 * 
 * @param {Object} filters - فلاتر البحث (اختياري)
 * @param {String} filters.supervisor - المشرف
 * @param {String} filters.observationType - نوع الملاحظة
 * @param {String} filters.status - الحالة
 * @param {String} filters.department - الإدارة
 * @param {Date} filters.startDate - تاريخ البداية
 * @param {Date} filters.endDate - تاريخ النهاية
 * @returns {Object} نتيجة العملية مع قائمة الملاحظات
 */
function getAllObservations(filters = {}) {
    try {
        const sheetName = 'DailyObservations';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.supervisor) {
            data = data.filter(o => o.supervisor === filters.supervisor);
        }
        if (filters.observationType) {
            data = data.filter(o => o.observationType === filters.observationType);
        }
        if (filters.status) {
            data = data.filter(o => o.status === filters.status);
        }
        if (filters.department) {
            data = data.filter(o => o.department === filters.department);
        }
        if (filters.startDate) {
            data = data.filter(o => {
                if (!o.date) return false;
                return new Date(o.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(o => {
                if (!o.date) return false;
                return new Date(o.date) <= new Date(filters.endDate);
            });
        }
        
        // دالة مساعدة لاستخراج الرقم من رقم الملاحظة للترتيب
        const extractObservationNumber = (isoCode) => {
            if (!isoCode) return 0;
            const match = String(isoCode).match(/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        };
        
        // ترتيب حسب رقم الملاحظة من الأقدم للأحدث
        data.sort((a, b) => {
            const numA = extractObservationNumber(a.isoCode);
            const numB = extractObservationNumber(b.isoCode);
            return numA - numB;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all observations: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الملاحظات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * حذف ملاحظة
 * ============================================
 * 
 * @param {String} observationId - معرف الملاحظة
 * @returns {Object} نتيجة العملية
 */
function deleteObservation(observationId) {
    try {
        if (!observationId) {
            return { success: false, message: 'معرف الملاحظة غير محدد' };
        }
        
        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(o => o.id !== observationId);
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }
        
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting observation: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الملاحظة: ' + error.toString() };
    }
}

/**
 * ============================================
 * حذف جميع الملاحظات
 * ============================================
 * 
 * @returns {Object} نتيجة العملية
 */
function deleteAllObservations() {
    try {
        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        
        // حفظ مصفوفة فارغة (سيحذف جميع البيانات)
        const result = saveToSheet(sheetName, [], spreadsheetId);
        
        if (result.success) {
            return { success: true, message: 'تم حذف جميع الملاحظات بنجاح' };
        } else {
            return { success: false, message: result.message || 'فشل حذف جميع الملاحظات' };
        }
    } catch (error) {
        Logger.log('Error in deleteAllObservations: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف جميع الملاحظات: ' + error.toString() };
    }
}

/**
 * ============================================
 * الحصول على إحصائيات الملاحظات
 * ============================================
 * 
 * @param {Object} filters - فلاتر البحث (اختياري)
 * @returns {Object} نتيجة العملية مع الإحصائيات
 */
function getObservationStatistics(filters = {}) {
    try {
        const allObservations = getAllObservations(filters);
        if (!allObservations.success) {
            return { success: false, message: 'فشل في قراءة الملاحظات' };
        }
        
        const observations = allObservations.data;
        const stats = {
            total: observations.length,
            byType: {},
            byStatus: {},
            bySupervisor: {},
            byDepartment: {},
            withCorrectiveAction: 0,
            trend: 'stable'
        };
        
        observations.forEach(obs => {
            // حسب النوع
            const type = obs.observationType || 'Unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // حسب الحالة
            const status = obs.status || 'Unknown';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            
            // حسب المشرف
            if (obs.supervisor) {
                stats.bySupervisor[obs.supervisor] = (stats.bySupervisor[obs.supervisor] || 0) + 1;
            }
            
            // حسب الإدارة
            if (obs.department) {
                stats.byDepartment[obs.department] = (stats.byDepartment[obs.department] || 0) + 1;
            }
            
            // مع إجراء تصحيحي
            if (obs.correctiveAction) {
                stats.withCorrectiveAction++;
            }
        });
        
        // حساب الاتجاه
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const recent = observations.filter(obs => {
            if (!obs.date) return false;
            return new Date(obs.date) >= threeMonthsAgo;
        });
        const older = observations.filter(obs => {
            if (!obs.date) return false;
            const obsDate = new Date(obs.date);
            return obsDate < threeMonthsAgo && obsDate >= new Date(now.getFullYear(), now.getMonth() - 6, 1);
        });
        
        if (recent.length > older.length * 1.2) {
            stats.trend = 'increasing';
        } else if (recent.length < older.length * 0.8) {
            stats.trend = 'decreasing';
        }
        
        return { success: true, data: stats };
    } catch (error) {
        Logger.log('Error getting observation statistics: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حساب الإحصائيات: ' + error.toString() };
    }
}

/**
 * ============================================
 * إدارة Template ID لتصدير PPT
 * ============================================
 */

/**
 * ضبط Template ID لتصدير PPT للملاحظات اليومية
 * 
 * @param {string|Object} templateIdOrPayload - File ID لملف Google Slides Template أو payload يحتوي على templateId
 * @returns {Object} نتيجة العملية
 */
function setDailyObservationsPptTemplateId(templateIdOrPayload) {
    try {
        let templateId;
        if (typeof templateIdOrPayload === 'string') {
            templateId = templateIdOrPayload;
        } else if (templateIdOrPayload && typeof templateIdOrPayload === 'object') {
            templateId = templateIdOrPayload.templateId || templateIdOrPayload.templateID || templateIdOrPayload.id;
        }
        
        if (!templateId || typeof templateId !== 'string' || templateId.trim() === '') {
            return { success: false, message: 'يرجى تحديد Template ID صحيح.' };
        }
        
        templateId = templateId.trim();
        
        // التحقق من صحة Template ID بمحاولة الوصول للملف
        try {
            const templateFile = DriveApp.getFileById(templateId);
            const mimeType = templateFile.getMimeType();
            if (mimeType !== 'application/vnd.google-apps.presentation') {
                return { 
                    success: false, 
                    message: 'الملف المحدد ليس ملف Google Slides. يرجى تحديد ملف Google Slides Template.' 
                };
            }
        } catch (fileError) {
            return { 
                success: false, 
                message: 'لا يمكن الوصول للملف المحدد. تأكد من صحة Template ID وصلاحيات الوصول.' 
            };
        }
        
        // حفظ في Script Properties
        const props = PropertiesService.getScriptProperties();
        props.setProperty('DAILY_OBSERVATIONS_PPT_TEMPLATE_ID', templateId);
        
        return { 
            success: true, 
            message: 'تم ضبط Template ID بنجاح.',
            templateId: templateId
        };
    } catch (error) {
        Logger.log('Error in setDailyObservationsPptTemplateId: ' + error.toString());
        return { 
            success: false, 
            message: 'حدث خطأ أثناء ضبط Template ID: ' + error.toString() 
        };
    }
}

/**
 * الحصول على Template ID الحالي لتصدير PPT
 * 
 * @returns {Object} Template ID الحالي
 */
function getDailyObservationsPptTemplateId() {
    try {
        const props = PropertiesService.getScriptProperties();
        const templateId = String(props.getProperty('DAILY_OBSERVATIONS_PPT_TEMPLATE_ID') || '').trim();
        
        if (!templateId) {
            return { 
                success: false, 
                message: 'لم يتم ضبط Template ID بعد.',
                templateId: null
            };
        }
        
        // التحقق من صحة Template ID
        try {
            const templateFile = DriveApp.getFileById(templateId);
            return { 
                success: true, 
                templateId: templateId,
                fileName: templateFile.getName(),
                fileUrl: templateFile.getUrl()
            };
        } catch (fileError) {
            return { 
                success: false, 
                message: 'Template ID غير صحيح أو لا يمكن الوصول للملف.',
                templateId: templateId
            };
        }
    } catch (error) {
        Logger.log('Error in getDailyObservationsPptTemplateId: ' + error.toString());
        return { 
            success: false, 
            message: 'حدث خطأ أثناء قراءة Template ID: ' + error.toString(),
            templateId: null
        };
    }
}

/**
 * ============================================
 * تصدير تقرير الملاحظات اليومية إلى PowerPoint (PPTX)
 * ============================================
 *
 * يعتمد على Template في Google Slides يحتوي على 3 شرائح:
 * 1) شريحة الغلاف (ثابتة): تحتوي Placeholders:
 *    - {{DEPARTMENT}}
 *    - {{REPORT_DATE}}
 * 2) شريحة الملاحظة (Template): سيتم تكرارها لكل ملاحظة وتعبئة Placeholders:
 *    - {{OBS_NO}}
 *    - {{ISO_CODE}}
 *    - {{OBS_DATE}}
 *    - {{OBS_LOCATION}}
 *    - {{OBS_TYPE}}
 *    - {{OBS_DETAILS}}
 *    - {{CORRECTIVE_ACTION}}
 *    - {{RISK_LEVEL}}
 *    - {{TARGET_DATE}}
 *    - {{RESPONSIBLE}}
 *    - {{STATUS}}
 *    - (اختياري) {{SHIFT}}, {{OBSERVER}}
 *
 * صورة الملاحظة:
 * - ضع عنصر Shape (مستطيل/نص) في الشريحة الثانية واجعل Title أو Description = OBS_IMAGE
 * - سيتم استبداله بصورة الملاحظة (إذا وُجدت).
 *
 * الإعدادات عبر Script Properties:
 * - DAILY_OBSERVATIONS_PPT_TEMPLATE_ID: (مطلوب) File ID لعرض Google Slides Template
 * - REPORTS_OUTPUT_FOLDER_ID: (اختياري) Folder ID لحفظ الملفات الناتجة
 * 
 * يمكن تمرير templateId في payload كبديل لـ Script Properties
 */
function exportDailyObservationsPptReport(payload) {
    try {
        payload = payload || {};
        const department = String(payload.department || payload.departmentName || '').trim();
        const reportDate = payload.reportDate ? new Date(payload.reportDate) : new Date();
        const observations = Array.isArray(payload.observations) ? payload.observations : [];

        if (!department) {
            return { success: false, message: 'يرجى تحديد الإدارة قبل التصدير.' };
        }
        if (observations.length === 0) {
            return { success: false, message: 'لا توجد ملاحظات لتصديرها لهذه الإدارة.' };
        }

        // الحصول على Template ID من payload أولاً، ثم من Script Properties
        const props = PropertiesService.getScriptProperties();
        let templateId = String(payload.templateId || payload.templateID || '').trim();
        if (!templateId) {
            templateId = String(props.getProperty('DAILY_OBSERVATIONS_PPT_TEMPLATE_ID') || '').trim();
        }
        
        if (!templateId) {
            return {
                success: false,
                message: 'لم يتم ضبط Template ID. يرجى إضافة DAILY_OBSERVATIONS_PPT_TEMPLATE_ID في Script Properties أو تمرير templateId في payload.\n\n' +
                         'لضبط Script Properties:\n' +
                         '1. افتح Google Apps Script Editor\n' +
                         '2. اذهب إلى Project Settings > Script Properties\n' +
                         '3. أضف خاصية جديدة:\n' +
                         '   Key: DAILY_OBSERVATIONS_PPT_TEMPLATE_ID\n' +
                         '   Value: [File ID من Google Slides Template]\n\n' +
                         'أو استخدم دالة setDailyObservationsPptTemplateId(templateId) لضبطها برمجياً.'
            };
        }

        const outputFolderId = String(props.getProperty('REPORTS_OUTPUT_FOLDER_ID') || '').trim();
        const outputFolder = outputFolderId ? DriveApp.getFolderById(outputFolderId) : null;

        const tz = Session.getScriptTimeZone();
        const dateLabel = Utilities.formatDate(reportDate, tz, 'yyyy-MM-dd');
        const safeDept = department.replace(/[\\\/:*?"<>|]/g, '-');
        const baseName = 'Daily_Observations_' + safeDept + '_' + dateLabel;

        // نسخ الـ Template
        const templateFile = DriveApp.getFileById(templateId);
        const copiedFile = outputFolder
            ? templateFile.makeCopy(baseName + '_TEMPLATE_COPY', outputFolder)
            : templateFile.makeCopy(baseName + '_TEMPLATE_COPY');

        const presId = copiedFile.getId();
        const presentation = SlidesApp.openById(presId);

        const slides = presentation.getSlides();
        if (!slides || slides.length < 3) {
            return { success: false, message: 'Template غير صالح: يجب أن يحتوي على 3 شرائح على الأقل.' };
        }

        const coverSlide = slides[0];
        const itemTemplateSlide = slides[1];
        // الشريحة الأخيرة ثابتة (نتركها كما هي)

        // تعبئة الغلاف
        _dob_replaceAllTextSafe_(presentation, coverSlide, {
            '{{DEPARTMENT}}': department,
            '{{REPORT_DATE}}': dateLabel
        });

        // تجهيز شرائح الملاحظات
        // استخدم الشريحة الثانية لأول ملاحظة ثم كررها للباقي
        observations.forEach(function (obs, idx) {
            const slide = (idx === 0) ? itemTemplateSlide : itemTemplateSlide.duplicate();
            const obsNo = String(idx + 1);
            const obsDate = _dob_formatDateTimeSafe_(obs.date, tz);
            const location = _dob_joinLocation_(obs.siteName, obs.locationName);
            const targetDate = _dob_formatDateSafe_(obs.expectedCompletionDate, tz);

            _dob_replaceAllTextSafe_(presentation, slide, {
                '{{OBS_NO}}': obsNo,
                '{{ISO_CODE}}': String(obs.isoCode || ''),
                '{{OBS_DATE}}': obsDate,
                '{{OBS_LOCATION}}': location,
                '{{OBS_TYPE}}': String(obs.observationType || ''),
                '{{OBS_DETAILS}}': String(obs.details || ''),
                '{{CORRECTIVE_ACTION}}': String(obs.correctiveAction || ''),
                '{{RISK_LEVEL}}': String(obs.riskLevel || ''),
                '{{TARGET_DATE}}': targetDate,
                '{{RESPONSIBLE}}': String(obs.responsibleDepartment || ''),
                '{{STATUS}}': String(obs.status || ''),
                '{{SHIFT}}': String(obs.shift || ''),
                '{{OBSERVER}}': String(obs.observerName || '')
            });

            // الصورة
            const imageUrl = String(obs.imageUrl || '').trim();
            if (imageUrl) {
                try {
                    const blob = _dob_getImageBlobFromUrl_(imageUrl);
                    if (blob) {
                        _dob_replaceImagePlaceholder_(slide, blob);
                    }
                } catch (imgErr) {
                    Logger.log('PPT Export: failed to insert image for obs ' + obsNo + ': ' + imgErr);
                }
            }
        });

        presentation.saveAndClose();

        // تصدير كـ PPTX
        const pptBlob = DriveApp.getFileById(presId).getAs(MimeType.MICROSOFT_POWERPOINT);
        pptBlob.setName(baseName + '.pptx');

        const pptFile = outputFolder ? outputFolder.createFile(pptBlob) : DriveApp.createFile(pptBlob);
        try {
            pptFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
            Logger.log('PPT Export: sharing failed: ' + shareErr);
        }

        const fileId = pptFile.getId();
        return {
            success: true,
            fileId: fileId,
            fileName: pptFile.getName(),
            viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId
        };
    } catch (error) {
        Logger.log('Error in exportDailyObservationsPptReport: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إنشاء تقرير PPT: ' + error.toString() };
    }
}

function _dob_replaceAllTextSafe_(presentation, slide, replacements) {
    if (!replacements) return;
    Object.keys(replacements).forEach(function (key) {
        const value = replacements[key] === null || replacements[key] === undefined ? '' : String(replacements[key]);
        try {
            if (slide && typeof slide.replaceAllText === 'function') {
                slide.replaceAllText(key, value);
            } else if (presentation && typeof presentation.replaceAllText === 'function') {
                presentation.replaceAllText(key, value);
            }
        } catch (e) {
            // تجاهل - قد تكون الشريحة لا تحتوي على النص
        }
    });
}

function _dob_formatDateTimeSafe_(value, tz) {
    try {
        if (!value) return '';
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return '';
        return Utilities.formatDate(d, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    } catch (e) {
        return '';
    }
}

function _dob_formatDateSafe_(value, tz) {
    try {
        if (!value) return '';
        const d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return '';
        return Utilities.formatDate(d, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) {
        return '';
    }
}

function _dob_joinLocation_(siteName, locationName) {
    const s = String(siteName || '').trim();
    const l = String(locationName || '').trim();
    if (s && l) return s + ' - ' + l;
    return s || l || '';
}

function _dob_extractDriveFileId_(url) {
    if (!url) return '';
    const s = String(url);
    // patterns:
    // - https://drive.google.com/file/d/<ID>/view
    // - https://drive.google.com/uc?export=view&id=<ID>
    // - https://drive.google.com/open?id=<ID>
    const match1 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) return match1[1];
    const match2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2 && match2[1]) return match2[1];
    return '';
}

function _dob_getImageBlobFromUrl_(imageUrl) {
    const fileId = _dob_extractDriveFileId_(imageUrl);
    if (!fileId) return null;
    const file = DriveApp.getFileById(fileId);
    return file ? file.getBlob() : null;
}

function _dob_replaceImagePlaceholder_(slide, imageBlob) {
    if (!slide || !imageBlob) return;

    const elements = slide.getPageElements();
    let placeholder = null;
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        try {
            const title = String(el.getTitle && el.getTitle() ? el.getTitle() : '').trim();
            const desc = String(el.getDescription && el.getDescription() ? el.getDescription() : '').trim();
            if (title === 'OBS_IMAGE' || desc === 'OBS_IMAGE' || title === '{{OBS_IMAGE}}' || desc === '{{OBS_IMAGE}}') {
                placeholder = el;
                break;
            }
            // دعم placeholder كنص داخل shape
            if (el.getPageElementType && el.getPageElementType() === SlidesApp.PageElementType.SHAPE) {
                const txt = el.asShape().getText().asString();
                if (txt && (txt.indexOf('OBS_IMAGE') !== -1 || txt.indexOf('{{OBS_IMAGE}}') !== -1)) {
                    placeholder = el;
                    break;
                }
            }
        } catch (e) {
            // ignore
        }
    }

    if (!placeholder) return;

    const left = placeholder.getLeft();
    const top = placeholder.getTop();
    const width = placeholder.getWidth();
    const height = placeholder.getHeight();

    try {
        placeholder.remove();
    } catch (e) {
        // ignore
    }

    const img = slide.insertImage(imageBlob);
    img.setLeft(left);
    img.setTop(top);
    img.setWidth(width);
    img.setHeight(height);
}

/**
 * ============================================
 * إضافة تعليق على ملاحظة
 * ============================================
 * 
 * @param {String} observationId - معرف الملاحظة
 * @param {Object} commentData - بيانات التعليق
 * @returns {Object} نتيجة العملية
 */
function addObservationComment(observationId, commentData) {
    try {
        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const observationIndex = data.findIndex(o => o.id === observationId);
        
        if (observationIndex === -1) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }
        
        const observation = data[observationIndex];
        
        // ✅ تحليل التعليقات الحالية
        let comments = [];
        try {
            if (Array.isArray(observation.comments)) {
                comments = observation.comments;
            } else if (typeof observation.comments === 'string' && observation.comments) {
                try {
                    comments = JSON.parse(observation.comments);
                } catch (e) {
                    comments = [];
                }
            }
        } catch (e) {
            comments = [];
        }
        
        // إضافة التعليق الجديد
        comments.push({
            id: 'CMT-' + Date.now().toString(),
            user: commentData.user || 'System',
            comment: commentData.comment || '',
            timestamp: new Date().toISOString()
        });
        
        // ✅ حفظ كـ array (بدون JSON.stringify)
        observation.comments = comments;
        observation.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(observation.timeLog)) {
                timeLog = observation.timeLog;
            } else if (typeof observation.timeLog === 'string' && observation.timeLog) {
                try {
                    timeLog = JSON.parse(observation.timeLog);
                } catch (e) {
                    timeLog = [];
                }
            }
        } catch (e) {
            timeLog = [];
        }
        
        timeLog.push({
            action: 'comment_added',
            user: commentData.user || 'System',
            timestamp: new Date().toISOString(),
            roleLabel: 'تعليق',
            actionDetail: 'تم إضافة تعليق على الملاحظة',
            note: 'تعليق: تم إضافة تعليق على الملاحظة'
        });
        
        // ✅ حفظ كـ array
        observation.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, observationId, {
            comments: observation.comments,
            timeLog: observation.timeLog,
            updatedAt: observation.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addObservationComment: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التعليق: ' + error.toString() };
    }
}

/**
 * ============================================
 * إضافة تحديث على ملاحظة
 * ============================================
 * 
 * @param {String} observationId - معرف الملاحظة
 * @param {Object} updateData - بيانات التحديث
 * @returns {Object} نتيجة العملية
 */
function addObservationUpdate(observationId, updateData) {
    try {
        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const observationIndex = data.findIndex(o => o.id === observationId);
        
        if (observationIndex === -1) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }
        
        const observation = data[observationIndex];
        
        // ✅ تحليل التحديثات الحالية
        let updates = [];
        try {
            if (Array.isArray(observation.updates)) {
                updates = observation.updates;
            } else if (typeof observation.updates === 'string' && observation.updates) {
                try {
                    updates = JSON.parse(observation.updates);
                } catch (e) {
                    updates = [];
                }
            }
        } catch (e) {
            updates = [];
        }
        
        // إضافة التحديث الجديد
        updates.push({
            id: 'UPD-' + Date.now().toString(),
            user: updateData.user || 'System',
            update: updateData.update || '',
            progress: updateData.progress || 0,
            timestamp: new Date().toISOString()
        });
        
        // ✅ حفظ كـ array
        observation.updates = updates;
        observation.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(observation.timeLog)) {
                timeLog = observation.timeLog;
            } else if (typeof observation.timeLog === 'string' && observation.timeLog) {
                try {
                    timeLog = JSON.parse(observation.timeLog);
                } catch (e) {
                    timeLog = [];
                }
            }
        } catch (e) {
            timeLog = [];
        }
        
        timeLog.push({
            action: 'update_added',
            user: updateData.user || 'System',
            timestamp: new Date().toISOString(),
            roleLabel: 'تحديث التنفيذ',
            actionDetail: 'تم إضافة تحديث على سير التنفيذ',
            note: 'تحديث التنفيذ: تم إضافة تحديث على سير التنفيذ'
        });
        
        // ✅ حفظ كـ array
        observation.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, observationId, {
            updates: observation.updates,
            timeLog: observation.timeLog,
            updatedAt: observation.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addObservationUpdate: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التحديث: ' + error.toString() };
    }
}

/**
 * ============================================
 * تحديث حالة ملاحظة
 * ============================================
 * 
 * @param {String} observationId - معرف الملاحظة
 * @param {Object} statusData - بيانات الحالة (status, updatedBy)
 * @returns {Object} نتيجة العملية
 */
function updateObservationStatus(observationId, statusData) {
    try {
        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const observationIndex = data.findIndex(o => o.id === observationId);
        
        if (observationIndex === -1) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }
        
        const observation = data[observationIndex];
        const oldStatus = observation.status || '';
        const newStatus = statusData.status || oldStatus;
        
        // تحديث الحالة
        observation.status = newStatus;
        observation.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(observation.timeLog)) {
                timeLog = observation.timeLog;
            } else if (typeof observation.timeLog === 'string' && observation.timeLog) {
                try {
                    timeLog = JSON.parse(observation.timeLog);
                } catch (e) {
                    timeLog = [];
                }
            }
        } catch (e) {
            timeLog = [];
        }
        
        // إضافة سجل تغيير الحالة
        if (newStatus !== oldStatus) {
            timeLog.push({
                action: 'status_changed',
                user: statusData.updatedBy || statusData.user || 'System',
                timestamp: new Date().toISOString(),
                roleLabel: 'تغيير الحالة',
                actionDetail: 'من ' + String(oldStatus || '—') + ' إلى ' + String(newStatus || '—'),
                note: 'تغيير الحالة: من ' + String(oldStatus || '—') + ' إلى ' + String(newStatus || '—'),
                oldStatus: oldStatus,
                newStatus: newStatus
            });
        }
        
        // ✅ حفظ كـ array
        observation.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, observationId, {
            status: observation.status,
            timeLog: observation.timeLog,
            updatedAt: observation.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateObservationStatus: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الحالة: ' + error.toString() };
    }
}

// ===== سير اعتماد الملاحظات + فلترة حسب المستخدم + بريد =====

/**
 * تطبيع اسم إدارة للمقارنة
 */
function _dobNormalizeDept_(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * تحليل حقل permissions للمستخدم (JSON)
 */
function _dobParseUserPermissions_(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(String(raw));
    } catch (e) {
        return {};
    }
}

/**
 * هل يملك المستخدم صلاحية تفصيلية في مديول الملاحظات؟
 */
function _dobUserHasDailyObsDetail_(perms, key) {
    const p = perms || {};
    const nested = p['daily-observationsPermissions'] || p['dailyObservationsPermissions'] || {};
    return nested[key] === true;
}

/**
 * جمع بريد المستخدمين النشطين الذين لديهم مفتاح صلاحية تفصيلي
 */
function getActiveUserEmailsWithDailyObsPermission(permissionKey) {
    try {
        const key = String(permissionKey || '').trim();
        if (!key) return [];
        const users = readFromSheet('Users', getSpreadsheetId()) || [];
        const emails = [];
        const seen = {};
        users.forEach(function (u) {
            if (!u || u.active === false || u.active === 'false') return;
            const email = String(u.email || '').trim();
            if (!email || seen[email]) return;
            const perms = _dobParseUserPermissions_(u.permissions);
            if (_dobUserHasDailyObsDetail_(perms, key)) {
                seen[email] = true;
                emails.push(email);
            }
        });
        return emails;
    } catch (e) {
        Logger.log('getActiveUserEmailsWithDailyObsPermission: ' + e.toString());
        return [];
    }
}

/**
 * بريد مستخدمي إدارة معيّنة (حقل department في Users)
 */
function getActiveUserEmailsByDepartment(departmentName) {
    const target = _dobNormalizeDept_(departmentName);
    if (!target) return [];
    try {
        const users = readFromSheet('Users', getSpreadsheetId()) || [];
        const emails = [];
        const seen = {};
        users.forEach(function (u) {
            if (!u || u.active === false || u.active === 'false') return;
            const email = String(u.email || '').trim();
            if (!email || seen[email]) return;
            if (_dobNormalizeDept_(u.department) === target) {
                seen[email] = true;
                emails.push(email);
            }
        });
        return emails;
    } catch (e) {
        Logger.log('getActiveUserEmailsByDepartment: ' + e.toString());
        return [];
    }
}

/**
 * بريد المستخدمين النشطين حسب role (مثل safety_officer)
 */
function getActiveUserEmailsByRole(roleName) {
    const target = String(roleName || '').toLowerCase().trim();
    if (!target) return [];
    try {
        const users = readFromSheet('Users', getSpreadsheetId()) || [];
        const emails = [];
        const seen = {};
        users.forEach(function (u) {
            if (!u || u.active === false || u.active === 'false') return;
            const email = String(u.email || '').trim();
            if (!email || seen[email]) return;
            if (String(u.role || '').toLowerCase() === target) {
                seen[email] = true;
                emails.push(email);
            }
        });
        return emails;
    } catch (e) {
        Logger.log('getActiveUserEmailsByRole: ' + e.toString());
        return [];
    }
}

/**
 * إشعارات داخل التطبيق (ورقة Notifications) لنفس مستلمي البريد عندما يكون userId = البريد
 */
function _dobPushInAppForEmails_(emails, title, message, relatedObservationId) {
    if (!emails || !emails.length) return;
    var rid = String(relatedObservationId || '').trim();
    var msg = String(message || '').slice(0, 2000);
    var ttl = String(title || '').slice(0, 200);
    emails.forEach(function (e) {
        var uid = String(e || '').trim();
        if (!uid || uid.indexOf('@') === -1) return;
        try {
            addNotification({
                userId: uid,
                type: 'daily_observation',
                priority: 'medium',
                title: ttl,
                message: msg,
                relatedId: rid,
                relatedType: 'DailyObservation',
                read: false
            });
        } catch (err) {
            Logger.log('_dobPushInAppForEmails_: ' + err.toString());
        }
    });
}

/**
 * رسالة بريد لحدث سير العمل (لا يوقف العملية عند الفشل)
 */
function _dobSendWorkflowEmail_(toList, subject, body) {
    const recipients = (toList || []).filter(function (e) {
        return e && String(e).indexOf('@') !== -1;
    });
    if (recipients.length === 0) return;
    const subj = '[HSE — ملاحظات] ' + String(subject || '').slice(0, 200);
    const text = String(body || '');
    recipients.forEach(function (email) {
        try {
            MailApp.sendEmail({
                to: email,
                subject: subj,
                body: text
            });
        } catch (mailErr) {
            Logger.log('MailApp.sendEmail failed for ' + email + ': ' + mailErr.toString());
        }
    });
}

/**
 * إشعار بريد حسب مرحلة / حدث
 */
function notifyObservationWorkflowEmails(eventKey, observation, extraEmails) {
    const obs = observation || {};
    const id = String(obs.isoCode || obs.id || '');
    const dept = String(obs.responsibleDepartment || '');
    const detailsShort = String(obs.details || '').slice(0, 280);
    const base = 'رقم الملاحظة: ' + id + '\nالإدارة المسؤولة: ' + dept + '\nالمرحلة: ' + String(obs.workflowStage || '') + '\n\n' + detailsShort;

    const merge = function (a, b) {
        const m = {};
        (a || []).concat(b || []).forEach(function (e) {
            const x = String(e || '').trim();
            if (x) m[x] = true;
        });
        return Object.keys(m);
    };

    if (eventKey === 'new_pending_specialist') {
        const to = merge(
            merge(
                getActiveUserEmailsWithDailyObsPermission('observations-specialist-review'),
                getActiveUserEmailsByRole('safety_officer')
            ),
            extraEmails
        );
        _dobSendWorkflowEmail_(to, 'ملاحظة جديدة بانتظار مراجعة مسؤول السلامة (أخصائي)', base);
        _dobPushInAppForEmails_(to, 'ملاحظة جديدة — بانتظار السلامة', base, obs.id);
    } else if (eventKey === 'pending_manager') {
        const to = merge(getActiveUserEmailsWithDailyObsPermission('observations-manager-approve'), extraEmails);
        _dobSendWorkflowEmail_(to, 'ملاحظة بانتظار اعتماد مدير السلامة', base);
        _dobPushInAppForEmails_(to, 'ملاحظة بانتظار اعتماد مدير السلامة', base, obs.id);
    } else if (eventKey === 'pending_department') {
        const to = merge(getActiveUserEmailsByDepartment(dept), extraEmails);
        _dobSendWorkflowEmail_(to, 'تسجيل ملاحظة تتطلب إجراءً من إدارتكم', base);
        _dobPushInAppForEmails_(to, 'ملاحظة تتطلب إجراءً من إدارتكم', base, obs.id);
    } else if (eventKey === 'department_update_from_safety') {
        const to = merge(getActiveUserEmailsByDepartment(dept), [obs.assignedToEmail], extraEmails);
        var bodyExtra = base + '\n\nتم تسجيل إجراء من إدارة السلامة.\nالإجراء التصحيحي: ' + String(obs.correctiveAction || '').slice(0, 280);
        _dobSendWorkflowEmail_(to, 'تحديث ملاحظة من إدارة السلامة', bodyExtra);
        _dobPushInAppForEmails_(to, 'تحديث ملاحظة من السلامة', bodyExtra, obs.id);
    } else if (eventKey === 'rejected_or_return') {
        const to = merge([], [obs.submittedByEmail], extraEmails);
        const spec = getActiveUserEmailsWithDailyObsPermission('observations-specialist-review');
        var finalTo = merge(to, spec);
        var subj = 'تحديث على ملاحظة (رفض أو إرجاع)';
        var bodyFull = base + '\n\nالسبب: ' + String(obs.rejectionReason || '');
        _dobSendWorkflowEmail_(finalTo, subj, bodyFull);
        _dobPushInAppForEmails_(finalTo, subj, bodyFull, obs.id);
    } else if (eventKey === 'closed') {
        const to = merge([obs.submittedByEmail], getActiveUserEmailsByDepartment(dept), extraEmails);
        _dobSendWorkflowEmail_(to, 'تم إغلاق ملاحظة', base);
        _dobPushInAppForEmails_(to, 'تم إغلاق ملاحظة', base, obs.id);
    }
}

/**
 * هل السياق يسمح برؤية جميع الملاحظات؟
 */
function _dobContextCanViewAll_(ctx) {
    if (!ctx) return true;
    const role = String(ctx.role || '').toLowerCase();
    if (role === 'admin') return true;
    if (role === 'safety_officer') return true;
    const perms = ctx.dailyObservationsPermissions || ctx['daily-observationsPermissions'] || {};
    if (perms['observations-specialist-review'] === true) return true;
    if (perms['observations-manager-approve'] === true) return true;
    if (perms['observations-view-all'] === true) return true;
    return false;
}

/**
 * فلترة صفوف DailyObservations حسب مستخدم الطلب (يُستدعى من readFromSheet)
 */
function filterDailyObservationsForRequestContext(rows, ctx) {
    if (!Array.isArray(rows)) return [];
    if (!ctx || _dobContextCanViewAll_(ctx)) {
        return rows;
    }

    const perms = ctx.dailyObservationsPermissions || ctx['daily-observationsPermissions'] || {};
    var deptScope = perms['observations-view-department'] !== false;

    const userDept = _dobNormalizeDept_(ctx.department);
    const userEmail = String((ctx.email || ctx.userEmail || '')).trim().toLowerCase();
    const userName = String((ctx.name || ctx.userName || '')).trim().toLowerCase();

    return rows.filter(function (obs) {
        if (!obs) return false;
        const stage = String(obs.workflowStage || '').trim();
        const resp = _dobNormalizeDept_(obs.responsibleDepartment);
        const subEmail = String(obs.submittedByEmail || '').trim().toLowerCase();
        const observer = String(obs.observerName || '').trim().toLowerCase();

        const isSubmitter = (userEmail && subEmail && userEmail === subEmail) ||
            (userName && observer && userName === observer);

        // بيانات قديمة بلا workflowStage: نعرض للإدارة إن طابقت المسؤولية
        if (!stage) {
            if (isSubmitter) return true;
            if (deptScope && userDept && resp && userDept === resp) return true;
            return false;
        }

        if (isSubmitter) return true;

        const early = (stage === 'pending_specialist' || stage === 'pending_manager' || stage === 'returned_specialist');
        if (early) return false;

        if (deptScope && userDept && resp && userDept === resp) {
            return (
                stage === 'pending_department' ||
                stage === 'in_progress' ||
                stage === 'closed' ||
                stage === 'rejected'
            );
        }
        return false;
    });
}

/**
 * دفع سجل في timeLog
 */
function _dobAppendTimeLog_(observation, entry) {
    var timeLog = [];
    try {
        if (Array.isArray(observation.timeLog)) {
            timeLog = observation.timeLog;
        } else if (typeof observation.timeLog === 'string' && observation.timeLog) {
            timeLog = JSON.parse(observation.timeLog);
        }
    } catch (e) {
        timeLog = [];
    }
    timeLog.push(entry);
    observation.timeLog = timeLog;
}

/** تطبيع دور الممثل: يدعم admin ومدير النظام ومسئول السلامة كما في الجدول */
function _dobActorIsAdmin_(roleRaw) {
    var r0 = String(roleRaw || '').trim();
    var s = r0.toLowerCase();
    return s === 'admin' || s === 'system_admin' || r0 === 'مدير النظام' || r0 === 'مدير';
}

function _dobActorIsSafetyOfficer_(roleRaw) {
    var r0 = String(roleRaw || '').trim();
    var s = r0.toLowerCase();
    return s === 'safety_officer' || r0 === 'مسئول السلامة' || r0 === 'مسؤول السلامة';
}

/**
 * انتقال مرحلة سير اعتماد الملاحظة
 * payload: { observationId, action, comments, rejectionReason, correctiveAction, expectedCompletionDate,
 *   actor: { name, email, role, dailyObservationsPermissions } }
 */
function transitionObservationWorkflow(payload) {
    try {
        payload = payload || {};
        const observationId = payload.observationId || payload.id;
        if (!observationId) {
            return { success: false, message: 'معرف الملاحظة غير محدد' };
        }
        const action = String(payload.action || '').trim();
        const actor = payload.actor || {};
        const actorName = String(actor.name || 'System');
        const actorEmail = String(actor.email || '');
        var roleRaw = String(actor.role || '').trim();
        var isAdminUser = _dobActorIsAdmin_(roleRaw);
        var isSafetyOfficerUser = _dobActorIsSafetyOfficer_(roleRaw);
        const perms = actor.dailyObservationsPermissions || {};

        const sheetName = 'DailyObservations';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        const idx = data.findIndex(function (o) { return o.id === observationId; });
        if (idx === -1) {
            return { success: false, message: 'الملاحظة غير موجودة' };
        }
        var obs = data[idx];
        var stage = String(obs.workflowStage || '').trim() || 'pending_specialist';

        var comments = String(payload.comments || '').trim();
        var rejectionReason = String(payload.rejectionReason || '').trim();

        // مسؤول السلامة (أخصائي) = safety_officer | مدير السلامة = مدير النظام (admin) | صلاحيات تفصيلية
        var hasSpecialist = isAdminUser || isSafetyOfficerUser || perms['observations-specialist-review'] === true;
        var hasManager = isAdminUser || perms['observations-manager-approve'] === true;
        var hasDept = _dobNormalizeDept_(actor.department) === _dobNormalizeDept_(obs.responsibleDepartment);

        var nowIso = new Date().toISOString();
        var updates = {};

        function fail(msg) {
            return { success: false, message: msg };
        }

        if (action === 'assign_responsible') {
            var aName = String(payload.assignedToName || '').trim();
            var aEmail = String(payload.assignedToEmail || '').trim();
            if (!aName) return fail('يرجى إدخال اسم المسؤول المعيّن');
            var specialistStages = (stage === 'pending_specialist' || stage === 'returned_specialist' || stage === 'pending_manager');
            var deptStages = (stage === 'pending_department' || stage === 'in_progress');
            var canSpec = hasSpecialist && specialistStages;
            var canDept = (hasDept || isAdminUser) && deptStages;
            if (!(isAdminUser || canSpec || canDept)) {
                return fail('لا صلاحية لتعيين المسؤول في هذه المرحلة');
            }
            obs.assignedToName = aName;
            obs.assignedToEmail = aEmail;
            _dobAppendTimeLog_(obs, {
                action: 'assign_responsible',
                user: actorName,
                timestamp: nowIso,
                roleLabel: 'تعيين المتابعة',
                actionDetail: 'المعيّن: ' + aName + (aEmail ? ' — ' + aEmail : ''),
                note: 'تعيين المتابعة: المعيّن: ' + aName + (aEmail ? ' — ' + aEmail : '')
            });
            if (aEmail) {
                var baseLocal = 'رقم الملاحظة: ' + String(obs.isoCode || obs.id || '') + '\nالإدارة: ' + String(obs.responsibleDepartment || '') + '\n' + String(obs.details || '').slice(0, 280);
                _dobSendWorkflowEmail_([aEmail], 'تعيينكم مسؤولاً عن متابعة ملاحظة', baseLocal + '\n\nالمعيّن: ' + aName);
                _dobPushInAppForEmails_([aEmail], 'تعيينكم مسؤولاً عن متابعة ملاحظة', baseLocal + '\n\nالمعيّن: ' + aName, obs.id);
            }
        } else if (action === 'specialist_forward') {
            if (!hasSpecialist) return fail('لا صلاحية لمراجعة مسؤول السلامة (أخصائي)');
            if (stage !== 'pending_specialist' && stage !== 'returned_specialist') {
                return fail('المرحلة الحالية لا تسمح بهذا الإجراء');
            }
            var asgN = String(payload.assignedToName != null ? payload.assignedToName : '').trim();
            var asgE = String(payload.assignedToEmail != null ? payload.assignedToEmail : '').trim();
            if (asgN) obs.assignedToName = asgN;
            if (asgE) obs.assignedToEmail = asgE;
            obs.workflowStage = 'pending_manager';
            obs.specialistReviewedBy = actorName;
            obs.specialistReviewedAt = nowIso;
            obs.specialistComments = comments || obs.specialistComments || '';
            _dobAppendTimeLog_(obs, {
                action: 'specialist_forward',
                user: actorName,
                timestamp: nowIso,
                roleLabel: 'أخصائي السلامة',
                actionDetail: 'تمرير لمدير السلامة',
                note: 'أخصائي السلامة: تمرير لمدير السلامة'
            });
            notifyObservationWorkflowEmails('pending_manager', obs, [actorEmail]);
        } else if (action === 'manager_approve') {
            if (!hasManager) return fail('لا صلاحية لاعتماد مدير السلامة (مدير النظام)');
            if (stage !== 'pending_manager') {
                return fail('المرحلة الحالية لا تسمح بالاعتماد');
            }
            var asgN2 = String(payload.assignedToName != null ? payload.assignedToName : '').trim();
            var asgE2 = String(payload.assignedToEmail != null ? payload.assignedToEmail : '').trim();
            if (asgN2) obs.assignedToName = asgN2;
            if (asgE2) obs.assignedToEmail = asgE2;
            obs.workflowStage = 'pending_department';
            obs.managerApprovedBy = actorName;
            obs.managerApprovedAt = nowIso;
            obs.managerComments = comments || obs.managerComments || '';
            obs.rejectionReason = '';
            _dobAppendTimeLog_(obs, {
                action: 'manager_approve',
                user: actorName,
                timestamp: nowIso,
                roleLabel: 'مدير السلامة',
                actionDetail: 'اعتماد وإرسال للإدارة',
                note: 'مدير السلامة: اعتماد وإرسال للإدارة'
            });
            notifyObservationWorkflowEmails('pending_department', obs, [actorEmail]);
        } else if (action === 'manager_reject' || action === 'admin_reject') {
            if (action === 'admin_reject') {
                if (!isAdminUser) return fail('الرفض الإداري لمدير النظام فقط');
                var adminOkStage = (
                    stage === 'pending_manager' ||
                    stage === 'pending_specialist' ||
                    stage === 'returned_specialist' ||
                    stage === 'pending_department' ||
                    stage === 'in_progress'
                );
                if (!adminOkStage) return fail('لا يمكن الرفض في هذه المرحلة');
            } else {
                if (!hasManager) return fail('لا صلاحية لرفض مدير السلامة');
                if (stage !== 'pending_manager') {
                    return fail('الرفض متاح من مدير السلامة في مرحلة بانتظار الاعتماد');
                }
            }
            if (!rejectionReason) return fail('يرجى إدخال سبب الرفض');
            obs.workflowStage = 'rejected';
            obs.rejectionReason = rejectionReason;
            obs.status = 'مغلق';
            _dobAppendTimeLog_(obs, {
                action: 'rejected',
                user: actorName,
                timestamp: nowIso,
                roleLabel: action === 'admin_reject' ? 'مدير النظام' : 'مدير السلامة',
                actionDetail: 'رفض الملاحظة — ' + rejectionReason,
                note: (action === 'admin_reject' ? 'مدير النظام' : 'مدير السلامة') + ': رفض الملاحظة — ' + rejectionReason
            });
            notifyObservationWorkflowEmails('rejected_or_return', obs, [actorEmail]);
        } else if (action === 'manager_return_specialist' || action === 'admin_return_specialist') {
            if (action === 'admin_return_specialist' && !isAdminUser) return fail('إرجاع المدير الإداري لمدير النظام فقط');
            if (!(hasManager || isAdminUser)) return fail('لا صلاحية للإرجاع');
            if (stage !== 'pending_manager') {
                return fail('الإرجاع متاح في مرحلة بانتظار اعتماد مدير السلامة');
            }
            if (!rejectionReason) return fail('يرجى إدخال سبب الإرجاع');
            obs.workflowStage = 'returned_specialist';
            obs.rejectionReason = rejectionReason;
            _dobAppendTimeLog_(obs, {
                action: 'return_specialist',
                user: actorName,
                timestamp: nowIso,
                roleLabel: action === 'admin_return_specialist' ? 'مدير النظام' : 'مدير السلامة',
                actionDetail: 'إرجاع لمسؤول السلامة (أخصائي) — ' + rejectionReason,
                note: (action === 'admin_return_specialist' ? 'مدير النظام' : 'مدير السلامة') + ': إرجاع لمسؤول السلامة (أخصائي) — ' + rejectionReason
            });
            notifyObservationWorkflowEmails('rejected_or_return', obs, [actorEmail]);
        } else if (action === 'department_update') {
            if (!hasDept && !isAdminUser) return fail('فقط إدارة التنفيذ يمكنها تحديث الإجراء');
            if (stage !== 'pending_department' && stage !== 'in_progress') {
                return fail('لا يمكن تحديث الإجراء في هذه المرحلة');
            }
            var corr = String(payload.correctiveAction != null ? payload.correctiveAction : '').trim();
            var exp = payload.expectedCompletionDate ? String(payload.expectedCompletionDate) : '';
            if (!corr) return fail('يرجى إدخال الإجراء التصحيحي');
            if (!exp) return fail('يرجى تحديد تاريخ الإغلاق المتوقع');
            obs.correctiveAction = corr;
            obs.expectedCompletionDate = exp;
            obs.workflowStage = 'in_progress';
            obs.departmentActionBy = actorName;
            obs.departmentActionAt = nowIso;
            obs.status = 'جاري';
            _dobAppendTimeLog_(obs, {
                action: 'department_update',
                user: actorName,
                timestamp: nowIso,
                roleLabel: 'مدير الإدارة',
                actionDetail: 'حفظ الإجراء التصحيحي وموعد الإغلاق',
                note: 'مدير الإدارة: حفظ الإجراء التصحيحي وموعد الإغلاق'
            });
            if (isAdminUser && !hasDept) {
                notifyObservationWorkflowEmails('department_update_from_safety', obs, [actorEmail]);
            }
        } else if (action === 'close_observation') {
            if (!(hasManager || hasSpecialist || isAdminUser)) {
                return fail('لا صلاحية لإغلاق الملاحظة');
            }
            if (stage !== 'in_progress' && stage !== 'pending_department') {
                return fail('لا يمكن الإغلاق في هذه المرحلة');
            }
            obs.workflowStage = 'closed';
            obs.status = 'مغلق';
            _dobAppendTimeLog_(obs, {
                action: 'closed',
                user: actorName,
                timestamp: nowIso,
                roleLabel: 'إدارة السلامة',
                actionDetail: 'إغلاق الملاحظة بعد التنفيذ',
                note: 'إدارة السلامة: إغلاق الملاحظة بعد التنفيذ'
            });
            notifyObservationWorkflowEmails('closed', obs, [actorEmail]);
        } else {
            return fail('إجراء غير معروف');
        }

        obs.updatedAt = nowIso;
        updates = {
            workflowStage: obs.workflowStage,
            specialistReviewedBy: obs.specialistReviewedBy,
            specialistReviewedAt: obs.specialistReviewedAt,
            specialistComments: obs.specialistComments,
            managerApprovedBy: obs.managerApprovedBy,
            managerApprovedAt: obs.managerApprovedAt,
            managerComments: obs.managerComments,
            departmentActionBy: obs.departmentActionBy,
            departmentActionAt: obs.departmentActionAt,
            rejectionReason: obs.rejectionReason,
            correctiveAction: obs.correctiveAction,
            expectedCompletionDate: obs.expectedCompletionDate,
            status: obs.status,
            assignedToName: obs.assignedToName || '',
            assignedToEmail: obs.assignedToEmail || '',
            timeLog: obs.timeLog,
            updatedAt: obs.updatedAt
        };

        var res = updateSingleRowInSheet(sheetName, observationId, updates, spreadsheetId);
        if (res && res.success) {
            return { success: true, message: 'تم تحديث سير الملاحظة', data: obs };
        }
        return res || { success: false, message: 'فشل الحفظ' };
    } catch (error) {
        Logger.log('transitionObservationWorkflow: ' + error.toString());
        return { success: false, message: 'حدث خطأ: ' + error.toString() };
    }
}

/**
 * إشعار بريد لملاحظة موجودة (بعد الحفظ المجمع saveToSheet من الواجهة)
 */
function notifyObservationWorkflowEvent(payload) {
    try {
        payload = payload || {};
        var id = payload.observationId || payload.id;
        var ev = String(payload.event || 'new_pending_specialist');
        if (!id) return { success: false, message: 'معرف الملاحظة غير محدد' };
        var r = getObservation(id);
        if (!r.success || !r.data) return { success: false, message: 'الملاحظة غير موجودة' };
        notifyObservationWorkflowEmails(ev, r.data, []);
        return { success: true };
    } catch (e) {
        Logger.log('notifyObservationWorkflowEvent: ' + e.toString());
        return { success: false, message: e.toString() };
    }
}
