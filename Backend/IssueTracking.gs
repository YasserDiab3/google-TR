/**
 * Google Apps Script for HSE System - Issue Tracking Module
 * 
 * موديول تتبع المشاكل وحلولها - النسخة المحسنة
 * 
 * المميزات:
 * - إدارة كاملة للمشاكل التقنية والوظيفية
 * - ربط تلقائي مع جميع الموديولات
 * - تتبع الحلول وفعاليتها
 * - سجل زمني كامل لكل مشكلة
 * - إحصائيات وتقارير شاملة
 */

/**
 * إضافة مشكلة جديدة
 */
function addIssueToSheet(issueData) {
    try {
        const sheetName = 'IssueTracking';
        
        // التحقق من البيانات المطلوبة
        if (!issueData) {
            return { success: false, message: 'لا توجد بيانات للإضافة' };
        }
        
        // توليد ID تلقائي إذا لم يكن موجوداً
        if (!issueData.id) {
            issueData.id = generateSequentialId('ISS', sheetName, null);
        }
        
        // إضافة التواريخ التلقائية
        if (!issueData.createdAt) {
            issueData.createdAt = new Date().toISOString();
        }
        if (!issueData.updatedAt) {
            issueData.updatedAt = new Date().toISOString();
        }
        
        // إضافة الحالة الافتراضية
        if (!issueData.status) {
            issueData.status = 'New'; // New, In Progress, Resolved, Closed, Reopened
        }
        
        // إضافة الأولوية الافتراضية
        if (!issueData.priority) {
            issueData.priority = 'Medium'; // Low, Medium, High, Critical
        }
        
        // ✅ إضافة سجل زمني أولي - array (سيتم تحويله تلقائياً بواسطة toSheetCellValue_)
        if (!issueData.timeLog) {
            issueData.timeLog = [{
                action: 'created',
                user: issueData.reportedBy || issueData.createdBy || 'System',
                timestamp: new Date().toISOString(),
                note: 'تم إنشاء المشكلة'
            }];
        }
        
        // ✅ إضافة مصفوفة الحلول إذا لم تكن موجودة
        if (!issueData.solutions) {
            issueData.solutions = [];
        }
        
        // ✅ إضافة مصفوفة التعليقات إذا لم تكن موجودة
        if (!issueData.comments) {
            issueData.comments = [];
        }
        
        // ✅ إضافة مصفوفة المرفقات إذا لم تكن موجودة
        if (!issueData.attachments) {
            issueData.attachments = [];
        }
        
        const result = appendToSheet(sheetName, issueData);
        
        // ✅ إضافة ID إلى الاستجابة لضمان ظهوره في الرسالة
        if (result.success && issueData.id) {
            result.data = { id: issueData.id };
        }
        
        return result;
    } catch (error) {
        Logger.log('Error in addIssueToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة المشكلة: ' + error.toString() };
    }
}

/**
 * تحديث مشكلة
 */
function updateIssue(issueId, updateData) {
    try {
        const sheetName = 'IssueTracking';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const issueIndex = data.findIndex(i => i.id === issueId);
        
        if (issueIndex === -1) {
            return { success: false, message: 'المشكلة غير موجودة' };
        }
        
        const existingIssue = data[issueIndex];
        const updatedIssue = {
            ...existingIssue,
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        // ✅ إضافة سجل زمني للتحديث - array (سيتم تحويله تلقائياً)
        let timeLog = [];
        try {
            // قراءة timeLog الحالي - قد يكون array أو string
            if (Array.isArray(existingIssue.timeLog)) {
                timeLog = existingIssue.timeLog;
            } else if (typeof existingIssue.timeLog === 'string' && existingIssue.timeLog) {
                try {
                    timeLog = JSON.parse(existingIssue.timeLog);
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
            note: updateData.updateNote || 'تم تحديث المشكلة',
            changes: updateData.changes || {}
        });
        
        // تحديث الحالة في السجل الزمني
        if (updateData.status && updateData.status !== existingIssue.status) {
            timeLog.push({
                action: 'status_changed',
                user: updateData.updatedBy || 'System',
                timestamp: new Date().toISOString(),
                note: `تم تغيير الحالة من ${existingIssue.status} إلى ${updateData.status}`,
                oldStatus: existingIssue.status,
                newStatus: updateData.status
            });
        }
        
        // إذا تم الحل، إضافة سجل الحل
        if (updateData.status === 'Resolved' || updateData.status === 'تم الحل') {
            updatedIssue.resolvedAt = new Date().toISOString();
            updatedIssue.resolvedBy = updateData.updatedBy || updateData.resolvedBy || 'System';
            
            timeLog.push({
                action: 'resolved',
                user: updatedIssue.resolvedBy,
                timestamp: new Date().toISOString(),
                note: 'تم حل المشكلة'
            });
        }
        
        // إذا تم الإغلاق
        if (updateData.status === 'Closed' || updateData.status === 'مغلق') {
            updatedIssue.closedAt = new Date().toISOString();
            updatedIssue.closedBy = updateData.updatedBy || updateData.closedBy || 'System';
            
            timeLog.push({
                action: 'closed',
                user: updatedIssue.closedBy,
                timestamp: new Date().toISOString(),
                note: 'تم إغلاق المشكلة'
            });
        }
        
        // إذا تم إعادة الفتح
        if (updateData.status === 'Reopened' || updateData.status === 'مفتوحة مجدداً') {
            timeLog.push({
                action: 'reopened',
                user: updateData.updatedBy || 'System',
                timestamp: new Date().toISOString(),
                note: 'تم إعادة فتح المشكلة'
            });
        }
        
        updatedIssue.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        return updateSingleRowInSheet(sheetName, issueId, updatedIssue, spreadsheetId);
    } catch (error) {
        Logger.log('Error in updateIssue: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحديث المشكلة: ' + error.toString() };
    }
}

/**
 * حذف مشكلة
 */
function deleteIssue(issueId) {
    try {
        if (!issueId) {
            return { success: false, message: 'معرف المشكلة غير محدد' };
        }
        
        const sheetName = 'IssueTracking';
        const spreadsheetId = getSpreadsheetId();
        
        // التحقق من وجود spreadsheetId
        if (!spreadsheetId || spreadsheetId.trim() === '') {
            return { 
                success: false, 
                message: 'معرف Google Sheets غير محدد. يرجى إدخال معرف الجدول في الإعدادات أو في Config.gs.' 
            };
        }
        
        // ✅ حذف الصف مباشرة بدون إعادة كتابة الجدول بالكامل
        return deleteRowById(sheetName, issueId, spreadsheetId);
    } catch (error) {
        Logger.log('Error in deleteIssue: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حذف المشكلة: ' + error.toString() };
    }
}

/**
 * الحصول على مشكلة محددة
 */
function getIssue(issueId) {
    try {
        const sheetName = 'IssueTracking';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const issue = data.find(i => i.id === issueId);
        
        if (!issue) {
            return { success: false, message: 'المشكلة غير موجودة' };
        }
        
        return { success: true, data: issue };
    } catch (error) {
        Logger.log('Error in getIssue: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المشكلة: ' + error.toString() };
    }
}

/**
 * الحصول على جميع المشاكل
 */
function getAllIssues(filters = {}) {
    try {
        const sheetName = 'IssueTracking';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد', data: [] };
        }
        
        let data = readFromSheet(sheetName, spreadsheetId);
        
        if (!data || !Array.isArray(data)) {
            data = [];
        }
        
        // تطبيق الفلاتر
        if (filters.status) {
            data = data.filter(issue => {
                const issueStatus = (issue.status || '').toLowerCase();
                const filterStatus = (filters.status || '').toLowerCase();
                return issueStatus === filterStatus || 
                       issueStatus.includes(filterStatus) || 
                       filterStatus.includes(issueStatus);
            });
        }
        
        if (filters.priority) {
            data = data.filter(issue => {
                const issuePriority = (issue.priority || '').toLowerCase();
                const filterPriority = (filters.priority || '').toLowerCase();
                return issuePriority === filterPriority;
            });
        }
        
        if (filters.module) {
            data = data.filter(issue => issue.module === filters.module);
        }
        
        if (filters.category) {
            data = data.filter(issue => issue.category === filters.category);
        }
        
        if (filters.reportedBy) {
            data = data.filter(issue => issue.reportedBy === filters.reportedBy);
        }
        
        if (filters.assignedTo) {
            data = data.filter(issue => issue.assignedTo === filters.assignedTo);
        }
        
        if (filters.search) {
            const searchTerm = (filters.search || '').toLowerCase();
            data = data.filter(issue => {
                const title = (issue.title || '').toLowerCase();
                const description = (issue.description || '').toLowerCase();
                const id = (issue.id || '').toLowerCase();
                return title.includes(searchTerm) || 
                       description.includes(searchTerm) || 
                       id.includes(searchTerm);
            });
        }
        
        if (filters.startDate) {
            data = data.filter(issue => {
                if (!issue.createdAt) return false;
                return new Date(issue.createdAt) >= new Date(filters.startDate);
            });
        }
        
        if (filters.endDate) {
            data = data.filter(issue => {
                if (!issue.createdAt) return false;
                return new Date(issue.createdAt) <= new Date(filters.endDate);
            });
        }
        
        // ترتيب حسب الوقت (الأحدث أولاً)
        data.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.updatedAt || 0);
            const dateB = new Date(b.createdAt || b.updatedAt || 0);
            return dateB - dateA;
        });
        
        return { success: true, data: data || [] };
    } catch (error) {
        Logger.log('Error in getAllIssues: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء قراءة المشاكل: ' + error.toString(), data: [] };
    }
}

/**
 * إضافة حل للمشكلة
 */
function addSolutionToIssue(issueId, solutionData) {
    try {
        const sheetName = 'IssueTracking';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const issueIndex = data.findIndex(i => i.id === issueId);
        
        if (issueIndex === -1) {
            return { success: false, message: 'المشكلة غير موجودة' };
        }
        
        const issue = data[issueIndex];
        
        // ✅ تحليل الحلول الحالية
        let solutions = [];
        try {
            if (Array.isArray(issue.solutions)) {
                solutions = issue.solutions;
            } else if (typeof issue.solutions === 'string' && issue.solutions) {
                try {
                    solutions = JSON.parse(issue.solutions);
                } catch (e) {
                    solutions = [];
                }
            }
        } catch (e) {
            solutions = [];
        }
        
        // إضافة الحل الجديد
        solutions.push({
            id: 'SOL-' + Date.now().toString(),
            solution: solutionData.solution || '',
            implementedBy: solutionData.implementedBy || 'System',
            implementedAt: new Date().toISOString(),
            effectiveness: solutionData.effectiveness || 'Unknown', // Effective, Partially Effective, Not Effective, Unknown
            notes: solutionData.notes || ''
        });
        
        issue.solutions = solutions;
        issue.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(issue.timeLog)) {
                timeLog = issue.timeLog;
            } else if (typeof issue.timeLog === 'string' && issue.timeLog) {
                try {
                    timeLog = JSON.parse(issue.timeLog);
                } catch (e) {
                    timeLog = [];
                }
            }
        } catch (e) {
            timeLog = [];
        }
        
        timeLog.push({
            action: 'solution_added',
            user: solutionData.implementedBy || 'System',
            timestamp: new Date().toISOString(),
            note: 'تم إضافة حل للمشكلة'
        });
        
        issue.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, issueId, {
            solutions: issue.solutions,
            timeLog: issue.timeLog,
            updatedAt: issue.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addSolutionToIssue: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الحل: ' + error.toString() };
    }
}

/**
 * إضافة تعليق على مشكلة
 */
function addCommentToIssue(issueId, commentData) {
    try {
        const sheetName = 'IssueTracking';
        const spreadsheetId = getSpreadsheetId();
        
        if (!spreadsheetId) {
            return { success: false, message: 'معرف Google Sheets غير محدد' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        const issueIndex = data.findIndex(i => i.id === issueId);
        
        if (issueIndex === -1) {
            return { success: false, message: 'المشكلة غير موجودة' };
        }
        
        const issue = data[issueIndex];
        
        // ✅ تحليل التعليقات الحالية
        let comments = [];
        try {
            if (Array.isArray(issue.comments)) {
                comments = issue.comments;
            } else if (typeof issue.comments === 'string' && issue.comments) {
                try {
                    comments = JSON.parse(issue.comments);
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
        
        issue.comments = comments;
        issue.updatedAt = new Date().toISOString();
        
        // ✅ إضافة سجل زمني
        let timeLog = [];
        try {
            if (Array.isArray(issue.timeLog)) {
                timeLog = issue.timeLog;
            } else if (typeof issue.timeLog === 'string' && issue.timeLog) {
                try {
                    timeLog = JSON.parse(issue.timeLog);
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
        
        issue.timeLog = timeLog;
        
        // ✅ تحديث الصف مباشرة
        return updateSingleRowInSheet(sheetName, issueId, {
            comments: issue.comments,
            timeLog: issue.timeLog,
            updatedAt: issue.updatedAt
        }, spreadsheetId);
    } catch (error) {
        Logger.log('Error in addCommentToIssue: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة التعليق: ' + error.toString() };
    }
}

/**
 * الحصول على إحصائيات المشاكل
 */
function getIssueStatistics(filters = {}) {
    try {
        const allIssues = getAllIssues(filters);
        
        if (!allIssues.success) {
            return { success: false, message: 'فشل في قراءة المشاكل', data: {} };
        }
        
        const issues = allIssues.data;
        const stats = {
            total: issues.length,
            byStatus: {
                New: 0,
                'In Progress': 0,
                Resolved: 0,
                Closed: 0,
                Reopened: 0
            },
            byPriority: {
                Low: 0,
                Medium: 0,
                High: 0,
                Critical: 0
            },
            byModule: {},
            byCategory: {},
            overdue: 0,
            avgResolutionTime: 0
        };
        
        issues.forEach(issue => {
            // حسب الحالة
            const status = issue.status || 'New';
            if (stats.byStatus[status] !== undefined) {
                stats.byStatus[status]++;
            } else {
                // دعم الحالات العربية
                if (status.includes('جديد') || status.includes('new')) stats.byStatus.New++;
                else if (status.includes('تنفيذ') || status.includes('progress')) stats.byStatus['In Progress']++;
                else if (status.includes('حل') || status.includes('resolved')) stats.byStatus.Resolved++;
                else if (status.includes('مغلق') || status.includes('closed')) stats.byStatus.Closed++;
                else if (status.includes('مفتوح') || status.includes('reopened')) stats.byStatus.Reopened++;
            }
            
            // حسب الأولوية
            const priority = issue.priority || 'Medium';
            if (stats.byPriority[priority] !== undefined) {
                stats.byPriority[priority]++;
            } else {
                // دعم الأولويات العربية
                if (priority.includes('منخفض') || priority.includes('low')) stats.byPriority.Low++;
                else if (priority.includes('متوسط') || priority.includes('medium')) stats.byPriority.Medium++;
                else if (priority.includes('عال') || priority.includes('high')) stats.byPriority.High++;
                else if (priority.includes('حرج') || priority.includes('critical')) stats.byPriority.Critical++;
            }
            
            // حسب الموديول
            if (issue.module) {
                stats.byModule[issue.module] = (stats.byModule[issue.module] || 0) + 1;
            }
            
            // حسب الفئة
            if (issue.category) {
                stats.byCategory[issue.category] = (stats.byCategory[issue.category] || 0) + 1;
            }
            
            // المشاكل المتأخرة
            if (issue.dueDate && issue.status !== 'Resolved' && issue.status !== 'Closed' && 
                !issue.status.includes('حل') && !issue.status.includes('مغلق')) {
                try {
                    const dueDate = new Date(issue.dueDate);
                    if (dueDate < new Date()) {
                        stats.overdue++;
                    }
                } catch (e) {
                    // تجاهل خطأ التاريخ
                }
            }
        });
        
        return { success: true, data: stats };
    } catch (error) {
        Logger.log('Error in getIssueStatistics: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء حساب الإحصائيات: ' + error.toString(), data: {} };
    }
}

