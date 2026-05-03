/**
 * Google Apps Script for HSE System - Module Management
 * 
 * موديول إدارة الموديولات
 * يسمح لمدير النظام بتحديث أو حذف الموديولات
 */

/**
 * ============================================
 * تعريف الموديولات المتاحة في النظام
 * ============================================
 */
function getSystemModules() {
    return [
        {
            id: 'users',
            name: 'إدارة المستخدمين',
            description: 'إدارة المستخدمين والصلاحيات',
            file: 'Users.gs',
            sheet: 'Users',
            version: '1.0.0',
            enabled: true,
            critical: true // موديول حرج - لا يمكن حذفه
        },
        {
            id: 'safety-health-management',
            name: 'إدارة السلامة والصحة المهنية',
            description: 'إدارة فريق السلامة، الهيكل الوظيفي، مؤشرات الأداء',
            file: 'SafetyHealthManagement.gs',
            sheets: ['SafetyTeamMembers', 'SafetyOrganizationalStructure', 'SafetyJobDescriptions', 'SafetyTeamKPIs', 'SafetyTeamTasks', 'SafetyTeamAttendance', 'SafetyTeamLeaves', 'SafetyHealthManagementSettings'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'user-tasks',
            name: 'مهام المستخدمين',
            description: 'إدارة المهام والتعليمات الموجهة للمستخدمين',
            file: 'UserTasks.gs',
            sheets: ['UserTasks', 'UserInstructions'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'incidents',
            name: 'الحوادث',
            description: 'تسجيل وإدارة الحوادث',
            file: 'Incidents.gs',
            sheet: 'Incidents',
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'near-miss',
            name: 'الحوادث الوشيكة',
            description: 'تسجيل الحوادث الوشيكة',
            file: 'NearMiss.gs',
            sheet: 'NearMiss',
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'ptw',
            name: 'تصاريح العمل',
            description: 'إدارة تصاريح العمل',
            file: 'PTW.gs',
            sheet: 'PTW',
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'training',
            name: 'التدريب',
            description: 'إدارة برامج التدريب',
            file: 'Training.gs',
            sheets: ['Training', 'EmployeeTrainingMatrix', 'ContractorTrainings', 'AnnualTrainingPlans', 'TrainingAttendance', 'TrainingAnalysisData'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'clinic',
            name: 'العيادة الطبية',
            description: 'إدارة العيادة الطبية والزيارات',
            file: 'Clinic.gs',
            sheets: ['ClinicVisits', 'Medications', 'SickLeave', 'Injuries', 'ClinicContractorInjuries', 'ClinicInventory'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'fire-equipment',
            name: 'معدات الإطفاء',
            description: 'إدارة معدات الإطفاء',
            file: 'FireEquipment.gs',
            sheets: ['FireEquipment', 'FireEquipmentAssets', 'FireEquipmentInspections'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'ppe',
            name: 'مهمات الوقاية',
            description: 'إدارة مهمات الوقاية الشخصية',
            file: 'PPE.gs',
            sheets: ['PPE', 'PPEMatrix', 'PPE_Stock', 'PPE_Transactions'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'periodic-inspection',
            name: 'الفحوصات الدورية',
            description: 'إدارة الفحوصات الدورية',
            file: 'PeriodicInspection.gs',
            sheets: ['PeriodicInspections', 'PeriodicInspectionCategories', 'PeriodicInspectionChecklists', 'PeriodicInspectionSchedules', 'PeriodicInspectionRecords'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'violations',
            name: 'المخالفات',
            description: 'إدارة المخالفات',
            file: 'Violations.gs',
            sheets: ['Violations', 'ViolationTypes', 'Violation_Types_DB'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'contractors',
            name: 'المقاولين',
            description: 'إدارة المقاولين',
            file: 'Contractors.gs',
            sheets: ['ApprovedContractors', 'ContractorEvaluations', 'ContractorApprovalRequests', 'ContractorDeletionRequests'], // ✅ تم إزالة 'Contractors'
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'employees',
            name: 'قاعدة بيانات الموظفين',
            description: 'إدارة قاعدة بيانات الموظفين',
            file: 'Employees.gs',
            sheets: ['Employees', 'ExternalWorkforceMonthly'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'safety',
            name: 'السلامة العامة',
            description: 'إدارة السلامة العامة',
            file: 'Safety.gs',
            sheets: ['BehaviorMonitoring', 'ChemicalSafety', 'DailyObservations', 'ObservationSites'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'iso',
            name: 'نظام ISO',
            description: 'إدارة نظام ISO',
            file: 'ISO.gs',
            sheets: ['ISODocuments', 'ISOProcedures', 'ISOForms', 'SOPJHA', 'LegalDocuments'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'risk-assessment',
            name: 'تقييم المخاطر',
            description: 'إدارة تقييم المخاطر',
            file: 'RiskAssessment.gs',
            sheet: 'RiskAssessments',
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'hse',
            name: 'HSE الشامل',
            description: 'إدارة HSE الشامل',
            file: 'HSE.gs',
            sheets: ['HSEAudits', 'HSENonConformities', 'HSECorrectiveActions', 'HSEObjectives', 'HSERiskAssessments'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'environmental',
            name: 'البيئة',
            description: 'إدارة البيئة والاستدامة',
            file: 'Environmental.gs',
            sheets: ['EnvironmentalAspects', 'EnvironmentalMonitoring', 'Sustainability', 'CarbonFootprint', 'WasteManagement', 'WasteManagement_RegularWasteTypes', 'WasteManagement_RegularWasteRecords', 'WasteManagement_RegularWasteSales', 'WasteManagement_HazardousWasteRecords', 'WaterManagement_Records', 'GasManagement_Records', 'ElectricityManagement_Records', 'EnergyEfficiency', 'WaterManagement', 'RecyclingPrograms'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'emergency',
            name: 'الطوارئ',
            description: 'إدارة الطوارئ',
            file: 'Emergency.gs',
            sheets: ['EmergencyAlerts', 'EmergencyPlans', 'EmergencyPlansUpdates'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'budget',
            name: 'الميزانية',
            description: 'إدارة ميزانية السلامة',
            file: 'Budget.gs',
            sheets: ['SafetyBudget', 'SafetyBudgets', 'SafetyBudgetTransactions'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'kpis',
            name: 'مؤشرات الأداء',
            description: 'إدارة مؤشرات الأداء',
            file: 'KPIs.gs',
            sheet: 'SafetyPerformanceKPIs',
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'action-tracking',
            name: 'متابعة الإجراءات',
            description: 'سجل متابعة الإجراءات',
            file: 'ActionTracking.gs',
            sheets: ['ActionTrackingRegister', 'ActionTrackingSettings'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'form-settings',
            name: 'إعدادات النماذج',
            description: 'إعدادات النماذج',
            file: 'FormSettings.gs',
            sheets: ['Form_Settings_DB'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'ai',
            name: 'الذكاء الاصطناعي',
            description: 'مساعد الذكاء الاصطناعي',
            file: 'AI.gs',
            sheets: ['AIAssistantSettings', 'UserAILog'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'logs',
            name: 'السجلات',
            description: 'سجلات النظام',
            file: 'Logs.gs',
            sheets: ['AuditLog', 'UserActivityLog'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'issue-tracking',
            name: 'تتبع المشاكل وحلولها',
            description: 'نظام تتبع المشاكل التقنية والوظيفية وحلولها',
            file: 'IssueTracking.gs',
            sheets: ['IssueTracking'],
            version: '1.0.0',
            enabled: true,
            critical: false
        },
        {
            id: 'change-management',
            name: 'إدارة التغيرات',
            description: 'تسجيل وموافقة ومتابعة طلبات التغيير (تقني، إداري، تنظيمي) مع تقييم مخاطر - مشابه SAP MoC',
            file: 'ChangeManagement.gs',
            sheets: ['ChangeRequests'],
            version: '1.0.0',
            enabled: true,
            critical: false
        }
    ];
}

/**
 * ============================================
 * الحصول على قائمة الموديولات
 * ============================================
 */
function getAllModules() {
    try {
        const modules = getSystemModules();
        const spreadsheetId = getSpreadsheetId();
        
        // الحصول على حالة الموديولات من قاعدة البيانات
        const moduleStatusData = readFromSheet('ModuleManagement', spreadsheetId);
        const moduleStatus = {};
        
        if (moduleStatusData && Array.isArray(moduleStatusData) && moduleStatusData.length > 0) {
            moduleStatusData.forEach(function(status) {
                if (status.moduleId) {
                    moduleStatus[status.moduleId] = status;
                }
            });
        }
        
        // دمج البيانات
        const result = modules.map(function(module) {
            const status = moduleStatus[module.id] || {};
            return {
                id: module.id,
                name: module.name,
                description: module.description,
                file: module.file,
                sheets: module.sheets || (module.sheet ? [module.sheet] : []),
                version: module.version,
                enabled: status.enabled !== undefined ? status.enabled : module.enabled,
                critical: module.critical || false,
                lastUpdated: status.lastUpdated || null,
                updatedBy: status.updatedBy || null,
                createdAt: status.createdAt || null
            };
        });
        
        return { success: true, data: result };
    } catch (error) {
        Logger.log('Error in getAllModules: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على الموديولات: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * التحقق من صلاحيات مدير النظام
 * ============================================
 */
function checkAdminPermissions(userData) {
    try {
        if (!userData) {
            return false;
        }
        
        // التحقق من أن المستخدم هو مدير النظام
        if (userData.role === 'admin' || userData.role === 'مدير النظام' || userData.role === 'system_admin') {
            return true;
        }
        
        // التحقق من الصلاحيات
        if (userData.permissions && (userData.permissions.admin === true || userData.permissions['manage-modules'] === true)) {
            return true;
        }
        
        return false;
    } catch (error) {
        Logger.log('Error checking admin permissions: ' + error.toString());
        return false;
    }
}

/**
 * ============================================
 * تحديث موديول
 * ============================================
 */
function updateModule(moduleId, updateData, userData) {
    try {
        // التحقق من صلاحيات مدير النظام
        if (!checkAdminPermissions(userData)) {
            return { 
                success: false, 
                message: 'ليس لديك صلاحية لتحديث الموديولات. هذه العملية محجوزة لمدير النظام فقط.',
                errorCode: 'PERMISSION_DENIED'
            };
        }
        
        if (!moduleId) {
            return { success: false, message: 'معرف الموديول غير محدد' };
        }
        
        const modules = getSystemModules();
        const module = modules.find(function(m) { return m.id === moduleId; });
        
        if (!module) {
            return { success: false, message: 'الموديول غير موجود' };
        }
        
        // التحقق من أن الموديول ليس حرجاً
        if (module.critical && updateData.enabled === false) {
            return { 
                success: false, 
                message: 'لا يمكن تعطيل هذا الموديول لأنه موديول حرج في النظام',
                errorCode: 'CRITICAL_MODULE'
            };
        }
        
        const sheetName = 'ModuleManagement';
        const spreadsheetId = getSpreadsheetId();
        
        // الحصول على البيانات الحالية
        let moduleStatusData = readFromSheet(sheetName, spreadsheetId);
        if (!moduleStatusData || !Array.isArray(moduleStatusData)) {
            moduleStatusData = [];
        }
        
        // البحث عن الموديول
        let moduleIndex = -1;
        for (let i = 0; i < moduleStatusData.length; i++) {
            if (moduleStatusData[i].moduleId === moduleId) {
                moduleIndex = i;
                break;
            }
        }
        
        // إعداد بيانات التحديث
        const updateInfo = {
            moduleId: moduleId,
            enabled: updateData.enabled !== undefined ? updateData.enabled : module.enabled,
            version: updateData.version || module.version,
            lastUpdated: new Date(),
            updatedBy: userData.email || userData.id || userData.name || 'Unknown',
            updatedByName: userData.name || userData.email || 'Unknown',
            notes: updateData.notes || ''
        };
        
        if (moduleIndex >= 0) {
            // تحديث موجود
            for (var key in updateInfo) {
                if (updateInfo.hasOwnProperty(key)) {
                    moduleStatusData[moduleIndex][key] = updateInfo[key];
                }
            }
        } else {
            // إضافة جديد
            updateInfo.id = Utilities.getUuid();
            updateInfo.createdAt = new Date();
            moduleStatusData.push(updateInfo);
        }
        
        // حفظ البيانات
        const saveResult = saveToSheet(sheetName, moduleStatusData, spreadsheetId);
        
        if (saveResult && saveResult.success) {
            // تسجيل النشاط
            try {
                const activityLog = {
                    id: Utilities.getUuid(),
                    action: 'update_module',
                    moduleId: moduleId,
                    moduleName: module.name,
                    userId: userData.id || userData.email,
                    userName: userData.name || userData.email,
                    timestamp: new Date(),
                    details: {
                        enabled: updateInfo.enabled,
                        version: updateInfo.version,
                        notes: updateInfo.notes
                    }
                };
                addUserActivityLogToSheet(activityLog);
            } catch (logError) {
                Logger.log('Warning: Could not log activity: ' + logError.toString());
            }
            
            return { 
                success: true, 
                message: 'تم تحديث الموديول بنجاح',
                data: updateInfo
            };
        } else {
            return { 
                success: false, 
                message: 'فشل حفظ التحديثات: ' + (saveResult?.message || 'خطأ غير معروف')
            };
        }
    } catch (error) {
        Logger.log('Error updating module: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث الموديول: ' + error.toString() };
    }
}

/**
 * ============================================
 * حذف موديول
 * ============================================
 */
function deleteModule(moduleId, userData) {
    try {
        // التحقق من صلاحيات مدير النظام
        if (!checkAdminPermissions(userData)) {
            return { 
                success: false, 
                message: 'ليس لديك صلاحية لحذف الموديولات. هذه العملية محجوزة لمدير النظام فقط.',
                errorCode: 'PERMISSION_DENIED'
            };
        }
        
        if (!moduleId) {
            return { success: false, message: 'معرف الموديول غير محدد' };
        }
        
        const modules = getSystemModules();
        const module = modules.find(function(m) { return m.id === moduleId; });
        
        if (!module) {
            return { success: false, message: 'الموديول غير موجود' };
        }
        
        // التحقق من أن الموديول ليس حرجاً
        if (module.critical) {
            return { 
                success: false, 
                message: 'لا يمكن حذف هذا الموديول لأنه موديول حرج في النظام',
                errorCode: 'CRITICAL_MODULE'
            };
        }
        
        const sheetName = 'ModuleManagement';
        const spreadsheetId = getSpreadsheetId();
        
        // الحصول على البيانات الحالية
        let moduleStatusData = readFromSheet(sheetName, spreadsheetId);
        if (!moduleStatusData || !Array.isArray(moduleStatusData)) {
            moduleStatusData = [];
        }
        
        // البحث عن الموديول وحذفه
        const filteredData = moduleStatusData.filter(function(status) {
            return status.moduleId !== moduleId;
        });
        
        // حفظ البيانات
        const saveResult = saveToSheet(sheetName, filteredData, spreadsheetId);
        
        if (saveResult && saveResult.success) {
            // تسجيل النشاط
            try {
                const activityLog = {
                    id: Utilities.getUuid(),
                    action: 'delete_module',
                    moduleId: moduleId,
                    moduleName: module.name,
                    userId: userData.id || userData.email,
                    userName: userData.name || userData.email,
                    timestamp: new Date(),
                    details: {
                        module: module.name,
                        file: module.file
                    }
                };
                addUserActivityLogToSheet(activityLog);
            } catch (logError) {
                Logger.log('Warning: Could not log activity: ' + logError.toString());
            }
            
            return { 
                success: true, 
                message: 'تم حذف الموديول بنجاح'
            };
        } else {
            return { 
                success: false, 
                message: 'فشل حذف الموديول: ' + (saveResult?.message || 'خطأ غير معروف')
            };
        }
    } catch (error) {
        Logger.log('Error deleting module: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الموديول: ' + error.toString() };
    }
}

/**
 * ============================================
 * الحصول على معلومات موديول محدد
 * ============================================
 */
function getModuleInfo(moduleId) {
    try {
        if (!moduleId) {
            return { success: false, message: 'معرف الموديول غير محدد' };
        }
        
        const modules = getSystemModules();
        const module = modules.find(function(m) { return m.id === moduleId; });
        
        if (!module) {
            return { success: false, message: 'الموديول غير موجود' };
        }
        
        const spreadsheetId = getSpreadsheetId();
        const moduleStatusData = readFromSheet('ModuleManagement', spreadsheetId);
        let status = {};
        
        if (moduleStatusData && Array.isArray(moduleStatusData)) {
            const moduleStatus = moduleStatusData.find(function(s) { return s.moduleId === moduleId; });
            if (moduleStatus) {
                status = moduleStatus;
            }
        }
        
        return {
            success: true,
            data: {
                id: module.id,
                name: module.name,
                description: module.description,
                file: module.file,
                sheets: module.sheets || (module.sheet ? [module.sheet] : []),
                version: status.version || module.version,
                enabled: status.enabled !== undefined ? status.enabled : module.enabled,
                critical: module.critical || false,
                lastUpdated: status.lastUpdated || null,
                updatedBy: status.updatedBy || null,
                updatedByName: status.updatedByName || null,
                createdAt: status.createdAt || null,
                notes: status.notes || ''
            }
        };
    } catch (error) {
        Logger.log('Error getting module info: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على معلومات الموديول: ' + error.toString() };
    }
}

