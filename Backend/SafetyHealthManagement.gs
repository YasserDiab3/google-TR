/**
 * Google Apps Script for HSE System - Safety & Health Management Module
 * 
 * موديول إدارة السلامة والصحة المهنية
 * 
 * هذا الموديول الشامل يدير:
 * 1. إدارة فريق السلامة
 * 2. الهيكل الوظيفي
 * 3. الوصف الوظيفي
 * 4. مؤشرات الأداء
 * 5. تقارير الأداء
 * 6. الحضور والإجازات
 * 7. إعدادات الموديول
 */

/**
 * ============================================
 * 1. إدارة فريق السلامة (Safety Team Management)
 * ============================================
 */

/**
 * إضافة عضو جديد لفريق السلامة
 */
function addSafetyTeamMemberToSheet(memberData) {
    try {
        if (!memberData) {
            return { success: false, message: 'بيانات العضو غير موجودة' };
        }
        
        const sheetName = 'SafetyTeamMembers';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من تكرار العضو بالكود الوظيفي فقط
        try {
            const employeeCode = (memberData.employeeCode || '').trim();
            
            // التحقق فقط إذا كان الكود الوظيفي موجوداً
            if (employeeCode) {
                const existingMembers = readFromSheet(sheetName, spreadsheetId);
                if (existingMembers && existingMembers.length > 0) {
                    for (var i = 0; i < existingMembers.length; i++) {
                        const existing = existingMembers[i];
                        const existingCode = (existing.employeeCode || '').trim();
                        
                        // التحقق من التكرار بالكود الوظيفي فقط
                        if (existingCode && employeeCode === existingCode) {
                            return { success: false, message: 'العضو موجود بالفعل في فريق السلامة بنفس الكود الوظيفي' };
                        }
                    }
                }
            }
        } catch (checkError) {
            Logger.log('Warning: Could not check for duplicates: ' + checkError.toString());
            // نستمر في الإضافة حتى لو فشل التحقق
        }
        
        // إضافة حقول تلقائية
        if (!memberData.id) {
            memberData.id = generateSequentialId('STM', sheetName, spreadsheetId);
        }
        if (!memberData.createdAt) {
            memberData.createdAt = new Date();
        }
        if (!memberData.updatedAt) {
            memberData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, memberData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addSafetyTeamMemberToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة العضو: ' + error.toString() };
    }
}

/**
 * تحديث بيانات عضو فريق السلامة
 */
function updateSafetyTeamMember(memberId, updateData) {
    try {
        const sheetName = 'SafetyTeamMembers';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let memberIndex = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === memberId) {
                memberIndex = i;
                break;
            }
        }
        
        if (memberIndex === -1) {
            return { success: false, message: 'عضو الفريق غير موجود' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[memberIndex][key] = updateData[key];
            }
        }
        
        // حفظ البيانات المحدثة
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating safety team member: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * الحصول على جميع أعضاء فريق السلامة
 */
function getSafetyTeamMembers() {
    try {
        const sheetName = 'SafetyTeamMembers';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            Logger.log('Warning: spreadsheetId not set, using default');
        }
        
        // محاولة قراءة البيانات
        let data;
        try {
            data = readFromSheet(sheetName, spreadsheetId);
        } catch (readError) {
            Logger.log('Error reading sheet in getSafetyTeamMembers: ' + readError.toString());
            // إذا فشلت القراءة، نرجع مصفوفة فارغة بدلاً من خطأ
            return { success: true, data: [] };
        }
        
        // التأكد من أن data هي مصفوفة
        if (!Array.isArray(data)) {
            Logger.log('Warning: data is not an array, converting to array');
            data = data ? [data] : [];
        }
        
        return { success: true, data: data || [] };
    } catch (error) {
        Logger.log('Error in getSafetyTeamMembers: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        // إرجاع مصفوفة فارغة بدلاً من خطأ لضمان استمرار عمل النظام
        return { success: true, data: [], message: 'تم الحصول على البيانات بنجاح (قد تكون فارغة)' };
    }
}

/**
 * الحصول على بيانات عضو محدد
 */
function getSafetyTeamMember(memberId) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد' };
        }
        
        const sheetName = 'SafetyTeamMembers';
        const data = readFromSheet(sheetName);
        
        if (!data || data.length === 0) {
            return { success: false, message: 'لا توجد بيانات لأعضاء الفريق' };
        }
        
        var member = null;
        var memberIdStr = String(memberId);
        for (var i = 0; i < data.length; i++) {
            if (data[i] && String(data[i].id) === memberIdStr) {
                member = data[i];
                break;
            }
        }
        
        if (!member) {
            return { success: false, message: 'عضو الفريق غير موجود' };
        }
        
        return { success: true, data: member };
    } catch (error) {
        Logger.log('Error in getSafetyTeamMember: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على بيانات العضو: ' + error.toString() };
    }
}

/**
 * حذف عضو من فريق السلامة
 */
function deleteSafetyTeamMember(memberId) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد' };
        }
        
        const sheetName = 'SafetyTeamMembers';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات.' 
            };
        }
        
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(function(member) {
            return member.id !== memberId;
        });
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'عضو الفريق غير موجود' };
        }
        
        // حفظ البيانات المحدثة
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting safety team member: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحذف: ' + error.toString() };
    }
}

/**
 * ============================================
 * 2. الهيكل الوظيفي (Organizational Structure)
 * ============================================
 */

/**
 * إضافة/تحديث الهيكل الوظيفي
 */
function saveOrganizationalStructureToSheet(structureData) {
    try {
        const sheetName = 'SafetyOrganizationalStructure';
        
        if (!structureData) {
            return { success: false, message: 'البيانات غير موجودة' };
        }
        
        // إضافة حقول تلقائية
        if (!structureData.id) {
            structureData.id = generateSequentialId('SOS', sheetName);
        }
        if (!structureData.createdAt) {
            structureData.createdAt = new Date();
        }
        if (!structureData.updatedAt) {
            structureData.updatedAt = new Date();
        }
        
        return saveToSheet(sheetName, structureData);
    } catch (error) {
        Logger.log('Error in saveOrganizationalStructureToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ الهيكل الوظيفي: ' + error.toString() };
    }
}

/**
 * الحصول على الهيكل الوظيفي
 */
function getOrganizationalStructure() {
    try {
        const sheetName = 'SafetyOrganizationalStructure';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            Logger.log('Warning: spreadsheetId not set, using default');
        }
        
        // محاولة قراءة البيانات
        let data;
        try {
            data = readFromSheet(sheetName, spreadsheetId);
        } catch (readError) {
            Logger.log('Error reading sheet in getOrganizationalStructure: ' + readError.toString());
            // إذا فشلت القراءة، نرجع مصفوفة فارغة بدلاً من خطأ
            return { success: true, data: [] };
        }
        
        // التأكد من أن data هي مصفوفة
        if (!Array.isArray(data)) {
            Logger.log('Warning: data is not an array, converting to array');
            data = data ? [data] : [];
        }
        
        return { success: true, data: data || [] };
    } catch (error) {
        Logger.log('Error in getOrganizationalStructure: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        // إرجاع مصفوفة فارغة بدلاً من خطأ لضمان استمرار عمل النظام
        return { success: true, data: [], message: 'تم الحصول على البيانات بنجاح (قد تكون فارغة)' };
    }
}

/**
 * تحديث ترتيب المناصب في الهيكل
 */
function updateOrganizationalStructureOrder(orderData) {
    try {
        const sheetName = 'SafetyOrganizationalStructure';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        // حفظ الترتيب الجديد
        return saveToSheet(sheetName, orderData, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating organizational structure: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * ============================================
 * 3. الوصف الوظيفي (Job Description)
 * ============================================
 */

/**
 * إضافة/تحديث الوصف الوظيفي
 */
function saveJobDescriptionToSheet(jobDescriptionData) {
    try {
        if (!jobDescriptionData) {
            return { success: false, message: 'بيانات الوصف الوظيفي غير موجودة' };
        }
        
        const sheetName = 'SafetyJobDescriptions';
        
        // إضافة حقول تلقائية
        if (!jobDescriptionData.id) {
            jobDescriptionData.id = generateSequentialId('SJD', sheetName);
        }
        if (!jobDescriptionData.createdAt) {
            jobDescriptionData.createdAt = new Date();
        }
        if (!jobDescriptionData.updatedAt) {
            jobDescriptionData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, jobDescriptionData);
    } catch (error) {
        Logger.log('Error in saveJobDescriptionToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ الوصف الوظيفي: ' + error.toString() };
    }
}

/**
 * الحصول على الوصف الوظيفي لعضو محدد
 */
function getJobDescription(memberId) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد' };
        }
        
        const sheetName = 'SafetyJobDescriptions';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات.' 
            };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        
        if (!data || data.length === 0) {
            // إرجاع قيم افتراضية فارغة بدلاً من خطأ
            return { 
                success: true, 
                data: null,
                isEmpty: true,
                message: 'لم يتم إنشاء وصف وظيفي بعد'
            };
        }
        
        var jobDescription = null;
        for (var i = 0; i < data.length; i++) {
            if (String(data[i].memberId) === String(memberId) || String(data[i].employeeId) === String(memberId)) {
                jobDescription = data[i];
                break;
            }
        }
        
        if (!jobDescription) {
            // إرجاع قيم افتراضية فارغة بدلاً من خطأ
            return { 
                success: true, 
                data: null,
                isEmpty: true,
                message: 'لم يتم إنشاء وصف وظيفي لهذا العضو بعد'
            };
        }
        
        return { success: true, data: jobDescription };
    } catch (error) {
        Logger.log('Error in getJobDescription: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على الوصف الوظيفي: ' + error.toString() };
    }
}

/**
 * تحديث الوصف الوظيفي
 */
function updateJobDescription(jobDescriptionId, updateData) {
    try {
        const sheetName = 'SafetyJobDescriptions';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let jobDescIndex = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === jobDescriptionId) {
                jobDescIndex = i;
                break;
            }
        }
        
        if (jobDescIndex === -1) {
            return { success: false, message: 'الوصف الوظيفي غير موجود' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[jobDescIndex][key] = updateData[key];
            }
        }
        
        // حفظ البيانات المحدثة
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating job description: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * ============================================
 * 4. مؤشرات الأداء (KPIs Tracking)
 * ============================================
 */

/**
 * إضافة مؤشر أداء لعضو فريق السلامة
 */
function addSafetyTeamKPIToSheet(kpiData) {
    try {
        if (!kpiData) {
            return { success: false, message: 'بيانات المؤشر غير موجودة' };
        }
        
        const sheetName = 'SafetyTeamKPIs';
        
        // إضافة حقول تلقائية
        if (!kpiData.id) {
            kpiData.id = generateSequentialId('STK', sheetName);
        }
        if (!kpiData.period) {
            const now = new Date();
            kpiData.period = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
        }
        if (!kpiData.createdAt) {
            kpiData.createdAt = new Date();
        }
        if (!kpiData.updatedAt) {
            kpiData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, kpiData);
    } catch (error) {
        Logger.log('Error in addSafetyTeamKPIToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المؤشر: ' + error.toString() };
    }
}

/**
 * حساب مؤشرات الأداء تلقائياً من البيانات المتكاملة مع جميع الموديولات
 */
function calculateSafetyTeamKPIs(memberId, period = null) {
    try {
        if (!period) {
            const now = new Date();
            period = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
        }
        
        const spreadsheetId = getSpreadsheetId();
        
        // 1. حساب عدد الجولات التفتيشية من PeriodicInspectionRecords
        const inspectionRecords = readFromSheet('PeriodicInspectionRecords', spreadsheetId);
        const inspectionsCount = inspectionRecords.filter(function(record) {
            if (!record.inspectionDate) return false;
            const recordDate = new Date(record.inspectionDate);
            const recordPeriod = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (recordPeriod !== period) return false;
            // التحقق من المفتش (inspector) أو المسؤول (responsible)
            return record.inspector === memberId || record.responsible === memberId || 
                   (record.assignedTo && record.assignedTo === memberId);
        }).length;
        
        // 2. حساب عدد الإجراءات التصحيحية المغلقة من ActionTrackingRegister
        const actionRecords = readFromSheet('ActionTrackingRegister', spreadsheetId);
        const closedActionsCount = actionRecords.filter(function(record) {
            if (!record.updatedAt && !record.dueDate) return false;
            const recordDate = new Date(record.updatedAt || record.dueDate);
            const recordPeriod = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (recordPeriod !== period) return false;
            // التحقق من المسؤول (responsible) أو المكلف (assignedTo)
            const isResponsible = record.responsible === memberId || 
                                 (record.assignedTo && record.assignedTo === memberId);
            return isResponsible && (record.status === 'مكتمل' || record.status === 'مغلق' || record.status === 'completed');
        }).length;
        
        // 3. حساب عدد الملاحظات من DailyObservations
        const observations = readFromSheet('DailyObservations', spreadsheetId);
        const observationsCount = observations.filter(function(obs) {
            if (!obs.date) return false;
            const obsDate = new Date(obs.date);
            const obsPeriod = Utilities.formatDate(obsDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (obsPeriod !== period) return false;
            // التحقق من المشرف (supervisor) أو المسؤول (responsible)
            return obs.supervisor === memberId || obs.responsible === memberId ||
                   (obs.reportedBy && obs.reportedBy === memberId);
        }).length;
        
        // 4. حساب عدد التدريبات من Training
        const trainings = readFromSheet('Training', spreadsheetId);
        const trainingsCount = trainings.filter(function(training) {
            if (!training.startDate) return false;
            const trainingDate = new Date(training.startDate);
            const trainingPeriod = Utilities.formatDate(trainingDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (trainingPeriod !== period) return false;
            
            // التحقق من المدرب
            if (training.trainer === memberId) return true;
            
            // التحقق من المشاركين
            if (training.participants) {
                if (typeof training.participants === 'string') {
                    try {
                        const participants = JSON.parse(training.participants);
                        if (Array.isArray(participants) && participants.indexOf(memberId) !== -1) {
                            return true;
                        }
                    } catch (e) {
                        // إذا فشل التحليل، نتحقق من النص
                        if (training.participants.indexOf(memberId) !== -1) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }).length;
        
        // 5. حساب عدد الحوادث المعالجة من Incidents
        const incidents = readFromSheet('Incidents', spreadsheetId);
        const incidentsHandledCount = incidents.filter(function(incident) {
            if (!incident.date) return false;
            const incidentDate = new Date(incident.date);
            const incidentPeriod = Utilities.formatDate(incidentDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (incidentPeriod !== period) return false;
            // التحقق من المسؤول عن الحادث
            return incident.reportedBy === memberId || incident.responsible === memberId ||
                   (incident.assignedTo && incident.assignedTo === memberId);
        }).length;
        
        // 6. حساب عدد Near Miss المعالجة
        const nearMisses = readFromSheet('NearMiss', spreadsheetId);
        const nearMissCount = nearMisses.filter(function(nm) {
            if (!nm.date) return false;
            const nmDate = new Date(nm.date);
            const nmPeriod = Utilities.formatDate(nmDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (nmPeriod !== period) return false;
            return nm.reportedBy === memberId || nm.responsible === memberId ||
                   (nm.assignedTo && nm.assignedTo === memberId);
        }).length;
        
        // 7. حساب عدد PTW المعالجة
        const ptwRecords = readFromSheet('PTW', spreadsheetId);
        const ptwCount = ptwRecords.filter(function(ptw) {
            if (!ptw.startDate) return false;
            const ptwDate = new Date(ptw.startDate);
            const ptwPeriod = Utilities.formatDate(ptwDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (ptwPeriod !== period) return false;
            return ptw.responsible === memberId || ptw.approvedBy === memberId ||
                   (ptw.assignedTo && ptw.assignedTo === memberId);
        }).length;
        
        // 8. حساب نسبة الالتزام (من الحضور)
        const attendanceRecords = readFromSheet('SafetyTeamAttendance', spreadsheetId);
        const periodAttendance = attendanceRecords.filter(function(record) {
            if (record.memberId !== memberId || !record.date) return false;
            const recordDate = new Date(record.date);
            const recordPeriod = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM');
            return recordPeriod === period;
        });
        
        const totalDays = periodAttendance.length;
        const presentDays = periodAttendance.filter(function(record) {
            return record.status === 'حاضر' || record.status === 'present';
        }).length;
        const commitmentRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
        
        // 9. الحصول على الأهداف من الإعدادات
        var targets = {};
        try {
            const settings = getSafetyHealthManagementSettings();
            if (settings && settings.success && settings.data && settings.data.kpiTargets) {
                targets = settings.data.kpiTargets;
            }
        } catch (error) {
            Logger.log('Warning: Could not get settings, using defaults: ' + error.toString());
        }
        
        // حساب المؤشرات المخصصة
        var customKPIsResult = calculateAllCustomKPIs(memberId, period);
        var customKPIs = customKPIsResult.success ? customKPIsResult.data : {};
        
        // إنشاء كائن KPI شامل
        const kpiData = {
            memberId: memberId,
            period: period,
            inspectionsCount: inspectionsCount,
            closedActionsCount: closedActionsCount,
            observationsCount: observationsCount,
            trainingsCount: trainingsCount,
            incidentsHandledCount: incidentsHandledCount,
            nearMissCount: nearMissCount,
            ptwCount: ptwCount,
            commitmentRate: Math.round(commitmentRate * 100) / 100,
            targetInspections: targets.targetInspections || 20,
            targetActionsClosure: targets.targetActionsClosure || 80,
            targetObservations: targets.targetObservations || 15,
            targetTrainings: targets.targetTrainings || 3,
            targetCommitment: targets.targetCommitment || 95,
            customKPIs: customKPIs,
            calculatedAt: new Date()
        };
        
        return { success: true, data: kpiData };
    } catch (error) {
        Logger.log('Error calculating KPIs: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حساب مؤشرات الأداء: ' + error.toString() };
    }
}

/**
 * تحديث مؤشرات الأداء يدوياً
 */
function updateSafetyTeamKPI(kpiId, updateData) {
    try {
        const sheetName = 'SafetyTeamKPIs';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let kpiIndex = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === kpiId) {
                kpiIndex = i;
                break;
            }
        }
        
        if (kpiIndex === -1) {
            return { success: false, message: 'المؤشر غير موجود' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        updateData.isManual = true; // تحديد أنه تم التعديل يدوياً
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[kpiIndex][key] = updateData[key];
            }
        }
        
        // حفظ البيانات المحدثة
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating KPI: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * الحصول على مؤشرات الأداء لعضو محدد
 */
function getSafetyTeamKPIs(memberId, period = null) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد', data: [] };
        }
        
        const sheetName = 'SafetyTeamKPIs';
        const data = readFromSheet(sheetName);
        
        if (!data || data.length === 0) {
            // إذا لم توجد بيانات محسوبة، نحسبها تلقائياً
            const calculatedKPIs = calculateSafetyTeamKPIs(memberId, period);
            if (calculatedKPIs.success) {
                // حفظ المؤشرات المحسوبة
                addSafetyTeamKPIToSheet(calculatedKPIs.data);
                return { success: true, data: [calculatedKPIs.data] };
            }
            return { success: true, data: [] };
        }
        
        let filteredData = data.filter(function(kpi) {
            if (!kpi) return false;
            return String(kpi.memberId) === String(memberId);
        });
        
        if (period) {
            filteredData = filteredData.filter(function(kpi) {
                return kpi.period === period;
            });
        } else if (filteredData.length > 1) {
            // عند عدم تحديد الفترة: ترتيب تنازلي حسب الفترة (الأحدث أولاً)
            filteredData = filteredData.slice().sort(function(a, b) {
                var pA = (a.period || '').toString();
                var pB = (b.period || '').toString();
                return pB.localeCompare(pA);
            });
        }
        
        // إذا لم توجد بيانات محسوبة، نحسبها تلقائياً
        if (filteredData.length === 0 && memberId) {
            const calculatedKPIs = calculateSafetyTeamKPIs(memberId, period);
            if (calculatedKPIs.success) {
                // حفظ المؤشرات المحسوبة
                addSafetyTeamKPIToSheet(calculatedKPIs.data);
                return { success: true, data: [calculatedKPIs.data] };
            }
        }
        
        return { success: true, data: filteredData };
    } catch (error) {
        Logger.log('Error in getSafetyTeamKPIs: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على مؤشرات الأداء: ' + error.toString(), data: [] };
    }
}

/**
 * ============================================
 * إدارة المهام اليدوية (Manual Tasks Management)
 * ============================================
 */

/**
 * إضافة مهمة يدوية لعضو فريق السلامة
 */
function addSafetyTeamTask(taskData) {
    try {
        if (!taskData) {
            return { success: false, message: 'بيانات المهمة غير موجودة' };
        }
        
        const sheetName = 'SafetyTeamTasks';
        
        // إضافة حقول تلقائية
        if (!taskData.id) {
            taskData.id = generateSequentialId('STT', sheetName);
        }
        if (!taskData.createdAt) {
            taskData.createdAt = new Date();
        }
        if (!taskData.updatedAt) {
            taskData.updatedAt = new Date();
        }
        if (!taskData.status) {
            taskData.status = 'قيد التنفيذ';
        }
        if (!taskData.priority) {
            taskData.priority = 'متوسط';
        }
        
        return appendToSheet(sheetName, taskData);
    } catch (error) {
        Logger.log('Error in addSafetyTeamTask: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المهمة: ' + error.toString() };
    }
}

/**
 * تحديث مهمة يدوية
 */
function updateSafetyTeamTask(taskId, updateData) {
    try {
        const sheetName = 'SafetyTeamTasks';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let taskIndex = -1;
        for (let i = 0; i < data.length; i++) {
            if (data[i].id === taskId) {
                taskIndex = i;
                break;
            }
        }
        
        if (taskIndex === -1) {
            return { success: false, message: 'المهمة غير موجودة' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        if (updateData.status === 'مكتمل' || updateData.status === 'completed') {
            updateData.completedDate = new Date();
        }
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[taskIndex][key] = updateData[key];
            }
        }
        
        // حفظ البيانات المحدثة
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error updating task: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * الحصول على مهام عضو محدد
 */
function getSafetyTeamTasks(memberId, status = null) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد', data: [] };
        }
        
        const sheetName = 'SafetyTeamTasks';
        const data = readFromSheet(sheetName);
        
        if (!data || data.length === 0) {
            return { success: true, data: [] };
        }
        
        let filteredData = data.filter(function(task) {
            return task && task.memberId === memberId;
        });
        
        if (status) {
            filteredData = filteredData.filter(function(task) {
                return task.status === status;
            });
        }
        
        // ترتيب حسب تاريخ الاستحقاق
        filteredData.sort(function(a, b) {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
        
        return { success: true, data: filteredData };
    } catch (error) {
        Logger.log('Error in getSafetyTeamTasks: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على المهام: ' + error.toString(), data: [] };
    }
}

/**
 * حذف مهمة
 */
function deleteSafetyTeamTask(taskId) {
    try {
        const sheetName = 'SafetyTeamTasks';
        const spreadsheetId = getSpreadsheetId();
        const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
        const sheet = spreadsheet.getSheetByName(sheetName);
        
        if (!sheet) {
            return { success: false, message: 'الورقة غير موجودة' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const filteredData = data.filter(function(task) {
            return task.id !== taskId;
        });
        
        if (filteredData.length === data.length) {
            return { success: false, message: 'المهمة غير موجودة' };
        }
        
        // حفظ البيانات المحدثة
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error deleting task: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحذف: ' + error.toString() };
    }
}

/**
 * ============================================
 * 5. تقارير الأداء (Performance Reports)
 * ============================================
 */

/**
 * إنشاء تقرير أداء شامل لعضو فريق السلامة
 */
function generateSafetyTeamPerformanceReport(memberId, startDate = null, endDate = null) {
    try {
        const spreadsheetId = getSpreadsheetId();
        
        // الحصول على بيانات العضو
        const memberResult = getSafetyTeamMember(memberId);
        if (!memberResult.success) {
            return { success: false, message: 'عضو الفريق غير موجود' };
        }
        const member = memberResult.data;
        
        // الحصول على الوصف الوظيفي
        const jobDescResult = getJobDescription(memberId);
        var jobDescription = null;
        if (jobDescResult.success) {
            jobDescription = jobDescResult.data;
        }
        
        // حساب الفترة
        if (!startDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        }
        if (!endDate) {
            endDate = new Date();
        }
        
        // حساب مؤشرات الأداء لفترة التقرير (شهر بداية startDate) لضمان اتساق البيانات
        var reportPeriod = null;
        if (startDate) {
            var startObj = new Date(startDate);
            var y = startObj.getFullYear();
            var m = String(startObj.getMonth() + 1);
            reportPeriod = y + '-' + (m.length === 1 ? '0' + m : m);
        }
        const kpiResult = calculateSafetyTeamKPIs(memberId, reportPeriod);
        var kpis = {};
        if (kpiResult.success) {
            kpis = kpiResult.data;
        }
        
        // الحصول على الأنشطة
        var startDateObj = new Date(startDate);
        var endDateObj = new Date(endDate);
        
        var mid = String(memberId);
        var inspections = readFromSheet('PeriodicInspectionRecords', spreadsheetId).filter(function(record) {
            if (!record.inspectionDate) return false;
            if (String(record.inspector) !== mid && String(record.responsible || '') !== mid) return false;
            var recordDate = new Date(record.inspectionDate);
            return recordDate >= startDateObj && recordDate <= endDateObj;
        });
        
        var actions = readFromSheet('ActionTrackingRegister', spreadsheetId).filter(function(record) {
            if (!record.createdAt) return false;
            if (String(record.responsible || '') !== mid && String(record.assignedTo || '') !== mid) return false;
            var recordDate = new Date(record.createdAt);
            return recordDate >= startDateObj && recordDate <= endDateObj;
        });
        
        var observations = readFromSheet('DailyObservations', spreadsheetId).filter(function(obs) {
            if (!obs.date) return false;
            var obsDate = new Date(obs.date);
            if (obsDate < startDateObj || obsDate > endDateObj) return false;
            if (obs.supervisor != null && String(obs.supervisor) === mid) return true;
            if (obs.responsible != null && String(obs.responsible) === mid) return true;
            if (obs.reportedBy != null && String(obs.reportedBy) === mid) return true;
            if (obs.observerName != null && member.name && String(obs.observerName).trim() === String(member.name).trim()) return true;
            return false;
        });
        
        var trainings = readFromSheet('Training', spreadsheetId).filter(function(training) {
            if (!training.startDate) return false;
            var trainingDate = new Date(training.startDate);
            if (trainingDate < startDateObj || trainingDate > endDateObj) return false;
            
            if (training.trainer != null && String(training.trainer) === mid) return true;
            if (training.participants && typeof training.participants === 'string') {
                try {
                    var participants = JSON.parse(training.participants);
                    if (Array.isArray(participants) && participants.some(function(p) { return p != null && (String(p) === mid || (typeof p === 'object' && p.id != null && String(p.id) === mid)); })) return true;
                } catch (e) {}
                if (training.participants.indexOf(mid) !== -1) return true;
            }
            return false;
        });
        
        const activities = {
            inspections: inspections,
            actions: actions,
            observations: observations,
            trainings: trainings
        };
        
        // إنشاء التقرير
        const report = {
            member: member,
            jobDescription: jobDescription,
            period: {
                startDate: startDate,
                endDate: endDate
            },
            kpis: kpis,
            activities: activities,
            summary: {
                totalInspections: activities.inspections.length,
                totalActions: activities.actions.length,
                totalObservations: activities.observations.length,
                totalTrainings: activities.trainings.length,
                closedActions: activities.actions.filter(function(a) {
                    return a.status === 'مكتمل' || a.status === 'مغلق' || a.status === 'completed';
                }).length,
                commitmentRate: kpis.commitmentRate || 0
            },
            generatedAt: new Date()
        };
        
        return { success: true, data: report };
    } catch (error) {
        Logger.log('Error generating performance report: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إنشاء التقرير: ' + error.toString() };
    }
}

/**
 * حفظ تقرير الأداء
 */
function savePerformanceReportToSheet(reportData) {
    try {
        if (!reportData) {
            return { success: false, message: 'بيانات التقرير غير موجودة' };
        }
        
        const sheetName = 'SafetyTeamPerformanceReports';
        
        // إضافة حقول تلقائية
        if (!reportData.id) {
            reportData.id = generateSequentialId('SPR', sheetName);
        }
        if (!reportData.createdAt) {
            reportData.createdAt = new Date();
        }
        
        return appendToSheet(sheetName, reportData);
    } catch (error) {
        Logger.log('Error in savePerformanceReportToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ التقرير: ' + error.toString() };
    }
}

/**
 * ============================================
 * 6. الحضور والإجازات (Attendance & Leave Log)
 * ============================================
 */

/**
 * تسجيل حضور عضو فريق السلامة
 */
function addSafetyTeamAttendanceToSheet(attendanceData) {
    try {
        if (!attendanceData) {
            return { success: false, message: 'بيانات الحضور غير موجودة' };
        }
        
        const sheetName = 'SafetyTeamAttendance';
        
        // إضافة حقول تلقائية
        if (!attendanceData.id) {
            attendanceData.id = generateSequentialId('STA', sheetName);
        }
        if (!attendanceData.date) {
            attendanceData.date = new Date();
        }
        if (!attendanceData.createdAt) {
            attendanceData.createdAt = new Date();
        }
        if (!attendanceData.updatedAt) {
            attendanceData.updatedAt = new Date();
        }
        
        // حساب مدة العمل إذا كان هناك وقت دخول وخروج
        if (attendanceData.checkIn && attendanceData.checkOut) {
            try {
                const checkIn = new Date(attendanceData.checkIn);
                const checkOut = new Date(attendanceData.checkOut);
                const duration = (checkOut - checkIn) / (1000 * 60 * 60); // بالساعات
                attendanceData.workDuration = Math.round(duration * 100) / 100;
            } catch (e) {
                Logger.log('Warning: Could not calculate work duration: ' + e.toString());
            }
        }
        
        return appendToSheet(sheetName, attendanceData);
    } catch (error) {
        Logger.log('Error in addSafetyTeamAttendanceToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تسجيل الحضور: ' + error.toString() };
    }
}

/**
 * تسجيل إجازة لعضو فريق السلامة
 */
function addSafetyTeamLeaveToSheet(leaveData) {
    try {
        if (!leaveData) {
            return { success: false, message: 'بيانات الإجازة غير موجودة' };
        }
        
        const sheetName = 'SafetyTeamLeaves';
        
        // إضافة حقول تلقائية
        if (!leaveData.id) {
            leaveData.id = generateSequentialId('STL', sheetName);
        }
        if (!leaveData.createdAt) {
            leaveData.createdAt = new Date();
        }
        if (!leaveData.updatedAt) {
            leaveData.updatedAt = new Date();
        }
        
        // حساب عدد الأيام
        if (leaveData.startDate && leaveData.endDate) {
            try {
                const start = new Date(leaveData.startDate);
                const end = new Date(leaveData.endDate);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                leaveData.daysCount = days;
            } catch (e) {
                Logger.log('Warning: Could not calculate leave days: ' + e.toString());
            }
        }
        
        return appendToSheet(sheetName, leaveData);
    } catch (error) {
        Logger.log('Error in addSafetyTeamLeaveToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تسجيل الإجازة: ' + error.toString() };
    }
}

/**
 * الحصول على سجل الحضور لعضو محدد
 */
function getSafetyTeamAttendance(memberId, startDate = null, endDate = null) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد', data: [] };
        }
        
        const sheetName = 'SafetyTeamAttendance';
        const data = readFromSheet(sheetName);
        
        if (!data || data.length === 0) {
            return { success: true, data: [] };
        }
        
        var filteredData = data.filter(function(record) {
            return record && record.memberId === memberId;
        });
        
        if (startDate && endDate) {
            try {
                var startDateObj = new Date(startDate);
                var endDateObj = new Date(endDate);
                filteredData = filteredData.filter(function(record) {
                    if (!record.date) return false;
                    var recordDate = new Date(record.date);
                    return recordDate >= startDateObj && recordDate <= endDateObj;
                });
            } catch (e) {
                Logger.log('Warning: Could not filter by date: ' + e.toString());
            }
        }
        
        return { success: true, data: filteredData };
    } catch (error) {
        Logger.log('Error in getSafetyTeamAttendance: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على سجل الحضور: ' + error.toString(), data: [] };
    }
}

/**
 * الحصول على سجل الإجازات لعضو محدد
 */
function getSafetyTeamLeaves(memberId, startDate = null, endDate = null) {
    try {
        if (!memberId) {
            return { success: false, message: 'معرف العضو غير محدد', data: [] };
        }
        
        const sheetName = 'SafetyTeamLeaves';
        const data = readFromSheet(sheetName);
        
        if (!data || data.length === 0) {
            return { success: true, data: [] };
        }
        
        var filteredData = data.filter(function(record) {
            return record && record.memberId === memberId;
        });
        
        if (startDate && endDate) {
            try {
                var startDateObj = new Date(startDate);
                var endDateObj = new Date(endDate);
                filteredData = filteredData.filter(function(record) {
                    if (!record.startDate) return false;
                    var recordDate = new Date(record.startDate);
                    return recordDate >= startDateObj && recordDate <= endDateObj;
                });
            } catch (e) {
                Logger.log('Warning: Could not filter by date: ' + e.toString());
            }
        }
        
        return { success: true, data: filteredData };
    } catch (error) {
        Logger.log('Error in getSafetyTeamLeaves: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على سجل الإجازات: ' + error.toString(), data: [] };
    }
}

/**
 * حذف سجل حضور
 */
function deleteSafetyTeamAttendance(attendanceId) {
    try {
        if (!attendanceId) {
            return { success: false, message: 'معرف سجل الحضور غير محدد' };
        }
        const sheetName = 'SafetyTeamAttendance';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        if (!data || data.length === 0) {
            return { success: false, message: 'سجل الحضور غير موجود' };
        }
        const filteredData = data.filter(function(record) {
            return record && record.id !== attendanceId;
        });
        if (filteredData.length === data.length) {
            return { success: false, message: 'سجل الحضور غير موجود' };
        }
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteSafetyTeamAttendance: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف سجل الحضور: ' + error.toString() };
    }
}

/**
 * تحديث سجل حضور
 */
function updateSafetyTeamAttendance(attendanceId, updateData) {
    try {
        if (!attendanceId || !updateData) {
            return { success: false, message: 'معرف سجل الحضور أو بيانات التحديث غير محددة' };
        }
        const sheetName = 'SafetyTeamAttendance';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        var recordIndex = -1;
        for (var i = 0; i < data.length; i++) {
            if (data[i] && data[i].id === attendanceId) {
                recordIndex = i;
                break;
            }
        }
        if (recordIndex === -1) {
            return { success: false, message: 'سجل الحضور غير موجود' };
        }
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[recordIndex][key] = updateData[key];
            }
        }
        if (updateData.checkIn && updateData.checkOut) {
            try {
                var checkIn = new Date(updateData.checkIn);
                var checkOut = new Date(updateData.checkOut);
                data[recordIndex].workDuration = Math.round(((checkOut - checkIn) / (1000 * 60 * 60)) * 100) / 100;
            } catch (e) {}
        }
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateSafetyTeamAttendance: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث سجل الحضور: ' + error.toString() };
    }
}

/**
 * حذف سجل إجازة
 */
function deleteSafetyTeamLeave(leaveId) {
    try {
        if (!leaveId) {
            return { success: false, message: 'معرف سجل الإجازة غير محدد' };
        }
        const sheetName = 'SafetyTeamLeaves';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        if (!data || data.length === 0) {
            return { success: false, message: 'سجل الإجازة غير موجود' };
        }
        const filteredData = data.filter(function(record) {
            return record && record.id !== leaveId;
        });
        if (filteredData.length === data.length) {
            return { success: false, message: 'سجل الإجازة غير موجود' };
        }
        return saveToSheet(sheetName, filteredData, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteSafetyTeamLeave: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف سجل الإجازة: ' + error.toString() };
    }
}

/**
 * تحديث سجل إجازة
 */
function updateSafetyTeamLeave(leaveId, updateData) {
    try {
        if (!leaveId || !updateData) {
            return { success: false, message: 'معرف سجل الإجازة أو بيانات التحديث غير محددة' };
        }
        const sheetName = 'SafetyTeamLeaves';
        const spreadsheetId = getSpreadsheetId();
        const data = readFromSheet(sheetName, spreadsheetId);
        var recordIndex = -1;
        for (var i = 0; i < data.length; i++) {
            if (data[i] && data[i].id === leaveId) {
                recordIndex = i;
                break;
            }
        }
        if (recordIndex === -1) {
            return { success: false, message: 'سجل الإجازة غير موجود' };
        }
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key)) {
                data[recordIndex][key] = updateData[key];
            }
        }
        if (updateData.startDate && updateData.endDate) {
            try {
                var start = new Date(updateData.startDate);
                var end = new Date(updateData.endDate);
                data[recordIndex].daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            } catch (e) {}
        }
        return saveToSheet(sheetName, data, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateSafetyTeamLeave: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث سجل الإجازة: ' + error.toString() };
    }
}

/**
 * إنشاء تقرير حضور/غياب شهري أو سنوي
 */
function generateAttendanceReport(memberId, period = 'monthly', year = null, month = null) {
    try {
        const now = new Date();
        let startDate, endDate;
        
        if (period === 'monthly') {
            const reportYear = year || now.getFullYear();
            const reportMonth = month !== null ? month : now.getMonth();
            startDate = new Date(reportYear, reportMonth, 1);
            endDate = new Date(reportYear, reportMonth + 1, 0);
        } else if (period === 'yearly') {
            const reportYear = year || now.getFullYear();
            startDate = new Date(reportYear, 0, 1);
            endDate = new Date(reportYear, 11, 31);
        } else {
            return { success: false, message: 'الفترة غير صحيحة. استخدم "monthly" أو "yearly"' };
        }
        
        // الحصول على بيانات الحضور
        const attendanceResult = getSafetyTeamAttendance(memberId, startDate, endDate);
        const attendance = attendanceResult.data || [];
        
        // الحصول على بيانات الإجازات
        const leavesResult = getSafetyTeamLeaves(memberId, startDate, endDate);
        const leaves = leavesResult.data || [];
        
        // حساب الإحصائيات
        var presentDays = attendance.filter(function(a) { return a.status === 'حاضر'; }).length;
        var lateDays = attendance.filter(function(a) { return a.status === 'متأخر'; }).length;
        var absentDays = attendance.filter(function(a) { return a.status === 'غائب'; }).length;
        var fieldWorkDays = attendance.filter(function(a) { return a.status === 'عمل ميداني'; }).length;
        var leaveDaysSum = 0;
        for (var i = 0; i < leaves.length; i++) {
            leaveDaysSum += (leaves[i].daysCount || 0);
        }
        
        const stats = {
            totalDays: period === 'monthly' ? endDate.getDate() : 365,
            presentDays: presentDays,
            lateDays: lateDays,
            absentDays: absentDays,
            fieldWorkDays: fieldWorkDays,
            totalLeaves: leaves.length,
            leaveDays: leaveDaysSum,
            attendanceRate: 0
        };
        
        const workingDays = stats.totalDays - stats.leaveDays;
        if (workingDays > 0) {
            stats.attendanceRate = Math.round((stats.presentDays / workingDays) * 100 * 100) / 100;
        }
        
        const report = {
            memberId: memberId,
            period: period,
            year: year || now.getFullYear(),
            month: month !== null ? month : now.getMonth(),
            startDate: startDate,
            endDate: endDate,
            attendance: attendance,
            leaves: leaves,
            statistics: stats,
            generatedAt: new Date()
        };
        
        return { success: true, data: report };
    } catch (error) {
        Logger.log('Error generating attendance report: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إنشاء تقرير الحضور: ' + error.toString() };
    }
}

/**
 * ============================================
 * 7. إعدادات الموديول (Module Settings - Admin Only)
 * ============================================
 */

/**
 * حفظ إعدادات الموديول
 */
function saveSafetyHealthManagementSettings(settingsData) {
    try {
        const sheetName = 'SafetyHealthManagementSettings';
        
        if (!settingsData) {
            return { success: false, message: 'البيانات غير موجودة' };
        }
        
        // إضافة حقول تلقائية
        if (!settingsData.id) {
            settingsData.id = generateSequentialId('SHS', sheetName);
        }
        if (!settingsData.createdAt) {
            settingsData.createdAt = new Date();
        }
        if (!settingsData.updatedAt) {
            settingsData.updatedAt = new Date();
        }
        
        return saveToSheet(sheetName, settingsData);
    } catch (error) {
        Logger.log('Error in saveSafetyHealthManagementSettings: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حفظ الإعدادات: ' + error.toString() };
    }
}

/**
 * الحصول على إعدادات الموديول
 */
function getSafetyHealthManagementSettings() {
    try {
        const sheetName = 'SafetyHealthManagementSettings';
        const spreadsheetId = getSpreadsheetId();
        
        // إعدادات افتراضية
        const defaultSettings = {
            leaveTypes: ['سنوية', 'مرضية', 'طارئة', 'أخرى'],
            attendanceStatuses: ['حاضر', 'متأخر', 'غائب', 'عمل ميداني'],
            kpiTargets: {
                targetInspections: 20,
                targetActionsClosure: 80,
                targetObservations: 15,
                targetTrainings: 3,
                targetCommitment: 95,
                inspectionsPerMonth: 20,
                actionsClosureRate: 80,
                observationsPerMonth: 15,
                trainingsPerMonth: 2,
                commitmentRate: 95
            }
        };
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            Logger.log('Warning: spreadsheetId not set, returning default settings');
            return { success: true, data: defaultSettings };
        }
        
        // محاولة قراءة البيانات
        let data;
        try {
            data = readFromSheet(sheetName, spreadsheetId);
        } catch (readError) {
            Logger.log('Error reading sheet in getSafetyHealthManagementSettings: ' + readError.toString());
            // إذا فشلت القراءة، نرجع الإعدادات الافتراضية
            return { success: true, data: defaultSettings };
        }
        
        // التأكد من أن data هي مصفوفة
        if (!Array.isArray(data)) {
            Logger.log('Warning: data is not an array, converting to array');
            data = data ? [data] : [];
        }
        
        if (data && data.length > 0) {
            return { success: true, data: data[0] };
        }
        
        // إذا لم تكن هناك بيانات، نرجع الإعدادات الافتراضية
        return { success: true, data: defaultSettings };
    } catch (error) {
        Logger.log('Error in getSafetyHealthManagementSettings: ' + error.toString());
        Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
        // إرجاع الإعدادات الافتراضية في حالة الخطأ
        const defaultSettings = {
            leaveTypes: ['سنوية', 'مرضية', 'طارئة', 'أخرى'],
            attendanceStatuses: ['حاضر', 'متأخر', 'غائب', 'عمل ميداني'],
            kpiTargets: {
                targetInspections: 20,
                targetActionsClosure: 80,
                targetObservations: 15,
                targetTrainings: 3,
                targetCommitment: 95,
                inspectionsPerMonth: 20,
                actionsClosureRate: 80,
                observationsPerMonth: 15,
                trainingsPerMonth: 2,
                commitmentRate: 95
            }
        };
        return { success: true, data: defaultSettings };
    }
}

/**
 * تحديث أنواع الإجازات
 */
function updateLeaveTypes(leaveTypes) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        settings.leaveTypes = leaveTypes;
        settings.updatedAt = new Date();
        
        return saveSafetyHealthManagementSettings(settings);
    } catch (error) {
        Logger.log('Error updating leave types: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * تحديث تصنيفات الحضور
 */
function updateAttendanceStatuses(statuses) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        settings.attendanceStatuses = statuses;
        settings.updatedAt = new Date();
        
        return saveSafetyHealthManagementSettings(settings);
    } catch (error) {
        Logger.log('Error updating attendance statuses: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * تحديث أهداف مؤشرات الأداء
 */
function updateKPITargets(targets) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        if (!settings.kpiTargets) {
            settings.kpiTargets = {};
        }
        for (var key in targets) {
            if (targets.hasOwnProperty(key)) {
                settings.kpiTargets[key] = targets[key];
            }
        }
        settings.updatedAt = new Date();
        
        return saveSafetyHealthManagementSettings(settings);
    } catch (error) {
        Logger.log('Error updating KPI targets: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * ============================================
 * 8. إدارة مؤشرات الأداء المخصصة (Custom KPIs Management)
 * ============================================
 */

/**
 * إضافة مؤشر أداء مخصص
 */
function addCustomKPI(kpiData) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        
        if (!settings.customKPIs) {
            settings.customKPIs = [];
        }
        
        // إضافة حقول تلقائية
        if (!kpiData.id) {
            kpiData.id = 'KPI-' + Date.now().toString();
        }
        if (!kpiData.createdAt) {
            kpiData.createdAt = new Date();
        }
        kpiData.updatedAt = new Date();
        kpiData.isActive = kpiData.isActive !== false; // Default to true if not specified
        
        // إضافة المؤشر الجديد
        settings.customKPIs.push(kpiData);
        settings.updatedAt = new Date();
        
        return saveSafetyHealthManagementSettings(settings);
    } catch (error) {
        Logger.log('Error adding custom KPI: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الإضافة: ' + error.toString() };
    }
}

/**
 * تحديث مؤشر أداء مخصص
 */
function updateCustomKPI(kpiId, updateData) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        
        if (!settings.customKPIs || !Array.isArray(settings.customKPIs)) {
            return { success: false, message: 'لا توجد مؤشرات مخصصة' };
        }
        
        // البحث عن المؤشر
        var kpiIndex = -1;
        for (var i = 0; i < settings.customKPIs.length; i++) {
            if (settings.customKPIs[i].id === kpiId || i.toString() === kpiId.toString()) {
                kpiIndex = i;
                break;
            }
        }
        
        if (kpiIndex === -1) {
            return { success: false, message: 'المؤشر غير موجود' };
        }
        
        // تحديث البيانات
        updateData.updatedAt = new Date();
        for (var key in updateData) {
            if (updateData.hasOwnProperty(key) && key !== 'id' && key !== 'createdAt') {
                settings.customKPIs[kpiIndex][key] = updateData[key];
            }
        }
        
        settings.updatedAt = new Date();
        
        return saveSafetyHealthManagementSettings(settings);
    } catch (error) {
        Logger.log('Error updating custom KPI: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء التحديث: ' + error.toString() };
    }
}

/**
 * حذف مؤشر أداء مخصص
 */
function deleteCustomKPI(kpiId) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        
        if (!settings.customKPIs || !Array.isArray(settings.customKPIs)) {
            return { success: false, message: 'لا توجد مؤشرات مخصصة' };
        }
        
        // البحث عن المؤشر وحذفه
        var kpiIndex = -1;
        for (var i = 0; i < settings.customKPIs.length; i++) {
            if (settings.customKPIs[i].id === kpiId || i.toString() === kpiId.toString()) {
                kpiIndex = i;
                break;
            }
        }
        
        if (kpiIndex === -1) {
            return { success: false, message: 'المؤشر غير موجود' };
        }
        
        // حذف المؤشر
        settings.customKPIs.splice(kpiIndex, 1);
        settings.updatedAt = new Date();
        
        return saveSafetyHealthManagementSettings(settings);
    } catch (error) {
        Logger.log('Error deleting custom KPI: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحذف: ' + error.toString() };
    }
}

/**
 * حساب مؤشر الأداء المخصص لعضو محدد
 */
function calculateCustomKPI(memberId, kpi, period = null) {
    try {
        const spreadsheetId = getSpreadsheetId();
        if (!spreadsheetId) {
            Logger.log('Warning: spreadsheetId not set in calculateCustomKPI');
            return 0;
        }
        
        // تحديد الفترة (افتراضي: الشهر الحالي)
        if (!period) {
            const now = new Date();
            period = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
        }
        
        // الحصول على البيانات من الموديول المحدد
        var records = [];
        var moduleName = kpi.module || '';
        
        try {
            switch (moduleName) {
                case 'PeriodicInspectionRecords':
                    records = readFromSheet('PeriodicInspectionRecords', spreadsheetId);
                    break;
                case 'Training':
                    records = readFromSheet('Training', spreadsheetId);
                    break;
                case 'DailyObservations':
                    records = readFromSheet('DailyObservations', spreadsheetId);
                    break;
                case 'NearMiss':
                    records = readFromSheet('NearMiss', spreadsheetId);
                    break;
                case 'ActionTrackingRegister':
                    records = readFromSheet('ActionTrackingRegister', spreadsheetId);
                    break;
                default:
                    Logger.log('Warning: Unknown module in calculateCustomKPI: ' + moduleName);
                    return 0;
            }
        } catch (readError) {
            Logger.log('Error reading sheet ' + moduleName + ' in calculateCustomKPI: ' + readError.toString());
            return 0;
        }
        
        if (!records || !Array.isArray(records) || records.length === 0) {
            return 0;
        }
        
        // فلترة السجلات حسب الفترة والعضو (متوافقة مع حقول كل موديول)
        var mid = String(memberId);
        var filteredRecords = records.filter(function(record) {
            // التحقق من التاريخ حسب نوع السجل
            var recordDate = null;
            if (record.date) {
                recordDate = new Date(record.date);
            } else if (record.inspectionDate) {
                recordDate = new Date(record.inspectionDate);
            } else if (record.startDate) {
                recordDate = new Date(record.startDate);
            } else if (record.createdAt) {
                recordDate = new Date(record.createdAt);
            } else if (record.updatedAt) {
                recordDate = new Date(record.updatedAt);
            }
            
            if (!recordDate) return false;
            
            var recordPeriod = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), 'yyyy-MM');
            if (recordPeriod !== period) return false;
            
            // التحقق من العضو حسب الموديول (نفس منطق calculateSafetyTeamKPIs)
            if (record.memberId === memberId || record.memberId == mid) return true;
            if (record.reportedBy === memberId || String(record.reportedBy) === mid) return true;
            if (record.responsible === memberId || String(record.responsible) === mid) return true;
            if (record.assignedTo && (record.assignedTo === memberId || String(record.assignedTo) === mid)) return true;
            if (record.inspector === memberId || String(record.inspector) === mid) return true;
            if (record.supervisor === memberId || String(record.supervisor) === mid) return true;
            if (record.trainer === memberId || String(record.trainer) === mid) return true;
            if (record.createdBy === memberId || String(record.createdBy) === mid) return true;
            if (record.inspectedBy === memberId || String(record.inspectedBy) === mid) return true;
            if (record.approvedBy === memberId || String(record.approvedBy) === mid) return true;
            
            // المشاركون (للتدريب)
            if (record.participants) {
                try {
                    var participants = typeof record.participants === 'string' ? 
                        JSON.parse(record.participants) : record.participants;
                    if (Array.isArray(participants) && participants.some(function(p) { return p != null && (String(p) === mid || (typeof p === 'object' && p.id != null && String(p.id) === mid)); })) {
                        return true;
                    }
                } catch (e) {
                    if (typeof record.participants === 'string' && record.participants.indexOf(mid) !== -1) return true;
                }
            }
            
            return false;
        });
        
        // إذا كان هناك حقل فلترة محدد
        if (kpi.fieldName && kpi.filterValue) {
            filteredRecords = filteredRecords.filter(function(record) {
                var fieldValue = record[kpi.fieldName];
                if (!fieldValue) return false;
                
                // المقارنة (دعم النصوص والأرقام)
                if (typeof fieldValue === 'string' && typeof kpi.filterValue === 'string') {
                    return fieldValue.toLowerCase() === kpi.filterValue.toLowerCase();
                }
                return fieldValue == kpi.filterValue;
            });
        }
        
        return filteredRecords.length;
    } catch (error) {
        Logger.log('Error calculating custom KPI: ' + error.toString());
        return 0;
    }
}

/**
 * حساب جميع المؤشرات المخصصة لعضو محدد
 */
function calculateAllCustomKPIs(memberId, period = null) {
    try {
        const settingsResult = getSafetyHealthManagementSettings();
        var settings = {};
        if (settingsResult.data) {
            settings = settingsResult.data;
        }
        
        var customKPIs = settings.customKPIs || [];
        var activeKPIs = customKPIs.filter(function(kpi) {
            return kpi.isActive !== false;
        });
        
        var results = {};
        for (var i = 0; i < activeKPIs.length; i++) {
            var kpi = activeKPIs[i];
            var value = calculateCustomKPI(memberId, kpi, period);
            results[kpi.id || i] = {
                name: kpi.name,
                category: kpi.category,
                module: kpi.module,
                currentValue: value,
                targetValue: kpi.targetValue || 0,
                unit: kpi.unit || 'عدد',
                percentage: kpi.targetValue > 0 ? Math.min((value / kpi.targetValue) * 100, 100) : 0
            };
        }
        
        return { success: true, data: results };
    } catch (error) {
        Logger.log('Error calculating all custom KPIs: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحساب: ' + error.toString() };
    }
}

