/**
 * Google Apps Script for HSE System - Violations Module
 * 
 * موديول المخالفات
 */

/**
 * إضافة مخالفة
 */
function addViolationToSheet(violationData) {
    try {
        if (!violationData) {
            return { success: false, message: 'بيانات المخالفة غير موجودة' };
        }
        
        const sheetName = 'Violations';
        
        // إضافة حقول تلقائية
        if (!violationData.id) {
            violationData.id = generateSequentialId('VIO', sheetName);
        }
        if (!violationData.createdAt) {
            violationData.createdAt = new Date();
        }
        if (!violationData.updatedAt) {
            violationData.updatedAt = new Date();
        }
        
        // معالجة photo - إذا كانت Base64، نحولها إلى رابط
        if (violationData.photo && typeof violationData.photo === 'string' && violationData.photo.startsWith('data:')) {
            try {
                const uploadResult = uploadFileToDrive(
                    violationData.photo,
                    'violation_' + (violationData.id || Utilities.getUuid()) + '_' + Date.now() + '.jpg',
                    'image/jpeg',
                    'Violations'
                );
                if (uploadResult && uploadResult.success) {
                    violationData.photo = uploadResult.directLink || uploadResult.shareableLink || violationData.photo;
                }
            } catch (imageError) {
                Logger.log('خطأ في رفع صورة المخالفة: ' + imageError.toString());
            }
        }
        
        // معالجة attachments - التأكد من تحويلها إلى JSON string مع الروابط
        if (violationData.attachments && Array.isArray(violationData.attachments)) {
            violationData.attachments = stringifyAttachments(violationData.attachments);
        } else if (violationData.attachments && typeof violationData.attachments === 'object') {
            violationData.attachments = stringifyAttachments([violationData.attachments]);
        } else if (!violationData.attachments) {
            violationData.attachments = '[]';
        }
        
        return appendToSheet(sheetName, violationData);
    } catch (error) {
        Logger.log('Error in addViolationToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المخالفة: ' + error.toString() };
    }
}


/**
 * حذف مخالفة
 */
function deleteViolationFromSheet(violationId) {
    try {
        if (!violationId) {
            return { success: false, message: 'معرف المخالفة غير موجود' };
        }
        
        const sheetName = 'Violations';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        // قراءة البيانات الحالية
        const currentData = readFromSheet(sheetName, spreadsheetId);
        
        // التحقق من وجود المخالفة والحصول على بياناتها قبل الحذف
        const violation = currentData.find(v => v.id === violationId);
        if (!violation) {
            return { success: false, message: 'المخالفة غير موجودة في قاعدة البيانات' };
        }
        
        // ✅ حذف الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        const result = deleteRowById(sheetName, violationId, spreadsheetId);
        
        if (result.success) {
            // ✅ تم تحديث: تنظيف المراجع من ApprovedContractors فقط
            try {
                // تنظيف من جدول المقاولين المعتمدين (إذا كان هناك مراجع)
                if (violation.contractorId || violation.contractorName) {
                    const approvedContractorsSheet = 'ApprovedContractors';
                    const approvedContractorsData = readFromSheet(approvedContractorsSheet, spreadsheetId);
                    let contractorsUpdated = false;
                    
                    // ✅ لا حاجة لتخزين violations داخل contractors
                    // يمكن الاستعلام عن المخالفات من جدول Violations مباشرة
                    // هذا الكود تم إزالته لتبسيط البنية وتجنب JSON
                    
                    if (contractorsUpdated) {
                        saveToSheet(approvedContractorsSheet, approvedContractorsData, spreadsheetId);
                    }
                }
                
                // تنظيف من جدول الموظفين (إذا كان هناك مراجع)
                if (violation.employeeId || violation.employeeCode || violation.employeeNumber || violation.employeeName) {
                    const employeesSheet = 'Employees';
                    const employeesData = readFromSheet(employeesSheet, spreadsheetId);
                    let employeesUpdated = false;
                    
                    // ✅ لا حاجة لتخزين violations داخل employees
                    // يمكن الاستعلام عن المخالفات من جدول Violations مباشرة
                    // هذا الكود تم إزالته لتبسيط البنية وتجنب JSON
                    
                    if (employeesUpdated) {
                        saveToSheet(employeesSheet, employeesData, spreadsheetId);
                    }
                }
            } catch (cleanupError) {
                // لا نعتبر خطأ التنظيف خطأ فادح - المخالفة تم حذفها بالفعل
                Logger.log('Warning: Could not clean up violation references: ' + cleanupError.toString());
            }
            
            return { 
                success: true, 
                message: 'تم حذف المخالفة بنجاح من قاعدة البيانات وجميع السجلات المرتبطة' 
            };
        } else {
            return result;
        }
    } catch (error) {
        Logger.log('Error in deleteViolationFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف المخالفة: ' + error.toString() };
    }
}

/**
 * إضافة نوع مخالفة (للإضافة المباشرة)
 */
function addViolationTypeToSheet(typeData) {
    const sheetName = 'ViolationTypes';
    return appendToSheet(sheetName, typeData);
}

/**
 * التحقق من صلاحيات المستخدم لإدارة أنواع المخالفات (من الإعدادات)
 */
function checkViolationTypesPermission(userData) {
    try {
        // إذا لم يتم تمرير بيانات المستخدم، رفض الوصول
        if (!userData) {
            return { hasPermission: false, message: 'يجب تسجيل الدخول أولاً' };
        }
        
        // التحقق من الدور (Role)
        const userRole = userData.role || '';
        const allowedRoles = ['admin', 'safety_officer', 'manager'];
        
        if (allowedRoles.includes(userRole.toLowerCase())) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        // التحقق من الصلاحيات المخصصة (Permissions)
        let userPermissions = userData.permissions || {};
        if (typeof userPermissions === 'string') {
            try {
                userPermissions = JSON.parse(userPermissions);
            } catch (e) {
                userPermissions = {};
            }
        }
        
        // التحقق من صلاحية 'admin' أو 'manage-settings' أو 'violation-types'
        if (userPermissions['admin'] === true || 
            userPermissions['manage-settings'] === true ||
            userPermissions['violation-types'] === true) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        return { 
            hasPermission: false, 
            message: 'ليس لديك صلاحية لإدارة أنواع المخالفات. يجب أن تكون مدير النظام أو لديك صلاحية خاصة.' 
        };
    } catch (error) {
        Logger.log('Error checking violation types permissions: ' + error.toString());
        return { hasPermission: false, message: 'حدث خطأ أثناء التحقق من الصلاحيات' };
    }
}

/**
 * حفظ جميع أنواع المخالفات في ورقة ViolationTypes فقط (مصدر حقيقة واحد).
 * يحذف الصفوف غير الموجودة في snapshot ثم يُحدّث/يضيف الباقي عبر saveToSheet (upsert).
 */
function saveViolationTypesToSheet(violationTypesData) {
    try {
        const userData = violationTypesData.userData || violationTypesData.user || {};
        const permissionCheck = checkViolationTypesPermission(userData);

        if (!permissionCheck.hasPermission) {
            return {
                success: false,
                message: permissionCheck.message || 'ليس لديك صلاحية لحفظ أنواع المخالفات',
                errorCode: 'PERMISSION_DENIED'
            };
        }

        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }

        const violationTypes = violationTypesData.violationTypes || violationTypesData.data || [];

        if (!Array.isArray(violationTypes)) {
            return { success: false, message: 'بيانات أنواع المخالفات غير صحيحة' };
        }

        const sheetName = 'ViolationTypes';
        const existingRows = readFromSheet(sheetName, spreadsheetId) || [];

        // حماية: رفض مسح كل الأنواع عن طريق snapshot فارغة إن وُجدت بيانات سابقاً
        if (violationTypes.length === 0 && existingRows.length > 0) {
            return {
                success: false,
                message: 'تم رفض الحفظ: قائمة الأنواع فارغة بينما توجد أنواع مسجلة. أعد تحميل الصفحة ثم حاول مرة أخرى.'
            };
        }

        const snapshotIds = new Set();
        violationTypes.forEach(function (t) {
            if (t && t.id) snapshotIds.add(String(t.id).trim());
        });

        const toDelete = existingRows.filter(function (row) {
            const rid = row && row.id ? String(row.id).trim() : '';
            return rid && !snapshotIds.has(rid);
        });

        var i;
        for (i = 0; i < toDelete.length; i++) {
            const delResult = deleteRowById(sheetName, toDelete[i].id, spreadsheetId);
            if (!delResult || !delResult.success) {
                Logger.log('saveViolationTypesToSheet deleteRowById failed for id ' + toDelete[i].id + ': ' + (delResult && delResult.message));
            }
        }

        const nowIso = new Date().toISOString();
        for (i = 0; i < violationTypes.length; i++) {
            const type = violationTypes[i];
            if (!type || !type.id) continue;
            const payload = Object.assign({}, type, {
                updatedAt: type.updatedAt || nowIso
            });
            if (!payload.createdAt) {
                payload.createdAt = nowIso;
            }
            const saveResult = saveToSheet(sheetName, payload, spreadsheetId);
            if (!saveResult || !saveResult.success) {
                return { success: false, message: (saveResult && saveResult.message) || 'فشل حفظ نوع مخالفة' };
            }
        }

        return { success: true, message: 'تم حفظ أنواع المخالفات بنجاح' };
    } catch (error) {
        Logger.log('Error in saveViolationTypesToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ أنواع المخالفات: ' + error.toString() };
    }
}

/**
 * الحصول على جميع أنواع المخالفات من ورقة ViolationTypes (مصدر الحقيقة الوحيد)
 */
function getViolationTypesFromSheet() {
    try {
        const sheetName = 'ViolationTypes';
        const spreadsheetId = getSpreadsheetId();

        if (!spreadsheetId) {
            return { success: true, data: [], message: 'معرف Google Sheets غير محدد' };
        }

        const data = readFromSheet(sheetName, spreadsheetId);

        if (!data || data.length === 0) {
            return { success: true, data: [] };
        }

        const activeTypes = data.filter(function (type) {
            return type && type.isActive !== false && type.isActive !== 'inactive';
        });

        return {
            success: true,
            data: activeTypes,
            updatedAt: new Date().toISOString()
        };
    } catch (error) {
        Logger.log('Error in getViolationTypesFromSheet: ' + error.toString());
        return { success: true, data: [], message: 'حدث خطأ أثناء قراءة أنواع المخالفات' };
    }
}

/**
 * تحديث نوع مخالفة (من الإعدادات) — upsert سطر واحد في ViolationTypes
 */
function updateViolationTypeInSheet(typeId, updateData) {
    try {
        const userData = updateData.userData || updateData.user || {};
        const permissionCheck = checkViolationTypesPermission(userData);

        if (!permissionCheck.hasPermission) {
            return {
                success: false,
                message: permissionCheck.message || 'ليس لديك صلاحية لتحديث أنواع المخالفات',
                errorCode: 'PERMISSION_DENIED'
            };
        }

        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }

        const sheetName = 'ViolationTypes';
        const existingRows = readFromSheet(sheetName, spreadsheetId) || [];
        const existing = existingRows.find(function (t) {
            return t && String(t.id).trim() === String(typeId).trim();
        });
        if (!existing) {
            return { success: false, message: 'نوع المخالفة غير موجود' };
        }

        const merged = Object.assign({}, existing);
        var k;
        for (k in updateData) {
            if (!updateData.hasOwnProperty(k)) continue;
            if (k === 'userData' || k === 'user' || k === 'id') continue;
            merged[k] = updateData[k];
        }
        merged.id = typeId;
        merged.updatedAt = new Date().toISOString();

        return saveToSheet(sheetName, merged, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateViolationTypeInSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث نوع المخالفة: ' + error.toString() };
    }
}

/**
 * حذف نوع مخالفة (من الإعدادات) — حذف صف حقيقي من ViolationTypes
 */
function deleteViolationTypeFromSheet(typeId, userData) {
    try {
        const permissionCheck = checkViolationTypesPermission(userData || {});

        if (!permissionCheck.hasPermission) {
            return {
                success: false,
                message: permissionCheck.message || 'ليس لديك صلاحية لحذف أنواع المخالفات',
                errorCode: 'PERMISSION_DENIED'
            };
        }

        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }

        return deleteRowById('ViolationTypes', typeId, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteViolationTypeFromSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف نوع المخالفة: ' + error.toString() };
    }
}

