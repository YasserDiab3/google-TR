/**
 * Google Apps Script for HSE System - KPIs Module
 *
 * موديول مؤشرات الأداء - النسخة المحسنة
 */

/**
 * إضافة مؤشر أداء
 */
function addKPIToSheet(kpiData) {
    try {
        if (!kpiData) {
            return { success: false, message: 'بيانات المؤشر غير موجودة' };
        }

        // محاولة تحديد نوع الورقة من البيانات
        let sheetName = 'KPIs';
        if (kpiData && (kpiData.kpiName || kpiData.name) && (kpiData.category === 'سلامة' || kpiData.type === 'safety')) {
            sheetName = 'SafetyPerformanceKPIs';
        }

        // إضافة حقول تلقائية
        if (!kpiData.id) {
            kpiData.id = Utilities.getUuid();
        }
        if (!kpiData.createdAt) {
            kpiData.createdAt = new Date();
        }
        if (!kpiData.updatedAt) {
            kpiData.updatedAt = new Date();
        }
        if (!kpiData.status) {
            kpiData.status = 'نشط';
        }

        return appendToSheet(sheetName, kpiData);
    } catch (error) {
        Logger.log('Error in addKPIToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المؤشر: ' + error.toString() };
    }
}

// ... existing code ...

/**
 * حذف مؤشر أداء
 */
function deleteKPI(kpiId) {
    try {
        if (!kpiId) {
            return { success: false, message: 'معرف المؤشر غير محدد' };
        }

        // البحث في كلا الورقتين
        let sheetName = 'KPIs';
        let spreadsheetId = getSpreadsheetId();

        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return {
                success: false,
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.'
            };
        }

        let data = readFromSheet(sheetName, spreadsheetId);
        let filteredData = data.filter(k => k.id !== kpiId);

        if (filteredData.length === data.length) {
            // البحث في ورقة Safety KPIs
            sheetName = 'SafetyPerformanceKPIs';
            data = readFromSheet(sheetName, spreadsheetId);
            filteredData = data.filter(k => k.id !== kpiId);
        }

        if (filteredData.length === data.length) {
            return { success: false, message: 'المؤشر غير موجود' };
        }

        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting KPI: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف المؤشر: ' + error.toString() };
    }
}

/**
 * =====================================================
 * KPI Annual Plan Functions (الخطة السنوية لمؤشرات الأداء)
 * =====================================================
 */

/**
 * الحصول على جميع خطط مؤشرات الأداء السنوية
 */
function getKPIAnnualPlans(filters = {}) {
    try {
        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('KPIAnnualPlans', spreadsheetId);
        
        // تطبيق الفلاتر
        if (filters.year) {
            data = data.filter(k => k.year == filters.year);
        }
        if (filters.indicatorType) {
            data = data.filter(k => k.indicatorType === filters.indicatorType);
        }
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error in getKPIAnnualPlans: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة الخطط السنوية: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة أو تحديث خطة مؤشر أداء سنوية
 */
function saveKPIAnnualPlan(planData) {
    try {
        if (!planData) {
            return { success: false, message: 'بيانات الخطة غير موجودة' };
        }

        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('KPIAnnualPlans', spreadsheetId);
        
        // إذا كان هناك معرف، نقوم بالتحديث
        if (planData.id) {
            const index = data.findIndex(k => k.id === planData.id);
            if (index !== -1) {
                planData.updatedAt = new Date();
                for (let key in planData) {
                    if (planData.hasOwnProperty(key)) {
                        data[index][key] = planData[key];
                    }
                }
                return saveToSheet('KPIAnnualPlans', data, spreadsheetId);
            }
        }
        
        // إضافة جديد
        if (!planData.id) {
            planData.id = Utilities.getUuid();
        }
        if (!planData.createdAt) {
            planData.createdAt = new Date();
        }
        planData.updatedAt = new Date();
        
        return appendToSheet('KPIAnnualPlans', planData);
    } catch (error) {
        Logger.log('Error in saveKPIAnnualPlan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ الخطة السنوية: ' + error.toString() };
    }
}

/**
 * حذف خطة مؤشر أداء سنوية
 */
function deleteKPIAnnualPlan(planId) {
    try {
        if (!planId) {
            return { success: false, message: 'معرف الخطة غير محدد' };
        }

        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('KPIAnnualPlans', spreadsheetId);
        const filteredData = data.filter(k => k.id !== planId);

        if (filteredData.length === data.length) {
            return { success: false, message: 'الخطة غير موجودة' };
        }

        return saveToSheet('KPIAnnualPlans', filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteKPIAnnualPlan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف الخطة السنوية: ' + error.toString() };
    }
}

/**
 * =====================================================
 * HSE Monitoring Plan Functions (خطة متابعة HSE)
 * =====================================================
 */

/**
 * الحصول على جميع أنشطة خطة متابعة HSE
 */
function getHSEMonitoringPlans(filters = {}) {
    try {
        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('HSEMonitoringPlans', spreadsheetId);
        
        // تطبيق الفلاتر
        if (filters.year) {
            data = data.filter(k => k.year == filters.year);
        }
        if (filters.frequency) {
            data = data.filter(k => k.frequency === filters.frequency);
        }
        if (filters.activityType) {
            data = data.filter(k => k.activityType === filters.activityType);
        }
        
        return { success: true, data: data, count: data.length };
    } catch (error) {
        Logger.log('Error in getHSEMonitoringPlans: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة خطط المتابعة: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة أو تحديث نشاط في خطة متابعة HSE
 */
function saveHSEMonitoringPlan(planData) {
    try {
        if (!planData) {
            return { success: false, message: 'بيانات النشاط غير موجودة' };
        }

        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('HSEMonitoringPlans', spreadsheetId);
        
        // إذا كان هناك معرف، نقوم بالتحديث
        if (planData.id) {
            const index = data.findIndex(k => k.id === planData.id);
            if (index !== -1) {
                planData.updatedAt = new Date();
                for (let key in planData) {
                    if (planData.hasOwnProperty(key)) {
                        data[index][key] = planData[key];
                    }
                }
                return saveToSheet('HSEMonitoringPlans', data, spreadsheetId);
            }
        }
        
        // إضافة جديد
        if (!planData.id) {
            planData.id = Utilities.getUuid();
        }
        if (!planData.createdAt) {
            planData.createdAt = new Date();
        }
        planData.updatedAt = new Date();
        
        return appendToSheet('HSEMonitoringPlans', planData);
    } catch (error) {
        Logger.log('Error in saveHSEMonitoringPlan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ خطة المتابعة: ' + error.toString() };
    }
}

/**
 * حذف نشاط من خطة متابعة HSE
 */
function deleteHSEMonitoringPlan(planId) {
    try {
        if (!planId) {
            return { success: false, message: 'معرف النشاط غير محدد' };
        }

        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('HSEMonitoringPlans', spreadsheetId);
        const filteredData = data.filter(k => k.id !== planId);

        if (filteredData.length === data.length) {
            return { success: false, message: 'النشاط غير موجود' };
        }

        return saveToSheet('HSEMonitoringPlans', filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteHSEMonitoringPlan: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف النشاط: ' + error.toString() };
    }
}

/**
 * تحديث التنفيذ الشهري لنشاط في خطة متابعة HSE
 */
function updateHSEMonitoringMonthlyExecution(planId, monthData) {
    try {
        if (!planId || !monthData) {
            return { success: false, message: 'البيانات غير كاملة' };
        }

        const spreadsheetId = getSpreadsheetId();
        let data = readFromSheet('HSEMonitoringPlans', spreadsheetId);
        const index = data.findIndex(k => k.id === planId);

        if (index === -1) {
            return { success: false, message: 'النشاط غير موجود' };
        }

        // تحديث بيانات الشهر المحدد
        const month = monthData.month; // Jan, Feb, Mar, etc.
        data[index]['executed_' + month] = monthData.executed || 0;
        data[index]['target_' + month] = monthData.target || 0;
        data[index]['notes_' + month] = monthData.notes || '';
        data[index].updatedAt = new Date();

        return saveToSheet('HSEMonitoringPlans', data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateHSEMonitoringMonthlyExecution: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث التنفيذ الشهري: ' + error.toString() };
    }
}

