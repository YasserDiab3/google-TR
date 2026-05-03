/**
 * Google Apps Script for HSE System - Action Tracking Module
 * 
 * موديول متابعة الإجراءات التصحيحية والوقائية - النسخة المحسنة
 * 
 * المميزات:
 * - إدارة كاملة للإجراءات التصحيحية والوقائية
 * - فلاتر ذكية ديناميكية (Type → Classification → Root Cause)
 * - ربط تلقائي مع جميع الموديولات
 * - سجل زمني كامل لكل إجراء
 * - إعدادات قابلة للتخصيص
 */

/**
 * إضافة إجراء متابعة جديد
 */
function addActionTrackingToSheet(actionData) {
    try {
        const sheetName = 'ActionTrackingRegister';
        
        // التحقق من البيانات المطلوبة
        if (!actionData) {
            return { success: false, message: 'لا توجد بيانات للإضافة' };
        }
        
        // توليد ID تلقائي إذا لم يكن موجوداً
        if (!actionData.id) {
            actionData.id = generateSequentialId('ATR', sheetName);
        }
        
        // إضافة التواريخ التلقائية
        if (!actionData.createdAt) {
            actionData.createdAt = new Date().toISOString();
        }
        if (!actionData.updatedAt) {
            actionData.updatedAt = new Date().toISOString();
        }
        
        // ✅ إضافة سجل زمني أولي - array (سيتم تحويله تلقائياً بواسطة toSheetCellValue_)
        if (!actionData.timeLog) {
            actionData.timeLog = [{
                action: 'created',
                user: actionData.createdBy || 'System',
                timestamp: new Date().toISOString(),
                note: 'تم إنشاء الإجراء'
            }];
        }
        
        // ✅ إضافة مصفوفة التحديثات إذا لم تكن موجودة
        if (!actionData.updates) {
            actionData.updates = [];
        }
        
        // ✅ إضافة مصفوفة التعليقات إذا لم تكن موجودة
        if (!actionData.comments) {
            actionData.comments = [];
        }
        
        return appendToSheet(sheetName, actionData);
    } catch (error) {
        Logger.log('Error in addActionTrackingToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإجراء: ' + error.toString() };
    }
}

/**
 * تحديث إجراء متابعة
 */
function updateActionTracking(actionId, updateData) {
    try {
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const actionIndex = data.findIndex(a => a.id === actionId);
        
        if (actionIndex === -1) {
            return { success: false, message: 'الإجراء غير موجود' };
        }
        
        const existingAction = data[actionIndex];
        
        // تحديث البيانات
        const updatedAction = {
            ...existingAction,
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        // ✅ إضافة سجل زمني للتحديث - array (سيتم تحويله تلقائياً)
        let timeLog = [];
        try {
            // قراءة timeLog الحالي - قد يكون array أو string
            if (Array.isArray(existingAction.timeLog)) {
                timeLog = existingAction.timeLog;
            } else if (typeof existingAction.timeLog === 'string' && existingAction.timeLog) {
                try {
                    timeLog = JSON.parse(existingAction.timeLog);
                } catch (e) {
                    timeLog = [];
                }
            }
        } catch (e) {
            timeLog = [];
        }
        
        timeLog.push({
            action: 'updated',
            user: updateData.updatedBy || 'System',
            timestamp: new Date().toISOString(),
            note: updateData.updateNote || 'تم تحديث الإجراء',
            changes: updateData.changes || {}
        });
        
        // ✅ حفظ كـ array (بدون JSON.stringify)
        updatedAction.timeLog = timeLog;
        
        // تحديث الحالة في السجل الزمني
        if (updateData.status && updateData.status !== existingAction.status) {
            timeLog.push({
                action: 'status_changed',
                user: updateData.updatedBy || 'System',
                timestamp: new Date().toISOString(),
                note: `تم تغيير الحالة من ${existingAction.status} إلى ${updateData.status}`,
                oldStatus: existingAction.status,
                newStatus: updateData.status
            });
            updatedAction.timeLog = timeLog;
        }
        
        // إذا تم الإغلاق، إضافة سجل الإغلاق
        if (updateData.status === 'Closed' || updateData.status === 'مغلق' || updateData.status === 'مكتمل') {
            updatedAction.closedAt = new Date().toISOString();
            updatedAction.closedBy = updateData.updatedBy || updateData.closedBy || 'System';
            
            timeLog.push({
                action: 'closed',
                user: updatedAction.closedBy,
                timestamp: new Date().toISOString(),
                note: 'تم إغلاق الإجراء'
            });
            updatedAction.timeLog = timeLog;
        }
        
        // ✅ تحديث الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        return updateSingleRowInSheet(sheetName, actionId, updatedAction, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateActionTracking: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الإجراء: ' + error.toString() };
    }
}

/**
 * حذف إجراء متابعة
 */
function deleteActionTracking(actionId) {
    try {
        if (!actionId) {
            return { success: false, message: 'معرف الإجراء غير محدد' };
        }
        
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
            };
        }
        
        // ✅ حذف الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        return deleteRowById(sheetName, actionId, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteActionTracking: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الإجراء: ' + error.toString() };
    }
}

/**
 * الحصول على إجراء محدد
 */
function getActionTracking(actionId) {
    try {
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const action = data.find(a => a.id === actionId);
        
        if (!action) {
            return { success: false, message: 'الإجراء غير موجود' };
        }
        
        return { success: true, data: action };
    } catch (error) {
        Logger.log('Error in getActionTracking: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإجراء: ' + error.toString() };
    }
}

/**
 * الحصول على جميع الإجراءات
 */
function getAllActionTracking() {
    try {
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد', data: [] };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        return { success: true, data: data || [] };
    } catch (error) {
        Logger.log('Error in getAllActionTracking: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإجراءات: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة تعليق على إجراء
 */
function addActionComment(actionId, commentData) {
    try {
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const actionIndex = data.findIndex(a => a.id === actionId);
        
        if (actionIndex === -1) {
            return { success: false, message: 'الإجراء غير موجود' };
        }
        
        const action = data[actionIndex];
        
        // ✅ تحليل التعليقات الحالية
        let comments = [];
        try {
            if (Array.isArray(action.comments)) {
                comments = action.comments;
            } else if (typeof action.comments === 'string' && action.comments) {
                try {
                    comments = JSON.parse(action.comments);
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
        action.comments = comments;
        action.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(action.timeLog)) {
                timeLog = action.timeLog;
            } else if (typeof action.timeLog === 'string' && action.timeLog) {
                try {
                    timeLog = JSON.parse(action.timeLog);
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
            note: 'تم إضافة تعليق'
        });
        
        // ✅ حفظ كـ array
        action.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, actionId, {
            comments: action.comments,
            timeLog: action.timeLog,
            updatedAt: action.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addActionComment: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التعليق: ' + error.toString() };
    }
}

/**
 * إضافة تحديث على إجراء
 */
function addActionUpdate(actionId, updateData) {
    try {
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const actionIndex = data.findIndex(a => a.id === actionId);
        
        if (actionIndex === -1) {
            return { success: false, message: 'الإجراء غير موجود' };
        }
        
        const action = data[actionIndex];
        
        // ✅ تحليل التحديثات الحالية
        let updates = [];
        try {
            if (Array.isArray(action.updates)) {
                updates = action.updates;
            } else if (typeof action.updates === 'string' && action.updates) {
                try {
                    updates = JSON.parse(action.updates);
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
        action.updates = updates;
        action.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(action.timeLog)) {
                timeLog = action.timeLog;
            } else if (typeof action.timeLog === 'string' && action.timeLog) {
                try {
                    timeLog = JSON.parse(action.timeLog);
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
            note: 'تم إضافة تحديث'
        });
        
        // ✅ حفظ كـ array
        action.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, actionId, {
            updates: action.updates,
            timeLog: action.timeLog,
            updatedAt: action.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addActionUpdate: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التحديث: ' + error.toString() };
    }
}

/**
 * إنشاء إجراء تلقائي من موديول آخر
 */
function createActionFromModule(sourceModule, sourceId, sourceData) {
    try {
        const actionData = {
            id: generateSequentialId('ATR', 'ActionTrackingRegister'),
            serialNumber: '', // سيتم توليده تلقائياً
            issueDate: sourceData.date || sourceData.issueDate || new Date().toISOString().split('T')[0],
            typeOfIssue: sourceModule, // Observations, Incidents, NearMiss, Inspections, ManagementReviews
            observationClassification: sourceData.classification || sourceData.type || '',
            observationIssueHazard: sourceData.description || sourceData.issue || sourceData.observation || '',
            correctivePreventiveAction: sourceData.correctiveAction || sourceData.action || '',
            rootCause: sourceData.rootCause || '',
            department: sourceData.department || '',
            location: sourceData.location || '',
            riskRating: sourceData.riskRating || sourceData.severity || 'Medium',
            responsible: sourceData.responsible || sourceData.reportedBy || '',
            originalTargetDate: sourceData.targetDate || sourceData.dueDate || '',
            status: 'Open', // Open, In Progress, Closed, Overdue
            observerName: sourceData.observerName || sourceData.reportedBy || sourceData.createdBy || '',
            shift: sourceData.shift || '',
            sourceModule: sourceModule,
            sourceId: sourceId,
            // ✅ sourceData كـ object (سيتم تحويله تلقائياً لنص منظم)
            sourceData: sourceData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: sourceData.createdBy || 'System',
            // ✅ timeLog كـ array
            timeLog: [{
                action: 'auto_created',
                user: 'System',
                timestamp: new Date().toISOString(),
                note: `تم إنشاء الإجراء تلقائياً من ${sourceModule}`,
                sourceId: sourceId
            }],
            // ✅ arrays فارغة
            updates: [],
            comments: []
        };
        
        // توليد رقم تسلسلي
        const allActions = readFromSheet('ActionTrackingRegister', getSpreadsheetId());
        actionData.serialNumber = (allActions.length + 1).toString();
        
        return addActionTrackingToSheet(actionData);
    } catch (error) {
        Logger.log('Error in createActionFromModule: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إنشاء الإجراء التلقائي: ' + error.toString() };
    }
}

/**
 * الحصول على إعدادات Action Tracking
 */
function getActionTrackingSettings() {
    try {
        const sheetName = 'ActionTrackingSettings';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد', data: getDefaultSettings() };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        
        if (!data || data.length === 0) {
            return { success: true, data: getDefaultSettings() };
        }
        
        // دمج جميع الإعدادات في كائن واحد
        const settings = data[0];
        
        // تحليل JSON strings
        if (typeof settings.typeOfIssueList === 'string') {
            try {
                settings.typeOfIssueList = JSON.parse(settings.typeOfIssueList);
            } catch (e) {
                settings.typeOfIssueList = [];
            }
        }
        
        if (typeof settings.classificationList === 'string') {
            try {
                settings.classificationList = JSON.parse(settings.classificationList);
            } catch (e) {
                settings.classificationList = [];
            }
        }
        
        if (typeof settings.rootCauseList === 'string') {
            try {
                settings.rootCauseList = JSON.parse(settings.rootCauseList);
            } catch (e) {
                settings.rootCauseList = [];
            }
        }
        
        if (typeof settings.typeClassificationMapping === 'string') {
            try {
                settings.typeClassificationMapping = JSON.parse(settings.typeClassificationMapping);
            } catch (e) {
                settings.typeClassificationMapping = {};
            }
        }
        
        if (typeof settings.classificationRootCauseMapping === 'string') {
            try {
                settings.classificationRootCauseMapping = JSON.parse(settings.classificationRootCauseMapping);
            } catch (e) {
                settings.classificationRootCauseMapping = {};
            }
        }
        
        if (typeof settings.statusList === 'string') {
            try {
                settings.statusList = JSON.parse(settings.statusList);
            } catch (e) {
                settings.statusList = [];
            }
        }
        
        if (typeof settings.riskRatingList === 'string') {
            try {
                settings.riskRatingList = JSON.parse(settings.riskRatingList);
            } catch (e) {
                settings.riskRatingList = [];
            }
        }
        
        if (typeof settings.departmentList === 'string') {
            try {
                settings.departmentList = JSON.parse(settings.departmentList);
            } catch (e) {
                settings.departmentList = [];
            }
        }
        
        if (typeof settings.locationList === 'string') {
            try {
                settings.locationList = JSON.parse(settings.locationList);
            } catch (e) {
                settings.locationList = [];
            }
        }
        
        if (typeof settings.responsibleList === 'string') {
            try {
                settings.responsibleList = JSON.parse(settings.responsibleList);
            } catch (e) {
                settings.responsibleList = [];
            }
        }
        
        if (typeof settings.shiftList === 'string') {
            try {
                settings.shiftList = JSON.parse(settings.shiftList);
            } catch (e) {
                settings.shiftList = [];
            }
        }
        
        return { success: true, data: settings };
    } catch (error) {
        Logger.log('Error in getActionTrackingSettings: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الإعدادات: ' + error.toString(), data: getDefaultSettings() };
    }
}

/**
 * التحقق من صلاحيات المستخدم للوصول إلى الإعدادات
 */
function checkActionTrackingSettingsPermission(userData) {
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
        const userPermissions = userData.permissions || {};
        if (typeof userPermissions === 'string') {
            try {
                userPermissions = JSON.parse(userPermissions);
            } catch (e) {
                userPermissions = {};
            }
        }
        
        // التحقق من صلاحية 'action-tracking-settings' أو 'admin'
        if (userPermissions['action-tracking-settings'] === true || 
            userPermissions['admin'] === true ||
            userPermissions['manage-settings'] === true) {
            return { hasPermission: true, message: 'صلاحية صحيحة' };
        }
        
        return { 
            hasPermission: false, 
            message: 'ليس لديك صلاحية للوصول إلى إعدادات Action Tracking. يجب أن تكون مدير النظام أو لديك صلاحية خاصة.' 
        };
    } catch (error) {
        Logger.log('Error checking permissions: ' + error.toString());
        return { hasPermission: false, message: 'حدث خطأ أثناء التحقق من الصلاحيات' };
    }
}

/**
 * حفظ إعدادات Action Tracking
 */
function saveActionTrackingSettings(settingsData) {
    try {
        // التحقق من الصلاحيات
        const userData = settingsData.userData || settingsData.user || {};
        const permissionCheck = checkActionTrackingSettingsPermission(userData);
        
        if (!permissionCheck.hasPermission) {
            return { 
                success: false, 
                message: permissionCheck.message || 'ليس لديك صلاحية لحفظ الإعدادات',
                errorCode: 'PERMISSION_DENIED'
            };
        }
        
        const sheetName = 'ActionTrackingSettings';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        // ✅ تحويل المصفوفات والكائنات - دع toSheetCellValue_() تتعامل معها
        const processedSettings = {
            id: settingsData.id || 'SETTINGS-1',
            typeOfIssueList: settingsData.typeOfIssueList || [],
            classificationList: settingsData.classificationList || [],
            rootCauseList: settingsData.rootCauseList || [],
            typeClassificationMapping: settingsData.typeClassificationMapping || {},
            classificationRootCauseMapping: settingsData.classificationRootCauseMapping || {},
            statusList: settingsData.statusList || [],
            riskRatingList: settingsData.riskRatingList || [],
            departmentList: settingsData.departmentList || [],
            locationList: settingsData.locationList || [],
            responsibleList: settingsData.responsibleList || [],
            shiftList: settingsData.shiftList || [],
            permissions: settingsData.permissions || {},
            updatedAt: new Date().toISOString()
        };
        
        // حفظ الإعدادات (استبدال كامل)
        return saveToSheet(sheetName, [processedSettings], spreadsheetId);
    } catch (error) {
        Logger.log('Error in saveActionTrackingSettings: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ الإعدادات: ' + error.toString() };
    }
}

/**
 * الإعدادات الافتراضية
 */
function getDefaultSettings() {
    return {
        id: 'SETTINGS-1',
        typeOfIssueList: ['Observations', 'Incidents', 'NearMiss', 'Inspections', 'ManagementReviews', 'Audits', 'Other'],
        classificationList: ['Safety Violation', 'Environmental Issue', 'Health Concern', 'Process Deviation', 'Equipment Failure', 'Training Gap', 'Documentation Issue', 'Other'],
        rootCauseList: ['Lack of Training', 'Inadequate Procedures', 'Equipment Failure', 'Human Error', 'Management System Failure', 'Environmental Factors', 'Communication Gap', 'Other'],
        typeClassificationMapping: {
            'Observations': ['Safety Violation', 'Environmental Issue', 'Health Concern', 'Process Deviation', 'Other'],
            'Incidents': ['Safety Violation', 'Equipment Failure', 'Health Concern', 'Other'],
            'NearMiss': ['Safety Violation', 'Process Deviation', 'Equipment Failure', 'Other'],
            'Inspections': ['Safety Violation', 'Equipment Failure', 'Process Deviation', 'Documentation Issue', 'Other'],
            'ManagementReviews': ['Process Deviation', 'Documentation Issue', 'Training Gap', 'Other']
        },
        classificationRootCauseMapping: {
            'Safety Violation': ['Lack of Training', 'Inadequate Procedures', 'Human Error', 'Management System Failure', 'Other'],
            'Environmental Issue': ['Inadequate Procedures', 'Equipment Failure', 'Environmental Factors', 'Other'],
            'Health Concern': ['Lack of Training', 'Inadequate Procedures', 'Environmental Factors', 'Other'],
            'Process Deviation': ['Inadequate Procedures', 'Management System Failure', 'Communication Gap', 'Other'],
            'Equipment Failure': ['Equipment Failure', 'Inadequate Procedures', 'Other'],
            'Training Gap': ['Lack of Training', 'Management System Failure', 'Other'],
            'Documentation Issue': ['Inadequate Procedures', 'Management System Failure', 'Communication Gap', 'Other']
        },
        statusList: ['Open', 'In Progress', 'Closed', 'Overdue'],
        riskRatingList: ['Low', 'Medium', 'High', 'Critical'],
        departmentList: ['Production', 'Maintenance', 'Quality', 'Safety', 'HR', 'Admin', 'Other'],
        locationList: ['Factory A', 'Factory B', 'Warehouse', 'Office', 'Other'],
        responsibleList: [],
        shiftList: ['Morning', 'Afternoon', 'Night'],
        permissions: {
            allowEdit: true,
            allowClose: true,
            allowDelete: false
        }
    };
}

/**
 * الحصول على KPIs للإجراءات
 */
function getActionTrackingKPIs() {
    try {
        const sheetName = 'ActionTrackingRegister';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد', data: {} };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        
        if (!data || data.length === 0) {
            return {
                success: true,
                data: {
                    total: 0,
                    open: 0,
                    inProgress: 0,
                    closed: 0,
                    overdue: 0
                }
            };
        }
        
        const now = new Date();
        const kpis = {
            total: data.length,
            open: 0,
            inProgress: 0,
            closed: 0,
            overdue: 0
        };
        
        data.forEach(action => {
            const status = (action.status || '').toLowerCase();
            
            if (status.includes('open') || status.includes('مفتوح') || status.includes('جديد')) {
                kpis.open++;
            } else if (status.includes('progress') || status.includes('تنفيذ') || status.includes('جاري')) {
                kpis.inProgress++;
            } else if (status.includes('closed') || status.includes('مغلق') || status.includes('مكتمل')) {
                kpis.closed++;
            }
            
            // التحقق من التأخير
            if (action.originalTargetDate) {
                try {
                    const targetDate = new Date(action.originalTargetDate);
                    if (targetDate < now && !status.includes('closed') && !status.includes('مغلق') && !status.includes('مكتمل')) {
                        kpis.overdue++;
                    }
                } catch (e) {
                    // تجاهل خطأ التاريخ
                }
            }
        });
        
        return { success: true, data: kpis };
    } catch (error) {
        Logger.log('Error in getActionTrackingKPIs: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حساب KPIs: ' + error.toString(), data: {} };
    }
}
