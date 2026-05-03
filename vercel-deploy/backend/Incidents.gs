/**
 * Google Apps Script for HSE System - Incidents Module
 * 
 * موديول الحوادث - النسخة المحسنة
 */

/**
 * إضافة حادث جديد
 */
function addIncidentToSheet(incidentData) {
    try {
        if (!incidentData) {
            return { success: false, message: 'بيانات الحادث غير موجودة' };
        }
        
        const sheetName = 'Incidents';
        
        // ✅ حذف userData لمنع تخزينها في Google Sheets
        if (incidentData && incidentData.userData) {
            try { delete incidentData.userData; } catch (e) {}
        }
        
        // إضافة حقول تلقائية
        if (!incidentData.id) {
            incidentData.id = generateSequentialId('INC', sheetName);
        }
        if (!incidentData.createdAt) {
            incidentData.createdAt = new Date();
        }
        if (!incidentData.updatedAt) {
            incidentData.updatedAt = new Date();
        }
        
        // ✅ Attachments: keep as array/object/string and let Utils handle formatting (NO JSON)
        // ✅ Investigation: keep as object and let Utils handle formatting (NO JSON)
        if (incidentData.attachments === undefined || incidentData.attachments === null) {
            incidentData.attachments = '';
        }
        
        // معالجة image - إذا كانت Base64، نحولها إلى رابط
        if (incidentData.image && typeof incidentData.image === 'string' && incidentData.image.startsWith('data:')) {
            try {
                const uploadResult = uploadFileToDrive(
                    incidentData.image,
                    'incident_' + (incidentData.id || Utilities.getUuid()) + '_' + Date.now() + '.jpg',
                    'image/jpeg',
                    'Incidents'
                );
                if (uploadResult && uploadResult.success) {
                    incidentData.image = uploadResult.directLink || uploadResult.shareableLink || incidentData.image;
                }
            } catch (imageError) {
                Logger.log('خطأ في رفع صورة الحادث: ' + imageError.toString());
            }
        }
        
        const result = appendToSheet(sheetName, incidentData);
        
        // إنشاء إجراء تلقائي في Action Tracking إذا كان هناك إجراء تصحيحي
        if (result.success && incidentData.correctiveAction) {
            try {
                createActionFromModule('Incidents', incidentData.id || '', {
                    date: incidentData.date || incidentData.issueDate,
                    description: incidentData.description || incidentData.title || '',
                    correctiveAction: incidentData.correctiveAction,
                    department: incidentData.department || '',
                    location: incidentData.location || '',
                    severity: incidentData.severity || 'Medium',
                    reportedBy: incidentData.reportedBy || incidentData.employeeName || '',
                    createdBy: incidentData.createdBy || 'System',
                    ...incidentData
                });
            } catch (error) {
                Logger.log('Error creating auto action from incident: ' + error.toString());
                // لا نوقف العملية إذا فشل إنشاء الإجراء التلقائي
            }
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addIncidentToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الحادث: ' + error.toString() };
    }
}

/**
 * التحقق من صلاحيات المستخدم (مدير النظام فقط للتعديل/الحذف)
 */
function checkIncidentPermissions(userData, action = 'edit') {
    try {
        if (!userData) {
            return { hasPermission: false, message: 'يجب تسجيل الدخول أولاً' };
        }
        
        const userRole = userData.role || '';
        if (userRole.toLowerCase() === 'admin') {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        let userPermissions = userData.permissions || {};
        if (typeof userPermissions === 'string') {
            try {
                userPermissions = JSON.parse(userPermissions);
            } catch (e) {
                userPermissions = {};
            }
        }
        
        // صلاحيات مدير النظام
        if (userPermissions['admin'] === true || 
            userPermissions['manage-modules'] === true ||
            userPermissions['incidents-manage'] === true) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        // صلاحية مسئول السلامة لاستكمال التحقيق (لكن يحتاج موافقة)
        if (action === 'edit' && (
            userRole.toLowerCase() === 'safety_officer' ||
            userPermissions['incidents-complete-investigation'] === true
        )) {
            return { hasPermission: true, message: 'صلاحية صحيحة', requiresApproval: true };
        }
        
        return { 
            hasPermission: false, 
            message: `ليس لديك صلاحية ${action === 'edit' ? 'لتعديل' : 'لحذف'} الحوادث. يجب أن تكون مدير النظام أو مسئول السلامة مع صلاحية "استكمال التحقيق".` 
        };
    } catch (error) {
        Logger.log('Error checking incident permissions: ' + error.toString());
        return { hasPermission: false, message: 'حدث خطأ أثناء التحقق من الصلاحيات' };
    }
}

/**
 * تحديث حادث موجود
 */
function updateIncident(incidentId, updateData) {
    try {
        if (!incidentId) {
            return { success: false, message: 'معرف الحادث غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const userData = updateData.userData || updateData.createdBy || {};
        const permissionCheck = checkIncidentPermissions(userData, 'edit');
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message };
        }
        
        const sheetName = 'Incidents';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        let data = readFromSheet(sheetName, spreadsheetId);
        let incidentIndex = data.findIndex(inc => inc.id === incidentId);
        
        // إذا لم يكن الحادث موجوداً، نحاول إضافته (مفيد للحوادث المحلية التي لم يتم حفظها بعد)
        if (incidentIndex === -1) {
            // محاولة إضافة الحادث إذا كانت البيانات كاملة
            if (updateData.title || updateData.description) {
                try {
                    // إنشاء بيانات الحادث من updateData
                    const newIncidentData = {
                        id: incidentId,
                        title: updateData.title || 'حادث بدون عنوان',
                        description: updateData.description || '',
                        date: updateData.date || new Date(),
                        status: updateData.status || 'مفتوح',
                        severity: updateData.severity || 'متوسطة',
                        location: updateData.location || '',
                        investigation: updateData.investigation || null,
                        requiresApproval: updateData.requiresApproval || false,
                        approvedBy: updateData.approvedBy || null,
                        createdAt: updateData.createdAt || new Date(),
                        updatedAt: updateData.updatedAt || new Date(),
                        createdBy: updateData.createdBy || updateData.userData || null
                    };
                    
                    // نسخ باقي البيانات من updateData
                    for (var key in updateData) {
                        if (updateData.hasOwnProperty(key) && 
                            key !== 'userData' && 
                            !newIncidentData.hasOwnProperty(key)) {
                            newIncidentData[key] = updateData[key];
                        }
                    }
                    
                    // إضافة الحادث
                    const addResult = addIncidentToSheet(newIncidentData);
                    if (addResult.success) {
                        // قراءة البيانات مرة أخرى للعثور على الحادث المضاف
                        data = readFromSheet(sheetName, spreadsheetId);
                        incidentIndex = data.findIndex(inc => inc.id === incidentId);
                        if (incidentIndex === -1) {
                            return { success: false, message: 'تم إضافة الحادث لكن لم يتم العثور عليه بعد الإضافة' };
                        }
                    } else {
                        return { success: false, message: 'الحادث غير موجود في Google Sheets. ' + (addResult.message || 'فشل إضافة الحادث') };
                    }
                } catch (addError) {
                    Logger.log('Error trying to add missing incident: ' + addError.toString());
                    return { success: false, message: 'الحادث غير موجود في Google Sheets. يرجى التأكد من حفظ الحادث أولاً.' };
                }
            } else {
                return { success: false, message: 'الحادث غير موجود في Google Sheets. يرجى التأكد من حفظ الحادث أولاً.' };
            }
        }
        
        // تحديث البيانات (NO JSON, no full-sheet rewrite)
        const safeUpdate = {};
        for (var key in updateData) {
            if (!updateData.hasOwnProperty(key)) continue;
            if (key === 'userData') continue; // لا نحفظ userData في الشيت
            safeUpdate[key] = updateData[key];
        }
        safeUpdate.updatedAt = new Date();

        // ✅ تحديث صف واحد فقط (بدون مسح/استبدال باقي البيانات)
        return updateSingleRowInSheet(sheetName, incidentId, safeUpdate, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating incident: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الحادث: ' + error.toString() };
    }
}

/**
 * الحصول على حادث محدد
 */
function getIncident(incidentId) {
    try {
        if (!incidentId) {
            return { success: false, message: 'معرف الحادث غير محدد' };
        }
        
        const sheetName = 'Incidents';
        const data = readFromSheet(sheetName, getSpreadsheetId());
        const incident = data.find(inc => inc.id === incidentId);
        
        if (!incident) {
            return { success: false, message: 'الحادث غير موجود' };
        }
        
        return { success: true, data: incident };
    } catch (error) {
        Logger.log('Error getting incident: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الحادث: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الحوادث
 */
function getAllIncidents(filters = {}) {
    try {
        const sheetName = 'Incidents';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.department) {
            data = data.filter(inc => inc.department === filters.department);
        }
        if (filters.location) {
            data = data.filter(inc => inc.location === filters.location);
        }
        if (filters.severity) {
            data = data.filter(inc => inc.severity === filters.severity);
        }
        if (filters.status) {
            data = data.filter(inc => inc.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(inc => {
                if (!inc.date) return false;
                return new Date(inc.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(inc => {
                if (!inc.date) return false;
                return new Date(inc.date) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        data.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all incidents: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الحوادث: ' + error.toString(), data: [] };
    }
}

/**
 * حذف حادث
 */
function deleteIncident(incidentId, userData = {}) {
    try {
        if (!incidentId) {
            return { success: false, message: 'معرف الحادث غير محدد' };
        }
        
        // التحقق من الصلاحيات
        const permissionCheck = checkIncidentPermissions(userData, 'delete');
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message };
        }
        
        const sheetName = 'Incidents';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
            };
        }
        
        // ✅ حذف صف واحد بالـ id (بدون إعادة كتابة الشيت بالكامل)
        return deleteRowById(sheetName, incidentId, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting incident: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الحادث: ' + error.toString() };
    }
}

/**
 * إضافة إخطار حادث جديد
 */
function addIncidentNotificationToSheet(notificationData) {
    try {
        if (!notificationData) {
            return { success: false, message: 'بيانات الإخطار غير موجودة' };
        }
        
        const sheetName = 'IncidentNotifications';
        
        // ✅ حذف userData لمنع تخزينها في Google Sheets
        if (notificationData && notificationData.userData) {
            try { delete notificationData.userData; } catch (e) {}
        }
        
        // إضافة حقول تلقائية
        if (!notificationData.id) {
            notificationData.id = generateSequentialId('INO', sheetName);
        }
        if (!notificationData.createdAt) {
            notificationData.createdAt = new Date();
        }
        if (!notificationData.updatedAt) {
            notificationData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, notificationData);
    } catch (error) {
        Logger.log('Error in addIncidentNotificationToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإخطار: ' + error.toString() };
    }
}

/**
 * الحصول على جميع إخطارات الحوادث
 */
function getAllIncidentNotifications(filters = {}) {
    try {
        const sheetName = 'IncidentNotifications';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.startDate) {
            data = data.filter(notif => {
                if (!notif.date) return false;
                return new Date(notif.date) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(notif => {
                if (!notif.date) return false;
                return new Date(notif.date) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        data.sort((a, b) => {
            const dateA = new Date(a.date || a.createdAt || 0);
            const dateB = new Date(b.date || b.createdAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all incident notifications: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإخطارات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة Safety Alert جديد
 */
function addSafetyAlertToSheet(alertData) {
    try {
        if (!alertData) {
            return { success: false, message: 'بيانات Safety Alert غير موجودة' };
        }
        
        const sheetName = 'SafetyAlerts';

        // لا نحفظ userData في الشيت (إن وُجدت)
        if (alertData && alertData.userData) {
            try { delete alertData.userData; } catch (e) {}
        }
        
        // إضافة حقول تلقائية
        if (!alertData.id) {
            alertData.id = generateSequentialId('SA', sheetName);
        }
        if (!alertData.createdAt) {
            alertData.createdAt = new Date();
        }
        if (!alertData.updatedAt) {
            alertData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, alertData);
    } catch (error) {
        Logger.log('Error in addSafetyAlertToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة Safety Alert: ' + error.toString() };
    }
}

/**
 * تحديث Safety Alert
 */
function updateSafetyAlert(alertId, updateData) {
    try {
        if (!alertId || !updateData) {
            return { success: false, message: 'بيانات غير صحيحة' };
        }
        
        const sheetName = 'SafetyAlerts';
        updateData.updatedAt = new Date();

        // لا نحفظ userData في الشيت (إن وُجدت)
        if (updateData && updateData.userData) {
            try { delete updateData.userData; } catch (e) {}
        }
        
        return updateSingleRowInSheet(sheetName, alertId, updateData);
    } catch (error) {
        Logger.log('Error updating Safety Alert: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث Safety Alert: ' + error.toString() };
    }
}

/**
 * الحصول على جميع Safety Alerts
 */
function getAllSafetyAlerts(filters = {}) {
    try {
        const sheetName = 'SafetyAlerts';
        let data = readFromSheet(sheetName, getSpreadsheetId());
        
        // تطبيق الفلاتر
        if (filters.incidentId) {
            data = data.filter(alert => alert.incidentId === filters.incidentId);
        }
        if (filters.status) {
            data = data.filter(alert => alert.status === filters.status);
        }
        if (filters.startDate) {
            data = data.filter(alert => {
                if (!alert.incidentDate) return false;
                return new Date(alert.incidentDate) >= new Date(filters.startDate);
            });
        }
        if (filters.endDate) {
            data = data.filter(alert => {
                if (!alert.incidentDate) return false;
                return new Date(alert.incidentDate) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب التاريخ (الأحدث أولاً)
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.incidentDate || 0);
            const dateB = new Date(b.createdAt || b.incidentDate || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error getting all Safety Alerts: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة Safety Alerts: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على Safety Alert واحد
 */
function getSafetyAlert(alertId) {
    try {
        if (!alertId) {
            return { success: false, message: 'معرف Safety Alert غير موجود' };
        }
        
        const sheetName = 'SafetyAlerts';
        const result = readFromSheet(sheetName, getSpreadsheetId());
        const alert = result.find(a => a.id === alertId);
        
        if (!alert) {
            return { success: false, message: 'Safety Alert غير موجود' };
        }
        
        return { success: true, data: alert };
    } catch (error) {
        Logger.log('Error getting Safety Alert: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة Safety Alert: ' + error.toString() };
    }
}

/**
 * حذف Safety Alert
 */
function deleteSafetyAlert(alertId) {
    try {
        if (!alertId) {
            return { success: false, message: 'معرف Safety Alert غير موجود' };
        }
        
        const sheetName = 'SafetyAlerts';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
            };
        }
        
        // ✅ حذف صف واحد بالـ id (بدون إعادة كتابة الشيت بالكامل)
        return deleteRowById(sheetName, alertId, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting Safety Alert: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف Safety Alert: ' + error.toString() };
    }
}

/**
 * الحصول على إحصائيات الحوادث
 */
function getIncidentStatistics(filters = {}) {
    try {
        const allIncidents = getAllIncidents(filters);
        if (!allIncidents.success) {
            return { success: false, message: 'فشل في قراءة الحوادث' };
        }
        
        const incidents = allIncidents.data;
        const stats = {
            total: incidents.length,
            bySeverity: {},
            byDepartment: {},
            byLocation: {},
            byStatus: {},
            byMonth: {},
            trend: 'stable'
        };
        
        incidents.forEach(inc => {
            // حسب الشدة
            const severity = inc.severity || 'Unknown';
            stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
            
            // حسب الإدارة
            const dept = inc.department || 'Unknown';
            stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
            
            // حسب الموقع
            const loc = inc.location || 'Unknown';
            stats.byLocation[loc] = (stats.byLocation[loc] || 0) + 1;
            
            // حسب الحالة
            const status = inc.status || 'Unknown';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
            
            // حسب الشهر
            if (inc.date) {
                const date = new Date(inc.date);
                const monthKey = date.getFullYear() + '-' + (date.getMonth() + 1);
                stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
            }
        });
        
        // حساب الاتجاه (آخر 3 أشهر)
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const recent = incidents.filter(inc => {
            if (!inc.date) return false;
            return new Date(inc.date) >= threeMonthsAgo;
        });
        const older = incidents.filter(inc => {
            if (!inc.date) return false;
            const incDate = new Date(inc.date);
            return incDate < threeMonthsAgo && incDate >= new Date(now.getFullYear(), now.getMonth() - 6, 1);
        });
        
        if (recent.length > older.length * 1.2) {
            stats.trend = 'increasing';
        } else if (recent.length < older.length * 0.8) {
            stats.trend = 'decreasing';
        }
        
        return { success: true, data: stats };
    } catch (error) {
        Logger.log('Error getting incident statistics: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حساب الإحصائيات: ' + error.toString() };
    }
}

/**
 * الحصول على إعدادات تحليل الحوادث
 */
function getIncidentAnalysisSettings() {
    try {
        const sheetName = 'Incident_Analysis_Settings';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود الجدول
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        let sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            // إنشاء الجدول إذا لم يكن موجوداً
            sheet = spreadsheet.insertSheet(sheetName);
            const headers = ['id', 'enabledSections', 'updatedAt', 'updatedBy', 'createdAt'];
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            
            // إضافة إعدادات افتراضية
            const defaultSettings = {
                id: 'default',
                // ✅ Store as plain text (NO JSON)
                enabledSections: ['summary', 'trends', 'severity', 'department'].join(', '),
                updatedAt: new Date(),
                updatedBy: 'System',
                createdAt: new Date()
            };
            appendToSheet(sheetName, defaultSettings);
            
            return {
                success: true,
                data: {
                    enabledSections: ['summary', 'trends', 'severity', 'department']
                }
            };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        if (data.length === 0) {
            // إعدادات افتراضية
            return {
                success: true,
                data: {
                    enabledSections: ['summary', 'trends', 'severity', 'department']
                }
            };
        }
        
        // الحصول على آخر إعدادات (أو الإعدادات الافتراضية)
        const settings = data.find(s => s.id === 'default') || data[0];
        
        let enabledSections = ['summary', 'trends', 'severity', 'department'];
        if (settings.enabledSections) {
            try {
                if (typeof settings.enabledSections === 'string') {
                    const raw = String(settings.enabledSections).trim();
                    // Backward compatibility: old JSON array or new comma-separated string
                    if (raw.startsWith('[') || raw.startsWith('{')) {
                        enabledSections = JSON.parse(raw);
                    } else {
                        enabledSections = raw.split(',').map(s => s.trim()).filter(Boolean);
                    }
                } else if (Array.isArray(settings.enabledSections)) {
                    enabledSections = settings.enabledSections;
                }
            } catch (e) {
                Logger.log('Error parsing enabledSections: ' + e.toString());
            }
        }
        
        return {
            success: true,
            data: {
                enabledSections: enabledSections,
                updatedAt: settings.updatedAt,
                updatedBy: settings.updatedBy
            }
        };
    } catch (error) {
        Logger.log('Error getting incident analysis settings: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء قراءة إعدادات التحليل: ' + error.toString(),
            data: {
                enabledSections: ['summary', 'trends', 'severity', 'department']
            }
        };
    }
}

/**
 * حفظ إعدادات تحليل الحوادث
 */
function saveIncidentAnalysisSettings(requestData) {
    try {
        // التحقق من الصلاحيات
        const userData = requestData?.userData || {};
        const permissionCheck = checkIncidentPermissions(userData, 'edit');
        if (!permissionCheck.hasPermission) {
            return { success: false, message: permissionCheck.message };
        }
        
        const settings = requestData?.settings || {};
        const sheetName = 'Incident_Analysis_Settings';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود الجدول
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        let sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            // إنشاء الجدول إذا لم يكن موجوداً
            sheet = spreadsheet.insertSheet(sheetName);
            const headers = ['id', 'enabledSections', 'updatedAt', 'updatedBy', 'createdAt'];
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const existingIndex = data.findIndex(s => s.id === 'default');
        
        const settingsData = {
            id: 'default',
            // ✅ Store as plain text (NO JSON)
            enabledSections: (settings.enabledSections || ['summary', 'trends', 'severity', 'department']).join(', '),
            updatedAt: new Date(),
            updatedBy: settings.updatedBy || userData.email || userData.name || 'Unknown',
            createdAt: existingIndex >= 0 ? data[existingIndex].createdAt : new Date()
        };
        
        if (existingIndex >= 0) {
            // تحديث الإعدادات الموجودة بدون مسح/استبدال باقي الصفوف
            return updateSingleRowInSheet(sheetName, 'default', settingsData, spreadsheetId);
        } else {
            // إضافة إعدادات جديدة
            return appendToSheet(sheetName, settingsData);
        }
    } catch (error) {
        Logger.log('Error saving incident analysis settings: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ إعدادات التحليل: ' + error.toString() };
    }
}

