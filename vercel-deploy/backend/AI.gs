/**
 * Google Apps Script for HSE System - AI Module
 * 
 * موديول الذكاء الاصطناعي - النسخة المحسنة
 * 
 * المميزات:
 * - تحليل البيانات والإحصائيات
 * - توصيات ذكية بناءً على البيانات
 * - اكتشاف الأنماط والاتجاهات
 * - تنبؤات المخاطر
 * - تحليل الأداء
 */

/**
 * إضافة إعدادات المساعد الذكي
 */
function addAIAssistantSettingsToSheet(settingsData) {
    try {
        const sheetName = 'AIAssistantSettings';
        
        // إضافة حقول تلقائية
        if (!settingsData.id) {
            settingsData.id = Utilities.getUuid();
        }
        if (!settingsData.createdAt) {
            settingsData.createdAt = new Date();
        }
        if (!settingsData.updatedAt) {
            settingsData.updatedAt = new Date();
        }
        
        return appendToSheet(sheetName, settingsData);
    } catch (error) {
        Logger.log('Error in addAIAssistantSettingsToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة الإعدادات: ' + error.toString() };
    }
}

/**
 * إضافة سجل المساعد الذكي
 */
function addUserAILogToSheet(logData) {
    try {
        const sheetName = 'UserAILog';
        
        // إضافة حقول تلقائية
        if (!logData.id) {
            logData.id = Utilities.getUuid();
        }
        if (!logData.timestamp) {
            logData.timestamp = new Date();
        }
        if (!logData.createdAt) {
            logData.createdAt = new Date();
        }
        
        return appendToSheet(sheetName, logData);
    } catch (error) {
        Logger.log('Error in addUserAILogToSheet: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء إضافة السجل: ' + error.toString() };
    }
}

/**
 * ============================================
 * تحليل البيانات والإحصائيات
 * ============================================
 */

/**
 * تحليل شامل لبيانات HSE
 * @param {Object} options - خيارات التحليل {module, startDate, endDate, department}
 * @return {Object} نتائج التحليل
 */
function analyzeHSEData(options = {}) {
    try {
        const spreadsheetId = getSpreadsheetId();
        const analysis = {
            timestamp: new Date(),
            modules: {},
            trends: {},
            recommendations: [],
            riskLevel: 'Low',
            summary: {}
        };
        
        // تحليل الحوادث
        if (!options.module || options.module === 'Incidents') {
            const incidents = readFromSheet('Incidents', spreadsheetId);
            const incidentAnalysis = analyzeIncidents(incidents, options);
            analysis.modules.incidents = incidentAnalysis;
        }
        
        // تحليل الحوادث الوشيكة
        if (!options.module || options.module === 'NearMiss') {
            const nearMisses = readFromSheet('NearMiss', spreadsheetId);
            const nearMissAnalysis = analyzeNearMisses(nearMisses, options);
            analysis.modules.nearMiss = nearMissAnalysis;
        }
        
        // تحليل الإجراءات التصحيحية
        if (!options.module || options.module === 'ActionTracking') {
            const actions = readFromSheet('ActionTrackingRegister', spreadsheetId);
            const actionAnalysis = analyzeActions(actions, options);
            analysis.modules.actions = actionAnalysis;
        }
        
        // تحليل التدريب
        if (!options.module || options.module === 'Training') {
            const trainings = readFromSheet('Training', spreadsheetId);
            const trainingAnalysis = analyzeTraining(trainings, options);
            analysis.modules.training = trainingAnalysis;
        }
        
        // تحليل المخالفات
        if (!options.module || options.module === 'Violations') {
            const violations = readFromSheet('Violations', spreadsheetId);
            const violationAnalysis = analyzeViolations(violations, options);
            analysis.modules.violations = violationAnalysis;
        }
        
        // حساب مستوى المخاطر الإجمالي
        analysis.riskLevel = calculateOverallRiskLevel(analysis.modules);
        
        // إنشاء توصيات
        analysis.recommendations = generateRecommendations(analysis.modules);
        
        // ملخص تنفيذي
        analysis.summary = generateExecutiveSummary(analysis.modules);
        
        // حفظ السجل
        try {
            addUserAILogToSheet({
                userId: options.userId || 'System',
                userName: options.userName || 'System',
                query: 'analyzeHSEData',
                response: JSON.stringify(analysis),
                timestamp: new Date()
            });
        } catch (logError) {
            Logger.log('Warning: Could not log AI analysis: ' + logError.toString());
        }
        
        return { success: true, data: analysis };
    } catch (error) {
        Logger.log('Error in analyzeHSEData: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء تحليل البيانات: ' + error.toString() };
    }
}

/**
 * تحليل الحوادث
 */
function analyzeIncidents(incidents, options = {}) {
    try {
        if (!incidents || incidents.length === 0) {
            return {
                total: 0,
                bySeverity: {},
                byDepartment: {},
                byLocation: {},
                trend: 'stable',
                averagePerMonth: 0
            };
        }
        
        // فلترة حسب التاريخ
        let filtered = incidents;
        if (options.startDate || options.endDate) {
            filtered = incidents.filter(inc => {
                if (!inc.date) return false;
                const incDate = new Date(inc.date);
                if (options.startDate && incDate < new Date(options.startDate)) return false;
                if (options.endDate && incDate > new Date(options.endDate)) return false;
                return true;
            });
        }
        
        // فلترة حسب الإدارة
        if (options.department) {
            filtered = filtered.filter(inc => inc.department === options.department);
        }
        
        const analysis = {
            total: filtered.length,
            bySeverity: {},
            byDepartment: {},
            byLocation: {},
            trend: 'stable',
            averagePerMonth: 0,
            recentIncidents: []
        };
        
        // تحليل حسب الشدة
        filtered.forEach(inc => {
            const severity = inc.severity || 'Unknown';
            analysis.bySeverity[severity] = (analysis.bySeverity[severity] || 0) + 1;
        });
        
        // تحليل حسب الإدارة
        filtered.forEach(inc => {
            const dept = inc.department || 'Unknown';
            analysis.byDepartment[dept] = (analysis.byDepartment[dept] || 0) + 1;
        });
        
        // تحليل حسب الموقع
        filtered.forEach(inc => {
            const loc = inc.location || 'Unknown';
            analysis.byLocation[loc] = (analysis.byLocation[loc] || 0) + 1;
        });
        
        // حساب الاتجاه (آخر 3 أشهر)
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const recent = filtered.filter(inc => {
            if (!inc.date) return false;
            return new Date(inc.date) >= threeMonthsAgo;
        });
        const older = filtered.filter(inc => {
            if (!inc.date) return false;
            const incDate = new Date(inc.date);
            return incDate < threeMonthsAgo && incDate >= new Date(now.getFullYear(), now.getMonth() - 6, 1);
        });
        
        if (recent.length > older.length * 1.2) {
            analysis.trend = 'increasing';
        } else if (recent.length < older.length * 0.8) {
            analysis.trend = 'decreasing';
        }
        
        // حساب المتوسط الشهري
        if (options.startDate && options.endDate) {
            const start = new Date(options.startDate);
            const end = new Date(options.endDate);
            const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
            analysis.averagePerMonth = months > 0 ? (filtered.length / months) : 0;
        }
        
        // الحوادث الأخيرة
        analysis.recentIncidents = filtered
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
            .slice(0, 5);
        
        return analysis;
    } catch (error) {
        Logger.log('Error in analyzeIncidents: ' + error.toString());
        return { total: 0, error: error.toString() };
    }
}

/**
 * تحليل الحوادث الوشيكة
 */
function analyzeNearMisses(nearMisses, options = {}) {
    try {
        if (!nearMisses || nearMisses.length === 0) {
            return { total: 0, byType: {}, byDepartment: {}, trend: 'stable' };
        }
        
        let filtered = nearMisses;
        if (options.startDate || options.endDate) {
            filtered = nearMisses.filter(nm => {
                if (!nm.date) return false;
                const nmDate = new Date(nm.date);
                if (options.startDate && nmDate < new Date(options.startDate)) return false;
                if (options.endDate && nmDate > new Date(options.endDate)) return false;
                return true;
            });
        }
        
        if (options.department) {
            filtered = filtered.filter(nm => nm.department === options.department);
        }
        
        const analysis = {
            total: filtered.length,
            byType: {},
            byDepartment: {},
            byLocation: {},
            trend: 'stable',
            withCorrectiveAction: 0
        };
        
        filtered.forEach(nm => {
            const type = nm.type || 'Unknown';
            analysis.byType[type] = (analysis.byType[type] || 0) + 1;
            
            const dept = nm.department || 'Unknown';
            analysis.byDepartment[dept] = (analysis.byDepartment[dept] || 0) + 1;
            
            if (nm.correctiveProposed || nm.correctiveDescription) {
                analysis.withCorrectiveAction++;
            }
        });
        
        return analysis;
    } catch (error) {
        Logger.log('Error in analyzeNearMisses: ' + error.toString());
        return { total: 0, error: error.toString() };
    }
}

/**
 * تحليل الإجراءات التصحيحية
 */
function analyzeActions(actions, options = {}) {
    try {
        if (!actions || actions.length === 0) {
            return {
                total: 0,
                byStatus: {},
                overdue: 0,
                completionRate: 0,
                averageDaysToClose: 0
            };
        }
        
        let filtered = actions;
        if (options.startDate || options.endDate) {
            filtered = actions.filter(action => {
                const actionDate = new Date(action.createdAt || action.issueDate || 0);
                if (options.startDate && actionDate < new Date(options.startDate)) return false;
                if (options.endDate && actionDate > new Date(options.endDate)) return false;
                return true;
            });
        }
        
        const analysis = {
            total: filtered.length,
            byStatus: {},
            overdue: 0,
            completionRate: 0,
            averageDaysToClose: 0,
            byType: {},
            byDepartment: {}
        };
        
        const now = new Date();
        let closedCount = 0;
        let totalDaysToClose = 0;
        let closedActions = 0;
        
        filtered.forEach(action => {
            const status = action.status || 'Unknown';
            analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;
            
            if (status === 'Closed' || status === 'مغلق' || status === 'مكتمل') {
                closedCount++;
                if (action.closedAt && action.createdAt) {
                    const created = new Date(action.createdAt);
                    const closed = new Date(action.closedAt);
                    const days = (closed - created) / (1000 * 60 * 60 * 24);
                    totalDaysToClose += days;
                    closedActions++;
                }
            }
            
            // التحقق من التأخير
            if (action.originalTargetDate) {
                const targetDate = new Date(action.originalTargetDate);
                if (targetDate < now && status !== 'Closed' && status !== 'مغلق' && status !== 'مكتمل') {
                    analysis.overdue++;
                }
            }
            
            const type = action.typeOfIssue || 'Unknown';
            analysis.byType[type] = (analysis.byType[type] || 0) + 1;
            
            const dept = action.department || 'Unknown';
            analysis.byDepartment[dept] = (analysis.byDepartment[dept] || 0) + 1;
        });
        
        analysis.completionRate = filtered.length > 0 ? (closedCount / filtered.length) * 100 : 0;
        analysis.averageDaysToClose = closedActions > 0 ? (totalDaysToClose / closedActions) : 0;
        
        return analysis;
    } catch (error) {
        Logger.log('Error in analyzeActions: ' + error.toString());
        return { total: 0, error: error.toString() };
    }
}

/**
 * تحليل التدريب
 */
function analyzeTraining(trainings, options = {}) {
    try {
        if (!trainings || trainings.length === 0) {
            return { total: 0, totalParticipants: 0, byStatus: {}, completionRate: 0 };
        }
        
        let filtered = trainings;
        if (options.startDate || options.endDate) {
            filtered = trainings.filter(training => {
                if (!training.startDate) return false;
                const trainingDate = new Date(training.startDate);
                if (options.startDate && trainingDate < new Date(options.startDate)) return false;
                if (options.endDate && trainingDate > new Date(options.endDate)) return false;
                return true;
            });
        }
        
        const analysis = {
            total: filtered.length,
            totalParticipants: 0,
            byStatus: {},
            completionRate: 0,
            averageParticipants: 0
        };
        
        let completedCount = 0;
        filtered.forEach(training => {
            const status = training.status || 'Unknown';
            analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;
            
            if (status === 'Completed' || status === 'مكتمل') {
                completedCount++;
            }
            
            const participants = training.participantsCount || training.participants ? 
                (typeof training.participants === 'string' ? 
                    (training.participants.match(/,/g) || []).length + 1 : 
                    (Array.isArray(training.participants) ? training.participants.length : 0)) : 0;
            analysis.totalParticipants += participants;
        });
        
        analysis.completionRate = filtered.length > 0 ? (completedCount / filtered.length) * 100 : 0;
        analysis.averageParticipants = filtered.length > 0 ? (analysis.totalParticipants / filtered.length) : 0;
        
        return analysis;
    } catch (error) {
        Logger.log('Error in analyzeTraining: ' + error.toString());
        return { total: 0, error: error.toString() };
    }
}

/**
 * تحليل المخالفات
 */
function analyzeViolations(violations, options = {}) {
    try {
        if (!violations || violations.length === 0) {
            return { total: 0, byType: {}, bySeverity: {}, byDepartment: {} };
        }
        
        let filtered = violations;
        if (options.startDate || options.endDate) {
            filtered = violations.filter(v => {
                if (!v.violationDate) return false;
                const vDate = new Date(v.violationDate);
                if (options.startDate && vDate < new Date(options.startDate)) return false;
                if (options.endDate && vDate > new Date(options.endDate)) return false;
                return true;
            });
        }
        
        if (options.department) {
            filtered = filtered.filter(v => v.department === options.department);
        }
        
        const analysis = {
            total: filtered.length,
            byType: {},
            bySeverity: {},
            byDepartment: {},
            trend: 'stable'
        };
        
        filtered.forEach(v => {
            const type = v.violationType || 'Unknown';
            analysis.byType[type] = (analysis.byType[type] || 0) + 1;
            
            const severity = v.severity || 'Unknown';
            analysis.bySeverity[severity] = (analysis.bySeverity[severity] || 0) + 1;
            
            const dept = v.department || 'Unknown';
            analysis.byDepartment[dept] = (analysis.byDepartment[dept] || 0) + 1;
        });
        
        return analysis;
    } catch (error) {
        Logger.log('Error in analyzeViolations: ' + error.toString());
        return { total: 0, error: error.toString() };
    }
}

/**
 * حساب مستوى المخاطر الإجمالي
 */
function calculateOverallRiskLevel(modules) {
    try {
        let riskScore = 0;
        let factors = 0;
        
        // الحوادث
        if (modules.incidents && modules.incidents.total > 0) {
            const criticalIncidents = modules.incidents.bySeverity['Critical'] || 
                                     modules.incidents.bySeverity['حرج'] || 0;
            riskScore += criticalIncidents * 10;
            riskScore += (modules.incidents.total - criticalIncidents) * 2;
            factors++;
        }
        
        // الحوادث الوشيكة
        if (modules.nearMiss && modules.nearMiss.total > 0) {
            riskScore += modules.nearMiss.total * 1;
            factors++;
        }
        
        // الإجراءات المتأخرة
        if (modules.actions && modules.actions.overdue > 0) {
            riskScore += modules.actions.overdue * 5;
            factors++;
        }
        
        // المخالفات
        if (modules.violations && modules.violations.total > 0) {
            const highSeverity = modules.violations.bySeverity['High'] || 
                               modules.violations.bySeverity['عالي'] || 0;
            riskScore += highSeverity * 5;
            riskScore += (modules.violations.total - highSeverity) * 1;
            factors++;
        }
        
        // حساب المتوسط
        const averageScore = factors > 0 ? (riskScore / factors) : 0;
        
        if (averageScore >= 50) return 'Critical';
        if (averageScore >= 30) return 'High';
        if (averageScore >= 15) return 'Medium';
        return 'Low';
    } catch (error) {
        Logger.log('Error calculating risk level: ' + error.toString());
        return 'Unknown';
    }
}

/**
 * إنشاء توصيات ذكية
 */
function generateRecommendations(modules) {
    try {
        const recommendations = [];
        
        // توصيات الحوادث
        if (modules.incidents) {
            if (modules.incidents.trend === 'increasing') {
                recommendations.push({
                    type: 'warning',
                    priority: 'high',
                    title: 'زيادة في عدد الحوادث',
                    description: 'لاحظنا زيادة في عدد الحوادث. نوصي بمراجعة إجراءات السلامة وتكثيف التدريب.',
                    action: 'مراجعة إجراءات السلامة والتدريب'
                });
            }
            
            const criticalIncidents = modules.incidents.bySeverity['Critical'] || 
                                     modules.incidents.bySeverity['حرج'] || 0;
            if (criticalIncidents > 0) {
                recommendations.push({
                    type: 'critical',
                    priority: 'urgent',
                    title: 'حوادث حرجة',
                    description: `يوجد ${criticalIncidents} حادث حرج يتطلب مراجعة فورية.`,
                    action: 'مراجعة فورية للحوادث الحرجة'
                });
            }
        }
        
        // توصيات الإجراءات
        if (modules.actions) {
            if (modules.actions.overdue > 0) {
                recommendations.push({
                    type: 'warning',
                    priority: 'high',
                    title: 'إجراءات متأخرة',
                    description: `يوجد ${modules.actions.overdue} إجراء متأخر. نوصي بمتابعة فورية.`,
                    action: 'متابعة الإجراءات المتأخرة'
                });
            }
            
            if (modules.actions.completionRate < 70) {
                recommendations.push({
                    type: 'info',
                    priority: 'medium',
                    title: 'معدل إتمام منخفض',
                    description: `معدل إتمام الإجراءات ${modules.actions.completionRate.toFixed(1)}% أقل من المستهدف.`,
                    action: 'تحسين معدل إتمام الإجراءات'
                });
            }
        }
        
        // توصيات التدريب
        if (modules.training) {
            if (modules.training.completionRate < 80) {
                recommendations.push({
                    type: 'info',
                    priority: 'medium',
                    title: 'معدل إتمام التدريب',
                    description: `معدل إتمام التدريب ${modules.training.completionRate.toFixed(1)}%.`,
                    action: 'تحسين معدل إتمام التدريب'
                });
            }
        }
        
        // توصيات عامة
        if (modules.violations && modules.violations.total > 10) {
            recommendations.push({
                type: 'warning',
                priority: 'medium',
                title: 'عدد كبير من المخالفات',
                description: `تم تسجيل ${modules.violations.total} مخالفة. نوصي بمراجعة إجراءات الامتثال.`,
                action: 'مراجعة إجراءات الامتثال'
            });
        }
        
        return recommendations;
    } catch (error) {
        Logger.log('Error generating recommendations: ' + error.toString());
        return [];
    }
}

/**
 * إنشاء ملخص تنفيذي
 */
function generateExecutiveSummary(modules) {
    try {
        const summary = {
            totalIncidents: modules.incidents?.total || 0,
            totalNearMisses: modules.nearMiss?.total || 0,
            totalActions: modules.actions?.total || 0,
            overdueActions: modules.actions?.overdue || 0,
            actionCompletionRate: modules.actions?.completionRate || 0,
            totalTrainings: modules.training?.total || 0,
            totalViolations: modules.violations?.total || 0,
            keyFindings: [],
            areasOfConcern: []
        };
        
        // النتائج الرئيسية
        if (summary.totalIncidents > 0) {
            summary.keyFindings.push(`تم تسجيل ${summary.totalIncidents} حادث`);
        }
        if (summary.overdueActions > 0) {
            summary.areasOfConcern.push(`${summary.overdueActions} إجراء متأخر`);
        }
        if (summary.actionCompletionRate < 70) {
            summary.areasOfConcern.push(`معدل إتمام الإجراءات منخفض (${summary.actionCompletionRate.toFixed(1)}%)`);
        }
        
        return summary;
    } catch (error) {
        Logger.log('Error generating executive summary: ' + error.toString());
        return {};
    }
}

/**
 * ============================================
 * اكتشاف الأنماط والتنبؤات
 * ============================================
 */

/**
 * اكتشاف أنماط في البيانات
 * @param {string} moduleName - اسم الموديول
 * @param {Object} options - خيارات التحليل
 * @return {Object} الأنماط المكتشفة
 */
function detectPatterns(moduleName, options = {}) {
    try {
        const spreadsheetId = getSpreadsheetId();
        const sheetName = moduleName;
        const data = readFromSheet(sheetName, spreadsheetId);
        
        if (!data || data.length === 0) {
            return { success: true, patterns: [] };
        }
        
        const patterns = [];
        
        // نمط الوقت (أيام الأسبوع، أوقات اليوم)
        const timePatterns = detectTimePatterns(data);
        if (timePatterns.length > 0) {
            patterns.push(...timePatterns);
        }
        
        // نمط الموقع
        const locationPatterns = detectLocationPatterns(data);
        if (locationPatterns.length > 0) {
            patterns.push(...locationPatterns);
        }
        
        // نمط الإدارة
        const departmentPatterns = detectDepartmentPatterns(data);
        if (departmentPatterns.length > 0) {
            patterns.push(...departmentPatterns);
        }
        
        return { success: true, patterns: patterns };
    } catch (error) {
        Logger.log('Error in detectPatterns: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء اكتشاف الأنماط: ' + error.toString() };
    }
}

/**
 * اكتشاف أنماط الوقت
 */
function detectTimePatterns(data) {
    try {
        const patterns = [];
        const dayOfWeekCount = {};
        const hourCount = {};
        
        data.forEach(record => {
            if (record.date) {
                const date = new Date(record.date);
                const dayOfWeek = date.getDay();
                const hour = date.getHours();
                
                dayOfWeekCount[dayOfWeek] = (dayOfWeekCount[dayOfWeek] || 0) + 1;
                hourCount[hour] = (hourCount[hour] || 0) + 1;
            }
        });
        
        // العثور على اليوم الأكثر تكراراً
        let maxDay = 0;
        let maxDayCount = 0;
        for (let day in dayOfWeekCount) {
            if (dayOfWeekCount[day] > maxDayCount) {
                maxDayCount = dayOfWeekCount[day];
                maxDay = parseInt(day);
            }
        }
        
        if (maxDayCount > data.length * 0.2) {
            const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            patterns.push({
                type: 'time',
                pattern: `معظم الحوادث تحدث في ${dayNames[maxDay]}`,
                confidence: (maxDayCount / data.length) * 100
            });
        }
        
        return patterns;
    } catch (error) {
        Logger.log('Error detecting time patterns: ' + error.toString());
        return [];
    }
}

/**
 * اكتشاف أنماط الموقع
 */
function detectLocationPatterns(data) {
    try {
        const patterns = [];
        const locationCount = {};
        
        data.forEach(record => {
            if (record.location) {
                locationCount[record.location] = (locationCount[record.location] || 0) + 1;
            }
        });
        
        // العثور على الموقع الأكثر تكراراً
        let maxLocation = '';
        let maxLocationCount = 0;
        for (let location in locationCount) {
            if (locationCount[location] > maxLocationCount) {
                maxLocationCount = locationCount[location];
                maxLocation = location;
            }
        }
        
        if (maxLocationCount > data.length * 0.3) {
            patterns.push({
                type: 'location',
                pattern: `معظم الحوادث تحدث في ${maxLocation}`,
                confidence: (maxLocationCount / data.length) * 100
            });
        }
        
        return patterns;
    } catch (error) {
        Logger.log('Error detecting location patterns: ' + error.toString());
        return [];
    }
}

/**
 * اكتشاف أنماط الإدارة
 */
function detectDepartmentPatterns(data) {
    try {
        const patterns = [];
        const departmentCount = {};
        
        data.forEach(record => {
            if (record.department) {
                departmentCount[record.department] = (departmentCount[record.department] || 0) + 1;
            }
        });
        
        // العثور على الإدارة الأكثر تكراراً
        let maxDept = '';
        let maxDeptCount = 0;
        for (let dept in departmentCount) {
            if (departmentCount[dept] > maxDeptCount) {
                maxDeptCount = departmentCount[dept];
                maxDept = dept;
            }
        }
        
        if (maxDeptCount > data.length * 0.3) {
            patterns.push({
                type: 'department',
                pattern: `معظم الحوادث تحدث في إدارة ${maxDept}`,
                confidence: (maxDeptCount / data.length) * 100
            });
        }
        
        return patterns;
    } catch (error) {
        Logger.log('Error detecting department patterns: ' + error.toString());
        return [];
    }
}

/**
 * ============================================
 * التوصيات الذكية
 * ============================================
 */

/**
 * الحصول على توصيات ذكية بناءً على البيانات
 * @param {string} userId - معرف المستخدم (اختياري)
 * @param {Object} context - السياق (module, department, etc.)
 * @return {Object} التوصيات
 */
function getSmartRecommendations(userId, context = {}) {
    try {
        const recommendations = [];
        const spreadsheetId = getSpreadsheetId();
        
        // تحليل البيانات
        const analysis = analyzeHSEData({
            module: context.module,
            department: context.department,
            startDate: context.startDate,
            endDate: context.endDate
        });
        
        if (analysis.success) {
            recommendations.push(...analysis.data.recommendations);
        }
        
        // توصيات مخصصة حسب المستخدم
        if (userId) {
            const userRecommendations = getUserSpecificRecommendations(userId, context);
            recommendations.push(...userRecommendations);
        }
        
        // ترتيب حسب الأولوية
        recommendations.sort((a, b) => {
            const priorityOrder = { 'urgent': 3, 'high': 2, 'medium': 1, 'low': 0 };
            return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        });
        
        return { success: true, recommendations: recommendations };
    } catch (error) {
        Logger.log('Error in getSmartRecommendations: ' + error.toString());
        return { success: false, message: 'حدث خطأ أثناء الحصول على التوصيات: ' + error.toString() };
    }
}

/**
 * توصيات مخصصة للمستخدم
 */
function getUserSpecificRecommendations(userId, context) {
    try {
        const recommendations = [];
        const spreadsheetId = getSpreadsheetId();
        
        // الحصول على مهام المستخدم
        const userTasks = getUserTasksByUserId(userId);
        if (userTasks.success && userTasks.data) {
            const overdueTasks = userTasks.data.filter(task => {
                if (!task.dueDate) return false;
                return new Date(task.dueDate) < new Date() && 
                       task.status !== 'مكتمل' && task.status !== 'completed';
            });
            
            if (overdueTasks.length > 0) {
                recommendations.push({
                    type: 'task',
                    priority: 'high',
                    title: 'مهام متأخرة',
                    description: `لديك ${overdueTasks.length} مهمة متأخرة`,
                    action: 'مراجعة المهام المتأخرة'
                });
            }
        }
        
        // الحصول على الإجراءات المكلف بها
        const actions = readFromSheet('ActionTrackingRegister', spreadsheetId);
        const userActions = actions.filter(action => {
            return action.responsible === userId || 
                   (action.assignedTo && action.assignedTo === userId);
        });
        
        const overdueActions = userActions.filter(action => {
            if (!action.originalTargetDate) return false;
            return new Date(action.originalTargetDate) < new Date() && 
                   action.status !== 'Closed' && action.status !== 'مغلق';
        });
        
        if (overdueActions.length > 0) {
            recommendations.push({
                type: 'action',
                priority: 'high',
                title: 'إجراءات متأخرة',
                description: `لديك ${overdueActions.length} إجراء متأخر`,
                action: 'متابعة الإجراءات المتأخرة'
            });
        }
        
        return recommendations;
    } catch (error) {
        Logger.log('Error in getUserSpecificRecommendations: ' + error.toString());
        return [];
    }
}

/**
 * ============================================
 * معالجة اللغة الطبيعية والردود الذكية
 * ============================================
 */

/**
 * معالجة سؤال المستخدم وإرجاع رد ذكي
 * @param {string} question - سؤال المستخدم
 * @param {Object} context - السياق {userId, userName, userRole, conversationHistory}
 * @return {Object} رد ذكي مع البيانات
 */
/**
 * ============================================
 * تكامل Google Gemini AI
 * ============================================
 */

const GEMINI_API_KEY = 'AIzaSyAD7S2HF5RwKFlp0Ijags9a7c9o57Z3o2Y';
const GEMINI_MODEL = 'gemini-1.5-flash';

// Cache للإحصاءات لتجنب إعادة قراءة الشيتات في كل طلب
var _hseStatsCache = null;
var _hseStatsCacheTime = 0;
var HSE_STATS_CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

/**
 * استدعاء Gemini API مع سياق بيانات HSE المباشرة من الشيتات
 * @param {string} question - سؤال المستخدم
 * @param {Object} context - سياق المستخدم (اسم، دور...)
 * @return {string|null} نص الرد من Gemini أو null عند الفشل
 */
function askGeminiWithHSEContext(question, context) {
  try {
    // استخدام البيانات المُمررة أولاً، وإذا لم تتوفر نجلب من Cache أو الشيتات
    var hseStats = context.localStats || buildHSEStatsForGemini();

    // بناء سياق البيانات الهيكلية إن وُجدت
    var structuredDataSection = '';
    if (context.structuredData) {
      structuredDataSection = '\n\nبيانات مستخرجة من النظام ذات صلة بالسؤال:\n' + context.structuredData;
    }

    var intentNote = '';
    if (context.intentType && context.intentType !== 'general') {
      intentNote = '\n- نوع الطلب المكتشف: ' + context.intentType;
    }

    const systemPrompt =
      'أنت مساعد ذكاء اصطناعي متخصص في إدارة السلامة والصحة المهنية (HSE).\n' +
      'دورك: الإجابة على أسئلة فريق HSE باللغة العربية بدقة واحترافية.\n\n' +
      'ملخص إحصائي حالي للنظام:\n' +
      JSON.stringify(hseStats, null, 2) +
      structuredDataSection + '\n\n' +
      'معلومات المستخدم:\n' +
      '- الاسم: ' + (context.userName || 'غير محدد') + '\n' +
      '- الدور الوظيفي: ' + (context.userRole || 'غير محدد') + '\n' +
      '- التاريخ الحالي: ' + new Date().toLocaleDateString('ar-SA') +
      intentNote + '\n\n' +
      'تعليمات الإجابة:\n' +
      '1. أجب دائماً باللغة العربية بشكل مباشر وواضح\n' +
      '2. استخدم الأرقام والإحصاءات من البيانات المقدمة أعلاه\n' +
      '3. إذا لم تجد بيانات كافية، قدم معلومات HSE عامة مفيدة ودقيقة\n' +
      '4. كن محدداً وعملياً - لا تقل "لا أعلم" بل قدم ما تستطيع\n' +
      '5. استخدم رموزاً تعبيرية مناسبة (📊 🔴 ✅ ⚠️) لتوضيح الفقرات\n' +
      '6. اجعل الإجابة موجزة (3-8 أسطر إلا إذا طُلب تفصيل أكثر)';

    const payload = {
      contents: [{
        parts: [{ text: systemPrompt + '\n\nسؤال المستخدم: ' + question }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.8
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    };

    const response = UrlFetchApp.fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      Logger.log('Gemini API Error ' + responseCode + ': ' + responseBody);
      return null;
    }

    const parsed = JSON.parse(responseBody);
    if (
      parsed.candidates &&
      parsed.candidates[0] &&
      parsed.candidates[0].content &&
      parsed.candidates[0].content.parts &&
      parsed.candidates[0].content.parts[0]
    ) {
      return parsed.candidates[0].content.parts[0].text;
    }

    Logger.log('Gemini: No valid candidate in response');
    return null;

  } catch (error) {
    Logger.log('Error calling Gemini API: ' + error.toString());
    return null;
  }
}

/**
 * بناء ملخص إحصائي من بيانات الشيتات لتغذية Gemini (مع Cache لتسريع الاستجابة)
 * @return {Object} إحصاءات موجزة من جميع الوحدات
 */
function buildHSEStatsForGemini() {
  try {
    // إرجاع من Cache إذا كانت البيانات حديثة (أقل من 5 دقائق)
    var nowMs = Date.now();
    if (_hseStatsCache && (nowMs - _hseStatsCacheTime) < HSE_STATS_CACHE_TTL) {
      return _hseStatsCache;
    }

    const spreadsheetId = getSpreadsheetId();
    const stats = {};
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const modules = [
      { label: 'الحوادث', sheet: 'Incidents', dateField: 'date' },
      { label: 'الحوادث_الوشيكة', sheet: 'NearMiss', dateField: 'date' },
      { label: 'المخالفات', sheet: 'Violations', dateField: 'date' },
      { label: 'التدريب', sheet: 'Training', dateField: 'date' },
      { label: 'الإجراءات_التصحيحية', sheet: 'ActionTrackingRegister', dateField: 'dueDate' },
      { label: 'الموظفون', sheet: 'Employees', dateField: null },
      { label: 'المقاولون_المعتمدون', sheet: 'ApprovedContractors', dateField: null }
    ];

    modules.forEach(function(mod) {
      try {
        var data = readFromSheet(mod.sheet, spreadsheetId);
        if (!data || data.length === 0) {
          stats[mod.label] = { الإجمالي: 0 };
          return;
        }

        var entry = { الإجمالي: data.length };

        if (mod.dateField) {
          var thisMonth = data.filter(function(r) {
            var d = r[mod.dateField];
            return d && new Date(d) >= thisMonthStart;
          });
          var lastMonth = data.filter(function(r) {
            var d = r[mod.dateField];
            if (!d) return false;
            var dt = new Date(d);
            return dt >= lastMonthStart && dt < thisMonthStart;
          });
          entry['هذا_الشهر'] = thisMonth.length;
          entry['الشهر_الماضي'] = lastMonth.length;
        }

        // إحصاءات خاصة بالإجراءات المتأخرة
        if (mod.sheet === 'ActionTrackingRegister') {
          var overdue = data.filter(function(r) {
            return r.status !== 'Completed' && r.dueDate && new Date(r.dueDate) < now;
          });
          entry['متأخرة'] = overdue.length;
        }

        // إحصاءات حسب الخطورة للحوادث
        if (mod.sheet === 'Incidents') {
          var bySeverity = {};
          data.forEach(function(r) { bySeverity[r.severity || 'غير_محدد'] = (bySeverity[r.severity || 'غير_محدد'] || 0) + 1; });
          entry['حسب_الخطورة'] = bySeverity;
        }

        stats[mod.label] = entry;
      } catch (e) {
        Logger.log('buildHSEStatsForGemini - skip ' + mod.sheet + ': ' + e.toString());
      }
    });

    // تخزين في Cache
    _hseStatsCache = stats;
    _hseStatsCacheTime = Date.now();
    return stats;
  } catch (error) {
    Logger.log('Error in buildHSEStatsForGemini: ' + error.toString());
    return _hseStatsCache || {};
  }
}

// ============================================

function processAIQuestion(question, context = {}) {
    try {
        if (!question || typeof question !== 'string') {
            return {
                success: false,
                message: 'يرجى إدخال سؤال صحيح'
            };
        }
        
        const startTime = Date.now();
        const questionLower = question.toLowerCase().trim();
        
        // تحليل السؤال وفهم النية
        const intent = analyzeQuestionIntent(questionLower, question);
        
        // استخراج المعاملات من السؤال
        const parameters = extractQuestionParameters(questionLower, question);
        
        // تحديد الموديول المستهدف
        const targetModule = identifyTargetModule(intent, parameters);
        
        // الحصول على البيانات المطلوبة
        let responseData = null;
        let responseText = '';
        let actions = [];
        
        // جمع البيانات الهيكلية أولاً (سريع - من الشيتات)
        var fallbackText = '';
        switch (intent.type) {
            case 'analyze':
            case 'statistics':
            case 'report':
                responseData = handleAnalysisQuestion(intent, parameters, context);
                fallbackText = generateAnalysisResponse(responseData, intent, parameters);
                break;

            case 'search':
            case 'find':
            case 'list':
                responseData = handleSearchQuestion(intent, parameters, context);
                fallbackText = generateSearchResponse(responseData, intent, parameters);
                break;

            case 'count':
            case 'number':
                responseData = handleCountQuestion(intent, parameters, context);
                fallbackText = generateCountResponse(responseData, intent, parameters);
                break;

            case 'status':
            case 'check':
                responseData = handleStatusQuestion(intent, parameters, context);
                fallbackText = generateStatusResponse(responseData, intent, parameters);
                break;

            case 'recommendation':
            case 'suggestion':
                responseData = handleRecommendationQuestion(intent, parameters, context);
                fallbackText = generateRecommendationResponse(responseData, intent, parameters);
                break;

            case 'help':
            case 'howto':
                fallbackText = generateHelpResponse(intent, parameters);
                break;

            default:
                fallbackText = generateDefaultResponse(question, context);
        }

        // استخدام Gemini لكل الأسئلة مع تمرير البيانات الهيكلية كسياق
        var geminiContext = {
            userId: context.userId || null,
            userName: context.userName || null,
            userRole: context.userRole || null,
            intentType: intent.type,
            localStats: context.localStats || null,
            structuredData: responseData ? JSON.stringify(responseData).substring(0, 3000) : null
        };
        var geminiAnswer = askGeminiWithHSEContext(question, geminiContext);
        responseText = geminiAnswer || fallbackText;
        
        // إضافة أزرار الإجراءات السريعة
        if (targetModule) {
            actions.push({
                label: `فتح ${getModuleArabicName(targetModule)}`,
                icon: getModuleIcon(targetModule),
                action: 'navigate',
                target: targetModule
            });
        }
        
        const responseTime = Date.now() - startTime;
        
        // حفظ السجل
        try {
            addUserAILogToSheet({
                userId: context.userId || 'unknown',
                userName: context.userName || 'Unknown',
                query: question,
                intent: intent.type,
                module: targetModule || 'general',
                response: responseText,
                responseTime: responseTime,
                timestamp: new Date()
            });
        } catch (logError) {
            Logger.log('Warning: Could not log AI question: ' + logError.toString());
        }
        
        return {
            success: true,
            text: responseText,
            data: responseData,
            intent: intent,
            module: targetModule,
            actions: actions,
            responseTime: responseTime
        };
        
    } catch (error) {
        Logger.log('Error in processAIQuestion: ' + error.toString());
        return {
            success: false,
            message: 'حدث خطأ أثناء معالجة السؤال. يرجى المحاولة مرة أخرى.',
            error: error.toString()
        };
    }
}

/**
 * تحليل نية السؤال
 */
function analyzeQuestionIntent(questionLower, originalQuestion) {
    const intent = {
        type: 'general',
        confidence: 0.5,
        keywords: []
    };
    
    // أنماط التحليل والإحصائيات
    const analysisPatterns = [
        'تحليل', 'تحليل', 'إحصائيات', 'statistics', 'analysis', 'analyze',
        'تقرير', 'report', 'reports', 'بيانات', 'data', 'معلومات', 'information'
    ];
    
    // أنماط البحث
    const searchPatterns = [
        'ابحث', 'بحث', 'find', 'search', 'عرض', 'show', 'أعرض', 'list',
        'ما هي', 'what are', 'ما هو', 'what is', 'من', 'who'
    ];
    
    // أنماط العد
    const countPatterns = [
        'كم', 'عدد', 'count', 'how many', 'كم عدد', 'ما عدد',
        'إجمالي', 'total', 'مجموع', 'sum'
    ];
    
    // أنماط الحالة
    const statusPatterns = [
        'حالة', 'status', 'state', 'ما حالة', 'what is the status',
        'هل', 'is', 'are', 'check', 'تحقق'
    ];
    
    // أنماط التوصيات
    const recommendationPatterns = [
        'توصية', 'recommendation', 'suggestion', 'نصيحة', 'advice',
        'ما الذي', 'what should', 'ماذا', 'what'
    ];
    
    // أنماط المساعدة
    const helpPatterns = [
        'مساعدة', 'help', 'كيف', 'how', 'طريقة', 'way', 'كيفية',
        'استخدام', 'use', 'استعمل'
    ];
    
    // حساب النقاط لكل نوع
    let analysisScore = 0;
    let searchScore = 0;
    let countScore = 0;
    let statusScore = 0;
    let recommendationScore = 0;
    let helpScore = 0;
    
    analysisPatterns.forEach(pattern => {
        if (questionLower.includes(pattern)) analysisScore += 1;
    });
    
    searchPatterns.forEach(pattern => {
        if (questionLower.includes(pattern)) searchScore += 1;
    });
    
    countPatterns.forEach(pattern => {
        if (questionLower.includes(pattern)) countScore += 1;
    });
    
    statusPatterns.forEach(pattern => {
        if (questionLower.includes(pattern)) statusScore += 1;
    });
    
    recommendationPatterns.forEach(pattern => {
        if (questionLower.includes(pattern)) recommendationScore += 1;
    });
    
    helpPatterns.forEach(pattern => {
        if (questionLower.includes(pattern)) helpScore += 1;
    });
    
    // تحديد النية الأقوى
    const scores = {
        'analyze': analysisScore,
        'search': searchScore,
        'count': countScore,
        'status': statusScore,
        'recommendation': recommendationScore,
        'help': helpScore
    };
    
    let maxScore = 0;
    let maxType = 'general';
    
    for (let type in scores) {
        if (scores[type] > maxScore) {
            maxScore = scores[type];
            maxType = type;
        }
    }
    
    intent.type = maxScore > 0 ? maxType : 'general';
    intent.confidence = Math.min(maxScore / 3, 1.0);
    
    return intent;
}

/**
 * استخراج المعاملات من السؤال
 */
function extractQuestionParameters(questionLower, originalQuestion) {
    const params = {
        module: null,
        department: null,
        dateRange: null,
        severity: null,
        status: null,
        location: null,
        specificValue: null
    };
    
    // تحديد الموديول
    const moduleKeywords = {
        'incidents': ['حادث', 'incident', 'حوادث', 'accident'],
        'nearmiss': ['وشيك', 'near miss', 'nearmiss', 'حادث وشيك'],
        'training': ['تدريب', 'training', 'برنامج تدريبي'],
        'budget': ['ميزانية', 'budget', 'إنفاق', 'spending'],
        'ptw': ['تصريح', 'permit', 'ptw', 'work permit', 'تصاريح'],
        'inspection': ['فحص', 'inspection', 'فحص دوري', 'periodic'],
        'clinic': ['عيادة', 'clinic', 'طبي', 'medical'],
        'kpi': ['مؤشر', 'kpi', 'أداء', 'performance'],
        'violations': ['مخالفة', 'violation', 'مخالفات'],
        'actions': ['إجراء', 'action', 'إجراءات', 'corrective']
    };
    
    for (let module in moduleKeywords) {
        if (moduleKeywords[module].some(keyword => questionLower.includes(keyword))) {
            params.module = module;
            break;
        }
    }
    
    // استخراج نطاق التاريخ
    const datePatterns = [
        { pattern: /هذا الشهر|this month|الشهر الحالي/i, value: 'thisMonth' },
        { pattern: /الشهر الماضي|last month|الشهر السابق/i, value: 'lastMonth' },
        { pattern: /هذا العام|this year|العام الحالي/i, value: 'thisYear' },
        { pattern: /آخر (\d+) يوم/i, extract: (match) => ({ days: parseInt(match[1]) }) },
        { pattern: /آخر (\d+) شهر/i, extract: (match) => ({ months: parseInt(match[1]) }) }
    ];
    
    for (let datePattern of datePatterns) {
        const match = originalQuestion.match(datePattern.pattern);
        if (match) {
            if (datePattern.extract) {
                params.dateRange = datePattern.extract(match);
            } else {
                params.dateRange = datePattern.value;
            }
            break;
        }
    }
    
    // استخراج الشدة
    if (questionLower.includes('حرج') || questionLower.includes('critical')) {
        params.severity = 'Critical';
    } else if (questionLower.includes('عالي') || questionLower.includes('high')) {
        params.severity = 'High';
    } else if (questionLower.includes('متوسط') || questionLower.includes('medium')) {
        params.severity = 'Medium';
    } else if (questionLower.includes('منخفض') || questionLower.includes('low')) {
        params.severity = 'Low';
    }
    
    // استخراج الحالة
    if (questionLower.includes('مكتمل') || questionLower.includes('completed')) {
        params.status = 'Completed';
    } else if (questionLower.includes('قيد') || questionLower.includes('pending')) {
        params.status = 'Pending';
    } else if (questionLower.includes('متأخر') || questionLower.includes('overdue')) {
        params.status = 'Overdue';
    }
    
    return params;
}

/**
 * تحديد الموديول المستهدف
 */
function identifyTargetModule(intent, parameters) {
    if (parameters.module) {
        return parameters.module;
    }
    
    // محاولة التخمين من النية
    if (intent.type === 'analyze' || intent.type === 'statistics') {
        return 'general'; // تحليل عام
    }
    
    return null;
}

/**
 * معالجة سؤال التحليل
 */
function handleAnalysisQuestion(intent, parameters, context) {
    try {
        const options = {
            module: parameters.module || null,
            department: parameters.department || null,
            userId: context.userId || null,
            userName: context.userName || null
        };
        
        // إضافة نطاق التاريخ
        if (parameters.dateRange) {
            if (parameters.dateRange === 'thisMonth') {
                const now = new Date();
                options.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                options.endDate = now;
            } else if (parameters.dateRange === 'lastMonth') {
                const now = new Date();
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                options.startDate = lastMonth;
                options.endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            } else if (parameters.dateRange === 'thisYear') {
                const now = new Date();
                options.startDate = new Date(now.getFullYear(), 0, 1);
                options.endDate = now;
            } else if (parameters.dateRange.days) {
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - parameters.dateRange.days);
                options.startDate = startDate;
                options.endDate = endDate;
            } else if (parameters.dateRange.months) {
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - parameters.dateRange.months);
                options.startDate = startDate;
                options.endDate = endDate;
            }
        }
        
        return analyzeHSEData(options);
    } catch (error) {
        Logger.log('Error in handleAnalysisQuestion: ' + error.toString());
        return { success: false, message: error.toString() };
    }
}

/**
 * توليد رد التحليل
 */
function generateAnalysisResponse(analysisData, intent, parameters) {
    if (!analysisData || !analysisData.success) {
        return 'عذراً، لم أتمكن من تحليل البيانات في الوقت الحالي. يرجى المحاولة مرة أخرى.';
    }
    
    const data = analysisData.data;
    let response = '';
    
    if (parameters.module) {
        const moduleName = getModuleArabicName(parameters.module);
        response += `📊 تحليل ${moduleName}:\n\n`;
        
        if (data.modules && data.modules[parameters.module]) {
            const moduleData = data.modules[parameters.module];
            response += generateModuleAnalysisText(moduleData, parameters.module);
        }
    } else {
        response += '📊 تحليل شامل لبيانات HSE:\n\n';
        response += generateGeneralAnalysisText(data);
    }
    
    // إضافة التوصيات
    if (data.recommendations && data.recommendations.length > 0) {
        response += '\n\n💡 التوصيات:\n';
        data.recommendations.slice(0, 3).forEach((rec, index) => {
            response += `${index + 1}. ${rec.title}: ${rec.description}\n`;
        });
    }
    
    return response;
}

/**
 * توليد نص تحليل الموديول
 */
function generateModuleAnalysisText(moduleData, moduleName) {
    let text = '';
    
    if (moduleData.total !== undefined) {
        text += `• إجمالي السجلات: ${moduleData.total}\n`;
    }
    
    if (moduleData.bySeverity) {
        const severities = Object.keys(moduleData.bySeverity);
        if (severities.length > 0) {
            text += '\nحسب الشدة:\n';
            severities.forEach(severity => {
                text += `  - ${severity}: ${moduleData.bySeverity[severity]}\n`;
            });
        }
    }
    
    if (moduleData.byDepartment) {
        const departments = Object.keys(moduleData.byDepartment);
        if (departments.length > 0) {
            text += '\nحسب الإدارة:\n';
            departments.slice(0, 5).forEach(dept => {
                text += `  - ${dept}: ${moduleData.byDepartment[dept]}\n`;
            });
        }
    }
    
    if (moduleData.trend) {
        const trendText = {
            'increasing': '📈 في ازدياد',
            'decreasing': '📉 في انخفاض',
            'stable': '➡️ مستقرة'
        };
        text += `\n• الاتجاه: ${trendText[moduleData.trend] || moduleData.trend}\n`;
    }
    
    if (moduleData.completionRate !== undefined) {
        text += `• معدل الإتمام: ${moduleData.completionRate.toFixed(1)}%\n`;
    }
    
    if (moduleData.overdue !== undefined && moduleData.overdue > 0) {
        text += `\n⚠️ يوجد ${moduleData.overdue} سجل متأخر\n`;
    }
    
    return text;
}

/**
 * توليد نص التحليل العام
 */
function generateGeneralAnalysisText(data) {
    let text = '';
    
    if (data.summary) {
        const summary = data.summary;
        if (summary.totalIncidents !== undefined) {
            text += `• إجمالي الحوادث: ${summary.totalIncidents}\n`;
        }
        if (summary.totalActions !== undefined) {
            text += `• إجمالي الإجراءات: ${summary.totalActions}\n`;
        }
        if (summary.overdueActions !== undefined && summary.overdueActions > 0) {
            text += `⚠️ الإجراءات المتأخرة: ${summary.overdueActions}\n`;
        }
        if (summary.actionCompletionRate !== undefined) {
            text += `• معدل إتمام الإجراءات: ${summary.actionCompletionRate.toFixed(1)}%\n`;
        }
    }
    
    if (data.riskLevel) {
        const riskText = {
            'Critical': '🔴 حرج',
            'High': '🟠 عالي',
            'Medium': '🟡 متوسط',
            'Low': '🟢 منخفض'
        };
        text += `\n• مستوى المخاطر: ${riskText[data.riskLevel] || data.riskLevel}\n`;
    }
    
    return text;
}

/**
 * معالجة سؤال البحث
 */
function handleSearchQuestion(intent, parameters, context) {
    try {
        const spreadsheetId = getSpreadsheetId();
        let results = [];
        
        if (!parameters.module) {
            return { success: false, message: 'يرجى تحديد الموديول للبحث' };
        }
        
        const sheetName = getSheetNameForModule(parameters.module);
        if (!sheetName) {
            return { success: false, message: 'موديول غير معروف' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        
        // تطبيق الفلاتر
        let filtered = data || [];
        
        if (parameters.department) {
            filtered = filtered.filter(item => item.department === parameters.department);
        }
        
        if (parameters.severity) {
            filtered = filtered.filter(item => item.severity === parameters.severity);
        }
        
        if (parameters.status) {
            filtered = filtered.filter(item => item.status === parameters.status);
        }
        
        if (parameters.dateRange) {
            // تطبيق فلتر التاريخ
        }
        
        results = filtered.slice(0, 10); // الحد الأقصى 10 نتائج
        
        return {
            success: true,
            results: results,
            total: filtered.length
        };
    } catch (error) {
        Logger.log('Error in handleSearchQuestion: ' + error.toString());
        return { success: false, message: error.toString() };
    }
}

/**
 * توليد رد البحث
 */
function generateSearchResponse(searchData, intent, parameters) {
    if (!searchData || !searchData.success) {
        return 'عذراً، لم أتمكن من البحث في الوقت الحالي.';
    }
    
    const moduleName = getModuleArabicName(parameters.module);
    let response = `🔍 نتائج البحث في ${moduleName}:\n\n`;
    
    if (searchData.total === 0) {
        response += 'لم يتم العثور على نتائج.';
        return response;
    }
    
    response += `تم العثور على ${searchData.total} نتيجة:\n\n`;
    
    searchData.results.slice(0, 5).forEach((item, index) => {
        response += `${index + 1}. `;
        if (item.title) response += item.title;
        if (item.description) response += ` - ${item.description.substring(0, 50)}...`;
        if (item.date) response += ` (${new Date(item.date).toLocaleDateString('ar-SA')})`;
        response += '\n';
    });
    
    if (searchData.total > 5) {
        response += `\n... و ${searchData.total - 5} نتيجة أخرى`;
    }
    
    return response;
}

/**
 * معالجة سؤال العد
 */
function handleCountQuestion(intent, parameters, context) {
    try {
        const spreadsheetId = getSpreadsheetId();
        
        if (!parameters.module) {
            return { success: false, message: 'يرجى تحديد الموديول' };
        }
        
        const sheetName = getSheetNameForModule(parameters.module);
        if (!sheetName) {
            return { success: false, message: 'موديول غير معروف' };
        }
        
        const data = readFromSheet(sheetName, spreadsheetId);
        let filtered = data || [];
        
        // تطبيق الفلاتر
        if (parameters.department) {
            filtered = filtered.filter(item => item.department === parameters.department);
        }
        
        if (parameters.severity) {
            filtered = filtered.filter(item => item.severity === parameters.severity);
        }
        
        if (parameters.status) {
            filtered = filtered.filter(item => item.status === parameters.status);
        }
        
        return {
            success: true,
            count: filtered.length,
            total: (data || []).length
        };
    } catch (error) {
        Logger.log('Error in handleCountQuestion: ' + error.toString());
        return { success: false, message: error.toString() };
    }
}

/**
 * توليد رد العد
 */
function generateCountResponse(countData, intent, parameters) {
    if (!countData || !countData.success) {
        return 'عذراً، لم أتمكن من العد في الوقت الحالي.';
    }
    
    const moduleName = getModuleArabicName(parameters.module);
    let response = `📊 عدد السجلات في ${moduleName}: ${countData.count}`;
    
    if (countData.total !== countData.count) {
        response += ` من إجمالي ${countData.total}`;
    }
    
    return response;
}

/**
 * معالجة سؤال الحالة
 */
function handleStatusQuestion(intent, parameters, context) {
    try {
        // استخدام وظيفة التحليل للحصول على الحالة
        const analysis = handleAnalysisQuestion(intent, parameters, context);
        
        if (!analysis.success) {
            return analysis;
        }
        
        return {
            success: true,
            status: analysis.data.riskLevel || 'Unknown',
            summary: analysis.data.summary || {}
        };
    } catch (error) {
        Logger.log('Error in handleStatusQuestion: ' + error.toString());
        return { success: false, message: error.toString() };
    }
}

/**
 * توليد رد الحالة
 */
function generateStatusResponse(statusData, intent, parameters) {
    if (!statusData || !statusData.success) {
        return 'عذراً، لم أتمكن من التحقق من الحالة.';
    }
    
    const riskText = {
        'Critical': '🔴 حرج - يتطلب إجراء فوري',
        'High': '🟠 عالي - يحتاج إلى متابعة',
        'Medium': '🟡 متوسط - في الحدود المقبولة',
        'Low': '🟢 منخفض - حالة جيدة'
    };
    
    let response = `📋 حالة النظام:\n\n`;
    response += `• مستوى المخاطر: ${riskText[statusData.status] || statusData.status}\n`;
    
    if (statusData.summary) {
        if (statusData.summary.overdueActions > 0) {
            response += `\n⚠️ يوجد ${statusData.summary.overdueActions} إجراء متأخر`;
        }
        if (statusData.summary.actionCompletionRate !== undefined) {
            response += `\n• معدل إتمام الإجراءات: ${statusData.summary.actionCompletionRate.toFixed(1)}%`;
        }
    }
    
    return response;
}

/**
 * معالجة سؤال التوصيات
 */
function handleRecommendationQuestion(intent, parameters, context) {
    try {
        return getSmartRecommendations(context.userId, {
            module: parameters.module || null,
            department: parameters.department || null
        });
    } catch (error) {
        Logger.log('Error in handleRecommendationQuestion: ' + error.toString());
        return { success: false, message: error.toString() };
    }
}

/**
 * توليد رد التوصيات
 */
function generateRecommendationResponse(recData, intent, parameters) {
    if (!recData || !recData.success || !recData.recommendations || recData.recommendations.length === 0) {
        return 'لا توجد توصيات في الوقت الحالي.';
    }
    
    let response = '💡 التوصيات الذكية:\n\n';
    
    recData.recommendations.slice(0, 5).forEach((rec, index) => {
        const priorityIcon = {
            'urgent': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        };
        
        response += `${priorityIcon[rec.priority] || '•'} ${rec.title}\n`;
        response += `   ${rec.description}\n\n`;
    });
    
    return response;
}

/**
 * توليد رد المساعدة
 */
function generateHelpResponse(intent, parameters) {
    return `مرحباً! أنا مساعد النظام وأنا هنا لمساعدتك.\n\n` +
           `يمكنني مساعدتك في:\n\n` +
           `• تحليل البيانات والإحصائيات\n` +
           `• البحث في السجلات\n` +
           `• العد والإحصائيات\n` +
           `• التحقق من الحالة\n` +
           `• تقديم التوصيات الذكية\n\n` +
           `جرب أن تسألني:\n` +
           `• "ما عدد الحوادث هذا الشهر؟"\n` +
           `• "تحليل بيانات التدريب"\n` +
           `• "ما حالة الميزانية؟"\n` +
           `• "أعطني توصيات"\n` +
           `• "ابحث عن حوادث حرجة"`;
}

/**
 * توليد رد افتراضي
 */
function generateDefaultResponse(question, context) {
    return `أنا هنا لمساعدتك! يمكنك أن تسألني عن:\n\n` +
           `• تحليل البيانات والإحصائيات\n` +
           `• البحث في السجلات\n` +
           `• العد والإحصائيات\n` +
           `• التحقق من الحالة\n` +
           `• التوصيات الذكية\n\n` +
           `جرب أن تسألني بشكل أكثر تحديداً، مثل:\n` +
           `• "كم عدد الحوادث؟"\n` +
           `• "ما حالة الميزانية؟"\n` +
           `• "تحليل بيانات التدريب"`;
}

/**
 * الحصول على اسم الموديول بالعربية
 */
function getModuleArabicName(module) {
    const names = {
        'incidents': 'الحوادث',
        'nearmiss': 'الحوادث الوشيكة',
        'training': 'التدريب',
        'budget': 'الميزانية',
        'ptw': 'تصاريح العمل',
        'inspection': 'الفحوصات الدورية',
        'clinic': 'العيادة الطبية',
        'kpi': 'مؤشرات الأداء',
        'violations': 'المخالفات',
        'actions': 'الإجراءات التصحيحية'
    };
    
    return names[module] || module;
}

/**
 * الحصول على أيقونة الموديول
 */
function getModuleIcon(module) {
    const icons = {
        'incidents': 'fas fa-exclamation-triangle',
        'nearmiss': 'fas fa-exclamation-circle',
        'training': 'fas fa-graduation-cap',
        'budget': 'fas fa-wallet',
        'ptw': 'fas fa-id-card',
        'inspection': 'fas fa-clipboard-check',
        'clinic': 'fas fa-hospital',
        'kpi': 'fas fa-chart-line',
        'violations': 'fas fa-ban',
        'actions': 'fas fa-tasks'
    };
    
    return icons[module] || 'fas fa-folder';
}

/**
 * الحصول على اسم الورقة للموديول
 */
function getSheetNameForModule(module) {
    const sheetNames = {
        'incidents': 'Incidents',
        'nearmiss': 'NearMiss',
        'training': 'Training',
        'budget': 'SafetyBudget',
        'ptw': 'PTW',
        'inspection': 'PeriodicInspection',
        'clinic': 'Clinic',
        'kpi': 'SafetyKPIs',
        'violations': 'Violations',
        'actions': 'ActionTrackingRegister'
    };
    
    return sheetNames[module] || null;
}

