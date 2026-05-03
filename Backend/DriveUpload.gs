/**
 * Google Apps Script for HSE System - Google Drive File Upload
 * 
 * نظام رفع الملفات إلى Google Drive وحفظ الروابط في Google Sheets
 * 
 * الوظيفة:
 * 1. رفع الصور والملفات إلى Google Drive في مجلد مخصص
 * 2. توليد رابط مباشر (Public/Shareable Link) للصورة
 * 3. حفظ الرابط فقط في Google Sheets (بدون تخزين الصورة نفسها)
 */

/**
 * الحصول على أو إنشاء مجلد المرفقات في Google Drive
 * @param {string} folderName - اسم المجلد (افتراضي: "HSE_Attachments")
 * @returns {Folder} مجلد Google Drive
 */
function getOrCreateAttachmentsFolder(folderName = 'HSE_Attachments') {
    try {
        // البحث عن المجلد في Google Drive
        const folders = DriveApp.getFoldersByName(folderName);
        
        if (folders.hasNext()) {
            return folders.next();
        }
        
        // إنشاء مجلد جديد إذا لم يكن موجوداً
        const newFolder = DriveApp.createFolder(folderName);
        Logger.log('تم إنشاء مجلد جديد للمرفقات: ' + folderName);
        return newFolder;
    } catch (error) {
        Logger.log('خطأ في الحصول على مجلد المرفقات: ' + error.toString());
        throw error;
    }
}

/**
 * الحصول على أو إنشاء مجلد فرعي حسب نوع الموديول
 * @param {string} moduleName - اسم الموديول (مثل: Incidents, NearMiss, Training, etc.)
 * @returns {Folder} مجلد Google Drive للموديول
 */
function getOrCreateModuleFolder(moduleName) {
    try {
        const mainFolder = getOrCreateAttachmentsFolder();
        const moduleFolders = mainFolder.getFoldersByName(moduleName);
        
        if (moduleFolders.hasNext()) {
            return moduleFolders.next();
        }
        
        // إنشاء مجلد فرعي للموديول
        const moduleFolder = mainFolder.createFolder(moduleName);
        Logger.log('تم إنشاء مجلد جديد للموديول: ' + moduleName);
        return moduleFolder;
    } catch (error) {
        Logger.log('خطأ في الحصول على مجلد الموديول: ' + error.toString());
        // في حالة الخطأ، نرجع المجلد الرئيسي
        return getOrCreateAttachmentsFolder();
    }
}

/**
 * رفع ملف إلى Google Drive
 * @param {string} base64Data - البيانات بصيغة Base64
 * @param {string} fileName - اسم الملف
 * @param {string} mimeType - نوع الملف (مثل: image/jpeg, image/png, application/pdf)
 * @param {string} moduleName - اسم الموديول (اختياري - لتجميع الملفات)
 * @returns {object} {success: boolean, fileId: string, directLink: string, shareableLink: string}
 */
function uploadFileToDrive(base64Data, fileName, mimeType, moduleName = null) {
    try {
        if (!base64Data || !fileName || !mimeType) {
            return {
                success: false,
                message: 'البيانات غير كاملة. يرجى التأكد من إرسال base64Data, fileName, و mimeType'
            };
        }
        
        // التحقق من نوع الملف المدعوم
        const allowedMimeTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
            return {
                success: false,
                message: 'نوع الملف غير مدعوم. الأنواع المدعومة: الصور (JPEG, PNG, GIF, WEBP) و PDF و Word و Excel'
            };
        }
        
        // تحويل Base64 إلى Blob
        let binaryData;
        try {
            // إزالة prefix إذا كان موجوداً (data:image/jpeg;base64,)
            const base64Prefix = /^data:[^;]+;base64,/;
            const cleanBase64 = base64Data.replace(base64Prefix, '');
            binaryData = Utilities.base64Decode(cleanBase64);
        } catch (decodeError) {
            Logger.log('خطأ في فك تشفير Base64: ' + decodeError.toString());
            return {
                success: false,
                message: 'خطأ في فك تشفير البيانات. تأكد من أن البيانات بصيغة Base64 صحيحة'
            };
        }
        
        // إنشاء Blob
        const blob = Utilities.newBlob(binaryData, mimeType, fileName);
        
        // الحصول على المجلد المناسب
        let targetFolder;
        if (moduleName) {
            targetFolder = getOrCreateModuleFolder(moduleName);
        } else {
            targetFolder = getOrCreateAttachmentsFolder();
        }
        
        // رفع الملف إلى Google Drive
        const file = targetFolder.createFile(blob);
        
        // جعل الملف قابل للمشاركة (Anyone with the link can view)
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // إنشاء رابط مباشر للصورة (للصور فقط)
        let directLink = '';
        let shareableLink = file.getUrl();

        if (mimeType.startsWith('image/')) {
            // للصور: رابط مباشر للعرض
            const fileId = file.getId();
            
            // ✅ استخدام صيغة lh3.googleusercontent.com بدلاً من uc?export=view
            // السبب: Google بدأ يحظر uc?export=view في 2025/2026
            directLink = 'https://lh3.googleusercontent.com/d/' + fileId;

            // أيضاً رابط مشاركة Google Drive
            shareableLink = 'https://drive.google.com/file/d/' + fileId + '/view';
        } else {
            // للملفات الأخرى: رابط المشاهدة فقط
            directLink = shareableLink;
        }
        
        Logger.log('تم رفع الملف بنجاح: ' + fileName + ' (ID: ' + file.getId() + ')');
        
        return {
            success: true,
            fileId: file.getId(),
            fileName: fileName,
            fileSize: file.getSize(),
            mimeType: mimeType,
            directLink: directLink,
            shareableLink: shareableLink,
            folderName: moduleName || 'HSE_Attachments',
            uploadedAt: new Date().toISOString()
        };
        
    } catch (error) {
        Logger.log('خطأ في رفع الملف إلى Google Drive: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        return {
            success: false,
            message: 'حدث خطأ أثناء رفع الملف: ' + error.toString()
        };
    }
}

/**
 * رفع عدة ملفات دفعة واحدة
 * @param {Array} files - مصفوفة من الملفات [{base64Data, fileName, mimeType}, ...]
 * @param {string} moduleName - اسم الموديول (اختياري)
 * @returns {object} {success: boolean, uploadedFiles: Array, failedFiles: Array}
 */
function uploadMultipleFilesToDrive(files, moduleName = null) {
    try {
        if (!Array.isArray(files) || files.length === 0) {
            return {
                success: false,
                message: 'يجب إرسال مصفوفة من الملفات'
            };
        }
        
        const uploadedFiles = [];
        const failedFiles = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = uploadFileToDrive(
                file.base64Data || file.data,
                file.fileName || file.name,
                file.mimeType || file.type,
                moduleName || file.moduleName
            );
            
            if (result.success) {
                uploadedFiles.push({
                    originalName: file.fileName || file.name,
                    fileId: result.fileId,
                    directLink: result.directLink,
                    shareableLink: result.shareableLink
                });
            } else {
                failedFiles.push({
                    fileName: file.fileName || file.name,
                    error: result.message
                });
            }
        }
        
        return {
            success: uploadedFiles.length > 0,
            uploadedFiles: uploadedFiles,
            failedFiles: failedFiles,
            totalUploaded: uploadedFiles.length,
            totalFailed: failedFiles.length
        };
        
    } catch (error) {
        Logger.log('خطأ في رفع الملفات المتعددة: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء رفع الملفات: ' + error.toString(),
            uploadedFiles: [],
            failedFiles: []
        };
    }
}

/**
 * حذف ملف من Google Drive
 * @param {string} fileId - معرف الملف في Google Drive
 * @returns {object} {success: boolean, message: string}
 */
function deleteFileFromDrive(fileId) {
    try {
        if (!fileId) {
            return {
                success: false,
                message: 'معرف الملف غير محدد'
            };
        }
        
        const file = DriveApp.getFileById(fileId);
        file.setTrashed(true); // نقل الملف إلى المهملات بدلاً من الحذف النهائي
        
        Logger.log('تم نقل الملف إلى المهملات: ' + fileId);
        
        return {
            success: true,
            message: 'تم حذف الملف بنجاح'
        };
        
    } catch (error) {
        Logger.log('خطأ في حذف الملف: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء حذف الملف: ' + error.toString()
        };
    }
}

/**
 * تحديث صلاحيات الملف (جعله عام أو خاص)
 * @param {string} fileId - معرف الملف
 * @param {boolean} isPublic - true لجعل الملف عام (Anyone with link can view)
 * @returns {object} {success: boolean, message: string}
 */
function updateFilePermissions(fileId, isPublic = true) {
    try {
        if (!fileId) {
            return {
                success: false,
                message: 'معرف الملف غير محدد'
            };
        }
        
        const file = DriveApp.getFileById(fileId);
        
        if (isPublic) {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } else {
            // إزالة الصلاحيات العامة (يجعل الملف خاص)
            file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
        }
        
        Logger.log('تم تحديث صلاحيات الملف: ' + fileId + ' (Public: ' + isPublic + ')');
        
        return {
            success: true,
            message: 'تم تحديث صلاحيات الملف بنجاح',
            shareableLink: file.getUrl()
        };
        
    } catch (error) {
        Logger.log('خطأ في تحديث صلاحيات الملف: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء تحديث صلاحيات الملف: ' + error.toString()
        };
    }
}

/**
 * معالجة attachments من البيانات قبل الحفظ
 * تحويل Base64 إلى روابط Google Drive
 * @param {Array} attachments - مصفوفة المرفقات [{data, name, type, ...}, ...]
 * @param {string} moduleName - اسم الموديول
 * @returns {Array} مصفوفة المرفقات مع الروابط بدلاً من Base64
 */
function processAttachmentsForSave(attachments, moduleName) {
    try {
        if (!Array.isArray(attachments) || attachments.length === 0) {
            return [];
        }
        
        const processedAttachments = [];
        
        for (let i = 0; i < attachments.length; i++) {
            const attachment = attachments[i];
            
            // إذا كان المرفق يحتوي بالفعل على رابط (تم رفعه مسبقاً)
            if (attachment.directLink || attachment.shareableLink || attachment.cloudLink) {
                processedAttachments.push({
                    id: attachment.id || Utilities.getUuid(),
                    name: attachment.name || 'attachment',
                    type: attachment.type || 'application/octet-stream',
                    directLink: attachment.directLink || attachment.shareableLink || attachment.cloudLink?.url,
                    shareableLink: attachment.shareableLink || attachment.cloudLink?.url || attachment.directLink,
                    fileId: attachment.fileId || attachment.cloudLink?.id,
                    size: attachment.size || 0,
                    uploadedAt: attachment.uploadedAt || new Date().toISOString()
                });
                continue;
            }
            
            // إذا كان المرفق يحتوي على Base64، نرفعه إلى Google Drive
            if (attachment.data || attachment.base64Data) {
                const uploadResult = uploadFileToDrive(
                    attachment.data || attachment.base64Data,
                    attachment.name || 'attachment_' + i,
                    attachment.type || 'application/octet-stream',
                    moduleName
                );
                
                if (uploadResult.success) {
                    processedAttachments.push({
                        id: attachment.id || Utilities.getUuid(),
                        name: uploadResult.fileName,
                        type: uploadResult.mimeType,
                        directLink: uploadResult.directLink,
                        shareableLink: uploadResult.shareableLink,
                        fileId: uploadResult.fileId,
                        size: uploadResult.fileSize,
                        uploadedAt: uploadResult.uploadedAt
                    });
                } else {
                    Logger.log('فشل رفع المرفق: ' + (attachment.name || 'unknown') + ' - ' + uploadResult.message);
                    // نضيف المرفق كـ Base64 للاحتفاظ به (في حالة فشل الرفع)
                    processedAttachments.push(attachment);
                }
            } else {
                // إذا لم يكن هناك Base64 ولا رابط، نضيف المرفق كما هو
                processedAttachments.push(attachment);
            }
        }
        
        return processedAttachments;
        
    } catch (error) {
        Logger.log('خطأ في معالجة المرفقات: ' + error.toString());
        // في حالة الخطأ، نرجع المرفقات الأصلية
        return attachments;
    }
}

/**
 * تحويل attachments من JSON string إلى Array
 * @param {string|Array} attachmentsData - البيانات (قد تكون JSON string أو Array)
 * @returns {Array} مصفوفة المرفقات
 */
function parseAttachments(attachmentsData) {
    try {
        if (!attachmentsData) {
            return [];
        }
        
        if (Array.isArray(attachmentsData)) {
            return attachmentsData;
        }
        
        if (typeof attachmentsData === 'string') {
            try {
                return JSON.parse(attachmentsData);
            } catch (parseError) {
                Logger.log('خطأ في تحليل JSON للمرفقات: ' + parseError.toString());
                return [];
            }
        }
        
        return [];
    } catch (error) {
        Logger.log('خطأ في تحليل المرفقات: ' + error.toString());
        return [];
    }
}

/**
 * تحويل attachments من Array إلى JSON string للحفظ في Google Sheets
 * @param {Array} attachments - مصفوفة المرفقات
 * @returns {string} JSON string
 */
function stringifyAttachments(attachments) {
    try {
        // إذا كانت attachments عبارة عن JSON string بالفعل، نعيدها كما هي
        if (typeof attachments === 'string') {
            try {
                // التحقق من أنها JSON صحيح
                const parsed = JSON.parse(attachments);
                if (Array.isArray(parsed)) {
                    // إذا كانت مصفوفة، نتحقق من أن كل عنصر يحتوي على رابط
                    const hasLinks = parsed.some(att => {
                        if (typeof att === 'string') return att.length > 0;
                        return att.directLink || att.shareableLink || att.cloudLink?.url;
                    });
                    if (hasLinks) {
                        Logger.log('stringifyAttachments: تم العثور على JSON string يحتوي على روابط، إرجاعه كما هو');
                        return attachments; // نعيدها كما هي إذا كانت تحتوي على روابط
                    }
                }
            } catch (e) {
                Logger.log('stringifyAttachments: خطأ في تحليل JSON string: ' + e.toString());
                // إذا لم تكن JSON صحيح، نتابع المعالجة
            }
        }
        
        if (!Array.isArray(attachments) || attachments.length === 0) {
            Logger.log('stringifyAttachments: attachments فارغة أو ليست Array');
            return '[]';
        }
        
        Logger.log('stringifyAttachments: بدء معالجة ' + attachments.length + ' مرفق');
        
        // نحفظ فقط المعلومات الأساسية (بدون Base64)
        const simplifiedAttachments = attachments.map((att, index) => {
            // إذا كان المرفق عبارة عن string (رابط مباشر)، نحوله إلى object
            if (typeof att === 'string') {
                if (att.startsWith('data:')) {
                    // إذا كان Base64، نتجاهله (يجب أن يكون قد تم رفعه مسبقاً)
                    Logger.log('stringifyAttachments: تم تجاهل Base64 في المرفق ' + index);
                    return null;
                }
                // إذا كان رابط
                Logger.log('stringifyAttachments: تحويل string إلى object للمرفق ' + index);
                return {
                    id: Utilities.getUuid(),
                    name: 'attachment',
                    type: 'application/octet-stream',
                    directLink: att,
                    shareableLink: att,
                    size: 0,
                    uploadedAt: new Date().toISOString()
                };
            }
            
            // إذا كان object، نستخرج الروابط
            const directLink = att.directLink || att.shareableLink || att.cloudLink?.url || att.url || '';
            const shareableLink = att.shareableLink || att.directLink || att.cloudLink?.url || att.url || '';
            
            // إذا لم يكن هناك رابط، نحاول البحث في data (قد يكون رابط)
            let finalDirectLink = directLink;
            let finalShareableLink = shareableLink;
            
            if (!finalDirectLink && att.data && typeof att.data === 'string' && !att.data.startsWith('data:')) {
                // إذا كان data عبارة عن رابط وليس Base64
                Logger.log('stringifyAttachments: تم العثور على رابط في data للمرفق ' + index);
                finalDirectLink = att.data;
                finalShareableLink = att.data;
            }
            
            const result = {
                id: att.id || Utilities.getUuid(),
                name: att.name || 'attachment',
                type: att.type || 'application/octet-stream',
                directLink: finalDirectLink,
                shareableLink: finalShareableLink,
                fileId: att.fileId || att.cloudLink?.id || '',
                size: att.size || 0,
                uploadedAt: att.uploadedAt || new Date().toISOString()
            };
            
            if (finalDirectLink || finalShareableLink) {
                Logger.log('stringifyAttachments: المرفق ' + index + ' (' + (att.name || 'unknown') + ') يحتوي على رابط: ' + (finalDirectLink || finalShareableLink).substring(0, 50) + '...');
            } else {
                Logger.log('stringifyAttachments: تحذير - المرفق ' + index + ' (' + (att.name || 'unknown') + ') لا يحتوي على رابط');
            }
            
            return result;
        }).filter(att => {
            if (!att) {
                Logger.log('stringifyAttachments: تم حذف null entry');
                return false; // حذف null entries
            }
            // نحتفظ بالمرفقات التي تحتوي على روابط فقط
            const hasDirectLink = att.directLink && att.directLink.trim() !== '';
            const hasShareableLink = att.shareableLink && att.shareableLink.trim() !== '';
            const hasLink = hasDirectLink || hasShareableLink;
            
            if (!hasLink) {
                Logger.log('stringifyAttachments: تم حذف مرفق بدون رابط: ' + (att.name || 'unknown') + 
                    ' - directLink: "' + (att.directLink || '') + '" - shareableLink: "' + (att.shareableLink || '') + '"');
            } else {
                Logger.log('stringifyAttachments: تم الاحتفاظ بالمرفق: ' + (att.name || 'unknown') + 
                    ' - رابط: ' + (att.directLink || att.shareableLink).substring(0, 60) + '...');
            }
            return hasLink;
        });
        
        Logger.log('stringifyAttachments: تم معالجة ' + simplifiedAttachments.length + ' مرفق من أصل ' + attachments.length);
        
        if (simplifiedAttachments.length === 0) {
            Logger.log('stringifyAttachments: تحذير - جميع المرفقات تم حذفها لأنها لا تحتوي على روابط');
            return '[]';
        }
        
        const jsonResult = JSON.stringify(simplifiedAttachments);
        Logger.log('stringifyAttachments: النتيجة النهائية - عدد المرفقات: ' + simplifiedAttachments.length + 
            ', JSON length: ' + jsonResult.length + ', أول 200 حرف: ' + jsonResult.substring(0, 200) + '...');
        
        return jsonResult;
    } catch (error) {
        Logger.log('خطأ في تحويل المرفقات إلى JSON: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        return '[]';
    }
}

