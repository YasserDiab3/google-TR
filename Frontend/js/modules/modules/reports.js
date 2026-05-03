/**
 * Reports Module
 * تم استخراجه من app-modules.js
 * دعم كامل للغتين: العربية والإنجليزية (عرض فقط، البيانات الأساسية لا تتغير)
 */
const Reports = {
    _languageChangeBound: false,

    /**
     * الحصول على اللغة الحالية
     */
    getCurrentLanguage() {
        try {
            return localStorage.getItem('language') || (typeof AppState !== 'undefined' && AppState.currentLanguage) || 'ar';
        } catch (e) {
            return 'ar';
        }
    },

    /**
     * الحصول على الترجمات حسب اللغة الحالية (عناوين وواجهة فقط، لا يغيّر البيانات المخزنة)
     */
    getTranslations() {
        const lang = this.getCurrentLanguage();
        const translations = {
            ar: {
                'title': 'التقارير',
                'subtitle': 'إنشاء وتصدير التقارير المختلفة',
                'card.period': 'تقرير شهري / سنوي',
                'card.periodDesc': 'إنشاء تقرير إحصائي للفترة (شهرياً أو سنوياً) يشمل التصاريح والملاحظات والحوادث والزيارات الطبية والتدريب والمخالفات',
                'card.incidents': 'تقرير الحوادث',
                'card.incidentsDesc': 'إنشاء تقرير شامل عن جميع الحوادث المسجلة',
                'card.training': 'تقرير التدريب',
                'card.trainingDesc': 'إنشاء تقرير عن برامج التدريب والمشاركين',
                'card.full': 'التقرير الشامل',
                'card.fullDesc': 'إنشاء تقرير شامل لجميع بيانات النظام',
                'btn.generate': 'إنشاء التقرير',
                'error.load': 'حدث خطأ أثناء تحميل البيانات',
                'btn.retry': 'إعادة المحاولة',
                'msg.noData': 'البيانات غير متوفرة. يرجى تحديث الصفحة',
                'msg.incidentsInvalid': 'بيانات الحوادث غير صحيحة',
                'msg.trainingInvalid': 'بيانات التدريب غير صحيحة',
                'msg.unknownReport': 'نوع التقرير غير معروف',
                'msg.allowPopups': 'يرجى السماح للنوافذ المنبثقة لعرض التقرير',
                'msg.invalidPeriodInput': 'صيغة الفترة غير صحيحة. يرجى المحاولة مرة أخرى.',
                'msg.periodCancelled': 'تم إلغاء اختيار الفترة.',
                'report.incidents': 'تقرير الحوادث',
                'report.training': 'تقرير التدريب',
                'report.full': 'التقرير الشامل',
                'report.periodSummary': 'التقرير الإحصائي للفترة',
                'report.totalIncidents': 'إجمالي الحوادث',
                'report.createdDate': 'تاريخ الإنشاء',
                'report.isoCode': 'كود ISO',
                'report.date': 'التاريخ',
                'report.location': 'الموقع',
                'report.severity': 'الخطورة',
                'report.status': 'الحالة',
                'report.description': 'الوصف',
                'report.totalPrograms': 'إجمالي برامج التدريب',
                'report.programName': 'اسم البرنامج',
                'report.trainer': 'المدرب',
                'report.participantsCount': 'عدد المشاركين',
                'report.generalStats': 'الإحصائيات العامة',
                'report.basicStats': 'الإحصائيات الأساسية',
                'report.type': 'النوع',
                'report.total': 'الإجمالي',
                'report.incidents': 'الحوادث',
                'report.nearmiss': 'الحوادث الوشيكة',
                'report.observations': 'الملاحظات',
                'report.ptw': 'تصاريح العمل',
                'report.trainingPrograms': 'برامج التدريب',
                'report.violations': 'المخالفات',
                'report.clinicVisits': 'الزيارات الطبية',
                'report.trainingSection': 'بند التدريب',
                'report.indicator': 'المؤشر',
                'report.value': 'القيمة',
                'report.traineesCount': 'عدد المتدربين',
                'report.avgTrainingHoursEmployees': 'متوسط ساعات التدريب للموظفين',
                'report.totalTrainingHoursEmployees': 'إجمالي ساعات التدريب لجميع الموظفين',
                'report.hour': 'ساعة',
                'report.trainingContractors': 'بند التدريب - المقاولين',
                'report.traineesContractors': 'عدد المتدربين للمقاولين',
                'report.avgTrainingContractors': 'متوسط ساعات التدريب للمقاولين',
                'report.totalTrainingContractors': 'إجمالي ساعات التدريب لجميع المقاولين',
                'report.violationsSection': 'بند المخالفات',
                'report.employeeViolations': 'عدد المخالفات للموظفين',
                'report.contractorViolations': 'عدد المخالفات للمقاولين',
                'report.violationsByType': 'المخالفات حسب النوع',
                'report.violationType': 'نوع المخالفة',
                'report.violationsCount': 'عدد المخالفات',
                'report.violationsByDept': 'المخالفات حسب الإدارة',
                'report.department': 'الإدارة',
                'report.period': 'الفترة',
                'report.periodTypeMonthly': 'تقرير شهري',
                'report.periodTypeYearly': 'تقرير سنوي',
                'report.employeeTrainingPrograms': 'عدد برامج التدريب للموظفين',
                'report.employeeTrainingTopics': 'عدد الموضوعات التدريبية للموظفين',
                'report.contractorTrainingPrograms': 'عدد برامج تدريب المقاولين',
                'report.contractorTrainingTopics': 'عدد الموضوعات التدريبية للمقاولين'
            },
            en: {
                'title': 'Reports',
                'subtitle': 'Create and export various reports',
                'card.period': 'Monthly / Yearly Report',
                'card.periodDesc': 'Generate a statistical report for a specific period (monthly or yearly) including permits, observations, incidents, clinic visits, training and violations',
                'card.incidents': 'Incidents Report',
                'card.incidentsDesc': 'Generate a comprehensive report of all recorded incidents',
                'card.training': 'Training Report',
                'card.trainingDesc': 'Generate a report on training programs and participants',
                'card.full': 'Comprehensive Report',
                'card.fullDesc': 'Generate a comprehensive report of all system data',
                'btn.generate': 'Generate Report',
                'error.load': 'An error occurred while loading data',
                'btn.retry': 'Retry',
                'msg.noData': 'Data not available. Please refresh the page',
                'msg.incidentsInvalid': 'Invalid incidents data',
                'msg.trainingInvalid': 'Invalid training data',
                'msg.unknownReport': 'Unknown report type',
                'msg.allowPopups': 'Please allow pop-ups to view the report',
                'msg.invalidPeriodInput': 'Invalid period format. Please try again.',
                'msg.periodCancelled': 'Period selection was cancelled.',
                'report.incidents': 'Incidents Report',
                'report.training': 'Training Report',
                'report.full': 'Comprehensive Report',
                'report.periodSummary': 'Period Summary Report',
                'report.totalIncidents': 'Total Incidents',
                'report.createdDate': 'Creation Date',
                'report.isoCode': 'ISO Code',
                'report.date': 'Date',
                'report.location': 'Location',
                'report.severity': 'Severity',
                'report.status': 'Status',
                'report.description': 'Description',
                'report.totalPrograms': 'Total Training Programs',
                'report.programName': 'Program Name',
                'report.trainer': 'Trainer',
                'report.participantsCount': 'Participants Count',
                'report.generalStats': 'General Statistics',
                'report.basicStats': 'Basic Statistics',
                'report.type': 'Type',
                'report.total': 'Total',
                'report.incidents': 'Incidents',
                'report.nearmiss': 'Near Miss',
                'report.observations': 'Observations',
                'report.ptw': 'Work Permits',
                'report.trainingPrograms': 'Training Programs',
                'report.violations': 'Violations',
                'report.clinicVisits': 'Clinic Visits',
                'report.trainingSection': 'Training Section',
                'report.indicator': 'Indicator',
                'report.value': 'Value',
                'report.traineesCount': 'Trainees Count',
                'report.avgTrainingHoursEmployees': 'Average Training Hours (Employees)',
                'report.totalTrainingHoursEmployees': 'Total Training Hours (Employees)',
                'report.hour': 'hour',
                'report.trainingContractors': 'Training Section - Contractors',
                'report.traineesContractors': 'Trainees Count (Contractors)',
                'report.avgTrainingContractors': 'Average Training Hours (Contractors)',
                'report.totalTrainingContractors': 'Total Training Hours (Contractors)',
                'report.violationsSection': 'Violations Section',
                'report.employeeViolations': 'Employee Violations Count',
                'report.contractorViolations': 'Contractor Violations Count',
                'report.violationsByType': 'Violations by Type',
                'report.violationType': 'Violation Type',
                'report.violationsCount': 'Violations Count',
                'report.violationsByDept': 'Violations by Department',
                'report.department': 'Department',
                'report.period': 'Period',
                'report.periodTypeMonthly': 'Monthly Report',
                'report.periodTypeYearly': 'Yearly Report',
                'report.employeeTrainingPrograms': 'Employee Training Programs',
                'report.employeeTrainingTopics': 'Employee Training Topics',
                'report.contractorTrainingPrograms': 'Contractor Training Programs',
                'report.contractorTrainingTopics': 'Contractor Training Topics'
            }
        };
        return {
            t: (key) => (translations[lang] && translations[lang][key]) ? translations[lang][key] : key,
            lang
        };
    },

    /**
     * تحميل الموديول (واجهة حسب لغة المستخدم، البيانات لا تتغير)
     */
    async load() {
        const section = document.getElementById('reports-section');
        if (!section) return;

        if (typeof AppState === 'undefined') {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('AppState غير متوفر!');
            } else {
                console.error('AppState غير متوفر!');
            }
            return;
        }

        const { t } = this.getTranslations();

        if (!this._languageChangeBound) {
            this._languageChangeBound = true;
            document.addEventListener('language-changed', () => {
                if (document.getElementById('reports-section') && document.getElementById('reports-section').innerHTML) {
                    Reports.load();
                }
            });
        }

        try {
            section.innerHTML = `
            <div class="section-header">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="section-title">
                            <i class="fas fa-file-alt ml-3"></i>
                            ${t('title')}
                        </h1>
                        <p class="section-subtitle">${t('subtitle')}</p>
                    </div>
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-exclamation-triangle ml-2"></i>
                            ${t('card.incidents')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <p class="text-gray-600 mb-4">${t('card.incidentsDesc')}</p>
                        <button onclick="Reports.generateAndExport('incidents')" class="btn-primary w-full">
                            <i class="fas fa-file-pdf ml-2"></i>
                            ${t('btn.generate')}
                        </button>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-graduation-cap ml-2"></i>
                            ${t('card.training')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <p class="text-gray-600 mb-4">${t('card.trainingDesc')}</p>
                        <button onclick="Reports.generateAndExport('training')" class="btn-primary w-full">
                            <i class="fas fa-file-pdf ml-2"></i>
                            ${t('btn.generate')}
                        </button>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-calendar-alt ml-2"></i>
                            ${t('card.period')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <p class="text-gray-600 mb-4">${t('card.periodDesc')}</p>
                        <button onclick="Reports.generateAndExport('period')" class="btn-primary w-full">
                            <i class="fas fa-file-pdf ml-2"></i>
                            ${t('btn.generate')}
                        </button>
                    </div>
                </div>

                <div class="content-card">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="fas fa-chart-line ml-2"></i>
                            ${t('card.full')}
                        </h3>
                    </div>
                    <div class="card-body">
                        <p class="text-gray-600 mb-4">${t('card.fullDesc')}</p>
                        <button onclick="Reports.generateAndExport('full')" class="btn-primary w-full">
                            <i class="fas fa-file-pdf ml-2"></i>
                            ${t('btn.generate')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        } catch (error) {
            if (typeof Utils !== 'undefined' && Utils.safeError) {
                Utils.safeError('❌ خطأ في تحميل مديول التقارير:', error);
            } else {
                console.error('❌ خطأ في تحميل مديول التقارير:', error);
            }
            if (section) {
                const { t: tErr } = this.getTranslations();
                section.innerHTML = `
                    <div class="content-card">
                        <div class="card-body">
                            <div class="empty-state">
                                <i class="fas fa-exclamation-triangle text-yellow-500 text-4xl mb-4"></i>
                                <p class="text-gray-500 mb-4">${tErr('error.load')}</p>
                                <button onclick="Reports.load()" class="btn-primary">
                                    <i class="fas fa-redo ml-2"></i>
                                    ${tErr('btn.retry')}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    },

    /**
     * التأكد من تحميل بيانات التدريب (موظفين + مقاولين) قبل التقرير الشامل
     * لأنها قد لا تكون محمّلة إذا لم يفتح المستخدم صفحة التدريب
     */
    async ensureTrainingDataForReport() {
        if (!AppState.appData) return;
        const needContractor = !Array.isArray(AppState.appData.contractorTrainings) || AppState.appData.contractorTrainings.length === 0;
        const needAttendance = !Array.isArray(AppState.appData.trainingAttendance);
        const needTraining = !Array.isArray(AppState.appData.training);
        if (!needContractor && !needAttendance && !needTraining) return;
        if (typeof GoogleIntegration === 'undefined' || typeof GoogleIntegration.sendRequest !== 'function') return;
        if (!AppState.googleConfig?.appsScript?.enabled || !AppState.googleConfig?.appsScript?.scriptUrl) return;
        try {
            const req = (action) => Promise.resolve(GoogleIntegration.sendRequest({ action, data: {} }))
                .then(r => (r && r.success && Array.isArray(r.data) ? r.data : []))
                .catch(() => []);
            const [contractorData, attendanceData, trainingData] = await Promise.all([
                needContractor ? req('getAllContractorTrainings') : Promise.resolve(AppState.appData.contractorTrainings || []),
                needAttendance ? req('getAllTrainingAttendance') : Promise.resolve(AppState.appData.trainingAttendance || []),
                needTraining ? req('getAllTrainings') : Promise.resolve(AppState.appData.training || [])
            ]);
            if (needContractor && Array.isArray(contractorData)) AppState.appData.contractorTrainings = contractorData;
            if (needAttendance && Array.isArray(attendanceData)) AppState.appData.trainingAttendance = attendanceData;
            if (needTraining && Array.isArray(trainingData)) AppState.appData.training = trainingData;
        } catch (e) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('تحميل بيانات التدريب للتقرير:', e);
        }
    },

    _filterArrayByDateRange(array, dateFields, startDate, endDate) {
        if (!Array.isArray(array) || !startDate || !endDate) return Array.isArray(array) ? array.slice() : [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return array.slice();
        }
        return array.filter(item => {
            if (!item || typeof item !== 'object') return false;
            let value = null;
            for (let i = 0; i < dateFields.length; i++) {
                const field = dateFields[i];
                if (item[field]) {
                    value = item[field];
                    break;
                }
            }
            if (!value) return false;
            const d = value instanceof Date ? value : new Date(value);
            if (isNaN(d.getTime())) return false;
            return d >= start && d <= end;
        });
    },

    async _askForPeriod() {
        const { t, lang } = this.getTranslations();
        try {
            const typePrompt = lang === 'ar'
                ? 'اختر نوع الفترة:\n1- شهري\n2- سنوي'
                : 'Choose period type:\n1- Monthly\n2- Yearly';
            const typeInput = window.prompt(typePrompt, '1');
            if (typeInput === null) {
                if (typeof Notification !== 'undefined' && Notification.info) {
                    Notification.info(t('msg.periodCancelled'));
                }
                return null;
            }
            const trimmedType = String(typeInput).trim();
            const isYearly = trimmedType === '2';

            if (!isYearly) {
                const monthPrompt = lang === 'ar'
                    ? 'أدخل السنة والشهر بصيغة YYYY-MM (مثال: 2026-02)'
                    : 'Enter year-month in format YYYY-MM (e.g. 2026-02)';
                const monthInput = window.prompt(monthPrompt);
                if (monthInput === null) {
                    if (typeof Notification !== 'undefined' && Notification.info) {
                        Notification.info(t('msg.periodCancelled'));
                    }
                    return null;
                }
                const match = /^(\d{4})-(\d{1,2})$/.exec(String(monthInput).trim());
                if (!match) {
                    if (typeof Notification !== 'undefined' && Notification.error) {
                        Notification.error(t('msg.invalidPeriodInput'));
                    }
                    return null;
                }
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10);
                if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
                    if (typeof Notification !== 'undefined' && Notification.error) {
                        Notification.error(t('msg.invalidPeriodInput'));
                    }
                    return null;
                }
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 0);
                const label = `${year}-${month.toString().padStart(2, '0')}`;
                return {
                    type: 'monthly',
                    year,
                    month,
                    startDate,
                    endDate,
                    label
                };
            } else {
                const nowYear = new Date().getFullYear();
                const yearPrompt = lang === 'ar'
                    ? 'أدخل السنة بصيغة YYYY (مثال: 2026)'
                    : 'Enter year in format YYYY (e.g. 2026)';
                const yearInput = window.prompt(yearPrompt, String(nowYear));
                if (yearInput === null) {
                    if (typeof Notification !== 'undefined' && Notification.info) {
                        Notification.info(t('msg.periodCancelled'));
                    }
                    return null;
                }
                const year = parseInt(String(yearInput).trim(), 10);
                if (!Number.isFinite(year)) {
                    if (typeof Notification !== 'undefined' && Notification.error) {
                        Notification.error(t('msg.invalidPeriodInput'));
                    }
                    return null;
                }
                const startDate = new Date(year, 0, 1);
                const endDate = new Date(year, 11, 31);
                const label = String(year);
                return {
                    type: 'yearly',
                    year,
                    startDate,
                    endDate,
                    label
                };
            }
        } catch (e) {
            if (typeof Utils !== 'undefined' && Utils.safeWarn) {
                Utils.safeWarn('Error in _askForPeriod:', e);
            }
            return null;
        }
    },

    async generateAndExport(type) {
        let printWindow = null;
        try {
            const { t } = this.getTranslations();

            if (typeof AppState === 'undefined' || !AppState.appData) {
                Notification.error(t('msg.noData'));
                return;
            }

            // فتح النافذة فوراً عند نقرة المستخدم لتجنب منع المتصفح للنوافذ المنبثقة (قبل أي await)
            printWindow = window.open('', '_blank');
            if (!printWindow) {
                Notification.error(t('msg.allowPopups'));
                return;
            }
            printWindow.document.write('<html dir="rtl"><body style="font-family: Arial; padding: 20px; text-align: center;"><p>جاري تحضير التقرير...</p></body></html>');
            printWindow.document.close();

            if (type === 'full') {
                await this.ensureTrainingDataForReport();
            } else if (type === 'period') {
                await this.ensureTrainingDataForReport();
            }

            const data = AppState.appData;
            let title = '';
            let content = '';

            switch (type) {
                case 'incidents':
                    title = t('report.incidents');
                    const incidentsData = data.incidents || [];
                    if (!Array.isArray(incidentsData)) {
                        Notification.error(t('msg.incidentsInvalid'));
                        if (printWindow) printWindow.close();
                        return;
                    }
                    content = this.generateIncidentsReport(incidentsData);
                    break;
                case 'training':
                    title = t('report.training');
                    const trainingData = data.training || [];
                    if (!Array.isArray(trainingData)) {
                        Notification.error(t('msg.trainingInvalid'));
                        if (printWindow) printWindow.close();
                        return;
                    }
                    content = this.generateTrainingReport(trainingData);
                    break;
                case 'period':
                    const period = await this._askForPeriod();
                    if (!period) {
                        if (printWindow) printWindow.close();
                        return;
                    }
                    title = `${t('report.periodSummary')} - ${period.label}`;
                    content = this.generatePeriodSummaryReport(data, period);
                    break;
                case 'full':
                    title = t('report.full');
                    content = this.generateFullReport(data);
                    break;
                default:
                    if (printWindow) printWindow.close();
                    throw new Error(t('msg.unknownReport'));
            }

            const formCode = `REPORT-${type.toUpperCase()}-${new Date().toISOString().slice(0, 10)}`;
            const htmlContent = typeof FormHeader !== 'undefined' && FormHeader.generatePDFHTML
                ? FormHeader.generatePDFHTML(formCode, title, content, false, true, { version: '1.0' }, new Date().toISOString(), new Date().toISOString())
                : `<html><body>${content}</body></html>`;

            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();

            setTimeout(() => {
                try {
                    printWindow.print();
                } catch (e) {
                    if (typeof Utils !== 'undefined' && Utils.safeWarn) Utils.safeWarn('طباعة التقرير:', e);
                }
            }, 300);
        } catch (err) {
            if (printWindow && typeof printWindow.close === 'function') printWindow.close();
            const msg = (typeof Notification !== 'undefined' && Notification.error)
                ? (err && err.message) || 'حدث خطأ عند استخراج التقرير'
                : (err && err.message) || 'حدث خطأ عند استخراج التقرير';
            if (typeof Notification !== 'undefined' && Notification.error) {
                Notification.error(msg);
            } else {
                console.error('Reports.generateAndExport:', err);
            }
        }
    },

    generateIncidentsReport(incidents) {
        const { t, lang } = this.getTranslations();
        const dateLocale = lang === 'ar' ? 'ar-SA' : 'en-GB';
        return `
            <div class="section-title">${t('report.totalIncidents')}: ${incidents.length}</div>
            <p style="margin-bottom: 20px; color: #666;">${t('report.createdDate')}: ${new Date().toLocaleDateString(dateLocale)}</p>
            <table>
                <thead>
                    <tr>
                        <th>${t('report.isoCode')}</th>
                        <th>${t('report.date')}</th>
                        <th>${t('report.location')}</th>
                        <th>${t('report.severity')}</th>
                        <th>${t('report.status')}</th>
                        <th>${t('report.description')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${incidents.map(incident => `
                        <tr>
                            <td>${Utils.escapeHTML(incident.isoCode || '')}</td>
                            <td>${incident.date ? Utils.formatDate(incident.date) : ''}</td>
                            <td>${Utils.escapeHTML(incident.location || '')}</td>
                            <td>${Utils.escapeHTML(incident.severity || '')}</td>
                            <td>${Utils.escapeHTML(incident.status || '')}</td>
                            <td>${Utils.escapeHTML((incident.description || '').substring(0, 100))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    generatePeriodSummaryReport(data, period) {
        const { t, lang } = this.getTranslations();
        const dateLocale = lang === 'ar' ? 'ar-SA' : 'en-GB';
        const startDate = period && period.startDate ? new Date(period.startDate) : null;
        const endDate = period && period.endDate ? new Date(period.endDate) : null;

        const incidents = this._filterArrayByDateRange(data.incidents || [], ['date', 'incidentDate', 'createdAt'], startDate, endDate);
        const nearmiss = this._filterArrayByDateRange(data.nearmiss || [], ['date', 'createdAt'], startDate, endDate);
        const ptw = this._filterArrayByDateRange(data.ptw || [], ['startDate', 'date', 'createdAt', 'endDate'], startDate, endDate);
        const observations = this._filterArrayByDateRange(data.dailyObservations || [], ['date', 'createdAt'], startDate, endDate);
        const clinicVisits = this._filterArrayByDateRange(data.clinicVisits || [], ['visitDate', 'date', 'createdAt'], startDate, endDate);

        const trainingAll = data.training || [];
        const trainingAttendanceAll = data.trainingAttendance || [];
        const contractorTrainingsAll = data.contractorTrainings || [];

        const training = this._filterArrayByDateRange(trainingAll, ['startDate', 'date', 'createdAt'], startDate, endDate);
        const trainingAttendance = this._filterArrayByDateRange(trainingAttendanceAll, ['date', 'attendanceDate', 'createdAt'], startDate, endDate);
        const contractorTrainings = this._filterArrayByDateRange(contractorTrainingsAll, ['date', 'trainingDate', 'startDate', 'createdAt'], startDate, endDate);

        const violationsAll = data.violations || [];
        const violations = this._filterArrayByDateRange(violationsAll, ['date', 'violationDate', 'createdAt'], startDate, endDate);

        // تدريب الموظفين
        const allParticipants = [];
        let totalTrainingHoursEmployees = 0;
        const uniqueEmployeeCodes = new Set();

        trainingAttendance.forEach(record => {
            if (record.employeeCode) uniqueEmployeeCodes.add(String(record.employeeCode).trim());
        });

        training.forEach(t => {
            if (t.participants && Array.isArray(t.participants)) {
                t.participants.forEach(p => {
                    const code = p.code || p.employeeNumber;
                    if (code && !allParticipants.find(ap => (ap.code || ap.employeeNumber) === code)) {
                        allParticipants.push(p);
                    }
                });
            }
            if (t.hours) {
                totalTrainingHoursEmployees += Number(parseFloat(t.hours)) || 0;
            } else if (t.duration) {
                totalTrainingHoursEmployees += Number(parseFloat(t.duration)) || 0;
            } else if (t.startTime && t.endTime) {
                try {
                    const start = new Date(`2000-01-01 ${t.startTime}`);
                    const end = new Date(`2000-01-01 ${t.endTime}`);
                    const diff = (end - start) / (1000 * 60 * 60);
                    totalTrainingHoursEmployees += Number.isFinite(diff) ? diff : 0;
                } catch (e) { /* ignore */ }
            }
        });

        const attendanceHours = trainingAttendance.reduce((sum, r) => {
            const h = parseFloat(r.totalHours);
            return sum + (Number.isFinite(h) ? h : 0);
        }, 0);
        if (attendanceHours > 0) {
            totalTrainingHoursEmployees = attendanceHours;
        }

        const countFromParticipants = allParticipants.length;
        const countFromTraining = typeof Training !== 'undefined' && Training.getParticipantsCount
            ? training.reduce((acc, t) => acc + Training.getParticipantsCount(t), 0)
            : training.reduce((acc, t) => {
                const n = Number(t.participantsCount) || 0;
                return acc + (Number.isFinite(n) ? n : 0);
            }, 0);
        const uniqueTrainees = uniqueEmployeeCodes.size > 0
            ? uniqueEmployeeCodes.size
            : (countFromParticipants > 0 ? countFromParticipants : countFromTraining);
        const avgTrainingHours = uniqueTrainees > 0
            ? (Number(totalTrainingHoursEmployees) / Number(uniqueTrainees)).toFixed(2)
            : '0.00';

        // عدد البرامج والموضوعات - الموظفين
        const employeeTrainingPrograms = training.length;
        const employeeTopicsSet = new Set();
        training.forEach(t => {
            const name = (t.name || t.programName || '').toString().trim();
            if (name) employeeTopicsSet.add(name);
        });
        const employeeTrainingTopics = employeeTopicsSet.size || employeeTrainingPrograms;

        // تدريب المقاولين
        const contractorTraineesCount = contractorTrainings.reduce((sum, t) => {
            const n = Number(t.traineesCount || t.attendees || 0);
            return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        const contractorTotalHours = contractorTrainings.reduce((sum, t) => {
            const h = parseFloat(t.totalHours || t.trainingHours || 0);
            return sum + (Number.isFinite(h) ? h : 0);
        }, 0);
        const contractorAvgHours = contractorTraineesCount > 0
            ? (contractorTotalHours / contractorTraineesCount).toFixed(2)
            : '0.00';

        const contractorTrainingPrograms = contractorTrainings.length;
        const contractorTopicsSet = new Set();
        contractorTrainings.forEach(t => {
            const name = (t.name || t.trainingName || t.topic || '').toString().trim();
            if (name) contractorTopicsSet.add(name);
        });
        const contractorTrainingTopics = contractorTopicsSet.size || contractorTrainingPrograms;

        // إحصائيات المخالفات
        const employeeViolations = violations.filter(v => v.violationType === 'موظفين' || v.category === 'موظفين' || (!v.contractorName && v.employeeName));
        const contractorViolations = violations.filter(v => v.violationType === 'مقاولين' || v.category === 'مقاولين' || v.contractorName);
        const violationsByDepartment = {};
        const violationsByType = {};

        violations.forEach(v => {
            const dept = v.department || v.employeeDepartment || 'غير محدد';
            violationsByDepartment[dept] = (violationsByDepartment[dept] || 0) + 1;
            const vType = (v.violationType || 'غير محدد').trim() || 'غير محدد';
            violationsByType[vType] = (violationsByType[vType] || 0) + 1;
        });

        const violationsByDeptHTML = Object.keys(violationsByDepartment).map(dept =>
            `<tr><td>${Utils.escapeHTML(dept)}</td><td>${violationsByDepartment[dept]}</td></tr>`
        ).join('');
        const violationsByTypeHTML = Object.keys(violationsByType).map(type =>
            `<tr><td>${Utils.escapeHTML(type)}</td><td>${violationsByType[type]}</td></tr>`
        ).join('');

        const hourLabel = t('report.hour');
        const periodTypeLabel = period.type === 'yearly' ? t('report.periodTypeYearly') : t('report.periodTypeMonthly');
        const periodRangeLabel = (startDate && endDate)
            ? `${startDate.toLocaleDateString(dateLocale)} - ${endDate.toLocaleDateString(dateLocale)}`
            : period.label;

        return `
            <div class="section-title">${t('report.periodSummary')}</div>
            <p style="margin-bottom: 10px; color: #666;">
                ${t('report.period')}: ${Utils.escapeHTML(periodRangeLabel)} (${Utils.escapeHTML(periodTypeLabel)})
            </p>
            <p style="margin-bottom: 20px; color: #666;">
                ${t('report.createdDate')}: ${new Date().toLocaleDateString(dateLocale)}
            </p>

            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.basicStats')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.type')}</th>
                        <th>${t('report.total')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.ptw')}</td>
                        <td>${ptw.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.observations')}</td>
                        <td>${observations.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.incidents')}</td>
                        <td>${incidents.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.nearmiss')}</td>
                        <td>${nearmiss.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.clinicVisits')}</td>
                        <td>${clinicVisits.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.trainingPrograms')}</td>
                        <td>${training.length + contractorTrainings.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.violations')}</td>
                        <td>${violations.length}</td>
                    </tr>
                </tbody>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.trainingSection')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.indicator')}</th>
                        <th>${t('report.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.employeeTrainingPrograms')}</td>
                        <td>${employeeTrainingPrograms}</td>
                    </tr>
                    <tr>
                        <td>${t('report.employeeTrainingTopics')}</td>
                        <td>${employeeTrainingTopics}</td>
                    </tr>
                    <tr>
                        <td>${t('report.traineesCount')}</td>
                        <td>${uniqueTrainees}</td>
                    </tr>
                    <tr>
                        <td>${t('report.avgTrainingHoursEmployees')}</td>
                        <td>${avgTrainingHours} ${hourLabel}</td>
                    </tr>
                    <tr>
                        <td>${t('report.totalTrainingHoursEmployees')}</td>
                        <td>${Number(totalTrainingHoursEmployees).toFixed(2)} ${hourLabel}</td>
                    </tr>
                </tbody>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.trainingContractors')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.indicator')}</th>
                        <th>${t('report.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.contractorTrainingPrograms')}</td>
                        <td>${contractorTrainingPrograms}</td>
                    </tr>
                    <tr>
                        <td>${t('report.contractorTrainingTopics')}</td>
                        <td>${contractorTrainingTopics}</td>
                    </tr>
                    <tr>
                        <td>${t('report.traineesContractors')}</td>
                        <td>${contractorTraineesCount}</td>
                    </tr>
                    <tr>
                        <td>${t('report.avgTrainingContractors')}</td>
                        <td>${contractorAvgHours} ${hourLabel}</td>
                    </tr>
                    <tr>
                        <td>${t('report.totalTrainingContractors')}</td>
                        <td>${Number(contractorTotalHours).toFixed(2)} ${hourLabel}</td>
                    </tr>
                </tbody>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.violationsSection')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.indicator')}</th>
                        <th>${t('report.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.employeeViolations')}</td>
                        <td>${employeeViolations.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.contractorViolations')}</td>
                        <td>${contractorViolations.length}</td>
                    </tr>
                </tbody>
            </table>

            ${violationsByTypeHTML ? `
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.violationsByType')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.violationType')}</th>
                        <th>${t('report.violationsCount')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${violationsByTypeHTML}
                </tbody>
            </table>
            ` : ''}

            ${violationsByDeptHTML ? `
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.violationsByDept')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.department')}</th>
                        <th>${t('report.violationsCount')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${violationsByDeptHTML}
                </tbody>
            </table>
            ` : ''}
        `;
    },

    generateTrainingReport(training) {
        const { t, lang } = this.getTranslations();
        const dateLocale = lang === 'ar' ? 'ar-SA' : 'en-GB';
        return `
            <div class="section-title">${t('report.totalPrograms')}: ${training.length}</div>
            <p style="margin-bottom: 20px; color: #666;">${t('report.createdDate')}: ${new Date().toLocaleDateString(dateLocale)}</p>
            <table>
                <thead>
                    <tr>
                        <th>${t('report.programName')}</th>
                        <th>${t('report.date')}</th>
                        <th>${t('report.trainer')}</th>
                        <th>${t('report.participantsCount')}</th>
                        <th>${t('report.status')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${training.map(tr => `
                        <tr>
                            <td>${Utils.escapeHTML(tr.name || '')}</td>
                            <td>${tr.startDate ? Utils.formatDate(tr.startDate) : ''}</td>
                            <td>${Utils.escapeHTML(tr.trainer || '')}</td>
                            <td>${typeof Training !== 'undefined' && Training.getParticipantsCount ? Training.getParticipantsCount(tr) : (tr.participants?.length || tr.participantsCount || 0)}</td>
                            <td>${Utils.escapeHTML(tr.status || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    generateFullReport(data) {
        // حساب إحصائيات التدريب للموظفين
        const training = data.training || [];
        const trainingAttendance = data.trainingAttendance || [];
        const contractorTrainings = data.contractorTrainings || [];
        const allParticipants = [];
        let totalTrainingHoursEmployees = 0;

        // عدد المتدربين الفريدين من سجلات الحضور (أدق مصدر)
        const uniqueEmployeeCodes = new Set();
        trainingAttendance.forEach(record => {
            if (record.employeeCode) uniqueEmployeeCodes.add(String(record.employeeCode).trim());
        });

        training.forEach(t => {
            if (t.participants && Array.isArray(t.participants)) {
                t.participants.forEach(p => {
                    const code = p.code || p.employeeNumber;
                    if (code && !allParticipants.find(ap => (ap.code || ap.employeeNumber) === code)) {
                        allParticipants.push(p);
                    }
                });
            }
            // حساب ساعات التدريب من برامج التدريب (إذا لم تُستخدم trainingAttendance)
            if (t.hours) {
                totalTrainingHoursEmployees += Number(parseFloat(t.hours)) || 0;
            } else if (t.duration) {
                totalTrainingHoursEmployees += Number(parseFloat(t.duration)) || 0;
            } else if (t.startTime && t.endTime) {
                try {
                    const start = new Date(`2000-01-01 ${t.startTime}`);
                    const end = new Date(`2000-01-01 ${t.endTime}`);
                    const diff = (end - start) / (1000 * 60 * 60);
                    totalTrainingHoursEmployees += Number.isFinite(diff) ? diff : 0;
                } catch (e) { /* تجاهل */ }
            }
        });

        // ساعات التدريب من سجلات الحضور (مصدر أساسي عند التوفر)
        const attendanceHours = trainingAttendance.reduce((sum, r) => {
            const h = parseFloat(r.totalHours);
            return sum + (Number.isFinite(h) ? h : 0);
        }, 0);
        if (attendanceHours > 0) {
            totalTrainingHoursEmployees = attendanceHours;
        }

        // عدد المتدربين: أولوية لسجلات الحضور ثم للمشاركين الفريدين ثم لمجموع participantsCount (كأرقام دائماً)
        const countFromParticipants = allParticipants.length;
        const countFromTraining = typeof Training !== 'undefined' && Training.getParticipantsCount
            ? training.reduce((acc, t) => acc + Training.getParticipantsCount(t), 0)
            : training.reduce((acc, t) => {
                const n = Number(t.participantsCount) || 0;
                return acc + (Number.isFinite(n) ? n : 0);
            }, 0);
        const uniqueTrainees = uniqueEmployeeCodes.size > 0
            ? uniqueEmployeeCodes.size
            : (countFromParticipants > 0 ? countFromParticipants : countFromTraining);
        const avgTrainingHours = uniqueTrainees > 0
            ? (Number(totalTrainingHoursEmployees) / Number(uniqueTrainees)).toFixed(2)
            : '0.00';

        // حساب إحصائيات التدريب للمقاولين
        const contractorTraineesCount = contractorTrainings.reduce((sum, t) => {
            const n = Number(t.traineesCount || t.attendees || 0);
            return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        const contractorTotalHours = contractorTrainings.reduce((sum, t) => {
            const h = parseFloat(t.totalHours || t.trainingHours || 0);
            return sum + (Number.isFinite(h) ? h : 0);
        }, 0);
        const contractorAvgHours = contractorTraineesCount > 0
            ? (contractorTotalHours / contractorTraineesCount).toFixed(2)
            : '0.00';

        // حساب إحصائيات المخالات
        const violations = data.violations || [];
        const employeeViolations = violations.filter(v => v.violationType === 'موظفين' || v.category === 'موظفين' || (!v.contractorName && v.employeeName));
        const contractorViolations = violations.filter(v => v.violationType === 'مقاولين' || v.category === 'مقاولين' || v.contractorName);
        const violationsByDepartment = {};
        const violationsByType = {};

        violations.forEach(v => {
            const dept = v.department || v.employeeDepartment || 'غير محدد';
            violationsByDepartment[dept] = (violationsByDepartment[dept] || 0) + 1;
            const vType = (v.violationType || 'غير محدد').trim() || 'غير محدد';
            violationsByType[vType] = (violationsByType[vType] || 0) + 1;
        });

        const violationsByDeptHTML = Object.keys(violationsByDepartment).map(dept =>
            `<tr><td>${Utils.escapeHTML(dept)}</td><td>${violationsByDepartment[dept]}</td></tr>`
        ).join('');
        const violationsByTypeHTML = Object.keys(violationsByType).map(type =>
            `<tr><td>${Utils.escapeHTML(type)}</td><td>${violationsByType[type]}</td></tr>`
        ).join('');

        const { t, lang } = this.getTranslations();
        const dateLocale = lang === 'ar' ? 'ar-SA' : 'en-GB';
        const hourLabel = t('report.hour');

        return `
            <div class="section-title">${t('report.generalStats')}</div>
            <p style="margin-bottom: 20px; color: #666;">${t('report.createdDate')}: ${new Date().toLocaleDateString(dateLocale)}</p>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.basicStats')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.type')}</th>
                        <th>${t('report.total')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.incidents')}</td>
                        <td>${(data.incidents || []).length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.nearmiss')}</td>
                        <td>${(data.nearmiss || []).length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.ptw')}</td>
                        <td>${(data.ptw || []).length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.trainingPrograms')}</td>
                        <td>${training.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.violations')}</td>
                        <td>${violations.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.clinicVisits')}</td>
                        <td>${(data.clinicVisits || []).length}</td>
                    </tr>
                </tbody>
            </table>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.trainingSection')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.indicator')}</th>
                        <th>${t('report.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.traineesCount')}</td>
                        <td>${uniqueTrainees}</td>
                    </tr>
                    <tr>
                        <td>${t('report.avgTrainingHoursEmployees')}</td>
                        <td>${avgTrainingHours} ${hourLabel}</td>
                    </tr>
                    <tr>
                        <td>${t('report.totalTrainingHoursEmployees')}</td>
                        <td>${Number(totalTrainingHoursEmployees).toFixed(2)} ${hourLabel}</td>
                    </tr>
                </tbody>
            </table>

            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.trainingContractors')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.indicator')}</th>
                        <th>${t('report.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.traineesContractors')}</td>
                        <td>${contractorTraineesCount}</td>
                    </tr>
                    <tr>
                        <td>${t('report.avgTrainingContractors')}</td>
                        <td>${contractorAvgHours} ${hourLabel}</td>
                    </tr>
                    <tr>
                        <td>${t('report.totalTrainingContractors')}</td>
                        <td>${Number(contractorTotalHours).toFixed(2)} ${hourLabel}</td>
                    </tr>
                </tbody>
            </table>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.violationsSection')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.indicator')}</th>
                        <th>${t('report.value')}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t('report.employeeViolations')}</td>
                        <td>${employeeViolations.length}</td>
                    </tr>
                    <tr>
                        <td>${t('report.contractorViolations')}</td>
                        <td>${contractorViolations.length}</td>
                    </tr>
                </tbody>
            </table>
            
            ${violationsByTypeHTML ? `
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.violationsByType')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.violationType')}</th>
                        <th>${t('report.violationsCount')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${violationsByTypeHTML}
                </tbody>
            </table>
            ` : ''}
            
            ${violationsByDeptHTML ? `
            <h3 style="margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;">${t('report.violationsByDept')}</h3>
            <table style="margin-bottom: 30px;">
                <thead>
                    <tr>
                        <th>${t('report.department')}</th>
                        <th>${t('report.violationsCount')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${violationsByDeptHTML}
                </tbody>
            </table>
            ` : ''}
        `;
    }
};

// ===== Export module to global scope =====
// تصدير الموديول إلى window فوراً لضمان توافره
(function () {
    'use strict';
    try {
        if (typeof window !== 'undefined' && typeof Reports !== 'undefined') {
            window.Reports = Reports;
            
            // إشعار عند تحميل الموديول بنجاح
            if (typeof AppState !== 'undefined' && AppState.debugMode && typeof Utils !== 'undefined' && Utils.safeLog) {
                Utils.safeLog('✅ Reports module loaded and available on window.Reports');
            }
        }
    } catch (error) {
        console.error('❌ خطأ في تصدير Reports:', error);
        // محاولة التصدير مرة أخرى حتى في حالة الخطأ
        if (typeof window !== 'undefined' && typeof Reports !== 'undefined') {
            try {
                window.Reports = Reports;
            } catch (e) {
                console.error('❌ فشل تصدير Reports:', e);
            }
        }
    }
})();